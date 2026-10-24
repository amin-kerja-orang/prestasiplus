# v2 DSKP integration: curriculum catalogue and question tagging

Slug: `v2-dskp-integration` · Date: 2026-10-24 · Track: Full (G1) · Priority: highest (user, system audit FB-026) · Status: **draft for G1 approval**

## 1. Summary and goal

Questions in the bank are tagged against a real, controlled DSKP list instead of the 12 prototype units. Today the Tag DSKP block in the question intake (m28) offers 12 unit codes for 3 subjects, takes SP as free text, defaults TP to 3 and has a publish gate that is weaker than the submit gate. The 13 official DSKP extracts (`docs/reference/dskp/*.json`) are not used by any code.

Goal: one DSKP catalogue (13 subjects, Tingkatan 4 and 5) owned by M03; every tag on a question (subject, tingkatan, unit, SK, SP, TP, optional KBAT) is chosen from it; the same tag rule is enforced at submit, revision and publish; every seed question carries a real tag or an explicit "perlu semakan" flag.

Sources: FIXLOG P-026 and FB-026 (`docs/qa/audit-sistem/FIXLOG.md`); user answers recorded 2026-10-24 (`v2-question-bank.md` §4.8 block "User decisions 2026-10-24"); audit report §13; `v2-exam-schema.md` D9; `docs/reference/dskp/README.md`.

Rules applied (CLAUDE.md §6, §8): convert from the old system and fix what is broken; no redesign; no redundant screens (the Tag DSKP block keeps its place and is reused by intake, manual entry and Sunting; no new screen is added). Old systems are never modified.

## 2. Users / personas

| Persona | Role code | Needs from this feature |
|---|---|---|
| Admin Pusat | `admin` | Tags, confirms and publishes questions; filters the bank by DSKP; sees the tag audit. Only role with intake access in the prototype (`routes/admin-intake.ts`). |
| Guru | `guru` | Same tagging, for own submissions, when Guru intake is enabled (QB spec; not in the prototype). |
| Murid | `pelajar` | Indirect: pools and papers are selected by unit/SP/TP. No new student screen. |
| Developer / data owner | n/a | M03 owner publishes the catalogue contract; m28 reads it. |

## 3. User stories

Priority: M = Must, S = Should, C = Could.

| ID | Pri | Story |
|---|---|---|
| US-01 | M | As the system owner (M03), I want one DSKP catalogue for the 13 subjects, T4 and T5, so that all modules tag against the same official list. |
| US-02 | M | As Admin Pusat, I want the catalogue to carry each subject's TP descriptors at the level the DSKP prints them, so that I can choose the right TP. |
| US-03 | M | As Admin Pusat, I want the two vocational subjects and the Jawi subject loaded correctly (Landskap dan Nurseri, Katering dan Penyajian, Pendidikan Islam), so that no DSKP subject is missing or mis-spelt. |
| US-04 | M | As a reviewer, I want to tag a question by picking unit and SP from the catalogue (SK derived), so that tags are valid and consistent. |
| US-05 | M | As a reviewer, I want TP 1-6 to be a deliberate choice with no default, and AI-suggested values to need my confirmation, so that a tag is never right by accident. |
| US-06 | S | As a reviewer, I want an optional "Aras KBAT" field separate from TP, so that KBAT questions can be marked without being derived from TP. **Form pending user confirmation.** |
| US-07 | M | As Admin Pusat, I want submit, revision and publish to enforce the same curriculum tag rule, so that no question reaches Terbit with a weaker tag than it needed for review. |
| US-08 | M | As Admin Pusat, I want every seed question tagged from the catalogue, with unmatched ones flagged for review, so that the bank has real tags from day one (D11: nothing guessed). |
| US-09 | M | As Admin Pusat, I want to filter the bank by unit, SP, TP and KBAT, so that I can find and review questions by curriculum. |
| US-10 | M | As Admin Pusat, I want the tag history (AI suggestion, final value, confidence, person) recorded, so that tag decisions are explainable (QB AC-05.5). |
| US-11 | M | As the system owner, I want curriculum ownership (D12) kept clear: M03 owns, m28 reads, and the other DSKP-like stores are named with a decision on their future. |

## 4. Acceptance criteria

