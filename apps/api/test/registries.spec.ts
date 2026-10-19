import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Controller, Get, Module } from '@nestjs/common'
import request from 'supertest'
import { describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../prisma/seed'
import { featureModules } from '../src/modules'
import { createTestApp } from './support/app'

@Controller('dummy')
class DummyController {
  @Get()
  get() {
    return { data: 'dummy' }
  }
}
@Module({ controllers: [DummyController] })
class DummyModule {}

describe('registries', () => {
  it('module registry exists', () => {
    expect(Array.isArray(featureModules)).toBe(true)
  })

  it('a module added to the list is mounted under /api', async () => {
    const app = await createTestApp({ modules: [DummyModule] })
    try {
      const res = await request(app.getHttpServer()).get('/api/dummy').expect(200)
      expect(res.body).toEqual({ data: 'dummy' })
    } finally {
      await app.close()
    }
  })

  it('seed registry runs the modules it is given in order', async () => {
    expect(Array.isArray(seedModules)).toBe(true)
    const calls: string[] = []
    const done = await runSeeds([
      { name: 'a', run: async () => void calls.push('a') },
      { name: 'b', run: async () => void calls.push('b') },
    ])
    expect(done).toEqual(['a', 'b'])
    expect(calls).toEqual(['a', 'b'])
  })

  it('.env.api.example has one commented block per lane PC-1 to PC-6; conformance README exists', () => {
    const env = readFileSync(
      fileURLToPath(new URL('../../../.env.api.example', import.meta.url)),
      'utf8',
    )
    for (let n = 1; n <= 6; n++) expect(env).toMatch(new RegExp(`^# =+ PC-${n}\\b`, 'm'))
    expect(existsSync(fileURLToPath(new URL('./conformance/README.md', import.meta.url)))).toBe(
      true,
    )
  })
})
