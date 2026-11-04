# R1 gap-truth audit: PRD + dev plan against real V3 (2026-11-04)

**Question.** Do the plan cards' "Current gap", "Starts from" and Exists-OK / Exists-Fix / Missing-Build claims match the real V3? Could a developer improve V3 from the docs alone?

**Docs audited:** `docs/plan/r1-development-plan.md` and `docs/prd/r1/50-data-model-erd.md` / `60-api-contract.md`, on branch `docs/r1-prd-devplan` at `561499c`.

**Code:** branch `feature/v3-bijak-r1` at `e34e0a52`, read-only worktree. Citations are `v3:<path>:<line>`.

**UAT:** https://uat.prestasiplus.cloud is reachable (HTTP 200, title "PRESTASIPLUS"). The environment has **no UAT test accounts**, so only public pages and unauthenticated GET endpoints were checked: about 50 page loads at 375/768/1280 and 4 API GETs. No login was attempted and no form was submitted. Screenshots stay outside the repo.

**Method:**
- Four code agents, one per sector group, sampled about 3–4 cards per sector. The sample includes the P0 cards and every Slice 0 card (§5A).
- One UAT agent checked the public surface.
- The Delivery Lead re-checked every Major finding marked "verified" against the code.

**Verdicts:**
- MATCH: the card is correct.
- PARTIAL: the gap is real, but the card has a wrong or stale detail.
- MISMATCH: the card's premise is false.

**Severity:**
- Major: the developer would rebuild existing code, build the wrong thing, or be blocked.
- Minor: a wrong path or line, or a stale detail that can be fixed on the fly.

## 1. Verdict

**NO. The PRD and plan are not yet ready to hand to teams as-is. They become ready after a focused fix of about 12 cards (§3).**

What is right:
- Where a card says something is **missing**, it is almost always missing. In the sample:
  - every Missing-Build DM/API row is absent from the code;
  - no Exists-OK row is broken;
  - the planned migration numbers (0163+) are free, since V3's highest is 0110.
- The P0 backend gaps are real: OCR/worker off, the publish gate, the group lifecycle, servability flags, and `practice_answers.mode`.

What is wrong:
- Where a card describes what **exists or is broken in the UI and display layer**, it is often stale or overstated. In 9 of the 12 Major findings, the card asks a developer to **build something that already works**:
  - the Headcount pages;
  - the attempt timeout sweeper;
  - Laporan Soalan;
  - the stimulus group, answer widgets and phone navigator;
  - the DSKP loader;
  - the pupil shell.

  That breaks the §0B "improve, not rebuild" guardrail. The mandatory gap check (§0B) would catch most of it, but only if the developer looks. The docs themselves point the wrong way.
- Plan §0B claims 2 and 4 are wrong as written. Claims 1 and 3 are true.

## 2. Counts per sector

| Sector | Sampled | MATCH | PARTIAL | MISMATCH | Major | Minor |
|---|---|---|---|---|---|---|
| S0 Platform | 5 (4 checked) | 1 | 3 | 0 | 1 | 3 |
| S1 Question pipeline | 6 (5 checked) | 3 | 2 | 0 | 0 | 3 |
| S9 Verification | 3 | 1 | 2 | 0 | 0 | 2 |
| S2 Admin question UI | 4 | 2 | 2 | 0 | 1 | 3 |
| S3 Bijak SPM papers | 5 | 2 | 2 | 1 | 3 | 2 |
| S4 Curriculum / DSKP | 3 | 2 | 1 | 0 | 1 | 1 |
| S5 Murid | 5 | 1 | 3 | 1 | 2 | 3 |
| S8 Rendering / responsive | 3 | 0 | 3 | 0 | 3 | 0 |
| S10 Performance | 3 | 1 | 2 | 0 | 1 | 2 |
| S6 Guru / Admin Sekolah | 3 | 3 | 0 | 0 | 0 | 3 |
| S7 Gamification | 3 | 2 | 1 | 0 | 0 | 3 |
| **Total** | **43 (40 checked)** | **18** | **20** | **2** | **12** | **25** |

S0-T07 and S1-T06 were sampled but not checked; their paths exist.

**Cards sampled per sector:**
- S0: T02, T03, T04, T05, T07
- S1: T01, T02, T03, T06, T07, T10
- S9: T02, T03, T06
- S2: T01, T02, T03, T08
- S3: T01, T02, T03, T04, T08
- S4: T02, T06, T09
- S5: T01, T03, T06, T10, T15
- S8: T02, T03, T04
- S10: T01, T02, T03
- S6: T01, T04, T06
- S7: T01, T04, T05

