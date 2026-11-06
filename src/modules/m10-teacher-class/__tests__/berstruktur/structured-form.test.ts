/**
 * R1-GUR-44b form logic (S6-T17): the PRD's validation texts, the total marks, the DSKP rule (D112), the
 * request body, and the contract shape of that body against a zod mirror of
 * `packages/contract/src/questions/schema.ts` (`GuruStructuredCreateRequest`). Keep the mirror in step with the contract.
 */
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  buildBody,
  canAddPart,
  canRemovePart,
  defaultDifficulty,
  emptyPart,
  emptyValues,
  imageError,
  parseMarks,
  STRUCTURED_COPY,
  totalMarks,
  totalMarksText,
  validate,
  valuesFromSaved,
  type StructuredFormValues,
} from '../../lib/structured-form'

const NO_DSKP = { hasChapters: false, hasDskpNodes: false }
const WITH_DSKP = { hasChapters: true, hasDskpNodes: true }

function valid(): StructuredFormValues {
  return {
    ...emptyValues(),
    levelId: '11',
    subjectId: '4',
    difficulty: '3',
    stimulus: 'Petikan pendek.',
    parts: [
      { ...emptyPart(), text: 'Soalan (a)', marks: '3', scheme: 'Skema (a)' },
      { ...emptyPart(), text: 'Soalan (b)', marks: '5', scheme: 'Skema (b)' },
    ],
  }
}

/** Mirror of the contract (GURU_STRUCTURED_MESSAGES, GURU_QUESTION_MESSAGES, guruStructuredBody). */
const LEVELS = [
  'mengingat',
  'memahami',
  'mengaplikasi',
  'menganalisis',
  'menilai',
  'mencipta',
] as const
const Part = z.strictObject({
  text: z.string().trim().min(1, STRUCTURED_COPY.partText).max(2000, STRUCTURED_COPY.partTextLong),
  marks: z
    .number()
    .int(STRUCTURED_COPY.marks)
    .min(1, STRUCTURED_COPY.marks)
    .max(20, STRUCTURED_COPY.marks),
  scheme: z.string().trim().min(1, STRUCTURED_COPY.scheme).max(2000, STRUCTURED_COPY.schemeLong),
  cognitiveLevel: z.enum(LEVELS).nullable().optional(),
})
const Body = z.strictObject({
  subjectId: z.string().trim().min(1).max(64),
  educationLevelId: z.string().trim().min(1).max(64),
  chapterId: z.string().max(64).nullable().optional(),
  spIds: z.array(z.string().min(1).max(64)).max(3).nullable().optional(),
  tp: z.number().int().min(1).max(6).nullable().optional(),
  cognitiveLevel: z.enum(LEVELS).nullable().optional(),
  difficultyLevel: z.number().int().min(1).max(5),
  stimulus: z.string().max(4000, STRUCTURED_COPY.stimulusLong).nullable().optional(),
  stimulusImageId: z.string().min(1).max(64).nullable().optional(),
  parts: z.array(Part).min(1, STRUCTURED_COPY.partsMin).max(10, STRUCTURED_COPY.partsMax),
})

