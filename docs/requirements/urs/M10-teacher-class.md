# M10 — Teacher Portal: Class & Teaching — User Requirements Specification

## 0. Document control

| Field | Value |
|---|---|
| Document | URS — M10 Teacher Portal: Class & Teaching |
| Version | 1.17 |
| Date | 2026-10-03 |
| Status | **Approved (G1)** — audit round 2 PASS. v1.4 aligns to M04 v1.7; v1.5 fixes XL batch 2 round 2; v1.6 fixes the XL round 3 Minors; v1.7 applies XL batch 3 (XL3-12, XL3-32); v1.8 fixes XL batch 3 round 2 (R2-05, R2-06); v1.9 fixes R3-01 (session neutrality); v1.10 re-places the T4 session holders (M05 C17); v1.11 fixes their exact session lists (R4-01); v1.12 aligns them to the M08 display format (R5-01); v1.13 adds 4 generic DSKP SPs (187 pairs); v1.14 follows the M02 v1.19 T4 pool. Fidelity deviations decided under user rule D9 (standing, pre-approved), D10, D11 (virtual datasets) and D12 (one owner per store); unobservable teacher states are SOURCE-DERIVED, INFERRED or PROPOSED with provisional E2E. |
| Author | product-analyst (agent); data/interface parts of the companion SRS by solution-architect (agent) |
| Source discovery | [M10-teacher-class.md](../../discovery/M10-teacher-class.md) (§1.2 access outcomes, §2 screens, §4 entities, §5 rules, §6 endpoints, §7.2 defects D-01…D-25, §8 OQ-01…11, §9 live-action states, Appendices A–B), inventory [`inventory/M10/`](../../discovery/inventory/M10/) (`S1…S35-*.json`, `SHU-user-shell.json`, `_crawl.json`, `_summary.md`), page scripts [`inventory/_raw/M10/_scripts/`](../../discovery/inventory/_raw/M10/_scripts/), screenshots `docs/discovery/img/M10/` (64, masked), global shell [00-global-ui.md](../../discovery/00-global-ui.md) |
| Companion SRS | [srs/M10-teacher-class.md](../srs/M10-teacher-class.md) |
| Related | M01 v1.9 (seed accounts, 404 page, `/tetapan` DV-M01-01, "Mula Latihan" DV-M01-02, User), M02 v1.19 (School, `/api/schools/search`, ClassroomRef/Enrolment "owned by M10", complimentary enrolments), M03 (subjects 1–31, levels 1–11, CurriculumChapter/Topic), M04 v1.9 (question store incl. structured bank, QuestionReport, QuestionSubmission; DSKP "owned by M10"), M05 v1.8 (answer log and sessions, `/misi-harian`, `/remedial/saya`, quiz component), M06 (SPM pool counts reused by the databank), M08 v1.7 (classes 2001–2002 and students 3001–3008 designed there; `/prestasi/kelas*`, `/analitik/kelas`), M09 (article store, Audio KBAT store and review), M11 v1.7 (`/guru/monitoring`, teacher reports), M12 (`/guru/kirkpatrick*`), M14 v1.3 (coins, badges), M16 (tournament banner), M23 (global shell), M17 v1.4 (Command Center drill-down S4–S7, teacher scope), M18 v1.4 (8880 classes 516/517) |

**Change log**

| Version | Date | Change |
|---|---|---|
| 1.17 | 2026-10-03 | **Revision history — v1.17, Session 6 second pass (Standard track; see SRS v1.20; G1 approval kept).** New **DV-M10-33** (remedial question selection: wrong answers in weak topics, topped up from the weak topics' chapters, then subject + level — exact SP selection is not available in M04's public contract). FN-M10-2.2.11 "Selesai ({x}%)" now matches the scan (`completed` tests listed with `afterAccuracy`); the evaluation of a student who never answered ("Tiada aktiviti"); cancel of a foreign test → 404, of a non-active test → 409; generate refused → 422 (PROPOSED copy); drill `kirk` T1 "Relevan" / "Kegunaan" null, badge description empty, GPS source "Anggaran OTR" (PROPOSED; SRS BR-M10-36). New **DV-M10-34** (S4 QR modal class-name heading dark on the gradient → white). No observed value changed. |
| 1.16 | 2026-10-02 | **Revision history — v1.16, Session 6 build decisions (Standard track; see SRS v1.19; G1 approval kept).** New **DV-M10-31** (S2 `gpsOverall` 4.69 display constant, replicated; its own id, DV-M10-12 not widened) and **DV-M10-32** (Audio KBAT templates as the server defines them under D24: a CSV and a real `.docx` with the 4 columns `tajuk,kod_subjek,kod_tingkatan,nama_fail_audio`; SERVER behaviour, not a D9 fix). AC-M10-34.4 extended; AC-M10-15.2 corrected to a searchable dataset school (SMK DEMO is excluded from the school search, M02 v1.21). New AC-M10-36.4 (unverified copy of the paper submission and "Tahun" default) and AC-M10-17.4 (join role check). No observed value changed. |
| 1.15 | 2026-09-30 | **Revision history — v1.15, privacy rule (doc-only).** The live S32 IC example (FN-M10-10.1.2, EL-M10-S32-017) may be real personal data and is replaced with the fictitious `000101010000` (serial 0000 is never issued); new DV-M10-30 in §7. No other change. |
| 1.14 | 2026-09-27 | **Revision history — v1.14, M02 v1.19 (G1 approval kept). §6.2.1 and the §13 split now follow the M02 v1.19 T4 pool. The 20 swapped-out rows left the pool: they are re-graded lower-grade pupils at filter schools with no class, session or answer, so `t4PoolSwappedOut` = 0. Three generated pool rows were re-homed to filter schools and kept their T4 memberships, so the pool goes 78 → **75** and the re-homed count 35 → 38. T4 card: **149 = 75 + 38 + 21 + 15**. The 3 moved rows are the last 3 generated rows of the remaining pool in generator order. None is a T4 session holder (H1–H4) or an M16 anchor, and none holds a session. `t4check.js` asserts this, and T4 149 / 11 sessions / "63.9%", class 5/9 "51.3%", class 6/10 "81.7%" and T5 3,911 all hold. `guru-check.js` passes. Coverage still 3,150/3,150. |
| 1.13 | 2026-09-27 | **Revision history — v1.13, M04 v1.13 SQ-7 (G1 approval kept). Four generic designed SPs added: **8287, 8288, 8289** for Pendidikan Muzik T1–T3 and **8547** for Pendidikan Syariah Islamiah T1 (id rule 8000 + 20 × subjectId + levelId). M04 has checked 187 subject–level pairs that hold rows, so the generic-SP count goes from 183 to **187**. Coverage still 3,150/3,150. |
| 1.12 | 2026-09-27 | **Revision history — v1.12, XL batch 3 round 5 R5-01 (G1 approval kept). M08 shows one decimal and drops a trailing ".0", so "64%" needs a session mean of 63.95–64.05 %. The session lists now use the auditor's script-checked lists: H1 (6/10) 0/7, 5/7, 11/13, 33/33 (60 · 49, mean 64.011 % → "64%"), H3 (5/9) 4/5, 4/6, H4 (5/9) 3/15, 0/20; H2 is unchanged. Class 5/9 is "51.3%", 6/10 "81.7%" and the T4 level "63.9%" (63.883). `t4check.js` compares the displayed strings with M08's formatter. Coverage still 3,150/3,150. |
| 1.11 | 2026-09-27 | **Revision history — v1.11, XL batch 3 round 4 R4-01 (G1 approval kept). M08 shows the T4 "Murid Terbaik" row "4 sesi · 60 soalan 64%", which is a mean of session accuracies, so the 4 T4 session holders now have exact session lists, found by script (`r401.js`) and recorded in §6.2.1. The 4-session pupil has 0/1, 1/1, 5/7, 43/51 (49 / 60, session mean 63.9 → 64 %). The 3-session pupil has 10/10, 9/10, 9/10 (93.3 %). The two 2-session pupils have 3/5, 7/7 and 1/14, 0/20. Class 5/9 is 39 / 76 = 51.3 %, class 6/10 is 49 / 60 = 81.7 %, and the T4 level is 11 sessions · 63.9 %. `t4check.js` asserts all of these. Coverage still 3,150/3,150. |
| 1.10 | 2026-09-27 | **Revision history — v1.10, M05 v1.13 feasibility C17 (Delivery Lead decision; G1 approval kept). M08 discovery shows the T4 "Murid Terbaik" rows "3 sesi · 30 soalan" (93.3 %) and "4 sesi · 60 soalan" only on the level page (S3), with **no class**, so which class they sit in is a design choice. The session holders are therefore re-placed to fit M08's observed class cells per answer: the 4-session pupil goes to classes 6/10 (4 sessions · 49 / 60 = 81.7 %), and the 3-session pupil plus the two 2-session pupils go to classes 5/9 (7 sessions · 39 / 76 = 51.3 %). The T4 level stays at 11 sessions · 63.9 %. `t4check.js` now asserts both class cells. Coverage still 3,150/3,150. |
| 1.9 | 2026-09-27 | **Revision history — v1.9, XL batch 3 round 3 (`docs/qa/audit/cross-module-logic-M12-M18.md` R3-01; G1 approval kept). New **session-neutrality rule** for the §6.2.1 swaps (table A.1): (1) 8765's 14 T4 joiners come from its 15 non-answering pupils, and 2 of its 6 answering pupils are class members as T5-only members; 8767 and 8772 joiners hold no session. (2) The 20 swapped-out pool pupils hold no session and are generated pool rows, never the M16 anchors 4326–4358 \ 4351 nor the 4 T4 session holders. (3) Each of the 32 T5 leavers carries exactly the sessions of its joiner: 2 carry the sessions of 8765's answering members and 30 hold none. (4) `t4check.js` now asserts M08 T4 = 11 sessions · 63.9 % and T5 = 29,971 · 79.7 % over the M05 v1.12 placement. The M02 pool update list is in §13. Coverage still 3,150/3,150. |
| 1.8 | 2026-09-27 | **Revision history — v1.8, XL batch 3 round 2 (`docs/qa/audit/cross-module-logic-M12-M18.md` R2-05, R2-06; G1 approval kept). **R2-05:** the default seed now makes the swaps. §6.2.1 gives the class memberships of the M18 schools' pupils in the "4 / 5 Bestari / Cemerlang / Dedikasi - BM / SEJ" classes, matching the S29 tables, the S22 in-class counts and M18 C28 (8765: T4-class 14, T5-class 7, both 4). They need 21 T4 swaps in, 1 re-homed school-1 pupil leaving the T4 classes and 32 T5 swaps, so M08 T4 stays 149 (no-school T4 pool 98 → 78) and T5 stays 3,911. `t4check.js` verifies it. **R2-06:** new §6.2.1 enrolment design for M17 "{n} GURU". Every target is met: today 8106 2, 8082 1, 8080 1; week 8106 17, 8082 50, 8078 22, 8080 6, 8090 9; month 8106 18, 8082 61, 8080 8, 8078 37, 8090 23. 8082 uses its 14 owners plus 47 cross-school owners of 8078 / 8090, and 8080 uses 1919 plus 7 of 8106. These are enrolments in existing generated classes, so there are still 750 classes and fixed owners keep their class counts. `guru-check.js` verifies it. M17's month 8284 = 1 is infeasible (its only pupil is also its week pupil, week 0) and is reported to M17. Coverage still 3,150/3,150. |
| 1.7 | 2026-09-27 | **Revision history — v1.7, XL batch 3 round 1 (`docs/qa/audit/cross-module-logic-M12-M18.md`; G1 approval kept). **XL3-12:** (1) every teacher-created question (objective #53, CSV rows #58, Soalan & Rujukan MCQs #33, structured #46) calls M14 `teacherGamification.onQuestionContributed(teacherId, questionId)` (M14 v1.3 BR-M14-23: +10 syiling, `questionsCount` +1, badges; deletes never decrement); S2 badges read DATA-M14-20. (2) FR-M10-26 no longer BLOCKED: `/guru/command-center/{school,classroom,student}/…` mount the M17 v1.4 S4–S7 drill-down component with the BR-M17-30 teacher scope. (3) Classes recorded in §6.2.1, each in the id slot of a generated class (750 unchanged): 366–372 (8080, owner 1919; 370 carries M08 HeadCount config 617) and 813 "5 CYBER" (8082, owner 4402) per M17 §6.7 C; 516 "4 Simulasi" (8880, members 3201–3215 at 8880 per M02 v1.13) and 517 "5 Simulasi" (8880, 15 T5 register pupils already counted, so M08 T5 "Murid" 3,911 unchanged, XL3-35); 8082 class owners and the 8880 teachers' classes. (4) T4 class joins: register pupils of 8765, 8772, 8767 and 7780 join T4 classes 4–10 only by a one-for-one swap with a T4-pool member, so the M08 T4 card stays 149 (verified by script). (5) M17 missions: designed missions 7103/7104 of teacher 4402 give M05 the links for 8 completed mission sessions in September, 3 of them this week, 0 today; question sets 7401/7402 are dated 28/08/2026, so none is created in September. **XL3-32:** the M10 Kirkpatrick T1 keeps its observed "/10" scale, and DV-M17-08 does not apply to the teacher twin. Coverage still 3,150/3,150. |
| 1.6 | 2026-09-26 | **Revision history — v1.6, XL round 3 Minors (G1 approval kept). **XL2-45:** the §6.2.1 id arithmetic and the designed-anchor row now count the five designed classes 2001, 2002 and 2011–2013 — `tingkatan-5` 645 = 640 in 1–1,156 + 5 designed; 743 classrooms in range + 2 school classes + 5 designed = 750. **XL2-47:** Related rows cite M02 v1.11, M05 v1.8, M08 v1.7, M11 v1.7 (also §13). **XL2-48:** M10 repository adds `remedialTests.get(id)` for the M05 Q4 read-only preview (return shape and access rule in §6.8: the test's own teacher or an admin, else `null`). Coverage still 3,150/3,150. |
| 1.5 | 2026-09-26 | **Revision history — v1.5, XL batch 2 round 2 (`docs/qa/audit/cross-module-logic-M08-M11.md` R2.3/R2.4; G1 approval kept). **XL2-36:** M10 no longer stores questions — the "Soalan & Rujukan" MCQs of S16 are written through M04 `questions.createFromTeacher` (the observed live flow: the mission form says "Pilih soalan yang anda sudah cipta di Soalan Saya"), DATA-M10-06 becomes ReferenceSet (reference material + M04 `questionIds`), seed rows 7501/7502 removed (created at runtime in the E2E); `missions.questionIdsFor` returns only eligible M04 ids. **XL2-41:** new **BR-M10-35** mission pool rule — an empty chapter pool of `latih_tubi` falls back to the subject pool; any other empty pool returns `[]` and M05 BR-32 / FR-M05-143 answer 422 `NOT_ENOUGH_QUESTIONS` ("Soalan tidak mencukupi.", back to `/misi-harian`); S12 shows no pool warning (live shows none). **XL2-40:** "Lihat Quiz" opens the M05 Q4 read-only preview for the test's teacher and admins (M05 v1.7). **XL2-38:** structured fields `curriculumChapterId` / `curriculumTopicId`. **XL2-42:** Mission `recipientIds`. **XL2-44:** enrolments keyed by (`classroomKind`, `classroomId`, `studentId`). **XL2-45:** fixture teacher 5302's classes 2011–2013 (DMO201–203) recorded. **XL2-47:** references refreshed to M01 v1.9, M02 v1.10, M04 v1.9, M05 v1.7, M08 v1.6, M11 v1.6; delivered contracts no longer called "requested"; the §7 total counts the 9 referenced endpoints. Coverage still 3,150/3,150. |
| 1.4 | 2026-09-26 | **Revision history — v1.4, M04 v1.7 alignment** (M04 requests to M10; G1 approval kept). DSKP seed (SRS §6.9): the SPs M08 and M04 read (9001–9004 Kimia T5; 221, 206, 222, 214, 179, 194 BM; 418 Sejarah; 6191 Sains T5 for anchor 564159) plus one designed SP for each of the 183 subject–level pairs that hold M04 questions, so every generated DSKP-tagged question points to an SP of the M10 store; availability counts as M04 Q-SP-AVAILABLE. Teacher questions are active from creation (`pending_review`, `isActive = true`); the pending contribution 700301 is inserted at runtime by the M04 test hook `questions.createFixture`; M10 id block 700300–700399; M04 contract names `questions.*`, `structured.*`, `reports.*`. "Jenis Tulisan" options confirmed from discovery (4 values incl. `mixed`). Join-code rule accepts the observed stored code "DEMO-4S". M05 v1.6: #76/#77 stay dropped; M10 owns the mission question pool (incl. the chapter case); S34 "Mula" → M05 Q6 `/set-soalan-saya/:id/jawab`, "Lihat Quiz" → M05 Q4 `/remedial/:id`; live sessions `in_progress`; mission status, set attempts and remedial progress read M05 Q-SESS-LINK. M02 v1.9: class 228 is owned by a teacher of monitoring school 8082 and its 93 members are 8082 T5 students. Coverage still 3,150/3,150. |
| 1.3 | 2026-09-26 | **Revision history — v1.3, cross-module logic review batch 2** (`docs/qa/audit/cross-module-logic-M08-M11.md`; Delivery Lead decisions; G1 approval kept). XL2-08: the student side of missions, remedial tests and question sets (`/api/missions/today`, `/api/remedial-tests/mine`, `/remedial/{id}`, session modes `mission`/`remedial`/`question_set` and the session ids) belongs to M05; M10 keeps creation and the teacher views; mission reward 3 × correct as observed. XL2-05: the attendance mirror = 137 students without a school (M02). XL2-06: guru 5 owns exactly classes 2001/2002. XL2-11: the pending contribution is a runtime test fixture, not a default seed (teacher S1 "Soalan 1 / ✅ 1", S21 1 / 1 / 0 / 0 by default). XL2-12/13/19: forms aligned to the M04 and M09 write contracts and field names. XL2-20: DSKP SPs read by M08 seeded. XL2-02: OQ-M10-19 closed. Minors XL2-21, 24, 31, 32 (SRS). Coverage still 3,150/3,150. |
| 1.2 | 2026-09-25 | **Revision history — v1.2, audit round 2 Minors** (G1 approved). No URS requirement changed; version aligned with the SRS v1.2 fixes (R2-01 document control, R2-02 class dataset id range). Coverage still 3,150/3,150. |
| 1.1 | 2026-09-25 | **Revision history — v1.1, audit round 1** (Delivery Lead decisions). AUD-01: teacher data re-based on M08 v1.3 (classes 2001 "5 MARIKH - Kimia" and 2002 "5 MARIKH - Sejarah", both Tingkatan 5, members 3001–3008; no class 2003; 3009–3012 removed); every teacher anchor re-derived from the M08 records (S1, S2, S4, S6, S7, S34). AUD-02: the 137 attendance students are a named selection of the M02 users dataset (request R-M02-01). AUD-03: counts cite M04 §4.1 queries; missing facets and anchors requested (R-M04-01…06); structured `visibility` stored value = `public` only. AUD-04: Classroom/enrolment dataset spec (SRS §6.2.1). AUD-05: DV-M10-02 narrowed to the section toggle. AUD-06: DV-M10-28 = measured screens S1, S2, S7, S21, text only inside `main`. AUD-07: new DV-M10-29 (S20 nested delete form). AUD-08: DV-M10-17 widened to the S2 grid/nav/LIVE clipping. Minors: provisional marks (AC-18.4/18.5, AC-23.3), §9 PROPOSED list, M04 import template, "Tukar Status", profile id 3 INFERRED, 4454 author name fictitious, DV-M10-15 empty value INFERRED. Coverage still 3,150/3,150. |
| 1.0 | 2026-09-25 | First issue under D7 (fidelity), D8 (proven completeness), D9/D10 (deviation rule) and D11/D12 (datasets and store owners). §3 breakdown and §6 coverage matrix generated by script from the inventory JSON: 3150/3150 content elements covered (3051 mapped, 99 excluded with reason), 0 unmapped; 77 M10-relevant shell elements mapped. Deviations DV-M10-01…28 decided (18 approved fixes, 9 replicate-live, 1 already fixed by M01); v1.1 adds DV-M10-29 (19 fixes). |

**Conventions** (same as M01–M09)
- Quoted UI copy is the exact live text. Where CSS upper-cases text, the fact is stated ("upper case by CSS" / "rendered …"). English or mixed words shown on live ("Command Center", "Rule-based", "Peer Tutor Matching", "Streak Champions", "Most Improved", "Public", "Approved", "Draft/Pending", "Assign misi harian…", "Showing … results") are live copy and are kept.
- **OBSERVED** = seen on the live site (walk-through, inventory state, screenshot). **SOURCE-DERIVED** = taken from page markup or inline script captured read-only, for a state that was never rendered (e.g. the remedial table, the Evaluate and Badges panels, the live-class session card). **INFERRED** = the most likely live behaviour, not observed; no new UX is built on it beyond what the observed controls imply. **UNVERIFIED** = live behaviour or copy exists but could not be observed (an L-state); nothing is asserted beyond the evidence. **PROPOSED** / **PROPOSED COPY** = a value, layout or text written for the rebuild where live has no observable original; listed in §9 for the Delivery Lead to report at G1.
- **L-M10-n** = a not-observable state (§9, from discovery §9). **D-n** = a live defect of discovery §7.2. **DV-M10-nn** = fidelity deviation (§7); anything not listed there must match live. **SEC-M10-nn** = risk of the live behaviour, replicated with dummy data (SRS §11.1).
- **Personal data (students are minors).** Discovery masked every person and school (`<person>`, `<school>`, `<name>`, avatars). Only structure, counts and question/article text are quoted. Seeds use clearly fictitious names.
- **Admin mirror vs designed data** (SRS §6.11). Values the admin account saw on live are seeded exactly (D11: counts come from the shared datasets built to the observed values; observed rows are anchors). The admin owns no class, student, set, mission, broadcast, timetable entry or remedial test, so those lists show their empty state for the admin, as live. The teacher `guru@demo.test` (canonical id 5, school SMK DEMO 900001) owns the designed classes 2001 "5 MARIKH - Kimia" and 2002 "5 MARIKH - Sejarah" (Tingkatan 5, members Murid Demo 01–08 = 3001–3008; designed in M08 v1.3 and adopted unchanged) and fictitious M10 records in M10 id ranges, so every populated state can be shown; where a populated layout was never observed it is PROPOSED and its E2E is provisional.

---

## 1. Overview

M10 is the **teacher portal for classes and teaching** plus the two student pages that consume it. Discovery found 35 screens (the TRACKER listed 17 routes). Every screen except S2 (Command Center, standalone dark layout) and the error pages renders in the **user-portal shell** (SHU), for the admin as well; the admin-panel sidebar has no `/guru/*` item.

What the module does:
1. **Dashboard and Command Center:** `/guru` (guide, checklist, counts, today's priorities, peer tutor, quick actions) and the live dark dashboard `/guru/command-center` (10-second poll, drill-down modals, Smart Remedial, SPM prediction, class summary, risk evaluation, badges) with `/guru/remedial-progress`.
2. **Classes and students:** class list with a quick-QR join modal, class creation (school, name, subject, level Tahun 1–6 for SK schools / Ting. 1–5 otherwise, 6-character join code), "Pelajar Saya" with the "Pelajar Sekolah" tab, and the student join page `/kelas-saya`.
3. **Monitoring and communication:** digital attendance derived from answers (≥5 answers per day = Hadir), a weekly study timetable, class broadcasts (≤500 characters, Biasa/Penting) and a live-class monitor (30-second poll; no video).
4. **Assignments:** daily missions (Latih Tubi SPM / Tracking A / Soalan & Rujukan; 5–50 questions; 3 syiling per correct answer; no class selector), question sets (class, TOV/AR group, time and attempt limits, Draf/Jadual/Terbit) with the student page `/set-soalan-saya`, and "Soalan & Rujukan" (private MCQs with an embedded reference link for chosen classes).
5. **Authoring and contributions:** structured questions (SPM Paper 2 format with DSKP mapping, KBAT 1–6, templates, sub-questions and KPM rubric constructs), contributed MCQ/other questions for admin review (with CSV import, contributor badges and question-paper submission), Audio KBAT listening sets, a subject databank with problem reports, and teacher articles.
6. **Profile:** the teacher's professional profile and school.

**Routes covered** (TRACKER §4 M10 plus crawl finds):

| # | Route | Tab title (exact live) | Header title (as specified) |
|---|---|---|---|
| S1 | `/guru` | "Dashboard Guru - PRESTASIPLUS" | "Dashboard Guru" / "Selamat datang, {nama} 👩‍🏫" |
| S2 | `/guru/command-center` | "Command Center — Guru: {nama}" | — (standalone dark layout) |
| S3 | `/guru/remedial-progress` | "Remedial Progress Dashboard" | "Remedial Progress Dashboard" (DV-M10-01) |
| S4 | `/guru/kelas` | "Kelas Saya - Portal Guru" | "Portal Guru" |
| S5 | `/guru/kelas/cipta` | "Cipta Kelas - Portal Guru" | "Cipta Kelas Baru" |
| S6 | `/guru/pelajar` | "Pelajar Saya - PRESTASIPLUS" | "Pelajar" |
| S7 | `/guru/kehadiran-digital` (`?date=`) | "Kehadiran Digital — Portal Guru" | "Kehadiran Digital" |
| S8 | `/guru/jadual-belajar` | "Jadual Belajar Harian — Portal Guru" | "Jadual Belajar Harian" |
| S9 | `/guru/broadcast` | "Broadcast Kelas — Portal Guru" | "Broadcast Kelas" |
| S10 | `/guru/live-kelas` | "Bilik Darjah Langsung - Portal Guru" | "Bilik Darjah Langsung" |
| S11 | `/guru/misi-harian` | "Misi Harian — Portal Guru" | "Misi Harian" |
| S12 | `/guru/misi-harian/cipta` | "Cipta Misi Harian — Portal Guru" | "Cipta Misi Harian" |
| S13 | `/guru/set-soalan` | "Set Soalan - PRESTASIPLUS" | "Set Soalan Guru" |
| S14 | `/guru/set-soalan/cipta` | "Cipta Set Soalan - PRESTASIPLUS" | "Cipta Set Soalan" |
| S15 | `/guru/soalan-guru` | "Soalan & Rujukan — Portal Guru" | "Soalan & Rujukan" |
| S16 | `/guru/soalan-guru/cipta` | "Soalan & Rujukan — Portal Guru" | "Soalan & Rujukan" |
| S17 | `/guru/soalan-berstruktur` | "Soalan Berstruktur - PRESTASIPLUS" | "Soalan Berstruktur" (DV-M10-01) |
| S18 | `/guru/soalan-berstruktur/cipta` | "Cipta Soalan Berstruktur - PRESTASIPLUS" | "Cipta Soalan Berstruktur" (DV-M10-01) |
| S19 | `/guru/soalan-berstruktur/{id}` | "Lihat Soalan Berstruktur - PRESTASIPLUS" | "Preview Soalan" (DV-M10-01) |
| S20 | `/guru/soalan-berstruktur/{id}/edit` | "Edit Soalan Berstruktur - PRESTASIPLUS" | "Edit Soalan Berstruktur" (DV-M10-01) |
| S21 | `/guru/soalan` | "Sumbang Soalan - PRESTASIPLUS" | "Sumbang Soalan" |
| S22 | `/guru/soalan/cipta` | "Tambah Soalan - PRESTASIPLUS" | "Tambah Soalan Baru" |
| S23 | `/guru/soalan/{id}` | "Detail Soalan — Sumbang Soalan" | "Detail Soalan" / "Selamat datang kembali" |
| S24 | `/guru/soalan/{id}/edit` | "Edit Soalan — Sumbang Soalan" | "Edit Soalan" / "Selamat datang kembali" |
| S25 | `/guru/audio-kbat` | "Set Audio KBAT" | "Set Audio KBAT" (DV-M10-01) |
| S26 | `/guru/audio-kbat/create` | "Cipta Set Audio KBAT" | "Cipta Set Audio KBAT" (DV-M10-01) |
| S27 | `/guru/databank` | "Databank Soalan SPM — PRESTASIPLUS" | "Databank Soalan" / "{jumlah} soalan · {n} subjek" |
| S28 | `/guru/databank/{CODE}` | "{Subjek} — Databank Soalan" | "{Subjek}" / "{n} soalan" |
| S29 | `/guru/artikel` | "Sumbang Artikel" | "Sumbang Artikel" (DV-M10-01) |
| S30 | `/guru/artikel/cipta` | "Tulis Artikel Baru" | "Tulis Artikel Baru" (DV-M10-01) |
| S31 | `/guru/artikel/{id}/edit` | "Edit Artikel" | "Edit Artikel" (DV-M10-01) |
| S32 | `/guru/profil/edit` | "Edit Profil Guru - PRESTASIPLUS" | "Profil Guru" / "Kemaskini maklumat profesional anda" |
| S33 | `/kelas-saya` (student) | "Kelas Saya" | "Kelas Saya" / "Sertai kelas guru anda 🏫" |
| S34 | `/set-soalan-saya` (student) | "Set Soalan Guru - PRESTASIPLUS" | "Set Soalan Guru" / "Set soalan yang disediakan oleh guru anda" |
| S35 | `/settings`, `/guru/{id}` (404); `/guru/set-soalan/{id}` (405 → 404, DV-M10-26) | "404 - Halaman Tidak Dijumpai \| PRESTASIPLUS" | — (standalone) |

**Other access outcomes** (discovery §1.2; states of the screens above): `/guru/pelajar/cipta` → back to `/guru/pelajar` with no message (DV-M10-07, replicated); `/guru/soalan/template` → 302 back on live (DV-M10-08, fixed: CSV download); `/guru/soalan/galeri-rajah` → HTML redirect on live (DV-M10-09); `/guru/audio-kbat/template` and `/template-word` → XLSX / DOCX downloads; `/guru/kelas/{id}` and `/qr-data` of a class not owned → 404; `/guru/command-center/remedial/scan` → 500 on live (DV-M10-03); the 405 routes of FN-M10-1.2.3.

**Cross-module ownership.** M10 owns the Classroom, ClassroomStudent (enrolment), TeacherProfile, Mission, QuestionSet, ReferenceSet (Soalan & Rujukan reference material; its MCQs are M04 questions), TimetableEntry, Broadcast, RemedialTest and DSKP (Bidang/SK/SP) entities and every `/guru/*` endpoint. By D12 it reads and writes the **question store** (objective and structured questions, reports, paper submissions) only through M04, the **answer log and sessions** through M05, **chapters and topics** through M03, **users and schools** through M01/M02, and **articles and Audio KBAT sets** through M09. `/prestasi/kelas*` and `/analitik/kelas` (linked from S1) belong to M08; `/guru/monitoring`, `/guru/laporan*`, `/guru/analisis-item`, `/guru/perbandingan-kelas` to M11; `/guru/kirkpatrick*` to M12; `/guru/gamifikasi` to M14. The student pages `/misi-harian`, `/remedial/saya` and `/latihan-berstruktur` are M05 screens that consume M10 data.

---

## 2. Actors

| Role | Involvement in M10 | Verified |
|---|---|---|
| Guru (teacher) | Every `/guru/*` screen for own classes, students, missions, sets, questions, articles and profile. | INFERRED (no teacher account; the admin renders the same pages) |
| Admin | Opens every M10 screen in the user shell. Owns no class, student, set, mission, broadcast, timetable entry or remedial test (teacher lists empty); owns 16,817 contributed questions, 36 articles; sees every structured question on S17; sees 137 students on S7 (source unknown). | OBSERVED (admin account) |
| Pelajar (student) | `/kelas-saya` (join by code) and `/set-soalan-saya`; receives missions (M05 `/misi-harian`), remedial tests (M05 `/remedial/saya`), broadcasts and the timetable ("nampak bila login", display UNVERIFIED). | Pages OBSERVED (admin rendering); student data INFERRED |
| Admin sekolah (school admin) | Named in the checklist copy ("Admin sekolah akan sediakan kelas anda", "Admin akan import pelajar ke kelas anda"): prepares classes and imports students (M02). | INFERRED |
| Admin (reviewer, other modules) | Reviews contributed questions and papers (M04), articles and Audio KBAT sets (M09), problem reports (M04). | OBSERVED in M04/M09 |
| Guest | Redirected to `/login` (M01 guard). | INFERRED |

Correction for URS.md §6: the user-portal sidebar of the admin shows the teacher items "Dashboard Guru", "Kelas Guru", "Sumbang Soalan", "Databank Soalan"; the full teacher group lives in the mobile drawer. A real teacher's sidebar is not observable (OQ-M10-08).

---

## 3. Functional breakdown (Epic → Feature → Function)

Generated by script from the element inventory (`docs/discovery/inventory/M10/`) and the Function catalogue. "EL" lists inventory element IDs (prefix `EL-M10-`). Functions with EL "—" are behaviours (access, server rules, SOURCE-DERIVED states, unobservable populated states) with no element of their own.


### EP-M10-1 — Navigation, shell entries and access


**FT-M10-1.1 — M10 entries and page titles in the user-portal shell (SHU)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-1.1.1 | Desktop sidebar (≥1024px), as rendered for the admin: `fa-chart-pie` "Dashboard Guru" → `/guru`, `fa-chalkboard-teacher` "Kelas Guru" → `/guru/kelas`, `fa-pen-fancy` "Sumbang Soalan" → `/guru/soalan`, `fa-database` "Databank Soalan" → `/guru/databank`; student items `fa-book-reader` "Kelas Saya" → `/kelas-saya` and `fa-clipboard-list` "Set Soalan Guru" → `/set-soalan-saya`. A real teacher's sidebar is UNVERIFIED (OQ-M10-08) | SHU-077–078, 100–103 | Admin (OBSERVED); Guru, Pelajar INFERRED | OBSERVED |
| FN-M10-1.1.2 | Mobile/tablet drawer (<1024px) teacher groups (group labels upper case as rendered): "HARIAN" (`fa-chart-pie` "Dashboard Guru" → `/guru`, `fa-rocket` "Misi Harian" → `/guru/misi-harian`, [M05 "Soalan by Chapter"], `fa-chalkboard-teacher` "Kelas Saya" → `/guru/kelas`, `fa-user-graduate` "Pelajar Saya" → `/guru/pelajar`, `fa-clipboard-check` "Kehadiran Digital" → `/guru/kehadiran-digital`); "PENGAJARAN" (`fa-calendar-alt` "Jadual Belajar" → `/guru/jadual-belajar`, `fa-bullhorn` "Broadcast" → `/guru/broadcast`, `fa-broadcast-tower` "Kelas Live" → `/guru/live-kelas`); "BANK SOALAN" (`fa-pen-fancy` "Sumbang Soalan", `fa-book-open` "Soalan & Rujukan" → `/guru/soalan-guru`, `fa-list-ol` "Soalan Berstruktur" → `/guru/soalan-berstruktur`, `fa-database` "Databank Soalan", `fa-clipboard-list` "Set Soalan" → `/guru/set-soalan`); "LAIN-LAIN" (`fa-newspaper` "Sumbang Artikel" → `/guru/artikel`, `fa-book-reader` "Kelas Saya" + badge "BARU" → `/kelas-saya`, `fa-clipboard-list` "Set Soalan Guru" → `/set-soalan-saya`; its M14/M09 items belong to those modules); `fa-satellite-dish` "Command Center LIVE" → `/guru/command-center` | SHU-218, 246–249, 251–258, 279–287, 289, 291–293 | Admin (OBSERVED); Guru INFERRED | OBSERVED |
| FN-M10-1.1.3 | Shell header title / subtitle per M10 screen (as live unless DV-M10-01): S1 "Dashboard Guru" / "Selamat datang, {nama} 👩‍🏫"; S4 "Portal Guru" / "Urus kelas dan tugasan anda 🏫"; S5 "Cipta Kelas Baru" / "Isi butiran kelas anda"; S6 "Pelajar" / "Urus pelajar dalam kelas anda"; S7 "Kehadiran Digital" / "Pelajar jawab 5+ soalan = Hadir. Auto-track, zero effort."; S8 "Jadual Belajar Harian" / "Set fokus subjek harian — pelajar nampak bila login"; S9 "Broadcast Kelas" / "Hantar mesej ringkas kepada pelajar — mereka nampak bila login"; S10 "Bilik Darjah Langsung" / "Pantau semua aktiviti pelajar — Latih Tubi SPM, Tracking A, Misi Harian"; S11 "Misi Harian" / "Cipta dan pantau misi latih tubi SPM untuk pelajar"; S12 "Cipta Misi Harian" / "Assign misi latih tubi SPM atau Tracking A"; S13 and S34 "Set Soalan Guru" / S13 "Cipta dan urus set soalan khas untuk kelas anda", S34 "Set soalan yang disediakan oleh guru anda"; S14 "Cipta Set Soalan" / "Sediakan set soalan khas untuk kelas anda"; S15 "Soalan & Rujukan" / "Cipta soalan peribadi dengan bahan rujukan — khas untuk kelas anda sahaja"; S16 "Soalan & Rujukan" / "Cipta soalan MCQ, lampir link rujukan, assign sebagai misi"; S21 "Sumbang Soalan" / "Sumbangan anda kepada bank soalan kebangsaan PrestasiPlus"; S22 "Tambah Soalan Baru" / "Sumbangkan soalan untuk pelajar Malaysia"; S23 "Detail Soalan" and S24 "Edit Soalan" / "Selamat datang kembali"; S27 "Databank Soalan" / "{jumlah} soalan · {n} subjek"; S28 "{Subjek}" / "{n} soalan"; S32 "Profil Guru" / "Kemaskini maklumat profesional anda" (and the masked name text shown in the header on S32); S33 "Kelas Saya" / "Sertai kelas guru anda 🏫". The subtitle is one line with ellipsis (cut at 1280 on S7–S10, S15, S16, S21 as live). S3, S17–S20, S25, S26, S29–S31 show the page title (DV-M10-01; live "Dashboard") with "Selamat datang kembali" | SHU-136–137, 373–415 | All | OBSERVED + DV-M10-01 |

**FT-M10-1.2 — Access outcomes and error pages**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-1.2.1 | Every M10 route requires a session; a guest is sent to `/login` (M01 guard). Teacher pages are opened by the admin on live; other roles' access (student on `/guru/*`, teacher on the student pages) is UNVERIFIED (OQ-M10-08) | — | Guest | INFERRED |
| FN-M10-1.2.2 | Global 404 page (M01 FR-M01-50): "404", "🔍", h1 "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice` (M01 DV-02; live `/latih-tubi`), "PRESTASIPLUS". Shown for `/settings`, `/guru/{id}` (Profil Awam), `/guru/kelas/{id}/edit`, `/guru/kelas/{id}/pelajar`, `/guru/soalan-guru/{id}/edit`, `/set-soalan-saya/{id}`, `/guru/kehadiran-digital/export`, `/guru/set-soalan/{id}/edit`, `/guru/misi-harian/{id}/edit`, `/guru/audio-kbat/{id}` of an unknown or not-owned record, and `/kelas-saya/{id}` of a class the student has not joined | S35-001–007 | All | OBSERVED + M01 DV-02 |
| FN-M10-1.2.3 | GET on a route that exists only for other methods (`/guru/set-soalan/{id}`, `/guru/misi-harian/{id}`, `/guru/soalan-guru/{id}`, `/guru/broadcast/{id}`, `/guru/jadual-belajar/{id}`, `/guru/pelajar/{id}`, `/guru/artikel/{id}`, `/guru/soalan/import`, `/guru/soalan/hantar-kertas`, `/guru/soalan/ai-generate`, `/guru/profil`, `/guru/broadcast/cipta`): live shows the English Symfony page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." / "Something is broken. …". Rebuild: the global 404 page (DV-M10-26) | S35-008–010 | All | OBSERVED + DV-M10-26 |
| FN-M10-1.2.4 | Owner scoping of class data: `/guru/kelas/{id}` and `/guru/kelas/{id}/qr-data` for a class the viewer does not own → 404 (live JSON "No query results for model [App\\Models\\Classroom] {id}"); `/guru/live-kelas/cipta` → 404 (no create page: live class is monitoring only) | — | Guru, Admin | OBSERVED |

### EP-M10-2 — Teacher dashboard and Command Center


**FT-M10-2.1 — Dashboard Guru (S1 `/guru`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-2.1.1 | Guide card (shown unless `localStorage.hideGuruGuide = "true"`): h3 "Mula Di Sini — 3 Langkah Mudah", "Ikut 3 langkah ini untuk mula menggunakan PrestasiPlus. Ambil masa 5 minit sahaja.", steps with badges 1/2/3: "Buka Kelas" / "Klik "Kelas Saya" di sidebar. Cipta kelas baru atau lihat kelas sedia ada." / "Kelas Saya →" → `/guru/kelas`; "Lihat Pelajar" / "Semak senarai pelajar anda. Lihat siapa yang aktif dan siapa yang belum mula." / "Pelajar Saya →" → `/guru/pelajar`; "Pantau Prestasi" / "Buka Monitoring untuk lihat penglibatan pelajar dan topik lemah mereka." / "Monitoring →" → `/guru/monitoring` (M11); tip `fa-lightbulb` "Tip:" "Hover atas mana-mana menu di sidebar untuk lihat penerangan ringkas."; close `fa-times` hides it and stores the key; the pill `fa-question-circle` "Tunjuk panduan Mula Di Sini" reopens it and removes the key (per browser) | S1-004–021 | Guru, Admin | OBSERVED |
| FN-M10-2.1.2 | Card "Checklist Guru": "{k}/3 langkah selesai", "{p}%", rows "Kelas dah ada" / "Admin sekolah akan sediakan kelas anda" (Lihat → `/guru/kelas`), "Pelajar dalam kelas" / "Admin akan import pelajar ke kelas anda" (Lihat → `/guru/pelajar`), "Misi harian pertama" / "Cipta misi latih tubi untuk pelajar anda" (Lihat → `/guru/misi-harian/cipta`). A step counts as done when the viewer owns ≥1 class / has ≥1 student in own classes / has created ≥1 mission; p = round(k ÷ 3 × 100) (INFERRED; admin 0/3, 0%) | S1-022–034 | Guru, Admin | OBSERVED / INFERRED (rules) |
| FN-M10-2.1.3 | 4 stat cards (4-up at 1280, 2-up at 375): "Kelas Aktif" {n} / "{m} jumlah kelas"; "Pelajar" {n} / "Merentasi semua kelas"; "Soalan" {n} / "✅ {a} diluluskan"; "Tugasan" {n} / "Jumlah tugasan dibuat". Admin: 0 / "0 jumlah kelas", 0, 20719 / "✅ 19361 diluluskan", 0 (values without thousands separators, as live; the admin "Soalan" values are observed snapshot constants with an UNVERIFIED definition; for other teachers the INFERRED definition of DV-M10-12 applies) | S1-035–046 | Guru, Admin | OBSERVED / INFERRED (definitions) |
| FN-M10-2.1.4 | Panel "Tindakan Hari Ini": h2 "Fokus guru yang paling penting hari ini", "Panel ini memprioritikan pelajar, topik, dan tindakan yang paling wajar disemak dahulu.", counters "Pelajar" / "Topik" / "Tindakan"; columns "Pelajar Perlu Dibantu" + chip "Top 3" (empty "Tiada pelajar berkeutamaan tinggi dikesan buat masa ini."), "Topik Kritikal" + "Analitik Kelas →" → `/analitik/kelas` (M08) (empty "Tiada topik kritikal menonjol dikesan daripada data semasa."), "Tindakan Disyorkan" + chip "Rule-based" with the action link `fa-chalkboard` "Bina aktiviti pertama untuk pelajar" + badge "Permulaan" + "Data tindakan akan muncul selepas pelajar mula membuat latihan." + "Buka Kelas →" → `/guru/kelas`; columns stack below 1024px. Populated rows are UNVERIFIED (L-M10-01) | S1-047–065 | Guru, Admin | OBSERVED; populated UNVERIFIED |
| FN-M10-2.1.5 | Card "Peer Tutor Matching" (label upper case by CSS, rendered "PEER TUTOR MATCHING"): h2 "Cadangan rakan pembimbing pelajar", "Cadangan peer tutor akan muncul apabila guru mempunyai pelajar aktif dan data prestasi yang mencukupi.", box "Belum cukup signal yang yakin untuk cadangan peer tutor. Modul ini akan jadi lebih tepat apabila data pelajar dan subjek bertambah." Pairs UNVERIFIED (L-M10-01) | S1-066–069 | Guru, Admin | OBSERVED; populated UNVERIFIED |
| FN-M10-2.1.6 | Card "Tindakan Pantas": tiles `fa-plus` "Cipta Kelas Baru" / "Tambah kelas pembelajaran" → `/guru/kelas/cipta`; `fa-pen-fancy` "Sumbang Soalan" / "Tambah soalan untuk pelajar" → `/guru/soalan/cipta`; `fa-user-graduate` "Lihat Pelajar" / "Pantau prestasi pelajar" → `/guru/pelajar`; `fa-id-card` "Edit Profil Guru" / "Kemaskini maklumat profesional" → `/guru/profil/edit` | S1-070–075 | Guru, Admin | OBSERVED |
| FN-M10-2.1.7 | Card "Kelas Saya" with "Semua →" → `/guru/kelas`; empty "Belum ada kelas. Cipta sekarang!"; populated layout UNVERIFIED (L-M10-01; PROPOSED: one line per own class "{nama} · {n} pelajar") | S1-076–079 | Guru, Admin | OBSERVED; populated PROPOSED |
| FN-M10-2.1.8 | Card "Penghantaran Terkini": empty "Belum ada penghantaran tugasan." / "Buat tugasan di kelas untuk lihat penghantaran di sini."; "Tugasan" and submissions come from the unobserved class detail (OQ-M10-11): the prototype has no assignment entity, so the card always shows the empty state and "Tugasan" is 0 (UNVERIFIED) | S1-080–083 | Guru, Admin | OBSERVED; populated UNVERIFIED |

**FT-M10-2.2 — Command Center (S2 `/guru/command-center`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-2.2.1 | Standalone dark full-screen layout (no user shell); tab title "Command Center — Guru: {nama}"; top bar: "← Dashboard" → `/guru`, h1 "Command Center" (rendered "COMMAND CENTER"), links "🔬 Remedial", "📊 Rekod" → `/guru/remedial-progress`, "⚠ Evaluate", "🔮 Ramalan SPM", "👩‍🏫 Kelas", "🏆 Badges", "LIVE" badge, clock "HH:MM:SS" (Asia/Kuala_Lumpur, ticks every second) and "MYT". **Live at every width:** the KPI grid and the panel grid keep 4 columns (the only media query is `max-width:1400px`); at 768 and 375 the tiles are squeezed and the right-hand panels, the five links after "🔬 Remedial" and the LIVE badge are clipped off-screen by `body{overflow-x:hidden}` (audit `s2-375-nav-clipped.png`). Rebuild (DV-M10-17): grid 4 columns ≥1024px, 2 columns 640–1023px, 1 column <640px; the top-bar links sit in a horizontally scrollable row below 1024px; the LIVE badge and the clock stay visible | S2-001–011, 100–102 | Guru, Admin | OBSERVED + DV-M10-17 |
| FN-M10-2.2.2 | Data refresh: `GET live-data` on load and every 10 s; values re-render in place (counts animate from the previous value; a value that stays 0 keeps the initial "--", as live) | — | Guru, Admin | OBSERVED / SOURCE-DERIVED |
| FN-M10-2.2.3 | 4 KPI tiles, each clickable with a "🔍" hint: "Pelajar Berdaftar" {n} / "{a} aktif menjawab" (drill students); "Soalan Dijawab" {n} / "sepanjang masa" (drill today); "Ketepatan Purata" "{x}%" / "keseluruhan sekolah" (drill subjects); "GPS Sekolah" {g} / "purata GPS" (drill gps). Admin: "--", "0 aktif menjawab", "--", "0%", "4.69" | S2-012–015 | Guru, Admin | OBSERVED |
| FN-M10-2.2.4 | Panels: "📚 Kelas Saya" (rows "{kelas}" · "{tahap}" · "{n} plj \| {a} aktif \| {x}%", tooltip "Klik: lihat pelajar dalam kelas"; empty "Tiada data"); "🔬 Kirkpatrick" T1 "{★☆} {v}/10", T2 "{x}% ketepatan", T3 "{n} aktif 30h", T4 "GPS {g}" (each opens drill kirk t1–t4); "💚 Mood Pelajar" 😊 Gembira / 😐 OK / 😢 Sedih / 😩 Tekanan counts (each opens drill mood); "🤖 ALESA AI" insight ""{r}% pelajar terlibat aktif. Ketepatan purata {x}%. GPS sekolah: {g}."" (r = (champion + konsisten + berkembang) ÷ engagement total × 100, 1 decimal; 0 when no students) | S2-016–032 | Guru, Admin | OBSERVED / SOURCE-DERIVED |
| FN-M10-2.2.5 | Panels: "📈 Aktiviti Hari Ini" "{n} soalan" (drill today), bar, "Minggu ini:" {w}, "Sama dengan minggu lepas" / "▲ +{p}% vs minggu lepas" (emerald) / "▼ {p}% vs minggu lepas" (rose); "⚡ Live Feed" (time, student, subject, ✓/✗ …; empty "Tiada aktiviti terkini"); "🏆 Leaderboard Minggu Ini" (🥇🥈🥉 then numbers, name, "{n} jwb", accuracy coloured ≥70 emerald / ≥50 amber / else rose; optional "Lencana Terbaru" block; empty "Tiada data minggu ini"); "📊 Engagement Pelajar" "Jumlah: {n} pelajar" and rows Champion / Konsisten / Berkembang / Minimum / Disengaged with bars and counts (tooltip "Klik: senarai pelajar") | S2-033–065 | Guru, Admin | OBSERVED / SOURCE-DERIVED |
| FN-M10-2.2.6 | Footer "Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat" | S2-066 | Guru, Admin | OBSERVED |
| FN-M10-2.2.7 | Drill modal `#drillModal`: title "Loading..." then "Memuatkan...", body "Memuatkan data..."; `GET drill?type=&filter=` → table by type (gps: Subjek · GPS · Gred · Pelajar · Sumber, Sumber labels Anggaran OTR / Head Count / Manual / Import; subjects: Subjek · Jawapan · Betul · Ketepatan · Pelajar; today: Masa · Pelajar · Subjek · Soalan · Betul · Ketepatan; mood: Pelajar · Tarikh · Sebab; kirk t1: Pelajar · Purata · Kepuasan · Relevan · Kegunaan · Tarikh; kirk t2–t4 "vs" cards "Bulan Ini" / "Bulan Lepas" with Ketepatan Kini / Ketepatan Lepas / Perubahan, Jawapan Kini / Jawapan Lepas, Aktif Kini (30h) / Aktif Lepas (30h), Pelajar Baru; students: Pelajar … Status "Aktif" / "Login") or "Tiada data"; accuracy ≥70 emerald / <50 rose / else amber; GPS ≤2 emerald / ≤3 amber / else rose; Gred from GPS ≤1.5 A+, ≤2.0 A, ≤2.5 A-, ≤3.0 B+, ≤3.5 B, ≤4.0 C+, ≤4.5 C, ≤5.0 D, else E; close "×" or backdrop. Title = the label of the clicked tile or panel (DV-M10-04; live shows the raw key "students", "gps", "kirk", "mood") | S2-067–087 | Guru, Admin | OBSERVED + SOURCE-DERIVED + DV-M10-04 |
| FN-M10-2.2.8 | "👩‍🏫 Kelas" → modal "Kelas Saya — Ringkasan Prestasi" ("Menganalisis prestasi guru..." while loading; reuses live-data): cards "Jumlah Pelajar", "Aktif", "Ketepatan" ({x}%), table # · Kelas · Tingkatan · Pelajar · Aktif · Ketepatan (admin: 0 / 0 / 0%, no rows); class rows link to `/guru/command-center/classroom/{id}` (page not observed, L-M10-02) | S2-088–092 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-2.2.9 | "🔮 Ramalan SPM" → modal "Ramalan SPM — Predictive Analytics" ("Menganalisis data prestasi semua pelajar..."): cards "Pelajar Dianalisis", "Ramalan GPS Purata", "Berisiko", "Gred Terbanyak"; grade chips A+ A A- B+ B C+ C D E G ("{g} ({n})" when n > 0); empty "Tiada data mencukupi untuk ramalan"; table # · Pelajar · Accuracy · Trend · Konsistensi · Ramalan · GPS · Risiko (risk chip kritikal/tinggi/sederhana/rendah upper case; row opens the student page, L-M10-02) | S2-093–096 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-2.2.10 | "🔬 Remedial" → modal "Smart Remedial — Scan Pelajar Lemah", "Mengimbas topik lemah pelajar...", `GET remedial/scan`; live returns HTTP 500 and shows "Ralat: Unexpected token '<', "<!DOCTYPE "... is not valid JSON". Rebuild: the scan works (DV-M10-03): "Tiada pelajar dengan topik lemah (<50% accuracy). Tahniah!" or "{n} pelajar dikesan lemah dalam topik tertentu (accuracy <50%)" + table Pelajar · Topik Lemah ("{topik} ({x}%)", …) · Accuracy Terendah ("{x}%", rose) · Tindakan; a real request failure still shows "Ralat: {message}" | S2-097–099 | Guru, Admin | OBSERVED + SOURCE-DERIVED + DV-M10-03 |
| FN-M10-2.2.11 | Remedial actions (SOURCE-DERIVED): per weak subject a button "Jana {Subjek}" → "Menjana..." (disabled) → `POST remedial/generate {student_id, subject}` → link "{Subjek} ({n})" → `/remedial/{id}` (new tab; M05 Q4 — a read-only preview for the teacher of the test and admins, the session of the student in mode `remedial`); error text from the response or "Gagal" (amber) or "Ralat"; a student with an open remedial test shows "Lihat Quiz ({n} soalan)" (or "Selesai ({x}%)") + "Batal & Jana Semula" → confirm "Batal set soalan remedial untuk {nama}? Anda boleh jana semula selepas ini." → "Membatal..." → `POST remedial/cancel {quiz_id}` → "Dibatalkan — boleh jana semula" / "Gagal — cuba lagi" / "Ralat — cuba lagi" | — | Guru, Admin | SOURCE-DERIVED (UNVERIFIED server) |
| FN-M10-2.2.12 | "⚠ Evaluate" → modal "Auto Evaluate — Penilaian Risiko Pelajar", "Menilai semua pelajar...", `GET evaluate`: cards Jumlah Pelajar · Berisiko · Kritikal · Tinggi · Sederhana; "Semua pelajar dalam keadaan baik! Tiada risiko dikesan." or table Risiko (KRITIKAL / TINGGI / SEDERHANA / RENDAH) · Pelajar · Amaran · Cadangan Tindakan (rows open the student page). Not opened on live (may write); SOURCE-DERIVED, server rules UNVERIFIED (L-M10-03) | — | Guru, Admin | SOURCE-DERIVED / UNVERIFIED |
| FN-M10-2.2.13 | "🏆 Badges" → modal "Achievement System — Scan & Award Badges", "Mengimbas pencapaian semua pelajar...", `GET achievements`: cards Pelajar · Lencana Baru Dianugerah · Jenis Lencana Aktif; "Senarai Lencana" chips (icon, name, "{n} pelajar", rarity Common ≥20 / Uncommon ≥10 / Rare ≥5 / Epic ≥1 / Legendary 0); "Top Pengumpul Lencana" table # · Pelajar · Jumlah Lencana; "Baru Dianugerahkan Hari Ini!" list; a chip opens "Lencana: {nama}" ("Memuatkan senarai pelajar...", "{n} pelajar memiliki lencana ini", table # · Pelajar · Ketepatan · Tarikh Anugerah, empty "Belum ada pelajar yang memiliki lencana ini."). Not opened on live; SOURCE-DERIVED, award rules UNVERIFIED (L-M10-03; M14) | — | Guru, Admin | SOURCE-DERIVED / UNVERIFIED |
| FN-M10-2.2.14 | Student and class links from the Command Center (drill rows, feed, leaderboard, remedial names) open `/guru/command-center/student/{id}` or `/guru/command-center/classroom/{id}` in a new tab; `/guru/command-center/school/{sid}/teacher/{uid}` exists in the script. These pages were never opened on live (L-M10-02); since v1.7 they mount the M17 S4–S7 drill-down component (M17 v1.4 owns the templates) within the teacher scope of BR-M17-30 | — | Guru, Admin | SOURCE-DERIVED / UNVERIFIED |

**FT-M10-2.3 — Remedial Progress Dashboard (S3 `/guru/remedial-progress`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-2.3.1 | 📊 h1 "Remedial Progress Dashboard", "Jejak peningkatan pelajar melalui ujian pemulihan"; tab "Remedial Progress Dashboard"; reached from S2 "📊 Rekod" | S3-004–006 | Guru, Admin | OBSERVED |
| FN-M10-2.3.2 | 4 stat cards (labels upper case as rendered): "JUMLAH SET" {n}, "SELESAI" {n}, "PELAJAR" {n}, "PURATA PENINGKATAN" "+{x}%" (admin 0, 0, 0, "+0%"); computed from the viewer's remedial tests (Selesai = completed; Pelajar = distinct students; peningkatan = mean(after − before accuracy) of completed tests, INFERRED) | S3-007–018 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-2.3.3 | Card "👥 Senarai Pelajar & Progress": empty 📋 "Belum ada ujian remedial dijana. Buka Command Center → klik Remedial untuk mula."; populated rows UNVERIFIED (L-M10-04; PROPOSED: one row per test "{nama}" · "{Subjek}" · status · "{before}% → {after}%") | S3-019–022 | Guru, Admin | OBSERVED; populated PROPOSED |

### EP-M10-3 — Classes, students and joining


**FT-M10-3.1 — Kelas Saya list (S4 `/guru/kelas`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-3.1.1 | h2 "Kelas Saya", "{n} kelas aktif", button link `fa-plus` "Cipta Kelas Baru" (gradient indigo-500 → purple-500, white) → `/guru/kelas/cipta` | S4-004–006 | Guru, Admin | OBSERVED |
| FN-M10-3.1.2 | Empty card: 🏫 h3 "Belum Ada Kelas", "Cipta kelas pertama anda untuk memulakan pengajaran", `fa-plus` "Cipta Kelas" → `/guru/kelas/cipta` | S4-007–011 | Guru, Admin | OBSERVED |
| FN-M10-3.1.3 | Populated class cards of the viewer's own classes: layout UNVERIFIED (L-M10-05). PROPOSED card (labels from the create form): class name, subject, level ("Tahun n" / "Ting. n"), "{n} pelajar", join code, and a QR button (`fa-qrcode`) that calls `openQrQuick(id)` (SOURCE-DERIVED: the quick-QR modal is opened from a class card). No link to a class detail page (`/guru/kelas/{id}` not observed, OQ-M10-11) | — | Guru | UNVERIFIED / PROPOSED |
| FN-M10-3.1.4 | Quick-QR modal `#quickQrModal`: opening shows a spinner and "-" placeholders, fetches `GET /guru/kelas/{id}/qr-data` → `{name, school, join_url}`, then shows h3 class name, school, a 192×192 QR code of `join_url` (dark `#1e293b`, light `#ffffff`, level M), "Pautan sertai:" read-only URL input, copy button `fa-copy` (alert "Disalin!"), `fa-print` "Cetak" (`window.print()`), "Tutup"; backdrop click closes | S4-012–018 | Guru | OBSERVED (forced open) + SOURCE-DERIVED |

**FT-M10-3.2 — Cipta Kelas Baru (S5 `/guru/kelas/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-3.2.1 | `fa-arrow-left` "Kembali" → `/guru/kelas`; form `POST /guru/kelas` | S5-004–006 | Guru, Admin | OBSERVED |
| FN-M10-3.2.2 | Card "Pilih Sekolah": search "Taip nama sekolah untuk cari..." (300 ms debounce, ≥2 characters) → `GET /api/schools/search?q=&limit=15` (M02); spinner while loading; results one button per school "{nama}" + "{daerah}, {negeri}"; `fa-search-minus` "Tiada sekolah dijumpai" when none; choosing shows a card (name + "{daerah}, {negeri}") with clear `fa-times-circle` and sets hidden `school_id`; fewer than 2 characters clears the results | S5-007–016, 051–068 | Guru, Admin | OBSERVED |
| FN-M10-3.2.3 | Card "Maklumat Kelas": "Nama Kumpulan *" text (`required`, placeholder "cth: 5 Bestari") with help "Nama kumpulan latih tubi anda."; the value is posted as hidden `name` | S5-017–022 | Guru, Admin | OBSERVED |
| FN-M10-3.2.4 | "Subjek *" select `subject_id` (`required`): "-- Pilih Subjek --" + the 31 M03 subjects in id order (Bahasa Melayu … Sains Sukan) | S5-023–024 | Guru, Admin | OBSERVED |
| FN-M10-3.2.5 | "Tahap Pendidikan *" radio tiles `education_level`: "Tahun 1"…"Tahun 6" (`tahun-1`…`tahun-6`) and "Ting. 1"…"Ting. 5" (`tingkatan-1`…`tingkatan-5`); no school → all 11; school type `SK` → Tahun tiles only; any other type → Ting. tiles only; the radios carry no `required` (as live, DV-M10-22); the chip "Auto dari kelas sekolah" never shows (its school-class picker is not rendered) | S5-025–047 | Guru, Admin | OBSERVED + DV-M10-22 |
| FN-M10-3.2.6 | "Penerangan (pilihan)" textarea `description`, placeholder "Penerangan ringkas tentang kelas ini..." | S5-048–049 | Guru, Admin | OBSERVED |
| FN-M10-3.2.7 | Submit `fa-plus-circle` "Cipta Kelas" (gradient indigo-500 → purple-500). Native validation blocks an empty name or subject. On success the class is created for the viewer with a unique 6-character join code and the viewer returns to `/guru/kelas` (INFERRED; success copy UNVERIFIED). Server validation messages are UNVERIFIED | S5-050 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-3.2.8 | The script's school-class picker (`onSchoolClassChange`, `GET /api/school-classes/{id}/students`, auto level via grade map T1–T5/D1–D6) is not rendered on live and is not built (behaviour identical) | — | Guru, Admin | SOURCE-DERIVED |

**FT-M10-3.3 — Pelajar Saya (S6 `/guru/pelajar`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-3.3.1 | Header counter "{n}" / "Pelajar dalam kelas saya"; link `fa-user-plus` "Cipta Pelajar" (label "Cipta" below 640px) → `/guru/pelajar/cipta`, which on live returns to `/guru/pelajar` with no message (replicated, DV-M10-07; teacher outcome UNVERIFIED) | S6-004–006 | Guru, Admin | OBSERVED + DV-M10-07 |
| FN-M10-3.3.2 | Tabs (default "Pelajar Saya"): `fa-school` "Pelajar Sekolah" and `fa-user-check` "Pelajar Saya" with count badge {n} | S6-007–009 | Guru, Admin | OBSERVED |
| FN-M10-3.3.3 | Tab "Pelajar Saya": empty "Belum ada pelajar dalam kelas anda" / "Buat kelas dan tambah pelajar dari senarai sekolah." / `fa-plus` "Cipta Kelas" → `/guru/kelas/cipta`; populated list of the students in the viewer's classes UNVERIFIED (L-M10-05; PROPOSED rows: name, class, level) | S6-017–020 | Guru, Admin | OBSERVED; populated PROPOSED |
| FN-M10-3.3.4 | Tab "Pelajar Sekolah": bar "Tambah pelajar ke:" + select (placeholder "-- Pilih kelas --" + the viewer's own classes); when the viewer has no school: "Sekolah belum ditetapkan" / "Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah." / `fa-user-cog` "Tetapan Profil" → `/guru/profil/edit`. The school student list, its search (`searchQuery`) and add/remove (`PUT`/`DELETE /guru/pelajar/{id}`) are UNVERIFIED (L-M10-05; PROPOSED minimal list: name, level, add-to-class button; INFERRED semantics) | S6-010–016 | Guru, Admin | OBSERVED; populated PROPOSED / INFERRED |

**FT-M10-3.4 — Student Kelas Saya (S33 `/kelas-saya`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-3.4.1 | Card "Masukkan Kod Kelas": form `POST /kelas-saya/join`, text `class_code` (`required`, `maxlength=6`, placeholder "cth: MAT5B2"), `fa-sign-in-alt` "Sertai" (indigo-500) | S33-004–009 | Pelajar, Admin | OBSERVED |
| FN-M10-3.4.2 | Empty: 📚 h3 "Belum Sertai Mana-Mana Kelas", "Minta kod kelas daripada guru anda dan masukkan di atas" | S33-010–013 | Pelajar, Admin | OBSERVED |
| FN-M10-3.4.3 | Join result and joined classes: a valid code enrols the student (ClassroomStudent) and the page lists the class (INFERRED); an unknown code or an already-joined class is refused (copy UNVERIFIED); the joined-class card and `/kelas-saya/{id}` are UNVERIFIED (L-M10-06; PROPOSED card: class name, subject, teacher) | — | Pelajar | INFERRED / UNVERIFIED |

### EP-M10-4 — Monitoring and communication


**FT-M10-4.1 — Kehadiran Digital (S7 `/guru/kehadiran-digital`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-4.1.1 | GET filter: "Tarikh" date `date` (max = today, default today) and `fa-search` "Semak" (indigo-600); `?date=YYYY-MM-DD` reloads for that day | S7-004–007 | Guru, Admin | OBSERVED |
| FN-M10-4.1.2 | 4 stat cards: "Jumlah Pelajar" {n} (blue label), "Hadir" {n} (green), "Tidak Hadir" {n} (red), "% Kehadiran" "{x}%" (orange label, red value); % = round(hadir ÷ jumlah × 100) (INFERRED; admin 137 / 0 / 137 / 0%) | S7-008–015 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-4.1.3 | Card "Trend Kehadiran 7 Hari": seven columns, oldest first, the 7 days ending today (the selected date does not move it, INFERRED), each labelled with its day (Isn, Sel, Rab, Kha, Jum, Sab, Ahd), bar height = the day's % (observed 2px minimum, red `#dc2626` at 0%) and "{x}%" | S7-016–031 | Guru, Admin | OBSERVED |
| FN-M10-4.1.4 | Table "Senarai Pelajar — {dd/mm/yyyy}": # · Nama · Tingkatan · Soalan · Status · Masa Aktif; status badge "Tidak Hadir" (red-100/red-700) or "Hadir" (green, INFERRED label/colour); "Masa Aktif" "-" when absent; rows grouped by level then name A→Z. Live mixes the labels "T4" (12 rows), "T5" (15), "Tingkatan 4" (2), "Tingkatan 5" (108) and groups them in that order; the rebuild shows the M03 level name "Tingkatan n" for every row, one group per level (admin: Tingkatan 4 × 14, Tingkatan 5 × 123; DV-M10-13); scrolls inside its card below 640px | S7-032–037, 039–040 | Guru, Admin | OBSERVED + DV-M10-13 |
| FN-M10-4.1.5 | Footnote `fa-info-circle` "Pelajar dianggap "Hadir" apabila menjawab sekurang-kurangnya 5 soalan pada hari tersebut. Data dikemas kini secara automatik." | S7-038 | Guru, Admin | OBSERVED |
| FN-M10-4.1.6 | Attendance is derived, never marked: Hadir ⇔ ≥5 answers on that date in the M05 answer log; "Soalan" = answers that day; "Masa Aktif" = time of the last answer that day (INFERRED). The student set = students of the viewer's classes; the admin's 137 students have an unknown source (admin mirror, OQ-M10-03) | — | Guru, Admin | OBSERVED (rule) / INFERRED |

**FT-M10-4.2 — Jadual Belajar Harian (S8 `/guru/jadual-belajar`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-4.2.1 | Card "Tambah Jadual", form `POST /guru/jadual-belajar`: "Hari" `day_of_week` (`required`; 1 Isnin … 7 Ahad, default Isnin), "Subjek" `subject_id` (`required`; the 31 subjects A→Z, no placeholder, default "Bahasa Arab"), "Topik Fokus (opsional)" `focus_topic` (placeholder "cth: Bab 3 Algebra"), `fa-plus` "Tambah" (indigo-600) | S8-004–014 | Guru, Admin | OBSERVED |
| FN-M10-4.2.2 | Seven day cards Isnin … Ahad (2–3 per row, 1 at 375), each "Tiada jadual ditetapkan" when empty; today's card has the badge "HARI INI" | S8-015–036 | Guru, Admin | OBSERVED |
| FN-M10-4.2.3 | Entries: each entry appears in its day card (PROPOSED layout: subject name + focus topic) with a delete control (`DELETE /guru/jadual-belajar/{id}`, live route). A confirm before deleting is PROPOSED behaviour ("Padam jadual ini?", PROPOSED COPY; the live control was never seen). Student display "pelajar nampak bila login" is UNVERIFIED (L-M10-07) | — | Guru | UNVERIFIED / PROPOSED |

**FT-M10-4.3 — Broadcast Kelas (S9 `/guru/broadcast`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-4.3.1 | Card "Hantar Mesej Baru", form `POST /guru/broadcast`: textarea `message` (`required`, `maxlength=500`, placeholder "Tulis mesej ringkas untuk pelajar..."), radios `priority` "Biasa" (`normal`, checked) / "Penting" (`important`), `fa-paper-plane` "Hantar" (indigo-600). No class or recipient selector: a broadcast reaches all the teacher's students (INFERRED, OQ-M10-01) | S9-004–013 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-4.3.2 | History: empty "Tiada mesej dihantar lagi."; populated history rows UNVERIFIED (L-M10-07; PROPOSED row: message, priority label, date) with delete (`DELETE /guru/broadcast/{id}`, live route); the confirm "Padam mesej ini?" is PROPOSED behaviour and PROPOSED COPY. Student display UNVERIFIED | S9-014 | Guru, Admin | OBSERVED; populated PROPOSED |

**FT-M10-4.4 — Bilik Darjah Langsung (S10 `/guru/live-kelas`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-4.4.1 | Monitoring only (no video room, no join link). Status card: "{n}" "pelajar sedang aktif", "Dikemas kini: {HH:MM:SS} · Auto-muat semula setiap 30 saat", countdown "{s}s", `fa-refresh` "Muat Semula". Every 30 s and on "Muat Semula": `GET /guru/live-kelas` (JSON) → `{sessions, recent, total, refreshed_at, topWeekly, streakChampions, mostImproved}`; only the sessions and the time are refreshed; failure → "Gagal mendapatkan data. Periksa sambungan internet anda." | S10-004–011 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-4.4.2 | Empty state "Tiada pelajar sedang aktif menjawab soalan sekarang" / "Halaman ini akan dikemas kini secara automatik apabila pelajar mula menjawab soalan." | S10-012–017 | Guru, Admin | OBSERVED |
| FN-M10-4.4.3 | Session card (SOURCE-DERIVED template, never rendered): badge "LANGSUNG", labels "Kuiz", "Masa", "Markah", activity label (e.g. "Latih Tubi"); one card per session of the viewer's students active in the last minutes (window INFERRED); values UNVERIFIED | S10-018–022 | Guru | SOURCE-DERIVED / UNVERIFIED |
| FN-M10-4.4.4 | Side cards (server-rendered on page load): "Pejuang Minggu Ini" (empty "Tiada data minggu ini"), "Streak Champions" (empty "Tiada streak aktif"), "Most Improved" ("Perlu data 2 minggu untuk perbandingan"); populated rows UNVERIFIED | S10-023–031 | Guru, Admin | OBSERVED; populated UNVERIFIED |

### EP-M10-5 — Daily missions, question sets and teacher questions


**FT-M10-5.1 — Misi Harian list (S11 `/guru/misi-harian`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.1.1 | "Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A."; `fa-plus` "Misi Baru" (indigo-600) → `/guru/misi-harian/cipta` | S11-004–005 | Guru, Admin | OBSERVED |
| FN-M10-5.1.2 | Empty "Belum ada misi" / "Cipta misi harian pertama untuk pelajar anda." / `fa-plus` "Cipta Misi" → cipta | S11-006–009 | Guru, Admin | OBSERVED |
| FN-M10-5.1.3 | Mission list, progress and delete UNVERIFIED (L-M10-08). PROPOSED row: "Nama Misi", type label, "Tarikh Misi", subject, "{n} soalan", completion "{selesai}/{pelajar}" (completion = students whose mission session is submitted, INFERRED) | — | Guru | UNVERIFIED / PROPOSED |

**FT-M10-5.2 — Cipta Misi Harian (S12 `/guru/misi-harian/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.2.1 | Form `POST /guru/misi-harian` (plain HTML): "Nama Misi" `title` (`required`, pre-filled "Misi Harian {dd/mm/yyyy}" of today); "Jenis Misi" `mission_type` (`required`; `latih_tubi` "Latih Tubi SPM" default, `tracking_a` "Tracking A", `youtube` "Soalan & Rujukan (YouTube/Anyflip/Rujukan)"); hidden `mission_source` = `bank_soalan`; "Tarikh Misi" date `mission_date` (`required`, default today). "Tracking A" changes nothing visible (as live) | S12-004–013 | Guru, Admin | OBSERVED |
| FN-M10-5.2.2 | "Subjek" `subject_id` (`required`; "Pilih Subjek" + 20 subjects A→Z: Bahasa Arab … Tasawwur Islam); "Bab (Opsional)" `chapter_id`: "Semua Bab" + every chapter of every subject (935 on live); choosing a subject hides options of other subjects (BM → 85 visible) and resets to "Semua Bab" | S12-014–017 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-5.2.3 | "Bilangan Soalan" number `question_count` (`required`, `min=5`, `max=50`, default 10) with help "5 hingga 50 soalan" | S12-018–020 | Guru, Admin | OBSERVED |
| FN-M10-5.2.4 | "Ganjaran Syiling" read-only box `fa-coins` "3 syiling" "per soalan betul" / "Auto-kira berdasarkan bilangan soalan betul. Tiada tetapan manual." | S12-021–024 | Guru, Admin | OBSERVED |
| FN-M10-5.2.5 | Section `#youtubeSection` (hidden by default): `fa-youtube` "Soalan Ciptaan Guru", "Pilih soalan yang anda sudah cipta di **Soalan Saya**." (link → `/guru/soalan-guru`), alert `fa-info-circle` "Soalan ciptaan anda (berdasarkan video/rujukan) akan digunakan sebagai misi. Pelajar akan tonton video dulu kemudian jawab soalan." Live: `toggleSource()` is referenced by `onchange` but not defined, so choosing the third type throws and the section never shows (D-02). Rebuild (DV-M10-02, minimal): choosing `youtube` shows the section, any other type hides it. Nothing else changes: the hidden `mission_source` keeps its only observed value `bank_soalan`, and `mission_type = youtube` carries the choice. Which questions a `youtube` mission uses is INFERRED (BR-M10-17, OQ-M10-10) | S12-025–028 | Guru, Admin | OBSERVED + DV-M10-02 |
| FN-M10-5.2.6 | `fa-link` "Bahan Rujukan (Opsional)" / "Pelajar akan lihat bahan ini sebelum mula menjawab soalan.": `resource_title` ("Tajuk (cth: Video Bab 3)"), `resource_url` type url ("URL (YouTube/PDF/website)"), `resource_note` textarea ("Nota ringkas untuk pelajar (opsional)"); fields fit 375px (DV-M10-18) | S12-029–033 | Guru, Admin | OBSERVED + DV-M10-18 |
| FN-M10-5.2.7 | `fa-arrow-left` "Kembali" → `/guru/misi-harian`; `fa-rocket` "Lancarkan Misi" (indigo-600). Native validation (required, 5–50, url). On success the mission is stored for all the teacher's students (no selector, INFERRED, OQ-M10-01) and the teacher returns to `/guru/misi-harian` (INFERRED; flash UNVERIFIED); students see it on `/misi-harian` (M05 owns the student list `/api/missions/today` and the session, mode `mission`) on its date; reward 3 syiling per correct answer (observed; applied by M05 per mode) | S12-034–035 | Guru, Admin | OBSERVED / INFERRED |

**FT-M10-5.3 — Set Soalan list (S13 `/guru/set-soalan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.3.1 | Card h2 "Set Soalan Anda", "{n} set dicipta", `fa-plus` "Cipta Set Baharu" → `/guru/set-soalan/cipta` | S13-004–007 | Guru, Admin | OBSERVED |
| FN-M10-5.3.2 | Empty h3 "Belum Ada Set Soalan", "Cipta set soalan pertama anda untuk kelas.", `fa-plus` "Cipta Set Pertama" | S13-008–011 | Guru, Admin | OBSERVED |
| FN-M10-5.3.3 | Set list UNVERIFIED (L-M10-09; `GET /guru/set-soalan/{id}` is 405, `/edit` 404 for ids the admin does not own). PROPOSED row: title, class, status label ("Draf" / "Jadual" / "Terbit"), "{n} soalan" | — | Guru | UNVERIFIED / PROPOSED |

**FT-M10-5.4 — Cipta Set Soalan (S14 `/guru/set-soalan/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.4.1 | `fa-arrow-left` "Kembali ke Senarai" → `/guru/set-soalan`; form `POST /guru/set-soalan` (Alpine `{ status: 'draft' }`) | S14-004–006 | Guru, Admin | OBSERVED |
| FN-M10-5.4.2 | Card 1 "Maklumat Asas": "Kelas *" `classroom_id` (`required`; "-- Pilih Kelas --" + the viewer's own classes; the admin has none, so the form cannot be submitted), "Tajuk Set *" `title` (`required`, "cth: Latih Tubi BM Mac 2026 - Set 1"), "Penerangan" `description` ("Arahan atau penerangan untuk pelajar..."), "Kumpulan Set (untuk TOV/AR tracking)" `group_tag` ("cth: BM Mac 2026") + `fa-info-circle` "Set pertama dalam kumpulan = TOV (baseline). Set seterusnya = AR (progress)." | S14-007–018 | Guru, Admin | OBSERVED |
| FN-M10-5.4.3 | Card 2 "Tetapan": "Had Masa (minit)" `time_limit_minutes` (1–360, placeholder "Tiada had") + "Kosongkan = tiada had masa"; "Had Percubaan" `max_attempts` (0–99) + "0 = tiada had (boleh ulang)" | S14-019–027 | Guru, Admin | OBSERVED |
| FN-M10-5.4.4 | Card 3 "Status Penerbitan": radio cards `status` "Draf" / "Simpan dahulu, terbit kemudian" (default), "Jadual" / "Terbit pada masa tertentu", "Terbit" / "Pelajar boleh mula sekarang"; "Jadual" reveals "Tarikh & Masa Terbit" `scheduled_at` (datetime-local) | S14-028–038 | Guru, Admin | OBSERVED |
| FN-M10-5.4.5 | Submit `fa-plus` "Cipta Set & Tambah Soalan" (gradient indigo-600 → purple-600). The next step (adding questions to the set) was not observable (L-M10-09): PROPOSED minimal builder = pick approved active questions of the M04 store by subject/level and save the list (UNVERIFIED layout, OQ-M10-02) | S14-039 | Guru, Admin | OBSERVED; next step PROPOSED |

**FT-M10-5.5 — Soalan & Rujukan list (S15 `/guru/soalan-guru`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.5.1 | Info bar `fa-info-circle`: "**Soalan & Rujukan** adalah soalan peribadi yang anda cipta khas untuk pelajar kelas anda. Lampirkan rujukan dari YouTube, Anyflip, PDF atau mana-mana sumber sebagai bahan pembelajaran tambahan. Soalan ini hanya boleh diakses oleh pelajar anda melalui Misi Harian." | S15-004–005 | Guru, Admin | OBSERVED |
| FN-M10-5.5.2 | Card "Cara Soalan & Rujukan": 1 "Cari Bahan Rujukan" / "Video YouTube, Anyflip, PDF, atau apa-apa link rujukan."; 2 "Tulis Soalan MCQ" / "A/B/C/D + gambarajah (optional). Tandakan jawapan betul."; 3 "Assign Misi Harian" / step text naming the real S12 option: "Pilih "Soalan & Rujukan (YouTube/Anyflip/Rujukan)" di Misi Harian." (DV-M10-23; live "Pilih "YouTube / Soalan Guru" di Misi Harian.") | S15-006–016 | Guru, Admin | OBSERVED + DV-M10-23 |
| FN-M10-5.5.3 | "{n} soalan dicipta"; `fa-plus` "Soalan & Rujukan Baru" → `/guru/soalan-guru/cipta` | S15-017–018 | Guru, Admin | OBSERVED |
| FN-M10-5.5.4 | Empty "Belum ada soalan" / "Cipta soalan MCQ peribadi dengan bahan rujukan untuk pelajar anda." / "Soalan & Rujukan Baru" | S15-019–022 | Guru, Admin | OBSERVED |
| FN-M10-5.5.5 | List rows UNVERIFIED (L-M10-10; PROPOSED row: question text, reference title/link, subject) with delete (`DELETE /guru/soalan-guru/{id}`, live route; no edit route); the confirm "Padam soalan ini?" is PROPOSED behaviour here (no S15 source for it) | — | Guru | UNVERIFIED / PROPOSED |

**FT-M10-5.6 — Cipta Soalan & Rujukan (S16 `/guru/soalan-guru/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.6.1 | Guide card "Panduan: Cara Cipta Soalan & Rujukan", open on every load (not remembered); toggle `fa-eye-slash` "Sembunyikan Panduan" / "Baca Panduan Dulu!"; content: "Apa itu Soalan & Rujukan?" (text with bold "cipta soalan MCQ sendiri", "Misi Harian"), `fa-list-ol` "Langkah Demi Langkah" steps 1–5 (exact texts, discovery §2.16 / Appendix B), embed table "AUTO EMBED" YouTube / Anyflip / Canva and "KLIK BUKA" PDF / Google Drive / Lain-lain with the example URLs in code chips, `fa-lightbulb` "Tips Menulis Soalan Yang Baik" (5 ✓ tips, 1 ⚠ tip). Code chips wrap at 375px (DV-M10-19) | S16-004–064 | Guru, Admin | OBSERVED + DV-M10-19 |
| FN-M10-5.6.2 | Form `POST /guru/soalan-guru`; card "1 Rujukan & Subjek": "Link Rujukan (YouTube, Anyflip, PDF, dll.)" url `youtube_url` (placeholder "https://youtube.com/... atau https://anyflip.com/... atau mana-mana link"); on input: YouTube (`youtu.be/…`, `youtube.com/watch?v=`, `/embed/`) → `fa-check-circle` "YouTube — auto embed. Pelajar boleh tonton terus."; Anyflip → "Anyflip — auto embed. Pelajar boleh selak buku terus."; Canva `/design/…` → "Canva — auto embed. Pelajar boleh lihat slide terus."; any other value longer than 5 characters → `fa-external-link-alt` "Link rujukan:" + the URL as a link + `fa-info-circle` "Link ini akan dipaparkan kepada pelajar sebagai butang klik. Pelajar perlu klik untuk buka dalam tab baru." | S16-065–077, 162, 189 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-5.6.3 | "Tajuk Rujukan" `youtube_title` ("cth: Video Bab 3 Algebra atau Nota Anyflip Sejarah") | S16-078–079 | Guru, Admin | OBSERVED |
| FN-M10-5.6.4 | "Subjek *" `subject_id` (`required`; "Pilih Subjek" + 31 A→Z); "Tahap Pendidikan" `education_level_id` ("-- Pilih Tahap --", Darjah 1–6, Tingkatan 1–5) | S16-080–083 | Guru, Admin | OBSERVED |
| FN-M10-5.6.5 | "Bab" `chapter_id` and "Topik" `topic_id` loaded by FN-M10-11.1 once subject and level are set (e.g. BM + Tingkatan 5 → "Bab 99: Kemahiran Bahasa Tingkatan 5"); help `fa-info-circle` "Pilih Subjek + Tahap dahulu untuk muat Bab & Topik secara automatik."; inline add buttons (`fa-plus`, titles "Tambah Bab Baru" / "Tambah Topik Baru") disabled until subject + level (Bab) or a chapter (Topik); panels "Bab Baru" (No. 1–99 + "Nama bab...") and "Topik Baru" ("Nama topik..."), "Batal" hides the panel **keeping the typed values**, "Simpan" per FN-M10-11.1 | S16-084–099 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-5.6.6 | "Gambarajah (optional)" file `image` (`accept=image/*`), "JPG, PNG — max 5MB. Gambarajah akan dipaparkan bersama soalan." | S16-100–102 | Guru, Admin | OBSERVED |
| FN-M10-5.6.7 | Card "Kelas Sasaran": "Pilih kelas yang akan menggunakan soalan ini (boleh pilih lebih dari satu)"; one checkbox per own class (`classrooms[]`, PROPOSED rendering: class name; SOURCE-DERIVED `selectedClassrooms`); no class: "Tiada kelas ditemui." + link "Cipta kelas dahulu" → `/guru/kelas/cipta` | S16-103–107 | Guru, Admin | OBSERVED; list PROPOSED |
| FN-M10-5.6.8 | Card "2 Soalan MCQ" + `fa-plus` "Tambah Soalan": per question "Soalan {n}", delete `fa-trash` (only with >1 question), textarea "Tulis soalan di sini..." (`required`), "Pilihan Jawapan" "*" "— Klik bulatan hijau untuk tandakan jawapan betul", rows A–D: radio `questions[i][correct_answer]` (the first radio `required`), letter badge, textarea "Taip pilihan jawapan {A–D} di sini..." (`required`); "Penjelasan Jawapan" "(opsional — membantu pelajar faham kenapa jawapan itu betul)" textarea "Terangkan kenapa jawapan yang dipilih adalah betul. Ini akan dipaparkan selepas pelajar menjawab." | S16-108–158, 163–188 | Guru, Admin | OBSERVED |
| FN-M10-5.6.9 | Footer: `fa-arrow-left` "Kembali" → `/guru/soalan-guru`, counter "{n} soalan", `fa-save` "Simpan Soalan" (indigo-600). On success the questions are stored (private, for the chosen classes) and the teacher returns to `/guru/soalan-guru` (INFERRED; flash UNVERIFIED) | S16-159–161 | Guru, Admin | OBSERVED / INFERRED |

**FT-M10-5.7 — Student Set Soalan Guru (S34 `/set-soalan-saya`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-5.7.1 | Empty card h3 "Tiada Set Soalan", "Guru anda belum sediakan set soalan untuk anda." | S34-004–006 | Pelajar, Admin | OBSERVED |
| FN-M10-5.7.2 | Populated list and set-taking flow UNVERIFIED (L-M10-09): the list shows the published (or due scheduled) sets of the student's classes (INFERRED); PROPOSED row: title, teacher, "{n} soalan", "Mula"; taking a set is an M05 session of mode `question_set` (INFERRED); `/set-soalan-saya/{id}` is 404 on live | — | Pelajar | UNVERIFIED / PROPOSED |

### EP-M10-6 — Structured questions (teacher authoring)


**FT-M10-6.1 — Soalan Berstruktur list (S17 `/guru/soalan-berstruktur`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-6.1.1 | h1 "Soalan Berstruktur", "Cipta & urus soalan berstruktur mengikut piawaian SPM KPM", `fa-plus` "Cipta Soalan" (cyan-600) → cipta | S17-004–006 | Guru, Admin | OBSERVED |
| FN-M10-6.1.2 | Filter card (GET): "Subjek" `subject_id` ("Semua" + 31 A→Z), "Tingkatan" `education_level_id` ("Semua", Darjah 1–6, Tingkatan 1–5), "Status" `status` ("Semua", `draft` "Draf", `published` "Diterbitkan"), `fa-filter` "Tapis" | S17-007–015 | Guru, Admin | OBSERVED |
| FN-M10-6.1.3 | Table # · Soalan · Subjek · KBAT · Sub · Markah · Visibility · Status · actions (headers upper case by CSS): stimulus truncated to ~60 characters + "..." with the chapter name below (slate-400); subject chip; KBAT chip "{LOTS\|MOTS\|HOTS} {n}" (amber); sub count; "{m}m"; visibility `fa-globe` "Public"; status "Terbit" (green) / "Draf"; `fa-eye` → `/{id}`, `fa-edit` → `/{id}/edit`; 20 rows per page; order = last updated first (INFERRED); admin sees every structured question, a teacher their own (INFERRED, OQ-M10-06); table scrolls in its card below 1024px | S17-016–023, 027–032, 036–041, 068–070 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-6.1.4 | Row toggle button `fa-toggle-on`, title "Tukar Status", in a form `POST /guru/soalan-berstruktur/{id}/toggle-status`: switches `published` → `draft` and back, then reloads the list (INFERRED; never clicked). Every live row is published, so only `fa-toggle-on` is observed; the icon of a draft row (`fa-toggle-off`) is INFERRED | S17-024–026, 033–035, 042–044 | Guru, Admin | OBSERVED (control, title) / INFERRED (result, draft icon) |
| FN-M10-6.1.5 | Pager: "Showing {from} to {to} of {total} results", numbered links (1–10 … last two), chevrons, "Next »"; below 640px "« Previous" / "Next »" only; page links keep the non-empty filters (`?subject_id=5&page=2`) | S17-045–064, 071–072 | Guru, Admin | OBSERVED |
| FN-M10-6.1.6 | Empty (e.g. `status=draft` for the admin): "Tiada soalan berstruktur lagi" + `fa-plus` "Cipta soalan pertama" → cipta | S17-065–067 | Guru, Admin | OBSERVED |

**FT-M10-6.2 — Cipta Soalan Berstruktur (S18 `/guru/soalan-berstruktur/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-6.2.1 | Back `fa-arrow-left` → list; h1 "Cipta Soalan Berstruktur", "Format Kertas 2 SPM/PT3 — Piawaian KPM"; form `POST /guru/soalan-berstruktur` (multipart); card h2 "Maklumat Soalan" | S18-004–010 | Guru, Admin | OBSERVED |
| FN-M10-6.2.2 | "Subjek *" (`required`; "-- Pilih Subjek --" + 31 A→Z), "Tingkatan *" (`required`; "-- Pilih --", Darjah 1–6, Tingkatan 1–5), "Aras KBAT *" `kbat_level` (`required`; 1 "1. Mengingat (LOTS)", 2 "2. Memahami (LOTS)", 3 "3. Mengaplikasi (MOTS)", 4 "4. Menganalisis (HOTS)", 5 "5. Menilai (HOTS)", 6 "6. Mencipta (HOTS)"; default 1) | S18-011–016 | Guru, Admin | OBSERVED |
| FN-M10-6.2.3 | "Bab" / "Topik" with inline "Bab Baru" / "Topik Baru" panels (FN-M10-11.1; e.g. Sains + Tingkatan 5 → 9 chapters "Bab 1: Dunia mikroorganisma" …); errors via `alert()`: server `error` or "Gagal menambah bab." / "Gagal menambah topik." | S18-017–031 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-6.2.4 | h3 "Pemetaan DSKP": "Bidang / Tema" (loaded when subject + level are set), "Standard Kandungan (SK)", "Standard Pembelajaran (SP)" `dskp_sp_id`, each with an inline add panel ("Bidang Baru": "Kod" + "Nama bidang..."; "SK Baru": "Kod" + "Penerangan SK..."; "SP Baru": "Kod" + "Penerangan SP...") per FN-M10-11.2; errors "Gagal menambah bidang." / "Gagal menambah SK." / "Gagal menambah SP." or the server `error`; note `fa-info-circle` "Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR." | S18-032–057 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-6.2.5 | "Jenis Tulisan" `script_type` (`rumi` "Rumi (Latin)", `arab` "Arab", `jawi` "Jawi", `mixed` "Campuran"); hidden `text_direction` = `rtl` for Arab/Jawi, else `ltr` | S18-058–060 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-6.2.6 | "Template" `question_template` ("Tiada (manual)", `eksperimen` "Eksperimen Sains"): choosing Eksperimen replaces the sub-questions with the 7 fixed parts (a) "Nyatakan hipotesis eksperimen ini." 1m F; (bi) "Nyatakan pemboleh ubah dimanipulasi." 1m F; (bii) "Nyatakan pemboleh ubah bergerak balas." 1m F; (biii) "Nyatakan pemboleh ubah dimalarkan." 1m F; (c) "Senaraikan radas dan bahan yang diperlukan." 2m F,F; (d) "Terangkan prosedur eksperimen." 3m P,P,P; (e) "Jadualkan keputusan eksperimen." 1m J (total 10m); switching back to "Tiada (manual)" keeps the parts (as live) | S18-061–062 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-6.2.7 | "Visibility *": one radio card "Public" (`visibility=public`, checked). The Alpine values `tingkatan` (select `education_level_filter` "-- Pilih Tingkatan --" + levels) and `class` (select `classroom_id` "-- Pilih Kelas --") have no rendered choice on live and are not offered (DV-M10-11; OQ-M10-07) | S18-063–067 | Guru, Admin | OBSERVED + DV-M10-11 |
| FN-M10-6.2.8 | "Stimulus / Teks Soalan Utama *" textarea `stimulus_text` (`required`, "Masukkan teks soalan utama, situasi, petikan, atau arahan...") with toggle `fa-superscript` "Simbol & Aksara Khas" / "Tutup Simbol" opening the 72-symbol palette (groups Asas, Kuasa, Subskrip, Matematik, Anak Panah, Greek, Umum; discovery A.6); a symbol is inserted at the cursor (FN-M10-11.3); "Gambar Stimulus (pilihan)" file `stimulus_image` (`image/*`) | S18-068–145, 353 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-6.2.9 | Card h2 "Sub-Soalan": "Jumlah markah: {n}m" (Σ sub marks, live update) and `fa-plus` "Tambah Sub" (next label from a b c … j, then numbers) | S18-146–149 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-6.2.10 | Sub-question card: label chip "({label})", label input `subs[i][part_label]` (placeholder "a"), delete `fa-trash` (only with >1 sub), "Soalan *" textarea (`required`, "Masukkan teks sub-soalan...") with its own symbol palette, "Jenis Jawapan" (`text` "Teks" / `numeric` "Numerik"), "Markah *" (`required`, 1–50, default 1); Numerik shows "Jawapan Tepat" `expected_numeric` and "Toleransi (±)" `numeric_tolerance` (min 0); "Jalan Kerja / Skema Jawapan Penuh" `subs[i][model_answer]` ("Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..."); hidden `parent_sub_id` | S18-150–236, 244–334, 347–349, 354–441, 454–544, 557–647, 660–750, 768–858, 881–971, 984–987 | Guru, Admin | OBSERVED |
| FN-M10-6.2.11 | Text subs: "Rubrik Skema (Konstruk KPM)" + `fa-plus` "Tambah" (adds the next unused code of F P C H R L J, else F); rows: konstruk select (F, P, C, H, R, L, J), "Keyword/frasa...", marks 1–10 + "m", remove `fa-times`; the row wraps so the remove button stays visible at 375px (DV-M10-20) | S18-237–243, 335–346, 442–453, 545–556, 648–659, 751–767, 859–880, 972–983 | Guru, Admin | OBSERVED + DV-M10-20 |
| FN-M10-6.2.12 | Footer `fa-info-circle` "Draf boleh diterbitkan kemudian dari senarai soalan."; `fa-save` "Simpan Draf" (slate-200/slate-700) and `fa-paper-plane` "Simpan & Terbitkan" submit with `publish` 0 / 1 (INFERRED); on success → S17 (INFERRED; flash UNVERIFIED); buttons full width below 640px | S18-350–352 | Guru, Admin | OBSERVED / INFERRED |

**FT-M10-6.3 — Preview Soalan (S19 `/guru/soalan-berstruktur/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-6.3.1 | Back arrow → list; h1 "Preview Soalan"; "{Subjek} · {Tingkatan} · {Bab}"; badges "Public", "Terbit"/"Draf"; `fa-edit` "Edit" → `/{id}/edit` | S19-004–009 | Guru, Admin | OBSERVED |
| FN-M10-6.3.2 | Card: "KBAT {n}: {label} ({LOTS\|MOTS\|HOTS})", "{m} markah", "{k} sub-soalan", `fa-flask` "Eksperimen" (shown as live, DV-M10-27); stimulus (pre-line); per sub "({label})", text, "[{m} markah]", answer type "Text"/"Numeric", `fa-check-circle` "Jalan Kerja:" + model answer; footer "Dicipta oleh {nama} · {dd Mon yyyy, HH:mm}" | S19-010–022 | Guru, Admin | OBSERVED + DV-M10-27 |

**FT-M10-6.4 — Edit Soalan Berstruktur (S20 `/guru/soalan-berstruktur/{id}/edit`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-6.4.1 | Back arrow → show page; h1 "Edit Soalan Berstruktur", "{Subjek} · {Tingkatan}"; form `POST …/{id}` + `_method=PUT`; card "Maklumat Soalan" | S20-004–011 | Guru, Admin | OBSERVED |
| FN-M10-6.4.2 | Fields preloaded: "Subjek *" (31, no placeholder), "Tingkatan *" (11, no placeholder), "Aras KBAT *", "Bab" and "Topik" (the saved chapter and topic are selected, DV-M10-05; live leaves them empty), "Jenis Tulisan", "Template" ("Tiada" / "Eksperimen Sains"); no DSKP section (as live) | S20-012–026 | Guru, Admin | OBSERVED + DV-M10-05 |
| FN-M10-6.4.3 | "Visibility *" with the single "Public" card; the tingkatan/class selects are not offered (DV-M10-11) | S20-027–031 | Guru, Admin | OBSERVED + DV-M10-11 |
| FN-M10-6.4.4 | "Stimulus *" (`required`) with the symbol palette toggle ("Simbol & Aksara Khas" / "Tutup Simbol"); "Gambar Stimulus" file | S20-032–109, 169 | Guru, Admin | OBSERVED |
| FN-M10-6.4.5 | Sub-Soalan: "Jumlah markah: {n}m", "Tambah" (new sub); per sub label input, delete (>1), text (`required`), "Jenis", "Markah" (no `required`, as live), "Jawapan", "Toleransi", "Jalan Kerja"; no per-sub symbol palette (as live) | S20-110–125, 133–148, 161–163 | Guru, Admin | OBSERVED |
| FN-M10-6.4.6 | "Rubrik Skema" + "Tambah" (always adds F, as live on edit); rows konstruk / keyword / marks + "m" / remove `fa-times`; rows wrap at 375px (DV-M10-20) | S20-126–132, 149–160 | Guru, Admin | OBSERVED + DV-M10-20 |
| FN-M10-6.4.7 | Footer: `fa-trash` "Padam", `fa-save` "Simpan Draf", `fa-paper-plane` "Simpan & Terbitkan". **Live defect (D-26, corrected after audit):** the delete form (`_method=DELETE`, `onsubmit="return confirm('Padam soalan ini?')"`) is nested inside the edit form; the browser drops the inner form, so "Padam" submits the edit form (`_method` = PUT and DELETE, the server reads DELETE) and deletes **without a confirm**. Rebuild (DV-M10-29): "Padam" is a separate delete form with the source confirm "Padam soalan ini?" (SOURCE-DERIVED); OK → `DELETE` → list; cancel → nothing | S20-164–168 | Guru, Admin | OBSERVED + SOURCE-DERIVED + DV-M10-29 |

### EP-M10-7 — Contributions: questions, papers and Audio KBAT


**FT-M10-7.1 — Sumbang Soalan hub (S21 `/guru/soalan`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-7.1.1 | 4 stat cards: "📝 Jumlah" {n}, "✅ Diluluskan" {n}, "⏳ Menunggu" {n}, "📊 Digunakan" {n} of the viewer's contributed questions (admin 16817 / 16817 / 0 / 0; "Digunakan" = contributed questions answered ≥1 time, INFERRED) | S21-004–015 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-7.1.2 | Info `fa-globe`: "**Sumbang Soalan** adalah platform perkongsian soalan untuk manfaat semua pelajar di seluruh Malaysia. Setiap soalan yang anda sumbangkan akan melalui proses semakan dan seterusnya tersedia dalam bank soalan kebangsaan PrestasiPlus. Sumbangan anda amat dihargai dalam membina masa depan pendidikan negara." | S21-016–017 | Guru, Admin | OBSERVED |
| FN-M10-7.1.3 | Card "Pencapaian Badge Penyumbang": 8 tiers `fa-seedling` Penyumbang Baru (10), `fa-fire` Penyumbang Aktif (100), `fa-award` Penyumbang Dedikasi (500), `fa-trophy` Penyumbang Cemerlang (1,000), `fa-crown` Penyumbang Terbilang (2,500), `fa-gem` Legenda Soalan (5,000), `fa-star` Guru Maestro (10,000), `fa-crown` Legenda Terulung (50,000); reached tiers (Jumlah ≥ threshold) highlighted; "Sasaran seterusnya: **{tier}** — {threshold} soalan" | S21-018–030 | Guru, Admin | OBSERVED / INFERRED (counted value) |
| FN-M10-7.1.4 | Card "Pecahan Subjek": chips "{Subjek} — {n}" for the top 10 subjects of the viewer's contributions plus "Lain — {n}" (the rest), all sorted by count descending ("Lain" takes its count position: admin Matematik 3,287 … Sejarah 795, Lain 763, PSV 510, PSI 363, Geografi 269; DV-M10-14 replicated) | S21-031–043 | Guru, Admin | OBSERVED |
| FN-M10-7.1.5 | Card "Import Soalan (CSV/Excel)" / "Muat naik banyak soalan sekaligus": `fa-download` "Template" → downloads the M04 import template (M04 FR-M04-57 / AC-M04-13.6 header, the same store; DV-M10-08; live 302 back, no file); `fa-upload` "Import CSV" toggles a form `POST /guru/soalan/import`: "Pilih Fail CSV" `csv_file` (`required`, `.csv,.txt`), `fa-cloud-upload-alt` "Import", `fa-info-circle` "Panduan:" "Muat turun template → isi soalan → import kembali", "Format: subjek, tahap, soalan, 4 pilihan, jawapan (A/B/C/D), kesukaran, penerangan", "Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin", "Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport" (Panduan copy kept as live) | S21-044–058 | Guru, Admin | OBSERVED + DV-M10-08 |
| FN-M10-7.1.6 | Card "Sumbang Set Audio KBAT / Ujian Mendengar": "Format khas fixed sequence: 4 audio section, 30 soalan MCQ, skema A-D, dan transkrip untuk semakan admin." / "Sesuai untuk bahan cikgu seperti audio soalan 1-8, 9-16, 17-24 dan 25-30."; `fa-file-excel` "Template XLSX" → `/guru/audio-kbat/template`, `fa-file-word` "Template Word" → `/guru/audio-kbat/template-word` (both download, as live), `fa-plus` "Cipta Set" → S26, `fa-list` "Senarai Set" → S25 | S21-059–065 | Guru, Admin | OBSERVED |
| FN-M10-7.1.7 | Card "AI Auto-Generate Soalan" / "Upload dokumen DOCX/PDF, AI extract soalan automatik": static, no link, button or form (as live, DV-M10-10) | S21-066–067 | Guru, Admin | OBSERVED + DV-M10-10 |
| FN-M10-7.1.8 | h2 "Soalan Saya" + `fa-plus` "Tambah Soalan" → `/guru/soalan/cipta`; 20 cards per page, ids ascending; card (click toggles open): text, chips subject / level ("Darjah 6") / difficulty label (M04 scale: "Sukar" = 4) / `fa-check-circle` "DSKP" when tagged / status "Diluluskan" or "Menunggu Semakan" (INFERRED label), date "dd Mon yyyy"; open: the question, "A." … "D." (correct highlighted), `fa-lightbulb` "Penjelasan" + text, footer `fa-hashtag` "#{id}", `fa-database` source (e.g. "textbook_content_rebuild"), `fa-eye` "Aktif" | S21-068–090, 096–116, 122–142, 212–232 | Guru, Admin | OBSERVED |
| FN-M10-7.1.9 | Card actions (open card): `fa-edit` "Edit" → `/guru/soalan/{id}/edit`; `fa-trash` "Padam" (form `DELETE /guru/soalan/{id}`) with confirm "Padam soalan #{id}? Tindakan ini tidak boleh dibatalkan." → the question is removed (INFERRED) | S21-091–095, 117–121, 143–147 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-7.1.10 | Pager as FN-M10-6.1.5 (`?page=`; admin 841 pages) | S21-148–167, 233–234 | Guru, Admin | OBSERVED |
| FN-M10-7.1.11 | Card "Hantar Kertas Soalan kepada Admin" / "Admin akan proses dan upload ke databank soalan": `fa-info-circle` "Jenis Soalan Yang Diterima" (Soalan Umum, Trial Paper, Soalan DSKP, Buku Teks, Buku Latihan, Soalan Peperiksaan, `fa-check-circle`); `fa-exclamation-triangle` "Syarat Fail Yang Dihantar" ("Format diterima: **PDF (teks), DOCX, XLSX**"; "**PDF scan imej TIDAK diterima** — teks mesti boleh disalin"; "**Skema jawapan WAJIB** disertakan bersama soalan"; "Maksimum **5 fail**, saiz maksimum **20MB** setiap fail"); steps "1. Hantar" / "Upload fail anda", "2. Proses" / "Admin extract soalan", "3. Databank" / "Soalan tersedia"; form `POST /guru/soalan/hantar-kertas`: "Jenis Soalan *" (`required`; "-- Pilih Jenis --" + the 6 types + "Lain-lain", value = label), "Matapelajaran *" (`required`, 100, "Cth: Matematik, Fizik, BM..."), "Tingkatan" ("-- Semua / Tidak Pasti --", Tingkatan 1–5), "Tahun" (2000–2099, "Cth: 2024"), "Disediakan Oleh" (150, "Cth: Jabatan Pelajaran Johor, nama guru..."), "Catatan Tambahan" (1000, "Maklumat tambahan untuk admin..."), "Fail Soalan + Skema *" drop label "Klik untuk pilih fail PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail" (`files[]`, `.pdf,.doc,.docx,.xls,.xlsx`) with a file list (icon by extension, name, "{x.xx} MB"), `fa-paper-plane` "Hantar kepada Admin"; the paper enters M04 S10 as `pending` | S21-168–211 | Guru, Admin | OBSERVED + SOURCE-DERIVED |

**FT-M10-7.2 — Tambah Soalan Baru (S22 `/guru/soalan/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-7.2.1 | `fa-arrow-left` "Kembali ke Senarai Soalan" → `/guru/soalan`; form `POST /guru/soalan` (multipart); card "Maklumat Soalan" | S22-004–008 | Guru, Admin | OBSERVED |
| FN-M10-7.2.2 | "Tahap Pendidikan *" `education_level_id` (`required`; "-- Pilih Tahap --" + 11), "Mata Pelajaran *" `subject_id` (`required`; "-- Pilih Subjek --" + 31 A→Z) | S22-009–012 | Guru, Admin | OBSERVED |
| FN-M10-7.2.3 | "Bab (Pilihan)" `chapter_id` and "Topik (Pilihan)" `curriculum_topic_id` with inline "Bab Baru" / "Topik Baru" (FN-M10-11.1) | S22-013–027 | Guru, Admin | OBSERVED |
| FN-M10-7.2.4 | "Jenis Soalan *" `question_type` (`required`; `mcq` "Aneka Pilihan (MCQ)", `true_false` "Betul / Salah", `short_answer` "Jawapan Pendek", `fill_blank` "Isi Tempat Kosong", `essay` "Esei"); "Tahap Kesukaran *" `difficulty_level` (`required`; "-- Pilih Tahap --", "Mudah", "Sederhana", "Sukar" = M04 difficulty 2, 3, 4, DV-M10-15); "Jenis Tulisan" `script_type` (… `mixed` "Campuran (Rumi + Arab/Jawi)") + hidden `text_direction` | S22-028–034 | Guru, Admin | OBSERVED + DV-M10-15 |
| FN-M10-7.2.5 | Card "Pemetaan DSKP" / "Dokumen Standard Kurikulum dan Pentaksiran — Bidang → Standard Kandungan → Standard Pembelajaran": Bidang / SK / SP (FN-M10-11.2) with add panels ("Kod (cth: B1)", "Kod (cth: 1.1)", "Kod (cth: 1.1.1)"), note "Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR." | S22-035–062 | Guru, Admin | OBSERVED |
| FN-M10-7.2.6 | Card "Soalan": textarea `question_text` (`required`, `maxlength=2000`, "Tuliskan soalan di sini..."; for Arab/Jawi RTL with "اكتب السؤال هنا...") with keyboard button `fa-keyboard` (title "Papan kekunci Arab / Jawi"); for non-Rumi scripts `fa-eye` "Pratonton paparan soalan:" + preview or "(Tiada teks lagi)" | S22-063–067, 204–206 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-7.2.7 | "Imej Soalan (Pilihan)": "Muat Naik" (file `question_image`) or `fa-images` "Galeri Rajah" + hint "Muat naik imej soalan (pilihan)"; a chosen image shows a preview, remove `fa-times` and (from the gallery) badge "Dari Galeri"; modal "Galeri Rajah" (breadcrumb "Semua Set / {folder}", "Memuatkan...", folder tiles `fa-folder` "{n} set tersedia", image tiles "Klik imej untuk pilih", back `fa-arrow-left` "Semua Set", "Batal", `fa-check` "Pilih Rajah Ini"); with no folders: "Tiada galeri tersedia" / "Tiada galeri rajah tersedia" / "Sila muat naik imej secara manual menggunakan butang "Muat Naik"" (always, as live, DV-M10-09) | S22-068–087 | Guru, Admin | OBSERVED + SOURCE-DERIVED + DV-M10-09 |
| FN-M10-7.2.8 | MCQ block "Pilihan Jawapan" / "Masukkan 4 pilihan dan pilih jawapan yang betul.": rows A–D with radio `correct_option`, letter, text `options[i][text]` (`required`, 500, "Pilihan A"…"Pilihan D"), optional image per option (upload, preview, remove); `fa-info-circle` "Klik butang bulat untuk memilih jawapan yang betul."; image buttons wrap at 375px (DV-M10-21) | S22-088–119 | Guru, Admin | OBSERVED + DV-M10-21 |
| FN-M10-7.2.9 | Betul / Salah block: h3 "Jawapan Betul / Salah", "Pilih jawapan yang betul untuk pernyataan ini.", radios `tf_answer` "Betul" / "Salah" | S22-120–126 | Guru, Admin | OBSERVED |
| FN-M10-7.2.10 | Jawapan Pendek / Isi Tempat Kosong block "Jawapan Betul": "Masukkan jawapan yang betul. Pelajar akan dipadankan secara automatik." (short) or "Gunakan `___` dalam soalan untuk tempat kosong, dan masukkan jawapan betul di bawah." (fill); "Jawapan Utama *" `correct_answer` (`required`, 500, "Jawapan yang betul..."), "Jawapan Alternatif (Pilihan)" `alt_answers` (500, "Pisahkan dengan koma, cth: jawapan1, jawapan2") + "Jawapan alternatif yang juga diterima sebagai betul." | S22-127–136 | Guru, Admin | OBSERVED |
| FN-M10-7.2.11 | Esei block "Jawapan Contoh (Model Answer)" / "Masukkan jawapan contoh sebagai rujukan pelajar selepas menjawab." + textarea `model_answer` ("Tulis jawapan contoh di sini...") | S22-137–140 | Guru, Admin | OBSERVED |
| FN-M10-7.2.12 | Card "Penerangan (Pilihan)": textarea `explanation` (2000, "Terangkan jawapan yang betul untuk membantu pelajar faham...") | S22-141–143 | Guru, Admin | OBSERVED |
| FN-M10-7.2.13 | Footer: `fa-times` "Batal" link → `/guru/soalan` (discards), `fa-paper-plane` "Hantar untuk Semakan" (gradient emerald-500 → teal-600); on success the question is stored `pending` for admin review (M04) and the teacher returns to `/guru/soalan` (INFERRED; flash UNVERIFIED); both buttons stay on one row at 375px | S22-144–145 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-7.2.14 | Virtual Arabic keyboard (`virtualKeyboard()`): mode buttons "عربي" / "جاوي", title "Papan Kekunci Arab" / "Papan Kekunci Jawi", close `fa-times`; Arab 32 keys in 3 rows (Jawi adds ڤ ڠ چ ڽ ݢ ۏ), 9 harakat keys (Fathah (atas) … Superscript Alif (alif kecil)), "SPACE", "ال", "ة", backspace `fa-delete-left`, enter `fa-turn-down`; inserts at the cursor, sets `dir=rtl` and the font "'Scheherazade New', 'Lateef', serif"; at <640px a bottom sheet over a dark backdrop, otherwise a 580px panel under the field | S22-146–203 | Guru, Admin | OBSERVED + SOURCE-DERIVED |

**FT-M10-7.3 — Detail Soalan (S23 `/guru/soalan/{id}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-7.3.1 | Links `fa-arrow-left` "Kembali" → `/guru/soalan`, `fa-edit` "Edit Soalan" → `/{id}/edit` | S23-004–005 | Guru, Admin | OBSERVED |
| FN-M10-7.3.2 | Chips subject, source (e.g. "textbook_content_rebuild"), "Tahap {n}" (M04 difficulty number), type (e.g. "mcq"); question; options "A)" … "D)" | S23-006–019 | Guru, Admin | OBSERVED |
| FN-M10-7.3.3 | Card "Penerangan"; card "Statistik": "{n}" "Kali Digunakan", "{n}" "Jawab Betul", "{x}%" "Ketepatan" (from the M05 answer log, INFERRED) | S23-020–030 | Guru, Admin | OBSERVED / INFERRED |

**FT-M10-7.4 — Edit Soalan (S24 `/guru/soalan/{id}/edit`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-7.4.1 | `fa-arrow-left` "Kembali" → show page; form `POST /guru/soalan/{id}` + `_method=PUT` | S24-004–007 | Guru, Admin | OBSERVED |
| FN-M10-7.4.2 | Card "Sumber Asal" with the source value | S24-008–010 | Guru, Admin | OBSERVED |
| FN-M10-7.4.3 | "Soalan *" textarea `question_text` (the only `required` field); "Tambah Gambarajah (optional)" file `image`, "JPG, PNG, max 5MB." | S24-011–017 | Guru, Admin | OBSERVED |
| FN-M10-7.4.4 | "Tahap Kesukaran" `difficulty_level`: "-- Pilih --", "Mudah" (2), "Sederhana" (3), "Sukar" (4), the saved value preselected (DV-M10-15; live "Tahap 1 (Mudah)"/"Tahap 2 (Sederhana)"/"Tahap 3 (Sukar)" with values 1–3, nothing preselected). A saved 1 or 5 shows "-- Pilih --"; that saving with "-- Pilih --" keeps the saved difficulty is an INFERRED server rule (not observed) | S24-018–020 | Guru, Admin | OBSERVED + DV-M10-15 / INFERRED (empty value) |
| FN-M10-7.4.5 | "Pilihan Jawapan *": four rows with hidden `options[i][id]`, radio `correct_option` (= option id; the correct one preselected), "A)"–"D)", textarea `options[i][option_text]`; hint `fa-info-circle` "Pilih radio button untuk tandakan jawapan betul". Only MCQ fields are editable (no type/subject/level/DSKP change, as live) | S24-021–039 | Guru, Admin | OBSERVED |
| FN-M10-7.4.6 | "Penerangan (optional)" textarea `explanation` | S24-040–042 | Guru, Admin | OBSERVED |
| FN-M10-7.4.7 | `fa-save` "Simpan Perubahan" (→ show page, INFERRED) and "Batal" link → show page | S24-043–044 | Guru, Admin | OBSERVED / INFERRED |

**FT-M10-7.5 — Set Audio KBAT list (S25 `/guru/audio-kbat`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-7.5.1 | Badge `fa-headphones` "Ujian Mendengar"; h1 "Set Audio KBAT"; "Senarai set soalan audio fixed sequence, bukan rawak."; "Template XLSX", "Template Word" (downloads), `fa-plus` "Cipta Set" → create | S25-004–009 | Guru, Admin | OBSERVED |
| FN-M10-7.5.2 | Guide "Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT" + the two paragraphs (Appendix B) | S25-010–012 | Guru, Admin | OBSERVED |
| FN-M10-7.5.3 | 4 stat cards "Set", "Approved", "Draft/Pending", "Soalan" of the viewer's sets (Draft/Pending = draft + pending_review; Soalan = 30 × sets, INFERRED) | S25-013–024 | Guru, Admin | OBSERVED / INFERRED |
| FN-M10-7.5.4 | GET filter: `education_level_id` ("Semua Tahap" + 11), `subject_id` ("Semua Subjek" + 31 A→Z), `status` ("Semua Status", `draft` "Draft", `pending_review` "Pending Review", `approved` "Approved", `archived` "Archived"), `search` ("Cari tajuk/sumber..."), `fa-search` "Tapis" | S25-025–030 | Guru, Admin | OBSERVED |
| FN-M10-7.5.5 | Empty `fa-headphones` "Belum ada set Audio KBAT."; populated rows UNVERIFIED (L-M10-11; PROPOSED row as the M09 admin list: title, level, subject, status label) | S25-031 | Guru, Admin | OBSERVED; populated PROPOSED |

**FT-M10-7.6 — Cipta Set Audio KBAT (S26 `/guru/audio-kbat/create`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-7.6.1 | `fa-arrow-left` "Kembali" → S25; h1 "Cipta Set Audio KBAT"; "Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section."; box "Apa yang cikgu perlu sediakan?" + two paragraphs; "Template Word", "Template XLSX" | S26-004–011 | Guru, Admin | OBSERVED |
| FN-M10-7.6.2 | Form `POST /guru/audio-kbat` (multipart); card "Maklumat Set": "Tajuk Set" `title` (`required`, "Contoh: BM T4 Ujian Mendengar Set 1"), "Tahap" (`required`, "Pilih Tahap" + 11), "Subjek" (`required`, "Pilih Subjek" + 31 A→Z), "Sumber / Penyumbang" `source_label` ("Contoh: Cikgu Contoh A"), "Arahan Umum" `instructions` ("Dengar audio bagi setiap bahagian dan jawab semua soalan.") | S26-012–025 | Guru, Admin | OBSERVED |
| FN-M10-7.6.3 | Four fixed section cards "Bahagian 1 · Soalan 1-8", "Bahagian 2 · Soalan 9-16", "Bahagian 3 · Soalan 17-24", "Bahagian 4 · Soalan 25-30": "Audio section ini akan kekal bersama semua soalan dalam range ini.", "Tajuk Audio" `sections[n][title]`, "Fail Audio" `sections[n][audio]` (`.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*`), "Transkrip Audio Untuk Audit" `sections[n][transcript]` ("Wajib digalakkan untuk semakan admin.") | S26-026–034, 079–105 | Guru, Admin | OBSERVED |
| FN-M10-7.6.4 | 30 question blocks "Soalan {n}" + badge "KBAT Audio", each under its section: "Teks Soalan" (`required`), "Pilihan A"–"Pilihan D" (`required`), "Jawapan" A/B/C/D (`required`), "Markah" (1–20), "KBAT Level" (1–5), "DSKP SP ID" (number, "Optional"), "Skema / Penjelasan" | S26-035–078 | Guru, Admin | OBSERVED |
| FN-M10-7.6.5 | `fa-save` "Simpan Set Audio KBAT"; on success the set is stored with status `pending_review` for M09 admin review and the teacher returns to S25 (INFERRED; flash UNVERIFIED) | S26-106 | Guru, Admin | OBSERVED / INFERRED |

### EP-M10-8 — Question databank


**FT-M10-8.1 — Databank Soalan SPM (S27 `/guru/databank`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-8.1.1 | Banner card (purple gradient) h1 "Databank Soalan SPM" in white (DV-M10-25; live dark text, barely readable), "Semak & semak semula soalan SPM — Lapor jika ada masalah" | S27-004–006 | Guru, Admin | OBSERVED + DV-M10-25 |
| FN-M10-8.1.2 | Cards "{jumlah}" "Jumlah Soalan" (21,033) and "{n}" "Subjek Aktif" (18 = subjects with ≥1 question); tip `fa-lightbulb` "Klik mana-mana subjek untuk lihat semua soalan. Anda boleh lapor soalan yang salah atau tidak relevan." | S27-007–013 | Guru, Admin | OBSERVED |
| FN-M10-8.1.3 | Grid h2 "Subjek Teras (7)": link cards → `/guru/databank/{CODE}` with icon tile, h3 BM name, English name, "{n} soalan" (BM 514, BI 1,114, MATH 1,681, SCI 2,076, SEJ 1,539, PI 483, PM 1,353 = the M06 SPM pool counts); 3-up → 1-up | S27-014–029 | Guru, Admin | OBSERVED |
| FN-M10-8.1.4 | Grid h2 "Subjek Elektif (18)": the 18 elective cards (Appendix A.4), zero-count subjects still link; every icon tile shows a glyph (DV-M10-25; live blank for `fa-beaker`, `fa-flask-round`, `fa-trending-up`, `fa-variable`, `fa-monitor`, `fa-languages`) | S27-030–067 | Guru, Admin | OBSERVED + DV-M10-25 |

**FT-M10-8.2 — Databank per subject (S28 `/guru/databank/{CODE}`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-8.2.1 | Breadcrumb `fa-arrow-left` "Databank" → `/guru/databank` / "{Subjek}"; h1 subject name + English name; chips "{n} Jumlah", "{n} Objektif", "{n} Subjektif" (BM 6,048 / 5,918 / 105; Jumlah includes the other types, DV-M10-16 replicated) | S28-004–012 | Guru, Admin | OBSERVED + DV-M10-16 |
| FN-M10-8.2.2 | Filter card "Carian" (GET, Alpine `dskpFilter()`): "Carian" `q` ("Cari soalan..."), "Jenis" `question_type` ("Semua", `mcq` "Objektif", `essay` "Subjektif"), "Sumber" `source_type` ("Semua", `past_year` "Tahun Lepas", `practice` "Latihan", `prediction` "Ramalan"), "Kesukaran" `difficulty` ("Semua", 1–5), "Bidang" `dskp_bidang_id` ("Semua Bidang" + the subject's Tingkatan 4 and Tingkatan 5 Bidang "{code} — {name}"), "Standard Kandungan" `dskp_sk_id` ("Semua SK", loaded on Bidang change), "Standard Pembelajaran" `dskp_sp_id` ("Semua SP", loaded on SK change), `fa-search` "Tapis"; `fa-times` "Reset" → the unfiltered page when a filter is active | S28-013–029, 132 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-8.2.3 | Question cards (15 per page, newest id first): chips "Tahap {n}", source, type "Objektif"/"Subjektif", `fa-sitemap` chapter/tema name, `fa-hashtag` "ID Soalan: {id}"; question; "A." … "D." (correct highlighted); `fa-chevron-right` "Penerangan" toggle revealing the explanation; level ("Tingkatan 1"); `fa-flag` "Lapor Masalah" (red-50/red-600), or "Sudah Dilaporkan" (`fa-check-circle`, slate) after a report | S28-030–086, 133–165 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-8.2.4 | Pager as FN-M10-6.1.5; page links keep the non-empty filters (`?question_type=mcq&difficulty=3&page=2`) | S28-087–106 | Guru, Admin | OBSERVED |
| FN-M10-8.2.5 | Modal "Lapor Masalah Soalan" (`fa-flag`): "Soalan #{id}"; 8 reason checkboxes `wrong_answer` "Jawapan tidak tepat", `confusing_question` "Soalan mengelirukan", `wrong_options` "Set jawapan tidak tepat", `missing_options` "Pilihan jawapan tidak lengkap", `duplicate` "Soalan berulang / pendua", `outdated` "Soalan sudah tidak relevan", `typo` "Kesalahan ejaan / taip", `other` "Lain-lain"; "Komen (pilihan)" textarea (500, "Jelaskan masalah secara ringkas..."); "Hantar Laporan" (disabled with no reason or while sending; "Menghantar...") → M04 report with `source: 'teacher_databank'`; success → modal closes, toast with the response message, the card button becomes "Sudah Dilaporkan"; failure toast = response `error` or "Gagal menghantar laporan."; network "Ralat rangkaian. Sila cuba lagi."; toast 4 s; "Batal" only hides the modal; opening it again (any question) resets the reasons and the comment | S28-107–131, 166 | Guru, Admin | OBSERVED + SOURCE-DERIVED |

### EP-M10-9 — Teacher articles


**FT-M10-9.1 — Sumbang Artikel list (S29 `/guru/artikel`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-9.1.1 | h1 "Sumbang Artikel", "Kongsi ilmu dan pengalaman anda dengan komuniti PRESTASIPLUS", `fa-feather-alt` "Tulis Artikel Baru" → cipta | S29-004–006 | Guru, Admin | OBSERVED |
| FN-M10-9.1.2 | 4 stat cards "Jumlah Artikel", "Diterbitkan", "Menunggu Semakan", "Jumlah Pembaca" (thousands separator) of the viewer's articles (admin 36 / 36 / 0 / 12,270) | S29-007–018 | Guru, Admin | OBSERVED |
| FN-M10-9.1.3 | Rows (15 per page, newest first): h3 title, status `fa-check-circle` "Diterbitkan" (or "Menunggu Semakan", INFERRED label), category chip, `fa-calendar` date "dd Mon yyyy", `fa-eye` "{n} pembaca", excerpt; actions `fa-external-link-alt` → `/artikel/{slug}` (M09 reader) and `fa-edit` → `/guru/artikel/{id}/edit`; no delete button (as live) | S29-019–043, 054–066 | Guru, Admin | OBSERVED |
| FN-M10-9.1.4 | Pager as FN-M10-6.1.5 | S29-044–053, 067–068 | Guru, Admin | OBSERVED |

**FT-M10-9.2 — Tulis Artikel Baru (S30 `/guru/artikel/cipta`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-9.2.1 | Back `fa-arrow-left` → list; h1 "Tulis Artikel Baru" + "Kongsi ilmu dan pengalaman anda dengan komuniti PRESTASIPLUS"; form `POST /guru/artikel` (the editor content is copied into hidden `content` on submit) | S30-004–008 | Guru, Admin | OBSERVED |
| FN-M10-9.2.2 | "Tajuk Artikel *" `title` (`required`, "Contoh: 5 Tips Belajar Matematik yang Menyeronokkan") | S30-009–011 | Guru, Admin | OBSERVED |
| FN-M10-9.2.3 | "Kandungan Artikel *" rich-text editor (placeholder "Mula menulis artikel anda di sini..."), hidden `content` | S30-012–014 | Guru, Admin | OBSERVED |
| FN-M10-9.2.4 | "Video YouTube (opsional)": 🎬 "Sila gunakan pautan YouTube sahaja untuk berkongsi video pembelajaran." **"PRESTASIPLUS tidak membenarkan muat naik video."**, url `youtube_url` ("https://www.youtube.com/watch?v=xxxxxxx"), hint `fa-info-circle` "Contoh: https://www.youtube.com/watch?v=abc123 atau https://youtu.be/abc123" | S30-015–021 | Guru, Admin | OBSERVED |
| FN-M10-9.2.5 | "Lampiran Fail": "PDF, Word, Excel, PowerPoint" chips PDF / Word / Excel / PPT; "**Video tidak dibenarkan** — sila gunakan ruangan YouTube di atas untuk video."; drop zone "📎 Seret & Lepas fail di sini atau klik untuk pilih fail" "Maks: 20MB setiap fail • Maks 5 fail" (`.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx`); per file "Label (opsional)" + remove `fa-times`; alerts "Maksimum 5 fail sahaja.", "Muat naik video tidak dibenarkan di PRESTASIPLUS.\nSila gunakan pautan YouTube sahaja untuk berkongsi video.", "Fail "{nama}" terlalu besar. Maks 20MB.", "Fail "{nama}" tidak disokong. Format yang dibenarkan: PDF, Word, Excel, PowerPoint" | S30-022–034, 057 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-9.2.6 | Card "Tetapan": "Kategori *" `category` (`required`; "Pilih...", TIPS_BELAJAR Tips Belajar, BERITA Berita, MOTIVASI Motivasi, PANDUAN_IBU_BAPA Panduan Ibu Bapa, PANDUAN_GURU Panduan Guru, KEJAYAAN Kejayaan, UMUM Umum), "Tahap *" `grade_level` (`required`; "Pilih...", SEMUA Semua Darjah, DARJAH_1 … DARJAH_6), "Ringkasan" `excerpt` (500, "Ringkasan singkat...") | S30-035–042 | Guru, Admin | OBSERVED |
| FN-M10-9.2.7 | Card "Gambar Utama": "🖼️ Klik untuk pilih gambar" "JPEG, PNG, WebP • Maks 2MB" (`featured_image`), preview + remove `fa-times` | S30-043–048 | Guru, Admin | OBSERVED |
| FN-M10-9.2.8 | Tips 💡 "Tips Menulis Artikel" ("• Gunakan tajuk yang menarik perhatian", "• Sertakan gambar untuk menarik minat", "• Lampirkan bahan rujukan (PDF/dokumen)", "• Tambah pautan video YouTube!"); `fa-paper-plane` "Hantar Artikel" (gradient orange-500 → pink-500) + `fa-shield-alt` "Akan disemak admin sebelum diterbitkan"; the article is stored with `isPublished = false` ("Menunggu Semakan") in the M09 store and the teacher returns to the list (INFERRED) | S30-049–056 | Guru, Admin | OBSERVED / INFERRED |

**FT-M10-9.3 — Edit Artikel (S31 `/guru/artikel/{id}/edit`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-9.3.1 | Back → list; h1 "Edit Artikel", "Kemaskini artikel anda", status badge (`fa-check-circle` "Diterbitkan"); form `_method=PUT` | S31-004–010 | Guru, Admin | OBSERVED |
| FN-M10-9.3.2 | "Tajuk Artikel *" (`required`, preloaded) | S31-011–013 | Guru, Admin | OBSERVED |
| FN-M10-9.3.3 | "Kandungan Artikel *" editor preloaded with the article HTML (placeholder "Kemaskini kandungan artikel anda...") | S31-014–029 | Guru, Admin | OBSERVED |
| FN-M10-9.3.4 | "Video YouTube (opsional)" as S30 | S31-030–036 | Guru, Admin | OBSERVED |
| FN-M10-9.3.5 | "Tambah Lampiran Baru": "PDF, Word, Excel, PPT", chips, "**Video tidak dibenarkan** — sila gunakan ruangan YouTube di atas.", drop zone "📎 Seret & Lepas fail di sini atau klik untuk pilih"; short alerts "Maks 5 fail.", "Muat naik video tidak dibenarkan.\nSila gunakan pautan YouTube sahaja.", ""{nama}" terlalu besar.", ""{nama}" tidak disokong."; existing attachments with delete (`confirm('Padam lampiran ini?')` → `DELETE /guru/artikel/attachment/{id}`, SOURCE-DERIVED) | S31-037–048, 065 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-9.3.6 | "Tetapan": "Kategori *" and "Tahap *" preloaded with no "Pilih..." option; "Ringkasan" | S31-049–056 | Guru, Admin | OBSERVED |
| FN-M10-9.3.7 | "Gambar Utama" "🖼️ Klik untuk pilih gambar", preview + remove | S31-057–062 | Guru, Admin | OBSERVED |
| FN-M10-9.3.8 | `fa-save` "Kemaskini Artikel" (→ list, INFERRED) and "Batal" link → list | S31-063–064 | Guru, Admin | OBSERVED / INFERRED |

### EP-M10-10 — Teacher profile


**FT-M10-10.1 — Profil Guru (S32 `/guru/profil/edit`)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-10.1.1 | Form `POST /guru/profil` + `_method=PUT` | S32-004–006 | Guru, Admin | OBSERVED |
| FN-M10-10.1.2 | Card "Maklumat Peribadi": "Nama Penuh *" `name` (`required`, 255); "E-mel / Username *" `email` (type email, `required`, 255, "cth: nama@gmail.com") + "Ini adalah e-mel login anda. Tukar ke e-mel peribadi supaya lebih mudah diingati."; "Bio" (1000, "Ceritakan tentang diri anda sebagai pendidik..."); "No Kad Pengenalan" `ic_number` (20, "cth: 000101010000") + "Digunakan untuk reset kata laluan secara layan diri. Tanpa tanda sempang (-)." | S32-007–018 | Guru, Admin | OBSERVED |
| FN-M10-10.1.3 | Card "Sekolah": picker (`schoolPicker`): the saved school as a card with clear `fa-times-circle`, else the search "Taip nama sekolah untuk cari..." (≥2 characters, `GET /api/schools/search?q=&limit=15`), results "{nama}" + "{daerah}, {negeri}", "Tiada sekolah dijumpai"; hidden `school_id` | S32-019–028, 044–058 | Guru, Admin | OBSERVED + SOURCE-DERIVED |
| FN-M10-10.1.4 | Card "Maklumat Profesional": "Subjek Utama" `subject` ("cth: Matematik, Sains"), "Kelayakan" `qualification` ("cth: Ijazah Sarjana Pendidikan"), "Pengalaman (tahun)" `experience_years` (0–50, default 0) | S32-029–036 | Guru, Admin | OBSERVED |
| FN-M10-10.1.5 | Card "Profil Awam Anda" / "Kongsi profil anda dengan pelajar dan ibu bapa.": URL `https://prestasiplus.my/guru/{id}` (admin: `/guru/3`, OBSERVED; that 3 is a teacher-profile id is INFERRED — the admin user id is 1 and both `/guru/1` and `/guru/3` are 404), `fa-copy` "Salin Link" (clipboard, `copied` state), `fa-external-link-alt` "Lihat" (new tab) → global 404 (replicated, DV-M10-06; teacher outcome UNVERIFIED, OQ-M10-12) | S32-037–041 | Guru, Admin | OBSERVED / INFERRED (id) + DV-M10-06 |
| FN-M10-10.1.6 | `fa-arrow-left` "Kembali" → `/guru`; `fa-save` "Simpan Profil" (on success → the same page, INFERRED; flash UNVERIFIED); name/email/IC changes update the M01 user record | S32-042–043 | Guru, Admin | OBSERVED / INFERRED |

### EP-M10-11 — Shared authoring services


**FT-M10-11.1 — Curriculum lookups and inline creation**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-11.1.1 | Chapters: `GET /guru/api/chapters?subject_id=&education_level_id=` → `[{id, chapter_number, name}]` shown "Bab {n}: {name}" in chapter-number order; topics: `GET /guru/api/topics?chapter_id=` → `[{id, topic_number, name}]`; changing subject or level clears chapter/topic; a failed request empties the list silently | — | Guru, Admin | SOURCE-DERIVED |
| FN-M10-11.1.2 | Inline "Bab Baru": both number and name needed (else nothing happens); `POST /guru/api/chapters {subject_id, education_level_id, name, chapter_number}` → the new chapter is added, sorted, selected and its topics loaded; inline "Topik Baru": `POST /guru/api/topics {chapter_id, name}` → added and selected; S18 shows `alert(error)` for a server `error` and "Gagal menambah bab." / "Gagal menambah topik." on failure; S16/S22 log failures silently | — | Guru, Admin | SOURCE-DERIVED |

**FT-M10-11.2 — DSKP lookups and inline creation (M10 owns the DSKP data set)**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-11.2.1 | Bidang `GET /guru/api/dskp/bidang?subject_id=&education_level_id=` → `[{id, code, name}]` ("{code} — {name}"; name alone when code is empty); SK `GET /guru/api/dskp/sk?dskp_bidang_id=` → `[{id, code, description}]`; SP `GET /guru/api/dskp/sp?dskp_sk_id=` → `[{id, code, description}]`; each change resets the lower levels; the question stores only `dskp_sp_id` | — | Guru, Admin | SOURCE-DERIVED |
| FN-M10-11.2.2 | Inline "Bidang Baru" / "SK Baru" / "SP Baru": code and name/description needed; `POST /guru/api/dskp/bidang {subject_id, education_level_id, code, name}`, `/sk {dskp_bidang_id, code, description}`, `/sp {dskp_sk_id, code, description}` → added and selected, then the next level loads; errors via `alert()` (server `error` or "Gagal menambah bidang." / "Gagal menambah SK." / "Gagal menambah SP.") | — | Guru, Admin | SOURCE-DERIVED |

**FT-M10-11.3 — Symbol palette**

| FN | Function | EL | Roles | Source |
|---|---|---|---|---|
| FN-M10-11.3.1 | Clicking a palette symbol inserts it at the cursor of the textarea it belongs to (stimulus or sub-question), keeps the caret after it, focuses the field and fires `input` (so the Alpine model updates) | — | Guru, Admin | SOURCE-DERIVED |

---

## 4. User stories

Values in the ACs come from the seed (SRS §6.11). "The admin" = `admin@demo.test` (id 1; mirrors the live admin: no class, no teacher-profile school; public profile id 3 as shown on S32, its nature INFERRED). "The teacher" = `guru@demo.test` (id 5; teacher profile id 4, school SMK DEMO 900001; classes 2001 "5 MARIKH - Kimia" DMO101 and 2002 "5 MARIKH - Sejarah" DMO102, both Tingkatan 5, M08 v1.3). "The student" = `pelajar@demo.test` (id 2, not enrolled in any seeded class). "The new student" = `pelajar2@demo.test` (id 3, no class; joins at runtime in the student-side ACs). "Murid Demo 01…08" = the fictitious members 3001–3008 of both classes (M08 v1.3; their sessions are the M08 §6.10 designed sessions). ACs marked "(depends on R-M04-0n)" assert counts that M04 must add to its dataset (SRS §13); they are not provisional but pass once the owner contract they cite (SRS §13, delivered in M04 v1.9) is built. Mock clock `2026-09-25T15:40:00+08:00` (Friday). ACs marked **(provisional)** assert PROPOSED or INFERRED behaviour for a state never observed on live; their E2E are tagged provisional in SRS §12.

| ID | Feature | MoSCoW | Story | Functions |
|---|---|---|---|---|
| US-M10-01 | FT-M10-1.1 | Must | As a teacher, I want the teacher pages in my sidebar or drawer with the right page title, so that I can find them and know where I am. | FN-M10-1.1.1–1.1.3 |
| US-M10-02 | FT-M10-1.2 | Must | As the owner, I want M10 closed to guests and wrong or method-only URLs to show the standard 404 page, so that the area behaves predictably. | FN-M10-1.2.1–1.2.4 |
| US-M10-03 | FT-M10-2.1 | Should | As a new teacher, I want a dismissible "Mula Di Sini" guide, so that I know the first three steps. | FN-M10-2.1.1 |
| US-M10-04 | FT-M10-2.1 | Must | As a teacher, I want a setup checklist and headline counts, so that I see how far my classes are set up. | FN-M10-2.1.2, 2.1.3 |
| US-M10-05 | FT-M10-2.1 | Should | As a teacher, I want today's priorities, peer-tutor suggestions, quick actions, my classes and recent submissions on the dashboard, so that I act on what matters first. | FN-M10-2.1.4–2.1.8 |
| US-M10-06 | FT-M10-2.2 | Must | As a teacher, I want a live Command Center with KPIs and panels refreshed every 10 seconds, so that I monitor my students in real time. | FN-M10-2.2.1–2.2.6 |
| US-M10-07 | FT-M10-2.2 | Must | As a teacher, I want to drill into any KPI or panel with a correctly titled modal, so that I see the students behind a number. | FN-M10-2.2.7, 2.2.14 |
| US-M10-08 | FT-M10-2.2 | Should | As a teacher, I want the class summary and the SPM prediction panels, so that I compare classes and spot students at risk of a poor grade. | FN-M10-2.2.8, 2.2.9 |
| US-M10-09 | FT-M10-2.2 | Must | As a teacher, I want Smart Remedial to list weak students and let me generate or cancel a remedial test, so that weak topics get targeted practice. | FN-M10-2.2.10, 2.2.11 |
| US-M10-10 | FT-M10-2.2 | Could | As a teacher, I want the risk evaluation and the badges panels, so that I see alerts and achievements. | FN-M10-2.2.12, 2.2.13 |
| US-M10-11 | FT-M10-2.3 | Should | As a teacher, I want a remedial progress dashboard, so that I see whether remedial tests improved my students. | FN-M10-2.3.1–2.3.3 |
| US-M10-12 | FT-M10-3.1 | Must | As a teacher, I want to see my classes (or be told to create one), so that I manage them. | FN-M10-3.1.1–3.1.3 |
| US-M10-13 | FT-M10-3.1 | Must | As a teacher, I want a QR code and join link for a class, so that students can join quickly. | FN-M10-3.1.4 |
| US-M10-14 | FT-M10-3.2 | Must | As a teacher, I want to fill in a class with its school, name, subject and level, with only the levels that fit the school type, so that the class is set up correctly. | FN-M10-3.2.1–3.2.6, 3.2.8 |
| US-M10-15 | FT-M10-3.2 | Must | As a teacher, I want to create the class and get a join code, so that students can join it. | FN-M10-3.2.7 |
| US-M10-16 | FT-M10-3.3 | Must | As a teacher, I want to see the students of my classes and of my school, so that I can add students to my classes. | FN-M10-3.3.1–3.3.4 |
| US-M10-17 | FT-M10-3.4 | Must | As a student, I want to join my teacher's class with a 6-character code, so that I receive the class's work. | FN-M10-3.4.1–3.4.3 |
| US-M10-18 | FT-M10-4.1 | Must | As a teacher, I want attendance derived from answers (≥5 per day) for any past date with a 7-day trend, so that I know who practised without marking by hand. | FN-M10-4.1.1–4.1.6 |
| US-M10-19 | FT-M10-4.2 | Should | As a teacher, I want to set a daily subject focus for each weekday, so that students know what to study. | FN-M10-4.2.1–4.2.3 |
| US-M10-20 | FT-M10-4.3 | Should | As a teacher, I want to send a short normal or important message to my students, so that they see it when they log in. | FN-M10-4.3.1, 4.3.2 |
| US-M10-21 | FT-M10-4.4 | Should | As a teacher, I want a live view of students answering now, refreshed every 30 seconds, so that I can follow a class session. | FN-M10-4.4.1–4.4.4 |
| US-M10-22 | FT-M10-5.1 | Must | As a teacher, I want a list of my daily missions, so that I track what I assigned. | FN-M10-5.1.1–5.1.3 |
| US-M10-23 | FT-M10-5.2 | Must | As a teacher, I want to launch a daily mission (type, date, subject, optional chapter, 5–50 questions, optional reference), so that my students practise with a fixed coin reward. | FN-M10-5.2.1–5.2.7 |
| US-M10-24 | FT-M10-5.3 / 5.4 | Must | As a teacher, I want to create question sets for a class with a TOV/AR group, limits and a publication status, so that I run baseline and progress tests. | FN-M10-5.3.1–5.3.3, 5.4.1–5.4.5 |
| US-M10-25 | FT-M10-5.5 | Should | As a teacher, I want a list of my "Soalan & Rujukan" questions with how-to steps, so that I manage my private questions. | FN-M10-5.5.1–5.5.5 |
| US-M10-26 | FT-M10-5.6 | Should | As a teacher, I want to write MCQs attached to a reference link (auto-embedded when possible) for chosen classes, so that students study the material and then answer. | FN-M10-5.6.1–5.6.9, 11.1.1, 11.1.2 |
| US-M10-27 | FT-M10-5.7 | Must | As a student, I want to see the question sets my teachers prepared, so that I can attempt them. | FN-M10-5.7.1, 5.7.2 |
| US-M10-28 | FT-M10-6.1 | Must | As a teacher, I want to list, filter, page and publish/unpublish structured questions, so that I manage my Paper 2 bank. | FN-M10-6.1.1–6.1.6 |
| US-M10-29 | FT-M10-6.2 | Must | As a teacher, I want to author a structured question (curriculum, DSKP, KBAT, script, template, stimulus with symbols, sub-questions with marks and rubrics), so that it follows the KPM Paper 2 format. | FN-M10-6.2.1–6.2.11, 11.3.1 |
| US-M10-30 | FT-M10-6.2 | Must | As a teacher, I want to add a missing chapter, topic, Bidang, SK or SP inline and save the question as draft or published, so that I am not blocked by missing curriculum data. | FN-M10-6.2.12, 11.1.1, 11.1.2, 11.2.1, 11.2.2 |
| US-M10-31 | FT-M10-6.3 | Must | As a teacher, I want to preview a structured question, so that I check it as students will see it. | FN-M10-6.3.1, 6.3.2 |
| US-M10-32 | FT-M10-6.4 | Must | As a teacher, I want to edit a structured question with its saved values preselected, so that I correct it without re-entering data. | FN-M10-6.4.1–6.4.7 |
| US-M10-33 | FT-M10-7.1 | Must | As a teacher, I want my contribution counts, badge tiers and subject breakdown, so that I see my contribution to the national bank. | FN-M10-7.1.1–7.1.4 |
| US-M10-34 | FT-M10-7.1 | Should | As a teacher, I want to import questions by CSV with a template and to reach the Audio KBAT tools, so that I contribute in bulk. | FN-M10-7.1.5–7.1.7 |
| US-M10-35 | FT-M10-7.1 | Must | As a teacher, I want to browse, open, edit and delete my contributed questions page by page, so that I maintain them. | FN-M10-7.1.8–7.1.10 |
| US-M10-36 | FT-M10-7.1 | Should | As a teacher, I want to send whole question papers (with answer schemes) to the admin, so that they are processed into the databank. | FN-M10-7.1.11 |
| US-M10-37 | FT-M10-7.2 | Must | As a teacher, I want to write a question of any of the five types with curriculum and DSKP mapping, image, Arabic/Jawi support and explanation, and send it for review, so that it can enter the national bank. | FN-M10-7.2.1–7.2.14, 11.1.1, 11.2.1 |
| US-M10-38 | FT-M10-7.3 | Must | As a teacher, I want a question's detail with its usage statistics, so that I see how it performs. | FN-M10-7.3.1–7.3.3 |
| US-M10-39 | FT-M10-7.4 | Must | As a teacher, I want to edit a contributed question's text, image, difficulty, options and explanation with the saved difficulty preselected, so that I fix mistakes without losing data. | FN-M10-7.4.1–7.4.7 |
| US-M10-40 | FT-M10-7.5 / 7.6 | Should | As a teacher, I want to list and create fixed-sequence Audio KBAT listening sets (4 audio sections, 30 MCQs), so that listening tests reach students after review. | FN-M10-7.5.1–7.5.5, 7.6.1–7.6.5 |
| US-M10-41 | FT-M10-8.1 | Must | As a teacher, I want the SPM databank by core and elective subject with counts, so that I pick a subject to review. | FN-M10-8.1.1–8.1.4 |
| US-M10-42 | FT-M10-8.2 | Must | As a teacher, I want to search and filter a subject's questions by type, source, difficulty and DSKP, so that I review the relevant ones. | FN-M10-8.2.1–8.2.4 |
| US-M10-43 | FT-M10-8.2 | Must | As a teacher, I want to report a problem with a databank question, so that the admin can fix it. | FN-M10-8.2.5 |
| US-M10-44 | FT-M10-9.1 | Should | As a teacher, I want the list of my articles with status and readers, so that I follow my contributions. | FN-M10-9.1.1–9.1.4 |
| US-M10-45 | FT-M10-9.2 | Should | As a teacher, I want to write an article with a YouTube link, attachments, category, level and a main image and send it for review, so that it can be published. | FN-M10-9.2.1–9.2.8 |
| US-M10-46 | FT-M10-9.3 | Should | As a teacher, I want to edit my article with its saved values, so that I can update it. | FN-M10-9.3.1–9.3.8 |
| US-M10-47 | FT-M10-10.1 | Must | As a teacher, I want to edit my personal, school and professional details and see my public profile link, so that my profile is correct. | FN-M10-10.1.1–10.1.6 |
| US-M10-48 | cross-cutting | Must | As a user on a phone, tablet or desktop, I want every M10 screen to fit without page scrolling sideways and with readable text, so that I can use it anywhere. | All screen FNs; DV-M10-17…21, DV-M10-28 |

### Acceptance criteria

**US-M10-01 — Menus and titles**
- **AC-M10-01.1** Given the admin at 1280px on any user-shell M10 screen, when it loads, then the sidebar shows "Dashboard Guru" (`fa-chart-pie`) → `/guru`, "Kelas Guru" (`fa-chalkboard-teacher`) → `/guru/kelas`, "Sumbang Soalan" (`fa-pen-fancy`) → `/guru/soalan`, "Databank Soalan" (`fa-database`) → `/guru/databank`, "Kelas Saya" (`fa-book-reader`) → `/kelas-saya` and "Set Soalan Guru" (`fa-clipboard-list`) → `/set-soalan-saya`.
- **AC-M10-01.2** Given 375px or 768px, when I open the drawer, then it shows the groups "HARIAN", "PENGAJARAN", "BANK SOALAN" and "LAIN-LAIN" with the M10 items and targets of FN-M10-1.1.2 (including "Kelas Saya" + badge "BARU" → `/kelas-saya`) and "Command Center LIVE" → `/guru/command-center`.
- **AC-M10-01.3** Given S1, S4–S16, S21–S24, S27, S28, S32–S34, when each loads, then the header title and subtitle are the live ones of FN-M10-1.1.3 (e.g. S7 "Kehadiran Digital" / "Pelajar jawab 5+ soalan = Hadir. Auto-track, zero effort."; S27 "Databank Soalan" / "21,033 soalan · 18 subjek"; S28 BM "Bahasa Melayu" / "6,048 soalan").
- **AC-M10-01.4** Given S3, S17, S18, S19, S20, S25, S26, S29, S30, S31, when each loads, then the header title is "Remedial Progress Dashboard", "Soalan Berstruktur", "Cipta Soalan Berstruktur", "Preview Soalan", "Edit Soalan Berstruktur", "Set Audio KBAT", "Cipta Set Audio KBAT", "Sumbang Artikel", "Tulis Artikel Baru", "Edit Artikel" respectively (not "Dashboard") with the subtitle "Selamat datang kembali" (DV-M10-01).

**US-M10-02 — Access and error pages**
- **AC-M10-02.1** (provisional) Given no session, when I open any M10 route, then I am sent to `/login` (INFERRED, M01 guard).
- **AC-M10-02.2** Given `/settings` or `/guru/3`, when it loads, then the standalone 404 page shows "404", "🔍", "Halaman Tidak Dijumpai", "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?", "Halaman Utama" → `/`, "Mula Latihan" → `/practice` and "PRESTASIPLUS".
- **AC-M10-02.3** Given `/guru/set-soalan/1` or `/guru/broadcast/1` opened by GET, when it loads, then the same 404 page renders (not the English "Oops! An Error Occurred" 405 page) (DV-M10-26).
- **AC-M10-02.4** Given the admin, when `/guru/kelas/2001/qr-data` is requested, then the response is 404 (class not owned); given the teacher, when `/guru/kelas/2001/edit` or `/guru/live-kelas/cipta` is opened, then the 404 page renders.

**US-M10-03 — Guide card**
- **AC-M10-03.1** Given a browser without `hideGuruGuide`, when S1 loads, then the guide shows "Mula Di Sini — 3 Langkah Mudah", its intro, steps 1–3 with the exact texts and links "Kelas Saya →" → `/guru/kelas`, "Pelajar Saya →" → `/guru/pelajar`, "Monitoring →" → `/guru/monitoring`, and the tip "Tip:" "Hover atas mana-mana menu di sidebar untuk lihat penerangan ringkas.".
- **AC-M10-03.2** Given the guide, when I press `fa-times`, then it hides, the pill "Tunjuk panduan Mula Di Sini" appears and stays after reload; when I press the pill, then the guide shows again and stays after reload.

**US-M10-04 — Checklist and counts**
- **AC-M10-04.1** Given the admin, when S1 loads, then the checklist reads "0/3 langkah selesai", "0%", rows "Kelas dah ada", "Pelajar dalam kelas", "Misi harian pertama" with their subtitles and "Lihat" links → `/guru/kelas`, `/guru/pelajar`, `/guru/misi-harian/cipta`; the stat cards read "Kelas Aktif" 0 "0 jumlah kelas", "Pelajar" 0 "Merentasi semua kelas", "Soalan" 20719 "✅ 19361 diluluskan", "Tugasan" 0 "Jumlah tugasan dibuat".
- **AC-M10-04.2** (provisional) Given the teacher, when S1 loads, then the checklist reads "3/3 langkah selesai" and "100%", and the cards read "Kelas Aktif" 2 "2 jumlah kelas", "Pelajar" 8, "Soalan" 1 "✅ 1 diluluskan", "Tugasan" 0 (default seed: the approved contribution 700302 only; after the E2E inserts the pending fixture 700301 through the M04 test hook `questions.createFixture` it reads 2 / ✅ 1; INFERRED definitions, DV-M10-12; depends on R-M04-03).

**US-M10-05 — Today panel, peer tutor, quick actions, classes, submissions**
- **AC-M10-05.1** Given the admin, when S1 loads, then "Tindakan Hari Ini" shows its h2, description, counters "Pelajar" 0 / "Topik" 0 / "Tindakan" 0, the three columns with "Top 3", "Analitik Kelas →" → `/analitik/kelas`, "Rule-based", the empty texts, and the action link "Bina aktiviti pertama untuk pelajar" + "Permulaan" + "Data tindakan akan muncul selepas pelajar mula membuat latihan." + "Buka Kelas →" → `/guru/kelas`.
- **AC-M10-05.2** Given S1, when it loads, then "PEER TUTOR MATCHING" (upper case by CSS) with "Cadangan rakan pembimbing pelajar" and both texts shows, and "Tindakan Pantas" has the four tiles with their subtitles and targets `/guru/kelas/cipta`, `/guru/soalan/cipta`, `/guru/pelajar`, `/guru/profil/edit`.
- **AC-M10-05.3** Given the admin, when S1 loads, then "Kelas Saya" shows "Semua →" → `/guru/kelas` and "Belum ada kelas. Cipta sekarang!", and "Penghantaran Terkini" shows "Belum ada penghantaran tugasan." / "Buat tugasan di kelas untuk lihat penghantaran di sini.".
- **AC-M10-05.4** (provisional) Given the teacher, when S1 loads, then "Kelas Saya" lists "5 MARIKH - Kimia · 8 pelajar" and "5 MARIKH - Sejarah · 8 pelajar" (PROPOSED layout) and "Penghantaran Terkini" still shows its empty texts.

**US-M10-06 — Command Center layout and KPIs**
- **AC-M10-06.1** Given the admin at 1280px, when S2 loads, then the tab title is "Command Center — Guru: Admin Demo", the page has no user shell, the top bar shows "← Dashboard" → `/guru`, "COMMAND CENTER", "🔬 Remedial", "📊 Rekod" → `/guru/remedial-progress`, "⚠ Evaluate", "🔮 Ramalan SPM", "👩‍🏫 Kelas", "🏆 Badges", "LIVE", a clock "HH:MM:SS" and "MYT"; the KPI tiles show "Pelajar Berdaftar" "--" "0 aktif menjawab", "Soalan Dijawab" "--" "sepanjang masa", "Ketepatan Purata" "0%" "keseluruhan sekolah", "GPS Sekolah" "4.69" "purata GPS".
- **AC-M10-06.2** Given the admin, when S2 loads, then the panels show "Tiada data" (Kelas Saya), T1 "☆☆☆☆☆ 0/10", T2 "0% ketepatan", T3 "0 aktif 30h", T4 "GPS 0", mood counts 0, the insight ""0% pelajar terlibat aktif. Ketepatan purata 0%. GPS sekolah: 4.69."", "0 soalan", "Minggu ini:" 0, "Sama dengan minggu lepas", "Tiada aktiviti terkini", "Tiada data minggu ini", "Jumlah: 0 pelajar" with the five engagement rows, and the footer text.
- **AC-M10-06.3** Given 375px, when S2 loads, then the KPI tiles and the panels are one per row and none is clipped, all six top-bar links are reachable in a horizontally scrollable row, the "LIVE" badge and the clock are visible, and the page has no horizontal scroll; given 768px, then tiles and panels are two per row, none clipped (DV-M10-17; live keeps 4 columns and clips them).
- **AC-M10-06.4** (provisional) Given the teacher, when S2 loads, then "Pelajar Berdaftar" is 8 with "0 aktif menjawab", "Soalan Dijawab" 83 (the M08 designed answers of 3001–3008: Kimia 68 + Sejarah 15), and "📚 Kelas Saya" lists "5 MARIKH - Kimia" and "5 MARIKH - Sejarah" with "tingkatan-5" and "8 plj \| {a} aktif \| {x}%" (INFERRED aggregates).
- **AC-M10-06.5** Given S2 open, when 10 s pass (mock timer), then `live-data` is requested again and the clock shows the new time each second.

**US-M10-07 — Drill-down modals**
- **AC-M10-07.1** Given the admin, when I click "Pelajar Berdaftar", then the modal shows "Memuatkan..." / "Memuatkan data..." and then the title "Pelajar Berdaftar" and "Tiada data" (DV-M10-04; live "students").
- **AC-M10-07.2** Given the admin, when I click "GPS Sekolah", T1 and "😊 Gembira", then the titles read "GPS Sekolah", "Kirkpatrick T1" and "Mood Pelajar" (DV-M10-04; live "gps", "kirk", "mood") with "Tiada data".
- **AC-M10-07.3** (provisional) Given the teacher, when I click "Pelajar Berdaftar", then the table lists the 8 students with columns Pelajar … Status and the status "Login" (none answered today; INFERRED); a row opens `/guru/command-center/student/{id}` in a new tab, which mounts the M17 v1.4 S7 student page within the teacher scope (BR-M17-30).
- **AC-M10-07.4** Given an open modal, when I press "×" or click the backdrop, then it closes.

**US-M10-08 — Class summary and prediction**
- **AC-M10-08.1** Given the admin, when I click "👩‍🏫 Kelas", then "Kelas Saya — Ringkasan Prestasi" shows "0" "Jumlah Pelajar", "0" "Aktif", "0%" "Ketepatan" and the headers # · Kelas · Tingkatan · Pelajar · Aktif · Ketepatan with no row.
- **AC-M10-08.2** Given the admin, when I click "🔮 Ramalan SPM", then "Ramalan SPM — Predictive Analytics" shows "0" "Pelajar Dianalisis", "0" "Ramalan GPS Purata", "0" "Berisiko", "Gred Terbanyak", chips A+ A A- B+ B C+ C D E G and "Tiada data mencukupi untuk ramalan".
- **AC-M10-08.3** (provisional) Given the teacher, when I click "👩‍🏫 Kelas", then the table has two rows 1–2 for classes 2001 and 2002 with "tingkatan-5", 8 members, their active count and accuracy.

**US-M10-09 — Smart Remedial**
- **AC-M10-09.1** Given the admin, when I click "🔬 Remedial", then "Smart Remedial — Scan Pelajar Lemah" shows "Mengimbas topik lemah pelajar..." and then "Tiada pelajar dengan topik lemah (<50% accuracy). Tahniah!" (DV-M10-03; live HTTP 500 and "Ralat: Unexpected token '<', "<!DOCTYPE "... is not valid JSON").
- **AC-M10-09.2** (provisional) Given the teacher, when I open Remedial, then "{n} pelajar dikesan lemah dalam topik tertentu (accuracy <50%)" and the table Pelajar · Topik Lemah · Accuracy Terendah · Tindakan show; Murid Demo 08 (open test 7601) shows "Lihat Quiz (5 soalan)" → M05 Q4 `/remedial/7601` (new tab; the read-only preview M05 v1.7 gives the test's teacher and admins) and "Batal & Jana Semula"; other weak students show "Jana Kimia".
- **AC-M10-09.3** (provisional) Given a "Jana Kimia" button, when I press it, then it reads "Menjana..." (disabled) and becomes the link "Kimia ({n})" → `/remedial/{id}`; when the mock returns an error, then the button reads the error or "Gagal".
- **AC-M10-09.4** (provisional) Given "Batal & Jana Semula" for Murid Demo 08, when I confirm "Batal set soalan remedial untuk Murid Demo 08? Anda boleh jana semula selepas ini.", then it reads "Membatal..." and then "Dibatalkan — boleh jana semula" and the quiz link is removed; on a mock failure "Gagal — cuba lagi".
- **AC-M10-09.5** Given `failNext('remedial/scan', 500)`, when I open Remedial, then the body shows "Ralat: {message}".

**US-M10-10 — Evaluate and Badges**
- **AC-M10-10.1** (provisional) Given the admin, when I click "⚠ Evaluate", then "Auto Evaluate — Penilaian Risiko Pelajar" shows "Menilai semua pelajar...", then the cards Jumlah Pelajar 0 · Berisiko 0 · Kritikal 0 · Tinggi 0 · Sederhana 0 and "Semua pelajar dalam keadaan baik! Tiada risiko dikesan.".
- **AC-M10-10.2** (provisional) Given the admin, when I click "🏆 Badges", then "Achievement System — Scan & Award Badges" shows "Mengimbas pencapaian semua pelajar..." and then the cards Pelajar 0 · Lencana Baru Dianugerah 0 · Jenis Lencana Aktif 0.
- **AC-M10-10.3** (provisional) Given the teacher, when I open Evaluate, then the table Risiko · Pelajar · Amaran · Cadangan Tindakan lists at-risk students with "KRITIKAL"/"TINGGI"/"SEDERHANA" badges; when I open Badges and click a badge chip, then "Lencana: {nama}" lists its holders or "Belum ada pelajar yang memiliki lencana ini.".

**US-M10-11 — Remedial progress**
- **AC-M10-11.1** Given the admin, when S3 loads, then 📊 "Remedial Progress Dashboard", "Jejak peningkatan pelajar melalui ujian pemulihan", the cards "JUMLAH SET" 0, "SELESAI" 0, "PELAJAR" 0, "PURATA PENINGKATAN" "+0%" and 📋 "Belum ada ujian remedial dijana. Buka Command Center → klik Remedial untuk mula." show.
- **AC-M10-11.2** (provisional) Given the teacher, when S3 loads, then the cards read 2, 1, 2, "+27%" and the list shows the two tests (PROPOSED rows).

**US-M10-12 — Class list**
- **AC-M10-12.1** Given the admin, when S4 loads, then "Kelas Saya", "0 kelas aktif", "Cipta Kelas Baru" → `/guru/kelas/cipta` and the card 🏫 "Belum Ada Kelas" / "Cipta kelas pertama anda untuk memulakan pengajaran" / "Cipta Kelas" show.
- **AC-M10-12.2** (provisional) Given the teacher, when S4 loads, then "2 kelas aktif" and two PROPOSED cards show name, subject (Kimia, Sejarah), level "Ting. 5", "8 pelajar", join code (DMO101, DMO102) and a QR button.

**US-M10-13 — Quick QR**
- **AC-M10-13.1** (provisional) Given the teacher, when I press the QR button of class 2001, then the modal shows a spinner and "-", then "5 MARIKH - Kimia", "SMK DEMO", a 192×192 QR of the join URL and "Pautan sertai:" with the URL `https://prestasiplus.my/kelas-saya?kod=DMO101` (PROPOSED, OQ-M10-04).
- **AC-M10-13.2** Given the modal, when I press the copy button, then the URL is copied and the alert "Disalin!" shows; "Cetak" calls print; "Tutup" or the backdrop closes it.

**US-M10-14 — Class form**
- **AC-M10-14.1** Given S5, when it loads, then "Kembali" → `/guru/kelas`, "Pilih Sekolah" with the search, "Maklumat Kelas" with "Nama Kumpulan *" (`required`, "cth: 5 Bestari", help "Nama kumpulan latih tubi anda."), "Subjek *" (`required`, "-- Pilih Subjek --" + 31 subjects in id order starting "Bahasa Melayu", "Bahasa Inggeris", "Matematik"), 11 level tiles "Tahun 1"…"Ting. 5", "Penerangan (pilihan)" and "Cipta Kelas" show.
- **AC-M10-14.2** Given the search, when I type "de" and wait 300 ms, then `GET /api/schools/search?q=de&limit=15` runs and each result shows the name and "{daerah}, {negeri}"; when I type "zzz", then "Tiada sekolah dijumpai" shows; when I type one character, then no request runs.
- **AC-M10-14.3** Given I choose an `SK` school, when the tiles render, then only "Tahun 1"…"Tahun 6" show; given an `SMK` school, then only "Ting. 1"…"Ting. 5"; when I clear the school, then all 11 show.
- **AC-M10-14.4** Given the level radios, when the form is inspected, then no level radio carries `required` (DV-M10-22) and "Auto dari kelas sekolah" is never visible.

**US-M10-15 — Create class**
- **AC-M10-15.1** Given S5 with an empty name or no subject, when I press "Cipta Kelas", then the browser's native required message blocks it and no request is sent.
- **AC-M10-15.2** Given the teacher (who owns 2 classes) chooses a school found by the search (an SMK of the dataset — SMK DEMO 900001 is excluded from the search, M02 v1.21; v1.16), enters "5 Bestari", Kimia, "Ting. 5", when I press "Cipta Kelas", then I return to `/guru/kelas`, the page reads "3 kelas aktif" and the new class has a unique 6-character upper-case join code (INFERRED; provisional).

**US-M10-16 — Students**
- **AC-M10-16.1** Given the admin, when S6 loads, then "0" / "Pelajar dalam kelas saya", "Cipta Pelajar" → `/guru/pelajar/cipta`, tabs "Pelajar Sekolah" and "Pelajar Saya" + "0" (active), and "Belum ada pelajar dalam kelas anda" / "Buat kelas dan tambah pelajar dari senarai sekolah." / "Cipta Kelas" → `/guru/kelas/cipta` show; following "Cipta Pelajar" lands on `/guru/pelajar` with no message (DV-M10-07).
- **AC-M10-16.2** Given the admin, when I open "Pelajar Sekolah", then "Tambah pelajar ke:" with only "-- Pilih kelas --", "Sekolah belum ditetapkan", "Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah." and "Tetapan Profil" → `/guru/profil/edit` show.
- **AC-M10-16.3** Given 375px, when S6 loads, then the link label is "Cipta".
- **AC-M10-16.4** (provisional) Given the teacher, when S6 loads, then the counter and the badge read 8, "Pelajar Saya" lists Murid Demo 01–08 (PROPOSED rows) and "Pelajar Sekolah" shows the select with the two classes and the SMK DEMO student list (PROPOSED); adding the student (id 2) to class 2002 at runtime makes the counter 9.

**US-M10-17 — Join a class**
- **AC-M10-17.1** Given S33, when it loads, then "Masukkan Kod Kelas", the field `class_code` (`required`, `maxlength=6`, "cth: MAT5B2"), "Sertai" and 📚 "Belum Sertai Mana-Mana Kelas" / "Minta kod kelas daripada guru anda dan masukkan di atas" show; typing 7 characters keeps 6.
- **AC-M10-17.2** (provisional) Given the new student, when I enter "DMO101" and press "Sertai", then I am enrolled in class 2001 and the page lists the class (PROPOSED card) instead of the empty state.
- **AC-M10-17.3** (provisional) Given an unknown code "ZZZ999", when I press "Sertai", then no enrolment happens and the page stays with a refusal message (UNVERIFIED COPY).
- **AC-M10-17.4** (provisional; v1.16, SRS SEC-M10-02) Given a logged-in user whose role is neither student nor admin (e.g. a teacher), when `POST /api/kelas-saya/join` is called, then the response is 403 and no enrolment happens.

**US-M10-18 — Attendance**
- **AC-M10-18.1** Given the admin, when S7 loads, then "Tarikh" = 2026-09-25 (max 2026-09-25), "Semak", the cards "Jumlah Pelajar" 137, "Hadir" 0, "Tidak Hadir" 137, "% Kehadiran" "0%", the trend columns "Sab", "Ahd", "Isn", "Sel", "Rab", "Kha", "Jum" each "0%", "Senarai Pelajar — 25/09/2026" with 137 rows all "Tidak Hadir" and "Masa Aktif" "-", and the footnote show (population = R-M02-01 selection).
- **AC-M10-18.2** Given `?date=2026-09-01`, when the page loads, then the heading reads "Senarai Pelajar — 01/09/2026" and the date field shows 2026-09-01.
- **AC-M10-18.3** Given any list, when it renders, then every level cell reads "Tingkatan 4" or "Tingkatan 5" (never "T4"/"T5") and each level appears as one group, names A→Z inside it — for the admin 14 "Tingkatan 4" rows then 123 "Tingkatan 5" rows (DV-M10-13; live 12 "T4", 15 "T5", 2 "Tingkatan 4", 108 "Tingkatan 5").
- **AC-M10-18.4** (provisional) Given the teacher, when S7 loads, then the cards read 8 / 0 / 8 / "0%", every row reads "Tidak Hadir" with "-", and the trend reads 0%, 0%, 0%, 50%, 0%, 0%, 0% (Sab → Jum; 22/09 = Murid Demo 05–08 with 8 answers each; 24/09 answers of 3001, 3002, 3007 are 1–2 each, below 5).
- **AC-M10-18.5** (provisional) Given the teacher and `?date=2026-09-22`, when the page loads, then "Hadir" is 4, "Tidak Hadir" 4, "% Kehadiran" "50%", and the rows of Murid Demo 05–08 read "Hadir" with 8 questions; `?date=2026-09-18` gives "Hadir" 3 (Murid Demo 01–03, 5 Sejarah answers each).
- **AC-M10-18.6** Given 375px, when S7 loads, then the table scrolls inside its card and the page has no horizontal scroll.

**US-M10-19 — Timetable**
- **AC-M10-19.1** Given S8, when it loads, then "Tambah Jadual" shows "Hari" (Isnin … Ahad, default Isnin, `required`), "Subjek" (31 subjects A→Z starting "Bahasa Arab", no placeholder, `required`), "Topik Fokus (opsional)" ("cth: Bab 3 Algebra") and "Tambah"; seven day cards Isnin … Ahad; the Jumaat card has "HARI INI"; the admin's cards all read "Tiada jadual ditetapkan".
- **AC-M10-19.2** (provisional) Given the teacher, when S8 loads, then Isnin shows "Kimia" with "Bab 5 Elektrokimia" and Jumaat shows "Bahasa Melayu" (PROPOSED layout); the other days read "Tiada jadual ditetapkan".
- **AC-M10-19.3** (provisional) Given the teacher adds Rabu, Sejarah, "Bab 1", when "Tambah" is pressed, then the Rabu card lists it; when its delete control is used, then Rabu reads "Tiada jadual ditetapkan" again.

**US-M10-20 — Broadcast**
- **AC-M10-20.1** Given S9, when it loads, then "Hantar Mesej Baru", the textarea ("Tulis mesej ringkas untuk pelajar...", `required`, `maxlength=500`), "Biasa" (checked) and "Penting" radios and "Hantar" show; the admin's history reads "Tiada mesej dihantar lagi.".
- **AC-M10-20.2** Given an empty message, when I press "Hantar", then the native required message blocks it; when I type 501 characters, then the field holds 500.
- **AC-M10-20.3** (provisional) Given the teacher, when S9 loads, then the history lists "Kelas tambahan Kimia pada hari Sabtu, 26/09, jam 9 pagi." (Penting) before "Jangan lupa siapkan misi harian." (Biasa); when the teacher sends "Ujian bulanan minggu depan." as Penting, then it appears first.

**US-M10-21 — Live class**
- **AC-M10-21.1** Given the admin, when S10 loads, then "0" "pelajar sedang aktif", "Dikemas kini: {HH:MM:SS} · Auto-muat semula setiap 30 saat", a countdown from "30s", "Muat Semula", "Tiada pelajar sedang aktif menjawab soalan sekarang" / "Halaman ini akan dikemas kini secara automatik apabila pelajar mula menjawab soalan.", "Pejuang Minggu Ini" / "Tiada data minggu ini", "Streak Champions" / "Tiada streak aktif", "Most Improved" / "Perlu data 2 minggu untuk perbandingan" show.
- **AC-M10-21.2** Given S10, when the countdown reaches 0 or I press "Muat Semula", then `GET /guru/live-kelas` (JSON) runs, the time updates and the countdown restarts at 30.
- **AC-M10-21.3** Given `failNext('live-kelas', 'network')`, when a refresh runs, then "Gagal mendapatkan data. Periksa sambungan internet anda." shows.
- **AC-M10-21.4** (provisional) Given the teacher and a mock session of the student in progress, when S10 refreshes, then a card with "LANGSUNG", "Kuiz", "Masa", "Markah" and the activity label shows and the count reads 1.

**US-M10-22 — Mission list**
- **AC-M10-22.1** Given the admin, when S11 loads, then "Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A.", "Misi Baru" → cipta and "Belum ada misi" / "Cipta misi harian pertama untuk pelajar anda." / "Cipta Misi" show.
- **AC-M10-22.2** (provisional) Given the teacher, when S11 loads, then two rows show "Misi Harian 24/09/2026" (Tracking A, Bahasa Melayu) and "Misi Harian 22/09/2026" (Latih Tubi SPM, Kimia) with "10 soalan" (PROPOSED layout).

**US-M10-23 — Launch a mission**
- **AC-M10-23.1** Given S12 on 2026-09-25, when it loads, then "Nama Misi" = "Misi Harian 25/09/2026" (`required`), "Jenis Misi" options "Latih Tubi SPM" (selected), "Tracking A", "Soalan & Rujukan (YouTube/Anyflip/Rujukan)", "Tarikh Misi" = 2026-09-25, "Subjek" "Pilih Subjek" + 20 subjects A→Z, "Bab (Opsional)" "Semua Bab", "Bilangan Soalan" 10 (min 5, max 50) + "5 hingga 50 soalan", the reward box "3 syiling" "per soalan betul" / "Auto-kira berdasarkan bilangan soalan betul. Tiada tetapan manual.", the reference fields, "Kembali" → `/guru/misi-harian` and "Lancarkan Misi" show; there is no class or student selector.
- **AC-M10-23.2** Given I choose "Bahasa Melayu", when the chapter list opens, then only Bahasa Melayu chapters and "Semua Bab" are visible and the value is "Semua Bab".
- **AC-M10-23.3** (provisional) Given I choose "Soalan & Rujukan (YouTube/Anyflip/Rujukan)", when the change fires, then "Soalan Ciptaan Guru", the text with the link "Soalan Saya" → `/guru/soalan-guru` and the alert show; choosing "Latih Tubi SPM" or "Tracking A" hides them; the hidden `mission_source` stays `bank_soalan` throughout (DV-M10-02).
- **AC-M10-23.4** Given "Bilangan Soalan" 4 or 51, when I press "Lancarkan Misi", then the native range message blocks it.
- **AC-M10-23.5** (provisional) Given the new student has joined "DMO101" on S33 at runtime and the teacher submits Latih Tubi SPM, Kimia, 10 questions for 2026-09-25, when "Lancarkan Misi" is pressed, then S11 lists the mission first and the new student's `/misi-harian` lists it (M05 owns that page and `/api/missions/today`; card UNVERIFIED).

**US-M10-24 — Question sets**
- **AC-M10-24.1** Given the admin, when S13 loads, then "Set Soalan Anda", "0 set dicipta", "Cipta Set Baharu" and "Belum Ada Set Soalan" / "Cipta set soalan pertama anda untuk kelas." / "Cipta Set Pertama" show.
- **AC-M10-24.2** Given S14, when it loads, then "Kembali ke Senarai", cards 1 "Maklumat Asas" ("Kelas *" `required` with only "-- Pilih Kelas --" for the admin, "Tajuk Set *", "Penerangan", "Kumpulan Set (untuk TOV/AR tracking)" + the TOV/AR note), 2 "Tetapan" ("Had Masa (minit)" 1–360 "Tiada had" + "Kosongkan = tiada had masa", "Had Percubaan" 0–99 + "0 = tiada had (boleh ulang)"), 3 "Status Penerbitan" with "Draf" selected, and "Cipta Set & Tambah Soalan" show.
- **AC-M10-24.3** Given I choose "Jadual", when it is selected, then "Tarikh & Masa Terbit" (datetime-local) shows; choosing "Draf" or "Terbit" hides it.
- **AC-M10-24.4** (provisional) Given the teacher, when S14 loads, then "Kelas *" lists the two classes; when the teacher submits class 2001, "Set Ujian Kimia", "Terbit", then the PROPOSED question picker opens for the new set.
- **AC-M10-24.5** (provisional) Given the teacher, when S13 loads, then "2 set dicipta" and the rows "Latih Tubi Kimia Sep 2026 - Set 1" (5 MARIKH - Kimia, Draf) and "Sejarah Bab 1 - Set 1" (5 MARIKH - Sejarah, Terbit, 10 soalan) show.

**US-M10-25 — Soalan & Rujukan list**
- **AC-M10-25.1** Given the admin, when S15 loads, then the info bar, "Cara Soalan & Rujukan" steps 1–3 (step 3 text "Pilih "Soalan & Rujukan (YouTube/Anyflip/Rujukan)" di Misi Harian.", DV-M10-23), "0 soalan dicipta", "Soalan & Rujukan Baru" → cipta and "Belum ada soalan" / "Cipta soalan MCQ peribadi dengan bahan rujukan untuk pelajar anda." show.
- **AC-M10-25.2** (provisional) Given the teacher has created two MCQs on S16 with the reference "Video Bab 1 Kimia" (runtime; M04 rows `pending_review`), when S15 loads, then "2 soalan dicipta" and two PROPOSED rows of that reference show.

**US-M10-26 — Create Soalan & Rujukan**
- **AC-M10-26.1** Given S16, when it loads, then the guide is open with its full content; when I press "Sembunyikan Panduan", then it collapses and the toggle reads "Baca Panduan Dulu!"; after reload it is open again.
- **AC-M10-26.2** Given "Link Rujukan", when I enter `https://www.youtube.com/watch?v=abc123`, `https://anyflip.com/abcd/efgh`, `https://www.canva.com/design/abc123/view` or `https://example.com/rujukan.pdf`, then the YouTube, Anyflip or Canva chip, or "Link rujukan:" + the link + the click-to-open note, shows respectively.
- **AC-M10-26.3** Given no subject or level, when the page loads, then the Bab/Topik add buttons are disabled; given Bahasa Melayu + Tingkatan 5, then "Bab" lists "Bab 99: Kemahiran Bahasa Tingkatan 5"; given I open "Bab Baru", type "12" and "Bab Ujian", press "Batal" and reopen, then the values are still there.
- **AC-M10-26.4** Given the admin, when S16 loads, then "Kelas Sasaran" reads "Tiada kelas ditemui." with "Cipta kelas dahulu" → `/guru/kelas/cipta`; (provisional) given the teacher, then two class checkboxes show.
- **AC-M10-26.5** Given one question, when I press "Tambah Soalan", then "Soalan 2" appears with its own fields, the counter reads "2 soalan" and each question has a delete button; deleting one returns to "1 soalan" with no delete button.
- **AC-M10-26.6** (provisional) Given the teacher completes the form for class 2001 and presses "Simpan Soalan", then S15 reads "3 soalan dicipta".

**US-M10-27 — Student set list**
- **AC-M10-27.1** Given the admin, when S34 loads, then "Tiada Set Soalan" / "Guru anda belum sediakan set soalan untuk anda." shows.
- **AC-M10-27.2** (provisional) Given the new student joins "DMO102" on S33 at runtime, when S34 loads, then "Sejarah Bab 1 - Set 1" by "Guru Demo" with "10 soalan" shows (PROPOSED row); the draft set 7401 of class 2001 does not.

**US-M10-28 — Structured list**
- **AC-M10-28.1** Given the admin, when S17 loads, then h1, subtitle, "Cipta Soalan" (cyan-600) → cipta, the filters ("Semua" + 31 subjects; "Semua" + 11 levels; "Semua"/"Draf"/"Diterbitkan"), "Tapis", and the first row id 4454 (Perniagaan, KBAT "MOTS 3", 1 sub, "8m", "Public", "Terbit", eye → `/guru/soalan-berstruktur/4454`, edit → `/4454/edit`) show; the headers are upper case by CSS.
- **AC-M10-28.2** Given the admin, when S17 loads, then the pager reads "Showing 1 to 20 of {N} results" with N = M04 Q-STRUCT-ALL (4,064 in the M04 dataset; live 4,061 at the M10 capture — data drift, the one dataset value applies) and links to the last two pages; given `?subject_id=5`, then the page-2 link is `?subject_id=5&page=2`.
- **AC-M10-28.3** Given the admin and `?status=draft`, when the page loads, then "Tiada soalan berstruktur lagi" and "Cipta soalan pertama" → cipta show.
- **AC-M10-28.4** Given 375px, when S17 loads, then only "« Previous" / "Next »" show and the table scrolls inside its card.
- **AC-M10-28.5** (provisional) Given the teacher's draft created in a test, when I press its toggle, then the row reads "Terbit".

**US-M10-29 — Structured authoring**
- **AC-M10-29.1** Given S18, when it loads, then "Subjek *", "Tingkatan *", "Aras KBAT *" (6 options "1. Mengingat (LOTS)" … "6. Mencipta (HOTS)", default 1), "Jenis Tulisan" (4), "Template" ("Tiada (manual)", "Eksperimen Sains"), "Visibility *" with the single "Public" choice checked, the stimulus, the image input, "Sub-Soalan" with "Jumlah markah: 1m", one sub "(a)" and "Tambah Sub" show.
- **AC-M10-29.2** Given Sains + Tingkatan 5, when both are chosen, then "Bab" lists 9 chapters starting "Bab 1: Dunia mikroorganisma" and "Bidang / Tema" lists 10 entries starting "T5-SUB4-TEXTBOOK — Sains T5 - Sokongan Bab Buku Teks".
- **AC-M10-29.3** Given "Jawi" or "Arab", when chosen, then `text_direction` = `rtl`; "Rumi (Latin)" or "Campuran" → `ltr`.
- **AC-M10-29.4** Given "Eksperimen Sains", when chosen, then seven subs (a), (bi), (bii), (biii), (c), (d), (e) with the fixed texts, marks 1, 1, 1, 1, 2, 3, 1, rubric codes F / F / F / F / F,F / P,P,P / J and "Jumlah markah: 10m" show.
- **AC-M10-29.5** Given one sub, when I press "Tambah Sub", then "(b)" appears and the total becomes "2m"; choosing "Numerik" shows "Jawapan Tepat" and "Toleransi (±)"; pressing the rubric "Tambah" of a sub whose row is F adds P.
- **AC-M10-29.6** Given the stimulus, when I press "Simbol & Aksara Khas", then 72 symbols in the groups Asas, Kuasa, Subskrip, Matematik, Anak Panah, Greek, Umum show and the toggle reads "Tutup Simbol"; clicking "π" inserts it at the cursor.
- **AC-M10-29.7** Given 375px with a rubric row, when S18 renders, then the remove button is visible and the page has no horizontal scroll (DV-M10-20).

**US-M10-30 — Inline curriculum/DSKP and save**
- **AC-M10-30.1** Given Sains + Tingkatan 5 and "Bab Baru" with "10" and "Bab Ujian", when I press "Simpan", then "Bab 10: Bab Ujian" is added, selected and its (empty) topic list loaded; with the name empty, nothing happens.
- **AC-M10-30.2** Given a chosen SK, when I add SP "9.1.2" / "Contoh SP", then it is added and selected in "Standard Pembelajaran (SP)".
- **AC-M10-30.3** Given `failNext('chapters POST', 'network')`, when I save a new chapter on S18, then `alert("Gagal menambah bab.")` shows; given a server `{error:"…"}`, then that text is alerted.
- **AC-M10-30.4** (provisional) Given the teacher completes a valid question, when "Simpan Draf" is pressed, then S17 lists it as "Draf"; with "Simpan & Terbitkan", as "Terbit".

**US-M10-31 — Preview**
- **AC-M10-31.1** Given `/guru/soalan-berstruktur/4454`, when it loads, then "Preview Soalan", "Perniagaan · Tingkatan 5 · Merancang Pengendalian Perniagaan", "Public", "Terbit", "Edit" → `/4454/edit`, "KBAT 3: Mengaplikasi (MOTS)", "8 markah", "1 sub-soalan", "Eksperimen", the stimulus, "(a)", "[8 markah]", "Text", "Jalan Kerja:" + model answer and "Dicipta oleh {nama} · 20 May 2026, 14:13" show.

**US-M10-32 — Edit structured**
- **AC-M10-32.1** Given `/guru/soalan-berstruktur/4454/edit`, when it loads, then "Edit Soalan Berstruktur", "Perniagaan · Tingkatan 5", Subjek "Perniagaan", Tingkatan "Tingkatan 5", KBAT "3. Mengaplikasi (MOTS)", Bab "Bab 7: Merancang Pengendalian Perniagaan" selected (DV-M10-05), "Rumi (Latin)", Template "Tiada", "Jumlah markah: 8m" and sub (a) with 8 marks show.
- **AC-M10-32.2** Given S20, when it loads, then there is no DSKP section, the sub has no symbol palette and "Markah" has no `required`.
- **AC-M10-32.3** Given S20, when "Padam" is pressed, then the confirm "Padam soalan ini?" shows (DV-M10-29; live deletes without it); cancelling keeps the question and stays on S20. (provisional) Given the teacher's own question, when "Simpan & Terbitkan" is pressed, then S17 shows it "Terbit"; when "Padam" is confirmed, then it is removed.

**US-M10-33 — Contribution stats**
- **AC-M10-33.1** Given the admin, when S21 loads, then "📝 Jumlah" 16817, "✅ Diluluskan" 16817, "⏳ Menunggu" 0, "📊 Digunakan" 0, the info text, the 8 tiers with the first seven highlighted, and "Sasaran seterusnya: Legenda Terulung — 50,000 soalan" show (depends on R-M04-01).
- **AC-M10-33.2** Given the admin, when S21 loads, then "Pecahan Subjek" reads, in order, "Matematik — 3,287", "Pendidikan Islam — 2,516", "Bahasa Melayu — 2,342", "Bahasa Inggeris — 2,214", "Sains — 1,935", "Pendidikan Moral — 1,823", "Sejarah — 795", "Lain — 763", "Pendidikan Seni Visual — 510", "Pendidikan Syariah Islamiah — 363", "Geografi — 269" (count order, DV-M10-14).
- **AC-M10-33.3** (provisional) Given the teacher, when S21 loads (depends on R-M04-03), then 1 / 1 / 0 / 0, no tier highlighted, "Sasaran seterusnya: Penyumbang Baru — 10 soalan" and the chip "Bahasa Melayu — 1" show; after the E2E inserts fixture 700301 (Kimia T5 MCQ, `pending_review`, active, `createdBy` 5) through `questions.createFixture`, S21 reads 2 / 1 / 1 / 0 with the chips "Bahasa Melayu — 1", "Kimia — 1".

**US-M10-34 — Import, Audio KBAT links, AI card**
- **AC-M10-34.1** Given S21, when I press "Template", then the M04 import template `template-import-soalan.csv` downloads with the header of M04 AC-M04-13.6 (DV-M10-08).
- **AC-M10-34.2** Given S21, when I press "Import CSV", then the form ("Pilih Fail CSV" `required`, `.csv,.txt`, "Import", "Panduan:" with its four lines) shows; pressing it again hides it.
- **AC-M10-34.3** (provisional) Given the teacher uploads a CSV with one valid and one invalid row, when "Import" is pressed, then the valid row is stored as pending ("⏳ Menunggu" +1) and the invalid row is reported (UNVERIFIED COPY).
- **AC-M10-34.4** Given S21, when it loads, then "Template XLSX" → `/guru/audio-kbat/template`, "Template Word" → `/guru/audio-kbat/template-word`, "Cipta Set" → `/guru/audio-kbat/create`, "Senarai Set" → `/guru/audio-kbat`, and the "AI Auto-Generate Soalan" card has no link, button or form. **(v1.16, DV-M10-32)** Both template links answer 200 (SERVER): "Template XLSX" downloads `template-audio-kbat.csv` (BOM, header `tajuk,kod_subjek,kod_tingkatan,nama_fail_audio`, one example row) and "Template Word" downloads `template-audio-kbat.docx` (a valid Word document with a table of the same 4 headings).

**US-M10-35 — My questions list**
- **AC-M10-35.1** Given the admin, when S21 loads, then "Soalan Saya", "Tambah Soalan" → `/guru/soalan/cipta` and 20 cards starting #522425 "Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca?" with chips "Bahasa Melayu", "Darjah 6", "Sukar", "DSKP", "Diluluskan" and "02 May 2026" show.
- **AC-M10-35.2** Given the first card, when I click it, then it opens with the question, "A." … "D." with the correct option highlighted, "Penjelasan" + text, "#522425", "textbook_content_rebuild", "Aktif", "Edit" → `/guru/soalan/522425/edit` and "Padam"; clicking again closes it.
- **AC-M10-35.3** Given "Padam" on #522425, when pressed, then the confirm "Padam soalan #522425? Tindakan ini tidak boleh dibatalkan." shows; cancelling keeps the card; (provisional) confirming on the teacher's #700302 removes it.
- **AC-M10-35.4** Given the admin, when S21 loads, then the pager reads "Showing 1 to 20 of 16817 results" with links 1–10, "...", 840, 841 and "Next »"; page 2 starts with #522445 (depends on R-M04-01).

**US-M10-36 — Question papers**
- **AC-M10-36.1** Given S21, when it loads, then "Hantar Kertas Soalan kepada Admin" shows its accepted types, file conditions, steps and form fields with the options, limits and placeholders of FN-M10-7.1.11.
- **AC-M10-36.2** Given I choose two files, when the input changes, then the list shows each file's icon (`fa-file-pdf` / `fa-file-word` / `fa-file-excel`), name and "{x.xx} MB".
- **AC-M10-36.3** (provisional) Given the teacher submits "Trial Paper", "Kimia", Tingkatan 5, 2025 with one PDF, when "Hantar kepada Admin" is pressed, then M04 S10 lists a "Pending" paper from Guru Demo.
- **AC-M10-36.4** (provisional; v1.16, UNVERIFIED COPY) Given the same form with "Tahun" left empty, when submitted, then the paper is stored with the mock clock's year (INFERRED) and the page shows "Kertas soalan berjaya dihantar kepada admin."; on failure "Gagal menghantar kertas soalan."; given a teacher with no contributions, S21 shows "Belum ada soalan."

**US-M10-37 — Contribute a question**
- **AC-M10-37.1** Given S22, when it loads, then the fields of FN-M10-7.2.1–7.2.5 and 7.2.12 show, "Tahap Kesukaran *" lists "-- Pilih Tahap --", "Mudah", "Sederhana", "Sukar", and "Jenis Soalan *" defaults to "Aneka Pilihan (MCQ)" with the MCQ block.
- **AC-M10-37.2** Given "Jenis Soalan", when I choose Betul / Salah, Jawapan Pendek, Isi Tempat Kosong or Esei, then only the matching answer block shows (FN-M10-7.2.9–7.2.11).
- **AC-M10-37.3** Given "Jenis Tulisan" = "Arab", when chosen, then the question field is RTL with "اكتب السؤال هنا..." and the preview "(Tiada teks lagi)"; pressing the keyboard button opens "Papan Kekunci Arab" (a bottom sheet at 375px) and pressing "ب" inserts it; "جاوي" switches to the Jawi layout.
- **AC-M10-37.4** Given "Galeri Rajah", when pressed, then the modal shows "Tiada galeri rajah tersedia" and "Sila muat naik imej secara manual menggunakan butang "Muat Naik"" (DV-M10-09).
- **AC-M10-37.5** Given S22, when "Batal" is pressed, then I return to `/guru/soalan` without saving; at 375px the page has no horizontal scroll (DV-M10-21).
- **AC-M10-37.6** (provisional) Given the teacher sends a valid MCQ, when "Hantar untuk Semakan" is pressed, then S21 reads "⏳ Menunggu" 1 and the question is pending (and active) in M04 S1.

**US-M10-38 — Question detail**
- **AC-M10-38.1** Given `/guru/soalan/522425`, when it loads, then "Kembali", "Edit Soalan", chips "Bahasa Melayu", "textbook_content_rebuild", "Tahap 4", "mcq", the question, "A)" … "D)", "Penerangan" and "Statistik" "0" "Kali Digunakan", "0" "Jawab Betul", "0%" "Ketepatan" show.

**US-M10-39 — Edit a question**
- **AC-M10-39.1** Given `/guru/soalan/522425/edit`, when it loads, then "Sumber Asal" "textbook_content_rebuild", the question text, "Tahap Kesukaran" with "Sukar" selected (DV-M10-15), four options with the correct one checked, "Penerangan (optional)", "Simpan Perubahan" and "Batal" → `/guru/soalan/522425` show.
- **AC-M10-39.2** (provisional) Given a question the teacher created at runtime on S22, when the explanation is changed and "Simpan Perubahan" pressed, then the detail page shows the new explanation and the difficulty is unchanged.

**US-M10-40 — Audio KBAT**
- **AC-M10-40.1** Given S25, when it loads, then "Ujian Mendengar", "Set Audio KBAT", the subtitle, the two templates and "Cipta Set", the guide, "Set" 0, "Approved" 0, "Draft/Pending" 0, "Soalan" 0, the filter (options of FN-M10-7.5.4) and "Belum ada set Audio KBAT." show.
- **AC-M10-40.2** Given S26, when it loads, then "Maklumat Set" fields, four section cards with the ranges 1-8, 9-16, 17-24, 25-30, 30 question blocks each with "KBAT Audio" and the required text/options/answer, and "Simpan Set Audio KBAT" show.
- **AC-M10-40.3** (provisional) Given the teacher submits a complete set, when saved, then S25 reads "Set" 1, "Draft/Pending" 1, "Soalan" 30 and lists the set as "Pending Review".

**US-M10-41 — Databank**
- **AC-M10-41.1** Given S27, when it loads, then the white h1 "Databank Soalan SPM" (DV-M10-25), the subtitle, "21,033" "Jumlah Soalan", "18" "Subjek Aktif", the tip, "Subjek Teras (7)" and "Subjek Elektif (18)" with the 25 cards and counts of discovery A.4 show, and every icon tile shows a glyph.
- **AC-M10-41.2** Given the "Pendidikan Jasmani & Kesihatan" card "0 soalan", when clicked, then `/guru/databank/PJK` opens.

**US-M10-42 — Subject databank**
- **AC-M10-42.1** Given `/guru/databank/BM`, when it loads, then "Databank" → `/guru/databank` / "Bahasa Melayu", h1 "Bahasa Melayu", "Malay Language", "6,048 Jumlah", "5,918 Objektif", "105 Subjektif" (depends on R-M04-02), the filter with the options of FN-M10-8.2.2 and "Bidang" = "Semua Bidang" + 10 entries starting "1.0 — Kemahiran Mendengar dan Bertutur" show.
- **AC-M10-42.2** Given the list, when it loads, then 15 cards start with "ID Soalan: 525433" ("Tahap 1", "chapter_textbook_rebuild", "Objektif", "Bahasa Melayu T1 - Sokongan Bab Buku Teks", "Tingkatan 1") and the pager reads "Showing 1 to 15 of 6048 results" with 403 and 404; pressing "Penerangan" reveals "Jawapan tepat: menilai maklumat dan menyokong jawapan dengan bukti. …".
- **AC-M10-42.3** Given `?question_type=mcq&difficulty=3`, when it loads, then the first cards are "Tahap 3" Tingkatan 3 questions of "Bahasa Melayu T3 - Sokongan Tema Buku Teks", the last page link is 64 (depends on R-M04-02), page links keep `question_type=mcq&difficulty=3`, and "Reset" → `/guru/databank/BM` shows.
- **AC-M10-42.4** Given Bidang "1.0 — Kemahiran Mendengar dan Bertutur", when chosen, then "Standard Kandungan" lists "Semua SK" + 8 SK starting "1.1 — Mendengar, mengenal dan menyebut".

**US-M10-43 — Report a problem**
- **AC-M10-43.1** Given card #525433, when I press "Lapor Masalah", then "Lapor Masalah Soalan", "Soalan #525433", the 8 reasons, "Komen (pilihan)" (500, "Jelaskan masalah secara ringkas..."), "Hantar Laporan" (disabled) and "Batal" show.
- **AC-M10-43.2** Given a ticked reason and a comment, when I press "Batal" and reopen the modal (same or another question), then no reason is ticked and the comment is empty.
- **AC-M10-43.3** (provisional) Given "Soalan mengelirukan" ticked, when I press "Hantar Laporan", then it reads "Menghantar...", the modal closes, a toast shows the response message for 4 s, the card shows "Sudah Dilaporkan", and M04 S7 lists a pending report with source `teacher_databank`.
- **AC-M10-43.4** (provisional) Given `failNext('question-reports', 'network')`, when I submit, then the toast reads "Ralat rangkaian. Sila cuba lagi." and the modal stays open.

**US-M10-44 — Article list**
- **AC-M10-44.1** Given the admin, when S29 loads, then "Sumbang Artikel", its subtitle, "Tulis Artikel Baru" → cipta, "36" "Jumlah Artikel", "36" "Diterbitkan", "0" "Menunggu Semakan", "12,270" "Jumlah Pembaca", and the first rows "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" (Diterbitkan, Tips Belajar, "22 Feb 2026", "596 pembaca", excerpt, → `/artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit`, edit → `/guru/artikel/10/edit`), "Belajar Bahasa Melayu: Teknik KWLH untuk Pemahaman" (448), "Cara Buat Jadual Belajar yang Realistik" (430) show, with no delete button.
- **AC-M10-44.2** Given page 2, when it loads, then its first rows are "Cara Hadapi Tekanan Peperiksaan" (Motivasi), "Memilih Tuisyen yang Tepat untuk Anak" (Panduan Ibu Bapa), "Teknik Pengajaran Aktif untuk Kelas Matematik" (Panduan Guru), and the pager reads "Showing 16 to 30 of 36 results".

**US-M10-45 — Write an article**
- **AC-M10-45.1** Given S30, when it loads, then the fields, texts, chips, drop zones, options ("Pilih..." + 7 categories; "Pilih..." + "Semua Darjah" + Darjah 1–6), the tips, "Hantar Artikel" and "Akan disemak admin sebelum diterbitkan" of FN-M10-9.2.1–9.2.8 show.
- **AC-M10-45.2** Given attachments, when I add a sixth file, a video, a 21 MB PDF or a `.zip`, then the alerts "Maksimum 5 fail sahaja.", "Muat naik video tidak dibenarkan di PRESTASIPLUS.\nSila gunakan pautan YouTube sahaja untuk berkongsi video.", "Fail "{nama}" terlalu besar. Maks 20MB." and "Fail "{nama}" tidak disokong. Format yang dibenarkan: PDF, Word, Excel, PowerPoint" show respectively and the file is not added.
- **AC-M10-45.3** (provisional) Given the teacher submits a valid article, when "Hantar Artikel" is pressed, then S29 reads "Menunggu Semakan" 1 and lists it, and it is not on `/artikel` (M09) until approved.

**US-M10-46 — Edit an article**
- **AC-M10-46.1** Given `/guru/artikel/10/edit`, when it loads, then "Edit Artikel", "Kemaskini artikel anda", "Diterbitkan", the title, the editor with "Apa Itu Teknik Pomodoro?" … "Tips Tambahan", "Kategori *" = "Tips Belajar" and "Tahap *" = "Darjah 4" (no "Pilih..." option), "Tambah Lampiran Baru", "Kemaskini Artikel" and "Batal" → `/guru/artikel` show.

**US-M10-47 — Teacher profile**
- **AC-M10-47.1** Given the admin, when S32 loads, then the fields of FN-M10-10.1.2–10.1.4 with their limits and placeholders, the empty school search, "Profil Awam Anda" with `https://prestasiplus.my/guru/3`, "Salin Link", "Lihat" → `/guru/3`, "Kembali" → `/guru` and "Simpan Profil" show; following "Lihat" shows the 404 page (DV-M10-06).
- **AC-M10-47.2** Given the school search, when I type "de", then results show "{nama}" and "{daerah}, {negeri}"; choosing one shows it as the selected school with a clear button.
- **AC-M10-47.3** Given "Salin Link", when pressed, then the URL is on the clipboard and the button shows its copied state.
- **AC-M10-47.4** (provisional) Given the teacher changes "Subjek Utama" and presses "Simpan Profil", then the page reloads with the new value.

**US-M10-48 — Responsive and readable**
- **AC-M10-48.1** Given each of S1–S34 at 375, 768 and 1280px, when it loads (and, on S12, S16, S18, S20 and S22, with every optional section shown), then `document.documentElement.scrollWidth` ≤ the viewport width (DV-M10-17…21).
- **AC-M10-48.2** Given S1, S2, S7 and S21 at every width, when they render (S2 with a modal open), then no text inside `main` (S2: the page body) is smaller than 12px; only font sizes change (DV-M10-28).
- **AC-M10-48.3** Given 375px, when S5, S12, S14, S16, S18, S22, S30 and S32 load, then their form fields stack in one column; form footers follow FN (S12, S16, S22 on one row; S18/S20 buttons full width).

---

## 5. UI expectations

| Screen | Key states (screenshots in `docs/discovery/img/M10/`) | Behaviour notes |
|---|---|---|
| S1 | admin (`guru-dashboard-desktop/-tablet/-mobile.png`); guide hidden | Stat cards 4-up at 1280, 2-up at 375; "Tindakan Hari Ini" columns stack below 1024px. Populated panels PROPOSED/UNVERIFIED. |
| S2 | default, drill modal, remedial error, predictive, kelas (`command-center-*.png`; audit `s2-375-nav-clipped.png`) | Own dark layout. Live keeps 4 columns at every width and clips panels, links and LIVE below 1024px; rebuild 4 → 2 → 1 columns, scrollable link row, LIVE visible (DV-M10-17). Text ≥ 12px (DV-M10-28). |
| S3 | empty (`remedial-progress-desktop.png`) | Cards 4-up → 2-up. |
| S4 | empty (`kelas-empty-*.png`), QR modal (`kelas-qr-modal.png`) | Populated cards PROPOSED. |
| S5 | form, school search (`kelas-cipta-*.png`) | Level tiles wrap; one column at 375. |
| S6 | mine tab, school tab (`pelajar-*.png`) | Tabs side by side at every width. |
| S7 | default, past date (`kehadiran-*.png`) | Table scrolls in its card at 375 (484 vs 340). |
| S8 | empty week (`jadual-belajar-*.png`) | Day cards 3/2 → 1 column. |
| S9 | empty (`broadcast-*.png`) | — |
| S10 | empty (`live-kelas-desktop.png`) | Side cards stack below 1024px. |
| S11/S12 | empty, form, YouTube type (`misi-*.png`) | S12 fits 375 (DV-M10-18); footer on one row. |
| S13/S14 | empty, scheduled (`set-*.png`) | Radio cards stack at 375. |
| S15/S16 | empty, form (`soalan-guru-*.png`) | S16 guide chips wrap (DV-M10-19). |
| S17–S20 | list, create, symbols, experiment, show, edit (`berstruktur-*.png`) | Table scrolls in card; rubric rows wrap (DV-M10-20). |
| S21–S24 | hub, create, Arabic keyboard, gallery, show, edit (`sumbang-soalan-*.png`, `soalan-*.png`) | Keyboard bottom sheet below 640px; option image buttons wrap (DV-M10-21). |
| S25/S26 | empty, create (`audio-kbat-*.png`) | — |
| S27/S28 | grids, BM list, report modal (`databank-*.png`) | Grids 3 → 1 column; modal buttons side by side at 375. |
| S29–S31 | list, create, edit (`artikel-*.png`) | — |
| S32 | form (`profil-guru-desktop.png`) | — |
| S33/S34 | student pages (`kelas-saya-*.png`, `set-soalan-saya-student.png`) | — |
| S35 | 404 (`settings-404.png`) | Standalone. |

Loading: pages are server-rendered on live (no spinner); the prototype shows the shared loading behaviour of the shell while the mock responds. JSON-driven parts keep their live loading texts ("Memuatkan...", "Memuatkan data...", "Mengimbas topik lemah pelajar...", "Menganalisis …", spinners in the school search and the QR modal).

---

## 6. Coverage matrix (completeness proof)

Source: `docs/discovery/inventory/M10/` (generated 2026-09-25). Generated by script (`gen.js` + `fns.js` in the author's scratchpad `m10-writer/`; reproducible from the Function catalogue and the inventory JSON). Every M10 content element (S1–S35) is listed with the Function that covers it or with a concrete exclusion reason; each element maps to exactly one Function. Shell elements are chrome owned by the global shell / M23 and the module each link targets; only M10-relevant ones are mapped individually, the rest are listed by ID range with their owner. "Content" quotes the DOM text as captured (`<person>`, `<school>`, `<name>` = discovery privacy mask). For S18, rubric elements inside the sub-question cards map to FN-M10-6.2.11 by rule (label "Rubrik Skema…", button "Tambah", 7-option konstruk select, keyword/marks inputs, "m", remove `fa-times`).

**Summary**

| Set | Elements | Mapped to an M10 Function | Excluded (with reason) | Unmapped |
|---|---|---|---|---|
| M10 content (S1–S35) | 3150 | 3051 | 99 (M16 tournament banner "LIVE:", "MAIN", "DAFTAR" — hidden user-layout widget, EL-M10-S{1,3–34}-001–003) | 0 |
| User-portal shell SHU | 415 | 77 | 338 (global shell / M23 and linked modules) | 0 |

**3150/3150 M10 content elements covered (3051 mapped, 99 excluded with reason), 0 unmapped.** Including the shell: 3565/3565 elements accounted for (3128 mapped, 437 excluded with reason). 191 of the 212 Functions in §3 appear in this matrix; the other 21 are behaviour-only Functions (access, server rules, SOURCE-DERIVED or unobservable states) with no element by nature.

### 6.1 M10 content elements


#### S1 — `/guru` (83 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S1-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S1-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S1-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S1-004 | button | conditional | "Tunjuk panduan Mula Di Sini", fa-question-circle | FN-M10-2.1.1 |
| EL-M10-S1-005 | button | visible-default | fa-times | FN-M10-2.1.1 |
| EL-M10-S1-006 | heading | visible-default | "Mula Di Sini — 3 Langkah Mudah" | FN-M10-2.1.1 |
| EL-M10-S1-007 | text | visible-default | "Ikut 3 langkah ini untuk mula menggunakan PrestasiPlus. Ambil masa 5 minit sahaja." | FN-M10-2.1.1 |
| EL-M10-S1-008 | badge | visible-default | "1" | FN-M10-2.1.1 |
| EL-M10-S1-009 | text | visible-default | "Buka Kelas" | FN-M10-2.1.1 |
| EL-M10-S1-010 | text | visible-default | "Klik "Kelas Saya" di sidebar. Cipta kelas baru atau lihat kelas sedia ada." | FN-M10-2.1.1 |
| EL-M10-S1-011 | link | visible-default | "Kelas Saya →", → /guru/kelas | FN-M10-2.1.1 |
| EL-M10-S1-012 | badge | visible-default | "2" | FN-M10-2.1.1 |
| EL-M10-S1-013 | text | visible-default | "Lihat Pelajar" | FN-M10-2.1.1 |
| EL-M10-S1-014 | text | visible-default | "Semak senarai pelajar anda. Lihat siapa yang aktif dan siapa yang belum mula." | FN-M10-2.1.1 |
| EL-M10-S1-015 | link | visible-default | "Pelajar Saya →", → /guru/pelajar | FN-M10-2.1.1 |
| EL-M10-S1-016 | badge | visible-default | "3" | FN-M10-2.1.1 |
| EL-M10-S1-017 | text | visible-default | "Pantau Prestasi" | FN-M10-2.1.1 |
| EL-M10-S1-018 | text | visible-default | "Buka Monitoring untuk lihat penglibatan pelajar dan topik lemah mereka." | FN-M10-2.1.1 |
| EL-M10-S1-019 | link | visible-default | "Monitoring →", → /guru/monitoring | FN-M10-2.1.1 |
| EL-M10-S1-020 | text | visible-default | "Hover atas mana-mana menu di sidebar untuk lihat penerangan ringkas.", fa-lightbulb | FN-M10-2.1.1 |
| EL-M10-S1-021 | text | visible-default | "Tip:" | FN-M10-2.1.1 |
| EL-M10-S1-022 | card | visible-default | "Checklist Guru" | FN-M10-2.1.2 |
| EL-M10-S1-023 | heading | visible-default | "Checklist Guru" | FN-M10-2.1.2 |
| EL-M10-S1-024 | text | visible-default | "0/3 langkah selesai" | FN-M10-2.1.2 |
| EL-M10-S1-025 | text | visible-default | "0%" | FN-M10-2.1.2 |
| EL-M10-S1-026 | text | visible-default | "Kelas dah ada" | FN-M10-2.1.2 |
| EL-M10-S1-027 | text | visible-default | "Admin sekolah akan sediakan kelas anda" | FN-M10-2.1.2 |
| EL-M10-S1-028 | link | visible-default | "Lihat", → /guru/kelas | FN-M10-2.1.2 |
| EL-M10-S1-029 | text | visible-default | "Pelajar dalam kelas" | FN-M10-2.1.2 |
| EL-M10-S1-030 | text | visible-default | "Admin akan import pelajar ke kelas anda" | FN-M10-2.1.2 |
| EL-M10-S1-031 | link | visible-default | "Lihat", → /guru/pelajar | FN-M10-2.1.2 |
| EL-M10-S1-032 | text | visible-default | "Misi harian pertama" | FN-M10-2.1.2 |
| EL-M10-S1-033 | text | visible-default | "Cipta misi latih tubi untuk pelajar anda" | FN-M10-2.1.2 |
| EL-M10-S1-034 | link | visible-default | "Lihat", → /guru/misi-harian/cipta | FN-M10-2.1.2 |
| EL-M10-S1-035 | text | visible-default | "Kelas Aktif" | FN-M10-2.1.3 |
| EL-M10-S1-036 | text | visible-default | "0" | FN-M10-2.1.3 |
| EL-M10-S1-037 | text | visible-default | "0 jumlah kelas" | FN-M10-2.1.3 |
| EL-M10-S1-038 | text | visible-default | "Pelajar" | FN-M10-2.1.3 |
| EL-M10-S1-039 | text | visible-default | "0" | FN-M10-2.1.3 |
| EL-M10-S1-040 | text | visible-default | "Merentasi semua kelas" | FN-M10-2.1.3 |
| EL-M10-S1-041 | text | visible-default | "Soalan" | FN-M10-2.1.3 |
| EL-M10-S1-042 | text | visible-default | "20719" | FN-M10-2.1.3 |
| EL-M10-S1-043 | text | visible-default | "✅ 19361 diluluskan" | FN-M10-2.1.3 |
| EL-M10-S1-044 | text | visible-default | "Tugasan" | FN-M10-2.1.3 |
| EL-M10-S1-045 | text | visible-default | "0" | FN-M10-2.1.3 |
| EL-M10-S1-046 | text | visible-default | "Jumlah tugasan dibuat" | FN-M10-2.1.3 |
| EL-M10-S1-047 | text | visible-default | "Tindakan Hari Ini" | FN-M10-2.1.4 |
| EL-M10-S1-048 | heading | visible-default | "Fokus guru yang paling penting hari ini" | FN-M10-2.1.4 |
| EL-M10-S1-049 | text | visible-default | "Panel ini memprioritikan pelajar, topik, dan tindakan yang paling wajar disemak dahulu." | FN-M10-2.1.4 |
| EL-M10-S1-050 | text | visible-default | "Pelajar" | FN-M10-2.1.4 |
| EL-M10-S1-051 | text | visible-default | "0" | FN-M10-2.1.4 |
| EL-M10-S1-052 | text | visible-default | "Topik" | FN-M10-2.1.4 |
| EL-M10-S1-053 | text | visible-default | "0" | FN-M10-2.1.4 |
| EL-M10-S1-054 | text | visible-default | "Tindakan" | FN-M10-2.1.4 |
| EL-M10-S1-055 | text | visible-default | "0" | FN-M10-2.1.4 |
| EL-M10-S1-056 | heading | visible-default | "Pelajar Perlu Dibantu" | FN-M10-2.1.4 |
| EL-M10-S1-057 | text | visible-default | "Top 3" | FN-M10-2.1.4 |
| EL-M10-S1-058 | empty-state | visible-default | "Tiada pelajar berkeutamaan tinggi dikesan buat masa ini." | FN-M10-2.1.4 |
| EL-M10-S1-059 | heading | visible-default | "Topik Kritikal" | FN-M10-2.1.4 |
| EL-M10-S1-060 | link | visible-default | "Analitik Kelas →", → /analitik/kelas | FN-M10-2.1.4 |
| EL-M10-S1-061 | empty-state | visible-default | "Tiada topik kritikal menonjol dikesan daripada data semasa." | FN-M10-2.1.4 |
| EL-M10-S1-062 | heading | visible-default | "Tindakan Disyorkan" | FN-M10-2.1.4 |
| EL-M10-S1-063 | text | visible-default | "Rule-based" | FN-M10-2.1.4 |
| EL-M10-S1-064 | link | visible-default | "Bina aktiviti pertama untuk pelajar Permulaan Data tindakan akan muncul selepas pelajar mu", → /guru/kelas, fa-chalkboard | FN-M10-2.1.4 |
| EL-M10-S1-065 | badge | visible-default | "Permulaan" | FN-M10-2.1.4 |
| EL-M10-S1-066 | text | visible-default | "Peer Tutor Matching" | FN-M10-2.1.5 |
| EL-M10-S1-067 | heading | visible-default | "Cadangan rakan pembimbing pelajar" | FN-M10-2.1.5 |
| EL-M10-S1-068 | text | visible-default | "Cadangan peer tutor akan muncul apabila guru mempunyai pelajar aktif dan data prestasi yan" | FN-M10-2.1.5 |
| EL-M10-S1-069 | text | visible-default | "Belum cukup signal yang yakin untuk cadangan peer tutor. Modul ini akan jadi lebih tepat a" | FN-M10-2.1.5 |
| EL-M10-S1-070 | card | visible-default | "Tindakan Pantas" | FN-M10-2.1.6 |
| EL-M10-S1-071 | heading | visible-default | "Tindakan Pantas" | FN-M10-2.1.6 |
| EL-M10-S1-072 | link | visible-default | "Cipta Kelas Baru Tambah kelas pembelajaran", → /guru/kelas/cipta, fa-plus | FN-M10-2.1.6 |
| EL-M10-S1-073 | link | visible-default | "Sumbang Soalan Tambah soalan untuk pelajar", → /guru/soalan/cipta, fa-pen-fancy | FN-M10-2.1.6 |
| EL-M10-S1-074 | link | visible-default | "Lihat Pelajar Pantau prestasi pelajar", → /guru/pelajar, fa-user-graduate | FN-M10-2.1.6 |
| EL-M10-S1-075 | link | visible-default | "Edit Profil Guru Kemaskini maklumat profesional", → /guru/profil/edit, fa-id-card | FN-M10-2.1.6 |
| EL-M10-S1-076 | card | visible-default | "Kelas Saya" | FN-M10-2.1.7 |
| EL-M10-S1-077 | heading | visible-default | "Kelas Saya" | FN-M10-2.1.7 |
| EL-M10-S1-078 | link | visible-default | "Semua →", → /guru/kelas | FN-M10-2.1.7 |
| EL-M10-S1-079 | text | visible-default | "Belum ada kelas. Cipta sekarang!" | FN-M10-2.1.7 |
| EL-M10-S1-080 | card | visible-default | "Penghantaran Terkini" | FN-M10-2.1.8 |
| EL-M10-S1-081 | heading | visible-default | "Penghantaran Terkini" | FN-M10-2.1.8 |
| EL-M10-S1-082 | text | visible-default | "Belum ada penghantaran tugasan." | FN-M10-2.1.8 |
| EL-M10-S1-083 | text | visible-default | "Buat tugasan di kelas untuk lihat penghantaran di sini." | FN-M10-2.1.8 |

#### S2 — `/guru/command-center` (102 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S2-001 | link | visible-default | "← Dashboard", → /guru | FN-M10-2.2.1 |
| EL-M10-S2-002 | heading | visible-default | "Command Center" | FN-M10-2.2.1 |
| EL-M10-S2-003 | link | visible-default | "🔬 Remedial", → # | FN-M10-2.2.1 |
| EL-M10-S2-004 | link | visible-default | "📊 Rekod", → /guru/remedial-progress | FN-M10-2.2.1 |
| EL-M10-S2-005 | link | visible-default | "⚠ Evaluate", → # | FN-M10-2.2.1 |
| EL-M10-S2-006 | link | visible-default | "🔮 Ramalan SPM", → # | FN-M10-2.2.1 |
| EL-M10-S2-007 | link | visible-default | "👩‍🏫 Kelas", → # | FN-M10-2.2.1 |
| EL-M10-S2-008 | link | visible-default | "🏆 Badges", → # | FN-M10-2.2.1 |
| EL-M10-S2-009 | text | visible-default | "LIVE" | FN-M10-2.2.1 |
| EL-M10-S2-010 | text | visible-default | "17:44:39" | FN-M10-2.2.1 |
| EL-M10-S2-011 | text | visible-default | "MYT" | FN-M10-2.2.1 |
| EL-M10-S2-012 | clickable | visible-default | "Pelajar Berdaftar 🔍--0 aktif menjawab" | FN-M10-2.2.3 |
| EL-M10-S2-013 | clickable | visible-default | "Soalan Dijawab 🔍--sepanjang masa" | FN-M10-2.2.3 |
| EL-M10-S2-014 | clickable | visible-default | "Ketepatan Purata 🔍0%keseluruhan sekolah" | FN-M10-2.2.3 |
| EL-M10-S2-015 | clickable | visible-default | "GPS Sekolah 🔍4.69purata GPS" | FN-M10-2.2.3 |
| EL-M10-S2-016 | text | visible-default | "Kelas Saya" | FN-M10-2.2.4 |
| EL-M10-S2-017 | text | visible-default | "📚" | FN-M10-2.2.4 |
| EL-M10-S2-018 | empty-state | visible-default | "Tiada data" | FN-M10-2.2.4 |
| EL-M10-S2-019 | text | visible-default | "Kirkpatrick" | FN-M10-2.2.4 |
| EL-M10-S2-020 | text | visible-default | "🔬" | FN-M10-2.2.4 |
| EL-M10-S2-021 | clickable | visible-default | "T1☆☆☆☆☆ 0/10" | FN-M10-2.2.4 |
| EL-M10-S2-022 | clickable | visible-default | "T20% ketepatan" | FN-M10-2.2.4 |
| EL-M10-S2-023 | clickable | visible-default | "T30 aktif 30h" | FN-M10-2.2.4 |
| EL-M10-S2-024 | clickable | visible-default | "T4GPS 0" | FN-M10-2.2.4 |
| EL-M10-S2-025 | text | visible-default | "💚 Mood Pelajar" | FN-M10-2.2.4 |
| EL-M10-S2-026 | clickable | visible-default | "😊Gembira0" | FN-M10-2.2.4 |
| EL-M10-S2-027 | clickable | visible-default | "😐OK0" | FN-M10-2.2.4 |
| EL-M10-S2-028 | clickable | visible-default | "😢Sedih0" | FN-M10-2.2.4 |
| EL-M10-S2-029 | clickable | visible-default | "😩Tekanan0" | FN-M10-2.2.4 |
| EL-M10-S2-030 | text | visible-default | "ALESA AI" | FN-M10-2.2.4 |
| EL-M10-S2-031 | text | visible-default | "🤖" | FN-M10-2.2.4 |
| EL-M10-S2-032 | text | visible-default | ""0% pelajar terlibat aktif. Ketepatan purata 0%. GPS sekolah: 4.69."" | FN-M10-2.2.4 |
| EL-M10-S2-033 | card | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-034 | text | visible-default | "Aktiviti Hari Ini" | FN-M10-2.2.5 |
| EL-M10-S2-035 | text | visible-default | "📈" | FN-M10-2.2.5 |
| EL-M10-S2-036 | clickable | visible-default | "0 soalan" | FN-M10-2.2.5 |
| EL-M10-S2-037 | text | visible-default | "Minggu ini:" | FN-M10-2.2.5 |
| EL-M10-S2-038 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-039 | text | visible-default | "Sama dengan minggu lepas" | FN-M10-2.2.5 |
| EL-M10-S2-040 | text | visible-default | "Live Feed" | FN-M10-2.2.5 |
| EL-M10-S2-041 | text | visible-default | "⚡" | FN-M10-2.2.5 |
| EL-M10-S2-042 | empty-state | visible-default | "Tiada aktiviti terkini" | FN-M10-2.2.5 |
| EL-M10-S2-043 | text | visible-default | "Leaderboard Minggu Ini" | FN-M10-2.2.5 |
| EL-M10-S2-044 | text | visible-default | "🏆" | FN-M10-2.2.5 |
| EL-M10-S2-045 | empty-state | visible-default | "Tiada data minggu ini" | FN-M10-2.2.5 |
| EL-M10-S2-046 | card | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-047 | text | visible-default | "Engagement Pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-048 | text | visible-default | "📊" | FN-M10-2.2.5 |
| EL-M10-S2-049 | text | visible-default | "Jumlah: pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-050 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-051 | tooltip | visible-default | "Klik: senarai pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-052 | text | visible-default | "Champion" | FN-M10-2.2.5 |
| EL-M10-S2-053 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-054 | tooltip | visible-default | "Klik: senarai pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-055 | text | visible-default | "Konsisten" | FN-M10-2.2.5 |
| EL-M10-S2-056 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-057 | tooltip | visible-default | "Klik: senarai pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-058 | text | visible-default | "Berkembang" | FN-M10-2.2.5 |
| EL-M10-S2-059 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-060 | tooltip | visible-default | "Klik: senarai pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-061 | text | visible-default | "Minimum" | FN-M10-2.2.5 |
| EL-M10-S2-062 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-063 | tooltip | visible-default | "Klik: senarai pelajar" | FN-M10-2.2.5 |
| EL-M10-S2-064 | text | visible-default | "Disengaged" | FN-M10-2.2.5 |
| EL-M10-S2-065 | text | visible-default | "0" | FN-M10-2.2.5 |
| EL-M10-S2-066 | text | visible-default | "Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat" | FN-M10-2.2.6 |
| EL-M10-S2-067 | clickable | hidden-only | "× Loading... Memuatkan..." | FN-M10-2.2.7 |
| EL-M10-S2-068 | modal | hidden-only | "Loading..." | FN-M10-2.2.7 |
| EL-M10-S2-069 | button | conditional | "×" | FN-M10-2.2.7 |
| EL-M10-S2-070 | heading | hidden-only | "Loading..." | FN-M10-2.2.7 |
| EL-M10-S2-071 | text | conditional | "17:44:53" | FN-M10-2.2.7 |
| EL-M10-S2-072 | clickable | conditional | "× gps Tiada data" | FN-M10-2.2.7 |
| EL-M10-S2-073 | modal | conditional | "gps" | FN-M10-2.2.7 |
| EL-M10-S2-074 | heading | conditional | "gps" | FN-M10-2.2.7 |
| EL-M10-S2-075 | text | conditional | "17:44:57" | FN-M10-2.2.7 |
| EL-M10-S2-076 | clickable | conditional | "× kirk Tiada data" | FN-M10-2.2.7 |
| EL-M10-S2-077 | modal | conditional | "kirk" | FN-M10-2.2.7 |
| EL-M10-S2-078 | heading | conditional | "kirk" | FN-M10-2.2.7 |
| EL-M10-S2-079 | text | conditional | "17:45:01" | FN-M10-2.2.7 |
| EL-M10-S2-080 | clickable | conditional | "× mood Tiada data" | FN-M10-2.2.7 |
| EL-M10-S2-081 | modal | conditional | "mood" | FN-M10-2.2.7 |
| EL-M10-S2-082 | heading | conditional | "mood" | FN-M10-2.2.7 |
| EL-M10-S2-083 | text | conditional | "17:44:49" | FN-M10-2.2.7 |
| EL-M10-S2-084 | clickable | conditional | "× students Tiada data" | FN-M10-2.2.7 |
| EL-M10-S2-085 | modal | conditional | "students" | FN-M10-2.2.7 |
| EL-M10-S2-086 | heading | conditional | "students" | FN-M10-2.2.7 |
| EL-M10-S2-087 | text | conditional | "17:45:16" | FN-M10-2.2.7 |
| EL-M10-S2-088 | clickable | conditional | "× Kelas Saya — Ringkasan Prestasi 0Jumlah Pelajar0Aktif0%Ketepatan#KelasTingkatanPelajarAk" | FN-M10-2.2.8 |
| EL-M10-S2-089 | modal | conditional | "Kelas Saya — Ringkasan Prestasi" | FN-M10-2.2.8 |
| EL-M10-S2-090 | heading | conditional | "Kelas Saya — Ringkasan Prestasi" | FN-M10-2.2.8 |
| EL-M10-S2-091 | table | conditional | (no text) | FN-M10-2.2.8 |
| EL-M10-S2-092 | text | conditional | "17:45:11" | FN-M10-2.2.8 |
| EL-M10-S2-093 | clickable | conditional | "× Ramalan SPM — Predictive Analytics 0Pelajar Dianalisis0Ramalan GPS Purata0BerisikoGred T" | FN-M10-2.2.9 |
| EL-M10-S2-094 | modal | conditional | "Ramalan SPM — Predictive Analytics" | FN-M10-2.2.9 |
| EL-M10-S2-095 | heading | conditional | "Ramalan SPM — Predictive Analytics" | FN-M10-2.2.9 |
| EL-M10-S2-096 | text | conditional | "17:45:06" | FN-M10-2.2.9 |
| EL-M10-S2-097 | clickable | conditional | "× Smart Remedial — Scan Pelajar Lemah Ralat: Unexpected token '<', "<!DOCTYPE "... is not " | FN-M10-2.2.10 |
| EL-M10-S2-098 | modal | conditional | "Smart Remedial — Scan Pelajar Lemah" | FN-M10-2.2.10 |
| EL-M10-S2-099 | heading | conditional | "Smart Remedial — Scan Pelajar Lemah" | FN-M10-2.2.10 |
| EL-M10-S2-100 | text | hidden-only | "17:44:42" | FN-M10-2.2.1 |
| EL-M10-S2-101 | text | hidden-only | "17:44:45" | FN-M10-2.2.1 |
| EL-M10-S2-102 | text | hidden-only | "17:45:21" | FN-M10-2.2.1 |

#### S3 — `/guru/remedial-progress` (22 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S3-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S3-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S3-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S3-004 | text | visible-default | "📊" | FN-M10-2.3.1 |
| EL-M10-S3-005 | heading | visible-default | "Remedial Progress Dashboard" | FN-M10-2.3.1 |
| EL-M10-S3-006 | text | visible-default | "Jejak peningkatan pelajar melalui ujian pemulihan" | FN-M10-2.3.1 |
| EL-M10-S3-007 | card | visible-default | "JUMLAH SET" | FN-M10-2.3.2 |
| EL-M10-S3-008 | text | visible-default | "0" | FN-M10-2.3.2 |
| EL-M10-S3-009 | text | visible-default | "JUMLAH SET" | FN-M10-2.3.2 |
| EL-M10-S3-010 | card | visible-default | "SELESAI" | FN-M10-2.3.2 |
| EL-M10-S3-011 | text | visible-default | "0" | FN-M10-2.3.2 |
| EL-M10-S3-012 | text | visible-default | "SELESAI" | FN-M10-2.3.2 |
| EL-M10-S3-013 | card | visible-default | "PELAJAR" | FN-M10-2.3.2 |
| EL-M10-S3-014 | text | visible-default | "0" | FN-M10-2.3.2 |
| EL-M10-S3-015 | text | visible-default | "PELAJAR" | FN-M10-2.3.2 |
| EL-M10-S3-016 | card | visible-default | "PURATA PENINGKATAN" | FN-M10-2.3.2 |
| EL-M10-S3-017 | text | visible-default | "+0%" | FN-M10-2.3.2 |
| EL-M10-S3-018 | text | visible-default | "PURATA PENINGKATAN" | FN-M10-2.3.2 |
| EL-M10-S3-019 | card | visible-default | "👥 Senarai Pelajar & Progress" | FN-M10-2.3.3 |
| EL-M10-S3-020 | heading | visible-default | "👥 Senarai Pelajar & Progress" | FN-M10-2.3.3 |
| EL-M10-S3-021 | text | visible-default | "📋" | FN-M10-2.3.3 |
| EL-M10-S3-022 | text | visible-default | "Belum ada ujian remedial dijana. Buka Command Center → klik Remedial untuk mula." | FN-M10-2.3.3 |

#### S4 — `/guru/kelas` (18 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S4-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S4-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S4-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S4-004 | heading | visible-default | "Kelas Saya" | FN-M10-3.1.1 |
| EL-M10-S4-005 | text | visible-default | "0 kelas aktif" | FN-M10-3.1.1 |
| EL-M10-S4-006 | link | visible-default | "Cipta Kelas Baru", → /guru/kelas/cipta, fa-plus | FN-M10-3.1.1 |
| EL-M10-S4-007 | card | visible-default | "Belum Ada Kelas" | FN-M10-3.1.2 |
| EL-M10-S4-008 | text | visible-default | "🏫" | FN-M10-3.1.2 |
| EL-M10-S4-009 | heading | visible-default | "Belum Ada Kelas" | FN-M10-3.1.2 |
| EL-M10-S4-010 | text | visible-default | "Cipta kelas pertama anda untuk memulakan pengajaran" | FN-M10-3.1.2 |
| EL-M10-S4-011 | link | visible-default | "Cipta Kelas", → /guru/kelas/cipta, fa-plus | FN-M10-3.1.2 |
| EL-M10-S4-012 | clickable | conditional | "- - Pautan sertai: Cetak Tutup", fa-spinner | FN-M10-3.1.4 |
| EL-M10-S4-013 | card | conditional | "-" | FN-M10-3.1.4 |
| EL-M10-S4-014 | heading | conditional | "-" | FN-M10-3.1.4 |
| EL-M10-S4-015 | input | conditional | (no text) | FN-M10-3.1.4 |
| EL-M10-S4-016 | button | conditional | fa-copy | FN-M10-3.1.4 |
| EL-M10-S4-017 | button | conditional | "Cetak", fa-print | FN-M10-3.1.4 |
| EL-M10-S4-018 | button | conditional | "Tutup" | FN-M10-3.1.4 |

#### S5 — `/guru/kelas/cipta` (68 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S5-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S5-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S5-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S5-004 | link | visible-default | "Kembali", → /guru/kelas, fa-arrow-left | FN-M10-3.2.1 |
| EL-M10-S5-005 | form | visible-default | (no text) | FN-M10-3.2.1 |
| EL-M10-S5-006 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-3.2.1 |
| EL-M10-S5-007 | card | visible-default | "Pilih Sekolah" | FN-M10-3.2.2 |
| EL-M10-S5-008 | heading | visible-default | "Pilih Sekolah" | FN-M10-3.2.2 |
| EL-M10-S5-009 | hidden-field | hidden-only | `school_id`, type hidden | FN-M10-3.2.2 |
| EL-M10-S5-010 | button | hidden-only | fa-times-circle | FN-M10-3.2.2 |
| EL-M10-S5-011 | input | hidden-only | ph "Taip nama sekolah untuk cari..." | FN-M10-3.2.2 |
| EL-M10-S5-012 | button | hidden-only | (no text) | FN-M10-3.2.2 |
| EL-M10-S5-013 | empty-state | hidden-only | "Tiada sekolah dijumpai", fa-search-minus | FN-M10-3.2.2 |
| EL-M10-S5-014 | input | visible-default | ph "Taip nama sekolah untuk cari..." | FN-M10-3.2.2 |
| EL-M10-S5-015 | button | hidden-only | (no text) | FN-M10-3.2.2 |
| EL-M10-S5-016 | empty-state | conditional | "Tiada sekolah dijumpai", fa-search-minus | FN-M10-3.2.2 |
| EL-M10-S5-017 | card | visible-default | "Maklumat Kelas" | FN-M10-3.2.3 |
| EL-M10-S5-018 | heading | visible-default | "Maklumat Kelas" | FN-M10-3.2.3 |
| EL-M10-S5-019 | hidden-field | hidden-only | `name`, type hidden | FN-M10-3.2.3 |
| EL-M10-S5-020 | label | visible-default | "Nama Kumpulan *" | FN-M10-3.2.3 |
| EL-M10-S5-021 | input | visible-default | label "Nama Kumpulan *", ph "cth: 5 Bestari" | FN-M10-3.2.3 |
| EL-M10-S5-022 | text | visible-default | "Nama kumpulan latih tubi anda." | FN-M10-3.2.3 |
| EL-M10-S5-023 | label | visible-default | "Subjek *" | FN-M10-3.2.4 |
| EL-M10-S5-024 | select | visible-default | label "Subjek *", `subject_id`, 32 options | FN-M10-3.2.4 |
| EL-M10-S5-025 | label | visible-default | "Tahap Pendidikan * Auto dari kelas sekolah" | FN-M10-3.2.5 |
| EL-M10-S5-026 | label | visible-default | "Tahun 1" | FN-M10-3.2.5 |
| EL-M10-S5-027 | radio | hidden-only | label "Tahun 1", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-028 | label | visible-default | "Tahun 2" | FN-M10-3.2.5 |
| EL-M10-S5-029 | radio | hidden-only | label "Tahun 2", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-030 | label | visible-default | "Tahun 3" | FN-M10-3.2.5 |
| EL-M10-S5-031 | radio | hidden-only | label "Tahun 3", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-032 | label | visible-default | "Tahun 4" | FN-M10-3.2.5 |
| EL-M10-S5-033 | radio | hidden-only | label "Tahun 4", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-034 | label | visible-default | "Tahun 5" | FN-M10-3.2.5 |
| EL-M10-S5-035 | radio | hidden-only | label "Tahun 5", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-036 | label | visible-default | "Tahun 6" | FN-M10-3.2.5 |
| EL-M10-S5-037 | radio | hidden-only | label "Tahun 6", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-038 | label | visible-default | "Ting. 1" | FN-M10-3.2.5 |
| EL-M10-S5-039 | radio | hidden-only | label "Ting. 1", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-040 | label | visible-default | "Ting. 2" | FN-M10-3.2.5 |
| EL-M10-S5-041 | radio | hidden-only | label "Ting. 2", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-042 | label | visible-default | "Ting. 3" | FN-M10-3.2.5 |
| EL-M10-S5-043 | radio | hidden-only | label "Ting. 3", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-044 | label | visible-default | "Ting. 4" | FN-M10-3.2.5 |
| EL-M10-S5-045 | radio | hidden-only | label "Ting. 4", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-046 | label | visible-default | "Ting. 5" | FN-M10-3.2.5 |
| EL-M10-S5-047 | radio | hidden-only | label "Ting. 5", `education_level`, type radio | FN-M10-3.2.5 |
| EL-M10-S5-048 | label | visible-default | "Penerangan (pilihan)" | FN-M10-3.2.6 |
| EL-M10-S5-049 | textarea | visible-default | label "Penerangan (pilihan)", `description`, ph "Penerangan ringkas tentang kelas ini..." | FN-M10-3.2.6 |
| EL-M10-S5-050 | button | visible-default | "Cipta Kelas", fa-plus-circle | FN-M10-3.2.7 |
| EL-M10-S5-051 | button | conditional | "<school> PPD SEGAMAT, Johor" | FN-M10-3.2.2 |
| EL-M10-S5-052 | button | conditional | "<school> PPD BATU PAHAT, Johor" | FN-M10-3.2.2 |
| EL-M10-S5-053 | button | conditional | "<school> PPD BATU PAHAT, Johor" | FN-M10-3.2.2 |
| EL-M10-S5-054 | button | conditional | "<school> PPD MUAR, Johor" | FN-M10-3.2.2 |
| EL-M10-S5-055 | button | conditional | "<school> PPD KULIM/BANDAR BAHARU, Kedah" | FN-M10-3.2.2 |
| EL-M10-S5-056 | button | conditional | "<school> PPD TIMUR LAUT, Pulau Pinang" | FN-M10-3.2.2 |
| EL-M10-S5-057 | button | conditional | "<school> PPD LARUT/MATANG/SELAMA, Perak" | FN-M10-3.2.2 |
| EL-M10-S5-058 | button | conditional | "<school> PPD KRIAN, Perak" | FN-M10-3.2.2 |
| EL-M10-S5-059 | button | conditional | "<school> PPD SEBERANG PERAI UTARA, Pulau Pinang" | FN-M10-3.2.2 |
| EL-M10-S5-060 | button | conditional | "<school> PPD SEBERANG PERAI UTARA, Pulau Pinang" | FN-M10-3.2.2 |
| EL-M10-S5-061 | button | conditional | "<school> PPD KUALA MUDA/YAN, Kedah" | FN-M10-3.2.2 |
| EL-M10-S5-062 | button | conditional | "<school> PPD MUAR, Johor" | FN-M10-3.2.2 |
| EL-M10-S5-063 | button | conditional | "<school> PPD KUALA SELANGOR, Selangor" | FN-M10-3.2.2 |
| EL-M10-S5-064 | button | conditional | "<school> PPD TAMPIN, Negeri Sembilan" | FN-M10-3.2.2 |
| EL-M10-S5-065 | button | conditional | "<school> PPD ALOR GAJAH, Melaka" | FN-M10-3.2.2 |
| EL-M10-S5-066 | text | conditional | "<school>" | FN-M10-3.2.2 |
| EL-M10-S5-067 | text | conditional | "JPN PERLIS, Perlis" | FN-M10-3.2.2 |
| EL-M10-S5-068 | button | conditional | fa-times-circle | FN-M10-3.2.2 |

#### S6 — `/guru/pelajar` (20 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S6-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S6-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S6-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S6-004 | text | visible-default | "0" | FN-M10-3.3.1 |
| EL-M10-S6-005 | text | visible-default | "Pelajar dalam kelas saya" | FN-M10-3.3.1 |
| EL-M10-S6-006 | link | visible-default | "Cipta PelajarCipta", → /guru/pelajar/cipta, fa-user-plus | FN-M10-3.3.1 |
| EL-M10-S6-007 | tab | visible-default | "Pelajar Sekolah", fa-school | FN-M10-3.3.2 |
| EL-M10-S6-008 | tab | visible-default | "Pelajar Saya 0", fa-user-check | FN-M10-3.3.2 |
| EL-M10-S6-009 | badge | visible-default | "0" | FN-M10-3.3.2 |
| EL-M10-S6-010 | card | conditional | "Tambah pelajar ke:" | FN-M10-3.3.4 |
| EL-M10-S6-011 | text | conditional | "Tambah pelajar ke:" | FN-M10-3.3.4 |
| EL-M10-S6-012 | select | conditional | 1 options | FN-M10-3.3.4 |
| EL-M10-S6-013 | card | conditional | "Tetapan Profil" | FN-M10-3.3.4 |
| EL-M10-S6-014 | text | conditional | "Sekolah belum ditetapkan" | FN-M10-3.3.4 |
| EL-M10-S6-015 | text | conditional | "Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar" | FN-M10-3.3.4 |
| EL-M10-S6-016 | link | conditional | "Tetapan Profil", → /guru/profil/edit, fa-user-cog | FN-M10-3.3.4 |
| EL-M10-S6-017 | card | visible-default | "Cipta Kelas" | FN-M10-3.3.3 |
| EL-M10-S6-018 | text | visible-default | "Belum ada pelajar dalam kelas anda" | FN-M10-3.3.3 |
| EL-M10-S6-019 | text | visible-default | "Buat kelas dan tambah pelajar dari senarai sekolah." | FN-M10-3.3.3 |
| EL-M10-S6-020 | link | visible-default | "Cipta Kelas", → /guru/kelas/cipta, fa-plus | FN-M10-3.3.3 |

#### S7 — `/guru/kehadiran-digital` (40 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S7-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S7-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S7-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S7-004 | form | visible-default | (no text) | FN-M10-4.1.1 |
| EL-M10-S7-005 | label | visible-default | "Tarikh" | FN-M10-4.1.1 |
| EL-M10-S7-006 | input | visible-default | label "Tarikh", `date`, type date | FN-M10-4.1.1 |
| EL-M10-S7-007 | button | visible-default | "Semak", fa-search | FN-M10-4.1.1 |
| EL-M10-S7-008 | text | visible-default | "Jumlah Pelajar" | FN-M10-4.1.2 |
| EL-M10-S7-009 | text | visible-default | "137" | FN-M10-4.1.2 |
| EL-M10-S7-010 | text | visible-default | "Hadir" | FN-M10-4.1.2 |
| EL-M10-S7-011 | text | visible-default | "0" | FN-M10-4.1.2 |
| EL-M10-S7-012 | text | visible-default | "Tidak Hadir" | FN-M10-4.1.2 |
| EL-M10-S7-013 | text | visible-default | "137" | FN-M10-4.1.2 |
| EL-M10-S7-014 | text | visible-default | "% Kehadiran" | FN-M10-4.1.2 |
| EL-M10-S7-015 | text | visible-default | "0%" | FN-M10-4.1.2 |
| EL-M10-S7-016 | card | visible-default | "Trend Kehadiran 7 Hari" | FN-M10-4.1.3 |
| EL-M10-S7-017 | heading | visible-default | "Trend Kehadiran 7 Hari" | FN-M10-4.1.3 |
| EL-M10-S7-018 | text | visible-default | "Sab" | FN-M10-4.1.3 |
| EL-M10-S7-019 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-020 | text | visible-default | "Ahd" | FN-M10-4.1.3 |
| EL-M10-S7-021 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-022 | text | visible-default | "Isn" | FN-M10-4.1.3 |
| EL-M10-S7-023 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-024 | text | visible-default | "Sel" | FN-M10-4.1.3 |
| EL-M10-S7-025 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-026 | text | visible-default | "Rab" | FN-M10-4.1.3 |
| EL-M10-S7-027 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-028 | text | visible-default | "Kha" | FN-M10-4.1.3 |
| EL-M10-S7-029 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-030 | text | visible-default | "Jum" | FN-M10-4.1.3 |
| EL-M10-S7-031 | text | visible-default | "0%" | FN-M10-4.1.3 |
| EL-M10-S7-032 | card | visible-default | "Senarai Pelajar — 25/09/2026" | FN-M10-4.1.4 |
| EL-M10-S7-033 | heading | visible-default | "Senarai Pelajar — 25/09/2026" | FN-M10-4.1.4 |
| EL-M10-S7-034 | table | visible-default | (no text) | FN-M10-4.1.4 |
| EL-M10-S7-035 | badge | visible-default | "Tidak Hadir" | FN-M10-4.1.4 |
| EL-M10-S7-036 | badge | visible-default | "Tidak Hadir" | FN-M10-4.1.4 |
| EL-M10-S7-037 | badge | visible-default | "Tidak Hadir" | FN-M10-4.1.4 |
| EL-M10-S7-038 | text | visible-default | "Pelajar dianggap "Hadir" apabila menjawab sekurang-kurangnya 5 soalan pada hari tersebut. ", fa-info-circle | FN-M10-4.1.5 |
| EL-M10-S7-039 | card | conditional | "Senarai Pelajar — 01/09/2026" | FN-M10-4.1.4 |
| EL-M10-S7-040 | heading | conditional | "Senarai Pelajar — 01/09/2026" | FN-M10-4.1.4 |

#### S8 — `/guru/jadual-belajar` (36 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S8-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S8-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S8-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S8-004 | card | visible-default | "Tambah Jadual" | FN-M10-4.2.1 |
| EL-M10-S8-005 | heading | visible-default | "Tambah Jadual" | FN-M10-4.2.1 |
| EL-M10-S8-006 | form | visible-default | (no text) | FN-M10-4.2.1 |
| EL-M10-S8-007 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-4.2.1 |
| EL-M10-S8-008 | label | visible-default | "Hari" | FN-M10-4.2.1 |
| EL-M10-S8-009 | select | visible-default | label "Hari", `day_of_week`, 7 options | FN-M10-4.2.1 |
| EL-M10-S8-010 | label | visible-default | "Subjek" | FN-M10-4.2.1 |
| EL-M10-S8-011 | select | visible-default | label "Subjek", `subject_id`, 31 options | FN-M10-4.2.1 |
| EL-M10-S8-012 | label | visible-default | "Topik Fokus (opsional)" | FN-M10-4.2.1 |
| EL-M10-S8-013 | input | visible-default | label "Topik Fokus (opsional)", `focus_topic`, ph "cth: Bab 3 Algebra" | FN-M10-4.2.1 |
| EL-M10-S8-014 | button | visible-default | "Tambah", fa-plus | FN-M10-4.2.1 |
| EL-M10-S8-015 | card | visible-default | "Isnin" | FN-M10-4.2.2 |
| EL-M10-S8-016 | heading | visible-default | "Isnin" | FN-M10-4.2.2 |
| EL-M10-S8-017 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |
| EL-M10-S8-018 | card | visible-default | "Selasa" | FN-M10-4.2.2 |
| EL-M10-S8-019 | heading | visible-default | "Selasa" | FN-M10-4.2.2 |
| EL-M10-S8-020 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |
| EL-M10-S8-021 | card | visible-default | "Rabu" | FN-M10-4.2.2 |
| EL-M10-S8-022 | heading | visible-default | "Rabu" | FN-M10-4.2.2 |
| EL-M10-S8-023 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |
| EL-M10-S8-024 | card | visible-default | "Khamis" | FN-M10-4.2.2 |
| EL-M10-S8-025 | heading | visible-default | "Khamis" | FN-M10-4.2.2 |
| EL-M10-S8-026 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |
| EL-M10-S8-027 | card | visible-default | "Jumaat HARI INI" | FN-M10-4.2.2 |
| EL-M10-S8-028 | heading | visible-default | "Jumaat HARI INI" | FN-M10-4.2.2 |
| EL-M10-S8-029 | badge | visible-default | "HARI INI" | FN-M10-4.2.2 |
| EL-M10-S8-030 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |
| EL-M10-S8-031 | card | visible-default | "Sabtu" | FN-M10-4.2.2 |
| EL-M10-S8-032 | heading | visible-default | "Sabtu" | FN-M10-4.2.2 |
| EL-M10-S8-033 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |
| EL-M10-S8-034 | card | visible-default | "Ahad" | FN-M10-4.2.2 |
| EL-M10-S8-035 | heading | visible-default | "Ahad" | FN-M10-4.2.2 |
| EL-M10-S8-036 | empty-state | visible-default | "Tiada jadual ditetapkan" | FN-M10-4.2.2 |

#### S9 — `/guru/broadcast` (14 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S9-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S9-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S9-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S9-004 | card | visible-default | "Hantar Mesej Baru" | FN-M10-4.3.1 |
| EL-M10-S9-005 | heading | visible-default | "Hantar Mesej Baru" | FN-M10-4.3.1 |
| EL-M10-S9-006 | form | visible-default | (no text) | FN-M10-4.3.1 |
| EL-M10-S9-007 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-4.3.1 |
| EL-M10-S9-008 | textarea | visible-default | `message`, ph "Tulis mesej ringkas untuk pelajar..." | FN-M10-4.3.1 |
| EL-M10-S9-009 | label | visible-default | "Biasa" | FN-M10-4.3.1 |
| EL-M10-S9-010 | radio | visible-default | label "Biasa", `priority`, type radio | FN-M10-4.3.1 |
| EL-M10-S9-011 | label | visible-default | "Penting" | FN-M10-4.3.1 |
| EL-M10-S9-012 | radio | visible-default | label "Penting", `priority`, type radio | FN-M10-4.3.1 |
| EL-M10-S9-013 | button | visible-default | "Hantar", fa-paper-plane | FN-M10-4.3.1 |
| EL-M10-S9-014 | empty-state | visible-default | "Tiada mesej dihantar lagi." | FN-M10-4.3.2 |

#### S10 — `/guru/live-kelas` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S10-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S10-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S10-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S10-004 | card | visible-default | "0 pelajar sedang aktif" | FN-M10-4.4.1 |
| EL-M10-S10-005 | text | visible-default | "pelajar sedang aktif" | FN-M10-4.4.1 |
| EL-M10-S10-006 | text | visible-default | "0" | FN-M10-4.4.1 |
| EL-M10-S10-007 | text | visible-default | "Dikemas kini: · Auto-muat semula setiap 30 saat" | FN-M10-4.4.1 |
| EL-M10-S10-008 | text | visible-default | "09:46:29" | FN-M10-4.4.1 |
| EL-M10-S10-009 | text | visible-default | "28s" | FN-M10-4.4.1 |
| EL-M10-S10-010 | button | visible-default | "Muat Semula", fa-refresh | FN-M10-4.4.1 |
| EL-M10-S10-011 | text | hidden-only | "Gagal mendapatkan data. Periksa sambungan internet anda." | FN-M10-4.4.1 |
| EL-M10-S10-012 | card | hidden-only | "Tiada pelajar sedang aktif menjawab soalan sekarang" | FN-M10-4.4.2 |
| EL-M10-S10-013 | empty-state | hidden-only | "Tiada pelajar sedang aktif menjawab soalan sekarang" | FN-M10-4.4.2 |
| EL-M10-S10-014 | text | hidden-only | "Halaman ini akan dikemas kini secara automatik apabila pelajar mula menjawab soalan." | FN-M10-4.4.2 |
| EL-M10-S10-015 | card | visible-default | "Tiada pelajar sedang aktif menjawab soalan sekarang" | FN-M10-4.4.2 |
| EL-M10-S10-016 | empty-state | visible-default | "Tiada pelajar sedang aktif menjawab soalan sekarang" | FN-M10-4.4.2 |
| EL-M10-S10-017 | text | visible-default | "Halaman ini akan dikemas kini secara automatik apabila pelajar mula menjawab soalan." | FN-M10-4.4.2 |
| EL-M10-S10-018 | card | hidden-only | "LANGSUNG" | FN-M10-4.4.3 |
| EL-M10-S10-019 | text | hidden-only | "LANGSUNG" | FN-M10-4.4.3 |
| EL-M10-S10-020 | text | hidden-only | "Kuiz" | FN-M10-4.4.3 |
| EL-M10-S10-021 | text | hidden-only | "Masa" | FN-M10-4.4.3 |
| EL-M10-S10-022 | text | hidden-only | "Markah" | FN-M10-4.4.3 |
| EL-M10-S10-023 | card | visible-default | "Pejuang Minggu Ini" | FN-M10-4.4.4 |
| EL-M10-S10-024 | heading | visible-default | "Pejuang Minggu Ini" | FN-M10-4.4.4 |
| EL-M10-S10-025 | empty-state | visible-default | "Tiada data minggu ini" | FN-M10-4.4.4 |
| EL-M10-S10-026 | card | visible-default | "Streak Champions" | FN-M10-4.4.4 |
| EL-M10-S10-027 | heading | visible-default | "Streak Champions" | FN-M10-4.4.4 |
| EL-M10-S10-028 | empty-state | visible-default | "Tiada streak aktif" | FN-M10-4.4.4 |
| EL-M10-S10-029 | card | visible-default | "Most Improved" | FN-M10-4.4.4 |
| EL-M10-S10-030 | heading | visible-default | "Most Improved" | FN-M10-4.4.4 |
| EL-M10-S10-031 | text | visible-default | "Perlu data 2 minggu untuk perbandingan" | FN-M10-4.4.4 |

#### S11 — `/guru/misi-harian` (9 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S11-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S11-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S11-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S11-004 | text | visible-default | "Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A." | FN-M10-5.1.1 |
| EL-M10-S11-005 | link | visible-default | "Misi Baru", → /guru/misi-harian/cipta, fa-plus | FN-M10-5.1.1 |
| EL-M10-S11-006 | card | visible-default | "Belum ada misi" | FN-M10-5.1.2 |
| EL-M10-S11-007 | text | visible-default | "Belum ada misi" | FN-M10-5.1.2 |
| EL-M10-S11-008 | text | visible-default | "Cipta misi harian pertama untuk pelajar anda." | FN-M10-5.1.2 |
| EL-M10-S11-009 | link | visible-default | "Cipta Misi", → /guru/misi-harian/cipta, fa-plus | FN-M10-5.1.2 |

#### S12 — `/guru/misi-harian/cipta` (35 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S12-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S12-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S12-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S12-004 | card | visible-default | "Nama Misi" | FN-M10-5.2.1 |
| EL-M10-S12-005 | form | visible-default | (no text) | FN-M10-5.2.1 |
| EL-M10-S12-006 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-5.2.1 |
| EL-M10-S12-007 | label | visible-default | "Nama Misi" | FN-M10-5.2.1 |
| EL-M10-S12-008 | input | visible-default | label "Nama Misi", `title` | FN-M10-5.2.1 |
| EL-M10-S12-009 | label | visible-default | "Jenis Misi" | FN-M10-5.2.1 |
| EL-M10-S12-010 | select | visible-default | label "Jenis Misi", `mission_type`, 3 options | FN-M10-5.2.1 |
| EL-M10-S12-011 | hidden-field | hidden-only | label "Jenis Misi", `mission_source`, type hidden | FN-M10-5.2.1 |
| EL-M10-S12-012 | label | visible-default | "Tarikh Misi" | FN-M10-5.2.1 |
| EL-M10-S12-013 | input | visible-default | label "Tarikh Misi", `mission_date`, type date | FN-M10-5.2.1 |
| EL-M10-S12-014 | label | visible-default | "Subjek" | FN-M10-5.2.2 |
| EL-M10-S12-015 | select | visible-default | label "Subjek", `subject_id`, 21 options | FN-M10-5.2.2 |
| EL-M10-S12-016 | label | visible-default | "Bab (Opsional)" | FN-M10-5.2.2 |
| EL-M10-S12-017 | select | visible-default | label "Bab (Opsional)", `chapter_id`, 12 options | FN-M10-5.2.2 |
| EL-M10-S12-018 | label | visible-default | "Bilangan Soalan" | FN-M10-5.2.3 |
| EL-M10-S12-019 | input | visible-default | label "Bilangan Soalan", `question_count`, type number | FN-M10-5.2.3 |
| EL-M10-S12-020 | text | visible-default | "5 hingga 50 soalan" | FN-M10-5.2.3 |
| EL-M10-S12-021 | label | visible-default | "Ganjaran Syiling" | FN-M10-5.2.4 |
| EL-M10-S12-022 | text | visible-default | "per soalan betul", fa-coins | FN-M10-5.2.4 |
| EL-M10-S12-023 | text | visible-default | "3 syiling" | FN-M10-5.2.4 |
| EL-M10-S12-024 | text | visible-default | "Auto-kira berdasarkan bilangan soalan betul. Tiada tetapan manual." | FN-M10-5.2.4 |
| EL-M10-S12-025 | text | hidden-only | "Soalan Ciptaan Guru", fa-youtube | FN-M10-5.2.5 |
| EL-M10-S12-026 | text | hidden-only | "Pilih soalan yang anda sudah cipta di ." | FN-M10-5.2.5 |
| EL-M10-S12-027 | link | hidden-only | "Soalan Saya", → /guru/soalan-guru | FN-M10-5.2.5 |
| EL-M10-S12-028 | alert | hidden-only | "Soalan ciptaan anda (berdasarkan video/rujukan) akan digunakan sebagai misi. Pelajar akan ", fa-info-circle | FN-M10-5.2.5 |
| EL-M10-S12-029 | text | visible-default | "Bahan Rujukan (Opsional)", fa-link | FN-M10-5.2.6 |
| EL-M10-S12-030 | text | visible-default | "Pelajar akan lihat bahan ini sebelum mula menjawab soalan." | FN-M10-5.2.6 |
| EL-M10-S12-031 | input | visible-default | `resource_title`, ph "Tajuk (cth: Video Bab 3)" | FN-M10-5.2.6 |
| EL-M10-S12-032 | input | visible-default | `resource_url`, ph "URL (YouTube/PDF/website)", type url | FN-M10-5.2.6 |
| EL-M10-S12-033 | textarea | visible-default | `resource_note`, ph "Nota ringkas untuk pelajar (opsional)" | FN-M10-5.2.6 |
| EL-M10-S12-034 | link | visible-default | "Kembali", → /guru/misi-harian, fa-arrow-left | FN-M10-5.2.7 |
| EL-M10-S12-035 | button | visible-default | "Lancarkan Misi", fa-rocket | FN-M10-5.2.7 |

#### S13 — `/guru/set-soalan` (11 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S13-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S13-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S13-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S13-004 | card | visible-default | "Set Soalan Anda" | FN-M10-5.3.1 |
| EL-M10-S13-005 | heading | visible-default | "Set Soalan Anda" | FN-M10-5.3.1 |
| EL-M10-S13-006 | text | visible-default | "0 set dicipta" | FN-M10-5.3.1 |
| EL-M10-S13-007 | link | visible-default | "Cipta Set Baharu", → /guru/set-soalan/cipta, fa-plus | FN-M10-5.3.1 |
| EL-M10-S13-008 | card | visible-default | "Belum Ada Set Soalan" | FN-M10-5.3.2 |
| EL-M10-S13-009 | heading | visible-default | "Belum Ada Set Soalan" | FN-M10-5.3.2 |
| EL-M10-S13-010 | text | visible-default | "Cipta set soalan pertama anda untuk kelas." | FN-M10-5.3.2 |
| EL-M10-S13-011 | link | visible-default | "Cipta Set Pertama", → /guru/set-soalan/cipta, fa-plus | FN-M10-5.3.2 |

#### S14 — `/guru/set-soalan/cipta` (39 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S14-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S14-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S14-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S14-004 | link | visible-default | "Kembali ke Senarai", → /guru/set-soalan, fa-arrow-left | FN-M10-5.4.1 |
| EL-M10-S14-005 | form | visible-default | (no text) | FN-M10-5.4.1 |
| EL-M10-S14-006 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-5.4.1 |
| EL-M10-S14-007 | card | visible-default | "1" | FN-M10-5.4.2 |
| EL-M10-S14-008 | text | visible-default | "1" | FN-M10-5.4.2 |
| EL-M10-S14-009 | heading | visible-default | "Maklumat Asas" | FN-M10-5.4.2 |
| EL-M10-S14-010 | label | visible-default | "Kelas *" | FN-M10-5.4.2 |
| EL-M10-S14-011 | select | visible-default | label "Kelas *", `classroom_id`, 1 options | FN-M10-5.4.2 |
| EL-M10-S14-012 | label | visible-default | "Tajuk Set *" | FN-M10-5.4.2 |
| EL-M10-S14-013 | input | visible-default | label "Tajuk Set *", `title`, ph "cth: Latih Tubi BM Mac 2026 - Set 1" | FN-M10-5.4.2 |
| EL-M10-S14-014 | label | visible-default | "Penerangan" | FN-M10-5.4.2 |
| EL-M10-S14-015 | textarea | visible-default | label "Penerangan", `description`, ph "Arahan atau penerangan untuk pelajar..." | FN-M10-5.4.2 |
| EL-M10-S14-016 | label | visible-default | "Kumpulan Set (untuk TOV/AR tracking)" | FN-M10-5.4.2 |
| EL-M10-S14-017 | input | visible-default | label "Kumpulan Set (untuk TOV/AR tracking)", `group_tag`, ph "cth: BM Mac 2026" | FN-M10-5.4.2 |
| EL-M10-S14-018 | text | visible-default | "Set pertama dalam kumpulan = TOV (baseline). Set seterusnya = AR (progress).", fa-info-circle | FN-M10-5.4.2 |
| EL-M10-S14-019 | card | visible-default | "2" | FN-M10-5.4.3 |
| EL-M10-S14-020 | text | visible-default | "2" | FN-M10-5.4.3 |
| EL-M10-S14-021 | heading | visible-default | "Tetapan" | FN-M10-5.4.3 |
| EL-M10-S14-022 | label | visible-default | "Had Masa (minit)" | FN-M10-5.4.3 |
| EL-M10-S14-023 | input | visible-default | label "Had Masa (minit)", `time_limit_minutes`, ph "Tiada had", type number | FN-M10-5.4.3 |
| EL-M10-S14-024 | empty-state | visible-default | "Kosongkan = tiada had masa" | FN-M10-5.4.3 |
| EL-M10-S14-025 | label | visible-default | "Had Percubaan" | FN-M10-5.4.3 |
| EL-M10-S14-026 | input | visible-default | label "Had Percubaan", `max_attempts`, type number | FN-M10-5.4.3 |
| EL-M10-S14-027 | text | visible-default | "0 = tiada had (boleh ulang)" | FN-M10-5.4.3 |
| EL-M10-S14-028 | card | visible-default | "3" | FN-M10-5.4.4 |
| EL-M10-S14-029 | text | visible-default | "3" | FN-M10-5.4.4 |
| EL-M10-S14-030 | heading | visible-default | "Status Penerbitan" | FN-M10-5.4.4 |
| EL-M10-S14-031 | label | visible-default | "Draf Simpan dahulu, terbit kemudian" | FN-M10-5.4.4 |
| EL-M10-S14-032 | radio | hidden-only | label "Draf Simpan dahulu, terbit kemudian", `status`, type radio | FN-M10-5.4.4 |
| EL-M10-S14-033 | label | visible-default | "Jadual Terbit pada masa tertentu" | FN-M10-5.4.4 |
| EL-M10-S14-034 | radio | hidden-only | label "Jadual Terbit pada masa tertentu", `status`, type radio | FN-M10-5.4.4 |
| EL-M10-S14-035 | label | visible-default | "Terbit Pelajar boleh mula sekarang" | FN-M10-5.4.4 |
| EL-M10-S14-036 | radio | hidden-only | label "Terbit Pelajar boleh mula sekarang", `status`, type radio | FN-M10-5.4.4 |
| EL-M10-S14-037 | label | conditional | "Tarikh & Masa Terbit" | FN-M10-5.4.4 |
| EL-M10-S14-038 | input | conditional | label "Tarikh & Masa Terbit", `scheduled_at`, type datetime-local | FN-M10-5.4.4 |
| EL-M10-S14-039 | button | visible-default | "Cipta Set & Tambah Soalan", fa-plus | FN-M10-5.4.5 |

#### S15 — `/guru/soalan-guru` (22 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S15-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S15-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S15-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S15-004 | text | visible-default | "adalah soalan peribadi yang anda cipta khas untuk pelajar kelas anda. Lampirkan rujukan da", fa-info-circle | FN-M10-5.5.1 |
| EL-M10-S15-005 | text | visible-default | "Soalan & Rujukan" | FN-M10-5.5.1 |
| EL-M10-S15-006 | card | visible-default | "Cara Soalan & Rujukan" | FN-M10-5.5.2 |
| EL-M10-S15-007 | heading | visible-default | "Cara Soalan & Rujukan" | FN-M10-5.5.2 |
| EL-M10-S15-008 | badge | visible-default | "1" | FN-M10-5.5.2 |
| EL-M10-S15-009 | text | visible-default | "Cari Bahan Rujukan" | FN-M10-5.5.2 |
| EL-M10-S15-010 | text | visible-default | "Video YouTube, Anyflip, PDF, atau apa-apa link rujukan." | FN-M10-5.5.2 |
| EL-M10-S15-011 | badge | visible-default | "2" | FN-M10-5.5.2 |
| EL-M10-S15-012 | text | visible-default | "Tulis Soalan MCQ" | FN-M10-5.5.2 |
| EL-M10-S15-013 | text | visible-default | "A/B/C/D + gambarajah (optional). Tandakan jawapan betul." | FN-M10-5.5.2 |
| EL-M10-S15-014 | badge | visible-default | "3" | FN-M10-5.5.2 |
| EL-M10-S15-015 | text | visible-default | "Assign Misi Harian" | FN-M10-5.5.2 |
| EL-M10-S15-016 | text | visible-default | "Pilih "YouTube / Soalan Guru" di Misi Harian." | FN-M10-5.5.2 |
| EL-M10-S15-017 | text | visible-default | "0 soalan dicipta" | FN-M10-5.5.3 |
| EL-M10-S15-018 | link | visible-default | "Soalan & Rujukan Baru", → /guru/soalan-guru/cipta, fa-plus | FN-M10-5.5.3 |
| EL-M10-S15-019 | card | visible-default | "Belum ada soalan" | FN-M10-5.5.4 |
| EL-M10-S15-020 | text | visible-default | "Belum ada soalan" | FN-M10-5.5.4 |
| EL-M10-S15-021 | text | visible-default | "Cipta soalan MCQ peribadi dengan bahan rujukan untuk pelajar anda." | FN-M10-5.5.4 |
| EL-M10-S15-022 | link | visible-default | "Soalan & Rujukan Baru", → /guru/soalan-guru/cipta, fa-plus | FN-M10-5.5.4 |

#### S16 — `/guru/soalan-guru/cipta` (189 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S16-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S16-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S16-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S16-004 | card | visible-default | "Panduan: Cara Cipta Soalan & Rujukan" | FN-M10-5.6.1 |
| EL-M10-S16-005 | heading | visible-default | "Panduan: Cara Cipta Soalan & Rujukan" | FN-M10-5.6.1 |
| EL-M10-S16-006 | toggle | visible-default | "Sembunyikan Panduan Baca Panduan Dulu!", fa-eye-slash | FN-M10-5.6.1 |
| EL-M10-S16-007 | text | visible-default | "Apa itu Soalan & Rujukan?", fa-question-circle | FN-M10-5.6.1 |
| EL-M10-S16-008 | text | visible-default | "Feature ini membolehkan anda berdasarkan mana-mana bahan rujukan — video YouTube, buku dig" | FN-M10-5.6.1 |
| EL-M10-S16-009 | text | visible-default | "cipta soalan MCQ sendiri" | FN-M10-5.6.1 |
| EL-M10-S16-010 | text | visible-default | "Misi Harian" | FN-M10-5.6.1 |
| EL-M10-S16-011 | text | visible-default | "Langkah Demi Langkah", fa-list-ol | FN-M10-5.6.1 |
| EL-M10-S16-012 | badge | visible-default | "1" | FN-M10-5.6.1 |
| EL-M10-S16-013 | text | visible-default | "Cari bahan rujukan di internet" | FN-M10-5.6.1 |
| EL-M10-S16-014 | text | visible-default | "Contoh: Cari "Sejarah Tingkatan 5 Bab 1" di YouTube. Atau buka buku digital di Anyflip. At" | FN-M10-5.6.1 |
| EL-M10-S16-015 | badge | visible-default | "2" | FN-M10-5.6.1 |
| EL-M10-S16-016 | text | visible-default | "Copy link & paste di ruangan "Link Rujukan"" | FN-M10-5.6.1 |
| EL-M10-S16-017 | text | visible-default | "Paste link penuh dari mana-mana sumber:" | FN-M10-5.6.1 |
| EL-M10-S16-018 | text | visible-default | "AUTO EMBED" | FN-M10-5.6.1 |
| EL-M10-S16-019 | text | visible-default | "YouTube — video terus nampak dalam page" | FN-M10-5.6.1 |
| EL-M10-S16-020 | text | visible-default | "https://www.youtube.com/watch?v=abc123" | FN-M10-5.6.1 |
| EL-M10-S16-021 | text | visible-default | "Pelajar boleh tonton terus tanpa keluar platform." | FN-M10-5.6.1 |
| EL-M10-S16-022 | text | visible-default | "AUTO EMBED" | FN-M10-5.6.1 |
| EL-M10-S16-023 | text | visible-default | "Anyflip — buku digital nampak dalam page" | FN-M10-5.6.1 |
| EL-M10-S16-024 | text | visible-default | "https://anyflip.com/abcd/efgh" | FN-M10-5.6.1 |
| EL-M10-S16-025 | text | visible-default | "Pelajar boleh selak buku digital terus tanpa keluar platform." | FN-M10-5.6.1 |
| EL-M10-S16-026 | text | visible-default | "AUTO EMBED" | FN-M10-5.6.1 |
| EL-M10-S16-027 | text | visible-default | "Canva — slide presentation nampak dalam page" | FN-M10-5.6.1 |
| EL-M10-S16-028 | text | visible-default | "https://www.canva.com/design/abc123/view" | FN-M10-5.6.1 |
| EL-M10-S16-029 | text | visible-default | "Pelajar boleh lihat slide terus tanpa keluar platform." | FN-M10-5.6.1 |
| EL-M10-S16-030 | text | visible-default | "KLIK BUKA" | FN-M10-5.6.1 |
| EL-M10-S16-031 | text | visible-default | "PDF / Google Drive / Lain-lain" | FN-M10-5.6.1 |
| EL-M10-S16-032 | text | visible-default | "https://drive.google.com/file/d/abc123" | FN-M10-5.6.1 |
| EL-M10-S16-033 | text | visible-default | "Pelajar klik butang untuk buka dalam tab baru. Tak auto-embed." | FN-M10-5.6.1 |
| EL-M10-S16-034 | badge | visible-default | "3" | FN-M10-5.6.1 |
| EL-M10-S16-035 | text | visible-default | "Pilih subjek yang berkaitan" | FN-M10-5.6.1 |
| EL-M10-S16-036 | text | visible-default | "Pilih dari dropdown. Ini penting supaya soalan anda dikategorikan dengan betul." | FN-M10-5.6.1 |
| EL-M10-S16-037 | badge | visible-default | "4" | FN-M10-5.6.1 |
| EL-M10-S16-038 | text | visible-default | "Tulis soalan MCQ (pilihan berganda)" | FN-M10-5.6.1 |
| EL-M10-S16-039 | text | visible-default | "Tulis soalan, kemudian isi 4 pilihan jawapan (A, B, C, D). di sebelah jawapan yang BETUL u" | FN-M10-5.6.1 |
| EL-M10-S16-040 | text | visible-default | "Klik pada bulatan hijau" | FN-M10-5.6.1 |
| EL-M10-S16-041 | badge | visible-default | "5" | FN-M10-5.6.1 |
| EL-M10-S16-042 | text | visible-default | "Simpan & gunakan dalam Misi Harian" | FN-M10-5.6.1 |
| EL-M10-S16-043 | text | visible-default | "Selepas simpan, pergi ke → pilih jenis → soalan anda akan digunakan. Pelajar akan nampak l" | FN-M10-5.6.1 |
| EL-M10-S16-044 | text | visible-default | "Misi Harian" | FN-M10-5.6.1 |
| EL-M10-S16-045 | text | visible-default | ""Soalan & Rujukan"" | FN-M10-5.6.1 |
| EL-M10-S16-046 | text | visible-default | "Tips Menulis Soalan Yang Baik", fa-lightbulb | FN-M10-5.6.1 |
| EL-M10-S16-047 | text | visible-default | "Soalan mestilah — elakkan ayat berbelit" | FN-M10-5.6.1 |
| EL-M10-S16-048 | text | visible-default | "✓" | FN-M10-5.6.1 |
| EL-M10-S16-049 | text | visible-default | "jelas dan mudah difahami" | FN-M10-5.6.1 |
| EL-M10-S16-050 | text | visible-default | "Pastikan — elakkan jawapan yang samar" | FN-M10-5.6.1 |
| EL-M10-S16-051 | text | visible-default | "✓" | FN-M10-5.6.1 |
| EL-M10-S16-052 | text | visible-default | "hanya SATU jawapan yang betul" | FN-M10-5.6.1 |
| EL-M10-S16-053 | text | visible-default | "Pilihan jawapan salah mestilah — jangan letak jawapan yang jelas salah" | FN-M10-5.6.1 |
| EL-M10-S16-054 | text | visible-default | "✓" | FN-M10-5.6.1 |
| EL-M10-S16-055 | text | visible-default | "munasabah" | FN-M10-5.6.1 |
| EL-M10-S16-056 | text | visible-default | "Tulis — ini membantu pelajar faham kenapa jawapan tu betul" | FN-M10-5.6.1 |
| EL-M10-S16-057 | text | visible-default | "✓" | FN-M10-5.6.1 |
| EL-M10-S16-058 | text | visible-default | "penjelasan jawapan" | FN-M10-5.6.1 |
| EL-M10-S16-059 | text | visible-default | "Rujuk — pastikan soalan relevan dengan peperiksaan" | FN-M10-5.6.1 |
| EL-M10-S16-060 | text | visible-default | "✓" | FN-M10-5.6.1 |
| EL-M10-S16-061 | text | visible-default | "silibus SPM (DSKP)" | FN-M10-5.6.1 |
| EL-M10-S16-062 | text | visible-default | "Elakkan soalan terlalu mudah atau terlalu sukar —" | FN-M10-5.6.1 |
| EL-M10-S16-063 | text | visible-default | "⚠" | FN-M10-5.6.1 |
| EL-M10-S16-064 | text | visible-default | "campurkan aras" | FN-M10-5.6.1 |
| EL-M10-S16-065 | form | visible-default | (no text) | FN-M10-5.6.2 |
| EL-M10-S16-066 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-5.6.2 |
| EL-M10-S16-067 | card | visible-default | "1 Rujukan & Subjek" | FN-M10-5.6.2 |
| EL-M10-S16-068 | heading | visible-default | "1 Rujukan & Subjek" | FN-M10-5.6.2 |
| EL-M10-S16-069 | badge | visible-default | "1" | FN-M10-5.6.2 |
| EL-M10-S16-070 | label | visible-default | "Link Rujukan (YouTube, Anyflip, PDF, dll.)" | FN-M10-5.6.2 |
| EL-M10-S16-071 | input | visible-default | label "Link Rujukan (YouTube, Anyflip, PDF, dll.)", `youtube_url`, ph "https://youtube.com/... atau https://anyflip.com/... atau mana-mana link", type url | FN-M10-5.6.2 |
| EL-M10-S16-072 | text | conditional | "YouTube — auto embed. Pelajar boleh tonton terus.", fa-check-circle | FN-M10-5.6.2 |
| EL-M10-S16-073 | text | hidden-only | "Anyflip — auto embed. Pelajar boleh selak buku terus.", fa-check-circle | FN-M10-5.6.2 |
| EL-M10-S16-074 | text | hidden-only | "Canva — auto embed. Pelajar boleh lihat slide terus.", fa-check-circle | FN-M10-5.6.2 |
| EL-M10-S16-075 | text | conditional | "Link rujukan:", fa-external-link-alt | FN-M10-5.6.2 |
| EL-M10-S16-076 | link | hidden-only | (no text) | FN-M10-5.6.2 |
| EL-M10-S16-077 | text | conditional | "Link ini akan dipaparkan kepada pelajar sebagai butang klik. Pelajar perlu klik untuk buka", fa-info-circle | FN-M10-5.6.2 |
| EL-M10-S16-078 | label | visible-default | "Tajuk Rujukan" | FN-M10-5.6.3 |
| EL-M10-S16-079 | input | visible-default | label "Tajuk Rujukan", `youtube_title`, ph "cth: Video Bab 3 Algebra atau Nota Anyflip Sejarah" | FN-M10-5.6.3 |
| EL-M10-S16-080 | label | visible-default | "Subjek *" | FN-M10-5.6.4 |
| EL-M10-S16-081 | select | visible-default | label "Subjek *", `subject_id`, 32 options | FN-M10-5.6.4 |
| EL-M10-S16-082 | label | visible-default | "Tahap Pendidikan" | FN-M10-5.6.4 |
| EL-M10-S16-083 | select | visible-default | label "Tahap Pendidikan", `education_level_id`, 12 options | FN-M10-5.6.4 |
| EL-M10-S16-084 | label | visible-default | "Bab" | FN-M10-5.6.5 |
| EL-M10-S16-085 | select | visible-default | `chapter_id`, 1 options | FN-M10-5.6.5 |
| EL-M10-S16-086 | button | visible-default | fa-plus | FN-M10-5.6.5 |
| EL-M10-S16-087 | text | conditional | "Bab Baru", fa-plus-circle | FN-M10-5.6.5 |
| EL-M10-S16-088 | input | conditional | ph "No.", type number | FN-M10-5.6.5 |
| EL-M10-S16-089 | input | conditional | ph "Nama bab..." | FN-M10-5.6.5 |
| EL-M10-S16-090 | button | conditional | "Batal" | FN-M10-5.6.5 |
| EL-M10-S16-091 | button | conditional | "Simpan", fa-check | FN-M10-5.6.5 |
| EL-M10-S16-092 | label | visible-default | "Topik" | FN-M10-5.6.5 |
| EL-M10-S16-093 | select | visible-default | `topic_id`, 1 options | FN-M10-5.6.5 |
| EL-M10-S16-094 | button | visible-default | fa-plus | FN-M10-5.6.5 |
| EL-M10-S16-095 | text | hidden-only | "Topik Baru", fa-plus-circle | FN-M10-5.6.5 |
| EL-M10-S16-096 | input | hidden-only | ph "Nama topik..." | FN-M10-5.6.5 |
| EL-M10-S16-097 | button | hidden-only | "Batal" | FN-M10-5.6.5 |
| EL-M10-S16-098 | button | hidden-only | "Simpan", fa-check | FN-M10-5.6.5 |
| EL-M10-S16-099 | text | visible-default | "Pilih Subjek + Tahap dahulu untuk muat Bab & Topik secara automatik.", fa-info-circle | FN-M10-5.6.5 |
| EL-M10-S16-100 | label | visible-default | "Gambarajah (optional)" | FN-M10-5.6.6 |
| EL-M10-S16-101 | input | visible-default | label "Gambarajah (optional)", `image`, type file | FN-M10-5.6.6 |
| EL-M10-S16-102 | text | visible-default | "JPG, PNG — max 5MB. Gambarajah akan dipaparkan bersama soalan." | FN-M10-5.6.6 |
| EL-M10-S16-103 | card | visible-default | "Kelas Sasaran" | FN-M10-5.6.7 |
| EL-M10-S16-104 | heading | visible-default | "Kelas Sasaran" | FN-M10-5.6.7 |
| EL-M10-S16-105 | text | visible-default | "Pilih kelas yang akan menggunakan soalan ini (boleh pilih lebih dari satu)" | FN-M10-5.6.7 |
| EL-M10-S16-106 | empty-state | visible-default | "Tiada kelas ditemui." | FN-M10-5.6.7 |
| EL-M10-S16-107 | link | visible-default | "Cipta kelas dahulu", → /guru/kelas/cipta | FN-M10-5.6.7 |
| EL-M10-S16-108 | card | visible-default | "2 Soalan MCQ" | FN-M10-5.6.8 |
| EL-M10-S16-109 | heading | visible-default | "2 Soalan MCQ" | FN-M10-5.6.8 |
| EL-M10-S16-110 | badge | visible-default | "2" | FN-M10-5.6.8 |
| EL-M10-S16-111 | button | visible-default | "Tambah Soalan", fa-plus | FN-M10-5.6.8 |
| EL-M10-S16-112 | text | hidden-only | "Soalan" | FN-M10-5.6.8 |
| EL-M10-S16-113 | button | hidden-only | fa-trash | FN-M10-5.6.8 |
| EL-M10-S16-114 | textarea | hidden-only | ph "Tulis soalan di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-115 | text | hidden-only | "Pilihan Jawapan" | FN-M10-5.6.8 |
| EL-M10-S16-116 | text | hidden-only | "*" | FN-M10-5.6.8 |
| EL-M10-S16-117 | text | hidden-only | "— Klik bulatan hijau untuk tandakan jawapan betul" | FN-M10-5.6.8 |
| EL-M10-S16-118 | label | hidden-only | "A" | FN-M10-5.6.8 |
| EL-M10-S16-119 | radio | hidden-only | type radio | FN-M10-5.6.8 |
| EL-M10-S16-120 | textarea | hidden-only | ph "Taip pilihan jawapan A di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-121 | label | hidden-only | "B" | FN-M10-5.6.8 |
| EL-M10-S16-122 | radio | hidden-only | type radio | FN-M10-5.6.8 |
| EL-M10-S16-123 | textarea | hidden-only | ph "Taip pilihan jawapan B di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-124 | label | hidden-only | "C" | FN-M10-5.6.8 |
| EL-M10-S16-125 | radio | hidden-only | type radio | FN-M10-5.6.8 |
| EL-M10-S16-126 | textarea | hidden-only | ph "Taip pilihan jawapan C di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-127 | label | hidden-only | "D" | FN-M10-5.6.8 |
| EL-M10-S16-128 | radio | hidden-only | type radio | FN-M10-5.6.8 |
| EL-M10-S16-129 | textarea | hidden-only | ph "Taip pilihan jawapan D di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-130 | text | hidden-only | "Penjelasan Jawapan" | FN-M10-5.6.8 |
| EL-M10-S16-131 | text | hidden-only | "(opsional — membantu pelajar faham kenapa jawapan itu betul)" | FN-M10-5.6.8 |
| EL-M10-S16-132 | textarea | hidden-only | ph "Terangkan kenapa jawapan yang dipilih adalah betul. Ini akan dipaparkan selepas pelajar me" | FN-M10-5.6.8 |
| EL-M10-S16-133 | text | visible-default | "Soalan" | FN-M10-5.6.8 |
| EL-M10-S16-134 | text | visible-default | "1" | FN-M10-5.6.8 |
| EL-M10-S16-135 | button | conditional | fa-trash | FN-M10-5.6.8 |
| EL-M10-S16-136 | textarea | visible-default | `questions[0][question_text]`, ph "Tulis soalan di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-137 | text | visible-default | "Pilihan Jawapan" | FN-M10-5.6.8 |
| EL-M10-S16-138 | text | visible-default | "*" | FN-M10-5.6.8 |
| EL-M10-S16-139 | text | visible-default | "— Klik bulatan hijau untuk tandakan jawapan betul" | FN-M10-5.6.8 |
| EL-M10-S16-140 | label | visible-default | "A" | FN-M10-5.6.8 |
| EL-M10-S16-141 | radio | visible-default | label "A", `questions[0][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-142 | badge | visible-default | "A" | FN-M10-5.6.8 |
| EL-M10-S16-143 | textarea | visible-default | `questions[0][option_a]`, ph "Taip pilihan jawapan A di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-144 | label | visible-default | "B" | FN-M10-5.6.8 |
| EL-M10-S16-145 | radio | visible-default | label "B", `questions[0][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-146 | badge | visible-default | "B" | FN-M10-5.6.8 |
| EL-M10-S16-147 | textarea | visible-default | `questions[0][option_b]`, ph "Taip pilihan jawapan B di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-148 | label | visible-default | "C" | FN-M10-5.6.8 |
| EL-M10-S16-149 | radio | visible-default | label "C", `questions[0][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-150 | badge | visible-default | "C" | FN-M10-5.6.8 |
| EL-M10-S16-151 | textarea | visible-default | `questions[0][option_c]`, ph "Taip pilihan jawapan C di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-152 | label | visible-default | "D" | FN-M10-5.6.8 |
| EL-M10-S16-153 | radio | visible-default | label "D", `questions[0][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-154 | badge | visible-default | "D" | FN-M10-5.6.8 |
| EL-M10-S16-155 | textarea | visible-default | `questions[0][option_d]`, ph "Taip pilihan jawapan D di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-156 | text | visible-default | "Penjelasan Jawapan" | FN-M10-5.6.8 |
| EL-M10-S16-157 | text | visible-default | "(opsional — membantu pelajar faham kenapa jawapan itu betul)" | FN-M10-5.6.8 |
| EL-M10-S16-158 | textarea | visible-default | `questions[0][explanation]`, ph "Terangkan kenapa jawapan yang dipilih adalah betul. Ini akan dipaparkan selepas pelajar me" | FN-M10-5.6.8 |
| EL-M10-S16-159 | link | visible-default | "Kembali", → /guru/soalan-guru, fa-arrow-left | FN-M10-5.6.9 |
| EL-M10-S16-160 | text | visible-default | "1 soalan" | FN-M10-5.6.9 |
| EL-M10-S16-161 | button | visible-default | "Simpan Soalan", fa-save | FN-M10-5.6.9 |
| EL-M10-S16-162 | link | conditional | "https://example.com/rujukan.pdf", → https://example.com/rujukan.pdf | FN-M10-5.6.2 |
| EL-M10-S16-163 | text | conditional | "Soalan" | FN-M10-5.6.8 |
| EL-M10-S16-164 | text | conditional | "2" | FN-M10-5.6.8 |
| EL-M10-S16-165 | button | conditional | fa-trash | FN-M10-5.6.8 |
| EL-M10-S16-166 | textarea | conditional | `questions[1][question_text]`, ph "Tulis soalan di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-167 | text | conditional | "Pilihan Jawapan" | FN-M10-5.6.8 |
| EL-M10-S16-168 | text | conditional | "*" | FN-M10-5.6.8 |
| EL-M10-S16-169 | text | conditional | "— Klik bulatan hijau untuk tandakan jawapan betul" | FN-M10-5.6.8 |
| EL-M10-S16-170 | label | conditional | "A" | FN-M10-5.6.8 |
| EL-M10-S16-171 | radio | conditional | label "A", `questions[1][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-172 | badge | conditional | "A" | FN-M10-5.6.8 |
| EL-M10-S16-173 | textarea | conditional | `questions[1][option_a]`, ph "Taip pilihan jawapan A di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-174 | label | conditional | "B" | FN-M10-5.6.8 |
| EL-M10-S16-175 | radio | conditional | label "B", `questions[1][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-176 | badge | conditional | "B" | FN-M10-5.6.8 |
| EL-M10-S16-177 | textarea | conditional | `questions[1][option_b]`, ph "Taip pilihan jawapan B di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-178 | label | conditional | "C" | FN-M10-5.6.8 |
| EL-M10-S16-179 | radio | conditional | label "C", `questions[1][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-180 | badge | conditional | "C" | FN-M10-5.6.8 |
| EL-M10-S16-181 | textarea | conditional | `questions[1][option_c]`, ph "Taip pilihan jawapan C di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-182 | label | conditional | "D" | FN-M10-5.6.8 |
| EL-M10-S16-183 | radio | conditional | label "D", `questions[1][correct_answer]`, type radio | FN-M10-5.6.8 |
| EL-M10-S16-184 | badge | conditional | "D" | FN-M10-5.6.8 |
| EL-M10-S16-185 | textarea | conditional | `questions[1][option_d]`, ph "Taip pilihan jawapan D di sini..." | FN-M10-5.6.8 |
| EL-M10-S16-186 | text | conditional | "Penjelasan Jawapan" | FN-M10-5.6.8 |
| EL-M10-S16-187 | text | conditional | "(opsional — membantu pelajar faham kenapa jawapan itu betul)" | FN-M10-5.6.8 |
| EL-M10-S16-188 | textarea | conditional | `questions[1][explanation]`, ph "Terangkan kenapa jawapan yang dipilih adalah betul. Ini akan dipaparkan selepas pelajar me" | FN-M10-5.6.8 |
| EL-M10-S16-189 | link | hidden-only | "https://www.youtube.com/watch?v=dQw4w9WgXcQ", → https://www.youtube.com/watch?v=dQw4w9WgXcQ | FN-M10-5.6.2 |

#### S17 — `/guru/soalan-berstruktur` (72 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S17-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S17-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S17-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S17-004 | heading | visible-default | "Soalan Berstruktur" | FN-M10-6.1.1 |
| EL-M10-S17-005 | text | visible-default | "Cipta & urus soalan berstruktur mengikut piawaian SPM KPM" | FN-M10-6.1.1 |
| EL-M10-S17-006 | link | visible-default | "Cipta Soalan", → /guru/soalan-berstruktur/cipta, fa-plus | FN-M10-6.1.1 |
| EL-M10-S17-007 | card | visible-default | "Subjek" | FN-M10-6.1.2 |
| EL-M10-S17-008 | form | visible-default | (no text) | FN-M10-6.1.2 |
| EL-M10-S17-009 | label | visible-default | "Subjek" | FN-M10-6.1.2 |
| EL-M10-S17-010 | select | visible-default | label "Subjek", `subject_id`, 32 options | FN-M10-6.1.2 |
| EL-M10-S17-011 | label | visible-default | "Tingkatan" | FN-M10-6.1.2 |
| EL-M10-S17-012 | select | visible-default | label "Tingkatan", `education_level_id`, 12 options | FN-M10-6.1.2 |
| EL-M10-S17-013 | label | visible-default | "Status" | FN-M10-6.1.2 |
| EL-M10-S17-014 | select | visible-default | label "Status", `status`, 3 options | FN-M10-6.1.2 |
| EL-M10-S17-015 | button | visible-default | "Tapis", fa-filter | FN-M10-6.1.2 |
| EL-M10-S17-016 | card | visible-default | "#" | FN-M10-6.1.3 |
| EL-M10-S17-017 | table | visible-default | (no text) | FN-M10-6.1.3 |
| EL-M10-S17-018 | link | visible-default | "Soalan Oleh: <person> 2 Bab 7 Tingkatan 5 (2019) I...", → /guru/soalan-berstruktur/4454 | FN-M10-6.1.3 |
| EL-M10-S17-019 | badge | visible-default | "Perniagaan" | FN-M10-6.1.3 |
| EL-M10-S17-020 | badge | visible-default | "Public", fa-globe | FN-M10-6.1.3 |
| EL-M10-S17-021 | badge | visible-default | "Terbit" | FN-M10-6.1.3 |
| EL-M10-S17-022 | link | visible-default | → /guru/soalan-berstruktur/4454, fa-eye | FN-M10-6.1.3 |
| EL-M10-S17-023 | link | visible-default | → /guru/soalan-berstruktur/4454/edit, fa-edit | FN-M10-6.1.3 |
| EL-M10-S17-024 | form | visible-default | (no text) | FN-M10-6.1.4 |
| EL-M10-S17-025 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-6.1.4 |
| EL-M10-S17-026 | button | visible-default | fa-toggle-on | FN-M10-6.1.4 |
| EL-M10-S17-027 | link | visible-default | "Soalan Oleh: <person> 2 Bab 7 Tingkatan 5 (2019) I...", → /guru/soalan-berstruktur/4455 | FN-M10-6.1.3 |
| EL-M10-S17-028 | badge | visible-default | "Perniagaan" | FN-M10-6.1.3 |
| EL-M10-S17-029 | badge | visible-default | "Public", fa-globe | FN-M10-6.1.3 |
| EL-M10-S17-030 | badge | visible-default | "Terbit" | FN-M10-6.1.3 |
| EL-M10-S17-031 | link | visible-default | → /guru/soalan-berstruktur/4455, fa-eye | FN-M10-6.1.3 |
| EL-M10-S17-032 | link | visible-default | → /guru/soalan-berstruktur/4455/edit, fa-edit | FN-M10-6.1.3 |
| EL-M10-S17-033 | form | visible-default | (no text) | FN-M10-6.1.4 |
| EL-M10-S17-034 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-6.1.4 |
| EL-M10-S17-035 | button | visible-default | fa-toggle-on | FN-M10-6.1.4 |
| EL-M10-S17-036 | link | visible-default | "Soalan Oleh: <person> 2 Bab 7 Tingkatan 5 (2019) I...", → /guru/soalan-berstruktur/4456 | FN-M10-6.1.3 |
| EL-M10-S17-037 | badge | visible-default | "Perniagaan" | FN-M10-6.1.3 |
| EL-M10-S17-038 | badge | visible-default | "Public", fa-globe | FN-M10-6.1.3 |
| EL-M10-S17-039 | badge | visible-default | "Terbit" | FN-M10-6.1.3 |
| EL-M10-S17-040 | link | visible-default | → /guru/soalan-berstruktur/4456, fa-eye | FN-M10-6.1.3 |
| EL-M10-S17-041 | link | visible-default | → /guru/soalan-berstruktur/4456/edit, fa-edit | FN-M10-6.1.3 |
| EL-M10-S17-042 | form | visible-default | (no text) | FN-M10-6.1.4 |
| EL-M10-S17-043 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-6.1.4 |
| EL-M10-S17-044 | button | visible-default | fa-toggle-on | FN-M10-6.1.4 |
| EL-M10-S17-045 | text | conditional | "« Previous" | FN-M10-6.1.5 |
| EL-M10-S17-046 | pagination | conditional | "Next »", → /guru/soalan-berstruktur?page=2 | FN-M10-6.1.5 |
| EL-M10-S17-047 | text | visible-default | "Showing to of results" | FN-M10-6.1.5 |
| EL-M10-S17-048 | text | visible-default | "1" | FN-M10-6.1.5 |
| EL-M10-S17-049 | text | visible-default | "20" | FN-M10-6.1.5 |
| EL-M10-S17-050 | text | visible-default | "4061" | FN-M10-6.1.5 |
| EL-M10-S17-051 | text | visible-default | "1" | FN-M10-6.1.5 |
| EL-M10-S17-052 | pagination | visible-default | "2", → /guru/soalan-berstruktur?page=2 | FN-M10-6.1.5 |
| EL-M10-S17-053 | pagination | visible-default | "3", → /guru/soalan-berstruktur?page=3 | FN-M10-6.1.5 |
| EL-M10-S17-054 | pagination | visible-default | "4", → /guru/soalan-berstruktur?page=4 | FN-M10-6.1.5 |
| EL-M10-S17-055 | pagination | visible-default | "5", → /guru/soalan-berstruktur?page=5 | FN-M10-6.1.5 |
| EL-M10-S17-056 | pagination | visible-default | "6", → /guru/soalan-berstruktur?page=6 | FN-M10-6.1.5 |
| EL-M10-S17-057 | pagination | visible-default | "7", → /guru/soalan-berstruktur?page=7 | FN-M10-6.1.5 |
| EL-M10-S17-058 | pagination | visible-default | "8", → /guru/soalan-berstruktur?page=8 | FN-M10-6.1.5 |
| EL-M10-S17-059 | pagination | visible-default | "9", → /guru/soalan-berstruktur?page=9 | FN-M10-6.1.5 |
| EL-M10-S17-060 | pagination | visible-default | "10", → /guru/soalan-berstruktur?page=10 | FN-M10-6.1.5 |
| EL-M10-S17-061 | text | visible-default | "..." | FN-M10-6.1.5 |
| EL-M10-S17-062 | pagination | visible-default | "203", → /guru/soalan-berstruktur?page=203 | FN-M10-6.1.5 |
| EL-M10-S17-063 | pagination | visible-default | "204", → /guru/soalan-berstruktur?page=204 | FN-M10-6.1.5 |
| EL-M10-S17-064 | pagination | visible-default | → /guru/soalan-berstruktur?page=2, svg | FN-M10-6.1.5 |
| EL-M10-S17-065 | card | conditional | "Cipta soalan pertama" | FN-M10-6.1.6 |
| EL-M10-S17-066 | empty-state | conditional | "Tiada soalan berstruktur lagi" | FN-M10-6.1.6 |
| EL-M10-S17-067 | link | conditional | "Cipta soalan pertama", → /guru/soalan-berstruktur/cipta, fa-plus | FN-M10-6.1.6 |
| EL-M10-S17-068 | link | conditional | "Soalan Oleh: <person> 2 Bab 2 Tingkatan 5 (2020) I...", → /guru/soalan-berstruktur/4352 | FN-M10-6.1.3 |
| EL-M10-S17-069 | link | conditional | "Soalan Oleh: <person> 2 Bab 4 Tingkatan 4 (2020) I...", → /guru/soalan-berstruktur/3841 | FN-M10-6.1.3 |
| EL-M10-S17-070 | link | conditional | "Soalan Oleh: <person> 2 Bab 4 Tingkatan 5 (2019) I...", → /guru/soalan-berstruktur/4097 | FN-M10-6.1.3 |
| EL-M10-S17-071 | pagination | hidden-only | "« Previous", → /guru/soalan-berstruktur?page=1 | FN-M10-6.1.5 |
| EL-M10-S17-072 | pagination | conditional | → /guru/soalan-berstruktur?page=3, svg | FN-M10-6.1.5 |

#### S18 — `/guru/soalan-berstruktur/cipta` (987 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S18-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S18-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S18-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S18-004 | link | visible-default | → /guru/soalan-berstruktur, fa-arrow-left | FN-M10-6.2.1 |
| EL-M10-S18-005 | heading | visible-default | "Cipta Soalan Berstruktur" | FN-M10-6.2.1 |
| EL-M10-S18-006 | text | visible-default | "Format Kertas 2 SPM/PT3 — Piawaian KPM" | FN-M10-6.2.1 |
| EL-M10-S18-007 | form | visible-default | (no text) | FN-M10-6.2.1 |
| EL-M10-S18-008 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-6.2.1 |
| EL-M10-S18-009 | card | visible-default | "Maklumat Soalan" | FN-M10-6.2.1 |
| EL-M10-S18-010 | heading | visible-default | "Maklumat Soalan" | FN-M10-6.2.1 |
| EL-M10-S18-011 | label | visible-default | "Subjek *" | FN-M10-6.2.2 |
| EL-M10-S18-012 | select | visible-default | label "Subjek *", `subject_id`, 32 options | FN-M10-6.2.2 |
| EL-M10-S18-013 | label | visible-default | "Tingkatan *" | FN-M10-6.2.2 |
| EL-M10-S18-014 | select | visible-default | label "Tingkatan *", `education_level_id`, 12 options | FN-M10-6.2.2 |
| EL-M10-S18-015 | label | visible-default | "Aras KBAT *" | FN-M10-6.2.2 |
| EL-M10-S18-016 | select | visible-default | label "Aras KBAT *", `kbat_level`, 6 options | FN-M10-6.2.2 |
| EL-M10-S18-017 | label | visible-default | "Bab" | FN-M10-6.2.3 |
| EL-M10-S18-018 | select | visible-default | `chapter_id`, 1 options | FN-M10-6.2.3 |
| EL-M10-S18-019 | button | visible-default | fa-plus | FN-M10-6.2.3 |
| EL-M10-S18-020 | text | conditional | "Bab Baru", fa-plus-circle | FN-M10-6.2.3 |
| EL-M10-S18-021 | input | conditional | ph "No.", type number | FN-M10-6.2.3 |
| EL-M10-S18-022 | input | conditional | ph "Nama bab..." | FN-M10-6.2.3 |
| EL-M10-S18-023 | button | conditional | "Batal" | FN-M10-6.2.3 |
| EL-M10-S18-024 | button | conditional | "Simpan", fa-check | FN-M10-6.2.3 |
| EL-M10-S18-025 | label | visible-default | "Topik" | FN-M10-6.2.3 |
| EL-M10-S18-026 | select | visible-default | `topic_id`, 1 options | FN-M10-6.2.3 |
| EL-M10-S18-027 | button | visible-default | fa-plus | FN-M10-6.2.3 |
| EL-M10-S18-028 | text | conditional | "Topik Baru", fa-plus-circle | FN-M10-6.2.3 |
| EL-M10-S18-029 | input | conditional | ph "Nama topik..." | FN-M10-6.2.3 |
| EL-M10-S18-030 | button | conditional | "Batal" | FN-M10-6.2.3 |
| EL-M10-S18-031 | button | conditional | "Simpan", fa-check | FN-M10-6.2.3 |
| EL-M10-S18-032 | heading | visible-default | "Pemetaan DSKP" | FN-M10-6.2.4 |
| EL-M10-S18-033 | label | visible-default | "Bidang / Tema" | FN-M10-6.2.4 |
| EL-M10-S18-034 | select | visible-default | 1 options | FN-M10-6.2.4 |
| EL-M10-S18-035 | button | visible-default | fa-plus | FN-M10-6.2.4 |
| EL-M10-S18-036 | text | conditional | "Bidang Baru", fa-plus-circle | FN-M10-6.2.4 |
| EL-M10-S18-037 | input | conditional | ph "Kod" | FN-M10-6.2.4 |
| EL-M10-S18-038 | input | conditional | ph "Nama bidang..." | FN-M10-6.2.4 |
| EL-M10-S18-039 | button | conditional | "Batal" | FN-M10-6.2.4 |
| EL-M10-S18-040 | button | conditional | "Simpan", fa-check | FN-M10-6.2.4 |
| EL-M10-S18-041 | label | visible-default | "Standard Kandungan (SK)" | FN-M10-6.2.4 |
| EL-M10-S18-042 | select | visible-default | 1 options | FN-M10-6.2.4 |
| EL-M10-S18-043 | button | visible-default | fa-plus | FN-M10-6.2.4 |
| EL-M10-S18-044 | text | conditional | "SK Baru", fa-plus-circle | FN-M10-6.2.4 |
| EL-M10-S18-045 | input | conditional | ph "Kod" | FN-M10-6.2.4 |
| EL-M10-S18-046 | input | conditional | ph "Penerangan SK..." | FN-M10-6.2.4 |
| EL-M10-S18-047 | button | conditional | "Batal" | FN-M10-6.2.4 |
| EL-M10-S18-048 | button | conditional | "Simpan", fa-check | FN-M10-6.2.4 |
| EL-M10-S18-049 | label | visible-default | "Standard Pembelajaran (SP)" | FN-M10-6.2.4 |
| EL-M10-S18-050 | select | visible-default | `dskp_sp_id`, 1 options | FN-M10-6.2.4 |
| EL-M10-S18-051 | button | visible-default | fa-plus | FN-M10-6.2.4 |
| EL-M10-S18-052 | text | conditional | "SP Baru", fa-plus-circle | FN-M10-6.2.4 |
| EL-M10-S18-053 | input | conditional | ph "Kod" | FN-M10-6.2.4 |
| EL-M10-S18-054 | input | conditional | ph "Penerangan SP..." | FN-M10-6.2.4 |
| EL-M10-S18-055 | button | conditional | "Batal" | FN-M10-6.2.4 |
| EL-M10-S18-056 | button | conditional | "Simpan", fa-check | FN-M10-6.2.4 |
| EL-M10-S18-057 | text | visible-default | "Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR.", fa-info-circle | FN-M10-6.2.4 |
| EL-M10-S18-058 | label | visible-default | "Jenis Tulisan" | FN-M10-6.2.5 |
| EL-M10-S18-059 | select | visible-default | label "Jenis Tulisan", `script_type`, 4 options | FN-M10-6.2.5 |
| EL-M10-S18-060 | hidden-field | hidden-only | label "Jenis Tulisan", `text_direction`, type hidden | FN-M10-6.2.5 |
| EL-M10-S18-061 | label | visible-default | "Template" | FN-M10-6.2.6 |
| EL-M10-S18-062 | select | visible-default | label "Template", `question_template`, 2 options | FN-M10-6.2.6 |
| EL-M10-S18-063 | label | visible-default | "Visibility *" | FN-M10-6.2.7 |
| EL-M10-S18-064 | label | visible-default | "Public" | FN-M10-6.2.7 |
| EL-M10-S18-065 | radio | hidden-only | label "Public", `visibility`, type radio | FN-M10-6.2.7 |
| EL-M10-S18-066 | select | conditional | `education_level_filter`, 12 options | FN-M10-6.2.7 |
| EL-M10-S18-067 | select | conditional | `classroom_id`, 1 options | FN-M10-6.2.7 |
| EL-M10-S18-068 | label | visible-default | "Stimulus / Teks Soalan Utama *" | FN-M10-6.2.8 |
| EL-M10-S18-069 | toggle | visible-default | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.8 |
| EL-M10-S18-070 | text | conditional | "Asas" | FN-M10-6.2.8 |
| EL-M10-S18-071 | button | conditional | "×" | FN-M10-6.2.8 |
| EL-M10-S18-072 | button | conditional | "÷" | FN-M10-6.2.8 |
| EL-M10-S18-073 | button | conditional | "±" | FN-M10-6.2.8 |
| EL-M10-S18-074 | button | conditional | "≠" | FN-M10-6.2.8 |
| EL-M10-S18-075 | button | conditional | "≥" | FN-M10-6.2.8 |
| EL-M10-S18-076 | button | conditional | "≤" | FN-M10-6.2.8 |
| EL-M10-S18-077 | button | conditional | "≈" | FN-M10-6.2.8 |
| EL-M10-S18-078 | button | conditional | "≡" | FN-M10-6.2.8 |
| EL-M10-S18-079 | button | conditional | "∝" | FN-M10-6.2.8 |
| EL-M10-S18-080 | button | conditional | "°" | FN-M10-6.2.8 |
| EL-M10-S18-081 | button | conditional | "%" | FN-M10-6.2.8 |
| EL-M10-S18-082 | text | conditional | "Kuasa" | FN-M10-6.2.8 |
| EL-M10-S18-083 | button | conditional | "⁰" | FN-M10-6.2.8 |
| EL-M10-S18-084 | button | conditional | "¹" | FN-M10-6.2.8 |
| EL-M10-S18-085 | button | conditional | "²" | FN-M10-6.2.8 |
| EL-M10-S18-086 | button | conditional | "³" | FN-M10-6.2.8 |
| EL-M10-S18-087 | button | conditional | "⁴" | FN-M10-6.2.8 |
| EL-M10-S18-088 | button | conditional | "⁵" | FN-M10-6.2.8 |
| EL-M10-S18-089 | button | conditional | "ⁿ" | FN-M10-6.2.8 |
| EL-M10-S18-090 | button | conditional | "⁻" | FN-M10-6.2.8 |
| EL-M10-S18-091 | button | conditional | "⁺" | FN-M10-6.2.8 |
| EL-M10-S18-092 | button | conditional | "½" | FN-M10-6.2.8 |
| EL-M10-S18-093 | button | conditional | "¼" | FN-M10-6.2.8 |
| EL-M10-S18-094 | button | conditional | "¾" | FN-M10-6.2.8 |
| EL-M10-S18-095 | text | conditional | "Subskrip" | FN-M10-6.2.8 |
| EL-M10-S18-096 | button | conditional | "₀" | FN-M10-6.2.8 |
| EL-M10-S18-097 | button | conditional | "₁" | FN-M10-6.2.8 |
| EL-M10-S18-098 | button | conditional | "₂" | FN-M10-6.2.8 |
| EL-M10-S18-099 | button | conditional | "₃" | FN-M10-6.2.8 |
| EL-M10-S18-100 | button | conditional | "₄" | FN-M10-6.2.8 |
| EL-M10-S18-101 | button | conditional | "ₙ" | FN-M10-6.2.8 |
| EL-M10-S18-102 | button | conditional | "ₓ" | FN-M10-6.2.8 |
| EL-M10-S18-103 | text | conditional | "Matematik" | FN-M10-6.2.8 |
| EL-M10-S18-104 | button | conditional | "√" | FN-M10-6.2.8 |
| EL-M10-S18-105 | button | conditional | "π" | FN-M10-6.2.8 |
| EL-M10-S18-106 | button | conditional | "∞" | FN-M10-6.2.8 |
| EL-M10-S18-107 | button | conditional | "∠" | FN-M10-6.2.8 |
| EL-M10-S18-108 | button | conditional | "∥" | FN-M10-6.2.8 |
| EL-M10-S18-109 | button | conditional | "⊥" | FN-M10-6.2.8 |
| EL-M10-S18-110 | button | conditional | "∴" | FN-M10-6.2.8 |
| EL-M10-S18-111 | button | conditional | "∵" | FN-M10-6.2.8 |
| EL-M10-S18-112 | button | conditional | "∈" | FN-M10-6.2.8 |
| EL-M10-S18-113 | button | conditional | "∉" | FN-M10-6.2.8 |
| EL-M10-S18-114 | button | conditional | "⊂" | FN-M10-6.2.8 |
| EL-M10-S18-115 | button | conditional | "∪" | FN-M10-6.2.8 |
| EL-M10-S18-116 | button | conditional | "∩" | FN-M10-6.2.8 |
| EL-M10-S18-117 | button | conditional | "∫" | FN-M10-6.2.8 |
| EL-M10-S18-118 | button | conditional | "∂" | FN-M10-6.2.8 |
| EL-M10-S18-119 | button | conditional | "∑" | FN-M10-6.2.8 |
| EL-M10-S18-120 | button | conditional | "Δ" | FN-M10-6.2.8 |
| EL-M10-S18-121 | text | conditional | "Anak Panah" | FN-M10-6.2.8 |
| EL-M10-S18-122 | button | conditional | "→" | FN-M10-6.2.8 |
| EL-M10-S18-123 | button | conditional | "←" | FN-M10-6.2.8 |
| EL-M10-S18-124 | button | conditional | "↔" | FN-M10-6.2.8 |
| EL-M10-S18-125 | button | conditional | "↑" | FN-M10-6.2.8 |
| EL-M10-S18-126 | button | conditional | "↓" | FN-M10-6.2.8 |
| EL-M10-S18-127 | button | conditional | "⟶" | FN-M10-6.2.8 |
| EL-M10-S18-128 | button | conditional | "⇌" | FN-M10-6.2.8 |
| EL-M10-S18-129 | text | conditional | "Greek" | FN-M10-6.2.8 |
| EL-M10-S18-130 | button | conditional | "α" | FN-M10-6.2.8 |
| EL-M10-S18-131 | button | conditional | "β" | FN-M10-6.2.8 |
| EL-M10-S18-132 | button | conditional | "γ" | FN-M10-6.2.8 |
| EL-M10-S18-133 | button | conditional | "θ" | FN-M10-6.2.8 |
| EL-M10-S18-134 | button | conditional | "λ" | FN-M10-6.2.8 |
| EL-M10-S18-135 | button | conditional | "μ" | FN-M10-6.2.8 |
| EL-M10-S18-136 | button | conditional | "φ" | FN-M10-6.2.8 |
| EL-M10-S18-137 | button | conditional | "Ω" | FN-M10-6.2.8 |
| EL-M10-S18-138 | text | conditional | "Umum" | FN-M10-6.2.8 |
| EL-M10-S18-139 | button | conditional | "✓" | FN-M10-6.2.8 |
| EL-M10-S18-140 | button | conditional | "✗" | FN-M10-6.2.8 |
| EL-M10-S18-141 | button | conditional | "•" | FN-M10-6.2.8 |
| EL-M10-S18-142 | button | conditional | "─" | FN-M10-6.2.8 |
| EL-M10-S18-143 | textarea | visible-default | label "Stimulus / Teks Soalan Utama *", `stimulus_text`, ph "Masukkan teks soalan utama, situasi, petikan, atau arahan..." | FN-M10-6.2.8 |
| EL-M10-S18-144 | label | visible-default | "Gambar Stimulus (pilihan)" | FN-M10-6.2.8 |
| EL-M10-S18-145 | input | visible-default | label "Gambar Stimulus (pilihan)", `stimulus_image`, type file | FN-M10-6.2.8 |
| EL-M10-S18-146 | card | visible-default | "Sub-Soalan" | FN-M10-6.2.9 |
| EL-M10-S18-147 | heading | visible-default | "Sub-Soalan" | FN-M10-6.2.9 |
| EL-M10-S18-148 | text | visible-default | "Jumlah markah: 1m" | FN-M10-6.2.9 |
| EL-M10-S18-149 | button | visible-default | "Tambah Sub", fa-plus | FN-M10-6.2.9 |
| EL-M10-S18-150 | card | hidden-only | (no text) | FN-M10-6.2.10 |
| EL-M10-S18-151 | input | hidden-only | ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-152 | button | hidden-only | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-153 | label | hidden-only | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-154 | toggle | hidden-only | fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-155 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-156 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-157 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-158 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-159 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-160 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-161 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-162 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-163 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-164 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-165 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-166 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-167 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-168 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-169 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-170 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-171 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-172 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-173 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-174 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-175 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-176 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-177 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-178 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-179 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-180 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-181 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-182 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-183 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-184 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-185 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-186 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-187 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-188 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-189 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-190 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-191 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-192 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-193 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-194 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-195 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-196 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-197 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-198 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-199 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-200 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-201 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-202 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-203 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-204 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-205 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-206 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-207 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-208 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-209 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-210 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-211 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-212 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-213 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-214 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-215 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-216 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-217 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-218 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-219 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-220 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-221 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-222 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-223 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-224 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-225 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-226 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-227 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-228 | textarea | hidden-only | label "Soalan *", ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-229 | label | hidden-only | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-230 | select | hidden-only | label "Jenis Jawapan", 2 options | FN-M10-6.2.10 |
| EL-M10-S18-231 | label | hidden-only | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-232 | input | hidden-only | label "Markah *", type number | FN-M10-6.2.10 |
| EL-M10-S18-233 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-234 | input | hidden-only | label "Jawapan Tepat", type number | FN-M10-6.2.10 |
| EL-M10-S18-235 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-236 | input | hidden-only | label "Toleransi (±)", type number | FN-M10-6.2.10 |
| EL-M10-S18-237 | label | hidden-only | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-238 | button | hidden-only | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-239 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-240 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-241 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-242 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-243 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-244 | label | hidden-only | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-245 | textarea | hidden-only | label "Jalan Kerja / Skema Jawapan Penuh", ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-246 | hidden-field | hidden-only | type hidden | FN-M10-6.2.10 |
| EL-M10-S18-247 | card | visible-default | "(a)" | FN-M10-6.2.10 |
| EL-M10-S18-248 | text | visible-default | "(a)" | FN-M10-6.2.10 |
| EL-M10-S18-249 | input | visible-default | `subs[0][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-250 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-251 | label | visible-default | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-252 | toggle | visible-default | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-253 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-254 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-255 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-256 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-257 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-258 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-259 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-260 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-261 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-262 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-263 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-264 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-265 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-266 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-267 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-268 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-269 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-270 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-271 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-272 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-273 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-274 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-275 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-276 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-277 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-278 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-279 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-280 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-281 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-282 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-283 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-284 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-285 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-286 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-287 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-288 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-289 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-290 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-291 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-292 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-293 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-294 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-295 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-296 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-297 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-298 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-299 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-300 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-301 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-302 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-303 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-304 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-305 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-306 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-307 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-308 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-309 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-310 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-311 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-312 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-313 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-314 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-315 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-316 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-317 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-318 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-319 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-320 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-321 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-322 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-323 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-324 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-325 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-326 | textarea | visible-default | label "Soalan *", `subs[0][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-327 | label | visible-default | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-328 | select | visible-default | label "Jenis Jawapan", `subs[0][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-329 | label | visible-default | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-330 | input | visible-default | label "Markah *", `subs[0][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-331 | label | conditional | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-332 | input | conditional | label "Jawapan Tepat", `subs[0][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-333 | label | conditional | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-334 | input | conditional | label "Toleransi (±)", `subs[0][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-335 | label | visible-default | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-336 | button | visible-default | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-337 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-338 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-339 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-340 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-341 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-342 | select | visible-default | `subs[0][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-343 | input | visible-default | `subs[0][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-344 | input | visible-default | `subs[0][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-345 | text | visible-default | "m" | FN-M10-6.2.11 |
| EL-M10-S18-346 | button | visible-default | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-347 | label | visible-default | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-348 | textarea | visible-default | label "Jalan Kerja / Skema Jawapan Penuh", `subs[0][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-349 | hidden-field | hidden-only | `subs[0][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-350 | text | visible-default | "Draf boleh diterbitkan kemudian dari senarai soalan.", fa-info-circle | FN-M10-6.2.12 |
| EL-M10-S18-351 | button | visible-default | "Simpan Draf", fa-save | FN-M10-6.2.12 |
| EL-M10-S18-352 | button | visible-default | "Simpan & Terbitkan", fa-paper-plane | FN-M10-6.2.12 |
| EL-M10-S18-353 | toggle | conditional | "Tutup Simbol", fa-superscript | FN-M10-6.2.8 |
| EL-M10-S18-354 | card | conditional | "(bi)" | FN-M10-6.2.10 |
| EL-M10-S18-355 | text | conditional | "(bi)" | FN-M10-6.2.10 |
| EL-M10-S18-356 | input | conditional | `subs[1][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-357 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-358 | label | conditional | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-359 | toggle | conditional | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-360 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-361 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-362 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-363 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-364 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-365 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-366 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-367 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-368 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-369 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-370 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-371 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-372 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-373 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-374 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-375 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-376 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-377 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-378 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-379 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-380 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-381 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-382 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-383 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-384 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-385 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-386 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-387 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-388 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-389 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-390 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-391 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-392 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-393 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-394 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-395 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-396 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-397 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-398 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-399 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-400 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-401 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-402 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-403 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-404 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-405 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-406 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-407 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-408 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-409 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-410 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-411 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-412 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-413 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-414 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-415 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-416 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-417 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-418 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-419 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-420 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-421 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-422 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-423 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-424 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-425 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-426 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-427 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-428 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-429 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-430 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-431 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-432 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-433 | textarea | conditional | label "Soalan *", `subs[1][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-434 | label | conditional | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-435 | select | conditional | label "Jenis Jawapan", `subs[1][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-436 | label | conditional | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-437 | input | conditional | label "Markah *", `subs[1][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-438 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-439 | input | hidden-only | label "Jawapan Tepat", `subs[1][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-440 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-441 | input | hidden-only | label "Toleransi (±)", `subs[1][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-442 | label | conditional | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-443 | button | conditional | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-444 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-445 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-446 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-447 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-448 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-449 | select | conditional | `subs[1][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-450 | input | conditional | `subs[1][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-451 | input | conditional | `subs[1][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-452 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-453 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-454 | label | conditional | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-455 | textarea | conditional | label "Jalan Kerja / Skema Jawapan Penuh", `subs[1][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-456 | hidden-field | hidden-only | `subs[1][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-457 | card | conditional | "(bii)" | FN-M10-6.2.10 |
| EL-M10-S18-458 | text | conditional | "(bii)" | FN-M10-6.2.10 |
| EL-M10-S18-459 | input | conditional | `subs[2][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-460 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-461 | label | conditional | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-462 | toggle | conditional | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-463 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-464 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-465 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-466 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-467 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-468 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-469 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-470 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-471 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-472 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-473 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-474 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-475 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-476 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-477 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-478 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-479 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-480 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-481 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-482 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-483 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-484 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-485 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-486 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-487 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-488 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-489 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-490 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-491 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-492 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-493 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-494 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-495 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-496 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-497 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-498 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-499 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-500 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-501 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-502 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-503 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-504 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-505 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-506 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-507 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-508 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-509 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-510 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-511 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-512 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-513 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-514 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-515 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-516 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-517 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-518 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-519 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-520 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-521 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-522 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-523 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-524 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-525 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-526 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-527 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-528 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-529 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-530 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-531 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-532 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-533 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-534 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-535 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-536 | textarea | conditional | label "Soalan *", `subs[2][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-537 | label | conditional | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-538 | select | conditional | label "Jenis Jawapan", `subs[2][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-539 | label | conditional | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-540 | input | conditional | label "Markah *", `subs[2][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-541 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-542 | input | hidden-only | label "Jawapan Tepat", `subs[2][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-543 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-544 | input | hidden-only | label "Toleransi (±)", `subs[2][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-545 | label | conditional | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-546 | button | conditional | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-547 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-548 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-549 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-550 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-551 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-552 | select | conditional | `subs[2][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-553 | input | conditional | `subs[2][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-554 | input | conditional | `subs[2][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-555 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-556 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-557 | label | conditional | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-558 | textarea | conditional | label "Jalan Kerja / Skema Jawapan Penuh", `subs[2][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-559 | hidden-field | hidden-only | `subs[2][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-560 | card | conditional | "(biii)" | FN-M10-6.2.10 |
| EL-M10-S18-561 | text | conditional | "(biii)" | FN-M10-6.2.10 |
| EL-M10-S18-562 | input | conditional | `subs[3][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-563 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-564 | label | conditional | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-565 | toggle | conditional | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-566 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-567 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-568 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-569 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-570 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-571 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-572 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-573 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-574 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-575 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-576 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-577 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-578 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-579 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-580 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-581 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-582 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-583 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-584 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-585 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-586 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-587 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-588 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-589 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-590 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-591 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-592 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-593 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-594 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-595 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-596 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-597 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-598 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-599 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-600 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-601 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-602 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-603 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-604 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-605 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-606 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-607 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-608 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-609 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-610 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-611 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-612 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-613 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-614 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-615 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-616 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-617 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-618 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-619 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-620 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-621 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-622 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-623 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-624 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-625 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-626 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-627 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-628 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-629 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-630 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-631 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-632 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-633 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-634 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-635 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-636 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-637 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-638 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-639 | textarea | conditional | label "Soalan *", `subs[3][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-640 | label | conditional | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-641 | select | conditional | label "Jenis Jawapan", `subs[3][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-642 | label | conditional | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-643 | input | conditional | label "Markah *", `subs[3][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-644 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-645 | input | hidden-only | label "Jawapan Tepat", `subs[3][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-646 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-647 | input | hidden-only | label "Toleransi (±)", `subs[3][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-648 | label | conditional | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-649 | button | conditional | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-650 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-651 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-652 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-653 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-654 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-655 | select | conditional | `subs[3][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-656 | input | conditional | `subs[3][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-657 | input | conditional | `subs[3][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-658 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-659 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-660 | label | conditional | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-661 | textarea | conditional | label "Jalan Kerja / Skema Jawapan Penuh", `subs[3][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-662 | hidden-field | hidden-only | `subs[3][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-663 | card | conditional | "(c)" | FN-M10-6.2.10 |
| EL-M10-S18-664 | text | conditional | "(c)" | FN-M10-6.2.10 |
| EL-M10-S18-665 | input | conditional | `subs[4][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-666 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-667 | label | conditional | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-668 | toggle | conditional | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-669 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-670 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-671 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-672 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-673 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-674 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-675 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-676 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-677 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-678 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-679 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-680 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-681 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-682 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-683 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-684 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-685 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-686 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-687 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-688 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-689 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-690 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-691 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-692 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-693 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-694 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-695 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-696 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-697 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-698 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-699 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-700 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-701 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-702 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-703 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-704 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-705 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-706 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-707 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-708 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-709 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-710 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-711 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-712 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-713 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-714 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-715 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-716 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-717 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-718 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-719 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-720 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-721 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-722 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-723 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-724 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-725 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-726 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-727 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-728 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-729 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-730 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-731 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-732 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-733 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-734 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-735 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-736 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-737 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-738 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-739 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-740 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-741 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-742 | textarea | conditional | label "Soalan *", `subs[4][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-743 | label | conditional | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-744 | select | conditional | label "Jenis Jawapan", `subs[4][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-745 | label | conditional | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-746 | input | conditional | label "Markah *", `subs[4][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-747 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-748 | input | hidden-only | label "Jawapan Tepat", `subs[4][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-749 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-750 | input | hidden-only | label "Toleransi (±)", `subs[4][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-751 | label | conditional | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-752 | button | conditional | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-753 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-754 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-755 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-756 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-757 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-758 | select | conditional | `subs[4][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-759 | input | conditional | `subs[4][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-760 | input | conditional | `subs[4][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-761 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-762 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-763 | select | conditional | `subs[4][rubrics][1][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-764 | input | conditional | `subs[4][rubrics][1][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-765 | input | conditional | `subs[4][rubrics][1][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-766 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-767 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-768 | label | conditional | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-769 | textarea | conditional | label "Jalan Kerja / Skema Jawapan Penuh", `subs[4][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-770 | hidden-field | hidden-only | `subs[4][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-771 | card | conditional | "(d)" | FN-M10-6.2.10 |
| EL-M10-S18-772 | text | conditional | "(d)" | FN-M10-6.2.10 |
| EL-M10-S18-773 | input | conditional | `subs[5][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-774 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-775 | label | conditional | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-776 | toggle | conditional | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-777 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-778 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-779 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-780 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-781 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-782 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-783 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-784 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-785 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-786 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-787 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-788 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-789 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-790 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-791 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-792 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-793 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-794 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-795 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-796 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-797 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-798 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-799 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-800 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-801 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-802 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-803 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-804 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-805 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-806 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-807 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-808 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-809 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-810 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-811 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-812 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-813 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-814 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-815 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-816 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-817 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-818 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-819 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-820 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-821 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-822 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-823 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-824 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-825 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-826 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-827 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-828 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-829 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-830 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-831 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-832 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-833 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-834 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-835 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-836 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-837 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-838 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-839 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-840 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-841 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-842 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-843 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-844 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-845 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-846 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-847 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-848 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-849 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-850 | textarea | conditional | label "Soalan *", `subs[5][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-851 | label | conditional | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-852 | select | conditional | label "Jenis Jawapan", `subs[5][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-853 | label | conditional | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-854 | input | conditional | label "Markah *", `subs[5][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-855 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-856 | input | hidden-only | label "Jawapan Tepat", `subs[5][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-857 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-858 | input | hidden-only | label "Toleransi (±)", `subs[5][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-859 | label | conditional | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-860 | button | conditional | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-861 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-862 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-863 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-864 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-865 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-866 | select | conditional | `subs[5][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-867 | input | conditional | `subs[5][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-868 | input | conditional | `subs[5][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-869 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-870 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-871 | select | conditional | `subs[5][rubrics][1][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-872 | input | conditional | `subs[5][rubrics][1][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-873 | input | conditional | `subs[5][rubrics][1][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-874 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-875 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-876 | select | conditional | `subs[5][rubrics][2][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-877 | input | conditional | `subs[5][rubrics][2][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-878 | input | conditional | `subs[5][rubrics][2][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-879 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-880 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-881 | label | conditional | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-882 | textarea | conditional | label "Jalan Kerja / Skema Jawapan Penuh", `subs[5][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-883 | hidden-field | hidden-only | `subs[5][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-884 | card | conditional | "(e)" | FN-M10-6.2.10 |
| EL-M10-S18-885 | text | conditional | "(e)" | FN-M10-6.2.10 |
| EL-M10-S18-886 | input | conditional | `subs[6][part_label]`, ph "a" | FN-M10-6.2.10 |
| EL-M10-S18-887 | button | conditional | fa-trash | FN-M10-6.2.10 |
| EL-M10-S18-888 | label | conditional | "Soalan *" | FN-M10-6.2.10 |
| EL-M10-S18-889 | toggle | conditional | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.2.10 |
| EL-M10-S18-890 | text | hidden-only | "Asas" | FN-M10-6.2.10 |
| EL-M10-S18-891 | button | hidden-only | "×" | FN-M10-6.2.10 |
| EL-M10-S18-892 | button | hidden-only | "÷" | FN-M10-6.2.10 |
| EL-M10-S18-893 | button | hidden-only | "±" | FN-M10-6.2.10 |
| EL-M10-S18-894 | button | hidden-only | "≠" | FN-M10-6.2.10 |
| EL-M10-S18-895 | button | hidden-only | "≥" | FN-M10-6.2.10 |
| EL-M10-S18-896 | button | hidden-only | "≤" | FN-M10-6.2.10 |
| EL-M10-S18-897 | button | hidden-only | "≈" | FN-M10-6.2.10 |
| EL-M10-S18-898 | button | hidden-only | "≡" | FN-M10-6.2.10 |
| EL-M10-S18-899 | button | hidden-only | "∝" | FN-M10-6.2.10 |
| EL-M10-S18-900 | button | hidden-only | "°" | FN-M10-6.2.10 |
| EL-M10-S18-901 | button | hidden-only | "%" | FN-M10-6.2.10 |
| EL-M10-S18-902 | text | hidden-only | "Kuasa" | FN-M10-6.2.10 |
| EL-M10-S18-903 | button | hidden-only | "⁰" | FN-M10-6.2.10 |
| EL-M10-S18-904 | button | hidden-only | "¹" | FN-M10-6.2.10 |
| EL-M10-S18-905 | button | hidden-only | "²" | FN-M10-6.2.10 |
| EL-M10-S18-906 | button | hidden-only | "³" | FN-M10-6.2.10 |
| EL-M10-S18-907 | button | hidden-only | "⁴" | FN-M10-6.2.10 |
| EL-M10-S18-908 | button | hidden-only | "⁵" | FN-M10-6.2.10 |
| EL-M10-S18-909 | button | hidden-only | "ⁿ" | FN-M10-6.2.10 |
| EL-M10-S18-910 | button | hidden-only | "⁻" | FN-M10-6.2.10 |
| EL-M10-S18-911 | button | hidden-only | "⁺" | FN-M10-6.2.10 |
| EL-M10-S18-912 | button | hidden-only | "½" | FN-M10-6.2.10 |
| EL-M10-S18-913 | button | hidden-only | "¼" | FN-M10-6.2.10 |
| EL-M10-S18-914 | button | hidden-only | "¾" | FN-M10-6.2.10 |
| EL-M10-S18-915 | text | hidden-only | "Subskrip" | FN-M10-6.2.10 |
| EL-M10-S18-916 | button | hidden-only | "₀" | FN-M10-6.2.10 |
| EL-M10-S18-917 | button | hidden-only | "₁" | FN-M10-6.2.10 |
| EL-M10-S18-918 | button | hidden-only | "₂" | FN-M10-6.2.10 |
| EL-M10-S18-919 | button | hidden-only | "₃" | FN-M10-6.2.10 |
| EL-M10-S18-920 | button | hidden-only | "₄" | FN-M10-6.2.10 |
| EL-M10-S18-921 | button | hidden-only | "ₙ" | FN-M10-6.2.10 |
| EL-M10-S18-922 | button | hidden-only | "ₓ" | FN-M10-6.2.10 |
| EL-M10-S18-923 | text | hidden-only | "Matematik" | FN-M10-6.2.10 |
| EL-M10-S18-924 | button | hidden-only | "√" | FN-M10-6.2.10 |
| EL-M10-S18-925 | button | hidden-only | "π" | FN-M10-6.2.10 |
| EL-M10-S18-926 | button | hidden-only | "∞" | FN-M10-6.2.10 |
| EL-M10-S18-927 | button | hidden-only | "∠" | FN-M10-6.2.10 |
| EL-M10-S18-928 | button | hidden-only | "∥" | FN-M10-6.2.10 |
| EL-M10-S18-929 | button | hidden-only | "⊥" | FN-M10-6.2.10 |
| EL-M10-S18-930 | button | hidden-only | "∴" | FN-M10-6.2.10 |
| EL-M10-S18-931 | button | hidden-only | "∵" | FN-M10-6.2.10 |
| EL-M10-S18-932 | button | hidden-only | "∈" | FN-M10-6.2.10 |
| EL-M10-S18-933 | button | hidden-only | "∉" | FN-M10-6.2.10 |
| EL-M10-S18-934 | button | hidden-only | "⊂" | FN-M10-6.2.10 |
| EL-M10-S18-935 | button | hidden-only | "∪" | FN-M10-6.2.10 |
| EL-M10-S18-936 | button | hidden-only | "∩" | FN-M10-6.2.10 |
| EL-M10-S18-937 | button | hidden-only | "∫" | FN-M10-6.2.10 |
| EL-M10-S18-938 | button | hidden-only | "∂" | FN-M10-6.2.10 |
| EL-M10-S18-939 | button | hidden-only | "∑" | FN-M10-6.2.10 |
| EL-M10-S18-940 | button | hidden-only | "Δ" | FN-M10-6.2.10 |
| EL-M10-S18-941 | text | hidden-only | "Anak Panah" | FN-M10-6.2.10 |
| EL-M10-S18-942 | button | hidden-only | "→" | FN-M10-6.2.10 |
| EL-M10-S18-943 | button | hidden-only | "←" | FN-M10-6.2.10 |
| EL-M10-S18-944 | button | hidden-only | "↔" | FN-M10-6.2.10 |
| EL-M10-S18-945 | button | hidden-only | "↑" | FN-M10-6.2.10 |
| EL-M10-S18-946 | button | hidden-only | "↓" | FN-M10-6.2.10 |
| EL-M10-S18-947 | button | hidden-only | "⟶" | FN-M10-6.2.10 |
| EL-M10-S18-948 | button | hidden-only | "⇌" | FN-M10-6.2.10 |
| EL-M10-S18-949 | text | hidden-only | "Greek" | FN-M10-6.2.10 |
| EL-M10-S18-950 | button | hidden-only | "α" | FN-M10-6.2.10 |
| EL-M10-S18-951 | button | hidden-only | "β" | FN-M10-6.2.10 |
| EL-M10-S18-952 | button | hidden-only | "γ" | FN-M10-6.2.10 |
| EL-M10-S18-953 | button | hidden-only | "θ" | FN-M10-6.2.10 |
| EL-M10-S18-954 | button | hidden-only | "λ" | FN-M10-6.2.10 |
| EL-M10-S18-955 | button | hidden-only | "μ" | FN-M10-6.2.10 |
| EL-M10-S18-956 | button | hidden-only | "φ" | FN-M10-6.2.10 |
| EL-M10-S18-957 | button | hidden-only | "Ω" | FN-M10-6.2.10 |
| EL-M10-S18-958 | text | hidden-only | "Umum" | FN-M10-6.2.10 |
| EL-M10-S18-959 | button | hidden-only | "✓" | FN-M10-6.2.10 |
| EL-M10-S18-960 | button | hidden-only | "✗" | FN-M10-6.2.10 |
| EL-M10-S18-961 | button | hidden-only | "•" | FN-M10-6.2.10 |
| EL-M10-S18-962 | button | hidden-only | "─" | FN-M10-6.2.10 |
| EL-M10-S18-963 | textarea | conditional | label "Soalan *", `subs[6][question_text]`, ph "Masukkan teks sub-soalan..." | FN-M10-6.2.10 |
| EL-M10-S18-964 | label | conditional | "Jenis Jawapan" | FN-M10-6.2.10 |
| EL-M10-S18-965 | select | conditional | label "Jenis Jawapan", `subs[6][answer_type]`, 2 options | FN-M10-6.2.10 |
| EL-M10-S18-966 | label | conditional | "Markah *" | FN-M10-6.2.10 |
| EL-M10-S18-967 | input | conditional | label "Markah *", `subs[6][marks]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-968 | label | hidden-only | "Jawapan Tepat" | FN-M10-6.2.10 |
| EL-M10-S18-969 | input | hidden-only | label "Jawapan Tepat", `subs[6][expected_numeric]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-970 | label | hidden-only | "Toleransi (±)" | FN-M10-6.2.10 |
| EL-M10-S18-971 | input | hidden-only | label "Toleransi (±)", `subs[6][numeric_tolerance]`, type number | FN-M10-6.2.10 |
| EL-M10-S18-972 | label | conditional | "Rubrik Skema (Konstruk KPM)" | FN-M10-6.2.11 |
| EL-M10-S18-973 | button | conditional | "Tambah", fa-plus | FN-M10-6.2.11 |
| EL-M10-S18-974 | select | hidden-only | 7 options | FN-M10-6.2.11 |
| EL-M10-S18-975 | input | hidden-only | ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-976 | input | hidden-only | ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-977 | text | hidden-only | "m" | FN-M10-6.2.11 |
| EL-M10-S18-978 | button | hidden-only | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-979 | select | conditional | `subs[6][rubrics][0][konstruk]`, 7 options | FN-M10-6.2.11 |
| EL-M10-S18-980 | input | conditional | `subs[6][rubrics][0][keyword]`, ph "Keyword/frasa..." | FN-M10-6.2.11 |
| EL-M10-S18-981 | input | conditional | `subs[6][rubrics][0][marks]`, ph "m", type number | FN-M10-6.2.11 |
| EL-M10-S18-982 | text | conditional | "m" | FN-M10-6.2.11 |
| EL-M10-S18-983 | button | conditional | fa-times | FN-M10-6.2.11 |
| EL-M10-S18-984 | label | conditional | "Jalan Kerja / Skema Jawapan Penuh" | FN-M10-6.2.10 |
| EL-M10-S18-985 | textarea | conditional | label "Jalan Kerja / Skema Jawapan Penuh", `subs[6][model_answer]`, ph "Jawapan penuh yang akan ditunjukkan kepada pelajar selepas jawab..." | FN-M10-6.2.10 |
| EL-M10-S18-986 | hidden-field | hidden-only | `subs[6][parent_sub_id]`, type hidden | FN-M10-6.2.10 |
| EL-M10-S18-987 | card | conditional | "(b)" | FN-M10-6.2.10 |

#### S19 — `/guru/soalan-berstruktur/{id}` (22 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S19-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S19-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S19-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S19-004 | link | visible-default | → /guru/soalan-berstruktur, fa-arrow-left | FN-M10-6.3.1 |
| EL-M10-S19-005 | heading | visible-default | "Preview Soalan" | FN-M10-6.3.1 |
| EL-M10-S19-006 | text | visible-default | "Perniagaan · Tingkatan 5 · Merancang Pengendalian Perniagaan" | FN-M10-6.3.1 |
| EL-M10-S19-007 | badge | visible-default | "Public" | FN-M10-6.3.1 |
| EL-M10-S19-008 | badge | visible-default | "Terbit" | FN-M10-6.3.1 |
| EL-M10-S19-009 | link | visible-default | "Edit", → /guru/soalan-berstruktur/4454/edit, fa-edit | FN-M10-6.3.1 |
| EL-M10-S19-010 | card | visible-default | "KBAT 3: Mengaplikasi (MOTS)" | FN-M10-6.3.2 |
| EL-M10-S19-011 | text | visible-default | "KBAT 3: Mengaplikasi (MOTS)" | FN-M10-6.3.2 |
| EL-M10-S19-012 | text | visible-default | "8 markah" | FN-M10-6.3.2 |
| EL-M10-S19-013 | text | visible-default | "1 sub-soalan" | FN-M10-6.3.2 |
| EL-M10-S19-014 | text | visible-default | "Eksperimen", fa-flask | FN-M10-6.3.2 |
| EL-M10-S19-015 | text | visible-default | "Soalan Oleh: <person> 2 Bab 7 Tingkatan 5 (2019) Item 1 Terangkan kepentingan menyediakan " | FN-M10-6.3.2 |
| EL-M10-S19-016 | text | visible-default | "(a)" | FN-M10-6.3.2 |
| EL-M10-S19-017 | text | visible-default | "Terangkan kepentingan menyediakan rancangan perniagaan kepada usahawan. [8 markah] Negeri " | FN-M10-6.3.2 |
| EL-M10-S19-018 | text | visible-default | "[8 markah]" | FN-M10-6.3.2 |
| EL-M10-S19-019 | text | visible-default | "Text" | FN-M10-6.3.2 |
| EL-M10-S19-020 | text | visible-default | "Jalan Kerja:", fa-check-circle | FN-M10-6.3.2 |
| EL-M10-S19-021 | text | visible-default | "Terangkan kepentingan menyediakan rancangan perniagaan kepada usahawan. JAWAPAN Meyakinkan" | FN-M10-6.3.2 |
| EL-M10-S19-022 | text | visible-default | "Dicipta oleh <person> · 20 May 2026, 14:13" | FN-M10-6.3.2 |

#### S20 — `/guru/soalan-berstruktur/{id}/edit` (169 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S20-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S20-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S20-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S20-004 | link | visible-default | → /guru/soalan-berstruktur/4454, fa-arrow-left | FN-M10-6.4.1 |
| EL-M10-S20-005 | heading | visible-default | "Edit Soalan Berstruktur" | FN-M10-6.4.1 |
| EL-M10-S20-006 | text | visible-default | "Perniagaan · Tingkatan 5" | FN-M10-6.4.1 |
| EL-M10-S20-007 | form | visible-default | (no text) | FN-M10-6.4.1 |
| EL-M10-S20-008 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-6.4.1 |
| EL-M10-S20-009 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-6.4.1 |
| EL-M10-S20-010 | card | visible-default | "Maklumat Soalan" | FN-M10-6.4.1 |
| EL-M10-S20-011 | heading | visible-default | "Maklumat Soalan" | FN-M10-6.4.1 |
| EL-M10-S20-012 | label | visible-default | "Subjek *" | FN-M10-6.4.2 |
| EL-M10-S20-013 | select | visible-default | label "Subjek *", `subject_id`, 31 options | FN-M10-6.4.2 |
| EL-M10-S20-014 | label | visible-default | "Tingkatan *" | FN-M10-6.4.2 |
| EL-M10-S20-015 | select | visible-default | label "Tingkatan *", `education_level_id`, 11 options | FN-M10-6.4.2 |
| EL-M10-S20-016 | label | visible-default | "Aras KBAT *" | FN-M10-6.4.2 |
| EL-M10-S20-017 | select | visible-default | label "Aras KBAT *", `kbat_level`, 6 options | FN-M10-6.4.2 |
| EL-M10-S20-018 | label | visible-default | "Bab" | FN-M10-6.4.2 |
| EL-M10-S20-019 | select | visible-default | label "Bab", `chapter_id`, 8 options | FN-M10-6.4.2 |
| EL-M10-S20-020 | label | visible-default | "Topik" | FN-M10-6.4.2 |
| EL-M10-S20-021 | select | visible-default | label "Topik", `topic_id`, 2 options | FN-M10-6.4.2 |
| EL-M10-S20-022 | label | visible-default | "Jenis Tulisan" | FN-M10-6.4.2 |
| EL-M10-S20-023 | select | visible-default | label "Jenis Tulisan", `script_type`, 4 options | FN-M10-6.4.2 |
| EL-M10-S20-024 | hidden-field | hidden-only | label "Jenis Tulisan", `text_direction`, type hidden | FN-M10-6.4.2 |
| EL-M10-S20-025 | label | visible-default | "Template" | FN-M10-6.4.2 |
| EL-M10-S20-026 | select | visible-default | label "Template", `question_template`, 2 options | FN-M10-6.4.2 |
| EL-M10-S20-027 | label | visible-default | "Visibility *" | FN-M10-6.4.3 |
| EL-M10-S20-028 | label | visible-default | "Public" | FN-M10-6.4.3 |
| EL-M10-S20-029 | radio | hidden-only | label "Public", `visibility`, type radio | FN-M10-6.4.3 |
| EL-M10-S20-030 | select | hidden-only | `education_level_filter`, 12 options | FN-M10-6.4.3 |
| EL-M10-S20-031 | select | hidden-only | `classroom_id`, 1 options | FN-M10-6.4.3 |
| EL-M10-S20-032 | label | visible-default | "Stimulus *" | FN-M10-6.4.4 |
| EL-M10-S20-033 | toggle | visible-default | "Simbol & Aksara Khas", fa-superscript | FN-M10-6.4.4 |
| EL-M10-S20-034 | text | conditional | "Asas" | FN-M10-6.4.4 |
| EL-M10-S20-035 | button | conditional | "×" | FN-M10-6.4.4 |
| EL-M10-S20-036 | button | conditional | "÷" | FN-M10-6.4.4 |
| EL-M10-S20-037 | button | conditional | "±" | FN-M10-6.4.4 |
| EL-M10-S20-038 | button | conditional | "≠" | FN-M10-6.4.4 |
| EL-M10-S20-039 | button | conditional | "≥" | FN-M10-6.4.4 |
| EL-M10-S20-040 | button | conditional | "≤" | FN-M10-6.4.4 |
| EL-M10-S20-041 | button | conditional | "≈" | FN-M10-6.4.4 |
| EL-M10-S20-042 | button | conditional | "≡" | FN-M10-6.4.4 |
| EL-M10-S20-043 | button | conditional | "∝" | FN-M10-6.4.4 |
| EL-M10-S20-044 | button | conditional | "°" | FN-M10-6.4.4 |
| EL-M10-S20-045 | button | conditional | "%" | FN-M10-6.4.4 |
| EL-M10-S20-046 | text | conditional | "Kuasa" | FN-M10-6.4.4 |
| EL-M10-S20-047 | button | conditional | "⁰" | FN-M10-6.4.4 |
| EL-M10-S20-048 | button | conditional | "¹" | FN-M10-6.4.4 |
| EL-M10-S20-049 | button | conditional | "²" | FN-M10-6.4.4 |
| EL-M10-S20-050 | button | conditional | "³" | FN-M10-6.4.4 |
| EL-M10-S20-051 | button | conditional | "⁴" | FN-M10-6.4.4 |
| EL-M10-S20-052 | button | conditional | "⁵" | FN-M10-6.4.4 |
| EL-M10-S20-053 | button | conditional | "ⁿ" | FN-M10-6.4.4 |
| EL-M10-S20-054 | button | conditional | "⁻" | FN-M10-6.4.4 |
| EL-M10-S20-055 | button | conditional | "⁺" | FN-M10-6.4.4 |
| EL-M10-S20-056 | button | conditional | "½" | FN-M10-6.4.4 |
| EL-M10-S20-057 | button | conditional | "¼" | FN-M10-6.4.4 |
| EL-M10-S20-058 | button | conditional | "¾" | FN-M10-6.4.4 |
| EL-M10-S20-059 | text | conditional | "Subskrip" | FN-M10-6.4.4 |
| EL-M10-S20-060 | button | conditional | "₀" | FN-M10-6.4.4 |
| EL-M10-S20-061 | button | conditional | "₁" | FN-M10-6.4.4 |
| EL-M10-S20-062 | button | conditional | "₂" | FN-M10-6.4.4 |
| EL-M10-S20-063 | button | conditional | "₃" | FN-M10-6.4.4 |
| EL-M10-S20-064 | button | conditional | "₄" | FN-M10-6.4.4 |
| EL-M10-S20-065 | button | conditional | "ₙ" | FN-M10-6.4.4 |
| EL-M10-S20-066 | button | conditional | "ₓ" | FN-M10-6.4.4 |
| EL-M10-S20-067 | text | conditional | "Matematik" | FN-M10-6.4.4 |
| EL-M10-S20-068 | button | conditional | "√" | FN-M10-6.4.4 |
| EL-M10-S20-069 | button | conditional | "π" | FN-M10-6.4.4 |
| EL-M10-S20-070 | button | conditional | "∞" | FN-M10-6.4.4 |
| EL-M10-S20-071 | button | conditional | "∠" | FN-M10-6.4.4 |
| EL-M10-S20-072 | button | conditional | "∥" | FN-M10-6.4.4 |
| EL-M10-S20-073 | button | conditional | "⊥" | FN-M10-6.4.4 |
| EL-M10-S20-074 | button | conditional | "∴" | FN-M10-6.4.4 |
| EL-M10-S20-075 | button | conditional | "∵" | FN-M10-6.4.4 |
| EL-M10-S20-076 | button | conditional | "∈" | FN-M10-6.4.4 |
| EL-M10-S20-077 | button | conditional | "∉" | FN-M10-6.4.4 |
| EL-M10-S20-078 | button | conditional | "⊂" | FN-M10-6.4.4 |
| EL-M10-S20-079 | button | conditional | "∪" | FN-M10-6.4.4 |
| EL-M10-S20-080 | button | conditional | "∩" | FN-M10-6.4.4 |
| EL-M10-S20-081 | button | conditional | "∫" | FN-M10-6.4.4 |
| EL-M10-S20-082 | button | conditional | "∂" | FN-M10-6.4.4 |
| EL-M10-S20-083 | button | conditional | "∑" | FN-M10-6.4.4 |
| EL-M10-S20-084 | button | conditional | "Δ" | FN-M10-6.4.4 |
| EL-M10-S20-085 | text | conditional | "Anak Panah" | FN-M10-6.4.4 |
| EL-M10-S20-086 | button | conditional | "→" | FN-M10-6.4.4 |
| EL-M10-S20-087 | button | conditional | "←" | FN-M10-6.4.4 |
| EL-M10-S20-088 | button | conditional | "↔" | FN-M10-6.4.4 |
| EL-M10-S20-089 | button | conditional | "↑" | FN-M10-6.4.4 |
| EL-M10-S20-090 | button | conditional | "↓" | FN-M10-6.4.4 |
| EL-M10-S20-091 | button | conditional | "⟶" | FN-M10-6.4.4 |
| EL-M10-S20-092 | button | conditional | "⇌" | FN-M10-6.4.4 |
| EL-M10-S20-093 | text | conditional | "Greek" | FN-M10-6.4.4 |
| EL-M10-S20-094 | button | conditional | "α" | FN-M10-6.4.4 |
| EL-M10-S20-095 | button | conditional | "β" | FN-M10-6.4.4 |
| EL-M10-S20-096 | button | conditional | "γ" | FN-M10-6.4.4 |
| EL-M10-S20-097 | button | conditional | "θ" | FN-M10-6.4.4 |
| EL-M10-S20-098 | button | conditional | "λ" | FN-M10-6.4.4 |
| EL-M10-S20-099 | button | conditional | "μ" | FN-M10-6.4.4 |
| EL-M10-S20-100 | button | conditional | "φ" | FN-M10-6.4.4 |
| EL-M10-S20-101 | button | conditional | "Ω" | FN-M10-6.4.4 |
| EL-M10-S20-102 | text | conditional | "Umum" | FN-M10-6.4.4 |
| EL-M10-S20-103 | button | conditional | "✓" | FN-M10-6.4.4 |
| EL-M10-S20-104 | button | conditional | "✗" | FN-M10-6.4.4 |
| EL-M10-S20-105 | button | conditional | "•" | FN-M10-6.4.4 |
| EL-M10-S20-106 | button | conditional | "─" | FN-M10-6.4.4 |
| EL-M10-S20-107 | textarea | visible-default | label "Stimulus *", `stimulus_text` | FN-M10-6.4.4 |
| EL-M10-S20-108 | label | visible-default | "Gambar Stimulus" | FN-M10-6.4.4 |
| EL-M10-S20-109 | input | visible-default | label "Gambar Stimulus", `stimulus_image`, type file | FN-M10-6.4.4 |
| EL-M10-S20-110 | card | visible-default | "Sub-Soalan" | FN-M10-6.4.5 |
| EL-M10-S20-111 | heading | visible-default | "Sub-Soalan" | FN-M10-6.4.5 |
| EL-M10-S20-112 | text | visible-default | "Jumlah markah: 8m" | FN-M10-6.4.5 |
| EL-M10-S20-113 | button | visible-default | "Tambah", fa-plus | FN-M10-6.4.5 |
| EL-M10-S20-114 | card | hidden-only | (no text) | FN-M10-6.4.5 |
| EL-M10-S20-115 | input | hidden-only | (no text) | FN-M10-6.4.5 |
| EL-M10-S20-116 | button | hidden-only | fa-trash | FN-M10-6.4.5 |
| EL-M10-S20-117 | textarea | hidden-only | (no text) | FN-M10-6.4.5 |
| EL-M10-S20-118 | label | hidden-only | "Jenis" | FN-M10-6.4.5 |
| EL-M10-S20-119 | select | hidden-only | label "Jenis", 2 options | FN-M10-6.4.5 |
| EL-M10-S20-120 | label | hidden-only | "Markah" | FN-M10-6.4.5 |
| EL-M10-S20-121 | input | hidden-only | label "Markah", type number | FN-M10-6.4.5 |
| EL-M10-S20-122 | label | hidden-only | "Jawapan" | FN-M10-6.4.5 |
| EL-M10-S20-123 | input | hidden-only | label "Jawapan", type number | FN-M10-6.4.5 |
| EL-M10-S20-124 | label | hidden-only | "Toleransi" | FN-M10-6.4.5 |
| EL-M10-S20-125 | input | hidden-only | label "Toleransi", type number | FN-M10-6.4.5 |
| EL-M10-S20-126 | label | hidden-only | "Rubrik Skema" | FN-M10-6.4.6 |
| EL-M10-S20-127 | button | hidden-only | "Tambah", fa-plus | FN-M10-6.4.6 |
| EL-M10-S20-128 | select | hidden-only | 7 options | FN-M10-6.4.6 |
| EL-M10-S20-129 | input | hidden-only | (no text) | FN-M10-6.4.6 |
| EL-M10-S20-130 | input | hidden-only | type number | FN-M10-6.4.6 |
| EL-M10-S20-131 | text | hidden-only | "m" | FN-M10-6.4.6 |
| EL-M10-S20-132 | button | hidden-only | fa-times | FN-M10-6.4.6 |
| EL-M10-S20-133 | label | hidden-only | "Jalan Kerja" | FN-M10-6.4.5 |
| EL-M10-S20-134 | textarea | hidden-only | label "Jalan Kerja" | FN-M10-6.4.5 |
| EL-M10-S20-135 | hidden-field | hidden-only | type hidden | FN-M10-6.4.5 |
| EL-M10-S20-136 | card | visible-default | "(a)" | FN-M10-6.4.5 |
| EL-M10-S20-137 | text | visible-default | "(a)" | FN-M10-6.4.5 |
| EL-M10-S20-138 | input | visible-default | `subs[0][part_label]` | FN-M10-6.4.5 |
| EL-M10-S20-139 | button | hidden-only | fa-trash | FN-M10-6.4.5 |
| EL-M10-S20-140 | textarea | visible-default | `subs[0][question_text]` | FN-M10-6.4.5 |
| EL-M10-S20-141 | label | visible-default | "Jenis" | FN-M10-6.4.5 |
| EL-M10-S20-142 | select | visible-default | label "Jenis", `subs[0][answer_type]`, 2 options | FN-M10-6.4.5 |
| EL-M10-S20-143 | label | visible-default | "Markah" | FN-M10-6.4.5 |
| EL-M10-S20-144 | input | visible-default | label "Markah", `subs[0][marks]`, type number | FN-M10-6.4.5 |
| EL-M10-S20-145 | label | hidden-only | "Jawapan" | FN-M10-6.4.5 |
| EL-M10-S20-146 | input | hidden-only | label "Jawapan", `subs[0][expected_numeric]`, type number | FN-M10-6.4.5 |
| EL-M10-S20-147 | label | hidden-only | "Toleransi" | FN-M10-6.4.5 |
| EL-M10-S20-148 | input | hidden-only | label "Toleransi", `subs[0][numeric_tolerance]`, type number | FN-M10-6.4.5 |
| EL-M10-S20-149 | label | visible-default | "Rubrik Skema" | FN-M10-6.4.6 |
| EL-M10-S20-150 | button | visible-default | "Tambah", fa-plus | FN-M10-6.4.6 |
| EL-M10-S20-151 | select | hidden-only | 7 options | FN-M10-6.4.6 |
| EL-M10-S20-152 | input | hidden-only | (no text) | FN-M10-6.4.6 |
| EL-M10-S20-153 | input | hidden-only | type number | FN-M10-6.4.6 |
| EL-M10-S20-154 | text | hidden-only | "m" | FN-M10-6.4.6 |
| EL-M10-S20-155 | button | hidden-only | fa-times | FN-M10-6.4.6 |
| EL-M10-S20-156 | select | visible-default | `subs[0][rubrics][0][konstruk]`, 7 options | FN-M10-6.4.6 |
| EL-M10-S20-157 | input | visible-default | `subs[0][rubrics][0][keyword]` | FN-M10-6.4.6 |
| EL-M10-S20-158 | input | visible-default | `subs[0][rubrics][0][marks]`, type number | FN-M10-6.4.6 |
| EL-M10-S20-159 | text | visible-default | "m" | FN-M10-6.4.6 |
| EL-M10-S20-160 | button | visible-default | fa-times | FN-M10-6.4.6 |
| EL-M10-S20-161 | label | visible-default | "Jalan Kerja" | FN-M10-6.4.5 |
| EL-M10-S20-162 | textarea | visible-default | label "Jalan Kerja", `subs[0][model_answer]` | FN-M10-6.4.5 |
| EL-M10-S20-163 | hidden-field | hidden-only | `subs[0][parent_sub_id]`, type hidden | FN-M10-6.4.5 |
| EL-M10-S20-164 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-6.4.7 |
| EL-M10-S20-165 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-6.4.7 |
| EL-M10-S20-166 | button | visible-default | "Padam", fa-trash | FN-M10-6.4.7 |
| EL-M10-S20-167 | button | visible-default | "Simpan Draf", fa-save | FN-M10-6.4.7 |
| EL-M10-S20-168 | button | visible-default | "Simpan & Terbitkan", fa-paper-plane | FN-M10-6.4.7 |
| EL-M10-S20-169 | toggle | conditional | "Tutup Simbol", fa-superscript | FN-M10-6.4.4 |

#### S21 — `/guru/soalan` (234 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S21-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S21-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S21-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S21-004 | card | visible-default | "16817" | FN-M10-7.1.1 |
| EL-M10-S21-005 | text | visible-default | "16817" | FN-M10-7.1.1 |
| EL-M10-S21-006 | text | visible-default | "📝 Jumlah" | FN-M10-7.1.1 |
| EL-M10-S21-007 | card | visible-default | "16817" | FN-M10-7.1.1 |
| EL-M10-S21-008 | text | visible-default | "16817" | FN-M10-7.1.1 |
| EL-M10-S21-009 | text | visible-default | "✅ Diluluskan" | FN-M10-7.1.1 |
| EL-M10-S21-010 | card | visible-default | "0" | FN-M10-7.1.1 |
| EL-M10-S21-011 | text | visible-default | "0" | FN-M10-7.1.1 |
| EL-M10-S21-012 | text | visible-default | "⏳ Menunggu" | FN-M10-7.1.1 |
| EL-M10-S21-013 | card | visible-default | "0" | FN-M10-7.1.1 |
| EL-M10-S21-014 | text | visible-default | "0" | FN-M10-7.1.1 |
| EL-M10-S21-015 | text | visible-default | "📊 Digunakan" | FN-M10-7.1.1 |
| EL-M10-S21-016 | text | visible-default | "adalah platform perkongsian soalan untuk manfaat semua pelajar di seluruh Malaysia. Setiap", fa-globe | FN-M10-7.1.2 |
| EL-M10-S21-017 | text | visible-default | "Sumbang Soalan" | FN-M10-7.1.2 |
| EL-M10-S21-018 | card | visible-default | "Pencapaian Badge Penyumbang" | FN-M10-7.1.3 |
| EL-M10-S21-019 | heading | visible-default | "Pencapaian Badge Penyumbang" | FN-M10-7.1.3 |
| EL-M10-S21-020 | alert | visible-default | "Penyumbang Baru (10)", fa-seedling | FN-M10-7.1.3 |
| EL-M10-S21-021 | alert | visible-default | "Penyumbang Aktif (100)", fa-fire | FN-M10-7.1.3 |
| EL-M10-S21-022 | alert | visible-default | "Penyumbang Dedikasi (500)", fa-award | FN-M10-7.1.3 |
| EL-M10-S21-023 | alert | visible-default | "Penyumbang Cemerlang (1,000)", fa-trophy | FN-M10-7.1.3 |
| EL-M10-S21-024 | alert | visible-default | "Penyumbang Terbilang (2,500)", fa-crown | FN-M10-7.1.3 |
| EL-M10-S21-025 | alert | visible-default | "Legenda Soalan (5,000)", fa-gem | FN-M10-7.1.3 |
| EL-M10-S21-026 | alert | visible-default | "Guru Maestro (10,000)", fa-star | FN-M10-7.1.3 |
| EL-M10-S21-027 | text | visible-default | "Legenda Terulung", fa-crown | FN-M10-7.1.3 |
| EL-M10-S21-028 | text | visible-default | "(50,000)" | FN-M10-7.1.3 |
| EL-M10-S21-029 | text | visible-default | "Sasaran seterusnya: — 50,000 soalan" | FN-M10-7.1.3 |
| EL-M10-S21-030 | text | visible-default | "Legenda Terulung" | FN-M10-7.1.3 |
| EL-M10-S21-031 | card | visible-default | "Pecahan Subjek" | FN-M10-7.1.4 |
| EL-M10-S21-032 | heading | visible-default | "Pecahan Subjek" | FN-M10-7.1.4 |
| EL-M10-S21-033 | badge | visible-default | "Matematik — 3,287" | FN-M10-7.1.4 |
| EL-M10-S21-034 | badge | visible-default | "Pendidikan Islam — 2,516" | FN-M10-7.1.4 |
| EL-M10-S21-035 | badge | visible-default | "Bahasa Melayu — 2,342" | FN-M10-7.1.4 |
| EL-M10-S21-036 | badge | visible-default | "Bahasa Inggeris — 2,214" | FN-M10-7.1.4 |
| EL-M10-S21-037 | badge | visible-default | "Sains — 1,935" | FN-M10-7.1.4 |
| EL-M10-S21-038 | badge | visible-default | "Pendidikan Moral — 1,823" | FN-M10-7.1.4 |
| EL-M10-S21-039 | badge | visible-default | "Sejarah — 795" | FN-M10-7.1.4 |
| EL-M10-S21-040 | badge | visible-default | "Lain — 763" | FN-M10-7.1.4 |
| EL-M10-S21-041 | badge | visible-default | "Pendidikan Seni Visual — 510" | FN-M10-7.1.4 |
| EL-M10-S21-042 | badge | visible-default | "Pendidikan Syariah Islamiah — 363" | FN-M10-7.1.4 |
| EL-M10-S21-043 | badge | visible-default | "Geografi — 269" | FN-M10-7.1.4 |
| EL-M10-S21-044 | card | visible-default | "Import Soalan (CSV/Excel)" | FN-M10-7.1.5 |
| EL-M10-S21-045 | text | visible-default | "Import Soalan (CSV/Excel)" | FN-M10-7.1.5 |
| EL-M10-S21-046 | text | visible-default | "Muat naik banyak soalan sekaligus" | FN-M10-7.1.5 |
| EL-M10-S21-047 | link | visible-default | "Template", → /guru/soalan/template, fa-download | FN-M10-7.1.5 |
| EL-M10-S21-048 | toggle | visible-default | "Import CSV", fa-upload | FN-M10-7.1.5 |
| EL-M10-S21-049 | form | conditional | (no text) | FN-M10-7.1.5 |
| EL-M10-S21-050 | hidden-field | hidden-only | label "Pilih Fail CSV", `_token`, type hidden | FN-M10-7.1.5 |
| EL-M10-S21-051 | label | conditional | "Pilih Fail CSV" | FN-M10-7.1.5 |
| EL-M10-S21-052 | input | conditional | label "Pilih Fail CSV", `csv_file`, type file | FN-M10-7.1.5 |
| EL-M10-S21-053 | button | conditional | "Import", fa-cloud-upload-alt | FN-M10-7.1.5 |
| EL-M10-S21-054 | text | conditional | "Panduan:", fa-info-circle | FN-M10-7.1.5 |
| EL-M10-S21-055 | text | conditional | "Muat turun template → isi soalan → import kembali" | FN-M10-7.1.5 |
| EL-M10-S21-056 | text | conditional | "Format: subjek, tahap, soalan, 4 pilihan, jawapan (A/B/C/D), kesukaran, penerangan" | FN-M10-7.1.5 |
| EL-M10-S21-057 | text | conditional | "Soalan akan dihantar sebagai "Menunggu Semakan" untuk kelulusan admin" | FN-M10-7.1.5 |
| EL-M10-S21-058 | text | conditional | "Baris yang ada ralat akan dilaporkan — soalan sah tetap diimport" | FN-M10-7.1.5 |
| EL-M10-S21-059 | text | visible-default | "Sumbang Set Audio KBAT / Ujian Mendengar" | FN-M10-7.1.6 |
| EL-M10-S21-060 | text | visible-default | "Format khas fixed sequence: 4 audio section, 30 soalan MCQ, skema A-D, dan transkrip untuk" | FN-M10-7.1.6 |
| EL-M10-S21-061 | text | visible-default | "Sesuai untuk bahan cikgu seperti audio soalan 1-8, 9-16, 17-24 dan 25-30." | FN-M10-7.1.6 |
| EL-M10-S21-062 | link | visible-default | "Template XLSX", → /guru/audio-kbat/template, fa-file-excel | FN-M10-7.1.6 |
| EL-M10-S21-063 | link | visible-default | "Template Word", → /guru/audio-kbat/template-word, fa-file-word | FN-M10-7.1.6 |
| EL-M10-S21-064 | link | visible-default | "Cipta Set", → /guru/audio-kbat/create, fa-plus | FN-M10-7.1.6 |
| EL-M10-S21-065 | link | visible-default | "Senarai Set", → /guru/audio-kbat, fa-list | FN-M10-7.1.6 |
| EL-M10-S21-066 | text | visible-default | "AI Auto-Generate Soalan" | FN-M10-7.1.7 |
| EL-M10-S21-067 | text | visible-default | "Upload dokumen DOCX/PDF, AI extract soalan automatik" | FN-M10-7.1.7 |
| EL-M10-S21-068 | heading | visible-default | "Soalan Saya" | FN-M10-7.1.8 |
| EL-M10-S21-069 | link | visible-default | "Tambah Soalan", → /guru/soalan/cipta, fa-plus | FN-M10-7.1.8 |
| EL-M10-S21-070 | card | visible-default | "Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca?" | FN-M10-7.1.8 |
| EL-M10-S21-071 | clickable | visible-default | "Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca? Bahasa Melayu", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-072 | badge | visible-default | "Bahasa Melayu" | FN-M10-7.1.8 |
| EL-M10-S21-073 | badge | visible-default | "Darjah 6" | FN-M10-7.1.8 |
| EL-M10-S21-074 | badge | visible-default | "Sukar" | FN-M10-7.1.8 |
| EL-M10-S21-075 | alert | visible-default | "DSKP", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-076 | badge | visible-default | "Diluluskan", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-077 | text | conditional | "Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca?" | FN-M10-7.1.8 |
| EL-M10-S21-078 | text | conditional | "A." | FN-M10-7.1.8 |
| EL-M10-S21-079 | text | conditional | "Danish berkata, "Mari kita kemas bilik ini bersama-sama."." | FN-M10-7.1.8 |
| EL-M10-S21-080 | text | conditional | "B." | FN-M10-7.1.8 |
| EL-M10-S21-081 | text | conditional | "Danish berkata, Mari kita kemas bilik ini bersama-sama." | FN-M10-7.1.8 |
| EL-M10-S21-082 | text | conditional | "C." | FN-M10-7.1.8 |
| EL-M10-S21-083 | text | conditional | "Danish berkata, "Mari kita kemas bilik ini bersama-sama."" | FN-M10-7.1.8 |
| EL-M10-S21-084 | text | conditional | "D." | FN-M10-7.1.8 |
| EL-M10-S21-085 | text | conditional | "Danish berkata "Mari kita kemas bilik ini bersama-sama."" | FN-M10-7.1.8 |
| EL-M10-S21-086 | text | conditional | "Penjelasan", fa-lightbulb | FN-M10-7.1.8 |
| EL-M10-S21-087 | text | conditional | "Konsep ini disemak dalam skop bab buku teks yang sama. Pilihan betul dikekalkan kerana ia " | FN-M10-7.1.8 |
| EL-M10-S21-088 | text | conditional | "#522425", fa-hashtag | FN-M10-7.1.8 |
| EL-M10-S21-089 | text | conditional | "textbook_content_rebuild", fa-database | FN-M10-7.1.8 |
| EL-M10-S21-090 | text | conditional | "Aktif", fa-eye | FN-M10-7.1.8 |
| EL-M10-S21-091 | link | conditional | "Edit", → /guru/soalan/522425/edit, fa-edit | FN-M10-7.1.9 |
| EL-M10-S21-092 | form | conditional | (no text) | FN-M10-7.1.9 |
| EL-M10-S21-093 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.1.9 |
| EL-M10-S21-094 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-7.1.9 |
| EL-M10-S21-095 | button | conditional | "Padam", fa-trash | FN-M10-7.1.9 |
| EL-M10-S21-096 | card | visible-default | "Semasa ulang kaji bab, pilih ayat penutup yang paling berkesan untuk karangan kreatif?" | FN-M10-7.1.8 |
| EL-M10-S21-097 | clickable | visible-default | "Semasa ulang kaji bab, pilih ayat penutup yang paling berkesan untuk karangan kreatif? Bah", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-098 | badge | visible-default | "Bahasa Melayu" | FN-M10-7.1.8 |
| EL-M10-S21-099 | badge | visible-default | "Darjah 6" | FN-M10-7.1.8 |
| EL-M10-S21-100 | badge | visible-default | "Sukar" | FN-M10-7.1.8 |
| EL-M10-S21-101 | alert | visible-default | "DSKP", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-102 | badge | visible-default | "Diluluskan", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-103 | text | hidden-only | "Semasa ulang kaji bab, pilih ayat penutup yang paling berkesan untuk karangan kreatif?" | FN-M10-7.1.8 |
| EL-M10-S21-104 | text | hidden-only | "A." | FN-M10-7.1.8 |
| EL-M10-S21-105 | text | hidden-only | "Peristiwa itu menjadi pengajaran yang tidak akan saya lupakan." | FN-M10-7.1.8 |
| EL-M10-S21-106 | text | hidden-only | "B." | FN-M10-7.1.8 |
| EL-M10-S21-107 | text | hidden-only | "Sejak hari itu, saya belajar menghargai masa dan peluang." | FN-M10-7.1.8 |
| EL-M10-S21-108 | text | hidden-only | "C." | FN-M10-7.1.8 |
| EL-M10-S21-109 | text | hidden-only | "Akhirnya, kami sedar bahawa kerjasama membawa kejayaan." | FN-M10-7.1.8 |
| EL-M10-S21-110 | text | hidden-only | "D." | FN-M10-7.1.8 |
| EL-M10-S21-111 | text | hidden-only | "Cerita ini habis." | FN-M10-7.1.8 |
| EL-M10-S21-112 | text | hidden-only | "Penjelasan", fa-lightbulb | FN-M10-7.1.8 |
| EL-M10-S21-113 | text | hidden-only | "Konsep ini disemak dalam skop bab buku teks yang sama. Pilihan betul dikekalkan kerana ia " | FN-M10-7.1.8 |
| EL-M10-S21-114 | text | hidden-only | "#522426", fa-hashtag | FN-M10-7.1.8 |
| EL-M10-S21-115 | text | hidden-only | "textbook_content_rebuild", fa-database | FN-M10-7.1.8 |
| EL-M10-S21-116 | text | hidden-only | "Aktif", fa-eye | FN-M10-7.1.8 |
| EL-M10-S21-117 | link | hidden-only | "Edit", → /guru/soalan/522426/edit, fa-edit | FN-M10-7.1.9 |
| EL-M10-S21-118 | form | hidden-only | (no text) | FN-M10-7.1.9 |
| EL-M10-S21-119 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.1.9 |
| EL-M10-S21-120 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-7.1.9 |
| EL-M10-S21-121 | button | hidden-only | "Padam", fa-trash | FN-M10-7.1.9 |
| EL-M10-S21-122 | card | visible-default | "Dalam konteks pembelajaran, cerita: Ali menghadapi situasi 'rakan terjatuh'. Apakah sambun" | FN-M10-7.1.8 |
| EL-M10-S21-123 | clickable | visible-default | "Dalam konteks pembelajaran, cerita: Ali menghadapi situasi 'rakan terjatuh'. Apakah sambun", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-124 | badge | visible-default | "Bahasa Melayu" | FN-M10-7.1.8 |
| EL-M10-S21-125 | badge | visible-default | "Darjah 6" | FN-M10-7.1.8 |
| EL-M10-S21-126 | badge | visible-default | "Sukar" | FN-M10-7.1.8 |
| EL-M10-S21-127 | alert | visible-default | "DSKP", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-128 | badge | visible-default | "Diluluskan", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-129 | text | hidden-only | "Dalam konteks pembelajaran, cerita: Ali menghadapi situasi 'rakan terjatuh'. Apakah sambun" | FN-M10-7.1.8 |
| EL-M10-S21-130 | text | hidden-only | "A." | FN-M10-7.1.8 |
| EL-M10-S21-131 | text | hidden-only | "Ali bertenang lalu mencari penyelesaian dengan bantuan orang sekeliling." | FN-M10-7.1.8 |
| EL-M10-S21-132 | text | hidden-only | "B." | FN-M10-7.1.8 |
| EL-M10-S21-133 | text | hidden-only | "Ali terus panik tanpa berbuat apa-apa." | FN-M10-7.1.8 |
| EL-M10-S21-134 | text | hidden-only | "C." | FN-M10-7.1.8 |
| EL-M10-S21-135 | text | hidden-only | "Ali menjerit sepanjang masa tanpa sebab." | FN-M10-7.1.8 |
| EL-M10-S21-136 | text | hidden-only | "D." | FN-M10-7.1.8 |
| EL-M10-S21-137 | text | hidden-only | "Ali meninggalkan masalah itu begitu sahaja." | FN-M10-7.1.8 |
| EL-M10-S21-138 | text | hidden-only | "Penjelasan", fa-lightbulb | FN-M10-7.1.8 |
| EL-M10-S21-139 | text | hidden-only | "Konsep ini disemak dalam skop bab buku teks yang sama. Pilihan betul dikekalkan kerana ia " | FN-M10-7.1.8 |
| EL-M10-S21-140 | text | hidden-only | "#522427", fa-hashtag | FN-M10-7.1.8 |
| EL-M10-S21-141 | text | hidden-only | "textbook_content_rebuild", fa-database | FN-M10-7.1.8 |
| EL-M10-S21-142 | text | hidden-only | "Aktif", fa-eye | FN-M10-7.1.8 |
| EL-M10-S21-143 | link | hidden-only | "Edit", → /guru/soalan/522427/edit, fa-edit | FN-M10-7.1.9 |
| EL-M10-S21-144 | form | hidden-only | (no text) | FN-M10-7.1.9 |
| EL-M10-S21-145 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.1.9 |
| EL-M10-S21-146 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-7.1.9 |
| EL-M10-S21-147 | button | hidden-only | "Padam", fa-trash | FN-M10-7.1.9 |
| EL-M10-S21-148 | text | conditional | "« Previous" | FN-M10-7.1.10 |
| EL-M10-S21-149 | pagination | conditional | "Next »", → /guru/soalan?page=2 | FN-M10-7.1.10 |
| EL-M10-S21-150 | text | visible-default | "Showing to of results" | FN-M10-7.1.10 |
| EL-M10-S21-151 | text | visible-default | "1" | FN-M10-7.1.10 |
| EL-M10-S21-152 | text | visible-default | "20" | FN-M10-7.1.10 |
| EL-M10-S21-153 | text | visible-default | "16817" | FN-M10-7.1.10 |
| EL-M10-S21-154 | text | visible-default | "1" | FN-M10-7.1.10 |
| EL-M10-S21-155 | pagination | visible-default | "2", → /guru/soalan?page=2 | FN-M10-7.1.10 |
| EL-M10-S21-156 | pagination | visible-default | "3", → /guru/soalan?page=3 | FN-M10-7.1.10 |
| EL-M10-S21-157 | pagination | visible-default | "4", → /guru/soalan?page=4 | FN-M10-7.1.10 |
| EL-M10-S21-158 | pagination | visible-default | "5", → /guru/soalan?page=5 | FN-M10-7.1.10 |
| EL-M10-S21-159 | pagination | visible-default | "6", → /guru/soalan?page=6 | FN-M10-7.1.10 |
| EL-M10-S21-160 | pagination | visible-default | "7", → /guru/soalan?page=7 | FN-M10-7.1.10 |
| EL-M10-S21-161 | pagination | visible-default | "8", → /guru/soalan?page=8 | FN-M10-7.1.10 |
| EL-M10-S21-162 | pagination | visible-default | "9", → /guru/soalan?page=9 | FN-M10-7.1.10 |
| EL-M10-S21-163 | pagination | visible-default | "10", → /guru/soalan?page=10 | FN-M10-7.1.10 |
| EL-M10-S21-164 | text | visible-default | "..." | FN-M10-7.1.10 |
| EL-M10-S21-165 | pagination | visible-default | "840", → /guru/soalan?page=840 | FN-M10-7.1.10 |
| EL-M10-S21-166 | pagination | visible-default | "841", → /guru/soalan?page=841 | FN-M10-7.1.10 |
| EL-M10-S21-167 | pagination | visible-default | → /guru/soalan?page=2, svg | FN-M10-7.1.10 |
| EL-M10-S21-168 | card | visible-default | "Hantar Kertas Soalan kepada Admin" | FN-M10-7.1.11 |
| EL-M10-S21-169 | heading | visible-default | "Hantar Kertas Soalan kepada Admin" | FN-M10-7.1.11 |
| EL-M10-S21-170 | text | visible-default | "Admin akan proses dan upload ke databank soalan" | FN-M10-7.1.11 |
| EL-M10-S21-171 | text | visible-default | "Jenis Soalan Yang Diterima", fa-info-circle | FN-M10-7.1.11 |
| EL-M10-S21-172 | text | visible-default | "Soalan Umum", fa-check-circle | FN-M10-7.1.11 |
| EL-M10-S21-173 | text | visible-default | "Trial Paper", fa-check-circle | FN-M10-7.1.11 |
| EL-M10-S21-174 | text | visible-default | "Soalan DSKP", fa-check-circle | FN-M10-7.1.11 |
| EL-M10-S21-175 | text | visible-default | "Buku Teks", fa-check-circle | FN-M10-7.1.11 |
| EL-M10-S21-176 | text | visible-default | "Buku Latihan", fa-check-circle | FN-M10-7.1.11 |
| EL-M10-S21-177 | text | visible-default | "Soalan Peperiksaan", fa-check-circle | FN-M10-7.1.11 |
| EL-M10-S21-178 | text | visible-default | "Syarat Fail Yang Dihantar", fa-exclamation-triangle | FN-M10-7.1.11 |
| EL-M10-S21-179 | text | visible-default | "Format diterima:", fa-file-pdf | FN-M10-7.1.11 |
| EL-M10-S21-180 | text | visible-default | "PDF (teks), DOCX, XLSX" | FN-M10-7.1.11 |
| EL-M10-S21-181 | text | visible-default | "— teks mesti boleh disalin", fa-ban | FN-M10-7.1.11 |
| EL-M10-S21-182 | text | visible-default | "PDF scan imej TIDAK diterima" | FN-M10-7.1.11 |
| EL-M10-S21-183 | text | visible-default | "disertakan bersama soalan", fa-book | FN-M10-7.1.11 |
| EL-M10-S21-184 | text | visible-default | "Skema jawapan WAJIB" | FN-M10-7.1.11 |
| EL-M10-S21-185 | text | visible-default | "Maksimum , saiz maksimum setiap fail", fa-upload | FN-M10-7.1.11 |
| EL-M10-S21-186 | text | visible-default | "5 fail" | FN-M10-7.1.11 |
| EL-M10-S21-187 | text | visible-default | "20MB" | FN-M10-7.1.11 |
| EL-M10-S21-188 | text | visible-default | "1. Hantar" | FN-M10-7.1.11 |
| EL-M10-S21-189 | text | visible-default | "Upload fail anda" | FN-M10-7.1.11 |
| EL-M10-S21-190 | text | visible-default | "2. Proses" | FN-M10-7.1.11 |
| EL-M10-S21-191 | text | visible-default | "Admin extract soalan" | FN-M10-7.1.11 |
| EL-M10-S21-192 | text | visible-default | "3. Databank" | FN-M10-7.1.11 |
| EL-M10-S21-193 | text | visible-default | "Soalan tersedia" | FN-M10-7.1.11 |
| EL-M10-S21-194 | form | visible-default | (no text) | FN-M10-7.1.11 |
| EL-M10-S21-195 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.1.11 |
| EL-M10-S21-196 | label | visible-default | "Jenis Soalan *" | FN-M10-7.1.11 |
| EL-M10-S21-197 | select | visible-default | label "Jenis Soalan *", `jenis_soalan`, 8 options | FN-M10-7.1.11 |
| EL-M10-S21-198 | label | visible-default | "Matapelajaran *" | FN-M10-7.1.11 |
| EL-M10-S21-199 | input | visible-default | label "Matapelajaran *", `subject`, ph "Cth: Matematik, Fizik, BM..." | FN-M10-7.1.11 |
| EL-M10-S21-200 | label | visible-default | "Tingkatan" | FN-M10-7.1.11 |
| EL-M10-S21-201 | select | visible-default | label "Tingkatan", `tingkatan`, 6 options | FN-M10-7.1.11 |
| EL-M10-S21-202 | label | visible-default | "Tahun" | FN-M10-7.1.11 |
| EL-M10-S21-203 | input | visible-default | label "Tahun", `tahun`, ph "Cth: 2024", type number | FN-M10-7.1.11 |
| EL-M10-S21-204 | label | visible-default | "Disediakan Oleh" | FN-M10-7.1.11 |
| EL-M10-S21-205 | input | visible-default | label "Disediakan Oleh", `disediakan_oleh`, ph "Cth: Jabatan Pelajaran Johor, nama guru..." | FN-M10-7.1.11 |
| EL-M10-S21-206 | label | visible-default | "Catatan Tambahan" | FN-M10-7.1.11 |
| EL-M10-S21-207 | textarea | visible-default | label "Catatan Tambahan", `catatan`, ph "Maklumat tambahan untuk admin..." | FN-M10-7.1.11 |
| EL-M10-S21-208 | label | visible-default | "Fail Soalan + Skema *" | FN-M10-7.1.11 |
| EL-M10-S21-209 | label | visible-default | "Klik untuk pilih fail PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail" | FN-M10-7.1.11 |
| EL-M10-S21-210 | input | hidden-only | label "Klik untuk pilih fail PDF (teks), DOCX, XLSX — maks 5 fail, 20MB setiap fail", `files[]`, type file | FN-M10-7.1.11 |
| EL-M10-S21-211 | button | visible-default | "Hantar kepada Admin", fa-paper-plane | FN-M10-7.1.11 |
| EL-M10-S21-212 | card | conditional | "Dalam tugasan pengukuhan, cerita: Fatin menghadapi situasi 'lampu terpadam'. Apakah sambun" | FN-M10-7.1.8 |
| EL-M10-S21-213 | clickable | conditional | "Dalam tugasan pengukuhan, cerita: Fatin menghadapi situasi 'lampu terpadam'. Apakah sambun", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-214 | text | hidden-only | "Dalam tugasan pengukuhan, cerita: Fatin menghadapi situasi 'lampu terpadam'. Apakah sambun" | FN-M10-7.1.8 |
| EL-M10-S21-215 | text | hidden-only | "Fatin berfikir secara rasional dan bertindak dengan berhati-hati." | FN-M10-7.1.8 |
| EL-M10-S21-216 | text | hidden-only | "Fatin terus panik tanpa berbuat apa-apa." | FN-M10-7.1.8 |
| EL-M10-S21-217 | text | hidden-only | "Fatin menjerit sepanjang masa tanpa sebab." | FN-M10-7.1.8 |
| EL-M10-S21-218 | text | hidden-only | "Fatin meninggalkan masalah itu begitu sahaja." | FN-M10-7.1.8 |
| EL-M10-S21-219 | card | conditional | "Semasa ulang kaji bab, baca petikan prosa: "Nadia berada di sekolah. Nadia bercakap sopan " | FN-M10-7.1.8 |
| EL-M10-S21-220 | clickable | conditional | "Semasa ulang kaji bab, baca petikan prosa: "Nadia berada di sekolah. Nadia bercakap sopan ", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-221 | text | hidden-only | "Semasa ulang kaji bab, baca petikan prosa: "Nadia berada di sekolah. Nadia bercakap sopan " | FN-M10-7.1.8 |
| EL-M10-S21-222 | text | hidden-only | "tolong-menolong" | FN-M10-7.1.8 |
| EL-M10-S21-223 | text | hidden-only | "bertanggungjawab" | FN-M10-7.1.8 |
| EL-M10-S21-224 | text | hidden-only | "cuai" | FN-M10-7.1.8 |
| EL-M10-S21-225 | text | hidden-only | "berhemah" | FN-M10-7.1.8 |
| EL-M10-S21-226 | card | conditional | "Dalam konteks pembelajaran, baca puisi: Berkawan baik saling membantu, Hidup aman sentiasa" | FN-M10-7.1.8 |
| EL-M10-S21-227 | clickable | conditional | "Dalam konteks pembelajaran, baca puisi: Berkawan baik saling membantu, Hidup aman sentiasa", fa-check-circle | FN-M10-7.1.8 |
| EL-M10-S21-228 | text | hidden-only | "Dalam konteks pembelajaran, baca puisi: Berkawan baik saling membantu, Hidup aman sentiasa" | FN-M10-7.1.8 |
| EL-M10-S21-229 | text | hidden-only | "berhemah" | FN-M10-7.1.8 |
| EL-M10-S21-230 | text | hidden-only | "tolong-menolong" | FN-M10-7.1.8 |
| EL-M10-S21-231 | text | hidden-only | "jujur" | FN-M10-7.1.8 |
| EL-M10-S21-232 | text | hidden-only | "pemarah" | FN-M10-7.1.8 |
| EL-M10-S21-233 | pagination | hidden-only | "« Previous", → /guru/soalan?page=1 | FN-M10-7.1.10 |
| EL-M10-S21-234 | pagination | conditional | → /guru/soalan?page=3, svg | FN-M10-7.1.10 |

#### S22 — `/guru/soalan/cipta` (206 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S22-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S22-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S22-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S22-004 | link | visible-default | "Kembali ke Senarai Soalan", → /guru/soalan, fa-arrow-left | FN-M10-7.2.1 |
| EL-M10-S22-005 | form | visible-default | (no text) | FN-M10-7.2.1 |
| EL-M10-S22-006 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.2.1 |
| EL-M10-S22-007 | card | visible-default | "Maklumat Soalan" | FN-M10-7.2.1 |
| EL-M10-S22-008 | heading | visible-default | "Maklumat Soalan" | FN-M10-7.2.1 |
| EL-M10-S22-009 | label | visible-default | "Tahap Pendidikan *" | FN-M10-7.2.2 |
| EL-M10-S22-010 | select | visible-default | label "Tahap Pendidikan *", `education_level_id`, 12 options | FN-M10-7.2.2 |
| EL-M10-S22-011 | label | visible-default | "Mata Pelajaran *" | FN-M10-7.2.2 |
| EL-M10-S22-012 | select | visible-default | label "Mata Pelajaran *", `subject_id`, 32 options | FN-M10-7.2.2 |
| EL-M10-S22-013 | label | visible-default | "Bab (Pilihan)" | FN-M10-7.2.3 |
| EL-M10-S22-014 | select | visible-default | `chapter_id`, 1 options | FN-M10-7.2.3 |
| EL-M10-S22-015 | button | visible-default | fa-plus | FN-M10-7.2.3 |
| EL-M10-S22-016 | text | conditional | "Bab Baru", fa-plus-circle | FN-M10-7.2.3 |
| EL-M10-S22-017 | input | conditional | ph "No.", type number | FN-M10-7.2.3 |
| EL-M10-S22-018 | input | conditional | ph "Nama bab..." | FN-M10-7.2.3 |
| EL-M10-S22-019 | button | conditional | "Batal" | FN-M10-7.2.3 |
| EL-M10-S22-020 | button | conditional | "Simpan", fa-check | FN-M10-7.2.3 |
| EL-M10-S22-021 | label | visible-default | "Topik (Pilihan)" | FN-M10-7.2.3 |
| EL-M10-S22-022 | select | visible-default | `curriculum_topic_id`, 1 options | FN-M10-7.2.3 |
| EL-M10-S22-023 | button | visible-default | fa-plus | FN-M10-7.2.3 |
| EL-M10-S22-024 | text | conditional | "Topik Baru", fa-plus-circle | FN-M10-7.2.3 |
| EL-M10-S22-025 | input | conditional | ph "Nama topik..." | FN-M10-7.2.3 |
| EL-M10-S22-026 | button | conditional | "Batal" | FN-M10-7.2.3 |
| EL-M10-S22-027 | button | conditional | "Simpan", fa-check | FN-M10-7.2.3 |
| EL-M10-S22-028 | label | visible-default | "Jenis Soalan *" | FN-M10-7.2.4 |
| EL-M10-S22-029 | select | visible-default | label "Jenis Soalan *", `question_type`, 5 options | FN-M10-7.2.4 |
| EL-M10-S22-030 | label | visible-default | "Tahap Kesukaran *" | FN-M10-7.2.4 |
| EL-M10-S22-031 | select | visible-default | label "Tahap Kesukaran *", `difficulty_level`, 4 options | FN-M10-7.2.4 |
| EL-M10-S22-032 | label | visible-default | "Jenis Tulisan" | FN-M10-7.2.4 |
| EL-M10-S22-033 | select | visible-default | label "Jenis Tulisan", `script_type`, 4 options | FN-M10-7.2.4 |
| EL-M10-S22-034 | hidden-field | hidden-only | label "Jenis Tulisan", `text_direction`, type hidden | FN-M10-7.2.4 |
| EL-M10-S22-035 | card | visible-default | "Pemetaan DSKP" | FN-M10-7.2.5 |
| EL-M10-S22-036 | heading | visible-default | "Pemetaan DSKP" | FN-M10-7.2.5 |
| EL-M10-S22-037 | text | visible-default | "Dokumen Standard Kurikulum dan Pentaksiran — Bidang → Standard Kandungan → Standard Pembel" | FN-M10-7.2.5 |
| EL-M10-S22-038 | label | visible-default | "Bidang / Tema" | FN-M10-7.2.5 |
| EL-M10-S22-039 | select | visible-default | 1 options | FN-M10-7.2.5 |
| EL-M10-S22-040 | button | visible-default | fa-plus | FN-M10-7.2.5 |
| EL-M10-S22-041 | text | conditional | "Bidang Baru", fa-plus-circle | FN-M10-7.2.5 |
| EL-M10-S22-042 | input | conditional | ph "Kod (cth: B1)" | FN-M10-7.2.5 |
| EL-M10-S22-043 | input | conditional | ph "Nama bidang..." | FN-M10-7.2.5 |
| EL-M10-S22-044 | button | conditional | "Batal" | FN-M10-7.2.5 |
| EL-M10-S22-045 | button | conditional | "Simpan", fa-check | FN-M10-7.2.5 |
| EL-M10-S22-046 | label | visible-default | "Standard Kandungan (SK)" | FN-M10-7.2.5 |
| EL-M10-S22-047 | select | visible-default | 1 options | FN-M10-7.2.5 |
| EL-M10-S22-048 | button | visible-default | fa-plus | FN-M10-7.2.5 |
| EL-M10-S22-049 | text | conditional | "SK Baru", fa-plus-circle | FN-M10-7.2.5 |
| EL-M10-S22-050 | input | conditional | ph "Kod (cth: 1.1)" | FN-M10-7.2.5 |
| EL-M10-S22-051 | input | conditional | ph "Penerangan SK..." | FN-M10-7.2.5 |
| EL-M10-S22-052 | button | conditional | "Batal" | FN-M10-7.2.5 |
| EL-M10-S22-053 | button | conditional | "Simpan", fa-check | FN-M10-7.2.5 |
| EL-M10-S22-054 | label | visible-default | "Standard Pembelajaran (SP)" | FN-M10-7.2.5 |
| EL-M10-S22-055 | select | visible-default | `dskp_sp_id`, 1 options | FN-M10-7.2.5 |
| EL-M10-S22-056 | button | visible-default | fa-plus | FN-M10-7.2.5 |
| EL-M10-S22-057 | text | conditional | "SP Baru", fa-plus-circle | FN-M10-7.2.5 |
| EL-M10-S22-058 | input | conditional | ph "Kod (cth: 1.1.1)" | FN-M10-7.2.5 |
| EL-M10-S22-059 | input | conditional | ph "Penerangan SP..." | FN-M10-7.2.5 |
| EL-M10-S22-060 | button | conditional | "Batal" | FN-M10-7.2.5 |
| EL-M10-S22-061 | button | conditional | "Simpan", fa-check | FN-M10-7.2.5 |
| EL-M10-S22-062 | text | visible-default | "Pemetaan DSKP memastikan soalan selaras dengan kurikulum KSSM/KSSR.", fa-info-circle | FN-M10-7.2.5 |
| EL-M10-S22-063 | card | visible-default | "Soalan" | FN-M10-7.2.6 |
| EL-M10-S22-064 | heading | visible-default | "Soalan" | FN-M10-7.2.6 |
| EL-M10-S22-065 | textarea | visible-default | `question_text`, ph "Tuliskan soalan di sini..." | FN-M10-7.2.6 |
| EL-M10-S22-066 | button | visible-default | fa-keyboard | FN-M10-7.2.6 |
| EL-M10-S22-067 | text | hidden-only | "Pratonton paparan soalan:", fa-eye | FN-M10-7.2.6 |
| EL-M10-S22-068 | label | visible-default | "Imej Soalan (Pilihan)" | FN-M10-7.2.7 |
| EL-M10-S22-069 | label | visible-default | "Muat Naik" | FN-M10-7.2.7 |
| EL-M10-S22-070 | input | hidden-only | label "Muat Naik", `question_image`, type file | FN-M10-7.2.7 |
| EL-M10-S22-071 | button | visible-default | "Galeri Rajah", fa-images | FN-M10-7.2.7 |
| EL-M10-S22-072 | text | visible-default | "Muat naik imej soalan (pilihan)" | FN-M10-7.2.7 |
| EL-M10-S22-073 | hidden-field | hidden-only | label "Imej Soalan (Pilihan)", `question_image_url`, type hidden | FN-M10-7.2.7 |
| EL-M10-S22-074 | image | hidden-only | (no text) | FN-M10-7.2.7 |
| EL-M10-S22-075 | button | hidden-only | fa-times | FN-M10-7.2.7 |
| EL-M10-S22-076 | badge | hidden-only | "Dari Galeri" | FN-M10-7.2.7 |
| EL-M10-S22-077 | modal | conditional | "Galeri Rajah" | FN-M10-7.2.7 |
| EL-M10-S22-078 | clickable | conditional | (no text) | FN-M10-7.2.7 |
| EL-M10-S22-079 | clickable | conditional | "Galeri Rajah Tiada galeri tersedia Semua Set / Memuatkan... Tiada galeri rajah tersedia Si", fa-images | FN-M10-7.2.7 |
| EL-M10-S22-080 | heading | conditional | "Galeri Rajah" | FN-M10-7.2.7 |
| EL-M10-S22-081 | button | conditional | fa-times | FN-M10-7.2.7 |
| EL-M10-S22-082 | button | hidden-only | "Semua Set", fa-arrow-left | FN-M10-7.2.7 |
| EL-M10-S22-083 | button | hidden-only | fa-folder | FN-M10-7.2.7 |
| EL-M10-S22-084 | button | hidden-only | fa-check | FN-M10-7.2.7 |
| EL-M10-S22-085 | image | hidden-only | (no text) | FN-M10-7.2.7 |
| EL-M10-S22-086 | button | hidden-only | "Batal" | FN-M10-7.2.7 |
| EL-M10-S22-087 | button | hidden-only | "Pilih Rajah Ini", fa-check | FN-M10-7.2.7 |
| EL-M10-S22-088 | card | visible-default | "Pilihan Jawapan" | FN-M10-7.2.8 |
| EL-M10-S22-089 | heading | visible-default | "Pilihan Jawapan" | FN-M10-7.2.8 |
| EL-M10-S22-090 | text | visible-default | "Masukkan 4 pilihan dan pilih jawapan yang betul." | FN-M10-7.2.8 |
| EL-M10-S22-091 | radio | visible-default | `correct_option`, type radio | FN-M10-7.2.8 |
| EL-M10-S22-092 | text | visible-default | "A" | FN-M10-7.2.8 |
| EL-M10-S22-093 | input | visible-default | `options[0][text]`, ph "Pilihan A" | FN-M10-7.2.8 |
| EL-M10-S22-094 | label | visible-default | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-095 | input | hidden-only | `options[0][image]`, type file | FN-M10-7.2.8 |
| EL-M10-S22-096 | image | hidden-only | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-097 | button | hidden-only | fa-times | FN-M10-7.2.8 |
| EL-M10-S22-098 | radio | visible-default | `correct_option`, type radio | FN-M10-7.2.8 |
| EL-M10-S22-099 | text | visible-default | "B" | FN-M10-7.2.8 |
| EL-M10-S22-100 | input | visible-default | `options[1][text]`, ph "Pilihan B" | FN-M10-7.2.8 |
| EL-M10-S22-101 | label | visible-default | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-102 | input | hidden-only | `options[1][image]`, type file | FN-M10-7.2.8 |
| EL-M10-S22-103 | image | hidden-only | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-104 | button | hidden-only | fa-times | FN-M10-7.2.8 |
| EL-M10-S22-105 | radio | visible-default | `correct_option`, type radio | FN-M10-7.2.8 |
| EL-M10-S22-106 | text | visible-default | "C" | FN-M10-7.2.8 |
| EL-M10-S22-107 | input | visible-default | `options[2][text]`, ph "Pilihan C" | FN-M10-7.2.8 |
| EL-M10-S22-108 | label | visible-default | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-109 | input | hidden-only | `options[2][image]`, type file | FN-M10-7.2.8 |
| EL-M10-S22-110 | image | hidden-only | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-111 | button | hidden-only | fa-times | FN-M10-7.2.8 |
| EL-M10-S22-112 | radio | visible-default | `correct_option`, type radio | FN-M10-7.2.8 |
| EL-M10-S22-113 | text | visible-default | "D" | FN-M10-7.2.8 |
| EL-M10-S22-114 | input | visible-default | `options[3][text]`, ph "Pilihan D" | FN-M10-7.2.8 |
| EL-M10-S22-115 | label | visible-default | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-116 | input | hidden-only | `options[3][image]`, type file | FN-M10-7.2.8 |
| EL-M10-S22-117 | image | hidden-only | (no text) | FN-M10-7.2.8 |
| EL-M10-S22-118 | button | hidden-only | fa-times | FN-M10-7.2.8 |
| EL-M10-S22-119 | text | visible-default | "Klik butang bulat untuk memilih jawapan yang betul.", fa-info-circle | FN-M10-7.2.8 |
| EL-M10-S22-120 | card | conditional | "Jawapan Betul / Salah" | FN-M10-7.2.9 |
| EL-M10-S22-121 | heading | conditional | "Jawapan Betul / Salah" | FN-M10-7.2.9 |
| EL-M10-S22-122 | text | conditional | "Pilih jawapan yang betul untuk pernyataan ini." | FN-M10-7.2.9 |
| EL-M10-S22-123 | label | conditional | "Betul" | FN-M10-7.2.9 |
| EL-M10-S22-124 | radio | hidden-only | label "Betul", `tf_answer`, type radio | FN-M10-7.2.9 |
| EL-M10-S22-125 | label | conditional | "Salah" | FN-M10-7.2.9 |
| EL-M10-S22-126 | radio | hidden-only | label "Salah", `tf_answer`, type radio | FN-M10-7.2.9 |
| EL-M10-S22-127 | card | conditional | "Jawapan Betul" | FN-M10-7.2.10 |
| EL-M10-S22-128 | heading | conditional | "Jawapan Betul" | FN-M10-7.2.10 |
| EL-M10-S22-129 | text | conditional | "Masukkan jawapan yang betul. Pelajar akan dipadankan secara automatik." | FN-M10-7.2.10 |
| EL-M10-S22-130 | text | conditional | "Gunakan dalam soalan untuk tempat kosong, dan masukkan jawapan betul di bawah." | FN-M10-7.2.10 |
| EL-M10-S22-131 | text | conditional | "___" | FN-M10-7.2.10 |
| EL-M10-S22-132 | label | conditional | "Jawapan Utama *" | FN-M10-7.2.10 |
| EL-M10-S22-133 | input | conditional | label "Jawapan Utama *", `correct_answer`, ph "Jawapan yang betul..." | FN-M10-7.2.10 |
| EL-M10-S22-134 | label | conditional | "Jawapan Alternatif (Pilihan)" | FN-M10-7.2.10 |
| EL-M10-S22-135 | input | conditional | label "Jawapan Alternatif (Pilihan)", `alt_answers`, ph "Pisahkan dengan koma, cth: jawapan1, jawapan2" | FN-M10-7.2.10 |
| EL-M10-S22-136 | text | conditional | "Jawapan alternatif yang juga diterima sebagai betul." | FN-M10-7.2.10 |
| EL-M10-S22-137 | card | conditional | "Jawapan Contoh (Model Answer)" | FN-M10-7.2.11 |
| EL-M10-S22-138 | heading | conditional | "Jawapan Contoh (Model Answer)" | FN-M10-7.2.11 |
| EL-M10-S22-139 | text | conditional | "Masukkan jawapan contoh sebagai rujukan pelajar selepas menjawab." | FN-M10-7.2.11 |
| EL-M10-S22-140 | textarea | conditional | `model_answer`, ph "Tulis jawapan contoh di sini..." | FN-M10-7.2.11 |
| EL-M10-S22-141 | card | visible-default | "Penerangan (Pilihan)" | FN-M10-7.2.12 |
| EL-M10-S22-142 | heading | visible-default | "Penerangan (Pilihan)" | FN-M10-7.2.12 |
| EL-M10-S22-143 | textarea | visible-default | `explanation`, ph "Terangkan jawapan yang betul untuk membantu pelajar faham..." | FN-M10-7.2.12 |
| EL-M10-S22-144 | link | visible-default | "Batal", → /guru/soalan, fa-times | FN-M10-7.2.13 |
| EL-M10-S22-145 | button | visible-default | "Hantar untuk Semakan", fa-paper-plane | FN-M10-7.2.13 |
| EL-M10-S22-146 | card | visible-default | "عربي" | FN-M10-7.2.14 |
| EL-M10-S22-147 | clickable | hidden-only | (no text) | FN-M10-7.2.14 |
| EL-M10-S22-148 | modal | hidden-only | "عربي" | FN-M10-7.2.14 |
| EL-M10-S22-149 | button | hidden-only | "عربي" | FN-M10-7.2.14 |
| EL-M10-S22-150 | button | hidden-only | "جاوي" | FN-M10-7.2.14 |
| EL-M10-S22-151 | text | hidden-only | "Papan Kekunci Arab" | FN-M10-7.2.14 |
| EL-M10-S22-152 | button | hidden-only | fa-times | FN-M10-7.2.14 |
| EL-M10-S22-153 | button | hidden-only | (no text) | FN-M10-7.2.14 |
| EL-M10-S22-154 | button | hidden-only | (no text) | FN-M10-7.2.14 |
| EL-M10-S22-155 | button | hidden-only | "ض" | FN-M10-7.2.14 |
| EL-M10-S22-156 | button | hidden-only | "ص" | FN-M10-7.2.14 |
| EL-M10-S22-157 | button | hidden-only | "ث" | FN-M10-7.2.14 |
| EL-M10-S22-158 | button | hidden-only | "ق" | FN-M10-7.2.14 |
| EL-M10-S22-159 | button | hidden-only | "ف" | FN-M10-7.2.14 |
| EL-M10-S22-160 | button | hidden-only | "غ" | FN-M10-7.2.14 |
| EL-M10-S22-161 | button | hidden-only | "ع" | FN-M10-7.2.14 |
| EL-M10-S22-162 | button | hidden-only | "ه" | FN-M10-7.2.14 |
| EL-M10-S22-163 | button | hidden-only | "خ" | FN-M10-7.2.14 |
| EL-M10-S22-164 | button | hidden-only | "ح" | FN-M10-7.2.14 |
| EL-M10-S22-165 | button | hidden-only | "ج" | FN-M10-7.2.14 |
| EL-M10-S22-166 | button | hidden-only | "د" | FN-M10-7.2.14 |
| EL-M10-S22-167 | button | hidden-only | (no text) | FN-M10-7.2.14 |
| EL-M10-S22-168 | button | hidden-only | "ش" | FN-M10-7.2.14 |
| EL-M10-S22-169 | button | hidden-only | "س" | FN-M10-7.2.14 |
| EL-M10-S22-170 | button | hidden-only | "ي" | FN-M10-7.2.14 |
| EL-M10-S22-171 | button | hidden-only | "ب" | FN-M10-7.2.14 |
| EL-M10-S22-172 | button | hidden-only | "ل" | FN-M10-7.2.14 |
| EL-M10-S22-173 | button | hidden-only | "ا" | FN-M10-7.2.14 |
| EL-M10-S22-174 | button | hidden-only | "ت" | FN-M10-7.2.14 |
| EL-M10-S22-175 | button | hidden-only | "ن" | FN-M10-7.2.14 |
| EL-M10-S22-176 | button | hidden-only | "م" | FN-M10-7.2.14 |
| EL-M10-S22-177 | button | hidden-only | "ك" | FN-M10-7.2.14 |
| EL-M10-S22-178 | button | hidden-only | "ط" | FN-M10-7.2.14 |
| EL-M10-S22-179 | button | hidden-only | (no text) | FN-M10-7.2.14 |
| EL-M10-S22-180 | button | hidden-only | "ئ" | FN-M10-7.2.14 |
| EL-M10-S22-181 | button | hidden-only | "ء" | FN-M10-7.2.14 |
| EL-M10-S22-182 | button | hidden-only | "ؤ" | FN-M10-7.2.14 |
| EL-M10-S22-183 | button | hidden-only | "ر" | FN-M10-7.2.14 |
| EL-M10-S22-184 | button | hidden-only | "لا" | FN-M10-7.2.14 |
| EL-M10-S22-185 | button | hidden-only | "ى" | FN-M10-7.2.14 |
| EL-M10-S22-186 | button | hidden-only | "و" | FN-M10-7.2.14 |
| EL-M10-S22-187 | button | hidden-only | "ز" | FN-M10-7.2.14 |
| EL-M10-S22-188 | button | hidden-only | "ظ" | FN-M10-7.2.14 |
| EL-M10-S22-189 | button | hidden-only | (no text) | FN-M10-7.2.14 |
| EL-M10-S22-190 | button | hidden-only | "◌َ" | FN-M10-7.2.14 |
| EL-M10-S22-191 | button | hidden-only | "◌ِ" | FN-M10-7.2.14 |
| EL-M10-S22-192 | button | hidden-only | "◌ُ" | FN-M10-7.2.14 |
| EL-M10-S22-193 | button | hidden-only | "◌ْ" | FN-M10-7.2.14 |
| EL-M10-S22-194 | button | hidden-only | "◌ً" | FN-M10-7.2.14 |
| EL-M10-S22-195 | button | hidden-only | "◌ٍ" | FN-M10-7.2.14 |
| EL-M10-S22-196 | button | hidden-only | "◌ٌ" | FN-M10-7.2.14 |
| EL-M10-S22-197 | button | hidden-only | "◌ّ" | FN-M10-7.2.14 |
| EL-M10-S22-198 | button | hidden-only | "◌ٰ" | FN-M10-7.2.14 |
| EL-M10-S22-199 | button | hidden-only | "SPACE" | FN-M10-7.2.14 |
| EL-M10-S22-200 | button | hidden-only | "ال" | FN-M10-7.2.14 |
| EL-M10-S22-201 | button | hidden-only | "ة" | FN-M10-7.2.14 |
| EL-M10-S22-202 | button | hidden-only | fa-delete-left | FN-M10-7.2.14 |
| EL-M10-S22-203 | button | hidden-only | fa-turn-down | FN-M10-7.2.14 |
| EL-M10-S22-204 | textarea | conditional | `question_text`, ph "اكتب السؤال هنا..." | FN-M10-7.2.6 |
| EL-M10-S22-205 | text | conditional | "Pratonton paparan soalan:", fa-eye | FN-M10-7.2.6 |
| EL-M10-S22-206 | text | conditional | "(Tiada teks lagi)" | FN-M10-7.2.6 |

#### S23 — `/guru/soalan/{id}` (30 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S23-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S23-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S23-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S23-004 | link | visible-default | "Kembali", → /guru/soalan, fa-arrow-left | FN-M10-7.3.1 |
| EL-M10-S23-005 | link | visible-default | "Edit Soalan", → /guru/soalan/522425/edit, fa-edit | FN-M10-7.3.1 |
| EL-M10-S23-006 | card | visible-default | "Bahasa Melayu" | FN-M10-7.3.2 |
| EL-M10-S23-007 | badge | visible-default | "Bahasa Melayu" | FN-M10-7.3.2 |
| EL-M10-S23-008 | badge | visible-default | "textbook_content_rebuild" | FN-M10-7.3.2 |
| EL-M10-S23-009 | badge | visible-default | "Tahap 4" | FN-M10-7.3.2 |
| EL-M10-S23-010 | badge | visible-default | "mcq" | FN-M10-7.3.2 |
| EL-M10-S23-011 | text | visible-default | "Dalam tugasan pengukuhan, pilih ayat dialog yang betul dari segi tanda baca?" | FN-M10-7.3.2 |
| EL-M10-S23-012 | text | visible-default | "A)" | FN-M10-7.3.2 |
| EL-M10-S23-013 | text | visible-default | "Danish berkata, "Mari kita kemas bilik ini bersama-sama."." | FN-M10-7.3.2 |
| EL-M10-S23-014 | text | visible-default | "B)" | FN-M10-7.3.2 |
| EL-M10-S23-015 | text | visible-default | "Danish berkata, Mari kita kemas bilik ini bersama-sama." | FN-M10-7.3.2 |
| EL-M10-S23-016 | text | visible-default | "C)" | FN-M10-7.3.2 |
| EL-M10-S23-017 | text | visible-default | "Danish berkata, "Mari kita kemas bilik ini bersama-sama."" | FN-M10-7.3.2 |
| EL-M10-S23-018 | text | visible-default | "D)" | FN-M10-7.3.2 |
| EL-M10-S23-019 | text | visible-default | "Danish berkata "Mari kita kemas bilik ini bersama-sama."" | FN-M10-7.3.2 |
| EL-M10-S23-020 | card | visible-default | "Penerangan" | FN-M10-7.3.3 |
| EL-M10-S23-021 | heading | visible-default | "Penerangan" | FN-M10-7.3.3 |
| EL-M10-S23-022 | text | visible-default | "Konsep ini disemak dalam skop bab buku teks yang sama. Pilihan betul dikekalkan kerana ia " | FN-M10-7.3.3 |
| EL-M10-S23-023 | card | visible-default | "Statistik" | FN-M10-7.3.3 |
| EL-M10-S23-024 | heading | visible-default | "Statistik" | FN-M10-7.3.3 |
| EL-M10-S23-025 | text | visible-default | "0" | FN-M10-7.3.3 |
| EL-M10-S23-026 | text | visible-default | "Kali Digunakan" | FN-M10-7.3.3 |
| EL-M10-S23-027 | text | visible-default | "0" | FN-M10-7.3.3 |
| EL-M10-S23-028 | text | visible-default | "Jawab Betul" | FN-M10-7.3.3 |
| EL-M10-S23-029 | text | visible-default | "0%" | FN-M10-7.3.3 |
| EL-M10-S23-030 | text | visible-default | "Ketepatan" | FN-M10-7.3.3 |

#### S24 — `/guru/soalan/{id}/edit` (44 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S24-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S24-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S24-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S24-004 | link | visible-default | "Kembali", → /guru/soalan/522425, fa-arrow-left | FN-M10-7.4.1 |
| EL-M10-S24-005 | form | visible-default | (no text) | FN-M10-7.4.1 |
| EL-M10-S24-006 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.4.1 |
| EL-M10-S24-007 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-7.4.1 |
| EL-M10-S24-008 | card | visible-default | "Sumber Asal" | FN-M10-7.4.2 |
| EL-M10-S24-009 | text | visible-default | "Sumber Asal" | FN-M10-7.4.2 |
| EL-M10-S24-010 | text | visible-default | "textbook_content_rebuild" | FN-M10-7.4.2 |
| EL-M10-S24-011 | card | visible-default | "Soalan *" | FN-M10-7.4.3 |
| EL-M10-S24-012 | label | visible-default | "Soalan *" | FN-M10-7.4.3 |
| EL-M10-S24-013 | textarea | visible-default | label "Soalan *", `question_text` | FN-M10-7.4.3 |
| EL-M10-S24-014 | card | visible-default | "Tambah Gambarajah (optional)" | FN-M10-7.4.3 |
| EL-M10-S24-015 | label | visible-default | "Tambah Gambarajah (optional)" | FN-M10-7.4.3 |
| EL-M10-S24-016 | input | visible-default | label "Tambah Gambarajah (optional)", `image`, type file | FN-M10-7.4.3 |
| EL-M10-S24-017 | text | visible-default | "JPG, PNG, max 5MB." | FN-M10-7.4.3 |
| EL-M10-S24-018 | card | visible-default | "Tahap Kesukaran" | FN-M10-7.4.4 |
| EL-M10-S24-019 | label | visible-default | "Tahap Kesukaran" | FN-M10-7.4.4 |
| EL-M10-S24-020 | select | visible-default | label "Tahap Kesukaran", `difficulty_level`, 4 options | FN-M10-7.4.4 |
| EL-M10-S24-021 | card | visible-default | "Pilihan Jawapan *" | FN-M10-7.4.5 |
| EL-M10-S24-022 | label | visible-default | "Pilihan Jawapan *" | FN-M10-7.4.5 |
| EL-M10-S24-023 | hidden-field | hidden-only | `options[0][id]`, type hidden | FN-M10-7.4.5 |
| EL-M10-S24-024 | radio | visible-default | `correct_option`, type radio | FN-M10-7.4.5 |
| EL-M10-S24-025 | text | visible-default | "A)" | FN-M10-7.4.5 |
| EL-M10-S24-026 | textarea | visible-default | `options[0][option_text]` | FN-M10-7.4.5 |
| EL-M10-S24-027 | hidden-field | hidden-only | `options[1][id]`, type hidden | FN-M10-7.4.5 |
| EL-M10-S24-028 | radio | visible-default | `correct_option`, type radio | FN-M10-7.4.5 |
| EL-M10-S24-029 | text | visible-default | "B)" | FN-M10-7.4.5 |
| EL-M10-S24-030 | textarea | visible-default | `options[1][option_text]` | FN-M10-7.4.5 |
| EL-M10-S24-031 | hidden-field | hidden-only | `options[2][id]`, type hidden | FN-M10-7.4.5 |
| EL-M10-S24-032 | radio | visible-default | `correct_option`, type radio | FN-M10-7.4.5 |
| EL-M10-S24-033 | text | visible-default | "C)" | FN-M10-7.4.5 |
| EL-M10-S24-034 | textarea | visible-default | `options[2][option_text]` | FN-M10-7.4.5 |
| EL-M10-S24-035 | hidden-field | hidden-only | `options[3][id]`, type hidden | FN-M10-7.4.5 |
| EL-M10-S24-036 | radio | visible-default | `correct_option`, type radio | FN-M10-7.4.5 |
| EL-M10-S24-037 | text | visible-default | "D)" | FN-M10-7.4.5 |
| EL-M10-S24-038 | textarea | visible-default | `options[3][option_text]` | FN-M10-7.4.5 |
| EL-M10-S24-039 | text | visible-default | "Pilih radio button untuk tandakan jawapan betul", fa-info-circle | FN-M10-7.4.5 |
| EL-M10-S24-040 | card | visible-default | "Penerangan (optional)" | FN-M10-7.4.6 |
| EL-M10-S24-041 | label | visible-default | "Penerangan (optional)" | FN-M10-7.4.6 |
| EL-M10-S24-042 | textarea | visible-default | label "Penerangan (optional)", `explanation` | FN-M10-7.4.6 |
| EL-M10-S24-043 | button | visible-default | "Simpan Perubahan", fa-save | FN-M10-7.4.7 |
| EL-M10-S24-044 | link | visible-default | "Batal", → /guru/soalan/522425 | FN-M10-7.4.7 |

#### S25 — `/guru/audio-kbat` (31 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S25-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S25-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S25-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S25-004 | badge | visible-default | "Ujian Mendengar", fa-headphones | FN-M10-7.5.1 |
| EL-M10-S25-005 | heading | visible-default | "Set Audio KBAT" | FN-M10-7.5.1 |
| EL-M10-S25-006 | text | visible-default | "Senarai set soalan audio fixed sequence, bukan rawak." | FN-M10-7.5.1 |
| EL-M10-S25-007 | link | visible-default | "Template XLSX", → /guru/audio-kbat/template, fa-file-excel | FN-M10-7.5.1 |
| EL-M10-S25-008 | link | visible-default | "Template Word", → /guru/audio-kbat/template-word, fa-file-word | FN-M10-7.5.1 |
| EL-M10-S25-009 | link | visible-default | "Cipta Set", → /guru/audio-kbat/create, fa-plus | FN-M10-7.5.1 |
| EL-M10-S25-010 | text | visible-default | "Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT" | FN-M10-7.5.2 |
| EL-M10-S25-011 | text | visible-default | "Set ini bukan soalan rawak. Cikgu perlu bekalkan satu set lengkap 30 soalan MCQ bersama 4 " | FN-M10-7.5.2 |
| EL-M10-S25-012 | text | visible-default | "Jika cikgu mahu bahan yang mudah ditaip, gunakan Template Word. Jika mahu format paling se" | FN-M10-7.5.2 |
| EL-M10-S25-013 | card | visible-default | "Set" | FN-M10-7.5.3 |
| EL-M10-S25-014 | text | visible-default | "Set" | FN-M10-7.5.3 |
| EL-M10-S25-015 | text | visible-default | "0" | FN-M10-7.5.3 |
| EL-M10-S25-016 | card | visible-default | "Approved" | FN-M10-7.5.3 |
| EL-M10-S25-017 | text | visible-default | "Approved" | FN-M10-7.5.3 |
| EL-M10-S25-018 | text | visible-default | "0" | FN-M10-7.5.3 |
| EL-M10-S25-019 | card | visible-default | "Draft/Pending" | FN-M10-7.5.3 |
| EL-M10-S25-020 | text | visible-default | "Draft/Pending" | FN-M10-7.5.3 |
| EL-M10-S25-021 | text | visible-default | "0" | FN-M10-7.5.3 |
| EL-M10-S25-022 | card | visible-default | "Soalan" | FN-M10-7.5.3 |
| EL-M10-S25-023 | text | visible-default | "Soalan" | FN-M10-7.5.3 |
| EL-M10-S25-024 | text | visible-default | "0" | FN-M10-7.5.3 |
| EL-M10-S25-025 | form | visible-default | (no text) | FN-M10-7.5.4 |
| EL-M10-S25-026 | select | visible-default | `education_level_id`, 12 options | FN-M10-7.5.4 |
| EL-M10-S25-027 | select | visible-default | `subject_id`, 32 options | FN-M10-7.5.4 |
| EL-M10-S25-028 | select | visible-default | `status`, 5 options | FN-M10-7.5.4 |
| EL-M10-S25-029 | input | visible-default | `search`, ph "Cari tajuk/sumber..." | FN-M10-7.5.4 |
| EL-M10-S25-030 | button | visible-default | "Tapis", fa-search | FN-M10-7.5.4 |
| EL-M10-S25-031 | text | visible-default | "Belum ada set Audio KBAT.", fa-headphones | FN-M10-7.5.5 |

#### S26 — `/guru/audio-kbat/create` (106 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S26-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S26-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S26-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S26-004 | link | visible-default | "Kembali", → /guru/audio-kbat, fa-arrow-left | FN-M10-7.6.1 |
| EL-M10-S26-005 | heading | visible-default | "Cipta Set Audio KBAT" | FN-M10-7.6.1 |
| EL-M10-S26-006 | text | visible-default | "Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section." | FN-M10-7.6.1 |
| EL-M10-S26-007 | text | visible-default | "Apa yang cikgu perlu sediakan?" | FN-M10-7.6.1 |
| EL-M10-S26-008 | text | visible-default | "Lengkapkan 30 soalan mengikut turutan asal. Upload audio untuk setiap bahagian: soalan 1-8" | FN-M10-7.6.1 |
| EL-M10-S26-009 | text | visible-default | "Jika cikgu bekalkan bahan offline, Word lebih mudah untuk menulis soalan dan transkrip. XL" | FN-M10-7.6.1 |
| EL-M10-S26-010 | link | visible-default | "Template Word", → /guru/audio-kbat/template-word, fa-file-word | FN-M10-7.6.1 |
| EL-M10-S26-011 | link | visible-default | "Template XLSX", → /guru/audio-kbat/template, fa-file-excel | FN-M10-7.6.1 |
| EL-M10-S26-012 | form | visible-default | (no text) | FN-M10-7.6.2 |
| EL-M10-S26-013 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-7.6.2 |
| EL-M10-S26-014 | card | visible-default | "Maklumat Set" | FN-M10-7.6.2 |
| EL-M10-S26-015 | heading | visible-default | "Maklumat Set" | FN-M10-7.6.2 |
| EL-M10-S26-016 | label | visible-default | "Tajuk Set" | FN-M10-7.6.2 |
| EL-M10-S26-017 | input | visible-default | label "Tajuk Set", `title`, ph "Contoh: BM T4 Ujian Mendengar Set 1" | FN-M10-7.6.2 |
| EL-M10-S26-018 | label | visible-default | "Tahap" | FN-M10-7.6.2 |
| EL-M10-S26-019 | select | visible-default | label "Tahap", `education_level_id`, 12 options | FN-M10-7.6.2 |
| EL-M10-S26-020 | label | visible-default | "Subjek" | FN-M10-7.6.2 |
| EL-M10-S26-021 | select | visible-default | label "Subjek", `subject_id`, 32 options | FN-M10-7.6.2 |
| EL-M10-S26-022 | label | visible-default | "Sumber / Penyumbang" | FN-M10-7.6.2 |
| EL-M10-S26-023 | input | visible-default | label "Sumber / Penyumbang", `source_label`, ph "Contoh: Cikgu Nur Demo" | FN-M10-7.6.2 |
| EL-M10-S26-024 | label | visible-default | "Arahan Umum" | FN-M10-7.6.2 |
| EL-M10-S26-025 | textarea | visible-default | label "Arahan Umum", `instructions`, ph "Dengar audio bagi setiap bahagian dan jawab semua soalan." | FN-M10-7.6.2 |
| EL-M10-S26-026 | card | visible-default | "Bahagian 1 · Soalan 1-8" | FN-M10-7.6.3 |
| EL-M10-S26-027 | heading | visible-default | "Bahagian 1 · Soalan 1-8" | FN-M10-7.6.3 |
| EL-M10-S26-028 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M10-7.6.3 |
| EL-M10-S26-029 | label | visible-default | "Tajuk Audio" | FN-M10-7.6.3 |
| EL-M10-S26-030 | input | visible-default | label "Tajuk Audio", `sections[1][title]` | FN-M10-7.6.3 |
| EL-M10-S26-031 | label | visible-default | "Fail Audio" | FN-M10-7.6.3 |
| EL-M10-S26-032 | input | visible-default | label "Fail Audio", `sections[1][audio]`, type file | FN-M10-7.6.3 |
| EL-M10-S26-033 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M10-7.6.3 |
| EL-M10-S26-034 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[1][transcript]`, ph "Wajib digalakkan untuk semakan admin." | FN-M10-7.6.3 |
| EL-M10-S26-035 | heading | visible-default | "Soalan 1" | FN-M10-7.6.4 |
| EL-M10-S26-036 | badge | visible-default | "KBAT Audio" | FN-M10-7.6.4 |
| EL-M10-S26-037 | label | visible-default | "Teks Soalan" | FN-M10-7.6.4 |
| EL-M10-S26-038 | textarea | visible-default | `questions[1][question_text]` | FN-M10-7.6.4 |
| EL-M10-S26-039 | label | visible-default | "Pilihan A" | FN-M10-7.6.4 |
| EL-M10-S26-040 | input | visible-default | label "Pilihan A", `questions[1][option_a]` | FN-M10-7.6.4 |
| EL-M10-S26-041 | label | visible-default | "Pilihan B" | FN-M10-7.6.4 |
| EL-M10-S26-042 | input | visible-default | label "Pilihan B", `questions[1][option_b]` | FN-M10-7.6.4 |
| EL-M10-S26-043 | label | visible-default | "Pilihan C" | FN-M10-7.6.4 |
| EL-M10-S26-044 | input | visible-default | label "Pilihan C", `questions[1][option_c]` | FN-M10-7.6.4 |
| EL-M10-S26-045 | label | visible-default | "Pilihan D" | FN-M10-7.6.4 |
| EL-M10-S26-046 | input | visible-default | label "Pilihan D", `questions[1][option_d]` | FN-M10-7.6.4 |
| EL-M10-S26-047 | label | visible-default | "Jawapan" | FN-M10-7.6.4 |
| EL-M10-S26-048 | select | visible-default | label "Jawapan", `questions[1][correct_answer]`, 4 options | FN-M10-7.6.4 |
| EL-M10-S26-049 | label | visible-default | "Markah" | FN-M10-7.6.4 |
| EL-M10-S26-050 | input | visible-default | label "Markah", `questions[1][marks]`, type number | FN-M10-7.6.4 |
| EL-M10-S26-051 | label | visible-default | "KBAT Level" | FN-M10-7.6.4 |
| EL-M10-S26-052 | input | visible-default | label "KBAT Level", `questions[1][kbat_level]`, type number | FN-M10-7.6.4 |
| EL-M10-S26-053 | label | visible-default | "DSKP SP ID" | FN-M10-7.6.4 |
| EL-M10-S26-054 | input | visible-default | label "DSKP SP ID", `questions[1][dskp_sp_id]`, ph "Optional", type number | FN-M10-7.6.4 |
| EL-M10-S26-055 | label | visible-default | "Skema / Penjelasan" | FN-M10-7.6.4 |
| EL-M10-S26-056 | textarea | visible-default | `questions[1][explanation]` | FN-M10-7.6.4 |
| EL-M10-S26-057 | heading | visible-default | "Soalan 2" | FN-M10-7.6.4 |
| EL-M10-S26-058 | badge | visible-default | "KBAT Audio" | FN-M10-7.6.4 |
| EL-M10-S26-059 | label | visible-default | "Teks Soalan" | FN-M10-7.6.4 |
| EL-M10-S26-060 | textarea | visible-default | `questions[2][question_text]` | FN-M10-7.6.4 |
| EL-M10-S26-061 | label | visible-default | "Pilihan A" | FN-M10-7.6.4 |
| EL-M10-S26-062 | input | visible-default | label "Pilihan A", `questions[2][option_a]` | FN-M10-7.6.4 |
| EL-M10-S26-063 | label | visible-default | "Pilihan B" | FN-M10-7.6.4 |
| EL-M10-S26-064 | input | visible-default | label "Pilihan B", `questions[2][option_b]` | FN-M10-7.6.4 |
| EL-M10-S26-065 | label | visible-default | "Pilihan C" | FN-M10-7.6.4 |
| EL-M10-S26-066 | input | visible-default | label "Pilihan C", `questions[2][option_c]` | FN-M10-7.6.4 |
| EL-M10-S26-067 | label | visible-default | "Pilihan D" | FN-M10-7.6.4 |
| EL-M10-S26-068 | input | visible-default | label "Pilihan D", `questions[2][option_d]` | FN-M10-7.6.4 |
| EL-M10-S26-069 | label | visible-default | "Jawapan" | FN-M10-7.6.4 |
| EL-M10-S26-070 | select | visible-default | label "Jawapan", `questions[2][correct_answer]`, 4 options | FN-M10-7.6.4 |
| EL-M10-S26-071 | label | visible-default | "Markah" | FN-M10-7.6.4 |
| EL-M10-S26-072 | input | visible-default | label "Markah", `questions[2][marks]`, type number | FN-M10-7.6.4 |
| EL-M10-S26-073 | label | visible-default | "KBAT Level" | FN-M10-7.6.4 |
| EL-M10-S26-074 | input | visible-default | label "KBAT Level", `questions[2][kbat_level]`, type number | FN-M10-7.6.4 |
| EL-M10-S26-075 | label | visible-default | "DSKP SP ID" | FN-M10-7.6.4 |
| EL-M10-S26-076 | input | visible-default | label "DSKP SP ID", `questions[2][dskp_sp_id]`, ph "Optional", type number | FN-M10-7.6.4 |
| EL-M10-S26-077 | label | visible-default | "Skema / Penjelasan" | FN-M10-7.6.4 |
| EL-M10-S26-078 | textarea | visible-default | `questions[2][explanation]` | FN-M10-7.6.4 |
| EL-M10-S26-079 | card | visible-default | "Bahagian 2 · Soalan 9-16" | FN-M10-7.6.3 |
| EL-M10-S26-080 | heading | visible-default | "Bahagian 2 · Soalan 9-16" | FN-M10-7.6.3 |
| EL-M10-S26-081 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M10-7.6.3 |
| EL-M10-S26-082 | label | visible-default | "Tajuk Audio" | FN-M10-7.6.3 |
| EL-M10-S26-083 | input | visible-default | label "Tajuk Audio", `sections[2][title]` | FN-M10-7.6.3 |
| EL-M10-S26-084 | label | visible-default | "Fail Audio" | FN-M10-7.6.3 |
| EL-M10-S26-085 | input | visible-default | label "Fail Audio", `sections[2][audio]`, type file | FN-M10-7.6.3 |
| EL-M10-S26-086 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M10-7.6.3 |
| EL-M10-S26-087 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[2][transcript]`, ph "Wajib digalakkan untuk semakan admin." | FN-M10-7.6.3 |
| EL-M10-S26-088 | card | visible-default | "Bahagian 3 · Soalan 17-24" | FN-M10-7.6.3 |
| EL-M10-S26-089 | heading | visible-default | "Bahagian 3 · Soalan 17-24" | FN-M10-7.6.3 |
| EL-M10-S26-090 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M10-7.6.3 |
| EL-M10-S26-091 | label | visible-default | "Tajuk Audio" | FN-M10-7.6.3 |
| EL-M10-S26-092 | input | visible-default | label "Tajuk Audio", `sections[3][title]` | FN-M10-7.6.3 |
| EL-M10-S26-093 | label | visible-default | "Fail Audio" | FN-M10-7.6.3 |
| EL-M10-S26-094 | input | visible-default | label "Fail Audio", `sections[3][audio]`, type file | FN-M10-7.6.3 |
| EL-M10-S26-095 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M10-7.6.3 |
| EL-M10-S26-096 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[3][transcript]`, ph "Wajib digalakkan untuk semakan admin." | FN-M10-7.6.3 |
| EL-M10-S26-097 | card | visible-default | "Bahagian 4 · Soalan 25-30" | FN-M10-7.6.3 |
| EL-M10-S26-098 | heading | visible-default | "Bahagian 4 · Soalan 25-30" | FN-M10-7.6.3 |
| EL-M10-S26-099 | text | visible-default | "Audio section ini akan kekal bersama semua soalan dalam range ini." | FN-M10-7.6.3 |
| EL-M10-S26-100 | label | visible-default | "Tajuk Audio" | FN-M10-7.6.3 |
| EL-M10-S26-101 | input | visible-default | label "Tajuk Audio", `sections[4][title]` | FN-M10-7.6.3 |
| EL-M10-S26-102 | label | visible-default | "Fail Audio" | FN-M10-7.6.3 |
| EL-M10-S26-103 | input | visible-default | label "Fail Audio", `sections[4][audio]`, type file | FN-M10-7.6.3 |
| EL-M10-S26-104 | label | visible-default | "Transkrip Audio Untuk Audit" | FN-M10-7.6.3 |
| EL-M10-S26-105 | textarea | visible-default | label "Transkrip Audio Untuk Audit", `sections[4][transcript]`, ph "Wajib digalakkan untuk semakan admin." | FN-M10-7.6.3 |
| EL-M10-S26-106 | button | visible-default | "Simpan Set Audio KBAT", fa-save | FN-M10-7.6.5 |

#### S27 — `/guru/databank` (67 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S27-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S27-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S27-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S27-004 | card | visible-default | "Databank Soalan SPM" | FN-M10-8.1.1 |
| EL-M10-S27-005 | heading | visible-default | "Databank Soalan SPM" | FN-M10-8.1.1 |
| EL-M10-S27-006 | text | visible-default | "Semak & semak semula soalan SPM — Lapor jika ada masalah" | FN-M10-8.1.1 |
| EL-M10-S27-007 | card | visible-default | "Jumlah Soalan" | FN-M10-8.1.2 |
| EL-M10-S27-008 | text | visible-default | "21,033" | FN-M10-8.1.2 |
| EL-M10-S27-009 | text | visible-default | "Jumlah Soalan" | FN-M10-8.1.2 |
| EL-M10-S27-010 | card | visible-default | "Subjek Aktif" | FN-M10-8.1.2 |
| EL-M10-S27-011 | text | visible-default | "18" | FN-M10-8.1.2 |
| EL-M10-S27-012 | text | visible-default | "Subjek Aktif" | FN-M10-8.1.2 |
| EL-M10-S27-013 | alert | visible-default | "Klik mana-mana subjek untuk lihat semua soalan. Anda boleh lapor soalan yang salah atau ti", fa-lightbulb | FN-M10-8.1.2 |
| EL-M10-S27-014 | card | visible-default | "Subjek Teras (7)" | FN-M10-8.1.3 |
| EL-M10-S27-015 | heading | visible-default | "Subjek Teras (7)" | FN-M10-8.1.3 |
| EL-M10-S27-016 | link | visible-default | "Bahasa Melayu Malay Language 514 soalan", → /guru/databank/BM, fa-book-open | FN-M10-8.1.3 |
| EL-M10-S27-017 | heading | visible-default | "Bahasa Melayu" | FN-M10-8.1.3 |
| EL-M10-S27-018 | link | visible-default | "Bahasa Inggeris English Language 1,114 soalan", → /guru/databank/BI, fa-globe | FN-M10-8.1.3 |
| EL-M10-S27-019 | heading | visible-default | "Bahasa Inggeris" | FN-M10-8.1.3 |
| EL-M10-S27-020 | link | visible-default | "Matematik Mathematics 1,681 soalan", → /guru/databank/MATH, fa-calculator | FN-M10-8.1.3 |
| EL-M10-S27-021 | heading | visible-default | "Matematik" | FN-M10-8.1.3 |
| EL-M10-S27-022 | link | visible-default | "Sains Science 2,076 soalan", → /guru/databank/SCI, fa-beaker | FN-M10-8.1.3 |
| EL-M10-S27-023 | heading | visible-default | "Sains" | FN-M10-8.1.3 |
| EL-M10-S27-024 | link | visible-default | "Sejarah History 1,539 soalan", → /guru/databank/SEJ, fa-clock | FN-M10-8.1.3 |
| EL-M10-S27-025 | heading | visible-default | "Sejarah" | FN-M10-8.1.3 |
| EL-M10-S27-026 | link | visible-default | "Pendidikan Islam Islamic Education 483 soalan", → /guru/databank/PI, fa-moon | FN-M10-8.1.3 |
| EL-M10-S27-027 | heading | visible-default | "Pendidikan Islam" | FN-M10-8.1.3 |
| EL-M10-S27-028 | link | visible-default | "Pendidikan Moral Moral Education 1,353 soalan", → /guru/databank/PM, fa-heart | FN-M10-8.1.3 |
| EL-M10-S27-029 | heading | visible-default | "Pendidikan Moral" | FN-M10-8.1.3 |
| EL-M10-S27-030 | card | visible-default | "Subjek Elektif (18)" | FN-M10-8.1.4 |
| EL-M10-S27-031 | heading | visible-default | "Subjek Elektif (18)" | FN-M10-8.1.4 |
| EL-M10-S27-032 | link | visible-default | "Geografi Geography 1,228 soalan", → /guru/databank/GEO, fa-map | FN-M10-8.1.4 |
| EL-M10-S27-033 | heading | visible-default | "Geografi" | FN-M10-8.1.4 |
| EL-M10-S27-034 | link | visible-default | "Biologi Biology 1,999 soalan", → /guru/databank/BIO, fa-leaf | FN-M10-8.1.4 |
| EL-M10-S27-035 | heading | visible-default | "Biologi" | FN-M10-8.1.4 |
| EL-M10-S27-036 | link | visible-default | "Kimia Chemistry 1,009 soalan", → /guru/databank/CHEM, fa-flask-round | FN-M10-8.1.4 |
| EL-M10-S27-037 | heading | visible-default | "Kimia" | FN-M10-8.1.4 |
| EL-M10-S27-038 | link | visible-default | "Fizik Physics 1,261 soalan", → /guru/databank/PHY, fa-zap | FN-M10-8.1.4 |
| EL-M10-S27-039 | heading | visible-default | "Fizik" | FN-M10-8.1.4 |
| EL-M10-S27-040 | link | visible-default | "Perniagaan Business Studies 934 soalan", → /guru/databank/PERNIAGA, fa-briefcase | FN-M10-8.1.4 |
| EL-M10-S27-041 | heading | visible-default | "Perniagaan" | FN-M10-8.1.4 |
| EL-M10-S27-042 | link | visible-default | "Prinsip Perakaunan Principles of Accounting 1,770 soalan", → /guru/databank/AKAUN, fa-receipt | FN-M10-8.1.4 |
| EL-M10-S27-043 | heading | visible-default | "Prinsip Perakaunan" | FN-M10-8.1.4 |
| EL-M10-S27-044 | link | visible-default | "Ekonomi Economics 1,986 soalan", → /guru/databank/EKON, fa-trending-up | FN-M10-8.1.4 |
| EL-M10-S27-045 | heading | visible-default | "Ekonomi" | FN-M10-8.1.4 |
| EL-M10-S27-046 | link | visible-default | "Matematik Tambahan Additional Mathematics 501 soalan", → /guru/databank/ADDMATH, fa-variable | FN-M10-8.1.4 |
| EL-M10-S27-047 | heading | visible-default | "Matematik Tambahan" | FN-M10-8.1.4 |
| EL-M10-S27-048 | link | visible-default | "Pendidikan Seni Visual Visual Arts Education 545 soalan", → /guru/databank/PSV, fa-palette | FN-M10-8.1.4 |
| EL-M10-S27-049 | heading | visible-default | "Pendidikan Seni Visual" | FN-M10-8.1.4 |
| EL-M10-S27-050 | link | visible-default | "Pendidikan Jasmani & Kesihatan Physical & Health Education 0 soalan", → /guru/databank/PJK, fa-heart-pulse | FN-M10-8.1.4 |
| EL-M10-S27-051 | heading | visible-default | "Pendidikan Jasmani & Kesihatan" | FN-M10-8.1.4 |
| EL-M10-S27-052 | link | visible-default | "Reka Bentuk & Teknologi Design & Technology 0 soalan", → /guru/databank/RBT, fa-wrench | FN-M10-8.1.4 |
| EL-M10-S27-053 | heading | visible-default | "Reka Bentuk & Teknologi" | FN-M10-8.1.4 |
| EL-M10-S27-054 | link | visible-default | "Sains Komputer Computer Science 0 soalan", → /guru/databank/SK, fa-monitor | FN-M10-8.1.4 |
| EL-M10-S27-055 | heading | visible-default | "Sains Komputer" | FN-M10-8.1.4 |
| EL-M10-S27-056 | link | visible-default | "Bahasa Arab Arabic Language 0 soalan", → /guru/databank/BA, fa-languages | FN-M10-8.1.4 |
| EL-M10-S27-057 | heading | visible-default | "Bahasa Arab" | FN-M10-8.1.4 |
| EL-M10-S27-058 | link | visible-default | "Bahasa Cina Chinese Language 0 soalan", → /guru/databank/BC, fa-languages | FN-M10-8.1.4 |
| EL-M10-S27-059 | heading | visible-default | "Bahasa Cina" | FN-M10-8.1.4 |
| EL-M10-S27-060 | link | visible-default | "Bahasa Tamil Tamil Language 0 soalan", → /guru/databank/BT, fa-languages | FN-M10-8.1.4 |
| EL-M10-S27-061 | heading | visible-default | "Bahasa Tamil" | FN-M10-8.1.4 |
| EL-M10-S27-062 | link | visible-default | "Pendidikan Al-Quran & As-Sunnah Quranic & Sunnah Education 0 soalan", → /guru/databank/PQS, fa-fas fa-quran | FN-M10-8.1.4 |
| EL-M10-S27-063 | heading | visible-default | "Pendidikan Al-Quran & As-Sunnah" | FN-M10-8.1.4 |
| EL-M10-S27-064 | link | visible-default | "Tasawwur Islam Islamic Worldview 530 soalan", → /guru/databank/TI, fa-fas fa-mosque | FN-M10-8.1.4 |
| EL-M10-S27-065 | heading | visible-default | "Tasawwur Islam" | FN-M10-8.1.4 |
| EL-M10-S27-066 | link | visible-default | "Pendidikan Syariah Islamiah Islamic Syariah Education 510 soalan", → /guru/databank/PSI, fa-fas fa-scale-balanced | FN-M10-8.1.4 |
| EL-M10-S27-067 | heading | visible-default | "Pendidikan Syariah Islamiah" | FN-M10-8.1.4 |

#### S28 — `/guru/databank/{CODE}` (166 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S28-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S28-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S28-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S28-004 | link | visible-default | "Databank", → /guru/databank, fa-arrow-left | FN-M10-8.2.1 |
| EL-M10-S28-005 | text | visible-default | "/" | FN-M10-8.2.1 |
| EL-M10-S28-006 | text | visible-default | "Bahasa Melayu" | FN-M10-8.2.1 |
| EL-M10-S28-007 | card | visible-default | "Bahasa Melayu" | FN-M10-8.2.1 |
| EL-M10-S28-008 | heading | visible-default | "Bahasa Melayu" | FN-M10-8.2.1 |
| EL-M10-S28-009 | text | visible-default | "Malay Language" | FN-M10-8.2.1 |
| EL-M10-S28-010 | badge | visible-default | "6,048 Jumlah" | FN-M10-8.2.1 |
| EL-M10-S28-011 | alert | visible-default | "5,918 Objektif" | FN-M10-8.2.1 |
| EL-M10-S28-012 | alert | visible-default | "105 Subjektif" | FN-M10-8.2.1 |
| EL-M10-S28-013 | card | visible-default | "Carian" | FN-M10-8.2.2 |
| EL-M10-S28-014 | form | visible-default | (no text) | FN-M10-8.2.2 |
| EL-M10-S28-015 | label | visible-default | "Carian" | FN-M10-8.2.2 |
| EL-M10-S28-016 | input | visible-default | label "Carian", `q`, ph "Cari soalan..." | FN-M10-8.2.2 |
| EL-M10-S28-017 | label | visible-default | "Jenis" | FN-M10-8.2.2 |
| EL-M10-S28-018 | select | visible-default | label "Jenis", `question_type`, 3 options | FN-M10-8.2.2 |
| EL-M10-S28-019 | label | visible-default | "Sumber" | FN-M10-8.2.2 |
| EL-M10-S28-020 | select | visible-default | label "Sumber", `source_type`, 4 options | FN-M10-8.2.2 |
| EL-M10-S28-021 | label | visible-default | "Kesukaran" | FN-M10-8.2.2 |
| EL-M10-S28-022 | select | visible-default | label "Kesukaran", `difficulty`, 6 options | FN-M10-8.2.2 |
| EL-M10-S28-023 | label | visible-default | "Bidang" | FN-M10-8.2.2 |
| EL-M10-S28-024 | select | visible-default | label "Bidang", `dskp_bidang_id`, 11 options | FN-M10-8.2.2 |
| EL-M10-S28-025 | label | visible-default | "Standard Kandungan" | FN-M10-8.2.2 |
| EL-M10-S28-026 | select | visible-default | label "Standard Kandungan", `dskp_sk_id`, 1 options | FN-M10-8.2.2 |
| EL-M10-S28-027 | label | visible-default | "Standard Pembelajaran" | FN-M10-8.2.2 |
| EL-M10-S28-028 | select | visible-default | label "Standard Pembelajaran", `dskp_sp_id`, 1 options | FN-M10-8.2.2 |
| EL-M10-S28-029 | button | visible-default | "Tapis", fa-search | FN-M10-8.2.2 |
| EL-M10-S28-030 | card | visible-default | "Tahap 1" | FN-M10-8.2.3 |
| EL-M10-S28-031 | alert | visible-default | "Tahap 1" | FN-M10-8.2.3 |
| EL-M10-S28-032 | text | visible-default | "chapter_textbook_rebuild" | FN-M10-8.2.3 |
| EL-M10-S28-033 | text | visible-default | "Objektif" | FN-M10-8.2.3 |
| EL-M10-S28-034 | alert | visible-default | "Bahasa Melayu T1 - Sokongan Bab Buku Teks", fa-sitemap | FN-M10-8.2.3 |
| EL-M10-S28-035 | badge | visible-default | "ID Soalan: 525433", fa-hashtag | FN-M10-8.2.3 |
| EL-M10-S28-036 | text | visible-default | "Apakah tindakan pembaca kritis apabila menemui maklumat tentang keputusan bersama?" | FN-M10-8.2.3 |
| EL-M10-S28-037 | text | visible-default | "A." | FN-M10-8.2.3 |
| EL-M10-S28-038 | text | visible-default | "menyalin pilihan tanpa membaca" | FN-M10-8.2.3 |
| EL-M10-S28-039 | text | visible-default | "B." | FN-M10-8.2.3 |
| EL-M10-S28-040 | text | visible-default | "menilai maklumat dan menyokong jawapan dengan bukti" | FN-M10-8.2.3 |
| EL-M10-S28-041 | text | visible-default | "C." | FN-M10-8.2.3 |
| EL-M10-S28-042 | text | visible-default | "terus meneka" | FN-M10-8.2.3 |
| EL-M10-S28-043 | text | visible-default | "D." | FN-M10-8.2.3 |
| EL-M10-S28-044 | text | visible-default | "mengabaikan bukti" | FN-M10-8.2.3 |
| EL-M10-S28-045 | dropdown-trigger | visible-default | "Penerangan", fa-chevron-right | FN-M10-8.2.3 |
| EL-M10-S28-046 | text | conditional | "Jawapan tepat: menilai maklumat dan menyokong jawapan dengan bukti. Soalan ini menguji kem" | FN-M10-8.2.3 |
| EL-M10-S28-047 | text | visible-default | "Tingkatan 1" | FN-M10-8.2.3 |
| EL-M10-S28-048 | button | visible-default | "Lapor Masalah", fa-flag | FN-M10-8.2.3 |
| EL-M10-S28-049 | card | visible-default | "Tahap 1" | FN-M10-8.2.3 |
| EL-M10-S28-050 | alert | visible-default | "Tahap 1" | FN-M10-8.2.3 |
| EL-M10-S28-051 | text | visible-default | "chapter_textbook_rebuild" | FN-M10-8.2.3 |
| EL-M10-S28-052 | text | visible-default | "Objektif" | FN-M10-8.2.3 |
| EL-M10-S28-053 | alert | visible-default | "Bahasa Melayu T1 - Sokongan Bab Buku Teks", fa-sitemap | FN-M10-8.2.3 |
| EL-M10-S28-054 | badge | visible-default | "ID Soalan: 525432", fa-hashtag | FN-M10-8.2.3 |
| EL-M10-S28-055 | text | visible-default | "Apakah tindakan pembaca kritis apabila menemui maklumat tentang musyawarah?" | FN-M10-8.2.3 |
| EL-M10-S28-056 | text | visible-default | "A." | FN-M10-8.2.3 |
| EL-M10-S28-057 | text | visible-default | "mengabaikan bukti" | FN-M10-8.2.3 |
| EL-M10-S28-058 | text | visible-default | "B." | FN-M10-8.2.3 |
| EL-M10-S28-059 | text | visible-default | "menyalin pilihan tanpa membaca" | FN-M10-8.2.3 |
| EL-M10-S28-060 | text | visible-default | "C." | FN-M10-8.2.3 |
| EL-M10-S28-061 | text | visible-default | "menilai maklumat dan menyokong jawapan dengan bukti" | FN-M10-8.2.3 |
| EL-M10-S28-062 | text | visible-default | "D." | FN-M10-8.2.3 |
| EL-M10-S28-063 | text | visible-default | "terus meneka" | FN-M10-8.2.3 |
| EL-M10-S28-064 | dropdown-trigger | visible-default | "Penerangan", fa-chevron-right | FN-M10-8.2.3 |
| EL-M10-S28-065 | text | hidden-only | "Jawapan tepat: menilai maklumat dan menyokong jawapan dengan bukti. Soalan ini menguji kem" | FN-M10-8.2.3 |
| EL-M10-S28-066 | text | visible-default | "Tingkatan 1" | FN-M10-8.2.3 |
| EL-M10-S28-067 | button | visible-default | "Lapor Masalah", fa-flag | FN-M10-8.2.3 |
| EL-M10-S28-068 | card | visible-default | "Tahap 1" | FN-M10-8.2.3 |
| EL-M10-S28-069 | alert | visible-default | "Tahap 1" | FN-M10-8.2.3 |
| EL-M10-S28-070 | text | visible-default | "chapter_textbook_rebuild" | FN-M10-8.2.3 |
| EL-M10-S28-071 | text | visible-default | "Objektif" | FN-M10-8.2.3 |
| EL-M10-S28-072 | alert | visible-default | "Bahasa Melayu T1 - Sokongan Bab Buku Teks", fa-sitemap | FN-M10-8.2.3 |
| EL-M10-S28-073 | badge | visible-default | "ID Soalan: 525431", fa-hashtag | FN-M10-8.2.3 |
| EL-M10-S28-074 | text | visible-default | "Apakah tindakan pembaca kritis apabila menemui maklumat tentang tanggungjawab rakyat?" | FN-M10-8.2.3 |
| EL-M10-S28-075 | text | visible-default | "A." | FN-M10-8.2.3 |
| EL-M10-S28-076 | text | visible-default | "terus meneka" | FN-M10-8.2.3 |
| EL-M10-S28-077 | text | visible-default | "B." | FN-M10-8.2.3 |
| EL-M10-S28-078 | text | visible-default | "mengabaikan bukti" | FN-M10-8.2.3 |
| EL-M10-S28-079 | text | visible-default | "C." | FN-M10-8.2.3 |
| EL-M10-S28-080 | text | visible-default | "menyalin pilihan tanpa membaca" | FN-M10-8.2.3 |
| EL-M10-S28-081 | text | visible-default | "D." | FN-M10-8.2.3 |
| EL-M10-S28-082 | text | visible-default | "menilai maklumat dan menyokong jawapan dengan bukti" | FN-M10-8.2.3 |
| EL-M10-S28-083 | dropdown-trigger | visible-default | "Penerangan", fa-chevron-right | FN-M10-8.2.3 |
| EL-M10-S28-084 | text | hidden-only | "Jawapan tepat: menilai maklumat dan menyokong jawapan dengan bukti. Soalan ini menguji kem" | FN-M10-8.2.3 |
| EL-M10-S28-085 | text | visible-default | "Tingkatan 1" | FN-M10-8.2.3 |
| EL-M10-S28-086 | button | visible-default | "Lapor Masalah", fa-flag | FN-M10-8.2.3 |
| EL-M10-S28-087 | text | conditional | "« Previous" | FN-M10-8.2.4 |
| EL-M10-S28-088 | pagination | conditional | "Next »", → /guru/databank/BM?page=2 | FN-M10-8.2.4 |
| EL-M10-S28-089 | text | visible-default | "Showing to of results" | FN-M10-8.2.4 |
| EL-M10-S28-090 | text | visible-default | "1" | FN-M10-8.2.4 |
| EL-M10-S28-091 | text | visible-default | "15" | FN-M10-8.2.4 |
| EL-M10-S28-092 | text | visible-default | "6048" | FN-M10-8.2.4 |
| EL-M10-S28-093 | text | visible-default | "1" | FN-M10-8.2.4 |
| EL-M10-S28-094 | pagination | visible-default | "2", → /guru/databank/BM?page=2 | FN-M10-8.2.4 |
| EL-M10-S28-095 | pagination | visible-default | "3", → /guru/databank/BM?page=3 | FN-M10-8.2.4 |
| EL-M10-S28-096 | pagination | visible-default | "4", → /guru/databank/BM?page=4 | FN-M10-8.2.4 |
| EL-M10-S28-097 | pagination | visible-default | "5", → /guru/databank/BM?page=5 | FN-M10-8.2.4 |
| EL-M10-S28-098 | pagination | visible-default | "6", → /guru/databank/BM?page=6 | FN-M10-8.2.4 |
| EL-M10-S28-099 | pagination | visible-default | "7", → /guru/databank/BM?page=7 | FN-M10-8.2.4 |
| EL-M10-S28-100 | pagination | visible-default | "8", → /guru/databank/BM?page=8 | FN-M10-8.2.4 |
| EL-M10-S28-101 | pagination | visible-default | "9", → /guru/databank/BM?page=9 | FN-M10-8.2.4 |
| EL-M10-S28-102 | pagination | visible-default | "10", → /guru/databank/BM?page=10 | FN-M10-8.2.4 |
| EL-M10-S28-103 | text | visible-default | "..." | FN-M10-8.2.4 |
| EL-M10-S28-104 | pagination | visible-default | "403", → /guru/databank/BM?page=403 | FN-M10-8.2.4 |
| EL-M10-S28-105 | pagination | visible-default | "404", → /guru/databank/BM?page=404 | FN-M10-8.2.4 |
| EL-M10-S28-106 | pagination | visible-default | → /guru/databank/BM?page=2, svg | FN-M10-8.2.4 |
| EL-M10-S28-107 | modal | conditional | "Lapor Masalah Soalan" | FN-M10-8.2.5 |
| EL-M10-S28-108 | clickable | conditional | (no text) | FN-M10-8.2.5 |
| EL-M10-S28-109 | clickable | hidden-only | "Lapor Masalah Soalan Soalan # Jawapan tidak tepat Soalan mengelirukan Set jawapan tidak te", fa-flag | FN-M10-8.2.5 |
| EL-M10-S28-110 | heading | conditional | "Lapor Masalah Soalan" | FN-M10-8.2.5 |
| EL-M10-S28-111 | label | conditional | "Jawapan tidak tepat" | FN-M10-8.2.5 |
| EL-M10-S28-112 | checkbox | conditional | label "Jawapan tidak tepat", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-113 | label | conditional | "Soalan mengelirukan" | FN-M10-8.2.5 |
| EL-M10-S28-114 | checkbox | conditional | label "Soalan mengelirukan", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-115 | label | conditional | "Set jawapan tidak tepat" | FN-M10-8.2.5 |
| EL-M10-S28-116 | checkbox | conditional | label "Set jawapan tidak tepat", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-117 | label | conditional | "Pilihan jawapan tidak lengkap" | FN-M10-8.2.5 |
| EL-M10-S28-118 | checkbox | conditional | label "Pilihan jawapan tidak lengkap", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-119 | label | conditional | "Soalan berulang / pendua" | FN-M10-8.2.5 |
| EL-M10-S28-120 | checkbox | conditional | label "Soalan berulang / pendua", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-121 | label | conditional | "Soalan sudah tidak relevan" | FN-M10-8.2.5 |
| EL-M10-S28-122 | checkbox | conditional | label "Soalan sudah tidak relevan", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-123 | label | conditional | "Kesalahan ejaan / taip" | FN-M10-8.2.5 |
| EL-M10-S28-124 | checkbox | conditional | label "Kesalahan ejaan / taip", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-125 | label | conditional | "Lain-lain" | FN-M10-8.2.5 |
| EL-M10-S28-126 | checkbox | conditional | label "Lain-lain", type checkbox | FN-M10-8.2.5 |
| EL-M10-S28-127 | label | conditional | "Komen (pilihan)" | FN-M10-8.2.5 |
| EL-M10-S28-128 | textarea | conditional | label "Komen (pilihan)", ph "Jelaskan masalah secara ringkas..." | FN-M10-8.2.5 |
| EL-M10-S28-129 | button | conditional | "Hantar Laporan Menghantar...", fa-paper-plane | FN-M10-8.2.5 |
| EL-M10-S28-130 | button | conditional | "Batal" | FN-M10-8.2.5 |
| EL-M10-S28-131 | modal | hidden-only | (no text) | FN-M10-8.2.5 |
| EL-M10-S28-132 | link | conditional | "Reset", → /guru/databank/BM, fa-times | FN-M10-8.2.2 |
| EL-M10-S28-133 | card | conditional | "Tahap 3" | FN-M10-8.2.3 |
| EL-M10-S28-134 | alert | conditional | "Tahap 3" | FN-M10-8.2.3 |
| EL-M10-S28-135 | text | conditional | "textbook_content_rebuild" | FN-M10-8.2.3 |
| EL-M10-S28-136 | alert | conditional | "Bahasa Melayu T3 - Sokongan Tema Buku Teks", fa-sitemap | FN-M10-8.2.3 |
| EL-M10-S28-137 | text | conditional | "Soalan kefahaman: pernyataan manakah paling tepat tentang hubungan tajuk dengan kehidupan " | FN-M10-8.2.3 |
| EL-M10-S28-138 | text | conditional | "Kesimpulan yang bercanggah dengan maksud tema." | FN-M10-8.2.3 |
| EL-M10-S28-139 | text | conditional | "Huraian yang terlalu sempit dan tidak menjawab kehendak soalan." | FN-M10-8.2.3 |
| EL-M10-S28-140 | text | conditional | "hubungan tajuk dengan kehidupan harian ialah fokus pembelajaran yang perlu difahami melalu" | FN-M10-8.2.3 |
| EL-M10-S28-141 | text | conditional | "Pilihan yang hanya menyebut tajuk tanpa menerangkan maksudnya." | FN-M10-8.2.3 |
| EL-M10-S28-142 | text | hidden-only | "Jawapan ini tepat kerana hubungan tajuk dengan kehidupan harian ialah fokus isi pelajaran " | FN-M10-8.2.3 |
| EL-M10-S28-143 | text | conditional | "Tingkatan 3" | FN-M10-8.2.3 |
| EL-M10-S28-144 | card | conditional | "Tahap 3" | FN-M10-8.2.3 |
| EL-M10-S28-145 | alert | conditional | "Tahap 3" | FN-M10-8.2.3 |
| EL-M10-S28-146 | text | conditional | "textbook_content_rebuild" | FN-M10-8.2.3 |
| EL-M10-S28-147 | alert | conditional | "Bahasa Melayu T3 - Sokongan Tema Buku Teks", fa-sitemap | FN-M10-8.2.3 |
| EL-M10-S28-148 | text | conditional | "Soalan kefahaman: pernyataan manakah paling tepat tentang rumusan ringkas Tema Destinasi M" | FN-M10-8.2.3 |
| EL-M10-S28-149 | text | conditional | "Ayat yang tidak menunjukkan penggunaan bahasa yang tepat." | FN-M10-8.2.3 |
| EL-M10-S28-150 | text | conditional | "Pernyataan yang tidak berkaitan dengan fokus pembelajaran tema." | FN-M10-8.2.3 |
| EL-M10-S28-151 | text | conditional | "Maklumat umum yang tidak menepati konteks bahan bacaan." | FN-M10-8.2.3 |
| EL-M10-S28-152 | text | conditional | "rumusan ringkas Tema Destinasi Misteri ialah fokus pembelajaran yang perlu difahami melalu" | FN-M10-8.2.3 |
| EL-M10-S28-153 | text | hidden-only | "Jawapan ini tepat kerana rumusan ringkas Tema Destinasi Misteri ialah fokus isi pelajaran " | FN-M10-8.2.3 |
| EL-M10-S28-154 | text | conditional | "Tingkatan 3" | FN-M10-8.2.3 |
| EL-M10-S28-155 | card | conditional | "Tahap 3" | FN-M10-8.2.3 |
| EL-M10-S28-156 | alert | conditional | "Tahap 3" | FN-M10-8.2.3 |
| EL-M10-S28-157 | text | conditional | "textbook_content_rebuild" | FN-M10-8.2.3 |
| EL-M10-S28-158 | alert | conditional | "Bahasa Melayu T3 - Sokongan Tema Buku Teks", fa-sitemap | FN-M10-8.2.3 |
| EL-M10-S28-159 | text | conditional | "Soalan kefahaman: pernyataan manakah paling tepat tentang ayat gramatis dalam Tema Destina" | FN-M10-8.2.3 |
| EL-M10-S28-160 | text | conditional | "ayat gramatis dalam Tema Destinasi Misteri ialah fokus pembelajaran yang perlu difahami me" | FN-M10-8.2.3 |
| EL-M10-S28-161 | text | conditional | "Kesimpulan yang bercanggah dengan maksud tema." | FN-M10-8.2.3 |
| EL-M10-S28-162 | text | conditional | "Huraian yang terlalu sempit dan tidak menjawab kehendak soalan." | FN-M10-8.2.3 |
| EL-M10-S28-163 | text | conditional | "Pilihan yang hanya menyebut tajuk tanpa menerangkan maksudnya." | FN-M10-8.2.3 |
| EL-M10-S28-164 | text | hidden-only | "Jawapan ini tepat kerana ayat gramatis dalam Tema Destinasi Misteri ialah fokus isi pelaja" | FN-M10-8.2.3 |
| EL-M10-S28-165 | text | conditional | "Tingkatan 3" | FN-M10-8.2.3 |
| EL-M10-S28-166 | clickable | conditional | "Lapor Masalah Soalan Soalan #525433 Jawapan tidak tepat Soalan mengelirukan Set jawapan ti", fa-flag | FN-M10-8.2.5 |

#### S29 — `/guru/artikel` (68 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S29-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S29-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S29-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S29-004 | heading | visible-default | "Sumbang Artikel" | FN-M10-9.1.1 |
| EL-M10-S29-005 | text | visible-default | "Kongsi ilmu dan pengalaman anda dengan komuniti PRESTASIPLUS" | FN-M10-9.1.1 |
| EL-M10-S29-006 | link | visible-default | "Tulis Artikel Baru", → /guru/artikel/cipta, fa-feather-alt | FN-M10-9.1.1 |
| EL-M10-S29-007 | card | visible-default | "36" | FN-M10-9.1.2 |
| EL-M10-S29-008 | text | visible-default | "36" | FN-M10-9.1.2 |
| EL-M10-S29-009 | text | visible-default | "Jumlah Artikel" | FN-M10-9.1.2 |
| EL-M10-S29-010 | card | visible-default | "36" | FN-M10-9.1.2 |
| EL-M10-S29-011 | text | visible-default | "36" | FN-M10-9.1.2 |
| EL-M10-S29-012 | text | visible-default | "Diterbitkan" | FN-M10-9.1.2 |
| EL-M10-S29-013 | card | visible-default | "0" | FN-M10-9.1.2 |
| EL-M10-S29-014 | text | visible-default | "0" | FN-M10-9.1.2 |
| EL-M10-S29-015 | text | visible-default | "Menunggu Semakan" | FN-M10-9.1.2 |
| EL-M10-S29-016 | card | visible-default | "12,270" | FN-M10-9.1.2 |
| EL-M10-S29-017 | text | visible-default | "12,270" | FN-M10-9.1.2 |
| EL-M10-S29-018 | text | visible-default | "Jumlah Pembaca" | FN-M10-9.1.2 |
| EL-M10-S29-019 | card | visible-default | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M10-9.1.3 |
| EL-M10-S29-020 | heading | visible-default | "Teknik Pomodoro: Belajar 25 Minit, Rehat 5 Minit" | FN-M10-9.1.3 |
| EL-M10-S29-021 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M10-9.1.3 |
| EL-M10-S29-022 | badge | visible-default | "Tips Belajar" | FN-M10-9.1.3 |
| EL-M10-S29-023 | text | visible-default | "22 Feb 2026", fa-calendar | FN-M10-9.1.3 |
| EL-M10-S29-024 | text | visible-default | "596 pembaca", fa-eye | FN-M10-9.1.3 |
| EL-M10-S29-025 | text | visible-default | "Teknik Pomodoro bantu pelajar fokus dengan pecahkan masa belajar kepada slot 25 minit." | FN-M10-9.1.3 |
| EL-M10-S29-026 | link | visible-default | → /artikel/teknik-pomodoro-belajar-25-minit-rehat-5-minit, fa-external-link-alt | FN-M10-9.1.3 |
| EL-M10-S29-027 | link | visible-default | → /guru/artikel/10/edit, fa-edit | FN-M10-9.1.3 |
| EL-M10-S29-028 | heading | visible-default | "Belajar Bahasa Melayu: Teknik KWLH untuk Pemahaman" | FN-M10-9.1.3 |
| EL-M10-S29-029 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M10-9.1.3 |
| EL-M10-S29-030 | badge | visible-default | "Tips Belajar" | FN-M10-9.1.3 |
| EL-M10-S29-031 | text | visible-default | "22 Feb 2026", fa-calendar | FN-M10-9.1.3 |
| EL-M10-S29-032 | text | visible-default | "448 pembaca", fa-eye | FN-M10-9.1.3 |
| EL-M10-S29-033 | text | visible-default | "Teknik KWLH bantu pelajar faham karangan dan petikan dengan lebih mendalam." | FN-M10-9.1.3 |
| EL-M10-S29-034 | link | visible-default | → /artikel/belajar-bahasa-melayu-teknik-kwlh-untuk-pemahaman, fa-external-link-alt | FN-M10-9.1.3 |
| EL-M10-S29-035 | link | visible-default | → /guru/artikel/13/edit, fa-edit | FN-M10-9.1.3 |
| EL-M10-S29-036 | heading | visible-default | "Cara Buat Jadual Belajar yang Realistik" | FN-M10-9.1.3 |
| EL-M10-S29-037 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M10-9.1.3 |
| EL-M10-S29-038 | badge | visible-default | "Tips Belajar" | FN-M10-9.1.3 |
| EL-M10-S29-039 | text | visible-default | "22 Feb 2026", fa-calendar | FN-M10-9.1.3 |
| EL-M10-S29-040 | text | visible-default | "430 pembaca", fa-eye | FN-M10-9.1.3 |
| EL-M10-S29-041 | text | visible-default | "Jadual belajar yang terlalu ketat akan gagal. Ini cara buat yang betul." | FN-M10-9.1.3 |
| EL-M10-S29-042 | link | visible-default | → /artikel/cara-buat-jadual-belajar-yang-realistik, fa-external-link-alt | FN-M10-9.1.3 |
| EL-M10-S29-043 | link | visible-default | → /guru/artikel/21/edit, fa-edit | FN-M10-9.1.3 |
| EL-M10-S29-044 | text | conditional | "« Previous" | FN-M10-9.1.4 |
| EL-M10-S29-045 | pagination | conditional | "Next »", → /guru/artikel?page=2 | FN-M10-9.1.4 |
| EL-M10-S29-046 | text | visible-default | "Showing to of results" | FN-M10-9.1.4 |
| EL-M10-S29-047 | text | visible-default | "1" | FN-M10-9.1.4 |
| EL-M10-S29-048 | text | visible-default | "15" | FN-M10-9.1.4 |
| EL-M10-S29-049 | text | visible-default | "36" | FN-M10-9.1.4 |
| EL-M10-S29-050 | text | visible-default | "1" | FN-M10-9.1.4 |
| EL-M10-S29-051 | pagination | visible-default | "2", → /guru/artikel?page=2 | FN-M10-9.1.4 |
| EL-M10-S29-052 | pagination | visible-default | "3", → /guru/artikel?page=3 | FN-M10-9.1.4 |
| EL-M10-S29-053 | pagination | visible-default | → /guru/artikel?page=2, svg | FN-M10-9.1.4 |
| EL-M10-S29-054 | card | conditional | "Cara Hadapi Tekanan Peperiksaan" | FN-M10-9.1.3 |
| EL-M10-S29-055 | heading | conditional | "Cara Hadapi Tekanan Peperiksaan" | FN-M10-9.1.3 |
| EL-M10-S29-056 | badge | conditional | "Motivasi" | FN-M10-9.1.3 |
| EL-M10-S29-057 | text | conditional | "Rasa cemas sebelum peperiksaan? Ini cara nak tenangkan diri." | FN-M10-9.1.3 |
| EL-M10-S29-058 | link | conditional | → /artikel/cara-hadapi-tekanan-peperiksaan, fa-external-link-alt | FN-M10-9.1.3 |
| EL-M10-S29-059 | heading | conditional | "Memilih Tuisyen yang Tepat untuk Anak" | FN-M10-9.1.3 |
| EL-M10-S29-060 | badge | conditional | "Panduan Ibu Bapa" | FN-M10-9.1.3 |
| EL-M10-S29-061 | text | conditional | "Panduan untuk ibu bapa yang sedang mempertimbangkan tuisyen." | FN-M10-9.1.3 |
| EL-M10-S29-062 | link | conditional | → /artikel/memilih-tuisyen-yang-tepat-untuk-anak, fa-external-link-alt | FN-M10-9.1.3 |
| EL-M10-S29-063 | heading | conditional | "Teknik Pengajaran Aktif untuk Kelas Matematik" | FN-M10-9.1.3 |
| EL-M10-S29-064 | badge | conditional | "Panduan Guru" | FN-M10-9.1.3 |
| EL-M10-S29-065 | text | conditional | "Cara buat pelajar aktif dan terlibat dalam kelas Matematik." | FN-M10-9.1.3 |
| EL-M10-S29-066 | link | conditional | → /artikel/teknik-pengajaran-aktif-untuk-kelas-matematik, fa-external-link-alt | FN-M10-9.1.3 |
| EL-M10-S29-067 | pagination | hidden-only | "« Previous", → /guru/artikel?page=1 | FN-M10-9.1.4 |
| EL-M10-S29-068 | pagination | conditional | → /guru/artikel?page=3, svg | FN-M10-9.1.4 |

#### S30 — `/guru/artikel/cipta` (57 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S30-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S30-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S30-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S30-004 | link | visible-default | → /guru/artikel, fa-arrow-left | FN-M10-9.2.1 |
| EL-M10-S30-005 | heading | visible-default | "Tulis Artikel Baru" | FN-M10-9.2.1 |
| EL-M10-S30-006 | text | visible-default | "Kongsi ilmu dan pengalaman anda dengan komuniti PRESTASIPLUS" | FN-M10-9.2.1 |
| EL-M10-S30-007 | form | visible-default | (no text) | FN-M10-9.2.1 |
| EL-M10-S30-008 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-9.2.1 |
| EL-M10-S30-009 | card | visible-default | "Tajuk Artikel *" | FN-M10-9.2.2 |
| EL-M10-S30-010 | label | visible-default | "Tajuk Artikel *" | FN-M10-9.2.2 |
| EL-M10-S30-011 | input | visible-default | label "Tajuk Artikel *", `title`, ph "Contoh: 5 Tips Belajar Matematik yang Menyeronokkan" | FN-M10-9.2.2 |
| EL-M10-S30-012 | card | visible-default | "Kandungan Artikel *" | FN-M10-9.2.3 |
| EL-M10-S30-013 | label | visible-default | "Kandungan Artikel *" | FN-M10-9.2.3 |
| EL-M10-S30-014 | hidden-field | hidden-only | label "Kandungan Artikel *", `content`, type hidden | FN-M10-9.2.3 |
| EL-M10-S30-015 | card | visible-default | "Video YouTube (opsional)" | FN-M10-9.2.4 |
| EL-M10-S30-016 | label | visible-default | "Video YouTube (opsional)" | FN-M10-9.2.4 |
| EL-M10-S30-017 | text | visible-default | "🎬" | FN-M10-9.2.4 |
| EL-M10-S30-018 | text | visible-default | "Sila gunakan pautan YouTube sahaja untuk berkongsi video pembelajaran." | FN-M10-9.2.4 |
| EL-M10-S30-019 | text | visible-default | "PRESTASIPLUS tidak membenarkan muat naik video." | FN-M10-9.2.4 |
| EL-M10-S30-020 | input | visible-default | label "Video YouTube (opsional)", `youtube_url`, ph "https://www.youtube.com/watch?v=xxxxxxx", type url | FN-M10-9.2.4 |
| EL-M10-S30-021 | text | visible-default | "Contoh: https://www.youtube.com/watch?v=abc123 atau https://youtu.be/abc123", fa-info-circle | FN-M10-9.2.4 |
| EL-M10-S30-022 | card | visible-default | "Lampiran Fail" | FN-M10-9.2.5 |
| EL-M10-S30-023 | label | visible-default | "Lampiran Fail" | FN-M10-9.2.5 |
| EL-M10-S30-024 | text | visible-default | "PDF, Word, Excel, PowerPoint" | FN-M10-9.2.5 |
| EL-M10-S30-025 | text | visible-default | "PDF", fa-file-pdf | FN-M10-9.2.5 |
| EL-M10-S30-026 | text | visible-default | "Word", fa-file-word | FN-M10-9.2.5 |
| EL-M10-S30-027 | text | visible-default | "Excel", fa-file-excel | FN-M10-9.2.5 |
| EL-M10-S30-028 | text | visible-default | "PPT", fa-file-powerpoint | FN-M10-9.2.5 |
| EL-M10-S30-029 | text | visible-default | "— sila gunakan ruangan YouTube di atas untuk video." | FN-M10-9.2.5 |
| EL-M10-S30-030 | text | visible-default | "Video tidak dibenarkan" | FN-M10-9.2.5 |
| EL-M10-S30-031 | clickable | visible-default | "📎 Seret & Lepas fail di sini atau klik untuk pilih fail Maks: 20MB setiap fail • Maks 5 f" | FN-M10-9.2.5 |
| EL-M10-S30-032 | input | hidden-only | label "Lampiran Fail", type file | FN-M10-9.2.5 |
| EL-M10-S30-033 | input | hidden-only | ph "Label (opsional)" | FN-M10-9.2.5 |
| EL-M10-S30-034 | button | hidden-only | fa-times | FN-M10-9.2.5 |
| EL-M10-S30-035 | card | visible-default | "Tetapan" | FN-M10-9.2.6 |
| EL-M10-S30-036 | heading | visible-default | "Tetapan" | FN-M10-9.2.6 |
| EL-M10-S30-037 | label | visible-default | "Kategori *" | FN-M10-9.2.6 |
| EL-M10-S30-038 | select | visible-default | label "Kategori *", `category`, 8 options | FN-M10-9.2.6 |
| EL-M10-S30-039 | label | visible-default | "Tahap *" | FN-M10-9.2.6 |
| EL-M10-S30-040 | select | visible-default | label "Tahap *", `grade_level`, 8 options | FN-M10-9.2.6 |
| EL-M10-S30-041 | label | visible-default | "Ringkasan" | FN-M10-9.2.6 |
| EL-M10-S30-042 | textarea | visible-default | label "Ringkasan", `excerpt`, ph "Ringkasan singkat..." | FN-M10-9.2.6 |
| EL-M10-S30-043 | card | visible-default | "Gambar Utama" | FN-M10-9.2.7 |
| EL-M10-S30-044 | heading | visible-default | "Gambar Utama" | FN-M10-9.2.7 |
| EL-M10-S30-045 | clickable | visible-default | "🖼️ Klik untuk pilih gambar JPEG, PNG, WebP • Maks 2MB" | FN-M10-9.2.7 |
| EL-M10-S30-046 | image | hidden-only | (no text) | FN-M10-9.2.7 |
| EL-M10-S30-047 | button | hidden-only | fa-times | FN-M10-9.2.7 |
| EL-M10-S30-048 | input | hidden-only | `featured_image`, type file | FN-M10-9.2.7 |
| EL-M10-S30-049 | text | visible-default | "💡" | FN-M10-9.2.8 |
| EL-M10-S30-050 | text | visible-default | "Tips Menulis Artikel" | FN-M10-9.2.8 |
| EL-M10-S30-051 | text | visible-default | "• Gunakan tajuk yang menarik perhatian" | FN-M10-9.2.8 |
| EL-M10-S30-052 | text | visible-default | "• Sertakan gambar untuk menarik minat" | FN-M10-9.2.8 |
| EL-M10-S30-053 | text | visible-default | "• Lampirkan bahan rujukan (PDF/dokumen)" | FN-M10-9.2.8 |
| EL-M10-S30-054 | text | visible-default | "• Tambah pautan video YouTube!" | FN-M10-9.2.8 |
| EL-M10-S30-055 | button | visible-default | "Hantar Artikel", fa-paper-plane | FN-M10-9.2.8 |
| EL-M10-S30-056 | text | visible-default | "Akan disemak admin sebelum diterbitkan", fa-shield-alt | FN-M10-9.2.8 |
| EL-M10-S30-057 | input | hidden-only | `attachments[]`, type file | FN-M10-9.2.5 |

#### S31 — `/guru/artikel/{id}/edit` (65 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S31-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S31-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S31-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S31-004 | link | visible-default | → /guru/artikel, fa-arrow-left | FN-M10-9.3.1 |
| EL-M10-S31-005 | heading | visible-default | "Edit Artikel" | FN-M10-9.3.1 |
| EL-M10-S31-006 | text | visible-default | "Kemaskini artikel anda" | FN-M10-9.3.1 |
| EL-M10-S31-007 | badge | visible-default | "Diterbitkan", fa-check-circle | FN-M10-9.3.1 |
| EL-M10-S31-008 | form | visible-default | (no text) | FN-M10-9.3.1 |
| EL-M10-S31-009 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-9.3.1 |
| EL-M10-S31-010 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-9.3.1 |
| EL-M10-S31-011 | card | visible-default | "Tajuk Artikel *" | FN-M10-9.3.2 |
| EL-M10-S31-012 | label | visible-default | "Tajuk Artikel *" | FN-M10-9.3.2 |
| EL-M10-S31-013 | input | visible-default | label "Tajuk Artikel *", `title` | FN-M10-9.3.2 |
| EL-M10-S31-014 | card | visible-default | "Kandungan Artikel *" | FN-M10-9.3.3 |
| EL-M10-S31-015 | label | visible-default | "Kandungan Artikel *" | FN-M10-9.3.3 |
| EL-M10-S31-016 | heading | visible-default | "Apa Itu Teknik Pomodoro?" | FN-M10-9.3.3 |
| EL-M10-S31-017 | text | visible-default | "Teknik Pomodoro ialah kaedah pengurusan masa yang dicipta oleh Francesco Cirillo. Caranya " | FN-M10-9.3.3 |
| EL-M10-S31-018 | heading | visible-default | "Kenapa Ia Berkesan?" | FN-M10-9.3.3 |
| EL-M10-S31-019 | text | visible-default | "Otak kita sebenarnya tak boleh fokus terlalu lama. Dengan slot 25 minit, otak kita boleh b" | FN-M10-9.3.3 |
| EL-M10-S31-020 | heading | visible-default | "Cara Guna Teknik Pomodoro" | FN-M10-9.3.3 |
| EL-M10-S31-021 | text | visible-default | "Pilih satu tugasan atau subjek untuk belajar" | FN-M10-9.3.3 |
| EL-M10-S31-022 | text | visible-default | "Set timer 25 minit — FOKUS penuh!" | FN-M10-9.3.3 |
| EL-M10-S31-023 | text | visible-default | "Bila timer berbunyi, rehat 5 minit" | FN-M10-9.3.3 |
| EL-M10-S31-024 | text | visible-default | "Ulang 4 kali, kemudian rehat panjang 15-30 minit" | FN-M10-9.3.3 |
| EL-M10-S31-025 | text | visible-default | "Catat berapa "pomodoro" kamu siap hari ini" | FN-M10-9.3.3 |
| EL-M10-S31-026 | heading | visible-default | "Tips Tambahan" | FN-M10-9.3.3 |
| EL-M10-S31-027 | text | visible-default | "Semasa rehat, jangan guna telefon! Buat stretching, minum air, atau jalan-jalan sekejap. I" | FN-M10-9.3.3 |
| EL-M10-S31-028 | text | visible-default | "Belajar bukan tentang berapa lama, tapi berapa fokus kamu semasa belajar!" | FN-M10-9.3.3 |
| EL-M10-S31-029 | hidden-field | hidden-only | label "Kandungan Artikel *", `content`, type hidden | FN-M10-9.3.3 |
| EL-M10-S31-030 | card | visible-default | "Video YouTube (opsional)" | FN-M10-9.3.4 |
| EL-M10-S31-031 | label | visible-default | "Video YouTube (opsional)" | FN-M10-9.3.4 |
| EL-M10-S31-032 | text | visible-default | "🎬" | FN-M10-9.3.4 |
| EL-M10-S31-033 | text | visible-default | "Sila gunakan pautan YouTube sahaja untuk berkongsi video pembelajaran." | FN-M10-9.3.4 |
| EL-M10-S31-034 | text | visible-default | "PRESTASIPLUS tidak membenarkan muat naik video." | FN-M10-9.3.4 |
| EL-M10-S31-035 | input | visible-default | label "Video YouTube (opsional)", `youtube_url`, ph "https://www.youtube.com/watch?v=xxxxxxx", type url | FN-M10-9.3.4 |
| EL-M10-S31-036 | text | visible-default | "Contoh: https://www.youtube.com/watch?v=abc123 atau https://youtu.be/abc123", fa-info-circle | FN-M10-9.3.4 |
| EL-M10-S31-037 | card | visible-default | "Tambah Lampiran Baru" | FN-M10-9.3.5 |
| EL-M10-S31-038 | label | visible-default | "Tambah Lampiran Baru" | FN-M10-9.3.5 |
| EL-M10-S31-039 | text | visible-default | "PDF, Word, Excel, PPT" | FN-M10-9.3.5 |
| EL-M10-S31-040 | text | visible-default | "PDF", fa-file-pdf | FN-M10-9.3.5 |
| EL-M10-S31-041 | text | visible-default | "Word", fa-file-word | FN-M10-9.3.5 |
| EL-M10-S31-042 | text | visible-default | "Excel", fa-file-excel | FN-M10-9.3.5 |
| EL-M10-S31-043 | text | visible-default | "PPT", fa-file-powerpoint | FN-M10-9.3.5 |
| EL-M10-S31-044 | text | visible-default | "— sila gunakan ruangan YouTube di atas." | FN-M10-9.3.5 |
| EL-M10-S31-045 | text | visible-default | "Video tidak dibenarkan" | FN-M10-9.3.5 |
| EL-M10-S31-046 | clickable | visible-default | "📎 Seret & Lepas fail di sini atau klik untuk pilih" | FN-M10-9.3.5 |
| EL-M10-S31-047 | input | hidden-only | label "Tambah Lampiran Baru", type file | FN-M10-9.3.5 |
| EL-M10-S31-048 | button | hidden-only | fa-times | FN-M10-9.3.5 |
| EL-M10-S31-049 | card | visible-default | "Tetapan" | FN-M10-9.3.6 |
| EL-M10-S31-050 | heading | visible-default | "Tetapan" | FN-M10-9.3.6 |
| EL-M10-S31-051 | label | visible-default | "Kategori *" | FN-M10-9.3.6 |
| EL-M10-S31-052 | select | visible-default | label "Kategori *", `category`, 7 options | FN-M10-9.3.6 |
| EL-M10-S31-053 | label | visible-default | "Tahap *" | FN-M10-9.3.6 |
| EL-M10-S31-054 | select | visible-default | label "Tahap *", `grade_level`, 7 options | FN-M10-9.3.6 |
| EL-M10-S31-055 | label | visible-default | "Ringkasan" | FN-M10-9.3.6 |
| EL-M10-S31-056 | textarea | visible-default | label "Ringkasan", `excerpt` | FN-M10-9.3.6 |
| EL-M10-S31-057 | card | visible-default | "Gambar Utama" | FN-M10-9.3.7 |
| EL-M10-S31-058 | heading | visible-default | "Gambar Utama" | FN-M10-9.3.7 |
| EL-M10-S31-059 | clickable | visible-default | "🖼️ Klik untuk pilih gambar" | FN-M10-9.3.7 |
| EL-M10-S31-060 | image | hidden-only | (no text) | FN-M10-9.3.7 |
| EL-M10-S31-061 | button | hidden-only | fa-times | FN-M10-9.3.7 |
| EL-M10-S31-062 | input | hidden-only | `featured_image`, type file | FN-M10-9.3.7 |
| EL-M10-S31-063 | button | visible-default | "Kemaskini Artikel", fa-save | FN-M10-9.3.8 |
| EL-M10-S31-064 | link | visible-default | "Batal", → /guru/artikel | FN-M10-9.3.8 |
| EL-M10-S31-065 | input | hidden-only | `attachments[]`, type file | FN-M10-9.3.5 |

#### S32 — `/guru/profil/edit` (58 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S32-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S32-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S32-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S32-004 | form | visible-default | (no text) | FN-M10-10.1.1 |
| EL-M10-S32-005 | hidden-field | hidden-only | `_token`, type hidden | FN-M10-10.1.1 |
| EL-M10-S32-006 | hidden-field | hidden-only | `_method`, type hidden | FN-M10-10.1.1 |
| EL-M10-S32-007 | card | visible-default | "Maklumat Peribadi" | FN-M10-10.1.2 |
| EL-M10-S32-008 | heading | visible-default | "Maklumat Peribadi" | FN-M10-10.1.2 |
| EL-M10-S32-009 | label | visible-default | "Nama Penuh *" | FN-M10-10.1.2 |
| EL-M10-S32-010 | input | visible-default | label "Nama Penuh *", `name` | FN-M10-10.1.2 |
| EL-M10-S32-011 | label | visible-default | "E-mel / Username *" | FN-M10-10.1.2 |
| EL-M10-S32-012 | input | visible-default | label "E-mel / Username *", `email`, ph "cth: nama@gmail.com", type email | FN-M10-10.1.2 |
| EL-M10-S32-013 | text | visible-default | "Ini adalah e-mel login anda. Tukar ke e-mel peribadi supaya lebih mudah diingati." | FN-M10-10.1.2 |
| EL-M10-S32-014 | label | visible-default | "Bio" | FN-M10-10.1.2 |
| EL-M10-S32-015 | textarea | visible-default | label "Bio", `bio`, ph "Ceritakan tentang diri anda sebagai pendidik..." | FN-M10-10.1.2 |
| EL-M10-S32-016 | label | visible-default | "No Kad Pengenalan" | FN-M10-10.1.2 |
| EL-M10-S32-017 | input | visible-default | label "No Kad Pengenalan", `ic_number`, ph "cth: 000101010000" | FN-M10-10.1.2 |
| EL-M10-S32-018 | text | visible-default | "Digunakan untuk reset kata laluan secara layan diri. Tanpa tanda sempang (-)." | FN-M10-10.1.2 |
| EL-M10-S32-019 | card | visible-default | "Sekolah" | FN-M10-10.1.3 |
| EL-M10-S32-020 | heading | visible-default | "Sekolah" | FN-M10-10.1.3 |
| EL-M10-S32-021 | hidden-field | hidden-only | `school_id`, type hidden | FN-M10-10.1.3 |
| EL-M10-S32-022 | button | hidden-only | fa-times-circle | FN-M10-10.1.3 |
| EL-M10-S32-023 | input | hidden-only | ph "Taip nama sekolah untuk cari..." | FN-M10-10.1.3 |
| EL-M10-S32-024 | button | hidden-only | (no text) | FN-M10-10.1.3 |
| EL-M10-S32-025 | empty-state | hidden-only | "Tiada sekolah dijumpai", fa-search-minus | FN-M10-10.1.3 |
| EL-M10-S32-026 | input | visible-default | ph "Taip nama sekolah untuk cari..." | FN-M10-10.1.3 |
| EL-M10-S32-027 | button | hidden-only | (no text) | FN-M10-10.1.3 |
| EL-M10-S32-028 | empty-state | hidden-only | "Tiada sekolah dijumpai", fa-search-minus | FN-M10-10.1.3 |
| EL-M10-S32-029 | card | visible-default | "Maklumat Profesional" | FN-M10-10.1.4 |
| EL-M10-S32-030 | heading | visible-default | "Maklumat Profesional" | FN-M10-10.1.4 |
| EL-M10-S32-031 | label | visible-default | "Subjek Utama" | FN-M10-10.1.4 |
| EL-M10-S32-032 | input | visible-default | label "Subjek Utama", `subject`, ph "cth: Matematik, Sains" | FN-M10-10.1.4 |
| EL-M10-S32-033 | label | visible-default | "Kelayakan" | FN-M10-10.1.4 |
| EL-M10-S32-034 | input | visible-default | label "Kelayakan", `qualification`, ph "cth: Ijazah Sarjana Pendidikan" | FN-M10-10.1.4 |
| EL-M10-S32-035 | label | visible-default | "Pengalaman (tahun)" | FN-M10-10.1.4 |
| EL-M10-S32-036 | input | visible-default | label "Pengalaman (tahun)", `experience_years`, ph "0", type number | FN-M10-10.1.4 |
| EL-M10-S32-037 | heading | visible-default | "Profil Awam Anda" | FN-M10-10.1.5 |
| EL-M10-S32-038 | text | visible-default | "Kongsi profil anda dengan pelajar dan ibu bapa." | FN-M10-10.1.5 |
| EL-M10-S32-039 | text | visible-default | "https://prestasiplus.my/guru/3" | FN-M10-10.1.5 |
| EL-M10-S32-040 | button | visible-default | "Salin Link", fa-copy | FN-M10-10.1.5 |
| EL-M10-S32-041 | link | visible-default | "Lihat", → /guru/3, fa-external-link-alt | FN-M10-10.1.5 |
| EL-M10-S32-042 | link | visible-default | "Kembali", → /guru, fa-arrow-left | FN-M10-10.1.6 |
| EL-M10-S32-043 | button | visible-default | "Simpan Profil", fa-save | FN-M10-10.1.6 |
| EL-M10-S32-044 | button | conditional | "<school> PPD SEGAMAT, Johor" | FN-M10-10.1.3 |
| EL-M10-S32-045 | button | conditional | "<school> PPD BATU PAHAT, Johor" | FN-M10-10.1.3 |
| EL-M10-S32-046 | button | conditional | "<school> PPD BATU PAHAT, Johor" | FN-M10-10.1.3 |
| EL-M10-S32-047 | button | conditional | "<school> PPD MUAR, Johor" | FN-M10-10.1.3 |
| EL-M10-S32-048 | button | conditional | "<school> PPD KULIM/BANDAR BAHARU, Kedah" | FN-M10-10.1.3 |
| EL-M10-S32-049 | button | conditional | "<school> PPD TIMUR LAUT, Pulau Pinang" | FN-M10-10.1.3 |
| EL-M10-S32-050 | button | conditional | "<school> PPD LARUT/MATANG/SELAMA, Perak" | FN-M10-10.1.3 |
| EL-M10-S32-051 | button | conditional | "<school> PPD KRIAN, Perak" | FN-M10-10.1.3 |
| EL-M10-S32-052 | button | conditional | "<school> PPD SEBERANG PERAI UTARA, Pulau Pinang" | FN-M10-10.1.3 |
| EL-M10-S32-053 | button | conditional | "<school> PPD SEBERANG PERAI UTARA, Pulau Pinang" | FN-M10-10.1.3 |
| EL-M10-S32-054 | button | conditional | "<school> PPD KUALA MUDA/YAN, Kedah" | FN-M10-10.1.3 |
| EL-M10-S32-055 | button | conditional | "<school> PPD MUAR, Johor" | FN-M10-10.1.3 |
| EL-M10-S32-056 | button | conditional | "<school> PPD KUALA SELANGOR, Selangor" | FN-M10-10.1.3 |
| EL-M10-S32-057 | button | conditional | "<school> PPD TAMPIN, Negeri Sembilan" | FN-M10-10.1.3 |
| EL-M10-S32-058 | button | conditional | "<school> PPD ALOR GAJAH, Melaka" | FN-M10-10.1.3 |

#### S33 — `/kelas-saya` (13 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S33-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S33-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S33-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S33-004 | card | visible-default | "Masukkan Kod Kelas" | FN-M10-3.4.1 |
| EL-M10-S33-005 | form | visible-default | (no text) | FN-M10-3.4.1 |
| EL-M10-S33-006 | hidden-field | hidden-only | label "Masukkan Kod Kelas", `_token`, type hidden | FN-M10-3.4.1 |
| EL-M10-S33-007 | label | visible-default | "Masukkan Kod Kelas" | FN-M10-3.4.1 |
| EL-M10-S33-008 | input | visible-default | label "Masukkan Kod Kelas", `class_code`, ph "cth: MAT5B2" | FN-M10-3.4.1 |
| EL-M10-S33-009 | button | visible-default | "Sertai", fa-sign-in-alt | FN-M10-3.4.1 |
| EL-M10-S33-010 | card | visible-default | "Belum Sertai Mana-Mana Kelas" | FN-M10-3.4.2 |
| EL-M10-S33-011 | text | visible-default | "📚" | FN-M10-3.4.2 |
| EL-M10-S33-012 | heading | visible-default | "Belum Sertai Mana-Mana Kelas" | FN-M10-3.4.2 |
| EL-M10-S33-013 | text | visible-default | "Minta kod kelas daripada guru anda dan masukkan di atas" | FN-M10-3.4.2 |

#### S34 — `/set-soalan-saya` (6 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S34-001 | text | hidden-only | "LIVE:", fa-circle | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S34-002 | text | hidden-only | "MAIN" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S34-003 | text | hidden-only | "DAFTAR" | Excluded — M16 tournament banner (hidden `tournamentBanner()` widget of the user layout) |
| EL-M10-S34-004 | card | visible-default | "Tiada Set Soalan" | FN-M10-5.7.1 |
| EL-M10-S34-005 | heading | visible-default | "Tiada Set Soalan" | FN-M10-5.7.1 |
| EL-M10-S34-006 | text | visible-default | "Guru anda belum sediakan set soalan untuk anda." | FN-M10-5.7.1 |

#### S35 — `/settings, /guru/{id}, /guru/set-soalan/{id}` (10 elements)

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-S35-001 | text | visible-default | "404" | FN-M10-1.2.2 |
| EL-M10-S35-002 | text | visible-default | "🔍" | FN-M10-1.2.2 |
| EL-M10-S35-003 | heading | visible-default | "Halaman Tidak Dijumpai" | FN-M10-1.2.2 |
| EL-M10-S35-004 | text | visible-default | "Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?" | FN-M10-1.2.2 |
| EL-M10-S35-005 | link | visible-default | "Halaman Utama", → / | FN-M10-1.2.2 |
| EL-M10-S35-006 | link | visible-default | "Mula Latihan", → /latih-tubi | FN-M10-1.2.2 |
| EL-M10-S35-007 | text | visible-default | "PRESTASIPLUS" | FN-M10-1.2.2 |
| EL-M10-S35-008 | heading | conditional | "Oops! An Error Occurred" | FN-M10-1.2.3 |
| EL-M10-S35-009 | heading | conditional | "The server returned a "405 Method Not Allowed"." | FN-M10-1.2.3 |
| EL-M10-S35-010 | text | conditional | "Something is broken. Please let us know what you were doing when this error occurred. We w" | FN-M10-1.2.3 |

### 6.2 Shell elements (M10-relevant only)

#### SHU — user-portal shell (chrome of S1, S3–S34) — 415 elements, 77 M10-relevant

| Element | Kind | Status | Content / attributes | Covered by |
|---|---|---|---|---|
| EL-M10-SHU-077 | link | visible-default | "Kelas Saya", → /kelas-saya, fa-book-reader | FN-M10-1.1.1 |
| EL-M10-SHU-078 | link | visible-default | "Set Soalan Guru", → /set-soalan-saya, fa-clipboard-list | FN-M10-1.1.1 |
| EL-M10-SHU-100 | link | visible-default | "Dashboard Guru", → /guru, fa-chart-pie | FN-M10-1.1.1 |
| EL-M10-SHU-101 | link | visible-default | "Kelas Guru", → /guru/kelas, fa-chalkboard-teacher | FN-M10-1.1.1 |
| EL-M10-SHU-102 | link | visible-default | "Sumbang Soalan", → /guru/soalan, fa-pen-fancy | FN-M10-1.1.1 |
| EL-M10-SHU-103 | link | visible-default | "Databank Soalan", → /guru/databank, fa-database | FN-M10-1.1.1 |
| EL-M10-SHU-136 | heading | visible-default | "Dashboard Guru" | FN-M10-1.1.3 |
| EL-M10-SHU-137 | text | visible-default | "Selamat datang, <name> 👩‍🏫" | FN-M10-1.1.3 |
| EL-M10-SHU-218 | link | hidden-only | "Command Center LIVE", → /guru/command-center, fa-satellite-dish | FN-M10-1.1.2 |
| EL-M10-SHU-246 | modal | hidden-only | "HARIAN" | FN-M10-1.1.2 |
| EL-M10-SHU-247 | text | hidden-only | "HARIAN" | FN-M10-1.1.2 |
| EL-M10-SHU-248 | link | hidden-only | "Dashboard Guru", → /guru, fa-chart-pie | FN-M10-1.1.2 |
| EL-M10-SHU-249 | link | hidden-only | "Misi Harian", → /guru/misi-harian, fa-rocket | FN-M10-1.1.2 |
| EL-M10-SHU-251 | link | hidden-only | "Kelas Saya", → /guru/kelas, fa-chalkboard-teacher | FN-M10-1.1.2 |
| EL-M10-SHU-252 | link | hidden-only | "Pelajar Saya", → /guru/pelajar, fa-user-graduate | FN-M10-1.1.2 |
| EL-M10-SHU-253 | link | hidden-only | "Kehadiran Digital", → /guru/kehadiran-digital, fa-clipboard-check | FN-M10-1.1.2 |
| EL-M10-SHU-254 | modal | hidden-only | "PENGAJARAN" | FN-M10-1.1.2 |
| EL-M10-SHU-255 | text | hidden-only | "PENGAJARAN" | FN-M10-1.1.2 |
| EL-M10-SHU-256 | link | hidden-only | "Jadual Belajar", → /guru/jadual-belajar, fa-calendar-alt | FN-M10-1.1.2 |
| EL-M10-SHU-257 | link | hidden-only | "Broadcast", → /guru/broadcast, fa-bullhorn | FN-M10-1.1.2 |
| EL-M10-SHU-258 | link | hidden-only | "Kelas Live", → /guru/live-kelas, fa-broadcast-tower | FN-M10-1.1.2 |
| EL-M10-SHU-279 | modal | hidden-only | "BANK SOALAN" | FN-M10-1.1.2 |
| EL-M10-SHU-280 | text | hidden-only | "BANK SOALAN" | FN-M10-1.1.2 |
| EL-M10-SHU-281 | link | hidden-only | "Sumbang Soalan", → /guru/soalan, fa-pen-fancy | FN-M10-1.1.2 |
| EL-M10-SHU-282 | link | hidden-only | "Soalan & Rujukan", → /guru/soalan-guru, fa-book-open | FN-M10-1.1.2 |
| EL-M10-SHU-283 | link | hidden-only | "Soalan Berstruktur", → /guru/soalan-berstruktur, fa-list-ol | FN-M10-1.1.2 |
| EL-M10-SHU-284 | link | hidden-only | "Databank Soalan", → /guru/databank, fa-database | FN-M10-1.1.2 |
| EL-M10-SHU-285 | link | hidden-only | "Set Soalan", → /guru/set-soalan, fa-clipboard-list | FN-M10-1.1.2 |
| EL-M10-SHU-286 | modal | hidden-only | "LAIN-LAIN" | FN-M10-1.1.2 |
| EL-M10-SHU-287 | text | hidden-only | "LAIN-LAIN" | FN-M10-1.1.2 |
| EL-M10-SHU-289 | link | hidden-only | "Sumbang Artikel", → /guru/artikel, fa-newspaper | FN-M10-1.1.2 |
| EL-M10-SHU-291 | link | hidden-only | "Kelas Saya BARU", → /kelas-saya, fa-book-reader | FN-M10-1.1.2 |
| EL-M10-SHU-292 | badge | hidden-only | "BARU" | FN-M10-1.1.2 |
| EL-M10-SHU-293 | link | hidden-only | "Set Soalan Guru", → /set-soalan-saya, fa-clipboard-list | FN-M10-1.1.2 |
| EL-M10-SHU-373 | heading | conditional | "Dashboard" | FN-M10-1.1.3 |
| EL-M10-SHU-374 | text | conditional | "Selamat datang kembali" | FN-M10-1.1.3 |
| EL-M10-SHU-375 | heading | conditional | "Portal Guru" | FN-M10-1.1.3 |
| EL-M10-SHU-376 | text | conditional | "Urus kelas dan tugasan anda 🏫" | FN-M10-1.1.3 |
| EL-M10-SHU-377 | heading | conditional | "Cipta Kelas Baru" | FN-M10-1.1.3 |
| EL-M10-SHU-378 | text | conditional | "Isi butiran kelas anda" | FN-M10-1.1.3 |
| EL-M10-SHU-379 | heading | conditional | "Pelajar" | FN-M10-1.1.3 |
| EL-M10-SHU-380 | text | conditional | "Urus pelajar dalam kelas anda" | FN-M10-1.1.3 |
| EL-M10-SHU-381 | heading | conditional | "Kehadiran Digital" | FN-M10-1.1.3 |
| EL-M10-SHU-382 | text | conditional | "Pelajar jawab 5+ soalan = Hadir. Auto-track, zero effort." | FN-M10-1.1.3 |
| EL-M10-SHU-383 | heading | conditional | "Jadual Belajar Harian" | FN-M10-1.1.3 |
| EL-M10-SHU-384 | text | conditional | "Set fokus subjek harian — pelajar nampak bila login" | FN-M10-1.1.3 |
| EL-M10-SHU-385 | heading | conditional | "Broadcast Kelas" | FN-M10-1.1.3 |
| EL-M10-SHU-386 | text | conditional | "Hantar mesej ringkas kepada pelajar — mereka nampak bila login" | FN-M10-1.1.3 |
| EL-M10-SHU-387 | heading | conditional | "Bilik Darjah Langsung" | FN-M10-1.1.3 |
| EL-M10-SHU-388 | text | conditional | "Pantau semua aktiviti pelajar — Latih Tubi SPM, Tracking A, Misi Harian" | FN-M10-1.1.3 |
| EL-M10-SHU-389 | heading | conditional | "Misi Harian" | FN-M10-1.1.3 |
| EL-M10-SHU-390 | text | conditional | "Cipta dan pantau misi latih tubi SPM untuk pelajar" | FN-M10-1.1.3 |
| EL-M10-SHU-391 | heading | conditional | "Cipta Misi Harian" | FN-M10-1.1.3 |
| EL-M10-SHU-392 | text | conditional | "Assign misi latih tubi SPM atau Tracking A" | FN-M10-1.1.3 |
| EL-M10-SHU-393 | heading | conditional | "Set Soalan Guru" | FN-M10-1.1.3 |
| EL-M10-SHU-394 | text | conditional | "Cipta dan urus set soalan khas untuk kelas anda" | FN-M10-1.1.3 |
| EL-M10-SHU-395 | heading | conditional | "Cipta Set Soalan" | FN-M10-1.1.3 |
| EL-M10-SHU-396 | text | conditional | "Sediakan set soalan khas untuk kelas anda" | FN-M10-1.1.3 |
| EL-M10-SHU-397 | heading | conditional | "Soalan & Rujukan" | FN-M10-1.1.3 |
| EL-M10-SHU-398 | text | conditional | "Cipta soalan peribadi dengan bahan rujukan — khas untuk kelas anda sahaja" | FN-M10-1.1.3 |
| EL-M10-SHU-399 | text | conditional | "Cipta soalan MCQ, lampir link rujukan, assign sebagai misi" | FN-M10-1.1.3 |
| EL-M10-SHU-400 | heading | conditional | "Sumbang Soalan" | FN-M10-1.1.3 |
| EL-M10-SHU-401 | text | conditional | "Sumbangan anda kepada bank soalan kebangsaan PrestasiPlus" | FN-M10-1.1.3 |
| EL-M10-SHU-402 | heading | conditional | "Tambah Soalan Baru" | FN-M10-1.1.3 |
| EL-M10-SHU-403 | text | conditional | "Sumbangkan soalan untuk pelajar Malaysia" | FN-M10-1.1.3 |
| EL-M10-SHU-404 | heading | conditional | "Detail Soalan" | FN-M10-1.1.3 |
| EL-M10-SHU-405 | heading | conditional | "Edit Soalan" | FN-M10-1.1.3 |
| EL-M10-SHU-406 | heading | conditional | "Databank Soalan" | FN-M10-1.1.3 |
| EL-M10-SHU-407 | text | conditional | "21,033 soalan · 18 subjek" | FN-M10-1.1.3 |
| EL-M10-SHU-408 | heading | conditional | "Bahasa Melayu" | FN-M10-1.1.3 |
| EL-M10-SHU-409 | text | conditional | "6,048 soalan" | FN-M10-1.1.3 |
| EL-M10-SHU-410 | text | conditional | "<name>" | FN-M10-1.1.3 |
| EL-M10-SHU-411 | heading | conditional | "Profil Guru" | FN-M10-1.1.3 |
| EL-M10-SHU-412 | text | conditional | "Kemaskini maklumat profesional anda" | FN-M10-1.1.3 |
| EL-M10-SHU-413 | heading | conditional | "Kelas Saya" | FN-M10-1.1.3 |
| EL-M10-SHU-414 | text | conditional | "Sertai kelas guru anda 🏫" | FN-M10-1.1.3 |
| EL-M10-SHU-415 | text | conditional | "Set soalan yang disediakan oleh guru anda" | FN-M10-1.1.3 |

Excluded SHU elements (prefix EL-M10-SHU-): 338 elements — IDs 001–076, 079–099, 104–135, 138–217, 219–245, 250, 259–278, 288, 290, 294–372: **global shell ([00-global-ui.md](../../discovery/00-global-ui.md)) / M23 and the module each link targets (per `_crawl.json`)**. IDs 001–003 are the shell logo/brand. Specifically: 006 "Misi Harian" → `/misi-harian`, 007 "Remedial" → `/remedial/saya`, 064 and 205 "Soalan Berstruktur" → `/latihan-berstruktur`, 250 "Soalan by Chapter" → `/practice/chapter` (M05); 259–278 groups "PENILAIAN" and "ANALITIK" (M08, M11, M12, M18); 288 "Syiling & Ganjaran" (M14); 290 "Video" (M09); 315 "Tetapan" → `/settings` (M01 FN-M01-2.4.1, fixed by DV-M01-01 to `/tetapan`).

**Coverage result: 3150/3150 covered, 0 unmapped.**

---

## 7. Fidelity deviations

These are the **only** intended differences from the live site. Anything not listed must match live (D7). Rule D9 (user, standing, pre-approved): where live is broken or contradictory, fix it minimally; where it works, replicate it exactly. D10: accessibility replicates live; a deliberate, consistent limit is not broken; adding options to a working feature is new scope. CLAUDE.md §6: minimal fixes that create no new contradiction; unobserved behaviour is never written as fact. Rows "Rejected — replicate live" were candidates that turned out to work, could not be shown to be broken, or could only be "fixed" by inventing a page or scope. Precedents followed: M08 G1 decisions (no hiding of items whose outcome for other roles is unverified; no options added to own-class selects), M08 DV-01 / M06 DV-07 (titles only), M04 DV-15 (edit preload), M06 DV-03 (blank icons), M08 DV-24 (405 page), M05 DV-11 / M08 DV-18 (text < 12px).

| ID | Discovery | Category | Live behaviour (evidence) | Rebuild behaviour (specified) and alternatives | Status |
|---|---|---|---|---|---|
| DV-M10-01 | D-01 | Wrong titles | S3, S17–S20, S25, S26, S29–S31 show the shell fallback "Dashboard" / "Selamat datang kembali" (EL-M10-SHU-373/374). | **Titles only:** the header title is the page's own h1 ("Remedial Progress Dashboard", "Soalan Berstruktur", "Cipta Soalan Berstruktur", "Preview Soalan", "Edit Soalan Berstruktur", "Set Audio KBAT", "Cipta Set Audio KBAT", "Sumbang Artikel", "Tulis Artikel Baru", "Edit Artikel"); subtitle "Selamat datang kembali" kept (M08 DV-01 / M06 DV-07 pattern; XL-20 shell rule). S23/S24 titles are correct on live and unchanged. Alternative: new subtitles — rejected (new copy). | Approved (D9) |
| DV-M10-02 | D-02 | Broken control | S12 "Jenis Misi" calls `toggleSource()`, which is not defined: choosing "Soalan & Rujukan (YouTube/Anyflip/Rujukan)" throws a ReferenceError and `#youtubeSection` stays hidden (inventory states `youtube`, `misi-cipta-youtube.png`). The hidden `mission_source` has one observed value, `bank_soalan`; the section holds only text, the "Soalan Saya" link and an alert (no picker). | **Minimal fix (v1.1, AUD-M10-05):** choosing `youtube` shows `#youtubeSection`, any other type hides it. Nothing else changes: `mission_source` stays `bank_soalan` (no invented value); `mission_type = youtube` carries the choice. Which questions such a mission uses stays INFERRED (BR-M10-17, OQ-M10-10) and is asserted only in provisional tests. Alternatives: (a) replicate the dead option — rejected (a control that does nothing); (b) also set a new `mission_source` value — rejected (no evidence, v1.0 withdrawn); (c) remove the option — rejected (S15/S16 tell teachers to use it). | Approved (D9) |
| DV-M10-03 | D-03 | Broken (HTTP 500) | `GET /guru/command-center/remedial/scan` returns 500; the modal shows "Ralat: Unexpected token '<', "<!DOCTYPE "... is not valid JSON" (`command-center-remedial-error.png`). | The scan returns `{weak_students, existing_remedials}` computed from the M05 answer log (topic accuracy < 50%, SRS BR-M10-11) and the modal renders the script's states (SOURCE-DERIVED copy). Alternative: replicate the error — rejected (broken feature; S3 tells teachers to use it). | Approved (D9); populated states provisional |
| DV-M10-04 | D-04 | Wrong label | Every drill modal title is the raw type key because the API returns `title = type`: "students", "gps", "kirk", "mood" (inventory states `drill-*`). | The drill response title is the label of the clicked tile or panel (existing live copy): students "Pelajar Berdaftar", today "Soalan Dijawab" (tile) or "Aktiviti Hari Ini" (panel), subjects "Ketepatan Purata", gps "GPS Sekolah", kirk "Kirkpatrick T1"…"T4", mood "Mood Pelajar", engagement "Engagement Pelajar" (PROPOSED mapping of existing labels). Alternative: a new wording per drill — rejected (new copy). | Approved (D9) |
| DV-M10-05 | D-05 | Preload bug | S20 does not preselect Bab/Topik: the script sets `chapterId: '1281'` but the select shows "-- Pilih Bab --" although S19 names the chapter "Merancang Pengendalian Perniagaan"; saving would clear the chapter. | The saved chapter and topic are selected after the lists load (M04 DV-15 precedent); a saved id missing from the list is cleared. Alternative: replicate — rejected (silent data loss on save). | Approved (D9) |
| DV-M10-06 | D-06 | Candidate: dead link | S32 "Profil Awam Anda" shows and copies `https://prestasiplus.my/guru/3`; "Lihat" → 404 for the admin (`profil-awam-404` state). A teacher's own public profile was not observable; the route may work for a real teacher id. | **Replicated**: URL, "Salin Link" and "Lihat" as live; `/guru/{id}` renders the global 404 in the prototype until the page is discovered (OQ-M10-12). Alternatives: (a) hide the card — rejected (M08 G1 decision: no hiding of an item whose outcome for other roles is unverified); (b) build a public teacher page — rejected (invented page); (c) point to another page — rejected (no equivalent page). | Rejected — replicate live (blocked, OQ-M10-12) |
| DV-M10-07 | D-07 | Candidate: dead link | S6 "Cipta Pelajar" → `/guru/pelajar/cipta` → 302 back to `/guru/pelajar`, no message, for the admin (who has no school). A teacher with a school may get a create page (unobserved). | **Replicated** (navigates back to S6 with no message); the teacher outcome is UNVERIFIED (OQ-M10-13). Alternatives: (a) retarget to the "Pelajar Sekolah" tab — rejected (new behaviour for a route that may work); (b) remove the link — rejected (M08 G1 decision). | Rejected — replicate live (OQ-M10-13) |
| DV-M10-08 | D-08 | Dead link | S21 "Template" → `/guru/soalan/template` → 302 back to `/guru/soalan`, no file, while the Import Panduan says "Muat turun template → isi soalan → import kembali". | "Template" downloads the **M04 import template** (M04 FR-M04-57 / AC-M04-13.6: `question_text,option_a,option_b,option_c,option_d,correct_answer,subject_id,education_level_id,difficulty_level,marks,explanation`, INFERRED there) because both imports write the one M04 store (D12); the teacher import reads the same columns; the live Panduan copy is kept. No page is added. Alternatives: (a) replicate — rejected (the documented import flow cannot start); (b) a separate M10 header — rejected in v1.1 (second schema for one store, AUD-M10-11). | Approved (D9); header owned by M04 (INFERRED there) |
| DV-M10-09 | D-09 | Broken feature | "Galeri Rajah" fetches `/guru/soalan/galeri-rajah`, which redirects to HTML; the JSON parse fails and the modal always shows "Tiada galeri tersedia" / "Tiada galeri rajah tersedia" (`soalan-cipta-galeri.png`). | The endpoint returns `{folders: []}` (no gallery data exists anywhere observed), so the visible state is the live empty state with its live instruction to use "Muat Naik". The folder/image states stay in the component (SOURCE-DERIVED) for when data exists. Alternative: seed a gallery — rejected (invented content; source unknown, OQ-M10-14). | Approved (transport only; visible state as live) |
| DV-M10-10 | D-10 | Candidate: dead control | S21 card "AI Auto-Generate Soalan" / "Upload dokumen DOCX/PDF, AI extract soalan automatik" has no link, button or form; `/guru/soalan/ai-generate` exists only for PUT/DELETE. | **Replicated** as a static card. Alternatives: build an AI upload flow — rejected (new scope, D10; D4 AI simulation needs a discovered flow). | Rejected — replicate live (D9, D10) |
| DV-M10-11 | D-11 | Candidate: unusable control | S18/S20 "Visibility *" renders only the "Public" radio card; the Alpine values `tingkatan` and `class` (with their selects) have no rendered choice. | **Replicated**: "Public" only; the two unreachable selects are not offered. Adding the two choices would need invented labels and is new scope (D10; M08 AUD-04 precedent). OQ-M10-07. | Rejected — replicate live (D10) |
| DV-M10-12 | D-12 | Candidate: contradictory counts | S1 "Soalan" 20719 / "✅ 19361 diluluskan" vs S21 "Jumlah" 16817 / "Diluluskan" 16817 for the admin. The labels differ and the definitions are not visible; no definition found fits every observed value (e.g. "objective + structured" fails because the admin's S17 draft filter is empty, so every structured question is published). | **Replicated**: the admin's S1 figures are seeded as observed snapshot constants (definition UNVERIFIED, the M06 BR-M06-01 hub-constant precedent); S21 is computed from the M04 dataset (16,817 contributions, all approved). For other teachers S1 "Soalan" is computed as contributed objective + structured questions and "diluluskan" as approved objective + published structured (INFERRED, PROPOSED definition). Alternatives: (a) make S1 equal S21 — rejected, changes two live values without evidence which one is wrong; (b) invent a definition that reproduces 20,719 / 19,361 — rejected (no observed basis). OQ-M10-05. | Rejected — replicate live (definitions UNVERIFIED) |
| DV-M10-13 | D-13 | Wrong / inconsistent label | S7 "Tingkatan" column mixes "T4" (12 rows), "T5" (15), "Tingkatan 4" (2) and "Tingkatan 5" (108); rows are grouped T4, T5, "Tingkatan 4", "Tingkatan 5", so each level appears twice (audit `s7-level-labels-masked.png`). | Every row shows the M03 level name and rows are grouped once per level, names A→Z inside: admin "Tingkatan 4" × 14, "Tingkatan 5" × 123. Only the label text and grouping change. Alternative: show "T4" everywhere — rejected (the column header is "Tingkatan"; M03 names are used elsewhere). | Approved (D9) |
| DV-M10-14 | D-14 | Candidate: visual order | Discovery read "Lain — 763" (between Sejarah 795 and PSV 510) as out of order. The 11 chips are in **descending count order including "Lain"** (3,287 … 795, 763, 510, 363, 269). | **Replicated**: chips sorted by count with "Lain" at its count position. Not a defect. | Rejected — replicate live (not broken) |
| DV-M10-15 | D-15 | Contradictory rule | One difficulty value, several scales: the platform stores 1–5 (M04 BR; S28 filter 1–5; S23 "Tahap 4"; S21 card "Sukar" for the same question = M04 label of 4). S22 create offers "Mudah"/"Sederhana"/"Sukar" (`easy`/`medium`/`hard`). S24 edit offers "Tahap 1 (Mudah)", "Tahap 2 (Sederhana)", "Tahap 3 (Sukar)" (values 1–3) and preselects nothing for the observed "Tahap 4" question, so a save would store a value whose label contradicts S21/S23. | **S24 only** changes: its options are the S22 labels "Mudah", "Sederhana", "Sukar" with the platform values 2, 3, 4, the saved value preselected; a saved 1 or 5 shows "-- Pilih --"; that saving "-- Pilih --" keeps the saved value is an INFERRED server rule (not observed). S22 keeps its labels; they store 2 / 3 / 4 (INFERRED mapping by label, consistent with S21 "Sukar" = 4). S21, S23 and S28 are unchanged. Alternatives: (a) keep "Tahap 1–3" labels with values 2–4 — rejected ("Tahap 3 (Sukar)" would show as "Tahap 4" on S23, a new contradiction); (b) offer all five levels on S24 — rejected (new options and copy, D10); (c) replicate — rejected (edits can silently change or lose the difficulty). | Approved (D9) |
| DV-M10-16 | D-16 | Candidate: contradictory counts | S27 card "Bahasa Melayu … 514 soalan" opens S28 "6,048 Jumlah"; on S28 5,918 + 105 ≠ 6,048. | **Replicated**: S27 shows the SPM databank pool (identical to M06 S2, same per-subject values; changing it would break M06), S28 lists every active question of the subject across levels (observed Tingkatan 1 and 3 cards); "Jumlah" includes the types other than Objektif/Subjektif (25 for BM, INFERRED). Both are computed from the D11 dataset. Alternatives: (a) change S27 to the S28 totals — rejected (25 live values and the M06 equality); (b) filter S28 to the pool — rejected (changes the observed list). OQ-M10-15. | Rejected — replicate live (different scopes) |
| DV-M10-17 | D-17, AUD-M10-08 | Layout breakage | S2 never reflows: the KPI and panel grids keep 4 columns at 1280, 768 and 375 (`grid-template-columns` 174/174/174/208px at 768; the only media query is `max-width:1400px`). At 375 the tiles are squeezed and "GPS Sekolah", "Engagement Pelajar" and other right-hand panels, the five links after "🔬 Remedial" (x = 380–791px) and the LIVE badge are clipped by `body{overflow-x:hidden}`; at 768 two header items are clipped (`s2-375-nav-clipped.png`, discovery `command-center-mobile.png`). | **Minimal responsive fix:** grids 4 columns ≥1024px, 2 columns 640–1023px, 1 column <640px, no panel clipped; below 1024px the six top-bar links sit in a horizontally scrollable row; the LIVE badge and the clock stay visible (they are not hidden on live, only clipped, so keeping them visible is the minimal change). Colours, panels and content unchanged. Alternatives: hide LIVE/clock — rejected (changes what live renders); a menu button — rejected (new control). | Approved (D9) |
| DV-M10-18 | D-18 | Horizontal scroll | S12 at 375px is 416px wide (the resource URL input overflows). | The Bahan Rujukan fields are full width and stack below 640px; nothing else changes. | Approved (D9) |
| DV-M10-19 | D-19 | Horizontal scroll | S16 at 375px is 398px wide (guide embed table / code chips). | Example URLs wrap inside their chips (break-all); the table becomes rows below 640px. | Approved (D9) |
| DV-M10-20 | D-20 | Horizontal scroll | S18/S20 at 375px are 414px wide (the rubric row's remove button is off-screen). | Below 640px a rubric row wraps (konstruk + marks on the first line, keyword full width, remove button visible). | Approved (D9) |
| DV-M10-21 | D-21 | Horizontal scroll | S22 at 375px is 383px wide (option image buttons). | The option image button moves under the option text below 640px. | Approved (D9) |
| DV-M10-22 | D-22 | Candidate: label vs validation | S5 "Tahap Pendidikan *" radios carry no `required`; the server rule is not observable; the school-class picker exists only in script. | **Replicated**: no client `required` (unsure → follow live); the mock server requires the level and returns the shared validation error (copy UNVERIFIED, OQ-M10-16); the picker and "Auto dari kelas sekolah" are not rendered, as live. Alternatives: add native `required` — rejected (adds a check not observed); remove "*" — rejected (changes live copy). | Rejected — replicate live (D9: unsure) |
| DV-M10-23 | D-23 | Wrong label | S15 step 3 tells teachers to pick "YouTube / Soalan Guru" in Misi Harian; the S12 option is "Soalan & Rujukan (YouTube/Anyflip/Rujukan)" (S16 guide step 5 already says "Soalan & Rujukan"). | Step 3 text: "Pilih "Soalan & Rujukan (YouTube/Anyflip/Rujukan)" di Misi Harian." (PROPOSED COPY assembled from the live option label). Alternative: rename the S12 option — rejected (changes the control, not the hint). | Approved (D9); PROPOSED COPY |
| DV-M10-24 | D-24 | Dead links | Drawer "Tetapan" → `/settings` (404); 404 page "Mula Latihan" → `/latih-tubi` (404). | Already fixed globally by M01 DV-01 (→ `/tetapan`) and DV-02 (→ `/practice`); M10 adds nothing. | Approved (M01 DV-01/02) |
| DV-M10-25 | D-25 | Visual bug / unreadable text | S27: eight subject tiles show an empty square (`fa-beaker`, `fa-flask-round`, `fa-trending-up`, `fa-variable`, `fa-monitor`, `fa-languages` do not render); the banner h1 "Databank Soalan SPM" is dark text on the purple gradient (`databank-desktop.png`). | Icons resolved by format to glyphs (M06 DV-03 pattern, same icon values); the banner h1 in white. Tile colours and the subtitle unchanged. | Approved (D9) |
| DV-M10-26 | §1.2 probes | Broken page | GET on method-only routes (FN-M10-1.2.3) shows the English Symfony page "Oops! An Error Occurred" / "The server returned a "405 Method Not Allowed"." (`set-405` state). No M10 screen links to them. | The global 404 page (M08 DV-24 precedent; the SPA has no method-level routing). | Approved (D9) |
| DV-M10-27 | §2.19 | Candidate: wrong label | S19 shows `fa-flask` "Eksperimen" for question 4454 while S20 shows Template "Tiada"; whether S19 always shows the chip or S20 fails to preselect is not observable. | **Replicated** (S19 shows the chip as live; S20 shows the stored template). OQ-M10-17. | Rejected — replicate live (D9: unsure) |
| DV-M10-28 | AUD-M10-06 | Unreadable text | Measured text below 12px (live, 1280px, computed sizes): **S1** guide text 10px, checklist subtitles and "Lihat" 9px, "Top 3" / "Analitik Kelas →" / "Rule-based" 11px; **S2** 0.5–0.75rem (8–12px) — style sheet `font-size:0.5rem`, script `0.55rem` summary labels, `0.6rem` risk chips and "Jana" buttons, `0.65rem` links; **S7** trend day labels 8px, trend "0%" 9px, "Tidak Hadir" badges 10px; **S21** tier names 10px, thresholds "(10)"… 8px, card chips 11px. S5, S10, S17, S27, S28, S29 measured: none (audit). | **Text only, inside `main` (S2: the page body), on S1, S2, S7 and S21:** content text below 12px is raised to 12px; icons, layout, colours and every other screen are unchanged (M05 DV-11 / M08 DV-18 precedent; NFR-02). Unmeasured screens are replicated as live (the v1.0 blanket sentence is withdrawn). | Approved (D9) |
| DV-M10-29 | D-26 (new, audit AUD-M10-07) | Broken destructive control | S20: the delete form (`_method=DELETE`, `onsubmit="return confirm('Padam soalan ini?')"`) is nested inside the edit form; the browser discards the inner form, so "Padam" submits the edit form (`POST …/4454`, `_method` = PUT and DELETE; the server reads DELETE) and deletes immediately without the intended confirm (`document.forms` has 3 forms and no delete form; `s20-padam-nested-form.png`; never clicked). | "Padam" is a separate delete form (outside the edit form) with the source confirm "Padam soalan ini?" (SOURCE-DERIVED copy): OK → `DELETE` → S17; cancel → nothing. Alternatives: replicate the immediate delete — rejected (the source shows the confirm is intended; a destructive action without it is broken). | Approved (D9) |
| DV-M10-30 | Privacy note (2026-09-30) | S32 "No Kad Pengenalan" placeholder example (EL-M10-S32-017) is a 12-digit IC that may be real personal data. | The placeholder example is the fictitious `000101010000` (serial 0000 is never issued); all other copy unchanged. Privacy overrides fidelity for personal data (CLAUDE.md §6; same as M01 DV-18). | Applied directly (privacy rule) |
| DV-M10-34 | v1.17 (build); `docs/discovery/img/M10/kelas-qr-modal.png` | Unreadable text (D9) | S4 QR modal: the class-name heading in the gradient (indigo → purple) header renders **dark** on the dark gradient (the screenshot shows only a dark "-" above a white sub-line); unreadable. | The class-name heading renders **white**; the header gradient, the white sub-line and everything else unchanged. | Approved (D9) |
| DV-M10-33 | v1.17 (Session 6 second pass); DV-M10-03 follow-up | Capability limit (INFERRED) | The remedial "Jana" action picks questions "of the weak topic" (S2, SOURCE-DERIVED); the weak topic is a DSKP SP (or a chapter). M04's public contract exposes `practiceQuery({curriculumChapterId})` but no selection by `dskpSpId`. | Question selection (SRS BR-M10-12): (1) the student's wrong answers in the weak topics; (2) topped up from the weak topics' **chapters** via M04 `practiceQuery({curriculumChapterId})`; (3) subject + level as a last resort; up to 10. Scan, button states, counts and copy unchanged. Alternatives: select by exact SP — rejected (not in M04's public contract; a private reader of M04's store would break D12); empty set when no SP match — rejected (the button would fail where live works). | Approved (D9; INFERRED) |
| DV-M10-31 | v1.16 (Session 6 build); D-12 sibling | Display constant (replicated) | Admin S2 `gpsOverall` **4.69** ("GPS" KPI of the Command Center; live-data key `gpsOverall`). The definition is not observable and no computed GPS sits beside it (S1 shows no GPS). | **Replicated** as a `DISPLAY_CONSTANT` of DATA-M10-11 (SRS §6.10, BR-M10-08), shown on S2 for the admin only; for a teacher `gpsOverall` is computed by the M08 GPS rule over the viewer's classes ("--" when null). Its **own id** because DV-M10-12 concerns the S1 counts (20719 / 19361) and is not widened. Alternatives: compute it from M08 headcount for the admin — rejected (no definition reproduces 4.69; it would change an observed value); hide the KPI — rejected (removes live content). | Rejected — replicate live (definition UNVERIFIED) |
| DV-M10-32 | v1.16 (Session 6 build); D24 | Server-defined file (SERVER; not a D9 fix) | S21 / S25 / S26 "Template XLSX" (`/guru/audio-kbat/template`) and "Template Word" (`/template-word`) answer 200 on live, but the file contents were never observed (FN-M10-7.6 is the observed S26 form, not the template). Under D24 the server defines them (SERVER `TeacherQuestionToolsController.php:397-453`, verified): `/template` is a CSV labelled `.csv` (the code comment: a CSV named `.xlsx` would be a file Excel warns about) and `/template-word` a real `.docx`. | **`/template`** serves `template-audio-kbat.csv` (`text/csv; charset=UTF-8`, UTF-8 BOM, columns `tajuk,kod_subjek,kod_tingkatan,nama_fail_audio`, one example row `Contoh: KBAT Sains Bab 1,SCI,T4,kbat-sains-1.mp3`) — SERVER. **`/template-word`** serves `template-audio-kbat.docx`, a real Word document generated by the mock, with the title "Template Set Audio KBAT", the server's instruction sentence and a table of the same 4 headings (Tajuk, Kod Subjek, Kod Tingkatan, Nama Fail Audio) plus the example row — SERVER. Link labels, hrefs and the 200 status unchanged. The remaining difference — live's "Template XLSX" link downloads a CSV, not an XLSX — is the server's own behaviour and is recorded as SERVER behaviour, **not** a D9 fix. *(Supersedes the earlier "CSV + `.txt` with the FN-M10-7.6 structure" decision.)* | Applied (SERVER, D24) |
| DV-M10-35 | SWEEP-23OCT D3 | Dead link (SPA) | S2 "📊 Rekod" → `/guru/remedial-progress` (S3) had no SPA route, so the guard silently sent the user to `/guru`. | S3 is built as specified (FN-M10-2.3.1–2.3.3: "Remedial Progress Dashboard", 4 stat cards, "Senarai Pelajar & Progress" with the live empty copy; populated rows PROPOSED) on `GET /api/guru/remedial-progress`, Guru and Admin, user shell. The "Rekod" link is unchanged. Alternative: hide "Rekod" — rejected (removes a live link and the screen is already specified and served). | Approved (user rule D9); the guard side depends on the half-AZ prototype-scope patch (PR #169: `/guru/remedial-progress` in the teacher scope) |
| DV-M10-36 | SWEEP-23OCT D4b | Dead links (SPA) | S21 Audio KBAT card: "Cipta Set" / "Senarai Set" → `/guru/audio-kbat/create` / `/guru/audio-kbat` (S26 / S25) have no SPA screen (404); the template links' `href` (`/guru/audio-kbat/template*`) is also an SPA 404 when opened outside the click handler. | The admin's "Cipta Set" / "Senarai Set" go to the M09 admin screens `/admin/audio-kbat/create` and `/admin/audio-kbat`; a teacher has no Audio KBAT screen, so the two buttons are not shown. The template links `href` is the API file URL (`/api/guru/audio-kbat/template(-word)`); the click still downloads through the API client. Labels unchanged. Alternative: build S25 / S26 under `/guru` — rejected (new scope; M09 owns the Audio KBAT set screens). | Approved (user rule D9) |
| DV-M10-39 | SW5-11 (teammate report) | Broken (missing icon) | S2 top-bar action "Ramalan SPM" used the Phosphor glyph `crystal-ball`, which the installed icon set does not have, so the action showed no icon (console: `[icons] not bundled: ph:crystal-ball`). | The glyph is `chart-line-up` (bundled, a forecast/trend glyph already used elsewhere); label and behaviour unchanged. | Applied (D9) |
| DV-M10-40 | SW7-01 (http mode) | Broken flow (D9: contradictory rule) | S5 opens with the "Pilih Sekolah" search empty (AC-M10-14.1; the observed admin has no school). A teacher who leaves the optional school empty creates a class with no school (contract: a missing or empty `schoolId` means "no school"). The school-admin screens (`/admin-sekolah/kelas`, "Kelas Aktif") filter on the class's school, so that class never reaches the teacher's own school admin. | **http mode only:** when the session user has a `schoolId`, S5 loads that one school (`GET /api/schools/search?id=`, M02 #38) and opens with it already chosen (the selected card, the level tiles filtered by its type, `schoolId` sent on submit). Not chosen when the teacher has no school or the lookup fails or returns `[]` (inactive school): the search stays empty as on live. The teacher can still clear the school on purpose (`fa-times-circle`), and the class then has no school (the contract's explicit choice, backend unchanged). **Mock mode unchanged** (empty search, AC-M10-14.1 and AC-M10-15.2 as written). Alternatives: preselect in both modes — rejected (changes the observed S5 start state and AC-M10-14.1 for a mock teacher with a school); make the school required — rejected (new validation; the school is optional on live); change the API to default to the teacher's school — rejected (contract and backend out of scope). | Approved (user rule D9) |
| DV-M10-43 | SWX-04 (http mode) | Broken function | S2 "Remedial" (Smart Remedial) shows "Selesai ({x}%)" for the latest completed test of a student (the highest id, FN-M10-2.2.11). In http mode ids are strings and were compared as text, so "9" counted as later than "10" and an older test's result and link (`/remedial/{id}`) could be shown. | **http mode only:** the ids are compared by numeric value (digit strings as integers; an opaque non-digit id falls back to a text comparison), so test 10 is later than test 9. The scan has no date field, so "latest" stays the highest id. **Mock mode unchanged** (numeric ids). Copy and layout unchanged. | Latest by a date field — rejected: the scan (contract `RemedialScan`) has no date; convert ids with `Number()` — rejected: loses precision for large ids. | Applied (D9) |

**Explicitly not deviations** (replicated as live): the header subtitle truncation at 1280 (S7–S10, S15, S16, S21); "--" for a zero KPI on S2; raw level slugs ("tingkatan-5") in the S2 class panel; the S1 counts without thousands separators; the S12 subject list of 20 subjects and the unfiltered 935-option chapter select; "Tracking A" with no visible change on S12; the S16 guide open on every load while the S1 guide is remembered; S16 "Batal" keeping the typed values vs S28 "Batal" whose next opening resets the reasons; S20 "Markah" without `required` and without a per-sub palette; S20 rubric "Tambah" always adding F; no DSKP section on S20 and S24; S24 editing MCQ fields only; S29 without a delete button; S31 selects without "Pilih..."; the English words listed in the conventions; no loading spinners on server-rendered pages; S10 side cards not refreshed by the poll (server-rendered).

---

## 8. Out of scope

| Item | Owner / reason |
|---|---|
| Class detail page `/guru/kelas/{id}` (assignments "Tugasan", submissions) | Not observable (the admin owns no class); OQ-M10-11. The route shows the 404 page until discovered. |
| Command Center student/class/teacher pages (`/guru/command-center/student/{id}`, `/classroom/{id}`, `/school/{sid}/teacher/{uid}`) | Not opened (L-M10-02). Since v1.7 they mount the M17 v1.4 S4–S7 drill-down component (M17 owns the templates; teacher scope BR-M17-30). |
| Student display of broadcasts and the timetable ("nampak bila login"); the student lists and sessions of missions, remedial tests and question sets (`/misi-harian`, `/remedial/saya`, `/remedial/{id}`, session modes `mission`/`remedial`/`question_set` — owned by M05, XL2-08); the set-taking page | M05 screens / UNVERIFIED (L-M10-07, L-M10-08); M10 defines the data contract only. |
| Question review and approval, report handling, paper processing | M04 (M10 creates the records through the M04 contract). |
| Article and Audio KBAT review/publication, `/artikel/{slug}`, `/audio-kbat` | M09. |
| `/guru/monitoring`, `/guru/laporan*`, `/guru/analisis-item`, `/guru/perbandingan-kelas`, `/guru/laporan-mingguan-kelas` | M11. |
| `/prestasi/kelas*`, `/analitik/kelas`, headcount | M08. |
| `/guru/kirkpatrick*` | M12. |
| Coins, badges catalogue and awarding rules, `/guru/gamifikasi` | M14 (M10 shows the Badges panel from the M14 contract). |
| AI extraction ("AI Auto-Generate Soalan") | Not a feature on live (DV-M10-10). |
| Real QR printing, clipboard, file storage, audio hosting, downloads | Simulated (D1, D2): `window.print()`, the Clipboard API and object URLs in the mock. |

---

## 9. Open questions

**Not-observable states (from discovery §9)** — specified as SOURCE-DERIVED / INFERRED / PROPOSED; E2E provisional:
- **L-M10-01** S1 populated panels (priority students, critical topics, rule-based actions, peer-tutor pairs, class cards, submissions).
- **L-M10-02** Command Center student/class/teacher pages.
- **L-M10-03** Evaluate and Badges panels (not opened: may write).
- **L-M10-04** Remedial scan results, Jana / Lihat Quiz / Batal & Jana Semula, populated S3.
- **L-M10-05** Class cards, class detail, roster, Pelajar Sekolah list, add/remove student.
- **L-M10-06** Student join success/error and joined-class cards; `/kelas-saya/{id}`.
- **L-M10-07** Timetable entries and delete, broadcast history, student display of both.
- **L-M10-08** Mission list, progress, student mission cards.
- **L-M10-09** Set builder (after "Cipta Set & Tambah Soalan"), set list, student set list and taking.
- **L-M10-10** Soalan & Rujukan list and student embed.
- **L-M10-11** Audio KBAT set list with data; article "Menunggu Semakan" row; every form's validation errors and success flashes.
- **L-M10-12** Toggle-status and delete results; report toast text; profile save.

**Questions**
1. **OQ-M10-01 Recipients (discovery OQ-01).** Missions (S12) and broadcasts (S9) have no selector: INFERRED all students of the teacher's classes. Confirm, or whether the school or one class is meant.
2. **OQ-M10-02 Set builder (OQ-02).** How questions are added after "Cipta Set & Tambah Soalan" and how a student takes a set (`/set-soalan-saya`). PROPOSED minimal picker and M05 quiz reuse.
3. **OQ-M10-03 Attendance population (OQ-03).** Where the admin's 137 students come from (no class, no school). Seeded as the M02 named selection of request R-M02-01 (14 Tingkatan 4, 123 Tingkatan 5; SRS §13).
4. **OQ-M10-04 Join URL (OQ-04).** The QR `join_url` value and whether it auto-joins. PROPOSED `https://prestasiplus.my/kelas-saya?kod={code}` pre-filling the code field (no auto-join).
5. **OQ-M10-05 Count definitions (OQ-05, DV-M10-12).** S1 "Soalan" / "diluluskan" vs S21 "Jumlah" / "Diluluskan" / "Digunakan".
6. **OQ-M10-06 Own-data scope (OQ-06).** Does a teacher see only their own structured questions (S17), contributions (S21) and articles (S29)? INFERRED yes; the admin sees all structured questions.
7. **OQ-M10-07 Visibility (OQ-07, DV-M10-11).** Should "Tingkatan" / "Kelas" visibility be offered? Replicated as Public only.
8. **OQ-M10-08 Teacher shell (OQ-08).** A real teacher's sidebar, landing page and access rules. A teacher test account is needed (same request as M08 OQ-M08-01).
9. **OQ-M10-09 Evaluate / Badges (OQ-09).** Do they write risk flags or award badges on GET?
10. **OQ-M10-10 Mission types (OQ-10, DV-M10-02).** How "Tracking A" differs from "Latih Tubi SPM", and how a "Soalan & Rujukan" mission picks the teacher's questions (INFERRED: that subject's questions for the teacher's classes). **Partly resolved (XL2-36):** a "Soalan & Rujukan" mission draws from the teacher's approved Soalan & Rujukan MCQs of the subject, which are M04 questions (SRS BR-M10-35).
11. **OQ-M10-11 Class detail (OQ-11).** `/guru/kelas/{id}` fields, "Tugasan" and submissions.
12. **OQ-M10-12 Public teacher profile (DV-M10-06).** Does `/guru/{id}` work for a teacher (and which id: the teacher profile id 3 shown for the admin, or the user id)?
13. **OQ-M10-13 "Cipta Pelajar" (DV-M10-07).** Does a teacher with a school get a create-student page?
14. **OQ-M10-14 Galeri Rajah source (DV-M10-09).** Which images the gallery lists (M04 "Gambar Rajah"?).
15. **OQ-M10-15 Databank scopes (DV-M10-16).** Confirm S27 = SPM pool and S28 = all questions of the subject; what the 25 extra BM questions are.
16. **OQ-M10-16 Server validation copy.** Messages for S5, S12, S14, S16, S18, S22, S26, S30, S32, S33 (not observable read-only; the M01 validation-probe permission OQ-1 covers it).
17. **OQ-M10-17 S19 "Eksperimen" chip (DV-M10-27).**
18. **OQ-M10-18 Cross-module requests** (for the XL gate; exact text in SRS §13): R-M02-01 attendance selection (137 students without a school, 14 Tingkatan 4 / 123 Tingkatan 5); R-M04-01…06 (contribution facet `createdBy` and anchors, the S28 databank query and type split, the M10 contributed anchors incl. pending 700301, `teacher_databank` reports, paper types); M05 mission/remedial item shapes and session links; M08 class 516 join code and the 4,533 "murid" definition; M09 authorship of 36 articles; M11 own-class endpoint.
19. **OQ-M10-19 Class-dataset figures — closed (XL2-02).** M08 now reads S1 "Murid"/"Guru" as the M02 role counts (4,533 / 551); the class dataset takes 310 distinct owners (the observed teacher cards) and leaves the enrolled-distinct total unconstrained (SRS §6.2.1).

**PROPOSED items to report at G1** (Delivery Lead):
- **PROPOSED values / rules:** the titles of DV-M10-01; the drill title mapping (DV-M10-04); the join URL `?kod=` (OQ-M10-04); the INFERRED definitions of DV-M10-12 for teachers; the engagement, remedial, prediction and evaluation rules of SRS BR-M10-09, 11, 12, 14, 15.
- **PROPOSED COPY:** the S15 step text (DV-M10-23); the confirms "Padam jadual ini?" (S8), "Padam mesej ini?" (S9) and "Padam soalan ini?" (S15; S20 is SOURCE-DERIVED, DV-M10-29) — these confirms are also PROPOSED **behaviour** (live delete controls never seen); "Tiada soalan untuk topik lemah" (SRS BR-M10-12); the trend labels "Naik" / "Turun" / "Stabil" (BR-M10-14; live takes `p.trend_label` from the server); the Evaluate alert and suggestion texts (BR-M10-15).
- **PROPOSED layouts:** FN-M10-2.1.7, 2.3.3, 3.1.3, 3.3.3, 3.3.4, 3.4.3, 4.2.3, 4.3.2, 5.1.3, 5.3.3, 5.4.5, 5.5.5, 5.6.7, 5.7.2, 7.5.5.
- **Privacy question:** the S26 placeholder "Contoh: Cikgu Contoh A" is live copy that looks like a real teacher's name — replicate (current spec) or replace by a fictitious name under D9 privacy (Delivery Lead to decide). The 4454 stimulus author ("Soalan Oleh: …") is replaced by a fictitious name in the seed (SRS §6.11).
