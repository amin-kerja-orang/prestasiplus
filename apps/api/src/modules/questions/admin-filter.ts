import { Prisma } from '../../db/generated/client'
import { idFromString } from '../../db/ids'
import { missingLeafSql } from './effective-leaf'
import { NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL } from './learner-visibility'
import type { AdminListFilter, QuestionStatus } from './types'

/** `bigint` of a decimal id, or null when the text is not a canonical id (such an id never exists). */
export function bi(text: string): bigint | null {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

export const likePattern = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

const NOT_PKSK = NOT_PKSK_SQL

/**
 * The WHERE conditions of the admin question filter over the LATEST version (`v`) of a question (`q`): the one definition shared by the
 * admin list, the filter-based bulk actions and the bulk Bab mapping (S4-T03), so a filter means the same everywhere.
 */
export function adminFilterConds(f: AdminListFilter): Prisma.Sql[] {
  const conds: Prisma.Sql[] = [NOT_PKSK, NOT_PRIMARY_LEVEL_SQL]
  const id = (text: string | undefined, column: Prisma.Sql): void => {
    if (text === undefined) return
    const key = bi(text)
    conds.push(key === null ? Prisma.sql`FALSE` : Prisma.sql`${column} = ${key}`)
  }
  id(f.subjectId, Prisma.sql`v.subject_id`)
  id(f.educationLevelId, Prisma.sql`v.education_level_id`)
  if (f.difficultyLevel !== undefined) {
    const n = /^[1-5]$/.test(f.difficultyLevel) ? Number(f.difficultyLevel) : null
    // Level 5 includes TP 6 (the flat wire clamps 6 to 5).
    conds.push(n === null ? Prisma.sql`FALSE` : n === 5 ? Prisma.sql`v.difficulty_tp >= 5` : Prisma.sql`v.difficulty_tp = ${n}`)
  }
  if (f.status) conds.push(Prisma.sql`v.status = ${f.status}`)
  if (f.dskpFilter !== undefined) {
    const tagged = Prisma.sql`EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id)`
    conds.push(f.dskpFilter === 'tagged' ? tagged : f.dskpFilter === 'untagged' ? Prisma.sql`NOT ${tagged}` : Prisma.sql`FALSE`)
  }
  if (f.tagReview) conds.push(Prisma.sql`v.tag_review`)
  if (f.missing !== undefined) conds.push(missingLeafSql(f.missing))
  if (f.complianceFilter !== undefined) {
    const c = f.complianceFilter
    conds.push(
      c === 'verified'
        ? Prisma.sql`q.live_version_no = v.version_no AND v.status = 'approved'`
        : c === 'draft'
          ? Prisma.sql`v.status <> 'approved'`
          : c === 'missing_source'
            ? Prisma.sql`v.source_file_id IS NULL`
            : c === 'verified_generated'
              ? Prisma.sql`q.source_type = 'ai_variant' AND v.status = 'approved'`
              : Prisma.sql`FALSE`,
    )
  }
  if (f.sourceFilter !== undefined) {
    // The v2 store has no textbook / dskp / trial / marking_scheme source: only ai_generated exists on the wire.
    conds.push(f.sourceFilter === 'ai_generated' ? Prisma.sql`q.source_type = 'ai_variant'` : Prisma.sql`FALSE`)
  }
  // V2 Studio filters (D79). Tahun, Negeri and Jenis read the source paper of the version; Kertas is the trailing digit of the
  // version's paper code (how the paper builder reads it). A question without the value never matches.
  if (f.tahun !== undefined) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM source_papers sp WHERE sp.id = v.source_paper_id AND sp.year = ${Number(f.tahun)})`)
  if (f.negeri !== undefined && f.negeri.trim() !== '') conds.push(Prisma.sql`EXISTS (SELECT 1 FROM source_papers sp WHERE sp.id = v.source_paper_id AND lower(btrim(sp.exam_board)) = lower(btrim(${f.negeri})))`)
  if (f.jenis !== undefined) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM source_papers sp WHERE sp.id = v.source_paper_id AND sp.exam_type = ${f.jenis})`)
  if (f.kertas !== undefined) conds.push(Prisma.sql`substring(v.paper_code from '/([1-3])[[:space:]]*$') = ${f.kertas}`)
  if (f.search !== undefined && f.search.trim() !== '') {
    const like = likePattern(f.search.trim())
    conds.push(Prisma.sql`(v.stem_ms ILIKE ${like} ESCAPE '\\' OR v.stem_en ILIKE ${like} ESCAPE '\\')`)
  }
  return conds
}

/** The wire `QuestionFilter` (already validated by the contract) as the repository's `AdminListFilter`, without paging. Blank text is no filter. */
export function adminFilterOf(d: {
  subjectId?: string | undefined
  educationLevelId?: string | undefined
  difficultyLevel?: string | undefined
  status?: string | undefined
  dskpFilter?: string | undefined
  complianceFilter?: string | undefined
  sourceFilter?: string | undefined
  search?: string | undefined
  tagReview?: string | undefined
  missing?: AdminListFilter['missing'] | undefined
  tahun?: string | undefined
  negeri?: string | undefined
  kertas?: AdminListFilter['kertas'] | undefined
  jenis?: AdminListFilter['jenis'] | undefined
}): Omit<AdminListFilter, 'page' | 'pageSize'> {
  return {
    ...(d.subjectId === undefined ? {} : { subjectId: d.subjectId }),
    ...(d.educationLevelId === undefined ? {} : { educationLevelId: d.educationLevelId }),
    ...(d.difficultyLevel === undefined ? {} : { difficultyLevel: d.difficultyLevel }),
    ...(d.status === undefined ? {} : { status: d.status as QuestionStatus }),
    ...(d.dskpFilter === undefined ? {} : { dskpFilter: d.dskpFilter }),
    ...(d.complianceFilter === undefined ? {} : { complianceFilter: d.complianceFilter }),
    ...(d.sourceFilter === undefined ? {} : { sourceFilter: d.sourceFilter }),
    ...(d.search === undefined || d.search.trim() === '' ? {} : { search: d.search.trim() }),
    ...(d.tagReview === undefined ? {} : { tagReview: true }),
    ...(d.missing === undefined ? {} : { missing: d.missing }),
    ...(d.tahun === undefined ? {} : { tahun: d.tahun }),
    ...(d.negeri === undefined ? {} : { negeri: d.negeri }),
    ...(d.kertas === undefined ? {} : { kertas: d.kertas }),
    ...(d.jenis === undefined ? {} : { jenis: d.jenis }),
  }
}
