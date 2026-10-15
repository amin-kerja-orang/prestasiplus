# Bank Soalan v2: problems found in the old system (prestasiplus.cloud)

Evidence for TRACKER D41. Paths are relative to `prestasiplus-reference/backend`. Source: two read-only code investigations on 2026-10-16. Fold these into `v2-question-bank.md` when the requirements are updated after the visual mockup review.

## A. Several questions sharing one diagram/stimulus

**Data model.** The canonical bank has `stimuli` and a `question_stimulus` pivot (`exam_question_id`, `stimulus_id`, `position`), so sharing is possible. There is **no group entity**, such as a range "Rajah 3 → Q5–8". The legacy bank has only `questions.image_path` (one image, never shared). About 14% of legacy questions say "Rajah 3 menunjukkan…" but have no diagram.

**Failures, ranked:**
1. **No group concept.** `PaperSection::sharedStimulus()` (`app/Models/PaperSection.php:187-206`) pins a stimulus only when exactly one stimulus is common to every question in the whole section. A sub-range such as Q5–8 inside a 40-question section is never pinned. The figure then either repeats on each question (`components/question.blade.php:36-38`) or is missing.
2. **DOCX import links a figure to the first following question only.** `DocxSetParser.php` keeps a `$pendingStimulus` and nulls it after the first question claims it. `DocxSetImporter.php:279-296` creates a new `stimuli` row and image for every question and never reuses one. Shared passages are duplicated N times, and cleanup is manual (`DedupeStimuli.php`).
3. **Assembly ignores groups.** `Services/Sets/RandomSetGenerator.php` and `PickableQuestionPool` pick single questions with `shuffle()` or `inRandomOrder()`. A draw can split a group, reorder it, or include a question without its figure. Latih Tubi (`QuizController`) randomises per question too.
4. **Fragile pinning.** One extra or missing link silently turns pinning off.
5. **Mobile.** A group figure has no sticky behaviour and scrolls away. The 42vh sticky header (`exam-sim.css:389-410`) applies only to a stimulus shared by the whole section.

The requirement already existed in `.cloud`'s own design doc (`docs/EXAM-MODEL-REDESIGN.md:4,14`: "the group must stay together and render in paper order"), but nothing enforces it.

## B. Answering subjective maths

- There is no maths input (no keyboard, MathLive or KaTeX input). Students type `x^2`, `1/2` and `√` as plain text. The `numeric` widget is a text box (`exam/widgets/numeric.blade.php:5`).
- The legacy structured lane (`pelajar/latihan-berstruktur-jawab.blade.php:118`) has one 3-row textarea per sub-question. It has no working/final split, **no autosave** (a refresh loses the answer), and no units field.
- There is no photo or handwriting upload. Kertas Subjektif means writing on paper and then self-marking.
- Worth keeping: the `working_shown` widget, which stores "Ruang kerja" and "Jawapan akhir" separately, and the /simulasi autosave (server record, localStorage mirror, 1s debounce).

## C. Entering mark schemes

- `part_answer_keys.content` is JSON with `mark_scheme_points` as free text. There is no structured method/answer mark type (K/N/P or M/A/B), no ECF, no accepted alternatives per point, and no sig-fig or unit rules. The unit is display-only.
- In the legacy editor (`admin/structured-questions-edit.blade.php:48-75`), each point is one text input (max 500 characters) plus a mark. The editor never sets `code`.
- `StructuredMarker::derive` (`app/Support/StructuredMarker.php:66-120`) guesses rubric points by splitting the scheme sentence on commas, "and" and "or". Most legacy items have no usable rubric.
- Maths in schemes is typed as `$…$` source and is visible only after baking. Numeric alternates were broken until 11 Sep 2026.
- Imported OCR/DOCX schemes are noisy.

## D. Matching subjective answers

- `ExamGrader::markAcceptedValues` (`app/Support/ExamGrader.php:84-109`) compares numerically only when both sides are pure numbers. Inputs like "3.14 cm", "1/2", "50%", "0,5" or "x=3" fall back to a lowercase string compare and fail. The default tolerance is 0. Objective parts are all-or-nothing.
- `RubricKeywordMarker` matches single tokens of 5+ characters, and any one hit counts. It over-awards prose, misses short answers, and ignores negation, paraphrase and equivalent forms. It only suggests a mark. The final mark is the student's self-mark, so quality depends on honesty.
- `StructuredMarker` does substring and all-words matching. It has no stemming, no BM/EN synonyms and no number-format normalisation, and it does not understand maths.
- An AI essay grader exists (`app/Support/Ai/EssayGrader.php`) but is disabled (`AI_ESSAY_GRADING_ENABLED=false`) and not wired in. It is also not maths-aware.

## What v2 keeps from .cloud

- The server-trust model: the grader reads only the keys and clamps marks.
- The autosave design.
- The working/final split.
- The recursive part tree with mark totals.
- Explainable per-point marking with hit/miss shown.
- Auto marks are suggestions confirmed by a person, and a failure never awards 0.
- The scheme is revealed only after submission, plus the best-N section scorer and the sanitising inline-math baker.
