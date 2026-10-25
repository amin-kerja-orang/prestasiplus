/**
 * DSKP-T05: bank filters (Subjek, Tingkatan, Unit, SP, TP, KBAT, Perlu semakan tag), the `BankRow`
 * tag fields, `tagSubjects()` and the `bankStats` subjects (AC-09.x, AC-08.3, D11: every count is
 * computed from the data it describes). The expected sets are computed independently from the
 * tags of the bank rows, never typed by hand.
 */
import { afterEach, describe, expect, it } from 'vitest'

import { BANK } from '../data/registry'
import { REVIEW_TOPIC, T1_T3_TOPIC } from '../domain/topic'
import { dskpSource } from '../lib/dskp-source'
import { BijakServer, MemoryStorage } from '../server/store'
import { MAT_T4_SP, MAT_T4_UNIT } from './tag-fixtures'

const make = () => new BijakServer({ storage: new MemoryStorage() })

// The bank is a shared in-memory registry; approvals below change it, so restore it after each test.
const snapshot = {
  questions: new Map(BANK.questions),
  schemes: new Map(BANK.schemes),
  stimuli: new Map(BANK.stimuli),
  groups: new Map(BANK.groups),
}
afterEach(() => {
  for (const [k, m] of [
    ['questions', BANK.questions],
    ['schemes', BANK.schemes],
    ['stimuli', BANK.stimuli],
    ['groups', BANK.groups],
  ] as const) {
    m.clear()
    for (const [id, v] of snapshot[k] as Map<string, never>) (m as Map<string, never>).set(id, v)
  }
})

const ids = (rows: { id: string }[]): string[] => rows.map((r) => r.id)

describe('BankRow tag fields (AC-09.4, design 5.4)', () => {
  it('a tagged row carries the catalogue unit title, printed SP codes, TP and KBAT', async () => {
    const row = (await make().listBank({ q: 'mat2-kuadratik-v1' })).find((r) => r.id === 'mat2-kuadratik-v1')!
    expect(row).toMatchObject({
      formOrigin: 'T4',
      unitId: MAT_T4_UNIT,
      unitTitle: 'Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
      topic: 'Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah',
      spCodes: ['1.1.6'],
      tp: 2,
      kbat: null,
      tagReview: false,
    })
  })

  it('a T1-T3 row shows the exempt copy and no unit', async () => {
    const row = (await make().listBank({ q: 'mat1-pub-1' })).find((r) => r.id === 'mat1-pub-1')!
    expect(row).toMatchObject({
      formOrigin: 'T1-T3',
      unitId: null,
      unitTitle: null,
      spCodes: [],
      topic: T1_T3_TOPIC,
      tagReview: false,
    })
  })

  it('a flagged row shows the admin "perlu semakan" copy and no tingkatan', async () => {
    const rows = await make().listBank({ status: 'semua', tagReview: true })
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows)
      expect(r).toMatchObject({
        formOrigin: null,
        unitId: null,
        unitTitle: null,
        spCodes: [],
        topic: REVIEW_TOPIC,
        tagReview: true,
      })
  })

  it('the review queue and the paper builder show the same topic', async () => {
    const server = make()
    const queue = await server.listReviewQueue()
    expect(queue.items.some((i) => i.topic === REVIEW_TOPIC)).toBe(true)
    const paper = await server.getPaperEditor('kp-seed-1')
    const kuadratik = paper.questions.find((q) => q.id === 'mat2-kuadratik-v2')!
    expect(kuadratik.topic).toBe('Fungsi dan Persamaan Kuadratik dalam Satu Pemboleh Ubah')
  })
})

