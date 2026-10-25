# Demo redeploy with new migrations (migration-aware path)

Run sheet for the LEAD. Script: [`deploy/demo/redeploy-demo-migration-aware.sh`](../../deploy/demo/redeploy-demo-migration-aware.sh).
Background: [demo-deploy-23oct.md](demo-deploy-23oct.md) (the full Path A reset),
[demo-cloudflare-supabase.md](demo-cloudflare-supabase.md) (the targets),
[demo-reseed.md](demo-reseed.md) (the seed and the demo password),
[db-backup.md](db-backup.md) (the backup rules this snapshot follows).

Nothing here has been run against the cloud demo. Every result below comes from a local rehearsal against a
throwaway Postgres (section 8).

## 1. When to use this, and when not to

| Situation | Path |
|---|---|
| New code, **no** new migration | the plain code redeploy: the Render and Pages steps of [demo-deploy-23oct.md](demo-deploy-23oct.md) sections 3 and 4. Its rollback is code-only and still holds. (`scripts/deploy-demo.sh` with `PP_MODE=redeploy` does the same end to end, but that workflow has not merged into this branch yet.) |
| New code **with** new migrations | **this script**. It exits 3 when there is nothing to migrate and points you back to the plain redeploy. |
| An earlier run of this script migrated, then stopped before the deploy | `run --resume` (section 5). |
| The database must be wiped and re-seeded | the Path A full reset in [demo-deploy-23oct.md](demo-deploy-23oct.md) section 2. |

**Why a separate path.** The plain redeploy promises a five-minute rollback: Render back to the old commit, Pages
back to the previous deployment, database untouched. Once `0043` and `0044` are applied that promise is dead —
code rolls back, a schema does not. So the default path here takes a database snapshot first and its rollback
restores that snapshot.

Note the two snapshot-related environment names, because the rollback depends on them: **`SNAPSHOT_DIR`** is where
a run writes its snapshot, **`SNAPSHOT_FILE`** is the one `run --resume` carries forward, and
**`ROLLBACK_SNAPSHOT`** is the one `rollback` restores. Write the path down when a run prints it.

## 2. Before you start

- Postgres **client tools at least as new as the server** (Supabase runs 17). The script checks this and stops.
- `git`, `node`, `npm`, `jq`, `curl`, `sha256sum`.
- A checkout of this repo. The script reads the branch tips itself; it does not need your checkout to be at any
  particular commit.
- A folder for the snapshot, **outside the repository** and on an encrypted volume (same rule as
  [db-backup.md](db-backup.md)). Default `~/pp-demo-snapshots`, created mode 700; the snapshot file is mode 600
  with a `.sha256` beside it. The script refuses a folder inside the repo.
- Inputs in the shell (never in a file in the repo, never in a command line):

```bash
export DEMO_REF='<project ref of the demo Supabase project>'
export PGURL='postgresql://postgres.<DEMO_REF>@<pooler host>:5432/postgres'   # no password, no query string
export SUPABASE_CA_FILE="$HOME/prod-ca-2021.crt"
export RENDER_SERVICE_ID='srv-...' RENDER_URL='https://<service>.onrender.com'
export CLOUDFLARE_ACCOUNT_ID='<32 hex>' PAGES_PROJECT='<pages project>' PAGES_URL='https://<project>.pages.dev'
export RENDER_API_KEY='...' CLOUDFLARE_API_TOKEN='...'       # from the vault
```

`PGPASSWORD` and `DEMO_PASSWORD` are **not** exported: the script asks for each on a silent prompt, checks them,
and never prints them. The demo password must not be `Demo1234` (the published dev password); the script refuses
it before anything is written.

`PP_RUNNING_BACKEND_SHA` defaults to the backend the demo runs today. **Check it** — if Render serves a different
commit, set it, or the migration plan will not match the database and the script stops (`PP_ACCEPT_DRIFT=1`
overrides and goes by the database).

## 3. Dry run first (read-only, nothing is changed)

```bash
deploy/demo/redeploy-demo-migration-aware.sh plan
```

It prints: both branch tips read at run time, how many merge commits are new since the running API, which
migrations are new in the tree, which ones the live database still needs, and whether they are backward
compatible with the API that is running now. Read the `REVIEW` lines — they are additive statements that still
deserve your eye (new CHECK constraints, for example).

`compatibility: additive` means migrating first is safe: the running API keeps reading the database while the new
one builds, so there is **no window** in which an API faces a schema it cannot read. If a pending migration is
**not** additive the script stops: there is no deploy order that keeps the demo up through such a change, so take
the demo out of use first and re-run with `PP_ACCEPT_DOWNTIME=1`.

## 4. The run

```bash
deploy/demo/redeploy-demo-migration-aware.sh run
```

Order, and why:

1. **Read-only checks** of Render (auto-deploy off, `BIJAK_POC_QUESTIONS=true`) and Pages (production branch, and
   the current production deployment, which becomes the rollback target — the run prints that id and writes it to
   `out/pages-previous-deployment.txt` in its work directory. Note it down: a later manual `rollback` takes it as
   `ROLLBACK_PAGES_DEPLOYMENT_ID`.)
