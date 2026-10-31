# v2 secondary school only (primary / Darjah hidden)

> Slug: `v2-secondary-only` | Track: Full (cross-module, touches seeds, contract, UI) | Status: G1 draft, 2026-10-29 | Branch: `local/v2-full`
> Decisions: D54-SEC (original, 2026-10-24) and D72 (refinement, 2026-10-29) in `docs/TRACKER.md`.

## 1. Summary and goal

v2 serves **secondary school (Tingkatan 1-5, with SPM focus) only**. Primary school (Darjah 1-6, SK/SJK) is **hidden everywhere, not deleted**. Goal: no learner, teacher, school admin or admin ever sees or can pick a Darjah level, a primary school or a Darjah pupil, while all primary rows and links stay in the database so the change is reversible and hard delete can be decided later.

### Context

- **D54-SEC** (user, 2026-10-24, UAT triage T1): "buang skop sekolah rendah (darjah) sistem baru fokus sekolah menengah dan SPM sahaja". It was recorded on the unmerged branch `origin/claude/wizardly-euler-glqplr` as "D54". The number D54 is already used on this branch for "Backend contract decisions" (2026-10-19), so it is cited here as **D54-SEC**. That branch implemented parts in the mock prototype and some frontend only (commits 898948c3, 098e4b34, 04e15b0b, fda7f44f, c72548dc), never in `apps/api`, and is not merged into `be/integration-frontend` or `feature/v2-backend`.
- **D72** (user, 2026-10-29, via the Delivery Lead session) refines D54-SEC with the four decisions below.

### Decisions (D72)

| # | Decision |
|---|---|
| 1 | **Hide now, do not delete.** `education_levels` D1-D6 (which already have `is_active`) are set inactive and hidden from every learner, teacher, school-admin and admin picker, list, chart and filter. Rows, FKs and data stay (deleting cascades or restricts across subject_levels, chapters, curriculum_nodes, question_versions, practice_sessions, classrooms, battles and more). Hard delete is a separate migration **after go-live (about 30 Oct 2026)** and needs its own decision. |
| 2 | **Secondary = Tingkatan 1-5 all stay** (registration, classes, games/battles, school lists). **Learning content** (practice chapter levels BR-11, Topik / Peta Belajar) stays focused on **Tingkatan 4-5 (SPM)**, as in D54-SEC. |
| 3 | **Real `.cloud` data:** primary schools (SK/SJK) and Darjah pupils/classes **are migrated by the ETL as planned** (no ETL change before go-live) but are **hidden in v2** (not shown, not usable). |
| 4 | **Delivery:** implement and test locally first (`local/v2-full` = `be/integration-frontend` + `feature/v2-backend` merged locally), then split into PRs for the frontend and backend branches. Nothing goes to UAT or production without the user's approval. |

## 2. Users / personas

| Persona | Impact |
|---|---|
| Murid (student) | Registers, profiles, practises, plays only at Tingkatan 1-5; practice and topics at T4-T5 |
| Guru | Class, question and import pickers offer T1-T5 only |
| Admin Sekolah | School, class, pupil lists and imports exclude primary |
| Admin Pusat | Kualiti Soalan, user/school management, dashboards exclude Darjah and primary |
| Demo / UAT accounts | All secondary |

## 3. User stories

| ID | Story | Priority |
|---|---|---|
| US-01 | As a student, I want to see only Tingkatan options when I register or edit my profile, so that I pick the right level without primary noise. | Must |
| US-02 | As a student, I want practice, topics and Peta Belajar limited to Tingkatan 4-5, so that content matches SPM. | Must |
| US-03 | As a teacher or school admin, I want class, import and filter pickers to offer T1-T5 only, so that I cannot create or filter primary data. | Must |
| US-04 | As a player, I want games, battles, lobbies and leaderboards to show Tingkatan only, so that primary pupils and levels never appear. | Must |
| US-05 | As an admin, I want question-quality, school, user and dashboard views to exclude Darjah and primary schools, so that reports reflect the secondary scope. | Must |
| US-06 | As a registrant, I want school search and registration to list only secondary schools, so that I cannot pick an SK/SJK. | Must |
| US-07 | As the product owner, I want the hiding to be data-driven and reversible, so that re-activating the levels restores primary and hard delete can be decided after go-live. | Must |
| US-08 | As the product owner, I want the ETL to keep loading primary rows unchanged, so that go-live migration is not put at risk. | Must |
| US-09 | As a tester or demo user, I want every demo account to be secondary, so that demos never show primary. | Must |

