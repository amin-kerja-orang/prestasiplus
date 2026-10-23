import { afterEach, describe, expect, it, vi } from 'vitest'

import { api } from '@/api'

import { resetPassword } from '../../api/auth'
import type { ResetPasswordRequest } from '../../api/types'

const REQUEST: ResetPasswordRequest = {
  token: 'tok',
  email: 'pelajar@demo.test',
  password: 'BaruBaru1',
  passwordConfirmation: 'BaruBaru1',
}

const SESSION = {
  token: 'sess',
  expiresAt: '2099-01-01T00:00:00+08:00',
  user: { id: 2, role: 'student', landingPath: '/dashboard' },
}

const postSpy = vi.spyOn(api, 'post')

afterEach(() => {
  postSpy.mockReset()
})

describe('resetPassword() (M01 #4, SW8-07)', () => {
  it('reads the flash text from the contract body {data: Session, status}', async () => {
    postSpy.mockResolvedValue({ data: SESSION, status: 'Your password has been reset.' })
    const result = await resetPassword(REQUEST)
    expect(result.status).toBe('Your password has been reset.')
    expect(result.session).toMatchObject({ token: 'sess', user: { id: 2 } })
    expect(result.session).not.toHaveProperty('status')
    // `raw`: the client must not unwrap `data` and drop the sibling `status`.
    expect(postSpy).toHaveBeenCalledWith('/api/auth/password/reset', {
      body: REQUEST,
      raw: true,
    })
  })

  it('still reads the mock body {data: {...session, status}}', async () => {
    postSpy.mockResolvedValue({ data: { ...SESSION, status: 'Your password has been reset.' } })
    const result = await resetPassword(REQUEST)
    expect(result.status).toBe('Your password has been reset.')
    expect(result.session).toMatchObject({ token: 'sess' })
    expect(result.session).not.toHaveProperty('status')
  })
})
