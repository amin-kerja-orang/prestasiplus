import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { ConfigService } from '@nestjs/config'
import { describe, expect, it } from 'vitest'

import { IcService } from '../../../src/modules/users/credentials'
import { IcHasher, decidePassword, parseDefaultHashes } from '../../../src/migration/transform/secrets'

describe('IC hashing', () => {
  it('matches IcService, so a migrated ic_hash equals the hash of the same IC typed in v2', () => {
    const env = { IC_HASH_KEY: 'a-test-key-of-sufficient-length', NODE_ENV: 'test' }
    const service = new IcService(new ConfigService(env))
    const hasher = new IcHasher(env)
    for (const raw of ['900101-14-5678', '900101 14 5678', '900101145678']) {
      expect(hasher.parts(raw)).toEqual(service.parts(raw))
    }
    expect(hasher.parts('12345')).toBeNull()
    expect(hasher.parts(null)).toBeNull()
  })

  it('requires IC_HASH_KEY in production and some key elsewhere', () => {
    expect(() => new IcHasher({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(40) })).toThrow(/IC_HASH_KEY/)
    expect(() => new IcHasher({ NODE_ENV: 'test' })).toThrow()
    expect(() => new IcHasher({ NODE_ENV: 'test', SESSION_SECRET: 'dev' })).not.toThrow()
  })
})

describe('password decisions', () => {
  const none = { defaultHashes: new Set<string>(), rosterAccount: false }
  const bcrypt = (cost: string) => `$2y$${cost}$${'a'.repeat(22)}${'b'.repeat(31)}`

  it('accepts bcrypt costs 4..13 only', () => {
    expect(decidePassword(bcrypt('10'), none)).toMatchObject({ passwordHash: bcrypt('10'), mustResetPassword: false })
    expect(decidePassword(bcrypt('14'), none)).toMatchObject({ passwordHash: null, mustResetPassword: true })
    expect(decidePassword(bcrypt('03'), none)).toMatchObject({ passwordHash: null, mustResetPassword: true })
  })

  it('never stores plaintext or a malformed hash', () => {
    for (const raw of ['', null, 'plain-text', '$2y$10$short', 'md5$abc']) {
      expect(decidePassword(raw, none)).toMatchObject({ passwordHash: null, mustResetPassword: true })
    }
  })

  it('parses the run-time list of shared default hashes', () => {
    expect([...parseDefaultHashes(' a,b\nc ,, ')]).toEqual(['a', 'b', 'c'])
    expect(parseDefaultHashes(undefined).size).toBe(0)
  })
})

describe('AC7: the reference repo roster files are never referenced', () => {
  it('has no roster seed path in apps/api/src/migration', () => {
    const root = fileURLToPath(new URL('../../../src/migration/', import.meta.url))
    const hits: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) walk(path)
        else if (/\.(ts|js|json|sql)$/.test(name) && /bbb_students|bbb_teachers|prestasiplus-reference|database[\\/]data[\\/]/i.test(readFileSync(path, 'utf8'))) hits.push(path)
      }
    }
    walk(root)
    expect(hits).toEqual([])
  })
})
