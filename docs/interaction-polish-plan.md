# ROYALS interaction polish plan

**Status:** specification only. Do not implement until this document is reviewed and the next prompt is issued.

**Branch:** `stage-2` after Stage 2.1 role/data corrections.

**Principle:** Animate outcomes people repeat, not decoration. One meaningful motion per action. Logic must stay role-correct: never polish a guest opening Maya’s Season Hub, and never animate a Men’s announcement onto the U8 team page.

**Identity to preserve:** cream `#F7F3EC`, paper `#FFFCF7`, ink `#151310`, burnt orange `#F36A21`, serif/display headings, five tabs only.

---

## Current-state audit

### Navigation

| Surface | Implementation | Motion today |
| --- | --- | --- |
| Bottom tabs | Expo Router `Tabs` in `src/app/(tabs)/_layout.tsx` | Instant scene swap. No enter/exit. |
| Stack (program, event, team, season, registration, admin, etc.) | `Stack` `animation: 'slide_from_right'` in `src/app/_layout.tsx` | Native iOS-style push. Web is typically a hard cut or a cheap slide. Back should reverse; not verified as a custom reverse on web. |
| Registration steps | Local `step` state; `Screen` remounts via `scrollKey={step}` | Instant replace + scroll reset. No directional step animation. |
| Schedule filters | `useState` filter; list remaps in place | Instant list replace. |
| Tab icons | Ionicons outline → filled already mapped | Color tints via `tabBarActiveTintColor`. Glyph swap is instantaneous, not choreographed. |

### Motion libraries

| Package | Installed | Used in `src/` |
| --- | --- | --- |
| `react-native-reanimated` 4.5.1 | Yes | **No** |
| `react-native-gesture-handler` | Yes | **No** (beyond Expo Router defaults) |
| `react-native-svg` | Yes | **No** |
| `expo-haptics` | Yes | Yes, but almost always `selectionAsync` |
| `expo-symbols` | Yes | **No** |
| RN `Animated` / `LayoutAnimation` | Platform | **No** |

**Decision:** Implement polish with Reanimated + SVG already in the project. Do not add Lottie, Rive, or confetti packages.

### Haptics today

`src/state/AppProvider.tsx` wraps a `haptic()` helper: **selection** on native, **no-op on web**. Almost every mutation (role, RSVP, supporter, check-in, field close, follow, prefs, announcement, DM) fires the same light selection tick. Registration submit is the exception: **notification success**.

**Gap:** No hierarchy. Tab changes and scrolling do not haptic (good). RSVP and field closure feel identical (bad).

### Loading and empty states

| Pattern | Today |
| --- | --- |
| `EmptyState` in `src/components/ui.tsx` | Ionicons + title + message. **Unused.** |
| Competition fixtures/standings | Inline icon empty copy. |
| Notifications | Always lists demo notices; no empty layout. |
| Schedule | Can show an empty filtered list with no illustration. |
| Profile attendance | Parent always sees Maya’s 8/9 demo history. |
| Followed teams | Always seeded with three follows. |
| Buttons | `ActivityIndicator` when `loading`; almost never passed. |
| Skeletons | None. |

### RSVP / supporter / attendance (logic already Stage 2.1)

- **Player RSVP** (`canPlayerRsvp`): Going / Maybe / Can’t go. Instant ink fill. Icons are filled `checkmark` / `help` / `close`, not outline→filled. `setAttendance` does **not** increment `goingCount`.
- **Supporter:** primary/secondary `Button` label swap. Count increments in state. No fill choreography.
- **Coach attendance:** row + `StatusPill`; tap cycles Present → Absent → Late. Copy is `10 present · 2 not recorded`, not `9 of 12 recorded`. No completion banner.
- **Parent attendance:** static `8 of 9 · 89%` list. No ring. No one-shot count-up.

Do not show both RSVP systems to the same user. Motion must respect that split.

### Registration

Six labeled steps (`overview` → `household` → `children` → `consent` → `review` → `payment`) then a seventh confirmation screen. Zod + react-hook-form. Errors render under fields but there is **no scroll/focus to first error**. Submit jumps to a static checkmark, “Welcome to the Royals family,” registration id, amount, **Open season hub** + **View schedule**. Missing: first-session time, jersey/pennant, calendar secondary action, button morph.

### Pressed states

`Button` already uses `pressed` opacity `0.78` and scale `0.985`. Cards, RSVP chips, tab icons, schedule rows, and attendance rows do not.

---

## Icon system audit and rule

