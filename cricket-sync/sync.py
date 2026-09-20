"""CCPL → Supabase sync. Requests first, Playwright Chromium fallback (Cloudflare)."""

from __future__ import annotations

import argparse
import os
import time
from datetime import datetime, timezone
from typing import Any

import requests
from bs4 import BeautifulSoup

from ccpl_parse import (
    find_live_match,
    is_match_complete,
    official_scorecard_url,
    parse_ballbyball,
    parse_full_scorecard,
    parse_info,
    parse_results,
)
from name_map import SQUAD, resolve_player

BASE = "https://www.ccplt20.net/CCPLT20"
TEAM_ID = 1393
CLUB_ID = 88
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml",
}


def supabase():
    from supabase import create_client

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


def fetch_html(url: str) -> str:
    try:
        res = requests.get(url, headers=HEADERS, timeout=30)
        text = res.text or ""
        if res.status_code == 200 and "Just a moment" not in text and "cf-browser-verification" not in text:
            return text
    except requests.RequestException:
        pass
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2500)
        html = page.content()
        browser.close()
        return html


def results_url() -> str:
    return f"{BASE}/teamResults.do?teamId={TEAM_ID}&clubId={CLUB_ID}"


def info_url(match_id: int) -> str:
    return f"{BASE}/info.do?matchId={match_id}&clubId={CLUB_ID}"


def scorecard_url(match_id: int) -> str:
    return f"{BASE}/fullScorecard.do?matchId={match_id}&clubId={CLUB_ID}"


def balls_url(match_id: int) -> str:
    return f"{BASE}/ballbyball.do?matchId={match_id}&clubId={CLUB_ID}"


def upsert_players(sb) -> None:
    rows = [
        {
            "full_name": p.full_name,
            "short_name": p.short_name,
            "role": p.role,
            "is_captain": p.is_captain,
            "is_vice_captain": p.is_vice_captain,
            "is_keeper": p.is_keeper,
        }
        for p in SQUAD
    ]
    sb.table("cricket_players").upsert(rows, on_conflict="full_name").execute()


def result_type(text: str, status: str) -> str | None:
    if status == "live":
        return None
    t = (text or "").lower()
    if "tied" in t:
        return "tie"
    if "no result" in t:
        return "no_result"
    if "won by" in t and "royals" in t:
        return "win"
    if "won by" in t:
        return "loss"
    return None


def backfill(sb, match_ids: list[int] | None = None) -> None:
    upsert_players(sb)
    html = fetch_html(results_url())
    fixtures = parse_results(html)
    if match_ids:
        fixtures = [f for f in fixtures if f["ccpl_match_id"] in match_ids]
    for row in fixtures:
        mid = row["ccpl_match_id"]
        if not mid:
            continue
        info = parse_info(fetch_html(info_url(mid)))
        payload = {
            "ccpl_match_id": mid,
            "played_at": row["played_at"],
            "venue": info.get("venue"),
            "opponent_name": row["opponent_name"],
            "toss": info.get("toss"),
            "umpires": info.get("umpires"),
            "result_text": row["result_text"] or row.get("live_score"),
            "result_type": result_type(row["result_text"] or "", row["status"]),
            "player_of_match": info.get("player_of_match"),
            "status": row["status"],
        }
        saved = sb.table("cricket_matches").upsert(payload, on_conflict="ccpl_match_id").execute().data[0]
        match_uuid = saved["id"]
        if row["status"] == "scheduled":
            continue
        innings = parse_full_scorecard(fetch_html(scorecard_url(mid)))
        xi = [b["player_name"] for inn in innings for b in inn.get("batting", [])]
        for inn in innings:
            inn_row = {
                "match_id": match_uuid,
                "innings_no": inn["innings_no"],
                "runs": inn.get("runs"),
                "wickets": inn.get("wickets"),
                "overs": inn.get("overs"),
                "extras": inn.get("extras"),
                "fow": inn.get("fow"),
            }
            inn_saved = (
                sb.table("cricket_innings")
                .upsert(inn_row, on_conflict="match_id,innings_no")
                .execute()
                .data[0]
            )
            inn_id = inn_saved["id"]
            sb.table("cricket_batting").delete().eq("innings_id", inn_id).execute()
            for i, bat in enumerate(inn.get("batting", []), start=1):
                player = resolve_player(bat["player_name"], xi=xi, player_id=bat.get("ccpl_player_id"))
                sb.table("cricket_batting").insert({
                    "innings_id": inn_id,
                    "player_id": None if player is None else _player_uuid(sb, player.full_name),
                    "player_name": bat["player_name"],
                    "batting_order": i,
                    "runs": bat["runs"],
                    "balls": bat["balls"],
                    "fours": bat["fours"],
                    "sixes": bat["sixes"],
                    "dismissal": bat.get("dismissal"),
                }).execute()
            sb.table("cricket_bowling").delete().eq("innings_id", inn_id).execute()
            for bowl in inn.get("bowling", []):
                player = resolve_player(bowl["player_name"], xi=xi, player_id=bowl.get("ccpl_player_id"))
                sb.table("cricket_bowling").insert({
                    "innings_id": inn_id,
                    "player_id": None if player is None else _player_uuid(sb, player.full_name),
                    "player_name": bowl["player_name"],
                    "overs": bowl["overs"],
                    "maidens": bowl["maidens"],
                    "runs": bowl["runs"],
                    "wickets": bowl["wickets"],
                    "wides": bowl.get("wides") or 0,
                    "no_balls": bowl.get("no_balls") or 0,
                }).execute()
        balls = parse_ballbyball(fetch_html(balls_url(mid)))
        for ball in balls:
            sb.table("cricket_balls").upsert(
                {
                    "match_id": match_uuid,
                    "innings_no": ball["innings_no"],
                    "seq": ball["seq"],
                    "over_label": ball.get("over_label"),
                    "batter": ball.get("batter"),
                    "bowler": ball.get("bowler"),
                    "runs": ball.get("runs"),
                    "is_wicket": ball.get("is_wicket"),
                    "extras": ball.get("extras"),
                    "commentary": ball.get("commentary"),
                },
                on_conflict="match_id,innings_no,seq",
            ).execute()
        print("synced", mid, official_scorecard_url(mid))


