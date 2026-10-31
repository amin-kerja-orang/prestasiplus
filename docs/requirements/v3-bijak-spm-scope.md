# V3 Release slice R1 = Bijak SPM (slug: `v3-bijak-spm-scope`)

Status: G1 DRAFT, 2026-10-30. Owner: product-analyst. Track: Full (slice of `admin-student-pipeline`, D82 approved; re-scoped by D86).
Naming (user, 2026-10-30): V1 = prestasiplus.my, V2 = prestasiplus.cloud + admin, V3 = the new system (the repo calls it "v2").
Inputs: TRACKER D79-D86; `docs/requirements/v2-admin-student-pipeline.md` (cited as PIPE; its "Release slicing (D86)" section tags every story and AC); `docs/discovery/v2-parity/student.md` (B01-B21, C01-C23), `docs/discovery/v2-parity/admin.md` (A01-A29, C01-C07); `docs/discovery/cloud-student-mechanism.md`; scratchpad `analysis/v2-v3-server-facts.md`.

---

## 1. Summary and goal

**Scope (D86):** secondary students only (Tingkatan 1-5); Darjah is out. Bijak SPM first; everything else is KIV. Admin work is only what feeds Bijak SPM.

**Principle (LEAD):** replicate what V2 production actually uses. Evidence:

| Fact | Value | Consequence |
|---|---|---|
| Approved answer modes | mcq 532, extended_essay 229, short_text 49, essay_choice 31, numeric 7; working_shown 0 approved (3 drafts); 8 other modes 0 rows | R1 builds 5 modes. The rest are KIV, not gaps. |
| Stimulus kinds on approved questions | passage, image, diagram, table, map, infographic, graph | R1 renders these 7. The other 8 kinds are KIV. |
| Usage | Databank Soalan SPM 426 sessions; Simulasi 283 attempts (6, 70, 99, 108 per month Jul-Oct; about 40% submitted); Soalan Aku Salah 94; Mock 26; Tracking A 18 | Databank and Simulasi are R1. Tracking A and Mock are R2. |
| V3 UAT state | 0 papers, 0 blueprints, 0 stimuli, 0 DSKP nodes; 406,396 legacy questions; all levels active; AI mock, OCR none | R1 must load DSKP, intake/create content, build and publish papers. |

**Goal of R1:** a Tingkatan 1-5 pupil sits a published Bijak SPM paper (and Databank / Kuiz), self-marks, sees the result and retries, and everything they see was created and approved by an admin with DSKP tags, with no fixture and no developer step.

## 2. Users

| Persona | Role in R1 |
|---|---|
| Murid (Tingkatan 1-5) | Sits papers, Kuiz, Databank; self-marks; reports questions. Mobile first (375px), Bahasa Melayu. |
| Admin Pusat | Loads DSKP, creates/imports/tags/approves questions, edits Kontrak, builds/generates/publishes papers, triages Laporan Soalan. |
| QA | Runs the end-to-end journey on the real stack. |

Admin Sekolah, Guru, PPD: KIV.

## 3. R1 item list (AC counts)

"Ref" = existing AC id in PIPE (counted once per item that reuses it); "New" = written here. Total 176 entries = 95 references + 81 new (some PIPE ACs are reused by two items). R1-21 (Panel parity, D79) was added last.

| Item | Title | Parity IDs | Ref | New | Total |
|---|---|---|---|---|---|
| R1-01 | SPM hub, paper list, cover, resume | B01, B03, B02 | 5 | 3 | 8 |
| R1-02 | Attempt: Bahagian, choose_n, question map | B04, B05, B11 | 4 | 3 | 7 |
| R1-03 | Widgets for the 5 production modes | B07 | 6 | 2 | 8 |
| R1-04 | Stimuli: 7 kinds, shared groups, images | B08 | 11 | 3 | 14 |
| R1-05 | Timer, autosave, Hantar | B09, B10, B12 | 2 | 4 | 6 |
| R1-06 | Semakan with self-mark | B14, B15 | 3 | 6 | 9 |
| R1-07 | Keyword-suggested marks | B13 | 1 | 4 | 5 |
| R1-08 | Results, Cuba Lagi, Lihat semakan lepas | B16, B19 | 1 | 4 | 5 |
| R1-09 | Simulasi Kuiz (random and per paper) | B17 | 2 | 4 | 6 |
| R1-10 | Rewards and records on submit | B18 | 0 | 4 | 4 |
| R1-11 | Databank Soalan SPM fed by admin questions | C11, A01 | 7 | 4 | 11 |
| R1-12 | DSKP curriculum loader (Tingkatan 1-5) | C04, B20 | 0 | 6 | 6 |
| R1-13 | Studio create/edit: stimuli, images, DSKP tags, approved = servable | A01-A04, A12 | 16 | 3 | 19 |
| R1-14 | PDF intake, accept, approve | A06-A08 | 2 | 4 | 6 |
| R1-15 | Kontrak / blueprint editor with Disahkan | A20 | 6 | 3 | 9 |
| R1-16 | Set Builder, Jana Kertas, paper review, Terbit | A18, A19, A09, B21 | 10 | 2 | 12 |
| R1-17 | Servability "Dilihat murid di" for Bijak | A29, A21 (Bijak part) | 8 | 2 | 10 |
| R1-18 | Laporan Soalan for Bijak questions | A15, C19 | 0 | 5 | 5 |
| R1-19 | Secondary-only guard (Tingkatan 1-5) | D86 | 0 | 3 | 3 |
| R1-20 | End-to-end acceptance on the real stack | all | 11 | 5 | 16 |
| R1-21 | V2 Panel parity: same steps and labels (D79d), one AC per Panel screen used by R1 | Panel rows of A01, A09, A18-A21 | 0 | 7 | 7 |

