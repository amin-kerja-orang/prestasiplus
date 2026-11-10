import { describe, expect, it } from 'vitest'

import { blankStimulus, parseTable, stimulusFormOf, stimulusIssue, STIMULUS_KINDS, tableToText, toCreateBody, toUpdateBody } from '../../../lib/studio/stimulus'

describe('stimulus form (rules of POST /api/stimuli, T32)', () => {
  it('has the seven V2 kinds', () => {
    expect(STIMULUS_KINDS.map((k) => k.value)).toEqual(['passage', 'image', 'diagram', 'table', 'map', 'infographic', 'graph'])
  })

  it('applies the label, alt text and kind rules before the server does (FR-QA-10, AC-QA-10)', () => {
    expect(stimulusIssue(blankStimulus('passage'))).toBe('Sila isi label rangsangan.')
    const form = (k: Parameters<typeof blankStimulus>[0]) => ({ ...blankStimulus(k), label: 'Rajah 1' })
    expect(stimulusIssue(form('passage'))).toBe('Petikan mesti mempunyai teks.')
    expect(stimulusIssue({ ...form('passage'), body: 'Teks.' })).toBeNull()
    for (const k of ['image', 'diagram', 'map', 'infographic', 'graph'] as const) expect(stimulusIssue(form(k))).toBe('Sila muat naik imej untuk rangsangan ini.')
    expect(stimulusIssue({ ...form('diagram'), imageToken: 'abc' })).toBe('Sila isi teks alternatif untuk imej ini.')
    expect(stimulusIssue({ ...form('diagram'), imageToken: 'abc', alt: 'Segi tiga' })).toBeNull()
    expect(stimulusIssue(form('table'))).toContain('Jadual mesti mempunyai kepala')
    expect(stimulusIssue({ ...form('table'), tableText: 'Hari | Suhu\nIsnin | 30' })).toBeNull()
  })

  it('reads and writes the table text', () => {
    expect(parseTable('a | b')).toBeNull()
    expect(parseTable('Hari | Suhu\nIsnin | 30\n\nSelasa | 31')).toEqual({ head: ['Hari', 'Suhu'], rows: [['Isnin', '30'], ['Selasa', '31']] })
    expect(tableToText({ head: ['a', 'b'], rows: [['1', '2']] })).toBe('a | b\n1 | 2')
  })

  it('builds the create body with only what is filled', () => {
    expect(toCreateBody({ ...blankStimulus('diagram'), label: 'Rajah 1', alt: 'Segi tiga', imageToken: 'tok' })).toEqual({
      kind: 'diagram', label: 'Rajah 1', caption: null, alt: 'Segi tiga', sourceCitation: null, imageFileId: 'tok',
    })
    expect(toCreateBody({ ...blankStimulus('passage'), body: 'Teks.' })).toMatchObject({ kind: 'passage', body: { ms: 'Teks.' } })
  })

  it('sends only the changed keys on update, and nothing when unchanged (the shared row is not touched)', () => {
    const saved = stimulusFormOf({ id: '1', kind: 'table', label: 'Jadual 1', body: null, imageId: null, alt: null, tableData: { head: ['a'], rows: [['1']] } })
    expect(toUpdateBody(saved, saved)).toBeNull()
    expect(toUpdateBody({ ...saved, caption: 'Sumber' }, saved)).toEqual({ caption: 'Sumber' })
    expect(toUpdateBody({ ...saved, tableText: 'a\n2' }, saved)).toEqual({ tableData: { head: ['a'], rows: [['2']] } })
    expect(toUpdateBody({ ...saved, imageToken: 'x' }, saved)).toEqual({ imageFileId: 'x' })
  })
})
