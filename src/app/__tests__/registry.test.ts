import { describe, expect, it } from 'vitest'

import { mockPlugins } from '@/mock/registry'

import { modules } from '../modules'

/** Slice modules M01–M10 (F-01) plus the batch-3 extension M11–M18 (F-31). */
const SLICE = [
  ['M01', 'm01-authentication'],
  ['M02', 'm02-users-schools'],
  ['M03', 'm03-curriculum'],
  ['M04', 'm04-question-bank'],
  ['M05', 'm05-practice'],
  ['M06', 'm06-spm'],
  ['M07', 'm07-pksk'],
  ['M08', 'm08-student-performance'],
  ['M09', 'm09-content'],
  ['M10', 'm10-teacher-class'],
  ['M11', 'm11-teacher-analytics'],
  ['M12', 'm12-kirkpatrick'],
  ['M13', 'm13-cikgu-alesa'],
  ['M14', 'm14-gamification'],
  ['M15', 'm15-rewards-shop'],
  ['M16', 'm16-battle-games'],
  ['M17', 'm17-admin-dashboard'],
  ['M18', 'm18-ppd-jpn'],
  ['M20', 'm20-marketplace'],
  ['M21', 'm21-sponsorship'],
  ['M22', 'm22-support-tickets'],
  ['M25', 'm25-ai-centre'],
  ['M27', 'm27-school-admin'],
] as const

describe('registries (F-01 scaffold, F-31 extension)', () => {
  it('list all 23 module manifests in phase order', () => {
    expect(modules.map((m) => [m.id, m.slug])).toEqual(SLICE)
  })

  it('register 23 modules with unique ids and slugs', () => {
    expect(modules).toHaveLength(23)
    expect(new Set(modules.map((m) => m.id)).size).toBe(23)
    expect(new Set(modules.map((m) => m.slug)).size).toBe(23)
    expect(mockPlugins).toHaveLength(23)
  })

  it('expose a route table for every module', () => {
    for (const m of modules) expect(Array.isArray(m.routes)).toBe(true)
  })

  // Loads every module mock plugin; the Nuxt UI transforms made this slow under a full-suite load
  // (V2-T02 spike), so it gets its own budget instead of the 30 s project default.
  it('lazy-load one mock plugin per module, in the same order', async () => {
    const loaded = await Promise.all(mockPlugins.map((load) => load()))
    expect(loaded.map((mod) => mod.default.id)).toEqual(SLICE.map(([id]) => id))
  }, 120_000)
})