## 4. Stories and acceptance criteria

Priority: all items are Must unless marked. PIPE = `v2-admin-student-pipeline.md`.

### R1-01 SPM hub, paper list, cover, resume
As a Murid, I want to find and open a published paper, so that I can sit it like the real exam.
- Ref: PIPE AC-20.1 (list), AC-20.2 (resume choice), AC-20.3 (cover), AC-01.2 (empty state), AC-14.7 (no link to a missing screen).
- AC-R1-01.1 Given a Tingkatan 1-5 pupil, when the SPM hub opens, then it offers Bijak SPM (Kertas Pilihan, Jana Kertas, Sejarah) and Databank Soalan SPM; entries for R2/KIV activities are absent unless built and enabled.
- AC-R1-01.2 Given papers in draft or withdrawn, when the pupil lists papers or opens one by direct URL, then it is not listed and the URL gives not-found; only `Terbit` papers appear, grouped by subject.
- AC-R1-01.3 Given an unsubmitted attempt on a paper, then its card shows "Sambung" instead of "Mula".

### R1-02 Attempt: Bahagian, choose_n, question map
As a Murid, I want to answer a paper with sections and optional questions, so that I practise the real structure.
- Ref: PIPE AC-10.6 (Pilih N), AC-10.7 (multi-part), AC-20.6 (map and flag), AC-20.8 (375px reach). Presentation (one question per screen vs printed sheets) follows the V3 design (D28c, D44); behaviours replicate V2.
- AC-R1-02.1 Given a Bahagian "Pilih N", when the pupil ticks an (N+1)th question, then it is refused with a plain BM message and the picks persist after reload.
- AC-R1-02.2 Given the pupil answered M > N questions of such a Bahagian and submits, then the server score counts the N best-scoring questions (test with known marks).
- AC-R1-02.3 Given a paper, then every question is reachable, in Bahagian order, and questions sharing a stimulus stay together in group order (D41).

### R1-03 Widgets for the 5 production modes
As a Murid, I want to answer mcq, short_text, numeric, extended_essay and essay_choice parts.
- Ref: PIPE AC-10.1 to 10.5 (one per mode), AC-10.10 (no "akan tersedia" fallback for approved questions).
- AC-R1-03.1 Given one attempt containing a part of each of the 5 modes, when the page reloads mid-attempt, then all five answers are restored and appear in Semakan.
- AC-R1-03.2 Given a question containing a mode outside the 5 (KIV), then it is not served in Bijak/Kuiz/Databank and the admin sees the reason (PIPE AC-05.2, 05.3); the pupil never sees an unanswerable part.

### R1-04 Stimuli: 7 kinds, shared groups, images
As a Murid, I want to see the passage, picture, table or figure a question refers to.
- Ref: PIPE AC-11.1 to 11.11 (passage; image and infographic; diagram, map, graph; table; stem image; option images; shared group "Rajah 1"; mobile persistence; load failure; no layout shift; image access rule).
- AC-R1-04.1 Given one fixture per kind (passage, image, diagram, table, map, infographic, graph) in a Terbit paper, then each renders correctly at 375, 768 and 1280px.
- AC-R1-04.2 Given a question with an image stimulus or option image approved in the admin (image uploaded through the existing upload), then it is served in a Terbit paper; the Bijak bridge no longer refuses it.
- AC-R1-04.3 Given a stimulus kind outside the 7 (KIV), then the question is excluded with an admin-visible reason (PIPE AC-04.2), never shown partly.

### R1-05 Timer, autosave, Hantar
As a Murid, I want my answers saved and my time tracked, and to submit safely.
- Ref: PIPE AC-20.4 (timer, warning, auto-submit, save states, Hantar confirm, late submit never rejected), AC-20.5 (autosave debounce, hidden questions keep answers).
- AC-R1-05.1 Given typing in an answer, then within 2 s the save state shows "disimpan"; with the network off it shows "luar talian" and, once back online, the answers reach the server without loss.
- AC-R1-05.2 Given a reload or opening the attempt on another device while unsubmitted, then the saved answers, flags and picks are restored.
- AC-R1-05.3 Given Hantar pressed twice (or a retry after a network error), then one submission exists and the score does not change.
- AC-R1-05.4 Given a timed paper reaching 0 with unsaved typing, then the latest answers are included in the auto-submit.

