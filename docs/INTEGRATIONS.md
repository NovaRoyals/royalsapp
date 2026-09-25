# Future integrations

Stage 2 anticipates these systems without implementing paid or production connections.

| System | Stage 2 stance | Code |
| --- | --- | --- |
| FXA schedules / results | Manual staff entry; label external | `upsertEvent`, competition `externalDisclaimer` |
| Stripe / payments | Demo pending only; no secrets | `src/services/payments.ts` |
| Google / Apple Calendar / .ics | Preview only. `CalendarAdapter.write` returns `written: false` | `src/services/calendar.ts` |
| Apple Maps / Google Maps | Demo directions preview. No provider keys | `src/services/maps.ts` |
| Weather | Placeholder copy only. Never a live or invented forecast | `src/services/weather.ts` |
| Field status | Demo staff updates with actor and timestamp | `setFieldStatus`, `venueUpdates` |
| Email / SMS | Not sent | Notification center only |
| Production push | `wouldPush` flags. No push credentials | `src/services/notifications.ts` |
| Tournament administration | Schedule display only | Event type `tournament_match` |
| Group chat | Not in this slice | Direct coach thread only |
| Social / share | Share icon placeholder | Event header |
| Registration import | Not built | Household reuse is local |

Do not add API keys, billing, or live processors in Stage 2.
