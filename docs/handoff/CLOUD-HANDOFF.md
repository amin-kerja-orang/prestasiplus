# Cloud handoff: V3 Bijak SPM R1 + admin → student question pipeline

Handoff date: 2026-10-31. Handed over by local session prestasiplus-30, the owner of all Bijak SPM work (TRACKER D88).
Branch: `feature/v3-bijak-r1`. See §5 for the exact pushed refs.
No secrets are in this document. Server access (V2 production, V3 UAT) is read-only and stays with the user. The cloud session has no server access and needs none.

---

## 0. Read first, in this order

1. `CLAUDE.md`, `AGENTS.md`: mandatory project rules.
2. This document, end to end.
3. `docs/TRACKER.md`, decisions **D28–D32, D41, D46, D53, D54a, D72–D90**. Read the full text there; §2 below is a summary.
4. `docs/requirements/v3-bijak-spm-scope.md`: the R1 scope, R1-01..R1-21.
5. `docs/architecture/v2-admin-student-pipeline.md`, §13 (R1 build plan, tasks, Panel→Pentadbiran map, DevOps notes), plus ADR-0027..0036.
6. `docs/discovery/cloud-student-mechanism.md`: how V2 works, admin → student. This is the reference to replicate.
7. `docs/discovery/v2-parity/student.md` and `admin.md`: the V2 → V3 gap tables.
8. `docs/architecture/r1-bjs-integration-review.md`: what was reused from the earlier "Bijak standards" work.
9. `docs/requirements/v2-admin-student-pipeline.md` (G1, 20 stories / 155 ACs, release-sliced) and `docs/design/v2-admin-student-pipeline.md` (UX spec).
10. `docs/qa/r1-student-smoke-2026-10-31.md`: the last real student QA, with the bug list.

---

## 1. Naming, repo and rules

### Naming
The user uses these names from 2026-10-30 onward:

| Name | System | Notes |
|---|---|---|
| **V1** | prestasiplus.my | The original site, replicated by the earlier v1 rebuild. |
| **V2** | prestasiplus.cloud + admin.prestasiplus.cloud (the "Panel") | Laravel 13. This is the **primary reference**. The read-only copy of its code is `prestasiplus-reference/backend` on the user's PC, and it was verified byte-identical to production on 2026-10-30. The cloud session does NOT have it; use the discovery docs instead. |
| **V3** | This repo | The new system. Docs and branch names still say "v2" (`docs/*/v2-*.md`, `local/v2-full`). Read "v2" in the docs as V3 wherever it means the new system. |

### Repo layout
- Frontend SPA (Vue 3, Nuxt UI): `src/`. Modules are `src/modules/mNN-*`. Bijak is `m28-bijak-spm`, the question bank `m04-question-bank`. The Portal Pentadbiran menu is `src/shells/pentadbiran/menu.ts`. Flags live in `src/app/features.ts`.
- API (NestJS + Prisma + Postgres): `apps/api/`. Migrations are in `apps/api/prisma/migrations/`.
- Shared packages: `packages/contract` (zod schemas and generated `openapi.json`) and `packages/exam-core` (exam model, composer, grading).
- Docs: `docs/`.

### CLAUDE.md rules that matter most
- The main session is the **Delivery Lead**. It plans, delegates to role subagents (`.claude/agents/`), verifies and integrates. Gates G1–G6 apply to each feature.
- Reply to the user in **Bahasa Melayu**. Code, commits and docs are in English.
- Work only on feature branches. **Never commit to `main`.** Commit only when it is appropriate; the user has said "push GitHub bila sesuai".
- **Never run `pnpm`.** The repo uses npm; pnpm once wrecked `node_modules`. Use `npx` / `npm run`.
- Changes to shared mock or seed data go in an isolated worktree. Never leave half-done edits.
- Never claim a gate passed without real evidence: test output, review verdicts.
- Responsive is mandatory: 375 / 768 / 1280, with no horizontal page scroll.
- Privacy: never write real people's names.

---

## 2. User intent and decisions, in plain terms

The full text is in `docs/TRACKER.md`.

### Overall direction
V3 must **replicate the features, processes and outcomes of V2 (and V1)**. The main pain point is that **questions the admin enters do not reliably reach students**. The user wants a **functioning** system, not mocks or prototypes (D84).

### Key decisions