### US-01 DSKP catalogue (M03)
- AC-01.1 Given the catalogue, then it holds exactly the 13 subjects of `docs/reference/dskp/` (Matematik, Matematik Tambahan, Fizik, Sains, Bahasa Melayu, Bahasa Inggeris, Sejarah, Pendidikan Islam, Tasawwur Islam, Pendidikan Moral, Pendidikan Seni Visual, Landskap dan Nurseri, Katering dan Penyajian) for Tingkatan 4 and 5.
- AC-01.2 Given a subject, then its tree is: Tingkatan -> grouping (Bidang / Tema / Learning Area where the DSKP prints one) -> unit (Tajuk / Topic / Learning Area / skill / Modul as the subject names it) -> SK (Standard Kandungan) -> SP (Standard Pembelajaran), with codes and text exactly as printed in the extract.
- AC-01.3 Given a code such as "1.1.1", then the key of any node includes subject and tingkatan (codes repeat across T4 and T5 in Matematik, Matematik Tambahan, Sains, Fizik, Bahasa Melayu, Bahasa Inggeris, Pendidikan Moral, Tasawwur Islam, Pendidikan Seni Visual); two nodes with the same code in different tingkatan are never confused.
- AC-01.4 Given the catalogue size (about 2,060 SP in total: roughly 1,130 in T4 and 930 in T5, from the extract counts), then every SP belongs to exactly one SK, every SK to exactly one unit, and the totals per subject and tingkatan equal the totals in the extracts after the known corrections (the README counts are regex counts, +/-1 per unit; the loader test reports any difference rather than hiding it).
- AC-01.5 Given the catalogue, then it is read-only for m28 and every other consumer; changes go through M03 only (US-11).
- AC-01.6 Given an English-edition subject (Matematik Tambahan, Sains, Fizik, Bahasa Inggeris), then titles are shown as printed (English); BM aliases are not invented in this phase (see Q-D9).
- AC-01.7 Given Pendidikan Moral, then T4/T5 contain only bidang 5-7 as printed; given Pendidikan Seni Visual, then all printed bidang are loaded even though only Persepsi and Apresiasi suit written questions (no filtering by suitability in the catalogue).
- AC-01.8 Given a node that the extract marks as reconstructed, inferred or misaligned (Sains T4 4.3.1 and one other reconstructed SP, Matematik Tambahan package mapping inferred from Table 8, Landskap dan Nurseri unaligned TP rows, Bahasa Inggeris "No learning standard" slots, Bahasa Inggeris Form 4 "DRAF 1/2018"), then the flag is carried into the catalogue and shown to the reviewer as "perlu semakan" [PROPOSED], not silently dropped.
- AC-01.9 Given Matematik, Matematik Tambahan and Fizik SPs whose formulae were images and are missing from the text, then they stay as printed text and no feature relies on their exact wording (README known limit).

### US-02 TP descriptors at the level each DSKP prints them
- AC-02.1 Given each subject, then TP 1-6 descriptors are stored at the level the DSKP defines them: per Tajuk/Topic (Matematik, Matematik Tambahan, Pendidikan Seni Visual), per Learning Area (Sains, Fizik), per SK (Sejarah, Pendidikan Islam, Tasawwur Islam, Pendidikan Moral), per skill/kemahiran (Bahasa Melayu strands 1.0-3.0, Bahasa Inggeris), per Modul (Landskap dan Nurseri, Katering dan Penyajian).
- AC-02.2 Given a question tagged to an SP, then the editor shows, next to the TP choice, the descriptor of the selected TP at the level that applies to that SP's subject (for example the Tajuk descriptor for Matematik, the SK descriptor for Sejarah). The descriptor is help text; it never changes the TP chosen.
- AC-02.3 Given Bahasa Melayu strands 4.0 (Aspek Seni Bahasa) and 5.0 (Aspek Tatabahasa) and Bahasa Inggeris 5.0 (Literature in Action), which print no TP, then no unit-level descriptor is shown for them; TP remains required (decision in Q-D2).
- AC-02.4 Given a subject that also prints a general TP table (for example Matematik "Jadual 4", Pendidikan Islam "Jadual 3"), then the general descriptors are stored and may be shown as the fallback when a unit has none.
- AC-02.5 Given the TP scale, then it is 1 to 6 for every subject; no subject uses a different scale in the tagging field.

