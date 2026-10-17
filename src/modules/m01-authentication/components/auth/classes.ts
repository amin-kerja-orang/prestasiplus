/**
 * Class strings shared by the M01 auth pages (S1-S5), v2 theme: design tokens only (layers, not
 * lines). Inputs are filled `bg-elevated` chips with a 2px primary focus ring; `text-body` keeps
 * the text at 16px (no iOS zoom on focus).
 */
export const AUTH_INPUT_CLASS =
  'w-full min-h-13 rounded-chip bg-elevated px-4 text-body text-highlighted outline-none transition placeholder:text-dimmed focus:ring-2 focus:ring-primary'

/** Field label: icon before the text, no colour of its own. */
export const AUTH_LABEL_CLASS = 'mb-2 flex items-center gap-2 text-label text-default'

/** Full-width gradient submit (52px mobile, 56px from sm). */
export const AUTH_SUBMIT_CLASS =
  'flex min-h-13 w-full items-center justify-center gap-2 rounded-chip bg-gradient-primary px-6 py-3 text-body font-bold text-primary-on shadow-cta transition hover:-translate-y-0.5 hover:brightness-110 motion-reduce:transform-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-14'

/** Small text links of the auth cards; 44px tall touch targets. */
export const AUTH_LINK_CLASS = 'inline-flex min-h-11 items-center gap-2 text-label'

/** Link colours: the primary link and the quiet back link. */
export const AUTH_LINK_PRIMARY = 'text-primary hover:underline'
export const AUTH_LINK_QUIET = 'text-muted hover:text-default'
