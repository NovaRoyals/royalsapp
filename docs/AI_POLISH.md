# AI polish for coach recaps

After a session the coach records or types a recap, taps **Polish with AI**, reviews the result in the editor, optionally adds a note for individual children, and approves the send. The AI only ever produces text for the coach to review. It cannot send anything to a family.

## Flow

```
app (signed-in coach)
  → Edge Function coach-polish            supabase/functions/coach-polish/index.ts
      1. checks who is calling             (auth.getUser)
      2. polish_context(team)              database: is this person a coach of the team, how many polishes
                                           in the last hour (limit 30), and the names to hide
      3. replace every name with {player1}, {player2}…
      4. OpenRouter → DeepSeek V4 Flash    (fallback DeepSeek V3.2)
      5. check the answer against what the coach wrote; refuse if it invented anything
      6. put the real names back
      7. log_polish(...)                   database: audit row (original and generated text)
  → text back to the coach's editor
```

The decisions are in `supabase/functions/_shared/polish.ts` and are unit-tested (`tests/polish.test.ts`). The database rules are tested by `supabase/tests/polish_security.sql` (`npm run db:test:polish`). Every database call runs as the signed-in coach; no service-role key is used.

## Modes

| Mode | What happens |
| --- | --- |
| Clean up only | Spelling, grammar, punctuation, filler words removed. Nearly every word kept. |
| Warm and concise | Friendlier and shorter, in the coach's voice. May merge or reorder sentences. |
| Keep exactly as spoken | No model is called. The text comes back unchanged. |

## What is refused

The answer is rejected, and the coach's text is left untouched, if the model adds a number, time or score that was not written, a name or place that was not written (a capitalised word in mid-sentence), a phone number, email or link, a name placeholder it was not given, or if it is much longer than the original or leaves out too much. The checks are deliberately blunt: a false alarm costs the coach one tap, a missed invention puts something false in front of parents.

## Privacy

- Names of every player on the team, their preferred names, and their guardians' names are replaced before any text leaves.
- Requests set `provider.data_collection: "deny"` so OpenRouter only uses providers that do not collect prompts. The setting is kept on the plain retry too.
- The key is an Edge Function secret (`OPENROUTER_API_KEY`). It is never in the app, in git, or in a request body.
- The audit log keeps the original and generated text and is readable only by a club admin.

## Model and cost

`deepseek/deepseek-v4-flash` (the dated 0423 listing), $0.028 per million input tokens and $0.056 per million output tokens as listed on OpenRouter on 2026-10-03, with `deepseek/deepseek-v3.2` as the fallback. Ids are pinned; the `-latest` aliases are avoided because they can change behaviour and price silently. A polish is roughly 500 tokens in and 150 out, a tiny fraction of a cent. Thinking is switched off (`reasoning.enabled: false`), since this is a rewrite task.

Quality has not been measured on real recaps. Once a key exists, run about ten sample recaps through V4 Flash, V3.2 and `openai/gpt-oss-120b`, and let a coach choose. Changing the model is one constant (`MODEL` in `_shared/polish.ts`).

## Status

- Built and tested here: the database functions, all the logic, the function running in the real local Edge runtime (signed-out, parent, wrong team's coach, forged token and a real coach all behave correctly), the app's client and its error wording.
- **Not yet tested: a live answer from OpenRouter.** That needs the key. Until then the app, in demo mode, uses a deterministic tidier that does not call a model.
- The app must be connected to Supabase (real sign-in, real team ids) before the Polish button reaches this function.

## Switching it on (needs your accounts)

1. Create an OpenRouter key with a monthly spending limit.
2. In the Supabase dashboard: Edge Functions → Secrets → add `OPENROUTER_API_KEY`. You enter it; it never goes in chat.
3. Apply the database migrations (`supabase db push`), then deploy the function (`supabase functions deploy coach-polish`).