**Family in use:** `@expo/vector-icons` **Ionicons** only. No FontAwesome, Material, emoji, or SF Symbols in screens.

**Already correct:** tab bar outline/filled pairs (`home`, `grid`, `calendar`, `shield`, `person`).

**Inconsistencies to fix during Prompt 2 (no new icon pack):**

| Issue | Examples | Rule |
| --- | --- | --- |
| Filled glyph used as idle/info | `warning`, `trophy`, `stats-chart`, `lock-closed`, `pencil`, `close` | Idle/info = `*-outline`. Filled only when selected, complete, or destructive-active. |
| Outline used as complete | Team roster `checkmark-circle-outline` | Complete = filled `checkmark-circle`. |
| Sport markers use UI icons | `football-outline`, `radio-outline` (cricket), `barbell-outline` | Keep Ionicons only as **filters**. Decorative sport marks later use SVG equipment, not radio glyphs. |
| RSVP icons are filled even when idle | `checkmark`, `help`, `close` | Idle: `checkmark-outline`, `help-outline`, `close-outline`. Active: filled + semantic color. |
| Mixed check language | `checkmark` vs `checkmark-circle` | Actions: `checkmark`. Status: `checkmark-circle`. |

**Do not adopt `expo-symbols`.** It would split iOS/web/Android. Stay on Ionicons.

### Written icon rule (implement in Prompt 2)

1. One family: Ionicons.
2. Inactive navigation: outline, `colors.stone`.
3. Active navigation: matching filled glyph + `colors.orange` in the same 200ms window.
4. Neutral information: outline, `colors.stone` or `orangeDark` in icon wells.
5. Completed: filled semantic (`checkmark-circle` / `checkmark`) in success green or ink.
6. Destructive: same family, `colors.danger`.
7. No emoji. No mixing weights. No decorative Ionicons standing in for equipment illustrations.

---

## Shared motion tokens (implement once)

Create `src/theme/motion.ts` (Prompt 2). Approximate values:

| Token | Value |
| --- | --- |
| `duration.fast` | 120ms |
| `duration.base` | 200ms |
| `duration.enter` | 240ms |
| `duration.celebrate` | 420ms |
| `easing.standard` | cubic-bezier(0.2, 0.8, 0.2, 1) |
| `easing.emphasized` | cubic-bezier(0.2, 0, 0, 1) |
| `spring.press` | damping 18, stiffness 420 |
| `spring.success` | damping 14, stiffness 280 |
| `offset.tabExit` | 5px down |
| `offset.tabEnter` | 7px up |
| `press.scale` | 0.97 |

### Reduced motion

Use `AccessibilityInfo.isReduceMotionEnabled()` (native) and `prefers-reduced-motion` (web). When enabled:

- Durations → 1ms or instant state swap.
- No particles, no count-up, no fill wipes, no springs.
- Still update labels, colors, counts, and icons immediately.
- Haptics still allowed unless the OS suppresses them.

### Web fallback

- Haptics: no-op (`Platform.OS === 'web'`).
- Reanimated transforms and opacity: allowed.
- Layout springs that jank on static export: fall back to 200ms opacity + translateY.
- Do not depend on native driver-only APIs.

### Haptic helper (replace undifferentiated `haptic()`)

| Level | API | When |
| --- | --- | --- |
| Light | `impactAsync(Light)` or `selectionAsync` | Tab, filter, RSVP choice, attendance tap |
| Medium | `impactAsync(Medium)` | Supporter confirm |
| Success | `notificationAsync(Success)` | Registration complete, attendance fully saved |
| Warning | `notificationAsync(Warning)` | Field-closure acknowledgment |
| Error | `notificationAsync(Error)` | Invalid form submit |

Never haptic on scroll, opening ordinary cards, or keystrokes.

---

## Interaction catalogue

Priority order for later prompts: (1) RSVP + supporter, (2) registration, (3) attendance, (4) tabs/filters, (5) empty states, (6) loading/skeletons.

Each item below is specified so Prompt 2–5 can implement without inventing motion.

### 1. Player RSVP — Going / Maybe / Can’t go

**Initiating action:** Team participant taps a choice on event details (`showPlayerRsvp`).

**Elements:** three choice cards; icon; participant count; confirmation line under the row.

**Sequence (Going — signature path, ~420ms):**

