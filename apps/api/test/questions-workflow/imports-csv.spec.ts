import {
  QUESTION_IMPORT_CODE_ROW_MESSAGES as CM,
  QUESTION_IMPORT_MESSAGE_MAX,
  cappedText,
  QUESTION_IMPORT_HEADER,
  QUESTION_IMPORT_MESSAGES,
  QUESTION_IMPORT_ROW_MESSAGES as MSG,
  QUESTION_IMPORT_TEMPLATE_CSV,
} from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { GURU_IMPORT_CAPS, buildCsv, csvCell, factsKey, parseCsv, planImport, type CodeLookups, type ImportLookups } from '../../src/modules/questions/workflow/imports/csv'

const lookups = { subjectIds: new Set(['1', '3']), levelIds: new Set(['1', '4']) }
const HEADER = QUESTION_IMPORT_HEADER.join(',')
const plan = (body: string, defaults = { subjectId: null, educationLevelId: null, difficultyLevel: null } as { subjectId: string | null; educationLevelId: string | null; difficultyLevel: number | null }) =>
  planImport(`${HEADER}\n${body}`, lookups, defaults)

describe('imports: CSV parser (mock csv.test.ts)', () => {
  it('splits records with file lines, quotes, doubled quotes and line breaks in a quoted field', () => {
    expect(parseCsv('a,b\n1,2\n\n3,4')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
      { line: 4, cells: ['3', '4'] },
    ])
    const rows = parseCsv('q,x\n"KL, ibu negara","dia ""ya"""\n"baris 1\nbaris 2",z\nlast,row')
    expect(rows[1]).toEqual({ line: 2, cells: ['KL, ibu negara', 'dia "ya"'] })
    expect(rows[2]).toEqual({ line: 3, cells: ['baris 1\nbaris 2', 'z'] })
    expect(rows[3]).toEqual({ line: 5, cells: ['last', 'row'] })
  })

  it('accepts CRLF, a BOM and ignores rows of only commas', () => {
    expect(parseCsv('﻿h1,h2\r\nv1,v2\r\n,,,\r\nv3,v4')).toEqual([
      { line: 1, cells: ['h1', 'h2'] },
      { line: 2, cells: ['v1', 'v2'] },
      { line: 4, cells: ['v3', 'v4'] },
    ])
  })
})

describe('imports: CRLF files (made on Windows)', () => {
  const rows = [
    '"Soalan dua baris\r\nbersambung",A,B,C,,B,1,1,3,2,',
    '"Soalan tidak lengkap",A,,C,D,A,1,1,1,1,',
    '"Jawapan salah",A,B,C,D,E,1,1,1,1,',
  ]
  const lf = `${HEADER}\n${rows.join('\n').replace(/\r\n/g, '\n')}`
  const crlf = `${HEADER}\r\n${rows.join('\r\n')}\r\n`

  it('keeps cell values free of CR and the bad-row lines identical to the LF file', () => {
    const a = planImport(lf, lookups)
    const b = planImport(crlf, lookups)
    expect(b.rows[0]?.input.stemMs).toBe('Soalan dua baris\nbersambung')
    expect(b.rows[0]?.input.stemMs).not.toContain('\r')
    expect(b.failures).toEqual([
      { row: 4, message: MSG.incomplete },
      { row: 5, message: MSG.answer },
    ])
    expect(b.failures).toEqual(a.failures)
    expect(b.rows).toEqual(a.rows)
  })

  it('turns a lone CR inside a quoted cell into LF and still counts the line', () => {
    expect(parseCsv('q,x\n"a\rb",c\nlast,row')).toEqual([
      { line: 1, cells: ['q', 'x'] },
      { line: 2, cells: ['a\nb', 'c'] },
      { line: 4, cells: ['last', 'row'] },
    ])
  })
})

