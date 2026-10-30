# ADR-0030: One `ServedQuestion` model; practice and Bijak bridges serve every production shape

Status: Proposed
Date: 2026-10-30

## Context
The practice bridge serves a single text-only MCQ with no stimulus or option image (`be09-practice-mapping.ts`). The Bijak bridge refuses image stimuli, option images, `table_fill`, multi-stimulus groups (`be09-mapping.ts`) and exam-core has no image stimulus (inline text or SVG only), no `essay_choice`. Production approved parts: mcq 532, extended_essay 229, short_text 49, essay_choice 31, numeric 7. Stimulus kinds: passage, image, diagram, table, map, infographic, graph.

## Decision
1. Define `ServedQuestion` in `packages/contract/src/serving/served-question.ts`: `{ id, versionNo, subject/level/unit labels, group?: { id, label, stimuli[], optionBank? }, stimuli[], stemImage? (an `image` stimulus), parts[] (tree), explanation? }`. Stimulus = `{ id, kind (7 kinds), label?, title?, text?, source?, caption?, alt?, file?: { fileId, width, height }, svg?, table? }`. Option = `{ label, text, image?: FileRef }`. Part modes sent to students: `mcq, short_text, numeric, extended_essay, essay_choice` plus the existing `working, match_letter, drawing` which stay supported where exam-core already renders them. Answer keys never appear.
2. exam-core (`packages/exam-core`) is extended: `StimulusDef` gains `image|map|infographic|graph` with a file reference; `McqOption` gains `imageFileId`; `PartDef` gains `essay_choice` (topics, word range, scheme points/rubric). Pure types and marking only; no file access.
3. One mapper `questions/serving/to-served.ts` converts a bank record to `ServedQuestion`. Both bridges call it. The Bijak bridge adds its exam-core projection on top; the practice bridge projects to the MCQ quiz shape (`PracticeQuestion` gains `stimuli`, `stemImage`, `options[].image`, `group`). Bank part `essay` is exposed as `extended_essay` on the wire (alias table in the contract).
4. **No silent drops.** A shape an activity cannot serve is excluded by a named rule in `activity-rules.ts` (ADR-0028) with a BM reason; the bridges no longer return `null` without a code. Explicit remaining exclusions (zero production rows): `table_fill`, multi-blank `short_text`, `anyOrder`, `sigFigs/decimals` numeric, `reveal: never`, more than 3 stimuli in a group. Reason code `shape_unsupported:<detail>`.
5. Games and Battle serve MCQ (2-4 options) without images and stimuli; a question with a stem image, option image or stimulus is excluded with `has_image_game` / `grouped_unsupported` (AC-13.2).
6. Image bytes: the wire carries `fileId` (decimal string) and size; the browser loads `GET /api/files/:id` under the existing pupil read rule (question images, already built). No signed URL.
7. Missing activities are built on the same model: Simulasi Kuiz and Pembetulan on practice sessions/answers (M05 owner), paper quiz on the Bijak paper read plus a stateless check endpoint.

## Consequences
- Frontend adapters map `ServedQuestion` to the FE-P5 display components (`src/components/question-display`), not the reverse.
- Multi-leaf (structured) questions remain out of the MCQ quiz activities by rule, but are served by Struktur, Subjektif, Mock K2 and Simulasi.
- Marking stays on the server (AC-10.8); exam-core remains the single marking implementation.
