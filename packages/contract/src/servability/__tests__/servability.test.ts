import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import {
  latihTubiCellAttentionMs,
  servabilityLaneListOf,
  ServabilityDatabankRowSchema,
  SERVABILITY_BATCH_MAX,
  SERVABILITY_HUB_CARDS,
  SERVABILITY_HUB_COPY,
  SERVABILITY_HUB_LANES,
  SERVABILITY_LANE_WINDOW,
  ServabilityBatchRequestSchema,
  ServabilityHubCardSchema,
  ServabilityLaneQuerySchema,
  ServabilityLaneRowSchema,
  ServabilityLatihTubiLaneSchema,
  ServabilityOverviewSchema,
  trackingSetAttentionMs,
} from '../reads'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  SERVABILITY_REASON_CODES,
  SERVABILITY_REASON_MS,
  SERVABILITY_REASON_SOURCE,
  ServabilityReportSchema,
  notServedLine,
  servabilityReasonMs,
} from '../schema'

describe('servability contract (R1-T29)', () => {
  it('has a BM sentence for every reason and a label for every activity, in one table each', () => {
    expect(Object.keys(SERVABILITY_REASON_MS).sort()).toEqual([...SERVABILITY_REASON_CODES].sort())
    expect(Object.keys(SERVABILITY_ACTIVITY_LABELS).sort()).toEqual([...SERVABILITY_ACTIVITIES].sort())
    // Every sentence ends with a full stop except V2's paper-lane line, printed without one.
    for (const [code, sentence] of Object.entries(SERVABILITY_REASON_MS)) expect(sentence.endsWith('.') || code === 'paper_empty', code).toBe(true)
    expect(Object.keys(SERVABILITY_REASON_SOURCE).sort()).toEqual([...SERVABILITY_REASON_CODES].sort())
  })

  it('quotes the design table 9.3 wording', () => {
    expect(SERVABILITY_REASON_MS.not_approved).toBe('Belum diluluskan — tekan Terbitkan untuk memaparkannya.')
    expect(SERVABILITY_REASON_MS.archived).toBe('Diarkibkan — pulihkan ke draf dahulu.')
    expect(SERVABILITY_REASON_MS.image_missing).toBe('Imej belum dimuat naik — muat naik di borang sunting.')
    expect(SERVABILITY_REASON_MS.not_on_published_paper).toBe('Tiada dalam mana-mana kertas diterbitkan.')
    // [PROPOSED] D90 cause and fix for a stimulus shared by several questions without a group.
    expect(SERVABILITY_REASON_MS.stimulus_shared_ungrouped).toBe('Rangsangan ini dikongsi oleh beberapa soalan tetapi bukan kumpulan rangsangan — jadikan soalan-soalan itu satu kumpulan rangsangan (D90).')
  })

  it('fills the activity into a sentence and wraps a bridge reason as "Tidak dihidangkan kerana ..."', () => {
    expect(servabilityReasonMs('shape_unsupported', 'bab')).toBe('Bentuk soalan ini tidak dipaparkan di Latihan Bab.')
    expect(servabilityReasonMs('bridge_refused', 'simulasi_paper', 'jenis rangsangan tidak disokong')).toBe(notServedLine('jenis rangsangan tidak disokong'))
    expect(servabilityReasonMs('bridge_refused', 'simulasi_paper')).toBe('Tidak dapat dihidangkan di Simulasi (kertas).')
  })

  it('a report has one result per activity and counts the served ones', () => {
    const activities = SERVABILITY_ACTIVITIES.map((activity, i) => ({
      activity,
      label: SERVABILITY_ACTIVITY_LABELS[activity],
      served: i < 2,
      reasons: i < 2 ? [] : [{ code: 'not_approved' as const, message: SERVABILITY_REASON_MS.not_approved }],
    }))
    const report = { questionId: '5', versionNo: 1, activities, servedCount: 2, total: 6 }
    expect(ServabilityReportSchema.safeParse(report).success).toBe(true)
    expect(ServabilityReportSchema.safeParse({ ...report, activities: activities.slice(1) }).success).toBe(false)
  })

  it('is in the OpenAPI components', () => {
    const doc = buildOpenApiDocument() as { components: { schemas: Record<string, unknown> } }
    for (const id of ['ServabilityReport', 'ServabilityActivityResult', 'ServabilityReason', 'ServabilityReasonCode', 'ServabilityActivity']) {
      expect(doc.components.schemas[id], id).toBeDefined()
    }
  })
})

