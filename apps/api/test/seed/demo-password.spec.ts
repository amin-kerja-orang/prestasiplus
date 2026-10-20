import { hash, verify } from '@node-rs/argon2'
import { describe, expect, it } from 'vitest'

import { DEMO_HASH_ENV, DEMO_PASSWORD, resolveDemoPasswordHash } from '../../prisma/seed/core/demo-password'

describe('demo password hash (SEED_DEMO_PASSWORD_HASH)', () => {
  it('hashes the published dev password when the variable is unset or blank', async () => {
    for (const env of [{}, { [DEMO_HASH_ENV]: '' }, { [DEMO_HASH_ENV]: '   ' }]) {
      const h = await resolveDemoPasswordHash(env)
      expect(h.startsWith('$argon2id$')).toBe(true)
      expect(await verify(h, DEMO_PASSWORD)).toBe(true)
    }
  })

  it('returns a valid argon2id PHC string from the environment as it is', async () => {
    const custom = await hash('a-different-staging-secret', { memoryCost: 19_456, timeCost: 2, parallelism: 1 })
    expect(await resolveDemoPasswordHash({ [DEMO_HASH_ENV]: custom })).toBe(custom)
    expect(await verify(custom, DEMO_PASSWORD)).toBe(false)
  })

  it('throws on an invalid value without echoing it', async () => {
    for (const bad of ['Demo1234', 'plaintext-secret-value', '$2b$10$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz0123', '$argon2i$v=19$m=1,t=1,p=1$c2FsdA$aGFzaA']) {
      const err = await resolveDemoPasswordHash({ [DEMO_HASH_ENV]: bad }).then(
        () => null,
        (e: unknown) => e as Error,
      )
      expect(err).toBeInstanceOf(Error)
      expect(err?.message).toContain(DEMO_HASH_ENV)
      expect(err?.message).not.toContain(bad)
    }
  })
})
