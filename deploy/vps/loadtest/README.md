# Load test (k6)

`pupil-load.k6.js` simulates pupils: login once, then dashboard reads, and an exam attempt with an autosave every
10 s (the Bijak SPM flow). It exists to check the sizing table in `docs/ops/production-vps.md` (section 13) with a
measurement instead of the assumptions in that table.

**Never run it against production without the LEAD's say-so.** It writes attempts and logs in many accounts. The
script refuses to start unless `LT_CONFIRM_TARGET` equals the host of `BASE_URL` and `LT_I_UNDERSTAND_THIS_WRITES_DATA=yes`: typing them is the deliberate act.

## Run

```
k6 run \
  -e BASE_URL=https://staging.example.my -e LT_CONFIRM_TARGET=staging.example.my -e LT_I_UNDERSTAND_THIS_WRITES_DATA=yes \
  -e LT_ACCOUNTS_FILE=/path/outside/the/repo/accounts.json \
  -e VUS=300 -e DURATION=10m \
  deploy/vps/loadtest/pupil-load.k6.js
```

Accounts come from the environment only: `LT_ACCOUNTS_FILE` (preferred; JSON `[{"identifier":"...","password":"..."}]`, mode 600, kept
outside the repo; avoids passwords in the process list and shell history) or `LT_IDENTIFIER_PREFIX` + `LT_IDENTIFIER_COUNT` + `LT_PASSWORD`. Use fictitious accounts on a
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

## Event simulation (400 pupils)

`event-sim.k6.js` simulates an event: about 400 pupils, each its own account, arriving at random times over a ramp, then a hold, then leaving over a ramp-down. A pupil logs in once, then repeats a weighted random behaviour (Latih Tubi practice 60, Bijak exam attempt 20, browsing 20) with an idle pause between them. It never calls an AI endpoint (the script refuses such a path). `seed-test-pupils.cjs` creates the accounts, `cleanup-test-pupils.cjs` removes them and everything they caused. Run it only with the LEAD's say-so: it writes real rows.

### 1. Preconditions and backup

- API container `pretasiplus-api-1` (project `pretasiplus`) is up and healthy; the database container is `db`. Choose a quiet time. Nobody else should be testing.
- Backup first, as `ppdeploy`: `sudo -u ppdeploy deploy/vps/backup/backup.sh --tag pre-loadtest --no-files`. Check it ends without error.
- On the load generator (separate box, Ubuntu 24.04): k6 installed (`k6 version`). To install, per k6 docs: add the Grafana k6 apt repository and key (`dl.k6.io`), then `sudo apt-get update && sudo apt-get install k6`. The script was written for k6 v1/v2 APIs only (`k6/http`, `k6/execution`, `k6/data`, `k6/metrics`, `open()` in the init context).
- Password file `/root/lt/pw` (one line, mode 600) on BOTH the app server and the load generator, same content. Never paste the password into a command line or a chat.

### 2. Seed (dry run, then real)

Run on the app server as root. The container root is read-only, so the scripts go in over stdin into `/tmp` (tmpfs):

```
cd /path/to/release-checkout
docker exec -i pretasiplus-api-1 sh -c 'umask 077; cat > /tmp/lt-seed.cjs'    < deploy/vps/loadtest/seed-test-pupils.cjs
docker exec -i pretasiplus-api-1 sh -c 'umask 077; cat > /tmp/lt-cleanup.cjs' < deploy/vps/loadtest/cleanup-test-pupils.cjs
docker exec -i pretasiplus-api-1 sh -c 'umask 077; cat > /tmp/lt-pass'        < /root/lt/pw
E="-e LT_SEED_CONFIRM=LT-UJIAN-BEBAN -e LT_PASSWORD_FILE=/tmp/lt-pass -e LT_ACCOUNTS_OUT=/tmp/lt-accounts.json -e LT_PUPILS=400"
docker exec $E pretasiplus-api-1 node /tmp/lt-seed.cjs --dry-run     # counts only; writes nothing
docker exec $E pretasiplus-api-1 node /tmp/lt-seed.cjs               # creates school "Sekolah Ujian Beban (LT)" (code LT-UJIAN-BEBAN), a 14 day subscription, 400 pupils lt-pupil-0001..0400
docker exec pretasiplus-api-1 cat /tmp/lt-accounts.json > /root/lt/accounts.json   # identifiers only, no password
docker exec pretasiplus-api-1 rm -f /tmp/lt-pass
```

Copy `/root/lt/accounts.json` to the load generator (it holds identifiers only). The pupils are `student` role in grade 10 and 11 (Tingkatan 4 and 5), the school has an active subscription (so there is no 50 question trial), no e-mail, no IC. The script is idempotent and refuses to run without `LT_SEED_CONFIRM`.

### 3. Run k6 from the load generator