### R1-06 Semakan with self-mark (parity B15)
As a Murid, I want to mark my own written answers against the scheme, so that my score is complete.
- Ref: PIPE AC-10.8 ("Markah kendiri:" clamped 0..marks), AC-10.9 (reveal copy), AC-20.7 ("Dihantar", "{score} / {max}").
- AC-R1-06.1 Given a submitted attempt with a subjective leaf part, then Semakan shows a stepper 0..N (N = part marks), clamped, not locked; changing it updates the part status, Bahagian total and "{score} / {max}" without reload.
- AC-R1-06.2 Given a part with a band rubric, then a band picker is shown; choosing a band sets the stepper to that band's midpoint (rounding as observed in V2) and the pupil can still adjust.
- AC-R1-06.3 Given a Bahagian marked as a whole (mark budget, no per-part scheme), then one stepper for that Bahagian is shown (V2 `semak-bahagian`); see OQ-2.
- AC-R1-06.4 Given a self-mark request, then the server accepts it only from the attempt owner, only after submit, and clamps or rejects a value above the part marks; the saved value shows on re-opening Semakan.
- AC-R1-06.5 Given unmarked subjective parts, then they show "Belum dimarkah" and count 0 in the total until marked.
- AC-R1-06.6 Given a self-mark change, then the pupil's Prestasi figure for that attempt is updated (V2: recorded to practice).

### R1-07 Keyword-suggested marks (parity B13)
As a Murid, I want a suggested mark for point-based answers, so that self-marking is quicker and fairer.
- Ref: PIPE AC-10.8 (keyword suggestion then adjustment).
- AC-R1-07.1 Verify first: before build, the owning developer records whether V3 `attempts/marking.ts` already seeds suggestions and reads the V2 `RubricKeywordMarker` rule; the result is written in the item's task note.
- AC-R1-07.2 Given a `mark_scheme_points` part and an answer containing keywords of k of n points, then on submit the suggested mark equals the sum of the matched points' marks, shown as "Cadangan automatik (kata kunci)", and it seeds the stepper.
- AC-R1-07.3 Given no keyword match, then the suggestion is 0 and the part is not marked "Betul"; band_rubric and model_answer parts get no suggestion (pure self-mark).
- AC-R1-07.4 Given the same answer twice, then the suggestion is identical (case- and whitespace-insensitive, deterministic).

### R1-08 Results, Cuba Lagi, Lihat semakan lepas (B16)
As a Murid, I want to retry a paper and revisit my last review.
- Ref: PIPE AC-20.7.
- AC-R1-08.1 Given the result page of a submitted attempt, then "Cuba Lagi" starts a new blank attempt of the same paper and the old attempt stays unchanged in Sejarah.
- AC-R1-08.2 Given a paper with a past submitted attempt, when the pupil opens its cover, then "Lihat semakan lepas" opens the latest submitted result.
- AC-R1-08.3 Given no submitted attempt, then neither control is shown; given the paper was withdrawn, "Cuba Lagi" is refused with a plain BM message.
- AC-R1-08.4 Given the result page at 375px, then status, "{score} / {max}" and per-Bahagian totals are visible without horizontal scroll.

### R1-09 Simulasi Kuiz, random and per paper (B17)
As a Murid, I want a quick objective quiz from the paper bank.
- Ref: PIPE AC-14.1 (random Kuiz screens and copy), AC-14.2 (per-paper quiz).
- AC-R1-09.1 Given the hub, then a pupil starts a random Kuiz with count 5/10/20/40 (default 20); the optional subject picker is built only as proven in DISC §5.5; questions are Approved MCQ parts with a correct option and show their stimulus (R1-04).
- AC-R1-09.2 Given a Kuiz question, then the answer key is not in the page before "✓ Semak"; the check is server-side and returns correct/incorrect.
- AC-R1-09.3 Given a published paper, then "Kuiz" on its card or cover opens the per-paper quiz (MCQ parts by Bahagian; non-MCQ per AC-14.2 / FD-9).
- AC-R1-09.4 Given fewer eligible questions than the chosen count, then the quiz runs with the available number, or shows "Belum ada soalan objektif" when none.

