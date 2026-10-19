/**
 * M04-T2: CSV parsing and row planning of the S5 import (BR-M04-10, FR-M04-56, §6.12): quoting,
 * line numbers, defaults, error rows and messages. Pure functions, no store.
 */

import { describe, expect, it } from 'vitest'

import {
  IMPORT_HEADER,
  IMPORT_TEMPLATE_CSV,
  MSG_ANSWER,
  MSG_ANSWER_EMPTY_OPTION,
  MSG_DIFFICULTY,
  MSG_INCOMPLETE,
  MSG_LEVEL,
  MSG_MARKS,
  MSG_SUBJECT,
  parseCsv,
  planImport,
  type ImportDefaults,
} from '../../mock/import/csv'
import {
  bucketOfScore,
  distributionBucket,
  scoreQuestion,
} from '../../mock/repository/quality-rules'

const HEADER = IMPORT_HEADER.join(',')
const NO_DEFAULTS: ImportDefaults = {
  subjectId: null,
  educationLevelId: null,
  difficultyLevel: null,
}
const lookups = {
  subjectExists: (id: number) => id >= 1 && id <= 31,
  levelExists: (id: number) => id >= 1 && id <= 11,
}
const plan = (body: string, defaults = NO_DEFAULTS) =>
  planImport(`${HEADER}\n${body}`, defaults, lookups)

describe('parseCsv', () => {
  it('splits records and fields with the file line of each record', () => {
    expect(parseCsv('a,b\n1,2\n\n3,4')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 2, cells: ['1', '2'] },
      { line: 4, cells: ['3', '4'] },
    ])
  })

  it('handles quotes: commas, doubled quotes and line breaks inside a quoted field', () => {
    const rows = parseCsv(
      'q,x\n"Kuala Lumpur, ibu negara","dia berkata ""ya"""\n"baris 1\nbaris 2",z\nlast,row',
    )
    expect(rows[1]).toEqual({ line: 2, cells: ['Kuala Lumpur, ibu negara', 'dia berkata "ya"'] })
    expect(rows[2]).toEqual({ line: 3, cells: ['baris 1\nbaris 2', 'z'] })
    // The quoted line break moved the line counter by one.
    expect(rows[3]).toEqual({ line: 5, cells: ['last', 'row'] })
  })

  it('accepts CRLF and CR line ends, a BOM and a missing final newline', () => {
    expect(parseCsv('﻿h1,h2\r\nv1,v2\rv3,v4')).toEqual([
      { line: 1, cells: ['h1', 'h2'] },
      { line: 2, cells: ['v1', 'v2'] },
      { line: 3, cells: ['v3', 'v4'] },
    ])
  })

  it('ignores blank lines and rows of only commas (spreadsheet exports)', () => {
    expect(parseCsv('a,b\n,\n   \n1,2\n,,,')).toEqual([
      { line: 1, cells: ['a', 'b'] },
      { line: 4, cells: ['1', '2'] },
    ])
  })

  it('keeps an empty trailing field', () => {
    expect(parseCsv('"2 + 3 = ?",4,5,6,7,B,3,1,1,1,')[0]?.cells).toHaveLength(11)
  })
})

