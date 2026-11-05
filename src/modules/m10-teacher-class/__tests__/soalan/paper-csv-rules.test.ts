import { describe, expect, it } from 'vitest'

import {
  buildErrorCsv,
  countDataRows,
  errorFileName,
  parseCsvRecords,
  validateCsvFile,
  validateCsvRows,
} from '../../components/soalan/csv-rules'
import { validatePaper, validatePaperFiles } from '../../components/soalan/paper-rules'

const MB = 1024 * 1024
const f = (name: string, size = 10) => ({ name, size })

describe('paper rules (44-F4)', () => {
  it('AC-GUR-44-14: none, 6 files, wrong type, over 20 MB', () => {
    expect(validatePaperFiles([])).toBe('Sila pilih fail.')
    expect(validatePaperFiles(Array.from({ length: 6 }, (_, i) => f(`a${String(i)}.pdf`)))).toBe(
      'Maksimum 5 fail, saiz maksimum 20MB setiap fail',
    )
    expect(validatePaperFiles([f('a.pdf'), f('b.doc')])).toBe(
      'Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.',
    )
    expect(validatePaperFiles([f('a.xls')])).toContain('Jenis fail tidak disokong')
    expect(validatePaperFiles([f('a.pdf', 25 * MB)])).toBe('Fail melebihi saiz maksimum 20 MB.')
    expect(validatePaperFiles([f('a.pdf', 20 * MB), f('b.DOCX'), f('c.xlsx')])).toBeNull()
  })

  it('field texts and the confirmation', () => {
    const e = validatePaper({
      paperType: '',
      subject: ' ',
      year: '1999',
      preparedBy: 'x'.repeat(151),
      note: 'y'.repeat(1001),
      confirmed: false,
      files: [],
    })
    expect(e).toEqual({
      paperType: 'Sila pilih jenis soalan.',
      subject: 'Sila isi matapelajaran.',
      year: 'Tahun mesti antara 2000 dan 2099.',
      preparedBy: 'Disediakan oleh tidak boleh melebihi 150 aksara.',
      note: 'Catatan tambahan tidak boleh melebihi 1000 aksara.',
      answerSchemeConfirmed: 'Sila sahkan skema jawapan disertakan.',
      files: 'Sila pilih fail.',
    })
    expect(
      validatePaper({
        paperType: 'trial',
        subject: 'Kimia',
        year: '',
        preparedBy: '',
        note: '',
        confirmed: true,
        files: [f('a.pdf')],
      }),
    ).toEqual({})
  })
})

describe('csv rules (44-F3)', () => {
  it('file checks: none, not .csv, over 2 MB', () => {
    expect(validateCsvFile(null)).toBe('Sila pilih fail.')
    expect(validateCsvFile(f('a.xlsx'))).toBe('Jenis fail tidak disokong. Format dibenarkan: CSV.')
    expect(validateCsvFile(f('a.csv', 3 * MB))).toBe('Fail melebihi saiz maksimum 2 MB.')
    expect(validateCsvFile(f('A.CSV', 2 * MB))).toBeNull()
  })

  it('AC-GUR-44-13: 501 data rows are refused, 500 pass', () => {
    const make = (n: number) => `h1,h2\n${Array.from({ length: n }, () => 'a,b').join('\n')}\n`
    expect(countDataRows(make(501))).toBe(501)
    expect(validateCsvRows(make(501))).toBe('Fail melebihi 500 baris.')
    expect(validateCsvRows(make(500))).toBeNull()
  })

  it('parses quoted fields with line breaks and numbers records by file line', () => {
    const recs = parseCsvRecords('a,b\n"x\ny",2\n\nc,d\n')
    expect(recs.map((r) => r.line)).toEqual([1, 2, 5])
    expect(recs[1]?.raw).toBe('"x\ny",2')
  })

  it('builds the error file: Baris, Sebab, then the original columns (uploaded text kept)', () => {
    const text = 'subjek,soalan\nA,"s, 1"\nB,s2\n'
    const csv = buildErrorCsv(text, [{ row: 3, message: 'Jawapan mesti A, B, C atau D.' }])
    expect(csv.replace('﻿', '')).toBe(
      'Baris,Sebab,subjek,soalan\r\n3,"Jawapan mesti A, B, C atau D.",B,s2\r\n',
    )
  })

  it('names the error file ralat-import-yyyymmdd.csv', () => {
    expect(errorFileName(new Date(2026, 10, 5))).toBe('ralat-import-20261105.csv')
  })
})