1. 0–80ms: selected card scale 1 → 0.97 (`spring.press`).
2. 40–220ms: semantic fill expands from the icon. Going = success green; Maybe = ink; Can’t go = stone. Idle siblings fade to 70% opacity.
3. 120–240ms: outline icon → filled (`checkmark-outline` → `checkmark`). Going check: extra 1.12 scale spring then settle.
4. 180–320ms: `goingCount` ticks (e.g. 11 → 12) with 8px upward fade of the outgoing numeral. Only increment when moving **to** Going from another state; decrement when leaving Going.
5. 240–400ms: confirmation copy fades in. Going: “You’re in. See you Sunday.” Maybe: “Marked maybe.” Can’t go: “We’ll miss you.”
6. Haptic: Light on choice. (Not Success — save Success for registration/attendance complete.)

**State logic (must ship with the animation):** `setAttendance` should update `goingCount` so the number is not fake. Do not show supporter UI.

**Failure:** tapping the already-selected Going is a no-op (or a light deselect if product later wants toggle — default **keep selected**, no reverse confetti).

**Reduced motion / web:** instant fill + copy; skip spring and count slide; web no haptic.

**Success:** persisted `attendance` + count; confirmation remains until another choice.

---

### 2. Supporter confirmation

**Initiating action:** Non-participant taps “I’m coming to support”.

**Elements:** orange primary button; icon (`heart-outline` or `flag-outline` → `checkmark`); supporter count; compact confirmation.

**Sequence (~380ms):**

1. 0–80ms: button scale 0.97.
2. 60–240ms: orange fill (already primary) stays; icon rotates ~90° and morphs to check.
3. Optional left-to-right sheen on the button (opacity 0.18, 200ms). Do not introduce a second orange system.
4. Label crossfade: “I’m coming to support” → “Supporting.”
5. Count 9 → 10 with 6px bounce (`spring.success`).
6. Line: “12 Royals are coming.” (use live `supporterCount`).
7. Haptic: **Medium**.

**Undo:** tapping again reverses count, label, and icon without celebration. Haptic Light.

**Reduced motion:** instant label/icon/count.

**Persist:** existing `setSupporter`.

---

### 3. Coach attendance

**Initiating action:** Coach/admin taps a roster row on a team event they staff.

**Elements:** outlined circle per child; name (privacy-safe); live meter; header.

**Tap cycle (replace pill-only UI):**

- Idle: 22px outline circle, stone.
- Present: circle fills `success`, check draws 140ms, Light haptic.
- Late: fill `warning`, clock-outline, Light haptic.
- Absent: fill none, `close-outline` in stone, Light haptic.

Prefer **tap = Present** on first touch, then a second control (small overflow or swipe-left) for Late/Absent so the happy path is one tap. If swipe is too costly on web, use: first tap Present; subsequent taps cycle Late → Absent → Present.

**Meter:** `recorded of roster.length recorded` (e.g. `9 of 12 recorded`), updating immediately. Secondary line may still show present/late/absent split.

**Completion:** when `unrecorded.length === 0`, header crossfades to “Attendance complete ✓” (200ms). Haptic **Success** once per session (do not fire again if they change a mark).

**Reduced motion:** instant fills. **Web:** CSS/Reanimated fill, no haptic.

**Do not** show RSVP or supporter on this surface.

---

### 4. Parent attendance ring

**Initiating action:** Parent Profile (or Home briefing) first reveals Maya’s attendance card.

**Elements:** 64–72px SVG ring; numeral `8 of 9`; `89%`.

**Sequence (once per device/session):**

1. Ring stroke-dashoffset 0% → 89% over 600ms `easing.emphasized`.
2. Number counts 0 → 8 (integer steps) while “of 9” stays static.
3. Percent labels 89% at the end.

**Do not replay** on scroll, tab blur/focus, or returning to Profile in the same session. Persist a `attendanceRingPlayed` flag in demo state or `sessionStorage`/`AsyncStorage`.

**Reduced motion:** final 89% ring and `8 of 9` immediately.

**Empty future state:** if a parent has zero sessions, do not run the ring; use the empty-state illustration instead.

---

### 5. Bottom-tab transition

**Initiating action:** User selects another of the five tabs.

**Elements:** tab icon/label; screen body.

**Sequence (~200–240ms):**

1. Outgoing content opacity 1 → 0, translateY 0 → +5px.
2. Incoming content opacity 0 → 1, translateY +7px → 0.
3. Icon: outline glyph crossfades to filled; color stone → orange together (not icon first, color later).
4. Haptic: Light on native only.

**Do not** animate cards inside the new tab. **Do not** run this on first app load.

**Reduced motion:** instant tab content; still swap filled icon + orange.