| D | Decision |
|---|---|
| D28–D32 | v2 direction. prestasiplus.cloud (V2) is the primary reference. Nuxt UI with its own theme. Changed flows are the two portals, question intake and display. D32: Bijak SPM has two starts, "Kertas Pilihan" and "Jana Kertas" (the successor of V2 `/spm-mock`). |
| D41 | V2 problems are recorded and must not be copied, e.g. a shared diagram split from its questions. |
| D72 | Secondary only (Tingkatan 1–5); Darjah is out. Learning content focuses on T4/T5. |
| D73 / D74 | ALESA AI and "Mohon Keluarga Angkat" are hidden behind flags. |
| D75–D78 | Bijak exam standard: blueprints (Kontrak) per subject × kertas, a "Disahkan" gate verified with evidence from 2 or more bodies, and Jana Kertas exact-or-refuse with "Pratonton kolam". KBAT follows DSKP cognitive levels. |
| **D79** | The V3 **Portal Pentadbiran absorbs admin.prestasiplus.cloud** (the V2 Panel) plus V2 `/admin`, with **V2 mechanisms and admin UX**: the same screens, steps, labels and order. Only the theme differs, and new gates must fit inside the V2 flow. |
| D80 | Legacy untagged MCQs stay servable (Latih Tubi, Bab, games) but are excluded from blueprint papers. Latih Tubi and Permainan are visible at go-live; Kertas Subjektif sits behind a flag (OFF). **No copy of V2 questions or images.** **Approved = servable**: the separate question publish hop is dropped, and papers still need Terbit. |
| D81 | Kertas Subjektif method: upload PDF → OCR → edit like a document → Terbit. This is KIV for R1. |
| D82–D85 | G1 and G2 approved. No mock prototype (D84). G2 decisions U1–U8 (D85): OCR = Tesseract; approved = servable; Tambah Set for Tracking A; Kertas required for SPM T4/T5; teacher reference questions treated as legacy; games exclude image questions with a reason; flag OFF returns 403 "Ciri ini tidak tersedia buat masa ini."; Simulasi Kuiz is stored as a practice session. |
| D86 | **Scope: secondary students, Bijak SPM first; everything else is KIV.** Priority modules are the "Murid 1.0" column of `docs/Matriks-Akses-Peranan .xlsx`: Dashboard, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Kelas Saya, Soalan by Chapter, Remedial, **SPM**, Heatmap Topik Lemah, Permainan, Laporan Soalan, plus the account basics. Admin work is limited to what feeds those modules. |
| D87 | R1 scope and build plan approved. U1–U7: DSKP T4–T5 only (the repo has no T1–T3 extracts); in R1 Databank serves text MCQ only; all spmPool readers switch together; the first demo can use Studio/manual; and so on. |
| D88 | **One owner for Bijak SPM.** The other session (prestasiplus-95) was stopped and its work integrated after review against V2. **V2 parity is the pass bar.** |
| D89 | **Soalan by Chapter: the admin picks the Bab manually.** Fact: V2 production has 0 of 408,197 MCQs with chapter_id, and V3 UAT has 0 of 339,112. |
| **D90** | **A shared stimulus is ONE group, never a standalone "question".** A figure or passage referred to by several questions ("Rajah 1" → S1, S2) is shown once, with every member question under it. It carries no marks. In the builder a group is placed, moved and removed as a unit. Intake links a figure to EVERY question that refers to it. V1/V2 got this wrong; do not copy them. |

### User working preferences (standing)
- **Decide by principle.** Don't ask what "copy V2 + DSKP + exam standard" already answers. Ask only real product questions, in plain BM, with a recommendation.
- **Replicate V2 unless it is broken.** Broken (D9) means a dead link, a contradiction, unusable on touch, and similar. Fix broken things and log them in the module's "Fidelity deviations" table.
- When asked how quiz/latihan/ujian/SPM work, answer as the **admin → pupil flow**, not an access matrix.
- **Never change anything on any server** (V1/V2/V3). All work is local and then pushed to GitHub. Deployment is done by the user's DevOps.
- No UX changes beyond what is requested.
- Playwright and preview use **Microsoft Edge**.

---

## 3. Discovery done (facts, verified read-only)

### Documents
- `docs/discovery/cloud-student-mechanism.md`: V2 admin → student mechanism for every activity, the 7 admin task flows with verbatim BM labels and click counts, and the V2 sidebars.
- `docs/discovery/v1-question-activity-baseline.md`: V1, 49 question features plus 14 outcome screens (from docs; many student screens were unobserved).
- `docs/discovery/v2-parity/student.md` and `admin.md`: V2 → V3 parity tables, scoped to Bijak first (D86).

### The V2 single mechanism
1. Everything enters as draft.
2. A question becomes servable at **approved** (canonical) or `diluluskan` (legacy).
3. A paper becomes servable at **published**.
4. Kertas Subjektif becomes visible once `published_at` is set, and a teacher set once it is `diterbitkan`.
5. Two banks coexist: legacy MCQ and a canonical exam bank, bridged by `exam:unify`.

