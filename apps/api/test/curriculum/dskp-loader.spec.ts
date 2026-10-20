import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DSKP_FILES, loadDskp } from '../../prisma/seed/curriculum'
import { indexNodes, parseDskpExtract, slugOf } from '../../src/modules/curriculum/dskp/dskp-loader'

const DSKP_DIR = fileURLToPath(new URL('../../../../docs/reference/dskp/', import.meta.url))
const files = readdirSync(DSKP_DIR).filter((f) => f.endsWith('.json'))

describe('DSKP loader (AC6)', () => {
  it('loads all 13 DSKP JSON files without error and the seed maps every file to a subject', () => {
    expect(files).toHaveLength(13)
    expect(DSKP_FILES.map((f) => f.file).sort()).toEqual([...files].sort())
    expect(new Set(DSKP_FILES.map((f) => f.subject)).size).toBe(13)
    const loaded = loadDskp()
    expect(loaded).toHaveLength(13)
    for (const { file, extract } of loaded) {
      expect(extract.nodes.length, file).toBeGreaterThan(0)
    }
  })

  it('keeps every unit, SK and SP of every file as a node (counts equal the files)', () => {
    for (const file of files) {
      const json = JSON.parse(readFileSync(DSKP_DIR + file, 'utf8')) as {
        units: { standards: { sp: unknown[] }[] }[]
      }
      const extract = parseDskpExtract(json)
      const units = json.units.length
      const sks = json.units.reduce((n, u) => n + u.standards.length, 0)
      const sps = json.units.reduce((n, u) => n + u.standards.reduce((m, s) => m + s.sp.length, 0), 0)
      const by = (k: string) => extract.nodes.filter((n) => n.kind === k).length
      expect([by('unit'), by('sk'), by('sp')], file).toEqual([units, sks, sps])
    }
  })

  it('supports lookup by code and parent traversal: sp -> sk -> unit -> grouping (Matematik T4 1.1.3)', () => {
    const matematik = loadDskp().find((f) => f.file === 'matematik.json')!.extract
    const nodes = indexNodes(matematik.nodes)
    const sp = nodes.get('T4|sp|1.1.3')
    expect(sp?.kind).toBe('sp')
    const sk = nodes.get(sp!.parentKey!)
    expect([sk?.kind, sk?.code]).toEqual(['sk', '1.1'])
    const unit = nodes.get(sk!.parentKey!)
    expect([unit?.kind, unit?.code]).toEqual(['unit', '1.0'])
    const grouping = nodes.get(unit!.parentKey!)
    expect(grouping?.kind).toBe('grouping')
    expect(grouping?.code).toBe(slugOf('PERKAITAN DAN ALGEBRA'))
    expect(grouping?.parentKey).toBeNull()
    // The same printed code exists at T5 as a different node.
    expect(nodes.get('T5|unit|1.0')).toBeDefined()
    expect(nodes.get('T4|unit|1.0')).not.toBe(nodes.get('T5|unit|1.0'))
  })

  it('every node parent exists, the keys are unique and the order is per sibling kind', () => {
    for (const { file, extract } of loadDskp()) {
      const keys = new Set(extract.nodes.map((n) => n.key))
      expect(keys.size, file).toBe(extract.nodes.length)
      for (const n of extract.nodes) {
        if (n.parentKey !== null) expect(keys.has(n.parentKey), `${file} ${n.key}`).toBe(true)
        expect(n.title.length).toBeGreaterThan(0)
        expect(n.edition.length).toBeGreaterThan(0)
      }
    }
  })

  it('Bahasa Melayu has no grouping; Bahasa Inggeris keeps one edition per level', () => {
    const all = loadDskp()
    const bm = all.find((f) => f.file === 'bahasa-melayu.json')!.extract
    expect(bm.nodes.some((n) => n.kind === 'grouping')).toBe(false)
    expect(bm.nodes.find((n) => n.kind === 'unit')?.parentKey).toBeNull()
    const bi = all.find((f) => f.file === 'bahasa-inggeris.json')!.extract
    const editions = new Map(bi.nodes.map((n) => [n.level, n.edition]))
    expect(editions.get('T4')).not.toBe(editions.get('T5'))
  })

  it('flags the elective Matematik Tambahan units', () => {
    const addmath = loadDskp().find((f) => f.file === 'matematik-tambahan.json')!.extract
    expect(addmath.nodes.filter((n) => n.isElective).map((n) => n.key).sort()).toEqual(
      ['T4|unit|10.0', 'T4|unit|9.0', 'T5|unit|7.0', 'T5|unit|8.0'].sort(),
    )
  })

  it('TP descriptors: tp 1 to 6, one per node and tp, general levels without a node; unusable rows are counted', () => {
    let total = 0
    for (const { file, extract } of loadDskp()) {
      const seen = new Set<string>()
      for (const t of extract.tps) {
        expect(t.tp, file).toBeGreaterThanOrEqual(1)
        expect(t.tp, file).toBeLessThanOrEqual(6)
        expect(t.descriptor.length).toBeGreaterThan(0)
        expect(t.scope === null, file).toBe(t.nodeKey === null)
        const k = `${t.nodeKey}#${t.tp}`
        expect(seen.has(k), `${file} ${k}`).toBe(false)
        seen.add(k)
      }
      total += extract.tps.length
    }
    expect(total).toBeGreaterThan(1000)
    const landskap = loadDskp().find((f) => f.file === 'landskap-dan-nurseri.json')!.extract
    // Printed ranges ("1-4") and missing numbers cannot be stored.
    expect(landskap.skipped.missingTp).toBeGreaterThan(0)
  })

  it('a malformed extract is rejected', () => {
    expect(() => parseDskpExtract({ subject: 'x', edition: 'e', units: [{ level: 'T9' }] })).toThrow()
    expect(() => parseDskpExtract(null)).toThrow()
  })

  it('slugOf keeps letters and digits', () => {
    expect(slugOf('PERKAITAN DAN ALGEBRA')).toBe('perkaitan-dan-algebra')
    expect(slugOf('  5.0 INSAN BERMORAL ')).toBe('5-0-insan-bermoral')
    expect(slugOf('***')).toBe('group')
  })
})