### US-03 Special subjects
- AC-03.1 Given Landskap dan Nurseri and Katering dan Penyajian, then they exist as subjects in the catalogue with their Modul > SK > SP structure (T4 modul 1-4, T5 modul 5-7 for Landskap; T4 modul 1-4, T5 modul 5-8 for Katering), and appear in every subject list that is driven by the catalogue (tag editor, bank filter). Neither exists in the system today.
- AC-03.2 Given Pendidikan Islam, then SK/SP/SPi text is the Jawi text from `pendidikan-islam.json`, rendered right-to-left where it is Jawi/Arabic, and every Pendidikan Islam node carries the flag "perlu semakan ejaan" (spelling review needed, about 110 SPs transcribed by hand from images).
- AC-03.3 Given a Pendidikan Islam node with the spelling flag, then a reviewer can still select it for tagging (the flag never blocks use) and the flag is visible in the catalogue and the pick list [PROPOSED label: "perlu semakan ejaan"].
- AC-03.4 Given Pendidikan Islam SK numbering, then it runs across forms as printed (T4 1.26-1.32, T5 from 1.33); no renumbering.
- AC-03.5 Given the two vocational subjects, then they are available for tagging even though no Bijak SPM blueprint or paper exists for them (blueprints stay out of scope, section 6).

### US-04 Tag DSKP editor (intake, manual, Sunting)
One editor block ("Tag DSKP") is used by Muat Naik Kertas -> Semak Ekstrak, Tulis Soalan Manual and Sunting (versi baharu); no screen is added.
- AC-04.1 Given a question, then the subject is fixed from the batch declaration (or the existing question) and the Tingkatan is chosen from Tingkatan 4, Tingkatan 5 or "Tingkatan 1-3 (di luar DSKP)"; there is no default value that hides an unset Tingkatan (the prototype default `T4+T5` is removed).
- AC-04.2 Given Tingkatan 4 or 5, then "Unit" lists only the units of that subject and tingkatan from the catalogue, shown with their grouping (Bidang/Tema) where printed and the unit code and title as printed; the 12 prototype units are removed.
- AC-04.3 Given a chosen unit, then "SP" is a pick list of that unit's SPs (multi-select by code and text; free text is not accepted; the old field "SP (asingkan dengan koma)" is replaced); the question needs at least one SP (D9 allows 1 to 3, see Q-D6).
- AC-04.4 Given one or more chosen SP, then the SK is derived and shown read-only (one SP belongs to one SK); if SPs from different SK are chosen, all their SK are shown.
- AC-04.5 Given an SP is chosen, then its unit is set to the SP's unit; the reviewer cannot pick an SP outside the chosen unit.
- AC-04.6 Given "Tingkatan 1-3 (di luar DSKP)", then Unit, SK and SP are disabled and not required, `unit` and `sp` stay empty, and TP is still required (LEAD decision FB-072).
- AC-04.7 Given a Tingkatan change after unit/SP were chosen, then the editor clears the now-invalid unit/SP and tells the reviewer ("Unit dan SP dikosongkan kerana tingkatan berubah" [PROPOSED]).
- AC-04.8 Given the editor at 375 / 768 / 1280 px, then the block has no horizontal page scroll, and the unit and SP lists are usable by touch with targets >= 44 px (FB-013 container layout kept); the SP pick list supports search by code or text because a unit can have dozens of SPs.
- AC-04.9 Given the AI suggests a unit/SP for an extracted question, then the suggestion is a catalogue node (never free text); an unmatched suggestion leaves the field empty and marked for the reviewer, not auto-filled with a guessed code (the prototype auto-fill "NN.1" is removed).

### US-05 TP mandatory, AI confirmation
- AC-05.1 Given a new question (extracted, manual or revision of an untagged one), then TP is empty until the reviewer chooses 1-6; the default 3 is removed.
- AC-05.2 Given an AI-suggested TP, then it is pre-selected only as a suggestion marked with its confidence, is always treated as needing confirmation (the prototype never flagged TP), and "Hantar untuk semakan" is refused until the reviewer confirms or changes it (QB AC-05.3 to AC-05.4; the Low-confidence rule applies to unit, SP and TP).
- AC-05.3 Given the existing confirmation control ("Saya sahkan unit DSKP (keyakinan rendah)"), then it is generalised so that each of unit, SP and TP that is Low confidence or AI-suggested can be confirmed, with the field name in the refusal message.
- AC-05.4 Given a question in a Tingkatan 4/5 and a TP of 1-6, then the editor accepts it only if the value is an integer 1 to 6; no other value can be saved.
- AC-05.5 Given the reviewer sets TP, then TP is independent of the difficulty field of the exam schema (`difficulty_tp` in D8 is a separate item; this feature neither sets nor derives it).

