import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import {
  backspaceAtCaret,
  HARAKAT,
  insertAtCaret,
  keyboardRows,
  placePanel,
} from '../../lib/arabic-keyboard'
import { buildBody, emptyValues, formErrors } from '../../lib/question-form'
import { GENERIC_ERROR } from '../../lib/ui-errors'

describe('arabic keyboard helpers', () => {
  it('inserts at the caret and replaces a selection', () => {
    expect(insertAtCaret('ab', 1, 1, 'ض')).toEqual({ value: 'aضb', caret: 2 })
    expect(insertAtCaret('abcd', 1, 3, 'x')).toEqual({ value: 'axd', caret: 2 })
    expect(insertAtCaret('ab', 2, 2, '\n')).toEqual({ value: 'ab\n', caret: 3 })
  })

  it('backspace deletes the selection, else one character before the caret', () => {
    expect(backspaceAtCaret('abc', 2, 2)).toEqual({ value: 'ac', caret: 1 })
    expect(backspaceAtCaret('abcd', 1, 3)).toEqual({ value: 'ad', caret: 1 })
    expect(backspaceAtCaret('abc', 0, 0)).toEqual({ value: 'abc', caret: 0 })
  })

  it('Jawi adds its letters inside the rows at the live positions', () => {
    const arab = keyboardRows('arab')
    const jawi = keyboardRows('jawi')
    expect(arab.map((r) => r.length)).toEqual([12, 11, 9])
    expect(jawi.map((r) => r.length)).toEqual([15, 13, 10])
    expect(jawi[0]?.[5]).toBe('ڤ')
    expect(jawi[1]?.[8]).toBe('ڽ')
    expect(jawi[2]?.[7]).toBe('ۏ')
    expect(HARAKAT).toHaveLength(9)
  })

  it('places the panel below, above when there is no room, clamped inside the viewport', () => {
    const view = { width: 1280, height: 800 }
    expect(placePanel({ left: 100, bottom: 300 }, view)).toEqual({
      above: false,
      left: 100,
      width: 580,
    })
    expect(placePanel({ left: 100, bottom: 500 }, view).above).toBe(true)
    expect(placePanel({ left: 1200, bottom: 300 }, view).left).toBe(1280 - 580 - 12)
    expect(placePanel({ left: -50, bottom: 300 }, view).left).toBe(8)
  })
})

describe('buildBody', () => {
  it('create posts every field with the chosen type (hidden cards are posted too)', () => {
    const v = emptyValues()
    v.subjectId = '4'
    v.educationLevelId = '11'
    v.difficulty = '3'
    v.questionType = 'true_false'
    v.questionText = 'Bumi bulat dan mengelilingi Matahari.'
    v.tfAnswer = 'true'
    const body = buildBody(v, '', 'create')
    expect(body.questionType).toBe('true_false')
    expect(body.tfAnswer).toBe(true)
    expect(body.options).toEqual(['', '', '', ''])
    expect(body.dskpSpId).toBe('')
    expect(body).not.toHaveProperty('removeQuestionImage')
  })

  it('create posts no answer as null for true/false', () => {
    const v = emptyValues()
    expect(buildBody(v, '', 'create').tfAnswer).toBeNull()
  })

  it('edit never posts the type and only the saved type fields; the remove flags are sent', () => {
    const v = emptyValues()
    v.questionType = 'mcq'
    v.removeQuestionImage = true
    v.removeOptionImage = [false, true, false, false]
    const body = buildBody(v, '6191', 'edit')
    expect(body).not.toHaveProperty('questionType')
    expect(body.removeQuestionImage).toBe(true)
    expect(body.removeOptionImage).toEqual([false, true, false, false])
    expect(body.dskpSpId).toBe('6191')
    expect(body).not.toHaveProperty('tfAnswer')
    expect(body).not.toHaveProperty('modelAnswer')
  })

  it('edit of an essay posts only the model answer', () => {
    const v = emptyValues()
    v.questionType = 'essay'
    v.modelAnswer = 'Contoh'
    const body = buildBody(v, '', 'edit')
    expect(body.modelAnswer).toBe('Contoh')
    expect(body).not.toHaveProperty('options')
    expect(body.dskpSpId).toBe('')
  })
})

describe('formErrors', () => {
  it('maps known fields and keeps the others as general lines', () => {
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: {
        questionText: 'Teks pendek.',
        'optionImages.2': 'Gambar tidak sah.',
        other: 'Lain.',
      },
    })
    expect(formErrors(err)).toEqual({
      fields: { questionText: 'Teks pendek.', 'optionImages.2': 'Gambar tidak sah.' },
      general: ['Lain.'],
    })
  })

  it('a network failure or a non-API error is the generic line', () => {
    expect(formErrors(new Error('boom')).general).toEqual([GENERIC_ERROR])
  })
})