describe('imports: row planning (mock messages, verbatim)', () => {
  it('a valid row becomes an excel MCQ input, letter case ignored, marks default 1', () => {
    const p = plan('"Soalan sepuluh aksara",A1,B1,C1,,b,3,4,2,,"Sebab"')
    expect(p.failures).toEqual([])
    expect(p.rows[0]).toMatchObject({
      line: 2,
      input: {
        stemMs: 'Soalan sepuluh aksara',
        options: [{ label: 'A', text: 'A1' }, { label: 'B', text: 'B1' }, { label: 'C', text: 'C1' }],
        correctLabel: 'B',
        subjectId: '3',
        educationLevelId: '4',
        difficultyLevel: 2,
        explanation: 'Sebab',
        sourceType: 'excel',
        marks: 1,
      },
    })
  })

  it('the form defaults fill empty cells; a cell wins over the default', () => {
    const d = { subjectId: '3', educationLevelId: '4', difficultyLevel: 2 }
    expect(plan('"Soalan sepuluh aksara",A,B,C,,A,,,,,', d).rows[0]?.input).toMatchObject({ subjectId: '3', educationLevelId: '4', difficultyLevel: 2 })
    expect(plan('"Soalan sepuluh aksara",A,B,C,,A,1,1,5,,', d).rows[0]?.input).toMatchObject({ subjectId: '1', educationLevelId: '1', difficultyLevel: 5 })
  })

  it('reports every bad row with its file line and the exact message', () => {
    const p = plan(
      [
        ',A,B,C,D,A,3,4,1,1,',
        '"t1",A,,C,D,A,3,4,1,1,',
        '"t3",A,B,C,D,E,3,4,1,1,',
        '"t4",A,B,,,C,3,4,1,1,',
        '"t5",A,B,C,D,A,99,4,1,1,',
        '"t6",A,B,C,D,A,3,99,1,1,',
        '"t7",A,B,C,D,A,3,4,6,1,',
        '"t8",A,B,C,D,A,3,4,,1,',
        '"t9",A,B,C,D,A,3,4,1,0,',
        '"t10",A,B,C,D,A,3,4,1,x,',
      ].join('\n'),
    )
    expect(p.rows).toHaveLength(0)
    expect(p.failures).toEqual([
      { row: 2, message: 'Baris tidak lengkap.' },
      { row: 3, message: 'Baris tidak lengkap.' },
      { row: 4, message: 'Jawapan betul mesti A, B, C atau D.' },
      { row: 5, message: MSG.answerEmptyOption },
      { row: 6, message: 'Subjek tidak sah.' },
      { row: 7, message: 'Tahap pendidikan tidak sah.' },
      { row: 8, message: 'Tahap kesukaran mesti 1 hingga 5.' },
      { row: 9, message: 'Tahap kesukaran mesti 1 hingga 5.' },
      { row: 10, message: 'Markah mesti nombor bulat sekurang-kurangnya 1.' },
      { row: 11, message: 'Markah mesti nombor bulat sekurang-kurangnya 1.' },
    ])
  })

  it('matches headers in any case and order, and reports missing required columns', () => {
    const p = planImport('Correct_Answer,Question_Text,OPTION_A,option_b,option_c\nb,"Soalan",A,B,C', lookups, { subjectId: '3', educationLevelId: '4', difficultyLevel: 1 })
    expect(p.rows[0]?.input.correctLabel).toBe('B')
    expect(planImport('question_text,option_a\nx,y', lookups).missingColumns).toEqual(['option_b', 'correct_answer'])
    expect(planImport('', lookups).missingColumns).toHaveLength(4)
  })

  it('the Guru caps reject a long question text and a long option, after the other checks', () => {
    const long = (n: number) => 'x'.repeat(n)
    const body = (q: string, a: string) => `"${q}",${a},B,C,,A,3,4,1,1,`
    const p = planImport(`${HEADER}\n${body(long(2001), 'A')}\n${body(long(2000), long(500))}\n${body('ok', long(501))}`, lookups, undefined, GURU_IMPORT_CAPS)
    expect(p.failures).toEqual([
      { row: 2, message: MSG.textTooLong },
      { row: 4, message: MSG.optionTooLong },
    ])
    expect(p.rows).toHaveLength(1)
  })
})

describe('imports: generated CSV is formula-safe', () => {
  it('prefixes a cell starting with =, +, - or @', () => {
    expect(csvCell('=1+1')).toBe("'=1+1")
    expect(csvCell('+1')).toBe("'+1")
    expect(csvCell('-1')).toBe("'-1")
    expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)")
    expect(csvCell('biasa')).toBe('biasa')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(buildCsv([['=cmd', 'x"y']])).toBe(`'=cmd,"x""y"\r\n`)
  })

  it('no cell of the template starts with a formula character', () => {
    for (const record of parseCsv(QUESTION_IMPORT_TEMPLATE_CSV)) for (const cell of record.cells) expect(cell).not.toMatch(/^[=+\-@]/)
  })
})


/* ---------------------------------------------------------------------------------------------------------- S1-T05 part 1: the new header */

const CODE_HEAD = 'question_key,type,prompt_ms,option_a,option_b,option_c,option_d,correct,marks,subject_code,tingkatan,kertas,number_label,unit_code,sp_kod,tp,aras,kbat,bab_kod,topik_kod,difficulty'
/** Subject MATH (id 3) at T4 (id 4) has DSKP nodes, chapters and is SPM-bound; subject SEJ (id 1) at T1 (id 1) has none. */
const dskp = {
  subjectId: '3',
  levelId: '4',
  hasDskpNodes: true,
  spmBound: true,
  units: new Map([['4.0', ['40']], ['5.0', ['50']]]),
  sps: new Map([
    ['4.1.1', [{ id: '411', unitIds: new Set(['40']) }]],
    ['4.1.2', [{ id: '412', unitIds: new Set(['40']) }]],
    ['4.1.3', [{ id: '413', unitIds: new Set(['40']) }]],
    ['4.1.4', [{ id: '414', unitIds: new Set(['40']) }]],
    ['5.1.1', [{ id: '511', unitIds: new Set(['50']) }]],
  ]),
  chapters: new Map([['4', { id: '700', topics: new Map([['2', '7002']]) }]]),
}
const plain = { subjectId: '1', levelId: '1', hasDskpNodes: false, spmBound: false, units: new Map(), sps: new Map(), chapters: new Map() }
const codes: CodeLookups = {
  subjectsByCode: new Map([['MATH', '3'], ['SEJ', '1']]),
  levelsByCode: new Map([['T4', '4'], ['T1', '1']]),
  facts: new Map([[factsKey('3', '4'), dskp], [factsKey('1', '1'), plain]]),
}
const withCodes: ImportLookups = { ...lookups, codes }
const row = (over: Record<string, string> = {}): string => {
  const base: Record<string, string> = {
    question_key: 'K1', type: 'mcq', prompt_ms: 'Berapakah hasil tambah dua dan tiga?', option_a: '4', option_b: '5', option_c: '6', option_d: '7', correct: 'B', marks: '2',
    subject_code: 'MATH', tingkatan: '4', kertas: '1', number_label: '12A', unit_code: '4.0', sp_kod: '4.1.1;4.1.2', tp: '3', aras: 'mengaplikasi', kbat: '', bab_kod: '4', topik_kod: '2', difficulty: '3',
  }
  return CODE_HEAD.split(',').map((c) => csvCell({ ...base, ...over }[c] ?? '')).join(',')
}
const codePlan = (rows: string[], head = CODE_HEAD, defaults?: { subjectId: string | null; educationLevelId: string | null; difficultyLevel: number | null }) =>
  planImport([head, ...rows].join('\n'), withCodes, defaults)

