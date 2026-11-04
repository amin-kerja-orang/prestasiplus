# Local / E2E seed (R1-B19)

A guarded seed profile for local and end-to-end runs. It is **off by default** and must never be run on a server: the `poc` profile does not include it, the production demo guard skips it, and it also needs its own flag.

## One command

```bash
cp .env.db.example .env.db && cp .env.api.example .env.api
# .env.api: set DATABASE_URL to the .env.db user, password and database (host `db`), and SESSION_SECRET
npm run stack:up
```

`stack:up` is `docker compose -f compose.yaml -f compose.http.yaml up -d --build --wait`. It runs, in order: db, then the `migrate` job (`prisma migrate deploy`, the demo seed, then this e2e seed), then the api (`compose.yaml` `depends_on` makes it wait for `migrate` to finish successfully), then the frontend on http://localhost:5192. No other manual step is needed.

The five e2e logins are `account(role)` in `e2e/api/helpers.ts` (`student`, `studentB`, `guru`, `adminSekolah`, `adminPusat`; the password comes from `BIJAK_<ROLE>_PASS`, `E2E_DEMO_PASSWORD`, else the fixture default). The smoke check logs each one in and reads the session role:

```bash
npx playwright test -c playwright.http.config.ts e2e/api/stack-smoke.spec.ts
```

The API image ships `docs/reference/blueprints/*.json` (the layer-2 blueprint files read by `seed/bijak-standards/layer2.ts`). Before it did, the seed saw no quota or KBAT data and the e2e seed stopped with `blueprint 3472/2 does not pass the Sahkan checks (NO_QUOTA, NO_KBAT)`, so `migrate` failed and the api never started.

## Run

```bash
# local stack or a throwaway database only
E2E_SEED=1 npm run be:db:seed -- --profile=e2e
```

Both are required: `--profile=e2e` and `E2E_SEED=1` (or `true`). Without the flag the module logs one line and creates nothing. Optional: `E2E_BLUEPRINT=<code>` to verify another launch blueprint (default `3472/2`, Matematik Tambahan Kertas 2).

With `E2E_DEMO_SECONDARY=1` as well, the demo schools DEMO002..004 become type SMK and their pupils move up to Tingkatan, because D72 hides primary schools and the `@api` browser specs (`playwright.http.config.ts`) use them as their other schools. Same fixture as `apps/api/test/support/secondary.ts`. `frontend.yml` and `compose.http.yaml` set it.

## What it creates (idempotent, fictitious)

| What | Value |
|---|---|
| Tingkatan 4 pupil | `murid.t4.e2e@example.test`, grade 10, school DEMO001 |
| Tingkatan 1 pupil | `murid.t1.e2e@example.test`, grade 7, school DEMO001, with servable questions in at least one subject (CI fixture for AC-X3-1, card S5-T01) |
| Tingkatan 5 pupil | `murid.t5.e2e@example.test`, grade 11, school DEMO001, with servable questions in at least one subject (CI fixture for AC-X3-1, card S5-T01) |
| Admin Pusat | `admin.pusat.e2e@example.test`, national scope |
| Evidence | the study evidence rows of `3472/2` replaced by admin-origin rows with the same values, note `E2E fixture: ...` (H-A15: study rows do not count at Sahkan) |
| Blueprint | `3472/2` moved from Spec to Disahkan with `serves_students = true` (verification note set) |
| K2 fixture | 15 structured `3472/2` questions plus one published Kertas 2 paper (`e2e-k2.ts`, see below) |
| Question pool | the `questions-pool` demo seed also runs under `e2e` (Tingkatan 4 and 5 MCQs per subject), so the paper builder reaches Sepadan for Matematik Kertas 1 (1449/1, 40 questions) from the bank |

The password is the existing demo convention (`core/demo-password.ts`: the published demo password, or the argon2id hash in `SEED_DEMO_PASSWORD_HASH` if set); see [AKAUN-DEMO-LOCAL.md](../AKAUN-DEMO-LOCAL.md). No secret is stored in the repo.

The blueprint is moved with the same checks and repository calls as the Kontrak "Sahkan" action: the AC-39.1 gate and the AC-39.7 evidence comparison (two or more bodies, trial paper and skema each, D77) must pass, then an insert-only verification row is written. If the blueprint does not pass, the seed fails and does not mark it Disahkan. `3472/2` is the only launch blueprint that passes as seeded; the others have incomplete layer-2 KBAT values or a single evidence body. Run the Jana Kertas E2E with subject `3472` Kertas 2 (the pupil may get 422 `SHORTAGE` until the question pool for that subject is loaded).

Refusals: the seed throws when the run counts as production (`countsAsProduction`, even with `ALLOW_DEMO_SEED`), and it reads `E2E_SEED` / `E2E_BLUEPRINT` from the runner env.

Kertas 2 fixture (T26c, REQ-B-003): the e2e seed also writes an E2E FIXTURE, `apps/api/prisma/seed/e2e-k2.ts`: 15 generic Matematik Tambahan structured questions (labels `E2E-K2-*`, `exam_board` and `set_label` = `E2E fixture`; 7 in Bahagian A for 50 marks, 4 in B and 4 in C of 10 marks each; every question multi-part, approved, with a DSKP unit and SP and a TP and cognitive level on every leaf) and one published (Terbit) paper `E2E fixture: Percubaan Matematik Tambahan Kertas 2` built from them on the Disahkan `3472/2` blueprint. Each question passes the real approve gate before it is written. It runs only inside the guarded e2e seed (profile `e2e`, `E2E_SEED=1`, never in production) and only for the default `3472/2` blueprint; it is never part of the UAT or production seed, where blueprints are created and Sahkan'd by the admin. `e2e/api/bijak-part-input.spec.ts` sits this paper (no longer `test.fixme`). Jana Kertas on 3472/2 may still answer 422 `SHORTAGE`: 15 questions are a fixed paper, not a generation pool.
