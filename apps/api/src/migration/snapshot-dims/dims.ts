/**
 * Pure side of the snapshot join (BE-29, v2-data-migration.md 3.3): turns the raw legacy question columns into the
 * dimensions a migrated answer carries, and resolves the legacy curriculum ids through the BE-28 id maps.
 * No I/O and no question text: the reader (`index.ts`) hands over only ids, codes and the content hash.
 *
 * Rules
 *  - difficulty is the raw 1 to 5 value (OD-26); anything else gives null and is counted by the caller;
 *  - the question type goes through an explicit map; a value outside it gives null (the column is audit data);
 *  - a curriculum id that is set but was not loaded is ORPHAN_PARENT (never defaulted);
 *  - the subject falls back to the session's subject only when the question gives none (no question, or no subject).
 */
import { orphan } from '../transform/activity-common'
import { enumKey, ok, text, type Outcome } from '../transform/common'

/** What the reader returns for one legacy question. Ids are .cloud primary keys as text. */
export interface RawDims {
  legacyQuestionId: string
  subjectId: string | null
  levelId: string | null
  chapterId: string | null
  topicId: string | null
  difficultyRaw: string | null
  typeRaw: string | null
  contentHash: string | null
  sourceNaturalKey: string | null
  numberLabel: string | null
}

/** The dimensions on a migrated answer row (v2 ids). */
export interface ResolvedDims {
  subject_id: string
  education_level_id: string | null
  chapter_id: string | null
  topic_id: string | null
  difficulty: number | null
  question_type: string | null
  legacy_content_hash: string | null
  source_natural_key: string | null
  number_label: string | null
  /** Counter names for the report (no values). */
  notes: string[]
}

export interface DimMaps {
  subjects: ReadonlyMap<string, string>
  levels: ReadonlyMap<string, string>
  chapters: ReadonlyMap<string, string>
  topics: ReadonlyMap<string, string>
}

/** .cloud `questions.type` -> v2 question type. `objektif` is the value in the BE-35 fixture (Perlu pengesahan). */
export const QUESTION_TYPE_MAP: Readonly<Record<string, string>> = {
  objektif: 'mcq',
  mcq: 'mcq',
  pilihan_berganda: 'mcq',
}

/** The raw 1 to 5 scale (OD-26); anything else is null. */
export function parseDifficulty(raw: string | null | undefined): number | null {
  const t = text(raw)
  return t !== null && /^[1-5]$/.test(t) ? Number(t) : null
}

export function mapQuestionType(raw: string | null | undefined): string | null {
  const key = enumKey(raw)
  return key !== null && Object.prototype.hasOwnProperty.call(QUESTION_TYPE_MAP, key) ? (QUESTION_TYPE_MAP[key] ?? null) : null
}

function pick(column: string, id: string | null, map: ReadonlyMap<string, string>): Outcome<string | null> {
  if (id === null) return ok(null)
  const hit = map.get(id)
  return hit === undefined ? orphan(column) : ok(hit)
}

/**
 * @param raw the legacy question (undefined = the question is not in the archive)
 * @param fallbackSubjectId the session's v2 subject, used when the question has no subject of its own
 */
export function resolveSnapshot(raw: RawDims | undefined, maps: DimMaps, fallbackSubjectId: string | null): Outcome<ResolvedDims> {
  const notes: string[] = []
  if (raw === undefined) {
    if (fallbackSubjectId === null) return orphan('subject_id')
    return ok({
      subject_id: fallbackSubjectId,
      education_level_id: null,
      chapter_id: null,
      topic_id: null,
      difficulty: null,
      question_type: null,
      legacy_content_hash: null,
      source_natural_key: null,
      number_label: null,
      notes: ['question_not_in_archive'],
    })
  }
  const own = pick('subject_id', raw.subjectId, maps.subjects)
  if (!own.ok) return own
  const subject = own.value ?? fallbackSubjectId
  if (subject === null) return orphan('subject_id')
  const level = pick('education_level_id', raw.levelId, maps.levels)
  if (!level.ok) return level
  const chapter = pick('chapter_id', raw.chapterId, maps.chapters)
  if (!chapter.ok) return chapter
  const topic = pick('topic_id', raw.topicId, maps.topics)
  if (!topic.ok) return topic
  const difficulty = parseDifficulty(raw.difficultyRaw)
  if (text(raw.difficultyRaw) !== null && difficulty === null) notes.push('difficulty_unparsed')
  const type = mapQuestionType(raw.typeRaw)
  if (text(raw.typeRaw) !== null && type === null) notes.push('question_type_unmapped')
  return ok({
    subject_id: subject,
    education_level_id: level.value,
    chapter_id: chapter.value,
    topic_id: topic.value,
    difficulty,
    question_type: type,
    legacy_content_hash: raw.contentHash,
    source_natural_key: text(raw.sourceNaturalKey),
    number_label: text(raw.numberLabel),
    notes,
  })
}