describe('imports: the new header with codes (S1-T05, Q-11)', () => {
  it('[CI] detects the header by the first cell: question_text is legacy (no warning), anything else is the new header', () => {
    const legacy = planImport(`${HEADER},kolum_lain\n"Soalan sepuluh aksara",A,B,C,D,A,3,4,1,1,,,x`, withCodes)
    expect(legacy.format).toBe('legacy')
    expect(legacy.warnings).toEqual([])
    expect(legacy.rows).toHaveLength(1)
    // A legacy file whose columns are in another order is still legacy (columns are matched by name).
    expect(planImport('Correct_Answer,Question_Text,OPTION_A,option_b,option_c\nb,"Soalan",A,B,C', lookups, { subjectId: '3', educationLevelId: '4', difficultyLevel: 1 }).format).toBe('legacy')
    const p = codePlan([row()])
    expect(p.format).toBe('codes')
    expect(p.failures).toEqual([])
    expect(p.rows).toHaveLength(1)
  })

  it('[CI] legacy planning is unchanged: failures carry only { row, message } with no prefix, code or field', () => {
    const p = planImport(`${HEADER}\n"x",A,,C,D,A,3,4,1,1,`, lookups)
    expect(p.failures).toEqual([{ row: 2, message: MSG.incomplete }])
  })

  it('[CI] ignores an unknown header cell with "Kolum {nama} tidak dikenali dan diabaikan." once, and not the columns of the header list', () => {
    const p = codePlan([row()], `${CODE_HEAD},Warna,warna,group_key,stimulus_text,explanation,difficulty_level`)
    expect(p.warnings).toEqual(['Kolum Warna tidak dikenali dan diabaikan.'])
    expect(QUESTION_IMPORT_MESSAGES.unknownColumn('x')).toBe('Kolum x tidak dikenali dan diabaikan.')
    expect(p.rows).toHaveLength(1)
  })

  it('[CI] a missing required column of the new header refuses the file with the column list', () => {
    expect(planImport('question_key,type,prompt_ms\nK1,mcq,x', withCodes).missingColumns).toEqual(['option_a', 'option_b', 'correct', 'marks'])
  })

  it('[CI] maps subject, Tingkatan, unit, SP, chapter and topic codes to ids and carries TP, aras, kertas and difficulty', () => {
    const p = codePlan([row()])
    expect(p.rows[0]).toMatchObject({
      line: 2,
      questionKey: 'K1',
      input: {
        stemMs: 'Berapakah hasil tambah dua dan tiga?',
        options: [{ label: 'A', text: '4' }, { label: 'B', text: '5' }, { label: 'C', text: '6' }, { label: 'D', text: '7' }],
        correctLabel: 'B',
        subjectId: '3',
        educationLevelId: '4',
        unitId: '40',
        spIds: ['411', '412'],
        tp: 3,
        cognitiveLevel: 'mengaplikasi',
        chapterId: '700',
        topicId: '7002',
        kertas: '1',
        numberLabel: '12A',
        difficultyLevel: 3,
        marks: 2,
        sourceType: 'excel',
      },
    })
  })

  it('[CI] difficulty: the cell, else the screen default, else min(5, tp); accepts difficulty_level; Tingkatan accepts 4 and T4, subject code any case', () => {
    expect(codePlan([row({ tp: '6', difficulty: '' })]).rows[0]?.input.difficultyLevel).toBe(5)
    expect(codePlan([row({ tp: '6', difficulty: '2' })]).rows[0]?.input.difficultyLevel).toBe(2)
    expect(codePlan([row({ tp: '6', difficulty: '' })], CODE_HEAD, { subjectId: null, educationLevelId: null, difficultyLevel: 4 }).rows[0]?.input.difficultyLevel).toBe(4)
    expect(codePlan([row({ difficulty: '' })], CODE_HEAD.replace('difficulty', 'difficulty_level')).rows[0]?.input.difficultyLevel).toBe(3)
    expect(codePlan([row({ difficulty: '4' })], CODE_HEAD.replace('difficulty', 'difficulty_level')).rows[0]?.input.difficultyLevel).toBe(4)
    const p = codePlan([row({ tingkatan: 'T4', subject_code: 'math' })])
    expect(p.rows[0]?.input).toMatchObject({ subjectId: '3', educationLevelId: '4' })
  })

  it('[CI] form defaults fill an empty subject_code and tingkatan', () => {
    const p = codePlan([row({ subject_code: '', tingkatan: '' })], CODE_HEAD, { subjectId: '3', educationLevelId: '4', difficultyLevel: null })
    expect(p.failures).toEqual([])
    expect(p.rows[0]?.input).toMatchObject({ subjectId: '3', educationLevelId: '4', unitId: '40' })
  })

  it('[CI] a Subjek + Tingkatan without DSKP nodes needs no unit, SP, TP or aras, and a row without a Bab is accepted as a draft', () => {
    const p = codePlan([row({ subject_code: 'SEJ', tingkatan: '1', kertas: '', unit_code: '', sp_kod: '', tp: '', aras: '', bab_kod: '', topik_kod: '', difficulty: '2' })])
    expect(p.failures).toEqual([])
    expect(p.rows[0]?.input.unitId).toBeUndefined()
    expect(p.rows[0]?.input.chapterId).toBeUndefined()
  })

  it('[CI] invalid codes give the exact Q-11 BM text with the "Baris {n}: " prefix, the field, a code and the question key', () => {
    const cases: [Record<string, string>, string, string, string][] = [
      [{ subject_code: 'XYZ' }, 'subject_code', 'SUBJECT_UNKNOWN', 'Kod subjek tidak dikenali.'],
      [{ tingkatan: '9' }, 'tingkatan', 'TINGKATAN_INVALID', 'Tingkatan tidak sah.'],
      [{ unit_code: '' }, 'unit_code', 'UNIT_REQUIRED', 'Sila pilih unit DSKP.'],
      [{ unit_code: '9.9' }, 'unit_code', 'UNIT_UNKNOWN', 'Kod unit tiada dalam senarai kurikulum.'],
      [{ sp_kod: '' }, 'sp_kod', 'SP_REQUIRED', 'Sila pilih sekurang-kurangnya satu SP DSKP.'],
      [{ sp_kod: '4.1.1;4.1.2;4.1.3;4.1.4' }, 'sp_kod', 'SP_TOO_MANY', 'Pilih paling banyak 3 SP.'],
      [{ sp_kod: '7.7.7' }, 'sp_kod', 'SP_UNKNOWN', 'SP "7.7.7" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.'],
      [{ sp_kod: '5.1.1' }, 'sp_kod', 'SP_UNKNOWN', 'SP "5.1.1" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.'],
      [{ tp: '' }, 'tp', 'TP_REQUIRED', 'Bahagian (1) belum ada TP.'],
      [{ tp: '7' }, 'tp', 'TP_RANGE', 'TP mesti antara 1 dan 6.'],
      [{ tp: '0' }, 'tp', 'TP_RANGE', 'TP mesti antara 1 dan 6.'],
      [{ tp: 'a' }, 'tp', 'TP_RANGE', 'TP mesti antara 1 dan 6.'],
      [{ aras: '' }, 'aras', 'ARAS_REQUIRED', 'Bahagian (1) belum ada aras pemikiran.'],
      [{ aras: 'pandai' }, 'aras', 'ARAS_INVALID', 'Aras pemikiran tidak sah.'],
      [{ kbat: 'tinggi' }, 'kbat', 'KBAT_INVALID', 'Nilai KBAT tidak sah.'],
      [{ bab_kod: '9' }, 'bab_kod', 'CHAPTER_MISMATCH', 'Bab tidak sepadan dengan subjek dan tahap.'],
      [{ topik_kod: '9' }, 'topik_kod', 'TOPIC_INVALID', 'Topik tidak sah.'],
      [{ kertas: '' }, 'kertas', 'KERTAS_REQUIRED', 'Sila pilih kertas untuk soalan SPM.'],
      [{ kertas: '7' }, 'kertas', 'KERTAS_INVALID', 'Kertas tidak sah.'],
      [{ number_label: '1234' }, 'number_label', 'NUMBER_LABEL_INVALID', 'Nombor soalan tidak sah.'],
      [{ difficulty: '9' }, 'difficulty', 'DIFFICULTY_INVALID', 'Sila pilih tahap kesukaran.'],
      [{ type: 'drawing' }, 'type', 'TYPE_STUDIO_ONLY', 'Jenis ini dimasukkan melalui wizard Studio.'],
      [{ type: 'essay' }, 'type', 'TYPE_STUDIO_ONLY', 'Jenis ini dimasukkan melalui wizard Studio.'],
      [{ type: 'pilihan' }, 'type', 'TYPE_INVALID', 'Jenis soalan tidak sah.'],
      [{ prompt_ms: 'pendek' }, 'prompt_ms', 'PROMPT_SHORT', 'Teks soalan mesti sekurang-kurangnya 10 aksara.'],
      [{ option_b: '', correct: 'A' }, 'option_a', 'OPTIONS_BLANK', 'Sila isi semua pilihan jawapan.'],
      [{ option_c: '', option_d: '7', correct: 'A' }, 'option_a', 'OPTIONS_BLANK', 'Sila isi semua pilihan jawapan.'],
      [{ correct: '' }, 'correct', 'CORRECT_REQUIRED', 'Sila pilih jawapan betul.'],
      [{ correct: 'H' }, 'correct', 'CORRECT_REQUIRED', 'Sila pilih jawapan betul.'],
      [{ marks: '0' }, 'marks', 'MARKS_MIN', 'Nilai mata mesti sekurang-kurangnya 1.'],
      [{ marks: '' }, 'marks', 'MARKS_MIN', 'Nilai mata mesti sekurang-kurangnya 1.'],
      [{ marks: '101' }, 'marks', 'MARKS_MAX', 'Markah bahagian tidak boleh melebihi 100.'],
      [{ bahasa: 'fr' }, 'bahasa', 'BAHASA_INVALID', 'Bahasa tidak sah.'],
      [{ jenis_tulisan: 'x' }, 'jenis_tulisan', 'SCRIPT_INVALID', 'Jenis tulisan tidak sah.'],
    ]
    for (const [over, field, code, message] of cases) {
      const p = planImport([`${CODE_HEAD},bahasa,jenis_tulisan`, `${row(over)},${over.bahasa ?? ''},${over.jenis_tulisan ?? ''}`].join('\n'), withCodes)
      expect(p.rows, JSON.stringify(over)).toHaveLength(0)
      expect(p.failures, JSON.stringify(over)).toEqual([{ row: 2, message: `Baris 2: ${message}`, questionKey: 'K1', field, code }])
    }
  })

  it('[CI] the "Soalan" texts of Q-11 are exact', () => {
    expect(CM.keyRequired).toBe('Kunci soalan diperlukan.')
    expect(CM.keyNotConsecutive).toBe('Baris soalan tidak berturutan.')
    expect(CM.keyDuplicate('A1')).toBe('Kunci soalan A1 berulang dalam fail.')
  })

  it('[CI] question_key: empty, repeated right after (duplicate) and repeated later (not consecutive); every error of a row is reported', () => {
    const p = codePlan([row({ question_key: '' }), row({ question_key: 'K2' }), row({ question_key: 'K2' }), row({ question_key: 'K3' }), row({ question_key: 'K2' })])
    expect(p.rows.map((r) => r.questionKey)).toEqual(['K2', 'K3'])
    expect(p.failures).toEqual([
      { row: 2, message: 'Baris 2: Kunci soalan diperlukan.', field: 'question_key', code: 'KEY_REQUIRED' },
      { row: 4, message: 'Baris 4: Kunci soalan K2 berulang dalam fail.', questionKey: 'K2', field: 'question_key', code: 'KEY_DUPLICATE' },
      { row: 6, message: 'Baris 6: Baris soalan tidak berturutan.', questionKey: 'K2', field: 'question_key', code: 'KEY_NOT_CONSECUTIVE' },
    ])
    const many = codePlan([row({ unit_code: '', sp_kod: '', tp: '', aras: '', marks: '0' })])
    expect(many.failures.map((f) => f.code)).toEqual(['MARKS_MIN', 'UNIT_REQUIRED', 'SP_REQUIRED', 'TP_REQUIRED', 'ARAS_REQUIRED'])
  })

  it('[CI] partial success is per question: the valid rows are planned, the invalid ones skipped whole', () => {
    const p = codePlan([row({ question_key: 'A' }), row({ question_key: 'B', tp: '9' }), row({ question_key: 'C' })])
    expect(p.rows.map((r) => r.questionKey)).toEqual(['A', 'C'])
    expect(p.failures.map((f) => f.questionKey)).toEqual(['B'])
    expect(p.dataRows).toBe(3)
  })

  it('[CI] the TP and aras messages carry the part label when the row has one', () => {
    const p = planImport([`${CODE_HEAD},part_label`, `${row({ tp: '', aras: '' })},(a)`].join('\n'), withCodes)
    expect(p.failures.map((f) => f.message)).toEqual(['Baris 2: Bahagian (a) belum ada TP.', 'Baris 2: Bahagian (a) belum ada aras pemikiran.'])
  })

  it('[CI] more than 2,000 data rows refuses the file whole (both formats); 2,000 is accepted', () => {
    const many = (n: number, line: string) => Array.from({ length: n }, (_, i) => line.replace('K1', `K${String(i)}`))
    const over = planImport([CODE_HEAD, ...many(2001, row())].join('\n'), withCodes)
    expect(over.rowLimitExceeded).toBe(true)
    expect(over.rows).toHaveLength(0)
    expect(planImport([CODE_HEAD, ...many(2000, row())].join('\n'), withCodes).rowLimitExceeded).toBe(false)
    const legacy = planImport([HEADER, ...Array.from({ length: 2001 }, () => '"Soalan sepuluh aksara",A,B,C,D,A,3,4,1,1,')].join('\n'), lookups)
    expect(legacy.rowLimitExceeded).toBe(true)
    expect(QUESTION_IMPORT_MESSAGES.tooManyRows).toBe('Fail melebihi 2,000 baris. Pecahkan fail kepada beberapa bahagian.')
  })
})

