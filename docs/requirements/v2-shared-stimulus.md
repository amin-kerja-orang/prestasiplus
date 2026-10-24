# v2 Shared stimulus (FB-027 .. FB-030)

Slug: `v2-shared-stimulus`. Phase: G1 Requirements. Track: Full (new data: stimulus versions, part-level reference, new kinds).
Module: M28 Bijak SPM (admin Bank/Semakan/Intake + student attempt). Language of user-facing copy: Bahasa Melayu (exact strings quoted below; `[PROPOSED]` = new copy with no old-system source).

Sources: audit report section 13.9 (13.9.1 old mechanisms a-h, 13.9.2-13.9.4 new, hands-on) and section 11 E3 (old `stimulus_kinds`); `docs/qa/audit-sistem/FIXLOG.md` FB-001..003 (Fixed), FB-027..030 (Planned), P-027..P-030; `v2-exam-schema.md` D6 / D41 / gap row 6; `v2-bijak-spm.md` US-07, AC-23.3, AC-24.4; `v2-question-bank.md` US-24, AC-21.5; code facts `m28-bijak-spm/domain/types.ts`, `admin/intake/domain/grouping.ts`, `server/admin.ts` (`reviseQuestionFull`, `applyLive`).

User rules applied (2026-10-24): convert from the old system and fix what is broken; no redesign, no invention; no overlapping screens, modules or features; ask only where the old system has no answer or contradicts itself. Consequence: **no new screen**. Every capability below lives on an existing surface (Intake review/manual editor, Bank edit page "Sunting", Semakan review item, Pratonton, student attempt).

## 1. Summary and goal

One rajah/petikan/jadual is stored once and used by several questions or parts (stimulus group, D6). Today an admin edit of a shared stimulus silently changes every sibling without review (old defect f, repeated in new `applyLive`), a group cannot be changed after publication, a question can carry only one stimulus, parts cannot carry a stimulus, and only 2 of the 15 old kinds can be added.

Goal: finish the shared-stimulus mechanism so that
1. an edit never propagates silently: the admin chooses "Ubah untuk semua N soalan" or "Salin untuk soalan ini sahaja" (FB-027);
2. a question/group carries 1-3 stimuli and a part can carry its own (FB-028);
3. every old stimulus kind can be authored (including the manual path with image upload), is rendered identically for admin preview and student, and has clear alt-text rules (FB-029);
4. a Terbit question can be attached to / detached from a stimulus group by a new version (FB-030);
5. the student sees group and part stimuli pinned (panel at >= 1024 px, sticky chip + sheet below) and a missing file shows "Rajah tidak dapat dimuatkan.".

## 2. Users / personas

| Persona | Role in this feature |
|---|---|
| Admin Pusat (SPM content admin) | Authors stimuli, edits shared stimuli, attaches/detaches, reviews groups |
| Penyemak (reviewer, same admin portal) | Approves/rejects a group revision as one unit |
| Murid | Reads the pinned stimulus while answering questions and parts |
| Guru / Admin Sekolah | Indirect: assemble sets from the bank; groups arrive whole (AC-07.3) |

## 3. Already delivered (regression guard, do not re-build)

| FB | Delivered behaviour | Regression check |
|---|---|---|
| FB-001 | Attach/detach renumbers plain-number labels in paper order; typed labels untouched; notes "Soalan dipindahkan supaya kumpulan kekal berturutan dan dinomborkan semula." / "Soalan dinomborkan semula mengikut susunan kertas." | Attach Rajah 1 to Soalan 1 in a batch: labels stay in sequence |
| FB-002 | Edit page and review item show "Rajah 1 dikongsi oleh 4 soalan: Soalan 1, 2 (soalan ini), 3, 4. Perubahan di sini terpakai untuk semua soalan tersebut." | The sentence appears with the real count and members; never "semua 1 soalan" for a 4-member group |
| FB-003 | Bank chip "Kumpulan N soalan" on every member of a group of 2 or more; drawer lists siblings | Chip count equals member count |