describe('listBank filters (AC-09.1, AC-09.2)', () => {
  it('Tingkatan, Unit, SP and TP each return exactly the rows whose tag matches', async () => {
    const server = make()
    const all = await server.listBank({ status: 'semua' })

    for (const formOrigin of ['T4', 'T5', 'T1-T3'] as const) {
      const rows = await server.listBank({ status: 'semua', formOrigin })
      expect(ids(rows)).toEqual(ids(all.filter((r) => r.formOrigin === formOrigin)))
    }
    expect((await server.listBank({ status: 'semua', formOrigin: 'T1-T3' })).length).toBeGreaterThan(0)

    const byUnit = await server.listBank({ status: 'semua', unitId: MAT_T4_UNIT })
    expect(ids(byUnit)).toEqual(ids(all.filter((r) => r.unitId === MAT_T4_UNIT)))
    expect(ids(byUnit)).toContain('mat2-kuadratik-v1')

    const bySp = await server.listBank({ status: 'semua', spId: MAT_T4_SP })
    expect(ids(bySp)).toEqual(ids(all.filter((r) => r.spCodes.includes('1.1.6') && r.unitId === MAT_T4_UNIT)))
    expect(bySp.length).toBeGreaterThan(0)

    for (const tp of [1, 2, 3, 4, 5, 6]) {
      const rows = await server.listBank({ status: 'semua', tp })
      expect(ids(rows)).toEqual(ids(all.filter((r) => r.tp === tp)))
    }
    expect((await server.listBank({ status: 'semua', tp: 2 })).length).toBeGreaterThan(0)
  })

  it('Subjek and Perlu semakan tag combine; the flagged count is the number of flagged rows', async () => {
    const server = make()
    const all = await server.listBank({ status: 'semua' })
    const flagged = await server.listBank({ status: 'semua', tagReview: true })
    expect(ids(flagged)).toEqual(ids(all.filter((r) => r.tagReview)))
    const matFlagged = await server.listBank({ status: 'semua', tagReview: true, subject: 'MAT' })
    expect(ids(matFlagged)).toEqual(ids(flagged.filter((r) => r.subject === 'MAT')))
    expect(matFlagged.length).toBeLessThan(flagged.length)
    // unchecked box = no filter
    expect(ids(await server.listBank({ status: 'semua', tagReview: false }))).toEqual(ids(all))
  })

  it('the search term also matches the printed SP codes', async () => {
    const server = make()
    const rows = await server.listBank({ status: 'semua', q: '1.1.6' })
    expect(ids(rows)).toContain('mat2-kuadratik-v1')
    for (const r of rows) {
      const hit =
        r.spCodes.some((c) => c.includes('1.1.6')) ||
        r.preview.toLowerCase().includes('1.1.6') ||
        r.id.includes('1.1.6') ||
        r.topic.toLowerCase().includes('1.1.6')
      expect(hit).toBe(true)
    }
  })

  it('an unknown unit or SP gives an empty list, not an error', async () => {
    const server = make()
    expect(await server.listBank({ status: 'semua', unitId: 'MAT:T4:u:99.0' })).toEqual([])
    expect(await server.listBank({ status: 'semua', spId: 'MAT:T4:sp:99.9.9' })).toEqual([])
  })

  it('KBAT: Ya, Tidak and each level (AC-06.5), after a question is tagged with a level', async () => {
    const server = make()
    expect(await server.listBank({ status: 'semua', kbat: 'ya' })).toEqual([])
    const all = await server.listBank({ status: 'semua' })
    expect(ids(await server.listBank({ status: 'semua', kbat: 'tidak' }))).toEqual(ids(all))

    const e = await server.getBankEditable('mat2-kuadratik-v1')
    expect(
      (await server.reviseQuestionFull('mat2-kuadratik-v1', { ...e.question, tag: { ...e.question.tag, kbat: 'menilai' } }, undefined, '')).ok,
    ).toBe(true)
    // the live version keeps serving until approval
    expect(await server.listBank({ status: 'semua', kbat: 'ya' })).toEqual([])
    expect((await server.reviewDecision('v:mat2-kuadratik-v1', { action: 'terbit' })).ok).toBe(true)

    expect(ids(await server.listBank({ status: 'semua', kbat: 'ya' }))).toEqual(['mat2-kuadratik-v1'])
    expect(ids(await server.listBank({ status: 'semua', kbat: 'menilai' }))).toEqual(['mat2-kuadratik-v1'])
    expect(await server.listBank({ status: 'semua', kbat: 'mencipta' })).toEqual([])
    const tidak = await server.listBank({ status: 'semua', kbat: 'tidak' })
    expect(tidak).toHaveLength(all.length - 1)
    expect(ids(tidak)).not.toContain('mat2-kuadratik-v1')
    expect((await server.getBankDetail('mat2-kuadratik-v1')).row.kbat).toBe('menilai')
  })

  it('default filters are unchanged: status Terbit, and the KPI strip stays unfiltered', async () => {
    const server = make()
    const stats = await server.bankStats()
    expect((await server.listBank()).length).toBe(stats.total)
    expect((await server.listBank({ tagReview: true })).length).toBeLessThan(stats.total)
    expect((await server.bankStats()).total).toBe(stats.total)
  })
})

