/**
 * DSKP-T03: `lib/dskp-source.ts`, m28's only door to the M03 catalogue: the `TagLookup`, loading,
 * `useDskpSubject` and the test seam (a fixture catalogue from `createDskpCatalog`).
 */
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'

import { createDskpCatalog, dskpCatalog } from '@/modules/m03-curriculum'
import type { DskpSubjectData, DskpSubjectInfo } from '@/modules/m03-curriculum'

import {
  catalogueVersion,
  dskpSource,
  dskpSubjects,
  setDskpCatalogForTests,
  tagLookup,
  tagLookupFor,
  useDskpSubject,
} from '../lib/dskp-source'

/** A tiny Matematik-shaped fixture: two units, one non-selectable slot. */
const FIXTURE: DskpSubjectData = {
  code: 'MAT',
  groups: [],
  units: [
    {
      tingkatan: 'T4',
      code: '1.0',
      title: 'Unit Satu',
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
  generalTp: null,
}
const INFO: DskpSubjectInfo = {
  ...(dskpCatalog.subject('MAT') as DskpSubjectInfo),
  counts: {
    T4: { units: 1, sk: 1, sp: 1, slots: 1 },
    T5: { units: 1, sk: 1, sp: 1, slots: 0 },
  },
}

afterEach(() => setDskpCatalogForTests())

describe('test seam', () => {
  it('reads the real catalogue by default and a fixture after setDskpCatalogForTests', () => {
    expect(dskpSource()).toBe(dskpCatalog)
    expect(dskpSubjects()).toHaveLength(13)
    const fixture = createDskpCatalog(
      { MAT: () => Promise.resolve(JSON.stringify(FIXTURE)) },
      { version: 'dskp-fixture', subjects: [INFO] },
    )
    setDskpCatalogForTests(fixture)
    expect(dskpSource()).toBe(fixture)
    expect(dskpSubjects().map((s) => s.code)).toEqual(['MAT'])
    expect(catalogueVersion()).toBe('dskp-fixture')
    setDskpCatalogForTests()
    expect(dskpSource()).toBe(dskpCatalog)
  })
})

describe('tagLookup / tagLookupFor', () => {
  it('knows nothing of a subject until it is loaded, then answers from the tree', async () => {
    setDskpCatalogForTests(
      createDskpCatalog(
        { MAT: () => Promise.resolve(JSON.stringify(FIXTURE)) },
        { version: 'v', subjects: [INFO] },
      ),
    )
    expect(tagLookup().subject('MAT')).toBe(true)
    expect(tagLookup().subject('SN')).toBe(false)
    expect(tagLookup().unit('MAT:T4:u:1.0')).toBeUndefined()

    const l = await tagLookupFor(['MAT', 'MAT', 'NOPE'])
    expect(l.unit('MAT:T4:u:1.0')).toEqual({ subject: 'MAT', tingkatan: 'T4', title: 'Unit Satu' })
    expect(l.unit('MAT:T5:u:1.0')).toMatchObject({ tingkatan: 'T5', title: 'Unit Lima' })
    expect(l.sp('MAT:T4:sp:1.1.1')).toEqual({ unitId: 'MAT:T4:u:1.0', selectable: true })
    expect(l.sp('MAT:T4:sp:1.1.2')).toEqual({ unitId: 'MAT:T4:u:1.0', selectable: false })
  })

  it('answers undefined for ids of the wrong kind, unknown ids and malformed keys', async () => {
    const l = await tagLookupFor(['MAT'])
    expect(l.unit('MAT:T4:sp:1.1.1')).toBeUndefined()
    expect(l.sp('MAT:T4:u:1.0')).toBeUndefined()
    expect(l.unit('MAT:T4:u:nope')).toBeUndefined()
    expect(l.unit('MAT-T4-02')).toBeUndefined()
    expect(l.sp('')).toBeUndefined()
  })

  it('a failed load rejects with the typed error and is not cached', async () => {
    let calls = 0
    setDskpCatalogForTests(
      createDskpCatalog(
        {
          MAT: () => {
            calls++
            return calls === 1 ? Promise.reject(new Error('net')) : Promise.resolve(JSON.stringify(FIXTURE))
          },
        },
        { version: 'v', subjects: [INFO] },
      ),
    )
    await expect(tagLookupFor(['MAT'])).rejects.toMatchObject({ name: 'DskpLoadError', reason: 'load-failed' })
    const l = await tagLookupFor(['MAT'])
    expect(l.unit('MAT:T4:u:1.0')?.title).toBe('Unit Satu')
  })
})

describe('useDskpSubject', () => {
  const fixtureCatalog = (delay = false) => {
    const gate: { open: () => void } = { open: () => undefined }
    const wait = delay ? new Promise<void>((r) => (gate.open = r)) : Promise.resolve()
    return {
      gate,
      catalog: createDskpCatalog(
        { MAT: () => wait.then(() => JSON.stringify(FIXTURE)) },
        { version: 'v', subjects: [INFO] },
      ),
    }
  }

  it('loads the subject: loading, then the view', async () => {
    const { catalog, gate } = fixtureCatalog(true)
    setDskpCatalogForTests(catalog)
    const s = useDskpSubject('MAT')
    expect(s.loading.value).toBe(true)
    expect(s.view.value).toBeUndefined()
    gate.open()
    await flushPromises()
    expect(s.loading.value).toBe(false)
    expect(s.error.value).toBeUndefined()
    expect(s.view.value?.units('T4')[0]?.title).toBe('Unit Satu')
  })

  it('is ready at once when the subject is already loaded', async () => {
    const { catalog } = fixtureCatalog()
    setDskpCatalogForTests(catalog)
    await catalog.load('MAT')
    const s = useDskpSubject('MAT')
    expect(s.loading.value).toBe(false)
    expect(s.view.value).toBe(catalog.loaded('MAT'))
  })

  it('an unknown or empty subject gives no view and no error', () => {
    for (const code of [undefined, null, '', 'XYZ']) {
      const s = useDskpSubject(code)
      expect(s.view.value).toBeUndefined()
      expect(s.loading.value).toBe(false)
      expect(s.error.value).toBeUndefined()
    }
  })

  it('shows the error and retry loads again', async () => {
    let calls = 0
    setDskpCatalogForTests(
      createDskpCatalog(
        {
          MAT: () => {
            calls++
            return calls === 1 ? Promise.reject(new Error('net')) : Promise.resolve(JSON.stringify(FIXTURE))
          },
        },
        { version: 'v', subjects: [INFO] },
      ),
    )
    const s = useDskpSubject('MAT')
    await flushPromises()
    expect(s.error.value?.name).toBe('DskpLoadError')
    expect(s.view.value).toBeUndefined()
    s.retry()
    await flushPromises()
    expect(s.error.value).toBeUndefined()
    expect(s.view.value).toBeDefined()
  })

  it('follows a reactive subject and ignores a stale answer', async () => {
    const { catalog, gate } = fixtureCatalog(true)
    setDskpCatalogForTests(catalog)
    const code = ref<string | undefined>('MAT')
    const s = useDskpSubject(code)
    expect(s.loading.value).toBe(true)
    code.value = undefined
    await nextTick()
    expect(s.loading.value).toBe(false)
    gate.open()
    await flushPromises()
    // the answer for 'MAT' arrived after the subject was cleared: not shown
    expect(s.view.value).toBeUndefined()
  })
})
