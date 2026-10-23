import { describe, expect, it } from 'vitest'

import { BijakServer, MemoryStorage } from '../server/store'

const make = () => new BijakServer({ storage: new MemoryStorage() })

describe('bank stat strip (FB-023)', () => {
  it('the total equals the sum of the subject counts and the default (Terbit) list', async () => {
    const server = make()
    const stats = await server.bankStats()
    const bySubject = stats.bySubject.reduce((n, s) => n + s.terbit, 0)
    expect(stats.total).toBe(bySubject)
    expect(stats.total).toBe((await server.listBank()).length)
  })

  it('questions waiting for review are reported apart, not added into the total', async () => {
    const server = make()
    const stats = await server.bankStats()
    const all = await server.listBank({ status: 'semua' })
    const waiting = all.filter((r) => r.status === 'semakan').length
    expect(waiting).toBeGreaterThan(0)
    expect(stats.semakan).toBe(waiting)
    expect(stats.bySubject.reduce((n, s) => n + s.semakan, 0)).toBe(waiting)
    expect(stats.total + stats.semakan).toBe(all.length)
  })

  it('stays consistent after a question is approved', async () => {
    const server = make()
    const before = await server.bankStats()
    const queue = await server.listReviewQueue()
    let item
    for (const i of queue.items) {
      if (i.isRevision || i.questionIds.length !== 1) continue
      if ((await server.getReviewItem(i.key)).gate.length === 0) {
        item = i
        break
      }
    }
    if (!item) throw new Error('no single-question unit passes the gate')
    const res = await server.reviewDecision(item.key, { action: 'terbit' })
    expect(res.ok).toBe(true)
    const after = await server.bankStats()
    expect(after.total).toBe(before.total + 1)
    expect(after.semakan).toBe(before.semakan - 1)
    expect(after.total).toBe(after.bySubject.reduce((n, s) => n + s.terbit, 0))
  })
})