---

### 6. Detail / back navigation

**Initiating action:** Push from Programs → program details → registration, Teams → team, Schedule → event, etc.

**Today:** stack `slide_from_right`.

**Polish:** keep directional slide. Explicit `animation: 'slide_from_right'` on push; back uses system reverse. Duration ~220ms. Registration overlay already disables gesture — keep that.

**Web:** 220ms translateX 24px + fade if native stack animation is a no-op.

**Haptic:** none.

---

### 7. Schedule filter crossfade

**Initiating action:** Chip My schedule / Soccer / Cricket / Fitness / Club.

**Sequence:** list opacity 1 → 0 (90ms) → swap data → 0 → 1 (140ms). Chip: outline/fill not required (text chips); active chip uses existing ink fill. Light haptic.

**Empty result:** after fade, show “No games match these filters” empty state (Prompt 5), not a blank cream gap.

---

### 8. Registration step transitions

**Initiating action:** Continue / Back inside Kids Soccer (and adult) registration.

**Sequence:** outgoing step translateX −12px fade; incoming +12px (forward) or reversed (back). Progress segments: previous stay orange; the new segment width-animates 0→100% in 240ms.

**Validation failure:** do not advance. First error field: `scrollTo` + `focus()`, border already `fieldError`. Haptic **Error** on Continue with invalid fields.

**Pressed/loading:** Continue uses existing press scale; on payment submit, `loading` true until confirmation sequence starts.

---

### 9. Registration completion (signature moment)

**Initiating action:** Valid tap on the final submit (payment/status step).

**Sequence (~700ms, then rest):**

1. Orange button compresses 0.97.
2. Label “Submit registration” fades (80ms).
3. Trailing arrow rotates to check (160ms).
4. Final progress segment fills.
5. Form content translates up 16px and opacity → 0.
6. Confirmation card enters from 12px below:

   > **Maya is joining ROYALS**  
   > Fall Soccer Training  
   > First session: Sunday at 4:00 PM

   (Use selected child names, program title, and the real first-session event via `formatEventParts`. Multi-child: “Maya & Noah are joining ROYALS”.)
7. Restrained celebration: **three** 6px orange dots or a 48px pennant SVG waving ±8° twice. **No confetti library.**
8. Actions only:

   - Primary: Open Season Hub  
   - Secondary: Add season to calendar  

   Keep the demo notice (“No real payment was processed”) under the card, smaller, not as a third CTA.

9. Haptic: **Success**.

**Reduced motion:** skip 1–5 and particles; show the confirmation card immediately.

**Logic:** still `submitRegistration` with pending demo payment. Season Hub remains parent/admin-only after submit (the submitting parent is in-flow).

---

### 10. Field closure

**Initiating action:** Staff closes a field.

**Motion:** warning pill + optional rain/flag empty treatment if the event card is the focus. Haptic **Warning**. Copy: “Today’s field is closed.” Do not celebrate.

---

### 11. Tab / child / team switch (Home briefing)

**Initiating action:** Future multi-child switcher or followed-team chip.

**Motion:** 180ms crossfade of briefing rows only. Light haptic. Out of scope until a visible switcher exists; do not invent a sixth tab.

---

### 12. Loading / skeleton (lowest priority)

**Where:** first paint after `hydrated === false` if a route waits on storage (should be rare; SSG is guest).

**Motion:** 3 cream-to-sand pulsing bars, 1200ms loop, orange never used as a loader. Reduced motion: static bars.

**Do not** skeleton screens that already have complete demo data.

---

## Empty-state and illustration system (Prompt 5)

### Architecture

Replace unused Ionicons `EmptyState` with:

```
<RoyalsEmpty
  illustration={<PennantResting />}
  title="You’re all caught up."
  description="..."
  primaryAction?
  secondaryAction?
/>
```

Rules:

- Compact: illustration ≤ 120×96, title, one sentence, optional buttons.
- **Never** place on a screen that already has a list of real items.
- Club-wide illustrations: equipment + pennant/crest. Kids Soccer **only**: Royal Cub.

### Palette

- Ink / charcoal `#151310` `#332E29`
- Cream / paper `#F7F3EC` `#FFFCF7`
- Burnt orange `#F36A21`
- Accents: success green on grass/check only; cricket red-leather as a **tiny** ellipse on the ball, not a third brand color flood.

Style: editorial SVG, slightly uneven human line, 1.75px stroke, no glossy 3D, no stock clip art, no emoji.

### Asset specification (if final art is not ready)

