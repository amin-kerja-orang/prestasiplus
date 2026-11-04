import { describe, expect, it } from 'vitest'

import {
  STIMULUS_LIMITS,
  STIMULUS_MESSAGES,
  StimulusCreateRequestSchema,
  StimulusGroupCreateRequestSchema,
  StimulusGroupDetailSchema,
  StimulusGroupMergeRequestSchema,
  StimulusGroupMoveRequestSchema,
  StimulusGroupPublishGateErrorSchema,
  StimulusGroupRetireRequestSchema,
  StimulusGroupRetireResultSchema,
  StimulusGroupListQuerySchema,
  StimulusListQuerySchema,
  StimulusGroupReorderRequestSchema,
  StimulusGroupUpdateRequestSchema,
  StimulusUpdateRequestSchema,
} from '../../index'

const fieldsOf = (r: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }): Record<string, string> =>
  Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path.map(String).join('.') || '_', i.message]))

describe('R1-T32 stimulus request schemas (D90)', () => {
  it('accepts each of the seven kinds with the content the kind needs', () => {
    const ok = [
      { kind: 'passage', body: { ms: 'Teks' } },
      { kind: 'image', imageFileId: 'abc' },
      { kind: 'diagram', imageFileId: 'abc', caption: 'Rajah 1' },
      { kind: 'table', tableData: { head: ['a'], rows: [['1']] } },
      { kind: 'table', imageFileId: 'abc' },
      { kind: 'map', imageFileId: 'abc' },
      { kind: 'infographic', imageFileId: 'abc' },
      { kind: 'graph', imageFileId: 'abc' },
    ]
    for (const body of ok) expect(StimulusCreateRequestSchema.safeParse(body).success, JSON.stringify(body)).toBe(true)
  })

  it('names the missing content in BM on the right field', () => {
    expect(fieldsOf(StimulusCreateRequestSchema.safeParse({ kind: 'passage' }))).toEqual({ body: STIMULUS_MESSAGES.bodyRequired })
    expect(fieldsOf(StimulusCreateRequestSchema.safeParse({ kind: 'diagram' }))).toEqual({ imageFileId: STIMULUS_MESSAGES.imageRequired })
    expect(fieldsOf(StimulusCreateRequestSchema.safeParse({ kind: 'table' }))).toEqual({ tableData: STIMULUS_MESSAGES.tableRequired })
    expect(fieldsOf(StimulusCreateRequestSchema.safeParse({ kind: 'poster' }))).toEqual({ kind: STIMULUS_MESSAGES.kind })
    expect(fieldsOf(StimulusCreateRequestSchema.safeParse({ kind: 'audio', body: { ms: 'x' } })).kind).toBe(STIMULUS_MESSAGES.kind)
  })

  it('is strict: inline svg or html is never accepted; the update cannot change the kind', () => {
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'diagram', imageFileId: 'a', svg: '<svg/>' }).success).toBe(false)
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'passage', body: { ms: 'x' }, html: '<b>' }).success).toBe(false)
    expect(StimulusUpdateRequestSchema.safeParse({ kind: 'image' }).success).toBe(false)
    expect(StimulusUpdateRequestSchema.safeParse({}).success).toBe(false)
    expect(StimulusUpdateRequestSchema.safeParse({ caption: null, imageFileId: null }).success).toBe(true)
  })

  it('bounds every free text and the table grid', () => {
    const long = (n: number) => 'x'.repeat(n)
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'passage', body: { ms: long(STIMULUS_LIMITS.body + 1) } }).success).toBe(false)
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'passage', body: { ms: 'x' }, caption: long(STIMULUS_LIMITS.caption + 1) }).success).toBe(false)
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'passage', body: { ms: 'x' }, alt: long(STIMULUS_LIMITS.alt + 1) }).success).toBe(false)
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'table', tableData: { head: Array.from({ length: STIMULUS_LIMITS.columns + 1 }, () => 'h'), rows: [['1']] } }).success).toBe(false)
    expect(StimulusCreateRequestSchema.safeParse({ kind: 'table', tableData: { head: ['h'], rows: Array.from({ length: STIMULUS_LIMITS.rows + 1 }, () => ['1']) } }).success).toBe(false)
  })

  it('a group has 1 to 3 stimuli and 0 to 40 member questions (D93), and no marks key', () => {
    const base = { stimulusIds: ['1'], questionIds: ['10', '11'] }
    expect(StimulusGroupCreateRequestSchema.safeParse(base).success).toBe(true)
    expect(StimulusGroupCreateRequestSchema.safeParse({ ...base, stimulusIds: ['1', '2', '3'] }).success).toBe(true)
    expect(fieldsOf(StimulusGroupCreateRequestSchema.safeParse({ ...base, stimulusIds: [] })).stimulusIds).toBe(STIMULUS_MESSAGES.stimuliCount)
    expect(fieldsOf(StimulusGroupCreateRequestSchema.safeParse({ ...base, stimulusIds: ['1', '2', '3', '4'] })).stimulusIds).toBe(STIMULUS_MESSAGES.stimuliCount)
    // D93: a draft group may have 0 or 1 members; only the 40-member cap is a 422.
    expect(StimulusGroupCreateRequestSchema.safeParse({ ...base, questionIds: ['10'] }).success).toBe(true)
    expect(StimulusGroupCreateRequestSchema.safeParse({ stimulusIds: ['1'], questionIds: [] }).success).toBe(true)
    expect(StimulusGroupCreateRequestSchema.safeParse({ stimulusIds: ['1'] }).data?.questionIds).toEqual([])
    expect(StimulusGroupCreateRequestSchema.safeParse({ ...base, questionIds: Array.from({ length: 40 }, (_, i) => String(i + 1)) }).success).toBe(true)
    expect(fieldsOf(StimulusGroupCreateRequestSchema.safeParse({ ...base, questionIds: Array.from({ length: 41 }, (_, i) => String(i + 1)) })).questionIds).toBe(STIMULUS_MESSAGES.membersTooMany)
    expect(StimulusGroupCreateRequestSchema.safeParse({ ...base, marks: 4 }).success).toBe(false)
    expect(StimulusGroupUpdateRequestSchema.safeParse({}).success).toBe(false)
    expect(StimulusGroupReorderRequestSchema.safeParse({ questionIds: [] }).success).toBe(false)
  })

  it('the removal warning is BM and counts the remaining members', () => {
    expect(STIMULUS_MESSAGES.smallGroup()).toBe('Kumpulan ini kini kosong. Bubarkan kumpulan jika rangsangan ini tidak diperlukan lagi.')
    expect(STIMULUS_MESSAGES.builderBlocker).toBe('Kumpulan perlu sekurang-kurangnya 1 soalan.')
    expect(STIMULUS_MESSAGES.stimulusInUse(3)).toBe('Rangsangan ini masih digunakan oleh 3 soalan.')
  })
})