describe('imports: echoed file values are capped (review of #704)', () => {
  it('[CI] a 500-character key or SP code shows up cut at 40 characters in the message and in the stored failure key', () => {
    const long = 'k'.repeat(500)
    const p = codePlan([row({ question_key: long }), row({ question_key: long }), row({ question_key: 'K9', sp_kod: 's'.repeat(500) }), row({ question_key: 'K8', part_label: '' , tp: '' })])
    expect(p.failures[0]?.message).toBe(`Baris 3: Kunci soalan ${'k'.repeat(40)} berulang dalam fail.`)
    expect(p.failures[0]?.questionKey).toBe('k'.repeat(40))
    expect(p.failures[1]?.message).toBe(`Baris 4: SP "${'s'.repeat(40)}" tiada dalam senarai kurikulum. Pilih SP daripada senarai DSKP.`)
    expect(JSON.stringify(p.failures)).not.toContain('k'.repeat(41))
    expect(JSON.stringify(p.failures)).not.toContain('s'.repeat(41))
    const label = planImport([`${CODE_HEAD},part_label`, `${row({ tp: '' })},${'b'.repeat(500)}`].join('\n'), withCodes)
    expect(label.failures[0]?.message).toBe(`Baris 2: Bahagian (${'b'.repeat(40)}) belum ada TP.`)
  })

  it('[CI] the 2,000-row cap is checked before the missing columns', () => {
    const rows = Array.from({ length: 2001 }, () => 'K,mcq')
    const p = planImport(['question_key,type', ...rows].join('\n'), withCodes)
    expect(p.rowLimitExceeded).toBe(true)
    expect(p.missingColumns).toEqual([])
  })
})


