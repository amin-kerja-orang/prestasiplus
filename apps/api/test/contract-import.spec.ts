import { LoginRequestSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

describe('@pp/contract import', () => {
  it('parses a valid LoginRequest and rejects an unknown extra key', () => {
    const ok = LoginRequestSchema.safeParse({ identifier: 'a@b.my', password: 'x', remember: true })
    expect(ok.success).toBe(true)
    const bad = LoginRequestSchema.safeParse({
      identifier: 'a@b.my',
      password: 'x',
      remember: true,
      role: 'admin',
    })
    expect(bad.success).toBe(false)
  })
})