### V2 production facts (2026-10-30, aggregate SELECTs only)

**Feature flags**
- OFF: `latih-tubi`, `permainan`, `kertas-subjektif`.
- ON for pupils: remedial, sejarah, video, psikometrik, kemajuan, biasiswa, cita-cita, panduan, perutusan, profil-cerah, tiket, universiti.

**Canonical bank**
- 5,371 exam_questions (667 approved, 5,037 draft).
- Parts by answer mode, total / on approved questions: mcq 5335/532, extended_essay 532/229, short_text 136/49, essay_choice 39/31, numeric 7/7, working_shown 3/0. The other 8 modes have 0 rows.
- Stimuli: passage 797, image 667, diagram 410, table 45, map 9, infographic 2, graph 1.

**Papers and bank**
- exam_papers: published 69 (K1 10, K2 11, 48 composite), draft 104. exam_attempts: 286, about 37–44% submitted.
- Legacy MCQ: 408,197 `diluluskan`. **0 of them have chapter_id or topic_id.** Structured questions: 4,061. Tracking A sets: 60. Kertas Subjektif page-image papers: 254 published. PKSK: 748.

**Images**
V2 keeps images as **files on disk** (about 2.4 GB). The DB stores paths only: 7,199 legacy questions with image_path, and 1,343 stimuli with images. Per D80, nothing is copied.

**Usage (practice_sessions by mode)**

| Mode | Sessions |
|---|---|
| Databank `spm_tahun_lepas` | 426 (most used) |
| revision | 94 |
| chapter | 51 (seeded timestamp) |
| latih_tubi | 50 |
| battle | 48 (seeded) |
| pksk | 43 (seeded) |
| spm | 38 (seeded) |
| spm_mock | 26 |
| spm_ramalan (Tracking A) | 18 |

Simulasi exam_attempts by month: Jul 6, Aug 70, Sep 99, Oct 108. Games and structured practice are barely used.

**Known V2 defects not to copy:**
- teacher-set and game pickers use `status != 'menunggu'`, so drafts and archived questions leak in;
- the stale "/simulasi" subheading;
- Kertas Subjektif pages can only be added through the CLI;
- the shared-stimulus split (D90);
- the Bab page shows "0 soalan" everywhere.

### V3 UAT state (uat.prestasiplus.cloud, 2026-10-30)
- The deployed API is 6d81162c (feature/v2-backend, 2026-10-26) and the frontend 83d7bf0d (2026-10-29). Migrations go up to 0091. None of the R1 work is deployed.
- Config: `AI_PROVIDER=mock`, `OCR_ENGINE=none`, `BIJAK_POC_QUESTIONS` unset (false).
- public DB: 406,396 questions, all `published` (loaded from V2 legacy MCQ by QLOAD). 85,772 `pool/spm` tags. All D1–D6 levels are active on UAT.
- Empty: **curriculum_nodes (DSKP) 0**, papers 0, blueprints 0, stimuli 0, Tracking A sets 0. No questions have chapter_id or paper_code.
- Schemas `archive_cloud` and `staging_cloud` hold copies of V2 data for ETL.

### Root causes found, so they are not repeated
1. **RC1.** The V3 build spec became the prototype mock instead of V2 (D43/D53: "the mock is the behavioural spec").
2. **RC2.** There was never a complete V2 inventory or coverage proof.
3. **RC3.** The redesigned question path was several models joined by lossy bridges that **silently drop** images, stimuli and groups. Exam data also started empty by decision.
4. **RC4.** FE and BE were built apart on mocks and joined late; the first joint tree was 2026-10-29.
5. **RC5.** Deferred work was logged ("later card") but not scheduled. The gates counted cards, not end-to-end flows. No test proved "admin enters → student sees".
6. **RC6.** Scope cuts, flags and the secondary-only change hid content near the end.
7. **RC7.** Split teams and schedule pressure.

**Lesson:** every task must prove the end-to-end flow on the real stack.

---

## 4. Requirements and design (all approved)

