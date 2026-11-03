# R1 Product Overview (PRD / BRD layer)

**Slug:** `r1-prd-devplan`. **Status:** For user review (G1). **Date:** 2026-11-04. **Owner:** Product Analyst (what and why only).
**Position:** [00-index](00-index.md) → **01-product-overview (this file)** → [02-urs](02-urs.md) → SRS per portal ([10-murid](10-murid.md), [20-guru-admin-sekolah](20-guru-admin-sekolah.md), [30-admin-pusat](30-admin-pusat.md)) → [40-cross-cutting](40-cross-cutting.md) → 50 data model and ERD → 60 API contract → [development plan](../../plan/r1-development-plan.md) → [traceability](../../plan/r1-traceability.md).

Naming: **V1** = prestasiplus.my, **V2** = prestasiplus.cloud (with its admin panel), **V3** = the new build in this repository (older documents call it "v2"). **UAT** = the V3 acceptance site.

## 1. Problem statement: why Release 1 (R1)

V3 was built in a short time by many parallel cloud sessions. A row-by-row comparison of V3 with V2 and V1 against the role-access matrix (3 to 4 November 2026, covering both the code on the working branch and the UAT site; summary in `docs/qa/gap-analysis-2026-11-04/`) found that V3 cannot yet be accepted. In plain terms:

| Area | What is wrong in V3 today |
|---|---|
| Question entry does not follow the DSKP | A figure, passage or table is stored as if it were a question. Questions that say "Rajah 3 menunjukkan…" are published without the figure. When a paper is uploaded, the stimulus is attached to the first question only, or is split from the 1..n questions that refer to it. Manual entry cannot add a second question to the same figure without uploading the figure again. Questions cannot be published without hand editing because the entry form and the CSV template lack the DSKP fields (unit, SP, thinking level, paper). |
| Admin side is duplicated, partly broken and incomplete | Three menu items open three lists of the same questions (`Bank Soalan`, `Bank Soalan (Studio)`, `Bank Soalan SPM`); two menu items open the same screen; two review queues disagree. PDF extraction hangs for ever. Several admin screens are missing or open a 404 (Tracking A, Kertas Subjektif, Tetapan, Video, Kelas, Kawalan Ciri). Teacher question submissions show "belum tersedia dalam demo". Dashboard, Analitik and Laporan are empty. |
| Acceptance data is wrong | The acceptance site has no verified exam contracts and no published papers, so Bijak SPM is empty. Hundreds of thousands of migrated questions have no chapter (Bab) or SP. Primary-school levels (Darjah) are still active, so statistics show 11 levels instead of 5. |
| Pupil modules missing or wrong | Headcount and Analisa Item are hidden; Prestasi opens a school-wide dashboard (a privacy defect); Soalan by Chapter and Latih Tubi say "akan datang" for Tingkatan 1–3; Laporan Soalan is hidden; Profil, Tetapan and Dashboard are thin; drills serve only text questions. |
| Teacher and school-admin screens disagree | The same measure (pupils, teachers, answers) shows different numbers on different screens. Weekly report and several analytics screens are missing. |
| Responsive and placeholders | Question-paper screens break on a phone (no "Hantar" button, figure not reachable while answering). "Pratonton" and "akan datang" pages stand in for ticked matrix modules. |

**R1 therefore closes, fixes and completes the gaps against the role-access matrix. It is not a rebuild.** The existing V3 code is the base; only what the gap list names is changed (FR-X1-5).

## 2. Goals and success measures

| # | Goal | Measure (how we know) |
|---|---|---|
| G1 | Every module ticked in the matrix works fully on real data (D100). | No "Pratonton", "akan datang", "belum tersedia", prototype page, mock data or dead control on any ticked module (AC-X2-1..3, AC-MUR-P2-1). Every sidebar item opens a working page for each role. |
| G2 | Questions are entered, stored and shown the DSKP way. | A stimulus group of 1..n questions is shown once and stays visible while answering (AC-X6-2); no published question lacks its figure; admin can enter and upload with DSKP tags (QE acceptance criteria). |
| G3 | A Bijak SPM paper can be created, published and sat end to end. | On the acceptance site a pupil sees at least one published paper under a verified contract and submits a sitting. |
| G4 | Tingkatan 1–5 pupils all get practice; Darjah is hidden. | Statistics show 5 levels; a Tingkatan 1 pupil and a Tingkatan 5 pupil each start a drill (D101). |
| G5 | Numbers agree across screens and roles. | The same measure shows the same number on every screen (XS rules, FR-X4-1). |
| G6 | Every screen is responsive. | At 375, 768 and 1280 px there is no horizontal page scroll and nothing is clipped (AC-X6-1). |
| G7 | Delivery is proven, not claimed. | The AC ledger (`docs/plan/r1-ac-ledger.md`) is 100% Pass on acceptance-site data, checked in a visible browser; the trace report shows `uncovered: 0 | dangling: 0`. |

