import { describe, expect, it } from 'vitest'

import { buildBulkFilter, type QuestionFilterBulkResult } from '../../api/questions'
import {
  bulkFilterCountLine,
  bulkFilterFailedHeading,
  bulkFilterNotes,
  bulkFilterSuccess,
} from '../../lib/bulk-filter'

const R: QuestionFilterBulkResult = {
  matched: 600,
  eligible: 600,
  skipped: 0,
  cap: 500,
  processed: 0,
  affected: 0,
  failed: [],
  remaining: 0,
  capped: false,
  dryRun: true,
}

describe('buildBulkFilter (REQ-A-021)', () => {
  it('is {} when nothing is set', () => {
    expect(buildBulkFilter({})).toEqual({})
  })
  it('drops empty, whitespace-only and non-string values and trims the rest', () => {
    expect(
      buildBulkFilter({
        subject_id: '',
        education_level_id: '   ',
        search: '  \t ',
        status: ' approved ',
        difficulty_level: '3',
        dskp_filter: [] as unknown as string,
        compliance_filter: undefined,
      }),
    ).toEqual({ status: 'approved', difficultyLevel: '3' })
  })
  it('maps the URL keys to the wire keys and the mock status to the wire code', () => {
    expect(
      buildBulkFilter({
        subject_id: '1',
        education_level_id: '11',
        status: 'pending_review',
        dskp_filter: 'tagged',
        compliance_filter: 'verified',
        source_filter: 'dskp',
        search: ' x ',
      }),
    ).toEqual({
      subjectId: '1',
      educationLevelId: '11',
      status: 'review',
      dskpFilter: 'tagged',
      complianceFilter: 'verified',
      sourceFilter: 'dskp',
      search: 'x',
    })
  })
})

describe('bulk filter copy', () => {
  it('uses the V2 success texts', () => {
    expect(bulkFilterSuccess('approved', 4)).toBe('Berjaya luluskan 4 soalan (hasil tapisan) — kini kelihatan kepada pelajar.')
    expect(bulkFilterSuccess('archived', 4)).toBe(
      'Berjaya arkib 4 soalan. Bank pelajar kini kosong — luluskan soalan secara manual untuk memaparkannya semula.',
    )
  })
  it('count line mentions the cap only when it bites', () => {
    expect(bulkFilterCountLine('approved', R)).toContain('Hanya 500 soalan diproses')
    expect(bulkFilterCountLine('archived', { ...R, matched: 5, eligible: 4 })).toBe('4 daripada 5 soalan sepadan akan diarkibkan.')
  })
  it('notes and heading', () => {
    expect(bulkFilterNotes({ ...R, skipped: 2, remaining: 7 })).toHaveLength(2)
    expect(bulkFilterNotes(R)).toEqual([])
    expect(bulkFilterFailedHeading('approved', 3)).toBe('3 soalan tidak diluluskan kerana DSKP belum lengkap:')
  })
})
