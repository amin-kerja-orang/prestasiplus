import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
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
