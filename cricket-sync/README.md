# Cricket sync (CCPL / CricClubs)

Parser is written against real CCPL markup captured 2026-09-20.
`test_ccpl_real_markup.py` must stay green (7 tests).

`ccplt20.net` is behind Cloudflare. `sync.fetch_html` tries `requests`, then Playwright Chromium.

## Commands

```bash
pip install -r requirements.txt
python -m pytest test_ccpl_real_markup.py
python sync.py backfill
python sync.py poll --match-id 4806
```

Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.

The workflow splits daily backfill from weekend discovery. The long poller uses concurrency group `cricket-ccpl-poller` with `cancel-in-progress: false` so overlapping 5-minute ticks cannot stack pollers.

`parse_ballbyball` still needs a saved live `ballbyball.do` HTML fixture before production.
The `~/workspace/nova-royals-cricket-sync/` prototype was not on this machine; this folder was rebuilt from the validated markup brief.
