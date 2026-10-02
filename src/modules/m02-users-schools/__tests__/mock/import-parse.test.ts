/**
 * M02-T2: the pure import parsing (SRS v1.28 BR-14, BR-15): CSV / paste records with line numbers,
 * header rule, Title Case, class levels and the row outcomes (planned / skipped / failed).
 */

import { describe, expect, it } from 'vitest'

import {
  countStudentRecords,
  countUserRecords,
  gradeOfClassLevel,
  IMPORT_MESSAGES,
  planStudentImport,
  planUserImport,
} from '../../mock/import/records'
import {
  csvRecords,
  isEmail,
  parseCsvLine,
  pasteBlocks,
  readImportFile,
  textLines,
  toTitleCase,
  withoutHeader,
} from '../../mock/import/text'

describe('text helpers', () => {
  it('splits LF, CRLF and CR lines and drops a BOM', () => {
    expect(textLines('﻿a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd'])
  })

  it('parses a CSV line: trims fields, keeps empty ones, honours quotes', () => {
    expect(parseCsvLine(' Ali , ali@x.my ,, pw ')).toEqual(['Ali', 'ali@x.my', '', 'pw'])
    expect(parseCsvLine('"Tan, Ah Kow",a@b.my')).toEqual(['Tan, Ah Kow', 'a@b.my'])
    expect(parseCsvLine('"say ""hi""",x')).toEqual(['say "hi"', 'x'])
    expect(parseCsvLine('')).toEqual([''])
  })

  it('csvRecords ignores blank lines but keeps the original line numbers', () => {
    const records = csvRecords('name,email\n\nAli,ali@x.my\r\n   \nSiti,siti@x.my')
    expect(records.map((r) => r.line)).toEqual([1, 3, 5])
    expect(records[2]?.cells).toEqual(['Siti', 'siti@x.my'])
  })

  it('pasteBlocks: records are blank-line separated blocks, numbered by their first line', () => {
    const blocks = pasteBlocks('Ali\nali@x.my\npw1\n\n\nSiti\nsiti@x.my\npw2\n990101015555\n')
    expect(blocks).toEqual([
      { line: 1, cells: ['Ali', 'ali@x.my', 'pw1'] },
      { line: 6, cells: ['Siti', 'siti@x.my', 'pw2', '990101015555'] },
    ])
    expect(pasteBlocks('  \n\n')).toEqual([])
  })

  it('header rule: the first record is a header when its second column is not an e-mail', () => {
    const withHeader = csvRecords('Nama,Emel,Telefon\nAli,ali@x.my')
    expect(withoutHeader(withHeader)).toHaveLength(1)
    const noHeader = csvRecords('Ali,ali@x.my\nSiti,siti@x.my')
    expect(withoutHeader(noHeader)).toHaveLength(2)
    expect(withoutHeader([])).toEqual([])
  })

  it('isEmail follows the shared e-mail rule', () => {
    expect(isEmail('a@b.my')).toBe(true)
    expect(isEmail('a@b')).toBe(true)
    expect(isEmail('a b@c.my')).toBe(false)
    expect(isEmail('')).toBe(false)
  })

  it('toTitleCase: first letter of each word upper-case, the rest lower-case', () => {
    expect(toTitleCase('  PELAJAR   DEMO bin sAtU ')).toBe('Pelajar Demo Bin Satu')
    expect(toTitleCase('')).toBe('')
  })

  it('readImportFile reads a string or a Blob, nothing else', async () => {
    expect(await readImportFile('abc')).toBe('abc')
    expect(await readImportFile(new Blob(['x,y']))).toBe('x,y')
    expect(await readImportFile(undefined)).toBeUndefined()
    expect(await readImportFile(12)).toBeUndefined()
  })
})

