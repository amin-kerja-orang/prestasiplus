import { describe, expect, it } from 'vitest'

import { builderCopy as t } from '../admin/builder/domain/copy'
import { publishGate } from '../admin/builder/domain/publish-gate'

const base = { localIssues: 0, dirty: false, reviewFailed: false, blockers: 0 }

describe('publishGate', () => {
  it('is open when nothing blocks', () => {
    expect(publishGate(base)).toEqual({ blocked: false, count: 0, reason: '' })
  })
  it('unsaved edits: disabled, reason says save first', () => {
    const g = publishGate({ ...base, dirty: true })
    expect(g.blocked).toBe(true)
    expect(g.reason).toBe(t.publishSaveFirst)
  })
  it('review call failed: disabled, reason says the check could not run', () => {
    const g = publishGate({ ...base, reviewFailed: true })
    expect(g.blocked).toBe(true)
    expect(g.reason).toBe(t.publishCheckFailed)
  })
  it('local issues and server blockers count', () => {
    expect(publishGate({ ...base, localIssues: 2, dirty: true }).count).toBe(2)
    expect(publishGate({ ...base, blockers: 3 })).toMatchObject({ blocked: true, count: 3 })
  })
})
