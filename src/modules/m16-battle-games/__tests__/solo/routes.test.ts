/** S13–S19 routes (SRS M16 §2, URS FN-M16-1.1.3 / 1.1.4): paths, shell, header and tab titles. */
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'

const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

describe('M16 solo routes', () => {
  it.each([
    ['/permainan/betul-salah', 'Betul atau Salah', 'Betul atau Salah ✅ — PRESTASIPLUS'],
    ['/permainan/cabaran-kilat', 'Cabaran Kilat', 'Cabaran Kilat ⚡ — PRESTASIPLUS'],
    ['/permainan/tembak-jawapan', 'Tembak Jawapan', 'Tembak Jawapan 🎯 — PRESTASIPLUS'],
    ['/permainan/susun-jawapan', 'Susun Jawapan', 'Susun Jawapan 🧩 — PRESTASIPLUS'],
    ['/permainan/kad-memori', 'Kad Memori', 'Kad Memori — PRESTASIPLUS'],
    ['/permainan/roda-nasib', 'Roda Nasib', 'Roda Nasib — PRESTASIPLUS'],
    ['/permainan/jutawan', 'Jutawan Ilmu', 'Jutawan Ilmu 💰 — PRESTASIPLUS'],
    ['/permainan/jutawan/main', 'Jutawan Ilmu', 'Jutawan Ilmu 💰 — PRESTASIPLUS'],
  ])('%s: user shell, any logged-in role, header "%s", tab "%s"', (path, header, tab) => {
    const r = router.resolve(path)
    expect(r.name).not.toBe('core.not-found')
    expect(r.meta.layout).toBe('user')
    expect(r.meta.access).toBe('auth')
    expect(r.meta.roles).toBeUndefined()
    expect(r.meta.title).toBe(tab)
    expect(r.meta.header).toEqual({ title: header, subtitle: 'Selamat datang kembali' })
  })

  it('the POST-only /permainan/roda-nasib/spin has no page (404)', () => {
    expect(router.resolve('/permainan/roda-nasib/spin').name).toBe('core.not-found')
  })
})
