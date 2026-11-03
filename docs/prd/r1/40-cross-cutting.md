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
| Local stack (`npm run stack:up`, port 5192/5193) | Development and first verification | Demo seed. Small, so not proof of behaviour at scale. |
| UAT (uat.prestasiplus.cloud) | Acceptance | V2 data migrated (±339k questions, 24,163 publicly counted). This is where 1.0 is accepted. |
| V2 / V1 production | Reference only | Read-only. Never written to. |

- **FR-X5-1** Every P0/P1 acceptance criterion is verified on **UAT data** (or on a local stack loaded with a UAT-equivalent dump), not only on the demo seed.
- **FR-X5-2** The local stack builds and starts with **no manual step**. Today the e2e seed step fails (`blueprint 3472/2 does not pass the Sahkan checks (NO_QUOTA, NO_KBAT)`) and the API does not start on its own. P0 for the development plan.
- **FR-X5-3** One-off data operations on UAT (Disahkan contracts, papers, Bab/SP mapping, Darjah deactivation) are delivered as reviewed scripts or admin-UI runbooks. They are executed only with the user's explicit approval. D95: blueprints on UAT are created by an admin in Kontrak, not seeded.

## X6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 Responsive | Every screen works at **375 / 768 / 1280 px** with no horizontal page scroll (project rule §7). See X6.1 for the detailed rules. The user reported on 2026-11-04 that some V3 screens are still bad, **especially the question-paper screens**. |
| NFR-2 Language | All UI copy in Bahasa Melayu, quoted exactly from V2 (or V1). New copy needs the user's approval (D94). |
| NFR-3 Accessibility | Replicates V2/V1 (D10). No regressions: labels on form controls, visible focus, touch targets usable on mobile. |
| NFR-4 Performance and rate limits | Normal admin navigation (one page every 2–3 s) never hits HTTP 429. Today fast navigation shows "Ralat" on Kurikulum/Subjek/Tahap/Set Builder. Limits are tuned per route group. A 429 shows a retry message, never an empty "Ralat" screen. |
| NFR-5 Privacy | No real person's name in docs, seeds or code. Pupils never see another pupil's personal data (X4-4). A pupil is shown to other pupils by the **display name = first name only, with no school**; the full name is shown only to the pupil's own teachers, the school admin and Admin Pusat. A pupil cannot change Tingkatan, school or role through `PUT /api/me`. |
| NFR-6 Feature flags | ALESA AI (D73) and Keluarga Angkat (D74) stay hidden in 1.0. |
| NFR-7 Errors | Every list and form has defined loading, empty and error states with BM copy. No silent failures. For example, intake "Sedang diproses" must time out with an error. |

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

1. **Functional test:** every AC for the module passes on the local stack and then on UAT data. The evidence is a test run plus screenshots.
2. **Side-by-side with the reference:** the V3 screen and the V2 (or V1) screen are captured at the same width and compared by the Delivery Lead. Every difference is either fixed or listed as a fidelity deviation.
3. **No regressions:** type-check, lint and the targeted unit tests are green. Every 1.0 sidebar item still opens (AC-X2-1).
4. **User review:** the user sees the result of the phase before the next phase starts.

Evidence capture rules: V1/V2 are read-only, one browser at a time, at least 3 s between pages. The V2 server blocks an IP after rapid scripted access (observed 2026-11-03).

## X9. End-to-end data chains

Each chain follows **one data record** from the place it is entered to every screen and process that must show or use it, across portals. Each is one Playwright spec on the UAT-like dataset (plan card S9-T06), runs at 1280 px with a 375 px pass of the pupil steps, and must pass before the modules it crosses are Done (FR-X1-5). Unless stated, the pupil is new (no earlier answers), the Syiling rate is the default 1, and the school, class and pupil are the seeded demo ones. Values are exact; "same number" means identical under the FR-X4 precision list.