def _player_uuid(sb, full_name: str) -> str | None:
    data = sb.table("cricket_players").select("id").eq("full_name", full_name).limit(1).execute().data
    return data[0]["id"] if data else None


def poll(sb, match_id: int, interval: int = 30) -> None:
    started = datetime.now(timezone.utc).isoformat()
    run = sb.table("cricket_sync_runs").insert({"ccpl_match_id": match_id, "started_at": started}).execute().data[0]
    added = 0
    try:
        while True:
            html = fetch_html(balls_url(match_id))
            complete = is_match_complete(html)
            match_row = sb.table("cricket_matches").select("id").eq("ccpl_match_id", match_id).limit(1).execute().data
            if not match_row:
                backfill(sb, [match_id])
                match_row = sb.table("cricket_matches").select("id").eq("ccpl_match_id", match_id).limit(1).execute().data
            match_uuid = match_row[0]["id"]
            existing = {
                (r["innings_no"], r["seq"])
                for r in sb.table("cricket_balls").select("innings_no,seq").eq("match_id", match_uuid).execute().data
            }
            for ball in parse_ballbyball(html):
                key = (ball["innings_no"], ball["seq"])
                if key in existing:
                    continue
                sb.table("cricket_balls").insert({
                    "match_id": match_uuid,
                    "innings_no": ball["innings_no"],
                    "seq": ball["seq"],
                    "commentary": ball.get("commentary"),
                    "runs": ball.get("runs"),
                    "is_wicket": ball.get("is_wicket"),
                    "extras": ball.get("extras"),
                }).execute()
                existing.add(key)
                added += 1
            score_el = BeautifulSoup(html, "html.parser").find("h4")
            sb.table("cricket_live_state").upsert({
                "match_id": match_uuid,
                "score_text": score_el.get_text(" ", strip=True) if score_el else None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).execute()
            if complete:
                sb.table("cricket_matches").update({"status": "completed"}).eq("id", match_uuid).execute()
                break
            time.sleep(interval)
        sb.table("cricket_sync_runs").update({
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "balls_added": added,
            "status": "ok",
        }).eq("id", run["id"]).execute()
    except Exception as exc:  # noqa: BLE001 — operator log
        sb.table("cricket_sync_runs").update({
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "balls_added": added,
            "status": "error",
            "error": str(exc),
        }).eq("id", run["id"]).execute()
        raise


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["backfill", "poll", "discover"])
    parser.add_argument("--match-id", type=int)
    args = parser.parse_args()
    sb = supabase()
    if args.command == "backfill":
        backfill(sb, [args.match_id] if args.match_id else None)
    elif args.command == "discover":
        live = find_live_match(fetch_html(results_url()))
        if live:
            print(live["ccpl_match_id"])
        else:
            print("")
    else:
        if not args.match_id:
            raise SystemExit("poll requires --match-id")
        poll(sb, args.match_id)


if __name__ == "__main__":
    main()
