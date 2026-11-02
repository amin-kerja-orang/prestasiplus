import { describe, expect, it } from 'vitest'

import { pinServableForNewSitting } from '../../src/modules/questions/pin-servable'

/** REQ-B-058: the rule that decides whether a new sitting / Kuiz page may be served from a pinned version. */
describe('pinServableForNewSitting', () => {
  it('serves an approved pin and a superseded archive', () => {
    expect(pinServableForNewSitting({ status: 'approved', archiveReason: null })).toBe(true)
    expect(pinServableForNewSitting({ status: 'archived', archiveReason: 'superseded' })).toBe(true)
  })

  it('refuses a takedown: archived withdrawn, source_takedown, or no reason recorded', () => {
    for (const archiveReason of ['withdrawn', 'source_takedown', null] as const) {
      expect(pinServableForNewSitting({ status: 'archived', archiveReason }), String(archiveReason)).toBe(false)
    }
  })

  it('refuses a version that is not published at all', () => {
    expect(pinServableForNewSitting({ status: 'draft', archiveReason: null })).toBe(false)
    expect(pinServableForNewSitting({ status: 'review', archiveReason: null })).toBe(false)
  })

  it('REQ-B-074: a version whose source paper is taken down is never servable, whatever its own status and reason', () => {
    expect(pinServableForNewSitting({ status: 'archived', archiveReason: 'superseded', sourceTakenDown: true })).toBe(false)
    expect(pinServableForNewSitting({ status: 'approved', archiveReason: null, sourceTakenDown: true })).toBe(false)
    expect(pinServableForNewSitting({ status: 'archived', archiveReason: 'superseded', sourceTakenDown: false })).toBe(true)
  })
})
