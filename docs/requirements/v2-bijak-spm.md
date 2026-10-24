# v2 Bijak SPM: full-paper practice and exam simulation (merge of SPM Mock and Simulasi)

- **Slug:** `v2-bijak-spm`
- **Status:** Draft G1 (requirements only). The exam schema, LPM format and sample papers are not yet shared, so the data model is NOT final.
- **Date:** 2026-10-16
- **Owner:** product-analyst
- **Decisions applied:** D24, D28(c)(e), D29(a)(b)(c), D30, D31(c), D32(a), D33(b), D35, D39, D40, D41, D43 (Murid matrix row 13 "SPM" in scope; Guru and Admin Sekolah have no SPM row). D22 (no generated media) and the privacy rule apply to all seeds and samples.
- **Evidence:** the .cloud behaviour is documented, with `path:line`, in [../discovery/BIJAK-SPM-cloud.md](../discovery/BIJAK-SPM-cloud.md) (cited as **DISC §x** and defect ids **N-xx**). Prior findings: [v2-question-bank-oldsystem-findings.md](v2-question-bank-oldsystem-findings.md) (**QBF A-D**). Bank contract: [v2-question-bank.md](v2-question-bank.md) (**QB US-xx / AC-xx**). Display design: [../design/v2-question-bank.md](../design/v2-question-bank.md) (S1-S6, P1-P2).
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
- AC-03.1 Given I choose a subject and paper (kertas) that has a blueprint with source "Disahkan" or "Spec" [SKEMA], when I tap "Jana Kertas", then the system builds a paper with the blueprint's sections, selection rules, section mark budgets and total marks, drawn only from Terbit questions.
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
- AC-06.2 Given a choose-N section (both modes), then a counter "{c} / {N} soalan dipilih" is shown; I can tick a question as chosen; and when I type an answer into an unticked question while a slot is free (c < N), then that question is ticked automatically. *User decision 2026-10-24 (source: system audit FB-048); replaces "advisory tick" in both modes — the effect of the tick now depends on the mode (AC-06.3, AC-06.6).*
- AC-06.3 **Mod Latihan.** Given a choose-N section in Mod Latihan, then I may answer all questions of the section, and:
  - (a) Given I have ticked N questions (cap reached), then the checkbox of every other question is disabled with the message "Anda sudah memilih {n} soalan. Nyahpilih soalan lain untuk menukar pilihan."; the other questions stay visible and answerable.
  - (b) Given I answer more than N questions, then the section shows "Anda telah menjawab {a} soalan. Hanya {n} soalan dengan markah tertinggi akan dikira." ({a} = questions answered, {n} = N).
  - (c) Given marking, then the best N attempted questions by marks count (ties: lower question position); if fewer than N were attempted, ticked blank questions fill the remaining slots (so a chosen question is never shown "Tidak dikira"); the Semakan states which questions counted.
  - (d) The progress count and the "Hantar" summary count at most N per choose-N section, using the same single rule as marking.
- AC-06.6 **Mod Peperiksaan.** Given a choose-N section in Mod Peperiksaan, then:
  - (a) Given N questions are ticked, then every other question in the section is locked (cannot be answered or ticked).
  - (b) Given marking, then only ticked questions count; there is no best-N selection.
  - (c) Given I untick a question, then its typed answer is kept but it is not counted; the lock lifts and I may tick it again (re-tick) or another question.
  - (d) The Semakan states which questions counted.
  - Locked-state copy and visual design are for the design phase (not specified by the user).
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
- AC-09.6 Given the maths keyboard (calculator-style, Casio-like; user-confirmed 2026-10-24, source: system audit FB-045), then it has two switchable layers plus a fixed number block:
  - Layer "Fungsi" (default): a/b, √, x², xⁿ, x⁻¹; sin, cos, tan, log, ln; (, ), π, °; and a key that switches to "Simbol".
  - Layer "Simbol": x, y, "," (comma), %, ±; <, >, ≤, ≥, =; (, ), π, °; and a key that switches back to "Fungsi".
  - Number block (always visible): 7 8 9 DEL AC; 4 5 6 × ÷; 1 2 3 + −; 0 . ×10ˣ ◀ ▶ (cursor left/right).
  - Every key is accepted by the marker (trigonometric functions in degrees).
  - Not included: e, (−), Ans, an execute "=" key, RCL/M+ (an answer field does no calculation).
  - Keys are shown as tiles/icons; the arrangement was confirmed as "dah elok" by the user.

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
- AC-14.5 Given the total, then it equals the sum of part marks after the choose-N reduction of the mode (best N in Mod Latihan, ticked questions in Mod Peperiksaan; AC-06.3, AC-06.6), and the denominator equals the recorded maximum of the composition I was served (never recomputed from later paper edits).
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
- AC-25.1 Given Kertas & SPM > Kontrak Blueprint, then I can create one contract per subject x kertas (unique), with: paper code, duration, total marks, auto-markable flag, source status (Draf / Spec / Disahkan), notes, and ordered sections (label, instruction, rule, N, mark budget, allowed answer modes) [SKEMA: topic weighting, difficulty mix, cognitive level].
- AC-25.2 Given a banner, then it states that a contract is shared and changing it changes the publish gate and Jana Kertas for **all** papers of that subject x kertas.
- AC-25.3 Given I save a change, then a new contract version is stored; papers already published stay valid under the version they were published with (QB AC-28.2); the change is audited with the diff.
- AC-25.4 Given a contract, then allowed answer modes are shown with BM labels, never raw identifiers. (Fixes N-15.)
- AC-25.5 Given delete, then it is blocked while a Terbit paper depends on it, else confirmed with the impact count.
- AC-25.6 Given Jana Kertas, then it reads exactly this contract (QB AC-28.4); a contract in Draf status may generate only for Admin Pusat in Mod Pelajar, not for real students [Default].

