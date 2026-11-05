import { QUESTION_IMPORT_GURU_HEADER, QUESTION_IMPORT_GURU_TEMPLATE_CSV } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { guruStatusOf, guruPayloadOf, readGuruSubmission } from '../../src/modules/intake/files/guru-submissions'
import { planGuruRows, readGuruCsv, type GuruCsvLookups } from '../../src/modules/questions/workflow/imports/guru-csv'

/** Pure (no database): the teacher CSV plan (API-GUR-19) and the status words / payload of a submission (API-GUR-18). */
const H = QUESTION_IMPORT_GURU_HEADER.join(',')
const lookups: GuruCsvLookups = {
  subjects: [{ id: '3', code: 'MAT', name: 'Matematik' }],
  levels: new Map([
    [4, { id: '14', code: 'T4' }],
    [1, { id: '11', code: 'T1' }],
  ]),
  refs: new Map([['3:14', { chapters: [{ id: '70', number: 1, name: 'Fungsi' }], sps: [{ id: '90', code: '1.1.1' }] }]]),
}
const plan = (body: string) => {
  const read = readGuruCsv(`${H}\r\n${body}`)
  return { read, ...planGuruRows(read.rows, lookups) }
}

describe('the template', () => {
  it('has the PRD header and example row, and the example row is a valid row', () => {
    const [header, row] = QUESTION_IMPORT_GURU_TEMPLATE_CSV.split('\r\n')
    expect(header).toBe('subjek,tingkatan,bab,sp,tp,aras,kesukaran,soalan,pilihan_a,pilihan_b,pilihan_c,pilihan_d,jawapan,penerangan')
    expect(row).toBe('Matematik,4,Bab 1,1.1.1,3,mengaplikasi,3,Contoh soalan?,A,B,C,D,A,Contoh penerangan')
    const p = planGuruRows(readGuruCsv(QUESTION_IMPORT_GURU_TEMPLATE_CSV).rows, lookups)
    expect(p.errors).toEqual([])
    expect(p.valid[0]?.input).toMatchObject({ chapterId: '70', spIds: ['90'], tp: 3, cognitiveLevel: 'mengaplikasi', difficultyLevel: 3, correctIndex: 0 })
  })
})

describe('readGuruCsv', () => {
  it('reports missing required columns and counts rows over the cap', () => {
    expect(readGuruCsv('subjek,tingkatan\r\nMatematik,4').missingColumns).toContain('soalan')
    const rows = Array.from({ length: 501 }, () => 'Matematik,4,,,,,,S?,a,b,c,d,A,').join('\r\n')
    expect(readGuruCsv(`${H}\r\n${rows}`).tooMany).toBe(true)
    expect(readGuruCsv(`${H}\r\n${rows.split('\r\n').slice(0, 500).join('\r\n')}`).tooMany).toBe(false)
  })
})

