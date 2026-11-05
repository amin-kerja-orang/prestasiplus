/**
 * Mock handler of API-AS-06 `POST /api/admin-sekolah/pelajar/import` (S6-T09): guard SA, `dryRun`, pending pupils, the
 * duplicate e-mail, the 1000-row and quota refusals. Real core with the owners at the project clock; fictitious data only.
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02, { setSubscriptionSource, studentsAt } from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import m27 from '../../mock'

const ADMIN = 1
const PELAJAR = 2
const SCHOOL_ADMIN = 8
const URL = '/api/admin-sekolah/pelajar/import'

let runtime: MockRuntime
let seq = 0
const mail = (): string => `import-${String(++seq)}@demo.test`

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m09, m10, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

async function post(userId: number | null, text: string, query = '', level?: string) {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (userId !== null) headers.authorization = `Bearer ${setUser(userId).token}`
  const form = new FormData()
  if (level !== undefined) form.append('level', level)
  form.append('csvFile', new File([text], 'pelajar.csv'))
  const res: TransportResponse = await runtime.transport.request({ method: 'POST', url: `${URL}${query}`, headers, body: form })
  return { status: res.status, body: res.body as { data?: Record<string, unknown>; error?: { code: string; message: string } } }
}

const csv = (rows: string[]): string => ['nama,email,kelas', ...rows].join('\n')
const schoolOfAdmin = (): number => users.get(SCHOOL_ADMIN)?.schoolId ?? 0
/** Exactly `free` seats for the school of the school admin, from now on. */
function seats(free: number): void {
  const quota = studentsAt(schoolOfAdmin()) + free
  setSubscriptionSource((schoolId) => [{ id: 1, schoolId, status: 'active', studentQuota: quota, startsAt: '2026-01-01T00:00:00+08:00' }])
}
afterAll(() => setSubscriptionSource(null))

describe('POST /api/admin-sekolah/pelajar/import (mock)', () => {
  it('is for a school admin only', async () => {
    expect((await post(null, csv([]))).status).toBe(401)
    expect((await post(PELAJAR, csv([]))).status).toBe(403)
    expect((await post(ADMIN, csv([]))).status).toBe(403)
  })

  it('previews with dryRun and creates nothing; the real call creates PENDING pupils; a duplicate e-mail is skipped and listed', async () => {
    const school = schoolOfAdmin()
    seats(3)
    const [a, b] = [mail(), mail()]
    const before = users.countWhere({ role: 'student', schoolId: school })
    const dry = await post(SCHOOL_ADMIN, csv([`ALI BIN ABU,${a},`, `Siti,${b},`, `Rosak,tak-sah,`]), '?dryRun=true', 'T4')
    expect(dry.status, JSON.stringify(dry.body)).toBe(200)
    expect(dry.body.data).toMatchObject({ dryRun: true, rows: 3, created: 0, errors: [{ row: 4, message: 'Format e-mel tidak sah.' }] })
    expect(users.countWhere({ role: 'student', schoolId: school })).toBe(before)

    const real = await post(SCHOOL_ADMIN, csv([`ALI BIN ABU,${a},`, `Siti,${b},`, `Rosak,tak-sah,`, `Lama,${a},`]), '', 'T4')
    expect(real.body.data).toMatchObject({ dryRun: false, created: 2 })
    expect(JSON.stringify(real.body)).not.toMatch(/password/i)
    const ali = users.findByEmail(a)
    expect(ali).toMatchObject({ name: 'Ali Bin Abu', isActive: false, grade: 10, schoolId: school })
    // The same e-mail again: skipped, counted and listed.
    const again = await post(SCHOOL_ADMIN, csv([`Ali Lagi,${a},`]), '', 'T4')
    expect(again.body.data).toMatchObject({ created: 0, skipped: 1, errors: [{ row: 2, message: 'E-mel sudah wujud (dilangkau).' }] })
  })

  it('refuses the WHOLE file over the remaining seats (pending pupils count) and a school without a subscription', async () => {
    setSubscriptionSource(null)
    const none = await post(SCHOOL_ADMIN, csv([`Satu,${mail()},`]), '', 'T4')
    expect(none.status).toBe(409)
    expect(none.body.error).toMatchObject({ code: 'NO_SUBSCRIPTION', message: 'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.' })
    seats(1)
    const before = studentsAt(schoolOfAdmin())
    const full = await post(SCHOOL_ADMIN, csv([`Satu,${mail()},`, `Dua,${mail()},`]), '', 'T4')
    expect(full.status).toBe(409)
    expect(full.body.error).toMatchObject({ code: 'QUOTA_FULL', message: 'Kuota penuh! Sila tingkatkan kuota dahulu.' })
    expect(studentsAt(schoolOfAdmin())).toBe(before)
    expect((await post(SCHOOL_ADMIN, csv([`Satu,${mail()},`]), '', 'T4')).body.data).toMatchObject({ created: 1 })
  })

  it('refuses a file of 1001 rows and a missing nama column', async () => {
    const rows = Array.from({ length: 1001 }, (_v, i) => `Murid ${String(i)},m${String(i)}.banyak@demo.test,`)
    seats(5000)
    const big = await post(SCHOOL_ADMIN, csv(rows), '', 'T4')
    expect(big.status).toBe(413)
    expect(big.body.error?.message).toBe('Fail melebihi 1000 baris.')
    const bad = await post(SCHOOL_ADMIN, 'email,kelas\nx@demo.test,\n', '', 'T4')
    expect(bad.status).toBe(422)
  })
})
