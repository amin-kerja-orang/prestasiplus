/**
 * PKSK rows (ids 177698–178460, BR-M04-33) through the REAL registry (M07 contributes its cells): the
 * detail endpoint #4 answers 200 for every id of the range (E2E-M04-62, AC-M04-32.2).
 */

import { beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { questions } from '../../mock'
import { ADMIN, bootRegistry, callAs } from './helpers-questions'

let runtime: MockRuntime
let call: ReturnType<typeof callAs>

beforeAll(async () => {
  runtime = await bootRegistry()
  call = callAs(runtime)
}, 180_000)

describe('#4 on the PKSK id range, full registry', () => {
  it('178460, 178000 and a sample across the range answer 200 with a PKSK row', async () => {
    for (const id of [177698, 177699, 178000, 178100, 178459, 178460]) {
      const res = await call<{ data: { id: number; pkskDomainId: number | null } }>(
        'GET',
        `/api/questions/${String(id)}`,
        ADMIN,
      )
      expect(res.status, `id ${String(id)}`).toBe(200)
      expect(res.body.data.pkskDomainId, `id ${String(id)}`).not.toBeNull()
    }
  })

  it('every id of the range exists in the store and is a PKSK row (763 rows)', () => {
    const missing: number[] = []
    for (let id = 177698; id <= 178460; id++) {
      if (questions.get(id)?.pkskDomainId == null) missing.push(id)
    }
    expect(missing).toEqual([])
    expect(questions.count('Q-PKSK')).toBe(763)
  })

  it('every id of the range answers 200 over HTTP', async () => {
    const bad: number[] = []
    for (let id = 177698; id <= 178460; id++) {
      if ((await call('GET', `/api/questions/${String(id)}`, ADMIN)).status !== 200) bad.push(id)
    }
    expect(bad).toEqual([])
  })
})