## 4. Acceptance criteria

Viewport rule for all UI criteria: verified at 375, 768 and 1280 px, for every role that can reach the screen.

| ID | Given / When / Then |
|---|---|
| AC-01.1 | Given any role at any viewport, When any screen, menu, picker, filter, chart legend, table column, empty state or toast is rendered, Then no option, label or row contains "Darjah", "Sekolah Rendah", "SK", "SJK" as a level or school type (case-insensitive search of rendered text finds none). |
| AC-01.2 | Given the registration form, When the level control is opened, Then exactly Tingkatan 1 to Tingkatan 5 are offered. |
| AC-01.3 | Given the profile edit screen (M01), When the level control is opened, Then exactly T1-T5 are offered; a user whose stored level is D1-D6 sees no Darjah value and is asked to choose a Tingkatan. |
| AC-02.1 | Given a student, When opening practice level or chapter selection, Then only Tingkatan 4 and 5 are offered (backend `OFFERED_LEVEL_CODES` contains no D-code). |
| AC-02.2 | Given a student, When opening Topik / Peta Belajar, Then only T4-T5 topics are listed. |
| AC-02.4 | Given a Tingkatan 1-3 pupil, When opening practice or topic pages, Then an empty state shows title "Kandungan akan datang" and description "Kandungan untuk Tingkatan anda akan datang. Buat masa ini, latihan tersedia untuk Tingkatan 4 dan 5." |
| AC-02.3 | Given a client that requests a practice session for a D-level via API, When the request is made, Then the API rejects it with a validation error and creates no session. |
| AC-03.1 | Given a teacher or school admin, When creating or editing a class, Then the level picker offers T1-T5 only. |
| AC-03.2 | Given a user import file (M02, student import), When it contains a Darjah level, Then that row is rejected with a BM validation message and others are processed as before. |
| AC-03.3 | Given class lists and filters (M27, M10), When rendered, Then Darjah classes are absent from lists, counts and filter options, even if they exist in the database. |
| AC-04.1 | Given the games hub and lobby (M16), When rendered, Then there is no DarjahPicker and no "Sekolah Rendah" optgroup; the picker lists T1-T5 only. |
| AC-04.2 | Given leaderboards, standings, battle opponent search and weekly competition, When listing participants, Then no Darjah pupil appears and rank/count totals are computed without them. |
| AC-04.3 | Given the PKSK track (M07), When rendered, Then no "Tingkatan 1 (Darjah 6)" label appears. |
| AC-05.1 | Given Admin Pusat on the M04 Kualiti Soalan page, When the "Mengikut Tingkatan" panel loads, Then it lists Tingkatan 1-5 only (backend `quality.service.ts` excludes inactive levels; D1-D6 never returned). |
| AC-05.2 | Given any admin list or dashboard (M02, M03, M05, M08, M09, M13, M17), When filtered by level, Then only T1-T5 appear and totals exclude Darjah data. |
| AC-05.3 | Given a reference-data API (levels, curriculum) called by any role, When it returns levels, Then it returns active levels only, with the same response shape. |
| AC-06.1 | Given the school search and registration school picker, When searching, Then no primary school (SK/SJK) is returned, including via direct API calls. |
| AC-06.2 | Given admin school lists (M02, M27, M17), When rendered, Then primary schools are absent and school counts exclude them. |
| AC-07.1 | Given D1-D6 rows in `education_levels`, When inspected, Then `is_active = false` and no row, FK or dependent data has been deleted (row counts of dependent tables unchanged by the change). |
| AC-07.2 | Given D1-D6 set back to `is_active = true` by seed/DB in a test database, When screens are reloaded, Then Darjah appears again (reversible and data-driven; reversal is by seed/DB only, no admin UI). |
| AC-07.3 | Given Admin Pusat, When opening the Kurikulum / education-levels screens, Then no Darjah level appears and no control exists to view or re-activate it. |
| AC-08.1 | Given the ETL run (`apps/api/src/migration`), When executed on a `.cloud` sample, Then it still loads SK/SJK schools and Darjah pupils/classes (ETL unit tests unchanged and green) and those rows are not visible in v2. |
| AC-09.1 | Given the demo seed, When loaded, Then `SK Demo Dua` / `SK Demo Tiga` and the AZ-02 PoC pool D1-D4 questions stay in the seed as hidden rows (excluded by type/stage and level filters, not removed), they never appear in any UI or API list, the package `D1_D6` and DARJAH_6 article are not visible, and no demo user has a D-level or practice session at a D-level in any visible list. |
| AC-09.2 | Given `pelajarmaju`, When logged in, Then the account is a secondary pupil at SMK Demo Satu — Tingkatan 5 (grade 11, class "5 Amanah", as seeded; D54-SEC's "Tingkatan 4" is superseded because the seed already places it in secondary, QA B-HTTP-06, 2026-10-30); `pelajar` is Tingkatan 4. |
| AC-10.1 | Given the contract package, When validating requests, Then write inputs reject D-level codes (cikgu, games leagues, class levels, student import levels); read responses never emit them. |
| AC-10.2 | Given the full local test run on `local/v2-full` (lint, type-check, unit, API integration, e2e at 375/768/1280, registry-boot), Then all pass with real output. |

## 5. Non-functional requirements

- Localisation: all new or changed copy in BM; messages reuse existing BM wording (e.g. validation errors for rejected import rows).
- Responsive: no horizontal scroll at 375 / 768 / 1280 after the change (pickers with fewer options must not break layout).
- Performance: filtering by active level must not add a measurable slowdown to Kualiti Soalan or list endpoints (use the existing indexed level column).
- Security / privacy: filtering is enforced server-side, not only in the UI (API cannot be used to read or create primary data); no real personal names in seeds.
- Accessibility: unchanged from current behaviour (no new enhancements).
- Reversibility: hiding is controlled by `education_levels.is_active` and an active-school filter, not by deleting.

## 6. Scope

### In scope
- Set D1-D6 inactive; filter inactive levels in backend reference/level endpoints, services and seeds.
- Hide primary schools (SK/SJK) and Darjah pupils/classes in school search, registration, lists, leaderboards, standings, dashboards.
- Frontend pickers and labels: M01, M02, M03, M05, M07, M08, M09, M13, M16, M27 and the M04 Kualiti Soalan panel.
- BR-11 offered levels = T4-T5; demo seeds made secondary; contract validation rejecting D-codes on write.
- Local verification, then PR split (frontend / backend).

### Out of scope
- Deleting any Darjah / primary row, column, table or enum value (follow-up, see section 8).
- Changing the ETL transform or load behaviour.
- New learning content for T1-T3; changing registration eligibility for T1-T3 (stay allowed).
- Re-implementing the parts already on the D54-SEC branch as-is (they are a reference only).
- Anything on old systems (.my / .cloud are never modified).

### Assumptions
- A1: `education_levels.is_active` exists and is honoured by (or can be cheaply added to) the level queries.
- A2: A school is "primary" by its type/stage data field (stage primary; school types SK / SJK(C) / SJK(T) as mapped by the ETL; package D1_D6), never by name prefix (OQ-02, decided by engineering 2026-10-29).
- A3: Tingkatan 1-3 pupils remain valid users even though learning content is T4-T5.
- A4: Go-live is about 30 Oct 2026; hard delete is after it.

## 7. Known inventory (code sweep, 2026-10-29)

- Backend: `apps/api/src/modules/questions/workflow/quality/quality.service.ts:110-113` lists every `curriculum.levels()` row; `apps/api/src/modules/practice/rules.ts:41` `OFFERED_LEVEL_CODES = D1-D4`.
- Seeds: AZ-02 PoC pool D1-D4 (768 questions); `SK Demo Dua`, `SK Demo Tiga`; package `D1_D6`; `pelajar` / `pelajarmaju` D1 practice sessions; article DARJAH_6.
- DB: `articles.grade_level` CHECK allows only SEMUA / DARJAH_1..6.
- Frontend pickers: M01 registration/profile, M02 user forms/import, M03, M05, M07 PKSK T1 track "Tingkatan 1 (Darjah 6)", M08, M09, M13, M16 DarjahPicker and lobby "Sekolah Rendah" optgroup, M27 class filters.
- Contract enums (`packages/contract`): cikgu, games leagues, schools class levels, student import levels, content articles.
- ETL: `apps/api/src/migration/transform/{reference,enums,users,classes}.ts` maps Darjah / SK.

## 8. Not done yet / follow-ups

| # | Item | Blocks go-live? |
|---|---|---|
| F-1 | Hard delete of Darjah / primary data (separate migration after go-live, needs its own decision and a dependency plan across subject_levels, chapters, curriculum_nodes, question_versions, practice_sessions, classrooms, battles) | No |
| F-2 | `articles.grade_level` CHECK allows only SEMUA / DARJAH_1..6; a TINGKATAN value needs a migration (out of scope for "hide"; until then articles show without a level label or only SEMUA, see OQ-04) | Depends on OQ-04 |
| F-3 | Contract enum cleanup (remove D-codes from enums once hard delete is decided) | No |
| F-4 | ETL decision for hard delete: keep loading primary rows, or skip them | No |
| F-5 | D54-SEC branch `origin/claude/wizardly-euler-glqplr`: decide whether to close it, cherry-pick, or leave as reference; D54-SEC is not merged anywhere | No |
| F-6 | Fidelity docs (URS/SRS) of affected modules need a deviation row once built | No |

## 9. Open questions

| ID | Question | Blocks |
|---|---|---|
| OQ-01 | CLOSED. D54-SEC row completed by the Delivery Lead from 1b87d229; D72 is the refinement. | - |
| OQ-02 | CLOSED (engineering, 2026-10-29): primary = type/stage field (stage primary, SK / SJK(C) / SJK(T) as mapped by the ETL, package D1_D6), never name prefix. | - |
| OQ-03 | CLOSED (user, 2026-10-29: "aku tahu takda budak sekolah rendah didaftarkan lagi"): no primary-school pupils were ever registered in `.cloud`, so there are no such users; login behaviour is unchanged. Hiding migrated real primary data is a safeguard only; the remaining aggregate/report sweep is not needed now (only demo seeds hold primary data, and they are hidden). | - |
| OQ-04 | Articles tagged DARJAH_1..6: hide them, or show them as SEMUA? (Hide is assumed; to be confirmed.) | M09 content filter only |
| OQ-05 | CLOSED (user, 2026-10-29): T1-T3 pupils see an empty state; copy in AC-02.4. | - |
| OQ-06 | CLOSED (user, 2026-10-29, "tak perlu lagi semua. catat"): nobody sees hidden primary data, admin included, also not on Kurikulum / education-levels screens; reversal by seed/DB only (AC-07.2, AC-07.3). | - |
| OQ-07 | OPEN, largely moot for production (no primary pupils in `.cloud`, see OQ-03). Counts and reports must still exclude hidden demo rows (AC-05.2); a short privacy check of hidden data is kept before UAT. | Not blocking build |
| OQ-08 | CLOSED. Original D54-SEC text now in TRACKER. | - |