**AC-CHAIN-1 Question group to every report.** Given the admin creates in the Studio wizard the stimulus group "Rajah 3" with 3 MCQ (Sains, Tingkatan 4, Bab 2, one SP, TP 3, difficulty 3), approves and publishes them, then: (a) a publish attempt of a fourth question with no Bab, in a subject and Tingkatan that have chapters (Sains T4 does), is refused with the gate list naming Bab (a subject and Tingkatan without chapters does not list the Bab item; SP and TP / aras stay required); (b) the T4 pupil's Latih Tubi Sains with 10 questions serves the 3 together with "Rajah 3" shown once; (c) Soalan by Chapter shows Bab 2 with "3 soalan"; (d) the pupil answers 2 right and 1 wrong. Then: pupil Prestasi tile "Sesi Kuiz" (sessions) = 1, "Soalan Dijawab" 3, "Ketepatan" 67; Analisa Item lists the wrong one under "Isyarat Awal" and "Soalan Dijawab" 3; the Heatmap Bab 2 tile reads "3 cuba · 67% betul" (amber); the teacher's Prestasi Kelas for the class of that pupil shows "Soalan Dijawab" +3 and XS-7 +3; the school-admin Prestasi shows the same +3; Admin Pusat Laporan shows +3 answers and +1 session for the window; the wallet is +2 Syiling and +20 XP (2 correct x rate 1; 10 XP each).

**AC-CHAIN-2 Paper PDF to a pupil sitting and every report.** Given the admin uploads a paper PDF (Sains, T4, Kertas 1) with Bahagian A of 10 items, Bahagian B of 5 items, and items 5 to 8 sharing "Rajah 3", accepts all 15 and uses "Hantar untuk semakan", then one draft paper with 2 sections and 15 placements exists, items 5 to 8 adjacent in one section, listed in "Kertas Diimport" with "Bilangan Soalan" 15; after "Semak & Terbit" under a Disahkan contract it is listed to a T4 pupil in Bijak. The pupil sits it: "Rajah 3" shows once for items 5 to 8; the pupil answers all 15 with 12 correct and presses Hantar twice. Then: `practice_answers` holds exactly 15 rows of mode `simulasi` (12 correct); the result shows "12 / 15"; pupil Prestasi "Soalan Dijawab" 15 and "Ketepatan" 80 with the sitting listed once with its Bijak label; the teacher and school-admin Prestasi and Admin Pusat Laporan show +15 answers; the wallet is +12 Syiling and +120 XP.

**AC-CHAIN-3 Bijak lanes: Tracking A and Subjektif.** Given a complete Tracking A set of 40 MCQ, when the pupil answers 30 correctly, then 40 rows of the Tracking A mode exist, "Soalan Dijawab" is +40, "Ketepatan" is 75 for this pupil, the hub "Prestasi SPM Anda" counts one session, and Headcount AR (Auto, Sains config) includes the 40 rows when HC-3 lists the mode. Given a Subjektif part of 4 marks, when the pupil submits and self-marks 3 through `POST /api/bijak/attempts/:id/self-mark`, then one row holds 3 awarded of 4 available (not counted correct), the Prestasi session list shows "3 / 4" and the wallet gains 3 x rate in Syiling + 30 XP; when the pupil changes the self-mark to 4, then the same row updates (still one row), counts as correct, and the wallet gains only the delta of 1 mark (+1 Syiling, +10 XP).

**AC-CHAIN-4 Class, Set Soalan, results.** Given the teacher creates class "4A" and adds pupil P1, and class "4B" with pupil P2, then P1's Kelas Saya lists 4A, the teacher and the classmates by first name only (no surname, no school), has no "Masukkan Kod Kelas" or "Sertai", and P2 does not see 4A. Given the teacher builds a set of 5 approved questions, where the question list includes one member of a 2-question stimulus group without its sibling, then saving is refused (422, `fields.questionIds`); with both members selected it saves, and the teacher assigns it to class 4A only. Then P1 sees the set in Set Soalan Guru, P2 does not, and P2 opening the set id gets 404. P1 answers the 5 questions with 4 correct: 5 rows of mode `question_set` exist, the teacher's set results show Penyertaan 1 and Skor Purata 80, class Prestasi +5 answers and the school-admin Prestasi +5.

**AC-CHAIN-5 Headcount from key-in to every view.** Given the teacher sets for Sains in class 4A TOV 40 and RS/ETR 80 with 3 OTRs in an Auto config ("Simpan Sasaran"), and the pupil has answered 10 Sains questions with 6 correct, then the teacher's table shows OTR1 53, OTR2 66, OTR3 80, AR 60, "Jurang +40" and pupil status "Below"; the pupil's `/headcount` card reads "Active" and its detail shows the same targets, AR 60, "Belum capai sasaran", Keyakinan "Sederhana" and status "Below"; the school admin's read-only list and the Prestasi Headcount pill show "Below" for the same pupil; "{n} entri headcount" is the same count on all of them. When the pupil then answers 10 more Sains questions all correct (16 of 20), AR becomes 80, status "On Track", Keyakinan "Tinggi", and the teacher's "On Track" count rises by 1 on Dashboard Headcount and the class dashboard.

