import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, expectError, loginAs } from '../../../curriculum/helpers'
import { bootWorld, type World } from './boot'

let w: World
let teacher: Client

beforeAll(async () => {
  w = await bootWorld()
  teacher = await loginAs(w, 'guru@demo.test')
}, 120_000)
afterAll(async () => {
  await w?.close()
})

describe('query bounds', () => {
  it('a repeated riskLevel is a 422 on that key', async () => {
    const e = expectError(await teacher.get('/api/analytics/classes?riskLevel=a&riskLevel=b&riskLevel=c'), 'VALIDATION_ERROR')
    expect(Object.keys(e.fields ?? {})).toEqual(['riskLevel'])
  })

  it('a repeated tingkatan is a 422 on the item analysis', async () => {
    expectError(await teacher.get('/api/item-analysis/school?tingkatan=T4&tingkatan=T5'), 'VALIDATION_ERROR')
  })

  it('more than 20 distinct keys is a 422', async () => {
    const qs = Array.from({ length: 25 }, (_, i) => `k${i}=1`).join('&')
    expectError(await teacher.get(`/api/analytics/classes?${qs}`), 'VALIDATION_ERROR')
    const ok = Array.from({ length: 20 }, (_, i) => `k${i}=1`).join('&')
    expect((await teacher.get(`/api/analytics/classes?${ok}`)).status).toBe(200)
  })
})