**US-26 Publish gates**
- AC-26.1 Given "Terbitkan" on a paper, then ALL of these must pass or the paper stays Draf and every failure is listed at once with the question number: (a) at least one question; (b) every question is Terbit and not withdrawn; (c) **every leaf part has an answer key / mark scheme with content** (QB AC-11.2; no bypass for single, paper-level or bulk publish); (d) MCQ shape: >= 2 options, exactly 1 correct; (e) marks: leaf marks >= 1 and parent marks consistent; (f) every answer mode used has a working student control; (g) every stimulus resolves; (h) no stimulus group is split or out of order; (i) choose-N: N <= questions in the section; (j) section totals > 0; (k) single subject; (l) duration present when the contract is "Disahkan".
- AC-26.2 Given the contract check, then a paper that does not match its contract (missing section, rule or N mismatch, marks budget, unexpected answer modes, section count) shows each gap; hard gaps (missing section, rule/N mismatch) block publish.
- AC-26.3 Given a hard gap, then Admin Pusat may publish anyway only by ticking "Terbitkan walaupun tidak memenuhi kontrak Simulasi" **and entering a reason** [Default; .cloud had no reason]; the paper shows a "Tidak memenuhi kontrak" badge and the audit entry lists the gaps and the reason. Completeness gates (a-j) can never be overridden.
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
- AC-28.4 Given Admin Sekolah in Mod Pelajar (D33b), then only Terbit papers are available; drafts are preview-only for Admin Pusat.
- AC-28.5 Given PPD/JPN, Guru or Murid, then no preview action exists.

**US-29 Pool preview and draft generation**
- AC-29.1 Given a blueprint, then "Pratonton kolam" shows per section the count of Terbit questions that qualify, computed by the same query as Jana Kertas, and a link "Lihat soalan" to the bank prefiltered. Empty pool shows "Tiada soalan Terbit untuk tag ini" (not an error).
- AC-29.2 Given "Jana draf kertas", then a draft paper is created from the blueprint (same generator as AC-03.x) and opened for editing; it is never published automatically.
- AC-29.3 Given the shortfall rule, then an under-filled draw is refused with the real numbers (replicates the .cloud generator rule).

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

## 6. Scope and assumptions

### In scope (v2.0)
- Student: Bijak SPM entry; Kertas Pilihan; Jana Kertas; Exam and Practice modes; cover, instructions, reference sheet; timer and auto-close; sections and choose-N; stimulus groups; answer controls for all answer modes in [SKEMA]; maths input; navigation/map/flags; autosave with offline queue; resume; submit; result with per-point marking; scheme reveal rules; self-mark; retry; history; Lapor Soalan; rewards; analytics aggregate.
- Admin Pusat (Portal Pentadbiran, Kertas & SPM group): Bijak SPM list (KS-06), paper assembly (merges KS-09 Set Builder, "Cipta set", "Jana set", import review hand-off), Kontrak Blueprint (KS-08), publish gates, copy/version, Mod Pelajar preview, pool preview and draft generation, analytics, marks-review queue (Tanda Karangan, KS-10), audit.
- One implementation of each rule shared by every entry point (no Blade/Panel twins, D30).

### Out of scope (v2.0)
- Guru, Admin Sekolah, PPD/JPN, parent screens for Bijak SPM (D43). Guru "confirm AI marks" screen (data contract only).
- Page-image "document" Bahagian B and the Kertas Subjektif viewer (KS-07; .cloud hybrid Bahagian B, N-12) — Won't; K2 content is native structured questions in the bank.
- "Soalan Tambahan" side path in the paper editor (all additions go through the bank).
- Server-side code execution, automatic handwriting recognition, automatic grading of graph/drawing geometry.
- AI-written questions and AI variants (QB US-32); automatic AI essay marking that counts without a human (depends on bank Q5).
- Question intake itself (Bank Soalan v2 owns it), curriculum data (M03), leaderboards/battles.
- Per-day attempt limits, paid tiers, proctoring.
- Printing / PDF export of papers.
- Migration of .cloud papers and questions (D29a); only attempt headers migrate (US-33.6).