The FB-002 sentence is the wording for the "Ubah untuk semua" branch only; once FB-027 is built it must not be shown as if propagation were automatic (see AC-01.5).

## 4. User stories and acceptance criteria

MoSCoW in brackets.

### US-01 [M] Choose between changing all sharers and forking (FB-027)
As Admin Pusat, I want to decide whether an edit to a shared stimulus applies to every question that uses it or only to this question, so that no other question changes without my knowing.

- AC-01.1 Given a Terbit question whose stimulus is used by N >= 2 questions (group members or parts), when I open "Sunting" and change any stimulus field (label, caption, alt text, source, text/table/body, image, kind, or the stimulus list), then on save I must choose one of two options before the revision is created: "Ubah untuk semua N soalan" or "Salin untuk soalan ini sahaja", with N equal to the number of live sharers.
- AC-01.2 Given the choice is shown, then neither option is preselected and save stays unavailable until one is chosen (no default, no silent propagation). [The old system has no default: Studio changed all silently, Panel forked only for other papers.]
- AC-01.3 Given I did not change any stimulus field, then no choice is asked and the revision touches only this question.
- AC-01.4 Given the stimulus is used by one question only (N = 1), then no choice is asked and the stimulus changes with that question's new version.
- AC-01.5 Given the choice is shown, then the sharer sentence of FB-002 is shown with the names of all N questions, and the two options state their effect: "Ubah untuk semua N soalan" = all N receive a new version and are reviewed together; "Salin untuk soalan ini sahaja" = only this question changes and leaves the group.
- AC-01.6 Given any stimulus approval, then after approval no sibling shows changed stimulus content unless it was part of the "Ubah untuk semua" revision that was approved (server-side check; replaces `applyLive` overwriting `BANK.stimuli` for all siblings).
- AC-01.7 Given a sharer already has a revision waiting for review, when I start a stimulus change on any sharer, then the save is refused with "Sudah ada versi baharu menunggu semakan" naming that question.

### US-02 [M] "Ubah untuk semua N soalan": all sharers become one reviewed unit (FB-027)
As Penyemak, I want a changed shared stimulus reviewed once for all its questions, so that the group never publishes half-changed.

- AC-02.1 Given I chose "Ubah untuk semua N soalan", then each of the N questions gets version n+1 (their own stems/keys unchanged unless I also edited this question) and the queue shows ONE item "Kumpulan N soalan" (same unit as a new batch group).
- AC-02.2 Given that item, then the stimulus is shown once with before/after, the decision text says "terpakai untuk semua N soalan" with the true N, and the sharer sentence of FB-002 is present.
- AC-02.3 Given I approve, then all N new versions become live in one step; given I reject or ask for correction, then all N stay on their previous live version. A partial decision is impossible.
- AC-02.4 Given the item is pending, then all N questions keep serving their previous live version (stem and stimulus) until approval.
- AC-02.5 Given approval, then each of the N histories records the new version with the same note and the member list; a published paper that references question id + version (Bijak AC-23.5, QB AC-21.5) keeps showing the version it references. [Assumption A2]
- AC-02.6 Given a group of up to 76 questions (largest observed, D6 rationale), then the approval is still atomic: either all versions are live or none.

### US-03 [M] "Salin untuk soalan ini sahaja": fork with notice (FB-027)
As Admin Pusat, I want to give one question its own copy of the stimulus, so that I can correct it without touching the others.