/* ---------------------------------------------------------------------------------------------------- S1-T05 part 2: groups and stimuli */

const GROUP_HEAD = `${CODE_HEAD},group_key,group_order,group_id,stimulus_label,stimulus_kind,stimulus_text,stimulus_image,stimulus_alt,stimulus_caption,part_stimulus,stimulus2_label,stimulus2_kind,stimulus2_text`
const grow = (over: Record<string, string> = {}): string => {
  const base: Record<string, string> = { group_key: 'G1' }
  const rest = GROUP_HEAD.split(',').slice(CODE_HEAD.split(',').length)
  const cells = rest.map((c) => csvCell({ ...base, ...over }[c] ?? ''))
  return `${row(over)},${cells.join(',')}`
}
const FIRST = { stimulus_label: 'Rajah 1', stimulus_kind: 'passage', stimulus_text: 'Petikan ringkas tentang pasar.' }
const gplan = (rows: string[], extra?: Partial<ImportLookups>) => planImport([GROUP_HEAD, ...rows].join('\n'), { ...withCodes, ...extra }, undefined)
const NO_PLAIN = { subject_code: 'SEJ', tingkatan: '1', kertas: '', unit_code: '', sp_kod: '', tp: '', aras: '', bab_kod: '', topik_kod: '' }

