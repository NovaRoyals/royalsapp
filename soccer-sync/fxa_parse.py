"""FXA LeagueLab HTML — selectors pinned 2026-09-20 from live Chromium."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

ET = ZoneInfo("America/New_York")
BASE = "https://fxasports.leaguelab.com"

CANONICAL_TEAM = {
    1059849: "NOVA ROYALS AC 35+",
    1033671: "NOVA ROYALS AC 35+",
    1031597: "NOVA ROYALS AC 35+",
    1059119: "NOVA ROYALS AC",
    1033558: "NOVA ROYALS AC",
    1031588: "NOVA ROYALS AC",
    1030675: "NOVA ROYALS AC",
    1030670: "NOVA ROYALS AC",
    1029717: "NOVA ROYALS AC",
}

TEAMS = {
    "35plus": {
        "league_id": 105789,
        "team_id": 1059849,
        "slug": "NOVA-ROYALS-AC",
        "canonical": "NOVA ROYALS AC 35+",
        "league_name": "Thursday Men's 8v8 (35+) Soccer | Fall '26",
        "schedule_url": f"{BASE}/league/105789/schedule",
        "details_url": f"{BASE}/league/105789/details",
    },
    "open": {
        "league_id": 105797,
        "team_id": 1059119,
        "slug": "NOVA-ROYALS-AC",
        "canonical": "NOVA ROYALS AC",
        "league_name": "Sunday Night Men's 8v8 Soccer | Fall '26",
        "schedule_url": f"{BASE}/league/105797/schedule",
        "details_url": f"{BASE}/league/105797/details",
    },
}


def team_url(team_id: int, slug: str) -> str:
    return f"{BASE}/team/{team_id}/{slug}"


def standings_url(league_id: int) -> str:
    return f"{BASE}/league/{league_id}/standings"


def parse_team_record(html: str) -> dict[str, int]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("#teamRecord")
    if not table:
        return {"wins": 0, "losses": 0, "draws": 0}
    cells = [c.get_text(strip=True) for c in table.select("tbody td")]
    if len(cells) < 3:
        return {"wins": 0, "losses": 0, "draws": 0}
    return {"wins": int(cells[0] or 0), "losses": int(cells[1] or 0), "draws": int(cells[2] or 0)}


def _parse_clock(time_label: str) -> tuple[int, int]:
    match = re.search(r"(\d{1,2}):(\d{2})\s*(AM|PM)", time_label, re.I)
    if not match:
        return 20, 0
    hour = int(match.group(1)) % 12
    minute = int(match.group(2))
    if match.group(3).upper() == "PM":
        hour += 12
    return hour, minute


def _played_at(ymd: str, time_label: str) -> str:
    hour, minute = _parse_clock(time_label)
    year, month, day = (int(part) for part in ymd.split("-"))
    when = datetime(year, month, day, hour, minute, tzinfo=ET)
    return when.isoformat()


def _recap_url(league_id: int, ymd: str, time_label: str, field_id: str, seq: str) -> str:
    hour, minute = _parse_clock(time_label)
    stamp = f"{ymd}_{hour:02d}-{minute:02d}-00"
    return f"{BASE}/gamerecap/{league_id}/d_{stamp}_{field_id}_{seq}"


def parse_team_schedule(html: str, *, league_id: int, team_id: int, canonical: str, league_name: str) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("#teamScheduleTable")
    if not table:
        return []
    rows: list[dict[str, Any]] = []
    current_ymd = ""
    current_time_hint = ""
    for tr in table.select("tr"):
        classes = tr.get("class") or []
        if "gameDateRow" in classes:
            heading = tr.select_one("h4")
            if heading:
                parsed = datetime.strptime(heading.get_text(strip=True), "%A, %B %d")
                current_ymd = f"{datetime.now(ET).year}-{parsed.month:02d}-{parsed.day:02d}"
            continue
        row_id = tr.get("id") or ""
        if not row_id.startswith("game_"):
            continue
        detail = tr.select_one(".detailLink")
        detail_id = detail.get("id") if detail else ""
        ymd, field_id, seq = current_ymd, "", "1"
        detail_match = re.match(r"game_(\d{4}-\d{2}-\d{2})_(.+)_(\d+)_(\d+)", detail_id or "")
        if detail_match:
            ymd = detail_match.group(1)
            current_time_hint = detail_match.group(2)
            field_id = detail_match.group(3)
            seq = detail_match.group(4)
        time_label = _text(tr.select_one(".gameTime"))
        loc = tr.select_one(".gameLocation")
        venue = ""
        field = ""
        if loc:
            venue_link = loc.select_one("a")
            venue = venue_link.get_text(strip=True) if venue_link else ""
            leftover = loc.get_text(" ", strip=True)
            leftover = leftover.replace("Cancelled", "").replace(venue, "").strip()
            field = leftover
        home_label = _text(tr.select_one(".homeOrVisitor"))
        opponent = _text(tr.select_one(".opponent a"))
        result_el = tr.select_one(".result")
        result_text = result_el.get_text(" ", strip=True) if result_el else ""
        status = "scheduled"
        royals_score = None
        opponent_score = None
        recap = None
        score = re.search(r"(Win|Loss|Tie|Draw)\s*(\d+)\s*[-–]\s*(\d+)", result_text, re.I)
        if score:
            status = "completed"
            royals_score = int(score.group(2))
            opponent_score = int(score.group(3))
            if field_id:
                recap = _recap_url(league_id, ymd, time_label or current_time_hint, field_id, seq)
        rows.append(
            {
                "source": "fxa",
                "league_id": league_id,
                "league_name": league_name,
                "division": "Competitive",
                "team_id": team_id,
                "canonical_team": canonical,
                "played_at": _played_at(ymd, time_label),
                "venue": venue or None,
                "field": field or None,
                "opponent_name": opponent,
                "home_away": "H" if home_label.lower().startswith("home") else "V" if home_label.lower().startswith("vis") else None,
                "royals_score": royals_score,
                "opponent_score": opponent_score,
                "status": status,
                "gamerecap_url": recap,
            }
        )
    return rows


def _text(node) -> str:
    return " ".join(node.get_text().split()) if node else ""


def parse_standings(html: str, league_id: int) -> list[dict[str, Any]]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict[str, Any]] = []
    for heading in soup.select("h2.divisionName"):
        division = heading.get_text(strip=True).replace(" Standings", "")
        table = heading.find_next_sibling("table", class_="divisionStandings")
        if not table:
            continue
        for tr in table.select("tbody tr"):
            rank_cell = tr.select_one(".teamRank")
            name_link = tr.select_one("a.teamPageLink")
            if not rank_cell or not name_link:
                continue
            href = name_link.get("href") or ""
            tid_match = re.search(r"/team/(\d+)/", href)
            cells = tr.find_all("td")
            numeric = [c.get_text(strip=True) for c in cells[2:7]]
            if len(numeric) < 5:
                continue
            rows.append(
                {
                    "league_id": league_id,
                    "team_id": int(tid_match.group(1)) if tid_match else None,
                    "division": division,
                    "team_name": name_link.get_text(strip=True),
                    "rank": int(rank_cell.get_text(strip=True) or 0),
                    "wins": int(numeric[0] or 0),
                    "losses": int(numeric[1] or 0),
                    "draws": int(numeric[2] or 0),
                    "point_diff": int(numeric[3] or 0),
                    "ranking_points": int(numeric[4] or 0),
                }
            )
    return rows


def parse_related_teams(html: str) -> list[dict[str, str]]:
    soup = BeautifulSoup(html, "html.parser")
    table = soup.select_one("#relatedTeamsTable")
    if not table:
        return []
    items = []
    for tr in table.select("tr"):
        link = tr.select_one("a")
        league = tr.select_one(".leagueName")
        if not link:
            continue
        items.append({"name": link.get_text(strip=True), "league": league.get_text(strip=True) if league else "", "href": link.get("href") or ""})
    return items
