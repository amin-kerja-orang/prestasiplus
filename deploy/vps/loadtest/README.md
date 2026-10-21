# Load test (k6)

`pupil-load.k6.js` simulates pupils: login once, then dashboard reads, and an exam attempt with an autosave every
10 s (the Bijak SPM flow). It exists to check the sizing table in `docs/ops/production-vps.md` (section 13) with a
measurement instead of the assumptions in that table.

**Never run it against production without the LEAD's say-so.** It writes attempts and logs in many accounts. The
script refuses to start unless `LT_CONFIRM_TARGET` equals the host of `BASE_URL`: typing it is the deliberate act.

## Run

```
k6 run \
  -e BASE_URL=https://staging.example.my -e LT_CONFIRM_TARGET=staging.example.my \
  -e LT_ACCOUNTS_FILE=/path/outside/the/repo/accounts.json \
  -e VUS=300 -e DURATION=10m \
  deploy/vps/loadtest/pupil-load.k6.js
```

Accounts come from the environment only: `LT_ACCOUNTS_FILE` (JSON `[{"identifier":"...","password":"..."}]`, kept
outside the repo) or `LT_IDENTIFIER_PREFIX` + `LT_IDENTIFIER_COUNT` + `LT_PASSWORD`. Use fictitious accounts on a
staging copy (the demo seed accounts), never real pupils. One account per VU: the login throttle is 5 per minute per
identifier and address.

Other knobs (all optional): `RAMP` (1m), `LT_EXAM_RATIO` (0.3), `LT_SAVE_INTERVAL_S` (10), `LT_SAVES` (6),
`LT_THINK_S` (8), `LT_P95_READ_MS` (500), `LT_P95_SAVE_MS` (400), `LT_P95_LOGIN_MS` (3000), `LT_MAX_ERROR_RATE` (0.005).

## Pass thresholds

| Threshold | Default | Why |
|---|---|---|
| `http_req_duration{kind:read}` p95 | < 500 ms | dashboard, session, papers, attempt view |
| `http_req_duration{kind:autosave}` p95 | < 400 ms | the write a pupil feels while answering |
| `http_req_duration{kind:login}` p95 | < 3000 ms | argon2/bcrypt are CPU heavy; a lesson-start login wave |
| `http_req_failed` rate | < 0.5 % | any 4xx/5xx counts |
| `throttled_429` count | = 0 | a 429 means a rate limit was hit, not the capacity of the server |
| `checks` rate | > 99 % | each step asserts its status code |

Watch the server while it runs (`docker stats`, `docker compose logs -f api`): the API container must stay under
about 70 % of its CPU limit and its memory under 80 % of `PP_API_MEM`, and Postgres must not log temp files or lock waits.

## Throttles and a single load generator

All requests of one run come from one address, and the API throttles per address:
`THROTTLE_GLOBAL_PER_MINUTE` is **300 requests per minute per address on every `/api` route**. A load generator
(and, in real life, a school behind one NAT address) reaches that in seconds, then every call is a 429 and the run
measures the limiter, not the server. Do not change production values for a test. Choose one:

1. **Staging with raised throttles** (preferred): on the staging stack set in its `api.env`
   `THROTTLE_GLOBAL_PER_MINUTE=1000000` and redeploy the API. Per-user limits (autosave 240/min, reads 120-240/min) are
   not reached by one simulated pupil, so they can stay as they are. Staging must have the same sizing and the same
   Postgres settings as production for the numbers to mean anything.
2. **Several source addresses**: run k6 from 3 to 5 machines (each with its own public address) at `VUS/N` each.
   The per-address ceiling then holds per machine, but 300 per minute is still only 5 requests per second per machine,
   so this is only useful for small `VUS`.

Real-life consequence (report to the LEAD, decision OQ1): with the default of 300 per minute per address, one school
with a class of 40 pupils on one NAT address and about 12 requests per minute each (480 per minute) already exceeds
the ceiling. Production needs a higher `THROTTLE_GLOBAL_PER_MINUTE` (a number the LEAD decides), or the throttle must
key on the user for signed-in routes. This is an application setting, not an infrastructure one.

## What is not covered

Uploads (intake, audio KBAT), games, and the OCR worker are not simulated; test them by hand with the sizes in the
runbook. `k6` has not been run from the repository's build environment (no k6 binary there); the script logic was
exercised against a stub API only.