describe('planUserImport (BR-14)', () => {
  const taken = new Set(['sedia@ada.my'])
  const exists = (email: string) => taken.has(email.toLowerCase())

  it('plans, skips and fails per line; errors carry the original line number', () => {
    const text = [
      'Nama,Emel,Telefon,Kata Laluan', // 1 header
      'Ali,ali@x.my,0123456789,rahsia1', // 2 planned
      '', // 3
      'Siti,SITI@x.my', // 4 planned, no phone / password
      'Dup,sedia@ada.my', // 5 skipped: exists
      'Ali Dua,ALI@x.my', // 6 skipped: repeats line 2
      ',nama@x.my', // 7 failed: no name
      'Bad,bukan-emel', // 8 failed: bad e-mail
      'Tel,tel@x.my,012345678901234', // 9 failed: phone 15 chars
      'Pendek,pendek@x.my,,abc', // 10 failed: password < 6
    ].join('\r\n')
    const plan = planUserImport(text, exists)
    expect(plan.planned).toEqual([
      { line: 2, name: 'Ali', email: 'ali@x.my', phone: '0123456789', password: 'rahsia1' },
      { line: 4, name: 'Siti', email: 'SITI@x.my', phone: null, password: '' },
    ])
    expect(plan.skipped).toBe(2)
    expect(plan.failed).toBe(4)
    expect(plan.errors).toEqual([
      { line: 7, message: IMPORT_MESSAGES.noName },
      { line: 8, message: IMPORT_MESSAGES.badEmail },
      { line: 9, message: IMPORT_MESSAGES.phoneLong },
      { line: 10, message: IMPORT_MESSAGES.passwordShort },
    ])
  })

  it('a record that fails validation is not counted as a repeat of a later one', () => {
    const plan = planUserImport('X,dup@x.my,0123456789012345\nY,dup@x.my', () => false)
    expect(plan.failed).toBe(1)
    expect(plan.planned.map((p) => p.name)).toEqual(['Y'])
  })

  it('counts data records without the header', () => {
    expect(countUserRecords('')).toBe(0)
    expect(countUserRecords('name,email')).toBe(0)
    expect(countUserRecords('name,email\nAli,ali@x.my')).toBe(1)
    expect(countUserRecords('Ali,ali@x.my')).toBe(1)
  })
})

describe('planStudentImport (BR-15)', () => {
  const exists = (email: string) => email === 'ada@moe-dl.edu.my'

  it('paste blocks: Title Case name, optional IC, existing ID skipped, missing password failed', () => {
    const text = [
      'PELAJAR DEMO TIGA', // 1
      'pelajar.tiga@moe-dl.edu.my',
      'Kata1234',
      '990101015555',
      '',
      'SITI', // 6
      'ada@moe-dl.edu.my',
      'Kata1234',
      '',
      'Tiada Kata', // 10
      'tiada@moe-dl.edu.my',
      '',
      'Emel Buruk', // 13
      'buruk',
      'Kata1234',
    ].join('\n')
    const plan = planStudentImport(text, 'paste', exists)
    expect(plan.planned).toEqual([
      {
        line: 1,
        name: 'Pelajar Demo Tiga',
        email: 'pelajar.tiga@moe-dl.edu.my',
        password: 'Kata1234',
        icNumber: '990101015555',
      },
    ])
    expect(plan.skipped).toBe(1)
    expect(plan.failed).toBe(2)
    expect(plan.errors).toEqual([
      { line: 10, message: IMPORT_MESSAGES.noDelimaPassword },
      { line: 13, message: IMPORT_MESSAGES.badDelimaEmail },
    ])
    expect(countStudentRecords(text, 'paste')).toBe(4)
  })

  it('csv: name, email, password, ic? with a header and repeats skipped', () => {
    const text = 'Nama,Email,Kata,IC\nali baba,a@moe-dl.edu.my,pw1,\nALI BABA,A@moe-dl.edu.my,pw2,'
    const plan = planStudentImport(text, 'csv', () => false)
    expect(plan.planned).toEqual([
      { line: 2, name: 'Ali Baba', email: 'a@moe-dl.edu.my', password: 'pw1', icNumber: null },
    ])
    expect(plan.skipped).toBe(1)
    expect(countStudentRecords(text, 'csv')).toBe(2)
  })

  it('an over-long IC fails the record', () => {
    const plan = planStudentImport('A,a@x.my,pw,123456789012345', 'csv', () => false)
    expect(plan.errors).toEqual([{ line: 1, message: IMPORT_MESSAGES.icLong }])
  })
})

describe('gradeOfClassLevel (BR-15)', () => {
  it('D1–D6 → 1–6 and T1–T5 → 7–11; anything else is undefined', () => {
    expect(['D1', 'D6', 'T1', 'T3', 'T5'].map(gradeOfClassLevel)).toEqual([1, 6, 7, 9, 11])
    for (const bad of ['', 'T6', 'D0', 'd1', 'X1', 'T'])
      expect(gradeOfClassLevel(bad)).toBeUndefined()
  })
})
