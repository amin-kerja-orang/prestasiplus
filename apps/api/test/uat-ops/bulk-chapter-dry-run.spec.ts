import { describe, expect, it } from 'vitest'

import { buildPlan, PAIRS_SQL, planLines, SPEC, type ChapterRow, type PairRow } from '../../scripts/uat-ops/bulk-chapter-dry-run'
import { parseUatArgs } from '../../scripts/uat-ops/lib'

/** S4-T03 U-OP-07 dry-run report: the pure parts (rows -> plan -> lines). */
const pair = (subject_id: string, subject_code: string, level_id: string, level_code: string, approved: number, with_chapter: number): PairRow => ({
  subject_id,
  subject_code,
  level_id,
  level_code,
  approved,
  with_chapter,
})
const chapter = (id: string, subject_id: string, education_level_id: string, chapter_number: number | null, name: string | null): ChapterRow => ({
  id,
  subject_id,
  education_level_id,
  chapter_number,
  name,
})

const pairs = [pair('1', 'MATEMATIK', '4', 'T4', 100, 20), pair('1', 'MATEMATIK', '5', 'T5', 50, 0), pair('2', 'SAINS', '4', 'T4', 7, 7)]
const chapters = [
  chapter('11', '1', '4', 1, 'Fungsi'),
  chapter('12', '1', '4', 2, 'Persamaan'),
  chapter('13', '2', '5', 1, 'Tidak ditawarkan'),
]

describe('bulk-chapter-dry-run arguments', () => {
  it('is dry-run only: --apply is a usage error; --subject and --level are accepted', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('bulk-chapter-dry-run is read-only: there is no --apply')
    expect(parseUatArgs(['--subject', 'matematik', '--level=T4'], SPEC).values).toEqual({ subject: 'matematik', level: 'T4' })
    expect(() => parseUatArgs(['--chapter', '1'], SPEC)).toThrow('unknown argument --chapter')
  })
})

describe('buildPlan', () => {
  const plan = buildPlan(pairs, chapters)

  it('counts approved questions without and with a Bab per subject x level', () => {
    expect(plan.pairs.map((p) => [p.level, p.subject, p.approved, p.withoutChapter, p.withChapter])).toEqual([
      ['T4', 'MATEMATIK', 100, 80, 20],
      ['T5', 'MATEMATIK', 50, 50, 0],
      ['T4', 'SAINS', 7, 0, 7],
    ])
  })

  it('lists the in-tree Babs of the pair, each with the unlinked count as eligible, and drops a Bab of a pair that is not offered', () => {
    expect(plan.pairs[0]!.chapters).toEqual([
      { chapterId: '11', chapterNumber: 1, name: 'Fungsi', eligible: 80 },
      { chapterId: '12', chapterNumber: 2, name: 'Persamaan', eligible: 80 },
    ])
    expect(plan.pairs[1]!.chapters).toEqual([])
    expect(plan.totals).toEqual({ pairs: 3, approved: 157, withoutChapter: 130, withChapter: 27, chapters: 2 })
  })

  it('suggests no Bab per question: the plan holds no question id', () => {
    expect(JSON.stringify(plan)).not.toMatch(/question/i)
  })
})

describe('planLines', () => {
  it('prints one INFO line per subject x level, one per Bab, a note for an empty tree and a total', () => {
    const lines = planLines(buildPlan(pairs, chapters))
    expect(lines.every((l) => l.status === 'INFO')).toBe(true)
    expect(lines.map((l) => l.text)).toEqual([
      'T4 MATEMATIK: approved 100, without Bab 80, with Bab 20, Bab in tree 2',
      '  T4 MATEMATIK chapter 11 (Bab 1 Fungsi): eligible 80',
      '  T4 MATEMATIK chapter 12 (Bab 2 Persamaan): eligible 80',
      'T5 MATEMATIK: approved 50, without Bab 50, with Bab 0, Bab in tree 0',
      '  T5 MATEMATIK: no Bab in tree, nothing to map to yet',
      'T4 SAINS: approved 7, without Bab 0, with Bab 7, Bab in tree 0',
      'total: 3 subject x level, approved 157, without Bab 130, with Bab 27, Bab in tree 2',
    ])
  })

  it('reports SKIP when a filter matches no offered subject x level', () => {
    expect(planLines(buildPlan([], []), { subject: 'XYZ', level: 'T4' })).toEqual([
      { status: 'SKIP', text: 'no offered subject x level for subject XYZ, level T4' },
    ])
  })
})

describe('PAIRS_SQL eligibility (same as the bulk-chapter API)', () => {
  it('does not require an active question: an inactive approved question counts, as the API maps it', () => {
    expect(PAIRS_SQL).not.toMatch(/q\.is_active/)
    expect(PAIRS_SQL).toContain('JOIN questions q ON q.id = v.question_id AND q.live_version_no = v.version_no')
  })

  it('counts the live approved version and leaves PKSK questions out, as the admin filter does', () => {
    expect(PAIRS_SQL).toContain("v.status = 'approved'")
    expect(PAIRS_SQL).toContain("pt.kind = 'pksk_domain'")
  })
})
