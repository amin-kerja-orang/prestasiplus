import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import { ACCOUNT_REGISTER_PENDING_MESSAGE } from '@pp/contract'

import { isRegisterPending, REGISTER_PENDING_FALLBACK_MESSAGE, register } from '../../api/auth'
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

  it('falls back to the contract message when the server message is missing, blank or not a string', async () => {
    for (const message of [undefined, '', '   ', 7, null]) {
      postSpy.mockResolvedValue({ status: 'pending_verification', message })
      const result = await register({ ...REQUEST, role: 'teacher', schoolId: 1 })
      expect(result).toEqual({
        status: 'pending_verification',
        message: ACCOUNT_REGISTER_PENDING_MESSAGE,
      })
    }
  })

  it('the fallback text equals the contract constant', () => {
    expect(REGISTER_PENDING_FALLBACK_MESSAGE).toBe(ACCOUNT_REGISTER_PENDING_MESSAGE)
  })

  it('keeps a non-empty server message as is', async () => {
    postSpy.mockResolvedValue({ status: 'pending_verification', message: 'Teks pelayan.' })
    expect(await register({ ...REQUEST, role: 'teacher', schoolId: 1 })).toEqual({
      status: 'pending_verification',
      message: 'Teks pelayan.',
    })
  })

  it('never treats a null body as the pending notice', async () => {
    postSpy.mockResolvedValue(null)
    await expect(register(REQUEST)).rejects.toThrow()
  })
})

describe('isRegisterPending()', () => {
  it('is true only for an object whose status is pending_verification', () => {
    expect(isRegisterPending(PENDING)).toBe(true)
    expect(isRegisterPending({ status: 'pending_verification' })).toBe(true)
    expect(isRegisterPending(null)).toBe(false)
    expect(isRegisterPending(undefined)).toBe(false)
    expect(isRegisterPending('pending_verification')).toBe(false)
    expect(isRegisterPending({ status: 'other' })).toBe(false)
    expect(isRegisterPending(SESSION_PAYLOAD)).toBe(false)
  })
})