## 3. Major mismatches (fix in the plan before the card starts)

| # | Card | PRD / plan claim | Real state in V3 | Evidence |
|---|---|---|---|---|
| 1 | S10-T02 | "Builds the Headcount dashboard, :id, summary and export pages once, replacing `HeadcountShellPage.vue`" | These pages already exist and are real: Dashboard, Table, Summary, Export, List, Create, Student. Only 4 routes are shells: results, edit, unjuran, settings. The access gap is true: `roles` excludes student, and `list()`/`dashboard()` return `[]` for non-teachers. | `v3:…/headcount.ts:71-93` |
| 2 | S3-T04 | Build `attempt-timeout.job.ts` to auto-submit at deadline + 300 s | The job already exists. Only the Kuiz 2-hour abandonment is new. | `v3:apps/api/src/modules/bijak/attempts/attempt-sweeper.ts:10` (verified), registered in `attempts.module.ts:26` |
| 3 | S3-T02 and plan §0B claim 2 | "Pembina Kertas is merged into Set Builder; the duplicate list route redirects; `/admin/spm/kertas/:id` stays as 'Semak Kertas Simulasi'" | Two separate editors exist. `/admin/spm/kertas/:id` renders `PaperEditorPage.vue` (934 lines, "Pembina Kertas"). There is no `redirect:` in `m28-bijak-spm/routes/`. "Semak Kertas Simulasi" appears nowhere. The card's "Starts from" omits `PaperEditorPage.vue` and `SetBuilderLandingPage.vue`, and does not say which editor functions survive (Salin set, Tarik balik, student view). | `v3:src/modules/m28-bijak-spm/routes/admin-papers.ts:61-90` (verified); `routes/admin-builder.ts:20,30` |
| 4 | S3-T03 (MISMATCH) | Entry point `apps/api/src/modules/spm/hub.service.ts` and `admin/kandungan/lanes.ts` | `spm/hub.service.ts` is the **pupil** SPM hub. The admin hub cards are in `questions/serving/servability-reads.service.ts:148-152` and `questions/http/servability.controller.ts:77-91`. `lanes.ts` holds copy strings only; the real front-end is `KandunganHubPage.vue`. The gap itself (2 of 6 lanes) is true. | as cited |
| 5 | S5-T06 (MISMATCH) | Build a new `m05-practice/pages/LaporanSoalanSayaPage.vue` | All of these already exist: the m04 page, the route, the menu item, the quiz report dialog, and the daily cap of 20. The real gap is the prototype-scope entry plus a check of the counts, and DM-82 `source` (correctly Build). | `v3:src/shells/nav/user-nav.ts:436`; `QuizRunner.vue:29`; `packages/contract/src/question-workflow/reports.ts:55` |
| 6 | S8-T02 | "`StimulusGroup.vue` shows per-question" | It already renders once: a pinned pane from 1024 px, and a sticky "Lihat {label}" chip with a drawer below that. The real gaps are zoom, the open/collapsed rule, and excluding a whole group that has an unrenderable kind. | plan line 1348 (verified wording); `v3:…/StimulusGroup.vue` |
| 7 | S8-T03 | New `MatchLetterBank.vue`, `EssayChoice.vue`, `DrawingPad.vue` | `match_letter`, `drawing` (photo) and `essay_choice` already exist. The true gaps are table_fill, cloze, mcq_multi, true_false and the language toggle. | `v3:src/modules/m28-bijak-spm/components/PartInput.vue:128,151,158` (verified); `EssayAnswer.vue` |
| 8 | S8-T04 | Phone navigator, timer and Hantar to be built or fixed | The bottom-sheet navigator, answered/flagged states and Hantar in the sheet already exist, and the timer header sits outside the scroll area. The card names no concrete defect. Landscape behaviour is unverified. | `v3:…/AttemptPage.vue:697-721` |
| 9 | S5-T10 | Pupil shell fixes | Logout and the server-fed header pills already work. The card names no concrete defect, and its Data/API list omits the pill endpoint. "Cari menu" exists only in `PembelajaranLayout`. | `v3:src/app/core-routes.ts:33-47`; `useGamificationSummary.ts`; `wallet.controller.ts:67` |
| 10 | S4-T02 | Loader report built on API-DSKP-05 | The loader, CLI, tests and 13 JSON extracts already exist; only the report tab is new. API-DSKP-05 is the Studio SP picker (`/questions/studio/dskp`). No API returns loader results (dimuatkan / belum dimuatkan), so the tab has no defined data source. | 60 API-DSKP-05; v3 curriculum loader |
| 11 | S0-T05 and plan §0B claim 4 | `STUDENT_HIDDEN_IDS` hides Headcount, Analisa Item, Laporan Soalan and Import Pelajar | The set holds only `analisa-item`, `headcount` and `laporan-mingguan`. Laporan Soalan is hidden because `/laporan-soalan` is missing from the pupil scope list in `prototype-scope.ts`. Import Pelajar is not in the set. The register cites `prototype-scope.ts:28-30`, but the note is at 24-29. | `v3:src/shells/nav/user-nav.ts:749-753` (verified); `prototype-scope.ts:117,119` |
| 12 | S2-T03 | Starts from `m04-question-bank/routes.ts`, `admin/intake/routes*`; redirect `/admin/spm/soalan` | `routes.ts` only spreads route fragments. The records are in `m28-bijak-spm/routes/admin-papers.ts:20,40` and `admin-intake.ts`. `admin/intake/routes*` does not exist. Redirecting `/admin/spm/soalan` collides with the live sub-routes `/ekstrak`, `/muat-naik`, `/manual` and `/:qid/sunting`, and the card does not say what happens to them. | `v3:…/intake-routes.ts:8-13`; `kontrak/domain/pool.ts:63` |

