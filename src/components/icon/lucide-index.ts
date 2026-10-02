/**
 * Full Lucide icon index (ADR-0010 "lazy full-set fallback chunk").
 *
 * Only ever loaded through a dynamic `import()` from `resolve.ts`, so the whole
 * icon set lands in its own chunk that is fetched on the first name the static
 * table cannot resolve. Never import this module statically.
 */
import type { LucideIcon } from '@lucide/vue'
import * as lucide from '@lucide/vue'

/**
 * Every icon export by PascalCase name: canonical names (`House`) and Lucide's own
 * aliases (`Home`). The `Lucide*` / `*Icon` duplicate exports and non-icon exports
 * (`Icon`, `createLucideIcon`, ...) are excluded.
 */
export function buildLucideIndex(): ReadonlyMap<string, LucideIcon> {
  const exports = lucide as unknown as Record<string, unknown>
  const icons = new Set<unknown>(Object.values(lucide.icons))
  const index = new Map<string, LucideIcon>()
  for (const [name, value] of Object.entries(exports)) {
    if (!icons.has(value)) continue
    if (name.startsWith('Lucide') && Object.hasOwn(exports, name.slice(6))) continue
    if (name.endsWith('Icon') && Object.hasOwn(exports, name.slice(0, -4))) continue
    index.set(name, value as LucideIcon)
  }
  return index
}
