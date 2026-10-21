import { afterEach, describe, expect, it, vi } from 'vitest'

import { queueIdOf, sameId, wireId, wireIds } from '../../api/wire'
import { isHost, canAct } from '../../components/lobby/room-lib'
import type { RoomView } from '../../api'

afterEach(() => vi.unstubAllEnvs())

describe('m16 http-mode ids', () => {
  it('mock mode leaves ids and bodies untouched', () => {
    const body = { subject_id: 3 }
    expect(wireIds(body, ['subject_id'])).toBe(body)
    expect(wireId(3)).toBe(3)
    expect(queueIdOf('12')).toBeNull()
    expect(queueIdOf(12)).toBe(12)
  })

  it('http mode sends ids as strings and reads a string queue id', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    expect(wireIds({ subject_id: 3, other: 1 }, ['subject_id'])).toEqual({ subject_id: '3', other: 1 })
    expect(wireIds({ mixed: [1, 2] }, ['mixed'])).toEqual({ mixed: ['1', '2'] })
    expect(queueIdOf('42')).toBe(42)
    expect(queueIdOf('x')).toBeNull()
  })

  it('compares a numeric session id with a string wire id', () => {
    expect(sameId('7', 7)).toBe(true)
    expect(sameId(null, 7)).toBe(false)
    const room = { host: { id: '7' }, state: { humanId: '7' } } as unknown as RoomView
    expect(isHost(room, 7)).toBe(true)
    expect(canAct(room, 7)).toBe(true)
    expect(canAct(room, null)).toBe(false)
  })
})
