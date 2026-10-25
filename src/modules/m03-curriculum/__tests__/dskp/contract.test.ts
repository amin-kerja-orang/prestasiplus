/**
 * DSKP-T02: the `dskpCatalog` contract (design §3.3 `contract.test.ts`, §4, AC-11.1): `load`
 * caches, an unknown code rejects with a typed error, the sync accessors are undefined before
 * load, `createDskpCatalog` accepts a fixture loader, and both doorways give the same object.
 */

import { describe, expect, it, vi } from 'vitest'

import { createDskpCatalog, DskpLoadError, dskpCatalog } from '../../dskp'
import type { DskpSpId, DskpSubjectData, DskpSubjectInfo, DskpUnitId } from '../../dskp'
import { DSKP_LOADERS } from '../../dskp/loaders'
import { DSKP_SUBJECTS } from '../../dskp/subjects'
import { DSKP_SUBJECT_CODES } from '../../dskp/types'

import { loadIndex, loadSubjects, loadVersion } from './helpers'

/** A tiny two-unit, SK-level Matematik-shaped fixture with a general TP table. */
const FIXTURE: DskpSubjectData = {
  code: 'MAT',
  groups: [{ tingkatan: 'T4', title: 'BIDANG Satu' }],
  units: [
    {
      tingkatan: 'T4',
      code: '1.0',
      title: 'Unit Satu',
      group: 0,
      sks: [
        {
          code: '1.1',
          title: 'SK Satu',
          sps: [
            { code: '1.1.1', text: 'SP pertama' },
            { code: '1.1.2', text: 'No learning standard', flags: ['noStandard'] },
          ],
        },
      ],
    },
    {
      tingkatan: 'T5',
      code: '1.0',
      title: 'Unit Lima',
      sks: [{ code: '1.1', title: 'SK Lima', sps: [{ code: '1.1.1', text: 'SP kelima' }] }],
    },
  ],
  generalTp: [1, 2, 3, 4, 5, 6].map((tp) => ({ tp: tp as 1, text: `umum ${String(tp)}` })),
}
const FIXTURE_INFO: DskpSubjectInfo = {
  ...(loadIndex().find((s) => s.code === 'MAT') as DskpSubjectInfo),
  counts: {
    T4: { units: 1, sk: 1, sp: 1, slots: 1 },
    T5: { units: 1, sk: 1, sp: 1, slots: 0 },
  },
}
const fixtureText = JSON.stringify(FIXTURE)

describe('the real catalogue', () => {
  it('carries the committed version and the 13 subjects', () => {
    expect(dskpCatalog.version).toBe(loadVersion().version)
    expect(dskpCatalog.subjects()).toHaveLength(13)
    expect(dskpCatalog.subjects().map((s) => s.code)).toEqual([...DSKP_SUBJECT_CODES])
  })

  it('has one literal loader per subject, matching the subject config', () => {
    expect(Object.keys(DSKP_LOADERS).sort()).toEqual([...DSKP_SUBJECT_CODES].sort())
    expect(DSKP_SUBJECTS.map((s) => s.code).sort()).toEqual([...DSKP_SUBJECT_CODES].sort())
  })

  it('loads every subject from its chunk, as the same document as the data file', async () => {
    const data = loadSubjects()
    for (const d of data) {
      const text = await DSKP_LOADERS[d.code]()
      expect(JSON.parse(text)).toEqual(d)
    }
  })

  it('is exposed through both doorways as one object', async () => {
    const entry = await import('@/modules/m03-curriculum')
    const mock = await import('@/modules/m03-curriculum/mock')
    expect(entry.dskpCatalog).toBe(dskpCatalog)
    expect(mock.dskpCatalog).toBe(dskpCatalog)
    expect(entry.createDskpCatalog).toBe(createDskpCatalog)
    expect(mock.createDskpCatalog).toBe(createDskpCatalog)
    expect(mock.parseDskpKey).toBe(entry.parseDskpKey)
    // The plugin itself is unchanged: still the default export and the repositories.
    expect(mock.default.id).toBe('M03')
    expect(mock.curriculum).toBeDefined()
  })
})

