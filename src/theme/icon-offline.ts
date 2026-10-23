/**
 * Network-off guard for icons (D-09). Every icon the app uses is bundled by the Nuxt UI icon plugin
 * (`iconBundle` in `ui.config.ts`); `@iconify/vue` would otherwise fetch an unknown name from
 * `api.iconify.design` (and the fallbacks `api.simplesvg.com`, `api.unisvg.com`), which fails offline
 * and under a strict CSP. Replacing its `fetch` makes the loader fail the request at once, so an
 * unknown name renders nothing and no request ever leaves the browser.
 *
 * A name that is not in the bundle is reported once with `console.warn('[icons] not bundled: ph:x')`,
 * which the e2e suite and a developer can see; add the name to `iconBundle` (or fix the typo).
 */
// `_api` is an underscore export of `@iconify/vue`: re-run `src/theme/__tests__/icon-offline.test.ts` when bumping it.
import { _api } from '@iconify/vue'

import { ICON_NOT_BUNDLED } from './icon-hosts'

const reported = new Set<string>()

/** `https://host/ph.json?icons=a,b` -> `['ph:a', 'ph:b']` (the request the loader would have sent). */
function requestedNames(request: string): string[] {
  try {
    const url = new URL(request, 'https://icons.invalid')
    const prefix = url.pathname.replace(/^\/|\.json$/g, '')
    return (url.searchParams.get('icons') ?? '').split(',').filter(Boolean).map((n) => `${prefix}:${n}`)
  } catch {
    return [request]
  }
}

const blockedFetch = ((input: string | URL | Request): Promise<Response> => {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  for (const name of requestedNames(raw)) {
    if (reported.has(name)) continue
    reported.add(name)
    console.warn(`${ICON_NOT_BUNDLED} ${name}`)
  }
  return Promise.reject(new Error('Icon API is disabled: icons are bundled locally'))
}) as typeof fetch

/** Call once, before the first icon renders. Idempotent. */
export function disableIconifyNetwork(): void {
  _api.setFetch(blockedFetch)
}

/** Test seam: forget which names were reported. */
export function resetIconReports(): void {
  reported.clear()
}
