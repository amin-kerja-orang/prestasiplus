# ADR-0031: DSKP tags per leaf part and the approval gate; "Belum ditanda DSKP" for legacy

Status: Proposed
Date: 2026-10-30

## Context
D53h/D76: questions tag curriculum nodes only; TP and cognitive level are per leaf part; KBAT = Mengaplikasi, Menganalisis, Menilai, Mencipta (D83 D-4: cognitive level mandatory per leaf at new approval). Today TP is one value per version (`difficulty_tp`) and `question_versions.cognitive_level` is a single int. D80 DEC-2: untagged legacy MCQs stay servable in practice/games and are excluded from blueprint papers and Jana Kertas.

## Decision
1. `question_parts` gains `tp smallint` (1..6) and `cognitive_level text` (`mengingat, memahami, mengaplikasi, menganalisis, menilai, mencipta`), both nullable, set on leaf parts only (check: branch parts have both null). Part `topics jsonb` is added for `essay_choice` (ADR-0030).
2. `question_versions.difficulty_tp` stays and is derived at save as the highest leaf TP (AC-03.6). The old int `question_versions.cognitive_level` is deprecated and no longer read; KBAT is read from `question_version_facts.has_kbat` (any leaf with one of the four levels) and per-part for blueprint KBAT marks.
3. The curriculum link remains `unit_node_id` + `question_version_sp_nodes` (1..3 SP) + subject + level (existing `checkTagGate`). Free-text tags are rejected (existing 422).
4. **Approve gate** (`review -> approved`, button Terbitkan) = the merged old approve and publish gates + new rules: every leaf has `tp` and `cognitive_level` ("Bahagian (b) belum ada aras pemikiran."); unit node present; kertas present when the question is SPM-bound (subject is in `spm_subject_configs` and level is Tingkatan 4 or 5); media resolved. The response lists every issue as `{ path, code, message, step }` where `step` is the wizard section (Langkah 1-4). Draft saves never run it.
5. `question_version_facts.dskp_complete` = unit node + >=1 SP + all leaves TP and cognitive level. It is computed on every write. The admin badge "Belum ditanda DSKP" is `NOT dskp_complete`.
6. **Legacy rule (DEC-2).** Rules keyed `legacy_untagged` apply only to blueprint-governed activities: Jana Kertas pool, blueprint conformance, Disahkan paper builder. Practice family, games and Bab do not require `dskp_complete`. The DSKP part of the gate applies at the next approval of an edited legacy question (AC-03.9); a legacy question that is already approved and untouched stays approved. A teacher reference question ("Soalan Guru (rujukan)", auto-approved as in .cloud) is stored with `source_kind = 'guru_rujukan'` and behaves like legacy.
7. Bulk approve (legacy list) runs the same gate per item; failures are returned with reasons and are not approved (AC-03.3).

## Consequences
- Backfill (migration 0101): `dskp_complete` false for all loaded legacy questions; no tp/cognitive data is invented.
- Contract: leaf parts gain `tp`, `cognitiveLevel`; question read gets `dskp: { complete, issues[] }`.
- Intake accept (`to-question.ts`) must carry the AI/editor leaf TP and cognitive level into the draft.
