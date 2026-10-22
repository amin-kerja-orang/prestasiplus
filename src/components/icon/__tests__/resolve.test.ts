import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import * as lucide from '@lucide/vue'
import { describe, expect, it } from 'vitest'

import { buildLucideIndex } from '../lucide-index'
import { kebabToPascal, resolveIcon, type IconResolution } from '../resolve'

const index = buildLucideIndex()

function iconOf(r: IconResolution): unknown {
  return r.kind === 'icon' ? r.icon : r
}

describe('resolveIcon (BR-05)', () => {
  it('step 1: empty values resolve to nothing', () => {
    for (const v of [undefined, null, '', '   ']) expect(resolveIcon(v)).toEqual({ kind: 'none' })
  })

  it('step 2: non-ASCII values render as emoji text', () => {
    expect(resolveIcon('🧪')).toEqual({ kind: 'emoji', text: '🧪' })
    expect(resolveIcon(' 📚 ')).toEqual({ kind: 'emoji', text: '📚' })
    expect(resolveIcon('fas fa-book 📖')).toEqual({ kind: 'emoji', text: 'fas fa-book 📖' })
  })

  it('step 3: FA classes map through the table with every style prefix', () => {
    for (const v of [
      'fa-home',
      'fas fa-home',
      'fa fa-home',
      'fa-solid fa-home',
      'fas  fa-home',
      ' fas fa-home ',
    ]) {
      expect(iconOf(resolveIcon(v)), v).toBe(lucide.House)
    }
    expect(iconOf(resolveIcon('far fa-clock'))).toBe(lucide.Clock)
    expect(iconOf(resolveIcon('fa-regular fa-clock'))).toBe(lucide.Clock)
    expect(iconOf(resolveIcon('fas fa-quran'))).toBe(lucide.BookOpenText)
    expect(iconOf(resolveIcon('fas fa-spinner'))).toBe(lucide.LoaderCircle)
  })

  it('step 3: the table wins over a same-name Lucide icon', () => {
    // Lucide has Cog and Bolt, but the doc maps fa-cog -> Settings and fa-bolt -> Zap.
    expect(lucide.Cog).not.toBe(lucide.Settings)
    expect(iconOf(resolveIcon('fas fa-cog', index))).toBe(lucide.Settings)
    expect(lucide.Bolt).not.toBe(lucide.Zap)
    expect(iconOf(resolveIcon('fas fa-bolt', index))).toBe(lucide.Zap)
  })

  it('step 3: unmapped FA names fall back to the same Lucide name', () => {
    // FA6 name of fa-home: not in the table, but House is statically imported -> synchronous.
    expect(iconOf(resolveIcon('fa-solid fa-house'))).toBe(lucide.House)
    // Not in the static set -> needs the lazy index.
    expect(resolveIcon('fas fa-anchor')).toEqual({ kind: 'lookup', name: 'Anchor' })
    expect(iconOf(resolveIcon('fas fa-anchor', index))).toBe(lucide.Anchor)
    expect(iconOf(resolveIcon('fa-regular fa-rabbit', index))).toBe(lucide.Rabbit)
  })

  it('step 3: only the BR-05 style prefixes are accepted', () => {
    for (const v of [
      'fa-light fa-home',
      'fa-thin fa-home',
      'fa-duotone fa-home',
      'fa-brands fa-home',
    ]) {
      expect(resolveIcon(v, index), v).toEqual({ kind: 'none' })
    }
    for (const v of ['fal fa-home', 'fab fa-home', 'fad fa-home', 'far fa-home']) {
      expect(iconOf(resolveIcon(v)), v).toBe(lucide.House)
    }
  })

  it('design-system v1.2 rows added or changed resolve as the doc says', () => {
    const expected: Record<string, unknown> = {
      edit: lucide.SquarePen,
      'square-root-alt': lucide.Radical,
      'chart-bar': lucide.ChartBar,
      building: lucide.Building,
      running: lucide.Footprints,
      futbol: lucide.Volleyball,
      'magnifying-glass-chart': lucide.Search,
      'flag-checkered': lucide.Flag,
      bullhorn: lucide.Megaphone,
      paste: lucide.ClipboardPaste,
      sitemap: lucide.Network,
    }
    for (const [fa, icon] of Object.entries(expected)) {
      expect(iconOf(resolveIcon(`fas fa-${fa}`)), fa).toBe(icon)
    }
  })

  it('design-system §6.11 broken live strings all resolve to a visible icon', () => {
    const expected: Record<string, unknown> = {
      'fa-crystal-ball': lucide.Sparkles,
      'fa-stars': lucide.Star,
      'fa-beaker': lucide.Beaker,
      'fa-flask-round': lucide.FlaskRound,
      'fa-trending-up': lucide.TrendingUp,
      'fa-variable': lucide.Variable,
      'fa-languages': lucide.Languages,
      'fa-monitor': lucide.Monitor,
      'fa-zap': lucide.Zap,
    }
    for (const [v, icon] of Object.entries(expected)) {
      expect(iconOf(resolveIcon(`fas ${v}`, index)), v).toBe(icon)
    }
  })

  it('step 4: bare Lucide names in kebab-case or PascalCase, including Lucide aliases', () => {
    expect(iconOf(resolveIcon('book-open'))).toBe(lucide.BookOpen)
    expect(iconOf(resolveIcon('BookOpen'))).toBe(lucide.BookOpen)
    expect(iconOf(resolveIcon('house'))).toBe(lucide.House)
    // Aliases (not in the static set under that name) resolve through the index.
    expect(resolveIcon('home')).toEqual({ kind: 'lookup', name: 'Home' })
    expect(iconOf(resolveIcon('home', index))).toBe(lucide.House)
    expect(iconOf(resolveIcon('Loader2', index))).toBe(lucide.LoaderCircle)
    expect(iconOf(resolveIcon('bar-chart-3', index))).toBe(lucide.ChartColumn)
    expect(iconOf(resolveIcon('rabbit', index))).toBe(lucide.Rabbit)
  })

  it('step 5: unknown or malformed values resolve to nothing', () => {
    for (const v of [
      'fas fa-not-a-real-icon',
      'not-a-real-icon',
      'NotARealIcon',
      'fab fa-whatsapp',
      'fas fa-home fa-spin',
      'fa-Home',
      'FAS FA-HOME',
      'icon',
      'Icon',
      'LucideHouse',
      'HouseIcon',
      'createLucideIcon',
      'icons',
      '__proto__',
      'constructor',
      'toString',
      'fa-constructor',
      '<img src=x onerror=alert(1)>',
      'fas fa-home" onload="x',
    ]) {
      expect(resolveIcon(v, index), v).toEqual({ kind: 'none' })
    }
  })

  it('kebabToPascal', () => {
    expect(kebabToPascal('book-open-text')).toBe('BookOpenText')
    expect(kebabToPascal('bar-chart-3')).toBe('BarChart3')
    expect(kebabToPascal('x')).toBe('X')
  })
})