## 3. Users and roles

Source: `docs/Matriks-Akses-Peranan .xlsx` (sheet "Matriks Akses"; its columns H, I and J are the "requirement 1.0" columns for Murid, Guru and Admin Sekolah) and `docs/requirements/role-access-matrix.md`.

| Role | Who | Matrix column | Modules (this release) |
|---|---|---|---|
| Murid (pupil), Tingkatan 1 to 5 (T1–T5) | Secondary-school pupil, 13–17 years; many use a phone | Murid | 1.0 column: 18 modules (A1, A2, A3, A5, 2–9, 12–14, 16, 21, 54); full column 41 modules in total (rows 15 and 37 hidden) |
| Guru | Subject teacher; manages own classes and pupils | Guru | 1.0 column: A1–A3, A5, rows 1–11, 41–44; plus linked 2b, 8b; Tiket Bantuan later |
| Admin Sekolah | School administrator (principal or senior assistant); sees own school only | Admin Sekolah | 1.0 column: A5, rows 1, 3–7, 10, 11, 45–53; Dashboard, Profil, Tetapan, Panduan, Tiket later |
| Admin Pusat | Central platform administrator | not a matrix column | Every admin capability that feeds, manages and monitors the matrix modules (PRD 30) |
| Ibu Bapa (parent) | Parent of a pupil | **no matrix column** | Out of scope as a user. Only the pupil-side "Jemput Ibu Bapa" (row 40) and the admin view of parent links (P2-16) are in the matrix. |

Primary pupils (Darjah 1–6) are out of scope for the whole release (D72, D96).

## 4. Scope

### 4.1 In scope
- Every module ticked in the Murid, Guru and Admin Sekolah matrix columns, delivered in two steps with the same quality bar (D100, D106): the 1.0 columns (plus Latih Tubi) and the modules they link to first; then the rest of the ticked modules.
- The Admin Pusat screens and data operations needed to feed those modules (question pipeline, curriculum and DSKP, content, users and schools, monitoring, flags, support contact).
- Question structure per the DSKP: stimulus groups of 1..n questions; DSKP tags; paper blueprints.
- Responsive behaviour at 375, 768 and 1280 px for every screen.
- Data and API definitions that the build needs (documents 50 and 60).

### 4.2 Out of scope
| Item | Reason |
|---|---|
| Cikgu Alesa (matrix row 37) and every other AI surface | Hidden behind one switch until a real AI provider exists (D73, D102). The URL shows the standard 404 page. |
| Mohon Keluarga Angkat (matrix row 15) | Hidden until the sponsorship flow exists (D74, D102). Standard 404. |
| Darjah 1–6 (primary) | Secondary only (D72, D96). |
| Ibu Bapa as a user role | No matrix column. |
| V2 extras with no matrix row (for example Target SPM, Misi Harian page, Kombo page, Notifikasi, Sekolah Bersaing for pupils, Psikometrik, Wellbeing, billing, Log Audit viewer, Chatbot) | Not ticked in the matrix. |
| A redesign or new features | R1 only fixes and completes (FR-X1-2, FR-X1-5). New menus, pages or copy need the user's approval (D94). |
| Changing V1, V2 or the acceptance site without the user's approval | Those systems are read-only references; one-off data operations run only with explicit approval (D95, FR-X5-3). |

## 5. User decisions D100–D108 in plain words

Full text is in [TRACKER.md](../../TRACKER.md).

| ID | Decision in plain words |
|---|---|
| D100 | Everything ticked in the matrix must work fully. No preview, "akan datang", "belum tersedia", prototype page, mock data or dead control. The 1.0 columns come first, then the rest. |
| D101 | Tingkatan 1–3 pupils get practice just like Tingkatan 4–5 (Latih Tubi, Soalan by Chapter, Topik, Peta Belajar) wherever questions exist. The level-wide "akan datang" message is removed. Darjah stays hidden. |
| D102 | Cikgu Alesa and Mohon Keluarga Angkat stay hidden for now. They are the only exceptions to D100. |
| D103 | The fix work is planned as non-overlapping sectors; developers declare a sector and claim tasks with tracking. |
| D104 | SPM Subjektif and Kertas Subjektif are fully working in 1.0, with pupil self-marking. No switch hides them. |
| D105 | Drills (Latih Tubi, Databank, Soalan by Chapter) follow the DSKP: they serve questions with figures and whole stimulus groups, with the figure shown once and the group never split. |
| D106 | No dead links: any module that a 1.0 screen links to is delivered with 1.0. "Phase" means order of delivery, never less scope. |
| D107 | The admin UI stays close to V2 and V1. The admin menu follows the V2 sidebar with one "Soalan" group; V3 duplicates are merged or redirected with no function lost. |
| D108 | Principle rulings: (1) a stimulus group holds 1..n questions, even inside papers; (2) the thinking-level gate stays for Tingkatan 4–5; (3) Set Soalan Guru is fed by a teacher "Set Soalan" screen; (4) an admin Tiket Bantuan screen exists and the support contact is an admin setting; (5) school-admin Kirkpatrick shows all seven screens for the school; (6) hidden modules return the standard 404 page. The user may override these. |

