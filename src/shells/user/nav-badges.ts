/**
 * Live nav badge text (overview §10: "static until the owning module supplies a count"). M04 supplies the
 * "Gambar Rajah" count: the flagged MCQ total without filters (`meta.unfilteredMcq` of
 * `GET /api/diagram-audit`, M04 FR-M04-108). The shell provides a map of nav id to badge text; items
 * keep their static observed text until a value arrives, and keep it when the call fails (not an admin).
 */

import { inject, provide, ref, type InjectionKey, type Ref } from 'vue'

import { api } from '@/api'
import { formatNumber } from '@/lib/number'

export type NavBadgeTexts = Readonly<Record<string, string>>

const KEY: InjectionKey<Ref<NavBadgeTexts>> = Symbol('nav-badge-texts')

/** Called once by the shell: owns the map and refreshes it. */
export function provideNavBadges() {
  const texts = ref<NavBadgeTexts>({})
  provide(KEY, texts)
  let seq = 0

  async function refresh(): Promise<void> {
    const id = ++seq
    try {
      const body = await api.get<{ meta?: { unfilteredMcq?: unknown } }>('/api/diagram-audit', {
        query: { mcqPage: 1 },
        raw: true,
      })
      const count = body?.meta?.unfilteredMcq
      if (id !== seq || typeof count !== 'number') return
      texts.value = { ...texts.value, 'gambar-rajah': formatNumber(count) }
    } catch {
      // Keep the static text (the call needs an admin session).
    }
  }

  return { texts, refresh }
}

/** The badge text to show for a nav item: the live value, else the static one. */
export function useNavBadgeText(): (id: string, fallback: string) => string {
  const texts = inject(KEY, null)
  return (id, fallback) => texts?.value[id] ?? fallback
}
