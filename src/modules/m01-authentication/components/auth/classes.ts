/**
 * Class strings shared by the M01 auth pages (S1-S5). Live auth inputs are `border-2 border-gray-200
 * rounded-2xl px-4 py-3.5` with a blue `.input-focus` (discovery M01 §2.1 "Visual tokens").
 * `text-base` keeps the text at 16px (no iOS zoom on focus, and above the 12px floor of DV-16).
 */
export const AUTH_INPUT_CLASS =
  'w-full rounded-2xl border-2 border-gray-200 bg-white px-4 py-3.5 text-base text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-300'

/** Field label: 14px/600 gray-700 with a coloured icon before it. */
export const AUTH_LABEL_CLASS = 'mb-2 flex items-center gap-2 text-sm font-semibold text-gray-700'

/** Full-width `cta-gradient` submit (min-height 48px mobile, 56px desktop). */
export const AUTH_SUBMIT_CLASS =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-cta-gradient px-6 py-3 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:min-h-14'

/** Small text links of the auth cards; 44px tall touch targets. */
export const AUTH_LINK_CLASS = 'inline-flex min-h-11 items-center gap-2 text-sm font-medium'
