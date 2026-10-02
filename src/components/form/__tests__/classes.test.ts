import { describe, expect, it } from 'vitest'

import {
  FORM_DISABLED_MODIFIER,
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS, FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '../classes'

describe('form class strings', () => {
  // The string observed verbatim on 74 live inputs (discovery inventory); focus is blue, not the
  // design-system indigo, because live wins (D9/D10).
  it('input is the live string', () => {
    expect(FORM_INPUT_CLASS).toBe(
      'w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition',
    )
  })

  it('select shares the input string; textarea does not resize', () => {
    expect(FORM_SELECT_CLASS).toBe(FORM_INPUT_CLASS)
    expect(FORM_TEXTAREA_CLASS).toContain('resize-none')
  })

  it('is not the design-system indigo variant', () => {
    expect(FORM_INPUT_CLASS).not.toContain('indigo')
  })

  it('error and disabled modifiers follow design-system 7.2', () => {
    expect(FORM_ERROR_MODIFIER).toBe('border-red-400')
    expect(FORM_ERROR_TEXT_CLASS).toContain('text-red-700')
    expect(FORM_DISABLED_MODIFIER).toContain('disabled:bg-slate-50')
    expect(FORM_DISABLED_MODIFIER).toContain('disabled:cursor-not-allowed')
  })
})
