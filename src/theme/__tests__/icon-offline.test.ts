import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { loadIcon } from '@iconify/vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ICON_ROUTES } from '../../../e2e/icons/icon-routes'
import { ACCOUNT_ITEMS, SCHOOL_ADMIN_ITEMS, STUDENT_ITEMS, TEACHER_ITEMS } from '@/app/prototype-scope'
import { PENTADBIRAN_FULL_MENU } from '@/shells/pentadbiran/menu'
import { ITEM_ICON } from '@/shells/pentadbiran/menu-icons'
import { dsIconBaseNames, dsIconClasses } from '@/theme/ds-icons'
import { ICON_NOT_BUNDLED, ICONIFY_API_HOSTS, KNOWN_ABSENT_ICONS } from '@/theme/icon-hosts'
import { disableIconifyNetwork, resetIconReports } from '@/theme/icon-offline'
import { iconBundle, uiConfig } from '@/theme/ui.config'

const require = createRequire(import.meta.url)
const collection = (name: string): Set<string> => {
  const json = JSON.parse(readFileSync(require.resolve(`@iconify-json/${name}/icons.json`), 'utf8')) as {
    icons: Record<string, unknown>
    aliases?: Record<string, unknown>
  }
  return new Set([...Object.keys(json.icons), ...Object.keys(json.aliases ?? {})])
}
const SETS: Record<string, Set<string>> = { ph: collection('ph'), lucide: collection('lucide') }
const ABSENT = new Set<string>(KNOWN_ABSENT_ICONS)

const SRC = join(process.cwd(), 'src')
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sources(path)
    return /\.(vue|ts)$/.test(name) ? [path] : []
  })
}
const FILES = sources(SRC).map((path) => ({ path, text: readFileSync(path, 'utf8') }))

/** Every `i-ph-*` / `i-lucide-*` literal in the source: what the Nuxt UI scanner puts in the bundle. */
const literals = new Set<string>()
for (const { text } of FILES)
  for (const m of text.matchAll(/\bi-(ph|lucide)-([a-z0-9-]+)\b/g)) literals.add(`${m[1]}:${m[2]}`)

describe('icon network-off guard (D-09)', () => {
  beforeEach(() => {
    resetIconReports()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('an icon outside the bundle is never fetched: no request, one warning', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network used')))
    vi.stubGlobal('fetch', fetchSpy)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    disableIconifyNetwork()

    await expect(loadIcon('ph:zz-not-a-real-icon')).rejects.toBeDefined()

    expect(fetchSpy).not.toHaveBeenCalled()
    const messages = warn.mock.calls.map((c) => String(c[0]))
    expect(messages.filter((m) => m === `${ICON_NOT_BUNDLED} ph:zz-not-a-real-icon`)).toHaveLength(1)
    for (const host of ICONIFY_API_HOSTS) expect(messages.join('\n')).not.toContain(host)
    vi.unstubAllGlobals()
  })
})

describe('icon bundle completeness (D-09)', () => {
  it('every i-ph-* / i-lucide-* name spelled in the source exists in the installed set', () => {
    const unknown = [...literals].filter((id) => {
      const [prefix, name] = id.split(':') as [string, string]
      return !name.endsWith('-') && !SETS[prefix]!.has(name) && !ABSENT.has(id)
    })
    expect(unknown).toEqual([])
  })

  it('the known-absent list only names icons that really are absent (delete the entry once fixed)', () => {
    for (const id of KNOWN_ABSENT_ICONS) {
      const [prefix, name] = id.split(':') as [string, string]
      expect(SETS[prefix]!.has(name), id).toBe(false)
      expect(literals.has(id), `${id} is no longer spelled in the source`).toBe(true)
    }
  })

  it('every explicit bundle entry exists in its set', () => {
    const missing = iconBundle.icons.filter((c) => {
      const m = /^i-(ph|lucide)-(.+)$/.exec(c)
      return !m || !SETS[m[1]!]!.has(m[2]!)
    })
    expect(missing).toEqual([])
  })

  it("Nuxt UI's internal icons (appConfig.ui.icons) are in the bundle", () => {
    for (const c of Object.values(uiConfig.icons)) expect(iconBundle.icons).toContain(c)
  })

  it('names built at run time are bundled: DsIcon base names, Pentadbiran menu glyphs', () => {
    const bundled = new Set([...iconBundle.icons, ...[...literals].map((l) => `i-${l.replace(':', '-')}`)])
    for (const c of dsIconClasses) expect(bundled.has(c), c).toBe(true)
    expect(dsIconBaseNames).toContain('laptop')
    // Pentadbiran falls back to `i-ph-<group icon>` for an item without its own glyph.
    for (const g of PENTADBIRAN_FULL_MENU) expect(bundled.has(`i-ph-${g.icon}`), g.icon).toBe(true)
    for (const c of Object.values(ITEM_ICON)) expect(bundled.has(c), c).toBe(true)
  })

  it('a base name handed to a DsXxx composite or listed as `icon: \'base\'` is bundled in both weights', () => {
    // Scope: `icon: 'base'` keys and DsXxx attributes only. Other keys (e.g. `stepsIcon` / `featuresIcon` in
    // m09 `panduan-content.ts`) are not rendered as icons today; a new code path that renders one must be added here.
    const bundled = new Set([...iconBundle.icons, ...[...literals].map((l) => `i-${l.replace(':', '-')}`)])
    const missing = new Set<string>()
    const check = (path: string, base: string): void => {
      if (base.startsWith('i-') || base.startsWith('fa-') || !SETS.ph!.has(base)) return
      for (const suffix of ['', '-duotone'])
        if (!bundled.has(`i-ph-${base}${suffix}`)) missing.add(`${path.slice(SRC.length + 1)}: ${base}${suffix}`)
    }
    for (const { path, text } of FILES) {
      for (const m of text.matchAll(/\bicon:\s*'([a-z][a-z0-9-]*)'/g)) check(path, m[1]!)
      if (!path.endsWith('.vue')) continue
      for (const m of text.matchAll(/<(?:DsIcon|DsIconChip)\b[^>]*?\s(?:name|icon)="([a-z0-9-]+)"/g)) check(path, m[1]!)
      for (const m of text.matchAll(/<Ds\w+\b[^>]*?\s:?icon="'?([a-z][a-z0-9-]*)'?"/g)) check(path, m[1]!)
    }
    expect([...missing]).toEqual([])
  })
})

describe('icon e2e route lists (D-09)', () => {
  it('stay in step with the prototype-scope menu matrix', () => {
    const first = (items: readonly { rules: readonly { path: string }[] }[]): string[] =>
      [...ACCOUNT_ITEMS, ...items]
        .map((i) => i.rules[0]!.path)
        .filter((p) => p !== '/logout' && !p.startsWith('/ibu-bapa'))
    expect([...ICON_ROUTES.student]).toEqual(first(STUDENT_ITEMS))
    expect([...ICON_ROUTES.teacher]).toEqual(first(TEACHER_ITEMS))
    expect([...ICON_ROUTES.school_admin]).toEqual(first(SCHOOL_ADMIN_ITEMS))
  })
})