2. **Build the SPA** — before anything is written, so a build failure never leaves a migrated database behind.
3. **Snapshot** the `public` schema and **verify it**, then ask you to type `GO`.
4. **Migrate**, then re-apply the Data API lockdown (a new table would otherwise inherit Supabase's default
   grants).
5. **Deploy the API**, wait for `/api/health` to report `db up`.
6. **Deploy the SPA** and confirm it is the deployment production serves.
7. **Smoke** and the **read-only walkthrough**. If either fails the script rolls back by itself: Pages to the
   previous deployment, Render to the running commit, then the database from the snapshot — code first, database
   last, because the other order would put the new API in front of the old schema.

`KEEP_EDGE_SECRET=1` is the default: a refresh does not need a new edge secret, and rotating it opens a gap in
which the old worker sends no secret and every user shares one login-throttle bucket. Set `KEEP_EDGE_SECRET=0`
only when the secret must change, and expect that gap.

**Snapshot verification.** Use the strong proof when you can:

```bash
# a throwaway Postgres on your own machine, e.g. docker run --rm -d -p 55432:5432 \
#   -e POSTGRES_PASSWORD=throwaway -e POSTGRES_DB=demo_snapcheck postgres:17
export PP_SNAPSHOT_VERIFY=restore
export PP_VERIFY_PG_URL='postgresql://postgres:throwaway@127.0.0.1:55432/demo_snapcheck'
```

The snapshot is then really restored there and every table's exact row count is compared with the live database.
The URL must be a loopback host and its database name must end in `_snapcheck`. Without it the default
(`inventory`) still checks the dump header, the object list, that nothing outside schema `public` is in it, and
that every non-empty table of the live database has data in the dump — but nobody has restored it.

Every exit prints a `STATE` / `SNAPSHOT` / `EXIT` / `NEXT` block. `NEXT` is the instruction; follow it.

## 5. If a run stops half way (`--resume`)

Each exit prints a `STATE` line. If it says `migrated=1` with `api_deployed=0`, the schema has moved and the code
has not — the database is ahead of the API. Two ways out, and the `NEXT` line names both:

```bash
SNAPSHOT_FILE=~/pp-demo-snapshots/demo-before-<stamp>.dump \
  deploy/demo/redeploy-demo-migration-aware.sh run --resume     # finish: deploy + verify, no migration
ROLLBACK_SNAPSHOT=~/pp-demo-snapshots/demo-before-<stamp>.dump \
  deploy/demo/redeploy-demo-migration-aware.sh rollback          # give up: code and schema back
```

`--resume` re-checks the snapshot's `PGDMP` header and its `.sha256` before it trusts it, skips the migration
step, and keeps the automatic rollback: if the resumed run's smoke fails, that snapshot is what gets restored. It
refuses if migrations are in fact still pending (then it is an ordinary run, not a resume), and with
`--no-snapshot` it finishes a forward-only run with no database rollback.

## 6. Manual rollback

```bash
ROLLBACK_SNAPSHOT=~/pp-demo-snapshots/demo-before-<stamp>.dump \
  deploy/demo/redeploy-demo-migration-aware.sh rollback          # type RESTORE
RESTORE_DB=0 deploy/demo/redeploy-demo-migration-aware.sh rollback   # code only; type CODE-ONLY
```

It checks the `.sha256` beside the snapshot, that the dump holds only schema `public`, runs the target gate, then
drops `public`, restores, re-applies the lockdown and checks that the newest migration is back to the running
API's. Everything written to the demo since the snapshot is lost — that is the trade.

**Which Pages deployment it goes back to** is decided by what is *live*, not by position in the list: only if the
live production deployment is this run's own upload does it step back to the one below. A run that stopped before
the SPA upload leaves the original SPA live, and the script says so and leaves Pages alone instead of rolling the
frontend one version too far. `ROLLBACK_PAGES_DEPLOYMENT_ID` overrides the choice. If Pages cannot be rolled back
at all (the list is unreadable, there is no earlier deployment, Cloudflare refuses), the script says so, **carries
on with Render and the database** — a migrated database with no rollback is the worse half to leave behind — and
ends by telling you the dashboard steps to roll the SPA back by hand.

## 7. Forward-only (`--no-snapshot`)

```bash
deploy/demo/redeploy-demo-migration-aware.sh run --no-snapshot
```

Only if you accept that **the database cannot be rolled back**. The script prints the consequences and makes you
type `NO-SNAPSHOT` at a terminal; `PP_ASSUME_YES=1` does not bypass it and there is no non-interactive way in. A
rollback afterwards moves Render and Pages back and leaves the schema where it is — safe only while every applied
migration is additive, which the compatibility step tells you. The only way back to the old schema is then a
Supabase backup you took yourself, or the Path A full reset.

## 8. Expected results

