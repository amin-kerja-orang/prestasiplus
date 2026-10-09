/**
 * Live nav badge text (overview §10: "static until the owning module supplies a count"). M04 supplies the
 * "Gambar Rajah" count: the flagged MCQ total without filters (`meta.unfilteredMcq` of
 * `GET /api/diagram-audit`, M04 FR-M04-108). The shell provides a map of nav id to badge text; items
 * keep their static observed text until a value arrives, and keep it when the call fails (not an admin).
 * M22 supplies the "Urus Tiket" count: the open tickets of `GET /api/admin/tiket/open-count` (M22 FR-M22-42);
 * a count of 0 is the text "0", which the nav list does not render (FR-M22-43, XR-M22-02).
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

  async function refreshTickets(id: number): Promise<void> {
    try {
      const body = await api.get<{ count?: unknown }>('/api/admin/tiket/open-count')
      const count = body?.count
      if (id !== seq || typeof count !== 'number') return
      texts.value = { ...texts.value, 'urus-tiket': formatNumber(count) }
    } catch {
      // Keep the static text (the call needs an admin session).
    }
  }

  async function refresh(): Promise<void> {
    const id = ++seq
    void refreshTickets(id)
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