Earlier decisions D28–D99 still apply where not superseded.

## 6. Constraints

| Constraint | Meaning for the build |
|---|---|
| Improve, not rebuild | Start from the existing V3 code. Reuse routes, components, APIs and data; change only what the gap names (FR-X1-5). Replacing a working part needs written approval. |
| Reference rule | Behaviour, flow, timers, result layout and BM copy follow V2 first, V1 second ("berdasarkan V2+V1 untuk betulkan V3"). If V2 works, replicate exactly; if it is broken, fix minimally and record the deviation. |
| DSKP governs question structure | Where V1 or V2 differ on question structure, the DSKP, D41, D90 and D105 win. |
| Stimulus groups | A stimulus is never a question. It holds 1..n questions, is shown once and stays visible while answering. |
| UI close to V2/V1 | Menus, pages, tabs and sections stay as in the SRS. The visual theme follows the design system decisions (light and dark). No UX change beyond what the SRS lists. |
| Responsive | 375 / 768 / 1280 px, no sideways page scroll, text at least 14 px (labels at least 12 px), touch targets at least 44 px. |
| Language | UI in exact Bahasa Melayu. New copy needs user approval. |
| Privacy | The repository is public. No real person's name, e-mail, credential or account name in documents, seeds or code; pupil data is never tied to a named real school; a pupil sees only their own data. |
| Read-only references | Nobody changes V1, V2 or the acceptance site without the user's explicit approval. |

## 7. Assumptions, dependencies and risks

### 7.1 Assumptions
- A1. One question store; the admin "legacy bank" is only a list style, not a second database.
- A2. Only Admin Pusat writes in the question and curriculum screens.
- A3. A question is servable when it is approved and passes the surface's own rules; papers need Terbit and a verified contract.
- A4. The acceptance site is UAT (`uat.prestasiplus.cloud`), a clone of V2 production data, so ACs are proven on that data (FR-X5-1). There is no local acceptance environment; the demo/e2e seed is for automated tests in CI only (D110). UAT holds real pupil data: evidence stays in the gitignored `.evidence/` and issues/PRs carry only pass/fail and IDs, never names.
- A6. The UAT operator is a designated developer with server access; the user approves every write; no AI session acts on a server (D95, D110). Every script operation runs as dry-run, report, user approval, real run.
- A7. Content work (Bab mapping, figure images for "Rajah n" questions, regrouping stimulus groups) is done by ADMIN users in the Portal Pentadbiran. Developers build and fix those screens and do not do the content work (D110).
- A5. The build is done by cloud agents that see only this repository; they never open V1, V2 or the acceptance site. **Every V2/V1 screen is therefore described in words inside the SRS** (layout, blocks in order, exact BM copy, states). If the text lacks a detail, the agent asks the Delivery Lead; it does not guess.

### 7.2 Dependencies
| # | Dependency | Needed for | Status |
|---|---|---|---|
| DEP-1 | **DSKP Tingkatan 1–3 source PDFs** (official curriculum documents for Matematik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah, Pendidikan Islam, Pendidikan Moral, Pendidikan Seni Visual) | Task S4-T09: extraction of the Tingkatan 1–3 DSKP, so T1–T3 questions can carry SP/TP | **Decided (user, 2026-11-04, D109):** not a prerequisite. T1–T3 use the same DSKP structure as T4–T5, built from the existing T1–T3 chapter and topic data (V3/UAT, V2) plus any T1–T3 PDF in `d:\prestasiplus-dskp`. Where no SP/TP is loaded, screens show Bab only, with no invented SP/TP labels (FR-MUR-DK-5). |
| DEP-2 | Evidence for exam-paper blueprints (at least two bodies of evidence per paper) | Verified contracts (Q-16, U-OP-04) | Prepared per paper; Matematik Tambahan paper 2 is sufficient first |
| DEP-3 | Extraction worker, OCR and an extraction provider on the acceptance site | Paper upload (Q-07, U-OP-02) | Operator task, done by the designated UAT developer (D110) |
| DEP-4 | User approval for each one-off data operation on the acceptance site, run by the designated UAT developer (dry-run, report, approval, real run) | U-OP-01..17 | Per operation; the developer's name is awaiting the user |
| DEP-6 | ADMIN users available to do the content work (Bab mapping, figure images, regroup) in the Portal Pentadbiran | U-OP-05, 07, 15, 17; AC-ADM-C05.3, AC-ADM-G7.2 | Decided owner (D110) |
| DEP-5 | A real AI provider | Only to un-hide Cikgu Alesa (out of scope) | Not planned |

