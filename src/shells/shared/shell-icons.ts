/**
 * Static icon resolution for the shells' fixed menus (overview §8.3: page code with a fixed icon
 * uses the named Lucide component). The live Font Awesome name is resolved through the global
 * FA → Lucide table and the module maps (`lookupFaName`, design-system §6 authority).
 *
 * `SHELL_ICON_FALLBACKS` covers shell icons that have **no row** in design-system §6 /
 * `fa-to-lucide.ts`. Design-system v1.10 added rows for every shell icon, so it is now empty;
 * it stays exported so `shellIcon()` keeps its fallback path for future shell items.
 */

import type { LucideIcon } from '@lucide/vue'

import { lookupFaName } from '@/components/icon'

/** FA name (without `fa-`) → Lucide, for names missing from design-system §6. Currently empty. */
export const SHELL_ICON_FALLBACKS: Readonly<Record<string, LucideIcon>> = {}

/** Lucide component for a live FA class (`fa-home`, `fas fa-home`), or `null`. */
export function shellIcon(fa: string): LucideIcon | null {
  const name = /fa-([a-z0-9-]+)\s*$/.exec(fa.trim())?.[1]
  if (!name) return null
  return lookupFaName(name) ?? SHELL_ICON_FALLBACKS[name] ?? null
}
