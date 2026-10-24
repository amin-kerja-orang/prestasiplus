/**
 * M21-T1 endpoint #15 `POST /api/mohon-keluarga-angkat` (SRS M21 v1.2 §7, BR-M21-13, V-M21-03,
 * FR-M21-09, FR-M21-49): any signed-in role, the e-mail must resolve to a student, 422 `fields`.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { issueSession } from '@/mock/core-data'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { users } from '@/modules/m01-authentication/mock'

import { FOSTER_APPLICATION_MESSAGES as MSG } from '../../api/types'
import m21, { fosterApplications } from '../../mock'

const ADMIN = 1
const PELAJAR = 2

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m21],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

beforeEach(async () => {
  await runtime.reset()
})

interface Answer {
  status: number
  body: {
    data?: { id: number }
    error?: { fields?: Record<string, string> }
    errors?: Record<string, string>
    message?: string
  }
}

async function post(body: unknown, as: number | null): Promise<Answer> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) {
    headers.authorization = `Bearer ${issueSession(users.get(as) as never, false, Date.parse(CLOCK_ANCHOR_ISO)).token}`
  }
  const res: TransportResponse = await runtime.transport.request({
    method: 'POST',
    url: '/api/mohon-keluarga-angkat',
    headers,
    body,
  })
  return { status: res.status, body: res.body as Answer['body'] }
}

const studentEmail = (): string => users.get(PELAJAR)?.email ?? ''
const valid = () => ({
  studentEmail: studentEmail(),
  studentCategory: 'B40',
  familyIncomeRange: 'RM1,000 - RM2,500',
  reason: '• Pelajar yatim piatu yang tinggal bersama nenek.',
})

/** The `fields` map wherever the envelope puts it. */
const fieldsOf = (a: Answer): Record<string, string> =>
  a.body.error?.fields ?? a.body.errors ?? {}

describe('guards (FR-M21-07, FR-M21-09)', () => {
  it('answers 401 to a guest', async () => {
    expect((await post(valid(), null)).status).toBe(401)
  })

  it.each([ADMIN, PELAJAR])('accepts the signed-in user %i', async (as) => {
    expect((await post(valid(), as)).status).toBe(201)
  })
})

describe('happy path (BR-M21-13)', () => {
  it('creates a pending application with the viewer as applicant; the first runtime id is 4', async () => {
    const a = await post(valid(), PELAJAR)
    expect(a.status).toBe(201)
    expect(a.body.data).toEqual({ id: 4 })
    expect(fosterApplications.get(4)).toEqual({
      id: 4,
      studentId: PELAJAR,
      applicantUserId: PELAJAR,
      applicantRole: 'student',
      studentCategory: 'B40',
      familyIncomeRange: 'RM1,000 - RM2,500',
      reason: '• Pelajar yatim piatu yang tinggal bersama nenek.',
      status: 'pending',
      createdAt: '2026-09-25T15:40:00+08:00',
    })
    expect(fosterApplications.tabs()).toEqual({ pending: 1, approved: 0, matched: 0, rejected: 0 })
  })

  it('records the applicant role of an admin; income may be missing; no duplicate check', async () => {
    const body = { ...valid(), familyIncomeRange: '' }
    const first = await post(body, ADMIN)
    const second = await post(body, ADMIN)
    expect([first.status, second.status]).toEqual([201, 201])
    expect(second.body.data?.id).toBe(5)
    expect(fosterApplications.get(4)).toMatchObject({
      applicantRole: 'admin',
      familyIncomeRange: null,
    })
  })

  it('resolves the e-mail case-insensitively and trimmed; stores the reason as typed', async () => {
    const a = await post(
      { ...valid(), studentEmail: `  ${studentEmail().toUpperCase()} `, reason: '  teks  ' },
      PELAJAR,
    )
    expect(a.status).toBe(201)
    expect(fosterApplications.get(4)).toMatchObject({ studentId: PELAJAR, reason: '  teks  ' })
  })

  it('stores at most 5,000 characters of the reason (SEC-M21-07)', async () => {
    await post({ ...valid(), reason: 'a'.repeat(6000) }, PELAJAR)
    expect(fosterApplications.get(4)?.reason).toHaveLength(5000)
  })
})

describe('422 (V-M21-03)', () => {
  it('rejects an e-mail that is not a student (admin account) with the BM copy', async () => {
    const a = await post({ ...valid(), studentEmail: users.get(ADMIN)?.email }, PELAJAR)
    expect(a.status).toBe(422)
    expect(fieldsOf(a)).toEqual({ studentEmail: MSG.studentNotFound })
    expect(MSG.studentNotFound).toBe('Emel pelajar tidak dijumpai dalam PrestasiPlus.')
    expect(fosterApplications.count('Q-M21-APP-TABS')).toBe(0)
  })

  it('rejects an unknown e-mail', async () => {
    const a = await post({ ...valid(), studentEmail: 'tiada.siapa@demo.test' }, PELAJAR)
    expect(a.status).toBe(422)
    expect(fieldsOf(a).studentEmail).toBe(MSG.studentNotFound)
  })

  it('reports every missing required field', async () => {
    const a = await post({}, PELAJAR)
    expect(a.status).toBe(422)
    expect(fieldsOf(a)).toEqual({
      studentEmail: MSG.required,
      studentCategory: MSG.required,
      reason: MSG.required,
    })
  })

  it('rejects a malformed e-mail, a category outside the 5, an income outside the 4 and a blank reason', async () => {
    const a = await post(
      {
        studentEmail: 'bukan-emel',
        studentCategory: 'VIP',
        familyIncomeRange: 'RM9',
        reason: '   ',
      },
      PELAJAR,
    )
    expect(a.status).toBe(422)
    expect(fieldsOf(a)).toEqual({
      studentEmail: MSG.invalidEmail,
      studentCategory: MSG.invalidChoice,
      familyIncomeRange: MSG.invalidChoice,
      reason: MSG.required,
    })
  })

  it('rejects a whitespace-only reason alone with "Sila isi ruangan ini." and creates nothing', async () => {
    const a = await post({ ...valid(), reason: ' \t  ' }, PELAJAR)
    expect(a.status).toBe(422)
    expect(fieldsOf(a)).toEqual({ reason: 'Sila isi ruangan ini.' })
    expect(fosterApplications.count('Q-M21-APP-TABS')).toBe(0)
  })

  it('accepts all 5 categories and all 4 incomes', async () => {
    for (const studentCategory of ['B40', 'Asnaf', 'Yatim', 'OKU', 'Lain-lain']) {
      expect((await post({ ...valid(), studentCategory }, PELAJAR)).status).toBe(201)
    }
    for (const familyIncomeRange of [
      '< RM1,000',
      'RM1,000 - RM2,500',
      'RM2,500 - RM4,000',
      '> RM4,000',
    ]) {
      expect((await post({ ...valid(), familyIncomeRange }, PELAJAR)).status).toBe(201)
    }
  })
})