| Doc | What it holds |
|---|---|
| `docs/requirements/v2-admin-student-pipeline.md` | G1, D82: the single admin → student pipeline. Stories are tagged R1, R2 or KIV (§0 "Release slicing"). |
| `docs/requirements/v3-bijak-spm-scope.md` | **R1 = Bijak SPM**, items R1-01..R1-21 (176 AC entries), including R1-21 Panel parity. |
| `docs/design/v2-admin-student-pipeline.md` | UX spec: 21 admin pages and the student displays. D83 decisions D-1..D-11. |
| `docs/architecture/v2-admin-student-pipeline.md` | Architecture. **§13 is the R1 build plan** (tasks R1-B/F/D/Qnn, waves, Panel → Pentadbiran mapping, DevOps notes). |
| ADR-0027..0036 | Lifecycle (approved = servable), servable service, single store, served model and bridges, DSKP leaf tags, Tracking A, Kertas Subjektif model, OCR = Tesseract, flags store, R1 slice and DSKP loader. |
| `docs/architecture/r1-bjs-integration-review.md` | Classification of the integrated "Bijak standards" work. |
| `docs/requirements/v2-bijak-spm.md` §10 | Fidelity deviations for the student Semakan (stepper with "Simpan markah", leave guard, band label). |
| `docs/ops/dskp-loader.md`, `docs/ops/r1-release-notes.md`, `docs/ops/r1-b01-question-lifecycle.md` (on the b01 branch) | DevOps runbooks. |

---

## 5. Git state at handoff

### Merged into `feature/v3-bijak-r1` (head 09f48585 + the handoff-doc commit)
Base: 6f92e350, a checkpoint commit of the whole shared working tree `local/v2-full` at 2026-10-30 23:11. It includes uncommitted work from several sessions at that time.

| Branch | Content |
|---|---|
| r1/integrate-bjs (L1) | The earlier Bijak "standards" work: Kontrak, Disahkan gate, per-leaf tags, pool source, launch blueprint seeds (as Spec), section review. Migration **0092_bijak_standards**. The image-index migration was renamed to **0093** (`IF NOT EXISTS`). |
| r1/b04-dskp | DSKP T4–T5 loader CLI `npm run dskp:load -w @pp/api -- --dry-run`, with data packaged under `apps/api/src/modules/curriculum/dskp/data`. Loads 2,844 nodes and 1,394 TP rows. |
| r1/b20-files | Pupil read rule for question images (`files/question-image-access.ts`). |
| r1/b12-selfmark | Self-mark (0..N, band), the keyword suggestion seeded as awarded at submit (V2 behaviour), Cuba Lagi (a new attempt, others untouched) and past sittings. |
| r1/g4-fix-papers | Pupils generate only from the serving Disahkan blueprint; Admin Pusat in Mod Pelajar may use Spec (is_test). |
| r1/g4-fix-attempts | Status derived from the mark; coins and points stay at the credited submit values. |
| r1/f11-semakan + r1/f11-followup | Student Semakan UI: stepper with "Simpan markah", band picker, keyword suggestion line, Cuba Lagi, "Lihat semakan lepas", leave guard. |
| r1/bab-field | D89: admin "Bab" select (`curriculumChapterId`); Soalan by Chapter now has questions to serve. |
| r1/b06-spmpool | Includes prestasiplus-8b fix2/3/4. `SPM_SERVABLE_SQL` (`questions/learner-visibility.ts`) replaces the `spmPool` tag filter in Databank, Latih Tubi SPM, Mock K1, Battle SPM and Misi. **Its DB specs were NOT run** because of PC load. |
| r1/b09a-builder | Admin paper builder API: placements with D90 group rules, section pool, pool-preview, admin generate, review, student-view, publish (structural tier), withdraw and copy (Salin set). |
| r1/b16-kuiz | Simulasi Kuiz backend. Random mode is stored as a practice session; per-paper mode is not stored. 23/23 tests. |

### NOT merged: still to do (see §7)

| Branch | State | Remaining |
|---|---|---|
| r1/b08-bridge (ab04b498) | DONE, not merged | Bijak bridge serves 7 stimulus kinds, option/stem images, groups of 1–3 stimuli (D90) and essay_choice, with refusal codes and BM reasons (`refusals.ts`). FE has StimulusStack, StimulusChip and ResultGroup. Still unrun: vue-tsc and the DB specs. |
| r1/b01-lifecycle (cf2aa784) | **WIP** | Migration **0100_question_lifecycle_approved** (approved → review, then published → approved). Contract, consumers and FE labels are updated. Not verified: tsc, eslint, FE m04 tests, the last spec batch. 4 spots still say `'published'` (§7a). |
| r1/f08-builder-ui (4cd1329f) | **WIP**, untested | The landing page, ReviewBlock, StudentViewDrawer, PoolPreviewCard and builder http/memory clients are done. Still missing: SetBuilderPage, routes, the PaperEditorPage extension, and tests. |
| r1/f12-kuiz | Stopped early | Student Simulasi Kuiz pages. Progress unknown; may be empty. |

