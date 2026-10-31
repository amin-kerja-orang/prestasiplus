/**
 * Mohon Keluarga Angkat (M21 S6) is hidden unless the app is built with `VITE_KELUARGA_ANGKAT=on` (TRACKER D74).
 * Specs that open `/mohon-keluarga-angkat` run only when the same variable is `on` for the Playwright process.
 */
export const KELUARGA_ANGKAT_ON = process.env.VITE_KELUARGA_ANGKAT === 'on'

/** Reason shown for specs skipped while Mohon Keluarga Angkat is hidden. */
export const KELUARGA_ANGKAT_SKIP_REASON =
  'Mohon Keluarga Angkat is hidden (VITE_KELUARGA_ANGKAT is not on, D74)'
