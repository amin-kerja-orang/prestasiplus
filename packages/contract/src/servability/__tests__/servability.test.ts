import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { SERVABILITY_BATCH_MAX, ServabilityBatchRequestSchema, ServabilityLaneQuerySchema, ServabilityOverviewSchema } from '../reads'
import {
  SERVABILITY_ACTIVITIES,
  SERVABILITY_ACTIVITY_LABELS,
  SERVABILITY_REASON_CODES,
  SERVABILITY_REASON_MS,
  ServabilityReportSchema,
  notServedLine,
  servabilityReasonMs,
} from '../schema'

describe('servability contract (R1-T29)', () => {
  it('has a BM sentence for every reason and a label for every activity, in one table each', () => {
    expect(Object.keys(SERVABILITY_REASON_MS).sort()).toEqual([...SERVABILITY_REASON_CODES].sort())
    expect(Object.keys(SERVABILITY_ACTIVITY_LABELS).sort()).toEqual([...SERVABILITY_ACTIVITIES].sort())
    for (const sentence of Object.values(SERVABILITY_REASON_MS)) expect(sentence.endsWith('.')).toBe(true)
  })

  it('quotes the design table 9.3 wording', () => {
    expect(SERVABILITY_REASON_MS.not_approved).toBe('Belum diluluskan — tekan Terbitkan untuk memaparkannya.')
    expect(SERVABILITY_REASON_MS.archived).toBe('Diarkibkan — pulihkan ke draf dahulu.')
    expect(SERVABILITY_REASON_MS.image_missing).toBe('Imej belum dimuat naik — muat naik di borang sunting.')
    expect(SERVABILITY_REASON_MS.not_on_published_paper).toBe('Tiada dalam mana-mana kertas diterbitkan.')
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

  it('overview has one entry per activity', () => {
    const activities = SERVABILITY_ACTIVITIES.map((activity) => ({ activity, label: SERVABILITY_ACTIVITY_LABELS[activity], served: 1, total: 2, attention: 1, basis: 'sql' as const }))
    expect(ServabilityOverviewSchema.safeParse({ bank: 2, activities }).success).toBe(true)
    expect(ServabilityOverviewSchema.safeParse({ bank: 2, activities: activities.slice(1) }).success).toBe(false)
  })

  it('registers the five routes under /admin/servability', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, unknown> }
    for (const p of ['/admin/servability/questions/{id}', '/admin/servability/questions/batch', '/admin/servability/overview', '/admin/servability/lanes/databank', '/admin/servability/lanes/bijak-spm']) {
      expect(doc.paths[p] ?? doc.paths[`/api${p}`], p).toBeDefined()
    }
  })
})
