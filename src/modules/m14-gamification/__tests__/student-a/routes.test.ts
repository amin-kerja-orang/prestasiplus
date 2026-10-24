import { describe, expect, it } from 'vitest'

import studentA from '../../routes/student-a'

describe('M14 student-a routes (FR-M14-04, 05, 06; DV-M14-01)', () => {
  const byPath = Object.fromEntries(studentA.map((r) => [r.path, r]))

  it('declares the four screens in the user shell for every logged-in role', () => {
    expect(Object.keys(byPath).sort()).toEqual([
      '/gamification',
      '/gamification/challenges',
      '/gamification/convert',
      '/gamification/history',
    ])
    for (const r of studentA) {
      expect(r.meta?.layout).toBe('user')
      expect(r.meta?.access).toBe('auth')
      expect(r.meta?.roles).toBeUndefined()
      expect(r.meta?.module).toBe('M14')
      expect(r.meta?.header?.subtitle).toBe('Selamat datang kembali')
    }
  })

  it('tab titles are exact and header titles follow DV-M14-01', () => {
    const titles = (p: string) => [byPath[p]!.meta!.title, byPath[p]!.meta!.header!.title]
    expect(titles('/gamification')).toEqual(['Gamifikasi Papan Pemuka', 'Gamifikasi Papan Pemuka'])
    expect(titles('/gamification/convert')).toEqual(['Tukar Token', 'Tukar Syiling → Token'])
    expect(titles('/gamification/challenges')).toEqual(['Cabaran Harian', 'Cabaran Harian'])
    expect(titles('/gamification/history')).toEqual(['Sejarah Transaksi', 'Sejarah Transaksi'])
  })
})
