/**
 * Question-set transform of `migrate:activity` (BE-29): the teacher question-set HEADER only (LEAD decision OD-10 Q4 A,
 * "keep teacher question-set headers as needs rebuild"; half AZ's AZ-31, check `ck_question_sets_classroom_or_migrated`).
 * Pure function; the loader resolves the teacher, the teacher role and the subject.
 *
 * What a migrated header is in v2:
 *  - no class (`classroom_id` NULL: .cloud sets have none) and `needs_rebuild = true`, which is the only way the check lets a
 *    row exist without a class (it also needs `legacy_source`, which the kit writes with `legacy_id`);
 *  - `status = 'draft'` whatever the .cloud status was: a set that must be rebuilt is never served (BE-18 never lists or
 *    resolves a set without a class either; this is the second lock);
 *  - no items (`question_set_items` are question-bound, Q4: not migrated);
 *  - `education_level_id` of the .cloud set has no v2 column, so it is not stored (the loader counts such rows).
 * Nothing is invented: the owner is the mapped teacher or the row is rejected.
 */
import { invalid, ok, orphan, text, unsupported, type Outcome, type Staged } from './activity-common'

/** The v2 `question_sets.status` of every migrated header (`draft`, `scheduled`, `published` are the allowed values). */
export const MIGRATED_SET_STATUS = 'draft'

/** `ck_question_sets_title`: 1 to 255 characters after trimming. */
const TITLE_MAX = 255

export interface QuestionSetValues {
  teacher_id: string
  classroom_id: null
  subject_id: string | null
  title: string
  status: typeof MIGRATED_SET_STATUS
  needs_rebuild: true
}

export interface QuestionSetParents {
  /** The v2 user mapped from the staged `teacher_id`; undefined when the value is blank or unmapped. */
  teacherId: string | undefined
  /** True when that v2 user holds the `teacher` role. */
  teacherIsTeacher: boolean
  /** The v2 subject mapped from the staged `subject_id`; undefined when blank or unmapped. */
  subjectId: string | undefined
}

export function transformQuestionSet(row: Staged, parents: QuestionSetParents): Outcome<QuestionSetValues> {
  if (text(row.teacher_id) === null) return invalid('teacher_id')
  if (parents.teacherId === undefined) return orphan('teacher_id')
  if (!parents.teacherIsTeacher) return unsupported('teacher_id')
  const title = text(row.title)
  if (title === null || Array.from(title).length > TITLE_MAX) return invalid('title')
  const staged = text(row.subject_id)
  if (staged !== null && parents.subjectId === undefined) return orphan('subject_id')
  return ok({
    teacher_id: parents.teacherId,
    classroom_id: null,
    subject_id: staged === null ? null : (parents.subjectId ?? null),
    title,
    status: MIGRATED_SET_STATUS,
    needs_rebuild: true,
  })
}
