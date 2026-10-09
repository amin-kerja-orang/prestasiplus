/**
 * Every icon value the S1 lobby supplies resolves through the shared icon resolver (ADR-0010).
 * The rows come from the real lobby payload (`GET /api/battle/lobby`, booted mock): the subject
 * tiles carry M03 `curriculum.subjects()` ids 1-31 (Lucide kebab names, `fas fa-*` classes, emoji,
 * `null` for ids 30/31) and the domain tiles the M07 PKSK domains. Rows that carry an icon must
 * resolve to an icon or an emoji; rows with `null` render no glyph (as supplied by M03).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadLucideIndex, resolveIcon, type LucideIndex } from '@/components/icon'

import { bootM16, MemoryStorage, setUser, type Booted } from '../mock/helpers'

interface Row {
  id: number
  icon: string | null
}
interface Lobby {
  subjects: Row[]
  pkskDomains: Row[]
  spmSubjects?: Row[]
}

const T4_STUDENT = 2 // grade 10: the lobby also carries the SPM subjects

let booted: Booted
let index: LucideIndex | null = null
let lobby: Lobby

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
  index = await loadLucideIndex()
  const res = await booted.runtime.transport.request({
    method: 'GET',
    url: '/api/battle/lobby',
    headers: { accept: 'application/json', authorization: `Bearer ${setUser(T4_STUDENT).token}` },
  })
  lobby = (res.body as { data: Lobby }).data
}, 180_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
})

describe('S1 data-driven icons resolve through resolveIcon', () => {
  it('carries the 31 subject rows and the active domains', () => {
    expect(lobby.subjects.map((s) => s.id)).toEqual(Array.from({ length: 31 }, (_, i) => i + 1))
    expect(lobby.pkskDomains.length).toBeGreaterThan(0)
  })

  it('every subject, SPM subject and domain row with an icon resolves to an icon or an emoji', () => {
    const rows = [
      ...lobby.subjects.map((r) => ({ key: `subject ${String(r.id)}`, ...r })),
      ...(lobby.spmSubjects ?? []).map((r) => ({ key: `spm ${String(r.id)}`, ...r })),
      ...lobby.pkskDomains.map((r) => ({ key: `domain ${String(r.id)}`, ...r })),
    ].filter((r) => r.icon !== null && r.icon !== undefined && r.icon !== '')
    expect(rows.length).toBeGreaterThan(0)
    const misses = rows
      .filter((r) => !['icon', 'emoji'].includes(resolveIcon(r.icon, index).kind))
      .map((r) => `${r.key}: ${String(r.icon)}`)
    expect(misses).toEqual([])
  })
})