They are variables, not constants in the script, because the totals move as PRs merge:

| Variable | Default | Where the default comes from |
|---|---|---|
| `PP_EXPECT_SMOKE` | `Result: 29 passed, 0 failed` | `scripts/demo-smoke.sh` behind Pages |
| `PP_EXPECT_WALK_RO` | `: 102 passed, 0 failed, 5 skipped` | read-only `scripts/demo-walkthrough.sh` |
| `PP_EXPECT_WALK_RO_EXIT` | `3` | a read-only run ends on blocking SKIPs; that is normal |
| `PP_EXPECT_MIGRATIONS` / `PP_EXPECT_NEWEST` | counted from the tree at `BACKEND_SHA` | not hard-coded at all |

If the smoke or walkthrough totals have moved since this run sheet was written, set the variable to the number the
current suite produces — do not edit the script.

The write walkthrough (`CONFIRM_WRITES=1`) is **not** part of this path: it belongs to a database refresh, not to a
migration top-up. Run it by hand if you want it, per [demo-deploy-23oct.md](demo-deploy-23oct.md) 5.3.

## 9. Rehearsal record (24 Oct 2026, cloud container)

Against a throwaway Supabase-shaped Postgres 16 (non-superuser `postgres` owner, pooler login
`postgres.<ref>`, `pgcrypto` in `extensions`, the `anon` / `authenticated` / `service_role` roles with Supabase's
default grants), loaded to the running demo's state: 36 migrations, newest `0042_question_sets_nullable_classroom`,
197 tables, two `@demo.test` rows. Every Render and Cloudflare call stubbed (`PP_DEMO_STUB=1`); nothing left the
machine. Docker Hub is not reachable from that container, so the cluster was created with `initdb` instead of a
container image — same throwaway database, same client tools.

| What was rehearsed | Result |
|---|---|
| `plan` | 41 new merge commits, `0043` + `0044` new in the tree **and** pending in the database, classified additive, the two new CHECK constraints listed under `REVIEW` |
| Comment stripping | the `-- Reversible: DROP INDEX / DROP COLUMN` notes in `0043` do **not** trip the compatibility check |
| Snapshot + `PP_SNAPSHOT_VERIFY=restore` | dump written mode 600 outside the repo, header and object list checked, restored into `demo_snapcheck`, all 197 row counts identical |
| Migrate | 36 → 38 applied, newest `0044`, lockdown re-applied (4137 Data API grants → 0, `anon` SELECT on `users` → f) |
| `rollback` with the snapshot | 38 → 36, newest back to `0042`, the `questions.legacy_*` columns gone, the two demo rows still there |
| Automatic rollback | smoke pointed at a failing local edge → Pages + Render rolled back and the database restored to `0042` without being asked |
| Wrong confirmation word | `rollback` refused (exit 2, nothing touched); `run --no-snapshot` refused with `PP_ASSUME_YES=1` set, and refused outright with no terminal |
| Nothing to migrate | exit 3, pointing at the plain redeploy |
| A deliberately breaking migration (`DROP COLUMN`, `SET NOT NULL`) | refused; `PP_ACCEPT_DOWNTIME=1` lets it through after the window is accepted |
| Wrong `PP_RUNNING_BACKEND_SHA` | drift detected and refused; `PP_ACCEPT_DRIFT=1` goes by the database |
| `SNAPSHOT_DIR` inside the repo, `DEMO_PASSWORD=Demo1234` | both refused before anything was written |
| `run --resume` with the snapshot of an interrupted run | migration step skipped, deploy and verify ran, and the resumed run still restored that snapshot when its smoke failed (38 → 36, newest back to `0042`) |
| `run --resume` with migrations still pending, and with a tampered snapshot | refused in both cases |
| the Pages rollback target (stubbed Cloudflare, five cases) | this run's upload live → steps back one; a different commit live → leaves Pages alone; no earlier deployment, or the list unreadable → hands it to the operator and still restores the database; an explicit id wins |

Not rehearsed, because no AI session touches the cloud demo: the Render and Cloudflare API calls, the real
`/api/health` waits, the Pages upload, and the smoke and walkthrough against the real demo. Those are the LEAD's
first run.

## 10. Checklist

- [ ] `PP_RUNNING_BACKEND_SHA` matches the commit Render actually serves
- [ ] `plan` run and read; compatibility says `additive` (or the window is accepted and the demo is out of use)
- [ ] snapshot folder is outside the repo, on an encrypted volume
- [ ] `PP_SNAPSHOT_VERIFY=restore` with a throwaway Postgres, if you have one
- [ ] `run` finished with `GO`; the snapshot path noted and kept until after the demo
- [ ] browser go/no-go, the two-network login check, and no `ClientIp` warning in the Render log
      ([demo-deploy-23oct.md](demo-deploy-23oct.md) 5)
- [ ] after the demo: rotate the DB password ([demo-deploy-23oct.md](demo-deploy-23oct.md) 7) and delete the snapshot
