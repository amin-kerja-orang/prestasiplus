import { describe, expect, it } from 'vitest'

import { BANK, BLUEPRINTS } from '../data/registry'
import {
  composeFromBlueprint,
  poolUnits,
  shortageLine,
  stemKeys,
  type PoolUnit,
} from '../domain/blueprint'
import type { Blueprint } from '../domain/types'
import { BijakServer, MemoryStorage } from '../server/store'

/** FB-060: a generated paper never holds two variants of the same stem. */

const keysOf = (id: string): string[] => stemKeys(id, BANK.questions.get(id)?.stem ?? '')
const groupOf = (id: string): string | undefined => BANK.questions.get(id)?.groupId

function unitsFor(bp: Blueprint): Map<string, PoolUnit[]> {
  const m = new Map<string, PoolUnit[]>()
  for (const s of bp.sections)
    m.set(s.pool, poolUnits(s.pool, BANK.pool, BANK.groups, groupOf, keysOf))
  return m
}

/** Every blueprint a student can generate (the server refuses drafts). */
const generable = BLUEPRINTS.filter((b) => b.source !== 'Draf')

describe('stemKeys: what "the same stem" means', () => {
  it('variants of one template share the family id', () => {
    expect(stemKeys('sn2-laju-v1', 'x')[0]).toBe(stemKeys('sn2-laju-v3', 'y')[0])
    expect(stemKeys('mat1-persamaan-v2', 'x')[0]).not.toBe(stemKeys('mat1-pecahan-v2', 'x')[0])
  })
  it('numbers are masked, so only the numbers differ between variants', () => {
    const a = stemKeys('a', 'Sebuah kereta mainan bergerak sejauh 600 m dalam masa 40 s.')
    const b = stemKeys('b', 'Sebuah kereta mainan bergerak sejauh 450 m dalam masa 30 s.')
    expect(a[1]).toBe(b[1])
    expect(a[1]).toContain('#')
  })
  it('a different wording or a short generic lead-in is not a repeat', () => {
    const a = stemKeys('a', 'Terangkan bagaimana air meresap masuk ke dalam sel akar tumbuhan.')
    const b = stemKeys('b', 'Nyatakan empat faktor yang mempengaruhi kadar fotosintesis.')
    expect(a[1]).not.toBe(b[1])
    expect(stemKeys('c', 'Berdasarkan Rajah 1,')).toHaveLength(1)
  })
})

describe('composeFromBlueprint keeps stems apart', () => {
  const unit = (id: string, stem: string, size = 1): PoolUnit => ({
    ids: Array.from({ length: size }, (_, i) => `${id}-${i}`),
    keys: [...new Set(Array.from({ length: size }, (_, i) => stemKeys(`${id}-${i}`, stem)).flat())],
  })
  const bp = (take: number): Blueprint => ({
    subject: 'SN',
    kertas: 2,
    source: 'Spec',
    code: 'x',
    durationMin: 10,
    instructions: [],
    sections: [{ label: 'Bahagian A', rule: { type: 'all' }, pool: 'P', take, markBudget: take }],
  })
  const laju = (n: number) =>
    unit(`t-laju-v${n}`, `Kereta bergerak sejauh ${n * 100} m dalam masa ${n} s sebelum berhenti.`)

  it('takes one variant of a template and then reports a shortage instead of a second one', () => {
    const units = new Map([['P', [laju(1), laju(2), laju(3)]]])
    const ok = composeFromBlueprint(bp(1), units, { seed: 1 })
    expect(ok.ok).toBe(true)
    const r = composeFromBlueprint(bp(2), units, { seed: 1 })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(shortageLine(r.shortages[0]!)).toBe('Bahagian A: perlu 2 soalan, hanya 1 tersedia')
    }
  })
  it('mixes templates freely and keeps a group whole', () => {
    const group = unit('sel', 'Rajah 1 menunjukkan struktur sebuah sel tumbuhan yang dilabel.', 2)
    const units = new Map([['P', [laju(1), laju(2), group]]])
    for (let seed = 1; seed <= 20; seed++) {
      const r = composeFromBlueprint(bp(3), units, { seed })
      if (!r.ok) throw new Error('expected a paper')
      const ids = r.sections.flatMap((s) => s.questionIds)
      expect(ids).toHaveLength(3)
      expect(ids.filter((i) => i.startsWith('t-laju'))).toHaveLength(1)
      expect(ids.filter((i) => i.startsWith('sel-'))).toEqual(['sel-0', 'sel-1'])
    }
  })
  it('also separates stems across sections of one paper', () => {
    const two: Blueprint = {
      ...bp(1),
      sections: [
        { label: 'Bahagian A', rule: { type: 'all' }, pool: 'P', take: 1, markBudget: 1 },
        { label: 'Bahagian B', rule: { type: 'all' }, pool: 'P', take: 1, markBudget: 1 },
      ],
    }
    const only = new Map([['P', [laju(1), laju(2)]]])
    const r = composeFromBlueprint(two, only, { seed: 3 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.shortages.map((s) => s.section)).toEqual(['Bahagian B'])
  })
})

describe('every generable subject x kertas (property)', () => {
  it('lists the combinations under test', () => {
    expect(generable.length).toBeGreaterThanOrEqual(4)
  })
  for (const bp of generable) {
    it(`${bp.subject} K${bp.kertas}: 40 generated papers never repeat a stem and keep groups whole`, async () => {
      const server = new BijakServer({
        storage: new MemoryStorage(),
        now: () => 1_800_000_000_000,
      })
      let made = 0
      for (let user = 1; user <= 40; user++) {
        const out = await server.generatePaper(user, bp.subject, bp.kertas)
        if (!out.ok) {
          // The only allowed failure is the shortage path (the SN K1 contract has an empty pool).
          expect(out.reason).toBe('shortage')
          continue
        }
        made++
        const { questions, groups } = await server.getAttemptView(
          user,
          (await server.startAttempt(user, out.paperId, 'latihan')).attemptId,
        )
        const ids = questions.map((q) => q.id)
        expect(new Set(ids).size).toBe(ids.length)
        const seen = new Map<string, string>()
        for (const id of ids) {
          for (const key of keysOf(id)) {
            const first = seen.get(key)
            expect(first, `${out.paperId}: ${id} repeats the stem of ${first}`).toBeUndefined()
            seen.set(key, id)
          }
        }
        for (const g of groups) {
          const at = ids.indexOf(g.questionIds[0]!)
          expect(ids.slice(at, at + g.questionIds.length)).toEqual(g.questionIds)
        }
        expect(ids).toHaveLength(bp.sections.reduce((n, s) => n + s.take, 0))
      }
      // Every pool that holds enough distinct stems still generates; only the empty pool may not.
      const units = unitsFor(bp)
      const hasPool = [...units.values()].every((u) => u.length > 0)
      expect(made > 0).toBe(hasPool)
    })
  }
})