### Pushed refs
Pushed to `origin` (github.com/amin-kerja-orang/prestasiplus) on 2026-10-31 by the lead. No branch was pushed to `main`.

| Ref on GitHub | Commit | Notes |
|---|---|---|
| `feature/v3-bijak-r1` | branch head (the commit that adds this doc, on top of 09f48585) | **Start here.** R1 integrated work plus this handoff. Its base is the shared-tree checkpoint of 2026-10-30 23:11 (6f92e350). |
| `handoff/shared-tree-2026-10-31` | 8bb59c2a | A snapshot of the shared tree `local/v2-full` as running on the 5192 preview: all sessions' uncommitted work (de: polish, secondary-only; 8b: fix–fix4, fe-final; question-bank work). Parent f82d12f6. **Not yet merged into `feature/v3-bijak-r1`.** Merge it in (task (a-1) below) to pick up the later de/8b changes. |
| `r1/b08-bridge` | ab04b498 | DONE, to merge (task (a)) |
| `r1/b01-lifecycle` | cf2aa784 | WIP, to finish and merge (task (a)) |
| `r1/f08-builder-ui` | 4cd1329f | WIP, to finish (task (c)) |

`r1/f12-kuiz` had no commits of its own (task (d) starts fresh from `feature/v3-bijak-r1`).

### (a-1) Merge the latest shared-tree snapshot
Run `git merge --no-ff origin/handoff/shared-tree-2026-10-31` into `feature/v3-bijak-r1`. Expect conflicts where both sides changed the same files. Typical cases:
- 8b's practice/curriculum fixes, already applied via r1/b06-spmpool, so pick the identical or newer hunk;
- `docs/TRACKER.md` and `docs/architecture/v2-backend-deviations.md`, which are append-only, so keep both sides;
- de's DS/shell polish versus R1's m04/m28 edits, so keep both sides' intent.

After resolving, run: registry-boot, apps/api tsc, vue-tsc, and the m04/m28/bijak specs.

---

## 6. Other sessions' state at handoff

### prestasiplus-8b (G5 QA lead, local/v2-full integration)

**Scope.** G5 QA of 5 changes: (a) secondary-only (D72; feature owner prestasiplus-de), (b) ALESA hidden (D73), (c) tab titles "{Page} | PRESTASIPLUS", (d) CC/Admin Sekolah header in the portal, (e) "Ingat saya".

**Done, applied in the shared tree (uncommitted)**
- Backend:
  - fix (OBS-4): questions list rows and totals on one filter; NOT_PRIMARY_LEVEL_SQL; CSV sample ids 7/10.
  - fix2: curriculum MAP_GRADES T4/T5; practice overview LEARNER_LEVEL_SQL + NOT_PKSK; account QUESTION_COUNT_SQL; command-center VISIBLE_USER_SQL.
  - fix3: stale specs.
  - fix4: card = details = login 493.
- Frontend fe-final (80 files): mock D72 data, HomeLevels pills, LearningMapPage fallback, ChapterIndexPage empty state.

**Pending**
- Final HTTP re-test on 5192 after rebuild. The G5 verdict for (a) is NOT READY until then. (b), (c) and (e) PASS. (d) is PASS for Admin Sekolah and PARTIAL for Admin Pusat.

**Open items**
- mock pelajar2 school;
- `exam/builder/question-bank.source.ts` ~79 counts Darjah (R1-B21, Bijak owner);
- reports/classes raw SQL may count Darjah;
- M17 docs (DC-M17-05);
- OQ-04 Darjah articles.

**Pre-existing failures**
UserListPage number format, perf budgets, 21 stale e2e specs, stale m17/m12/m11 unit tests.

**QA doc:** `docs/qa/v2-integration-2026-10-29.md`.

> Note: these changes live in the **local shared working tree** and are only in GitHub if the user or lead pushes a branch that contains them (see §5). `feature/v3-bijak-r1` contains the shared tree as of 2026-10-30 23:11, plus 8b's fix2/3/4 via r1/b06-spmpool. fe-final and later edits may be missing.

### prestasiplus-de (preview owner / lead for 5192)
**Scope**
- Delivery Lead and single integrator of the local preview **5192**. Branch `local/v2-full` = FE `be/integration-frontend` + BE `feature/v2-backend` (merge f82d12f6, local only).
- Owns everything outside the Bijak/exam/question pipeline, plus the decisions for QA session 8b.
- Decisions:
  - D54-SEC / D72: secondary only. Darjah hidden, T1–T5 kept, content T4–T5.
  - D73: ALESA AI hidden behind `VITE_ALESA_AI`, default off.
  - D77: Pemantauan IA changes revoked; original UX plus layout/DS polish only.
  - 2026-10-31: Kirkpatrick "T1–T4" → "Tahap 1–4" (DV-M12-39).
