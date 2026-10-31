# R1 E2E baseline on BASE-1, 2026-10-31 (T23, lane B4)

Slug: `r1-e2e-baseline`. Naming: V1 = prestasiplus.my, V2 = prestasiplus.cloud (reference), V3 = this repo.
Scope: CLOUD-HANDOFF §7(i), `docs/requirements/v3-bijak-spm-scope.md` R1-20. This is a **baseline**: BASE-1 does not yet contain T03 (b08 bridge), T04 (b01 lifecycle), T10 (Set Builder UI), T12 (Simulasi Kuiz UI) or T13 (Studio groups). Steps that depend on them are reported as Blocked or as Fail with the owning task, never as Pass.

## 1. Environment

| Item | Value |
|---|---|
| BASE | `feature/v3-bijak-r1` @ `14e4336cf0c335768ef50367934fd5b4da8abb99` (BASE-1). Only test files changed on `r1/t23-e2e`. |
| Browser | **Chromium 153.0.8010.12** (Playwright 1.63.0 bundled build, headless). Not Edge. The pdf.js `getOrInsertComputed` shim in the spec was **not** needed (native in this build). |
| Viewports | Playwright projects `mobile` 375×812 (touch, DPR 2), `tablet` 768×1024 (touch, DPR 2), `desktop` 1280×800. One worker, steps in file order, projects in sequence. |
| Database | Local PostgreSQL 16.15, a lane-own disposable cluster on `127.0.0.1:5444`, database `b4_r1e2e`. All 43 `apps/api/prisma/migrations/*/migration.sql` (0001 … 0093) applied in name order, as `apps/api/test/support/global-setup.ts` does. The shared cluster on 5433 was not usable: it stopped at 06:19 UTC with `PANIC: could not open file ".../pg/data/global/pg_control": Permission denied` because the host keeps `/tmp/claude-0` at mode 0700 (the `postgres` user cannot traverse it). |
| Seed | `apps/api/prisma/seed/index.ts`, profile `poc` (27 modules), `NODE_ENV=development ALLOW_DEMO_SEED=true`. Snapshot `b4_r1e2e_seed`; the final run started from a fresh copy of it. No DSKP loader run; the seed's own `curriculum_nodes` were used (all subjects: 171 unit, 2,062 sp, 528 sk, 83 grouping). |
| API | `apps/api` `vite build`, `node dist/main.js` on port 3141. Env: `BIJAK_POC_QUESTIONS=true`, `JOBS_WORKER_ENABLED=true`, `COOKIE_SECURE=false`, `THROTTLE_LOGIN_PER_MINUTE=200`, OCR `none`, AI extraction = mock (default). |
| SPA | `vite build --mode production` with `VITE_API_MODE=http`, `VITE_PROTOTYPE_SCOPE=on`, `VITE_TEST_HOOKS=false`; served by `vite preview` on `127.0.0.1:5241`, `/api` proxied to 3141. |
| Accounts | Seed demo accounts only (fictitious): Admin Pusat `admin@demo.test`, pupil T4 `pelajar@demo.test`, pupil T5 `pelajarmaju@demo.test`. |
| Spec / config | `e2e/api/r1-e2e-baseline.spec.ts`, `playwright.r1-e2e.config.ts` |
| Raw evidence | `docs/qa/r1-e2e-baseline-2026-10-31/observations-final2.txt` (every step's observed facts, skip reasons and first error line, all viewports); `…/seed-only/observations-seedonly.txt`. Screenshots `docs/qa/r1-e2e-baseline-2026-10-31/<viewport>-<step>.jpg` (taken at the end of each executed step; Blocked steps have none). |

Commands (from the worktree root):

```
R1_E2E_RUN=final2 BASE_URL=http://127.0.0.1:5241 npx playwright test -c playwright.r1-e2e.config.ts
R1_E2E_RUN=seedonly R1_E2E_SHOTS=docs/qa/r1-e2e-baseline-2026-10-31/seed-only BASE_URL=http://127.0.0.1:5241 \
  npx playwright test -c playwright.r1-e2e.config.ts -g 'S0 pupil|B-01'      # before the final run, fresh DB
npx tsc -p tsconfig.e2e.json --noEmit
npx eslint e2e/api/r1-e2e-baseline.spec.ts playwright.r1-e2e.config.ts
```

Results: final run **84 tests = 51 passed, 27 failed, 6 skipped** (18.4 min); seed-only run 6 tests = 3 passed, 3 failed. Every step had the same outcome at 375, 768 and 1280. e2e `tsc` 0 errors; eslint 0. Unit/integration suites were not run in this task (H-B1 covers the unit sweep).

## 2. Step × viewport

Result per viewport is given as 375 / 768 / 1280. "Blocked" = the step could not run because an earlier step or an unmerged task did not provide its input (Playwright skip with the reason). Every executed step also asserts **no horizontal page scroll** (`expectNoHScroll`) on each screen it visits; no step failed on layout at any width.

| Step | What | 375 / 768 / 1280 | Evidence (observed) | Owner of a Fail / Block |
|---|---|---|---|---|
| S0 | Pupil baseline: Databank, Latih Tubi SPM, Soalan by Chapter | Pass / Pass / Pass | Seed: Databank MATH 54, Latih Tubi SPM MATH 54, 0 chapter subjects. `*-S0.jpg` | |
| S1a | Admin form (Bank Soalan > Tambah): T4 Matematik MCQ, **stem image**, Bab, DSKP Bidang > SK > SP, Kertas 1 | Pass / Pass / Pass | Bab "Bab 1: Fungsi dan Persamaan Kuadratik", DSKP 1.1.1; created as `draft` (ids 1272/1276/1280). `*-S1a.jpg` | |
| S1e | Control: same MCQ **without** image | Pass / Pass / Pass | created `draft`. `*-S1e.jpg` | |
| S1b | CSV import (Import & Semakan), 2 MCQs | Pass / Pass / Pass | `POST import` 201, importedCount 2, failedCount 0. `*-S1b.jpg` | |
| S1c | PDF intake (Muat Naik Kertas): passage shared by 2 questions | **Fail / Fail / Fail** | Upload + mock extraction OK: 2 cards, 1 group header ("Petikan 1 · Soalan 1 - 2 berkongsi rajah ini"), client gate "Semua semakan kualiti lulus". Server gate refuses "Hantar untuk semakan": "Subjek dan tingkatan perlu ditetapkan." + "Unit DSKP tiada dalam senarai kurikulum." for both questions; the page does not show it. `*-S1c.jpg` | R1E2E-01 (A), R1E2E-02 (C), R1E2E-03 (C) |
| S1d | D90 group: one shared stimulus + 2 member questions | **Fail / Fail / Fail** | `/admin/studio` = "Halaman Tidak Dijumpai" (Studio is T13). Via Tulis Soalan Manual: group header 1, both members attached; same server-gate refusal as S1c. `*-S1d.jpg` | T13 (C); R1E2E-01/02/03 |
| S2a | Approve in the UI: detail "Hantar untuk Semakan", then bulk "Luluskan" | **Fail / Fail / Fail** | Detail page sends `{"action":"review","ids":[1272]}` (number) → 422 "Senarai soalan tidak sah." on all 4 questions; bulk Luluskan → "Perubahan status daripada Draf kepada Lulus tidak dibenarkan." (0 affected). `*-S2a.jpg` | R1E2E-04 (C) |
| S2c | **API-assisted**, not a UI pass: `POST /api/questions/bulk-action` review → approved (string ids) | Pass / Pass / Pass | 4 of 4 → `approved` (incl. 2 untagged CSV rows). `*-S2c.jpg` | (workaround for R1E2E-04) |
| S2b | Approve intake items in Baris Gilir Semakan | Blocked ×3 | "S1c/S1d sent no batch for review" | R1E2E-01/02 |
| S5a | R1 target: Databank count rises after **approval** | **Fail / Fail / Fail** | Waited out the 60 s count memo. 54→54, 56→56, 58→58. `*-S5a.jpg` | R1E2E-08 = T04 (A) |
| S5b | R1 target: Latih Tubi SPM count rises after approval | **Fail / Fail / Fail** | 54→54, 56→56, 58→58. `*-S5b.jpg` | R1E2E-08 = T04 (A) |
| S5c | R1 target: Soalan by Chapter lists the Bab after approval | **Fail / Fail / Fail** | Bab total 0→0 (375: Matematik tile absent), 2→2, 4→4. `*-S5c.jpg` (375/768 identical to S0: nothing changed) | R1E2E-08 = T04 (A) |
| S2d | BASE-1 interim: bulk **Terbitkan** (published is what BASE-1 serves) | Pass / Pass / Pass | 2 of 4 published (the two DSKP-tagged form MCQs); the CSV rows refused "Sila pilih unit DSKP. Sila pilih sekurang-kurangnya satu SP DSKP." (matches AC-R1-14.4). `*-S2d.jpg` | |
| S5d | BASE-1 interim: Databank, Latih Tubi SPM, Bab serve the **published** admin MCQs | Pass / Pass / Pass | Databank 54→56, 56→58, 58→60; Latih Tubi SPM same; Bab total 0→2, 2→4, 4→6; tile "Matematik · 1 bab tersedia · 56 soalan". `*-S5d.jpg` | |
| S3a | Set Builder `/admin/studio/sets` (V2 flow 4) | **Blocked** (asserted, Fail ×3) | "Halaman Tidak Dijumpai". `*-S3a.jpg` | T10 (C) |
| S3b | BASE-1 Pembina Kertas: new Matematik K1 paper, admin MCQs offered and placed, rest from bank | Pass / Pass / Pass | Picker offers 2 run questions (image + control); budget "Sepadan dengan blueprint" (40/40); bank groups placed as units (2); "Draf kertas disimpan." No admin D90 group exists to place (S1c/S1d). `*-S3b.jpg` | |
| S3c | Terbitkan the paper | Pass / Pass / Pass | `publish` 200 `ok:true`; editor header reads "blueprint Spec" (see R1E2E-07). `*-S3c.jpg` | |
| S4a | Pupil T4 sits the paper that holds the **image** MCQ | **Fail / Fail / Fail** | Paper is on the hub; Mula → `POST /api/bijak/attempts` **403**; cover shows "Percubaan tidak dapat dimulakan. Cuba lagi."; API log: "BE-09 question not served to Bijak: Question N: a stimulus outside the question group cannot be shown". `*-S4a.jpg` | R1E2E-05 = T03 (A), R1E2E-06 (A) |
| S3d | Control paper with only the image-free admin MCQ, published | Pass / Pass / Pass | Offered 1, budget OK, publish `ok:true`. `*-S3d.jpg` | |
| S4a2 | Pupil T4 sits the control paper, answers 40 MCQs, Hantar | Pass / Pass / Pass | `POST /api/bijak/attempts` 201; the admin question appears in the sitting; result "Awak dapat 10/40 markah." `*-S4a2.jpg` | |
| S4b | Self-mark a written part of the admin paper | Blocked ×3 | The admin paper holds only MCQs: no written part could be created (S1c/S1d refused). Self-mark itself: see B-02. | R1E2E-01/02 |
| S4c | Result: score / max, per Bahagian, question list | Pass / Pass / Pass | "10 / 40", 1 section, 40 questions listed. `*-S4c.jpg` | |
| S4d | Cuba Lagi → new blank attempt of the same paper | Pass / Pass / Pass | New attempt id, attempt shell shown. `*-S4d.jpg` | |
| S4e | Pupil T5 sees the admin paper on the hub | Pass / Pass / Pass | Card shown (the image paper; T5 was not made to sit it). `*-S4e.jpg` | |

Flow coverage summary: admin entry by form and CSV works; PDF/manual intake and every D90 group path are refused at the server gate; the UI approval path is broken (approval only via API); approved questions are not served on BASE-1 (T04); after the BASE-1 publish step the question reaches Databank, Latih Tubi SPM, Soalan by Chapter and the BASE-1 paper builder; a paper with an image question cannot be sat (T03), an image-free one can be sat, scored and retried end to end at all three widths.

## 3. Re-test of the student smoke bugs (`docs/qa/r1-student-smoke-2026-10-31.md` on `handoff/shared-tree-2026-10-31`)

| Bug | Re-test result (375 / 768 / 1280) | Evidence | Status / owner |
|---|---|---|---|
| B-01 Soalan by Chapter empty, no empty state | Seed only: **Fail ×3** (`GET /api/practice/chapter-subjects` → `data: []`; 0 tiles; no "tiada / belum ada" text). After an admin Bab-tagged question is published: **Pass ×3** (Matematik tile, Bab listed). | `seed-only/*-B-01.jpg`, `seed-only/observations-seedonly.txt`; `*-B-01.jpg`, S5d | **Partly fixed**: the data path works (D89 Bab field + publish); the seed has no Bab-tagged question, and the FE still shows no empty-state message (H-C1, team C). |
| B-02 Bijak text answers cannot be self-marked | **Pass ×3**. Sains K2 sitting: 8 self-mark controls; "Simpan markah" → `POST /api/bijak/attempts/:id/self-mark` 200; headline "Awak dapat 0/13 markah (sementara)." → after reload "Awak dapat 1/13 markah." | `*-B-02.jpg` | **Fixed** on BASE-1 (b12-selfmark, f11-semakan). V2 §1.7 uses a number input saved per change; V3 uses a stepper + "Simpan markah" (R1-06 design), not re-judged here. |
| B-04 Simulasi Kuiz missing | **Fail ×3**: `/simulasi/kuiz` redirects to `/dashboard`. | `*-B-04.jpg` | **Open**: T11/T12 (team C lane C2; not on BASE-1). V2 §1.8. |
| B-05 "Cuba lagi" returns to the cover | **Pass ×3**: `retry` → `POST /api/bijak/attempts` 201 and lands directly on `/spm/bijak/percubaan/<new id>`. "Lihat semakan lepas" link present at 768 and 1280; 0 at 375 (not investigated; that run had no earlier Sains sitting for the pupil, which may be why). | `*-B-05.jpg` | **Fixed** (V2 §1.7 behaviour). |

## 4. Bugs found

Severity: Critical = blocks an R1 flow with no UI workaround; High = a broken step or silent failure; Medium = a missing gate; Low = cosmetic or count wording. Owner lanes: A = backend team, C = frontend team.

### R1E2E-01 (Critical, team A): intake gate cannot resolve Bijak subject codes, so every Matematik / Sains intake item is refused
- Steps: Admin Pusat > Muat Naik Kertas (subject Matematik), upload a PDF, Ekstrak soalan, complete each card (MCQ, key, DSKP unit, SP, TP), Hantar untuk semakan. Same through Tulis Soalan Manual.
- Expected: the batch goes to Baris Gilir Semakan; accepted items become draft questions that can be approved (AC-R1-14.1; V2 flow 2, cloud-student-mechanism §3.2).
- Actual: `GET /api/intake/batches/:id/review` returns "Soalan N: Subjek dan tingkatan perlu ditetapkan." for every item. The item tag carries the Bijak code `MAT` (`intake_items.payload.tag.subject`), and `TagResolver.subject()` (`apps/api/src/modules/intake/workflow/curriculum-facts.ts:37-45`) looks it up with `subjectByCode('MAT')`; the curriculum code is `MATH` (`SCI` for `SN`). Every other Bijak path maps codes with `curriculumCodeOf` (`apps/api/src/modules/bijak/papers/subject-codes.ts`).
- Evidence: S1c/S1d at 375/768/1280, `*-S1c.jpg`, `*-S1d.jpg`, observations "server gate refused".

### R1E2E-02 (Critical, team C): intake DSKP unit picker uses a stand-in list whose codes do not exist in the curriculum
- Steps: as R1E2E-01; choose any unit offered by the card editor (e.g. "Asas Nombor").
- Expected: units come from the loaded curriculum, so a chosen unit passes the server gate (AC-R1-12.4, AC-R1-14.4; PIPE AC-05.2 "the model may only pick known units").
- Actual: `src/modules/m28-bijak-spm/admin/intake/lib/dskp.ts` is a "small stand-in … prototype codes, not official ones" (`MAT-T4-02`, `SN-T4-02`, …). The server answers "Unit DSKP tiada dalam senarai kurikulum." for every item. The server already lists units (`CurriculumFactsService.taxonomy` in the intake module; `exam/blueprints/lookups.service.ts` units of a subject). Even with R1E2E-01 fixed, no intake batch can pass.
- Evidence: as R1E2E-01.

### R1E2E-03 (High, team C): the intake review page hides the server's refusal
- Steps: as R1E2E-01, press "Hantar untuk semakan".
- Expected: the admin sees why the batch was not sent (each server issue, like the client issues list).
- Actual: the panel keeps saying "Semua semakan kualiti lulus. Sedia dihantar." and nothing else happens. `IntakeReviewPage.vue:324` stores `res.issues` in `serverIssues`, which no template renders (`issues` = client `validateBatch` only).
- Evidence: `mobile-S1c.jpg` (taken after the refusal).

### R1E2E-04 (High, team C): question detail "Hantar untuk Semakan" (and "Luluskan") always fails with 422
- Steps: Bank Soalan > open a Draf question > "Hantar untuk Semakan" > "Ya".
- Expected: status Reviewed and the flash "Soalan dihantar untuk semakan." (V2 flow 1 step 4, cloud-student-mechanism §3.1); then Luluskan / Terbitkan.
- Actual: `POST /api/questions/bulk-action {"action":"review","ids":[1272]}` → 422 `fields.ids: "Senarai soalan tidak sah."`, shown as "Senarai soalan tidak sah.". The route passes `id: Number(route.params.id)` and `QuestionDetailPage.vue:124` sends `[props.id]` as a number; the API wants string ids (the list's bulk bar sends strings and works). The bulk bar has no "Hantar untuk Semakan", and bulk "Luluskan" refuses Draf ("Perubahan status daripada Draf kepada Lulus tidak dibenarkan."), so **no UI path moves a new question to approved**. The detail "Luluskan" button uses the same call (code reading; not executed). Workaround used by the test: the API (S2c).
- Evidence: S2a at 375/768/1280, `*-S2a.jpg`, observations.

### R1E2E-05 (Critical, team A, T03): a published paper holding an admin question with a stem image cannot be started
- Steps: create an MCQ with a stem image (S1a), approve, Terbitkan (BASE-1), place it in a paper (Pembina Kertas), Terbitkan; pupil opens the paper from Bijak SPM and presses Mula.
- Expected: the sitting starts and shows the image (AC-R1-13.2 "a question with an image … servable in a Terbit paper"; V2 stimulus rendering, cloud-student-mechanism §1.5).
- Actual: `POST /api/bijak/attempts` → 403 FORBIDDEN; cover shows "Percubaan tidak dapat dimulakan. Cuba lagi."; API log "BE-09 question not served to Bijak: Question N: a stimulus outside the question group cannot be shown (exam-core pins only the group stimulus)". The same paper without the image question (control, S4a2) works.
- Evidence: S4a ×3, `*-S4a.jpg`. Expected to be resolved by T03 (`r1/b08-bridge`: option/stem images); re-test after it merges.

### R1E2E-06 (High, team A): Pembina Kertas publishes, and the hub lists, a paper that pupils cannot sit
- Steps: as R1E2E-05.
- Expected: publish is refused while a placed question is not servable, with the blocker named (V2 paper review "{n} masalah menghalang penerbitan." / "Kertas ini belum boleh diterbitkan — {n} masalah perlu dibetulkan.", cloud-student-mechanism §3.2 item 3 and §3.4; R1-17 "Dilihat murid di").
- Actual: `POST /api/admin/papers/:id/publish` → `ok: true`, the card appears on every pupil's hub (T4 and T5, S4e), and Mula fails (R1E2E-05). The publish check and the attempt check (`bijak/papers/attempt-source.ts:89-91`, "not_eligible") disagree.
- Evidence: S3c + S4a + S4e ×3.

### R1E2E-07 (Medium, team A): Terbitkan succeeds on a Spec (not Disahkan) blueprint
- Steps: Pembina Kertas > new Matematik Kertas 1 paper (the seed blueprint is Spec after migration 0092) > fill > Terbitkan.
- Expected: AC-R1-16.2: "Given no Disahkan contract for the paper's subject and kertas, then Terbitkan is blocked with a message naming the contract, unless the audited override of PIPE AC-07.5 applies."
- Actual: the editor header reads "Matematik · Kertas 1 · blueprint Spec · 1449/1" and publish returns `ok: true` with no override.
- Evidence: `*-S3b.jpg` (header), S3c/S3d observations. To confirm with A whether the BASE-1 admin publish is meant to carry the Disahkan gate (it may arrive with T10's review block).

### R1E2E-08 (High vs the R1 target, team A, tracked as T04): approved questions are not served
- Steps: approve a DSKP-tagged T4 MCQ (S2c), wait 63 s (count memo), read Databank / Latih Tubi SPM / Soalan by Chapter; open the paper picker.
- Expected: approved = servable (D80; AC-R1-11.2 "the Databank count for that subject rises by 1"; AC-R1-13.2; V2 §0.1 question gate `approved`, `is_servable`).
- Actual: counts and Bab totals unchanged; the Pembina Kertas picker shows only "Terbit" (published) questions. After the BASE-1 Terbitkan (S2d) all three rise and the picker offers the question (S5d, S3b).
- Evidence: S5a/S5b/S5c vs S5d ×3. Owned by T04 (`r1/b01-lifecycle`). Related for T04: BASE-1 lets the untagged CSV rows reach `approved` (S2c), while AC-R1-14.4 / PIPE AC-03.2 refuse approval until tagged; only the publish gate stops them today.

### R1E2E-09 (Low, team A): Soalan by Chapter subject tile counts all subject questions, not the chaptered ones
- Steps: after S5d, open Soalan by Chapter.
- Expected: V2 subject list shows the question count of chaptered questions (`chapter_id NOT NULL AND status != 'menunggu'`, cloud-student-mechanism §2.3).
- Actual: tile "Matematik · 1 bab tersedia · 56 soalan" while the only Bab holds 2 questions (`chapterSubjects()` returns `bank.practice(subject, levels)`, `apps/api/src/modules/practice/reads/overview/overview.service.ts:265-285`, citing FR-M05-58 Q-PRACTICE(subject)). Confirm whether FR-M05-58 is an intended deviation; if not, count the chaptered questions.
- Evidence: S5d observations, `*-S5d.jpg`.

### Not bugs (recorded so they are not re-filed)
- The practice counts are memoised 60 s per API process (`DEFAULT_OVERVIEW_OPTIONS.bankTtlMs`, documented staleness); the spec waits 63 s after each status change before reading counts.
- Layout: the no-horizontal-scroll check passed on every screen each executed step visited, at 375/768/1280; the screenshots show no clipped or overlapping content. Screens not visited (e.g. "Pratonton sebagai pelajar") were not checked.

## 5. What is verified and what is not

Verified (executed in the final run at 375, 768 and 1280, same outcome at each): every row of §2 and §3 marked Pass or Fail, with the observations file and screenshots as evidence.

Not verified:
- A pupil sitting with a written (self-markable) part of an **admin-created** question, and any admin-created D90 group reaching a pupil: blocked by R1E2E-01/02 (and T13 for the Studio path).
- Baris Gilir Semakan approval (S2b) and "Terima (A)" / accept-to-draft of intake items.
- Set Builder, Jana set, Salin set, Tarik balik, Simulasi Kuiz (T10, T12 not on BASE-1).
- Real PDF extraction (AI mock and OCR `none` only; AC-R1-14.2 needs the real provider) and the DSKP loader (`npm run dskp:load`) — the seed's curriculum nodes were used.
- Mod Latihan, timer expiry, Simpan markah on band (rubric) parts, Prestasi records of the sittings.
- T5 pupil sitting (only hub visibility, S4e).

## 6. Verdict

**Not ready** (baseline, as expected for BASE-1). Open Critical: R1E2E-01, R1E2E-02, R1E2E-05. Open High: R1E2E-03, R1E2E-04, R1E2E-06, R1E2E-08. Blocked until merged: T03, T04, T10, T12, T13. Re-run this spec unchanged after T04, T05 and T10–T13 merge (board T23 "final"): S2a, S5a–S5c and S4a should then pass, and S3a/B-04 turn from Blocked to executable.