describe('validate (field table of R1-GUR-44b)', () => {
  it('a complete form has no error', () => {
    expect(validate(valid(), NO_DSKP, null)).toEqual({})
  })

  it('AC-GUR-44b-8: Markah 21 gives "Markah mesti antara 1 dan 20."', () => {
    const v = valid()
    v.parts[1]!.marks = '21'
    expect(validate(v, NO_DSKP, null)).toEqual({ 'parts.1.marks': 'Markah mesti antara 1 dan 20.' })
  })

  it('Markah outside 1..20, empty or not whole is refused', () => {
    for (const bad of ['0', '-1', '', '2.5', 'abc', '21']) {
      const v = valid()
      v.parts[0]!.marks = bad
      expect(validate(v, NO_DSKP, null)['parts.0.marks'], bad).toBe(STRUCTURED_COPY.marks)
    }
    for (const ok of ['1', '20', ' 7 ']) {
      const v = valid()
      v.parts[0]!.marks = ok
      expect(validate(v, NO_DSKP, null)['parts.0.marks'], ok).toBeUndefined()
    }
  })

  it('names the required level, subject, difficulty, part text and scheme in BM', () => {
    const e = validate(emptyValues(), NO_DSKP, null)
    expect(e).toEqual({
      educationLevelId: 'Sila pilih tingkatan.',
      subjectId: 'Sila pilih subjek.',
      difficultyLevel: 'Sila pilih kesukaran.',
      'parts.0.text': 'Sila isi teks sub-soalan.',
      'parts.0.marks': 'Markah mesti antara 1 dan 20.',
      'parts.0.scheme': 'Sila isi skema jawapan.',
    })
  })

  it('limits: stimulus 4000, part text 2000, scheme 2000', () => {
    const v = valid()
    v.stimulus = 'x'.repeat(4001)
    v.parts[0]!.text = 'x'.repeat(2001)
    v.parts[0]!.scheme = 'x'.repeat(2001)
    const e = validate(v, NO_DSKP, null)
    expect(e.stimulus).toBe('Rangsangan tidak boleh melebihi 4000 aksara.')
    expect(e['parts.0.text']).toBe('Teks sub-soalan tidak boleh melebihi 2000 aksara.')
    expect(e['parts.0.scheme']).toBe('Skema jawapan tidak boleh melebihi 2000 aksara.')
    const edge = valid()
    edge.stimulus = 'x'.repeat(4000)
    expect(validate(edge, NO_DSKP, null)).toEqual({})
  })

  it('1 to 10 parts', () => {
    const none = valid()
    none.parts = []
    expect(validate(none, NO_DSKP, null).parts).toBe(
      'Sekurang-kurangnya satu sub-soalan diperlukan.',
    )
    const many = valid()
    many.parts = Array.from({ length: 11 }, () => ({
      ...emptyPart(),
      text: 't',
      marks: '1',
      scheme: 's',
    }))
    expect(validate(many, NO_DSKP, null).parts).toBe(STRUCTURED_COPY.partsMax)
    expect(canAddPart(9)).toBe(true)
    expect(canAddPart(10)).toBe(false)
  })

  it('AC-GUR-44b-9: the last part cannot be removed', () => {
    expect(canRemovePart(1)).toBe(false)
    expect(canRemovePart(2)).toBe(true)
  })

  it('image rule: jpg, png, webp and at most 2 MB, with the PRD texts', () => {
    expect(imageError({ type: 'image/png', size: 2 * 1024 * 1024 })).toBeNull()
    expect(imageError({ type: 'image/webp', size: 10 })).toBeNull()
    expect(imageError({ type: 'application/pdf', size: 10 })).toBe(
      'Fail mesti berupa imej (jpg, png atau webp).',
    )
    expect(imageError({ type: 'image/gif', size: 10 })).toBe(STRUCTURED_COPY.imageType)
    expect(imageError({ type: 'image/png', size: 2 * 1024 * 1024 + 1 })).toBe(
      'Saiz imej tidak boleh melebihi 2 MB.',
    )
    expect(validate(valid(), NO_DSKP, { type: 'image/png', size: 3_000_000 }).stimulusImage).toBe(
      STRUCTURED_COPY.imageSize,
    )
  })

  it('D112: Bab only where chapters exist; SP, TP and Aras only where DSKP nodes exist', () => {
    expect(validate(valid(), { hasChapters: true, hasDskpNodes: false }, null)).toEqual({
      chapterId: 'Sila pilih bab.',
    })
    expect(validate(valid(), WITH_DSKP, null)).toEqual({
      chapterId: 'Sila pilih bab.',
      spIds: 'Sila pilih Standard Pembelajaran (SP).',
      tp: 'Sila pilih TP.',
      cognitiveLevel: 'Sila pilih aras pemikiran.',
    })
    const v = {
      ...valid(),
      chapterId: '9',
      spId: '30',
      tp: '3',
      cognitiveLevel: 'memahami' as const,
    }
    expect(validate(v, WITH_DSKP, null)).toEqual({})
    expect(validate({ ...v, tp: '7' }, WITH_DSKP, null).tp).toBe(
      'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
    )
  })
})

