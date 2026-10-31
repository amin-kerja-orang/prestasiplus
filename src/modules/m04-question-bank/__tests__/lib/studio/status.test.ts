import { describe, expect, it } from 'vitest'

import {
  archiveBody,
  canArchive,
  draftCreatedFlash,
  gateLines,
  moveFlash,
  servedCaption,
  servedRows,
  servedSummary,
  statusBadge,
  statusButtons,
} from '../../../lib/studio/status'

const report = {
  questionId: '5',
  versionNo: 1,
  servedCount: 1,
  total: 2,
  activities: [
    { activity: 'databank', label: 'Databank Soalan', served: true, reasons: [] },
    { activity: 'bab', label: 'Latihan Bab', served: false, reasons: [{ code: 'no_chapter', message: 'Belum dipautkan kepada bab — pilih Bab di borang soalan.' }] },
  ],
} as never

describe('Studio status copy and rules', () => {
  it('uses the V2 badge words, not the wire codes', () => {
    expect(['draft', 'review', 'approved', 'archived'].map(statusBadge)).toEqual(['Draft', 'Reviewed', 'Approved', 'Archived'])
    expect(statusBadge('odd')).toBe('odd')
  })

  it('offers the V2 buttons per state', () => {
    const labels = (s: string) => statusButtons(s).map((b) => b.label)
    expect(labels('draft')).toEqual(['Hantar untuk semakan', 'Arkib'])
    expect(labels('review')).toEqual(['Terbitkan', 'Kembali ke draf'])
    expect(labels('approved')).toEqual(['Edit sebagai draf', 'Arkib'])
    expect(labels('archived')).toEqual(['Pulihkan ke draf'])
    expect(labels('published')).toEqual([])
  })

  it('has no Arkib on a reviewed question (no review-to-archived pair in the lifecycle table)', () => {
    expect(canArchive('review')).toBe(false)
    expect(canArchive('archived')).toBe(false)
    expect(canArchive('draft')).toBe(true)
    expect(canArchive('approved')).toBe(true)
  })

  it('keeps the V2 flashes verbatim', () => {
    expect(moveFlash('draft', 'review')).toBe('Soalan dihantar untuk semakan.')
    expect(moveFlash('review', 'approved')).toBe('Soalan diterbitkan — kini boleh dijawab oleh pelajar.')
    expect(moveFlash('approved', 'archived')).toBe('Soalan diarkibkan — tidak lagi dipapar kepada pelajar.')
    expect(draftCreatedFlash('42')).toBe('Draf baharu #42 dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan.')
  })

  it('names the effect in the archive dialog', () => {
    expect(archiveBody(4)).toBe('Soalan ini akan hilang daripada 4 aktiviti.')
    expect(archiveBody(0)).toBe('Soalan ini akan disembunyikan daripada murid.')
    expect(archiveBody(null)).toBe('Soalan ini akan disembunyikan daripada murid.')
  })

  it('lists every gate gap with its wizard step', () => {
    expect(gateLines([{ path: 'parts.b.cognitiveLevel', code: 'X', message: 'Bahagian (b) belum ada aras pemikiran.', step: 3 }])).toEqual([
      { text: 'Bahagian (b) belum ada aras pemikiran.', step: 'Langkah 3' },
    ])
  })

  it('reads "Dilihat murid di" as a sentence, a caption and rows', () => {
    expect(servedSummary(report)).toBe('Dilihat murid di 1 daripada 2 aktiviti')
    expect(servedCaption(report)).toBe('Dilihat murid di 1/2')
    expect(servedRows(report)).toEqual([
      { activity: 'databank', label: 'Databank Soalan', served: true, reason: '' },
      { activity: 'bab', label: 'Latihan Bab', served: false, reason: 'Belum dipautkan kepada bab — pilih Bab di borang soalan.' },
    ])
  })
})
