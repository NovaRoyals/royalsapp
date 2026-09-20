"""CCPL / CricClubs HTML parsers. Markup facts: cricket build brief 2026-09-20."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import parse_qs, urlparse

from bs4 import BeautifulSoup, Tag

PLAYER_HREF = re.compile(r"viewPlayer\.do\?playerId=(\d+)", re.I)
MATCH_HREF = re.compile(r"viewScorecard\.do\?[^\"']*matchId=(\d+)", re.I)
LIVE_SCORE = re.compile(r":\s*\d+/\d+\s*\(\s*[\d.]+/\d+\s*ov", re.I)
WON_BY = re.compile(r"won by", re.I)
MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


def _soup(html: str) -> BeautifulSoup:
    return BeautifulSoup(html, "html.parser")


def _text(node: Tag | None) -> str:
    if node is None:
        return ""
    return re.sub(r"\s+", " ", node.get_text(" ", strip=True)).strip()


def player_id_from_href(href: str | None) -> int | None:
    if not href:
        return None
    m = PLAYER_HREF.search(href)
    return int(m.group(1)) if m else None


def match_id_from_href(href: str | None) -> int | None:
    if not href:
        return None
    parsed = urlparse(href)
    q = parse_qs(parsed.query)
    if "matchId" in q:
        return int(q["matchId"][0])
    m = MATCH_HREF.search(href)
    return int(m.group(1)) if m else None


def parse_results(html: str) -> list[dict[str, Any]]:
    soup = _soup(html)
    out: list[dict[str, Any]] = []
    for link in soup.select("a.btn.btn-sc"):
        href = link.get("href") or ""
        match_id = match_id_from_href(href)
        h3 = link.find_previous("h3")
        headline = _text(h3).replace(" v ", " v ")
        teams = re.split(r"\s+v\s+", headline, maxsplit=1, flags=re.I)
        home = teams[0].strip() if teams else ""
        away = teams[1].strip() if len(teams) > 1 else ""
        h4s: list[Tag] = []
        cursor = link
        for _ in range(8):
            prev = cursor.find_previous("h4") if cursor else None
            if not prev:
                break
            h4s.append(prev)
            cursor = prev
        result_text = ""
        live_score = None
        status = "completed"
        for block in h4s:
            t = _text(block)
            if not t or "Manassas" in t and "Fall" in t:
                continue
            if LIVE_SCORE.search(t) and not WON_BY.search(t):
                live_score = t
                status = "live"
                break
            if WON_BY.search(t) or "tied" in t.lower() or "no result" in t.lower():
                result_text = t
                status = "completed"
                break
        day_el = link.find_previous("h2")
        month_el = day_el.find_next("h5") if day_el else None
        day = _text(day_el)
        month_year = _text(month_el)
        played_at = _parse_date(day, month_year)
        opponent = away if "royals" in home.lower() else home
        if "royals" not in headline.lower():
            opponent = away or home
        out.append({
            "ccpl_match_id": match_id,
            "headline": headline,
            "home": home,
            "away": away,
            "opponent_name": opponent,
            "result_text": result_text,
            "live_score": live_score,
            "status": status,
            "played_at": played_at,
            "scorecard_href": href,
        })
    return out


def find_live_match(html: str) -> dict[str, Any] | None:
    for row in parse_results(html):
        if row["status"] == "live":
            return row
    return None


def is_match_complete(html: str) -> bool:
    return bool(WON_BY.search(_soup(html).get_text(" ", strip=True)))


def _parse_date(day: str, month_year: str) -> str | None:
    try:
        d = int(re.sub(r"\D", "", day))
        parts = month_year.split()
        month = MONTHS[parts[0][:3].lower()]
        year = int(parts[1])
        return f"{year:04d}-{month:02d}-{d:02d}"
    except (ValueError, IndexError, KeyError):
        return None


def parse_info(html: str) -> dict[str, Any]:
    soup = _soup(html)
    info: dict[str, Any] = {}
    for row in soup.select("tr"):
        cells = row.find_all("th")
        if len(cells) < 2:
            continue
        topic = _text(cells[0]).rstrip(":")
        details = _text(cells[1])
        if not topic:
            continue
        key = topic.lower()
        if "toss" in key:
            info["toss"] = details
        elif "venue" in key or "ground" in key:
            info["venue"] = details
        elif "umpire" in key:
            info["umpires"] = details
        elif "player of" in key or "pom" in key:
            info["player_of_match"] = details
        elif "innings" in key:
            info.setdefault("timings", []).append({"label": topic, "value": details, "tz": row.get("title")})
        elif "point" in key:
            info["points"] = details
    return info


def _cell_player(cell: Tag) -> tuple[str, int | None, bool, bool]:
    link = cell.find("a", href=PLAYER_HREF)
    name = _text(link.find("b") if link and link.find("b") else link) if link else _text(cell)
    name = re.sub(r"Did not bat:.*", "", name, flags=re.I).strip()
    captain = "*" in cell.get_text()
    keeper = "†" in cell.get_text()
    pid = player_id_from_href(link.get("href") if link else None)
    name = name.replace("*", "").replace("†", "").strip()
    return name, pid, captain, keeper


def parse_scorecard(html: str) -> list[dict[str, Any]]:
    soup = _soup(html)
    panes = []
    for idx, pane_id in enumerate(("#ballByBallTeam1", "#ballByBallTeam2"), start=1):
        pane = soup.select_one(pane_id)
        if pane:
            panes.append((idx, pane))
    if not panes:
        panes = [(1, soup)]
    innings: list[dict[str, Any]] = []
    for innings_no, root in panes:
        batting = _parse_batting(root)
        bowling = _parse_bowling(root)
        fow = _parse_fow(root)
        total = batting.get("total") or {}
        innings.append({
            "innings_no": innings_no,
            "batting": batting.get("rows", []),
            "dnb": batting.get("dnb", []),
            "extras": batting.get("extras"),
            "total": total,
            "bowling": bowling,
            "fow": fow,
            "runs": total.get("runs"),
            "wickets": total.get("wickets"),
            "overs": total.get("overs"),
        })
    return innings


def parse_full_scorecard(html: str) -> list[dict[str, Any]]:
    return parse_scorecard(html)


def _parse_batting(root: Tag) -> dict[str, Any]:
    rows = []
    dnb: list[dict[str, Any]] = []
    extras = None
    total = None
    for tr in root.find_all("tr"):
        ths = tr.find_all("th")
        if not ths:
            continue
        joined = _text(tr)
        if joined.lower().startswith("did not bat"):
            for a in tr.find_all("a", href=PLAYER_HREF):
                name = _text(a.find("b") or a)
                dnb.append({"player_name": name, "ccpl_player_id": player_id_from_href(a.get("href"))})
            continue
        if joined.lower().startswith("extras"):
            extras = {"text": joined, "runs": _first_int(tr.find("b"))}
            continue
        if joined.lower().startswith("total"):
            total = _parse_total(joined, tr)
            continue
        if len(ths) < 6:
            continue
        name_cell = ths[0]
        if not name_cell.find("a", href=PLAYER_HREF):
            continue
        name, pid, captain, keeper = _cell_player(name_cell)
        dismissal_cell = next((c for c in ths if "hidden-phone" in (c.get("class") or [])), ths[1] if len(ths) > 1 else None)
        dismissal = _text(dismissal_cell)
        nums = []
        for cell in ths[2:]:
            val = _text(cell.find("b") or cell)
            if re.fullmatch(r"[\d.]+", val or ""):
                nums.append(val)
        if len(nums) < 4:
            continue
        rows.append({
            "player_name": name,
            "ccpl_player_id": pid,
            "is_captain": captain,
            "is_keeper": keeper,
            "dismissal": dismissal,
            "runs": int(float(nums[0])),
            "balls": int(float(nums[1])),
            "fours": int(float(nums[2])),
            "sixes": int(float(nums[3])),
            "sr": float(nums[4]) if len(nums) > 4 else None,
        })
    return {"rows": rows, "dnb": dnb, "extras": extras, "total": total}


def _parse_total(joined: str, tr: Tag) -> dict[str, Any]:
    runs = _first_int(tr.find("b")) or _first_int_from(joined)
    wk = re.search(r"(\d+)\s+wickets?", joined, re.I)
    ov = re.search(r"([\d.]+)\s+overs?", joined, re.I)
    return {
        "runs": runs,
        "wickets": int(wk.group(1)) if wk else None,
        "overs": ov.group(1) if ov else None,
        "text": joined,
    }


def _first_int(node: Tag | None) -> int | None:
    if node is None:
        return None
    return _first_int_from(_text(node))


def _first_int_from(text: str) -> int | None:
    m = re.search(r"\d+", text or "")
    return int(m.group(0)) if m else None


def _parse_bowling(root: Tag) -> list[dict[str, Any]]:
    rows = []
    in_bowl = False
    for tr in root.find_all("tr"):
        ths = tr.find_all("th")
        if not ths:
            continue
        label = _text(ths[0]).lower()
        if label == "bowling" or (label.startswith("bowling") and "o" in _text(tr).lower()):
            in_bowl = True
            continue
        if not in_bowl:
            continue
        if label.startswith("fall of"):
            break
        link = tr.find("a", href=PLAYER_HREF)
        if not link:
            if label.startswith("did not") or label.startswith("extras") or label.startswith("total"):
                in_bowl = False
            continue
        name = _text(link.find("b") or link)
        nums = []
        for cell in ths:
            val = _text(cell.find("b") or cell)
            if re.fullmatch(r"[\d.]+", val or ""):
                nums.append(val)
        extras_note = re.search(r"\((\d+)\s*(?:w(\d+))?\s*(?:nb(\d+))?\)", _text(tr), re.I)
        if len(nums) < 5:
            continue
        # O M Dot R W Econ — Dot may be present
        overs = float(nums[0])
        maidens = int(float(nums[1]))
        if len(nums) >= 6:
            runs, wickets, econ = int(float(nums[3])), int(float(nums[4])), float(nums[5])
        else:
            runs, wickets, econ = int(float(nums[2])), int(float(nums[3])), float(nums[4])
        rows.append({
            "player_name": name,
            "ccpl_player_id": player_id_from_href(link.get("href")),
            "overs": overs,
            "maidens": maidens,
            "runs": runs,
            "wickets": wickets,
            "econ": econ,
            "wides": int(extras_note.group(2) or 0) if extras_note and extras_note.group(2) else 0,
            "no_balls": int(extras_note.group(3) or 0) if extras_note and extras_note.group(3) else 0,
        })
    return rows


def _parse_fow(root: Tag) -> list[dict[str, Any]]:
    heading = None
    for tag in root.find_all("h4"):
        if "fall of wickets" in _text(tag).lower():
            heading = tag
            break
    if not heading:
        return []
    fow = []
    for sib in heading.find_all_next(["a", "h5"]):
        if sib.name == "h4":
            break
        if sib.name == "a" and PLAYER_HREF.search(sib.get("href") or ""):
            name = _text(sib)
            detail = sib.find_next("h5")
            detail2 = detail.find_next("h5") if detail else None
            meta = _text(detail2 or detail)
            m = re.search(r"(\d+)\s*-\s*(\d+)\s*,\s*Over\s*([\d.]+)", meta, re.I)
            fow.append({
                "player_name": name,
                "ccpl_player_id": player_id_from_href(sib.get("href")),
                "wicket": int(m.group(1)) if m else None,
                "runs": int(m.group(2)) if m else None,
                "over": m.group(3) if m else None,
                "text": meta,
            })
    return fow


def parse_ballbyball(html: str) -> list[dict[str, Any]]:
    """Best-effort until a real ball-entry fixture is saved. Groups by pane + .circle-ball."""
    soup = _soup(html)
    balls: list[dict[str, Any]] = []
    seq = 0
    panes = [(1, soup.select_one("#ballByBallTeam1")), (2, soup.select_one("#ballByBallTeam2"))]
    if not any(p[1] for p in panes):
        panes = [(1, soup)]
    for innings_no, root in panes:
        if root is None:
            continue
        innings_seq = 0
        for badge in root.select(".circle-ball"):
            parent = badge.parent
            blob = _text(parent)
            innings_seq += 1
            seq += 1
            wicket = bool(re.search(r"\bOUT!|\bW\d", blob))
            runs_m = re.search(r"(\d+)\s+runs?", blob, re.I)
            balls.append({
                "innings_no": innings_no,
                "seq": innings_seq,
                "over_label": None,
                "commentary": blob,
                "runs": int(runs_m.group(1)) if runs_m else 0,
                "is_wicket": wicket,
                "extras": None,
            })
    return balls


def parse_overbyover(html: str) -> list[dict[str, Any]]:
    soup = _soup(html)
    overs: list[dict[str, Any]] = []
    for table in soup.find_all("table"):
        title = table.find("th", attrs={"colspan": True})
        side = _text(title)
        innings_no = 1 if overs == [] else 2
        for tr in table.find_all("tr"):
            tds = tr.find_all("td")
            if len(tds) < 4:
                continue
            if _text(tds[0]) in {"#", ""}:
                continue
            tokens = [_text(li) for li in tds[1].select("li")]
            overs.append({
                "innings_no": innings_no,
                "batting_side": side.replace(" Batting", ""),
                "over": _text(tds[0]),
                "bowler": _text(tds[1]).split("\n")[0],
                "tokens": tokens,
                "runs": _first_int_from(_text(tds[2])),
                "score": _text(tds[3]),
            })
    return overs


def official_scorecard_url(match_id: int, club_id: int = 88) -> str:
    return f"https://www.ccplt20.net/CCPLT20/viewScorecard.do?matchId={match_id}&clubId={club_id}"
