import { QUESTION_IMPORT_HEADER, QUESTION_IMPORT_ROW_MESSAGES as MSG, QUESTION_IMPORT_TEMPLATE_CSV } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { GURU_IMPORT_CAPS, buildCsv, csvCell, parseCsv, planImport } from '../../src/modules/questions/workflow/imports/csv'

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

describe('imports: row planning (mock messages, verbatim)', () => {
  it('a valid row becomes an excel MCQ input, letter case ignored, marks default 1', () => {
    const p = plan('"Soalan sepuluh aksara",A1,B1,,,b,3,4,2,,"Sebab"')
    expect(p.failures).toEqual([])
    expect(p.rows[0]).toMatchObject({
      line: 2,
      input: {
        stemMs: 'Soalan sepuluh aksara',
        options: [{ label: 'A', text: 'A1' }, { label: 'B', text: 'B1' }],
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
    expect(plan('"Soalan sepuluh aksara",A,B,,,A,,,,,', d).rows[0]?.input).toMatchObject({ subjectId: '3', educationLevelId: '4', difficultyLevel: 2 })
    expect(plan('"Soalan sepuluh aksara",A,B,,,A,1,1,5,,', d).rows[0]?.input).toMatchObject({ subjectId: '1', educationLevelId: '1', difficultyLevel: 5 })
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
    const p = planImport('Correct_Answer,Question_Text,OPTION_A,option_b\nb,"Soalan",A,B', lookups, { subjectId: '3', educationLevelId: '4', difficultyLevel: 1 })
    expect(p.rows[0]?.input.correctLabel).toBe('B')
    expect(planImport('question_text,option_a\nx,y', lookups).missingColumns).toEqual(['option_b', 'correct_answer'])
    expect(planImport('', lookups).missingColumns).toHaveLength(4)
  })

  it('the Guru caps reject a long question text and a long option, after the other checks', () => {
    const long = (n: number) => 'x'.repeat(n)
    const body = (q: string, a: string) => `"${q}",${a},B,,,A,3,4,1,1,`
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
