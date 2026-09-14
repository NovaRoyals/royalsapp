# Future integrations

Stage 2 anticipates these systems without implementing paid or production connections.

| System | Stage 2 stance | Code |
| --- | --- | --- |
| FXA schedules / results | Manual staff entry; label external | `upsertEvent`, competition `externalDisclaimer` |
| Stripe / payments | Demo pending only; no secrets | `src/services/payments.ts` |
| Google / Apple Calendar | Simulated add | `src/services/calendar.ts` |
| Maps / directions | URL to Google Maps | `src/services/maps.ts` |
| Weather / field status | Stub summaries; staff overrides | `src/services/weather.ts`, `setFieldStatus` |
| Email / SMS | Not sent | Notification center only |
| Production push | `wouldPush` flags | `src/services/notifications.ts` |
| Social / share | Share icon placeholder | Event header |
| Registration import | Not built | Household reuse is local |

Do not add API keys, billing, or live processors in Stage 2.
