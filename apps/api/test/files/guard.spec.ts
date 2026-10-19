import 'reflect-metadata'

import type { ExecutionContext } from '@nestjs/common'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { AUTH_CONTEXT_KEY } from '../../src/common/scope/auth-context'
import { UploadGuard } from '../../src/modules/files/files.controller'
import type { UploadThrottle } from '../../src/modules/files/upload-throttle'

/** A request whose stream members fail the test if the guard touches them. */
function requestWith(query: Record<string, unknown>, role: string) {
  const stream = {
    on: vi.fn(),
    once: vi.fn(),
    pipe: vi.fn(),
    read: vi.fn(),
    resume: vi.fn(),
    pause: vi.fn(),
    unpipe: vi.fn(),
    [Symbol.asyncIterator]: vi.fn(),
  }
  const req = {
    ...stream,
    query,
    [AUTH_CONTEXT_KEY]: { userId: '7', active: { role } },
  }
  return { req, stream }
}

function contextOf(req: unknown): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext
}

function guardWith() {
  const hit = vi.fn()
  return { guard: new UploadGuard({ hit } as unknown as UploadThrottle), hit }
}

describe('UploadGuard (runs before the body is read)', () => {
  it.each([['wallpaper'], [''], [undefined], [['avatar', 'avatar']], [{ toString: 'x' }], ['intake_page'], ['AVATAR']])(
    'refuses the purpose %j with 422 fields.purpose and never reads the request stream',
    (purpose) => {
      const { guard, hit } = guardWith()
      const { req, stream } = requestWith({ purpose }, 'student')
      let thrown: unknown
      try {
        guard.canActivate(contextOf(req))
      } catch (err) {
        thrown = err
      }
      expect(thrown).toBeInstanceOf(ApiError)
      const e = thrown as ApiError
      expect(e.getStatus()).toBe(422)
      expect(e.code).toBe('VALIDATION_ERROR')
      expect(e.fields).toEqual({ purpose: 'The selected purpose is invalid.' })
      for (const [name, fn] of Object.entries(stream)) expect(fn, name).not.toHaveBeenCalled()
      expect(hit).toHaveBeenCalledWith('7') // the attempt still counts against the rate limit
    },
  )

  it('refuses a role that may not upload the purpose with 403, still without reading the stream', () => {
    const { guard } = guardWith()
    const { req, stream } = requestWith({ purpose: 'cms_image' }, 'student')
    expect(() => guard.canActivate(contextOf(req))).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }) as Error)
    for (const [name, fn] of Object.entries(stream)) expect(fn, name).not.toHaveBeenCalled()
  })

  it('lets an allowed role through', () => {
    const { guard } = guardWith()
    expect(guard.canActivate(contextOf(requestWith({ purpose: 'avatar' }, 'student').req))).toBe(true)
    expect(guard.canActivate(contextOf(requestWith({ purpose: 'cms_image' }, 'admin').req))).toBe(true)
  })

  it('has no session context: 401 before anything else', () => {
    const { guard, hit } = guardWith()
    expect(() => guard.canActivate(contextOf({ query: { purpose: 'avatar' } }))).toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED' }) as Error,
    )
    expect(hit).not.toHaveBeenCalled()
  })
})
