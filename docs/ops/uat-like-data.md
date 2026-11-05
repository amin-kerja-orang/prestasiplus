CI fixtures only, not acceptance evidence

# Seed profile `uat-like` (S4-T01)

## Purpose

Decision D110: acceptance is done on UAT, a clone of V2 production data. No UAT dump, no anonymised local restore and no synthetic acceptance profile exists. The profile `uat-like` is only a small deterministic set of fixtures for **automated tests in CI** (card S4-T01, FR-X5-1, DM-39). It reproduces the data defect shapes that S4 checks and fixers must handle. Never use it, or numbers taken from it, as acceptance evidence. All data is fictitious.

## How to run

```bash
# local stack or a throwaway database only (a demo seed: refused in production unless ALLOW_DEMO_SEED)
npm run be:db:seed -- --profile=uat-like
```

`be:db:seed` is the root script `npm run db:seed -w @pp/api --`. It needs `DATABASE_URL` and a migrated database. The run is deterministic and idempotent: a second run changes nothing. The test is `apps/api/test/seed/uat-like.spec.ts`.

## Include / exclude list

Entries of the seed registry (`apps/api/prisma/seed/index.ts`) that have no `profiles` run in every profile. For `uat-like` only the names in `UAT_LIKE_BASE_MODULES` are kept; every other entry without `profiles` is skipped. Entries with `profiles` follow their own list (`uat-like-fixtures` has `['uat-like']`; `questions-pool` and `poc-profile` do not list it).

| Module | uat-like | Why |
|---|---|---|
| `core-identity` | included | Admin Pusat, Admin Sekolah, Guru, Tingkatan 4 and 5 pupils, schools DEMO001 and DEMO002 |
| `core-schools` | included | schools DEMO003 and DEMO004 (4 schools in all), JPN and PPD rows |
| `core-school-packages`, `core-wallet-tiers`, `core-marketplace-categories`, `spm-subject-configs` | included | reference catalogues the app reads |
| `curriculum` | included | Sains Tingkatan 4 curriculum nodes and chapters, which the question fixtures hang on |
| `uat-like-fixtures` | profile only | the fixtures below |
| `core-population`, `questions` (demo bank), `wallet`, `content`, `classes`, `bijak-sittings`, `battle`, `games`, `cikgu`, `pksk`, `poc/performance`, `spm`, `practice`, `marketplace`, `gamification` | excluded | demo or PoC data; would add noise, a bank or sittings |
| `exam`, `exam-demo-blueprints`, `exam-launch-blueprints`, `exam-retire-poc` | excluded | create papers and blueprints (Kontrak); the fixture needs 0 papers, 0 blueprints and 0 contracts |
| `e2e-bijak`, `questions-pool`, `poc-profile` | not in profile | own `profiles` lists |

## Fixtures and counts

Counts are constants in `apps/api/prisma/seed/uat-like/`; the test asserts `>=` the minimum (the zeros exactly).

| Fixture | Value |
|---|---|
| No Bab (`chapter_id` null; unit and SP set) | 5 approved Sains Tingkatan 4 MCQs, `UATLIKE-NOBAB-nn` (`UAT_LIKE_PER_SHAPE`) |
| No SP (no `question_version_sp_nodes` row; Bab and unit set) | 5, `UATLIKE-NOSP-nn` |
| Stimulus-less "Rajah n" stems (no stimulus, no figure) | 5, `UATLIKE-RAJAH-nn` |
| Duplicated stems (stem repeated as the only part prompt) | 5, `UATLIKE-DUP-nn` |
| Papers, blueprints, contracts (Kontrak = blueprint) | 0, 0, 0 |
| Schools | 4 (DEMO001..DEMO004), at least 3 required |
| Pupils Tingkatan 1, 2, 3 | `pengguna90001@contoh.invalid` (grade 7), `pengguna90002@...` (8), `pengguna90003@...` (9), names `Murid Contoh 90001` and so on, school DEMO001 |
| Pupils Tingkatan 4, 5 | reused from `core-identity`: `pelajar@demo.test` (grade 10), `pelajarmaju@demo.test` (grade 11) |
| Admin Pusat, Admin Sekolah (one school), Guru | reused from `core-identity`: `admin@demo.test`, `adminsekolah@demo.test` (DEMO001), `guru@demo.test` |

The password follows the demo convention of `core/demo-password.ts`. No secret is stored in the repo.

Not a fixture: the "11 education levels active" defect. Decision D115 removed it, because the S4-T05 constraint (DM-13) rejects such a row; it is an in-memory unit-test input for `check-levels.ts`.
