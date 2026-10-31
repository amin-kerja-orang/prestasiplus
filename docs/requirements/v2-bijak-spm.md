# v2 Bijak SPM: full-paper practice and exam simulation (merge of SPM Mock and Simulasi)

- **Slug:** `v2-bijak-spm`
- **Gate:** G1 (exam standard) passed 2026-10-29 with D76. **G2 passed 2026-10-29 (D78):** user approved the architecture and design of the exam standard (`../architecture/v2-bijak-spm-standards.md`, `../design/v2-bijak-spm-standards.md`) on their principle "tiru sistem lama dan berpandukan DSKP", "ikut standard peperiksaan". G2 decisions applied in place, each marked "(amended 2026-10-29, G2)": O-1 (primary unit per question), O-2 (a real/curated Kertas Pilihan is never blocked by quota, profile or KBAT; a mismatch flags the blueprint, AC-26.7), O-3 (cognitive level encoding; *amended 2026-10-30, KBAT reconciliation: superseded by the optional `kbat` of `v2-dskp-integration` A9*), O-4 (mixed order is best effort), O-5 (TP/KBAT conflict is a warning), O-6 (Admin Sekolah in Mod Pelajar follows the student rule), O-7 (layer-2 values prepared for Admin Pusat review, AC-40.7/39.9), O-8 (marks band per slot group, AC-34.9), O-9 (custom bounded solver, no external solver) and design D-1 to D-11.
- **Status:** Draft G1 (requirements only). The exam schema is derived and approved ([v2-exam-schema.md](v2-exam-schema.md), D47); the official LPM format / JSU is still not shared. 2026-10-29 update: US-34 to US-40 add "Jana Kertas follows the exam standard" (D75). **User answers of 2026-10-29 (D76) are applied:** Disahkan-only for students (Q-B14), KBAT = cognitive level Mengaplikasi/Menganalisis/Menilai/Mencipta per DSKP (Q-B18), exact topic quotas (Q-B15), verification by Admin Pusat against trial papers and skema from at least two bodies (Q-B13), TP and cognitive level per leaf part (Q-B19). Still open: Q-B16, Q-B17 (non-blocking), section 9.3. Q-B24 (exam-schema alignment) closed 2026-10-29. *(Amended 2026-10-30, KBAT reconciliation: KBAT is now the optional `kbat` tag of the approved `v2-dskp-integration` feature (decision A9): 'mengaplikasi' | 'menganalisis' | 'menilai' | 'mencipta' | none (Bukan KBAT), optional, independent of TP, never a publish gate; this is consistent with D76 because the four levels are the DSKP's KBAT. The 1-to-6 "cognitive level" field is withdrawn. Architecture decisions R-1 to R-6: `../architecture/v2-bijak-spm-standards.md` section 14. New stories US-41 and US-42 make question intake DSKP-aware, and need the `v2-dskp-integration` branch (dependency B13).)*
- **Date:** 2026-10-29 (created 2026-10-16)
- **Owner:** product-analyst
- **Decisions applied:** D24, D28(c)(e), D29(a)(b)(c), D30, D31(c), D32(a), D33(b), D35, D39, D40, D41, D43 (Murid matrix row 13 "SPM" in scope; Guru and Admin Sekolah have no SPM row), D75 (2026-10-29: follow the SPM exam standard; launch subjects = those with material), D76 (2026-10-29: user answers to the exam-standard questions), D78 (2026-10-29: G2 approval and the decisions above). D22 (no generated media) and the privacy rule apply to all seeds and samples.
- **Evidence:** the .cloud behaviour is documented, with `path:line`, in [../discovery/BIJAK-SPM-cloud.md](../discovery/BIJAK-SPM-cloud.md) (cited as **DISC §x** and defect ids **N-xx**). The exam-standard rules (US-34 to US-40) rest on [../discovery/SPM-paper-patterns.md](../discovery/SPM-paper-patterns.md) (cited as **SPP §x**; 2025 state-body trial papers, observed vs inferred marked there). Prior findings: [v2-question-bank-oldsystem-findings.md](v2-question-bank-oldsystem-findings.md) (**QBF A-D**). Bank contract: [v2-question-bank.md](v2-question-bank.md) (**QB US-xx / AC-xx**). Display design: [../design/v2-question-bank.md](../design/v2-question-bank.md) (S1-S6, P1-P2).
- **Placeholders:** **[SKEMA]** = waits for the user's exam schema / LPM format. **[Default]** = proposal to tune in the pilot. **[PROPOSED]** = new BM copy, not observed in .cloud. BM copy without a tag is quoted from .cloud code.

## 1. Summary and goal

**Problem.** .cloud has the only full-paper simulation (`/simulasi`) and it is the biggest student-facing feature that the prototype lacks, but it has four names, two admin surfaces, a flat random generator that ignores its own blueprint, a submit/autosave race, an unanswerable answer mode and an answer-key oracle (DISC §8, N-01..N-21). The old .my "SPM Mock" is a separate, weaker lane (DISC §9). D32 merges them.

**Goal.** One student feature, **Bijak SPM**, with two starts and two modes, fed by the one Bank Soalan v2 and governed by one **Kontrak Blueprint**:

```
Bijak SPM
 |- Start 1  Kertas Pilihan  = a published, admin-curated real-format paper (.cloud /simulasi)
 |- Start 2  Jana Kertas     = a paper generated for the student from the bank UNDER the Kontrak Blueprint
 |                             (replaces .my/.cloud /spm-mock; same section structure as a real paper)
 '- Mode A   Mod Peperiksaan = timed, sections, no instant mark, one Hantar, then Semakan   [name PROPOSED]
    Mode B   Mod Latihan     = untimed or count-up, per-question Semak with instant feedback [name PROPOSED]
```

**Success measures [Default].**

| Measure | Target |
|---|---|
| Answers lost between last keystroke and grading (any cause) | 0 in the acceptance suite; <= 1 s of typing on a hard crash |
| Papers published without an answer key / mark scheme on every leaf part | 0 (hard gate, no bypass) |
| Generated papers (Jana Kertas) that fail their own blueprint | 0 |
| Generated papers whose marks, topic quota, TP profile or KBAT quota differ from their blueprint | 0 |
| Published papers whose questions of one stimulus group are split or reordered | 0 |
| Submitted attempts missing from the student's history and teacher analytics | 0 (all paper kinds) |
| Answer keys readable by a student before submit (page source, network, API) | 0 |

## 2. Users and personas

Roles follow .cloud (D31). Role access is taken from `docs/requirements/role-access-matrix.md` (D43) and the portals doc.

| Persona | Role code | Bijak SPM rights in v2.0 | Basis |
|---|---|---|---|
| **Murid** (SPM 2027 candidate, mostly on a phone) | `pelajar` | Everything in section 4 "Student". | Matrix row 13 "SPM": Murid only |
| **Admin Pusat** | `admin` (national) | Everything in "Admin": assemble, configure blueprint, approve and publish, preview as student, analytics, marks-review queue. | D40(a); D30 (Kertas & SPM group is Pusat only) |
| **Admin Pusat / Admin Sekolah in Mod Pelajar** | `admin`, `admin_sekolah` | May use the student Bijak SPM **as themselves** to test; data is flagged as test data and excluded from analytics, history ranking and rewards. | D31(c), D33(b) |
| **Guru** | `guru` | **No Bijak SPM screen** (matrix has no SPM row for Guru). Sees outcomes only through existing Guru modules (Prestasi, Analitik, Analisa Item, Monitoring) fed by US-33. Confirming AI-proposed essay marks for own students (D32b) is a later Guru surface: out of the D43 prototype, data contract provided by US-31. | D43, D32(b) |
| **Admin Sekolah** | `admin_sekolah` | No Bijak SPM screen; school analytics via existing modules (US-33). No bank or paper access. | D40(a), D43 |
| **Pegawai PPD / JPN** | `pegawai_ppd` | None. | D30, D40(a) |
| Ibu bapa, Penaja | | None. | D43 |
| System (marking service) | n/a | Proposes marks with confidence; never approves. | D41, QB US-05 |

## 3. User stories

Priority: M Must, S Should, C Could, W Won't (v2.0).

### Student

| ID | P | Story |
|---|---|---|
| US-01 | M | As a Murid, I want one Bijak SPM entry with two starts, "Kertas Pilihan" and "Jana Kertas", so that I find full-paper practice in one place. |
| US-02 | M | As a Murid, I want to browse published papers by subject and paper (kertas) and see my status on each, so that I pick what to sit next. |
| US-03 | M | As a Murid, I want the system to generate a paper for a subject that follows the real paper structure, so that I can practise a fresh paper at any time. |
| US-04 | M | As a Murid, I want to choose Exam mode or Practice mode and read the cover, instructions and formula sheet before I start. |
| US-05 | M | As a Murid, I want a visible timer with a five-minute warning and a fair automatic end, so that I train time management without losing work. |
| US-06 | M | As a Murid, I want sections ("Bahagian") with "Jawab N daripada M" rules, so that the paper behaves like the real one. |
| US-07 | M | As a Murid, I want questions that share a diagram or passage to stay together with that stimulus pinned while I answer. |
| US-08 | M | As a Murid, I want the right answer control for each question type (choice, short text, number with unit, working + final answer, essay with word count, table, gaps, ordering, graph, drawing, code). |
| US-09 | M | As a Murid, I want an easy way to enter maths answers and working (steps, maths keyboard, final answer, photo of working). |
| US-10 | M | As a Murid, I want to see which questions I answered, flagged or skipped, jump between them and move next/previous. |
| US-11 | M | As a Murid, I want my answers saved continuously, even with a poor connection, so that nothing is lost. |
| US-12 | M | As a Murid, I want to resume an unfinished sitting or start over, with a clear choice. |
| US-13 | M | As a Murid, I want to submit with a clear check of what is unanswered, and be sure everything I typed is graded. |
| US-14 | M | As a Murid, I want a result that shows marks per section, per question and per marking point, and tells me what is still waiting for a human. |
| US-15 | M | As a Murid, I want the mark scheme revealed only when it is fair (after Hantar in Exam mode; after Semak in Practice mode). |
| US-16 | S | As a Murid, I want to adjust my own mark within the allowed range and flag a mark I disagree with. |
| US-17 | M | As a Murid, I want "Cuba Lagi" to start a fresh sitting (same paper, or a newly generated one) without destroying earlier results. |
| US-18 | M | As a Murid, I want a history of all my Bijak SPM sittings with scores, and to reopen any Semakan. |
| US-19 | S | As a Murid, I want to report a wrong question from Practice mode or Semakan. |
| US-20 | S | As a Murid, I want syiling and XP for marks earned, so that Bijak SPM counts toward my streak and rewards. |
| US-21 | C | As a Murid, I want a weak-topic summary on the result, so that I know what to revise (the .my Mock result had it; .cloud Simulasi does not). |

### Admin (Portal Pentadbiran, Admin Pusat)

| ID | P | Story |
|---|---|---|
| US-22 | M | As Admin Pusat, I want one list of Bijak SPM papers with status and what needs attention. |
| US-23 | M | As Admin Pusat, I want to assemble a paper from the one bank, section by section, with stimulus groups kept intact. |
| US-24 | M | As Admin Pusat, I want to edit a draft paper's details: title, duration, cover code, instructions, section text, reference sheet. |
| US-25 | M | As Admin Pusat, I want to manage the Kontrak Blueprint per subject and paper as data. |
| US-26 | M | As Admin Pusat, I want publish gates that cannot be bypassed, including a mandatory answer key / mark scheme. |
| US-27 | M | As Admin Pusat, I want to withdraw, copy-to-edit and version a published paper without harming past sittings. |
| US-28 | M | As Admin Pusat, I want to preview a paper exactly as a student sees it (Mod Pelajar), including drafts. |
| US-29 | S | As Admin Pusat, I want to preview the question pool behind Jana Kertas and generate a draft paper from the blueprint. |
| US-30 | S | As Admin Pusat, I want per-paper analytics (attempts, scores, question difficulty, blank rate). |
| US-31 | S | As Admin Pusat, I want a queue of marks that need a human (low confidence, essays) to confirm or adjust. |
| US-32 | M | As Admin Pusat, I want access limited to my role and every change audited. |

### System

| ID | P | Story |
|---|---|---|
| US-33 | M | As the platform, every submitted and every marked sitting (all paper kinds, both starts) must produce one attempt record and one analytics aggregate, so that student history, Guru modules and rewards are complete. |

### Exam standard for Jana Kertas (added 2026-10-29, D75; evidence SPP)

| ID | P | Story |
|---|---|---|
| US-34 | M | As a Murid, I want a generated paper to follow the exam standard of its subject and kertas, so that practising it is a fair rehearsal of the real paper. Here: section and total marks equal the blueprint exactly. (US-35 to US-37 cover difficulty, topic and KBAT.) |
| US-35 | M | As a Murid, I want the questions of a generated paper ordered and picked by the difficulty profile of that paper (ladder by question number, by Bahagian, or by theme block), so that the easy-to-hard feel matches the real paper. |
| US-36 | M | As a Murid, I want the topics of a generated paper to follow the paper's topic quota (JSU), including the Tingkatan 4 : 5 share, in a mixed (non-chapter) order, so that I am not surprised by topic balance on exam day. |
| US-37 | M | As a Murid, I want the amount of higher-order (KBAT) marks to follow the paper's KBAT quota, so that a generated paper is neither easier nor harder than the real one. |
| US-38 | M | As Admin Pusat, I want only fully tagged questions (unit or form origin, TP, marks) to enter the Jana Kertas pool, and the sub-part order checked at bank review, so that the generator can honour the blueprint. |
| US-39 | M | As Admin Pusat, I want a blueprint to become "Disahkan" only with the topic quota, difficulty profile and a recorded verifier, so that students only get generated papers built on a verified standard. |
| US-40 | M | As Admin Pusat, I want launch blueprints for the papers we have study material for, seeded as "Spec" from the discovery document, so that Jana Kertas can be tested at once and verified later. |
| US-41 | M | (Added 2026-10-30, task BJS-17.) As the person who reviews an uploaded paper in question intake, I want to set unit, TP and KBAT per part (optional) in the intake tag editor, so that a multi-topic or mixed-difficulty question is tagged as the exam standard needs. |
| US-42 | M | (Added 2026-10-30, task BJS-18.) As the person who uploads a paper, I want the AI extractor to know the DSKP, so that it suggests unit, TP and KBAT for each part and I only confirm or fix them. |

## 4. Acceptance criteria

### Student

**US-01 Entry and starts**
- AC-01.1 Given I am a Murid, when I open the SPM section, then one card/entry named "Bijak SPM" is shown with the subtitle "Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema." (.cloud copy), and no other entry named "Simulasi Peperiksaan", "SPM Mock Exam" or "Kuiz" exists for the same function.
- AC-01.2 Given I open Bijak SPM, then I can choose "Kertas Pilihan" or "Jana Kertas" in one tap each; the page works at 375, 768 and 1280 px with no horizontal scroll.
- AC-01.3 Given no paper is published for any subject, then "Kertas Pilihan" shows the empty state "Tiada kertas tersedia buat masa ini" with "Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi." and "Jana Kertas" still works for subjects that have a confirmed blueprint and enough questions.
- AC-01.4 Given I am a Guru, Admin Sekolah, PPD/JPN or parent, when I request a Bijak SPM student route, then access is refused (403) and no attempt is created. (Fixes N-07.)

**US-02 Kertas Pilihan list**
- AC-02.1 Given published papers, then they are grouped by subject, each card shows the set label or title, "Kertas {k}", total marks (effective marks after choose-N, e.g. 100 not 310), duration in minutes, and my status: "Belum cuba", "Sedang dijawab" (with "Sambung"), or my latest score "{s} / {m}".
- AC-02.2 Given filters subject and kertas, then the list narrows and the count shown equals the rows shown.
- AC-02.3 Given a draft or withdrawn paper, then it is absent from the list and its direct URL/ID returns "not found", including for the check/answer endpoints.
- AC-02.4 Given the library has more papers than one page, then pagination uses BM labels (D33).

**US-03 Jana Kertas**
- AC-03.1 Given I choose a subject and paper (kertas) that has a blueprint with source "Disahkan" (real students) or "Spec" (Admin Pusat in Mod Pelajar only, AC-39.6; Admin Sekolah in Mod Pelajar follows the student rule, Disahkan only), when I tap "Jana Kertas", then the system builds a paper with the blueprint's sections, selection rules, section mark budgets and total marks, drawn only from Terbit questions, and meeting US-34 to US-37. *(Amended 2026-10-29: was "Disahkan or Spec [SKEMA]"; the Disahkan-only rule is decided, Q-B14, D76.)*
- AC-03.2 Given a section of the blueprint cannot be filled from the Terbit pool, then no paper is created and I see which section is short ("{Bahagian}: perlu {n} soalan, hanya {m} tersedia" [PROPOSED]); the system never silently under-fills.
- AC-03.3 Given a generated paper, then no question appears twice, no stimulus group is split or reordered, every question has a servable answer key / mark scheme, and the subject matches.
- AC-03.4 Given I generate twice, then the two papers differ when the pool is larger than the paper; the exact questions served are recorded on my attempt (AC-33.2) so that Semakan never changes.
- AC-03.5 Given I have already sat questions in a previous generated paper, then the generator prefers unseen questions when the pool allows [Default], without failing when it does not.
- AC-03.6 Given a subject without a usable blueprint, then "Jana Kertas" is disabled for it with the reason "Belum ada kontrak untuk subjek dan kertas ini" [PROPOSED].

**US-04 Mode, cover, instructions**
- AC-04.1 Given I pick a paper or a generated paper, then before starting I see the cover: paper code ([SKEMA] e.g. "1449/1"), subject, "Kertas {k}", "{d} minit" (when set), numbered instructions, and the reference sheet panels (formula sheet, constants, tables) when the paper declares them, open by default and foldable.
- AC-04.2 Given the mode choice, then "Mod Peperiksaan" states: timed, no instant marks, mark scheme after Hantar; "Mod Latihan" states: one question at a time with "Semak" and instant feedback. Both modes are offered for both starts [Default].
- AC-04.3 Given Mod Latihan, then a timer is optional: counts up (shown as "Masa") and never ends the sitting.

**US-05 Timer**
- AC-05.1 Given a paper with duration D in Exam mode, when I start, then the server stores `started_at` and `deadline = started_at + D`; the countdown is computed from server time (clock offset corrected on load and on resume), not from the device clock alone.
- AC-05.2 Given remaining time reaches 5 minutes, then a banner "Amaran: masa berbaki kurang 5 minit." appears once and does not cover the answer area.
- AC-05.3 Given remaining time reaches 0 with the page open, then the sitting is submitted automatically without a confirmation, using the full local answer set (AC-13.2).
- AC-05.4 Given the page is closed or offline at the deadline, when the deadline plus a grace period [Default 5 min] passes, then the server closes the attempt itself from the last saved answers and marks it "Dihantar automatik"; answers synced later from the device with a save time at or before the deadline are still accepted and graded [Default window 24 h]. (Fixes N-08, N-17.)
- AC-05.5 Given a late submit, then it is accepted, graded and recorded with `late_by_seconds`; work is never discarded because of clock drift.
- AC-05.6 Given a paper without a duration, then the clock counts up and no deadline exists; a Kertas Pilihan whose blueprint is "Disahkan" cannot be published without a duration (US-26).
- AC-05.7 Given Mod Latihan, then there is no deadline.

**US-06 Sections and choose-N**
- AC-06.1 Given a section, then its header shows its label, "[{n} markah]" (effective marks) and its rule line: the authored instruction, else "Jawab semua soalan." or "Jawab {N} daripada {M} soalan" [PROPOSED; .cloud: "Jawab {n} soalan sahaja."].
- AC-06.2 Given a choose-N section, then a counter "{c} / {N} soalan dipilih" is shown; I can mark a question as chosen; when N are chosen the remaining questions are visibly dimmed but not hidden.
- AC-06.3 Given I answer more than N questions in a choose-N section, then scoring uses the best N attempted by marks (ties: lower question position) and the Semakan states which questions counted. The tick state never changes the score.
- AC-06.4 Given a section transition, then the next section's header and instruction are shown before its first question.
- AC-06.5 Given the total shown, then it equals the sum of the questions' marks after the choose-N reduction and equals the denominator of the result.

**US-07 Stimulus groups**
- AC-07.1 Given questions that share a stimulus (D41), then they are shown as one group in published order; the stimulus is shown once and is reachable in one action while I answer any question of the group (side panel at >= 1280 px; bottom sheet at 375/768, answers preserved) — per design S3.
- AC-07.2 Given a group heading, then every dependent question shows "Soalan {a}-{b} berdasarkan teks di atas" [PROPOSED; wording from design S3 in the bank design doc].
- AC-07.3 Given Jana Kertas or any assembly, then a group is included whole or not at all and keeps its order.
- AC-07.4 Given a stimulus whose file fails to load, then the question shows "Rajah tidak dapat dimuatkan." with "Cuba lagi" and "Lapor"; "Seterusnya"/"Semak" stay available only where the question does not need the stimulus [SKEMA].
- AC-07.5 Given a stimulus of kind passage, table, diagram, image, graph, math, code or audio, then it renders per bank AC-24.x; audio respects a maximum number of plays when set.

**US-08 Answer controls**
- AC-08.1 Given each answer mode in [SKEMA] (at minimum those of DISC §3.3: MCQ, short text, numeric, numbered list, extended essay, essay with topic choice, working + final answer, table fill, gap match, cloze, ordering, graph plot, draw on diagram, code), then a working control exists and a saved answer is restored identically after reload and on another device.
- AC-08.2 Given an essay, then a live counter "{w} patah perkataan" shows, plus "sasaran {min}–{max}" when the question defines a range, and signals over/under without blocking input.
- AC-08.3 Given an ordering (sequence) question, then I can reorder with touch drag **and** with explicit move up/down controls usable by keyboard; the order is saved and graded. (Fixes N-02.)
- AC-08.4 Given an answer mode that has no working student control in the build, then a paper using it cannot be published (US-26 gate).
- AC-08.5 Given an MCQ, then my choice is stored by option identity, not by letter, so reshuffled options cannot change its meaning.
- AC-08.6 Given graph, drawing and code answers, then they are saved as structured data and are marked by self-mark or staff review; the UI says so ("dinilai sendiri") [PROPOSED].

**US-09 Maths answer input (D41)**
- AC-09.1 Given a maths part, then I can write step lines (one line per step) with a maths keyboard (fractions, powers, roots, subscripts, units, symbols), a separate "Jawapan akhir" box, and a unit field when the part defines a unit.
- AC-09.2 Given I cannot type the working, then I can attach a photo of my working (JPG/PNG, <= [Default 5 MB], up to [Default 3] per part); the photo is stored privately, shown to me in Semakan, and marked by self-mark or staff review (no automatic handwriting recognition).
- AC-09.3 Given plain-text entry like `1/2`, `x^2`, `√3`, the input accepts it and converts to the structured form without losing what I typed.
- AC-09.4 Given the maths keyboard at 375 px, then it does not cover the question or final-answer box (the field scrolls into view) and keys are >= 44 px.
- AC-09.5 Given the answer is saved, then both the structured and plain-text forms are stored so marking and staff review can read either.

**US-10 Navigation**
- AC-10.1 Given the question map, then each question shows one of: "Dijawab", "Ditanda", "Belum"; counts equal the number of questions; tapping a dot goes to that question or its stimulus group.
- AC-10.2 Given I flag a question ("Tanda soalan"), then the flag is saved with the attempt and shown in the map; flags never affect score.
- AC-10.3 Given "Sebelum"/"Seterusnya", then I move through questions in paper order across sections; the last step shows "Hantar".
- AC-10.4 Given a reload or resume, then I return to the question I was on.
- AC-10.5 Given 375 px, then the map opens as a sheet and the current question and its answer control remain visible without horizontal scroll.

**US-11 Autosave and offline tolerance**
- AC-11.1 Given I change an answer, then it is written to local storage on the device first, then sent to the server within [Default] 1 s of the last change (debounced), as an idempotent per-part update that cannot overwrite a newer saved version of the same part.
- AC-11.2 Given the save indicator, then it shows one of "Menyimpan…", "Disimpan", "Luar talian — jawapan disimpan pada peranti ini", "Gagal simpan — cuba lagi" [PROPOSED wording; .cloud: menyimpan…, disimpan, gagal simpan, luar talian].
- AC-11.3 Given I am offline for minutes and keep answering, when the connection returns (or the tab becomes visible, or every [Default 15 s] with back-off), then all queued changes are sent in order without my action and the indicator returns to "Disimpan".
- AC-11.4 Given the tab is hidden or closed, then pending changes are flushed with a beacon where available and remain in local storage otherwise; the next load of this attempt merges them.
- AC-11.5 Given I use a second device, then the newest saved version per part wins and the older device shows the update; no field is wiped by a partial payload.
- AC-11.6 Given a hard crash of the browser, then at most the last [Default 1 s] of typing is lost.
- AC-11.7 Given local storage is full or blocked, then I see a visible warning and the app keeps saving to the server.

**US-12 Resume**
- AC-12.1 Given an unsubmitted sitting older than [Default 60 s] exists, when I open the same paper, then I see "Percubaan belum dihantar" with "Anda mempunyai percubaan {title} yang masih berjalan.", the elapsed time as hours:minutes:seconds when >= 1 h, and two actions "Sambung — teruskan jawapan & masa sedia ada" and "Mula Semula — kosongkan jawapan & masa".
- AC-12.2 Given "Mula Semula", then a confirmation "Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?" appears; on confirm the old attempt is closed as "Ditinggalkan" and kept in my history; no hidden orphan remains in progress. (Fixes N-08.)
- AC-12.3 Given "Sambung", then answers and timer are exactly as saved on the server; remaining time never exceeds the original deadline.
- AC-12.4 Given a shared device and a different account, then the other account never sees my sitting.
- AC-12.5 Given a sitting still within its first [Default 60 s], when I reopen, then it resumes silently.

**US-13 Submit**
- AC-13.1 Given I tap "Hantar", then a dialog states how many questions are unanswered and flagged and asks "Hantar jawapan anda sekarang?"; I can go back to a listed question.
- AC-13.2 Given I confirm, then the submit request carries the complete local answer set and an idempotency key, and the server grades the **union of saved and submitted** answers; no answer typed before the tap may be missing from grading. (Fixes N-01.)
- AC-13.3 Given a double tap or a retried request, then exactly one submission is recorded and the result is the same.
- AC-13.4 Given I submit while offline, then I am told it will be sent when the connection returns, the attempt stays "Sedang dijawab" locally, and nothing is shown as final until the server accepts it.
- AC-13.5 Given the submission succeeds, then I land on this attempt's Semakan, not on a new blank sitting.
- AC-13.6 Given Mod Latihan, then there is no Hantar for the whole paper; "Selesai" ends the practice and shows the summary (US-14).

**US-14 Result**
- AC-14.1 Given a submitted Exam-mode sitting, then the Semakan shows: total "{s} / {m}", per-section "{s} / {m}", per-question "{s} / {m}", and per-part result chip "Betul / Separa / Salah / Belum dimarkah" [SKEMA states].
- AC-14.2 Given a structured part with marking points (K/N/P [SKEMA], D41), then each point is listed with hit/miss, marks for that point, and what in my answer matched, so I can see why I lost marks.
- AC-14.3 Given a part marked by the system with confidence below the High band, then it shows "Menunggu semakan" [PROPOSED] and counts per the Q-B3 default; the total shows "(sementara)" while any such mark exists.
- AC-14.4 Given a choose-N section, then the result lists the questions that counted.
- AC-14.5 Given the total, then it equals the sum of part marks after best-N reduction, and the denominator equals the recorded maximum of the composition I was served (never recomputed from later paper edits).
- AC-14.6 Given a paper with unmarked self-mark parts, then the total excludes them and says how many marks are still unclaimed.
- AC-14.7 Given the result screen at 375/768/1280 px, then no horizontal scroll and tables become cards.
- AC-14.8 Given the result, then no grade letter is shown unless the Q-B5 decision enables it (default: marks and percentage only).

**US-15 Scheme reveal**
- AC-15.1 Given Exam mode before Hantar, then no answer key, mark scheme, correct/incorrect state or running score appears anywhere (page, network response, local storage). Per-page instant marking does not exist (replicates W:1136-1138).
- AC-15.2 Given Exam mode after Hantar, then each part shows "Skema Pemarkahan · {n} markah" with the model answer / accepted answers (with tolerance and units) / marking points.
- AC-15.3 Given Mod Latihan, then the scheme of a question is revealed only after I tap "Semak" on it.
- AC-15.4 Given any mode, then a page-image or document scheme is revealed under the same rule (not before Hantar). (Fixes N-12.)
- AC-15.5 Given a direct request for a scheme or key of an unsubmitted question, then the server refuses.

**US-16 Self-mark and disagree**
- AC-16.1 Given a subjective part in Semakan, then I see "Markah kendiri:" with a stepper 0..part marks, "/ {marks}", pre-filled with the system suggestion; the server clamps to the range and I may revise at any time.
- AC-16.2 Given I change a mark, then the total updates on screen and in my history, and rewards follow US-20 (increase only).
- AC-16.3 Given a part with a band rubric, then selecting a band sets the stepper to the band midpoint and limits it to the band's range.
- AC-16.4 Given I disagree with a system mark, then "Mohon semakan guru" [PROPOSED] puts the part in the review queue (US-31) with my note (<= 300 characters).
- AC-16.5 Given a mark confirmed by staff, then it replaces the self-mark and I see "Disahkan" next to it.

**US-17 Retry**
- AC-17.1 Given Semakan, when I tap "Cuba Lagi", then a new sitting starts: Kertas Pilihan = same paper; Jana Kertas = a newly generated paper for the same subject and kertas (AC-03.5).
- AC-17.2 Given the new sitting, then previous attempts and their Semakan are unchanged and remain in history.
- AC-17.3 Given I already have an unsubmitted sitting for the paper, then "Cuba Lagi" asks me to resume or discard it first (AC-12.1).
- AC-17.4 Given no per-day limit is configured, then there is no limit; a configured limit shows a BM message with the time left [SKEMA/Default none].

**US-18 History**
- AC-18.1 Given "Sejarah Bijak SPM", then my attempts are listed newest first with date, subject, "Kertas {k}", start type (Kertas Pilihan / Jana Kertas), mode, status (Dijawab, Dihantar, Dihantar automatik, Ditinggalkan), score "{s} / {m}", and duration.
- AC-18.2 Given any submitted row, then it opens its Semakan exactly as submitted; an unsubmitted row offers "Sambung".
- AC-18.3 Given Mod Pelajar test data, then it never appears in a real student's or teacher's lists.
- AC-18.4 Given the shared SPM history, then Bijak SPM rows carry the label "Bijak SPM" (not "Tahun Lepas"). (Fixes N-10.)
- AC-18.5 Given summary tiles (sittings, average accuracy, syiling), then each equals the sum/average of the rows shown.

**US-19 Lapor Soalan**
- AC-19.1 Given Mod Latihan or Semakan, then "Lapor Soalan" is reachable from each question; the report links the question **and version** and follows the bank's flow (QB US-18).
- AC-19.2 Given Exam mode before Hantar, then the report action is deferred to Semakan so the timer is not affected (design Q-S5 default).

**US-20 Rewards**
- AC-20.1 Given a submitted sitting, then syiling and XP are credited once per attempt at the existing rates [Default 2 syiling and 10 XP per mark earned, as .cloud `PracticeRecorder`] using marks (not question counts) for every paper kind.
- AC-20.2 Given later mark increases, then only the positive difference is credited; decreases never claw back.
- AC-20.3 Given Mod Pelajar, then no rewards are credited.

**US-21 Weak topics (Could)**
- AC-21.1 Given a result, then topics (from question tags) where I lost the most marks are listed with a link to revise; if tags are missing it says so rather than guessing.

### Admin

**US-22 Paper list**
- AC-22.1 Given Admin Pusat in Kertas & SPM > Bijak SPM, then papers are listed (25/page) with title, subject, kertas, question count, marks, duration, status (Draf / Terbit / Dibatalkan terbit), kind (Disusun / Dijana), attention text, last change.
- AC-22.2 Given filters subject, kertas, status, search by title, then counts shown equal rows.
- AC-22.3 Given attention rules, then a published paper is flagged when it has zero questions, a question without an answer key, or a withdrawn question; the attention count on the hub equals the number of flagged rows (computed, not stored).
- AC-22.4 Given Admin Sekolah, PPD/JPN, Guru, Murid, then the menu entry is absent and a direct URL returns 403 without leaking content (D30; no "Admin Pusat sahaja" notice page).

**US-23 Assemble from the one bank**
- AC-23.1 Given "Kertas baharu", I choose subject and kertas, then sections are pre-created from the matching Kontrak Blueprint (label, instruction, rule, N, mark budget); without a blueprint I can still create a draft but cannot publish it as Kertas Pilihan (QB AC-12.3).
- AC-23.2 Given the bank picker, then only Terbit questions are offered, filterable by subject, level, chapter, topic, type, year, board/source, official-past-year flag; counts equal rows; duplicates by normalised content are collapsed with a count.
- AC-23.3 Given I add a question that belongs to a stimulus group, then the whole group is added together in order; removing one of its questions asks to remove the group or split it knowingly with a warning that blocks publish.
- AC-23.4 Given choose-N sections, then I set N and the picker shows "Pilih {N} daripada {M} soalan".
- AC-23.5 Given a paper stores references, then each is question id + version (QB AC-21.5); no question text is copied into the paper.
- AC-23.6 Given a question is withdrawn in the bank, then every draft paper using it shows a blocking warning; every published paper using it becomes "Perlu semakan" and stops being served until resolved (QB AC-14.2).
- AC-23.7 Given a section can be a native-question section only; page-image document sections are not offered in v2.0 (Won't, section 6).

**US-24 Edit details**
- AC-24.1 Given a draft paper, then I can edit title, duration, paper code, numbered cover instructions (one line = one instruction), section label, section instruction, selection rule and N, and the reference sheet panels (title + items: text with maths, or image, max 10 panels x 40 items).
- AC-24.2 Given a published paper, then these fields are read-only and the page offers "Salin untuk sunting" (draft copy); attempting a server-side edit returns a refusal "Kertas ini sudah diterbitkan…".
- AC-24.3 Given N exceeds the number of questions in the section, then save is refused with the allowed range.
- AC-24.4 Given a stimulus shared by another paper, when I edit it from this paper, then it is forked for this paper and I am told how many other papers share the original.

**US-25 Kontrak Blueprint**
- AC-25.1 Given Kertas & SPM > Kontrak Blueprint, then I can create one contract per subject x kertas (unique), with: paper code, duration, total marks, auto-markable flag, source status (Draf / Spec / Disahkan), notes, and ordered sections (label, instruction, rule, N, question count, mark budget, allowed answer modes) **and, per section (2026-10-29): difficulty profile kind and TP target per slot group (AC-35.1/35.2), optional per-slot marks (AC-34.3), topic quota lines and allowed units (AC-36.1/36.2), T4:T5 share (implied by the exact unit values, AC-36.3), KBAT quota (AC-37.1/37.2), and a "sub-bahagian menaik" flag (AC-38.4); per contract: verification record (AC-39.2)**. *Previously "[SKEMA: topic weighting, difficulty mix, cognitive level]": now partly answered by SPP (2025 trial papers); what stays open is widening the sample and an official LPM format / JSU (Q-B16); verification rule is AC-39.1/39.2 (Q-B13 decided).*
- AC-25.2 Given a banner, then it states that a contract is shared and changing it changes the publish gate and Jana Kertas for **all** papers of that subject x kertas.
- AC-25.3 Given I save a change, then a new contract version is stored; papers already published stay valid under the version they were published with (QB AC-28.2); the change is audited with the diff.
- AC-25.4 Given a contract, then allowed answer modes are shown with BM labels, never raw identifiers. (Fixes N-15.)
- AC-25.5 Given delete, then it is blocked while a Terbit paper depends on it, else confirmed with the impact count.
- AC-25.6 Given Jana Kertas, then it reads exactly this contract (QB AC-28.4); a contract in Draf status may generate only for Admin Pusat in Mod Pelajar, not for real students [Default]. (2026-10-29: the same now holds for "Spec", AC-39.6.) *(Amended 2026-10-29, G2: Admin Sekolah in Mod Pelajar is treated like a student, Disahkan only (O-6); the student never sees the blueprint's status, and Admin Pusat in Mod Pelajar sees a "Spec - ujian sahaja" badge [PROPOSED], design D-3.)*
- AC-25.7 Given I save a contract, then it is refused with every problem listed when: section mark budgets (after choose-N) do not add up to total marks; a section's question count is less than N; a slot group overlaps or leaves a slot uncovered; the quota values of a section do not add up exactly to the section's question count (or marks); a quota-bearing section's T4:T5 split implied by its unit values contradicts a stated paper-level split. (Applies to Draf, Spec and Disahkan alike.) *(Amended 2026-10-29, G2: a section with at least one quota line must add up; a section with zero lines is "incomplete" and can be saved (AC-35.1); the editor relies on an unsaved-changes guard for half-entered quotas. The refusals are arithmetic only: a KBAT quota above the section's offered marks is refused, but a KBAT quota that looks hard against the TP bands is only a warning, AC-37.5. A marks-basis quota in a choose-N section needs a defined offered-mark total, AC-36.1. Design D-7.)*
- AC-25.8 Given the contract editor, then the profile kind, quota units and KBAT basis are shown with BM labels, never raw identifiers (as AC-25.4): "Tangga mengikut nombor soalan", "Mengikut Bahagian", "Blok tema" [PROPOSED].

**US-26 Publish gates**
- AC-26.1 Given "Terbitkan" on a paper, then ALL of these must pass or the paper stays Draf and every failure is listed at once with the question number: (a) at least one question; (b) every question is Terbit and not withdrawn; (c) **every leaf part has an answer key / mark scheme with content** (QB AC-11.2; no bypass for single, paper-level or bulk publish); (d) MCQ shape: >= 2 options, exactly 1 correct; (e) marks: leaf marks >= 1 and parent marks consistent; (f) every answer mode used has a working student control; (g) every stimulus resolves; (h) no stimulus group is split or out of order; (i) choose-N: N <= questions in the section; (j) section totals > 0; (k) single subject; (l) duration present when the contract is "Disahkan".
- AC-26.2 Given the contract check, then a paper that does not match its contract (missing section, rule or N mismatch, marks budget, unexpected answer modes, section count) shows each gap; hard gaps (missing section, rule/N mismatch) block publish. *(Amended 2026-10-29, G2, O-2: this list is the **structural tier** only (sections, totals, rules, N, counts, groups, answer modes); standard-tier mismatches (topic quota, difficulty profile, KBAT) never block, see AC-26.7.)*
- AC-26.3 Given a hard gap, then Admin Pusat may publish anyway only by ticking "Terbitkan walaupun tidak memenuhi kontrak Simulasi" **and entering a reason** [Default; .cloud had no reason]; the paper shows a "Tidak memenuhi kontrak" badge and the audit entry lists the gaps and the reason. Completeness gates (a-j) can never be overridden.
- AC-26.7 (added 2026-10-29, G2, O-2) Given a hand-assembled or official-paper Kertas Pilihan (Terbitkan on a paper that was not generated), when its topic counts, TP per question or KBAT marks differ from its blueprint's quota, difficulty profile or KBAT quota, then publish is **not** blocked, no override tick and no reason are required, and the paper is served as it is (a real paper is the standard; an official paper is not wrong). Instead the **blueprint** is flagged "Blueprint perlu disemak" [PROPOSED] for Admin Pusat on the contract list and in the editor, listing each paper and each mismatch (what the paper has vs what the blueprint says). The flag is computed (not stored): it clears when the blueprint is changed so that the mismatch disappears or when the paper is withdrawn; it never changes the blueprint's status by itself and never stops Jana Kertas. The attention count on the hub includes flagged blueprints. Structural gaps keep AC-26.2/26.3 unchanged.
- AC-26.4 Given the gates run, then the result is the same from the paper screen, the bulk action and the API (single implementation).
- AC-26.5 Given publish succeeds, then the paper appears to students within [Default] 60 s, and the audit records user, time, version and contract version.
- AC-26.6 Given publish does not change any question's own status (QB lifecycle): approving a question is a separate decision. (Fixes N-20.)

**US-27 Withdraw, copy, version**
- AC-27.1 Given "Batal terbit", then the paper stops appearing in "Kertas Pilihan"; in-progress sittings may finish; submitted results stay; its questions stay Terbit (QB AC-12.4).
- AC-27.2 Given "Salin untuk sunting", then a deep draft copy (new paper id, same question references) opens; the original is unchanged until the copy is published; publishing a copy marks the original "Digantikan".
- AC-27.3 Given a composite paper is published, then adding/removing/reordering its questions is refused; changes go through a copy. (Fixes N-13.)
- AC-27.4 Given a student attempt made on version n, then its Semakan still shows version n's questions, keys and marks after n+1 is live (QB AC-13.3).

**US-28 Preview as student (Mod Pelajar)**
- AC-28.1 Given a paper (draft or published), then "Pratonton sebagai Pelajar" opens it in Mod Pelajar (new tab, persistent banner, "Keluar Mod Pelajar") as the admin's own account, not a real student (D31c).
- AC-28.2 Given the preview, then it uses the real student renderer, timer, autosave, submit and Semakan, so what the admin sees is what students get (one renderer).
- AC-28.3 Given attempts made in Mod Pelajar, then they are flagged test data, excluded from analytics, history ranking and rewards, and can be deleted by the admin.
- AC-28.4 Given Admin Sekolah in Mod Pelajar (D33b), then only Terbit papers are available; drafts are preview-only for Admin Pusat. *(Amended 2026-10-29, G2, O-6: for Jana Kertas, Admin Sekolah in Mod Pelajar follows the student rule, so only Disahkan blueprints; only Admin Pusat may test Spec.)*
- AC-28.5 Given PPD/JPN, Guru or Murid, then no preview action exists.

**US-29 Pool preview and draft generation**
- AC-29.1 Given a blueprint, then "Pratonton kolam" shows per section the count of Terbit questions that qualify, computed by the same query as Jana Kertas, and a link "Lihat soalan" to the bank prefiltered. Empty pool shows "Tiada soalan Terbit untuk tag ini" (not an error).
- AC-29.2 Given "Jana draf kertas", then a draft paper is created from the blueprint (same generator as AC-03.x) and opened for editing; it is never published automatically.
- AC-29.3 Given the shortfall rule, then an under-filled draw is refused with the real numbers (replicates the .cloud generator rule).
- AC-29.4 Given "Pratonton kolam" for a blueprint (2026-10-29), then besides the per-section count it shows, per section, a "needed / available" table for: each topic quota line (unit or T1-T3 bucket, AC-36.1), each TP target of the difficulty profile (per slot group, AC-35.2), and KBAT marks (AC-37.2), computed by the same query as Jana Kertas; every line short of its exact value is marked with text ("Kurang {n}") and not by colour alone, so Admin Pusat sees which unit (and which TP or KBAT line) is short. *(Amended 2026-10-29, G2, design D-6: the verdict (AC-29.5) is shown above the tables; the per-line figures are independent necessary counts, so every line can read "Cukup" while the verdict is "Tidak boleh dijana" because of combinations, and the screen then shows an explanatory line.)*
- AC-29.5 Given the same preview, then it shows a verdict "Boleh dijana" or "Tidak boleh dijana" from the same solver as Jana Kertas, the first failing constraint, and the count of Terbit questions excluded as ineligible with a breakdown (tiada unit, tiada TP, tiada markah, mod jawapan tidak dibenarkan, Perlu semakan tag; AC-38.2; amended 2026-10-30, KBAT reconciliation) linking to the bank prefiltered. Counts equal rows. *(Amended 2026-10-29, G2, design D-8: one question can fail several reasons, so the screen shows a unique total plus per-reason counts that may overlap, with a note; "mod jawapan tidak dibenarkan" exists only relative to a section, so it is shown only in the contract context.)*

**US-30 Analytics**
- AC-30.1 Given a published paper, then Admin Pusat sees: attempts started/submitted, mean and median score, score distribution, per-question facility (% full marks), blank rate, mean time, and choose-N pick frequency; test data excluded; all figures computed from attempt rows.
- AC-30.2 Given a question whose facility is below [Default 20%] or above [Default 95%] with >= [Default 30] attempts, then it is highlighted for review and links to the bank item.
- AC-30.3 Given export, then Admin Pusat only and logged.

**US-31 Marks-review queue**
- AC-31.1 Given system-marked parts with confidence below High and parts the student flagged "Mohon semakan guru", then they appear in a queue showing question, scheme, student answer (escaped), the per-point proposal, confidence, and a stepper to confirm or adjust within 0..marks.
- AC-31.2 Given a confirm, then the confirmed mark replaces the earlier mark, the student sees "Disahkan", totals and history update, and rewards credit only an increase.
- AC-31.3 Given Admin Pusat, then the queue covers all schools; scoping for Guru (own students) and Admin Sekolah (own school) is defined in the data contract but has no screen in v2.0 (D43).
- AC-31.4 Given a mark AI-proposed by an external service, then it never counts until a human confirms (replicates .cloud) unless the Q-B3 decision says otherwise.

**US-32 Access and audit**
- AC-32.1 Given any admin write route, then only Admin Pusat is allowed; a refused write returns 403 and changes nothing.
- AC-32.2 Given create, edit, add/remove question, publish, withdraw, copy, contract change, override, queue confirm, delete test data, then an audit entry records user, role, time, object, before/after, and reason where applicable; entries cannot be edited from the UI. (Closes the .cloud gaps in DISC §6.3.)

### System

**US-33 Attempt and analytics contract**
- AC-33.1 Given any sitting (both starts, both modes), then exactly one attempt record exists per sitting with: student, paper reference (paper id + version, or "generated" with the full composition), mode, start type, started/submitted/closed times, deadline, status, score, maximum, per-section scores, late flag, test-data flag.
- AC-33.2 Given an attempt, then the **served composition** (question ids + versions + marks + section rules) is frozen at start and is the sole basis for allowed answers, scoring and the denominator, whatever happens to the paper later.
- AC-33.3 Given per-part responses, then each stores the structured answer, plain text form, awarded marks, per-point results, mark source (auto / self / staff / system-proposed), confidence, and who changed it.
- AC-33.4 Given a submitted or later-marked attempt, then one aggregate (subject, units = marks, duration, start type) is written or updated idempotently for student history, Guru modules (Prestasi, Analitik, Analisa Item, Monitoring) and rewards, for **every** paper kind. (Fixes N-10.)
- AC-33.5 Given Mod Pelajar, then no aggregate is written.
- AC-33.6 Given migration (D29a), then old `exam_attempts` rows migrate as header-only history with their own subject/score snapshot; per-part responses are not migrated by default (`docs/architecture/v2-data-migration.md` §3.3).

### Exam standard for Jana Kertas (US-34 to US-40, added 2026-10-29)

**Terms used below** (business terms; field names stay with the architect, G2). Existing blueprint fields in `v2-exam-schema.md` D7 (`mark_budget`, `question_count`, `topic_weights`, `cognitive_mix`, `marks_per_question`) are the starting point and are extended here, not contradicted.

| Term | Meaning |
|---|---|
| Slot | A numbered position in a section ("Bahagian A, soalan 3"). A stimulus group occupies consecutive slots. |
| Slot group | One or more consecutive slots of a section that share one TP target. |
| Offered vs effective | *Offered* = every question printed on the paper. *Effective* = after choose-N (AC-06.5). **Marks totals are effective; topic and KBAT quotas count offered questions/marks** [Default, Q-B21], because the student's choice must not change the standard. |
| TP of a question | The highest TP among its leaf parts (TP is stored per leaf part, inheriting the question's; Q-B19, D76). KBAT is likewise optional per leaf part, inheriting the question's. |
| KBAT marks | Marks of leaf parts whose **effective `kbat`** (the part's own value, else the question's) is Mengaplikasi, Menganalisis, Menilai or Mencipta (the four thinking levels every DSKP extract defines as KBAT; Q-B18, D76). A part with no value, or "Bukan KBAT", counts 0. TP is **not** the KBAT measure. *(Amended 2026-10-30, KBAT reconciliation: was "cognitive level".)* |
| Quota line | A topic target: unit (or the bucket "T1-T3, luar DSKP") -> one **exact** number of questions or marks (Q-B15, D76). |

**US-34 Marks follow the blueprint**
- AC-34.1 Given a generated paper, when I inspect each section, then the sum of its effective marks equals that section's mark budget and the paper total equals the blueprint's total marks, with no tolerance. (Observed skeletons: SPP section 4.)
- AC-34.2 Given a choose-N section (N of M), then the paper has exactly M questions, all with the same marks, and that mark value times N equals the section's mark budget. (Every choose-N section observed is equal-mark, SPP section 4.)
- AC-34.3 Given a blueprint that sets marks for a slot (optional), then the question in that slot has exactly those marks; where no per-slot marks are set, only the section total is checked and question marks may differ within the section [Default, Q-B23: bodies differ on per-question marks, SPP 5.6]. *(Amended 2026-10-29, G2: per-slot exact marks are the special case of the marks band, AC-34.9, where minimum = maximum.)*
- AC-34.9 (added 2026-10-29, G2, O-8) Given a slot group, then the blueprint may set a marks band (minimum and maximum marks of a question in that group; minimum = maximum is exact), and every question placed in the group has marks inside it (for example a 15-mark question can never land in Matematik K2 Bahagian A, whose questions are 3-5 marks). The band values come from the real papers (SPP section 4 and the skema, SPP 10), "ikut standard peperiksaan", not from invention. A group without a band is constrained only by the section total (AC-34.1). A band whose minimum exceeds its maximum, or that cannot add up to the section's mark budget with the section's question count, is refused on save (AC-25.7). A shortage names the group: "{Bahagian} soalan {no}: tiada soalan layak dengan {a}-{b} markah" [PROPOSED].
- AC-34.4 Given no combination of eligible questions reaches a section's mark budget, then no paper is created and I see "{Bahagian}: tidak dapat menyusun {b} markah daripada soalan yang tersedia" [PROPOSED]; the system never serves a paper with a different total.
- AC-34.5 Given a generated paper, then question numbers run continuously across sections in the order and ranges of the blueprint (for example Q1-10, Q11-15, Q16-17), and sections appear in blueprint order.
- AC-34.6 Given the generator has composed a paper, then before serving it re-checks the composed paper against every constraint of AC-03.3 and US-34 to US-37 using the same rules as the publish contract check (AC-26.2); a paper that fails any check is never served and the failure is logged with the blueprint version.
- AC-34.7 Given a served paper, then its frozen composition (AC-33.2) also stores the blueprint version and, per section, the achieved effective marks, the TP of each slot, the unit count per quota line and the KBAT marks, so QA and Admin Pusat can compare them with the blueprint.
- AC-34.8 Given the constraints, then profile, quota, marks, structure, stimulus groups and eligibility are **hard**; "prefer unseen" (AC-03.5) and variety between papers (AC-03.4) are **soft** and never override a hard constraint.

**US-35 Difficulty profile**
- AC-35.1 Given a blueprint section, then it has exactly one profile kind: "Tangga mengikut nombor soalan" (ladder), "Mengikut Bahagian", or "Blok tema" [PROPOSED labels]. A section without a profile can be saved (Draf/Spec) but cannot be part of a Disahkan blueprint (AC-39.1).
- AC-35.2 Given a section, then its slots are covered by slot groups, each with a TP band (minimum and maximum, 1 to 6) and optionally an exact count per TP (for example "TP3 x 6, TP4 x 3"); a single-slot group is allowed. *(Amended 2026-10-29, G2: when any exact TP count is set, the counts must add up to the group's slot count, the TPs without a count inside the band counting as 0; a group may also carry the marks band of AC-34.9.)*
- AC-35.3 Given the ladder kind, then the bands of successive slot groups never decrease (neither minimum nor maximum), and in a generated paper every question's TP is inside the band of the slot it occupies, with counts per TP met where stated. Order inside a multi-slot group is not constrained. (SPP 5.1: Fizik K2 A is strict by slot; Matematik K1 SBP is a trend by bands of ten.)
- AC-35.4 Given the "Mengikut Bahagian" kind, then each section has one band (and optional counts per TP) and every question of the section is inside it; the order of questions inside the section is not required to be sorted by TP. (SPP 5.1: Matematik K2, Matematik Tambahan, Geografi K2.)
- AC-35.5 Given the "Blok tema" kind (Should; no launch blueprint uses it, first user is Geografi K1; *amended 2026-10-29, G2, design D-9: the option is hidden in the editor until it is built, with the first user*), then slots are grouped into ordered theme blocks, each with a unit set and a TP mix; blocks appear in blueprint order and the questions inside a block are not sorted by TP.
- AC-35.6 Given a stimulus group that spans slots, then each member's TP is inside the band of the slot it occupies.
- AC-35.7 Given a choose-N section, then all its questions share one slot group (the alternatives are of the same demand).
- AC-35.8 Given no eligible question exists for a slot group, then no paper is created and I see "{Bahagian} soalan {no}: tiada soalan layak pada TP {a}-{b}" [PROPOSED].
- AC-35.9 Given a sample of 30 generated papers for a blueprint, then in each the TP of every slot is inside its band (0 violations).

**US-36 Topic quota (JSU)**
- AC-36.1 Given a blueprint section, then it has quota lines: unit code (or the bucket "T1-T3, luar DSKP" for questions with `form_origin` T1-T3 and no unit, per `v2-exam-schema.md` D9 and Q-S2) -> one exact value, counted in questions or in marks (chosen per section; default questions for objective sections, marks for structured sections). The two bodies differ per unit, so the blueprint author sets one value per unit; the study's ranges (SPP section 6) are guidance for choosing it. *(Amended 2026-10-29, G2: **O-1** a question counts for a quota line by its **primary unit** (one per question); on a marks basis all marks of the question go to that unit, and a multi-topic question (for example Matematik K2 Bahagian C) is mapped by the seed author to one unit with a note. Sejarah is keyed at Tajuk level, so SPP 6.4 SK rows are aggregated to Tajuk and an ambiguous 20-mark question ("13.2 or 14.1") needs an author decision. **D-7** In a choose-N section the marks basis is allowed only when the offered-mark total is defined (equal-mark derivation: budget / N x M, or exact per-slot marks); otherwise the editor refuses it and the author counts in questions.)*
- AC-36.2 Given a section with quota lines, then a question whose unit has no line in that section is never picked for it. (This is how "Bahagian C = the four elective units" of Matematik Tambahan K2 is expressed, SPP 5.5.)
- AC-36.3 Given an optional T4:T5 share on a section or on the paper (an exact figure; T1-T3 bucket excluded from the denominator [Default]), then it must equal the split implied by the exact unit values (AC-25.7) and a generated paper meets it exactly. With unit values set, the share needs no separate input. (Guidance, SPP 5.5: Matematik K2 about 52-56 : 44-48, Matematik Tambahan K2 about 53-58 : 42-47, Fizik K2 36 : 64.)
- AC-36.4 Given a generated paper, then for each quota line the offered count (or marks) equals the line's exact value, with 0 violations in a sample of 30 papers; otherwise no paper is created (AC-36.7).
- AC-36.5 Given a question with `form_origin` T1-T3 and no unit, then it is eligible only for sections that have a "T1-T3, luar DSKP" line with a value above 0, and counts against that line only.
- AC-36.6 Given a section with at least 4 different units, then across a sample of 30 generated papers the sequence of unit codes follows DSKP chapter order in at most 1 paper, and in a section containing both T4 and T5 questions at least 29 papers show them interleaved (not all T4 before all T5) [Default; replicates SPP 5.5 "no chapter order"]. *(Amended 2026-10-29, G2, O-4: **best effort, never a reason to refuse.** The chapter-order check applies to sections with free order and at least 4 distinct units; the T4/T5 block check applies only when the section has at least 2 T4 and at least 2 T5 questions; ladder sections, where TP bands fix the order, are excluded. The generator reshuffles free positions up to 25 tries and otherwise keeps the last order. This AC is a generator statistic test, not a screen test.)*
- AC-36.7 Given a quota line that cannot be met, then no paper is created and I see "{Bahagian}: perlu {n} soalan {unit}, hanya {m} tersedia" [PROPOSED] (marks wording: "perlu {n} markah"). *(Amended 2026-10-29, G2, design D-11: shortage lines for a student keep the DSKP unit labels and TP ranges as worded in these ACs, capped at 5 lines with "Tunjuk {n} lagi" [PROPOSED]; revisit with pilot feedback.)*
- AC-36.8 Given the T4:T5 share cannot be met, then no paper is created and I see "{Bahagian}: nisbah Tingkatan 4 : 5 tidak dapat dipenuhi daripada soalan yang tersedia" [PROPOSED].

**US-37 KBAT quota**
- AC-37.1 Given KBAT, then a leaf part is KBAT when its **effective `kbat`** is Mengaplikasi, Menganalisis, Menilai or Mencipta (DSKP definition, Q-B18, D76); the effective value is the part's own `kbat` when set, else the question's; no value or "Bukan KBAT" is not KBAT. `kbat` is optional, independent of TP, not attached to SP codes, and never a submit or publish gate. There is no per-blueprint TP threshold. *(Amended 2026-10-30, KBAT reconciliation: replaces the G2 O-3 wording "cognitive level 1 to 6, KBAT = 3 to 6". Migrated legacy "MOTS/HOTS" numbers are copied into `kbat` only for dev/seed rows and must be confirmed at bank review before they count for seeds.)*
- AC-37.2 Given a blueprint section, then it has a KBAT quota: an exact number of marks of KBAT leaf parts, counted on offered marks; 0 is allowed; a paper-level KBAT quota is optional. Because Mengaplikasi counts, shares measured on this basis are higher than the study's S4 shares (SPP 5.4); seeds are re-measured (AC-40.2). *(Amended 2026-10-30, KBAT reconciliation: KBAT marks = marks of leaf parts whose effective `kbat` is a level (AC-37.1); a question with no `kbat` contributes 0 and is not ineligible.)*
- AC-37.3 Given a generated paper, then the KBAT marks of each section (and of the paper, when set) equal their quota exactly, with 0 violations in a sample of 30 papers.
- AC-37.4 Given a KBAT quota that cannot be met, then no paper is created and I see "{Bahagian}: perlu {n} markah KBAT, hanya {m} tersedia" [PROPOSED].
- AC-37.5 Given a section whose KBAT quota is incompatible with its other constraints (more KBAT marks than the section's marks, or a KBAT quota that contradicts a TP band of the profile, for example all slots in a TP1-2 band with KBAT above 0), then the contract is refused on save with the conflict named (extends AC-25.7). *(Amended 2026-10-29, G2, O-5: only the arithmetic case (KBAT marks above the section's offered marks) is refused. A KBAT quota above 0 while every TP band of the section has maximum 1-2 is a **warning** `KBAT_TP_BAND` shown in the editor and the preview, not a save refusal, because TP and `kbat` are independent stored fields (amended 2026-10-30, KBAT reconciliation) and satisfiability depends on the pool.)* TP stays the difficulty and profile measure (US-35) and is independent of KBAT.

**US-38 Eligibility and bank-review dependency**
- AC-38.1 Given a Terbit question, then it enters the Jana Kertas pool only if: (a) it has a unit code, or `form_origin` T1-T3 with no unit; (b) every leaf part has a TP (inherited from the question when not set separately, Q-B19); (c) every leaf part has marks of at least 1; (d) it has its answer key (AC-03.3) and (e) its answer modes are allowed by the target section; (f) its tag is trusted: `tag_review` is false (not "Perlu semakan tag"). *(Amended 2026-10-30, KBAT reconciliation: "cognitive level required" is dropped; KBAT is optional, a null `kbat` counts as Bukan KBAT, and there is no KBAT gate. Eligibility = unit or T1-T3 bucket, TP, marks, key, allowed mode and `tag_review` false.)*
- AC-38.2 Given Terbit questions that fail AC-38.1, then they are never served by Jana Kertas and are counted in "Pratonton kolam" with the reason (tiada unit, tiada TP, tiada markah, mod jawapan tidak dibenarkan, Perlu semakan tag) (AC-29.5). *(Amended 2026-10-30, KBAT reconciliation: "tiada tahap kognitif" removed; "Perlu semakan tag" added, existing copy from `v2-dskp-integration`, with a link to the bank filter of that name.)*
- AC-38.3 Given a thin pool because of ineligible questions, then the shortage message states real numbers of eligible questions (AC-34.4, AC-35.8, AC-36.7), never the raw Terbit count.
- AC-38.4 Given a subject whose pattern is a sub-part ramp (blueprint flag "sub-bahagian menaik"; observed strictly in Sejarah K2 and Geografi K2, mostly in Fizik K2, not strictly in Matematik/Matematik Tambahan, SPP 5.2), then **the bank review checklist** (owned by `v2-question-bank.md`, dependency B10 in section 8.1) asks the reviewer to confirm that the leaf parts of a multi-part question run from lower to higher demand (and, where the subject's marks signal difficulty, that marks do not fall at the last part). The result is a review flag, not a publish gate, and Jana Kertas does not re-check it. For Matematik and Matematik Tambahan "Tunjukkan bahawa ... Seterusnya ..." chains are not flagged for being non-monotone.

**US-39 "Disahkan" gate**
- AC-39.1 Given a blueprint in Spec, when Admin Pusat sets it to Disahkan, then all of these must hold or it stays Spec and every failure is listed at once: (a) total marks, duration, sections, rules, N, question counts and mark budgets are set and consistent (AC-25.7); (b) every section has a difficulty profile covering every slot (AC-35.1/35.2); (c) every section has quota lines (AC-36.1), and a T4:T5 share where the subject has both levels in the DSKP; (d) a KBAT quota per section, where 0 counts as filled; (e) the verification record is complete (AC-39.2) and the evidence check passes (AC-39.7); (f) the seeded quota and KBAT values are marked reviewed by Admin Pusat (AC-39.9). *(Amended 2026-10-29, G2: the T4:T5 share implied by the exact unit values satisfies (c); "Sahkan" is never disabled silently: it shows the reason next to it and the server re-checks with the full failure list (design D-10).)*
- AC-39.2 Given the verification record, then it holds: verifier (user and role), date, and evidence, being **trial papers and their skema jawapan from at least two bodies** (per body: body, year, paper code, and the values read: Bahagian marks, "Jawab" rules, question counts, total marks, duration), or an LPM format / JSU document; plus a note. It is shown on the contract, is read-only after saving and is audited (AC-32.2). *(Amended 2026-10-29, G2, design D-4/D-5: a body counts towards "at least two" only when its skema is recorded as present (or it is an LPM format / JSU document) and the gate needs both a paper item and a skema item per body, not a skema for every value; seeded study rows do not count until the verifier edits them; there is no "copy from contract" shortcut in the evidence form; evidence is locked after Sahkan and a new Spec version starts with an editable copy while the earlier record stays in history.)*
- AC-39.3 Given verification (Q-B13, D76), then only Admin Pusat may verify; any other role is refused with 403 and nothing changes. Guru has no Bijak SPM screen (D43), so a subject-teacher flow is out of scope.
- AC-39.7 Given Admin Pusat sets Disahkan, then the system compares the blueprint's section marks, "Jawab" rules (all / choose N of M), question counts, total marks and duration with the values recorded in the evidence (AC-39.2); a value that differs, or a section or value that the evidence does not cover, blocks Disahkan and is listed. At least two evidence bodies must agree on each compared value, otherwise the item is listed as "tidak disahkan" [PROPOSED]. Topic quotas and KBAT quotas are not compared (they are author-set; Q-B15). *(Amended 2026-10-29, G2: sections are matched to the evidence by order (Bahagian A/B/C) and the evidence's own label is shown beside it.)*
- AC-39.8 Note (status): **done 2026-10-29.** The skema jawapan study is added as SPP section 10. It confirms section and question marks for Matematik, Matematik Tambahan and Fizik K2, and shows that no skema prints the "Jawab" rules (so evidence for AC-39.7 must include the paper, not only the skema) and that no skema or other file states TP, cognitive level, KBAT, topic or JSU (so TP and KBAT are set by humans in the bank, with AI suggestions in intake (US-42), and exact quota values by the blueprint author, using SPP section 6 as guidance; amended 2026-10-30, KBAT reconciliation). Notation gaps for the exam-schema owner are in SPP 10.4.
- AC-39.4 Given a Disahkan blueprint is edited in marks, structure, profile, quota or KBAT, then the edit is stored as a new version with source "Spec"; the last Disahkan version keeps serving real students until the new version is verified [Default, Q-B22]. Cosmetic fields (notes, instructions, reference sheets, section label and section instruction) do not reset the status. *(Amended 2026-10-29, G2: the structural vs cosmetic list is the one in `../architecture/v2-bijak-spm-standards.md` section 3.5, used identically by the screen and the server; the head version and the serving version may differ.)*
- AC-39.5 Given a blueprint whose status is Disahkan, then the hub and the contract list show the verifier, date and evidence in one glance, and a blueprint seeded from the study shows its evidence as "Kajian kertas percubaan 2025" [PROPOSED] until a human verification replaces it.
- AC-39.9 (added 2026-10-29, G2, O-7) Given quota and KBAT values prepared by the analyst/Claude from the per-question tables (AC-40.7), then each is shown as "Belum disemak" [PROPOSED] until Admin Pusat reviews and confirms it in the editor; Sahkan is refused while any is unreviewed (AC-39.1(f)). Editing a value counts as reviewing it.
- AC-39.6 Given Jana Kertas, then a real student can generate only from a Disahkan blueprint; Admin Pusat in Mod Pelajar may also generate from a Spec blueprint, flagged test data (AC-28.3) (Q-B14 decided, D76). For a student, a subject without a Disahkan blueprint shows the AC-03.6 reason. *(Amended 2026-10-29, G2: Admin Sekolah in Mod Pelajar follows the student rule, Disahkan only (O-6); real students are shown no blueprint status; Admin Pusat in Mod Pelajar sees the "Spec - ujian sahaja" badge [PROPOSED], design D-3.)*

**US-40 Launch blueprints (user: "ikut yang ada")**
- AC-40.1 Given the data seed for launch, then one blueprint exists in status "Spec" for each of: Matematik 1449/1 and 1449/2; Matematik Tambahan 3472/1 and 3472/2; Fizik 4531/2; Sejarah 1249/2 (section 6.1). None is "Disahkan" at seed.
- AC-40.2 Given a seeded blueprint, then its sections, rules, N, question counts and mark budgets match SPP section 4, its profile kind matches section 6.1, its quota lines (one exact value per unit) and KBAT quota (exact marks of parts whose `kbat` is Mengaplikasi/Menganalisis/Menilai/Mencipta; amended 2026-10-30, KBAT reconciliation) are derived from SPP section 6 and the per-question tables (re-measured on the DSKP KBAT basis, not copied from the S4 shares; the analyst-read levels are seeded unreviewed and the bank's real KBAT tagging decides the pool), and each value is tagged observed or inferred in its note. Where two bodies disagree on a unit, the author picks one exact value inside the observed spread and notes the alternatives (SPP ranges are guidance only); structure, rules and totals that agree are exact. *(Amended 2026-10-29, G2, O-7: seeding has two layers. Layer 1 = structure, rules, totals, profile, marks bands (AC-34.9), from the repo and SPP. Layer 2 = exact unit quotas and KBAT marks, prepared from the per-question tables kept outside the repo by the analyst; no skema states cognitive level (SPP 10.5). If layer 2 is late, launch with layer 1 only: the blueprint is Spec, testable by Admin Pusat in Mod Pelajar, not verifiable.)*
- AC-40.7 (added 2026-10-29, G2, O-7) Given layer-2 values, then they are prepared by Claude/the analyst, tagged observed or inferred, and reviewed by Admin Pusat before Sahkan (AC-39.9); they use the principle "ikut standard peperiksaan dan DSKP", with the real papers as the source and no invented figures.

### DSKP-aware question intake (US-41, US-42; added 2026-10-30, KBAT reconciliation)

Requires the `v2-dskp-integration` feature (dependency B13). Terms: unit, TP, `kbat`, `tag_review` and "Perlu semakan tag" are those of that feature; A6 = a human confirms AI tags, A9 = `kbat` is optional and not a gate.

**US-41 Per-part tags in the intake editor (BJS-17)**
- AC-41.1 Given the intake tag editor for a question, then each leaf part offers optional controls: unit (or form origin T1-T3), TP (1 to 6) and KBAT (Mengaplikasi, Menganalisis, Menilai, Mencipta, Bukan KBAT); a blank control inherits the question's value and shows that inherited value as text.
- AC-41.2 Given a question with no part values set, then the editor looks and behaves as the question-level DSKP editor does today, and no part value is required to confirm the question (not a gate).
- AC-41.3 Given I confirm the question, then the intake-to-question mapping writes every part value I set to the created question version; when I reopen the question in the bank, the same part values show, and the Jana Kertas pool uses the effective values (AC-37.1, AC-38.1).
- AC-41.4 Given a part with its own unit, then it needs no SP of its own: the question's tag (units, SP list, TP, catalogue version, `tag_review`) stays complete and valid by itself, and the unit picker lists only catalogue units of the question's subject plus the T1-T3 bucket.
- AC-41.5 Given part TP values, then the question TP shown is the highest effective TP of its parts (computed, not typed).
- AC-41.6 Given "Bukan KBAT" on a part of a KBAT question, then that part counts 0 KBAT marks while its siblings keep the question's level; a blank part inherits.
- AC-41.7 Given a question still flagged "Perlu semakan tag", then it shows that badge and is excluded from the Jana Kertas pool (AC-38.2).
- AC-41.8 Given 375, 768 and 1280 px, the part controls work without horizontal page scroll, are keyboard-operable and labelled in BM (NFR-01, NFR-07, NFR-16).

**US-42 AI extractor understands the DSKP (BJS-18)**
- AC-42.1 Given an extraction run, then the AI receives, for the candidate units of the paper's subject and level, the DSKP TP descriptors, and the KBAT level definitions, together with the uploaded paper's own text only (no student data; QB NFR-04).
- AC-42.2 Given the result, then each part carries a suggested unit (or T1-T3 bucket), TP and KBAT level (or none), each with a confidence band (as QB intake: High / Medium / Low).
- AC-42.3 Given suggestions, then they are only suggestions: nothing is applied until a human confirms or edits it per part (A6/A9); a question whose AI tags are not yet confirmed stays "Perlu semakan tag".
- AC-42.4 Given a suggested unit that is not in the catalogue of the subject (or is not a candidate), then it is discarded and the part shows "no suggestion"; the system never creates a unit.
- AC-42.5 Given the AI is unavailable or fails, then intake continues with manual tagging, no tag is defaulted, and nothing is scored as 0.
- AC-42.6 Given a confirmed tag, then the audit records its source (AI or human), the confidence and who confirmed it (AC-32.2).
- AC-42.7 Test: with a fixture paper and a fixed set of candidate units and descriptors, every suggested unit is one of the candidates, and TP and KBAT values are inside their allowed sets.
- AC-40.3 Given a seeded blueprint, then it holds structure and counts only: no question text, no mark-scheme text, no copied figure, no person name.
- AC-40.4 Given a launch paper whose structure is only partly observed (Fizik K2 Bahagian C rule; Matematik Tambahan K2 Selangor Q13(b)-Q15; Matematik Tambahan K1 one body), then the seed note says so, and the blueprint cannot be verified (AC-39.1(e)) until a verifier confirms those items.
- AC-40.5 Given subjects and papers with no study material (for example Bahasa Melayu, Bahasa Inggeris, Fizik K1, Sejarah K1, Sains, Kimia, Biologi, Geografi, Sains Komputer), then their existing blueprints stay as they are; without a profile and quota they cannot be Disahkan, so students see the AC-03.6 reason for Jana Kertas on them.
- AC-40.6 Given TP, then no separate "S level" field exists on a question or blueprint: the information-load scale (S1-S4) is a study tool; TP carries the difficulty (Q-B20).

## 5. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Responsive | Every Bijak SPM screen (student and admin) works at 375, 768 and 1280 px with no horizontal page scroll (CLAUDE.md §7). Student exam is phone-first: touch targets >= 44 px; the paper reading column max 40rem (design S1-S2); stimulus is a bottom sheet < 1280 and a sticky side panel >= 1280 (design S3); tables and formulas scroll inside their own container. E2E runs at all three sizes. |
| NFR-02 | Offline-tolerant autosave | As US-11. Local durable queue before network; ordered, idempotent replay; back-off; no field overwritten by a stale device; indicator always truthful; submit never loses an answer typed before the tap (AC-13.2). A 10-minute offline period with continued answering loses nothing on reconnect (QA scenario). |
| NFR-03 | Performance | A 40-question, 100-mark paper opens in <= 2 s p90 on a mid-range phone on 4G; an autosave round trip < 500 ms p90; payload per save sends only changed parts; Semakan opens in <= 2 s p90; paper list loads in <= 1.5 s p90 with 200 papers. Images lazy-load with reserved dimensions (no layout shift). |
| NFR-04 | Scale | Designed for SPM-season peaks: [Default] 5,000 concurrent sittings and 2,000 saves/s sustained without data loss; submit and auto-close are queue-safe and idempotent; a retry storm cannot double-credit rewards. |
| NFR-05 | Integrity and trust | Answer keys, correctness and schemes never leave the server before they may be shown (AC-15.1/15.5). Grading reads only stored keys; the client never sends a verdict. Practice-mode check requests are bound to an attempt, to servable questions and to the student's role, and are rate-limited (fixes N-06). Option and part ids from a request are verified to belong together. |
| NFR-06 | Security and privacy | Role checks on every request; a student reads only own attempts (403 otherwise); photos and answers stored privately with expiring links; authored content is sanitised, student input is always escaped; no student data in any AI prompt (QB NFR-04); no real personal names in seeds or fixtures; no generated media (D22). Mod Pelajar uses the admin's own identity only. |
| NFR-07 | Accessibility | Follows the v2 design-system baseline (D29, D33): keyboard operation of the whole sitting (answer, flag, navigate, submit), visible focus, labels for every control, `aria-live` for save state and timer warnings (not every second), reduced-motion respected, maths with a text form, figures with alt text, ordering controls usable without drag. |
| NFR-08 | Localisation | All UI in Bahasa Melayu (exact .cloud copy kept where marked in the stories); content may be BM, BI, Arabic or Jawi per question (QB AC-26.x); Asia/Kuala_Lumpur time; numbers and units formatted for Malaysia; the elapsed-time display never wraps at 60 minutes (fixes N-16). |
| NFR-09 | Reliability and time | Server time is authoritative for deadlines; device clock skew up to [Default 5 min] never costs marks; auto-close runs within [Default 1 min] of deadline + grace; a failed marking job never awards 0 silently (it shows "Belum dimarkah" and queues retry). |
| NFR-10 | Observability | Metrics: saves ok/fail/queued, submit latency, auto-close counts, marking latency, queue depth, publish-gate failures by rule; alerts on save failure rate and stuck "Sedang dijawab" past deadline + grace. |
| NFR-11 | Data retention | Attempts and responses kept [Default] 5 years; photos of working [Default] 12 months after the attempt; audit 5 years (QB NFR-12). |
| NFR-12 | Consistency of counts | Every count and total shown (cards, hub, history, analytics, "x / y") is computed from the same data it describes (CLAUDE.md §6 D11/D12 spirit). |
| NFR-13 | Generation speed and determinism (US-34 to US-37) | Jana Kertas answers (paper or refusal) in <= 3 s p90 for a 40-question, 100-mark paper with all constraints on, against a pool of [Default] 5,000 eligible questions per subject. A refusal always names the first failing constraint. The same blueprint version and pool never produce a paper that violates a hard constraint (AC-34.8). |
| NFR-14 | Standard-fidelity evidence | The metric "papers differing from blueprint = 0" is checked by the acceptance suite over [Default] 30 generated papers per launch blueprint (AC-35.9, AC-36.4, AC-37.3) and monitored in production from the stored composition (AC-34.7); any violation raises an alert. |
| NFR-15 | Content rights and privacy | Blueprint, seed and discovery data derived from state-body trial papers hold structure, counts and shares only: no question text, no mark-scheme text, no copied figures, no person names (AC-40.3). Rights status of the source papers follows `v2-exam-schema.md` D10 (`third_party` until a rights decision). |
| NFR-16 | Accessibility and BM of the new admin views | Quota and TP tables in the blueprint editor and "Pratonton kolam" convey shortfall by text as well as colour, are keyboard-operable, and all new copy is BM and tagged [PROPOSED] until approved. |

## 6. Scope and assumptions

### In scope (v2.0)
- Student: Bijak SPM entry; Kertas Pilihan; Jana Kertas; Exam and Practice modes; cover, instructions, reference sheet; timer and auto-close; sections and choose-N; stimulus groups; answer controls for all answer modes in [SKEMA]; maths input; navigation/map/flags; autosave with offline queue; resume; submit; result with per-point marking; scheme reveal rules; self-mark; retry; history; Lapor Soalan; rewards; analytics aggregate.
- Admin Pusat (Portal Pentadbiran, Kertas & SPM group): Bijak SPM list (KS-06), paper assembly (merges KS-09 Set Builder, "Cipta set", "Jana set", import review hand-off), Kontrak Blueprint (KS-08), publish gates, copy/version, Mod Pelajar preview, pool preview and draft generation, analytics, marks-review queue (Tanda Karangan, KS-10), audit.
- One implementation of each rule shared by every entry point (no Blade/Panel twins, D30).
- **Exam standard for Jana Kertas (US-34 to US-40, D75):** marks, difficulty profile, topic quota (JSU), KBAT quota, question eligibility, "Disahkan" gate with verifier, quota-fill view in "Pratonton kolam", and six launch blueprints seeded as "Spec".

### 6.1 Launch scope for the exam standard (user, 2026-10-29: "ikut yang ada")

Launch = the papers we have material for (SPP). Structure from SPP section 4; confidence from SPP section 8. All start as "Spec"; "Disahkan" only after human verification (US-39).

| Blueprint | Duration | Sections (effective marks) | Profile kind (default) | KBAT, S4 study only (the quota uses cognitive level and will be higher; AC-37.2) | Evidence |
|---|---|---|---|---|---|
| Matematik K1 1449/1 | 90 min | 40 MCQ, jawab semua (40) | Ladder, slot groups of ten (TP band rises about 3 to 4.4 mean) | about 0% | 2 bodies (Selangor 15 of 40 only) |
| Matematik K2 1449/2 | 150 min | A Q1-10 (40) semua; B Q11-15 (45) semua; C Q16-17 choose 1 (15) | By Bahagian (A low, B middle, C full range) | 7-9% | 2 bodies |
| Matematik Tambahan K1 3472/1 | 120 min | A Q1-12 (64) semua; B Q13-15 choose 2 of 3 (16) | By Bahagian | about 20% | 1 body |
| Matematik Tambahan K2 3472/2 | 150 min | A Q1-7 (50) semua; B Q8-11 choose 3 of 4 (30); C Q12-15 choose 2 of 4 (20), C = the four elective units | By Bahagian | about 3% | 2 bodies (Selangor partly read) |
| Fizik K2 4531/2 | 150 min | A Q1-8 (60) semua; B Q9-10 choose 1 of 2 (20); C Q11 (20, compulsory inferred) | Ladder by question number in A; B, C top band | about 30% (26% of scored) | 1 body |
| Sejarah K2 1249/2 | 90 min | A Q1-4 (40) semua; B Q5-9 choose 3 of 5 (60) | By Bahagian, with "sub-bahagian menaik" | about 17% | 1 body |

All durations in the table are printed on the papers read (SPP section 4), including those `v2-exam-schema.md` D7 had to infer (Matematik K2 and Matematik Tambahan K1/K2 cover pages were not readable there). This answers Q-S1 for these papers, notably Matematik K1 = 90 min (printed in both bodies), not the 75 min convention.

**Next candidates once DSKP is added (not seeded now):** Geografi 2280/1 (theme-block ladder) and 2280/2, Sains Komputer 3770/1. **Reported, not verified here:** Biologi and Kimia K2 share Fizik K2's shape.

**Decision, S level [Default, Q-B20]:** the information-load scale S1-S4 is **not** a new field. TP already carries difficulty and the study shows S and TP track each other (SPP 3.2); a second scale would be a second source of truth. KBAT is the optional `kbat` tag (DSKP four levels; Q-B18, D76), not S or TP; TP and `kbat` are stored per leaf part as optional overrides of the question (Q-B19). *(Amended 2026-10-30, KBAT reconciliation.)*

### Out of scope (v2.0)
- Guru, Admin Sekolah, PPD/JPN, parent screens for Bijak SPM (D43). Guru "confirm AI marks" screen (data contract only).
- Page-image "document" Bahagian B and the Kertas Subjektif viewer (KS-07; .cloud hybrid Bahagian B, N-12) — Won't; K2 content is native structured questions in the bank.
- "Soalan Tambahan" side path in the paper editor (all additions go through the bank).
- Server-side code execution, automatic handwriting recognition, automatic grading of graph/drawing geometry.
- AI-written questions and AI variants (QB US-32); automatic AI essay marking that counts without a human (depends on bank Q5).
- Question intake itself (Bank Soalan v2 owns it), curriculum data (M03), leaderboards/battles.
- Per-day attempt limits, paid tiers, proctoring.
- Printing / PDF export of papers.
- Exam standard: automatic checking of the sub-part ramp by the generator; an official LPM JSU import; per-body ("gaya negeri") variants of one blueprint; empirical difficulty recalibration from student results; blueprints for subjects without study material (AC-40.5).
- Migration of .cloud papers and questions (D29a); only attempt headers migrate (US-33.6).

### Assumptions
- A1 Bank Soalan v2 supplies the questions, versions, stimulus groups, mark schemes, pools, blueprint entity and the marking service; this document consumes them (section 8).
- A2 Subjects, levels, kertas and chapters come from M03; subject names in BM.
- A3 The blueprint is an entity of the bank (QB US-28); "Kontrak Blueprint" is its editor screen in Kertas & SPM (KS-08).
- A4 Attempts are owned by Bijak SPM; aggregates flow to the practice/analytics owner (D12) through a single contract (US-33.4).
- A5 Exam mode does not use the "printed sheet" skin or "Halaman x daripada y"; real-paper feel comes from structure (cover, Bahagian, marks, instructions, formula sheet). Final look is a G2 design decision (proposal, not blocking).
- A6 Mod Pelajar, themes, shells and Nuxt UI design-system rules from D29-D38 apply; no new colour/value tokens.
- A7 (2026-10-29) The study (SPP) is a first draft, not a JSU: 2025, 1-2 state bodies per subject, trial (not LPM) papers, S/TP/unit labels are analyst judgement, most files are scans. Structure and rules are treated as firm where two bodies agree; per-unit marks and per-question marks are guidance for choosing the exact quota values (AC-40.2). Nothing is "Disahkan" on this evidence alone.
- A8 Questions in the bank carry unit, TP and marks (v2-exam-schema D2, D9) or are made eligible by tagging; the share of Terbit questions that qualify is unknown until the bank is loaded (risk R-3 below).
- A9 DSKP extracts cover T4-T5 only (13 subjects, none for Geografi, Sains Komputer, Biologi, Kimia); T1-T3 content is carried by `form_origin` (Q-S2).

### Risks (added 2026-10-29)

| ID | Risk | Mitigation |
|---|---|---|
| R-1 | With the Disahkan-only default (Q-B14) no student can use Jana Kertas until a human verifies a blueprint; nothing is Disahkan today. | Seed Spec now so Admin Pusat can test in Mod Pelajar; collect trial papers and skema from two bodies per launch paper early (AC-39.2); Q-B16 widens the sample. |
| R-2 | Thin pool: constraints (marks x unit x TP x KBAT) can be unsatisfiable even with many Terbit questions; refusals frustrate students. | AC-29.4/29.5 quota-fill preview; AC-38.3 honest numbers; tag-first intake; pilot with launch subjects only. |
| R-3 | Untagged legacy questions (no unit, no TP) are ineligible (AC-38.1); the bank may have few eligible ones. | Preview shows excluded counts with reasons; tagging via bank intake (QB US-05). |
| R-4 | The study's KBAT shares are S4-based; the quota uses `kbat` (Mengaplikasi and above), so real shares are higher and the study numbers cannot be copied (SPP 5.4). | Re-measure seeds from the per-question KBAT levels, seeded unreviewed (AC-40.2). *(Amended 2026-10-30, KBAT reconciliation.)* |
| R-7 | Exact topic quotas (Q-B15) need a larger Terbit pool per unit; one short unit blocks the whole paper. | "Pratonton kolam" shows which unit, TP or KBAT line is short (AC-29.4/29.5); tag-first intake; launch with the six papers only. |
| R-8 | Questions flagged "Perlu semakan tag" (and those without unit or TP) are ineligible (AC-38.1); few legacy questions carry trusted tags. KBAT is no longer a precondition. | Excluded counts with reason in the preview; AI-suggested tags confirmed at bank review and in intake (US-42). *(Amended 2026-10-30, KBAT reconciliation: was "cognitive level per leaf part is required".)* |
| R-9 | US-41 and US-42 depend on the unmerged `v2-dskp-integration` branch (catalogue, tag editor, `tagIssues`). | Dependency B13; Bijak SPM tasks BJS-01 to BJS-16 do not wait for it. |
| R-5 | The papers are third-party state-body papers. | Only structure/counts are stored (AC-40.3, NFR-15); rights status per `v2-exam-schema.md` D10. |
| R-6 | Single-body, partly read sources for Matematik Tambahan K1, Fizik K2, Sejarah K2. | Evidence field in the verification record; Q-B16 widens the sample. |

## 7. Replicate vs redesign

| # | Topic | .cloud behaviour (evidence) | v2 decision | Why / decision |
|---|---|---|---|---|
| R1 | Name and structure | 4 names; `/simulasi`, `/spm-mock` separate (DISC §1.1) | **Change**: one "Bijak SPM", two starts, two modes | D32(a) |
| R2 | Kertas Pilihan list | Subject-grouped cards, effective marks, "Mula" (S1) | **Keep** grouping and effective-marks rule; **add** my status per paper, filters | D29(b): flow unchanged; N-03 stale subtitle dropped |
| R3 | Random generation | Flat N questions into one Bahagian A; ignores blueprint (N-11); `/spm-mock` trusts client `is_correct` (DISC §9) | **Change**: Jana Kertas draws under the blueprint, server-graded | D32(a), D41 groups, QB AC-28.4 |
| R4 | No instant mark in exam mode | Removed on purpose (W:1136-1138) | **Keep** | F-74 rule retained in QB AC-23.3 |
| R5 | Practice mode | `/simulasi/kuiz` and `/simulasi/{paper}/kuiz`, nothing stored (N-05) | **Change**: Mod Latihan stores an attempt, history and aggregate; all parts answerable | D39 question flow; N-05 |
| R6 | Timer | Server `started_at`, client countdown, accept-but-record, T-5 warning, auto-submit on page (ESC:371-374) | **Keep** countdown, T-5 banner, accept-late; **add** server-side deadline and auto-close | N-08, N-17 |
| R7 | Autosave | Single map, 1 s debounce, localStorage mirror, beacon, merge-by-field (DISC §4.1) | **Keep** design; **add** durable offline queue, retry, ordering, per-part versioning | QBF "what v2 keeps"; N-09 |
| R8 | Submit | Form with token only; async PATCH race (N-01) | **Change**: submit carries full answer set + idempotency key | N-01 |
| R9 | Served composition snapshot | `served_composition` freezes questions, marks, rules (ESC:814-834) | **Keep** (with question versions) | QB AC-13.3, NFR-08 |
| R10 | Scoring | Best-N for choose_n; recorded denominator; fold document marks (ExamBestNScorer) | **Keep** best-N and recorded denominator; drop document-section fold | Won't page-image Bahagian |
| R11 | Objective grading | Server-only, dichotomous, numeric compare only for pure numbers, tolerance 0 default | **Keep** trust model; **replace** matching with equivalence marking (numbers, units, fractions, notation) with confidence | D41(4), QBF D |
| R12 | Subjective marking | Keyword suggestion; student self-marks 0..max (RubricKeywordMarker) | **Change**: structured marking points (K/N/P [SKEMA]) with per-point hit/miss and confidence; **keep** self-mark within clamps and "failure never awards 0" | D41(3)(4), QBF "keeps" |
| R13 | AI essay marks | Proposal queue, counts only after human confirm; not wired (EssayReviewController) | **Keep** rule; queue under Pentadbiran for Admin Pusat first | D32(b), D43 |
| R14 | Stimulus | Pinned only if one stimulus is common to the whole section (PaperSection.php:187-207) | **Change**: stimulus groups as first-class, pinned/side-panel, kept whole in every assembly | D41(1), QBF A |
| R15 | Maths answers | Plain text; `working_shown` split is good | **Keep** working/final split; **add** maths keyboard, unit field, photo of working | D41(2), QBF B |
| R16 | Answer controls | 14 widgets; sequence_order broken (N-02) | **Keep** the set via the schema; fix ordering; gate publish on working controls | N-02, schema [SKEMA] |
| R17 | Paper skin and pagination | Light paper skin, weight-4 sheets, "Halaman x daripada y" (ATT:571-652) | **Change**: learner-portal layout, question/group steps, question map; structure kept | D35, D39, A5 |
| R18 | Question map, flags, choose-N picks | Map dots, flag, pick checkbox (advisory) | **Keep** (advisory only; scoring ignores) | Fidelity, D29(b) |
| R19 | Reference sheet | Foldable panels on the cover, open by default | **Keep** | D29(b) |
| R20 | Resume choice | "Sambung" / "Mula Semula" after > 60 s | **Keep** copy and 60 s rule; **add** closing of discarded attempt | N-08 |
| R21 | Semakan | Scheme per part, verdict, self-mark; cover grid never filled | **Keep** scheme + verdict + self-mark; **drop** "Untuk Kegunaan Pemeriksa" grid and raw JSON mapping | N-14 |
| R22 | History | Only `/spm/history` aggregate; non-native composites missing; label "Tahun Lepas" (N-10) | **Change**: dedicated history, all kinds, label "Bijak SPM" | N-10, AC-33.4 |
| R23 | Rewards | Syiling 2 and XP 10 per marks earned, delta, no clawback | **Keep** | D29(b) |
| R24 | Document Bahagian (page-image K2) | Hybrid Bahagian B with self-toggle scheme (N-12) | **Drop** from v2.0 | Scope; N-12 |
| R25 | Admin surfaces | Blade `/admin` + Panel + `/admin-filament` twins; create/jana only in Blade (N-19) | **Change**: one place in Portal Pentadbiran Kertas & SPM | D30 |
| R26 | Admin gating UX | "Admin Pusat sahaja" notice page for school/district staff | **Change**: menu filtering; direct URL = 403 | D30 (no visible-but-forbidden items) |
| R27 | Publish gates | Completeness validator + blueprint gate + override tick without reason; native publish flips question statuses (N-20) | **Keep** gates and override for **blueprint gaps only**; **add** reason; **add** answer-key rule as unbypassable; publish does not change question status | QB E9, US-11/12; N-20 |
| R28 | Edit rule on live paper | Never edit live; "Salin untuk sunting" | **Keep**; extend to composite (N-13) | .cloud D-07 intent |
| R29 | Snapshots on publish | Composite pins question snapshots; native does not | **Change**: all papers reference question id + version | QB AC-21.5 |
| R30 | Blueprint | Per subject x kertas validator; shared-effect banner; 14 raw slugs; no audit (N-15) | **Keep** concept, banner, unique key; **add** versions, audit, BM labels, generation use | D32(a), QB US-28 |
| R31 | Preview | Admin opens student URL and creates junk attempts (N-07) | **Change**: Mod Pelajar, test data flagged | D31(c), D33(b) |
| R32 | Soalan Tambahan, DOCX/BI upload, import review | Separate Blade-only paths | **Replace** by bank intake + assembly | D28(e), D39(a) |
| R33 | Answer-check endpoint | Public answer oracle (N-06) | **Change** | NFR-05 |
| R34 | Result grade letter | .my Mock showed A+ to G; .cloud Simulasi none | **Open**: default no letter | D29(c): .my only for what .cloud lacks; Q-B5 |
| R35 | Exam standard of a generated paper | .cloud validator checks sections/rules only; generator ignores marks, topic, difficulty (N-11) | **Add** (new, not from .cloud): marks, difficulty profile, topic quota, KBAT quota, eligibility, Disahkan gate | D75; SPP |

## 8. Dependencies

### 8.1 On Bank Soalan v2 ([v2-question-bank.md](v2-question-bank.md), held by D39(a) until its G2)

| # | Needed from the bank | Why Bijak SPM needs it |
|---|---|---|
| B1 | Pool query by tags (subject, level, chapter, topic, difficulty, type, year, kertas, source, language, official-past-year flag), Terbit only, with computed counts (QB US-21) | Jana Kertas, picker, pool preview |
| B2 | Paper entity "Kertas" with sections, question references by id + version, publish state, conformance (QB US-12) | Kertas Pilihan |
| B3 | Stimulus groups: one stimulus, ordered linked questions, "kept whole" flag (D41) | Pinning, assembly, generation |
| B4 | Structured mark scheme: marking points K/N/P, marks, accepted equivalents, tolerance, units, ECF (D41) | Per-point results, equivalence marking |
| B5 | Marking service: objective + equivalence marking returning per-point result and confidence (D41) | Submit, Semak |
| B6 | Question render payload without keys; version served is stored on the attempt | Exam mode trust |
| B7 | Blueprint entity with versions and the contract fields (QB US-28) | Kontrak Blueprint, Jana Kertas |
| B8 | Reports flow (QB US-18/19), versions and withdraw events (QB US-13/14) | Lapor Soalan, "Perlu semakan" |
| B9 | Review-queue contract for low-confidence marks | US-31 |
| B10 | (2026-10-29) Bank review checklist item "leaf parts run from lower to higher demand" with a stored result (flag, not a gate), per AC-38.4; to be added by the owner of `v2-question-bank.md` (not rewritten here) | Sub-part ramp (SPP 5.2) |
| B11 | (2026-10-29) Tags needed on every Terbit question for the pool: unit code or `form_origin`, TP per leaf part (inherits the question's), optional `kbat` per leaf part (Mengaplikasi/Menganalisis/Menilai/Mencipta/Bukan KBAT, inherits the question's), leaf marks, and `tag_review` false; pool query filters and counts by unit, TP, `tag_review` and KBAT marks (extends B1). *(Amended 2026-10-30, KBAT reconciliation: cognitive level withdrawn.)* | Eligibility, quota, preview (AC-38.1, AC-29.4) |
| B12 | (2026-10-29, D76) **Met 2026-10-29 (Q-B24 closed); was a dependency for the exam-schema owner (solution-architect):** `v2-exam-schema.md` D9 derives `kbat` as TP >= 4 and holds `tp` and `cognitive_level` per question (D2). D76 defines KBAT as cognitive level in {Mengaplikasi, Menganalisis, Menilai, Mencipta} and requires TP and cognitive level per leaf part. That doc must be aligned by its owner (not edited here). Until then Bijak SPM uses the D76 definition. *(Amended 2026-10-30, KBAT reconciliation: the encoding is now the optional `kbat` of `v2-dskp-integration` A9 (four levels or none), per question with an optional leaf-part override; `v2-exam-schema.md` D2/D8/D9 were revised to that enum by the architect, `../architecture/v2-bijak-spm-standards.md` section 14.)* | KBAT quota, eligibility (Q-B24) |
| B13 | (2026-10-30) The `v2-dskp-integration` feature (branch `origin/claude/determined-dijkstra-ju5q60`: DSKP catalogue, tag editor, `tagIssues`, `tag_review`, backend hand-over) must be merged for **BJS-17 and BJS-18** (US-41, US-42). BJS-01 to BJS-16 do not wait for it. | US-41, US-42 |

### 8.2 On the user's exam schema / LPM format ([SKEMA])
Answer-mode list; mark-scheme structure; marking states (Betul / Separa / Salah / Belum dimarkah); paper blueprint per subject x kertas (durations, total marks, sections, choose rules, ~~topic weighting, difficulty mix~~); paper code format ("1449/1"); kertas list per subject; whether K3 (practical) exists in scope; grade scale if any; controlled vocabularies (difficulty, cognitive level, language).

*Update 2026-10-29 (D75):* the exam schema is derived and approved (`v2-exam-schema.md`, D47), so the list above is mostly answered. **Topic weighting and difficulty mix are now partly answered** by the 2025 trial-paper study ([SPP](../discovery/SPM-paper-patterns.md)): structure and rules for six launch papers, the three difficulty-profile kinds, first-draft unit mark tables, KBAT shares. **Still waiting for the user / LPM:** widening the sample and any official LPM format or JSU (Q-B16), and DSKP for Geografi, Sains Komputer, Biologi, Kimia and Tingkatan 1-3 (Q-B17). Decided by the user (D76): verification rule (Q-B13), Disahkan-only (Q-B14), exact quotas (Q-B15), KBAT basis = the DSKP four levels (Q-B18), TP and KBAT per part as optional overrides (Q-B19). *(Amended 2026-10-30, KBAT reconciliation: "cognitive level" is now the optional `kbat` tag, A9 of `v2-dskp-integration`.)*

### 8.3 On other v2 work
- D29 design system and shells (V2-T-series): student quiz layout and feedback components (`docs/design/v2-question-bank.md` S1-S6).
- Mod Pelajar (D31c/D33b) switch and banner from the shells work.
- Practice/analytics owner (M05) for the aggregate contract; rewards owner for syiling/XP; Guru modules for Prestasi/Analitik/Analisa Item/Monitoring consumption.
- Data migration (`docs/architecture/v2-data-migration.md` §3.3) for attempt headers.
- Media policy: only source media (D22); no generated images/audio.

## 9. Open questions

### 9.1 Blocking (need the user before G2 data model / tasks)

| ID | Question | Blocks | Recommended default |
|---|---|---|---|
| Q-B1 | The **exam schema and LPM format**: answer modes, mark-scheme structure (K/N/P?), marking states, and per-subject x kertas blueprints (durations, marks, sections, choose rules). | Data model; Kontrak fields; Jana Kertas; gates (f)(l) | Build on a pluggable structure; seed the contract list from .cloud's rows as "Draf" (it already lists durations/marks as unconfirmed `[K]` in `docs/SPM-SIMULASI-BLUEPRINT.md`) and confirm each against LPM before it can be "Disahkan". Same as bank Q1. |
| Q-B2 | **Launch scope of Bijak SPM**: which subjects and which kertas (K1 objektif only, or K2 struktur/esei too)? | Blueprint seeding, Jana Kertas, maths/essay input work in the first release | SPM Tingkatan 4-5 core subjects (D40b); K1 objektif and K2 struktur/esei for subjects whose blueprint is "Disahkan"; K3 practical and oral papers excluded. |
| Q-B3 | **Marking authority for subjective answers**: should a system-proposed mark count immediately ("sementara"), only after the student self-confirms, or only after a human confirms? And may paper content go to an external AI for semantic marking (bank Q5)? | US-14/16/31 behaviour, rewards, privacy | Rule-based equivalence marking (numbers, units, fractions, accepted variants) counts immediately when confidence is High; lower confidence is "Belum dimarkah" until the student self-marks or staff confirm; no external AI marking in v2.0 (flagged hook only). |
| Q-B4 | **Generation when the pool is thin**: refuse (list the shortfall) or allow a shorter paper? | AC-03.2, US-29 | Refuse with the shortfall; never under-fill (replicates the .cloud generator rule). |

### 9.2 Decided by default (not blocking; tell us if you disagree)

| ID | Decision taken | Impact if changed |
|---|---|---|
| Q-B5 | No grade letter on the result; marks and percentage only (the .my Mock letter grade is per-attempt accuracy, not a real SPM grade). | Add scale in [SKEMA] |
| Q-B6 | Page-image Bahagian B and Kertas Subjektif viewer are not part of Bijak SPM v2.0. | Re-add as a section type later |
| Q-B7 | Blueprint-gap override stays (with a mandatory reason), completeness gates have no override. | Remove override entirely |
| Q-B8 | Both starts offer both modes. | Restrict Jana Kertas to Latihan |
| Q-B9 | No daily attempt limit. | Add a limit rule |
| Q-B10 | Guru confirm-marks screen is deferred; Admin Pusat queue first (D32b vs D43). | Add Guru screen when scope grows |
| Q-B11 | Auto-close grace 5 min and device-sync window 24 h. | Tune in pilot |
| Q-B12 | Exam mode drops the printed-paper skin and sheet paging (A5). | G2 design review |
| Q-B20 | The information-load scale S1-S4 is **not** a new field; TP carries difficulty (section 6.1). | Add a field and a second quota basis |
| Q-B21 | Topic and KBAT quotas count **offered** questions/marks; mark totals count **effective** marks (after choose-N). | Count effective only: student choice changes the standard |
| Q-B22 | Editing a Disahkan blueprint (marks/structure/profile/quota/KBAT) creates a Spec version; the last Disahkan version keeps serving students until the new one is verified (AC-39.4). | Withdraw Jana Kertas during re-verification |
| Q-B23 | Per-slot marks are optional; section totals are mandatory (bodies differ on per-question marks, SPP 5.6). | Force per-slot marks, pick one body's values |
| Q-B13 | **Decided by the user (D76):** Admin Pusat verifies "Disahkan". The record cites trial papers **and their skema jawapan** from at least two bodies; the system compares section marks, rules, counts, totals and duration with the recorded evidence before allowing Disahkan (AC-39.2, AC-39.3, AC-39.7). The skema study is in progress and will be added to SPP. | Add a subject-teacher flow; accept one body |
| Q-B14 | **Decided by the user (D76):** real students may generate only from **Disahkan** blueprints; Admin Pusat in Mod Pelajar may also use Spec (AC-03.1, AC-39.6). Risk R-1 kept. | Allow Spec for students |
| Q-B15 | **Decided by the user (D76):** topic quotas are **exact** (one value per unit; T4:T5 share is implied). The generator matches exactly or refuses with the shortage message (AC-36.1/36.4). Risk R-7. | Ranges |
| Q-B18 | **Decided by the user (D76, "ikut DSKP"):** a leaf part is KBAT when its effective `kbat` is Mengaplikasi, Menganalisis, Menilai or Mencipta (the DSKP's four thinking levels); the KBAT quota counts marks of such parts; no TP threshold per blueprint; TP remains the difficulty/profile measure (AC-37.1 to 37.5). Study S4 shares are not comparable (R-4). *(Amended 2026-10-30, KBAT reconciliation: encoded as the optional `kbat` of `v2-dskp-integration` A9; null = Bukan KBAT; no KBAT gate.)* | Re-introduce a TP threshold |
| Q-B19 | **Decided by the user (D76):** TP and `kbat` are held per question with an **optional** leaf-part override (a part inherits the question's value); question TP = highest of its parts; **TP** is required for pool eligibility, `kbat` is not (AC-38.1(b)). Schema alignment: Q-B24. *(Amended 2026-10-30, KBAT reconciliation: was "TP and cognitive level ... both required".)* | Question-level only |

### 9.3 Open questions, exam standard (2026-10-29, D75/D76)

| ID | Question | Blocks | Recommended default |
|---|---|---|---|
| Q-B16 | **Widen the sample before "Disahkan"**: more bodies and 2023-2024 papers? How many? (Study: 2025 only, 1-2 bodies per subject, SPP 8.) | US-39 evidence rule | Yes for the single-body papers (Matematik Tambahan K1, Fizik K2, Sejarah K2) before they are Disahkan; Matematik K2 and Matematik Tambahan K2 (2 bodies agree) first. |
| Q-B17 | **Supply DSKP** for Geografi, Sains Komputer, Biologi, Kimia and for Tingkatan 1-3 (Matematik, Sejarah)? Without it these cannot get a unit-level quota or a T4:T5 share. | Next candidates (6.1); `form_origin` workaround (Q-S2) | Matematik T1-T3 first (about 44% of Matematik K1 items); then Geografi and Sains Komputer. |
| Q-B24 | **Closed 2026-10-29 (solution-architect, D76).** `v2-exam-schema.md` D2, D8 and D9 are aligned: `kbat` is derived per leaf part from cognitive level (level 3 to 6 = Mengaplikasi, Menganalisis, Menilai, Mencipta), not from `tp >= 4`; TP and cognitive level are held per leaf part, inheriting the question's value, and the question TP is the highest TP of its leaf parts (computed). Dependency B12 is met. Design: `docs/architecture/v2-bijak-spm-standards.md`. | (was G2 data model) | Done |

## 10. Fidelity deviations (student side: Semakan R1-F11, session and Kuiz H-A22)

Tracked per project rule D9 (fix what is broken or unusable, replicate what works). Reference: V2 `exam-sim/components/scheme.blade.php` and `attempt.blade.php`.

| # | V2 behaviour | Rebuild | Why (D9) | Status |
|---|---|---|---|---|
| F11-D1 | "Markah kendiri" is a bare `<input type="number">` that posts the mark on every change. | A -/+ stepper (buttons at least 44px, value shown as `{mark} / {max}`) with an explicit "Simpan markah" button; the state badge reads "Belum disahkan" until saved and "Markah kendiri disimpan" after. The 0..max range, the band presets (floor midpoint, band range) and the server clamp are unchanged. | A native number spinner is not usable by touch, and posting on every keystroke saves half-typed marks. Touch-usability fix. | Applied |
| F11-D2 | No warning when leaving the page with a changed but unsaved mark. | The result page asks "Anda ada markah kendiri yang belum disimpan. Tinggalkan halaman ini?" before in-app navigation and shows the browser's leave prompt on tab close or reload, only while a stepper change is unsaved. | Follows from F11-D1 (an unsaved draft exists only because saving is explicit). V2 has no such text in `exam-sim`. | Applied; copy is [PROPOSED] |
| F11-D3 | Band option reads "Band {n} · {label} ({min}-{max}): {descriptor}". | The same, but the " · {label}" part is shown only when the band carries a label. `BijakAttemptRubricBand` has no `label` field yet, so today it never appears. | Contract gap, not a rebuild choice. | Open: needs a contract field if bands carry labels |
| H22-D1 | The sitting is pinned in the PHP session; a logout destroys the pin, so the next pupil on a shared device gets a blank paper (operator request, `ESC:84-92`). | An open attempt lives on the server and is returned on any device and after a new login ("Sambung" on the cover); there is no reset at logout. | Not a D9 fix. By decision: AC-R1-05.2 (reload or another device restores saved answers, flags and picks) needs the server to keep the attempt. The V2 shared-device reset is not replicated; a pupil who wants a blank sitting uses "Mula Semula". Parity row S-10 in `docs/qa/r1-student-parity-check.md`. | Applied (AC-R1-05.2) |
| H22-D2 | `/simulasi/kuiz` (random Kuiz) stores nothing: score and timer are local (BIJAK-SPM-cloud 3.6, R5 above). | The random Kuiz is stored as a practice session, feeds Soalan Aku Salah and pays the practice reward (result tiles "Syiling" and "Mata"). The per-paper quiz `/simulasi/{paper}/kuiz` still stores nothing. | Not a D9 fix. By decision D85 U8 ("Simulasi Kuiz is stored as a practice session; a single-paper quiz is not stored"). Parity row S-45 in `docs/qa/r1-student-parity-check.md`. | Applied (D85 U8) |