- **User rule:** improve the look only. Never add, remove or rename menus, pages, tabs or sections.

**Done** (all UNCOMMITTED in the shared tree, about 661 status entries; captured in `handoff/shared-tree-2026-10-31`, see §5)
- Login and shell:
  - "Ingat saya" alignment;
  - sidebar search under a centred logo;
  - collapsed icon logo + favicon;
  - tab title "{Page} | PRESTASIPLUS";
  - Command Center header cleanup.
- Secondary-only:
  - BE: QA fix2/3/4 (curriculum T4/T5, LEARNER_LEVEL_SQL, VISIBLE_USER_SQL, questionCount 493);
  - FE: 8b's fe-final applied. registry-boot 3/3 and typecheck green.
- ALESA hidden and tab titles: G5 Pass.
- DS fixes: shell header subtitle, DsSelect, pagination, DsPillNav.
- Layout polish:
  - Pemantauan: Monitoring; Kirkpatrick incl. the filter-card toggle and Tahap labels; Langsung; Aktiviti Harian;
  - Kualiti / PKSK / Audio KBAT;
  - Kurikulum & Kandungan / Tiket / Screenshot;
  - the Pengguna & Sekolah list pages.
- vue-tsc clean in de's paths.

**Open and next**
- Rebuild 5192 with fe-final, then 8b's final HTTP re-test (B-HTTP-04, B-HTTP-07, chapter empty state).
- Run the m01/02/03/04/05/08/09/16/27 unit tests.
- Known failures:
  - perf budgets under load;
  - 3 apps/api `learner.spec` label tests (BR-16 code map, subject labels).
- Not yet polished: forms and detail pages for Pengguna, Sekolah, Langganan, Subjek, Tahap, Banner, Artikel and Nota.
- DS asks:
  - right-align the DsFilterBar actions;
  - a 7-tile DsStatRow;
  - DsStatTile truncates long values.
- `lint:admin` has 7 new findings in the m02/m03/m09 polish files; a ratchet is needed.
- mock pelajar2 has no school.

**Docs and build**
- Docs:
  - docs/TRACKER.md (D72/D73/D77 + change log 10-30/10-31);
  - docs/requirements/v2-secondary-only.md;
  - docs/AKAUN-DEMO-LOCAL.md (demo accounts, published local demo password);
  - URS/SRS M12 (DV-M12-39), M17 (URS v1.14 / SRS v1.17, DV-M17-55);
  - docs/architecture/v2-api-catalogue/teacher-reports-admin.md;
  - role-access-matrix.md and v2-portals.md.
- Local full stack:
  - Build: `npm run stack:up` (compose.yaml + compose.http.yaml; migrate + demo seed) → http://localhost:5192.
  - Restart without a build: `docker compose -f compose.yaml -f compose.http.yaml up -d --wait`.
  - Gotcha: `.env.api` must not carry inline comments.

### prestasiplus-95
Stopped by the user (D88). Its `feature/bijak-spm-standards` work was reviewed and integrated (r1/integrate-bjs). Its half-done items were re-implemented or folded into R1 tasks.

---

## 7. What is left: prioritised tasks for the cloud session

Each task: a feature branch off `feature/v3-bijak-r1`, run by the owning role subagent, then targeted tests, then code-reviewer, then merge `--no-ff`.

### (a0) Fix FE type errors on feature/v3-bijak-r1 (found at handoff, 09f48585)
apps/api `tsc --noEmit` is clean. `npx vue-tsc --noEmit -p tsconfig.app.json` shows these in R1 paths (likely merge interplay):
- m04 `components/QuestionSummaryCard.vue:254`, TS7053
- m04 `mock/handlers/question-input.ts:230`, `guruChapter` is missing from the messages type (bab-field vs messages)
- m04 `pages/SubmissionListPage.vue:270-271`, TS7053
- m28 `admin/papers/BankPage.vue:286`, TS7053
Fix these first, then re-run vue-tsc.

