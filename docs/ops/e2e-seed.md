# Local / E2E seed (R1-B19)

A guarded seed profile for local and end-to-end runs. It is **off by default** and must never be run on a server: the `poc` profile does not include it, the production demo guard skips it, and it also needs its own flag.

## Run

```bash
# local stack or a throwaway database only
E2E_SEED=1 npm run be:db:seed -- --profile=e2e
```

Both are required: `--profile=e2e` and `E2E_SEED=1` (or `true`). Without the flag the module logs one line and creates nothing. Optional: `E2E_BLUEPRINT=<code>` to verify another launch blueprint (default `3472/2`, Matematik Tambahan Kertas 2).

## What it creates (idempotent, fictitious)

| What | Value |
|---|---|
| Tingkatan 4 pupil | `murid.t4.e2e@example.test`, grade 10, school DEMO001 |
| Admin Pusat | `admin.pusat.e2e@example.test`, national scope |
| Evidence | the study evidence rows of `3472/2` replaced by admin-origin rows with the same values, note `E2E fixture: ...` (H-A15: study rows do not count at Sahkan) |
| Blueprint | `3472/2` moved from Spec to Disahkan with `serves_students = true` (verification note set) |
| Question pool | the `questions-pool` demo seed also runs under `e2e` (Tingkatan 4 and 5 MCQs per subject), so the paper builder reaches Sepadan for Matematik Kertas 1 (1449/1, 40 questions) from the bank |

The password is the existing demo convention (`core/demo-password.ts`: the published demo password, or the argon2id hash in `SEED_DEMO_PASSWORD_HASH` if set); see [AKAUN-DEMO-LOCAL.md](../AKAUN-DEMO-LOCAL.md). No secret is stored in the repo.

The blueprint is moved with the same checks and repository calls as the Kontrak "Sahkan" action: the AC-39.1 gate and the AC-39.7 evidence comparison (two or more bodies, trial paper and skema each, D77) must pass, then an insert-only verification row is written. If the blueprint does not pass, the seed fails and does not mark it Disahkan. `3472/2` is the only launch blueprint that passes as seeded; the others have incomplete layer-2 KBAT values or a single evidence body. Run the Jana Kertas E2E with subject `3472` Kertas 2 (the pupil may get 422 `SHORTAGE` until the question pool for that subject is loaded).

Refusals: the seed throws when the run counts as production (`countsAsProduction`, even with `ALLOW_DEMO_SEED`), and it reads `E2E_SEED` / `E2E_BLUEPRINT` from the runner env.

Known gap (REQ-B-003): the bank seed holds only 3 structured questions (2 Matematik, 1 Sains), while every Kertas 2 blueprint needs 5 or more, so no structured Kertas 2 paper can be published from the bank. The only seeded K2 papers are PoC papers (they answer 403 on start). `e2e/api/bijak-part-input.spec.ts` is `test.fixme` until a structured K2 paper is seeded from bank questions.
