import { FORM_INPUT_CLASS } from '@/components/form'

/** White S8 card (live `rounded-2xl`, padding 24px, soft shadow). */
export const PROFILE_CARD_CLASS = 'rounded-2xl bg-white p-4 shadow-md sm:p-6'

/** Card title row: icon + 18px Outfit heading. */
export const PROFILE_CARD_TITLE_CLASS =
  'font-heading mb-4 flex items-center gap-2 text-lg font-bold text-slate-800'

/** Field label: 14px/600 slate-700 with a coloured icon before it (discovery M01 §2.8). */
export const PROFILE_LABEL_CLASS =
  'mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700'

/** S8 input: the F-16 string with 44px touch height. */
export const PROFILE_INPUT_CLASS = `${FORM_INPUT_CLASS} min-h-11`

/** Primary pill buttons (min 44px). */
export const PROFILE_BUTTON_CLASS =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0'