### 7.3 Risks
| # | Risk | Mitigation |
|---|---|---|
| RK-1 | Questions stay structurally wrong because migrated data is split | Regroup work-list and detector (QE-08, G7); flagged questions are never served |
| RK-2 | Acceptance-site data wrong, so correct code looks broken | Fixed order of data operations (PRD 30 §5); dry-run reports on UAT before each approved write (no local rehearsal, D110) |
| RK-3 | "Done" declared without proof | AC ledger; only the Delivery Lead moves a card to Done after a visible-browser check at three widths |
| RK-4 | Merge conflicts on shared files | Single owner per shared file; sector rules in the plan |
| RK-5 | Estimates too optimistic for one developer | Stated openly in the plan; scope cuts go to the user |
| RK-6 | Chapter mapping of hundreds of thousands of questions is human work | Bulk-by-filter tool built by developers; ADMIN users do the mapping (D110), starting with the core Tingkatan 4–5 subjects; coverage reported per sprint |
| RK-7 | Real names leak through copied data | Fictitious names only; V2 captures never committed; UAT evidence only in the gitignored `.evidence/`, issues/PRs carry pass/fail and IDs only |

## 8. Release and delivery order

| Delivery | Content | Exit |
|---|---|---|
| **Delivery A** | The Murid, Guru and Admin Sekolah 1.0 columns (plus Latih Tubi), every module a 1.0 screen links to (D106), and the Admin Pusat screens that feed them | Every AC of every Delivery A module passes on acceptance-site data in a visible browser at three widths; data operations done; user signs off the demo |
| **Delivery B** | The remaining ticked modules (Murid A4 and rows 19, 22, 24, 25, 27, 32, 34–36, 38–40; Guru A4; Admin Sekolah Dashboard and account pages) and their admin screens | Each module passes its ACs and is switched on; no other matrix module stays hidden |

Inside Delivery A: P0 first, then P1; P2 may slip behind sign-off only if the user agrees. Milestones M0–M5 and the sprint plan are in the [development plan](../../plan/r1-development-plan.md).

## 9. Glossary

The glossary is in [40-cross-cutting.md §X8](40-cross-cutting.md) (Servable, Kontrak, Set Builder, Stimulus group, Bab / SP, P0 / P1 / P2). Other terms used here: **DSKP** = Dokumen Standard Kurikulum dan Pentaksiran; **SP / TP** = Standard Pembelajaran / Tahap Penguasaan; **T1–T5** = Tingkatan 1–5; **Terbit** = published; **AC ledger** = the table recording the result of every acceptance criterion.

## 10. Document map

| # | Document | Layer | Content |
|---|---|---|---|
| 00 | [00-index.md](00-index.md) | Entry | Read order, ID chain, conventions |
| 01 | [01-product-overview.md](01-product-overview.md) | PRD / BRD | This file: problem, goals, roles, scope, decisions, constraints, risks, delivery order |
| 02 | [02-urs.md](02-urs.md) | URS | User requirements per role, mapped to the SRS |
| 10 | [10-murid.md](10-murid.md) | SRS | Pupil portal |
| 20 | [20-guru-admin-sekolah.md](20-guru-admin-sekolah.md) | SRS | Teacher and school-admin portals |
| 30 | [30-admin-pusat.md](30-admin-pusat.md) | SRS | Central admin portal and data operations |
| 40 | [40-cross-cutting.md](40-cross-cutting.md) | SRS / NFR | Reference rule, scope, data, environments, non-functional requirements, responsive rules, verification, glossary |
| 50 | `50-data-model-erd.md` | Design | Data model and ERD (DM IDs) |
| 60 | `60-api-contract.md` | Design | API contract (API IDs) |
| plan | [r1-development-plan.md](../../plan/r1-development-plan.md) | Plan | Sectors, task cards, sprints, claim-and-track, Definition of Done |
| trace | [r1-traceability.md](../../plan/r1-traceability.md) | Traceability | Generated: PRD module → cards and card → PRD modules |

The ID chain that links them is explained in [00-index.md](00-index.md).