### (a) Integrate the finished/WIP backend
- **Merge `r1/b08-bridge`.** Run vue-tsc on m28, `test/bijak-question-bridge`, `test/bijak-integration/be09-paper.spec.ts`, and a DB integration test of the image read rule.
- **Finish `r1/b01-lifecycle`.**
  - Run apps/api `tsc --noEmit`, eslint, FE m04 unit tests, and the questions / questions-workflow / files / exam-builder / bijak specs.
  - Fix the remaining `'published'` spots:
    - `practice/question-bridge/be09-practice-question-source.ts:95,197`
    - `practice/reads/writes/structured.service.ts:121`
    - `bijak/question-bridge/be09-question-source.ts:82`
    - `bijak/papers/pool-source.ts:51` (`excludedBankQuery` would 422)
    - their tests.
  - Then drop `published` from `exam/builder/builder.constants.ts isServableStatus`.
- **AC:** tsc/eslint clean; an approved question is servable and a draft/review one is not; migration 0100 is verified on a seeded DB.

### (b) Run the DB specs that never ran
- B06: `test/questions/spm-servable.spec.ts`, `draw-bounded.spec.ts`, `served.db.spec.ts`, `battle/lobby.spec.ts`, `missions/assignments-adapter.spec.ts`, `practice-question-source/source.spec.ts`.
- Also `bijak-integration/challenges-savepoint.spec.ts` (it timed out under load).
- Fix what fails. `battle/arena-helpers.ts` and `source.spec.ts:176` may still assume the pool tag.
- Produce before/after counts for 8b's QA: login "N+ Soalan" (was 493), the per-subject cards (BM 53, MATH 54, SCI 50) and one draw check.
- **AC:** an admin-created approved T4 MCQ appears in Databank, Latih Tubi SPM and Mock K1, and card = details = login = drawable.

### (c) Admin Set Builder and Semak Kertas UI (F08/F09)
- Continue `r1/f08-builder-ui`: SetBuilderPage at `/admin/studio/sets/:paper/builder`, routes, the PaperEditorPage extension (header, ReviewBlock, Terbitkan disabled with reason, Tarik balik, Salin set, student view), and tests.
- V2 Panel labels and click counts (Jana set + Terbitkan = 2 clicks).
- Menu item `KS-17 Set Builder /admin/studio/sets` is a minimal menu.ts hunk; coordinate with whoever owns the menu.
- **AC:** an admin builds a paper (groups move as a unit) → review shows blockers and notes → Terbit → a pupil sees it in Bijak SPM.

### (d) Simulasi Kuiz UI (F12) and the kuiz follow-ups
- Pages `/simulasi/kuiz` and `/simulasi/:paperId/kuiz`, reusing `src/components/question-display`.
- Backend follow-ups:
  - an invalid count falls back to 20, as V2 does;
  - D90: random mode serves a member with its group stimulus;
  - per-paper mode shows the stimulus once per group.
- Make the route reachable (check prototype scope).

### (e) Studio create/edit (F03a/b) with D90 groups, DSKP tags, Bab and images
- The admin can create one stimulus with 2 or more member questions, add/remove/reorder members, and tag DSKP (unit, SP, TP, cognitive level per leaf) and Bab.
- Intake links one figure to every question that references it.
- Follow V2 Studio labels (cloud-student-mechanism §3, flow 1; 4 clicks to publish).

### (f) Question-model gaps for display
- `QuestionsRepository.groupOf` must pass all 7 stimulus kinds plus caption, tableData and sourceCitation.
- Add `essay_choice` to the parts contract.
- `exam/builder/question-bank.source.ts` takes only the first stimulus of a group.
- `QuestionsRepository` needs a read for stimulus bodies linked directly to a version, used by kuiz and bridges.

### (g) Student Jana Kertas
`POST /bijak/papers/generate` still uses the legacy `composeFromBlueprint`. Switch it to `composeStandardPaper` (D75) and update `generate.spec` and `golden-mock.json`.

### (h) R1-B21 secondary-only guard
Apply it to the Bijak and builder paths, including `exam/builder/question-bank.source.ts` ~79.

### (i) Review and QA
- G4 code-reviewer and security-engineer review of everything since 100496c2.
- Then a QA end-to-end run on the real stack at 375/768/1280, covering:
  1. the admin uploads a question (form/CSV/PDF) with an image and a D90 group;
  2. approves it;
  3. builds a paper;
  4. Terbit;
  5. a pupil sits the paper, self-marks, sees the result and does Cuba Lagi;
  6. Databank, Latih Tubi SPM and Bab receive the admin question.
- Re-test QA bugs B-01, B-02, B-04 and B-05 from `docs/qa/r1-student-smoke-2026-10-31.md`.

### (j) [PROPOSED] BM copy awaiting user confirmation

