/** Constants of the icon network-off guard. Import-free so Playwright specs can load them in plain Node. */

/** Hosts of the public Iconify API (the default one and its two fallbacks). */
export const ICONIFY_API_HOSTS = [
  'api.iconify.design',
  'api.simplesvg.com',
  'api.unisvg.com',
] as const

/** Prefix of the console warning for an icon that is not in the local bundle. */
export const ICON_NOT_BUNDLED = '[icons] not bundled:'

/**
 * Phosphor names that the source spells but the installed `@iconify-json/ph` set does not have, so
 * they never rendered (live: the Iconify API answers 404) and still render nothing. They are left as
 * they are (D-09: no visual change) and named here so the unit test and the e2e do not report them.
 * Replace the glyph in the page, then delete the entry.
 */
export const KNOWN_ABSENT_ICONS = [
  'ph:seedling-duotone', // m14 S11MasteryCard (the plant glyph is `plant-duotone`)
  'ph:file-check-bold', // m06 TrackingASubjectPage, "soalan kuiz siap guna" badge
] as const