### R1-10 Rewards and records on submit (B18)
As a Murid, I want my sitting to count in Prestasi and rewards as in V2.
- AC-R1-10.1 Verify first: the developer documents from V2 code (`PracticeRecorder`) what a submit writes (session, Prestasi feed, kombo, syiling) with the rules and amounts; no amount is assumed.
- AC-R1-10.2 Given a submit, then V3 writes the same kinds of records once; resubmit, Cuba Lagi or later self-mark never double-awards.
- AC-R1-10.3 Given a submitted attempt, then it appears in the pupil's Prestasi by subject and in Sejarah.
- AC-R1-10.4 Given a finished Kuiz or Databank session, then it is recorded in the same way (mode kept: `spm_tahun_lepas` for Databank).

### R1-11 Databank Soalan SPM fed by admin questions (no spmPool flag)
As a Murid, I want Databank questions to include what admins approve, since it is the most used activity.
- Ref: PIPE AC-08.1, 08.3, 08.4 (A02 empty text), 03.8 (legacy untagged stay servable), 12.1 (A02 serves images/stimuli), 11.12 (Databank part), 10.9 ("Penjelasan:").
- AC-R1-11.1 Given the Databank, then counts are 5/10/20 (default 10), random, one question at a time with "✓ Semak", "Penjelasan:" when present, and a result with "Ganjaran Anda".
- AC-R1-11.2 Given an admin approves an MCQ (Tingkatan 1-5, with subject) through the Studio, then the Databank count for that subject rises by 1 and the question can appear, with no pool toggle in the form and no developer step.
- AC-R1-11.3 Given a Databank session, then it is stored with mode `spm_tahun_lepas` and appears in Prestasi, so usage history stays continuous.
- AC-R1-11.4 Given the 406,396 legacy questions already loaded, then those that qualified before still appear (no regression); image-bearing items stay excluded until their image is uploaded (PIPE AC-16.3).

### R1-12 DSKP curriculum loader (Tingkatan 1-5 only)
As an Admin Pusat, I want the DSKP loaded, so that I can tag questions and blueprints can run.
- AC-R1-12.1 Given a DSKP source for a subject and Tingkatan, when the loader runs, then it creates the curriculum nodes (Bidang, SK, SP with TP descriptors); running it again creates no duplicates.
- AC-R1-12.2 Given Darjah rows in a source, then they are ignored and listed in the report; only Tingkatan 1-5 are loaded.
- AC-R1-12.3 Given a load, then a report gives counts per subject and level and each rejected row with a plain reason; a subject loads fully or not at all (no half-loaded subject).
- AC-R1-12.4 Given a completed load, then the Studio tag picker lists the nodes for the question's subject and level, and Soalan by Chapter lists are unchanged (R2).
- AC-R1-12.5 Given the load, then it does not change any student-visible question or paper by itself.
- AC-R1-12.6 Given UAT after loading, then `curriculum_nodes` is greater than 0 for each in-scope subject (evidence in the QA table). Source of the data: OQ-1.

### R1-13 Studio create/edit with stimuli, images, DSKP tags; approved = servable
As an Admin Pusat, I want to create a full question and approve it in 4 clicks.
- Ref: PIPE AC-02.1 to 02.4, 02.7, 02.9, AC-03.1, 03.2, 03.4 to 03.7, 03.9, AC-05.1, 05.5, AC-16.3.
- AC-R1-13.1 Given the Studio form, then the admin can add a stimulus of each of the 7 kinds, upload an image for the stem, an option or a stimulus (existing upload), and attach one stimulus to several questions as a shared group.
- AC-R1-13.2 Given a question with an image and a complete DSKP tag, when approved, then it is servable in a Terbit paper, Kuiz and Databank (see R1-17).
- AC-R1-13.3 Given the form, then levels offered for new questions are Tingkatan 1-5 only (R1-19).

### R1-14 PDF intake, accept, approve
As an Admin Pusat, I want to turn a paper PDF into approved questions.
- Ref: PIPE AC-02.5 (action names state the real result), AC-02.6 (PDF upload and item review; DOCX ZIP, BI Kertas 1 and Kiriman Guru are not R1).
- AC-R1-14.1 Given a paper PDF uploaded via Muat Naik Kertas, then extraction produces review items; `Terima (A)` creates a draft question; then PIPE AC-02.2 moves it to Approved (click counts recorded).
- AC-R1-14.2 Given R1 sign-off, then at least one paper is intaken with the real extraction provider chosen at G2; a mock-only run (UAT today: AI mock, OCR none) does not pass this AC.
- AC-R1-14.3 Given a figure in the PDF, then the accepted item carries the cropped figure as a stimulus image, and a stimulus group when several items share it.
- AC-R1-14.4 Given an accepted item without a DSKP tag, then it is a draft and approval is refused until tagged (PIPE AC-03.2).

