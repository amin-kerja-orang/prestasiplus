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
| NFR-5 Privacy | No real person's name in docs, seeds or code. Pupils never see another pupil's personal data (X4-4). |
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

## X8. Glossary

| Term | Meaning |
|---|---|
| Servable | A question that a pupil surface can draw (D80/D85: approved, plus the surface's own rules). |
| Kontrak / Blueprint | Per subject × paper rule set (sections, quotas, marks). *Disahkan* = verified; required for pupil-facing papers (D76). |
| Set Builder | The single V2 tool to assemble a paper from the bank and publish it (Terbit). |
| Stimulus group | One shared image or passage with its questions, shown once and moved as a unit (D90). |
| Bab / SP | Chapter / Standard Pembelajaran from DSKP; used by Soalan by Chapter, Topik, Peta Belajar, Heatmap and Analitik. |
| P0 / P1 / P2 | Blocks 1.0 / important for 1.0 / polish, can follow 1.0. |
