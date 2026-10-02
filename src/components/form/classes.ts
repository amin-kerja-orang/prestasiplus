/**
 * Live form control class strings (F-16; design-system §7.2; M01/M02 SRS forms).
 * `FORM_INPUT_CLASS` is the string observed on 74 live inputs (discovery inventory);
 * `FORM_TEXTAREA_CLASS` is the observed amber-focus textarea. Validation is native HTML5
 * (see README.md); only `FORM_ERROR_MODIFIER` marks a server-rejected field.
 */
export const FORM_INPUT_CLASS =
  'w-full px-3.5 py-2.5 border-2 border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none transition'

/** Selects share the input string (native `<select>`, no custom listbox). */
export const FORM_SELECT_CLASS = FORM_INPUT_CLASS

export const FORM_TEXTAREA_CLASS =
  'w-full px-4 py-3 border-2 border-slate-200 rounded-xl text-sm text-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-100 transition-all resize-none'

/** Design-system §7.2: server-rejected field, red border with red-700 helper text below. */
export const FORM_ERROR_MODIFIER = 'border-red-400'
export const FORM_ERROR_TEXT_CLASS = 'mt-1 text-xs text-red-700'

/** Design-system §7.2 disabled treatment. */
export const FORM_DISABLED_MODIFIER =
  'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed'
