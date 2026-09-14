# Interaction status

Blink test: if someone looked away, would they still understand what the app just did?

## Functional baseline

- Role-aware Home, RSVP vs supporter split, coach attendance persist, guest Home without Maya hub
- Registration, season hub, field close alerts, notifications list
- About, sponsors, contact, waiver history, settings (conventional, not signature-animated)

## Polished (high-frequency)

- Tab icons, press scale, reduced-motion, web-safe haptics
- **RSVP A** — fill, count tick, confirmation line, going count
- **Supporter A** — button morph, supporter count, saved copy
- **Attendance** — progress, mark-everyone-present, check state, missing-RSVP highlight
- **Calendar** — transforms to Added + stub confirmation
- **Field closed** — persistent banner (not toast-only)
- **Announcements / notifications** — newest item enters the feed
- Home child switcher, Teams “Following” state
- Registration: age → group recommendation, sibling rate copy, personalized confirmation + first session

## Still experimental

- Interaction Lab `/lab` (Profile → Preview roles). Variants B/C for RSVP and supporter are comparison-only.
- Game-Day Home uses a **demo clock** (`2026-09-13T14:30:00-04:00`) so the U8 4:00 PM session sits in the 60–90 minute window.
- Household overlap warning (Maya vs Noah U6) is a labeled household stub.
- Cross-club cricket → Men’s Open suggestion is stub intelligence from followed teams.

## Temporary artwork

- `IllustrationFrame` placeholders marked TEMPORARY ART
- No approved Royal Cub / pennant. See `docs/ILLUSTRATION_ART_DIRECTION.md`

## Stub / demo intelligence

- Travel minutes, leave-by, 74°F weather, Fairfax origin
- Location share is **opt-in** in Profile; live GPS is not used
- Calendar write, weather, maps
- Age-group recommendation from saved birth dates (Maya U8, Noah U7)
- Sibling pricing (already $120 / $60)
- Coach opens the current U8 session roster

Production navigation still has five tabs only. The lab is not in the tab bar.
