# Re-seed the staging/demo database (Supabase Postgres)

For the Group B developers who re-seed before a live demo. Staging only: never run this against production. Supabase and Render setup is in [deploy-execution.md](deploy-execution.md) and [deploy-staging.md](deploy-staging.md); not repeated here.

## 0. Prerequisites

1. Repo at the merged commit (`origin/feature/v2-backend`), then `npm ci`.
2. `DATABASE_URL` = the Supabase **session pooler** URI (port 5432, `?sslmode=require`), the same one the deploy docs use for migrate and seed. Not the transaction pooler (6543); it breaks Prisma. Keep it in the shell only, never in a committed file.
3. An argon2id PHC hash of the chosen staging demo password. The seed accepts only `$argon2id$v=19$m=...,t=...,p=...$salt$hash`; anything else aborts the seed (the value is never printed). Generate it with the repo's own `@node-rs/argon2`, same parameters as the seed (memoryCost 19456, timeCost 2, parallelism 1). Bash, from the repo root:

```bash
read -rs -p "Demo password: " PW; echo
(cd apps/api && PW="$PW" node -e "require('@node-rs/argon2').hash(process.env.PW,{memoryCost:19456,timeCost:2,parallelism:1}).then(h=>console.log(h))")
unset PW
```

The password is read from a silent prompt (not in shell history, not in argv). Only the hash is printed.

**The password and the hash are secrets.** Store both in the team vault. Never commit them, never paste them in chat or tickets. Share the password with demo users through the vault only.

Set the hash for the session (single quotes, because it contains `$`):

```bash
export SEED_DEMO_PASSWORD_HASH='<argon2id hash from the vault>'
export DATABASE_URL='<supabase session pooler url>'
```

## Path A: fresh or never-seeded database (preferred)

Set `SEED_DEMO_PASSWORD_HASH` BEFORE the first seed (an account that already has a hash keeps it, see Path B).

```bash
npm run be:db:migrate        # prisma migrate deploy; safe to re-run
ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc
```

Expected last line: `seed: profile=poc, N module(s): ...` (`poc` is also the default profile). To start from an empty database, recreate the Supabase project schema first (or restore a clean backup), then run the two commands above.

## Path B: already seeded with the published dev password (Demo1234)

The seed writes the hash only when the stored `users.password_hash` is NULL (`existing.passwordHash ?? demoPasswordHash()` in `core/identity.ts` and `core/population.ts`). So the hashes of the demo accounts must be emptied first. Take a Supabase backup first (Dashboard -> Database -> Backups). Alternative: reset the database and follow Path A.

Demo accounts the seed creates: `@demo.test` (identity, population, Bijak PoC pupils murid4 to murid8), `@example.test` (population pupils/teachers/school admins, also on the dev password), and the e-mail-less roster pupil `murid01` of DEMO002. Run in the Supabase SQL editor or `psql "$DATABASE_URL"`:

```sql
BEGIN;

-- 1. Dry check: note the count, make sure it looks right (demo accounts only).
SELECT count(*) FROM users
WHERE lower(email) LIKE '%@demo.test'
   OR lower(email) LIKE '%@example.test'
   OR (email IS NULL AND username = 'murid01'
       AND school_id = (SELECT id FROM schools WHERE code = 'DEMO002'));

-- 2. Empty the hashes (same predicate). The row count must equal step 1.
UPDATE users SET password_hash = NULL
WHERE lower(email) LIKE '%@demo.test'
   OR lower(email) LIKE '%@example.test'
   OR (email IS NULL AND username = 'murid01'
       AND school_id = (SELECT id FROM schools WHERE code = 'DEMO002'));

-- COMMIT;   -- only if the UPDATE count equals step 1 and no real account is involved; otherwise ROLLBACK;
```

Never widen the predicate: no account outside these patterns may be touched.

Then re-run the seed (same env as Path A):

```bash
ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true npm run be:db:seed -- --profile=poc
```

**Follow-up SQL (required).** The Bijak PoC seed (`poc/bijak-sittings.ts`) copies `pelajar@demo.test`'s hash into `murid4` to `murid8@demo.test` only when it CREATES them; for existing rows it does not touch the hash, so after the reset above they stay NULL and cannot log in. Fix after the seed:

```sql
BEGIN;
UPDATE users SET password_hash = (SELECT password_hash FROM users WHERE lower(email) = 'pelajar@demo.test')
WHERE lower(email) IN ('murid4@demo.test','murid5@demo.test','murid6@demo.test','murid7@demo.test','murid8@demo.test')
  AND password_hash IS NULL;   -- expect 5 rows
COMMIT;
```

## Verify after seeding

Log in at the staging site with the vault password:

| Account | Role | Expect |
|---|---|---|
| `guru@demo.test` | teacher | Dashboard Guru (`/guru`) loads |
| `adminsekolah@demo.test` | school admin | school dashboard loads |
| `admin@demo.test` | Admin Pusat | Command Center loads |
| `pelajar@demo.test` (and one of `murid4`..`murid8@demo.test`) | pupil | `/dashboard` loads |

Also check that `Demo1234` is **rejected** for these accounts.

Then check the data:
1. School-admin dashboard (`adminsekolah@demo.test`, school DEMO001): at least 5 pupils and a non-empty practice block.
2. Teacher `guru@demo.test` -> Kelas Saya (`/guru/kelas`) -> "Kelas Demo Matematik T4" (code `DEMO4M`): sessions are listed.
3. Teacher -> Analisa Item (`/guru/analisis-item`): the Bijak item analysis is not empty. Its rows come from the demo bank paper "Latihan Demo Matematik Bank Soalan (Contoh)" (6 lettered MCQ); the PoC papers have no lettered options, so they do not appear there.

## Notes

- The seed is idempotent and deterministic (upsert by natural key, fixed clock and PRNG). Re-running it is safe.
- `BIJAK_POC_QUESTIONS=true` must also be set in the **API runtime env** (Render), not only for the seed command, or the PoC papers have no questions. Redeploy after changing it.
- `ALLOW_DEMO_SEED` must never be set on production. Without it, `be:db:seed` there loads reference data only (`school_packages`).
- Do not put `SEED_DEMO_PASSWORD_HASH` in the repo; it is only needed in the shell that runs the seed.