describe('R1-T49 list queries', () => {
  it('defaults to page 1 of 20 and bounds the page, the page size and the search text', () => {
    expect(StimulusGroupListQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 })
    expect(StimulusListQuerySchema.parse({ pageSize: '100', page: '3', q: 'x' })).toMatchObject({ page: 3, pageSize: 100, q: 'x' })
    expect(fieldsOf(StimulusListQuerySchema.safeParse({ pageSize: '101' })).pageSize).toBe(STIMULUS_MESSAGES.pageSize)
    expect(fieldsOf(StimulusListQuerySchema.safeParse({ pageSize: '0' })).pageSize).toBe(STIMULUS_MESSAGES.pageSize)
    expect(fieldsOf(StimulusListQuerySchema.safeParse({ page: '100001' })).page).toBe(STIMULUS_MESSAGES.page)
    expect(fieldsOf(StimulusListQuerySchema.safeParse({ q: 'x'.repeat(101) })).q).toBe(STIMULUS_MESSAGES.search)
    expect(fieldsOf(StimulusGroupListQuerySchema.safeParse({ status: 'baru' })).status).toBe(STIMULUS_MESSAGES.filter)
  })

  it('is strict: an unknown key is refused, and only the stimulus list takes a kind', () => {
    expect(StimulusGroupListQuerySchema.safeParse({ evil: '1' }).success).toBe(false)
    expect(StimulusGroupListQuerySchema.safeParse({ kind: 'table' }).success).toBe(false)
    expect(StimulusListQuerySchema.safeParse({ kind: 'table' }).success).toBe(true)
    expect(StimulusListQuerySchema.safeParse({ kind: 'audio' }).success).toBe(false)
    // REQ-C-019: only the group list takes `joinable`, and only `true`
    expect(StimulusGroupListQuerySchema.safeParse({ joinable: 'true' }).success).toBe(true)
    expect(StimulusGroupListQuerySchema.safeParse({ joinable: 'false' }).success).toBe(false)
    expect(StimulusListQuerySchema.safeParse({ joinable: 'true' }).success).toBe(false)
  })
})