| Context | Text |
|---|---|
| Retry 409 (attempt not submitted) | "Hantar percubaan ini dahulu sebelum mencuba semula." |
| Retry 409 (paper gone) | "Kertas ini sudah tidak tersedia untuk dicuba semula." |
| Self-mark 422 (unknown part) | "Bahagian ini tiada dalam kertas ini." |
| Self-mark 422 (auto-marked part) | "Bahagian ini ditanda automatik; markah kendiri tidak diperlukan." |
| Self-mark 422 (invalid band) | "Band tidak sah untuk bahagian ini." |
| Self-mark 422 (band on non-rubric part) | "Bahagian ini tidak menggunakan band." |
| Leave guard | "Anda ada markah kendiri yang belum disimpan. Tinggalkan halaman ini?" |
| Bab mismatch | "Bab tidak sepadan dengan subjek dan tahap." |
| Pipeline docs | The gate lines and the 12 "Dilihat murid di" reasons in the design spec |

### (k) R2 and KIV
- **R2:** Tracking A editor and sets, Mock K1/K2, Subjektif SPM / Latihan Berstruktur, practice-family bridge upgrades (images and groups in Latih Tubi/Bab/Remedial), Heatmap, the other Murid 1.0 modules, Panel dashboard/analytics tiles.
- **KIV:** Kertas Subjektif + OCR, games changes, Kawalan Ciri, PKSK, DOCX import, teacher and Admin Sekolah features, the 8 answer modes with 0 V2 rows.

### (l) DevOps notes (documentation only; the cloud never deploys)
- **Migrations, in order:** 0092_bijak_standards (downgrades existing verified blueprints to spec; serves_students defaults false), 0093_part_options_image_file_index (`IF NOT EXISTS`; `prisma migrate resolve` for DBs that recorded the old 0092 name), 0100_question_lifecycle_approved (once B01 is finished).
- **DSKP:** run `npm run dskp:load -w @pp/api -- --dry-run`, then the real run (`docs/ops/dskp-loader.md`).
- **Config:** `BIJAK_POC_QUESTIONS` stays false. A real PDF intake needs `OCR_ENGINE=tesseract` plus an extraction provider (AC-R1-14.2).
- **Blueprints:** they must be re-verified (Disahkan) before pupils can use Jana Kertas (`docs/ops/r1-release-notes.md`).

---

## 8. How to work (lessons from the local sessions)
- **Branches:** one feature branch per task, off `feature/v3-bijak-r1`. Merge back with `--no-ff` after tests and review. Small additive changes, each with its own tests.
- **Tests:**
  - API: from `apps/api`, `npx tsc --noEmit` and `npx vitest run <spec files>`. DB specs use testcontainers (Docker).
  - FE: `npx vitest run --project unit <paths>`, `npx vue-tsc --noEmit -p tsconfig.app.json`.
  - Lint: `npx eslint <files>`.
  - Contract: `npx jiti scripts/emit-openapi.ts` regenerates openapi.json; `--check` verifies it.
- After a schema change, run `npx prisma generate` in `apps/api`. The generated client is git-ignored.
- Run only targeted specs, one vitest process at a time; DB specs time out under load. Limit parallel agents to 3–4.
- **No server access.** Never deploy, migrate or seed on any server.
- **Review gates:** after each task, code-reviewer. Add security-engineer when auth, files or new input are involved. QA end to end before calling a feature done (lesson RC5).
- Every V2 behaviour you replicate: cite the V2 behaviour from the discovery docs. Every deviation: log it in the module's fidelity-deviations table with the reason (D9).

## 9. Open questions and risks
- `feature/v3-bijak-r1` is based on a checkpoint of the shared tree from 2026-10-30 23:11. Later shared-tree edits by other sessions (de's layout/DS polish, 8b's fe-final, Kirkpatrick) may not be in it. Reconciling with whatever the user pushes from the shared tree may need a careful merge. Expect conflicts in `src/ds/**`, `menu.ts`, m04 mock files and `v2-backend-deviations.md`; the latter is append-only, so keep both sides.
- Several DB-backed specs never ran on the merged head (PC load). Treat B06 and the bijak-integration areas as unverified until run.
- V3 UAT has no DSKP nodes, papers, blueprints or stimuli. A demo needs the DSKP loader, one Disahkan blueprint (verify via Kontrak) and admin-built papers. The PoC fixture is off by design.
- The 339k legacy MCQs have no Bab and no DSKP tags. They appear in Bab or blueprint papers only after an admin tags them. A bulk-tagging tool is not planned (ask the user if it becomes a blocker).
- The OCR/AI extraction provider for real PDF intake is undecided beyond Tesseract (D85 U1). R1 sign-off AC-R1-14.2 needs one real extraction.
- [PROPOSED] BM copy (§7j) needs the user's confirmation.