```
k6 run \
  -e BASE_URL=https://<prod host> -e LT_CONFIRM_TARGET=<prod host> -e LT_I_UNDERSTAND_THIS_WRITES_DATA=yes \
  -e LT_ACCOUNTS_FILE=/root/lt/accounts.json -e LT_PASSWORD_FILE=/root/lt/pw \
  -e LT_PUPILS=400 -e LT_RAMP=5m -e LT_HOLD=15m -e LT_RAMPDOWN=3m \
  -e LT_SUMMARY_JSON=/root/lt/summary.json \
  deploy/vps/loadtest/event-sim.k6.js
```

Before the real run, a smoke run is cheap: `-e LT_PUPILS=10 -e LT_RAMP=1m -e LT_HOLD=2m -e LT_RAMPDOWN=30s`. Other knobs are listed at the top of the script (weights `LT_W_PRACTICE/BIJAK/BROWSE`, think time `LT_THINK_MIN_S/MAX_S`, thresholds `LT_P95_<KIND>_MS`).

**Why one load generator address is fine** (from the code: `apps/api/src/common/security/global-rate-limit.guard.ts`, `modules/auth/login-throttle.service.ts`, `deploy/vps/nginx/templates/pp.conf.template`):
- Signed-in requests are counted per user (1200 per minute), not per address. A pupil makes well under 20 requests per minute.
- Only anonymous requests count per address (`THROTTLE_GLOBAL_PER_MINUTE` 3000 per minute). Those are the logins: about 80 per minute at the default ramp.
- Login: 5 per minute per identifier and address (one login per pupil, a failed pupil is retried at most 3 times, 15 s apart, then stops). The per-address failed-login ceiling is 20 per minute, and each login in flight holds one unit until it succeeds: keep concurrent logins below 20, which holds below about 3 logins per second.
- Edge `/api/auth/`: 300r/m (5 per second) with burst 120 and `nodelay`: at most `120 + 5 x T` logins fit in the first T seconds. 400 logins need a ramp of at least 1 minute, so keep `LT_RAMP` at 2 minutes or more (default 5 minutes = 1.3 per second on average, random peaks of 3 to 4 per second). Do not shorten it below 2 minutes.
- API pool is 10 connections per process; the expected load is about 30 requests per second, far below the 200 per second of the sizing table.

### 4. What to watch during the run

App server: `docker stats pretasiplus-api-1` (CPU under 70% of the limit, memory under 80%), `docker logs -f --since 1m pretasiplus-api-1 | grep -ci error`, and the 429/5xx lines in the edge log. Database server, in a second terminal:

```
docker exec db psql -U pp -d prestasiplus -c "select state, count(*) from pg_stat_activity group by 1"
docker exec db psql -U pp -d prestasiplus -c "select pid, now()-query_start as running, wait_event_type, left(query,80) from pg_stat_activity where state <> 'idle' order by 2 desc limit 10"
docker stats db            # CPU and memory of the database container; also `top` on the host
```

Stop the run (Ctrl-C in k6) if the API container passes 90% CPU for a minute, the 5xx rate climbs, or `pg_stat_activity` shows a growing lock wait.

### 5. Cleanup (dry run, then real)

```
docker exec -e LT_SEED_CONFIRM=LT-UJIAN-BEBAN pretasiplus-api-1 node /tmp/lt-cleanup.cjs --dry-run   # per-table counts, deletes nothing
docker exec -e LT_SEED_CONFIRM=LT-UJIAN-BEBAN pretasiplus-api-1 node /tmp/lt-cleanup.cjs             # one transaction; rolls back on any problem
docker exec pretasiplus-api-1 rm -f /tmp/lt-seed.cjs /tmp/lt-cleanup.cjs /tmp/lt-accounts.json
shred -u /root/lt/pw /root/lt/accounts.json    # on both boxes, when done
```

The cleanup stops without deleting if a table it does not know still holds rows for the test pupils. `login_attempts` rows (keyed hashes) are not removed; they expire within 15 minutes. Dashboards and leaderboards that include the test school while it exists are listed in the report of this task.

### 6. Reading `summary.json`

`by_kind.<kind>` has `requests`, `p50_ms`, `p95_ms`, `p99_ms`, `max_ms` for `login`, `read`, `practice_start`, `practice_check`, `practice_submit`, `bijak_start`, `autosave`, `bijak_submit`. Also `error_rate` (share of requests with an unexpected status), `throttled_429` (any value above 0 means a limit was hit: read the edge and API logs, the run measured a limiter), `server_5xx`, `trial_402` (above 0 = the test school has no live subscription), `practice_no_questions_422` (a subject had too few questions; expected, retried), `iterations_by_behaviour`, and `thresholds_failed` (empty = pass). Default thresholds: login p95 < 3 s, read < 500 ms, practice_check < 500 ms, autosave < 400 ms, starts and submits < 1.5-2 s, error rate < 1%, zero 429.