describe('buildLucideIndex', () => {
  it('holds canonical names and Lucide aliases, not the Lucide* / *Icon duplicates or helpers', () => {
    expect(index.get('House')).toBe(lucide.House)
    expect(index.get('Home')).toBe(lucide.House)
    expect(index.has('LucideHouse')).toBe(false)
    expect(index.has('HouseIcon')).toBe(false)
    expect(index.has('Icon')).toBe(false)
    expect(index.size).toBeGreaterThanOrEqual(Object.keys(lucide.icons).length)
  })
})

/**
 * Partial guard (78-16): it scans only LITERAL names — static `<AppIcon name="…">` attributes and
 * `fa… fa-xxx` strings in src/. Dynamic `:name` bindings, bare Lucide names kept in data files and
 * names sent by the server are not covered; those still rely on the full lazy index at runtime, which
 * is why the index is not subset.
 */
describe('every literal icon name used in src still resolves (78-16 guard)', () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url))
  const used = new Set<string>()

  function walk(dir: string): void {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '__tests__' || e.name === 'node_modules') continue
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(vue|ts)$/.test(e.name) && !/\.(test|spec)\./.test(e.name)) {
        const text = readFileSync(p, 'utf8')
        for (const m of text.matchAll(/<AppIcon[^>]*?\sname="([^"]+)"/g)) used.add(m[1]!)
        for (const m of text.matchAll(
          /['"`]((?:fa[srlb]?|fa-solid|fa-regular) fa-[a-z0-9-]+)['"`]/g,
        ))
          used.add(m[1]!)
      }
    }
  }
  // Collected inside the tests (once), so a filesystem error fails a test instead of the collection.
  const collect = (): Set<string> => {
    if (used.size === 0) walk(root)
    return used
  }

  it('finds literal names to check', () => {
    expect(collect().size).toBeGreaterThan(0)
  })

  it('resolves each one to an icon or emoji once the full index is loaded', () => {
    const unresolved = [...collect()].filter((v) => resolveIcon(v, index).kind === 'none')
    expect(unresolved).toEqual([])
  })
})