### US-06 KBAT as a separate optional field (form pending user confirmation)
- AC-06.1 Given the Tag DSKP block, then an optional select "Aras KBAT" offers Mengaplikasi, Menganalisis, Menilai, Mencipta; empty means "bukan KBAT" [PROPOSED form; **pending user confirmation**, see Q-D1].
- AC-06.2 Given KBAT, then its value is never derived from TP and TP is never derived from it ("KBAT derived as TP >= 4" in `v2-exam-schema.md` D9 is superseded).
- AC-06.3 Given KBAT is empty, then submit, revision and publish still pass (optional).
- AC-06.4 Given the AI suggests a KBAT level, then it is a suggestion that follows AC-05.2 (confirm before submit) [PROPOSED].
- AC-06.5 Given a bank filter on KBAT (US-09), then "Ya", "Tidak" and each of the four levels are available [PROPOSED].
- If the user chooses a different form (for example a yes/no switch), only AC-06.1, AC-06.4 and AC-06.5 change.

### US-07 Gates (submit, revision, publish)
- AC-07.1 Given a Tingkatan 4 or 5 question, then "Hantar untuk semakan", a revision submit and "Lulus & Terbit" (publish) all require: subject, tingkatan, unit, at least one SP and TP. The three gates call one shared rule (no separate weaker copy).
- AC-07.2 Given a Tingkatan 1-3 (di luar DSKP) question, then all three gates require subject, tingkatan and TP, and require no unit and no SP (FB-004, LEAD decision FB-072).
- AC-07.3 Given a failing tag rule, then the action is refused and each missing field is named in BM, for example "Unit DSKP belum dipilih", "SP belum dipilih", "TP belum dipilih" [PROPOSED; the existing publish message is "topik DSKP belum dipilih"]. Messages are identical in the editor, the review queue and the bulk action.
- AC-07.4 Given the publish gate, then it checks the unit code, the SP codes and the TP, not just a non-empty unit label (the prototype's `unitLabel` check is replaced).
- AC-07.5 Given an existing untagged question edited through Sunting, then the SP rule is not skipped: the prototype exception for "legacy" questions with no SP is removed because seed questions are tagged (US-08). A question that stays flagged for review (US-08) cannot be published until tagged.
- AC-07.6 Given a bulk action that includes a question failing the tag rule, then that question is reported and skipped, the others proceed (QB §4.8 "No bypass", E9).
- AC-07.7 Given a tag that is complete but contains a catalogue node that no longer exists, then the gate fails with the field named (catalogue changes are versioned by M03; see Q-D8).

### US-08 Seed tagging
- AC-08.1 Given the seeded bank (3 subjects in the prototype: Matematik, Sains, Sejarah), then every seed question has tingkatan, unit, SK, SP and TP taken from the catalogue, or is explicitly flagged "perlu semakan" with no unit/SP set.
- AC-08.2 Given a seed question whose tag cannot be matched to an SP with evidence (the question text or an authored mapping that a person has reviewed), then it is flagged, not tagged by guess (D11: "never invent records ... never tune values").
- AC-08.3 Given the flagged seed questions, then the count of flagged questions is computed from the data and shown to Admin Pusat (a bank filter "Perlu semakan tag" [PROPOSED]), and each flagged question is excluded from publishing until tagged (AC-07.5).
- AC-08.4 Given the seed unit labels that exist today as free text (for example "Gerakan dan Kecerunan", "Kebangkitan Nasionalisme" that have no exact title in the DSKP), then they are not copied as units; the mapping table from old label to catalogue node is part of the deliverable, and each row is "matched" or "no match" (never "closest").
- AC-08.5 Given the seed counts shown anywhere (bank totals, subject cards), then they are computed from the tagged dataset (CLAUDE.md D11) and unchanged by tagging, because tagging adds no and removes no questions.
- AC-08.6 Given the seed data is a shared store (m28 `data/builders.ts` and the tag source), then the change is made in an isolated worktree and merged only after `registry-boot.test.ts` and the module tests pass (CLAUDE.md shared working tree rule).

### US-09 Bank filter
- AC-09.1 Given the Bank Soalan SPM list, then filters exist for Unit (scoped by the chosen subject and tingkatan), SP, TP (1-6) and KBAT (US-06), in addition to the existing ones; the unit list comes from the catalogue.
- AC-09.2 Given a filter result, then the row count and the subject/unit counts are computed from the same query as the rows (QB NFR counts rule).
- AC-09.3 Given the filters at 375 / 768 / 1280 px, then the filter bar has no horizontal page scroll.
- AC-09.4 Given a bank row or card, then it shows the unit title and SP codes from the catalogue (not free text), and "Tingkatan 1-3 (di luar DSKP)" for exempt questions.

### US-10 Tag audit
- AC-10.1 Given a tag field (unit, SP, TP, KBAT) accepted or changed, then the audit trail records the AI-suggested value, the final value, the confidence and the person (QB AC-05.5).
- AC-10.2 Given a question tagged without an AI suggestion, then the audit records the final value and the person with the suggestion empty.
- AC-10.3 Given a revision (Sunting) that changes the tag, then the new version's history shows the before/after of the tag and the change note (the prototype's `history[]` gains the tag fields; the fixed admin name is replaced by the real user when the backend exists).
- AC-10.4 Given the audit, then entries cannot be edited or deleted from the UI (QB AC-15.3).