### R1-15 Kontrak / blueprint editor with Disahkan
As an Admin Pusat, I want to author and verify a blueprint per subject and kertas.
- Ref: PIPE AC-06.1 to 06.6.
- AC-R1-15.1 Given Kontrak Simulasi, then the admin creates and edits a contract through the screen using the existing blueprint API; a user who is not Admin Pusat cannot set `Disahkan` (refused).
- AC-R1-15.2 Given `Disahkan` is chosen, then it succeeds only if the conformance checks pass and the evidence record exists; otherwise every failing check is listed.
- AC-R1-15.3 Given Jana Kertas and student-generated papers, then only Disahkan contracts are offered.

### R1-16 Set Builder, Jana Kertas, paper review, Terbit
As an Admin Pusat, I want to build or generate a paper and publish it.
- Ref: PIPE AC-07.1 to 07.10 (Set Builder, Jana set exact-or-refuse, 2-click publish, publish checks, blueprint override audited, publish confirm and flashes, Tarik balik, Salin set, snapshot pinning, student-generated entry).
- AC-R1-16.1 Given `Terbitkan` on a valid paper, then the pupil's hub shows it on the next load with no job or restart.
- AC-R1-16.2 Given no Disahkan contract for the paper's subject and kertas, then `Terbitkan` is blocked with a message naming the contract, unless the audited override of PIPE AC-07.5 applies.

### R1-17 Servability "Dilihat murid di" (Bijak part)
As an Admin Pusat, I want to see where a question is visible to pupils.
- Ref: PIPE AC-04.1 to 04.5, 05.3, 05.4, 05.6; scope: Simulasi, Kuiz, Databank families only (other families R2).
- AC-R1-17.1 Given a question, then its detail lists Simulasi (paper titles), Kuiz and Databank each as "Boleh dilihat" or "Tidak boleh dilihat" with a BM reason.
- AC-R1-17.2 Given 20 sample questions of mixed shapes, then the admin indicator equals what a pupil actually receives (contract test on the same rule code).

### R1-18 Laporan Soalan for Bijak questions
As a Murid, I want to report a wrong question, and as an Admin Pusat I want to fix or hide it.
- AC-R1-18.1 Given Semakan or an attempt, then the pupil can report a question part with a reason and optional note; the report stores the question and paper.
- AC-R1-18.2 Given own reports, then `/laporan-soalan` lists them with status baru / disemak / diperbaiki / ditolak; a pupil sees only their own.
- AC-R1-18.3 Given the admin queue, then each row shows question, paper and status; the admin sets status and a note.
- AC-R1-18.4 Given a report, then the admin can open the question and archive it (verify that the existing row action does this; add if absent); archiving removes it from Databank and Kuiz at once. A Terbit paper that holds the archived question can no longer be started: a new sitting, or a per-paper Kuiz, is refused with "Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini."; a sitting already started keeps its pinned version; the Arkib answer warns the admin which Terbit papers are affected (PIPE AC-04.4). (Updated 2026-10-31 from "Terbit papers keep their frozen snapshot" to the implemented rule: H-A13 `r1/ha13-archived-paper` for sittings, REQ-A-003 `r1/b16-kuiz` for the per-paper Kuiz; REQ-C-016.)
- AC-R1-18.5 Given a status change, then the pupil sees the new status on their next view.

### R1-19 Secondary-only guard (D86)
- AC-R1-19.1 Given any R1 student activity, then only Tingkatan 1-5 questions, papers and levels are served; D1-D6 never appear (UAT today has all levels active, so this is a change).
- AC-R1-19.2 Given the admin lists, then D1-D6 questions stay visible and manageable (PIPE AC-16.6) but cannot be chosen for new R1 questions or blueprints.
- AC-R1-19.3 Given the DSKP loader and Kontrak editor, then Darjah is refused with a BM reason.

### R1-20 End-to-end acceptance (real stack)
- Ref: PIPE AC-18.1 (A02 and A10 only), 18.2, 18.3, 18.4, 18.6, 18.7, AC-17.1 to 17.5.
- AC-R1-20.1 Journey: Given a clean database with DSKP loaded, no demo flags and no `BIJAK_POC_QUESTIONS`, when an admin creates and approves questions with images/stimuli and DSKP tags, builds or generates a paper from a Disahkan blueprint and presses `Terbitkan`, then a Tingkatan 4 and a Tingkatan 5 student each sit it (objective and written parts), submit, self-mark, see the result and press "Cuba Lagi".
- AC-R1-20.2 Variant: the same with `Jana Kertas` under a Disahkan blueprint (exact-or-refuse; a short pool shows the shortfall).
- AC-R1-20.3 Negative: a draft paper is not visible; a question without DSKP cannot be approved; a withdrawn paper cannot be retried.
- AC-R1-20.4 Databank: an admin-approved MCQ appears in Databank and Kuiz for a matching pupil (R1-11.2).
- AC-R1-20.5 Environment: the run uses the real API (http mode), a real database and fictitious accounts; the mock transport and PoC flags do not count. Runs at 375, 768 and 1280px with no horizontal page scroll; part of G5.