describe('planGuruRows: one reason per bad row, valid rows kept (AC-GUR-44-13)', () => {
  it('3 rows, one wrong jawapan: 2 imported, the reason of the PRD', () => {
    const p = plan(['Matematik,4,,,,,2,S1?,a,b,c,d,A,', 'Matematik,4,,,,,2,S2?,a,b,c,d,E,', 'matematik,1,,,,,2,S3?,a,b,c,d,d,'].join('\r\n'))
    expect(p.valid).toHaveLength(2)
    expect(p.errors).toEqual([{ row: 3, message: 'Jawapan mesti A, B, C atau D.' }])
  })
  it('the reasons of 44-F3', () => {
    const msg = (row: string) => plan(row).errors[0]?.message
    expect(msg('Sains,4,,,,,,S?,a,b,c,d,A,')).toBe('Subjek tidak dikenali.')
    expect(msg('Matematik,6,,,,,,S?,a,b,c,d,A,')).toBe('Tingkatan mesti antara 1 dan 5.')
    expect(msg('Matematik,4,,,7,,,S?,a,b,c,d,A,')).toBe('Tahap Penguasaan (TP) mesti antara 1 dan 6.')
    expect(msg('Matematik,4,,,,hebat,,S?,a,b,c,d,A,')).toBe('Aras pemikiran tidak sah.')
    expect(msg('Matematik,4,,,,,9,S?,a,b,c,d,A,')).toBe('Kesukaran mesti antara 1 dan 5.')
    expect(msg('Matematik,4,Bab 9,,,,2,S?,a,b,c,d,A,')).toBe('Bab tidak dijumpai: Bab 9')
    expect(msg('Matematik,4,,9.9.9,,,2,S?,a,b,c,d,A,')).toBe('SP tidak dijumpai: 9.9.9')
    expect(msg('Matematik,4,,,,,2,,a,b,c,d,A,')).toBe('Soalan diperlukan.')
    expect(msg('Matematik,4,,,,,2,S?,a,b,,d,A,')).toBe('Pilihan C diperlukan.')
  })
  it('kesukaran defaults to min(5, tp) and bab matches by number or by name', () => {
    const p = plan(['Matematik,4,Fungsi,,6,,,S?,a,b,c,d,B,', 'Matematik,4,1,,2,,,S?,a,b,c,d,B,', 'Matematik,4,,,,,3,S?,a,b,c,d,B,'].join('\r\n'))
    expect(p.errors).toEqual([])
    expect(p.valid.map((v) => [v.input.difficultyLevel, v.input.chapterId, v.input.tp])).toEqual([[5, '70', 6], [2, '70', 2], [3, null, null]])
  })
  it('empty kesukaran without a tp is an error', () => {
    expect(plan('Matematik,4,,,,,,S?,a,b,c,d,A,').errors[0]?.message).toBe('Kesukaran mesti antara 1 dan 5.')
  })
})

describe('guruStatusOf (FR-GUR-44-10)', () => {
  const none = { liveVersionNo: null, latestStatus: null, latestRejectionReason: null }
  it('pending until the question is published; approved once live; rejected with the reason', () => {
    expect(guruStatusOf({ reviewState: 'needs_review', rejectReason: null, question: null }).status).toBe('pending')
    expect(guruStatusOf({ reviewState: 'accepted', rejectReason: null, question: { ...none, latestStatus: 'draft' } })).toMatchObject({ status: 'pending', label: 'Menunggu Semakan' })
    expect(guruStatusOf({ reviewState: 'accepted', rejectReason: null, question: { liveVersionNo: 1, latestStatus: 'approved', latestRejectionReason: null } })).toMatchObject({ status: 'approved', label: 'Diluluskan' })
    expect(guruStatusOf({ reviewState: 'rejected', rejectReason: 'Soalan kabur.', question: null })).toEqual({ status: 'rejected', label: 'Ditolak', reason: 'Soalan kabur.' })
    expect(guruStatusOf({ reviewState: 'accepted', rejectReason: null, question: { ...none, latestStatus: 'draft', latestRejectionReason: 'Betulkan kunci.' } }).reason).toBe('Betulkan kunci.')
  })
})

describe('the stored payload', () => {
  it('round-trips the submitted fields (difficulty and key preselect on edit, FR-GUR-44-6)', () => {
    const payload = guruPayloadOf(
      { subjectId: '3', educationLevelId: '14', chapterId: '70', spIds: ['90'], tp: 3, cognitiveLevel: 'memahami', difficultyLevel: 4, correctIndex: 2, explanation: 'Sebab.', questionText: 'S?', options: ['a', 'b', 'c', 'd'] },
      { subjectCode: 'MAT', levelCode: 'T4', spCodes: ['1.1.1'] },
    )
    const r = readGuruSubmission(payload)
    expect(r).toMatchObject({ stem: 'S?', options: ['a', 'b', 'c', 'd'], correctIndex: 2, explanation: 'Sebab.' })
    expect(r?.guru.difficultyLevel).toBe(4)
    expect(readGuruSubmission({ stem: 'x' })).toBeNull()
  })
})
