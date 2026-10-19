import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import analitik from '../../routes/analitik'
import classRoutes from '../../routes/class'
import prestasi from '../../routes/prestasi'

/**
 * M08-T2 routing note (T5 review): `/prestasi/:userId` is digits only, so the static `/prestasi/tingkatan`
 * and `/prestasi/kelas` (and what M08-T5 / T7 build under them) are never shadowed by S6.
 */
const router = createRouter({
  history: createMemoryHistory(),
  routes: [...prestasi, ...analitik, ...classRoutes],
})

const nameOf = (path: string) => router.resolve(path).name

describe('M08 analitik route fragment', () => {
  it('resolves S7 and S6 with their meta', () => {
    expect(nameOf('/analitik/pelajar')).toBe('m08.analitik.pelajar')
    const s7 = router.resolve('/analitik/pelajar').meta
    expect(s7.title).toBe('Analitik Pembelajaran')
    expect(s7.header).toEqual({
      title: 'Analitik Pembelajaran',
      subtitle: 'Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan',
    })
    expect(s7.layout).toBe('user')
    expect(s7.access).toBe('auth')

    const s6 = router.resolve('/prestasi/3001')
    expect(s6.name).toBe('m08.prestasi.360')
    expect(s6.params.userId).toBe('3001')
    expect(s6.meta.header).toEqual({ title: 'Prestasi 360', subtitle: 'Selamat datang kembali' })
    expect(s6.meta.layout).toBe('user')
    expect(s6.meta.access).toBe('auth')
  })

  it('keeps /prestasi/tingkatan and /prestasi/kelas (and their children) from being shadowed by S6', () => {
    expect(nameOf('/prestasi/tingkatan')).toBe('m08.prestasi.tingkatan')
    expect(nameOf('/prestasi/tingkatan/t4')).toBe('m08.prestasi.tingkatan.detail')
    expect(nameOf('/prestasi/kelas')).toBe('m08.prestasi.kelas')
    expect(nameOf('/prestasi/sekolah')).toBe('m08.prestasi.sekolah')
    expect(nameOf('/prestasi/kelas/228')).not.toBe('m08.prestasi.360')
  })

  it('does not match S6 for a path that is not a number', () => {
    expect(router.resolve('/prestasi/abc').matched).toHaveLength(0)
    expect(router.resolve('/prestasi/12abc').matched).toHaveLength(0)
  })
})
