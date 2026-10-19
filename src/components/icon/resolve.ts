import type { LucideIcon } from '@lucide/vue'
import { shallowRef } from 'vue'

import { FA_TO_LUCIDE, LUCIDE_STATIC } from './fa-to-lucide'
import { MODULE_ICON_MAPS } from './maps'

/**
 * Data-driven icon resolution (M03 BR-05 generalised; ADR-0010; overview §8.3).
 *
 * 1. empty -> nothing;
 * 2. contains a non-ASCII character -> the text itself (emoji);
 * 3. a Font Awesome class (`fa-book`, `fas fa-book`, `fa-solid fa-book`, `fa-regular ...`) -> the
 *    FA -> Lucide table, then the module maps, else the same name as a Lucide icon;
 * 4. a bare kebab-case or PascalCase Lucide name -> that icon;
 * 5. anything else -> nothing.
 *
 * Values only ever select a component; they are never used as HTML or class names
 * (SEC-M03-03).
 */
export type IconResolution =
  | { kind: 'none' }
  | { kind: 'emoji'; text: string }
  | { kind: 'icon'; icon: LucideIcon }
  /** A Lucide name outside the static set; needs the lazy full index. */
  | { kind: 'lookup'; name: string }

export type LucideIndex = ReadonlyMap<string, LucideIcon>

/** M03 BR-05 pattern, including the FA6 `fa-solid` / `fa-regular` prefixes (ADR-0010 Amendment 1). */
const FA_CLASS = /^(?:(?:fa[srlbd]?|fa-solid|fa-regular)\s+)?fa-([a-z0-9-]+)$/
const KEBAB = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/
const PASCAL = /^[A-Z][A-Za-z0-9]*$/
const NON_ASCII = /[^\x00-\x7F]/

const NONE: IconResolution = { kind: 'none' }

/** `book-open-text` -> `BookOpenText`, `bar-chart-3` -> `BarChart3`. */
export function kebabToPascal(name: string): string {
  return name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/** Looks up an FA name (without `fa-`) in the global table, then in the module maps. */
export function lookupFaName(faName: string): LucideIcon | undefined {
  if (Object.hasOwn(FA_TO_LUCIDE, faName)) {
    const lucideName = FA_TO_LUCIDE[faName]
    if (lucideName) return LUCIDE_STATIC[lucideName]
  }
  for (const map of Object.values(MODULE_ICON_MAPS)) {
    if (Object.hasOwn(map, faName)) return map[faName]
  }
  return undefined
}

function lookupLucideName(pascal: string, index: LucideIndex | null): IconResolution {
  if (Object.hasOwn(LUCIDE_STATIC, pascal)) {
    return { kind: 'icon', icon: LUCIDE_STATIC[pascal as keyof typeof LUCIDE_STATIC] }
  }
  if (!index) return { kind: 'lookup', name: pascal }
  const icon = index.get(pascal)
  return icon ? { kind: 'icon', icon } : NONE
}

/**
 * Resolves an icon value. Pass the loaded full index (or `null` while it is not
 * loaded yet); without it, names outside the static set come back as `lookup`.
 */
export function resolveIcon(
  value: string | null | undefined,
  index: LucideIndex | null = null,
): IconResolution {
  const raw = (value ?? '').trim()
  if (raw === '') return NONE
  if (NON_ASCII.test(raw)) return { kind: 'emoji', text: raw }

  const fa = FA_CLASS.exec(raw.replace(/\s+/g, ' '))
  if (fa) {
    const faName = fa[1] ?? ''
    const mapped = lookupFaName(faName)
    if (mapped) return { kind: 'icon', icon: mapped }
    return lookupLucideName(kebabToPascal(faName), index)
  }

  if (KEBAB.test(raw)) return lookupLucideName(kebabToPascal(raw), index)
  if (PASCAL.test(raw)) return lookupLucideName(raw, index)
  return NONE
}

/** The lazily loaded full index, shared by every `AppIcon` (null until loaded). */
export const lucideIndex = shallowRef<LucideIndex | null>(null)

let pending: Promise<LucideIndex | null> | null = null

/** Loads the full Lucide index chunk once. A failed load can be retried later. */
export function loadLucideIndex(): Promise<LucideIndex | null> {
  pending ??= import('./lucide-index')
    .then((mod) => {
      lucideIndex.value = mod.buildLucideIndex()
      return lucideIndex.value
    })
    .catch(() => {
      pending = null
      return null
    })
  return pending
}
