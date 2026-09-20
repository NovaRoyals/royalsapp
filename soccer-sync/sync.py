"""FXA LeagueLab → Supabase. Playwright required (plain HTTP is an auth overlay)."""

from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone

from fxa_parse import TEAMS, parse_standings, parse_team_schedule, standings_url, team_url


def supabase():
    from supabase import create_client

    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])


def fetch_html(url: str) -> str:
    from playwright.sync_api import sync_playwright

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(2000)
        overlay = page.locator("text=Sign In").first
        if overlay.count():
            page.keyboard.press("Escape")
            page.wait_for_timeout(500)
        html = page.content()
        browser.close()
        return html


def side_for_league(league_id: int) -> str:
    for key, meta in TEAMS.items():
        if meta["league_id"] == league_id:
            return key
    raise SystemExit(f"unknown league_id {league_id}")


def upsert_side(sb, side: str) -> int:
    meta = TEAMS[side]
    started = datetime.now(timezone.utc).isoformat()
    team_html = fetch_html(team_url(meta["team_id"], meta["slug"]))
    standings_html = fetch_html(standings_url(meta["league_id"]))
    matches = parse_team_schedule(
        team_html,
        league_id=meta["league_id"],
        team_id=meta["team_id"],
        canonical=meta["canonical"],
        league_name=meta["league_name"],
    )
    standings = parse_standings(standings_html, meta["league_id"])
    count = 0
    error = None
    status = "ok"
    try:
        if matches:
            sb.table("soccer_matches").upsert(matches, on_conflict="league_id,team_id,opponent_name,played_at").execute()
            count = len(matches)
        if standings:
            sb.table("soccer_standings").delete().eq("league_id", meta["league_id"]).execute()
            sb.table("soccer_standings").insert(standings).execute()
    except Exception as exc:  # noqa: BLE001
        status = "error"
        error = str(exc)
        raise
    finally:
        sb.table("soccer_sync_runs").insert(
            {
                "started_at": started,
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "league_id": meta["league_id"],
                "matches_upserted": count,
                "status": status,
                "error": error,
            }
        ).execute()
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", nargs="?", default="backfill", choices=["backfill"])
    parser.add_argument("--league-id", type=int)
    args = parser.parse_args()
    sb = supabase()
    if args.league_id:
        print(upsert_side(sb, side_for_league(args.league_id)))
        return
    total = 0
    for side in TEAMS:
        total += upsert_side(sb, side)
    print(total)


if __name__ == "__main__":
    main()