describe('tagSubjects() and the bankStats subjects', () => {
  it('tagSubjects lists the 13 catalogue subjects; subjects() stays blueprint-driven', () => {
    const server = make()
    const tag = server.tagSubjects()
    expect(tag).toHaveLength(13)
    expect(tag.map((s) => s.code)).toEqual(dskpSource().subjects().map((s) => s.code))
    expect(tag.find((s) => s.code === 'LNS')?.name).toBe('Landskap dan Nurseri')
    expect(tag.find((s) => s.code === 'KPJ')?.name).toBe('Katering dan Penyajian')
    expect(tag.find((s) => s.code === 'MAT')?.name).toBe('Matematik')
    expect(server.subjects().map((s) => s.code)).toEqual(['MAT', 'SN', 'SEJ'])
  })

  it('bankStats lists the subjects that hold questions, computed, and its total equals its tiles', async () => {
    const server = make()
    const stats = await server.bankStats()
    const all = await server.listBank({ status: 'semua' })
    // catalogue order (MAT, ..., SN, ..., SEJ); exactly the subjects present in the data
    expect(stats.bySubject.map((s) => s.code)).toEqual(['MAT', 'SN', 'SEJ'])
    expect(new Set(stats.bySubject.map((s) => s.code))).toEqual(new Set(all.map((r) => r.subject)))
    for (const s of stats.bySubject) {
      const mine = all.filter((r) => r.subject === s.code)
      expect(s.terbit + s.semakan + s.draf + s.ditolak).toBe(mine.length)
      expect(s.terbit).toBe(mine.filter((r) => r.status === 'terbit').length)
    }
    expect(stats.total).toBe(stats.bySubject.reduce((n, s) => n + s.terbit, 0))
    // no empty tiles for the ten catalogue subjects without a question
    expect(stats.bySubject.every((s) => s.terbit + s.semakan + s.draf + s.ditolak > 0)).toBe(true)
  })

  it('a question of another catalogue subject adds its tile (Fizik), with the catalogue name', async () => {
    const server = make()
    const fiz = await dskpSource().load('FIZ')
    const unit = fiz.units('T4')[0]!
    const sp = fiz.sps(unit.id)[0]!
    const b = await server.createManualBatch(1, {
      subject: 'FIZ',
      kertas: 2,
      year: 2026,
      paperType: 'Soalan Umum',
      source: 'Latihan sekolah fiksyen',
      copyright: 'sendiri',
      notes: '',
    })
    const q = b.questions[0]!
    await server.saveExtracted(b.id, {
      questions: [
        {
          ...q,
          type: 'mcq',
          stem: 'Nilai $2 + 3$ ialah',
          options: ['4', '5', '6', '7'].map((text, i) => ({ id: 'ABCD'[i]!, text })),
          marks: 1,
          scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5' },
          tag: {
            subject: 'FIZ',
            formOrigin: 'T4',
            unitId: unit.id,
            spIds: [sp.id],
            tp: 2,
            kbat: null,
            catalogueVersion: dskpSource().version,
          },
        },
      ],
      stimuli: [],
    })
    const before = await server.bankStats()
    expect(before.bySubject.some((s) => s.code === 'FIZ')).toBe(false)
    const res = await server.submitForReview(b.id)
    expect(res.ok).toBe(true)

    const after = await server.bankStats()
    const tile = after.bySubject.find((s) => s.code === 'FIZ')!
    expect(tile).toMatchObject({ name: 'Fizik', terbit: 0, semakan: 1, draf: 0, ditolak: 0 })
    expect(after.semakan).toBe(before.semakan + 1)
    expect(after.total).toBe(before.total)
    expect(after.total).toBe(after.bySubject.reduce((n, s) => n + s.terbit, 0))
    // and the bank filter and the queue show it with the unit title from the catalogue
    const row = (await server.listBank({ status: 'semua', subject: 'FIZ' }))[0]!
    expect(row).toMatchObject({ subjectName: 'Fizik', unitTitle: unit.title, topic: unit.title, tagReview: false })
    expect((await server.listReviewQueue({ subject: 'FIZ' })).items).toHaveLength(1)
  })
})