describe('planImport (BR-M04-10)', () => {
  it('turns a valid row into an MCQ input: letter → index, defaults, marks, explanation', () => {
    const p = plan('"Apakah ibu negara Malaysia?",KL,Putrajaya,Johor,Ipoh,c,3,11,4,2,"Kerana ..."')
    expect(p.failures).toEqual([])
    expect(p.rows).toHaveLength(1)
    expect(p.rows[0]).toEqual({
      line: 2,
      input: {
        subjectId: 3,
        educationLevelId: 11,
        difficultyLevel: 4,
        questionType: 'mcq',
        questionText: 'Apakah ibu negara Malaysia?',
        options: ['KL', 'Putrajaya', 'Johor', 'Ipoh'],
        correctAnswer: 2,
        explanation: 'Kerana ...',
        pointsValue: 2,
      },
    })
  })

  it('takes subject, level and difficulty from the form defaults when the column is empty; marks default 1', () => {
    const p = plan('"Soalan sepuluh aksara",A1,B1,,,B,,,,,', {
      subjectId: 3,
      educationLevelId: 10,
      difficultyLevel: 2,
    })
    expect(p.failures).toEqual([])
    const input = p.rows[0]?.input
    expect(input).toMatchObject({
      subjectId: 3,
      educationLevelId: 10,
      difficultyLevel: 2,
      pointsValue: 1,
    })
    // `option_c` / `option_d` may be empty (stored as "").
    expect(input?.options).toEqual(['A1', 'B1', '', ''])
    expect(input?.explanation).toBeNull()
  })

  it('a column value wins over the default', () => {
    const p = plan('"Soalan sepuluh aksara",A,B,,,A,5,1,3,,', {
      subjectId: 3,
      educationLevelId: 10,
      difficultyLevel: 2,
    })
    expect(p.rows[0]?.input).toMatchObject({
      subjectId: 5,
      educationLevelId: 1,
      difficultyLevel: 3,
    })
  })

  it('counts a row without subject_id (and no default) as failed and imports the others', () => {
    const p = plan(
      [
        '"Soalan pertama ok",A,B,C,D,A,3,4,1,1,',
        '"Soalan tanpa subjek",A,B,C,D,B,,4,1,1,',
        '"Soalan ketiga ok",A,B,C,D,C,3,4,1,1,',
      ].join('\n'),
    )
    expect(p.dataRows).toBe(3)
    expect(p.rows.map((r) => r.line)).toEqual([2, 4])
    expect(p.failures).toEqual([{ row: 3, message: MSG_SUBJECT }])
    // With "Subjek Lalai" set the same file imports 3.
    expect(
      plan(['"a soalan satu",A,B,,,A,3,4,1,,', '"b soalan dua",A,B,,,B,,4,1,,'].join('\n'), {
        subjectId: 3,
        educationLevelId: null,
        difficultyLevel: null,
      }).failures,
    ).toEqual([])
  })

  it('fails a row with the SRS / INFERRED messages', () => {
    const p = plan(
      [
        ',A,B,C,D,A,3,4,1,1,', // 2 no text
        '"t1 soalan",A,,C,D,A,3,4,1,1,', // 3 no option_b
        '"t2 soalan",A,B,C,D,,3,4,1,1,', // 4 no answer
        '"t3 soalan",A,B,C,D,E,3,4,1,1,', // 5 answer outside A–D
        '"t4 soalan",A,B,,,C,3,4,1,1,', // 6 answer names an empty option
        '"t5 soalan",A,B,C,D,A,99,4,1,1,', // 7 unknown subject
        '"t6 soalan",A,B,C,D,A,3,99,1,1,', // 8 unknown level
        '"t7 soalan",A,B,C,D,A,3,4,6,1,', // 9 difficulty 6
        '"t8 soalan",A,B,C,D,A,3,4,,1,', // 10 no difficulty, no default
        '"t9 soalan",A,B,C,D,A,3,4,1,0,', // 11 marks 0
        '"t10 soalan",A,B,C,D,A,3,4,1,x,', // 12 marks not a number
      ].join('\n'),
    )
    expect(p.rows).toHaveLength(0)
    expect(p.failures).toEqual([
      { row: 2, message: MSG_INCOMPLETE },
      { row: 3, message: MSG_INCOMPLETE },
      { row: 4, message: MSG_INCOMPLETE },
      { row: 5, message: MSG_ANSWER },
      { row: 6, message: MSG_ANSWER_EMPTY_OPTION },
      { row: 7, message: MSG_SUBJECT },
      { row: 8, message: MSG_LEVEL },
      { row: 9, message: MSG_DIFFICULTY },
      { row: 10, message: MSG_DIFFICULTY },
      { row: 11, message: MSG_MARKS },
      { row: 12, message: MSG_MARKS },
    ])
  })

  it('matches header names in any case and any column order, and ignores extra columns', () => {
    const text = [
      'Correct_Answer,Question_Text,extra,OPTION_A,option_b',
      'b,"Soalan sepuluh aksara",x,A,B',
    ].join('\n')
    const p = planImport(text, { subjectId: 3, educationLevelId: 4, difficultyLevel: 1 }, lookups)
    expect(p.failures).toEqual([])
    expect(p.rows[0]?.input).toMatchObject({
      questionText: 'Soalan sepuluh aksara',
      correctAnswer: 1,
    })
  })

  it('reports the required columns a file lacks, and an empty file', () => {
    expect(planImport('question_text,option_a\nx,y', NO_DEFAULTS, lookups).missingColumns).toEqual([
      'option_b',
      'correct_answer',
    ])
    expect(planImport('', NO_DEFAULTS, lookups).missingColumns).toHaveLength(4)
    const headerOnly = planImport(HEADER, NO_DEFAULTS, lookups)
    expect(headerOnly.missingColumns).toEqual([])
    expect(headerOnly.dataRows).toBe(0)
  })

  it('the download template imports its own two sample rows', () => {
    const p = planImport(
      IMPORT_TEMPLATE_CSV,
      { subjectId: null, educationLevelId: null, difficultyLevel: null },
      lookups,
    )
    expect(IMPORT_TEMPLATE_CSV.split('\r\n')[0]).toBe(HEADER)
    expect(p.dataRows).toBe(2)
    expect(p.failures).toEqual([])
    expect(p.rows[1]?.input).toMatchObject({
      questionText: '2 + 3 = ?',
      correctAnswer: 1,
      explanation: null,
    })
  })
})

