import { SERVABILITY_ACTIVITIES, SERVABILITY_ACTIVITY_LABELS, type ServabilityReport } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { approvalRefusalFields, unservableEverywhere } from '../../src/modules/questions/serving/approval-check'

const report = (verdicts: Record<string, string[] | 'served'>): ServabilityReport => {
  const activities = SERVABILITY_ACTIVITIES.map((activity) => {
    const v = verdicts[activity] ?? ['shape_unsupported']
    return {
      activity,
      label: SERVABILITY_ACTIVITY_LABELS[activity],
      served: v === 'served',
      reasons: v === 'served' ? [] : v.map((code) => ({ code: code as never, message: `Sebab ${code} untuk ${activity}.` })),
    }
  })
  return { questionId: '1', versionNo: 1, activities, servedCount: activities.filter((a) => a.served).length, total: activities.length }
}

/** Unit (no DB): what AC-05.3 calls "unservable everywhere". */
describe('approval check (R1-T45, AC-05.3)', () => {
  it('one served activity is enough to approve', () => {
    expect(unservableEverywhere(report({ databank: 'served' }))).toBe(false)
  })

  it('every activity refusing is unservable everywhere, and the refusal names each activity in BM', () => {
    const r = report({})
    expect(unservableEverywhere(r)).toBe(true)
    const fields = approvalRefusalFields(r)
    expect(Object.keys(fields)).toEqual(SERVABILITY_ACTIVITIES.map((a) => `servability.${a}`))
    expect(fields['servability.databank']).toBe('Databank Soalan: Sebab shape_unsupported untuk databank.')
  })

  it('a question the bridge would serve once placed is not unservable everywhere (not_on_published_paper is about the paper)', () => {
    expect(unservableEverywhere(report({ simulasi_paper: ['not_on_published_paper'] }))).toBe(false)
    expect(unservableEverywhere(report({ simulasi_paper: ['not_on_published_paper', 'bridge_refused'] }))).toBe(true)
  })
})
