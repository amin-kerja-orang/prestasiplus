import { describe, expect, it } from 'vitest'

import {
  STIMULUS_LIMITS,
  STIMULUS_MESSAGES,
  StimulusCreateRequestSchema,
  StimulusGroupCreateRequestSchema,
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
    expect(STIMULUS_MESSAGES.smallGroup(1)).toBe('Kumpulan ini kini hanya mempunyai 1 soalan. Rangsangan bersama lazimnya untuk sekurang-kurangnya 2 soalan.')
    expect(STIMULUS_MESSAGES.smallGroup(0)).toContain('kosong')
  })
})
