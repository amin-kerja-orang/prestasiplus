# R1 PRD — Cross-cutting requirements

Part of the Release 1.0 PRD ([index](00-index.md)). These rules apply to every module in
[10-murid.md](10-murid.md), [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) and [30-admin-pusat.md](30-admin-pusat.md).
When a module section conflicts with this file, the module section wins only if it says so explicitly.

---

## X1. Reference rule (how to decide behaviour)

| Order | Source | Use |
|---|---|---|
| 1 | **V2** — prestasiplus.cloud (`/admin` Blade, pupil/teacher portals) and the admin Panel (admin.prestasiplus.cloud) | Primary reference for every flow, screen, field, rule, message (exact BM) and state. |
| 2 | **V1** — prestasiplus.my | Fallback where V2 has no equivalent (for example the school-admin screens, rows 45–53) or where V2 is broken. |
| 3 | **Principle** (DSKP, SPM exam standard, consistency with other 1.0 modules) | Only when neither V1 nor V2 shows the behaviour. Mark the requirement "specified by principle" so the user can review it. |

- **FR-X1-1** Where V2 works, V3 replicates it exactly (TRACKER D9). Where V2 is broken (404, wrong label, contradictory rule, unusable control), V3 fixes it minimally and records the fix in the module's *Fidelity deviations* table.
- **FR-X1-2** No menu, page, tab or section is added, removed or renamed beyond what this PRD specifies (D77 and the user's standing rule). Layout and design-system improvements are allowed; changes to the user experience are not.
- **FR-X1-3** Every requirement that cites V2 or V1 names its evidence (screenshot, V2 code file, or discovery document). Unobserved behaviour is never written as fact.
- **FR-X1-5 Close the gaps, never rewrite (user, 2026-11-04: "cari macam mana nak close gap, fix gap, improve gap je.. jangan buat from scratch").** The existing V3 code (`feature/v3-bijak-r1`) is the base.
  - **FR-X1-5 guardrail (read this first).** V3 already exists. Each module's *Action* and *Current gap* say what to change. The *Screen specification* describes the target behaviour; it is **not** an instruction to rebuild the screen. Before coding a card: (1) run a code gap check of the existing V3 code against every FR/AC of the card and post it on the issue (FR/AC → works / broken / missing, with file:line); (2) change only what is broken or missing, in the existing files; (3) prove the ACs, including the AC-CHAIN (section X9) that passes through the module.
  - Each module section states an **Action**:
    - **Keep**: it already matches; verify only.
    - **Fix**: existing code is wrong.
    - **Complete**: partly built.
    - **Build**: missing.
  - A developer changes **only** what the module's *Current gap* lists, and reuses the existing routes, components, APIs and data.
  - A module or screen that already meets its ACs is **not** rewritten, restyled or restructured.
  - Replacing an existing working screen, component or API needs the Delivery Lead's written approval in the task's issue.
  - The full reference behaviour in each section exists so that the developer never has to open V1/V2. It is the yardstick for judging a gap, **not** an instruction to rebuild.
  - **Completeness is still mandatory (user, 2026-11-04: "semua function dalam V2/V1 wajib difahami dan dipastikan berfungsi dalam V3 berdasarkan Matriks-Akses-Peranan").**
    - Every V2/V1 function inside a matrix module (every section, field, button, filter, tab, state and rule in its reference behaviour) has at least one AC.
    - Every such AC must pass in V3 before the module is Done.
    - "Keep" means verified and passing, never assumed.
    - "Close the gaps" decides **how** the work is done: on the existing code, without rewriting. It never decides **whether** a V2/V1 function is delivered.
- **FR-X1-4 Exception: question STRUCTURE does not follow V1/V2 (D90, D41).** The user confirmed again on 2026-11-04 that the way questions are added in V1/V2 is wrong. This covers manual entry and paper upload, in both `/admin` and the admin Panel. The fault is structural. A diagram (*rajah*), passage (*petikan*) or table is turned into **a standalone "question"**, and the questions that refer to it become **separate questions cut off from it**. In the real paper, **one stimulus is the shared reference for one or more questions**. V2 code confirms the fault (`docs/requirements/v2-question-bank-oldsystem-findings.md` §A):
  - DOCX import links a figure to the first following question only.
  - A shared figure is duplicated per question.
  - Random set generation picks single questions, so it can split a group or serve a question without its figure.
  - There is no group entity.

  Therefore, for V3:
  - **FR-X1-4a** A stimulus (rajah / petikan / jadual / graf) is **never a question** and carries no marks. It is a **stimulus group** that holds an ordered list of **1..n** questions referring to it (D90). A one-question group is valid everywhere, including inside papers (D108-1).
  - **FR-X1-4b** **Manual entry** (Studio) creates the stimulus group first, then adds its questions inside it (D93). It must be possible to add a second, third, … question to the same stimulus without re-uploading the figure.
  - **FR-X1-4c** **Paper upload / extraction** keeps each stimulus with **all** the questions that refer to it (for example "Rajah 3 → soalan 5–8"). It never attaches the stimulus to the first question only, and never duplicates it. The reviewer can fix the group range (add or remove a question from the group) before accepting.
  - **FR-X1-4d** **Display:** the pupil sees the stimulus **once**, above its questions, and it stays visible while answering them (sticky on mobile). Never once per question, never missing.
  - **FR-X1-4e** **Assembly and drills (D105):** Set Builder, Jana set, Jana Kertas and every draw (Latih Tubi, Databank, Soalan by Chapter, games) **serve questions with figures and whole stimulus groups**, as a real paper does. A group is **one unit**: it is never split, never reordered internally, and no question is served without its stimulus. Counts on each surface include what that surface serves (D91). The R1 "text-only MCQ" restriction (D92-1) is superseded by D105.
  - **FR-X1-4f** Migrated V1/V2 questions that are split this way (a "question" that is only a figure, or questions that say "Rajah n menunjukkan…" with no figure) are listed for the admin to regroup. They are not served as broken items.

  For the rest of the question structure (types, parts, marks, mark schemes), the reference is `docs/requirements/v2-exam-schema.md` (user-approved, D46/D47). For maths and subjective answering, it is D41. V2 is used only for workflow steps, states and BM copy that do not conflict with these rules. Every such difference is a logged fidelity deviation.

## X2. Release 1.0 scope by role

Source: `docs/Matriks-Akses-Peranan .xlsx`, columns *Murid 1.0*, *Guru 1.0*, *Admin Sekolah 1.0*, plus the user's addition of **Latih Tubi** for Murid.

| Role | 1.0 modules |
|---|---|
| Murid | A1 Profil Saya · A2 Tetapan Peribadi · A3 Panduan · A5 Log Keluar · 2 Dashboard · 3 Headcount · 4 Prestasi · 5 Analitik Adaptif · 6 Analisa Item · 7 Video · 8 Kelas Saya · 9 Soalan by Chapter · 12 Remedial · 13 SPM (incl. Bijak SPM) · 14 Heatmap Topik Lemah · **16 Latih Tubi** · 21 Permainan · 54 Laporan Soalan |
| Guru | A1–A3, A5 · 1 Command Center · 2 Dashboard Guru · 3 Headcount · 4 Prestasi · 5 Analitik Adaptif · 6 Analisa Item · 7 Video · 8 Kelas Saya · 9 Soalan by Chapter · 10 Monitoring · 11 Kirkpatrick · 41 Pelajar Saya · 42 Laporan · 43 Laporan Mingguan · 44 Sumbang Soalan |
| Admin Sekolah | A5 · 1 Command Center · 3 Headcount · 4 Prestasi · 5 Analitik Adaptif · 6 Analisa Item · 7 Video · 10 Monitoring · 11 Kirkpatrick · 45 Sekolah Bersaing · 46 Statistik Penggunaan · 47 DSKP Heatmap · 48 Laporan Aktiviti · 49 Amaran Awal · 50 Laporan Bulanan · 51 Senarai Pelajar · 52 Senarai Guru · 53 Kelas Sekolah |
| Admin Pusat | Every admin capability needed to feed, manage and monitor the modules above ([30-admin-pusat.md](30-admin-pusat.md)). |

- **FR-X2-0 Fully working, no placeholders (user, 2026-11-04: "apa2 yang tersenarai dalam Matriks-Akses-Peranan.xlsx mesti berfungsi. tiada pratonton, akan datang … fully working and functional").** Every module ticked for a role in the matrix must be **fully functional on real data**. These are **forbidden** on any matrix module:
  - preview or prototype pages ("Pratonton", "belum tersedia dalam prototaip/demo", `PrototypeUnavailablePage`)
  - "akan datang" or "coming soon" states
  - mock or demo-only data paths
  - dead buttons or links
  - screens that render only a title
  - menu items that open 403/404 or another role's screen

  An empty state is allowed **only** when the user genuinely has no data yet (for example "Belum ada laporan"), and it must offer the next action. A module that cannot meet this rule blocks the release; it is never shipped as a placeholder.
- **FR-X2-1 Delivery order (D100, D106).** Every ticked module must be fully working. "Phase" in this PRD means **delivery order only, never less scope**:
  - **Phase 1 = the 1.0 columns** (+ Latih Tubi for Murid), **plus every module that a Phase-1 screen links to** (D106). This includes Murid 20 Artikel, 26 Set Soalan Guru, 33 Papan Pendahulu, and any other module linked from a Phase-1 screen, as listed in each part.
  - **Phase 2 = the rest of the ticked modules:** Murid A4, 17–19, 22–25, 27–32, 34–36, 38–40 (where not pulled into Phase 1), Guru A4, Admin Sekolah A1–A4 and 2, plus the admin screens that feed them.
  - Until a Phase-2 module passes acceptance it is not linked from anywhere and not in any menu. It is never shown as a placeholder, and no Phase-1 screen links to it.
- **FR-X2-1a Listed exceptions (D102):** Cikgu Alesa (row 37, needs a real AI provider, D73) and Mohon Keluarga Angkat (row 15, D74) stay hidden. No other matrix module may be hidden at the end of Phase 2.
- **FR-X2-2 (D108-6)** A hidden module is unreachable by URL as well as by menu. A direct visit returns the **standard 404 page** ("Halaman Tidak Dijumpai"). It never shows a 403, a "belum tersedia" page or a feature-off message.
- **FR-X2-3** Every 1.0 module listed for a role appears in that role's sidebar in the order given by its PRD part, and opens a working screen. A menu item that opens 403, "Akses Ditolak", "belum tersedia" or another role's screen is a release blocker (P0).
- **AC-X2-1** Given each 1.0 role account on UAT, when every sidebar item is opened in turn, then every item opens a screen titled as in the PRD, with no 403/404/"Akses Ditolak" and no redirect to another role's screen.
- **AC-X2-2** Given each role account on UAT, when every matrix module and every button or link inside it is exercised in a **visible** browser, then none shows "Pratonton", "akan datang", "belum tersedia", a prototype or demo notice, a dead control, or mock data. Every action completes against the real API.
- **AC-X2-3** A repository check fails the build if a route of a matrix module renders `PrototypeUnavailablePage`, or if its module code contains the strings "akan datang", "belum tersedia", "dalam prototaip", "dalam demo" or "coming soon".
  - **Allowed-strings list** (the only exceptions):
    1. **"Pratonton"** used as an **admin preview or impersonation action** label (a button, a dialog title or a "Pratonton (baca sahaja)" link), never as a page that stands in for a missing module.
    2. Test files and fixtures (`__tests__`, `*.spec.ts`, `e2e/`).
  - Data-empty states must use wording that does not contain the banned strings, for example "Belum ada data" or "Tiada laporan lagi".

## X3. Secondary school only (D72, D96)

- **FR-X3-1** Active education levels are **Tingkatan 1–5** only. Darjah 1–6 are inactive and hidden from every picker, list, count and public statistic, for pupils and admins alike (D96).
- **FR-X3-2** The public statistic "Tahap" shows **5**. UAT currently shows **11**; this is a P0 data defect.
- **FR-X3-3 (D101)** Learning content (Latih Tubi, Soalan by Chapter, Topik, Peta Belajar) is served for **every Tingkatan T1–T5**, as in V2, wherever questions exist. The "Kandungan untuk Tingkatan anda akan datang" state is **removed**. A pupil whose level genuinely has no questions in a subject sees a real empty state for that subject only, never a level-wide "akan datang".
- **AC-X3-1** Given a T1 pupil and a T5 pupil on UAT, when each opens Latih Tubi and Soalan by Chapter, then each sees the subjects that have questions for their own level, with counts, and can start practice. Neither sees "akan datang".

## X4. Data and counts

- **FR-X4-1** Every number shown is computed from the owner module's dataset (D11, D12). The same concept shows the same number on every screen for the same scope and period. Definitions are fixed in [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) §5. Today the school-admin screens disagree (pupils 17/16/13, teachers 3/4, answers 122/30/36).
- **FR-X4-2** A count on a pupil surface shows what that surface can actually serve (D91). The admin "Dilihat murid di n/6" indicator must agree with what pupils actually receive. On UAT it shows 0/6 while Latih Tubi serves the questions, which is a defect.
- **FR-X4-3** "No data" is never shown as a negative result. For example, a pupil with no practice is "Tiada data", not "Berisiko Tinggi" (Amaran Awal), and a period with no activity is not "Penurunan 73.3%" (Kirkpatrick).
- **FR-X4-4** Each pupil sees **only their own** data on pupil screens. A pupil route that renders school-wide data (today Prestasi → Dashboard Sekolah) is a privacy defect and P0.
- **FR-X4-5 One answer store, one computation and one precision per metric (D-A1, D-A10).** Every pupil activity that answers questions writes each answer to the single answer store owned by practice, `practice_answers` (M05), with a **mode** value: Latih Tubi, Soalan by Chapter, SPM Databank, Kuiz, Bijak sittings including Tracking A, Subjektif and Kertas Subjektif self-marked results, Set Soalan Guru (`question_set`), Simulasi, Misi, Remedial / Ulang Kaji and question-based games. The exact mode values are in the API contract (API-PRAC-01) and the data model (50). Every report reads that one store and includes every mode: pupil Prestasi, Dashboard, Profil, Analisa Item, Heatmap, Remedial, Analitik; teacher and school-admin Prestasi, Laporan, Laporan Mingguan, Analisa Item, Command Center, Monitoring, Kirkpatrick; Admin Pusat Command Center, Monitoring, Analitik, Laporan and Kirkpatrick; Headcount AR (the modes HC-3 lists). A report that excludes a mode says so in its own caption. No report reads a separate Bijak aggregate for these figures (`practice_attempt_aggregates` stays a detail of the Bijak result screen). A self-marked part writes its marks awarded and marks available and counts as correct only when it earned full marks; changing a self-mark replaces the row, never adds one. Resubmitting an attempt never duplicates rows.

  **FR-X4 precision list** (the metric list; one computation, one display precision, on every screen of every role including Admin Pusat; XS ids are in `20-guru-admin-sekolah.md` §5):

  | Metric (BM label) | Computation | Display |
  |---|---|---|
  | Soalan Dijawab | XS-4: count of answer rows in `practice_answers`, all modes | whole number |
  | Soalan Diuji / Soalan Unik | XS-7: distinct `question_id` answered | whole number |
  | Ketepatan, Ketepatan Purata, Purata Ketepatan, Tahap Penguasaan, "betul" % on tiles | XS-5: pooled correct ÷ answered x 100 (never a mean of session accuracies); "—" with 0 answers; never above 100 | whole-number percent, rounded half up, on every screen (V2 pupil screens show whole numbers); the stored value keeps full precision |
  | Skor Purata (Kirkpatrick, Laporan) | mean of per-session accuracies, a separate named measure | whole-number percent, never labelled "Ketepatan" |
  | Pelajar berdaftar / aktif, Guru | XS-1 / XS-2 / XS-3 | whole number |
  | Headcount AR, OTR, grade, On Track | HC-SPEC in 20 R1-GUR-3 (AR in Auto mode is a whole number) | as HC-SPEC |
  | Penguasaan Subjek / mastery bands | thresholds table in X4b | as X4b |
  | Syiling per correct answer | admin setting "Syiling flat / soalan betul" (default 1), never a code constant (D-A11) | whole number |
  | Kesukaran (5 labels) | difficulty 1 to 5 stored on the question; (3 labels) 1-2 "Mudah", 3 "Sederhana", 4-5 "Sukar" | label |

  **AC-X4-1** Given a pupil with 10 Latih Tubi answers (7 correct) and one Bijak sitting of 40 MCQ marks (30 correct), then pupil Prestasi, teacher Prestasi Kelas, school-admin Prestasi and the Admin Pusat Laporan for that pupil all show "Soalan Dijawab" 50 and "Ketepatan" 74, XS-7 is 50 when the 50 answered questions are all different, and the sitting is listed as one session.
  **AC-X4-2** Given three pupils of one class with 1, 2 and 7 answers of which 1, 1 and 4 are correct, then Ketepatan per pupil is 100, 50 and 57, and for the class 6/10 = 60 (pooled), not 69 (the mean of the three).

### X4a Source table (which activity feeds which figure)

Because every mode writes to `practice_answers` (FR-X4-5), the table has one rule: **Y = counted**. Exceptions are written in the report's own caption.

| Activity (mode value in API-PRAC-01) | Pupil Prestasi / Dashboard | Analisa Item (per question) | Heatmap / Analitik (per Bab / SP) | Teacher, AS, Admin Pusat reports, XS-4 / XS-5, Command Center | Headcount AR |
|---|---|---|---|---|---|
| Latih Tubi, Soalan by Chapter, Databank, Kuiz, Remedial, Misi, Set Soalan Guru (`question_set`), PKSK, question-based games | Y | Y | Y when the question has Bab / SP | Y | Y for the modes HC-3 lists |
| Bijak / Simulasi sittings, Tracking A, Subjektif and Kertas Subjektif (objective and self-marked parts) | Y (sitting also listed as one session) | Y | Y when the question has Bab / SP | Y | Y for the modes HC-3 lists |

Every other figure derived from these rows (sessions, streak, coins, XP) follows its owner module. Where a screen shows a Bijak unit ("sesi", "kertas") it is a count of sittings, not of answers.

### X4b Mastery band thresholds (intentionally different per screen, V2; do not unify)

| Screen | Bands |
|---|---|
| Prestasi, Penguasaan Subjek | green at least 80, amber 60-79, red below 60 |
| Heatmap Topik Lemah | red below 50, amber 50-79, green at least 80, grey "Belum cuba" |
| Analitik Adaptif (SP) | Mahir at least 75, Sederhana 50-74, Lemah below 50, "Belum cuba" |
| Analisa Item (pupil) | accuracy pill red below 60; Pemulihan: at least 2 attempts and 0 correct; Pengukuhan: at least 2 attempts and some correct |
| Remedial | card when pooled accuracy is below 60 (target 60) |
| Analisa Item (teacher, per question) | per `20-guru-admin-sekolah.md` (70 / 40 bands) |

These differ on purpose because each follows its V2 screen; a developer does not merge them.

## X5. Environments and data reality

| Environment | Purpose | Data |
|---|---|---|
| Local stack (`npm run stack:up`, port 5192/5193) and CI | Development and automated tests (unit, integration, e2e in CI). **Not an acceptance environment (D110).** | Demo/e2e seed, for automated tests only. |
| UAT (uat.prestasiplus.cloud) | **The only acceptance environment** (D110) | A clone of V2 production data (±339k questions, 24,163 publicly counted), with real pupil data. This is where 1.0 is accepted. Evidence stays in the gitignored `.evidence/`; never committed; issues and PRs carry only pass/fail and IDs, never names. |
| V2 / V1 production | Reference only | Read-only. Never written to. |

- **FR-X5-1** Every P0/P1 acceptance criterion is verified on **UAT** (a clone of V2 production data) in a visible browser at 375/768/1280. There is no local acceptance environment, no UAT dump, no anonymised local restore and no synthetic acceptance profile (D110); the demo/e2e seed is for automated tests in CI only.
- **FR-X5-2** The local stack builds and starts with **no manual step**. Today the e2e seed step fails (`blueprint 3472/2 does not pass the Sahkan checks (NO_QUOTA, NO_KBAT)`) and the API does not start on its own. P0 for the development plan.
- **FR-X5-3** One-off data operations on UAT (Disahkan contracts, papers, Bab/SP mapping, Darjah deactivation) are delivered as reviewed scripts or admin-UI runbooks. Script operations are run only by the designated UAT developer (D95, D110: no AI session acts on a server): dry-run, report, the user's explicit approval, then the real run. Content work (Bab mapping, figure images, regrouping) is done by ADMIN users in the Portal Pentadbiran; scripts may only produce dry-run reports or assist bulk actions an admin confirms in the UI. D95: blueprints on UAT are created by an admin in Kontrak, not seeded.

## X6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 Responsive | Every screen works at **375 / 768 / 1280 px** with no horizontal page scroll (project rule §7). See X6.1 for the detailed rules. The user reported on 2026-11-04 that some V3 screens are still bad, **especially the question-paper screens**. |
| NFR-2 Language | All UI copy in Bahasa Melayu, quoted exactly from V2 (or V1). New copy needs the user's approval (D94). |
| NFR-3 Accessibility | Replicates V2/V1 (D10). No regressions: labels on form controls, visible focus, touch targets usable on mobile. |
| NFR-4 Performance and rate limits | Normal admin navigation (one page every 2–3 s) never hits HTTP 429. Today fast navigation shows "Ralat" on Kurikulum/Subjek/Tahap/Set Builder. Limits are tuned per route group. A 429 shows a retry message, never an empty "Ralat" screen (ERR-RATE-01). The numeric limits are fixed in §X10.8: login 5 attempts per 60 s per identifier and address, 20 failed logins per 60 s per address, 100 failed logins per 15 min per identifier; global API ceiling 300 requests per minute per client; intake writes 20 per minute and reads 240 per minute per user, 10 files per batch, 5 active batches, 500 pages per day, 2 parallel uploads; question reports 20 per reporter per Malaysia day; server timeouts 120 s request, 60 s headers, 65 s keep-alive; client timeouts 30 s (JSON), 60 s without upload progress, 125 s (export and import). |
| NFR-5 Privacy | No real person's name in docs, seeds or code. Pupils never see another pupil's personal data (X4-4). A pupil is shown to other pupils by the **display name = first name only, with no school**; the full name is shown only to the pupil's own teachers, the school admin and Admin Pusat. A pupil cannot change Tingkatan, school or role through `PUT /api/me`. |
| NFR-6 Feature flags | ALESA AI (D73) and Keluarga Angkat (D74) stay hidden in 1.0. |
| NFR-7 Errors | Every list and form has defined loading, empty and error states with BM copy. No silent failures. For example, intake "Sedang diproses" must time out with an error (ERR-INT-05, 90 s per page, 15 min per batch). The rules, the exact BM copy and the ERR catalogue are in §X10; the shared option sets are in §X11. |

### X6.1 Responsive across devices (mandatory for every 1.0 screen)

Target devices: phone **375×667** (and 360 wide), tablet **768×1024** portrait and landscape, laptop **1280×800**, desktop **1440+**. Touch and mouse.

- **FR-X6-1** No horizontal page scroll at any target width. Wide content (tables, diagrams, long equations) scrolls or zooms **inside its own container**, never the page.
- **FR-X6-2** Text stays readable without zoom. On phone, body and question text is ≥ 14 px, and secondary labels (KPI captions, chips, table meta) are ≥ 12 px; nothing is smaller. No text is clipped or overlapping, and question text, options and labels are never truncated. Every part of the PRD uses these same thresholds.
- **FR-X6-3** Touch targets ≥ 44×44 px on touch devices, with enough spacing so neighbouring options are not hit by mistake.
- **FR-X6-4** Data tables on phone either become stacked cards or keep the key columns with horizontal scroll inside the table only. Primary actions stay reachable.
- **FR-X6-5** Forms on phone: one column, labels above fields, the on-screen keyboard does not hide the active field or the submit button, and sticky action bars do not cover content.

**Question-paper screens** (pupil: Bijak SPM / Simulasi sitting, Latih Tubi and Soalan by Chapter quiz, Databank, result and review; admin: Studio question editor and preview, intake review, Set Builder / paper editor, paper preview):
- **FR-X6-6** Stimulus groups (FR-X1-4): on phone the stimulus is shown once above its questions and stays reachable while the pupil answers those questions, through a collapsible sticky panel or a "Lihat Rajah" toggle. It never pushes the answer area off-screen permanently.
- **FR-X6-7** Diagrams, graphs and tables in questions fit the width by default and can be **zoomed or opened full-screen** (pinch or tap). Labels inside figures stay legible.
- **FR-X6-8** Answer inputs (MCQ options, short answer, the maths working/final input of D41, file or photo upload) are full-width and usable with the on-screen keyboard. The timer, question navigator and Hantar stay reachable without covering the question.
- **FR-X6-9** Question navigation on phone: a compact navigator (for example a drawer or bottom sheet listing question numbers with their answered/flagged state) replaces wide desktop grids.
- **FR-X6-10** Paper view (admin preview and pupil cover): sections, parts and marks are readable on phone, and long papers keep their place on rotation.
- **FR-X6-11** Admin editors (Studio, intake review with the PDF pane, Set Builder): on tablet and phone the two-pane layout (PDF/source | editor, bank | paper) becomes tabs or stacked panes with a clear switch. Nothing is cut off or overlapped.

**AC-X6-1** For every 1.0 screen and every question-paper screen above: at 375, 768 and 1280 px, the page has no horizontal scroll (`document.documentElement.scrollWidth <= window.innerWidth`). No text or control is clipped or overlapped, every action can be reached and used, and a screenshot at each width is attached to the task as evidence.
**AC-X6-2** Given a Bijak SPM paper with a stimulus group (one figure + 3 questions) on a 375 px phone, when the pupil answers the 3 questions, then the figure is shown once and can be viewed while answering each of them, the figure can be zoomed, and the answer input, navigator and Hantar stay usable.

## X7. Verification protocol (how a requirement is proven)

A module or task is **done** only when all of these hold:

1. **Functional test (D110):** unit/integration tests and CI (lint, typecheck, test) are green; then every AC for the module passes **on UAT** (a clone of V2 production data) in a visible browser at 375/768/1280. There is no local acceptance step. The evidence is the CI run plus UAT screenshots kept in the gitignored `.evidence/` (UAT holds real pupil data: never committed; issues and PRs carry only pass/fail and IDs, never names).
2. **Side-by-side with the reference:** the V3 screen and the V2 (or V1) screen are captured at the same width and compared by the Delivery Lead. Every difference is either fixed or listed as a fidelity deviation.
3. **No regressions:** type-check, lint and the targeted unit tests are green. Every 1.0 sidebar item still opens (AC-X2-1).
4. **User review:** the user sees the result of the phase before the next phase starts.

Evidence capture rules: V1/V2 are read-only, one browser at a time, at least 3 s between pages. The V2 server blocks an IP after rapid scripted access (observed 2026-11-03).

## X9. End-to-end data chains

Each chain follows **one data record** from the place it is entered to every screen and process that must show or use it, across portals. Each is one Playwright spec (plan card S9-T06) that CI runs on the CI seed as an automated check, and whose **acceptance run is on UAT** (a clone of V2 production data, D110) in a visible browser at 1280 px with a 375 px pass of the pupil steps; it must pass before the modules it crosses are Done (FR-X1-5). Unless stated, the pupil is a new test pupil (no earlier answers) created for acceptance (U-OP-12), the Syiling rate is the default 1, and the school, class and pupil are the acceptance accounts; test records are removed afterwards (U-OP-14). Evidence stays in the gitignored `.evidence/`; reports carry only pass/fail and IDs, never names. Values are exact; "same number" means identical under the FR-X4 precision list.

**AC-CHAIN-1 Question group to every report.** Given the admin creates in the Studio wizard the stimulus group "Rajah 3" with 3 MCQ (Sains, Tingkatan 4, Bab 2, one SP, TP 3, difficulty 3), approves and publishes them, then: (a) a publish attempt of a fourth question with no Bab, in a subject and Tingkatan that have chapters (Sains T4 does), is refused with the gate list naming Bab (a subject and Tingkatan without chapters does not list the Bab item). SP, TP and aras are required by the gate only where DSKP nodes exist for the subject (D112-3): Sains T4 has DSKP nodes, so the same refusal also names any of SP, TP or aras that the question lacks, whereas a subject with no loaded DSKP nodes lists none of the three and publishes without them; (b) the T4 pupil's Latih Tubi Sains with 10 questions serves the 3 together with "Rajah 3" shown once; (c) Soalan by Chapter shows Bab 2 with "3 soalan"; (d) the pupil answers 2 right and 1 wrong. Then: pupil Prestasi tile "Sesi Kuiz" (sessions) = 1, "Soalan Dijawab" 3, "Ketepatan" 67; Analisa Item lists the wrong one under "Isyarat Awal" and "Soalan Dijawab" 3; the Heatmap Bab 2 tile reads "3 cuba · 67% betul" (amber); the teacher's Prestasi Kelas for the class of that pupil shows "Soalan Dijawab" +3 and XS-7 +3; the school-admin Prestasi shows the same +3; Admin Pusat Laporan shows +3 answers and +1 session for the window; the wallet is +2 Syiling and +20 XP (2 correct x rate 1; 10 XP each).

**AC-CHAIN-2 Paper PDF to a pupil sitting and every report.** Given the admin uploads a paper PDF (Sains, T4, Kertas 1) with Bahagian A of 10 items, Bahagian B of 5 items, and items 5 to 8 sharing "Rajah 3", accepts all 15 and uses "Hantar untuk semakan", then one draft paper with 2 sections and 15 placements exists, items 5 to 8 adjacent in one section, listed in "Kertas Diimport" with "Bilangan Soalan" 15; after "Semak & Terbit" under a Disahkan contract it is listed to a T4 pupil in Bijak. The pupil sits it: "Rajah 3" shows once for items 5 to 8; the pupil answers all 15 with 12 correct and presses Hantar twice. Then: `practice_answers` holds exactly 15 rows of mode `simulasi` (12 correct); the result shows "12 / 15"; pupil Prestasi "Soalan Dijawab" 15 and "Ketepatan" 80 with the sitting listed once with its Bijak label; the teacher and school-admin Prestasi and Admin Pusat Laporan show +15 answers; the wallet is +12 Syiling and +120 XP.

**AC-CHAIN-3 Bijak lanes: Tracking A and Subjektif.** Given a complete Tracking A set of 40 MCQ, when the pupil answers 30 correctly, then 40 rows of the Tracking A mode exist, "Soalan Dijawab" is +40, "Ketepatan" is 75 for this pupil, the hub "Prestasi SPM Anda" counts one session, and Headcount AR (Auto, Sains config) includes the 40 rows when HC-3 lists the mode. Given a Subjektif part of 4 marks, when the pupil submits and self-marks 3 through `POST /api/bijak/attempts/:id/self-mark`, then one row holds 3 awarded of 4 available (not counted correct), the Prestasi session list shows "3 / 4" and the wallet gains 3 x rate in Syiling + 30 XP; when the pupil changes the self-mark to 4, then the same row updates (still one row), counts as correct, and the wallet gains only the delta of 1 mark (+1 Syiling, +10 XP).

**AC-CHAIN-4 Class, Set Soalan, results.** Given the teacher creates class "4A" and adds pupil P1, and class "4B" with pupil P2, then P1's Kelas Saya lists 4A, the teacher and the classmates by first name only (no surname, no school), has no "Masukkan Kod Kelas" or "Sertai", and P2 does not see 4A. Given the teacher builds a set of 5 approved questions, where the question list includes one member of a 2-question stimulus group without its sibling, then saving is refused (422, `fields.questionIds`); with both members selected it saves, and the teacher assigns it to class 4A only. Then P1 sees the set in Set Soalan Guru, P2 does not, and P2 opening the set id gets 404. P1 answers the 5 questions with 4 correct: 5 rows of mode `question_set` exist, the teacher's set results show Penyertaan 1 and Skor Purata 80, class Prestasi +5 answers and the school-admin Prestasi +5.

**AC-CHAIN-5 Headcount from key-in to every view.** Given the teacher sets for Sains in class 4A TOV 40 and RS/ETR 80 with 3 OTRs in an Auto config ("Simpan Sasaran"), and the pupil has answered 10 Sains questions with 6 correct, then the teacher's table shows OTR1 53, OTR2 66, OTR3 80, AR 60, "Jurang +40" and pupil status "Below"; the pupil's `/headcount` card reads "Active" and its detail shows the same targets, AR 60, "Belum capai sasaran", Keyakinan "Sederhana" and status "Below"; the school admin's read-only list and the Prestasi Headcount pill show "Below" for the same pupil; "{n} entri headcount" is the same count on all of them. When the pupil then answers 10 more Sains questions all correct (16 of 20), AR becomes 80, status "On Track", Keyakinan "Tinggi", and the teacher's "On Track" count rises by 1 on Dashboard Headcount and the class dashboard.

**AC-CHAIN-6 Teacher question to the pupil.** Given the teacher submits through Sumbang Soalan one MCQ (Sains, Tingkatan 4, 4 options, 3 stars), then the teacher's list shows it "Menunggu Semakan" and the admin's "Kiriman Guru" lists it with source guru. Given the admin opens it in the Studio wizard (Subjek, Tingkatan, options and key prefilled), then Terbitkan is refused while Bab, SP or TP is empty and accepted after the admin sets Bab 2, an SP and TP 3. Then the teacher's list shows "Diluluskan"; a T4 pupil's Soalan by Chapter Bab 2 counts it ("1 soalan" more); after one pupil answers it the teacher's "Digunakan" rises per its definition in R1-GUR-44; a question the admin has not completed is shown to no pupil.

**AC-CHAIN-7 Support ticket.** Given a T5 pupil creates a ticket with Subjek "Tidak boleh buka kertas" and a Butiran, then it is listed to the pupil as "Dibuka" and to the admin in `/admin/tiket` with the role "Murid" and the pupil's school. Given the admin saves a reply and a status, then the pupil's ticket list shows the reply under "Balasan Sokongan" and the new status label with no reply box; the pupil of another school requesting that ticket id gets 404; the same flow with a teacher and a school-admin account shows the role "Guru" / "Admin Sekolah" in the admin queue.

**AC-CHAIN-8 School, quota and users to role visibility.** Given the admin creates a school with a seat limit of 30 pupils and an Admin Sekolah account, and that school admin logs in, then the school admin imports a file of 31 pupils and the whole file is refused with "Kuota penuh! Sila tingkatkan kuota dahulu."; a file of 30 imports (pending approval until Admin Pusat approves) and XS-1 is 30 on the school-admin dashboard and in Admin Pusat. A teacher created by the school admin can log in at once. A pupil can log in with the identifier, a password of 7 characters is refused and 8 accepted; the pupil sees exactly the pupil menu, `/admin` and `/prestasi/sekolah` are refused, a hidden module returns the standard 404 page, `PUT /api/me` with another `grade` or `schoolId` leaves the stored values unchanged, and a pupil of another school requesting this pupil's record gets 404; the school admin sees only the 30 pupils of its own school.

**AC-CHAIN-9 Coins to redemption.** Given the admin Syiling rate is 1, a pupil with 7 of 10 correct in Latih Tubi gains 7 Syiling and 70 XP; the admin sets the rate to 3 and the next 7 of 10 gives 21 Syiling; the Papan Pendahulu tab "Minggu" of the class shows the pupil's first name with 28 Syiling for the period. Given a pupil with 120 Syiling at tier Gangsa (50 : 1) converts 100, then the pupil has 2 tokens and 20 Syiling. Given a gift priced 2 tokens, the pupil redeems it, then tokens are 0, "Tebusan Saya" shows "Menunggu", the admin queue lists it, and after the admin pastes the code the pupil sees "Dihantar" with the code; a second redemption that the admin cancels shows "Dibatalkan" and the tokens are refunded exactly once.

**AC-CHAIN-10 Kuiz and game answers reach every report.** Given a new test pupil (T4, no earlier answers), the Syiling rate 1, `games_award_syiling` = Tidak, and two other test pupils in the same class. (a) The pupil starts "Simulasi — Kuiz" of 5 objective questions, presses "✓ Semak" on all 5 (3 correct): `practice_answers` holds 0 rows and the wallet is unchanged; pressing "Tamat" twice then gives exactly 5 rows of mode `kuiz` (3 correct), the wallet +3 Syiling and +30 XP once. (b) The pupil plays a Battle of 5 questions against a second human pupil and answers 4 (3 correct) and times out on 1: 5 rows of mode `battle` exist for this pupil (3 correct, one with a null option) and 5 for the opponent; the winner gets XP only (no Syiling); a replay of one answer adds no row. (c) The pupil plays a Quick Match with no human for 30 s: the opponent shows "Robot PrestasiPlus", 5 rows of mode `battle` (3 correct) exist for the pupil only and no standing changes. Then: pupil Prestasi "Soalan Dijawab" = 15, "Ketepatan" 60 (9 of 15), "Sesi Kuiz" = 1 (the Kuiz; games add none); Analisa Item lists the 6 wrong answers' questions; the teacher's Prestasi Kelas and the school-admin Prestasi show +15 answers for the pupil and the Admin Pusat Laporan +15 answers and +1 session for the window; the teacher "Soalan Diuji" counts the distinct questions; the leaderboard shows the human Battle only. Evidence on UAT at 1280 px with a 375 px pass of the pupil steps. Source: [46-pupil-activity-flow.md](46-pupil-activity-flow.md) §9.7. Owner: plan card S9-T06, like AC-CHAIN-1 to AC-CHAIN-9 (one Playwright spec per chain).

## X8. Glossary

| Term | Meaning |
|---|---|
| Servable | A question that a pupil surface can draw (D80/D85: approved, plus the surface's own rules). |
| Kontrak / Blueprint | Per subject × paper rule set (sections, quotas, marks). *Disahkan* = verified; required for pupil-facing papers (D76). |
| Set Builder | The single V2 tool to assemble a paper from the bank and publish it (Terbit). |
| Stimulus group | One shared image or passage with its questions, shown once and moved as a unit (D90). |
| Bab / SP | Bab = textbook chapter (the only word used; never "Unit"); SP = Standard Pembelajaran from DSKP (under its Tajuk and SK). A question cannot be published without Bab when its Subjek and Tingkatan have chapters, nor without SP and TP / aras where DSKP nodes exist for the subject (admin gate, D112-1 and D112-3); the admin work-list "Soalan tanpa Bab" lists legacy questions without one. Used by Soalan by Chapter, Topik, Peta Belajar, Heatmap and Analitik. |
| Display name | A pupil's first name only, no school; the only pupil name shown to other pupils. |
| Answer store | `practice_answers`, owned by practice (M05): one row per answered question, with a mode value; the only source of every answer-based figure (FR-X4-5). |
| Difficulty / TP | Kesukaran (difficulty, 1 to 5) and TP (1 to 6) are two separate typed fields; Kesukaran is pre-filled with min(5, TP) until the admin touches it (D113). The three display labels Mudah / Sederhana / Sukar are derived from Kesukaran (1-2, 3, 4-5). Option sets OPT-TP and OPT-KESUKARAN in §X11. |
| P0 / P1 / P2 | Blocks 1.0 / important for 1.0 / polish, can follow 1.0. |
| D112 | Delivery Lead decisions of 2026-11-04 on the Bijak content and the question gate: (1) Bab required before Terbit when the Subjek and Tingkatan have chapters; (2) in-house Tesseract OCR, no external AI provider in R1, mock OCR only in CI; (3) DSKP is loaded for every SPM subject offered, and until it is loaded SP, TP and aras are required only where DSKP nodes exist, Kontrak only for loaded subjects; (4) content is entered by Admin users, first the six sample-paper subjects (BM, BI, Matematik, Matematik Tambahan, Fizik, Sejarah), Kertas 1 first; (5) Sunting Pantas is Fix; (6) no pupil Jana Kertas in R1 (tab hidden, routes answer 404), admin Jana Kertas stays; (7) Slice 0 (plan §5A). Recorded in `docs/TRACKER.md` and [00-index](00-index.md). |
| D113 | Delivery Lead decisions by principle, all final (the product owner delegated detail decisions): the single answer store with `mode`; stimulus group 1..n; 11 question types; MCQ 2 to 8 options (default 4); TP 1 to 6 and Kesukaran 1 to 5 separate; Kertas 1 to 4; the five status labels; pooled whole-number accuracy; coin rate as an admin setting; games with real pupils first and a labelled robot after 30 s; and every duplicate decision in [47-v3-duplicates-register.md](47-v3-duplicates-register.md). Text marked "(R1 decision D113)" is a requirement. |
| ID families (R1) | **FR-X** / **AC-X** this file. **FR-MUR**, **FR-GUR**, **FR-AS**, **FR-ADM** + **AC-** per module in 10, 20, 30. **R1-MUR-n**, **R1-GUR-n**, **R1-AS-n**, **R1-ADM-xx** module codes. **FR-QA-nn** / **AC-QA-nn** / **D-QA-n** question authoring flow ([45](45-question-authoring-flow.md)). **FR-PA-nn** / **AC-PA-nn** / **D-PA-n** pupil activity flow ([46](46-pupil-activity-flow.md)); its activity codes **B1 to B6** (Bijak lanes) and **D1 to D7** (drills); **FR-MUR-QP-n** / **AC-MUR-QP-n** question-paper screen rules. **GAME-00 to GAME-25**, **FR-GM-*** / **AC-GM-*** / **D-GAME-n** game and gamification specification ([48](48-game-and-gamification-spec.md)); **API-GAME-nn**. **ERR-xx** error catalogue (§X10; the 26 game errors **ERR-GAME-01 to ERR-GAME-26** live in 48 §3.8). **OPT-xx** option sets (§X11). **DM-nn**, **API-xxx-nn**, **INV-nn**, **ENT-xx** data model and API contract ([50](50-data-model-erd.md), [60](60-api-contract.md)). **XS-n** shared computations (20 §5). **HC-n** Headcount rules. **AC-CHAIN-n** end-to-end chains (§X9). **Sn-Tnn** plan cards, **U-OP-nn** UAT data operations, **D-n / Dnnn** decisions. The working names **DM-PA-nn** and **API-PA-nn** in 46 are renumbered by the data and API registration task (T5). |
| ERR / OPT | **ERR** = error catalogue row (one stable ID per user-visible failure: code, status, exact BM text, surface, action). **OPT** = option set (one stable ID per list of choices: stored value, BM label, order, default, the modules that use it). Neither is ever redefined in a module file; a module cites the ID. |
| "Duplicate" (six meanings) | The word is used for six different things; only the first five are defects. (1) **Menu or screen duplicate**: two menu items or screens for one function (register M-01 to M-11). (2) **Route or page duplicate**: two URLs or pages for one function (R-01 to R-05; R-05 is on purpose). (3) **Data-structure duplicate**: two tables or models for one concept (S-01 to S-07). (4) **Data-content duplicate**: the same content stored twice, such as a copied figure or a repeated stem (C-01 to C-04). (5) **Code or API duplicate**: two clients, endpoints or rules for one function (P-01 to P-07). (6) **Near-duplicate question detection**: the intake feature `DuplicateLink` and the report reason "Duplikasi" / "Soalan berulang / pendua"; a feature, not a defect. The form message "{Medan} sudah digunakan." (ERR-REQ-16) is a uniqueness error, not a duplicate in this sense. All 34 duplicates, their decisions and their CI rules are in [47-v3-duplicates-register.md](47-v3-duplicates-register.md). |

---

## X10. Error handling

Master copy of how every failure looks and behaves, for every role and every module. A module file never redefines an error text: it cites the ERR id of §X10.11 and quotes only a screen-specific text. Where a module quotes an exact V2 or PRD string that differs from the generic pattern (for example "Kategori diperlukan."), the quoted string wins on that screen and the ERR id is still cited. Source of the rules: the error-handling audit of 2026-11-04 (102 catalogue rows), decided by D113.

How it connects: [60-api-contract.md](60-api-contract.md) §1.4 carries the envelope and cites this section; [10-murid.md](10-murid.md), [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) and [30-admin-pusat.md](30-admin-pusat.md) cite ERR ids instead of inline strings; [45](45-question-authoring-flow.md), [46](46-pupil-activity-flow.md) and [48](48-game-and-gamification-spec.md) cite the same ids (the 26 game errors ERR-GAME-01 to ERR-GAME-26 are defined once in 48 §3.8 and follow the rules below).

### X10.1 API envelope and code rules

- **FR-ERR-1 Envelope.** Every error response has the shape `{ "error": { "code", "message", "fields"?, "details"?, "retryAfter"?, "requestId" } }`. `requestId` is always present (the exception filter guarantees it) and is also sent in the `x-request-id` response header. `message` is Bahasa Melayu and may be shown to the user.
- **FR-ERR-2 Two code families.** An envelope `code` is `UPPER_SNAKE` (for example `VALIDATION_ERROR`). A publish-gate or import issue code inside `details.gate[]` or `issues[]` is `lower_snake` (for example `chapter_missing`, `stimulus_group_split`, `stimulus_missing`, `figure_only`, `paper_empty`, `question_missing`). A new code is added to §X10.11 and to the contract in the same pull request.
- **FR-ERR-3 Generic codes and statuses.**

  | Code | HTTP | Meaning |
  |---|---|---|
  | `BAD_REQUEST` | 400 | malformed request; a body-parser error is answered 422 `VALIDATION_ERROR` instead (60 §1.4) |
  | `UNAUTHORIZED` | 401 | no valid session |
  | `FORBIDDEN` | 403 | role or scope not allowed |
  | `PASSWORD_CHANGE_REQUIRED` | 403 | the account must set a new password first |
  | `CSRF_INVALID` | 403 | CSRF header missing or wrong |
  | `NOT_FOUND` | 404 | unknown id, id outside the caller's scope, or hidden module |
  | `CONFLICT` | 409 | state conflict; module codes (for example `QUOTA_FULL`, `STALE_VERSION`) use 409 too |
  | `PAYLOAD_TOO_LARGE` | 413 | body or file over the limit |
  | `UNSUPPORTED_MEDIA_TYPE` | 415 | wrong file type |
  | `VALIDATION_ERROR` | 422 | invalid body or query; field texts in `fields` |
  | `RATE_LIMITED` | 429 | throttled; `retryAfter` in seconds and the `Retry-After` header |
  | `SERVER_ERROR` | 500 | unhandled exception |
  | `BAD_GATEWAY` | 502 | proxy upstream down (synthesised on the client) |
  | `SERVICE_UNAVAILABLE` | 503 | maintenance or overload |
  | `TIMEOUT` | 504 | proxy timeout (synthesised on the client; also the client's own 30 s / 125 s timeout) |
  | `NETWORK_ERROR` | 0 | no response at all (client only) |

- **FR-ERR-4 BM on the wire.** The default `message` of 401, 403, 404, 409, 422, 429, 500, 413 and 415 is the BM text of ERR-AUTH-01, ERR-ACC-01, ERR-ACC-02, ERR-CON-01, ERR-REQ-01, ERR-RATE-01, ERR-SYS-01, ERR-REQ-03 and ERR-REQ-04. No English default (for example "Not Found.", "Too Many Attempts.") may reach a user, in the real API or in the mock. The frontend shows the server `message` for a module code (it is BM); for a generic code it shows the §X10.11 text.
- **FR-ERR-5 Unmapped statuses.** A 4xx the server does not map (405, 408, 410, 415 and similar) keeps its status with code `BAD_REQUEST`, `UNSUPPORTED_MEDIA_TYPE` or `PAYLOAD_TOO_LARGE`; it is never answered as 500 and never logged with a stack. Only a non-HTTP exception or a 5xx is `SERVER_ERROR` with a stack in the log.
- **FR-ERR-6 Frontend error object.** The frontend `ApiError` carries `status`, `code`, `message`, `fields`, `details` and `requestId`. The codes `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, `PAYLOAD_TOO_LARGE` and `UNSUPPORTED_MEDIA_TYPE` are synthesised from the statuses 502, 503, 504, 413 and 415 when the body has no envelope.

### X10.2 Status to behaviour (default; a screen overrides only where its ERR row says so)

| HTTP | Code | Behaviour |
|---|---|---|
| 400 | `BAD_REQUEST` | treated as 422 with ERR-REQ-02 (developer error, logged) |
| 401 | `UNAUTHORIZED` | ERR-AUTH-01 session flow (X10.3.1). A login form never shows it: wrong credentials are 401 `INVALID_CREDENTIALS` (ERR-AUTH-02) |
| 403 | `FORBIDDEN` | ERR-ACC-01: full page "Akses Ditolak" for a route; toast for an action on an open screen |
| 403 | `PASSWORD_CHANGE_REQUIRED` | ERR-AUTH-07: redirect to the forced password-change screen |
| 403 | `CSRF_INVALID` | ERR-AUTH-06: dialog, reload |
| 404 | `NOT_FOUND` | route-level record or hidden module: full page "Halaman Tidak Dijumpai" (ERR-ACC-02); action on an open screen: toast ERR-ACC-04 |
| 409 | `CONFLICT` and module codes | ERR-CON-* or the module row; toast or inline per the row; input kept |
| 413 | `PAYLOAD_TOO_LARGE` | ERR-REQ-03 (inline at the file field, toast for a non-file body) |
| 415 | `UNSUPPORTED_MEDIA_TYPE` | ERR-REQ-04 (inline at the file field) |
| 422 | `VALIDATION_ERROR` and module codes | ERR-REQ-01: field errors inline from `fields`, else the screen's message region; first invalid field focused |
| 429 | `RATE_LIMITED` | ERR-RATE-01: inline banner on the section that failed, with countdown from `retryAfter`; never an empty "Ralat" |
| 500 | `SERVER_ERROR` | ERR-SYS-01: toast for an action; in-place error panel for a failed load; full page for a failed route boot. `Rujukan` shown |
| 502 / 504 | synthesised | ERR-SYS-02 / ERR-SYS-04: as 500; GET requests are retried automatically (X10.3.4) |
| 503 | `SERVICE_UNAVAILABLE` | ERR-SYS-03: maintenance page when it comes from the page boot, toast otherwise. A module 503 code (`GENERATE_LIMIT`) uses its own row |
| 0 | `NETWORK_ERROR` | ERR-NET-01: offline banner plus the per-action message |

### X10.3 Global behaviours

**X10.3.1 Session expiry (401).**
- **FR-ERR-7** A 401 on any non-auth route clears the session and redirects to `/login?kembali={path+query, URL-encoded}`. Only a same-origin path is accepted as `kembali`; anything else is ignored. The login page shows the banner "Sesi anda telah tamat. Sila log masuk semula." After a successful login the user goes to `kembali` if the role may open it, otherwise to the role home. One redirect per 401 burst (debounce 2 s); the other in-flight requests are aborted.
- **FR-ERR-8 Unsaved work is kept.** A form with edits writes a draft copy to `sessionStorage` under the key `pp.draft.{routeName}.{recordId|new}` (at most 200 KB; removed after a successful save and on logout). After re-login the same form restores it and shows the V2 notice "Terdapat kerja yang belum disimpan daripada sesi sebelum ini." in the same screen element for every restored draft (V2 Studio create and edit). A Bijak attempt already mirrors itself under `pp.bijak.local.{attemptId}`; during a timed attempt a 401 opens the dialog of ERR-AUTH-01 and does not redirect until the pupil confirms.

**X10.3.2 403 versus 404 (FR-X2-2).** A hidden module, an unknown id and an id outside the caller's scope all answer 404 with the same page and the same copy, and the page never shows `Rujukan`; the interface never tells "hidden" from "unknown". A visible module the role may not use answers 403. **AC-ERR-1** Given an anonymous visitor and each role requesting the URL of a hidden module, then each sees the identical 404 page.

**X10.3.3 Offline and online banner (ERR-NET-01 to ERR-NET-03).** A global banner component shows when `navigator.onLine` is false or when two consecutive `NETWORK_ERROR` results occur within 10 s. It is sticky at the top, `role="status"`, and on a phone it overlays and does not push the layout. When the connection returns it reads "Sambungan dipulihkan." for 3 s, queued retries run, then it hides.

**X10.3.4 Timeouts, retries and server limits.**

| Rule | Value |
|---|---|
| Client request timeout, JSON | 30 s, then `NETWORK_ERROR` subtype `TIMEOUT` (ERR-NET-02), by `AbortController`; a caller-supplied signal wins |
| Client timeout, file upload | no total timer; abort when there is no progress event for 60 s |
| Client timeout, export or blob download, and import calls | 120 s plus 5 s margin = 125 s |
| Automatic retry | GET and HEAD only, on `NETWORK_ERROR`, 502, 503, 504 and 429 (429 only when `retryAfter` is at most 10). At most 2 retries, after 1 s and 3 s, each with 20 % jitter; the counter resets on a user action. 4xx (other than that 429) and 500 are never retried automatically |
| Automatic retry of writes | never, except two engines that are idempotent: Bijak answer autosave (debounce 800 ms, retry every 5 s until success) and Bijak submit (on the `online` event and every 30 s, only for `NETWORK_ERROR`, 502, 503, 504 and timeout; any other error stops the loop, ERR-SAVE-03) |
| Manual retry | every failed load shows `Cuba Semula`, which re-issues the same request |
| Server timeouts | `REQUEST_TIMEOUT_MS` 120000, `HEADERS_TIMEOUT_MS` 60000, `KEEP_ALIVE_TIMEOUT_MS` 65000, `SHUTDOWN_GRACE_MS` 25000 |
| Global API rate limit | 300 requests per minute per client (fixed 60 s window) |

**X10.3.5 Idempotency.** There is no generic `Idempotency-Key` header in R1. The existing idempotent writes stay: practice `clientUuid`, Bijak submit (`idempotencyKey` = `{attemptId}-hantar`), Kuiz finish. Every other create (tiket, kelas, set, import) is protected by the double-submit lock (X10.3.6) and the server's own uniqueness rule (409). **FR-ERR-9** A POST that moves Syiling, tokens or points (redeem, convert tokens, claim) is idempotent per `(userId, clientUuid)`, so AC-CHAIN-9's refund-once rule holds.

**X10.3.6 Double-submit lock and optimistic updates.**
- **FR-ERR-10** On the first activation of any submit, save, delete, redeem or publish control the control is set `disabled`, `aria-busy="true"` with a spinner and the label "Sedang diproses..." (or the screen's own progressive label such as "Menyimpan..."). It is re-enabled only when the request settles (success: navigate or reset; error: restore). Enter and a double-click are ignored while busy. Dialog confirm buttons follow the same rule.
- **FR-ERR-11** There is no optimistic UI except (a) autosave of answers, (b) the "Ditanda" flag and (c) read-state toggles. On a failure of (b) or (c) the control reverts and the toast ERR-SAVE-04 shows. Every other action waits for the server, then the list is refetched; there is no local cache surgery.

**X10.3.7 Which surface shows an error.**

| Surface | Use for | Specification |
|---|---|---|
| Inline field error | 422 `fields`, client validation | under the control, `aria-describedby`, red text with an icon, never colour only |
| Inline region or banner | failed section load, 429, quota, gate list (QE-04 panel), partial import errors | inside the card or section, with `Cuba Semula` where retry makes sense; `role="alert"` for errors, `role="status"` for information |
| Toast (error) | failed action on a screen that is still usable (409, 403 on an action, 5xx on save, 404 on an action) | top-centre below 768 px, top-right otherwise; an error toast stays 8 s (hover or focus pauses it), a 5xx toast stays until dismissed and shows `Rujukan`; a success toast stays 3 s; at most 3 stacked; the same code and message within 5 s merge; `role="alert"` |
| Dialog | a decision or a login is needed: session expired in a timed attempt, CSRF, stale edit (409 `STALE_VERSION`), destructive confirm | focus trap, primary and secondary button, Esc = secondary |
| Full page | the route cannot render: 403, 404, 500 on route load, maintenance, boot failure | X10.3.8 |
| Never | `alert()`, silent failure, an empty "Ralat" screen, raw English text, a stack or JSON | NFR-7 |

**X10.3.8 Error pages (exact BM).** One shared `GlobalErrorPage` layout: code chip, title (h1), body, buttons (44 px), optional line `Rujukan: {requestId}` with the button `Salin`; no horizontal scroll at 375, 768 and 1280 px.

| Page | Chip | Title | Body | Buttons | `Rujukan` |
|---|---|---|---|---|---|
| 404 (also hidden module, unknown id, out-of-scope id) | 404 | Halaman Tidak Dijumpai | Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip? | `Halaman Utama` (role home; `/` when signed out). Murid only: also `Mula Latihan` (to `/practice`) | never |
| 403 | 403 | Akses Ditolak | Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir. | `Halaman Utama`; `Log Keluar` | never |
| 500 | 500 | Ralat Pelayan | Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi. | `Halaman Utama`; `Cuba Semula` (reload the current route) | shown when known |
| Maintenance | 503 | Penyelenggaraan Sedang Dijalankan | Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit. | `Cuba Semula` | shown when present |
| Boot failure | none | Aplikasi gagal dimuatkan | Sila muat semula halaman. Jika masalah berterusan, cuba lagi sebentar nanti. | `Muat semula` | none (the app is not running) |
| New build (dialog, not a page) | none | (dialog) | Versi baharu tersedia. Sila muat semula halaman. | `Muat Semula` | none |

- The 404 button `Mula Latihan` is shown to Murid only, because `/practice` is a pupil screen (a staff link would open 403 or 404). **FR-ERR-12** The 403 and 500 copy above replaces the shorter strings in the shared copy file `src/ds/copy.ts`.
- The maintenance page shows when the session bootstrap `GET /api/session` answers 503 or after 3 consecutive 502, 503 or 504 on GET requests; it probes `GET /api/session` every 30 s and clears itself on success.
- A slow boot (20 s) shows "Mengambil masa lebih lama daripada biasa. Sila tunggu atau muat semula halaman."
- The new-build dialog shows when a lazy route chunk fails to load (ERR-SYS-06); the unsaved draft is written to `sessionStorage` first.

**X10.3.9 Logging and reference ID.**

| Rule | Specification |
|---|---|
| Server log | Every error response logs one line: `requestId`, status, `code`, route, user id when known, role. Level: 5xx `error` (with stack), 401, 403 and 429 `warn`, other 4xx `info`. User input text, tokens, passwords and e-mail addresses are never logged |
| Display | `Rujukan: {requestId}` with `Salin` shows on the 500 page, the maintenance page, every 5xx toast or panel, and ERR-SYS-*, ERR-EXP-* and ERR-IMP-* failures, followed by "Hubungi sokongan dengan nombor ini." It never shows for a 4xx user error, nor for 403 or 404 (no existence leak) |
| Support | The tiket form prefills nothing from an error; the user pastes the id. No new endpoint |

### X10.4 Forms

- **FR-ERR-13 One generic message set.** The generic field messages are one pattern set, shared by [10-murid.md](10-murid.md), [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) (GLB-1) and [30-admin-pusat.md](30-admin-pusat.md). `{medan}` is the lower-case field label without the asterisk; `{Medan}` is the same with a capital letter.

  | Case | Text | ERR id |
  |---|---|---|
  | Required text | "Sila isi {medan}." | ERR-REQ-10 |
  | Required select or radio | "Sila pilih {medan}." | ERR-REQ-11 |
  | Too long | "{Medan} tidak boleh melebihi {n} aksara." | ERR-REQ-12 |
  | Too short | "{Medan} mesti sekurang-kurangnya {n} aksara." (password: "Kata laluan mesti sekurang-kurangnya 8 aksara.") | ERR-REQ-13 |
  | Format | "Format {medan} tidak sah." (e-mail: "Format e-mel tidak sah.") | ERR-REQ-14 |
  | Number range | "{Medan} mesti antara {a} dan {b}." | ERR-REQ-15 |
  | Duplicate (409) | "{Medan} sudah digunakan." | ERR-REQ-16 |
  | Several errors at submit | banner "{n} medan perlu dibetulkan." plus the inline messages | ERR-REQ-01 |

  A screen row that quotes an exact V2 or PRD string of another form (for example "Nama diperlukan.", "Kategori diperlukan.", "Tahun diperlukan.", "Pengisytiharan sumber diperlukan.", "Label bahagian diperlukan.") keeps that string; the pattern above is the default for every new field and the fallback when a row quotes nothing. A screen-specific range text such as "Tahap Penguasaan (TP) mesti antara 1 dan 6." or "Markah mesti antara 0 dan 100." is an instance of ERR-REQ-15.
- **FR-ERR-14 Server validation display.** `fields[path]` shows under the control whose `name` matches (a dotted path is an array index, for example `items.0.text`; a nested row shows the message on the row). An unmatched key goes to a summary banner at the top of the form. A 422 without `fields` shows its `message` in the banner.
- **FR-ERR-15 Client validation.** A form validates on submit and on blur (after the first blur) and re-validates on input once a field is in error. It uses the same texts as the server, so the two never differ. Client validation never replaces server validation.
- **FR-ERR-16 First-error focus.** On a failed submit (client or 422) the first invalid control in DOM order takes focus and scrolls into view with a 16 px margin below the sticky header, and a `role="alert"` region announces "{n} medan perlu dibetulkan."
- **FR-ERR-17 Input kept.** A failed submit keeps every typed value. A selected file is the exception: after 413 or 415 the file is picked again. Password fields are cleared after a 401 or 422 on the login form only.

### X10.5 Long-running work

**X10.5.1 Upload and request limits (one table; the contract constants are the source of the numbers, the error texts take `{n}` and `{jenis}` from them).**

| Item | Limit | Where it is specified |
|---|---|---|
| JSON request body (default) | 100 kB | all routes without a file |
| User import file (`.csv` or `.txt`, UTF-8) | 2 MB; the server limit of this route is raised from 1,100 kB to 2 MB so that the V2 text "maksimum 2 MB" is true | 20 Admin Sekolah import, 30 Import Pengguna |
| Question CSV | 5 MB and 2,000 data rows; whole file refused above either | 30 Q-11, 45 |
| Admin paper PDF and its scheme PDF | 30 MB each, 1 file each | 30 Q-08, 45 |
| Teacher paper submission (Hantar Kertas Soalan, PDF, DOCX, XLSX) | 1 to 5 files, 20 MB each | 20 Sumbang Soalan |
| Admin intake batch | 10 files per batch, 5 active batches, 500 pages per day, 2 parallel uploads, writes 20 per minute and reads 240 per minute per user | 30, 45 |
| Stimulus, option and Studio images (JPG, PNG, WebP) | 2 MB each | 45 |
| Pupil answer photo (JPG, PNG) | 5 MB each, up to 3 per part | 46 |
| Marketplace product images | up to 5 images, JPG, PNG or WEBP | 30 P2-12 |

**X10.5.2 Upload progress.** Per file row: name, size, a bar with "{n}%", `Batal`; on completion a tick and "Selesai"; on failure the ERR text and `Cuba lagi` (re-sends that file only). Several files upload with concurrency 2. Leaving the page during an upload asks "Muat naik sedang berjalan. Keluar sekarang?" with `Kekal` and `Keluar`.

**X10.5.3 Import and OCR job states.** `Menunggu` (queued), `Sedang diproses`, `Selesai`, `Selesai dengan ralat` (partial), `Gagal`, `Dibatalkan`. A page whose OCR runs over 90 s fails with `OCR_TIMEOUT`; a batch over 15 min becomes `Gagal` with `OCR_TIMEOUT`. The status is polled every 3 s for the first minute, then every 10 s, and stops at a terminal state. A batch with at least one accepted item and at least one failed page is `Selesai dengan ralat` and lists each failed page with its ERR-INT text. A retry is always user-initiated (`Cuba lagi` per failed page and for the whole batch), creates a new attempt on the same file, and is allowed 3 times per file; after that ERR-INT-11 shows.

**X10.5.4 Import row errors.** The result panel reads "{imported} baris berjaya, {n} baris gagal." followed by a table `Baris | Medan | Sebab` (at most 100 rows shown, then "dan {m} lagi") and the button `Muat Turun Ralat (CSV)`. Valid rows still import, except where a rule refuses the whole file (seat quota, missing header, row or size limit).

**X10.5.5 Exports.** The button reads "Menyediakan..." and is disabled until the download starts; timeout 125 s; failure is ERR-EXP-01 and an empty result is ERR-EXP-02; the file name comes from `Content-Disposition`; an export uses the same filters as the screen. The exports that exist in R1 are those listed in the module files (the Dashboard CSV downloads and the Eksport PDF of M-03 are not R1).

**X10.5.6 Notifications.** Sending a notification is asynchronous and never fails the user action. A failure is logged with the `requestId` (ERR-NOT-01); the user is not told. Admin Pusat sees `Gagal dihantar` per message only where a send status exists.

### X10.6 Answering and exams

- **FR-ERR-18 Autosave.** Debounce 800 ms, retry every 5 s until success. Status words (Bijak, V2 verbatim, lower case): `menyimpan…`, `disimpan`, `luar talian`, `gagal simpan`; other editors use `Menyimpan...`, `Disimpan`, `Luar talian`, `Gagal menyimpan`. If browser storage is unavailable, autosave still goes to the server and `gagal simpan` shows only when the server also fails. FR-MUR-13-10 states the same 800 ms.
- **FR-ERR-19 Timer and grace.** The timer is a convenience; the server clock decides. The timer re-synchronises on every successful save response and at 0 the client auto-submits (`auto: true`). Answers saved up to the deadline plus 30 s are counted. If the server answers `closed`, the pupil sees ERR-SAVE-05 and then the result. A submit sent by the timer or within the 30 s grace is accepted (this replaces "a late submit is accepted" in FR-MUR-13-11).
- **FR-ERR-20 Submit while offline.** For `NETWORK_ERROR`, timeout, 502, 503 and 504 the copy is "Luar talian. Jawapan anda disimpan pada peranti ini dan akan dihantar apabila sambungan pulih." and the banner "Belum dihantar" stays until sent. For other statuses: 409 `ALREADY_SUBMITTED` goes silently to the result; 403 or 404 show ERR-ACC-01 or ERR-ACC-02; 422 or 500 show ERR-SAVE-03 with `Cuba Semula`.
- **FR-ERR-21 Double submit.** A second submit with the same key returns the first result (200, same body); `ALREADY_SUBMITTED` is used only for a different key. The pupil sees the result screen, never an error.
- **FR-ERR-22 Practice answers (Latih Tubi, Soalan by Chapter, Databank, Kuiz).** Each answer POST is retried 3 times after 1 s, 3 s and 5 s; if it still fails the question stays on screen with ERR-SAVE-06 and the pupil cannot move on until it is sent or `Langkau` (skip, unanswered) is pressed. There is no local queue across reloads in R1.
- **FR-ERR-23 Two tabs or devices.** The later load wins reads; answers merge by `rev` (the higher `rev` wins per part). There is no lock and no message.

### X10.7 Concurrency

- **FR-ERR-24 Live question.** An edit of a live question creates a draft version n+1; if a draft or review version already exists the API answers 409 `CONFLICT` with `details.id` and `details.versionNo` (ERR-CON-02).
- **FR-ERR-25 Same draft, same paper.** Draft saves, status changes, publish, and Set Builder paper saves accept an optional `expectedUpdatedAt`; a mismatch answers 409 `STALE_VERSION` (a module code on `CONFLICT`, ERR-CON-02b). Last-write-wins is not allowed for question content. The field is optional, so existing clients keep working.
- **FR-ERR-26 No locks.** R1 uses optimistic versioning only; there are no pessimistic locks.

### X10.8 Rate limits and quotas

| Item | Value |
|---|---|
| Login, layer 1 | 5 attempts per 60 s per identifier and client address, counted before the password check (the 6th attempt answers 429 even with the right password); `THROTTLE_LOGIN_PER_MINUTE` |
| Login, layer 2 | 20 failed logins per 60 s per client address across identifiers |
| Login, layer 3 | 100 failed logins per 15 min per identifier across addresses; `retryAfter` 1 to 900 s |
| Global API | 300 requests per minute per client |
| Intake | writes 20 per minute and reads 240 per minute per user; 10 files per batch; 5 active batches; 500 pages per day; 2 parallel uploads |
| Question report | 20 new reports per reporter per Malaysia day (`QUESTION_REPORT_DAILY_CAP`); refreshing an open report is not new |
| Seat quota | an import above the remaining seats is refused whole with `QUOTA_FULL` (ERR-QUOTA-01) |
| 429 display | the UI uses `retryAfter` from the body, then the `Retry-After` header, else 30 s; the text is ERR-RATE-01 with "Cuba lagi dalam {s} saat." (minutes from 120 s: "{m} minit") and the retry button is disabled until the countdown ends |

### X10.9 One wording for the same meaning

| Concept | Use | Replaces |
|---|---|---|
| Generic load failure | ERR-SYS-01b "Tidak dapat memuatkan data. Sila cuba semula." with `Cuba Semula`; admin and staff list screens keep the V2 text "Gagal memuat senarai." with `Cuba lagi` | "Percubaan tidak dapat dimuatkan.", "Ralat semasa mencari bank soalan." and similar; the practice text "Maaf, terdapat masalah memuatkan kuiz ulang kaji." stays only for `NO_WRONG_QUESTIONS` |
| Retry button | `Cuba Semula` for retrying a failed request | `Cuba lagi` (kept only on the V2 admin lists and the OCR job rows), `Cuba Lagi` (kept only for a game or quiz replay and for a paper attempt, FR-MUR-13-15) |
| Rate limited | ERR-RATE-01 | the three English or near-duplicate variants |
| Save failed | ERR-SAVE-01 for the status line, ERR-SAVE-02 "{Tindakan} gagal. Cuba lagi." for action toasts | "Gagal menyimpan", "Susunan gagal disimpan - muat semula halaman dan cuba lagi." and the other one-off texts; the lower-case `gagal simpan` stays in the Bijak status line only |
| Publish errors | ERR-NET-01 and ERR-SYS-01 with the verb "menerbitkan"; the V2 texts "Ralat tidak dijangka semasa menerbitkan." and "Ralat rangkaian semasa menerbitkan." stay in Set Builder only (listed fidelity exception) | |
| Offline | ERR-NET-01 "Anda sedang luar talian. Semak sambungan internet anda."; the word `luar talian` stays in the autosave status line | "Luar talian. Cuba lagi.", "Luar talian. Semak sambungan anda." |
| Not found | "Rekod tidak dijumpai." for a record; always "dijumpai", never "ditemui" | "Kertas tidak ditemui" becomes "Kertas tidak dijumpai." (ERR-BIJ-05) |
| Access denied | ERR-ACC-01 | "This action is unauthorized.", "Peranan ini tidak tersedia untuk akaun anda." |
| Invalid | ERR-REQ-01 default; a specific text ("Nilai tidak sah.", "Jawapan tidak sah.", "Mod tidak sah.") stays for its own field | "The given data was invalid." |
| English leftovers | all error text is BM; the V2-kept English labels (`Mastered`, `Developing`, English weekday abbreviations on the Engagement bars) are listed fidelity exceptions | `Payload Too Large.`, `HTTP 502`, `Network request failed` |

### X10.10 Empty states

- **FR-ERR-27** `Belum ada {item}.` means the user has never created or received any; `Tiada {item} dijumpai.` means a filter or search returned nothing; `Tiada data untuk tempoh ini.` means a period filter returned nothing. Every empty state offers the next action (FR-X2-0), and "no data" is never a negative result (FR-X4-3). The strings must not contain the words banned by AC-X2-3.
- The V2 empty-state texts that are kept verbatim: "Belum ada data untuk dianalisa"; "Belum ada percubaan SPM"; "Belum ada data prestasi lagi. Mula latihan →"; "Belum ada sasaran headcount daripada cikgu untuk sesi 2026."; "Belum ada latihan untuk {Subjek}. Mula berlatih untuk membuka analitik penuh."; "Belum ada sekolah yang menyertai battle. Mulakan pertandingan sekarang!"; "Tiada pelajar dijumpai"; "Belum ada audio diterbitkan"; "Belum ada set Audio KBAT."; "Belum ada data latihan."; "Belum ada pelajar dalam kelas anda — data impak tidak dapat dianalisis lagi."; "Tiada tiket lagi."; "Tiada kelas lagi"; "Tiada pelajar dengan sekurang-kurangnya 5 soalan minggu ini."; "Tiada video buat masa ini"; "Tiada aktiviti minggu ini."; "Tiada laporan soalan untuk status ini."; "Tiada soalan"; "Tiada soalan perlu diulang kaji!"; "Sila pilih subjek dan tahap pendidikan".

### X10.11 The ERR catalogue

Display tokens. **Show:** I = inline field, R = inline region or banner, T = toast, D = dialog, P = full page, B = global banner. **Kept:** Y = typed input kept, N = nothing to keep. **Log:** E = error with stack, W = warn, I = info. **Ref:** Y = show `Rujukan: {requestId}`, N = never. "Existing" text is quoted exactly from V2, the PRD or the code. **Copy source** of every row is stated after the tables.

#### X10.11.1 Connectivity and server (client-synthesised or proxy)

| ID | Code | HTTP | When | BM message | Show | Action offered | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-NET-01 | NETWORK_ERROR | 0 | no response / `navigator.onLine` false | Anda sedang luar talian. Semak sambungan internet anda. (banner) ; per action: Tindakan tidak dapat dihantar. Semak sambungan anda. | B (banner) + T | `Cuba Semula` | Y | I (client) | N |
| ERR-NET-02 | TIMEOUT | 0/504 | no reply within 30 s (JSON) / 60 s no upload progress / 120 s export | Permintaan mengambil masa terlalu lama. Cuba lagi. | T (action) / R (load) | `Cuba Semula` | Y | W | Y |
| ERR-NET-03 | (recovery) | - | connection back | Sambungan dipulihkan. | banner 3 s | none | - | - | N |
| ERR-SYS-01 | SERVER_ERROR | 500 | unhandled server exception | Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi. | action: T (stays until closed); load: R; route: P (500 page) | `Cuba Semula` ; page also `Halaman Utama` | Y | E | Y |
| ERR-SYS-01b | SERVER_ERROR | 500/502/504 | a GET list/card fails after auto-retry | Tidak dapat memuatkan data. Sila cuba semula. (existing `dsCopy.loadError`). **V2 observed (admin list screens: users, import, Kirkpatrick; with `Cuba lagi`): "Gagal memuat senarai."** Use V2 text for admin/staff **list** screens, `dsCopy.loadError` for every other section. | R in the section | `Cuba Semula` (V2 admin lists keep the V2 label `Cuba lagi`) | N | E/W | Y |
| ERR-SYS-02 | BAD_GATEWAY | 502 | proxy upstream down | same as ERR-SYS-01 | as 01 | as 01 (GET auto-retry 2x) | Y | W | Y |
| ERR-SYS-03 | SERVICE_UNAVAILABLE | 503 | maintenance / overload on boot | Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit. | P (maintenance page) at boot; T otherwise | `Cuba Semula` | Y | W | Y |
| ERR-SYS-04 | TIMEOUT | 504 | proxy timeout | same as ERR-NET-02 | as NET-02 | `Cuba Semula` | Y | W | Y |
| ERR-SYS-05 | (boot) | - | app/bundle fails to start | Aplikasi gagal dimuatkan / Sila muat semula halaman. Jika masalah berterusan, cuba lagi sebentar nanti. (existing) | P | `Muat semula` | N | client console | N |
| ERR-SYS-06 | (chunk) | - | lazy route chunk 404 after a deploy | Versi baharu tersedia. Sila muat semula halaman. | D | `Muat Semula` | warn: unsaved draft saved to sessionStorage first | I | N |
| ERR-SYS-07 | OVERLOAD (db pool/tx timeout) | 429 | `isOverloadError` (`auth.errors.ts:25`) | Sistem sedang sibuk. Sila cuba sebentar lagi. | R | countdown + `Cuba Semula` | Y | W | Y |

#### X10.11.2 Authentication and session

| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-AUTH-01 | UNAUTHORIZED | 401 | session missing/expired on a non-auth route | Sesi anda telah tamat. Sila log masuk semula. | redirect to `/login?kembali=` + banner R on login page; during a timed Bijak attempt: D (no redirect until the pupil confirms) "Sesi anda telah tamat. Jawapan anda disimpan pada peranti ini. Log masuk semula untuk meneruskan." | `Log Masuk Semula` | Y (draft in sessionStorage) | W | N |
| ERR-AUTH-02 | INVALID_CREDENTIALS | 401 | wrong identifier or password | E-mel/Nama pengguna atau kata laluan tidak sah. (existing) | R above form | none (re-type) | identifier kept, password cleared | W | N |
| ERR-AUTH-03 | ACCOUNT_INACTIVE | 403 | inactive/suspended account | Akaun anda tidak aktif atau telah digantung. Sila hubungi pentadbir. (existing) | R | none | identifier kept | W | N |
| ERR-AUTH-04 | SCHOOL_INACTIVE | 403 | school not activated | Sekolah anda belum diaktifkan oleh pentadbir. Sila hubungi pihak sekolah. (existing) | R | none | Y | W | N |
| ERR-AUTH-05 | AMBIGUOUS_USERNAME | 422 | username exists in several schools | Nama pengguna ini wujud di lebih daripada satu sekolah. Sila pilih sekolah anda. (existing) | R + school picker from `details.schools` | `Pilih Sekolah` | Y | I | N |
| ERR-AUTH-06 | CSRF_INVALID | 403 | CSRF header missing/wrong | Sesi tidak sah. Sila muat semula halaman dan cuba lagi. (existing) | D | `Muat Semula` | draft saved first | W | Y |
| ERR-AUTH-07 | PASSWORD_CHANGE_REQUIRED | 403 | `mustChangePassword` | Sila tukar kata laluan anda sebelum meneruskan. (existing) | P (redirect to change-password screen) | `Tukar Kata Laluan` | N | I | N |
| ERR-AUTH-08 | ROLE_NOT_ALLOWED / MODE_ACTIVE / MODE_ALREADY_ACTIVE / MODE_NOT_ALLOWED / NO_MODE_ACTIVE | 403/409 | role switch / Mod Pelajar misuse | exactly the five existing texts in `AUTH_ERROR_MESSAGES` (`auth/errors.ts:51-55`) | T | none | N | I | N |
| ERR-AUTH-09 | RATE_LIMITED | 429 | login throttle: 6th attempt within 60 s for the same identifier+address; or 20 failed logins/min from one address; or 100 failed logins/15 min for one identifier; `retryAfter` 1..900 s | Terlalu banyak percubaan. Sila cuba sebentar lagi. (existing) + "Cuba lagi dalam {s} saat." (use minutes when s >= 120: "{m} minit") | R above form | submit disabled until countdown ends | identifier kept | W | N |

#### X10.11.3 Access

| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-ACC-01 | FORBIDDEN | 403 | role not allowed (feature on) | Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir. (route) ; action on open screen: Anda tidak dibenarkan melakukan tindakan ini. | route: P; action: T | `Halaman Utama` / none | Y | W | N |
| ERR-ACC-02 | NOT_FOUND | 404 | unknown id, out-of-scope id, hidden module | page copy 2D | P | `Halaman Utama` | N | I | N |
| ERR-ACC-03 | NOT_FOUND | 404 | hidden module by URL (FR-X2-2) | identical to ERR-ACC-02 (no distinct page) | P | as 02 | N | I | N |
| ERR-ACC-04 | NOT_FOUND | 404 | action on a record deleted meanwhile | Rekod tidak dijumpai. Ia mungkin telah dipadam. | T | `Muat Semula` | Y | I | N |

#### X10.11.4 Request, validation, files

| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-REQ-01 | VALIDATION_ERROR | 422 | body/query invalid | field texts from `fields`; banner: `{n} medan perlu dibetulkan.`; no fields: Data yang dihantar tidak sah. Sila semak dan cuba lagi. | I + R | focus first invalid field | Y | I | N |
| ERR-REQ-02 | BAD_REQUEST (mapped to 422) | 400->422 | malformed JSON | Permintaan tidak sah. Sila muat semula halaman dan cuba lagi. | T | `Muat Semula` | Y | W | Y |
| ERR-REQ-03 | PAYLOAD_TOO_LARGE | 413 | body/file over limit | Fail atau data terlalu besar. Saiz maksimum ialah {n} MB. | I at file field / T | `Pilih Fail Lain` | other fields Y, file N | I | N |
| ERR-REQ-04 | UNSUPPORTED_MEDIA_TYPE | 415 | wrong file type | Jenis fail tidak disokong. Format dibenarkan: {senarai}. | I at file field | `Pilih Fail Lain` | other fields Y, file N | I | N |
| ERR-REQ-05 | (client) | - | file > limit before upload | Fail melebihi saiz maksimum {n} MB. (existing `dsCopy.fileTooLarge`) | I | pick another | N | none | N |
| ERR-REQ-06 | (client) | - | too many files | Maksimum {n} fail dibenarkan. | I | remove files | Y | none | N |
| ERR-REQ-07 | (client) | - | empty file / nothing chosen | Sila pilih fail. | I | pick | N | none | N |
| ERR-REQ-10 | (text required) | 422 | empty required text | Sila isi {medan}. (screens that quote an exact V2 or PRD string such as "Nama diperlukan." keep it) | I | - | Y | - | N |
| ERR-REQ-11 | (select required) | 422 | empty required choice | Sila pilih {medan}. (for example "Sila pilih Bab.") | I | - | Y | - | N |
| ERR-REQ-12 | (too long) | 422 | over max length | {Medan} tidak boleh melebihi {n} aksara. | I | - | Y | - | N |
| ERR-REQ-13 | (too short) | 422 | under min | {Medan} mesti sekurang-kurangnya {n} aksara. (password: Kata laluan mesti sekurang-kurangnya 8 aksara.) | I | - | Y | - | N |
| ERR-REQ-14 | (format) | 422 | pattern fail | Format {medan} tidak sah. (e-mel: Format e-mel tidak sah.) | I | - | Y | - | N |
| ERR-REQ-15 | (range) | 422 | number out of range | {Medan} mesti antara {a} dan {b}. | I | - | Y | - | N |
| ERR-REQ-16 | (duplicate) | 409 | unique value exists | {Medan} sudah digunakan. | I | - | Y | - | N |

#### X10.11.5 Rate and quota

| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-RATE-01 | RATE_LIMITED | 429 | any throttle | Terlalu banyak percubaan. Sila cuba sebentar lagi. + "Cuba lagi dalam {s} saat." | R in the failed section | `Cuba Semula` enabled after countdown; GET auto-retry once when retryAfter <= 10 | Y | W | N |
| ERR-QUOTA-01 | QUOTA_FULL | 409 | import rows > remaining seats | Kuota penuh! Sila tingkatkan kuota dahulu. (existing) | R | none; whole file refused | file N | I | N |
| ERR-QUOTA-02 | RATE_LIMITED (existing; no new code) | 429 | 21st new question report by one reporter in a Malaysia day (`QUESTION_REPORT_DAILY_CAP` = 20) | Anda telah mencapai had 20 laporan sehari. Sila cuba lagi esok. (existing, `question-workflow/reports.ts:38`) ; `retryAfter` = seconds until the cap window ends | R inside the report dialog | none (dialog stays; submit disabled) | comment Y | W | N |
| ERR-QUOTA-03 | INTAKE_BATCH_LIMIT | 422 | more than 10 files in a batch (also the Sumbang Soalan paper upload: 1..5 files, V2 copy "Maksimum 5 fail, saiz maksimum 20MB setiap fail") | admin intake: Maksimum 10 fail setiap kumpulan. ; teacher paper upload: Maksimum 5 fail, saiz maksimum 20MB setiap fail (V2) | I | remove files | Y | I | N |
| ERR-QUOTA-04 | INTAKE_ACTIVE_LIMIT | 409 | more than 5 active batches | Terlalu banyak kumpulan sedang diproses (maksimum 5). Tunggu salah satu selesai. | R | `Lihat Kumpulan` | Y | I | N |
| ERR-QUOTA-05 | INTAKE_DAILY_PAGE_QUOTA | 429 | more than 500 pages/day | Kuota halaman harian (500) telah dicapai. Cuba lagi esok. | R | none | Y | I | N |
| ERR-QUOTA-06 | RATE_LIMITED | 429 | intake writes over 20/min/user or reads over 240/min/user (`INTAKE_LIMITS`, 60 s window); upload concurrency 2 (`INTAKE_UPLOAD_CONCURRENCY`) | same text as ERR-RATE-01 | R | countdown | Y | W | N |
| ERR-QUOTA-07 | RATE_LIMITED | 429 | global API ceiling 300 requests/min/client (`global-rate-limit.guard.ts:17`) | same text as ERR-RATE-01 | R | countdown | Y | W | N |

#### X10.11.6 Conflict and concurrency

| ID | Code | HTTP | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|---|
| ERR-CON-01 | CONFLICT | 409 | generic conflict | Tindakan ini bercanggah dengan keadaan semasa. Muat semula dan cuba lagi. | T | `Muat Semula` | Y | I | N |
| ERR-CON-02 | CONFLICT (existing) + `details.id`, `details.versionNo` | 409 | admin presses edit on a live question while a newer draft/review version already exists (`POST /questions/:id/edit-as-draft`, `questions/paths.ts:224`) | Soalan ini sudah mempunyai draf yang sedang disunting (versi {versionNo}). Buka draf itu. | D | `Buka Draf` (to `details.id`) / `Kembali` | Y | I | N |
| ERR-CON-02b | STALE_VERSION | 409 | two admins save the **same draft**: PUT carries `expectedUpdatedAt` of the draft version, differs | Draf ini telah dikemas kini oleh pengguna lain. Muat semula untuk melihat versi terkini. (paper: Kertas ini telah dikemas kini oleh pengguna lain. ...) | D | `Muat Semula Versi Terkini` (copies the user's edits to `pp.draft.*` first and offers `Pulihkan Suntingan Saya`) / `Kembali` | Y | I | N |
| ERR-CON-03 | CONFLICT | 409 | bulk-by-filter count changed | Bilangan soalan telah berubah ({lama} kepada {baru}). Semak semula sebelum meneruskan. | D | `Semak Semula` | filter Y | I | N |
| ERR-CON-04 | CONFLICT | 409 | lifecycle pair not allowed | Perubahan status ini tidak dibenarkan daripada status semasa. | T | none | Y | I | N |
| ERR-CON-05 | CONFLICT | 409 | member already in another group / pending item blocks  | server message (BM) shown as is | T | none | Y | I | N |

#### X10.11.7 Practice, wallet, rewards, Bijak, SPM (all existing text, quoted exactly)

| ID | Code | HTTP | BM message | Show | Action |
|---|---|---|---|---|---|
| ERR-PRAC-01 | TRIAL_EXHAUSTED | 402 | Baki percubaan percuma anda telah habis. | R | none |
| ERR-PRAC-02 | NOT_ENOUGH_QUESTIONS / SET_NOT_READY | 422 | Soalan tidak mencukupi. | R | `Kembali` |
| ERR-PRAC-03 | NO_WRONG_QUESTIONS | 422 | Maaf, terdapat masalah memuatkan kuiz ulang kaji. | R | `Kembali` |
| ERR-PRAC-04 | ALREADY_COMPLETED | 409 | Misi ini sudah diselesaikan. / Ujian ini sudah selesai. | R | `Kembali` |
| ERR-PRAC-05 | NO_ATTEMPTS_LEFT | 409 | Tiada percubaan lagi untuk set ini. | R | `Kembali` |
| ERR-PRAC-06 | ALREADY_SUBMITTED | 409 | Sesi ini sudah dihantar. | pupil is sent to the result (no error shown when the same key) | `Lihat Keputusan` |
| ERR-PRAC-07 | (generic) | 422 | Rekod tidak dijumpai. / Nilai tidak sah. / Jawapan tidak sah. / Mod tidak sah. (`PRACTICE_MESSAGES`) | T | none |
| ERR-WAL-01 | INSUFFICIENT_BALANCE | 409 | Baki syiling tidak mencukupi. / Baki token tidak mencukupi. | T | `Kembali` |
| ERR-RWD-01 | OUT_OF_STOCK | 409 | Stok hadiah telah habis. | T | `Kembali` |
| ERR-RWD-02 | MONTHLY_CAP | 409 | Had tebusan bulanan dicapai. | T | `Kembali` |
| ERR-RWD-03 | INSUFFICIENT_TOKENS | 409 | Token tidak mencukupi. (near-duplicate of ERR-WAL-01 "Baki token tidak mencukupi."; keep both, they are existing live-aligned copy) | T | `Kembali` |
| ERR-RWD-04 | DRAW_CLOSED | 409 | Cabutan ditutup. | T | `Kembali` |
| ERR-RWD-05 | TICKET_LIMIT | 409 | Had tiket dicapai. | T | `Kembali` |
| ERR-RWD-06 | INSUFFICIENT_BALANCE | 409 | Baki syiling tidak mencukupi. | T | `Kembali` |
| ERR-RWD-07 | CONFLICT | 409 | Tebusan ini tidak lagi menunggu pemprosesan. (admin process) / Tebusan ini tidak lagi menunggu kelulusan. (parent consent) | T | `Muat Semula` |
| ERR-RWD-08 | NOT_FOUND | 404 | Hadiah tidak dijumpai. / Tebusan tidak dijumpai. / Kotak tidak dijumpai. (existing `REWARD_MESSAGES`); **defect D8:** `REWARD_MESSAGES.notFound` = `Not Found.` and `REWARD_VALIDATION_MESSAGES` are English Laravel text ("The reward id field is required.", "The selected action is invalid.", "The ids field must contain positive integers.") and must become `Rekod tidak dijumpai.` / ERR-REQ-10..14 texts | T | none |
| ERR-BIJ-01 | NO_BLUEPRINT | 422 | Belum ada kontrak untuk subjek dan kertas ini | R | `Kembali` |
| ERR-BIJ-02 | SHORTAGE | 422 | Kertas tidak dapat dijana kerana soalan tidak mencukupi. (+ shortage list) | R | `Kembali` |
| ERR-BIJ-03 | GENERATE_LIMIT | 503 | Kertas tidak dapat disusun sekarang. Cuba lagi. | R | `Cuba Semula` |
| ERR-BIJ-04 | (paper updating) | 409 | Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini. (FR-MUR-13-15) | T | `Kembali` |
| ERR-BIJ-05 | (paper not found) | 404 | Kertas tidak dijumpai. (replaces `Kertas tidak ditemui`) | P | `Halaman Utama` |
| ERR-BIJ-06 | NOT_SUBMITTED | 409 | Bijak scheme/self-mark before Hantar: Skema hanya didedahkan selepas Hantar (`BIJAK_ATTEMPTS_MESSAGES.schemeAfterSubmit`, also used with 403 at `attempts.service.ts:690`); SPM mock: Mock belum dihantar. (`SPM_MESSAGES.mockNotSubmitted`, `spm/shared.ts:18`) | R | `Kembali` |
(Kept/Log/Ref for 9.7: input kept Y, log I, Ref N.)

#### X10.11.8 Questions and intake (gate and job)

| ID | Code | HTTP | When | BM message | Show | Action |
|---|---|---|---|---|---|---|
| ERR-QST-01 | VALIDATION_ERROR + `details.gate[]` | 422 | publish gate fails (QE-04) | panel listing each issue; texts: Sila pilih unit DSKP. / Sila pilih sekurang-kurangnya satu SP DSKP. / Sila pilih Bab. [issue `chapter_missing`] / Sila pilih tahap kesukaran. / Sila pilih kertas untuk soalan SPM. / Bahagian (b) belum ada aras pemikiran.; "Soalan menyebut {Rajah 3} tetapi tiada rangsangan. Pilih kumpulan atau tambah rangsangan." [issue `stimulus_missing`]; "Soalan ini hanya mengandungi rangsangan. Tukarkan kepada rangsangan kumpulan." [issue `figure_only`]. An item is listed only when it applies: Sila pilih Bab. only when the Subjek and Tingkatan have chapters (D112-1); the unit DSKP, SP, TP and aras items only where DSKP nodes exist for the subject (D112-3); the kertas item only for an SPM-bound question | R panel with links to the step | click link |
| ERR-QST-02 | VALIDATION_ERROR (`stimulus_group_split`) | 422 | a set/paper/placement would split a stimulus group | Soalan dalam kumpulan rangsangan mesti dipilih bersama. (existing) | I at `questionIds` | add the sibling |
| ERR-QST-03 | VALIDATION_ERROR | 422 | publish a paper with an empty question | “{title}” tiada kandungan - tidak boleh diterbitkan. (R1 copy, D113) | R | fix content |
| ERR-QST-04 | VALIDATION_ERROR | 422 | missing declarations | Pengisytiharan sumber diperlukan. / Status hak cipta diperlukan. | I | - |
| ERR-INT-01 | ENCRYPTED | job | password-protected file | Fail dilindungi kata laluan. Buang perlindungan dan muat naik semula. | R in batch row | `Muat Naik Semula` |
| ERR-INT-02 | CORRUPT | job | unreadable file | Fail rosak atau tidak dapat dibaca. | R | `Muat Naik Semula` |
| ERR-INT-03 | TOO_MANY_PAGES | job | over page limit | Fail mempunyai terlalu banyak halaman (maksimum {n}). Bahagikan fail dan muat naik semula. | R | `Muat Naik Semula` |
| ERR-INT-04 | TOO_COMPLEX | job | memory/time while reading | Fail terlalu kompleks untuk diproses. Cuba fail yang lebih ringkas. | R | `Muat Naik Semula` |
| ERR-INT-05 | OCR_TIMEOUT | job | page > 90 s or batch > 15 min | Pengecaman teks mengambil masa terlalu lama. | R | `Cuba lagi` |
| ERR-INT-06 | OCR_FAILED | job | OCR error | Pengecaman teks gagal. | R | `Cuba lagi` |
| ERR-INT-07 | OCR_UNAVAILABLE | job | scanned page, no OCR engine | Halaman imbasan tidak dapat dibaca kerana pengecaman teks tidak tersedia. Taip soalan secara manual. | R | `Tulis Soalan Manual` (same fields as the Studio manual entry) |
| ERR-INT-08 | RENDER_FAILED | job | page image fails | Halaman tidak dapat dipaparkan. | R | `Cuba lagi` |
| ERR-INT-09 | CANCELLED | job | cancelled | Dibatalkan. | status chip | `Cuba lagi` |
| ERR-INT-10 | (batch failed) | job | batch ends Gagal | Pengekstrakan gagal: {sebab}. (FR-ADM-Q07.2; {sebab} = the ERR-INT-01 to ERR-INT-08 text) | R | `Cuba lagi` |
| ERR-INT-11 | (retry exhausted) | 409 | 3 retries used | Fail ini gagal diproses berulang kali. Sila hubungi sokongan. | R | none |
| ERR-INT-12 | (guru paper upload) | 503 today | the teacher paper submit calls an unavailable-intake stub | none: a defect to fix (the route must work, so no user text exists for it); until fixed it falls under ERR-SYS-01 | - | - |
(Kept: Y; Log: W; Ref: Y for ERR-INT-04,05,06,08,10,11.)

#### X10.11.9 Save, autosave, export, notification

| ID | Code | When | BM message | Show | Action | Kept | Log | Ref |
|---|---|---|---|---|---|---|---|---|
| ERR-SAVE-01 | (autosave status) | save in flight / ok / offline / error | menyimpan… / disimpan / luar talian / gagal simpan (Bijak V2 words); other editors: Menyimpan... / Disimpan / Luar talian / Gagal menyimpan | status line next to the editor | auto-retry every 5 s | Y (local) | I | N |
| ERR-SAVE-02 | (action failed) | save/add/remove/publish fails with 5xx/network | {Tindakan} gagal. Cuba lagi. e.g. Soalan gagal ditambah. Cuba lagi. | T | `Cuba Semula` | Y | E | Y |
| ERR-SAVE-03 | (submit non-network error) | Bijak Hantar returns 422/500 | Jawapan tidak dapat dihantar. Jawapan anda masih disimpan pada peranti ini. | R + D | `Cuba Semula` | Y | E | Y |
| ERR-SAVE-04 | (rollback) | optimistic toggle fails | Perubahan tidak dapat disimpan. Cuba lagi. | T | none | revert | I | N |
| ERR-SAVE-05 | (attempt closed) | server reports deadline passed | Masa tamat. Jawapan yang disimpan sebelum masa tamat telah dihantar. (existing `AttemptPage.vue:413`) | D then result | `Lihat Keputusan` | - | I | N |
| ERR-SAVE-06 | (unsent answer, practice) | answer POST failed 3x | Jawapan belum dihantar. Cuba Semula. | R | `Cuba Semula` / `Langkau` | Y | W | N |
| ERR-SAVE-07 | (check) | Bijak "Semak" fails | Semakan tidak dapat dibuat sekarang. Cuba lagi. (existing `AttemptPage.vue:348`) | R | `Cuba Semula` | Y | I | N |
| ERR-EXP-01 | (export failed) | PDF/CSV fails | Muat turun gagal. Cuba lagi. | T | `Cuba Semula` | Y | E | Y |
| ERR-EXP-02 | (export empty) | no rows | Tiada data untuk dieksport. | T | none | - | - | N |
| ERR-IMP-01 | (import row errors) | CSV rows invalid | {imported} baris berjaya, {n} baris gagal. | R + table | `Muat Turun Ralat (CSV)` | file N | I | N |
| ERR-IMP-02 | (header missing) | 422 | Lajur wajib tiada: {lajur}. Gunakan templat yang disediakan. | I | `Muat Turun Templat` | N | I | N |
| ERR-NOT-01 | (notification send failure) | async send fails | no user text; logged | - | - | - | E | N |

**Copy source.** Of the 102 rows, 52 carry text quoted from V2, the PRD or the existing code. 48 carry new BM copy decided by D113 ("R1 copy"): ERR-NET-01, -02, -03; ERR-SYS-02, -03, -04, -06, -07; ERR-ACC-04; ERR-REQ-01, -02, -03, -04, -06, -07, -10 to -16; ERR-QUOTA-03 (admin text), -04, -05; ERR-CON-01, -02, -02b, -03, -04; ERR-INT-01 to -09 and -11; ERR-SAVE-02, -03, -04, -06; ERR-EXP-01, -02; ERR-IMP-01, -02. Two rows have no user text: ERR-NOT-01 (logged only) and ERR-INT-12 (a defect to fix). The new envelope codes introduced by this catalogue are `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `BAD_GATEWAY`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, `STALE_VERSION`, `INTAKE_BATCH_LIMIT` (422), `INTAKE_ACTIVE_LIMIT` (409) and `INTAKE_DAILY_PAGE_QUOTA` (429). Limits behind the three intake codes: 10 files per batch (`INTAKE_MAX_FILES_PER_BATCH`), 5 active batches (`INTAKE_MAX_ACTIVE_BATCHES`), 500 pages per day (`INTAKE_DAILY_PAGE_QUOTA`).

**ERR id ranges.** ERR-NET-01 to -03; ERR-SYS-01, -01b, -02 to -07; ERR-AUTH-01 to -09; ERR-ACC-01 to -04; ERR-REQ-01 to -07 and -10 to -16; ERR-RATE-01; ERR-QUOTA-01 to -07; ERR-CON-01, -02, -02b, -03 to -05; ERR-PRAC-01 to -07; ERR-WAL-01; ERR-RWD-01 to -08; ERR-BIJ-01 to -06; ERR-QST-01 to -04; ERR-INT-01 to -12; ERR-SAVE-01 to -07; ERR-EXP-01, -02; ERR-IMP-01, -02; ERR-NOT-01 (102 rows). ERR-GAME-01 to -26 are in 48 §3.8. A new row continues the series of its prefix.

### X10.12 Code and contract changes this section requires (improve, not rebuild)

| # | Change | Owner sector |
|---|---|---|
| E-1 | Default `message` in the API error filter and the mock become the BM texts of FR-ERR-4; the filter keeps an unmapped 4xx as 4xx (FR-ERR-5) and adds 413 / 415 to `ERROR_CODES`; the codes `BAD_REQUEST`, `PAYLOAD_TOO_LARGE`, `UNSUPPORTED_MEDIA_TYPE`, `SERVICE_UNAVAILABLE`, `TIMEOUT`, `BAD_GATEWAY` are added to the contract | API platform (S0) |
| E-2 | 401 handling: return URL, banner, draft keep and restore (FR-ERR-7, FR-ERR-8) | frontend core (S0 / S8) |
| E-3 | Frontend `ApiError` gets `requestId` and `details`; 502, 503, 504, 413, 415 get their own codes (FR-ERR-6) | frontend core `src/api` |
| E-4 | Bijak submit stops treating every failure as offline (FR-ERR-20, ERR-SAVE-03) | Bijak (S3) |
| E-5 | Error pages, maintenance page and chunk-load dialog use the copy of X10.3.8 | frontend shell (S0 / S8) |
| E-6 | Autosave wording aligned (FR-ERR-18) | Bijak (S3) and Studio (S1 / S2) |
| E-7 | Reward and validation messages in BM (ERR-RWD-08) | gamification (S7) |
| E-8 | Global offline banner, one client timeout and retry policy in `src/api/client.ts`, double-submit lock, toast rules, first-error focus | frontend core / design system (S8) |
| E-9 | Optional `expectedUpdatedAt` on draft and paper saves and 409 `STALE_VERSION` (FR-ERR-25) | questions (S1) and Set Builder (S3) |
| E-10 | Intake codes `INTAKE_BATCH_LIMIT`, `INTAKE_ACTIVE_LIMIT`, `INTAKE_DAILY_PAGE_QUOTA`; OCR timeouts 90 s per page and 15 min per batch with `OCR_TIMEOUT` | intake (S2) |
| E-11 | User-import route limit raised from 1,100 kB to 2 MB (X10.5.1) | school admin / users (S6) |
| E-12 | Idempotency per `(userId, clientUuid)` on redeem, convert tokens and claim (FR-ERR-9) | gamification (S7) |
| E-13 | The Studio "Diterbitkan" label becomes "Diluluskan" everywhere (X11, OPT-STATUS-SOALAN) | Studio (S2) |

### X10.13 Acceptance criteria

- **AC-ERR-1** (403 versus 404) as in X10.3.2.
- **AC-ERR-2** Given a signed-in user on a form with unsaved edits whose session expires, when the next request answers 401, then the browser lands on `/login?kembali=` with the edited path, the banner "Sesi anda telah tamat. Sila log masuk semula." shows, and after login the same form opens with the edits restored and the notice "Terdapat kerja yang belum disimpan daripada sesi sebelum ini."
- **AC-ERR-3** Given a login throttled by ERR-AUTH-09 or ERR-RATE-01 with `retryAfter` 30, then "Cuba lagi dalam 30 saat." counts down and the retry control is disabled until it reaches 0.
- **AC-ERR-4** Given the network is cut, then the banner "Anda sedang luar talian. Semak sambungan internet anda." shows within 10 s, no layout shift occurs at 375 px, and on reconnection "Sambungan dipulihkan." shows for 3 s.
- **AC-ERR-5** Given a save control pressed twice within 200 ms, then exactly one request is sent and the control shows "Menyimpan..." until the request settles.
- **AC-ERR-6** Given two admins saving the same draft, when the second sends an older `expectedUpdatedAt`, then it receives 409 `STALE_VERSION` and sees the dialog of ERR-CON-02b with `Pulihkan Suntingan Saya`.
- **AC-ERR-7** Given any 5xx, then the toast or panel shows `Rujukan: {requestId}` and `Salin`; given any 403 or 404 page, then no `Rujukan` shows.
- **AC-ERR-8** Given each generic form pattern, when the field is empty, too long, too short, malformed, out of range or a duplicate, then the exact text of ERR-REQ-10 to ERR-REQ-16 shows under the field, the first invalid field has focus, and the banner "{n} medan perlu dibetulkan." is announced.
- **AC-ERR-9** Every row of §X10.11 has one automated assertion (Playwright or unit) named with its ERR id; the CI check lists the ERR ids that have none. The five cross-cutting specs are the 401 return URL, the 429 countdown, the offline banner, the double submit and the stale-draft dialog (AC-ERR-2, 3, 4, 5, 6).
- **AC-ERR-10** Given a GET that fails with 503, then it is retried twice (after about 1 s and 3 s) before the error shows, and a POST that fails with 503 is not retried.
- **AC-ERR-11** Given an upload with no progress for 60 s, then it aborts with ERR-NET-02 and `Cuba lagi`; given an export that runs 125 s, then ERR-NET-02 shows.
- **AC-ERR-12** Given the API receives a request with an unsupported media type, then the answer is 415 `UNSUPPORTED_MEDIA_TYPE` with a BM message, and not 500.

---

## X11. Option sets (master list)

One ID per concept. A module file ([10](10-murid.md), [20](20-guru-admin-sekolah.md), [30](30-admin-pusat.md), [45](45-question-authoring-flow.md), [46](46-pupil-activity-flow.md), [48](48-game-and-gamification-spec.md)) cites the ID and lists, in its own "§A1 Option sets used here", only the screen-specific parts (placeholder text, which values a screen shows, order). **This section wins on any difference** in stored values, BM labels, order or defaults. Values are written as stored value → BM label; the order shown is the display order. Labels are exact BM.

The three field registers (Murid, Guru and Admin Sekolah, Admin Pusat) used different IDs for the same concept in some places, and the same ID for different concepts in others. §X11.7 maps every register ID to its master ID; a document written against a register ID stays valid by that table, and a new citation uses the master ID.

### X11.1 Curriculum, papers and language

| Master ID | Concept and values | Used by |
|---|---|---|
| **OPT-TINGKATAN** | Tingkatan 1 to 5 only (D72, D96; no Darjah in any picker). Label "Tingkatan n" (short "Ting. n"; the Headcount Auto-Setup checkboxes use "T1".."T5"). Three stored forms of the same value: level code `T{n}` (practice levels), `education_level` n (questions, classes, papers, sets) and `users.grade` = n + 6 (T1 = 7 … T5 = 11); the contract helpers are `gradeToLevelCode` and `levelCodeToGrade`. The server rejects a pupil `grade` below 7 or above 11 with 422 `fields.grade` "Tahap tidak sah."; the register with no choice says "Sila pilih tahap anda." Default is the pupil's own form. A pupil-facing picker shows only forms that have servable content, each with its count ("{n} soalan"; 0 is disabled), and "Semua Tahap" (`all`) only where the screen says so. Per-screen first option (placeholder) is the screen's own text, for example "-- Pilih tingkatan --", "Semua Tingkatan", "— Tiada —" | all modules |
| **OPT-SUBJEK** | Source: `subjects` where active (`GET /api/subjects?active=1`); stored value `subjects.id`, label = the BM name; never hard-coded. 31 subjects in "V2 order": Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral, Matematik Tambahan, Fizik, Kimia, Biologi, Geografi, Pendidikan Seni Visual, Pendidikan Muzik, Pendidikan Jasmani & Kesihatan, Reka Bentuk & Teknologi, Sains Komputer, Bahasa Arab, Bahasa Cina, Bahasa Tamil, Prinsip Perakaunan, Ekonomi, Perniagaan, Pendidikan Al-Quran & As-Sunnah, Tasawwur Islam, Jawi, Pendidikan Syariah Islamiah, Sains Rumah Tangga, Pembuatan Pakaian Wanita, Pertanian, Sains Sukan. Orders: pupil pickers show Subjek Teras first (Bahasa Melayu, Bahasa Inggeris, Matematik, Sains, Sejarah, Pendidikan Islam, Pendidikan Moral) then the rest by name ascending; teacher and admin forms use "V2 order"; filters and lists marked "A-Z" sort by BM name ascending with Malay collation. A pupil picker, Soalan by Chapter and the Heatmap list only subjects that have at least one servable question for the form. A select option may read "{nama} ({KOD})". Placeholders are per screen ("-- Pilih subjek --", "Semua Subjek", "— Tiada —") | all modules |
| **OPT-KERTAS** | Paper code number: "Kertas 1" `'1'`, "Kertas 2" `'2'`, "Kertas 3" `'3'`, "Kertas 4" `'4'` (D113; the contract enum is widened from 1..3). Objective papers are Kertas 1; Kertas Subjektif is 2, 3 or 4. A pupil filter lists the distinct kertas of the visible papers in ascending order with "Semua kertas". Error "Kertas tidak sah." This is the paper number, not the paper type (OPT-JENIS-KERTAS) | 10 Bijak, Kertas Subjektif; 30 Studio, Set Builder, Kontrak, CSV; 45; 46 |
| **OPT-JENIS-KERTAS** | Type of exam paper, stored on `source_papers.exam_type` (contract `QUESTION_JENIS`): `sebenar` → Sebenar, `percubaan` → Percubaan, `modul` → Modul, `topikal` → Topikal, `latihan` → Latihan. Filter order: Percubaan, Sebenar, Modul, Topikal, Latihan. The admin upload form (Q-08) uses the same set; the old intake strings are retired and mapped: Percubaan SPM → `percubaan`, Soalan Umum → `topikal`, Peperiksaan Sebenar → `sebenar`, Buku Latihan → `latihan`, Lain-lain → `modul` | 30 Q-03, Q-08, Q-13, Q-14, Q-18, Q-19; 45 |
| **OPT-JENIS-HANTARAN** | Type chosen by a teacher in "Hantar Kertas Soalan", stored on `intake_batches.paper_type`: "Soalan Umum" → `umum`, "Trial Paper" → `trial`, "Soalan DSKP" → `dskp`, "Buku Teks" → `buku_teks`, "Buku Latihan" → `buku_latihan`, "Soalan Peperiksaan" → `peperiksaan`, "Lain-lain" → `lain` (last, select only; the six information chips omit it). Placeholder "-- Pilih Jenis --". When the admin accepts the batch the value is mapped to OPT-JENIS-KERTAS: `umum` → `topikal`, `trial` → `percubaan`, `dskp` → `topikal`, `buku_teks` → `latihan`, `buku_latihan` → `latihan`, `peperiksaan` → `sebenar`, `lain` → `modul` (R1 decision D113) | 20 Hantar Kertas |
| **OPT-NEGERI-KERTAS** | Exam board or state of a paper (22, V2 order), stored as the lower-case slug (`johor`, `wp-kuala-lumpur`): Johor, Kedah, Kelantan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Sabah, Sarawak, Selangor, Terengganu, WP Kuala Lumpur, WP Labuan, WP Putrajaya, MRSM, SBP, SABK, SMKA, SPM(U), PPD. Upload forms offer all 22; list filters offer only values present in the data (Set Builder shows 19). Error "Negeri atau badan diperlukan." | 30 Q-03, Q-08, Q-13, Q-14, Q-18; 45 |
| **OPT-TAHUN** | Exam year. Filters: years present in the data, descending. Upload and create fields: 2015 to the current year, descending, no default. Error "Tahun diperlukan." | 30; 45 |
| **OPT-SALINAN-HAK-CIPTA** | Copyright status (required, no default): `sendiri` → "Milik sendiri / sekolah", `rasmi` → "Kertas rasmi KPM / LPM", `pihak-ketiga` → "Pihak ketiga / komersial". Error "Status hak cipta diperlukan." | 30 Q-08; 45 |
| **OPT-BAHAGIAN** | Section of a paper, never free text; the label comes from the paper or contract section: "Bahagian A", "Bahagian B", "Bahagian C"; Bahasa Inggeris "Part 1" to "Part 5"; Matematik Kertas 1 "Objektif". Select option "{nama kertas} · {label bahagian}". Stored `paper_sections.id` | 30; 45 |
| **OPT-PERATURAN** | Answering rule of a section, stored `all` / `choose_n` / `none`: "Tiada", "Jawab Semua", "Pilih N" (shows the number input N, an integer from 1 to the section's question count). Kontrak shows all three; Set Builder and Semak Kertas show "Jawab Semua" and "Pilih N" only | 30; 45; 46 |
| **OPT-BAHASA** | Language of a question or paper: `ms` → "BM", `en` → "EN"; a bilingual paper or question is `ms+en` and the pupil has a toggle (FR-PA-04). A CSV `bahasa` cell accepts `ms` or `en`; `bm` is read as `ms`. Default `ms` (R1 decision D113) | 30 CSV; 45; 46 |
| **OPT-JENIS-TULISAN** | Script of a question: `rumi` → "Rumi" (default), `arab` → "Arab", `jawi` → "Jawi", `mixed` → "Campuran" (labels: R1 decision D113) | 30 CSV; 45 |

### X11.2 Question model

| Master ID | Concept and values | Used by |
|---|---|---|
| **OPT-JENIS-SOALAN** | The 11 question types, in this order (stored `questionType` → BM label): `mcq` → "Aneka Pilihan"; `mcq_multi` → "Aneka Pilihan (Pelbagai Jawapan)"; `true_false` → "Betul / Salah"; `match` → "Padanan / Lengkapkan Petikan"; `short_answer` → "Jawapan Pendek"; `fill_blank` → "Isi Tempat Kosong"; `structured` → "Berstruktur"; `working` → "Pengiraan dengan Langkah Kerja"; `essay` → "Karangan / Respons Terbuka"; `drawing` → "Lukisan / Graf"; `table_fill` → "Isi Jadual". All 11 are offered and served (D113; the earlier rule that `drawing` and `table_fill` stay hidden until built is withdrawn). `essay_choice` is a leaf mode of `essay`, served. `pksk_choice` is PKSK only and is never offered in Studio. V2 modes map on migration: mcq → mcq; short_text and numeric → short_answer; numbered_list → structured; extended_essay → essay; essay_choice → essay (leaf essay_choice); working_shown → working; graph_plot and draw_on_diagram → drawing; table_fill → table_fill; sequence_order and gapped_text_match → match; code → short_answer; cloze → fill_blank | 30 Studio, CSV; 45; 46 |
| **OPT-MOD-JAWAPAN** | Answer mode of one leaf (stored → BM label): `mcq` → "Aneka Pilihan"; `match_letter` → "Padanan Huruf"; `short_text` → "Jawapan Pendek"; `numeric` → "Jawapan Nombor"; `working` → "Kerja Langkah"; `essay` → "Karangan"; `drawing` → "Lukisan"; `table_fill` → "Isi Jadual"; `essay_choice` → "Esei Pilihan". A type offers only its own modes: mcq family → `mcq`; match → `match_letter`; short_answer → `short_text`, `numeric`; fill_blank → `short_text`; structured → any mode, depth at most 3; working → `working`; essay → `essay`, `essay_choice`. Item kinds served to a pupil add two views of `mcq`: `true_false` (two fixed options A "Betul", B "Salah", never shuffled) and `mcq_multi` (checkboxes; not served in Latih Tubi, Soalan by Chapter, Databank, Tracking A objective, Remedial, Misi, PKSK or games). Pupil display names: "Aneka pilihan", "Betul / Salah", "Aneka pilihan (lebih daripada satu jawapan)", "Padanan huruf", "Jawapan pendek", "Nombor", "Kerja & jawapan akhir", "Esei", "Esei (pilih satu gesaan)", "Lukisan", "Isi Jadual". The Kontrak "Mod Jawapan Dijangka" multi-select uses the 9 stored modes | 30; 45; 46 |
| **OPT-MCQ-PILIHAN** | Option rows of an MCQ: 2 to 8, default 4 (A to D) on a new MCQ; labels A to H in order; `+ Pilihan` adds the next letter, `Buang pilihan` removes the last and renumbers. `true_false` has the two fixed options "Betul" and "Salah" (text not editable). `mcq_multi` has 2 to 8 options with 1 to (options − 1) correct (R1 decision D113; this replaces "3 to 8 options, 2 ≤ k ≤ n−1" in the field registers). Messages: "Soalan aneka pilihan mesti ada 2 hingga 8 pilihan.", "Sila isi semua pilihan jawapan.", "Sila pilih jawapan betul.", "Pilih sekurang-kurangnya satu jawapan betul dan sekurang-kurangnya satu jawapan salah." | 30; 45; 46; 20 |
| **OPT-JENIS-RANGSANGAN** | Stimulus kind, in this order (stored `kind` → label): `passage` → "Petikan" (default); `diagram` → "Rajah"; `table` → "Jadual"; `graph` → "Graf"; `map` → "Peta"; `infographic` → "Carta / Infografik"; `image` → "Imej / Gambar". Image kinds (the file is the content): diagram, graph, map, infographic, image. A group has 1 to 3 stimuli. V2 kinds map on migration: Passage, Box, Math, Code, Pseudocode and Sql → passage; Table → table; Diagram → diagram; Graph → graph; Image and Cartoon → image; Infographic → infographic; Map → map; Audio and Video are not migrated. Error "Sila pilih jenis rangsangan." | 30; 45 |
| **OPT-TP** | Tahap Penguasaan, stored 1 to 6 (`questions.tp`, `difficulty_tp`). Admin option label "TP 1" … "TP 6" with the descriptor text of the unit or SK under the select (`curriculum_tp_descriptors`); the teacher select shows "1" … "6" under the field label "Tahap Penguasaan (TP)", placeholder "-- Pilih TP --". No TP band names exist; labels are numeric only (R1 decision D113). Never shown to a pupil. Error: ERR-REQ-15 instance "Tahap Penguasaan (TP) mesti antara 1 dan 6." | 20 Sumbang Soalan; 30; 45 |
| **OPT-KESUKARAN** | Kesukaran, stored 1 to 5 (`difficulty_level`), typed by the admin or teacher and independent of TP: 1 → "Sangat Mudah", 2 → "Mudah", 3 → "Sederhana", 4 → "Sukar", 5 → "Sangat Sukar"; list display "⭐" repeated n times; teacher select "⭐ — Sangat mudah" … "⭐⭐⭐⭐⭐ — Sangat sukar". Default: the form pre-fills min(5, TP) when TP is set, until the user changes Kesukaran (`difficultyTouched`); changing TP afterwards never overwrites a touched value; a CSV or intake row without it gets min(5, tp) with the hint "Dikira daripada TP. Sahkan." Placeholders: admin "— Pilih —", teacher "-- Pilih kesukaran --". Error "Sila pilih tahap kesukaran." Pupil Latih Tubi filter: the 5 labels with live counts and "Semua" (null); a choice with 0 is disabled. Latih Tubi reads `difficulty_level`; DSKP reads `difficulty_tp` | 10 Latih Tubi; 20; 30; 45 |
| **OPT-KESUKARAN-3** | Display-only grouping of Kesukaran, never typed: 1-2 → "Mudah" (green chip), 3 → "Sederhana" (amber), 4-5 → "Sukar" (red). Filters that use three labels send the ranges `1-2`, `3`, `4-5` | list badges, filters |
| **OPT-ARAS** | Bloom cognitive level of a leaf ("Aras Pemikiran", placeholder "-- Pilih aras --"), stored lower case: `mengingat` → "Mengingat", `memahami` → "Memahami", `mengaplikasi` → "Mengaplikasi", `menganalisis` → "Menganalisis", `menilai` → "Menilai", `mencipta` → "Mencipta". KBAT is derived, not stored: the last four are KBAT. The admin badge reads "KBAT" or "Bukan KBAT"; a teacher list chip may show the derived word LOTS (Mengingat, Memahami), MOTS (Mengaplikasi) or HOTS (Menganalisis, Menilai, Mencipta). Required per leaf for an SPM-bound question only where DSKP nodes exist (D112-3). Not the pupil filter (OPT-ARAS-KBAT) | 20 Sumbang Soalan; 30; 45 |
| **OPT-ARAS-KBAT** | Pupil filter "Aras KBAT" of Soalan Berstruktur, stored as integer `kbatLevel` 1 to 6: "Semua" (null), "LOTS 1" (1), "LOTS 2" (2), "MOTS 3" (3), "HOTS 4" (4), "HOTS 5" (5), "HOTS 6" (6); the badge "KBAT" shows for 4 to 6. Never mixed with the Bloom vocabulary of OPT-ARAS (K14) | 10 Berstruktur; 46 |
| **OPT-KBAT-OVERRIDE** | Per leaf, optional, stored `kbat`: "— Ikut aras pemikiran —" (null, default), "Mengaplikasi", "Menganalisis", "Menilai", "Mencipta" (the same lower-case values), "Bukan KBAT" (`bukan`). A read-only badge beside it shows "KBAT" or "Bukan KBAT" | 30; 45 |
| **OPT-KOD-MARKAH** | Mark-scheme point codes: `K` → "K - Kaedah"; `N` → "N - Ketepatan"; `P` → "P - Penaakulan / persembahan"; `B` → "B - Bebas"; `M` → "M - Mata sains"; `F` → "F - Fakta"; `C` → "C - Kandungan / contoh". Subject hint: K and N for Matematik and Matematik Tambahan; P for Matematik Tambahan; M for Fizik; F for Sejarah; C for BI writing and Sejarah examples. Bahasa Inggeris criteria C / CA / O / L and word ranges are in 45 | 30; 45; 46 |
| **OPT-STATUS-SOALAN** | One vocabulary on every screen, every role (Studio shows "Diluluskan", never "Diterbitkan"). Label → stored `question_versions.status` (+ condition) → filter query: "Draf" → `draft` (no rejection reason) → `status=draft`; "Menunggu Semakan" → `review` → `status=review` (never `reviewed`); "Diluluskan" → `approved` → `status=approved`; "Ditolak" → `draft` with `rejection_reason` set → `status=draft&rejected=true`; "Diarkibkan" → `archived` → `status=archived`. Chip colours: amber (Menunggu Semakan), green (Diluluskan), red (Ditolak, shows the reason). The tiles Draf, Menunggu Semakan, Diluluskan, Diarkibkan count the stored values; "Ditolak ({n})" is a sub-count of Draf. Error "Status tidak sah." The English V2 words Draft, Reviewed, Approved, Archived and the old labels Semakan, Menunggu, Diterbitkan, Diarkib are not shown | 20 Soalan Saya; 30 Studio, M-01; 45 |
| **OPT-SERVABILITY** | The 7 servability activities (stored → label): `databank` → "Databank"; `latih_tubi_spm` → "Latih Tubi"; `bab` → "Soalan by Chapter"; `simulasi_paper` → "Simulasi"; `simulasi_kuiz` → "Kuiz"; `jana_kertas` → "Jana Kertas"; `permainan` → "Permainan" (not servable when the question has an image or stimulus: "Soalan bergambar tidak digunakan dalam permainan."). State text "Boleh dilihat" / "Tidak boleh dilihat". Summary "Dilihat murid di {n} daripada 7" | 30; 45 |
| **OPT-DSKP-TAG** | Filter: "Semua" (empty), "Ada DSKP Tag" (`tagged`), "Belum Ditag" (`untagged`) | 30 |
| **OPT-COMPLIANCE** | Filter: "Semua", "Verified" (`verified`), "AI Verified" (`aiVerified=true`), "Pending Mapping" (`pending_mapping`), "Tiada Source PDF" (`sourceFile IS NULL`) | 30 Senarai Soalan |
| **OPT-SOURCE-TYPE** | Filter: "Semua", "Textbook" (`textbook`), "DSKP" (`dskp`), "Trial" (`trial`), "Skema" (`marking_scheme`); `ai_generated` is not offered | 30 |
| **OPT-BATCH-STATUS** | Intake batch: `submitted` → "Dihantar", `processing` → "Sedang diproses", `ready_for_review` → "Selesai", `failed` → "Gagal", `cancelled` → "Dibatalkan"; job-level words in X10.5.3 | 30; 45 |
| **OPT-KIRIMAN-STATUS** | Kiriman Guru filter: "Semua Status", "Pending" (`submitted`), "Processing" (`processing`), "Selesai" (`ready_for_review`), "Ditolak" (`rejected`, set by the admin with a reason) | 30 |
| **OPT-STATUS-SET** | Teacher question set: `draft` → "Draf", `published` → "Diterbitkan" | 20 Set Soalan |
| **OPT-KONTRAK-SUMBER** | Kontrak source: `draf` → "Draf", `spec` → "Spec", `disahkan` → "Disahkan" (Disahkan only through the Pengesahan tab) | 30 Kontrak |
| **OPT-STATUS-LAPORAN** | Question report: `pending` → "Menunggu", `reviewed` → "Disemak", `fixed` → "Diperbaiki", `dismissed` → "Ditolak", `removed` → "Dikeluarkan" (set by Arkib, not selectable). Admin chips: "Menunggu ({n})", "Selesai ({n})" (= Disemak + Diperbaiki + Ditolak + Dikeluarkan), "Semua ({n})" | 10 Laporan Soalan; 30 |
| **OPT-REPORT-REASON-MCQ** | Report dialog, objective question, 7 reasons: `wrong_answer` "Jawapan tidak tepat"; `confusing_question` "Soalan mengelirukan"; `wrong_options` "Set jawapan tidak tepat"; `missing_options` "Pilihan jawapan tidak lengkap"; `duplicate` "Soalan berulang / pendua"; `typo` "Kesalahan ejaan / taip"; `other` "Lain-lain". 1 to 8 reasons per report; the pupil never sees `outdated` (teacher only) | 10; 46 |
| **OPT-REPORT-REASON-STRUCT** | Report dialog, structured question, 5 reasons: `wrong_answer` "Skema jawapan tidak tepat"; `confusing_question` "Soalan mengelirukan"; `wrong_options` "Markah tidak adil"; `typo` "Kesalahan ejaan / taip"; `other` "Lain-lain" | 10; 46 |

### X11.3 Practice, games and rewards

| Master ID | Concept and values | Used by |
|---|---|---|
| **OPT-MODE-SESI** | The registry of `practice_answers.mode` (check `ck_practice_answers_mode`), also the session label in the Sejarah and Profil tables. Stored → BM name: `latih_tubi` → "Latih Tubi"; `random` → "Latih Tubi Rawak"; `chapter` → "Soalan by Chapter"; `revision` → "Ulang Kaji"; `remedial` → "Remedial"; `mission` → "Misi Harian"; `question_set` → "Set Soalan Guru"; `pksk` → "PKSK"; `databank` → "Databank Soalan"; `kuiz` → "Simulasi - Kuiz"; `simulasi` → "Bijak SPM"; `tracking_a` → "Tracking A"; `subjektif` → "Subjektif" (also Kertas Subjektif); `structured` → "Soalan Berstruktur"; `battle` → "Battle"; `audio_kbat` → "Audio KBAT"; `game` → "Permainan"; legacy `past_year` → "Tahun Lepas" (read as `databank`); legacy `ramalan` → "Tracking A" (read as `tracking_a`). Battle Arena writes mode `battle`; every other game writes mode `game` with the game key in `part_ref` (OPT-GAME-KEY). The Sejarah Kuiz SPM chips are "Semua", "Tahun Lepas", "Latih Tubi", "Tracking A" (→ `all`, `past_year`, `latih_tubi`, `ramalan`) | 10 A1, Sejarah, Prestasi; 40 FR-X4-5; 46; 48; 50 §4.7a |
| **OPT-GAME-KEY** | Game keys for `part_ref` (`<key>#<position>`), with the specification: `battle` Battle Arena (GAME-01; mode `battle`), `papan-bijak` Papan Bijak (GAME-02), `perang-fakta` Perang Fakta (GAME-03), `benteng-ilmu` Benteng Ilmu (GAME-04), `perlumbaan-matematik` Perlumbaan Matematik (GAME-05), `kuiz-relay` Kuiz Relay (GAME-06), `teka-silang-kata` Teka Silang Kata (GAME-07), `betul-salah` Betul atau Salah (GAME-08), `cabaran-kilat` Cabaran Kilat (GAME-09), `tembak-jawapan` Tembak Jawapan (GAME-10), `susun-jawapan` Susun Jawapan (GAME-11), `kad-memori` Kad Memori (GAME-12), `jutawan` Jutawan Ilmu (GAME-13), `tournament` Liga and Tournament (GAME-15). Roda Nasib (GAME-14) writes no answer row | 48 |
| **OPT-BILANGAN-LT** | Question count for Latih Tubi, Soalan by Chapter and game rooms: 5, 10 (default), 15, 20. A count above the available is disabled | 10; 46; 48 |
| **OPT-BILANGAN-DB** | Databank: 5, 10 (default, R1 decision D113), 20 | 10; 46 |
| **OPT-BILANGAN-KUIZ** | Simulasi — Kuiz: 5, 10, 20 (default and the fallback for any other value), 40 | 10; 46 |
| **OPT-STATUS-ATTEMPT** | Bijak attempt: `in_progress` → "Belum dihantar", `submitted` → "Dihantar", `auto_submitted` → "Dihantar automatik", `abandoned` → "Ditinggalkan" | 10; 46 |
| **OPT-STATUS-BAHAGIAN** | Part result: `betul` → "✓ Betul", `separa` → "Separa", `salah` → "✗ Salah", `kosong` → "Tiada jawapan", `belum_dimarkah` → "Belum dimarkah" (suffix " {a}/{m}") | 10; 46 |
| **OPT-STATUS-HEADCOUNT** | Card "Active" / "Draft"; chip "Auto" / "Manual"; pupil status "On Track" / "Below" / "—"; the card text "Below Target" (English kept as V2) | 10; 20 |
| **OPT-PERIOD** | Papan Pendahulu period: "Semua Masa" `all` (default), "Minggu Ini" `week` (current ISO week from Monday 00:00 MYT), "Bulan Ini" `month` (current calendar month) | 10 |
| **OPT-SKOP** | Papan Pendahulu scope: "Kelas" `kelas`, "Sekolah" `sekolah`; default Kelas when the pupil is in a class, else Sekolah (no class: the tab Kelas is hidden) | 10 |
| **OPT-TIER** | Syiling tier (admin-configurable; names fixed): "Gangsa" 🥉 from 0 (50 : 1), "Perak" 🥈 from 500 (40 : 1), "Emas" 🥇 from 2,000 (30 : 1), "Platinum" 💎 from 5,000 (20 : 1). Admin filter "Semua Tier". Colour swatches #b45309, #94a3b8, #f59e0b, #06b6d4 | 10; 30 P2; 48 |
| **OPT-TUKAR** | Tukar Token amounts: 50, 250, "Semua" | 10; 48 |
| **OPT-STATUS-TEBUSAN** | Redemption: `pending_admin` → pupil "Menunggu", admin "⏳ Pending Admin"; `delivered` → pupil "Dihantar", admin "🎁 Delivered"; `cancelled` → pupil "Dibatalkan", admin "❌ Cancelled"; `pending_parent_consent` stays a valid stored value but is never produced and never shown in R1 (parent consent is not built, D-GAME-5). The admin default pill is "⏳ Pending Admin"; the admin filter also has "Semua" | 10; 30 P2; 48 |
| **OPT-HADIAH-KATEGORI** | Reward category (stored → label, order): `flagship` → "Mahkota"; `ewallet` → "E-Wallet"; `telco` → "Telco"; `gaming` → "Gaming"; `streaming` → "Streaming"; `food_beverage` → "F&B"; `ecommerce` → "E-Commerce"; `education` → "Pembelajaran"; `entertainment` → "Hiburan"; the filter pill "Semua" comes first. The same words show to pupils and admins (the admin screens add the emoji 🏆 💳 📱 🎮 🎬 🍔 🛒 📚 🎭); a raw key such as `Fnb` never shows. Delivery: `manual` → "Manual (admin paste)", `instant` → "Instant" (`api` is not offered) | 10 Kedai Hadiah; 30 P2-07 |
| **OPT-RARITY** | Pencapaian rarity: "Biasa", "Jarang", "Epik", "Legenda" | 10 |
| **OPT-MOOD** | Dashboard mood: `happy` → "😄 Gembira", `ok` → "🙂 Okay", `sad` → "😟 Sedih", `stressed` → "😣 Tertekan" | 10 |
| **OPT-CABARAN** | Challenge type (six): `quiz_count` → "Bilangan Kuiz"; `accuracy` → "Ketepatan (%)"; `topic_variety` → "Topik Berbeza"; `combo` → "Kombo (jawapan betul berturut-turut)"; `streak` → "Hari Berturut-turut"; `time_spent` → "Masa (min)". Difficulty `easy` / `medium` / `hard` → "Mudah", "Sederhana", "Sukar" | 30 P2-03; 48 |
| **OPT-GAM-JENIS-TRANSAKSI** | Ledger kind: `earn` → "💰 Dapat"; `spend` → "🛍️ Belanja"; `convert` → "🔄 Tukar"; `bonus` → "🎁 Bonus"; `refund` → "↩️ Refund"; filter first option "Semua Jenis". `Sumber` keys: `latihan` → "Latih Tubi", `cabaran-harian` → "Cabaran Harian", `kuiz` → "Kuiz", `admin` → "Pelarasan Admin", `tebus` → "Tebusan Hadiah"; any other key shows "Lain-lain" | 30 P2-05 |
| **OPT-STATUS-TIKET** | Support ticket, stored → label: `dibuka` → "Dibuka"; `dalam_proses` → "Dalam Proses"; `menunggu_balas` → "Menunggu Balas"; `selesai` → "Selesai"; `ditutup` → "Ditutup". Default on a new ticket `dibuka`. Pupil and teacher tabs/chips show the label with the count, default "Semua"; the admin chips show the lower-case stored word with the count (`dibuka (3)`) | 10 A4; 20 A4; 30 P2-20 |
| **OPT-STATUS-MISI** | Mission: no stored status; display badge "Global" for platform missions | 20 |

### X11.4 People, school and account

| Master ID | Concept and values | Used by |
|---|---|---|
| **OPT-PERANAN** | Stored `users.role` → label: `student` → "Pelajar"; `teacher` → "Guru"; `parent` → "Ibu Bapa"; `sponsor` → "Penaja"; `school_admin` → "Admin Sekolah"; `ppd_officer` → "Pegawai PPD"; `admin` → "Admin". The register offers "Pelajar", "Guru", "Ibu Bapa" only. List filter order: Semua Peranan, Pelajar, Guru, Admin Sekolah, Pegawai PPD, Admin (Ibu Bapa and Penaja after). Create-form order: Pelajar, Guru, Ibu Bapa, Penaja, Admin Sekolah, Pegawai PPD, Admin. "Pegawai JPN" is not offered. Admin Pusat may assign all seven; Admin Sekolah only `student` and `teacher` (school-admin lists filter Pelajar and Guru; the role control on a pupil form is read-only text). A student never combines with another role; `admin` is single-role | 10 register; 20; 30 |
| **OPT-BULK-ROLE** | Import Pengguna roles: `teacher` → "Guru", `parent` → "Ibu Bapa", `school_admin` → "Admin Sekolah", `ppd_officer` → "Pegawai PPD". Admin Sekolah imports teachers only (typed 403); the school is required for teacher and school_admin | 30 |
| **OPT-STATUS-AKAUN** | List filter: "Semua" (empty), "Aktif" → `active`, "Tidak Aktif" → `inactive` (includes pending and suspended). Edit radios: "Aktif (boleh log masuk)" → `active`, "Digantung" → `suspended`. Teacher pending list = `pending` | 20; 30 |
| **OPT-NEGERI** | The 16 states, stored as the full name: Johor, Kedah, Kelantan, Kuala Lumpur, Labuan, Melaka, Negeri Sembilan, Pahang, Perak, Perlis, Pulau Pinang, Putrajaya, Sabah, Sarawak, Selangor, Terengganu. The pupil register select shows the short forms "KL", "N.Sembilan", "P.Pinang" and stores the full name. Filters add "Semua Negeri". Not shown to Admin Sekolah (scope is one school); shown in Admin Pusat and PPD views | 10 register; 20; 30 |
| **OPT-JENIS-SEKOLAH** | Stored = label: `SK`, `SMK`, `SJK(C)`, `SJK(T)`, `MRSM`, `SBP`; filter "Semua Jenis" | 30 |
| **OPT-LANGGANAN** | Status `active` → "Aktif", `grace` → "Tempoh Ihsan", `expired` → "Tamat", `cancelled` → "Dibatalkan"; Pakej "Pemantauan", "Penuh"; Tingkatan only "Tingkatan 4", "Tingkatan 5"; create cards "Pakej SPM Tingkatan 4", "Pakej SPM Tingkatan 5" | 30 |
| **OPT-FAITH** | Latar agama (Tetapan): "— Tidak nyatakan —" (null, default), "Islam" → `muslim`, "Hindu" → `hindu`, "Buddha" → `buddhist`, "Kristian" → `christian`, "Tiada" → `none`; label "Agama / kepercayaan", stored in `user_settings`; enabled only when Mod Rohani is on. Sub-text "Bagi konteks supaya kandungan lebih relevan. Tidak diwajibkan." (the word "AI" is removed because ALESA is hidden, D73) | 10 A2; 20 A2 |

### X11.5 Teacher, school admin and reports

| Master ID | Concept and values | Used by |
|---|---|---|
| **OPT-KELAS-OWN** | Source `GET /api/guru/classes`: the active classes of the signed-in teacher (`classrooms.teacher_id = me`; past years only with the `year` filter); value `classrooms.id`, label = class name; sorted by `education_level` then name (Malay collation). First option per screen: "Semua Kelas" (filters), "-- Pilih kelas --" (forms), "Semua kelas saya" (Misi). A teacher with no class gets a disabled control and the screen's no-class text | 20 |
| **OPT-JULAT** | Pills "7 Hari" → 7, "30 Hari" → 30 (default), "3 Bulan" → 90; query `range`; any other value is treated as 30 | 20 |
| **OPT-TEMPOH** | Period select: "Semua Masa" `all` (default), "7 Hari" → 7, "30 Hari" → 30, "3 Bulan" → 90; Statistik Penggunaan pills "Hari Ini" → 1, "7 Hari" → 7, "30 Hari" → 30 (default 30) | 20 AS; 30 Monitoring |
| **OPT-RISIKO** | Select "Semua Risiko" (empty, default), "Kritikal" `kritikal`, "Tinggi" `tinggi`, "Sederhana" `sederhana`, "Rendah" `rendah`; row-only "Belum Bermula" `belum_bermula` (no answers; not selectable). Rule on accuracy rounded to a whole number: below 40 Kritikal; below 55 Tinggi; below 70 Sederhana; otherwise Rendah | 20 |
| **OPT-KESUKARAN-ITEM** | Analisa Item filter on % Betul (whole number): "Semua Tahap" (empty, default), "> 70% (Mudah)" `mudah`, "40–70% (Sederhana)" `sederhana` (40 to 70 inclusive), "< 40% (Sukar)" `sukar` | 20 |
| **OPT-ENGAGEMENT** | Non-overlapping bands over a pupil's all-time answers in scope (R1 decision D113): "Champion" 51 or more (text ">50 soalan"); "Konsisten" 20 to 50 ("20-50 soalan"); "Berkembang" 5 to 19 ("5-19 soalan"); "Minimum" 1 to 4 ("1-4 soalan"); "Tidak Terlibat" 0 ("0 soalan") | 20 |
| **OPT-GRED** | Grade from a whole-number score (half away from zero): A+ 90-100, A 80-89, A- 70-79, B+ 65-69, B 60-64, C+ 55-59, C 50-54, D 45-49, E 40-44, G below 40; grade points A+ 0, A 1, A- 2, B+ 3, B 4, C+ 5, C 6, D 7, E 8, G 9; GPS = mean grade point | 20 Headcount |
| **OPT-JENIS-INTERVENSI** | "Akademik (prestasi rendah)" `akademik`, "Kesejahteraan / mood" `kesejahteraan`, "Kehadiran" `kehadiran`, "Lain-lain" `lain`; placeholder "-- Pilih jenis --" | 20 |
| **OPT-HEATBAND** | Analitik: "Mahir (75%+)" accuracy 75 or more; "Sederhana (50-74%)"; "Lemah (<50%)"; "Belum Cuba" (no answers, cell "-"). The other mastery bands are fixed in X4b | 20 |
| **OPT-BULAN** | "Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember" → 1..12; chart short labels Jan, Feb, Mac, Apr, Mei, Jun, Jul, Ogo, Sep, Okt, Nov, Dis | 20 |

### X11.6 Content and other admin sets

| Master ID | Concept and values | Used by |
|---|---|---|
| **OPT-VIDEO-KATEGORI** | Stored → label: `motivasi` → "Motivasi", `tutorial` → "Tutorial", `tips-spm` → "Tips SPM", `ceramah` → "Ceramah", `lain-lain` → "Lain-lain"; pupil pills add "Semua" first and "(n)" counts; a pill with 0 is disabled | 10 Video; 30 N-01 |
| **OPT-ARTIKEL-KATEGORI** | Stored → label: `TIPS_BELAJAR` → "Tips Belajar", `BERITA` → "Berita", `MOTIVASI` → "Motivasi", `PANDUAN_IBU_BAPA` → "Panduan Ibu Bapa", `PANDUAN_GURU` → "Panduan Guru", `KEJAYAAN` → "Kejayaan", `UMUM` → "Umum". The pupil filter order is "Semua", "Berita", "Kejayaan", "Motivasi", "Panduan Guru", "Panduan Ibu Bapa", "Tips Belajar", "Umum". Article status "Diterbitkan" / "Draf"; Tahap filter "Semua" then Tingkatan 1 to 5 | 10 Artikel; 30 N-02 |
| **OPT-NOTA-JENIS** | Filter and form order: "Ringkasan" `RINGKASAN`, "Lengkap" `LENGKAP`, "Formula" `FORMULA`, "Tips & Tricks" `TIPS_TRICKS`. Stored-only types show in lists: `MIND_MAP` "Peta Minda", `FLASHCARD` "Kad Imbas", `CHEAT_SHEET` "Lembaran Rujukan" | 30 N-04 |
| **OPT-BANNER** | Jenis: `HERO` "Hero", `PROMO` "Promosi", `ANNOUNCEMENT` "Pengumuman", `EVENT` "Acara" (legacy `FEATURE` "Ciri Utama (lama)" and `PROMOTIONAL` "Promosi (lama)" stay valid and are not offered for new banners); Jenis Pautan `NONE` "Tiada", `SUBJECT` "Subjek", `QUIZ` "Kuiz", `ARTICLE` "Artikel", `EXTERNAL` "Pautan Luar"; Sasaran `ALL` "Semua", `STUDENT` "Pelajar", `TEACHER` "Guru", `ADMIN` "Admin" | 30 N-03 |
| **OPT-AUDIO-STATUS** | `draft` "Draft", `pending_review` "Pending Review", `approved` "Approved", `archived` "Archived" (V2 words kept); the create form offers the first three | 30 P2-17 |
| **OPT-MARKET** | Kategori "Peralatan Sekolah", "Buku & Rujukan", "Uniform & Pakaian", "Stationery", "Digital & E-Book", "Lain-lain"; Keadaan "🆕 Baru", "♻️ Terpakai"; Stok `available` "✅ Ada", `out_of_stock` "❌ Habis"; Penghantaran "Ambil Sendiri", "Pos / Kurier", "COD", "Percuma"; Status produk "🟢 Aktif", "⏸️ Draf", "🔴 Ditolak"; status penjual "Pending", "Aktif", "Digantung", "Diharamkan" | 30 P2-12 |
| **OPT-SYILING-REWARD-TYPE** | Kos Sebenar Hadiah category: `VOUCHER` "Baucar", `PHYSICAL` "Fizikal", `EXPERIENCE` "Pengalaman", `DIGITAL` "Digital", `SUBSCRIPTION` "Langganan" | 30 P2-09 |
| **OPT-AKTIF** | Switch "Aktif" / "Tidak Aktif" in lists; checkbox "Aktif" in forms, checked by default on create | 30 |

### X11.7 Register ID to master OPT ID

Where two registers used different IDs for one concept, the master ID is the one in the first column of §X11.1 to §X11.6. "(context)" means the register ID meant different things in different places and each meaning maps separately.

| Register ID (source) | Master ID |
|---|---|
| OPT-QTYPE (10, 46) | OPT-MOD-JAWAPAN (served item kinds) and OPT-JENIS-SOALAN (question type) |
| OPT-KERTAS (10, 30, 45, 46) | OPT-KERTAS (Kertas 1 to 4) |
| OPT-KERTAS (20, paper type chosen by a teacher) | OPT-JENIS-HANTARAN |
| OPT-JENIS-KERTAS (30, 45) | OPT-JENIS-KERTAS |
| OPT-ARAS (20, 30, 45; Bloom level) | OPT-ARAS |
| OPT-ARAS (10, 46; pupil "Aras KBAT" filter LOTS 1 to HOTS 6) | OPT-ARAS-KBAT |
| OPT-KESUKARAN (10, 20), OPT-KESUKARAN-5 (30, 45) | OPT-KESUKARAN |
| OPT-KESUKARAN-3 (30) | OPT-KESUKARAN-3 |
| OPT-STATUS-SOALAN (20, 30) | OPT-STATUS-SOALAN (five labels) |
| OPT-MODE-SESI (10, 46) | OPT-MODE-SESI |
| OPT-STATUS-LAPORAN (10), OPT-LAPORAN-SOALAN (30) | OPT-STATUS-LAPORAN |
| OPT-STATUS-TIKET (10, 20), OPT-TIKET-STATUS (30) | OPT-STATUS-TIKET (stored values `dibuka`, `dalam_proses`, `menunggu_balas`, `selesai`, `ditutup`; the English values `open`, `in_progress`, `waiting_reply`, `resolved`, `closed` in 20 are not stored) |
| OPT-STATUS-REDEEM (10), the redemption status inside OPT-HADIAH-KATEGORI (30) | OPT-STATUS-TEBUSAN |
| OPT-KATEGORI-HADIAH (10), OPT-HADIAH-KATEGORI (30) | OPT-HADIAH-KATEGORI |
| OPT-KATEGORI-VIDEO (10), OPT-VIDEO-KATEGORI (30) | OPT-VIDEO-KATEGORI |
| OPT-KATEGORI-ARTIKEL (10), OPT-ARTIKEL-KATEGORI (30) | OPT-ARTIKEL-KATEGORI |
| OPT-TIER (10), OPT-GAM-TIER (30) | OPT-TIER |
| OPT-FAITH (10), OPT-LATAR-AGAMA (20) | OPT-FAITH |
| OPT-ROLE-REG (10), OPT-ROLE (20), OPT-PERANAN (30) | OPT-PERANAN |
| OPT-TEMPOH-AS (20), OPT-MONITORING-TEMPOH (30) | OPT-TEMPOH |
| OPT-BATCH-STATUS (30, 45) | OPT-BATCH-STATUS |
| OPT-NEGERI (10, 20), OPT-NEGERI-SEKOLAH (30) | OPT-NEGERI |
| OPT-NEGERI-KERTAS (30, 45) | OPT-NEGERI-KERTAS |
| OPT-BILANGAN-LT, -DB, -KUIZ (10, 46) | the same IDs |
| OPT-JENIS-SOALAN, OPT-MOD-JAWAPAN, OPT-JENIS-RANGSANGAN, OPT-KOD-MARKAH, OPT-KBAT-OVERRIDE, OPT-SERVABILITY, OPT-SALINAN-HAK-CIPTA, OPT-BAHAGIAN, OPT-PERATURAN, OPT-TAHUN (30, 45) | the same IDs |
| OPT-TP (10, 20, 30, 45) | OPT-TP |
| OPT-STATUS-ATTEMPT, OPT-STATUS-BAHAGIAN, OPT-STATUS-HEADCOUNT, OPT-PERIOD, OPT-SKOP, OPT-MOOD, OPT-RARITY, OPT-TUKAR, OPT-REPORT-REASON-MCQ, OPT-REPORT-REASON-STRUCT (10) | the same IDs |
| OPT-KELAS-OWN, OPT-JULAT, OPT-RISIKO, OPT-KESUKARAN-ITEM, OPT-ENGAGEMENT, OPT-GRED, OPT-JENIS-INTERVENSI, OPT-HEATBAND, OPT-BULAN, OPT-STATUS-SET, OPT-STATUS-MISI (20) | the same IDs |
| OPT-DSKP-TAG, OPT-COMPLIANCE, OPT-SOURCE-TYPE, OPT-KIRIMAN-STATUS, OPT-KONTRAK-SUMBER, OPT-BULK-ROLE, OPT-STATUS-AKAUN, OPT-JENIS-SEKOLAH, OPT-LANGGANAN, OPT-BANNER, OPT-NOTA-JENIS, OPT-AUDIO-STATUS, OPT-MARKET, OPT-SYILING-REWARD-TYPE, OPT-CABARAN, OPT-GAM-JENIS-TRANSAKSI, OPT-AKTIF (30) | the same IDs |
| OPT-JENIS-RANGSANGAN (30 "SUPERSEDED" 15-kind list) | OPT-JENIS-RANGSANGAN (7 kinds; the older lists are withdrawn) |
| New in this section | OPT-MCQ-PILIHAN, OPT-BAHASA, OPT-JENIS-TULISAN, OPT-GAME-KEY, OPT-JENIS-HANTARAN, OPT-ARAS-KBAT, OPT-TEMPOH, OPT-STATUS-TEBUSAN |

**Count.** The master list holds 80 option sets (X11.1: 12; X11.2: 23; X11.3: 20; X11.4: 7; X11.5: 10; X11.6: 8). Question status, question types, TP, Kesukaran, Kertas, answer modes, language and MCQ option count are the sets most documents cite: OPT-STATUS-SOALAN, OPT-JENIS-SOALAN, OPT-TP, OPT-KESUKARAN, OPT-KERTAS, OPT-MODE-SESI, OPT-BAHASA, OPT-MCQ-PILIHAN.