describe('S1-T01 group action schemas (API-Q-31..35)', () => {
  it('has the exact BM texts', () => {
    expect(STIMULUS_MESSAGES.publishNotReady).toBe('Semua soalan dalam kumpulan mesti dihantar untuk semakan dahulu.')
    expect(STIMULUS_MESSAGES.memberScope).toBe('Subjek dan Tingkatan ahli mesti sama dengan kumpulan.')
    expect(STIMULUS_MESSAGES.draftExists).toBe('Tindakan ini bercanggah dengan keadaan semasa. Muat semula dan cuba lagi.')
    expect(STIMULUS_MESSAGES.noDraft).toBe(STIMULUS_MESSAGES.conflict)
    expect(STIMULUS_MESSAGES.requestInvalid).toBe('Data yang dihantar tidak sah. Sila semak dan cuba lagi.')
    expect(STIMULUS_MESSAGES.retireConfirm).toBe(STIMULUS_MESSAGES.requestInvalid)
    expect(STIMULUS_MESSAGES.mergeSame).toBe(STIMULUS_MESSAGES.requestInvalid)
    expect(STIMULUS_MESSAGES.groupDraftCreated('12')).toBe('Draf kumpulan #12 dicipta.')
  })
  it('create/update accept the optional scope keys and still refuse a bad kertas', () => {
    const base = { stimulusIds: ['1'] }
    expect(StimulusGroupCreateRequestSchema.safeParse(base).success).toBe(true)
    expect(StimulusGroupCreateRequestSchema.safeParse({ ...base, subjectId: '3', educationLevelId: '2', kertas: '1' }).success).toBe(true)
    expect(StimulusGroupCreateRequestSchema.safeParse({ ...base, kertas: null }).success).toBe(true)
    expect(fieldsOf(StimulusGroupCreateRequestSchema.safeParse({ ...base, kertas: '9' }))).toEqual({ kertas: 'Kertas tidak sah.' })
    expect(StimulusGroupUpdateRequestSchema.safeParse({ subjectId: '3' }).success).toBe(true)
    expect(StimulusGroupUpdateRequestSchema.safeParse({ kertas: '2' }).success).toBe(true)
    expect(fieldsOf(StimulusGroupUpdateRequestSchema.safeParse({}))).toEqual({ _: STIMULUS_MESSAGES.noChange })
  })
  it('detail carries subjectId, educationLevelId, kertas and draftOfGroupId, all optional', () => {
    const d = { id: '1', label: null, scope: 'section', stimuli: [{ id: '1', kind: 'passage', label: 'P', body: null, imageId: null, alt: null }], questionIds: [], members: [] }
    expect(StimulusGroupDetailSchema.safeParse(d).success).toBe(true)
    expect(StimulusGroupDetailSchema.safeParse({ ...d, subjectId: '2', educationLevelId: '4', kertas: '2', draftOfGroupId: '7' }).success).toBe(true)
    expect(StimulusGroupDetailSchema.safeParse({ ...d, subjectId: null, educationLevelId: null, kertas: null, draftOfGroupId: null }).success).toBe(true)
  })
  it('retire needs confirm: true exactly', () => {
    expect(StimulusGroupRetireRequestSchema.safeParse({ confirm: true }).success).toBe(true)
    expect(fieldsOf(StimulusGroupRetireRequestSchema.safeParse({ confirm: false }))).toEqual({ confirm: STIMULUS_MESSAGES.retireConfirm })
    expect(StimulusGroupRetireRequestSchema.safeParse({}).success).toBe(false)
    expect(StimulusGroupRetireRequestSchema.safeParse({ confirm: true, x: 1 }).success).toBe(false)
    expect(StimulusGroupRetireResultSchema.safeParse({ archived: 2, affectedPapers: [{ id: '5', title: 'Kertas A' }] }).success).toBe(true)
  })
  it('move needs toGroupId and is strict', () => {
    expect(StimulusGroupMoveRequestSchema.safeParse({ toGroupId: '9' }).success).toBe(true)
    expect(StimulusGroupMoveRequestSchema.safeParse({}).success).toBe(false)
    expect(StimulusGroupMoveRequestSchema.safeParse({ toGroupId: '9', extra: 1 }).success).toBe(false)
  })
  it('merge needs two different ids', () => {
    expect(StimulusGroupMergeRequestSchema.safeParse({ fromGroupId: '1', intoGroupId: '2' }).success).toBe(true)
    expect(fieldsOf(StimulusGroupMergeRequestSchema.safeParse({ fromGroupId: '1', intoGroupId: '1' }))).toEqual({ intoGroupId: STIMULUS_MESSAGES.mergeSame })
    expect(StimulusGroupMergeRequestSchema.safeParse({ fromGroupId: '1' }).success).toBe(false)
  })
  it('publish gate error body shape', () => {
    const body = { error: { code: 'VALIDATION_ERROR', message: 'x', details: { gate: [{ questionId: '4', message: 'Soalan 1: Kunci jawapan diperlukan.' }] } } }
    expect(StimulusGroupPublishGateErrorSchema.safeParse(body).success).toBe(true)
    expect(StimulusGroupPublishGateErrorSchema.safeParse({ error: { code: 'CONFLICT', message: 'x', details: { gate: [] } } }).success).toBe(false)
  })
})
