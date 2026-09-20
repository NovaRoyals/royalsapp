"""Nova Royals CCPL squad + name resolution.

Ambiguous 'Ganesh G' (Gautam vs Giri) is resolved via the match XI when provided.
Opponents are never linked to a Royals profile.
"""

from __future__ import annotations

import re
from dataclasses import dataclass


@dataclass(frozen=True)
class SquadPlayer:
    full_name: str
    short_name: str
    role: str
    is_captain: bool = False
    is_vice_captain: bool = False
    is_keeper: bool = False


def _short(full: str) -> str:
    parts = full.split()
    if len(parts) == 1:
        return parts[0]
    return f"{parts[0]} {parts[-1][0]}"


SQUAD: list[SquadPlayer] = [
    SquadPlayer("Sujit Khanal", "Sujit K", "batter", is_captain=True),
    SquadPlayer("Ashim Gautam", "Ashim G", "batter"),
    SquadPlayer("Ashok Kunwar", "Ashok K", "batter"),
    SquadPlayer("Binod Bhujel", "Binod B", "batter"),
    SquadPlayer("Indra Bist", "Indra B", "batter"),
    SquadPlayer("Janak Dumre", "Janak D", "batter"),
    SquadPlayer("Krishna Poudel", "Krishna P", "batter"),
    SquadPlayer("Nishan Prasai", "Nishan P", "batter"),
    SquadPlayer("Prem Thapa", "Prem T", "batter"),
    SquadPlayer("Rameshwar Lekhak", "Rameshwar L", "batter"),
    SquadPlayer("Sandeep Roka", "Sandeep R", "batter"),
    SquadPlayer("Santosh Ghimire", "Santosh G", "batter"),
    SquadPlayer("Sarad Singh Hamal", "Sarad H", "batter"),
    SquadPlayer("Suraj Thapa", "Suraj T", "batter"),
    SquadPlayer("Suresh Singh", "Suresh S", "batter", is_keeper=True),
    SquadPlayer("Sushant Shrestha", "Sushant S", "batter"),
    SquadPlayer("Yukesh Sitoula", "Yukesh S", "batter"),
    SquadPlayer("Yushek Sitoula", "Yushek S", "batter"),
    SquadPlayer("Biplav Gautam", "Biplav G", "all_rounder", is_vice_captain=True),
    SquadPlayer("Ashish Khanal", "Ashish K", "all_rounder"),
    SquadPlayer("Basant Bhatt", "Basant B", "all_rounder"),
    SquadPlayer("Beni Mahato", "Beni M", "all_rounder"),
    SquadPlayer("Ehsan Ansari", "Ehsan A", "all_rounder"),
    SquadPlayer("Ganesh Gautam", "Ganesh G", "all_rounder"),
    SquadPlayer("Ganesh Giri", "Ganesh G", "all_rounder"),
    SquadPlayer("Ganesh Pandey", "Ganesh P", "all_rounder"),
    SquadPlayer("Kavin Parakh", "Kavin P", "all_rounder"),
    SquadPlayer("Rupesh Phuyal", "Rupesh P", "all_rounder"),
    SquadPlayer("Suraj Kandel", "Suraj K", "all_rounder"),
]

BY_FULL = {p.full_name.lower(): p for p in SQUAD}
BY_SHORT = {}
for p in SQUAD:
    BY_SHORT.setdefault(p.short_name.lower(), []).append(p)


def is_squad_member(name: str) -> bool:
    return resolve_player(name) is not None


def _norm(name: str) -> str:
    cleaned = re.sub(r"[*†]", "", name or "")
    cleaned = re.sub(r"\s+", " ", cleaned).strip().lower()
    return cleaned


def resolve_player(name: str, xi: list[str] | None = None, player_id_map: dict[int, str] | None = None, player_id: int | None = None) -> SquadPlayer | None:
    """exact squad abbrev → fuzzy first+surname-token → playerId map → None (opponent)."""
    if player_id is not None and player_id_map:
        full = player_id_map.get(player_id)
        if full and full.lower() in BY_FULL:
            return BY_FULL[full.lower()]
    raw = _norm(name)
    if not raw:
        return None
    if raw in BY_FULL:
        return BY_FULL[raw]
    shorts = BY_SHORT.get(raw) or BY_SHORT.get(raw.rstrip("."))
    if shorts:
        if len(shorts) == 1:
            return shorts[0]
        if xi:
            xi_l = {_norm(n) for n in xi}
            hits = [p for p in shorts if p.full_name.lower() in xi_l]
            if len(hits) == 1:
                return hits[0]
        return None
    tokens = raw.replace(".", "").split()
    if not tokens:
        return None
    first, last = tokens[0], tokens[-1]
    fuzzy = [
        p
        for p in SQUAD
        if p.full_name.lower().split()[0] == first and p.full_name.lower().split()[-1].startswith(last[:1])
    ]
    if len(fuzzy) == 1:
        return fuzzy[0]
    if len(fuzzy) > 1 and xi:
        xi_l = {_norm(n) for n in xi}
        hits = [p for p in fuzzy if p.full_name.lower() in xi_l]
        if len(hits) == 1:
            return hits[0]
    return None
