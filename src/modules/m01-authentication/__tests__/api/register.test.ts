import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import { register } from '../../api/auth'
import type { RegisterRequest } from '../../api/types'

const REQUEST: RegisterRequest = {
  name: 'Murid Baru',
  email: 'baru@demo.test',
  phone: null,
  role: 'student',
  grade: 3,
  icNumber: null,
  schoolId: null,
  password: 'rahsia1',
  passwordConfirmation: 'rahsia1',
  referralCode: null,
}

const PENDING = {
  status: 'pending_verification',
  message:
    'Pendaftaran diterima. Akaun guru anda akan diaktifkan selepas disahkan oleh pentadbir sekolah.',
} as const

const SESSION_PAYLOAD = {
  token: 'tok',
  expiresAt: '2099-01-01T00:00:00+08:00',
  user: { id: 9000001, role: 'student', landingPath: '/dashboard' },
}

const postSpy = vi.spyOn(api, 'post')

afterEach(() => {
  postSpy.mockReset()
})

describe('register() (M01 #2, AM2-N1)', () => {
  it('resolves to the pending notice for a 201 pending_verification, with no session shape', async () => {
    postSpy.mockResolvedValue(PENDING)
    const result = await register({ ...REQUEST, role: 'teacher', schoolId: 1 })
    expect(result).toEqual(PENDING)
    expect(result).not.toHaveProperty('token')
    expect(result).not.toHaveProperty('user')
  })

  it('resolves to a not-remembered client session otherwise (student, parent)', async () => {
    postSpy.mockResolvedValue(SESSION_PAYLOAD)
    const result = await register(REQUEST)
    expect(result).toMatchObject({ token: 'tok', remember: false, user: { id: 9000001 } })
    expect(result).not.toHaveProperty('status')
  })
})