**AC-CHAIN-6 Teacher question to the pupil.** Given the teacher submits through Sumbang Soalan one MCQ (Sains, Tingkatan 4, 4 options, 3 stars), then the teacher's list shows it "Menunggu Semakan" and the admin's "Kiriman Guru" lists it with source guru. Given the admin opens it in the Studio wizard (Subjek, Tingkatan, options and key prefilled), then Terbitkan is refused while Bab, SP or TP is empty and accepted after the admin sets Bab 2, an SP and TP 3. Then the teacher's list shows "Diluluskan"; a T4 pupil's Soalan by Chapter Bab 2 counts it ("1 soalan" more); after one pupil answers it the teacher's "Digunakan" rises per its definition in R1-GUR-44; a question the admin has not completed is shown to no pupil.

**AC-CHAIN-7 Support ticket.** Given a T5 pupil creates a ticket with Subjek "Tidak boleh buka kertas" and a Butiran, then it is listed to the pupil as "Dibuka" and to the admin in `/admin/tiket` with the role "Murid" and the pupil's school. Given the admin saves a reply and a status, then the pupil's ticket list shows the reply under "Balasan Sokongan" and the new status label with no reply box; the pupil of another school requesting that ticket id gets 404; the same flow with a teacher and a school-admin account shows the role "Guru" / "Admin Sekolah" in the admin queue.

**AC-CHAIN-8 School, quota and users to role visibility.** Given the admin creates a school with a seat limit of 30 pupils and an Admin Sekolah account, and that school admin logs in, then the school admin imports a file of 31 pupils and the whole file is refused with "Kuota penuh! Sila tingkatkan kuota dahulu."; a file of 30 imports (pending approval until Admin Pusat approves) and XS-1 is 30 on the school-admin dashboard and in Admin Pusat. A teacher created by the school admin can log in at once. A pupil can log in with the identifier, a password of 7 characters is refused and 8 accepted; the pupil sees exactly the pupil menu, `/admin` and `/prestasi/sekolah` are refused, a hidden module returns the standard 404 page, `PUT /api/me` with another `grade` or `schoolId` leaves the stored values unchanged, and a pupil of another school requesting this pupil's record gets 404; the school admin sees only the 30 pupils of its own school.

**AC-CHAIN-9 Coins to redemption.** Given the admin Syiling rate is 1, a pupil with 7 of 10 correct in Latih Tubi gains 7 Syiling and 70 XP; the admin sets the rate to 3 and the next 7 of 10 gives 21 Syiling; the Papan Pendahulu tab "Minggu" of the class shows the pupil's first name with 28 Syiling for the period. Given a pupil with 120 Syiling at tier Gangsa (50 : 1) converts 100, then the pupil has 2 tokens and 20 Syiling. Given a gift priced 2 tokens, the pupil redeems it, then tokens are 0, "Tebusan Saya" shows "Menunggu", the admin queue lists it, and after the admin pastes the code the pupil sees "Dihantar" with the code; a second redemption that the admin cancels shows "Dibatalkan" and the tokens are refunded exactly once.

## X8. Glossary

| Term | Meaning |
|---|---|
| Servable | A question that a pupil surface can draw (D80/D85: approved, plus the surface's own rules). |
| Kontrak / Blueprint | Per subject × paper rule set (sections, quotas, marks). *Disahkan* = verified; required for pupil-facing papers (D76). |
| Set Builder | The single V2 tool to assemble a paper from the bank and publish it (Terbit). |
| Stimulus group | One shared image or passage with its questions, shown once and moved as a unit (D90). |
| Bab / SP | Bab = textbook chapter (the only word used; never "Unit"); SP = Standard Pembelajaran from DSKP (under its Tajuk and SK). A question cannot be published without Bab, SP and TP/aras (admin gate); the admin work-list "Soalan tanpa Bab" lists legacy questions without one. Used by Soalan by Chapter, Topik, Peta Belajar, Heatmap and Analitik. |
| Display name | A pupil's first name only, no school; the only pupil name shown to other pupils. |
| Answer store | `practice_answers`, owned by practice (M05): one row per answered question, with a mode value; the only source of every answer-based figure (FR-X4-5). |
| Difficulty / TP | Difficulty 1 to 5 and TP 1 to 6 are stored separately; the three labels Mudah / Sederhana / Sukar are derived from difficulty (1-2, 3, 4-5). |
| P0 / P1 / P2 | Blocks 1.0 / important for 1.0 / polish, can follow 1.0. |
