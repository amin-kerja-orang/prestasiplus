import { describe, expect, it, vi } from 'vitest'

import type { RateLimiter } from '../../src/common/throttle'
import { ManagedUsersService, TEACHER_KIND, type PeopleCtx } from '../../src/modules/school-admin/people/managed-users.service'

/** DB-free: the password hash runs BEFORE the e-mail uniqueness check, and an e-mail change is charged to the create bucket. */
function build(emailTaken: boolean, current = 'old@x.test') {
  const order: string[] = []
  const hash = vi.fn(async () => {
    order.push('hash')
    return 'h'
  })
  const taken = vi.fn(async () => {
    order.push('taken')
    return emailTaken
  })
  const consume = vi.fn(() => {
    order.push('consume')
  })
  const user = { id: '5', email: current, isActive: true, isSuspended: false, schoolId: '1', roles: ['teacher'] }
  const svc = new ManagedUsersService(
    {} as never,
    { now: () => new Date() } as never,
    { emailTaken: taken, findVisible: async () => user } as never,
    { get: async () => ({ id: '1', name: 'S' }) } as never,
    { get: async () => null } as never,
    { hash } as never,
    {} as never,
    { consume } as unknown as RateLimiter,
  )
  const ctx = { actor: { schoolId: '1', userId: '9' }, caller: {} } as unknown as PeopleCtx
  return { svc, ctx, order, hash, taken, consume }
}

describe('ManagedUsersService e-mail enumeration mitigations', () => {
  it('create with a taken e-mail still hashes the generated password first, then answers 422', async () => {
    const { svc, ctx, order, hash } = build(true)
    await expect(svc.create(ctx, TEACHER_KIND, { value: { name: 'N', email: 'a@x.test', phone: null }, fields: {} }, null)).rejects.toMatchObject({})
    expect(hash).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['hash', 'taken'])
  })

  it('update with a password and a taken e-mail hashes before the check, and an e-mail change consumes the create bucket', async () => {
    const { svc, ctx, order, consume } = build(true)
    await expect(svc.update(ctx, TEACHER_KIND, '5', { name: 'N', email: 'new@x.test', newPassword: 'abcdefgh1', newPasswordConfirmation: 'abcdefgh1' })).rejects.toMatchObject({})
    expect(order).toEqual(['hash', 'consume', 'taken'])
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ bucket: 'school-admin.create' }), '9')
  })

  it('update that keeps the e-mail does not consume the create bucket', async () => {
    const { svc, ctx, consume } = build(false)
    await svc.update(ctx, TEACHER_KIND, '5', { name: 'N', email: 'OLD@x.test' }).catch(() => undefined)
    expect(consume).not.toHaveBeenCalled()
  })
})