describe('load', () => {
  it('caches: the same view, the same promise while pending, one loader call', async () => {
    const loader = vi.fn(() => Promise.resolve(fixtureText))
    const cat = createDskpCatalog({ MAT: loader }, { subjects: [FIXTURE_INFO], version: 'v-test' })
    const p1 = cat.load('MAT')
    const p2 = cat.load('MAT')
    expect(p2).toBe(p1)
    const v1 = await p1
    expect(await cat.load('MAT')).toBe(v1)
    expect(loader).toHaveBeenCalledTimes(1)
  })

  it('returns undefined from loaded() before load and the view after', async () => {
    const cat = createDskpCatalog(
      { MAT: () => Promise.resolve(fixtureText) },
      { subjects: [FIXTURE_INFO] },
    )
    expect(cat.loaded('MAT')).toBeUndefined()
    expect(cat.loaded('SN')).toBeUndefined()
    const pending = cat.load('MAT')
    expect(cat.loaded('MAT')).toBeUndefined() // still not settled
    const v = await pending
    expect(cat.loaded('MAT')).toBe(v)
  })

  it('rejects an unknown code with a typed error and never calls a loader', async () => {
    const loader = vi.fn(() => Promise.resolve(fixtureText))
    const cat = createDskpCatalog({ MAT: loader }, { subjects: [FIXTURE_INFO] })
    const err = await cat.load('NOPE').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DskpLoadError)
    expect(err).toMatchObject({ name: 'DskpLoadError', subject: 'NOPE', reason: 'unknown-subject' })
    expect(loader).not.toHaveBeenCalled()
    await expect(dskpCatalog.load('NOPE')).rejects.toBeInstanceOf(DskpLoadError)
    await expect(dskpCatalog.load('__proto__')).rejects.toMatchObject({ reason: 'unknown-subject' })
    expect(dskpCatalog.loaded('NOPE')).toBeUndefined()
  })

  it('rejects a subject in the index that has no loader', async () => {
    const cat = createDskpCatalog({}, { subjects: [FIXTURE_INFO] })
    await expect(cat.load('MAT')).rejects.toMatchObject({ reason: 'no-loader' })
  })

  it('does not cache a failed chunk: a retry runs the loader again', async () => {
    const boom = new Error('chunk 404')
    const loader = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(boom)
      .mockResolvedValue(fixtureText)
    const cat = createDskpCatalog({ MAT: loader }, { subjects: [FIXTURE_INFO] })
    const err = await cat.load('MAT').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(DskpLoadError)
    expect(err).toMatchObject({ reason: 'load-failed', subject: 'MAT' })
    expect((err as DskpLoadError).cause).toBe(boom)
    expect(cat.loaded('MAT')).toBeUndefined()
    const v = await cat.load('MAT')
    expect(v.units('T4')).toHaveLength(1)
    expect(loader).toHaveBeenCalledTimes(2)
  })

  it('rejects bad data as invalid-data, and does not cache it', async () => {
    let text = '{not json'
    const cat = createDskpCatalog(
      { MAT: () => Promise.resolve(text) },
      { subjects: [FIXTURE_INFO] },
    )
    await expect(cat.load('MAT')).rejects.toMatchObject({ reason: 'invalid-data' })
    text = JSON.stringify({ ...FIXTURE, code: 'SN' })
    await expect(cat.load('MAT')).rejects.toMatchObject({ reason: 'invalid-data' })
    text = JSON.stringify({ ...FIXTURE, units: [FIXTURE.units[0], FIXTURE.units[0]] })
    await expect(cat.load('MAT')).rejects.toMatchObject({ reason: 'invalid-data' }) // duplicate key
    text = fixtureText
    await expect(cat.load('MAT')).resolves.toBeDefined()
  })
})

describe('createDskpCatalog (test seam)', () => {
  const cat = createDskpCatalog(
    { MAT: () => Promise.resolve(fixtureText) },
    { subjects: [FIXTURE_INFO], version: 'dskp-test.1' },
  )

  it('uses the injected index and version', () => {
    expect(cat.version).toBe('dskp-test.1')
    expect(cat.subjects()).toHaveLength(1)
    expect(cat.subject('MAT')?.counts.T4.units).toBe(1)
    expect(cat.subject('SN')).toBeUndefined()
  })

  it('falls back to the committed version and index when none is given', () => {
    const real = createDskpCatalog({})
    expect(real.version).toBe(loadVersion().version)
    expect(real.subjects()).toHaveLength(13)
  })

  it("does not freeze or share the caller's index objects", () => {
    expect(Object.isFrozen(FIXTURE_INFO)).toBe(false)
    expect(cat.subject('MAT')).not.toBe(FIXTURE_INFO)
  })

  it('indexes a fixture subject: tree, groups, slots, keys', async () => {
    const v = await cat.load('MAT')
    const t4 = v.units('T4')
    expect(t4.map((u) => u.id)).toEqual(['MAT:T4:u:1.0'])
    expect(v.units('T5').map((u) => u.id)).toEqual(['MAT:T5:u:1.0'])
    expect(t4[0]?.groupId).toBe('MAT:T4:g:bidang-satu')
    expect(v.groups('T4').map((g) => g.title)).toEqual(['BIDANG Satu'])
    expect(v.sps('MAT:T4:u:1.0' as DskpUnitId).map((p) => p.id)).toEqual(['MAT:T4:sp:1.1.1'])
    expect(v.sp('MAT:T4:sp:1.1.2' as DskpSpId)?.selectable).toBe(false)
    expect(v.skOf('MAT:T5:sp:1.1.1' as DskpSpId)?.id).toBe('MAT:T5:sk:1.1')
  })

  it('resolves the general TP table of a fixture, so a unit without a table still gets help text', async () => {
    const v = await cat.load('MAT')
    const got = v.tpFor({ unitId: 'MAT:T4:u:1.0' as DskpUnitId }, 4)
    expect(got).toEqual([
      { source: 'general', nodeId: null, descriptor: { tp: 4, text: 'umum 4' } },
    ])
  })

  it('searches a fixture', async () => {
    const v = await cat.load('MAT')
    expect(v.search('pertama').map((h) => h.node.id)).toEqual(['MAT:T4:sp:1.1.1'])
    expect(v.search('1.1.1').map((h) => h.node.id)).toEqual(['MAT:T4:sp:1.1.1', 'MAT:T5:sp:1.1.1'])
  })

  it('keeps two catalogues apart: the real cache is not touched by a fixture catalogue', async () => {
    await cat.load('MAT')
    expect((await dskpCatalog.load('MAT')).units('T4')).toHaveLength(10)
  })
})