describe('totals and defaults', () => {
  it('Jumlah markah is the sum of the part marks', () => {
    expect(totalMarksText(valid().parts)).toBe('Jumlah markah: 8')
    expect(totalMarks([{ marks: '' }, { marks: '4' }, { marks: '99' }])).toBe(4)
    expect(parseMarks('12')).toBe(12)
    expect(parseMarks('1.5')).toBeNull()
  })

  it('Kesukaran defaults to min(5, TP)', () => {
    expect(defaultDifficulty('3')).toBe('3')
    expect(defaultDifficulty('6')).toBe('5')
    expect(defaultDifficulty('')).toBe('')
  })
})

describe('request body', () => {
  it('matches the contract schema, sends no total marks, and keeps the stimulus once', () => {
    const body = buildBody(valid(), null)
    expect(() => Body.parse(body)).not.toThrow()
    expect(JSON.stringify(body)).not.toMatch(/total/i)
    expect(Object.keys(body).sort()).toEqual([
      'difficultyLevel',
      'educationLevelId',
      'parts',
      'stimulus',
      'subjectId',
    ])
    expect(body.parts).toEqual([
      { text: 'Soalan (a)', marks: 3, scheme: 'Skema (a)' },
      { text: 'Soalan (b)', marks: 5, scheme: 'Skema (b)' },
    ])
  })

  it('carries the DSKP fields, a one-element spIds, the image token and part Aras', () => {
    const v = {
      ...valid(),
      chapterId: '9',
      spId: '30',
      tp: '4',
      cognitiveLevel: 'menganalisis' as const,
    }
    v.parts[0]!.cognitiveLevel = 'mengaplikasi'
    const body = buildBody(v, 'AbCdEfGhIjKlMnOpQrStUv')
    expect(() => Body.parse(body)).not.toThrow()
    expect(body).toMatchObject({
      chapterId: '9',
      spIds: ['30'],
      tp: 4,
      cognitiveLevel: 'menganalisis',
      stimulusImageId: 'AbCdEfGhIjKlMnOpQrStUv',
    })
    expect(body.parts[0]?.cognitiveLevel).toBe('mengaplikasi')
  })

  it('the zod mirror rejects an unknown key and the values the form already refuses', () => {
    expect(Body.safeParse({ ...buildBody(valid(), null), totalMarks: 8 }).success).toBe(false)
    const bad = buildBody(valid(), null)
    bad.parts[0]!.marks = 21
    expect(Body.safeParse(bad).success).toBe(false)
  })
})

describe('valuesFromSaved (edit preload)', () => {
  it('rebuilds the form values from the stored form and the parts', () => {
    const v = valuesFromSaved({
      stimulus: 'Rangsangan',
      subQuestions: [
        { questionText: 'A?', marks: 2, cognitiveLevel: 'memahami', modelAnswer: 'Skema A' },
      ],
      form: {
        subjectId: 4,
        educationLevelId: '11',
        chapterId: null,
        spIds: [30],
        tp: 3,
        cognitiveLevel: 'memahami',
        difficultyLevel: 2,
      },
    })
    expect(v).toMatchObject({
      levelId: '11',
      subjectId: '4',
      chapterId: '',
      spId: '30',
      tp: '3',
      cognitiveLevel: 'memahami',
      difficulty: '2',
      stimulus: 'Rangsangan',
    })
    expect(v.parts[0]).toMatchObject({
      text: 'A?',
      marks: '2',
      scheme: 'Skema A',
      cognitiveLevel: 'memahami',
    })
  })
})