### R1-21 V2 Panel parity (D79d)
As an Admin Pusat, I want the Portal Pentadbiran to work like the V2 Panel (admin.prestasiplus.cloud), merged into V3 (D79), so that I relearn nothing. Source: DISC §3.0-3.7 (labels and steps are verbatim there; this item adds no new label). The V2 main-site screens (Studio, Set Builder, Import & Semakan) are covered by R1-13, R1-14, R1-16; this item covers the Panel screens.

Rule for all R1-21 ACs: same screen title, same field, button, column, filter, flash and error labels (BM verbatim from DISC §3), same step order and click counts; only the theme differs; no new screen is added to reach them; where the Panel and the main site have two labels for one function, V3 has one menu entry (named in the table) and keeps both label sets on the screens.

| # | V2 Panel screen (route) | V2 menu label / how reached | V3 Pentadbiran location (menu.ts item) | R1 use |
|---|---|---|---|---|
| P1 | Kandungan SPM hub (`/spm`) | Sidebar `Kandungan SPM` | `SPM` (KS-01), `/admin/spm`; group Kertas & SPM | R1: shows lane cards and `Perhatian` counts |
| P2 | Lane list (`/spm/{lane}`, title "Kandungan SPM") | Hub card button `Buka senarai` | `/admin/spm/{lane}`: `Databank Soalan` (new item), `Bijak SPM` (KS-06); lanes `Tracking A` (KS-04), `Subjektif` (KS-05), `Latih Tubi` (KS-03) exist as R2 | R1 lanes: Databank Soalan, Bijak SPM |
| P3 | Semak Kertas Simulasi (`/spm/simulasi-paper/{paper}/review`) | No sidebar entry; Bijak SPM lane row `Sunting` | `Pembina Kertas` (KS-09) `/admin/spm/kertas/:id`, reached from the Bijak SPM lane row `Sunting` | R1 |
| P4 | Kontrak Simulasi (`/spm/kontrak`, heading `Senarai Kontrak`) | No sidebar entry; `Sunting kontrak` from Set Builder / paper review | `Kontrak Simulasi` (KS-08), `/admin/spm/kontrak`; also `Sunting kontrak` buttons | R1 |
| P5 | Question Studio (`/studio`, list "Bank Soalan"; edit modal) | Sidebar `Question Studio` | `Bank Soalan (Studio)` (BS-01), `/admin/studio`; Panel edit/`Sembunyikan` actions are the row actions | R1 |
| P6 | Pembina Set (`/studio/sets/{paper}/builder`) | No sidebar entry; hub/lane buttons | `Set Builder` (new, under `Pembina Kertas`), `/admin/studio/sets/:paper/builder` | R1 |
| P7 | Stimulus and uploads in the Panel (`Sunting petikan`, `Bahan rujukan (kulit kertas)` > `Tambah gambar`; Panel has no question upload or import) | Inside P3 | Inside `Pembina Kertas`; question images and stimulus authoring via `Bank Soalan (Studio)` wizard (R1-13) | R1 |