- AC-03.1 Given I chose "Salin untuk soalan ini sahaja", then a new stimulus (new id, label and content as I edited) is created, the question's new version n+1 references it and no longer belongs to the old group; the old stimulus and the other N-1 sharers are unchanged and need no review.
- AC-03.2 Given the fork, then the new version goes to the normal single-question review (not a group item); the old group keeps its remaining members and its stimulus.
- AC-03.3 Given the old group is left with one member, then it stays valid (a group of one, D6 Fizik case); the "Kumpulan N soalan" chip shows only for groups of 2 or more (FB-003).
- AC-03.4 Given the fork is saved and the original stimulus is also used by M >= 1 papers (draft or published), then the admin sees the old Panel notice verbatim: "Petikan telah dikemas kini. Ia dikongsi dengan kertas lain, jadi satu salinan dibuat untuk kertas ini sahaja." followed by the count of other papers and other questions still using the original (Bijak AC-24.4). [Fidelity note D1: "kertas ini" is the old wording; v2 forks per question. Kept verbatim because the user asked to replicate it; wording difference is logged in section 8.]
- AC-03.5 Given the fork, then no other paper changes: papers reference id + version, so papers using the original keep the original stimulus.
- AC-03.6 Given I later want the question back in the group, then the attach flow of US-09 applies (the copy is then an orphan and is not offered again).

### US-04 [M] 1 to 3 stimuli per question or group (FB-028)
As Admin Pusat, I want a question or group to carry up to three stimuli, so that papers such as BM Komsas (poem + text) can be authored and shown.