Ship **temporary branded SVGs** in `src/illustrations/` that match this spec. Filenames and viewBoxes are the contract for later designer replacement.

| File | ViewBox | Composition | Used on |
| --- | --- | --- | --- |
| `pennant-whistle.svg` | 160×112 | Orange pennant folded on cream ground; black whistle on its side | No notifications |
| `boots-calendar.svg` | 160×112 | Black boots, cream ball, calendar block with orange 13 | No upcoming events |
| `fixture-blank.svg` | 160×112 | Black board, three empty cream rows, orange header bar | No schedule results |
| `jersey-hooks.svg` | 160×112 | Three empty black hooks, one orange hanger | No followed teams |
| `floodlight-dim.svg` | 160×112 | Two pylons, dim cream beams, no orange fill | Offline |
| `flag-rain.svg` | 160×112 | Folded corner flag, three rain ticks | Field closed |
| `cub-cone.svg` | 160×112 | Cub in black/orange kit placing one cone | No attendance history (Kids) |
| `cub-jersey.svg` | 160×112 | Cub holding a jersey; optional first-name on back | Registration success (Kids) |
| `cub-pennant.svg` | 160×112 | Cub carrying small pennant | Attendance streak (future) |
| `cub-sleep.svg` | 160×112 | Cub asleep by a ball | Kids empty notifications |
| `cub-umbrella.svg` | 160×112 | Cub + umbrella | Kids weather cancellation |
| `cub-binoculars.svg` | 160×112 | Cub looking through binoculars | Kids search empty |
| `cub-cones-row.svg` | 160×112 | Cub lining three cones | Kids parent loading |

Royal Cub constraints: no speech bubbles, no cartoon rainbow, kit is black shirt + orange sleeve/trim, lion cub not a mascot stamped on adult cricket/men’s/veterans screens.

### Copy

| State | Title | Description | Action |
| --- | --- | --- | --- |
| No notifications | You’re all caught up. | New team notes will land here. | none |
| No upcoming events | Nothing scheduled yet. | When fixtures publish, they appear on Schedule. | Browse programs |
| No schedule results | No games match these filters. | Try another sport or show the full club calendar. | Reset filters |
| No attendance history | Attendance starts with the first session. | Coaches record presence when training begins. | none |
| Registration completed | Maya is joining ROYALS. | (See confirmation sequence; not a stacked empty state.) | Season Hub / Calendar |
| Field closed | Today’s field is closed. | Check back for the reopen or the makeup session. | none |
| No followed teams | Choose the teams you want to follow. | Home and Schedule stay quieter until you pick. | Open Profile follows |
| Offline | You’re offline. | Saved details are still available on this device. | none |

---

## Implementation sequence (later prompts)

Do not start Prompt 3 until Prompt 2 is tested on all five tabs.

### Prompt 2 — Navigation, icons, shared motion

- `src/theme/motion.ts`
- `src/lib/haptics.ts` (web no-op, hierarchy)
- `src/lib/reducedMotion.ts`
- Tab icon + color cohesion; tab content translate/fade
- Pressed states on cards (`Pressable` scale) without per-card mount animations
- Ionicons outline/filled sweep listed in the audit
- Keep all routes and Stage 2.1 role logic

**Test:** Home, Programs, Schedule, Teams, Profile; push program details and back; web + a native layout width.

### Prompt 3 — RSVP, supporter, attendance

Implement **as three components**, fully test each before the next:

1. `RsvpChoices`
2. `SupporterIntentButton`
3. `AttendanceRoster` + `AttendanceRing`

Wire `goingCount` on RSVP. Preserve participant vs supporter split.

### Prompt 4 — Registration completion

Step transitions, progress fill, scroll-to-error, submit choreography, confirmation card, two CTAs only. Reduced-motion instant completion.

### Prompt 5 — Illustrations and empty states

`RoyalsEmpty` + SVG set. Wire only truly empty views. Do not illustrate Home when This Week has events.

---

## Out of scope

- Splash animation, dark mode, FIFA-style cards, sixth tab
- Animating every briefing row, every schedule card on first paint
- Guest Season Hub access, U8 showing Men’s announcements
- New npm animation/confetti libraries
- Live maps/travel (stub copy stays)
- Claiming real payments or real weather

---

## Acceptance bar

The app feels more expensive when these four actions feel intentional:

1. Supporting another team  
2. Registering a child  
3. Checking into practice (parent ring / RSVP)  
4. Completing coach attendance  

If those work, leave informational cards still.