- AC-R1-21.1 (P1) Given the hub "Kandungan SPM", then it shows one card per lane in this order and with these texts: `Databank Soalan` ("Bank soalan objektif SPM mengikut subjek."), `Tracking A` ("Set objektif penuh dan lane bahasa."), `Subjektif` ("Soalan berstruktur dan esei."), `Bijak SPM` ("Kertas SPM penuh dalam format sebenar."), `Kertas Subjektif` ("Kertas 2, 3 & 4 percubaan negeri."), `Latih Tubi` ("Latihan ikut topik dan bab."), each with an attention count (labels "tidak boleh ditanda", "set tidak lengkap", "tiada skema — tidak disajikan", "tiada kunci jawapan", "tiada halaman") and `Buka senarai`; cards of R2/KIV lanes are shown only when their screen exists, otherwise hidden (no link to a missing screen), and the attention counts equal what students are actually served (PIPE AC-05.6).
- AC-R1-21.2 (P2) Given a lane page (Databank Soalan, Bijak SPM), then it has filters `Subjek` ("Semua Subjek"), `Status` ("Semua Status"), `Cari`, buttons `Tapis` and `Set Semula`, columns `Senarai`, `Tajuk`, `Perhatian`, `Tindakan`, and row actions `Pratonton`, `Salin` (native Simulasi rows) and `Sunting`.
- AC-R1-21.3 (P3) Given a native paper opened from the Bijak SPM lane, then the review screen offers, in this order and with these labels: `Kontrak Simulasi` block ("Tiada kontrak untuk subjek/kertas ini." when none), `Kemas kini metadata` (`Tajuk`, `Tempoh (minit)`, `Kod kertas (kulit)`, `Arahan kulit kertas`; flash "Kertas '{title}' telah dikemas kini."), `Sunting bahagian` (`Label bahagian`, `Peraturan menjawab`, `Bilangan soalan dipilih`, `Arahan bahagian`; flash "Bahagian '{label}' telah dikemas kini."), `Tambah soalan` (`Nombor soalan`, `Jenis jawapan`, `Markah`; errors "Soalan hanya boleh ditambah ke bahagian yang dicipta oleh admin.", "Nombor soalan {x} sudah digunakan dalam kertas ini."), `Padam soalan` (confirm "Soalan tambahan ini, termasuk bahagian, pilihan jawapan dan skemanya, akan dibuang dari kertas. Tindakan ini tidak boleh dibatalkan."; flash "Soalan {label} telah dipadam."), `Salin set` (flash "Set disalin sebagai draf. Sunting dan terbitkan salinan baharu."), and the `Penerbitan` panel: draft shows "Belum boleh diterbitkan" with blockers and `Terbit`; live shows "Kertas ini sedang DITERBITKAN — pelajar boleh mengaksesnya di Simulasi." with `Sembunyikan`; override "Terbitkan walaupun tidak memenuhi kontrak Simulasi" (audited, PIPE AC-07.5); a published paper is read-only with the "Salin set" message (PIPE AC-07.8); publish/unpublish flashes as in DISC §3.4.
- AC-R1-21.4 (P4) Given Kontrak Simulasi, then `Senarai Kontrak`, `Baharu` > "Kontrak Baharu" (`Subjek`, `Kertas`, `Cipta`; duplicate error "Kontrak untuk subjek/kertas ini sudah wujud."), editor fields in the order `Kod Kertas`, `Tempoh (minit)`, `Jumlah Markah`, `Sumber` (`Draf`, `Spec`, `Disahkan`), `Boleh tanda auto`, `Nota`, `Bahagian` table (`Tambah Bahagian`, `Label`, `Peraturan Pilihan` Tiada/Pilih N, `Markah`, `Arahan (opsyenal)`, `Mod Jawapan Dijangka`), `Simpan`; flashes "Kontrak dicipta.", "Kontrak dikemas kini.", "Kontrak dipadam."; warning "Kontrak dikongsi."; delete dialog "Padam kontrak ini?"; empty state "Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas." The V3 fields for exact unit quotas, TP profile and KBAT quota (PIPE AC-06.2) sit inside this editor.
- AC-R1-21.5 (P5) Given the Studio list and edit screen, then they offer the Panel's filters `Subjek`, `Status`, `Tahun`, `Negeri`, `Kertas`, `Jenis` (each "Semua ..."), `Tapis`, `Set Semula`, status tiles, columns `No.`, `Soalan`, `Tindakan`, row actions `Pratonton`, `Edit` / `Edit sebagai draf`, `Sembunyikan` (dialog "Arkibkan soalan ini?", `Batal` / `Sembunyikan`); the edit form edits nested sub-bahagian one level deep for all R1 modes (the Panel modal covers Kertas, Bahagian, Nombor soalan, Teks soalan (stem), Jenis rangsangan, Kapsyen (pilihan), Bab, Topik, Kesukaran, `Simpan`, `Tutup`); an out-of-scope question shows "Soalan ini di luar skop suntingan Panel — sunting di Studio penuh." only if V3 keeps a limited editor, else the full editor opens; status changes stay in the status bar (PIPE AC-02.3).
- AC-R1-21.6 (P6) Given Pembina Set (Set Builder), then title edit (flash "Set '{title}' telah dinamakan semula."), bank search ("Cari soalan…"; "Menunjukkan 150 teratas — tapis lagi untuk menyempitkan."; "Tiada soalan sepadan."), per Bahagian label, rule `Jawab Semua` / `Pilih N`, per question `Sunting` / `Buang`, chips `Disematkan` and `Tidak disajikan`, the contract panel with `Sunting kontrak`, and the warning "Set ini belum memenuhi kontrak penuh (K2 subjektif tiada)." exist as in DISC §3.4; `Lampir Kertas 2` / `Tanggalkan` are KIV (they need Kertas Subjektif documents) and are not shown.
- AC-R1-21.7 (P7) Given paper review, then `Sunting petikan` (`Tajuk petikan`) edits a stimulus title and `Bahan rujukan (kulit kertas)` offers `Tambah gambar`, `Tajuk panel`, `Buang panel` and up/down arrows (flash "Bahan rujukan kertas telah dikemas kini."); image upload for stems, options and stimuli is done in the Studio wizard (step "Rangsangan", editor button `Imej` "Muat naik imej") and uses the existing v2 upload; the Panel itself has no question upload or import and V3 adds none.

**Panel items not needed for R1**