### US-11 Ownership (D12) and the other DSKP-like stores
- AC-11.1 Given the DSKP catalogue, then M03 is its single owner and exposes it through a contract (working name `dskpCatalog`); m28 reads it and keeps no schema of its own for units, SK, SP or TP descriptors (D12).
- AC-11.2 Given the four datasets in the audit (D-A m28 prototype list, D-B M03 fixture of Bab/Topik, D-C M10 Bidang/SK/SP fixture, D-D the DSKP extracts), then D-A is removed after the move, D-D becomes the catalogue's source, and the future of D-B and D-C is recorded as a decision (Q-D3). Until it is decided D-B and D-C are not changed.
- AC-11.3 Given the M04 legacy question form, whose optional "DSKP Tagging (Pilihan)" reads D-C, then it keeps working as it does today (a replicated .my flow, "Old systems are never modified") until the decision in Q-D4.
- AC-11.4 Given the M03 Bab/Topik taxonomy (D-B, a mirror of the live .my data), then it stays as is; the DSKP catalogue is an additional read-only tree beside chapters/topics, not a replacement (the backend plan lists `curriculum_nodes` separately from `chapters`/`topics`).

## 5. Non-functional requirements

| ID | Area | Requirement |
|---|---|---|
| NFR-01 | Performance | Opening the Tag DSKP block and showing the unit list takes <= [Default] 300 ms after the catalogue is loaded; the SP list (up to several dozen per unit) filters as the reviewer types without lag; the catalogue (about 2,060 SP) is loaded once per session, not per question. |
| NFR-02 | Integrity | The catalogue is versioned; a tag stores the catalogue version it was made against; a question's tag survives a catalogue update and is re-checked only by the gate (AC-07.7). |
| NFR-03 | Security | Only M03 can write the catalogue; role checks follow the existing rules (Admin Pusat for approvals); AI never sets a tag as final and never receives student or school data (QB NFR-04). |
| NFR-04 | Accessibility | Replicates the existing editor behaviour (D10): labelled controls, keyboard operation of the unit/SP lists, visible focus; no enhancements beyond the live pattern. |
| NFR-05 | Localisation | All UI copy in Bahasa Melayu (existing strings kept exactly; new strings are [PROPOSED]); catalogue text is shown as printed (BM, English for four subjects, Jawi for Pendidikan Islam); Jawi renders right-to-left with a font that supports Arabic script. |
| NFR-06 | Responsive | Every changed screen works at 320 / 375, 768 and 1280 px without horizontal page scroll; targets >= 44 px on touch (CLAUDE.md §7). |
| NFR-07 | Data privacy | No real personal names in seeds, mapping tables or docs; the DSKP text contains no personal names (panel/committee names are not copied). |
| NFR-08 | Consistency | Every count shown (flagged, filtered, per unit) is computed from the data it describes (D11). |

## 6. Scope