describe('imports: groups and stimuli (S1-T05 part 2, Q-11 and FR-ADM-QE6.4)', () => {
  it('[CI] one group of 3 rows is one group with 3 members in group_order and one stimulus', () => {
    const p = gplan([
      grow({ question_key: 'A', group_order: '3', ...FIRST }),
      grow({ question_key: 'B', group_order: '1' }),
      grow({ question_key: 'C', group_order: '2' }),
    ])
    expect(p.failures).toEqual([])
    expect(p.rows).toHaveLength(0)
    expect(p.groups).toHaveLength(1)
    expect(p.groups[0]?.members.map((m) => m.questionKey)).toEqual(['B', 'C', 'A'])
    expect(p.groups[0]?.stimuli).toEqual([{ kind: 'passage', label: 'Rajah 1', caption: null, bodyMs: 'Petikan ringkas tentang pasar.', bodyEn: null, alt: null, sourceCitation: null, tableData: null }])
    expect(p.groups[0]).toMatchObject({ key: 'G1', existingGroupId: null })
  })

  it('[CI] up to three stimuli, a table from JSON and a part stimulus by label', () => {
    const p = gplan([
      grow({ question_key: 'A', ...FIRST, stimulus_caption: 'Sumber kajian', stimulus2_label: 'Jadual 1', stimulus2_kind: 'table', stimulus2_text: '[["Nama","Skor"],["a",1]]', part_stimulus: 'Jadual 1' }),
      grow({ question_key: 'B' }),
    ])
    expect(p.failures).toEqual([])
    expect(p.groups[0]?.stimuli[1]).toMatchObject({ kind: 'table', bodyMs: null, tableData: { head: ['Nama', 'Skor'], rows: [['a', '1']] } })
    expect(p.groups[0]?.stimuli[0]?.caption).toBe('Sumber kajian')
    expect(p.groups[0]?.members[0]?.partStimulusIndex).toBe(1)
  })

  it('[CI] "Baris kumpulan mesti berturutan." for a group row after ungrouped rows; "Kumpulan {key} sudah diimport dalam kelompok ini." after another group', () => {
    const p = gplan([
      grow({ question_key: 'A', ...FIRST }),
      grow({ question_key: 'B', group_key: '' }),
      grow({ question_key: 'C' }),
      grow({ question_key: 'D', group_key: 'G2', ...FIRST }),
      grow({ question_key: 'E', group_key: 'G1' }),
    ])
    expect(p.groups.map((g) => g.key)).toEqual(['G1', 'G2'])
    expect(p.rows.map((r) => r.questionKey)).toEqual(['B'])
    expect(p.failures.map((f) => [f.row, f.code, f.message])).toEqual([
      [4, 'GROUP_NOT_CONSECUTIVE', 'Baris 4: Baris kumpulan mesti berturutan.'],
      [6, 'GROUP_ALREADY_IMPORTED', 'Baris 6: Kumpulan G1 sudah diimport dalam kelompok ini.'],
    ])
  })

  it('[CI] mixed Subjek or Kertas, and stimulus fields on a later row, give the QE6.4 texts once (no second "Baris {n}:")', () => {
    const p = gplan([
      grow({ question_key: 'A', ...FIRST }),
      grow({ question_key: 'B', ...NO_PLAIN, difficulty: '2' }),
      grow({ question_key: 'C', stimulus_label: 'Rajah 2' }),
    ])
    expect(p.groups).toHaveLength(0)
    expect(p.failedQuestions).toBe(3)
    expect(p.failures.map((f) => [f.row, f.code, f.message])).toEqual([
      [3, 'GROUP_MIXED', 'Baris 3: kumpulan G1 bercampur subjek atau kertas.'],
      [4, 'GROUP_STIMULUS_FIRST_ROW_ONLY', 'Baris 4: rangsangan hanya pada baris pertama kumpulan.'],
    ])
    const k = gplan([grow({ question_key: 'A', ...FIRST }), grow({ question_key: 'B', kertas: '2' })])
    expect(k.failures.map((f) => f.message)).toEqual(['Baris 3: kumpulan G1 bercampur subjek atau kertas.'])
  })

  it('[CI] group_order must be 1..n and unique: "Susunan kumpulan tidak sah."', () => {
    for (const orders of [['1', '1'], ['1', '3'], ['0', '1'], ['x', '1']]) {
      const p = gplan([grow({ question_key: 'A', group_order: orders[0] as string, ...FIRST }), grow({ question_key: 'B', group_order: orders[1] as string })])
      expect(p.groups, orders.join()).toHaveLength(0)
      expect(p.failures.map((f) => f.message), orders.join()).toContain(orders[0] === '1' ? 'Baris 3: Susunan kumpulan tidak sah.' : 'Baris 2: Susunan kumpulan tidak sah.')
    }
  })

  it('[CI] every stimulus rule has its Q-11 text on the first row', () => {
    const msgs = (over: Record<string, string>): string[] => gplan([grow({ question_key: 'A', ...FIRST, ...over })]).failures.map((f) => f.message)
    expect(msgs({ stimulus_label: '', stimulus_kind: '', stimulus_text: '' })).toEqual(['Baris 2: Satu kumpulan mesti mempunyai 1 hingga 3 rangsangan.'])
    expect(msgs({ stimulus_label: '' })).toEqual(['Baris 2: Sila isi label rangsangan.'])
    expect(msgs({ stimulus_kind: 'video' })).toEqual(['Baris 2: Sila pilih jenis rangsangan.'])
    expect(msgs({ stimulus_text: '' })).toEqual(['Baris 2: Petikan mesti mempunyai teks.'])
    expect(msgs({ stimulus_kind: 'table', stimulus_text: '[["a"]]' })).toEqual(['Baris 2: Jadual mesti mempunyai kepala dan sekurang-kurangnya satu baris, atau imej.'])
    expect(msgs({ stimulus_kind: 'table', stimulus_text: 'bukan json' })).toEqual(['Baris 2: Jadual mesti mempunyai kepala dan sekurang-kurangnya satu baris, atau imej.'])
    expect(msgs({ stimulus_caption: 'k'.repeat(301) })).toEqual(['Baris 2: Kapsyen tidak boleh melebihi 300 aksara.'])
    expect(msgs({ stimulus_kind: 'diagram', stimulus_text: '', stimulus_image: 'rajah.png' })).toEqual(['Baris 2: Imej rangsangan tidak dapat dimuat turun.', 'Baris 2: Sila isi teks alternatif imej.'])
    expect(msgs({ stimulus_label: 'x'.repeat(101) })).toEqual(['Baris 2: Data yang dihantar tidak sah. Sila semak dan cuba lagi.'])
    expect(msgs({ part_stimulus: 'Tiada' })).toEqual(['Baris 2: Rangsangan bahagian mesti daripada kumpulan soalan ini.'])
  })

  it('[CI] a URL (or any) stimulus_image is a row error until the ZIP exists; an image kind without an image is the same error', () => {
    for (const image of ['https://contoh.test/a.png', 'http://contoh.test/a.png', 'a.png']) {
      const p = gplan([grow({ question_key: 'A', ...FIRST, stimulus_kind: 'image', stimulus_image: image, stimulus_alt: 'Gambar pasar' })])
      expect(p.groups).toHaveLength(0)
      expect(p.failures).toEqual([{ row: 2, message: 'Baris 2: Imej rangsangan tidak dapat dimuat turun.', questionKey: 'A', field: 'stimulus_image', code: 'STIMULUS_IMAGE_UNAVAILABLE' }])
    }
    expect(gplan([grow({ question_key: 'A', ...FIRST, stimulus_kind: 'map', stimulus_alt: 'Peta' })]).failures.map((f) => f.code)).toEqual(['STIMULUS_IMAGE_UNAVAILABLE'])
  })

  it('[CI] a member with its own error skips the whole group, the other questions still import', () => {
    const p = gplan([grow({ question_key: 'A', group_key: '' }), grow({ question_key: 'B', ...FIRST }), grow({ question_key: 'C', tp: '9' }), grow({ question_key: 'D', group_key: '' })])
    expect(p.rows.map((r) => r.questionKey)).toEqual(['A', 'D'])
    expect(p.groups).toHaveLength(0)
    expect(p.failedQuestions).toBe(2)
    expect(p.failures.map((f) => f.questionKey)).toEqual(['C'])
  })

  it('[CI] group_id: a group that is missing or shown to pupils gives the QE6.4 text; a usable one is joined; stimulus columns with it are refused', () => {
    const groups = new Map([['7', { stimuli: new Map([['Rajah 1', '71']]) }], ['8', null]])
    const join = (id: string, over: Record<string, string> = {}) => gplan([grow({ question_key: 'A', group_key: '', group_id: id, ...over })], { codes: { ...codes, groups } })
    expect(join('8').failures.map((f) => [f.message, f.code])).toEqual([['Baris 2: Kumpulan tidak dijumpai atau sedang dipaparkan kepada murid.', 'GROUP_UNAVAILABLE']])
    expect(join('99').failures.map((f) => f.code)).toEqual(['GROUP_UNAVAILABLE'])
    expect(join('abc').failures.map((f) => f.code)).toEqual(['GROUP_UNAVAILABLE'])
    const ok = join('7', { part_stimulus: 'Rajah 1' })
    expect(ok.failures).toEqual([])
    expect(ok.groups[0]).toMatchObject({ existingGroupId: '7', stimuli: [] })
    expect(ok.groups[0]?.members[0]?.input.partStimulusId).toBe('71')
    expect(join('7', FIRST).failures.map((f) => [f.message, f.code])).toEqual([['Baris 2: Data yang dihantar tidak sah. Sila semak dan cuba lagi.', 'GROUP_FIELDS_INVALID']])
    expect(join('7', { part_stimulus: 'Lain' }).failures.map((f) => f.code)).toEqual(['PART_STIMULUS_INVALID'])
  })

  it('[CI] stimulus columns on a row with no group are refused with the ERR-REQ-01 text', () => {
    const p = gplan([grow({ question_key: 'A', group_key: '', ...FIRST })])
    expect(p.failures.map((f) => [f.message, f.code])).toEqual([['Baris 2: Data yang dihantar tidak sah. Sila semak dan cuba lagi.', 'GROUP_FIELDS_INVALID']])
  })

  it('[CI] a group key echoed in a message is cut at 40 characters', () => {
    const key = 'g'.repeat(500)
    const p = gplan([grow({ question_key: 'A', group_key: key, ...FIRST }), grow({ question_key: 'B', group_key: key, ...NO_PLAIN, difficulty: '2' })])
    expect(p.failures[0]?.message).toBe(`Baris 3: kumpulan ${'g'.repeat(40)} bercampur subjek atau kertas.`)
    const q = gplan([grow({ question_key: 'A', group_key: key, ...FIRST }), grow({ question_key: 'B', group_key: 'H', ...FIRST }), grow({ question_key: 'C', group_key: key })])
    expect(q.failures[0]?.message).toBe(`Baris 4: Kumpulan ${'g'.repeat(40)} sudah diimport dalam kelompok ini.`)
    expect(JSON.stringify(p.failures) + JSON.stringify(q.failures)).not.toContain('g'.repeat(41))
  })
})

describe('imports: #719 review minors', () => {
  it('[CI] a service message is capped at QUESTION_IMPORT_MESSAGE_MAX code points', () => {
    expect(cappedText('x'.repeat(500), QUESTION_IMPORT_MESSAGE_MAX)).toHaveLength(200)
    expect(cappedText('Subjek dan Tingkatan ahli mesti sama dengan kumpulan.', QUESTION_IMPORT_MESSAGE_MAX)).toBe('Subjek dan Tingkatan ahli mesti sama dengan kumpulan.')
  })

  it('[CI] group_order of a group_id row without group_key: a one-row block, so only empty or 1 is valid', () => {
    const groups = new Map([['7', { stimuli: new Map<string, string>() }]])
    const join = (order: string) => gplan([grow({ question_key: 'A', group_key: '', group_id: '7', group_order: order })], { codes: { ...codes, groups } })
    expect(join('').failures).toEqual([])
    expect(join('1').failures).toEqual([])
    expect(join('2').failures.map((f) => [f.code, f.message])).toEqual([['GROUP_ORDER_INVALID', 'Baris 2: Susunan kumpulan tidak sah.']])
  })
})