describe('servability reads contract (R1-T30)', () => {
  it('caps the batch at 100 ids with BM messages, rejects extra keys', () => {
    expect(ServabilityBatchRequestSchema.safeParse({ ids: ['1'] }).success).toBe(true)
    const tooMany = ServabilityBatchRequestSchema.safeParse({ ids: Array.from({ length: SERVABILITY_BATCH_MAX + 1 }, (_, i) => String(i + 1)) })
    expect(tooMany.success).toBe(false)
    expect(JSON.stringify(tooMany.error?.issues)).toContain('Paling banyak 100 soalan sekali gus.')
    expect(ServabilityBatchRequestSchema.safeParse({ ids: [] }).success).toBe(false)
    expect(ServabilityBatchRequestSchema.safeParse({ ids: ['1'], x: 1 }).success).toBe(false)
  })

  it('lane query: page 1 and size 25 by default, bounded page size and search', () => {
    expect(ServabilityLaneQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 25 })
    expect(ServabilityLaneQuerySchema.safeParse({ pageSize: '101' }).success).toBe(false)
    expect(ServabilityLaneQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(ServabilityLaneQuerySchema.safeParse({ search: 'x'.repeat(101) }).success).toBe(false)
  })

  it('lane query: a page deeper than the window (page x pageSize) is refused with a BM message on `page`', () => {
    expect(ServabilityLaneQuerySchema.safeParse({ page: String(SERVABILITY_LANE_WINDOW / 100), pageSize: '100' }).success).toBe(true)
    const deep = ServabilityLaneQuerySchema.safeParse({ page: String(SERVABILITY_LANE_WINDOW / 100 + 1), pageSize: '100' })
    expect(deep.success).toBe(false)
    expect(deep.error?.issues[0]).toMatchObject({ path: ['page'], message: 'Halaman terlalu jauh. Gunakan Tapis atau Cari untuk mengecilkan senarai.' })
    expect(ServabilityLaneQuerySchema.safeParse({ page: '100000' }).success).toBe(false)
  })

  it('a lane page is the list envelope plus the Subjek options (REQ-C-020)', () => {
    const meta = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1, from: null, to: null }
    const lane = servabilityLaneListOf(ServabilityDatabankRowSchema)
    expect(lane.safeParse({ data: [], meta, subjects: [{ id: '3', name: 'Matematik' }] }).success).toBe(true)
    expect(lane.safeParse({ data: [], meta }).success).toBe(false)
    expect(lane.safeParse({ data: [], meta, subjects: [{ id: '3' }] }).success).toBe(false)
  })

  describe('S3-T03 hub and lanes (FR-ADM-Q01.1, API-BIJAK-12)', () => {
    const meta = { page: 1, pageSize: 25, totalItems: 0, totalPages: 1, from: null, to: null }

    it('has six lanes in the PRD order, under the PRD title and intro', () => {
      expect(SERVABILITY_HUB_LANES).toEqual(['databank', 'tracking-a', 'subjektif', 'bijak-spm', 'kertas-subjektif', 'latih-tubi'])
      expect(SERVABILITY_HUB_LANES.map((l) => SERVABILITY_HUB_CARDS[l].title)).toEqual(['Databank Soalan', 'Tracking A', 'Subjektif', 'Bijak SPM', 'Kertas Subjektif', 'Latih Tubi'])
      expect(SERVABILITY_HUB_COPY.title).toBe('SPM')
      expect(SERVABILITY_HUB_COPY.intro).toBe('Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.')
    })

    it('carries no attention text for Kertas Subjektif, whose rule is open', () => {
      expect(SERVABILITY_HUB_CARDS['kertas-subjektif'].attentionLabel).toBe('')
      expect(SERVABILITY_HUB_CARDS.subjektif.attentionLabel).toBe('tiada skema — tidak disajikan')
      const card = { lane: 'kertas-subjektif', title: 'Kertas Subjektif', description: 'x', total: 3, attention: 0, attentionLabel: '' }
      expect(ServabilityHubCardSchema.safeParse({ ...card, attentionOpen: true }).success).toBe(true)
      expect(ServabilityHubCardSchema.safeParse({ ...card, attentionLines: [{ count: 0, text: 'x' }] }).success).toBe(false)
    })

    it('a lane page takes count and attention beside data, meta and subjects', () => {
      const lane = servabilityLaneListOf(ServabilityLaneRowSchema)
      const row = { id: '1', title: 'Bahasa Melayu · 2026 Set 1', meta: '#1 · ramalan · 8 soalan', status: 'belum_cukup', attention: [], actions: ['edit'] }
      expect(lane.safeParse({ data: [row], meta, subjects: [], count: 1, attention: [{ count: 1, text: '1 set tidak lengkap' }] }).success).toBe(true)
      expect(lane.safeParse({ data: [{ ...row, actions: ['padam'] }], meta, subjects: [] }).success).toBe(false)
    })

    it('the Latih Tubi page needs meta.switchEnabled and its cells have no row action', () => {
      const cell = { id: '3:4', title: 'Sains · Tingkatan 4', meta: '#3 · 2 soalan', status: 'open', attention: [], actions: [], subject: { id: '3', name: 'Sains' }, level: { id: '4', name: 'Tingkatan 4' }, servable: 2, total: 2 }
      expect(ServabilityLatihTubiLaneSchema.safeParse({ data: [cell], meta: { ...meta, switchEnabled: true }, subjects: [], count: 2 }).success).toBe(true)
      expect(ServabilityLatihTubiLaneSchema.safeParse({ data: [cell], meta, subjects: [] }).success).toBe(false)
      expect(ServabilityLatihTubiLaneSchema.safeParse({ data: [{ ...cell, actions: ['edit'] }], meta: { ...meta, switchEnabled: true }, subjects: [] }).success).toBe(false)
    })

    it('search over 100 characters gives the SR-4 message', () => {
      const res = ServabilityLaneQuerySchema.safeParse({ search: 'a'.repeat(101) })
      expect(res.success).toBe(false)
      expect(res.error?.issues[0]?.message).toBe('Carian tidak boleh melebihi 100 aksara.')
    })

    it('builds the exact BM attention sentences', () => {
      expect(trackingSetAttentionMs(8, 40, 28471)).toBe('Hanya 8 daripada 40 soalan — 28471 tersedia untuk diisi')
      expect(latihTubiCellAttentionMs(3)).toBe('3 tidak boleh ditanda')
    })
  })

  it('overview has one entry per activity', () => {
    const activities = SERVABILITY_ACTIVITIES.map((activity) => ({ activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: 1, total: 2, attention: 1, basis: 'sql' as const }))
    expect(ServabilityOverviewSchema.safeParse({ bank: 2, activities, cards: [], computedAt: '2026-10-19T09:00:00.000+08:00' }).success).toBe(true)
    // computedAt is required (H-A21): the cache always sends it
    expect(ServabilityOverviewSchema.safeParse({ bank: 2, activities, cards: [] }).success).toBe(false)
    expect(ServabilityOverviewSchema.safeParse({ bank: 2, activities: activities.slice(1), cards: [], computedAt: '2026-10-19T09:00:00.000+08:00' }).success).toBe(false)
  })

  it('registers the five routes under /admin/servability', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, unknown> }
    for (const p of ['/admin/servability/questions/{id}', '/admin/servability/questions/batch', '/admin/servability/overview', '/admin/servability/lanes/databank', '/admin/servability/lanes/bijak-spm']) {
      expect(doc.paths[p] ?? doc.paths[`/api${p}`], p).toBeDefined()
    }
  })

  it('[CI] S1-T07: stimulus_missing names the reference, figure_only has its own sentence (PRD 30 FR-ADM-G7.3, 45 gate row 26)', () => {
    expect(servabilityReasonMs('stimulus_missing', 'databank', 'Rajah 14')).toBe('Rangsangan tiada — soalan merujuk Rajah 14 tetapi tiada gambar.')
    expect(servabilityReasonMs('stimulus_missing', 'bab')).toBe('Rangsangan tiada — soalan merujuk rajah tetapi tiada gambar.')
    expect(servabilityReasonMs('figure_only', 'latih_tubi_spm')).toBe('Soalan ini hanya mengandungi rangsangan. Tukarkan kepada rangsangan kumpulan.')
    expect(SERVABILITY_REASON_SOURCE.stimulus_missing).toBe('PRD')
    expect(SERVABILITY_REASON_SOURCE.figure_only).toBe('PRD')
  })
})