### In scope (v2.0)
- M03 DSKP catalogue: 13 subjects, T4 and T5, tree to SP, TP descriptors at the printed level, flags (Jawi spelling, reconstructed), contract for readers.
- m28 Tag DSKP block in intake, manual entry and Sunting: unit and SP pick lists, SK derived, TP mandatory with no default, confirmation of AI suggestions, T1-T3 exemption, optional KBAT (form pending).
- One shared tag rule for submit, revision and publish; consistent BM messages.
- Seed tagging and review flags; mapping of old prototype unit labels.
- Bank filter by unit, SP, TP, KBAT; tag audit (AC-05.5).
- Subjects Landskap dan Nurseri and Katering dan Penyajian added to every catalogue-driven subject list.

### Out of scope (v2.0)
- Replacing M03's Bab/Topik taxonomy or M10's fixture DSKP store (decision pending, Q-D3).
- Bijak SPM blueprints, papers and Jana Kertas for the 10 subjects that have none; they stay driven by blueprints (the subject list for papers does not grow just because the catalogue has 13).
- Other curriculum dimensions the DSKP prints as general sections: Elemen Merentas Kurikulum, Standard Proses Matematik, Science Process Skills, Kemahiran Pemikiran Sejarah, Elemen Kewarganegaraan dan Nilai Sivik, Fizik key verbs. Not taggable in v2.0.
- DSKP for Tingkatan 1-3, Darjah 1-6 and other forms (T1-T3 questions are only exempt, "di luar DSKP").
- BM aliases for English-edition titles, correcting extract errors beyond the logged ones, verifying Jawi spelling (flagged only).
- Duplicate detection, difficulty field (`difficulty_tp`), source/board field, paper-type list (FB-040), and the backend implementation (section 8).
- Changing any old system (prestasiplus.my, prestasiplus.cloud).

### Assumptions
- A1 The extracts in `docs/reference/dskp/` are the accepted source (independently audited 2026-10-16); the PDFs stay outside the repo.
- A2 The catalogue is loaded as data; no live DSKP service exists.
- A3 The prototype currently exposes intake to Admin Pusat only; Guru access follows the QB spec later.
- A4 Seed questions are limited to the subjects m28 seeds today (Matematik, Sains, Sejarah); other subjects have no seed questions to tag.
- A5 `v2-question-bank.md` §4.8 decision block (2026-10-24) and LEAD decision FB-072 are authoritative for gates and T1-T3.

## 7. Related decisions already made (do not reopen)

| Decision | Date | Source |
|---|---|---|
| M03 owns the DSKP catalogue; m28 reads it | 2026-10-24 | user, FB-026 |
| All 13 subjects in v2.0, incl. Landskap dan Nurseri and Katering dan Penyajian | 2026-10-24 | user, FB-026 |
| TP 1-6 mandatory, no default; AI-suggested TP must be confirmed | 2026-10-24 | user, FB-026 |
| KBAT is a separate optional field, not derived from TP (form pending) | 2026-10-24 | user, FB-026 |
| Pendidikan Islam uses Jawi text from the repo, flagged "perlu semakan ejaan" | 2026-10-24 | user, FB-026 |
| Seed questions tagged; unmatched flagged for review | 2026-10-24 | user, FB-026 |
| T1-T3 (di luar DSKP) exempt from unit and SP; TP required | 2026-10-24 | LEAD, FB-072 |
| Publish gate = submit gate | 2026-10-24 | user, FB-026 / P-026 |

## 8. Backend note (for G2, not a requirement on the "how")

- Contract owner: lane PC-2 (BE-08 `curriculum`, `m03-curriculum/api`) for the catalogue (`curriculum_nodes` is already planned in `docs/architecture/v2-backend-plan.md`, tree from D9) and the DSKP source, and the question-workflow gates in BE-10 (`questions-workflow`, with DSKP source). Gate logic that today lives in the m28 mock server (`server/admin.ts` `gateErrors`) must be the same rule the backend enforces (one rule, no front/back drift).
- This touches shared stores (M03 curriculum, m28 seed data) and the exam-core boundary; ownership is "half AZ". **LEAD decision required** on: the contract shape, which lane implements the loader, and the order relative to the 25 Oct freeze and 30 Oct go-live.
- Seed and fixture edits follow the shared working-tree rules (isolated worktree; `registry-boot.test.ts` green before merge).

## 9. Open questions

