# M06 — SPM — Software Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | SRS — M06 SPM |
| Version | 1.5 |
| Date | 2026-10-03 |
| Status | Approved (G1) — v1.4 XL round-2 alignment (D11, D12). Live-session states pending user approval (URS OQ-M06-01). |
| Authors | product-analyst (functional: §1–5, 8–10, 12–13) and solution-architect (data entities §6, mock API §7, NFR/SEC §11) — agent |
| Source URS | [urs/M06-spm.md](../urs/M06-spm.md) v1.0 |
| Evidence | [discovery/M06-spm.md](../../discovery/M06-spm.md), inventory `docs/discovery/inventory/M06/` (+ raw states `inventory/_raw/M06/`), M04 discovery §2.14 (report modal on `/spm/latih-tubi/{code}/quiz`), M05 discovery §2.7/§2.10 (quiz component template, structured list) |
| Related | [srs/M01](M01-authentication.md) (404, canonical seed accounts with integer ids), [srs/M03](M03-curriculum.md) (subject/level integer ids, codes, `GET /api/subjects`), [srs/M04](M04-question-bank.md) v1.2 (**owner** of the question store incl. SPM pool BR-M04-32, `getEligible`, `structuredStore` and its §6.11 anchors, `ReportQuestionModal` FR-M04-118; store contract §7.1), [srs/M05](M05-practice.md) v1.2 (**owner** of the session store DATA-M05-01/02, StructuredAttempt DATA-M05-06, BR-31 completion contract, endpoints §7 #4–#6 and #15–17, `<PracticeQuiz>` / `<StructuredAnswer>` §7.1), shell rule `docs/design/shells.md` DV-SH-03. |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.5 | 2026-10-03 | **Revision history — v1.5, XL-R10-05** (`docs/qa/audit/cross-module-logic-R10-M25.md`): §7 #21 now states the response `DutaCard \| null` (`null` when no `bintang` record is active), the seedable pick with no `subject` / `seed`, and 401 without a session. Matches `src/modules/m06-spm/mock/handlers/duta.ts`. M25 §7 #2 writes auth `U`; the handler uses `requireAuth()` (any session), so the two agree on "any signed-in user". Documentation only. |
| 1.4 | 2026-09-25 | **Revision history — v1.4.** XL round 2 (`docs/qa/audit/cross-module-logic-M01-M07.md`): XL-35 — S10 reads M05 #23 (`GET /api/practice/sessions?modes=past_year,latih_tubi,ramalan&type=`); M06 #11 removed as an own endpoint. XL-34 — hub 20,529 / 14,673 declared documented display constants under DV-M06-01 (D11 exception); S1 shows no contradicting computed figure (chips ≤ total, E2E-M06-03). XL-29 — the SPM pool and the Tracking A sets use the M04 `spmPool` facet. XL-25 — stale "M05 A1" and "M05 SPM fixtures" notes removed. Trace re-run 0 errors. |
| 1.3 | 2026-09-25 | **Revision history — v1.3, cross-module logic review** (`docs/qa/audit/cross-module-logic-M01-M07.md`; D11, D12). XL-01: SPM pool = M04 `questionStore.spmPool` (§6.2; M06 question schema and virtual ids removed); `question_id` sessions via `getEligible` (FR-87, E2E-41 uses active 570024); pool follows M04 creates/deactivations (new FR-89, AC-02.2, E2E-03); observed per-subject pool sizes supplied as M04 allocation inputs (§6.10). XL-02: S2–S4 counts are named `spmPool` queries; the hub constants cannot be derived and stay live under the approved minimal DV-M06-01 (BR-01, FR-06). XL-03/04: sessions are M05 PracticeSessions (§6.4 field map; no `mode = spm`), created/checked/completed through M05 #4–#6 with BR-31 (FR-20/21/32/34/51/53, BR-13/15/19); subjective sets are StructuredAttempts `scope = spm` (BR-17, FR-61); mock exams stay M06 records outside the session store, decision in §6.5. XL-10: `<PracticeQuiz>` / `<StructuredAnswer>` per M05 §7.1 (§13 Q2 closed). XL-11: `structuredStore` with only M04 §6.11 anchors, total 4,059 (§6.10; Q3 closed). XL-12: KBAT 1–6 (§6.9). XL-20: DV-SH-03 — fixed titles without subtitle (FR-10). XL-22: DV-M06-17 text ≥ 12px (FR-86). XL-24: M05 structured paths (§7 #18/#19). XL-25: stale references refreshed (§0, §13). Seeds A2–A5 / P1–P4 unchanged. 89 FRs. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, audit round 2 + M05 alignment.** AUD-M06-17: hub reverted to live values — "Jumlah Soalan" 20,529 and Databank / Latih Tubi chips 14,673 are live fixture constants; DV-M06-01 changes the S4 page only (BR-M06-01, FR-02 unchanged in scope, §6.10 hub values, E2E-01, E2E-03). AUD-M06-18: PERNIAGA S4 = 934 (URS AC-09.2). AUD-M06-19: the S4 seed split is labelled PROPOSED (E2E-11, E2E-13). M05 AUD-M05-02: the admin's 4 SPM sessions use the M05 ids and values A2–A5 (A2 = latih_tubi **Sejarah** 14/40, not MATH); the student's SPM sessions are P1–P4 (P1/P3 as M05; P2 and the new P4 proposed to M05); one session store shared with M05 (§6.4, §6.10, E2E-28). Traceability 0 errors. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit fixes** (`docs/qa/audit/M06-audit.md`). AUD-01: difficulty keys 2–5 replicated, DV-02 withdrawn (FR-27/28/31, BR-07, §2, §6.1, E2E-11…14). AUD-02: real S6 set values seeded (§6.10); "Soalan Tracking A" computed = 1,769 (BR-01, DV-04). AUD-03: minimal DV-01 — S2/S3 and BA lock as live, S4 from the same pool with PROPOSED seed splits (BR-01/02/03, FR-23…26, §6.10). AUD-04: role-based shell kept for S11–S13, titles only (§2, FR-10, E2E-04). AUD-05: S13 `required` subject, `maxlength=8`, hide-on-submit, h2 + `<pre>` (FR-80/82/83, new FR-88, BR-28, §5, §8, E2E-35/36, new E2E-42). AUD-06: `question_id` + `count=1` variant (new FR-87, BR-07/13, §2, §5, §7 #8, new E2E-41). AUD-07: Q4 neutral/UNVERIFIED (FR-72…74, BR-22/23, §8.3, §10, E2E-31/32 provisional). AUD-08…16: FR-63/64/70/78, BR-21/25, §6.1 integer ids, SEC-03 wording, PROPOSED COPY labels, DV-08 evidence. 88 FRs, 42 E2E; traceability re-run 0 errors. |
| 1.0 | 2026-09-25 | First issue. 86 FRs, 30 business rules, 9 data entities + seed, 21 mock endpoints (17 M06-owned), 40 E2E scenarios on 3 viewports, 10 SEC items. Live-session states L-1…L-13 specified in §8.3 (SOURCE-DERIVED / INFERRED). Traceability checked by script (§12.1). |

Conventions as in the URS §0: OBSERVED / SOURCE-DERIVED / INFERRED / UNVERIFIED / PROPOSED COPY / DV-M06-nn / SEC-M06-nn. Exact live copy is quoted; displayed casing is stated where CSS changes it.

### 0.1 Fidelity deviations referenced here

DV-M06-01 S4 counts from the S3/S2 pool, seed split PROPOSED (hub unchanged, live values) · DV-M06-03 visible icons (S1–S4, S8) · DV-M06-04 "Soalan Tracking A" computed from the sets (1,769, PROPOSED) · DV-M06-05 mock result computed from items · DV-M06-06 A/A+/B/B+ chip styles · DV-M06-07 header titles (S4, S6, S7, S9; S11–S13 in the admin shell) · DV-M06-08 S4/S11/S13 mobile layout and pending-chip size · DV-M06-09 readable active "Semua" tab · DV-M06-10 BM before BI on "Semua Subjek" (bahasa track) · DV-M06-11 = M01 DV-02 · DV-M06-17 content text ≥ 12px (XL-22). Replicated (not changed): DV-M06-02 (difficulty keys 2–5, withdrawn), -12 (tahun-lepas naming), -13 (S2 "Mula" text), -14 (number formats), -15 (copy), -16 (random Duta). Full table: URS §7.

## 1. Scope

The mock implementation covers S1–S13 of URS §1 and the session flows Q1–Q4 with dummy data behind a REST-shaped mock service layer (D1, D2). M06 owns the SPM configuration, the Tracking A set records, mock exams, the walkthrough simulation and the screens; questions and structured sets come from the M04 stores and quiz sessions, answers and structured attempts from the M05 store through their published contracts (D11, D12). AI walkthrough, Paper 2 marking and Duta picks are simulated (D4).

Out of scope: URS §8 (M05 quiz component internals and structured answer page, M04 report modal, M24 profiles, M25 notes centre, M07/M19 gating, shell widgets, real AI).

## 2. Screens & routes

| Route | Screen | Primary actor | Shell | Notes |
|---|---|---|---|---|
| `/spm` | S1 Mod SPM | Pelajar, Admin | user portal | |
| `/spm/tahun-lepas` | S2 Databank Soalan SPM | Pelajar, Admin | user portal | unknown query keys ignored |
| `/spm/tahun-lepas/:code/quiz` | Q1 databank quiz | Pelajar, Admin | user portal | `count` ∈ {5,10,20}; M05 quiz component |
| `/spm/latih-tubi` | S3 Latih Tubi SPM | Pelajar, Admin | user portal | |
| `/spm/latih-tubi/:code` | S4 Tetapan Kuiz | Pelajar, Admin | user portal | unknown code → 404 page |
| `/spm/latih-tubi/:code/quiz` | Q2 Latih Tubi quiz | Pelajar, Admin | user portal | `count`, `level?` (10\|11), `difficulty?` (2–5, as live); or `question_id` + `count=1` (M04 "Buka Soalan Sama", BR-M04-17) |
| `/spm/ramalan` | S5 Tracking A SPM | Pelajar, Admin | user portal | readiness card admin-only |
| `/spm/ramalan/:code` | S6 set list / Q3 set quiz | Pelajar, Admin | user portal | without `year`/`set` → S6; with `year=2026&set=n` → Q3; `BM`/`BI` → redirect to S7; unknown → 404 |
| `/latihan-berstruktur?scope=spm&track=bahasa` | S7 Tracking A Bahasa | Pelajar, Admin | user portal | M05 route, SPM variant: `subject_id`, `kbat_level`, `page` |
| `/spm/subjektif` | S8 Latihan Subjektif SPM | Pelajar, Admin | user portal | |
| `/latihan-berstruktur?scope=spm` | S9 Subjektif SPM | Pelajar, Admin | user portal | M05 route, SPM variant |
| `/latihan-berstruktur/:id/jawab?scope=spm[&track=bahasa]` | M05 answer page | Pelajar, Admin | user portal | M05; back link per `scope`/`track` |
| `/spm/history` | S10 Sejarah Kuiz SPM | Pelajar, Admin | user portal | `type` ∈ past_year, latih_tubi, ramalan; other values → all |
| `/spm-mock` | S11 SPM Mock Exam | Pelajar, Admin | role-based as live: admin shell for admin (header = page title, no subtitle, DV-M06-07); user portal for other roles (INFERRED) | |
| `/spm-mock/:id` | Q4 in-exam page (UNVERIFIED, L-8) | owner | role-based (as S11) | submitted mock → S12; not owner/unknown → 404 |
| `/spm-mock/:id/result` | S12 Result Mock SPM | owner | role-based (as S11) | unknown → 404; not submitted → Q4 |
| `/pusat-ai/spm` | S13 SPM Walkthrough | Pelajar, Admin | role-based (as S11) | |

Tab titles (exact): S1 "Mod SPM - PRESTASIPLUS", S2 "Databank Soalan SPM - PRESTASIPLUS", S3 "Latih Tubi SPM - PRESTASIPLUS", S4 "Latih Tubi SPM — {Subjek}", S5 "Tracking A SPM - PRESTASIPLUS", S6 "Tracking A SPM — {Subjek}", S7/S9 "Soalan Berstruktur - PRESTASIPLUS", S8 "Latihan Subjektif SPM - PRESTASIPLUS", S10 "Sejarah Kuiz SPM - PRESTASIPLUS", S11 "SPM Mock Exam", S12 "Result Mock SPM — {Subjek}", S13 "SPM Walkthrough — Cikgu Alesa", 404 "404 - Halaman Tidak Dijumpai | PRESTASIPLUS". Q1–Q4 titles are not captured (UNVERIFIED): Q1–Q3 use the M05 quiz component's title; Q4 uses "SPM Mock Exam".

## 3. Functional requirements

| ID | Requirement | FN | Traces |
|---|---|---|---|
| FR-M06-01 | S1 SHALL render the pill `fa-graduation-cap` "MOD SPM", h1 "Persediaan SPM" (gradient text, live size classes) and the lead of FN-M06-1.1.1. | 1.1.1 | US-01; AC-01.1 |
| FR-M06-02 | S1 SHALL render 4 stat cards "Jumlah Soalan", "Subjek SPM", "Tahun Tersedia", "Soalan Tracking A" with values from `GET /api/spm/overview` (BR-M06-01: 20,529 / 25 / 0 as live; Tracking A computed, 1,769 PROPOSED), `ms-MY` separators, colours amber/blue/green/purple, 2 columns (<768px) / 4 columns (≥768px). | 1.1.2 | US-01; AC-01.2 |
| FR-M06-03 | S1 SHALL render the four module cards of FN-M06-1.1.3–1.1.6 as whole-card links with icon tile, title, description, count chip ("{n} soalan" ×3, "{n} set subjektif") and "Mula" `fa-arrow-right`; 1 / 2 (`md`) / 4 (`lg`) columns; icons resolved per DV-M06-03. | 1.1.3, 1.1.4, 1.1.5, 1.1.6 | US-01; AC-01.3 |
| FR-M06-04 | S1 SHALL render "Prestasi SPM Anda" with the caller's SPM stats (BR-M06-20): sessions, average accuracy with 1 decimal + "%", coins, answered. | 1.1.7 | US-01; AC-01.4 |
| FR-M06-05 | S1 SHALL render button-link `fa-history` "Sejarah Kuiz SPM" → `/spm/history`. | 1.1.8 | US-01; AC-01.5 |
| FR-M06-06 | Every S2/S3/S4 count SHALL be a named query on the M04 dataset (`questionStore.spmPool` counts over the M04 `spmPool` facet, BR-M06-02), Tracking A counts SHALL be computed from the set records over that pool (BR-M06-08…11) and Subjektif counts from `structuredStore` (BR-M06-12); the hub values of BR-M06-01 are documented display constants (D11 exception, DV-M06-01). No count is stored separately. | 1.1.9 | US-02; AC-02.1, AC-02.2 |
| FR-M06-07 | The user-portal shell SHALL show section "SPM" with item "SPM" (`fa-graduation-cap`, amber pill "SPM") → `/spm` in the desktop sidebar and the mobile drawer, highlighted on every M06 screen. | 1.2.1 | US-03; AC-03.1, AC-03.2 |
| FR-M06-08 | Below 1024px the bottom nav SHALL include "SPM" → `/spm` (global bottom nav Home · SPM · Game · Topik · Chat · Lagi). | 1.2.2 | US-03; AC-03.2 |
| FR-M06-09 | The desktop user-portal sidebar SHALL list `fa-file-pen` "SPM Mock Exam" → `/spm-mock` under "💎 Killer Features". | 1.2.3 | US-03; AC-03.1 |
| FR-M06-10 | Header titles SHALL follow the shell rule DV-SH-03 (title from the route): S1, S2, S3, S5, S8, S10 keep their live title and live subtitle "Selamat datang kembali"; S4, S6, S7, S9 and S11–S13 show the DV-M06-07 title with no subtitle. S11–S13 keep the role-based shell as live (admin → admin shell; other roles → user portal, INFERRED). | 1.2.4 | US-03; AC-03.3, AC-01.1 |
| FR-M06-11 | The admin-panel shell SHALL show group "SPM" (collapsed by default) with "Databank Soalan", "Latih Tubi", "Tracking A", "Subjektif" (icons of FN-M06-1.2.5), the same four under "SPM" in the mobile "Lagi" sheet, and items "SPM Walkthrough" (Pusat AI) and "SPM Mock Exam" (Killer Features). | 1.2.5, 1.2.6, 1.2.7 | US-03; AC-03.4 |
| FR-M06-12 | Every M06 route SHALL require a session; without one the client SHALL go to `/login` (M01 FR-M01-14). | 1.3.1 | US-04; AC-04.1 |
| FR-M06-13 | Unknown subject codes on S4/S6 and unknown or foreign mock ids on Q4/S12 SHALL render the global 404 page (M01; "Mula Latihan" → `/practice`, DV-M06-11). | 1.3.2 | US-04; AC-04.2 |
| FR-M06-14 | M06 SHALL NOT show any premium gate (as observed; URS OQ-M06-02). | 1.3.3 | US-04; AC-04.3 |
| FR-M06-15 | S11, S12 and S13 SHALL each render one Duta card from `GET /api/duta/recommendations` (M24): initials, name, tagline, star icon, pills "🥇 Duta Bintang", "📚 {subject}", "📍 {state}", "⭐ {rating}", link `/bilik-duta/{slug}`; pick per BR-M06-27. | 1.4.1 | US-23; AC-23.1, AC-23.2 |
| FR-M06-16 | S2 SHALL render "Kembali ke Mod SPM" → `/spm`, h1 `fa-database` "Databank Soalan SPM", sub "Pilih subjek dan mula jawab dari bank soalan". | 2.1.1 | US-05; AC-05.1 |
| FR-M06-17 | S2 SHALL render the 18 databank subjects in the order of BR-M06-06, each card with icon tile, name, English name and "{n} soalan dalam databank" (`ms-MY`); cards are not links; 1 / 2 (`md`) / 3 (`lg`) columns. | 2.1.2 | US-05; AC-05.1, AC-05.2 |
| FR-M06-18 | Each S2 card SHALL render "Pilih set:" + links "5", "10", "20" → `/spm/tahun-lepas/{CODE}/quiz?count=…` and a plain amber "Mula" text (not interactive). | 2.1.3, 2.1.4 | US-05; AC-05.2 |
| FR-M06-19 | S2 SHALL ignore every query parameter. | 2.1.5 | US-05; AC-05.3 |
| FR-M06-20 | Q1 SHALL mount the M05 `<PracticeQuiz>` (M05 §7.1) with `start = {mode:'past_year', subjectCode, count}`, `headerTitle` = subject name, the M05 Q1 label set (PROPOSED COPY, M05 §8.3), `backUrl` S2, `retry:'restart'`, `report = {source:'spm'}` (M04 `ReportQuestionModal`, FR-M04-118); the session is created by M05 §7 #4 from the SPM pool (BR-M06-05). Count ∉ {5,10,20} → 422 → back to S2 (BR-M06-13). | 2.2.1, 2.2.2 | US-06; AC-06.1 |
| FR-M06-21 | Finishing Q1 SHALL complete the session through M05 §7 #6 (BR-31, BR-M06-15): totals, QuizAnswer rows, revision queue, mastery, trial counter and wallet; coins = correct (BR-M06-19); the session then appears on S10, in S1/S10 stats and on M05 `/practice/history`. | 2.2.3 | US-06; AC-06.2 |
| FR-M06-22 | S3 SHALL render "Kembali ke Mod SPM", h1 `fa-brain` "Latih Tubi SPM", sub "Pilih subjek untuk mula berlatih (Tingkatan 4 & 5)", sections `fa-crown` "Subjek Teras ({n})" and `fa-puzzle-piece` "Subjek Elektif ({n})" in the order of BR-M06-06. | 3.1.1, 3.1.2 | US-07; AC-07.1 |
| FR-M06-23 | Each S3 card SHALL link to `/spm/latih-tubi/{CODE}` and show icon tile, name, English name, `fa-brain` "{n} soalan" (n = the subject's databank-pool count, same as S2; BR-M06-02), target chip `fa-bullseye` "Target {SPM\|Custom\|Latihan}: {n}" when a target exists, and `fa-chevron-right`. | 3.1.3, 3.1.4 | US-07; AC-07.2 |
| FR-M06-24 | A subject with count < target SHALL render as the locked card (BR-M06-03; live: Bahasa Arab "Locked: 0/40"): amber styling, `fa-lock` "Locked: {count}/{target}", `fa-lock` icon, `href="javascript:void(0)"`, `pointer-events-none`; S4 remains reachable and shows the same count (FR-M06-25). | 3.1.5 | US-07; AC-07.3 |
| FR-M06-25 | S4 SHALL render "Kembali" → `/spm/latih-tubi`, icon tile (glyph resolved per DV-M06-03), h1 subject name, "{total} soalan tersedia" (total = the S3/S2 pool count, DV-M06-01) [+ " · " + "Target {Type} set: {n} soalan"], card `fa-cog` "Tetapan Kuiz"; data from `GET /api/spm/latih-tubi/:code`. | 3.2.1, 3.2.2, 3.2.3 | US-08; AC-08.1 |
| FR-M06-26 | S4 "Tingkatan" SHALL render "Tingkatan 4"/"Tingkatan 5" with "{n} soalan" (`ms-MY`; level counts of the same pool, summing to the total); click sets `selectedLevel` 10/11, clicking the selected one clears it; selected style `border-blue-500 bg-blue-50 shadow-md`. | 3.2.4 | US-08; AC-08.2 |
| FR-M06-27 | S4 "Tahap Kesukaran" SHALL render "Asas", "Pertengahan", "Sukar", "Sangat Sukar" bound to difficulty keys 2, 3, 4, 5 (as live; DV-M06-02 withdrawn) with "{n} soalan" (no separators), toggle selection, selected colours green/yellow/orange/red, helper "Biarkan kosong untuk campuran semua tahap"; 2 per row below 640px, 4 from 640px (DV-M06-08). | 3.2.5 | US-08, US-24; AC-08.3, AC-08.5, AC-24.3 |
| FR-M06-28 | Difficulty counts SHALL read `difficultyByLevel[level][k]` with a Tingkatan selected and `difficultyStats[k]` otherwise, for k = 2…5 (0 when absent). | 3.2.9 | US-08; AC-08.4 |
| FR-M06-29 | For a subject with a target, "Bilangan Soalan" SHALL offer only "{n} (Target {SPM\|Custom\|Latihan})", selected by default (emerald unselected / blue selected), helper "Set penuh target {spm\|custom\|latihan} untuk {Subjek} disasar pada {n} soalan.". | 3.2.6 | US-09; AC-09.1 |
| FR-M06-30 | For a subject without a target, "Bilangan Soalan" SHALL offer 5, 10, 20, 30, 40, 50, 60 (default 10) with helper "Pilih bilangan soalan ikut keperluan latihan anda.". | 3.2.8 | US-09; AC-09.2 |
| FR-M06-31 | "Mula Kuiz" (`fa-play-circle`) SHALL be a link whose href is `/spm/latih-tubi/{CODE}/quiz?count={questionCount}` + `&level={10\|11}` when set + `&difficulty={2..5}` when set, updated on every change. | 3.2.7 | US-09; AC-09.3 |
| FR-M06-32 | Q2 SHALL mount the M05 `<PracticeQuiz>` (M05 §7.1) with `start = {mode:'latih_tubi', subjectCode, count, levelId?, difficulty?}` (from the query string), `headerTitle` = subject name, M05 Q1 labels, `backUrl` S4, `report = {source:'spm'}` (M04 `ReportQuestionModal`, FR-M04-118). | 3.3.1 | US-10; AC-10.1 |
| FR-M06-33 | When fewer pool questions match than `count`, the session SHALL contain all matching ones; with none, M05 §7 #4 returns 422 `NO_QUESTIONS` and `<PracticeQuiz>` emits `start-error`; M06 shows the §8 message (PROPOSED COPY) with a link back to S4. | 3.3.2 | US-10; AC-10.2 |
| FR-M06-34 | Finishing Q2 SHALL complete the session through M05 §7 #6 (BR-31) as FR-M06-21. | 3.3.3 | US-10; AC-10.3 |
| FR-M06-35 | S5 SHALL render "Kembali ke Mod SPM", h1 `fa-hat-wizard` "Tracking A SPM", pill "TRACKING A", sub "Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!". | 4.1.1 | US-11; AC-11.1 |
| FR-M06-36 | S5 SHALL render the objective and bahasa lane cards of FN-M06-4.1.2/4.1.3 with counts per BR-M06-10 (labels upper case by CSS). | 4.1.2, 4.1.3 | US-11; AC-11.2 |
| FR-M06-37 | S5 SHALL render one card per open objective subject (BR-M06-09) → `/spm/ramalan/{CODE}` with the chips of FN-M06-4.1.10 under their conditions and footer "Pilih Set". | 4.1.10 | US-11; AC-11.3 |
| FR-M06-38 | S5 SHALL render the "Admin Readiness" card (heading, text, three summary chips = sums over the tiles) only when the caller is an admin. | 4.1.4 | US-12; AC-12.1, AC-12.4 |
| FR-M06-39 | The readiness card SHALL contain one tile per subject with a target (BR-M06-11 order) with h3, "{CODE} · Target set: {n} soalan", badge "{bersih}/{total} set bersih", and mini stats Set Bersih, Bank Besar, Locked, Readiness "{p}%" (BR-M06-11). | 4.1.5, 4.1.6 | US-12; AC-12.2 |
| FR-M06-40 | A tile SHALL show "Set Masih Lock" with the first 6 locked sets as "2026 Set {n} · {ready}/{target}" only when Locked > 0, and the bank-besar note only when Bank Besar > 0. | 4.1.7, 4.1.8 | US-12; AC-12.3 |
| FR-M06-41 | S5 SHALL render the bahasa section of FN-M06-4.1.9 with BM and BI cards whose "{n} set" is the count of SPM structured sets of that subject (BR-M06-12) and links to S7. | 4.1.9 | US-13; AC-13.1 |
| FR-M06-42 | `/spm/ramalan/BM` and `/spm/ramalan/BI` SHALL redirect (replace) to `/latihan-berstruktur?subject_id=1\|2&scope=spm&track=bahasa`. | 4.2.7 | US-13; AC-13.2 |
| FR-M06-43 | With `scope=spm&track=bahasa` the structured list SHALL render the S7 header and info card of FN-M06-4.4.1/4.4.2; "{n} set ditemui" = the filtered total. | 4.4.1, 4.4.2 | US-13; AC-13.3 |
| FR-M06-44 | The S7 filter SHALL be a GET form with hidden `scope=spm`, `track=bahasa`, "Subjek" limited to Semua Subjek / Bahasa Melayu / Bahasa Inggeris, "Aras KBAT" (Semua, 1–6) and "Cari"; controls reflect the query. | 4.4.3 | US-13; AC-13.4 |
| FR-M06-45 | S7 SHALL render the M05 set cards (FN-M06-4.4.4) from M05 §7 #15 (`scope=spm&track=bahasa`, M04 `structuredStore`) with "Mula" → `/latihan-berstruktur/{id}/jawab?scope=spm&track=bahasa`; with no subject, BM sets precede BI sets (DV-M06-10, BR-M06-12). | 4.4.4, 4.4.5 | US-13; AC-13.5, AC-13.6 |
| FR-M06-46 | S7 and S9 SHALL use the shared Laravel-style pager (§8.1), 20 per page, links keeping `subject_id`, `scope`, `track`, `kbat_level`. | 4.4.6, 5.2.5 | US-13, US-17, US-24; AC-13.7, AC-17.2, AC-24.4 |
| FR-M06-47 | `/latihan-berstruktur/{id}/jawab?scope=spm[&track=bahasa]` SHALL mount the M05 `<StructuredAnswer>` (M05 §7.1) with `setId`, `scope:'spm'`, `track` ('bahasa' or null) and `backUrl` = S7 (`track=bahasa`) or S9 (`/latihan-berstruktur?subject_id={id}&scope=spm`); submitting posts M05 §7 #17 and stores a StructuredAttempt with `scope`/`track`. | 4.4.7 | US-13; AC-13.8 |
| FR-M06-48 | S6 SHALL render "Kembali" → `/spm/ramalan`, icon tile, h1, sub "Tracking A SPM" [+ " · Target {SPM\|Latihan} set: {n} soalan"] and the summary chips of FN-M06-4.2.2 under their conditions. | 4.2.1, 4.2.2 | US-14; AC-14.1, AC-14.3 |
| FR-M06-49 | S6 SHALL render h2 `fa-calendar` "Tracking A 2026" and the set cards of FN-M06-4.2.4/4.2.5 (status per BR-M06-08), startable first then locked, each by set number; startable cards link to `?year=2026&set={n}`, locked cards are inert. | 4.2.3, 4.2.4, 4.2.5 | US-14; AC-14.2, AC-14.3, AC-14.4, AC-14.6 |
| FR-M06-50 | A subject with no sets SHALL show the zero chips and the empty block "Belum Ada Set Tracking A" / "Set Tracking A untuk subjek ini akan ditambah tidak lama lagi.". | 4.2.6 | US-14; AC-14.5 |
| FR-M06-51 | Q3 SHALL mount the M05 `<PracticeQuiz>` (M05 §7.1) with `start = {mode:'ramalan', subjectCode, year:2026, setNo}`, `headerTitle` = subject name, M05 Q1 labels, `backUrl` S6, `report = {source:'spm'}` (M04 `ReportQuestionModal`, FR-M04-118); the session holds the set's questions (BR-M06-14). | 4.3.1 | US-15; AC-15.1 |
| FR-M06-52 | Starting a Belum Cukup or unknown set SHALL be refused by M05 §7 #4 with 422 `SET_NOT_READY` / 404 (M06 rule BR-M06-13, INFERRED); the client SHALL replace the URL with `/spm/ramalan/{CODE}` and no session is created. | 4.3.2 | US-15; AC-15.2 |
| FR-M06-53 | Finishing Q3 SHALL complete the session through M05 §7 #6 (BR-31) as FR-M06-21. | 4.3.3 | US-15; AC-15.3 |
| FR-M06-54 | S8 SHALL render "Kembali ke Mod SPM", h1 "Latihan Subjektif SPM", its sub and the info box of FN-M06-5.1.2. | 5.1.1, 5.1.2 | US-16; AC-16.1 |
| FR-M06-55 | S8 SHALL render the 4 stat cards (labels upper case by CSS) with the caller's subjective stats (BR-M06-18); "Skor Terbaik" = "Belum Ada" when no attempt. | 5.1.3, 5.2.8 | US-16, US-17; AC-16.2, AC-17.4 |
| FR-M06-56 | S8 tabs "Semua", "Teras", "Elektif" with count pills SHALL switch the grid client-side (default Semua); active Semua `bg-slate-900` + white text (DV-M06-09), Teras `bg-teal-600`, Elektif `bg-amber-500`. | 5.1.4, 5.1.6 | US-16; AC-16.3 |
| FR-M06-57 | S8 cards SHALL link to `/latihan-berstruktur?subject_id={id}&scope=spm` with icon, name, badge "Teras"/"Elektif", English name and `fa-pen` "{n} set subjektif" (BR-M06-12), ordered Teras A–Z then Elektif A–Z. | 5.1.5 | US-16; AC-16.4 |
| FR-M06-58 | With `scope=spm` (no `track`) the structured list SHALL render the S9 header and a filter with the 15 SPM subjects (URS FN-M06-5.2.2 order), KBAT 1–6 and hidden `scope=spm`. | 5.2.1, 5.2.2 | US-17; AC-17.1 |
| FR-M06-59 | S9 SHALL render the set cards from M05 §7 #15 (`scope=spm`) with "Mula" → `/latihan-berstruktur/{id}/jawab?scope=spm`. | 5.2.3, 5.2.4 | US-17; AC-17.2 |
| FR-M06-60 | With no matching set S9 SHALL show "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" and no pager. | 5.2.6 | US-17; AC-17.3 |
| FR-M06-61 | S8 stats SHALL be computed from the caller's M05 StructuredAttempts with `scope = 'spm'` (BR-M06-18), so a submitted attempt (FR-M06-47) updates them. | 5.2.7 | US-17; AC-17.4 |
| FR-M06-62 | S10 SHALL render "Kembali ke Mod SPM", h1 "Sejarah Kuiz SPM" and 4 stats (all types, filter-independent, BR-M06-20): "Sesi Kuiz", "Purata Ketepatan", "Jumlah Syiling", "Soalan Dijawab". | 8.1.1, 8.1.2 | US-18; AC-18.1, AC-18.3 |
| FR-M06-63 | S10 SHALL render filter links "Semua", "Tahun Lepas", "Latih Tubi", "Tracking A" with `?type=` values of FN-M06-8.1.3; the active one is `bg-{indigo\|amber\|blue\|purple}-500 text-white shadow-md` respectively, the others white with a slate border and `hover:border-{colour}-400` (OBSERVED); with an unknown `type` no filter is active. | 8.1.3 | US-18; AC-18.1, AC-18.3, AC-18.6 |
| FR-M06-64 | S10 rows SHALL come from M05 §7 #23 `GET /api/practice/sessions?modes=past_year,latih_tubi,ramalan&type={type}` (caller's completed SPM sessions; all rows when `type` is absent or unknown, `activeType` null), newest first, with score tile, type badge, "{c}/{n} betul", "{d MMM yyyy, hh:mm A} · {m}m {s}s" (English month abbreviations, as live) and "+{coins} 🪙"; rows are not links. | 8.1.4 | US-18; AC-18.2, AC-18.6 |
| FR-M06-65 | With no row S10 SHALL show the empty block of FN-M06-8.1.5. | 8.1.5 | US-18; AC-18.4 |
| FR-M06-66 | Score tiles SHALL be red (`bg-red-100 text-red-600`) below 50%, yellow 50–79%, green ≥80% (INFERRED); "Tracking A" badge purple (INFERRED). | 8.1.6 | US-18; AC-18.5 |
| FR-M06-67 | S11 SHALL render the hero, the Duta block title and text (FN-M06-6.1.2) with one Duta card, and the warning box of FN-M06-6.1.3. | 6.1.1, 6.1.2, 6.1.3 | US-19; AC-19.1 |
| FR-M06-68 | S11 SHALL render the form of FN-M06-6.1.4 (labels upper case by CSS) with native `required` on both selects; fields side by side (2fr / 1fr) from 640px and stacked below (DV-M06-08). | 6.1.4 | US-19, US-24; AC-19.2, AC-24.2 |
| FR-M06-69 | Submitting without a subject SHALL be stopped by the browser's required check (no request). | 6.2.1 | US-19; AC-19.3 |
| FR-M06-70 | S11 SHALL list the caller's mocks newest first (FN-M06-6.1.6/6.1.7) with relative time (BR-M06-29), score "Score: {a}/{b} ({p}%)" (2 decimals), grade chip classes per BR-M06-25 (DV-M06-06), the pending chip "Belum" at 0.85rem, and "Sambung →"/"Lihat →"; below 640px chip and link sit on their own line (DV-M06-08). | 6.1.5, 6.1.6, 6.1.7 | US-19, US-24; AC-19.4, AC-19.5, AC-24.2 |
| FR-M06-71 | "🎯 Jana Mock SPM" SHALL call `POST /api/spm-mocks` `{subject, paperNumber}` and navigate to `/spm-mock/{id}`; the new mock is listed on S11 as in progress. | 6.2.2 | US-20; AC-20.1 |
| FR-M06-72 | (provisional, UNVERIFIED — L-8) Q4 SHALL render a neutral placeholder: the title "{Subjek} · Paper {n}", the mock's items each with an answer input, and one submit button (PROPOSED COPY "Hantar"). Item count, layout and copy are to be replaced after L-8. | 6.2.3 | US-20; AC-20.1, AC-20.4 |
| FR-M06-73 | (provisional, UNVERIFIED — L-8) Q4 SHALL show a timer placeholder derived from the mock's `createdAt`; its direction, time limit and any auto-submit are not specified (URS OQ-M06-05) and SHALL NOT be asserted by tests beyond "a timer element is visible and has no pause control". | 6.2.4 | US-20; AC-20.2 |
| FR-M06-74 | Submitting Q4 SHALL call `POST /api/spm-mocks/:id/submit`; the mock grades it (BR-M06-24; Paper 2 by the simulated marker, D4), stores the answers in the MockExam items only (no M05 session, QuizAnswer, queue, mastery or wallet write — §6.5 decision) and the client goes to S12. | 6.2.5 | US-20; AC-20.3, AC-20.4 |
| FR-M06-75 | S12 SHALL render the hero with h1 "{Subjek} · Paper {n}", grade, "{p}%", "{score} / {max} markah" and the hero class by grade band (BR-M06-24). | 6.3.1 | US-21; AC-21.1, AC-21.6 |
| FR-M06-76 | S12 SHALL render the Duta block "🎓 Cikgu Pakar {Subjek}" / "Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ next round." with a subject-matched card when available. | 6.3.2 | US-21; AC-21.2 |
| FR-M06-77 | S12 SHALL render "📉 Topik Lemah — Fokus Belajar Ke Sini" with the wrong-item counts per topic, sorted by count desc then topic name (DV-M06-05), and the tip with link "jana nota ringkas" → `/pusat-nota-ringkas`; hidden when there is no wrong item (INFERRED). | 6.3.3 | US-21; AC-21.3 |
| FR-M06-78 | S12 SHALL render "📋 Review Setiap Soalan" with every item (`.correct` green "✓" / `.wrong` red "✗"), header "Soalan {n} · {m}/{max} markah" upper-cased by CSS (`.q-review .num`), question, "**Anda:**" answer or "(tiada jawapan)", "**Jawapan:**" model answer, italic feedback. | 6.3.4, 6.3.6 | US-21; AC-21.4, AC-21.6 |
| FR-M06-79 | S12 SHALL render "📝 Mock Lain" → `/spm-mock` and "📚 Belajar Topik Lemah" → `/pusat-nota-ringkas`. | 6.3.5 | US-21; AC-21.5 |
| FR-M06-80 | S13 SHALL render h1, text and the form of FN-M06-7.1.2: `subject` with native `required` (no `novalidate`), `year` with `maxlength="8"`, `question_text` and `image` not required; labels upper case by CSS; "Subjek" / "Tahun (opsyen)" side by side from 640px, stacked below (DV-M06-08); and the hidden result card. | 7.1.1, 7.1.2 | US-22, US-24; AC-22.1, AC-24.2 |
| FR-M06-81 | The upload label SHALL open the hidden `image` input (`accept="image/*"`, drag and drop onto the label allowed); choosing a file sets the label to "📎 {filename}". | 7.1.3 | US-22; AC-22.2 |
| FR-M06-82 | On a valid submit "Bagi Walkthrough" SHALL `preventDefault`, disable itself with "AI sedang fikir... (mungkin 15-30s)", hide `#result`, send FormData (`subject`, `year`, `question_text`, `image`) to `POST /api/spm-walkthrough/solve`, and finally re-enable with "Bagi Walkthrough". | 7.1.4 | US-22; AC-22.3 |
| FR-M06-83 | On `{ok:true}` S13 SHALL set `#walkBody` (a `<pre>`, whitespace kept) to `walkthrough \|\| ''` as text (no HTML), show `#result` (h2 "✨ Walkthrough Cikgu Alesa") and smooth-scroll to it. | 7.1.5 | US-22; AC-22.3 |
| FR-M06-84 | On `{ok:false}` S13 SHALL `alert(error \|\| 'Ralat')`; on a network error `alert('Ralat: ' + message)`. | 7.1.6 | US-22; AC-22.4 |
| FR-M06-85 | S13 SHALL render the Duta block "🎓 Cikgu Maestro SPM" / "Setelah baca walkthrough, tonton video penjelasan dari Duta SPM." with one card. | 7.1.7 | US-22; AC-22.1 |
| FR-M06-86 | Every M06 screen SHALL follow §10 at 375, 768 and 1280px with no horizontal page scroll, and no content text SHALL render below 12px (DV-M06-17). | all screen FNs | US-24; AC-24.1, AC-24.2, AC-24.3, AC-24.5 |
| FR-M06-87 | Q2 opened with `question_id={id}&count=1` SHALL mount the M05 `<PracticeQuiz>` (M05 §7.1) with `start = {mode:'latih_tubi', subjectCode, count:1, targetQuestionId:id}`; M05 §7 #4 resolves it with `questionStore.getEligible(id)` and requires an SPM-pool question of the subject; the target-count rule does not apply; an inactive (e.g. 136891), unknown or foreign-subject id returns 422 and the client goes back to S4 (INFERRED, L-3; cross-ref M04 BR-M04-17, FR-M04-114). | 3.3.4 | US-10; AC-10.4 |
| FR-M06-88 | An S13 submit with an empty "Subjek" SHALL be blocked by the browser's native required check before the script runs: no busy label, no request, no alert, previous result unchanged. | 7.1.2 | US-22; AC-22.5 |
| FR-M06-89 | The S2–S4 pool SHALL follow the M04 store: a question an admin creates (approved, active, MCQ, T4/T5, SPM subject) enters it and one deactivated or archived leaves it at once, changing S2/S3/S4 counts and the questions served by Q1–Q3 (M04 FR-M04-113); the hub constants do not change. | 1.1.9 | US-02; AC-02.2 |


## 4. Business rules

| ID | Rule | Source |
|---|---|---|
| BR-M06-01 | Hub values mirror observation (CLAUDE.md §6). "Jumlah Soalan" 20,529 and the chips "Databank Soalan" 14,673 and "Latih Tubi SPM" 14,673 are **documented display constants** (D11 exception clause, XL-34; DV-M06-01): no named query on the dataset reproduces them (Σ `spmPool` = 21,033; no other observed attribute defines them), they sit outside the dataset fit, store changes do not move them, and they are never shown next to a contradicting computed figure — S1 shows only these constants, 25, 0, 1,769 and 4,059, and both chips are ≤ the total (E2E-M06-03). Derived: "Subjek SPM" = number of M03 subjects linked to level 10 or 11 (25, verified); "Tahun Tersedia" = distinct `year` values among SPM-pool questions (0); "Soalan Tracking A" (stat and chip) = Σ `readyCount` of all 2026 sets (1,769; live 1,797 — DV-M06-04, PROPOSED); "Subjektif" chip = `structuredStore` student-visible total (4,059, as live). | OBSERVED + DV-M06-01/04 + D11 |
| BR-M06-02 | S2, S3 and S4 read one pool per subject: `questionStore.spmPool({subjectId})`, i.e. eligible rows carrying the M04 `spmPool` facet (M04 §6.13.1, BR-M04-32; exact cells = the observed pool sizes, Σ 21,033). S2 "soalan dalam databank" = S3 card count (as live, 18/18; BA 0) = S4 "{n} soalan tersedia" (DV-M06-01); S4 Tingkatan counts = `spmPool` counts per level; difficulty counts = per difficulty 1–5 (S4 shows 2–5). Rows created/approved at T4/T5 in M04 take the facet value M04 specifies (FR-M06-89 relies on `true`, INFERRED, M04 OQ); deactivations leave the pool at once. | OBSERVED (S2 = S3) + DV-M06-01 + D11/D12 |
| BR-M06-03 | Latih Tubi lock: a subject with a target is locked on S3 when its pool count < target (live: BA 0 < 40); S4 and Q2 stay reachable and show the same count. | OBSERVED |
| BR-M06-04 | Target per subject (type · size): custom · 34 BM, custom · 36 BI; spm · 40 MATH, SCI, SEJ, GEO, BIO, CHEM, PHY; latihan · 40 PI, PM, EKON, BA, PSI; latihan · 20 ADDMATH; none PERNIAGA, AKAUN, PSV, TI. With a target the Latih Tubi count is fixed to the size; without, 5/10/20/30/40/50/60 (default 10). | OBSERVED |
| BR-M06-05 | Databank quiz: `count` questions picked at random without repeats from `questionStore.query({subjectId, educationLevelIds:[10,11], limit:count, seed})` (the SPM pool), fewer if the pool is smaller. | OBSERVED ("dipaparkan secara rawak") / INFERRED (sampling) |
| BR-M06-06 | Orders: S2 BM, BI, MATH, SCI, SEJ, BIO, EKON, PHY, GEO, CHEM, ADDMATH, PI, PM, PSV, PSI, PERNIAGA, AKAUN, TI; S3 Teras BM, BI, MATH, SCI, SEJ, PI, PM; Elektif GEO, BIO, CHEM, PHY, PERNIAGA, AKAUN, EKON, ADDMATH, PSV, BA, TI, PSI (fixed display order stored on the SPM subject config). | OBSERVED |
| BR-M06-07 | Latih Tubi quiz filter: questions of the subject with `level` = 10/11 when given and `difficulty` = 2–5 when given (site-wide 1–5 scale; key 1 only in the unfiltered mix, D10); `count` must equal the target when a target exists, else be one of the 7 options (else 422) — **except** the single-question form `question_id={id}&count=1` (M04 BR-M04-17), which is always allowed for a question of that subject. | OBSERVED (URL, `@click` keys 2–5; M04 link) / INFERRED (validation) |
| BR-M06-08 | Tracking A set status: `size` = subject target ?? 40; `belum_cukup` when `readyCount` < `size`; `bank_besar` when `bankSource` > `size`; otherwise `bersih`. Startable = bersih or bank_besar. DSKP line "DSKP: {dskpTagged}/{dskpTotal} ({round(p)}%)" with `dskpTotal` = `bankSource` ?? `readyCount`. | OBSERVED (all live sets fit) / INFERRED (formula) |
| BR-M06-09 | Open objective subject (S5 card) = subject with ≥1 startable 2026 set, excluding BM/BI. Card: "{Σ readyCount of startable sets} soalan kuiz siap guna"; "{n} bank besar" when > 0; "{n} set bersih" and "Target {Type}: {size}" only when the subject has a target and the count > 0; "Bank source: {Σ bankSource}" when a bank-besar set exists; "{startable sets} set". Order: subject display order of S3. | OBSERVED (GEO, AKAUN, PSI cards) / INFERRED (conditions) |
| BR-M06-10 | Objective lane: "{open subjects} subjek", "{Σ startable sets} set", "{Σ over startable sets of (bankSource ?? readyCount)} soalan" (GEO 67 + AKAUN 640 + PSI 40 = 747). Bahasa lane: "2 subjek", "{BM + BI SPM structured sets} set". | OBSERVED arithmetic (DV-M06-04) |
| BR-M06-11 | Readiness (admin): tiles = subjects with a target in the order BM, BI, MATH, SCI, SEJ, PI, PM, ADDMATH, PHY, CHEM, BIO, GEO, BA, EKON, PSI; per tile bersih / bank besar / locked counts of its 2026 sets, total = all its sets, readiness = round((bersih + bank besar) / total × 100) (0 when total = 0); summary chips = sums over tiles. | OBSERVED (values, 10% / 17%) |
| BR-M06-12 | SPM structured sets = `structuredStore.query({subjectId?, kbatLevel?, scope:'spm', track?})` (M04 FR-M04-115: published, active T4/T5; 4,059 student-visible) of the 15 subjective subjects; S8 counts and S7 "set ditemui" are its counts per subject. Default list order: M05 list order (M04 BR-M04-26), except on `track=bahasa` without a subject where BM (id 1) sets come before BI (id 2) (DV-M06-10). | OBSERVED (counts) + DV-M06-10 + D12 |
| BR-M06-13 | Session start goes through M05 §7 #4 (`POST /api/practice/sessions`) with the M06 rules: `past_year` needs `count` ∈ {5,10,20}; `latih_tubi` per BR-M06-07; `targetQuestionId` resolves through `questionStore.getEligible(id)` and must be an SPM-pool question of the subject, else 422 → S4; `ramalan` needs a startable set (a Belum Cukup set is refused — INFERRED, L-5). Unknown subject → 404. The session stores the served question ids (M05 DATA-M05-01). | OBSERVED (routes) / INFERRED |
| BR-M06-14 | Tracking A session questions: `bersih` → the set's `readyCount` questions in set order; `bank_besar` → the first `size` of its bank by `priority` ("Sistem tetap ambil 40 soalan ikut prioriti semasa"). | OBSERVED (copy) / INFERRED |
| BR-M06-15 | Answer check and completion are M05 §7 #5 and #6; completion applies the M05 BR-31 write contract (session totals, QuizAnswer rows, revision queue BR-14, SubjectMastery BR-20, trial counter BR-07, M14 wallet) and returns `{score, total, gamification}`. | M05 BR-31 (D12) |
| BR-M06-16 | Report from Q1–Q3 = M04 `ReportQuestionModal` (FR-M04-118) with `variant:'mcq'`, `source:'spm'`, `quizSessionId`; the question is an M04 row, so M04 BR-M04-11/12 (queue, auto-deactivation) apply and a deactivated question leaves the SPM pool. | SOURCE-DERIVED (M04 discovery §2.14) + D12 |
| BR-M06-17 | Structured answer pages opened with `scope=spm` post M05 §7 #17 and save a StructuredAttempt with `scope = 'spm'` and `track` (M05 DATA-M05-06). | INFERRED |
| BR-M06-18 | Subjective stats (S8): sets answered = number of submitted `scope:'spm'` attempts; subjects tried = distinct subjects among them; best score = max attempt percentage, shown "{p}%" rounded (INFERRED format) or "Belum Ada"; best sets saved = distinct sets with ≥1 submitted attempt. | OBSERVED (labels, empty) / INFERRED |
| BR-M06-19 | Session record (M05 fields, §6.4 map): `correctCount`, `questionCount`, `timeSpent`, `coinsEarned` = `correctCount` (OBSERVED: 4 rows), accuracy = correctCount / questionCount. | OBSERVED + M05 DATA-M05-01 |
| BR-M06-20 | SPM stats (S1, S10): sessions = count of the caller's SPM sessions (all types); "Purata Ketepatan" = mean of per-session accuracy × 100, 1 decimal (admin: (0 + 20 + 32.35 + 35) / 4 = 21.8); coins = Σ coins; answered = Σ total. Mock exams and subjective attempts are not included. | OBSERVED (arithmetic) |
| BR-M06-21 | History row: percentage = round(accuracy × 100); type label `past_year` "Tahun Lepas" (amber), `latih_tubi` "Latih Tubi" (blue), `ramalan` "Tracking A"; date `d MMM yyyy, hh:mm A` (English, Asia/Kuala_Lumpur); duration "{m}m {s}s". `type` absent → all rows, "Semua" active; unknown `type` → all rows, no filter active. | OBSERVED (except Tracking A row) |
| BR-M06-22 | Mock generation (UNVERIFIED, L-8): items are M04 questions — Paper 1 from `questionStore.query` on the subject's SPM pool, Paper 2 from `structuredStore.query({subjectId})`. Live mock 16 (BM Paper 1) has max 30 marks at 1 mark per objective item; the prototype placeholder uses 30 objective items of 1 mark for Paper 1 and 6 structured items of 10 marks for Paper 2 (PROPOSED values, OQ-M06-05). Each item keeps a topic and a model answer. Subject values are the S11 option values. | OBSERVED (30 marks) / UNVERIFIED |
| BR-M06-23 | Mock timer (UNVERIFIED, L-8): the mock stores `createdAt`; the mock stays `in_progress` until submitted (live mock 317 is still "Belum submit" after 2 months, so nothing server-side closes it). Timer direction, time limit, auto-submit and pause penalty are not specified (OQ-M06-05). | OBSERVED (mock 317) / UNVERIFIED |
| BR-M06-24 | Mock grading: P1 item mark = 1 when the answer equals the key; P2 item mark from the simulated marker (§6.12); score = Σ marks; max = Σ max marks; percent = score / max × 100 (2 decimals). Grade (INFERRED bands): A+ ≥90, A ≥80, B+ ≥70, B ≥60, C ≥50, D ≥45, E ≥40, G <40. Hero class: green (A+, A, B+, B), `mid` yellow (C, D, E), `bad` red (G). Weak topics = wrong items (mark < max) grouped by topic, count desc then name. | OBSERVED (G at 0%, red, classes) / INFERRED (bands, thresholds) |
| BR-M06-25 | Grade chip classes: A+ and A emerald, B+ and B blue (live rules invalid, DV-M06-06), C amber, D, E, G red, pending "Belum" slate at 0.85rem (live overridden to 1.5rem by `.sm-card .grade`, DV-M06-08). | OBSERVED (CSS) + DV-M06-06/08 |
| BR-M06-26 | Mock access: only the owner opens Q4/S12 (others → 404); a submitted mock's Q4 URL goes to S12; an unsubmitted mock's S12 URL goes to Q4. | INFERRED (SEC-M06-08) |
| BR-M06-27 | Duta pick: random among active `bintang`-tier ambassadors; on S12 an ambassador whose subject equals the mock subject is preferred when one exists; the mock uses a seedable PRNG. | OBSERVED (varies per load; subject match on one S12 load) / INFERRED (preference) |
| BR-M06-28 | Walkthrough (simulated, D4): an empty subject never reaches the server (native `required`). The mock waits `walkthroughLatency` (default 1,500 ms) and returns `{ok:true, walkthrough}` from the canned text of the subject (§6.12) with the question text echoed in the first line; returns `{ok:false, error:"Sila masukkan soalan atau muat naik gambar soalan."}` (PROPOSED COPY) when neither `question_text` nor `image` is given, and the `failNext` payload when set. | SOURCE-DERIVED (response shape, `required`) / INFERRED |
| BR-M06-29 | Relative time on S11 uses Laravel `diffForHumans` in Malay ("{n} bulan yang lepas", "{n} hari yang lepas", …) as M04 BR-M04-16. | OBSERVED (samples) |
| BR-M06-30 | Readiness card visibility: role `admin` only. | INFERRED (title "Admin Readiness"; SEC-M06-06) |

## 5. Validation rules

Client checks are only the native ones listed (as live). Server messages that were not captured are written as PROPOSED COPY (new text for the rebuild; URS OQ-M06-09).

| Form / field | Rule | Message | Trigger |
|---|---|---|---|
| S11 `subject` | required; one of the 10 option values | native required bubble; server 422 "Sila pilih subjek." (PROPOSED COPY) | submit |
| S11 `paper_number` | required; 1 or 2 (default 1) | native | submit |
| S13 `subject` | native `required` (no `novalidate`); one of the 15 values | native bubble; the script does not run | submit |
| S13 `year` | free text, `maxlength="8"` (as live) | — (input stops at 8 characters) | typing |
| S13 `question_text` | optional (as live) | — | — |
| S13 `image` | `accept="image/*"` (client); server: image MIME, ≤5 MB (mock, SEC-M06-05) | server `{ok:false, error:"Gambar tidak sah."}` (PROPOSED COPY) | submit |
| S7/S9 filter | `subject_id` in the allowed list else "Semua"; `kbat_level` 1–6 else "Semua" | — | GET |
| Q1 `count` | 5, 10 or 20 | 422 → back to S2 | open |
| Q2 `count`, `level`, `difficulty`, `question_id` | BR-M06-07 (`difficulty` 2–5; `question_id` + `count=1` allowed) | 422 → back to S4 | open |
| Q3 `year`, `set` | year 2026, startable set | 422/404 → S6 | open |

## 6. Data entities & fields

*(solution-architect)* JSON camelCase; dates ISO 8601 +08:00 (SRS.md §7.4). **Numeric ids** are kept where live exposes them (mock ids `/spm-mock/16`, structured set ids `/latihan-berstruktur/3700/jawab`, question ids `?question_id=`, subject ids `?subject_id=3`, level ids 10/11). **One owner per store (D12):** questions and structured sets belong to M04 (`questionStore`, `structuredStore`, M04 §7.1); practice sessions, answers, the revision queue, mastery counters and structured attempts belong to M05 (DATA-M05-01/02/06, M05 §7). M06 owns only the SPM configuration (6.1), the Tracking A set records (6.3), mock exams (6.5), the walkthrough simulation (6.7) and its lookups. All data lives in the in-memory mock, reset per test (`mock.reset()`).

### 6.1 DATA-M06-01 — SpmSubject (owned by M06; configuration over M03 Subject)

| Field | Type | Notes |
|---|---|---|
| code | string | M03 code (BM, BI, MATH, …) — key |
| subjectId | int | M03 id (1…31, integer per M03 v1.2); name, `isCore`, icon and colour are read from M03 `GET /api/subjects`, not re-declared |
| group | `teras` \| `elektif` | S3 section |
| displayOrder | int | BR-M06-06 (S3); `databankOrder` int\|null (S2; null = not listed: BA) |
| targetType | `spm` \| `custom` \| `latihan` \| null | BR-M06-04 |
| targetSize | int \| null | |
| subjective | `{ group: 'teras'\|'elektif' }` \| null | membership of the 15 S8 subjects |

Counts are **not stored** here (D11). They are named queries on the M04 question store: `spmPoolCount(code)` = `questionStore.spmPool({subjectId}).count`; `levelCount(code, l)` = `spmPool({subjectId, educationLevelIds:[l]}).count`; `difficultyCount(code, k[, l])` = `spmPool({subjectId, [educationLevelIds:[l]], difficultyLevel:k}).count` (BR-M06-02).

### 6.2 DATA-M06-02 — SPM question pool (M04 view; not an M06 schema)

The SPM objective pool is the M04 view `questionStore.spmPool` over the `spmPool` facet (M04 BR-M04-32, §6.13.1, FR-M04-113): `mcq`, level 10 or 11, approved, active, not PKSK, facet `spmPool = true`. M06 has no question schema and no virtual ids (XL-01). Rows that leave eligibility (deactivated, archived) leave the pool at once; rows created in M04 enter it when M04 sets the facet (XL-29). Single questions resolve with `questionStore.getEligible(id)` (null for inactive, unknown or ineligible rows) plus the facet check. M06 supplies the observed per-subject pool sizes and their level/difficulty split as allocation inputs to the M04 dataset (§6.10).

### 6.3 DATA-M06-03 — TrackingASet (owned by M06)

| Field | Type | Notes |
|---|---|---|
| subjectId | int | M03 id (`subjectCode` derived) |
| year | int | 2026 |
| setNo | int | unique per subject/year |
| questionIds | int[] → Question (M04) | ids of the subject's SPM pool, in `priority` order; length = observed `bankSource` for bank-besar sets, else the observed ready count |
| dskpTagged | int | DSKP line numerator (observed; = total) |
| eligibleCount | derived | number of `questionIds` that `getEligible` returns (a deactivated question leaves the set) |
| readyCount | derived | min(eligibleCount, size) — "soalan kuiz siap guna" (size = target ?? 40) |
| bankSource | derived | eligibleCount when it exceeds size (GEO Set 1: 67), else null |
| status | derived | BR-M06-08 |

### 6.4 DATA-M06-04 — SPM sessions (a view of M05 DATA-M05-01; no M06 schema)

SPM quiz sessions are M05 PracticeSessions (D12) with `mode` ∈ `past_year` \| `latih_tubi` \| `ramalan`, created, checked and completed through M05 §7 #4–#6 (BR-31). There is no `mode = spm`. M06 screens read them through the M05 field map: `type` = `mode`; `subjectCode` from `subjectId` (M03); `total` = `questionCount`; `correct` = `correctCount`; `durationSec` = `timeSpent`; `coins` = `coinsEarned`; `level` = `levelId`; `questionId` = `targetQuestionId`; `year`, `setNo`, `status` (`in_progress` \| `completed`), `completedAt` unchanged; answers are M05 QuizAnswer rows (DATA-M05-02). The same records appear on M05 `/practice/history` with the badge "Latihan" (M05, OBSERVED) and on M06 S10 with the SPM type badge.

### 6.5 DATA-M06-05 — MockExam and MockItem (owned by M06)

MockExam: `id` (int, live style), `userId` (int), `subject` (S11 option value, e.g. "English"), `subjectId` (int; mapped: Bahasa Melayu 1, English 2, Matematik 3, Matematik Tambahan 8, Fizik 9, Kimia 10, Biologi 11, Sains 4, Sejarah 5, Pendidikan Islam 6), `paperNumber` 1\|2, `status` (`in_progress` \| `submitted`), `createdAt`, `submittedAt?`, `score?`, `maxScore`, `percent?`, `grade?` (A+…G), `items[]`.
MockItem: `no`, `questionId` (Paper 1: an M04 SPM-pool question id; Paper 2: an M04 structured question id from `structuredStore`), `text`, `options?`, `modelAnswer` (P1: letter), `studentAnswer?` (null = "(tiada jawapan)"), `marks?`, `maxMarks`, `feedback?`, `topic`.
**Decision (XL-04):** mock answers are stored only in MockItem. A mock is not a practice session (M05 DATA-M05-01 excludes it; live `/spm/history` and `/practice/history` list only the 4 quiz sessions while mock 16 exists — OBSERVED), so M05 BR-31 does not apply: no QuizAnswer rows, revision queue, mastery counters, trial counter or wallet credit.

### 6.6 DATA-M06-06 — StructuredAttempt (owned by M05; referenced)

M05 DATA-M05-06 with `scope = 'spm'` and `track = 'bahasa' | null`; M06 reads `structuredQuestionId`, `totalAwarded`, `totalMax`, `submittedAt` for the S8 stats (BR-M06-18). Structured sets are M04 `structuredStore` rows (the M05 structured paths §7 #15–17).

### 6.7 DATA-M06-07 — Walkthrough (transient) and CannedWalkthrough

Request: `subject`, `year`, `questionText`, `image?` (File). Response: `{ok:true, walkthrough: string}` \| `{ok:false, error: string}`. CannedWalkthrough: `{subjectKey, text}` (§6.12).

### 6.8 DATA-M06-08 — DutaCard (owned by M24; referenced)

`slug`, `name`, `initials`, `tier` (`bintang` \| `inspirasi` \| `tetamu`), `tagline`, `subject`, `state`, `rating` (2 decimals), `active`.

### 6.9 DATA-M06-09 — Lookups (static)

History types and labels (BR-M06-21; values = M05 `mode` `past_year`, `latih_tubi`, `ramalan`); target types; set statuses ("Set Bersih", "Ready Bank Besar", "Belum Cukup"); KBAT (M04 BR-M04-28, student scale 1–6): filter options "1. Mengingat", "2. Memahami", "3. Mengaplikasi", "4. Menganalisis", "5. Menilai", "6. Mencipta" and card bands LOTS (1–2), MOTS (3), HOTS (4–6); mock subjects (10, S11 order) and papers; walkthrough subjects (16, S13 order); grades and bands (BR-M06-24/25).

### 6.10 Seed data (fictitious people; live curriculum values)

**Accounts** (M01 seeds reused; no new account): `admin@demo.test` (mirrors the live admin's SPM data), `pelajar@demo.test` (student with every type of record), `pelajar2@demo.test` (no SPM activity — empty states), `guru@demo.test` (non-admin, non-student role for the readiness check). M03 `pelajarmaju@demo.test` has no SPM data.

**SpmSubject and SPM pool allocation inputs (to M04, D11).** The 19 Latih Tubi subjects keep their live targets (A.2). M06 supplies the observed per-subject SPM pool sizes — the live S2/S3 counts BM 514, BI 1,114, MATH 1,681, SCI 2,076, SEJ 1,539, BIO 1,999, EKON 1,986, PHY 1,261, GEO 1,228, CHEM 1,009, ADDMATH 501, PI 483, PM 1,353, PSV 545, PSI 510, PERNIAGA 934, AKAUN 1,770, TI 530, BA 0 (Σ 21,033) — as the allocation of M04 approved + active T4/T5 MCQ rows of each subject (M04 §6.11 "SPM pool"); anchors inside it (e.g. 564157–564161, 563393, 561050 Sains/Biologi T5; 570024 Matematik T4; 570023 Kimia T4; 570021 Pendidikan Moral T5; 570022 Fizik T5) replace generated rows and do not change the totals. The split by level and difficulty was never observed for this pool; the allocation divides each count in the proportions of the live S4 breakdown (discovery A.2, keys 1–4 = difficulty 1–4; difficulty 5 = 0) with largest-remainder rounding — **PROPOSED values** (DV-M06-01). Subjects whose live S4 total already equalled the pool (BI, SEJ, PI, GEO, PHY) keep their exact live S4 values. Every S2/S3/S4 count is then the `spmPool` count of the dataset:

| Code | Pool (S2 = S3 = S4) | T4 / T5 | difficulty 1 / 2 / 3 / 4 (5 = 0) | T4 by difficulty 1–4 | T5 by difficulty 1–4 |
|---|---|---|---|---|---|
| BM | 514 | 205 / 309 | 13 / 195 / 242 / 64 | 3 / 101 / 80 / 21 | 10 / 94 / 162 / 43 |
| BI | 1,114 | 362 / 752 | 228 / 447 / 293 / 146 | 0 / 134 / 166 / 62 | 228 / 313 / 127 / 84 |
| MATH | 1,681 | 976 / 705 | 505 / 514 / 577 / 85 | 199 / 309 / 410 / 58 | 306 / 205 / 167 / 27 |
| SCI | 2,076 | 1,172 / 904 | 47 / 1299 / 539 / 191 | 20 / 801 / 246 / 105 | 27 / 498 / 293 / 86 |
| SEJ | 1,539 | 777 / 762 | 386 / 503 / 493 / 157 | 385 / 184 / 122 / 86 | 1 / 319 / 371 / 71 |
| PI | 483 | 239 / 244 | 0 / 150 / 212 / 121 | 0 / 79 / 109 / 51 | 0 / 71 / 103 / 70 |
| PM | 1,353 | 712 / 641 | 0 / 831 / 429 / 93 | 0 / 429 / 224 / 59 | 0 / 402 / 205 / 34 |
| GEO | 1,228 | 250 / 978 | 217 / 405 / 448 / 158 | 0 / 52 / 121 / 77 | 217 / 353 / 327 / 81 |
| BIO | 1,999 | 1,078 / 921 | 5 / 1147 / 529 / 318 | 5 / 616 / 318 / 139 | 0 / 531 / 211 / 179 |
| CHEM | 1,009 | 607 / 402 | 20 / 705 / 225 / 59 | 0 / 442 / 123 / 42 | 20 / 263 / 102 / 17 |
| PHY | 1,261 | 461 / 800 | 68 / 450 / 545 / 198 | 0 / 182 / 213 / 66 | 68 / 268 / 332 / 132 |
| PERNIAGA | 934 | 249 / 685 | 162 / 524 / 220 / 28 | 0 / 218 / 24 / 7 | 162 / 306 / 196 / 21 |
| AKAUN | 1,770 | 503 / 1,267 | 286 / 1052 / 325 / 107 | 0 / 393 / 70 / 40 | 286 / 659 / 255 / 67 |
| EKON | 1,986 | 896 / 1,090 | 234 / 642 / 743 / 367 | 70 / 301 / 376 / 149 | 164 / 341 / 367 / 218 |
| ADDMATH | 501 | 274 / 227 | 0 / 239 / 234 / 28 | 0 / 132 / 128 / 14 | 0 / 107 / 106 / 14 |
| PSV | 545 | 273 / 272 | 0 / 165 / 254 / 126 | 0 / 87 / 135 / 51 | 0 / 78 / 119 / 75 |
| BA | 0 | 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 | 0 / 0 / 0 / 0 |
| TI | 530 | 275 / 255 | 118 / 78 / 204 / 130 | 39 / 64 / 106 / 66 | 79 / 14 / 98 / 64 |
| PSI | 510 | 435 / 75 | 0 / 104 / 216 / 190 | 0 / 86 / 197 / 152 | 0 / 18 / 19 / 38 |

Resulting hub values: Jumlah Soalan 20,529, Subjek SPM 25, Tahun Tersedia 0 (all live), Soalan Tracking A 1,769 (PROPOSED, DV-M06-04); chips Databank 14,673 and Latih Tubi 14,673 (live constants), Tracking A 1,769, Subjektif 4,059. S4 buttons show difficulties 2–5, e.g. MATH "Asas" 514, "Pertengahan" 577, "Sukar" 85, "Sangat Sukar" 0 (seed split, PROPOSED).

**Tracking A sets (2026)** — the real S6 values of every subject (discovery §2.6/A.3 and the audit's S6 reads, AUD-M06-02); no value is chosen to reach a total. Each set's `questionIds` are that many pool question ids of the subject (deterministic pick from `questionStore.spmPool({subjectId, educationLevelIds:[10,11]})` with seed "tracking-{code}-{setNo}", disjoint across sets of a subject; GEO Set 1 holds 67); all are eligible in the default dataset, so Σ readyCount = 1,769:

| Subject (size) | Sets: `setNo readyCount` (bankSource) |
|---|---|
| BM (34) | 1 9 |
| MATH (40) | 43 34, 44 31, 45 34, 46 32, 47 35, 48 30, 49 35, 50 34, 51 31, 52 33, 53 33 |
| SCI (40) | 25 22, 26 3, 27 1, 28 1, 30 3, 31 1, 32 2, 33 1, 34 1 (Σ 35) |
| SEJ (40) | 37 31 |
| PHY (40) | 1 4, 4 1, 7 2, 9 1 |
| CHEM (40) | 1 4, 2 1, 3 3, 5 5, 6 3, 8 4, 9 2 (Σ 22) |
| BIO (40) | 2 1, 5 1, 10 1 |
| GEO (40) | 1 40 (bank 67, DSKP 67/67), 2 31, 3 34, 4 30, 5 30, 6 31, 7 30, 8 32, 9 20, 10 31 |
| EKON (40) | 1 23, 2 17, 3 12, 4 14, 5 19, 6 23, 7 19, 8 18 (Σ 145) |
| PSI (40) | 3 31, 4 40, 5 33, 6 33, 7 38, 8 30 |
| AKAUN (none → 40) | 1–16: 40 each |
| BI, PI, PM, ADDMATH, BA, PERNIAGA, TI, PSV | no sets (S6 empty state; with the target chip for PI, PM, ADDMATH, BA; without a target line for PERNIAGA, TI, PSV) |

DSKP: `dskpTagged = dskpTotal` (100%) for every set, as live.

**SPM structured sets** — the M04 structured dataset (M04 §6.11; one store, D12), read through M05 §7 #15–17. Student-visible total **4,059** (M04 FR-M04-115; S8 counts BI 773, BM 559, MATH 298, SCI 204, SEJ 328, BIO 217, EKON 42, PHY 246, GEO 21, CHEM 232, ADDMATH 256, PERNIAGA 763, AKAUN 76, SK 22, TI 22). M06 cites only the M04 §6.11 anchors: 3700, 3701, 3702 (BM T5 KBAT 2 Trial 5 bahagian), 3704, 3705, 3706 (BI T5 KBAT 3, 4 bahagian · 10 markah, 10m), 2505, 2510, 2511 (Matematik T4 KBAT 1 Trial), 4454–4456 (Perniagaan T5 KBAT 3; 4454 topic "Merancang Pengendalian Perniagaan"), 3698 (Sejarah T5); inactive anchors 3699, 3703, 2509 are not listed to students. BM has exactly 3 sets at KBAT 6 and Matematik none (M04 dataset). Other ids are generated rows of the M04 dataset.

**Sessions (history)**
- admin (ids and values = M05 seed A2–A5, the live `/spm/history` rows): A5 `past_year` BM 0/5 2026-05-19 03:49, 14 s; A4 `past_year` BM 1/5 2026-05-19 03:26, 36 s; A3 `latih_tubi` BM 11/34 2026-05-11 14:27, 105 s; A2 `latih_tubi` **SEJ** 14/40 2026-05-11 14:22, 131 s (Sejarah per live `/practice/progress`: "SE Sejarah 40 soalan … 14 betul") → 4 / 21.8% / 26 / 84. The admin's 35 BM answers of 2026-02-19 in M05 have no session and are not on S10.
- student (`pelajar@demo.test`; one seed shared with M05 §6.12, adopted there): P1 `past_year` MATH 4/10 2026-09-22 19:00, 300 s (40%, red); P2 `latih_tubi` BM 26/34 2026-09-24 20:15, 360 s (76%, yellow); P3 `past_year` SEJ 6/10 2026-09-24 20:40, 270 s (60%, yellow); P4 `ramalan` AKAUN Set 1 34/40 2026-09-25 08:30, 900 s (85%, green) → 4 / 65.4% / 70 / 94. All sessions are M05 PracticeSession rows (§6.4) whose questions and QuizAnswer rows use M04 SPM-pool ids (P4 = the AKAUN Set 1 questions).

**Mocks** (ids as live where known)
- admin 16: Bahasa Melayu P1, submitted 2026-05-25, 30 items all unanswered, keys and first three texts as live ("Apakah maksud perkataan 'inovatif' dalam konteks sains dan teknologi?" A; "Apakah tema utama dalam puisi 'Bumi Bertuah' karya A. Samad Said?" B; "Siapakah penulis novel 'Salina'?" A), topics Sastra 11, Penulisan 10, Sosiobudaya 5, Kosa Kata 2, Tatabahasa 2 → 0/30, 0.00%, G.
- admin 317: Sejarah P1, in progress, created 2026-07-25.
- student 318–327: Matematik P1 29/30 A+; Sains P1 25/30 A; Biologi P1 22/30 B+; Fizik P1 19/30 B; Kimia P1 16/30 C; Sejarah P1 14/30 D; English P1 12/30 E; Pendidikan Islam P1 6/30 G; Matematik Tambahan P2 38/60 B; Bahasa Melayu P2 in progress.

**Subjective attempts** (M05 StructuredAttempt rows, `scope = "spm"`): student — set 2510 (Matematik) 60%, set 3700 (BM, `track = "bahasa"`) 75% → S8 2 / 2 / "75%" / 2.

**Duta** (all fictitious): `cikgu-demo-matematik` "Cikgu Demo Matematik" (CM, bintang, "Maestro Matematik · 22 tahun ajar pelajar B40 capai cita-cita.", Matematik, Johor, 4.92); `cikgu-demo-bahasa` "Cikgu Demo Bahasa" (CB, bintang, "Pakar Bahasa Melayu SPM · 15 tahun mengajar Kertas 2.", Bahasa Melayu, Johor, 4.88); `cikgu-demo-sains` "Cikgu Demo Sains" (CS, bintang, "Pakar Sains SPM · Jurulatih eksperimen sekolah.", Sains, Selangor, 4.80); `cikgu-demo-inspirasi` (inspirasi) and `cikgu-demo-tetamu` (tetamu) are never picked.

### 6.11 Test hooks (dev/test builds; NFR-M06-02)

`mock.reset(overrides?)` (the shared reset of the M04/M05 stores; e.g. M04 allocation override `{questionStore:{spmPool:{MATH:{11:{4:3}}}}}` for the short-filter case), M04 actions for pool changes (create on M04 S2, deactivate via M04 S7 — AC-02.2), `setLatency(ms)`, `setWalkthroughLatency(ms)`, `failNext(endpoint, status|'network'|payload)`, `setUser(email)`, `setRandomSeed(n)` (question sampling and Duta pick), `setNow(iso)` (relative time, timer placeholder).

### 6.12 Fixture functions

- (v1.3) M06 has no question generator: questions come from the M04 dataset (§6.2).
- Paper 2 marker (simulated, D4): `marks = 0` for an empty answer, else `round(maxMarks × min(1, words / 60))`; feedback "Jawapan anda merangkumi {marks} daripada {maxMarks} markah. Rujuk skema." (PROPOSED COPY).
- Canned walkthroughs (PROPOSED COPY; real output comes from AI, D4): `Matematik` — "Langkah 1: Kenal pasti apa yang diberi dan apa yang diminta.\nLangkah 2: Pilih rumus yang sesuai (rujuk buku teks Tingkatan 4/5).\nLangkah 3: Gantikan nilai dan selesaikan.\nSkema: 1 markah untuk kaedah, 1 markah untuk jawapan betul."; `Sejarah` — "Langkah 1: Kenal pasti kata tugas soalan (nyatakan / huraikan).\nLangkah 2: Tulis isi berserta huraian.\nSkema: 1 markah bagi setiap isi yang tepat."; default — "Langkah 1: Baca soalan dengan teliti.\nLangkah 2: Kenal pasti konsep utama dalam buku teks.\nLangkah 3: Jawab mengikut format skema pemarkahan." Each is prefixed with "Soalan: {first 80 chars of question_text or '(gambar)'}\n\n" and shown in the `<pre>` with its line breaks.

## 7. Mock API endpoints

*(solution-architect)* Base `/api`, envelope/error/locale per SRS.md §7. **A** = any session (guest → 401 → `/login`); **AD** = admin. Every call has the configurable latency. Live start URLs are GETs (SEC-M06-01); the rebuild starts sessions with the M05 POST (#8), called once by `<PracticeQuiz>` on mount. Questions come from the M04 store contract (`questionStore`, `structuredStore`, M04 §7.1), sessions from the M05 session endpoints (D12).

| # | Method | Path | Auth | Mut. | Request | Success | Errors | Live equivalent |
|---|---|---|---|---|---|---|---|---|
| 1 | GET | `/api/spm/overview` | A | no | — | 200 `{data:{stats:{totalQuestions, subjectCount, yearsAvailable, trackingAQuestions}, modules:{databank, latihTubi, trackingA, subjektifSets}, me:{sessions, avgAccuracy, coins, answered}}}` | 401 | `GET /spm` |
| 2 | GET | `/api/spm/databank` | A | no | — | 200 `{data:[{code, name, nameEn, icon, color, databankCount}]}` (BR-M06-06 order) | 401 | `GET /spm/tahun-lepas` |
| 3 | GET | `/api/spm/latih-tubi` | A | no | — | 200 `{data:{teras:[Card], elektif:[Card]}}`; Card = `{code, name, nameEn, icon, color, total, targetType, targetSize, locked}` | 401 | `GET /spm/latih-tubi` |
| 4 | GET | `/api/spm/latih-tubi/:code` | A | no | — | 200 `{data:{code, name, icon, color, total, targetType, targetSize, levelCounts, difficultyStats:{1..5}, difficultyByLevel, countOptions:[{value, label, isTarget}], defaultCount}}` (total = S3 count) | 404 `NOT_FOUND` | `GET /spm/latih-tubi/{CODE}` (server-rendered `quizConfig()`) |
| 5 | GET | `/api/spm/tracking-a` | A | no | — | 200 `{data:{objectiveLane:{subjects, sets, questions}, bahasaLane:{subjects:2, sets}, readiness: Readiness\|null, bahasa:[{subjectId, code, name, nameEn, sets}], openSubjects:[OpenCard]}}`; `readiness` null for non-admins | 401 | `GET /spm/ramalan` |
| 6 | GET | `/api/spm/tracking-a/:code` | A | no | — | 200 `{data:{code, name, targetType, targetSize, summary:{bersih, bankBesar, readyQuestions, belumCukup}, sets:[{setNo, status, readyCount, bankSource, dskpTagged, dskpTotal}]}}` · for BM/BI 200 `{data:{redirect:'/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa'}}` | 404 | `GET /spm/ramalan/{CODE}` (302 for BM/BI) |
| 7 | GET | `/api/spm/subjektif` | A | no | — | 200 `{data:{stats:{setsAnswered, subjectsTried, bestScore\|null, bestSetsSaved}, subjects:[{subjectId, name, nameEn, group, icon, color, sets}]}}` | 401 | `GET /spm/subjektif` |
| 8 | POST | `/api/practice/sessions` | A | yes | M05 #4 with the SPM modes: `{mode:'past_year', subjectCode, count}` · `{mode:'latih_tubi', subjectCode, count, levelId?, difficulty?, targetQuestionId?}` · `{mode:'ramalan', subjectCode, year, setNo}`; M06 rules BR-M06-07/13 apply; questions from `questionStore.spmPool` / `getEligible` / the set record | 201 M05 #4 shape | 404; 422 `VALIDATION_ERROR`, `NO_QUESTIONS`, `SET_NOT_READY`, `QUESTION_NOT_ELIGIBLE`; 402 per M05 BR-07 | **owned by M05** — replaces live GET `/spm/tahun-lepas/{CODE}/quiz`, `/spm/latih-tubi/{CODE}/quiz` (incl. `?question_id=&count=1`), `/spm/ramalan/{CODE}?year&set` |
| 9 | POST | `/api/practice/sessions/:id/check-answer` | A (owner) | yes | M05 #5 | M05 #5 | M05 #5 | **owned by M05** (`POST /practice/check-answer`) |
| 10 | POST | `/api/practice/sessions/:id/submit` | A (owner) | yes | M05 #6 (BR-31: totals, QuizAnswer rows, revision queue, mastery, trial, wallet) | M05 #6 | M05 #6 | **owned by M05** (`POST /practice/submit-quiz`) |
| 11 | GET | `/api/practice/sessions` | A | no | M05 #23 `?modes=past_year,latih_tubi,ramalan&type=` (absent or unknown `type` → all rows, `activeType` null) | M05 #23 `{data:[…], meta:{activeType, stats:{sessions, avgAccuracyPct, coins, answered}, …}}` (S10 maps it through the §6.4 field map) | 401 | **owned by M05** — `GET /spm/history?type=` |
| 12 | GET | `/api/spm-mocks` | A | no | — | 200 `{data:[{id, subject, paperNumber, status, createdAt, score, maxScore, percent, grade}]}` newest first | 401 | `GET /spm-mock` |
| 13 | POST | `/api/spm-mocks` | A | yes | `{subject, paperNumber}` | 201 `{data:{id}}` | 422 `fields.subject` | `POST /spm-mock/jana` |
| 14 | GET | `/api/spm-mocks/:id` | A (owner) | no | — | 200 `{data:{id, subject, paperNumber, status, createdAt, items:[{no, text, options?, maxMarks}]}}` (no keys; shape provisional, L-8) | 404 | `GET /spm-mock/{id}` (not observed) |
| 15 | POST | `/api/spm-mocks/:id/submit` | A (owner) | yes | `{answers:[{no, answer}]}` | 200 `{data: MockResult}` | 404; 409 (already submitted) | (not observed) |
| 16 | GET | `/api/spm-mocks/:id/result` | A (owner) | no | — | 200 `{data:{id, subject, paperNumber, score, maxScore, percent, grade, heroClass, weakTopics:[{topic, wrongCount}], items:[MockItem]}}` | 404; 409 `NOT_SUBMITTED` | `GET /spm-mock/{id}/result` |
| 17 | POST | `/api/spm-walkthrough/solve` | A | yes | multipart `subject, year, question_text, image?` | 200 `{ok:true, walkthrough}` · 200 `{ok:false, error}` (shape kept as live for the page script) | 401; network (hook) | `POST /pusat-ai/spm/solve` |
| 18 | GET | `/api/practice/structured` | A | no | M05 #15 with `scope=spm` [`&track=bahasa`], `subjectId`, `kbatLevel` (1–6), `page` | M05 #15 (from M04 `structuredStore`) | — | **owned by M05** (`GET /latihan-berstruktur?…`) |
| 19 | GET/POST | `/api/practice/structured/:id`, `/api/practice/structured/:id/attempts` | A | mixed | M05 #16/#17 with `scope`, `track` | M05 contract (StructuredAttempt) | — | **owned by M05** |
| 20 | POST | `/api/question-reports` | A | yes | `ReportQuestionModal` (M04 FR-M04-118) with `source:'spm'` (MCQ) or `'structured_attempt'` (structured, via `<StructuredAnswer>`), `quizSessionId` | M04 #15 | — | **owned by M04** |
| 21 | GET | `/api/duta/recommendations` (provisional, owner M24) | A (any session) | no | `?subject=&seed=` | 200 `{data: DutaCard \| null}`: `null` when no `bintang` record is active (BR-M06-27; consumers treat it as "no card", e.g. M25 FR-M25-25 block absent). Pool = active `bintang` records (never `inspirasi` / `tetamu`); with `subject` and a match, the pick is among the matching records, otherwise among all `bintang` records; with no `subject` and no `seed`, the pick is from the seedable mock stream `m06.duta` (`setRandomSeed`); `seed` gives a deterministic pick | 401 (no session) | **owned by M24** (server-rendered card) |

Total: 21 rows — 13 owned by M06 (#1–7, #12–17; 10 read, 3 mutating) and 8 referenced (M05 #4, #5, #6, #23, #15, #16/#17; M04 report; M24). Store functions used without an HTTP path: M04 `questionStore.spmPool`, `query`, `count`, `getEligible`, `structuredStore.query` (M04 §7.1).

## 8. States & messages

### 8.1 Shared pager (S7, S9)

Laravel "tailwind" pager, English, as live: ≥640px "Showing **{from}** to **{to}** of **{total}** results" (numbers without separators), prev chevron (disabled on page 1), page links (current unlinked) with "..." gaps (`onEachSide` window; page 1 of 28 shows 1–10 … 27 28), next chevron; <640px "« Previous" / "Next »", plain text when unavailable. Hidden when there is one page or none.

### 8.2 Per screen

Live M06 pages are server-rendered; no loading spinner was observed. The SPA prototype uses the global loading/error pattern (FR-G-10).

| Screen | State | Copy / behaviour |
|---|---|---|
| All data screens | Loading | Skeleton cards in the content area (FR-G-10); shell stays. |
| All data screens | Load error | "Maaf, berlaku ralat. Sila cuba semula." + "Cuba Semula" (FR-G-10; string from the shared layout script; UNVERIFIED as a page state). |
| S3 | Locked subject | amber card, "Locked: {have}/{target}" (FR-M06-24) |
| S4 | Default / level / difficulty selected | FR-M06-26…31 |
| S6 | Empty | "Belum Ada Set Tracking A" / "Set Tracking A untuk subjek ini akan ditambah tidak lama lagi." |
| S6 | Locked set | "Belum cukup soalan untuk format KPM." |
| S8 | No attempt | "Belum Ada" (Skor Terbaik) |
| S9 (and S7) | Empty | "Tiada soalan berstruktur buat masa ini" / "Soalan akan ditambah oleh guru dan admin" |
| S10 | Empty | "Belum Ada Sejarah" / "Mulakan kuiz SPM untuk melihat sejarah prestasi anda di sini." + "Mula Kuiz SPM" |
| S10 | Unknown `type` | all rows, no filter active (OBSERVED) |
| S11 | Required subject | native bubble; server 422 "Sila pilih subjek." (PROPOSED COPY) |
| S11 | No mock yet | heading "📚 Mock Sebelum Ini" with no rows (INFERRED: live empty list not seen) |
| S11 | In-progress / submitted row | "Belum submit" + "Belum" + "Sambung →" / "Score: …" + grade + "Lihat →" |
| S13 | Empty "Subjek" | native required bubble; the script does not run (no busy label, request or alert) |
| S13 | Busy | button disabled "AI sedang fikir... (mungkin 15-30s)"; previous result card hidden |
| S13 | Success | card with h2 "✨ Walkthrough Cikgu Alesa" + text in `<pre>` (line breaks kept) |
| S13 | Error | `alert(error)` / `alert("Ralat")` / `alert("Ralat: " + message)`; mock error when a subject is chosen but no question text or image: "Sila masukkan soalan atau muat naik gambar soalan." (PROPOSED COPY) |
| Q2 | No matching question | "Tiada soalan untuk tetapan ini. Sila ubah tetapan kuiz." + link "Kembali" → S4 (PROPOSED COPY) |
| Q2 | `question_id` not in the subject | back to S4 (INFERRED, no message) |
| Q4 | In-exam page | provisional neutral placeholder (FR-M06-72/73), submit button "Hantar" (PROPOSED COPY); everything else UNVERIFIED (L-8) |
| 404 | Unknown code/id | global 404 page (M01) |

### 8.3 Live-session states (L-1…L-13) — pending user approval

How each state is specified. None was rendered on live; each is listed in URS OQ-M06-01.

| # | State | Specified by | Basis | Label |
|---|---|---|---|---|
| L-1 | Databank quiz page | FR-M06-20 | Start route and type (S2 links, S10 "Tahun Lepas"); report modal on the SPM quiz page with `openReport(currentQuestion.id)` and `source:'spm'` (M04 discovery §2.14); quiz layout = M05 `<PracticeQuiz>` (M05 §7.1, SOURCE-DERIVED from the M05 S7 template) | SOURCE-DERIVED + INFERRED; page copy UNVERIFIED |
| L-2 | Databank finish / result / coins | FR-M06-21, BR-M06-15, BR-M06-19 | S10 rows (coins = correct, duration); completion = M05 §7 #6 with BR-31; `<PracticeQuiz>` results ("Ganjaran Anda") | OBSERVED (record) + M05 contract |
| L-3 | Latih Tubi quiz with filters (difficulty 2–5); `question_id` single-question form; zero-question case | FR-M06-32, FR-M06-33, FR-M06-87, BR-M06-07 | S4 `quizUrl()` script and `@click` keys; M04 "Buka Soalan Sama" URL; zero case not captured | SOURCE-DERIVED (params) + INFERRED; zero-case message PROPOSED COPY |
| L-4 | Latih Tubi result and history entry | FR-M06-34 | S10 "Latih Tubi" rows | OBSERVED (record) + INFERRED |
| L-5 | Tracking A set quiz and result | FR-M06-51…53, BR-M06-14 | S6 card copy ("Sistem tetap ambil 40 soalan ikut prioriti semasa"), history filter `ramalan` | SOURCE-DERIVED + INFERRED |
| L-6 | Bahasa structured answer page | FR-M06-47 | S7 "Mula" URL; the page is the M05 `<StructuredAnswer>` with `scope`/`track` | INFERRED (M05) |
| L-7 | Subjective answer, marking, best attempt, S8 stat change | FR-M06-55, FR-M06-61, BR-M06-18 | S8 stat labels and captions | OBSERVED (labels) + INFERRED |
| L-8 | Mock generation and in-exam UI | FR-M06-71…73, BR-M06-22/23 | Form fields, warning copy ("timer akan jalan dan tak boleh stop"), "Belum submit"/"Sambung →" row for a 2-month-old mock | **UNVERIFIED**: only the POST and the resulting S11 row are specified; the Q4 page is a neutral provisional placeholder; timer direction, time limit, auto-submit, item count and button copy are open (URS OQ-M06-05) |
| L-9 | Mock result for other grades, green/yellow hero, correct items, Paper 2 review | FR-M06-75, FR-M06-78, BR-M06-24/25 | Result CSS (`.mr-hero` `.bad` `.mid`, `.q-review.correct`, grade classes) | SOURCE-DERIVED (classes) + INFERRED (bands) |
| L-10 | Mock limit / validation messages | FR-M06-69 (required) | `required` attributes; no limit message is specified (not observed) | OBSERVED (required) / OQ |
| L-11 | Walkthrough busy, success, errors, image label | FR-M06-81…84, FR-M06-88 | Inline page script and form markup (discovery §2.13, corrected after audit): native `required` subject, `maxlength=8` year, result hidden on submit, h2 + `<pre>` | SOURCE-DERIVED |
| L-12 | Tracking A history rows, higher score colours | FR-M06-66 | — | INFERRED |
| L-13 | Student-role views (gating, readiness visibility) | FR-M06-14, FR-M06-38 | Card title "Admin Readiness"; no gate for admin | INFERRED |

## 9. Permissions matrix

| Role | View | Create | Edit / delete | Notes |
|---|---|---|---|---|
| Pelajar | S1–S13 (S5 without readiness card), Q1–Q4, own history/mocks/attempts | quiz sessions, mocks, walkthrough requests, subjective attempts (M05), question reports (M04) | — | INFERRED (L-13) |
| Admin | everything incl. the readiness card | same as Pelajar | — | OBSERVED (admin account) |
| Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD/JPN | S1–S13 without readiness card | as Pelajar | — | INFERRED (URS OQ-M06-03) |
| Guest | — | — | — | redirected to `/login` |

Ownership: sessions, mocks and attempts are readable only by their owner (404 otherwise, BR-M06-26).

## 10. Responsive behaviour

User-portal shell: sidebar ≥1024px; drawer + bottom nav below (global; FR-M06-07/08). S11–S13 and Q4 use the role-based shell as live (admin → admin shell with its own sidebar/drawer and bottom nav; other roles → user portal). Breakpoints named as Tailwind (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).

| Screen | 375 (base) | 768 (`md`) | 1280 |
|---|---|---|---|
| S1 | Stats 2 columns; module cards 1 column; h1 small (live classes) | Stats 4 columns; cards 2 columns | Cards 4 columns |
| S2 | Cards 1 column; set links in one row | 2 columns | 3 columns |
| S3 | 1 column | 2 columns | 3 columns |
| S4 | Tingkatan buttons side by side; difficulty 2 × 2 (DV-M06-08); count options wrap; "Mula Kuiz" full width; the bottom nav may cover it until scrolled (as live) | Difficulty 4 in a row | Same, wider card |
| S5 | Lane cards stacked; readiness mini stats 4 across in each tile; lock chips wrap; open cards 1 column | Lanes side by side | Open cards 3 columns (`tracking-a-desktop.png`) |
| S6 | Set cards 1 column | 2 columns | 2 columns |
| S7 / S9 | Cards 1 column; filter fields stacked; pager "« Previous / Next »" | Cards 2 columns (`sm`); numbered pager | Cards 3 columns (`xl`) |
| S8 | Stats 2 per row; tabs wrap; cards 1 column | Stats 4; cards 2 columns | Cards 3 columns |
| S10 | Stats 2 per row; filters wrap; rows full width | Stats 4 | Same |
| S11 | Hero; Duta card pills wrap; form fields stacked (DV-M06-08); mock rows: title and meta, then chip ("Belum" at 0.85rem) and link on their own line (DV-M06-08) | Form 2fr / 1fr; rows in one line | Same (max width as live) |
| S12 | Single column (max 880px) | Same | Same |
| S13 | Single column; "Subjek" and "Tahun (opsyen)" stacked (DV-M06-08) | Side by side | Same (max 880px) |
| Q1–Q3 | M05 quiz component responsive rules | | |
| Q4 | Provisional placeholder: single column, items full width (UNVERIFIED, L-8) | Same | Same |

## 11. Non-functional requirements

| ID | Requirement | Specialises |
|---|---|---|
| NFR-M06-01 | Counts are read from the M04 allocation (D11 datasets, M04 BR-M04-34) and the M05 store in <50 ms; M06 keeps no question rows and generates none. | NFR-01, D11 |
| NFR-M06-02 | The mock layer SHALL expose the §6.11 hooks in dev/test builds only. | NFR-03 |
| NFR-M06-03 | No external calls: the walkthrough, image "extraction", Paper 2 marking and Duta pick are simulated (D4); uploaded images stay in memory. | D4 |
| NFR-M06-04 | Accessibility replicates live (D10): no extra ARIA, keyboard handling or reduced-motion behaviour beyond the live markup; only DV-M06-09 (readable tab) changes visible contrast. | NFR-02, D10 |
| NFR-M06-05 | Security items SEC-M06-01…10 are replicated with dummy data and must be resolved in the backend phase. | NFR-04 |

**Security items (for security-engineer review)**

| ID | Item | Recommendation for the backend phase |
|---|---|---|
| SEC-M06-01 | Quiz sessions start on **GET** (`/spm/tahun-lepas/{CODE}/quiz`, `/spm/latih-tubi/{CODE}/quiz`, `/spm/ramalan/{CODE}?year&set`, `/latihan-berstruktur/{id}/jawab`): link prefetch, crawlers or a shared link create sessions without CSRF protection (discovery safety notes; M04 SEC-M04-10). | Start sessions with POST + CSRF; make the GET page idempotent (resume an open session). The prototype already uses POST (§7 #8). |
| SEC-M06-02 | Client-controlled `count`, `level`, `difficulty`, `year`, `set` parameters. | Validate server-side against the subject config (BR-M06-07/13); cap `count`. |
| SEC-M06-03 | Locked content reachable by URL — OBSERVED: `/spm/latih-tubi/BA` opens a working settings page while BA is "Locked" on S3, and the MATH set list (sets 43–53) is reachable although not linked from S5. **To verify (INFERRED, L-5):** whether a Belum Cukup set can be started by typing its start URL (`?year=2026&set=2`); that URL was never opened. | Enforce lock and readiness server-side (FR-M06-52, INFERRED); verify during L-5. |
| SEC-M06-04 | AI endpoint `POST /pusat-ai/spm/solve`: cost abuse (15–30 s per call), prompt injection via question text, no rate limit visible. | Per-user rate limit and quota, queue, request size limit, log model/tokens; keep rendering as text (live uses `textContent`). |
| SEC-M06-05 | Image upload on the walkthrough: only `accept="image/*"` client-side, no size limit, image sent to an AI vision service (may contain personal data). | Server MIME sniffing, size limit, strip EXIF, do not retain images; inform users (PDPA). |
| SEC-M06-06 | "Admin Readiness" panel rendered on a student-facing page; visibility for students unknown (L-13). | Authorise server-side by role; never send readiness data to non-admins (§7 #5 `readiness:null`). |
| SEC-M06-07 | Mock integrity: timer "tak boleh stop" and grading must not rely on the client; answer keys must not reach the client before submit. | Server-side start time and grading; Q4 payload without keys (§7 #14). |
| SEC-M06-08 | Sequential mock ids (`/spm-mock/16/result`, `/spm-mock/317`) → IDOR risk. | Enforce ownership (BR-M06-26); consider non-sequential ids. |
| SEC-M06-09 | Duta card shows a real teacher's name, state, rating and profile link on every load. | Consent and PDPA notice for ambassadors (M24). |
| SEC-M06-10 | Reports from quiz pages deactivate questions immediately (M04 SEC-M04-05) and carry `quiz_session_id`. | As M04 SEC-M04-05; validate that the session belongs to the reporter. |

## 12. E2E test scenarios

Every scenario runs on the three Playwright projects **mobile 375×812, tablet 768×1024, desktop 1280×800** unless a step is viewport-specific (then it asserts the behaviour for the current project). Each test starts with `mock.reset()`, `setNow('2026-09-25T10:00:00+08:00')`, `setRandomSeed(1)` and a session as `pelajar@demo.test` unless stated.

| ID | Scenario | Verifies FR | Verifies AC |
|---|---|---|---|
| E2E-M06-01 | Open `/spm`: pill, h1, lead, tab and header title, 4 stats (20,529 / 25 / 0 / 1,769) and their column count per viewport, 4 module cards with texts, chips (14,673 / 14,673 / 1,769 / 4,059), links and visible icons; "Sejarah Kuiz SPM" opens S10. | FR-01, FR-02, FR-03, FR-05, FR-10 | AC-01.1, AC-01.2, AC-01.3, AC-01.5 |
| E2E-M06-02 | "Prestasi SPM Anda" as admin (4 / 21.8% / 26 / 84) and as `pelajar2` (0 / 0.0% / 0 / 0). | FR-04 | AC-01.4 |
| E2E-M06-03 | Count consistency: for all 19 subjects S2 count = S3 count = S4 total = `questionStore.spmPool({subjectId}).count` and S4 T4 + T5 = total; hub Tracking A = Σ S6 ready questions of every subject (1,769); hub Subjektif = `structuredStore` student total (4,059); hub "Jumlah Soalan" 20,529 ≥ each chip (14,673). As admin create an approved Matematik T5 MCQ on M04 S2 → S2, S3, S4 total and "Tingkatan 5" +1 and the new id is served by `/spm/latih-tubi/MATH/quiz?question_id={new}&count=1`; deactivate 564159 on M04 → Sains counts −1 and `getEligible(564159)` null; hub values unchanged. | FR-06, FR-89 | AC-02.1, AC-02.2 |
| E2E-M06-04 | User shell: desktop sidebar "SPM" active + "SPM Mock Exam"; tablet/mobile bottom nav "SPM" and drawer "SPM"; header titles of S1–S10 incl. S4 "Latih Tubi SPM — Matematik", S6, S7, S9 with "Selamat datang kembali"; as admin S11/S12/S13 render in the admin shell with headers "SPM Mock Exam" / "Result Mock SPM — Bahasa Melayu" / "SPM Walkthrough — Cikgu Alesa" and no subtitle; as student S11 renders in the user portal with "SPM Mock Exam"; no "Dashboard" title anywhere in M06. | FR-07, FR-08, FR-09, FR-10 | AC-03.1, AC-03.2, AC-03.3 |
| E2E-M06-05 | As admin on `/admin`: expand "SPM" group (desktop) or open "Lagi" (mobile): 4 links; "SPM Walkthrough" and "SPM Mock Exam" items open S13/S11. | FR-11 | AC-03.4 |
| E2E-M06-06 | Guest → `/spm` redirects to `/login`; `/spm/latih-tubi/XYZ`, `/spm/ramalan/XYZ`, `/spm-mock/99999/result` show the 404 page with "Mula Latihan" → `/practice`; no "PRO"/lock/package element on S1–S13. | FR-12, FR-13, FR-14 | AC-04.1, AC-04.2, AC-04.3 |
| E2E-M06-07 | S2: header, 18 cards in order, BM card texts, links `count=5/10/20`, "Mula" not a link, no year select; `?subject=MATH` renders the same list. | FR-16, FR-17, FR-18, FR-19 | AC-05.1, AC-05.2, AC-05.3 |
| E2E-M06-08 | Click "10" on BM: `<PracticeQuiz>` posts M05 #4 `{mode:'past_year', subjectCode:'BM', count:10}`; quiz shows 10 questions whose ids are M04 BM T4/T5 pool rows; "Lapor Soalan" request has `source:'spm'` and the session id and the report appears in the M04 S7 queue with its question block; answer all and finish (M05 #6) → S10 first row "Tahun Lepas", "{c}/10 betul", "+{c} 🪙"; S1 stats updated; the wrong answers are in the M05 revision queue; M05 `/practice/history` lists the session with the badge "Latihan". | FR-20, FR-21 | AC-06.1, AC-06.2 |
| E2E-M06-09 | S3: header, section headings with counts, card order, counts equal S2 ("1,681 soalan", Bahasa Arab "0 soalan"), target chips per subject, none for PERNIAGA/AKAUN/PSV/TI. | FR-22, FR-23 | AC-07.1, AC-07.2 |
| E2E-M06-10 | Default seed: BA card amber, "0 soalan", "Locked: 0/40", lock icon, not navigable on click; `/spm/latih-tubi/BA` opens with "0 soalan tersedia", Tingkatan and difficulty counts all 0. | FR-24 | AC-07.3 |
| E2E-M06-11 | S4 MATH: icon tile glyph, header texts ("1,681 soalan tersedia") and tab title; seed-split values (PROPOSED, DV-M06-01): Tingkatan 976 / 705, select/clear; difficulty (keys 2–5) 514 / 577 / 85 / 0; T4 309 / 410 / 58 / 0; T5 205 / 167 / 27 / 0; clear restores; SCI "Asas" "1299 soalan" (unformatted, as live format) vs "Tingkatan 4" "1,172 soalan"; "Sangat Sukar" "0 soalan" on all 19 subjects. | FR-25, FR-26, FR-27, FR-28 | AC-08.1, AC-08.2, AC-08.3, AC-08.4, AC-08.5 |
| E2E-M06-12 | Count options: MATH "40 (Target SPM)" + helper; BM, ADDMATH helpers; PERNIAGA options 5–60, default 10, choose 30; "Mula Kuiz" hrefs for none / T4 / T5 + Sukar (`difficulty=4`) / PERNIAGA 30. | FR-29, FR-30, FR-31 | AC-09.1, AC-09.2, AC-09.3 |
| E2E-M06-13 | Open `/spm/latih-tubi/MATH/quiz?count=40&level=11&difficulty=4`: `<PracticeQuiz>` posts M05 #4 with `levelId:11, difficulty:4`; session with the matching pool questions (27 in the seed split, PROPOSED), all T5 / difficulty 4; report button present; finish (M05 #6) → S10 `?type=latih_tubi` row "{c}/27 betul". | FR-32, FR-34 | AC-10.1, AC-10.3 |
| E2E-M06-14 | `reset({spmPool:{MATH:{t5:{4:3}}}})` → `count=40&level=11&difficulty=4` gives 3 questions; `difficulty=5` → no session, §8 message and "Kembali" → S4. | FR-33 | AC-10.2 |
| E2E-M06-15 | S5 header, lane cards (3 subjek / 18 set / 747 soalan; 2 subjek / 1,332 set), open cards GEO, AKAUN, PSI with their exact chips and links. | FR-35, FR-36, FR-37 | AC-11.1, AC-11.2, AC-11.3 |
| E2E-M06-16 | As admin: readiness card texts, chips 1/1/58, 15 tiles in order, GEO/PSI/BI values, MATH lock chips (6), GEO-only note, no "SET MASIH LOCK" on BI; as student and as `guru@demo.test` the card is absent. | FR-38, FR-39, FR-40 | AC-12.1, AC-12.2, AC-12.3, AC-12.4 |
| E2E-M06-17 | S5 bahasa section texts and links; `/spm/ramalan/BM` and `/BI` land on S7 URLs. | FR-41, FR-42 | AC-13.1, AC-13.2 |
| E2E-M06-18 | S7 BM: back link, pill, h1, sub, info text, chips incl. "559 set ditemui"; filter options, `kbat_level=6` → "3 set ditemui", hidden fields kept; card fields of 3700 and its "Mula" URL; "Semua Subjek" → "1,332 set ditemui" and first card Bahasa Melayu. | FR-43, FR-44, FR-45 | AC-13.3, AC-13.4, AC-13.5, AC-13.6 |
| E2E-M06-19 | Pager on S7 BM ("Showing 1 to 20 of 559 results", 1–10 … 27 28; page-2 link keeps `track`) and S9 MATH ("of 298", … 14 15); on mobile only "« Previous" (plain) / "Next »". | FR-46 | AC-13.7, AC-17.2, AC-24.4 |
| E2E-M06-20 | From S7 press "Mula" on 3700 → `<StructuredAnswer>` loads M05 #16 with `scope=spm&track=bahasa`; its back link returns to S7; submitting posts M05 #17 and the attempt has `scope:'spm', track:'bahasa'`; from S9 (set 2510) → back link to S9. | FR-47 | AC-13.8 |
| E2E-M06-21 | S6 GEO (header, chips, Set 1 link and texts, Sets 2–10 inert with "Belum cukup soalan untuk format KPM."), AKAUN (no target line/chip, 16 cards without "Format set"), PSI (Set 4 first), MATH (11 locked, "11 set belum cukup"), EKON ("145 soalan kuiz siap guna", Set 7 "19", Set 8 "18"), SCI ("35", Sets 32–34 = 2 / 1 / 1), CHEM ("22", Set 9 "2"). | FR-48, FR-49 | AC-14.1, AC-14.2, AC-14.3, AC-14.4, AC-14.6 |
| E2E-M06-22 | S6 BA: zero chips, "Target Latihan: 40 / set", empty block texts. | FR-50 | AC-14.5 |
| E2E-M06-23 | AKAUN Set 3 → `<PracticeQuiz>` posts M05 #4 `{mode:'ramalan', subjectCode:'AKAUN', year:2026, setNo:3}`; session of the set's 40 questions; GEO Set 1 → 40 of its 67; `/spm/ramalan/GEO?year=2026&set=2` → URL replaced by `/spm/ramalan/GEO`, no session created; finish AKAUN set (M05 #6) → S10 `?type=ramalan` row "Tracking A". | FR-51, FR-52, FR-53 | AC-15.1, AC-15.2, AC-15.3 |
| E2E-M06-24 | S8: header, info box, stats for `pelajar2` (0 / 0 / "Belum Ada" / 0) and student (2 / 2 / "75%" / 2); tabs: "Semua" active readable (computed contrast ≥ 4.5:1), Teras 5 cards, Elektif 10; card texts and links (BI id 2, Sains Komputer 17). | FR-54, FR-55, FR-56, FR-57 | AC-16.1, AC-16.2, AC-16.3, AC-16.4 |
| E2E-M06-25 | S9 MATH: header, back link, filter options order, cards with "Mula" `?scope=spm`; `kbat_level=6` → empty texts and no pager. | FR-58, FR-59, FR-60 | AC-17.1, AC-17.2, AC-17.3 |
| E2E-M06-26 | As `pelajar2`: submit an SPM attempt on set 2510 through `<StructuredAnswer>` (`scope=spm`, M05 #17) → S8 "SET DIJAWAB" 1, "SUBJEK DICUBA" 1, "SKOR TERBAIK" "{p}%", "SET TERBAIK DISIMPAN" 1. | FR-61, FR-55 | AC-17.4 |
| E2E-M06-27 | As admin: S10 header, stats, 4 rows with exact texts (red tiles); "Tahun Lepas" → 2 rows, `bg-amber-500 text-white shadow-md`, stats unchanged; `?type=latih_tubi` → "Latih Tubi" `bg-blue-500`; `?type=ramalan` → "Tracking A" `bg-purple-500` + empty block, "Mula Kuiz SPM" → `/spm`; `?type=zzz` → 4 rows and no active filter. | FR-62, FR-63, FR-64, FR-65 | AC-18.1, AC-18.2, AC-18.3, AC-18.4, AC-18.6 |
| E2E-M06-28 | As student: rows newest first P4 85% green "Tracking A", P3 60% yellow, P2 76% yellow, P1 40% red; stats 4 / 65.4% / 70 / 94. | FR-66 | AC-18.5 |
| E2E-M06-29 | S11: hero, Duta block title/text + one card, warning with bold "Persediaan sebelum mula:", form options and default, button label; submit with no subject → form invalid, no request. | FR-67, FR-68, FR-69 | AC-19.1, AC-19.2, AC-19.3 |
| E2E-M06-30 | As admin: rows 317 ("Belum submit", "Belum" chip font-size 0.85rem, "Sambung →" `/spm-mock/317`) and 16 ("4 bulan yang lepas · Score: 0/30 (0.00%)", "G", "Lihat →"); as student: chip colours A+/A emerald, B+/B blue, C amber, D/E/G red. | FR-70 | AC-19.4, AC-19.5 |
| E2E-M06-31 | **Provisional (pending L-8).** Generate Matematik Paper 1 → `/spm-mock/{id}` with title "Matematik · Paper 1", items with answer inputs and a visible timer element without a pause control; S11 lists the mock as "Belum submit" with "Sambung →", which reopens the same mock. No assertion on timer direction, time limit, auto-submit or item count. | FR-71, FR-72, FR-73 | AC-20.1, AC-20.2 |
| E2E-M06-32 | **Provisional (pending L-8).** Answer and submit the Paper 1 placeholder → S12 with the computed grade; S11 row "Score: …" + chip + "Lihat →"; generate Paper 2 → answer inputs; submit → marks and feedback per item. | FR-74 | AC-20.3, AC-20.4 |
| E2E-M06-33 | As admin `/spm-mock/16/result`: red hero texts, tab title, Duta block (BM card), weak topics sorted (Sastra first) summing to 30, tip + link, 30 review items with item 1 texts and the header displayed "✗ SOALAN 1 · 0/1 MARKAH" (CSS upper case), both action links. | FR-75, FR-76, FR-77, FR-78, FR-79 | AC-21.1, AC-21.2, AC-21.3, AC-21.4, AC-21.5 |
| E2E-M06-34 | As student: A+ result green hero "A+"; C result yellow hero; a correct item shows "✓" and green style. | FR-75, FR-78 | AC-21.6 |
| E2E-M06-35 | S13: texts, 16 subject options, `subject` has `required`, `year` has `maxlength=8` (typing "2023-2024" keeps "2023-202"), placeholders, upload label; `setInputFiles('soalan.png')` → label "📎 soalan.png"; result card hidden; Duta block. | FR-80, FR-81, FR-85 | AC-22.1, AC-22.2 |
| E2E-M06-36 | Submit Matematik + text with `setWalkthroughLatency(800)`: button disabled "AI sedang fikir... (mungkin 15-30s)"; card h2 "✨ Walkthrough Cikgu Alesa" with the canned text in a `<pre>` (newlines preserved; `<b>` in the question stays literal), in viewport; button restored; a second submit hides the card until the new answer arrives. | FR-82, FR-83 | AC-22.3 |
| E2E-M06-37 | `failNext` with `{ok:false, error:'X'}` → alert "X"; with `{ok:false}` → "Ralat"; network → alert starting "Ralat: "; button restored each time. | FR-84 | AC-22.4 |
| E2E-M06-38 | Duta card on S11/S12/S13 has all fields and link; seeds 1 and 2 give different bintang ambassadors on S11; S12 of mock 16 shows the Bahasa Melayu ambassador; inspirasi/tetamu never shown. | FR-15 | AC-23.1, AC-23.2 |
| E2E-M06-39 | Visit S1–S13 (and Q1, Q4) on each project: `scrollWidth ≤ innerWidth`; grid column counts per §10; no visible text node inside `main` has a computed font-size below 12px (DV-M06-17). | FR-86 | AC-24.1, AC-24.5 |
| E2E-M06-40 | Mobile/tablet: S11 fields stacked at 375 (select shows "Paper 1 (Objektif)" fully), chip and link boxes do not intersect; S4 difficulty 2 columns at 375 and "Pertengahan" inside its button; 4 columns at 768/1280; S13 year field full width at 375 with placeholder "Cth: 2023" not clipped. | FR-86, FR-68, FR-70, FR-27, FR-80 | AC-24.2, AC-24.3 |
| E2E-M06-41 | Open `/spm/latih-tubi/MATH/quiz?question_id=570024&count=1` (an active Matematik T4 M04 anchor; same URL form as E2E-M04-40): `<PracticeQuiz>` posts M05 #4 with `targetQuestionId: 570024, count: 1`, no 422, quiz has exactly question 570024; `?question_id=136891&count=1` (inactive, `getEligible` → null) and `?question_id=564159&count=1` (a Sains question) → back to `/spm/latih-tubi/MATH`, no session. | FR-87 | AC-10.4 |
| E2E-M06-42 | S13 with "Subjek" = "Pilih" and a question: press "Bagi Walkthrough" → `form.checkValidity()` false, no request to `/api/spm-walkthrough/solve`, no dialog, button label unchanged. | FR-88 | AC-22.5 |

### 12.1 Traceability (US → FR → E2E)

Generated by the traceability script (author's scratchpad `trace.js`, Node): every FN in URS §3 is cited by ≥1 FR; every AC by ≥1 FR and ≥1 E2E; every FR by ≥1 E2E.

| US | ACs | FR | E2E |
|---|---|---|---|
| US-M06-01 | 5 | FR-01, FR-02, FR-03, FR-04, FR-05, FR-10 | E2E-01, E2E-02 |
| US-M06-02 | 2 | FR-06, FR-89 | E2E-03 |
| US-M06-03 | 4 | FR-07, FR-08, FR-09, FR-10, FR-11 | E2E-04, E2E-05 |
| US-M06-04 | 3 | FR-12, FR-13, FR-14 | E2E-06 |
| US-M06-05 | 3 | FR-16, FR-17, FR-18, FR-19 | E2E-07 |
| US-M06-06 | 2 | FR-20, FR-21 | E2E-08 |
| US-M06-07 | 3 | FR-22, FR-23, FR-24 | E2E-09, E2E-10 |
| US-M06-08 | 5 | FR-25, FR-26, FR-27, FR-28 | E2E-11 |
| US-M06-09 | 3 | FR-29, FR-30, FR-31 | E2E-12 |
| US-M06-10 | 4 | FR-32, FR-33, FR-34, FR-87 | E2E-13, E2E-14, E2E-41 |
| US-M06-11 | 3 | FR-35, FR-36, FR-37 | E2E-15 |
| US-M06-12 | 4 | FR-38, FR-39, FR-40 | E2E-16 |
| US-M06-13 | 8 | FR-41, FR-42, FR-43, FR-44, FR-45, FR-46, FR-47 | E2E-17, E2E-18, E2E-19, E2E-20 |
| US-M06-14 | 6 | FR-48, FR-49, FR-50 | E2E-21, E2E-22 |
| US-M06-15 | 3 | FR-51, FR-52, FR-53 | E2E-23 |
| US-M06-16 | 4 | FR-54, FR-55, FR-56, FR-57 | E2E-24 |
| US-M06-17 | 4 | FR-46, FR-55, FR-58, FR-59, FR-60, FR-61 | E2E-19, E2E-25, E2E-26 |
| US-M06-18 | 6 | FR-62, FR-63, FR-64, FR-65, FR-66 | E2E-27, E2E-28 |
| US-M06-19 | 5 | FR-67, FR-68, FR-69, FR-70 | E2E-29, E2E-30 |
| US-M06-20 | 4 | FR-71, FR-72, FR-73, FR-74 | E2E-31, E2E-32 |
| US-M06-21 | 6 | FR-75, FR-76, FR-77, FR-78, FR-79 | E2E-33, E2E-34 |
| US-M06-22 | 5 | FR-80, FR-81, FR-82, FR-83, FR-84, FR-85, FR-88 | E2E-35, E2E-36, E2E-37, E2E-42 |
| US-M06-23 | 2 | FR-15 | E2E-38 |
| US-M06-24 | 5 | FR-27, FR-46, FR-68, FR-70, FR-80, FR-86 | E2E-19, E2E-39, E2E-40 |

Result: 118 FN → all cited by an FR; 99 AC → all covered by FR and E2E; 89 FR → all covered by E2E; 42 E2E. Errors: 0.

## 13. Open questions

1. **Q1 Live-session states** — URS OQ-M06-01 (L-1…L-13 pending the user's approval of practice sessions on a test student account).
2. **Q2 M05 contract — closed (v1.3, XL-10).** M05 §7.1 defines `<PracticeQuiz>` and `<StructuredAnswer>`; M06 mounts them per FR-M06-20/32/47/51/87.
3. **Q3 Structured sets — closed (v1.3, XL-11).** One M04 structured dataset (4,064; 4,059 student-visible) with the §6.11 anchors; M06 cites only those anchors.
4. **Q4 Mock rules** — URS OQ-M06-05 (items per paper, timer, monthly limit, grade bands, Paper 2 marking).
5. **Q5 Count definitions — closed** (URS OQ-M06-08; v1.3: S2–S4 counts are M04 `spmPool` queries; the hub constants remain live under DV-M06-01).
6. **Q6 Role visibility and gating** — URS OQ-M06-02/03.
7. **Q7 Shared SPM sessions with M05 — closed.** M05 v1.2 adopted P1–P4 and A2–A5; both modules read the one M05 store.
8. **Q8 SPM history read — closed (v1.4, XL-35).** S10 calls M05 §7 #23 directly; M06 has no own history endpoint.