| Panel item (V2 label) | Slice | Reason |
|---|---|---|
| `Tracking A` lane and `Set Tracking A` editor (`Isi set`, `tukar`, `buang`, `Simpan`) | R2 | Tracking A is 18 sessions in V2; PIPE US-09 |
| `Subjektif` lane and its editor (`/spm/subjektif/{question}/sunting`) | R2 | Subjektif SPM / Latihan Berstruktur are R2 |
| `Latih Tubi` lane, Quick Edit (`Buka editor penuh`) | R2 | Latih Tubi / Bab bridge upgrades are R2 |
| `Papan Pemuka` tiles | R2 | Discovery documents no Bijak-specific tile; needs a discovery addendum (OQ-3) |
| `Analitik` tiles (incl. `Laporan Soalan` tile) | R2 | School-scoped; the Bijak-related tile content is undocumented (OQ-3). Laporan Soalan triage itself is R1-18 |
| `Kertas Subjektif` lane, `Senarai Kertas`, `Lampir Kertas 2` | KIV | Flag OFF in V2; D80/D81 |
| `Tanda Karangan` | KIV | Only with the essay-grading flag; AI hidden (D73); PIPE AC-10.11 |
| `Pengguna`, `Sekolah` | KIV | User and school management are not Bijak content (D86 item 3) |
| Padlock behaviour for non-national roles | KIV | Admin Sekolah / PPD are KIV; R1 is Admin Pusat only |

## 5. Non-functional requirements

| Area | Requirement |
|---|---|
| Performance | PIPE section 7 (paper opens within 2 s p90 on mid-range phone on 4G; autosave under 500 ms p90). |
| Security | Answer keys and schemes never reach the page before reveal; self-mark owner-only and after submit; `Disahkan` Admin Pusat only; images of non-visible questions not loadable. |
| Accessibility | Replicates V2 (D10), no enhancements. |
| Localisation | All copy in Bahasa Melayu, verbatim from V2 where quoted; errors in plain BM. |
| Responsive | 375 / 768 / 1280px, no horizontal page scroll, 44px touch targets (PIPE US-17). |
| Privacy | No real names in docs, seeds or fixtures; test accounts fictitious. |

## 6. Scope

**R1 (in):** items R1-01 to R1-21 above.

**R2 (next, tagged R2 in PIPE):** Tracking A (incl. admin set editor, PIPE US-09); Mock Kertas 1 and 2 pool upgrades; Subjektif SPM and Latihan Berstruktur; Latih Tubi, Soalan by Chapter, Soalan Aku Salah and Remedial MCQ-bridge upgrades (image/stimulus/multi-part, T1-T5 random mode); practice-family display extension (PIPE AC-11.12, 12.2 to 12.6); CSV import; Heatmap Topik Lemah; the other Murid 1.0 modules (Dashboard incl. mood check-in, Headcount, Prestasi, Analitik Adaptif, Analisa Item, Video, Kelas Saya, Permainan data, Profil, Tetapan, Panduan) as parity audits list them.

**KIV:** Kertas Subjektif (flag OFF in V2; PIPE AC-14.3, 14.4, 14.8, 14.9-14.25), games changes (PIPE US-13), Kawalan Ciri (unless R1 finds a flag it needs), the 8 unused answer modes and 8 unused stimulus kinds, Pembetulan, Penguasaan, PKSK, Audio KBAT, Kiriman Guru, DOCX ZIP and BI Kertas 1 import, teacher and Admin Sekolah features, primary (Darjah), and everything else.

**Assumptions**
- AS-1 No V2 questions or images are copied (DEC-4); R1 content is created through the pipeline.
- AS-2 Where a V2 behaviour is unverified (B13, B18), the first AC of the item is a verification step, not an assumption.
- AS-3 Presentation follows the V3 design (D28c, D44); V2 behaviour and copy are the functional baseline.

## 7. Open questions

| # | Question | Blocks | Recommendation |
|---|---|---|---|
| OQ-1 | Dari mana data DSKP Tingkatan 1-5 datang (fail daripada pengguna, atau salinan V2 `archive_cloud` jika ada nod kurikulum)? V2 tiada skrin admin DSKP. | R1-12 (and so R1-13, R1-15, R1-16) | Guna fail berstruktur (CSV/JSON) yang dijalankan oleh operator, bukan skrin baharu. Minta pengguna sediakan sumber untuk subjek Bijak dahulu. |
| OQ-3 | Tile Papan Pemuka dan Analitik Panel yang berkaitan Bijak tidak didokumenkan dalam discovery. Perlu tambahan discovery? | None (R2) | Tangguh ke R2; satu sesi discovery baca-sahaja pada admin.prestasiplus.cloud untuk senaraikan tile sebelum R2. |
| OQ-2 | Stepper per-Bahagian (V2 `semak-bahagian`) wujud untuk Bahagian dokumen yang KIV. Adakah dibina juga untuk Bahagian biasa yang ada bajet markah? | R1-06.3 only (not blocking) | Bina hanya untuk Bahagian yang ditanda sebagai satu markah; jika tiada Bahagian sebegitu dalam kertas R1, AC ini dilangkau dan dicatat. |