### Blocking (before G2 design)
| ID | Question | Why it blocks | Recommended default |
|---|---|---|---|
| Q-D1 | KBAT form: optional select "Aras KBAT" with Mengaplikasi / Menganalisis / Menilai / Mencipta (empty = bukan KBAT), or a yes/no switch? **Pending user confirmation.** | US-06, editor design, bank filter, schema field type | The 4-level select (it is what the DSKP prints; same cost). |
| Q-D2 | TP for units whose DSKP prints no TP (Bahasa Melayu strands 4.0 and 5.0, Bahasa Inggeris 5.0 Literature in Action): TP is mandatory by the user's decision, so what does the reviewer choose against? | AC-02.3, AC-07.1 for those units | TP stays required, chosen against the subject's general TP table (no unit descriptor shown). **Lead decision 2026-10-24 under the user's rule ("convert from the old system, fix what is broken, ask only when the old system has no answer"): default adopted.** |
| Q-D3 | Do M03's Bab/Topik taxonomy (D-B) and M10's fixture DSKP store (D-C, used by M08/M27 heatmaps and M04's legacy form) switch to the M03 DSKP catalogue now, later, or never? | Scope of US-11, risk to M04/M08/M10/M27 modules already approved | Not now: the catalogue is additional; D-B and D-C unchanged in v2.0; revisit after go-live. **Lead decision 2026-10-24 under the user's rule ("convert from the old system, fix what is broken, ask only when the old system has no answer"): default adopted.** |
| Q-D4 | The M04 legacy .my "DSKP Tagging (Pilihan)" form: keep reading M10's fixtures (replicated old flow) or read the new catalogue? | AC-11.3, fidelity vs one source of truth | Keep as is (old-system replica); no change. **Lead decision 2026-10-24 under the user's rule ("convert from the old system, fix what is broken, ask only when the old system has no answer"): default adopted.** |
| Q-D5 | Backend: who loads the catalogue and in what order (BE-08 contract, BE-10 gates), and is it before or after the 30 Oct go-live? | G2 task list and sequencing | LEAD decision; propose catalogue + gates after go-live unless the LEAD wants them before. |

### Non-blocking (defaults used unless the user disagrees)
| ID | Question | Default |
|---|---|---|
| Q-D6 | Maximum number of SPs per question: D9 says 1 to 3 (one per leaf part allowed); the user said at least 1. Cap at 3 or no cap? | At least 1; no cap in the first build, cap left to G2. |
| Q-D7 | The unit pick list: group by Bidang/Tema when printed (Matematik, Sains, Sejarah, Pendidikan Islam, etc.)? | Group and show the code; subjects without grouping show a flat list. |
| Q-D8 | Catalogue versioning rule: what happens to existing tags if M03 corrects a code or text (re-tag, keep version)? | Tags keep the catalogue version; a removed node fails the gate. |
| Q-D9 | BM aliases for the four English-edition subjects' unit titles (D9 QB: "keep English titles as key, add BM aliases"): this phase or later? | Later; titles as printed. |
| Q-D10 | Who confirms the Jawi spelling of Pendidikan Islam (about 110 hand-transcribed SPs) and when? | Flag only; review outside this feature. |
| Q-D11 | Seed mapping: which person reviews the old-label -> catalogue mapping table (US-08) before flagged questions are cleared? | Admin Pusat; each unmatched row stays flagged until reviewed. |
| Q-D12 | Tag audit storage detail (fields, retention) is left to G2; retention follows QB NFR-12 (audit 5 years). | Follow NFR-12. |

## 10. Risks

| ID | Risk | Mitigation |
|---|---|---|
| R1 | Catalogue extracts contain known gaps (missing formulae, regex counts +/-1, some missing codes such as Matematik Tambahan 6.2, 9.4). | Loader test reports differences; nodes flagged; no feature depends on exact wording of image-based SPs. |
| R2 | Pendidikan Islam Jawi text is not independently verified. | "perlu semakan ejaan" flag; usable but visibly provisional. |
| R3 | Seed questions may not match any SP and stay unpublishable. | Flagged count shown; they are blocked at publish (AC-07.5), never guessed (D11). |
| R4 | Mandatory SP and TP slow intake of large papers. | Pick lists search by code/text; AI suggestions pre-fill and the reviewer confirms; revisit timing in the pilot. |
| R5 | Removing the "legacy tag" exception makes older untagged questions uneditable until tagged. | Seeds are tagged first (US-08); no other legacy untagged questions exist in v2. |
| R6 | M03/M10/M04 modules already approved are affected if D-B or D-C change. | Out of scope for v2.0 (Q-D3, Q-D4); defaults leave them unchanged. |
| R7 | Backend and mock drift on the tag gate. | One shared rule (section 8). |