- AC-04.1 Given a question or group, then it can hold 1, 2 or 3 stimuli in a stated order (old pivot `position`); the order is shown and can be changed.
- AC-04.2 Given a fourth stimulus is added, then it is refused with "Satu soalan atau kumpulan boleh mempunyai paling banyak 3 rangsangan." [PROPOSED]
- AC-04.3 Given a question has stimuli, then the count of stimuli it displays (group's + its own) is at most 3.
- AC-04.4 Given a question that already has 2 or 3 stimuli (old data: 14 and 8 questions), when I open "Sunting" or the intake editor, then the stimulus box is shown and every stimulus can be edited and saved. The old behaviour of hiding the form for multi-stimulus questions (defect g, `skipStimulus`) is not replicated; saving never drops a stimulus (the data-loss incident behind that bypass).
- AC-04.5 Given a group with several stimuli, then all of them are shared by every member and appear in the student panel in the stated order.
- AC-04.6 Given a question belongs to a group, then it belongs to exactly one group (existing rule "(dalam kumpulan lain)").
- AC-04.7 Given alt text, label or any field of one stimulus fails validation, then the message names that stimulus by its label.

### US-05 [M] Part-level stimulus (FB-028)
As Admin Pusat, I want a stimulus on one part of a structured question, so that Sejarah (c) sources and BM Komsas texts are modelled as in the old system.

- AC-05.1 Given a part (a), (b)(i) ..., then I can attach one existing or new stimulus to it (`stimulus_ref`, old `question_parts.stimulus_id`).
- AC-05.2 Given a part stimulus, then it is stored once and may also be used by other parts or questions; it is subject to the same fork choice (US-01) and the 3-stimuli limit counts it.
- AC-05.3 Given Pratonton, review and paper preview, then a part stimulus is shown with that part (old: printed after the part).
- AC-05.4 Given the student answers that part, then its stimulus is reachable in the pinned panel/chip (US-10).
- AC-05.5 Given sharer counts, then a part using the stimulus counts as a sharer and the sentence names it ("Soalan 6 (b)").

### US-06 [M] Stimulus kinds: the old 15, how each renders, alt-text rules (FB-029)
As Admin Pusat, I want every kind the old system supported, so that no existing material is lost.

Old values (report E3, `stimulus_kinds`) and the v2 disposition. "Same renderer" = admin Pratonton, Intake editor, Semakan and student use one rendering (no separate admin look).

| # | Old kind | Old render | v2 disposition | Priority | Alt text |
|---|---|---|---|---|---|
| K01 | `passage` | title, rich text, `source_citation` | Keep; source line under text | M | not required |
| K02 | `box` ("Bahan") | boxed material list | Keep as boxed passage; exact old layout unobserved (open question Q1) | S | not required |
| K03 | `table` | image or HTML table | Keep; head/rows table or table image; wide table scrolls inside its own container | M | required only if shown as an image |
| K04 | `diagram` | svg / asset image / html | Keep; image upload and inline vector | M | required |
| K05 | `graph` | as diagram, caption "Graf" | Keep; caption default word "Graf" when no caption | M | required |
| K06 | `image` | picture + text | Keep (photo) | M | required |
| K07 | `infographic` | picture + text | Keep (renders as image) | S | required |
| K08 | `code` | pre/code | Keep as one monospaced block kind | C | not required |
| K09 | `pseudocode` | pre/code | Same renderer as K08; stored as a label of the code kind | C | not required |
| K10 | `sql` | pre/code | Same renderer as K08 | C | not required |
| K11 | `math` (MathML baked at save) | formula block | Keep as a formula block written with `$latex$` spans (D41-2); MathML baking is not replicated | S | not required |
| K12 | `audio` (`max_plays`) | player, play limit | Won't in v2.0: deferred with Listening (D6 rule 5, D7); kind reserved | W | transcript rule decided with Listening |
| K13 | `video` | placeholder "akan datang" | Won't: old only shows a placeholder, nothing to convert | W | n/a |
| K14 | `map` | as diagram, caption "Rajah" | Keep; caption default word "Rajah" | M | required |
| K15 | `cartoon` | picture + text | Keep (renders as image) | S | required |

- AC-06.1 Given the kinds marked M, S and C, then each can be created, edited, saved, previewed and shown to the student; "Won't" kinds are not offered.
- AC-06.2 Given any kind, then it has a label ("Rajah 3", "Teks 2", "Bahan 1") used in headings, chips and notices, and an optional caption.
- AC-06.3 Given a passage, then the optional source line (`source_citation`) is stored and shown under the text (observed on old published paper #9); the field is added back to the model.
- AC-06.4 Given a passage, e-mel, notis, iklan, sajak or tajuk akhbar, then it is a `passage` with the descriptive text in its label; no new sub-kind field is introduced (not in the old system).
- AC-06.5 Given an image-like kind (K04-K07, K14, K15), then alt text is required: publish and approval are blocked with "Teks alternatif (alt) bagi rajah diperlukan." (existing copy), naming the stimulus.
- AC-06.6 Given alt text, then it describes what the figure shows in Bahasa Melayu (or the paper language), is shown nowhere visually unless the image fails, and an empty or whitespace value is invalid. Old data without alt (379 of 1,139 images) is flagged at migration, not silently filled.
- AC-06.7 Given a figure, then it scales to the viewport and can be enlarged (QB AC-24.3); a table or formula wider than the screen scrolls inside its own container (QB AC-25.2).
- AC-06.8 Given changing a stimulus's kind during a revision, then alt/body validation of the new kind is applied before save.

### US-07 [M] Intake can add every kind, including the manual path (FB-029)
As Admin Pusat, I want to add any stimulus while writing or reviewing a batch, so that the manual path is not limited to a petikan.

- AC-07.1 Given the Intake review editor of an extracted batch and the manual path ("Mula menulis soalan" after the Sumber/hak cipta declaration), then both offer the same set of kinds (US-06), with "Tambah rajah" and "Tambah petikan" kept and the other kinds reachable from the same place (no separate page).
- AC-07.2 Given "Tambah rajah" on the manual path, then I can upload an image file, give it a label, caption and alt text, and see it in the editor; the saved stimulus shows the uploaded figure (the old Studio upload step; closes the "Tambah rajah" gap of 13.9.3 b).
- AC-07.3 Given an uploaded file of a type or size not allowed, then it is refused with a message naming the rule. [Allowed types and size limit: open question Q2]
- AC-07.4 Given an uploaded image or vector file, then the system never runs any script inside it, and a file that cannot be read as an image is refused. (Security review required at G4.)
- AC-07.5 Given a table, then I can enter head and rows (or upload a table image); given a code kind, then I can enter text and choose kod / pseudokod / SQL as label.
- AC-07.6 Given the stimulus is saved in a batch, then its figure content is persisted and still displayed after reload and after approval (closes audit A18: figure content not persisted from intake).
- AC-07.7 Given an extraction run that crops a figure or table from the page, then the crop is stored as an image/table stimulus with the page region kept (QB AC-04.4) and the same alt-text rule. [Dependency: extraction pipeline lane; not built here]
- AC-07.8 Given a stimulus is shared in a batch, then attach/detach, contiguity, renumbering and the group header behave as delivered in FB-001; the validator message "Soalan dalam satu kumpulan mesti berturutan." still blocks a non-contiguous group.

### US-08 [S] Pratonton and bank list show kind, members and part use (FB-029, FB-028)
As Admin Pusat, I want to see what a stimulus is and where it is used, so that edits are informed.

- AC-08.1 Given Pratonton, review item or Bank edit of a stimulus, then it shows label, kind, caption, source and the list of sharers (questions and parts) with count.
- AC-08.2 Given the chip "Kumpulan N soalan" (FB-003), then it also appears for a question that has part-level sharing of its stimulus only if the stimulus is used by 2 or more questions or parts.
- AC-08.3 Given a stimulus with 2 or 3 entries, then Pratonton shows them in order, each once.

### US-09 [S] Attach or detach a stimulus on a Terbit question (FB-030)
As Admin Pusat, I want to put an already published question into a stimulus group or take it out, so that groups can be fixed after publication without re-importing.

- AC-09.1 Given the Bank edit page "Sunting" of a Terbit question, then it offers "Kumpulkan dengan rangsangan…" (picks an existing stimulus/group of the same subject) and, for a member, "Keluarkan dari kumpulan" (no new screen).
- AC-09.2 Given I attach question Q to group G and save, then Q gets version n+1 referencing G, and ONE review item "Kumpulan N+1 soalan" is queued showing the new member highlighted; the existing members keep their version number and keep serving unchanged.
- AC-09.3 Given the item is approved, then Q is live in G (position stated, appended last by default) and G's membership changes at the same moment; given it is rejected, then Q and G are as before.
- AC-09.4 Given I detach Q, then Q gets version n+1 with no group reference; the group item is queued as one unit for the remaining members; after approval the former members are unchanged. A detached question keeps no stimulus (stem must stay valid: if the stem depends on the stimulus, the validation warning from the review applies, not a hard block).
- AC-09.5 Given Q is already in another group, or has a revision waiting, or the 3-stimuli limit would be exceeded, then attach is refused with the reason ("(dalam kumpulan lain)", "Sudah ada versi baharu menunggu semakan", or the AC-04.2 message).
- AC-09.6 Given attach or detach, then no other question is moved or renumbered (bank questions carry no paper order); the position of Q inside G is shown.
- AC-09.7 Given a draft paper contains some but not all members of a group after approval, then the paper shows a blocking warning that the group is incomplete and cannot be published until completed or split knowingly (Bijak AC-23.3). A published paper is unaffected (it keeps the versions it references). [The split-with-warning path of AC-23.3 is not built; tracked there, not duplicated here.]
- AC-09.8 Given the history of Q and G, then attach/detach is recorded with who, when and the note.

### US-10 [M] Student sees the stimulus pinned for groups and parts (FB-028, FB-029)
As Murid, I want the stimulus kept in reach while I answer, so that I never lose the text or figure.

- AC-10.1 Given a viewport >= 1024 px, then the stimulus of the current question/part is shown in a pinned side panel next to the question; given < 1024 px (including 768 and 375), then a sticky chip with the stimulus label is shown and opens a bottom sheet. [The v2 docs say 1280 in AC-07.1 and NFR-01; the code uses the 1024 breakpoint. Open question Q3.]
- AC-10.2 Given I open and close the sheet, then my typed or selected answers are preserved.
- AC-10.3 Given a group, then the stimulus is shown once for all members (not repeated under each question) and each member shows "berdasarkan {label}" (existing text; AC-07.2 wording stays PROPOSED).
- AC-10.4 Given a group of any size or position inside a section (for example Q5-8 of 40), then pinning works per group, not per section (fixes old defect d).
- AC-10.5 Given a question or group with 2 or 3 stimuli, then all are reachable in their stated order from the panel or sheet.
- AC-10.6 Given a part with its own stimulus, then while that part is current the panel/chip shows it in addition to the question/group stimuli; the chip label names it.
- AC-10.7 Given a stimulus whose file fails to load, then the question shows "Rajah tidak dapat dimuatkan." with "Cuba lagi" and "Lapor"; "Seterusnya" and "Semak" stay available only where the question does not need the stimulus (Bijak AC-07.4).
- AC-10.8 Given a Terbit question whose stimulus asset is missing at serve time, then the question is not served and is flagged to Admin Pusat (QB AC-24.4); the publish gate also blocks publishing it (D6 "stimulus assets resolve"). The load-failure message of AC-10.7 is for a failure after serving. [Reconciles QB AC-24.4 and Bijak AC-07.4: different moments.]
- AC-10.9 Given Latih Tubi / practice drills, then all stimuli of a question are shown, not only the first (old defect, `BIJAK-SPM-cloud.md:183`).
- AC-10.10 Given Jana Kertas or any assembly, then a group is included whole and in order (Bijak AC-07.3); a figure is never omitted from a question that needs it.

## 5. Old defects (13.9.1 a-h) and what happens to them

| Defect | Fixed here by | Status |
|---|---|---|
| a. No group entity or range | `GroupDef` built; groups reviewed as units | Already built; kept |
| b. No UI to attach an existing stimulus to more questions | Intake checkbox/select (built); Terbit question attach/detach | US-09 |
| c. Importers duplicate or single-link stimuli | Stored once, re-import reuses (D6 rule 1); crops via extraction | Migration hand-over; AC-07.7 |
| d. Pin works only for the whole section | Pin per group and per part | AC-10.4, AC-10.6 |
| e. Assembly splits groups, publish gate ignores group integrity | Whole-group add (built); incomplete group warning on draft papers; gate checks assets | AC-09.7, AC-10.8, AC-10.10 |
| f. Edits hit every sharer silently; fork only cross-paper | Mandatory choice, group review, fork | US-01..US-03 |
| g. Multi-stimulus questions bypass the form | Form always shown, 1-3 stimuli editable | AC-04.4 |
| h. Panel edit dialog limited and crashes | Not carried into v2: one edit surface (Bank "Sunting"); Panel dialog not rebuilt | Out of scope |
| Part-level stimulus exists in old, absent in new | `stimulus_ref` on a part | US-05 |

## 6. Non-functional requirements

| Area | Requirement |
|---|---|
| Localisation | All admin and student strings in Bahasa Melayu, exact text as quoted; labels such as "Rajah", "Teks", "Bahan" are data, not hard-coded English |
| Responsive | Admin screens and student panel/sheet work at 375, 768 and 1280 px with no horizontal page scroll; tables, formulas and wide figures scroll inside their own container; touch targets >= 44 px on the student side; E2E at all three sizes |
| Accessibility | Replicates live (D10), no enhancements, except the alt-text requirement above; the sheet and chip are operable by keyboard as in the existing attempt shell; no new motion |
| Performance | Fork/approval of a group of 76 members completes as one atomic step and the review item loads with the stimulus once; the student panel opens a cached stimulus without a new round trip when it is already loaded |
| Data integrity | A stimulus is stored once; versions are immutable; approval of a group is all-or-nothing; no sibling content changes without an approved revision that lists it |
| Security | Admin-only (D30; others get 403 without leaking content); uploaded files validated by real content type and size, never executed; reviewer must not be the AI service (QB approve rule); security review at G4 because of file uploads |
| Audit | Every fork, attach, detach and group approval is written to the history of each affected question |
| Privacy | Seeds and examples use fictitious names; source lines name publishers/exam boards only where observed public anchors |

## 7. Scope and assumptions

In scope: US-01..US-10 as above; stimulus versioning needed by them; data fields `kind`, `label`, `caption`, `alt`, `source_citation`, body/table/asset, ordered stimulus list per question/group, part reference.

Out of scope (Won't in v2.0): audio kind (deferred with Listening, D6/D7); video kind (placeholder only); MathML baking; a separate Panel stimulus-edit screen (defect h); the split-knowingly path of Bijak AC-23.3 (own work item); migration scripts (hand-over to the migration lane: 946 orphans dropped, 63 non-contiguous groups flagged, 379 images without alt); reordering a group's members after publication; changing the student attempt layout beyond the stimulus panel/chip.

Assumptions:
- A1: There is no entry point to edit a stimulus from the paper builder; Bijak AC-24.4 ("edit from this paper") is met through Bank "Sunting" plus the count of papers shown in AC-03.4.
- A2: A paper stores question id + version (QB AC-21.5, Bijak AC-23.5), so a new version does not change a published paper; old Panel edits likewise only reached a draft paper.
- A3: A stimulus belongs to one subject; attach offers only same-subject stimuli.
- A4: Contiguity is a property of a paper/batch order; a bank group is an ordered member list, so a fork or detach in the middle of a group does not break any group.
- A5: Visual design, component choice and storage are decided at G2, not here.

### Ownership and hand-over (no design here)
- The shared exam types (`StimulusDef`, `GroupDef`, `PartDef`, `QuestionDef` in `m28-bijak-spm/domain/types.ts`) are scheduled to move into the shared exam-core package in the backend programme, lane PC-3 (BE-14, half AZ). This feature needs those types to carry: more kinds, `alt`/`source_citation`, a versioned stimulus, an ordered list of 1-3 stimulus references on question and group, and a stimulus reference on a part. Hand-over note for PC-3: coordinate so the type edits happen once, either before or inside the coordinated move; the frontend build of this feature must not fork the types.
- Question/stimulus storage contracts belong to the question-bank owner (M04/BE-09 service); migration of old stimuli belongs to PC-4; extraction crops to PC-5.

## 8. Fidelity deviations (D9) and open points

| Item | Old | Here | Reason |
|---|---|---|---|
| Fork notice | "…satu salinan dibuat untuk kertas ini sahaja." (Panel, per paper) | Same sentence, shown on a per-question fork when other papers use the original, plus counts | Old sentence replicated; "kertas ini" is slightly off in the bank context |
| Silent in-place edit of a shared stimulus (Studio) | All sharers change, no notice | Mandatory choice | Broken: contradicts review rules |
| Multi-stimulus bypass | Form hidden | Form shown | Broken: lost data / unusable |
| Pin per section | Section-wide only | Per group and per part | Broken: sub-ranges never pinned |
| code / pseudocode / sql | 3 kinds, same render | One code kind, 3 labels | Same render; no overlap |
| `video` | Placeholder | Dropped | Nothing to convert |

## 9. Open questions

None block G2.

| ID | Question | Why open | Default if unanswered |
|---|---|---|---|
| Q1 | How does the old `box` ("Bahan" list) look and behave exactly? | Only the code location is known; the Blade page was never opened | Render as a boxed passage with its label |
| Q2 | Allowed upload types and maximum size for stimulus images | Old rule is in `StimulusUploadHandler.php`, not read | Lead or developer reads the old handler and copies the limits |
| Q3 | Pin breakpoint: 1024 px (code, this request) or 1280 px (Bijak AC-07.1, NFR-01, design S3)? | The v2 docs contradict the code | 1024 px; update Bijak AC-07.1 and NFR-01 when approved |
| Q4 | Should an unapproved group revision (US-02) also queue for a second reviewer? | The old system has no multi-reviewer step | One reviewer, same as a new batch |

Risks: R1 figure persistence is not built in the prototype (audit A18), so US-07 and US-10 depend on it; R2 a 76-member group revision is a heavy unit; R3 group-incomplete warning (AC-09.7) leans on the unbuilt split path of AC-23.3; R4 hand-over timing with BE-14 (type move) can cause merge conflicts in `types.ts`.
