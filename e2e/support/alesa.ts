/**
 * ALESA AI surfaces are hidden unless the app is built with `VITE_ALESA_AI=on` (TRACKER D73).
 * Specs that assert ALESA content run only when the same variable is `on` for the Playwright process.
 */
export const ALESA_ON = process.env.VITE_ALESA_AI === 'on'

/** Reason shown for specs skipped while the ALESA AI surfaces are hidden. */
export const ALESA_SKIP_REASON = 'ALESA AI surfaces are hidden (VITE_ALESA_AI is not on, D73)'