## 4. Minor mismatches (fix on the fly or in one clean-up pass)

| Card | Issue | Evidence |
|---|---|---|
| S0-T02 | "API does not start by itself" is stale: compose already waits for migrate and runs both seeds. The seed error text exists but was not reproduced. `docs/ops/e2e-seed.md` contradicts the card on which blueprint passes. | `v3:compose.yaml:51-55`; `compose.http.yaml:41-42`; `e2e.ts:152` |
| S0-T03 | The gap is true, and confirmed on UAT: `/api/ready` returns `status, db, migrations, time` with no `worker` field. "API `Dockerfile`" means `docker/api/Dockerfile`. | `v3:ready.controller.ts:25-27`; UAT GET `/api/ready` |
| S0-T04, S9-T02, S9-T03 | These cards say `scripts/r1-trace-check.mjs`, `r1-scope-guard.mjs`, `r1-canonical-map.mjs`, `.github/workflows/r1-*.yml` and the `.evidence/` gitignore entry "already exist". They exist only on `docs/r1-prd-devplan` (PR #406), not on `feature/v3-bijak-r1`. | v3 tree |
| S0-T04 / AC-X2-3 | UAT `/password/reset` shows "Pautan reset melalui email belum tersedia." "belum tersedia" is a banned string, and allow-list table X2-3-A has no row for it, so it is unassigned to any card. | `v3:src/modules/m01-authentication/pages/PasswordForgotPage.vue:25` (verified); `40-cross-cutting.md` X2-3-A |
| S1-T07 | The step "stop writing `spmPool:false` at `questions.service.ts:592`" is stale: that line is the approve transition. The pool tag is already replaced by `SPM_SERVABLE_SQL`. | `v3:learner-visibility.ts:40` |
| S1-T03 | The card does not name `to-question.ts`, where the paper and year carry-over goes. | intake |
| S2-T02 | The three header buttons already exist, with different letter case. `submissions-unavailable.ts` has another consumer and two tests. | `v3:IntakeListPage.vue:81-110`; `m04-question-bank/api/submissions.ts:9` |
| S2-T01 | The card says the demo copy is removed from Studio pages, but no Studio page imports it. "V2 `/edit` redirects to it" describes a redirect that does not exist yet. | Studio pages |
| S3-T01 | DM-57 `blueprint_sections.marks_per_question` clashes in name with `paper_sections.marks_per_question`, and the card does not warn about it. | `v3:exam.prisma:219` |
| S3-T08 / S5-T15 | `apps/api/scripts/uat-ops` does not exist (correct), but the card does not say which route or auth the script uses. | — |
| S5-T01 | The lower-form copy is not in `mock/datasets/prime.ts`, and the existing empty-state tests are not listed. | — |
| S5-T03 | Files omits the API-PRAC-04 counts code. The card is large for an M. | — |
| S4-T06 | The PRD cites `rules.ts:43-45`, but the code is at 41-43. The separate `MAP_GRADES` (T4/T5) in curriculum is not named. | `v3:practice/rules.ts:41-43`; `curriculum/rules.ts:150` |
| S10-T01, S10-T03 | The known wrong path is confirmed: it should be `reports/performance/http/performance.controllers.ts`. Starts-from `routes/analisa-item.ts` should be `analisis-item.ts`. Line numbers are off by a few (`prestasi.ts:18` is really 22; `analisaItemTarget` is at 13-18, not 43). | v3 m11 routes (verified file list) |
| S6-T01 | The plan says `roles: ['guru']`, but the role code is `teacher`. `/guru/laporan-mingguan-kelas` already exists as a PrototypeUnavailable page, and the old path to redirect from has no route. | `v3:laporan-mingguan.ts:14-30` |
| S7-T04 | Type Build, but the backend ADM-14 and `api/admin.ts` exist; only the pages are new. | — |
| S7-T05 | API-ADM-16 is said to be in `shop/admin.controller.ts`, but it is in `gamification/admin.controller.ts:122-143`. Files lists only BE/shop and BE/wallet. | — |

## 5. Plan §0B claims

| Claim | Verdict | Evidence |
|---|---|---|
| 1. Prestasi 360 exists but a redirect hides it | **True.** The backend leak is real: `viewScope` gives a student school scope, and `PerformanceController` has no `@Roles`. | `v3:routes/prestasi.ts:22,29`; `routes/analitik.ts:30`; `services/support.ts:10-14` |
| 2. Set Builder exists; Pembina Kertas merged into it | **False as written.** It reads as current state but describes the target. See #3. | `admin-papers.ts:61-90` |
| 3. Gamification and shop backends exist; only admin screens needed | **True.** The admin Gamifikasi nav links are dead. | `v3:admin-nav.ts:348-359` |
| 4. Headcount, Analisa Item, Laporan Soalan hidden by `STUDENT_HIDDEN_IDS` and `prototype-scope.ts` | **Partly true.** See #11. | `user-nav.ts:749-753` |

## 6. UAT public-surface results (no login)

What matches the docs:
- `/` redirects to `/login` ("Log Masuk | PRESTASIPLUS").
- The public routes (`/login`, `/register`, `/artikel`, `/panduan`, `/video`, `/video/1`, `/password/reset`, `/password/reset-ic`) render.
- Protected routes redirect to `/login?redirect=<path>`. Unknown paths and `/__ds` show "Halaman Tidak Dijumpai" (FR-X2-2).
- None of the pages tested scrolls horizontally at 375, 768 or 1280.
- `/api/health` and `/api/ready` return 200. `ready` has no `worker` field, which confirms S0-T03.
- `/api/config/support` returns 404 "Konfigurasi sokongan tidak dijumpai.", which confirms API-SUP-04 Exists-Fix and S5-T05.

Not yet explained:
- `/pusat-tuisyen/panduan` redirects to login. Whether that is intended was not verified.

**Not checkable without UAT accounts:**
- every authenticated screen of every role;
- the intake upload and OCR state;
- UAT seed data and the empty states D-01..D-13;
- the authenticated API;
- token pages.

`/pelajar/:id` is public per `v3:timeline.ts:38-41`, but it was deliberately skipped because it may show real pupil data.

## 7. What must be fixed in the docs before teams start

1. **Rewrite the 12 Major cards** (§3) so that "Current gap" names the real defect and "Starts from" names the real entry point. In particular, S10-T02, S3-T04, S5-T06, S8-T02, S8-T03 and S8-T04 must say "exists: extend/fix", not "build".
2. **Correct plan §0B claims 2 and 4.** Claim 2 must state the current state (two editors, no redirect) and the target separately.
3. **State the branch dependency.** S0-T04 and S9-T02/T03 rely on scripts and workflows that reach `feature/v3-bijak-r1` only when PR #406 merges.
4. **Assign the reset-page string** "Pautan reset melalui email belum tersedia." to a card, or add it to allow-list X2-3-A.
5. **Make one clean-up pass on the Minor items** (§4): paths, line numbers, role code `teacher`, and the API-ADM-16 location.
6. **Re-run this audit with UAT test accounts** (as environment secrets) to check the authenticated "Current gap" claims. This audit could check them in code only.

Agent working files (outside the repo): the scratchpad folders `c1-s0s1s9`, `c2-s2s3`, `c3-s4s5s8`, `c4-s6s7s10` and `u1-uat`.
