# Backend tests in Linux (T-A2)

Why: the backend suite (`apps/api`, vitest, about 990 spec files, 10,600 tests) has specs that depend on file modes, symlinks, POSIX shell and paths (`test/migration/*`, the dump and anonymise CLIs, `answer-store-writers`). On Windows they fail for reasons that are not product defects. This runs the whole suite in a Linux container on any host.

Files: `deploy/test/compose.be-test.yaml`, `deploy/test/run-be-tests.sh`.

## Run

From the repository root (PowerShell or bash):

```
docker compose -p pp-betest -f deploy/test/compose.be-test.yaml run --rm runner
docker compose -p pp-betest -f deploy/test/compose.be-test.yaml run --rm runner test/support/tickets.spec.ts
docker compose -p pp-betest -f deploy/test/compose.be-test.yaml down -v      # when finished: removes the Linux copy, node_modules cache and database
```

Arguments after `runner` go to `vitest run` (a file, a folder, `-t "name"`, `--maxWorkers=2`). A JSON report: pass `--reporter=json --outputFile.json=/out/vitest.json` and set `PP_BETEST_OUT` to a host folder outside the repository (default is a named volume).

What it does: starts `postgres:16-alpine` (fsync off, 400 connections, data in tmpfs) on a private network and passes it as `TEST_DATABASE_URL`, so no Docker-in-Docker and no Testcontainers daemon is needed. `node:22.22.2-bookworm` syncs the working tree read-only from `/src` into a volume (`node_modules`, `dist*`, `.git`, `e2e`, `.migration-out`, `test-results*`, `.claude`, `.playwright-mcp` excluded; incremental, see "Incremental sync"), runs `npm ci` only when `package-lock.json` changed, then `prisma generate` and `vitest run`. Nothing is written back to the repository and no host port is published, so it does not touch the local stack (project `pp-v3`).

## Practical notes

- First run: about 15 to 25 minutes for the copy (Windows bind mounts read slowly) and `npm ci` (the optional `cpu-features` package compiles with node-gyp and can stall on a busy machine; it is optional, killing that one `node-gyp` process lets `npm ci` finish). Later runs reuse `node_modules` and copy only what changed since the last run.
- Use `--maxWorkers=2` and `NODE_OPTIONS=--max-old-space-size=3072` on a shared 8 GB Docker VM. With the default 4 workers beside other containers the container was OOM-killed (exit 137) once.
- The suite is CPU bound: on a 6 CPU VM shared with other test runs it ran at about 50 to 100 tests per minute. Run it when the VM is otherwise quiet. Load makes DB specs hit their 120 s `beforeAll` timeout (seen as "N tests skipped" for a whole file, for example `test/support/tickets.spec.ts`); re-run such a file alone before calling it a failure.
- CI should use the service-container route already described in `apps/api/test/support/global-setup.ts` (`TEST_DATABASE_URL`); this compose file is the local equivalent.

## Results of the first Linux run (10 Nov 2026)

A full-suite run could not be completed: the first attempt was OOM-killed (4 workers), the second ran for 90 minutes on a machine shared with other test runs and was lost when Docker Desktop was restarted. The focused run of `test/migration`, `test/support/tickets.spec.ts`, `test/conformance/run.spec.ts`, `test/seed` and `test/subscriptions/seed-production.spec.ts` (116 files, 2,321 tests) finished in 18 minutes. After the Linux fixes (loopback database host, a scratch `git init`) the remaining failures were: `test/migration/anonymise/*`, `dump/cli`, `staging/{ddl,load,never-stage,profile}` (ETL staging spec grew to 45 tables incl. `school_battle_rankings`, while `anon.config.json` has no rules for 20 of its columns and the never-stage list still expects 38/127) and `test/seed/seed-clock.spec.ts` (no weekly rows). `tickets.spec` passed 34/34 in Linux. Raw logs stay outside the repository.

## Incremental sync

`run-be-tests.sh` (function `sync_tree`) copies `/src` into `/work` only for the first run. Every later run:

- copies only files newer than the stamp `/work/.sync-stamp` (`find -newer` piped to `tar --null -T -`, same excludes as the old full copy);
- deletes files that exist in `/work` but no longer in `/src` (sorted file lists compared with `comm`; `node_modules`, `.git` and the other excluded paths are never touched; it refuses to delete anything when `/src` lists no files at all, for example a missing mount);
- replaces the stamp only after the sync succeeded. The stamp is dated at the start of the sync minus 60 seconds, so a file edited during the sync, or a small clock difference between the host and the container, makes that file be copied again next time. A few recently edited files are therefore always re-copied;
- keeps the old tolerance: `tar` exit 1 (file changed while read) is a warning, exit 2 fails the run;
- prints `sync (full|incremental ...): N copied, M deleted, S s`.

Force a full copy with `PP_BETEST_FULL_SYNC=1` (for example `docker compose ... run --rm -e PP_BETEST_FULL_SYNC=1 runner`), or delete the stamp. Do this after a restore of the volume, or if `/work` was changed by hand. `down -v` clears the volume, so the next run is a full copy again.

Do not edit `run-be-tests.sh` while a runner container is executing it (bash reads the script as it runs); the shared runner lock (`shared-runner` notes) covers this.
