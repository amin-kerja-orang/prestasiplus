import { afterAll, describe, expect, it } from 'vitest'

import { loadStaging, SyntheticDumpRefusedError } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { scratch, writeDump } from './helpers'
import { writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/** M2: a dump marked anonymised or synthetic (known dummy password) is refused when NODE_ENV is production. */
const work = scratch()
afterAll(() => work.cleanup())
const pool = { connect: () => Promise.reject(new Error('must not connect')), query: () => Promise.reject(new Error('must not query')) } as never

function dumpWith(name: string, flag: 'anonymised' | 'synthetic' | null): string {
  const dir = work.out(name)
  writeDump(dir, { schools: [{ id: 1 }] })
  if (flag) {
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as Record<string, unknown>
    m[flag] = true
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify(m))
  }
  return dir
}

describe('staging:load refuses anonymised and synthetic dumps in production', () => {
  for (const flag of ['anonymised', 'synthetic'] as const) {
    for (const env of ['production', 'PRODUCTION', ' Prod ', 'prod']) {
      it(`${flag} manifest, NODE_ENV="${env}"`, async () => {
        const reader = new DirReader(dumpWith(`${flag}-${env.trim()}`, flag))
        await expect(loadStaging(pool, reader, { env: { NODE_ENV: env, PP_ALLOW_STAGING_RESET: '1' } })).rejects.toThrow(SyntheticDumpRefusedError)
      })
    }
  }

  it('an unmarked dump is not refused by this check (the reset guard still applies)', async () => {
    const reader = new DirReader(dumpWith('plain', null))
    await expect(loadStaging(pool, reader, { env: { NODE_ENV: 'production' } })).rejects.not.toThrow(SyntheticDumpRefusedError)
  })

  it('a marked dump passes this check outside production', async () => {
    const reader = new DirReader(dumpWith('marked-test', 'anonymised'))
    await expect(loadStaging(pool, reader, { env: { NODE_ENV: 'test' } })).rejects.not.toThrow(SyntheticDumpRefusedError)
  })
})