### Assumptions
- A1 Bank Soalan v2 supplies the questions, versions, stimulus groups, mark schemes, pools, blueprint entity and the marking service; this document consumes them (section 8).
- A2 Subjects, levels, kertas and chapters come from M03; subject names in BM.
- A3 The blueprint is an entity of the bank (QB US-28); "Kontrak Blueprint" is its editor screen in Kertas & SPM (KS-08).
- A4 Attempts are owned by Bijak SPM; aggregates flow to the practice/analytics owner (D12) through a single contract (US-33.4).
- A5 Exam mode does not use the "printed sheet" skin or "Halaman x daripada y"; real-paper feel comes from structure (cover, Bahagian, marks, instructions, formula sheet). Final look is a G2 design decision (proposal, not blocking).
- A6 Mod Pelajar, themes, shells and Nuxt UI design-system rules from D29-D38 apply; no new colour/value tokens.

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
| R10 | Scoring | Best-N for choose_n; recorded denominator; fold document marks (ExamBestNScorer) | **Keep** best-N (Mod Latihan only; Mod Peperiksaan counts ticked questions only, AC-06.6 — user decision 2026-10-24, FB-048) and recorded denominator; drop document-section fold | Won't page-image Bahagian |
| R11 | Objective grading | Server-only, dichotomous, numeric compare only for pure numbers, tolerance 0 default | **Keep** trust model; **replace** matching with equivalence marking (numbers, units, fractions, notation) with confidence | D41(4), QBF D |
| R12 | Subjective marking | Keyword suggestion; student self-marks 0..max (RubricKeywordMarker) | **Change**: structured marking points (K/N/P [SKEMA]) with per-point hit/miss and confidence; **keep** self-mark within clamps and "failure never awards 0" | D41(3)(4), QBF "keeps" |
| R13 | AI essay marks | Proposal queue, counts only after human confirm; not wired (EssayReviewController) | **Keep** rule; queue under Pentadbiran for Admin Pusat first | D32(b), D43 |
| R14 | Stimulus | Pinned only if one stimulus is common to the whole section (PaperSection.php:187-207) | **Change**: stimulus groups as first-class, pinned/side-panel, kept whole in every assembly | D41(1), QBF A |
| R15 | Maths answers | Plain text; `working_shown` split is good | **Keep** working/final split; **add** maths keyboard, unit field, photo of working | D41(2), QBF B |
| R16 | Answer controls | 14 widgets; sequence_order broken (N-02) | **Keep** the set via the schema; fix ordering; gate publish on working controls | N-02, schema [SKEMA] |
| R17 | Paper skin and pagination | Light paper skin, weight-4 sheets, "Halaman x daripada y" (ATT:571-652) | **Change**: learner-portal layout, question/group steps, question map; structure kept | D35, D39, A5 |
| R18 | Question map, flags, choose-N picks | Map dots, flag, pick checkbox (advisory) | **Keep** map dots and flags (flags never affect score). **Choose-N pick changed (user decision 2026-10-24, FB-048):** Mod Latihan = tick is a hint, best N attempted count, ticked blanks fill short slots; Mod Peperiksaan = only ticked questions count, other questions locked at N (AC-06.2, AC-06.3, AC-06.6) | Fidelity, D29(b); user decision FB-048 |
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

### 8.2 On the user's exam schema / LPM format ([SKEMA])
Answer-mode list; mark-scheme structure; marking states (Betul / Separa / Salah / Belum dimarkah); paper blueprint per subject x kertas (durations, total marks, sections, choose rules, topic weighting, difficulty mix); paper code format ("1449/1"); kertas list per subject; whether K3 (practical) exists in scope; grade scale if any; controlled vocabularies (difficulty, cognitive level, language).

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

### 9.3 Open — pending decision (added 2026-10-24, system audit)

| ID | Question | Blocks | Status / recommended default |
|---|---|---|---|
| Q-B13 | Answer field renders maths while typing (WYSIWYG, e.g. MathLive): stacked fractions, raised powers and √ shown in the field itself (like a Casio natural display) instead of raw text. Affects US-09 (AC-09.1, AC-09.3, AC-09.5) and would add a runtime dependency (ADR needed). | US-09 input model; timing relative to the 30 Okt go-live | **Pending LEAD/user decision** (new request from the user 2026-10-24, not approved yet); see `docs/qa/audit-sistem/FIXLOG.md` FB-069 / P-069. Until decided, the current keypad (AC-09.6) with preview stays. |
