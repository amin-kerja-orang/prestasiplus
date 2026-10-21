# CI secrets (GitHub Actions)

Names only. Values are never written to the repo, docs, issues, PR bodies or logs. The LEAD sets and rotates
them. Where: GitHub, repository `amin-kerja-orang/prestasiplus` → **Settings → Secrets and variables → Actions →
Repository secrets → New repository secret**.

| Secret | Used by | Needed when | If it is missing |
|---|---|---|---|
| `E2E_DEMO_PASSWORD` | `.github/workflows/e2e-http.yml` (manual run only, `workflow_dispatch`) | Only when someone runs **Actions → e2e-http → Run workflow** (78-13, AZ-24). No push or pull request ever needs it. | The `preflight` job posts the notice "e2e-http skipped: the repository secret E2E_DEMO_PASSWORD is not set …" (annotation and job summary), and the `e2e-http` job is **skipped**, not failed. |

## `E2E_DEMO_PASSWORD`

- **What it is:** the password of the demo-seed accounts (`pelajar@demo.test`, `guru@demo.test`, …) on the
  throw-away stack that `e2e-http.yml` builds inside the runner. The `@api` and `@bijak` http specs read it
  (`e2e/api/helpers.ts`, `e2e/bijak/http-creds.ts`).
- **Value rule:** it must match the password the seed gives those accounts in that job. The job's `.env.api` does
  not set `SEED_DEMO_PASSWORD_HASH`, so today that is the published seed default
  (`apps/api/prisma/seed/core/demo-password.ts`). If the LEAD wants a non-default value, the job must also put
  the matching argon2id hash in `SEED_DEMO_PASSWORD_HASH` (a workflow change, not only a secret).
- **It is not** the staging, demo-cloud or production password. Never reuse one of those here: a workflow
  secret is readable by anyone who can change a workflow on a branch that runs it.
- **Rotation:** change the secret value; nothing else holds it.

## Workflows that need no secret

- `frontend.yml` (AZ-21c, PR #140): its `e2e-api` job makes a random demo password per run, seeds its hash
  (`SEED_DEMO_PASSWORD_HASH`) and passes the clear text to the specs as a masked job-local
  `E2E_DEMO_PASSWORD`. Nothing to set.
- `api.yml`, `no-dumps.yml`: throw-away database credentials inline, CI-only.