describe('quality rules (§6.12 score(q), BR-M04-21)', () => {
  const base = {
    explanation: 'Penjelasan.',
    dskpSpId: 6191 as number | null,
    sourceType: 'textbook' as 'textbook' | null,
    complianceStatus: 'verified' as 'verified' | 'quarantined' | 'rejected',
    questionText: 'Teks soalan yang lebih daripada dua puluh aksara.',
  }

  it('scores 100 minus the penalties, clamped 0–100', () => {
    expect(scoreQuestion(base)).toBe(100)
    expect(scoreQuestion({ ...base, explanation: null })).toBe(85)
    expect(scoreQuestion({ ...base, explanation: '  ' })).toBe(85)
    expect(scoreQuestion({ ...base, dskpSpId: null })).toBe(90)
    expect(scoreQuestion({ ...base, sourceType: null })).toBe(90)
    expect(scoreQuestion({ ...base, complianceStatus: 'quarantined' })).toBe(85)
    expect(scoreQuestion({ ...base, complianceStatus: 'rejected' })).toBe(85)
    expect(scoreQuestion({ ...base, questionText: 'pendek' })).toBe(90)
    expect(
      scoreQuestion({
        explanation: null,
        dskpSpId: null,
        sourceType: null,
        complianceStatus: 'quarantined',
        questionText: 'x',
      }),
    ).toBe(40)
  })

  it('buckets: cemerlang 76–100, baik 51–75, lemah 26–50, kritikal 0–25', () => {
    expect([100, 76].map(bucketOfScore)).toEqual(['cemerlang', 'cemerlang'])
    expect([75, 51].map(bucketOfScore)).toEqual(['baik', 'baik'])
    expect([50, 0].map(bucketOfScore)).toEqual(['le50', 'le50'])
    expect([100, 76, 75, 51, 50, 26, 25, 0].map(distributionBucket)).toEqual([
      'cemerlang',
      'cemerlang',
      'baik',
      'baik',
      'lemah',
      'lemah',
      'kritikal',
      'kritikal',
    ])
  })
})
