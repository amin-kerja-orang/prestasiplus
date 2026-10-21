import { DutaCardSchema, DutaRecommendationSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootSpmApp, loginAs, parseData, type Client, type SpmTestApp } from './helpers'

let t: SpmTestApp
let student: Client
let admin: Client

beforeAll(async () => {
  t = await bootSpmApp()
  student = await loginAs(t, 'student')
  admin = await loginAs(t, 'admin')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const pick = async (c: Client, query = '') => parseData(await c.get(`/api/duta/recommendations${query}`), DutaRecommendationSchema)

describe('AC14 Duta recommendation (M06-14)', () => {
  it('picks only active bintang ambassadors, in the DutaCard shape, from fictitious seeds', async () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 25; seed++) {
      const d = await pick(student, `?seed=${String(seed)}`)
      expect(d).not.toBeNull()
      expect(DutaCardSchema.parse(d)).toEqual(d)
      expect(d?.tier).toBe('bintang')
      expect(d?.active).toBe(true)
      expect(Object.keys(d as object).sort()).toEqual(['active', 'initials', 'name', 'rating', 'slug', 'state', 'subject', 'tagline', 'tier'])
      expect(d?.name.startsWith('Cikgu Contoh')).toBe(true)
      expect(typeof d?.rating).toBe('number')
      seen.add(d?.slug as string)
    }
    // inspirasi and tetamu are never picked.
    expect([...seen].sort()).toEqual(['cikgu-contoh-bahasa', 'cikgu-contoh-matematik', 'cikgu-contoh-sains'])
  })

  it('the pick is deterministic per seed and the same for every caller; a seed that is not an integer is ignored', async () => {
    expect((await pick(student, '?seed=7'))?.slug).toBe((await pick(admin, '?seed=7'))?.slug)
    expect(await pick(student, '?seed=7')).toEqual(await pick(student, '?seed=7'))
    expect((await student.get('/api/duta/recommendations?seed=abc')).status).toBe(200)
    expect((await student.get('/api/duta/recommendations?seed=1.5')).status).toBe(200)
  })

  it('prefers an active bintang of the subject; a subject without one falls back to any bintang', async () => {
    expect(await pick(student, '?subject=Matematik&seed=3')).toMatchObject({ slug: 'cikgu-contoh-matematik', initials: 'CM', state: 'Johor', rating: 4.9 })
    expect((await pick(student, '?subject=Sains'))?.slug).toBe('cikgu-contoh-sains')
    expect((await pick(student, '?subject=%20Sains%20'))?.slug).toBe('cikgu-contoh-sains')
    // Sejarah has an inspirasi, Biologi a tetamu: neither is returned.
    for (const subject of ['Sejarah', 'Biologi', 'Tiada']) {
      expect((await pick(student, `?subject=${subject}&seed=2`))?.tier, subject).toBe('bintang')
    }
  })

  it('an inactive bintang is never returned; with no active bintang the answer is { data: null }', async () => {
    await t.db.query(`update duta_profiles set is_active = false where slug = 'cikgu-contoh-matematik'`)
    try {
      for (let seed = 1; seed <= 12; seed++) expect((await pick(student, `?subject=Matematik&seed=${String(seed)}`))?.slug).not.toBe('cikgu-contoh-matematik')
      await t.db.query(`update duta_profiles set is_active = false where tier = 'bintang'`)
      const res = await student.get('/api/duta/recommendations?subject=Matematik')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ data: null })
    } finally {
      await t.db.query(`update duta_profiles set is_active = true where tier = 'bintang'`)
    }
    expect(await pick(student, '?subject=Matematik&seed=3')).not.toBeNull()
  })
})
