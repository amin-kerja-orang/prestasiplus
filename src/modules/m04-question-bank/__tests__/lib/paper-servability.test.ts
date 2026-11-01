import { SERVABILITY_REASON_MS, type QuestionPaperServabilityRow } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { paperServedRows, paperServedSummary, reasonQuestionId } from '../../lib/paper-servability'

const OPEN: QuestionPaperServabilityRow = { paperId: '10', title: 'Kertas A', served: true, reasons: [] }
const MISSING: QuestionPaperServabilityRow = {
  paperId: '11',
  title: 'Kertas B',
  served: false,
  reasons: [{ code: 'question_missing', message: SERVABILITY_REASON_MS.question_missing, detail: '77' }],
}
const OWN: QuestionPaperServabilityRow = {
  paperId: '12',
  title: 'Kertas C',
  served: false,
  reasons: [{ code: 'not_approved', message: SERVABILITY_REASON_MS.not_approved, detail: '5' }],
}

describe('paper servability mapping', () => {
  it('reads the placed question id before the first colon', () => {
    expect(reasonQuestionId('42')).toBe('42')
    expect(reasonQuestionId('42: shape_unsupported:image')).toBe('42')
    expect(reasonQuestionId(undefined)).toBeNull()
    expect(reasonQuestionId('')).toBeNull()
  })

  it('maps a served paper with the chip and no reasons', () => {
    expect(paperServedRows([OPEN], '5')).toEqual([{ paperId: '10', title: 'Kertas A', served: true, chip: 'Boleh dilihat', reasons: [] }])
  })

  it('keeps the API sentence for this question and prefixes another placed question', () => {
    const [missing, own] = paperServedRows([MISSING, OWN], '5')
    expect(missing?.chip).toBe('Tidak boleh dilihat')
    expect(missing?.reasons[0]?.text).toBe(`Soalan #77: ${SERVABILITY_REASON_MS.question_missing}`)
    expect(own?.reasons[0]?.text).toBe(SERVABILITY_REASON_MS.not_approved)
  })

  it('summarises how many papers are open', () => {
    expect(paperServedSummary([OPEN, MISSING])).toBe('Boleh dibuka murid di 1 daripada 2 kertas diterbitkan.')
    expect(paperServedSummary([])).toBe('Boleh dibuka murid di 0 daripada 0 kertas diterbitkan.')
  })
})
