# Messaging

Parents get a direct line to the coach, and, only if they choose, to other parents on the same
team. It is built for youth sport: children never message, parents are never shown to each other
by phone or email, and a private conversation is private even from the club unless someone
reports it.

## What families see

- **Home:** a chat bar at the very top shows the coach's latest message with an unread badge, and
  a chat button in the header carries the same count. A new message is the first thing seen on
  opening the app. Coaches see the same bar, summarising the families waiting on a reply.
- **Messages:** the coach thread is pinned first. Below it, "Team updates and recaps", then the
  optional parent chat.
- **A conversation:** bubbles with day headings, a message box pinned to the bottom, Enter to send
  on the web, read tracking that clears the badge when the thread is opened.
- **Notification:** a message creates an alert for the other person only, with `forRole` so a
  coach's alert never reaches a parent. Real push needs credentials (not configured).

## The three kinds of thread

| Kind | Between | Who can see it |
| --- | --- | --- |
| `coach` | a family and the team's coach | that family's guardians and the coach |
| `family` | the coach's side of another family's thread | the coach only |
| `parent` | two parents on the same team | those two parents only |

Parent chat is **off by default**. Both parents must turn it on, both must have a child on the
team, a parent appears only as "Parent of <child's first name>", and phone numbers, emails and
links are refused. Either parent can block or report; reporting also blocks.

## Where the rules live

- App, mirrored for the screens: `src/lib/messaging.ts` (16 tests in `tests/messaging.test.ts`).
- Database, the source of truth: `supabase/migrations/20261003120000_messaging.sql`, tested by
  `supabase/tests/messaging_security.sql` (`npm run db:test:messaging`, ends in ALL PASSED).
  Nobody inserts a message directly; `send_message` checks membership, opt-in, blocks and contact
  details. Admins see a conversation's messages only after it has been reported.

## Not built yet

- Wiring the screens to these tables (the app still uses local demo state, like everything else
  until Supabase Auth is connected).
- Realtime delivery and push notifications.
- Club review tools for reports (the data and the admin read access exist).
- Attachments and photos are deliberately out of scope for youth chat.

## Questions for the club

1. Who reviews reports, and how quickly?
2. Should the coach be able to see that parent chat exists between two families (not the content)?
3. Are co-coaches or team managers part of the coach thread?
4. How long are messages kept?
5. Does the club want parent chat at all for the youngest age groups?
