# Merge queue for feature/v3-bijak-r1

The gate workflows also run on the `merge_group` event (`types: [checks_requested]`), so queued merges get their checks. Without this a queued PR would wait forever.

## What each workflow does on merge_group

| Workflow | Job (check name) | On merge_group |
|---|---|---|
| api.yml | `verify`, `deps-audit`, `docker`, `secret-scan` | Runs in full (`paths:` is not supported on merge_group) |
| api.yml | `openapi-diff`, `dependency-review` | Skipped (PR-only: they read the PR number, base ref and labels; already checked on the PR) |
| frontend.yml | `verify (build, vue-tsc, unit)` | Runs in full |
| frontend.yml | `e2e @api (http mode, 375/768/1280)` | Skipped (only for be/integration-frontend or a manual run) |
| e2e-http.yml | `preflight`, `e2e-http` | Runs in full (no paths filter on merge_group). `e2e-http` is skipped, not failed, if the secret `E2E_DEMO_PASSWORD` is missing |
| no-dumps.yml | `no-dumps` | Runs |
| r1-docs.yml | `r1-docs` | Runs |
| r1-scope-guard.yml | `scope-guard` | Skipped (checks the PR body and labels; done on the PR). Its concurrency group falls back to `github.ref`, and merge_group runs are never cancelled |

A skipped job reports success-as-skipped, which GitHub accepts for a required check.
Concurrency groups use `github.ref`, which is unique per merge_group ref. `cancel-in-progress` is true only for `pull_request` events.

## Settings the PO must apply

Settings -> Rules -> Rulesets -> New branch ruleset.

1. Name: `merge-queue feature/v3-bijak-r1`. Enforcement status: Active.
2. Bypass list: leave empty.
3. Target branches: Add target -> Include by pattern -> `feature/v3-bijak-r1`.
4. Rules: tick "Require merge queue" and set:
   - Merge method: Squash and merge
   - Build concurrency: 5
   - Minimum group size: 1
   - Maximum group size: 8
   - Wait time to meet minimum group size: 5 minutes
   - Status check timeout: at least 60 minutes (e2e-http and api `verify` take up to 45 minutes)
   - Only merge non-failing pull requests: ticked
5. Rules: tick "Require status checks to pass" and add exactly these checks (job names):
   - `scope-guard`
   - `r1-docs`
   - `no-dumps`
   - `verify (build, vue-tsc, unit)`

   Do not tick "Require branches to be up to date"; the queue tests each PR on top of the others.

### Why api.yml and e2e-http.yml checks are not in the required list

Both have a `paths:` filter on `pull_request`. A PR that touches none of those paths never gets the check, and a required check that never reports blocks the PR for ever. In the queue they run in full anyway, but only required checks can fail a queued merge. Choose one:

- Safe default (above): require the four always-reporting checks only.
- Stronger: also require `verify`, `deps-audit`, `docker`, `secret-scan` (api.yml) and `e2e-http` (e2e-http.yml), but first remove the `paths:` filter from `pull_request` in api.yml and e2e-http.yml (more Actions minutes per PR; needs a separate change). Add `openapi-diff` and `dependency-review` only if you accept that they are skipped in the queue.

## After it is enabled

- The merge queue replaces direct merges into `feature/v3-bijak-r1`. Nobody merges with the plain Merge button.
- Sessions merge with "Merge when ready" (enqueue): in the GitHub UI, or through the API (`gh pr merge <n> --squash --auto` uses the queue when a ruleset requires it).
- A PR that fails in the queue is removed; its author fixes it and enqueues again.
- Pushes to `feature/v3-bijak-r1` itself still run the `push` workflows after each squash merge.
