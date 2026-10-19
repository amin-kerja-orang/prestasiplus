import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from './fixtures'
import { bootFilesApp, expectError, type FilesTestApp, loginAs, uploadOk } from './helpers'

describe('files survive a restart (AC 6)', () => {
  let first: FilesTestApp
  let second: FilesTestApp
  beforeAll(async () => {
    first = await bootFilesApp()
  })
  afterAll(async () => {
    await second?.close()
    await first.close()
  })

  it('a second app on the same database and FILE_STORAGE_DIR serves a file stored by the first', async () => {
    const me = await loginAs(first, 'pelajar@demo.test')
    const png = makePng({ width: 3, height: 3 })
    const ref = await uploadOk(me, 'avatar', png)
    const stored = (await me.agent.get(ref.url).buffer().parse((res, cb) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => cb(null, Buffer.concat(chunks)))
    })).body as Buffer

    await first.closeApp() // the "container restart"
    second = await bootFilesApp({}, { db: first.db, dir: first.dir })

    // The same session cookie is still valid (sessions live in the database) and the bytes are the same.
    const res = await second.http().get(ref.url).set('Cookie', `pp_session=${encodeURIComponent(me.token)}`).buffer().parse((r, cb) => {
      const chunks: Buffer[] = []
      r.on('data', (c: Buffer) => chunks.push(c))
      r.on('end', () => cb(null, Buffer.concat(chunks)))
    })
    expect(res.status).toBe(200)
    expect((res.body as Buffer).equals(stored)).toBe(true)
    // Someone else still cannot read it after the restart.
    const other = await loginAs(second, 'pelajar2@demo.test')
    expectError(await other.agent.get(ref.url), 'NOT_FOUND')
  })
})

/** The storage path must be the same in compose, the Dockerfile and the example env, or a volume would hide the files. */
describe('storage path guard (compose, Dockerfile, .env.api.example)', () => {
  const root = fileURLToPath(new URL('../../../../', import.meta.url))
  const read = (file: string): string => readFileSync(root + file, 'utf8').replace(/\r\n/g, '\n')

  it('uses one path everywhere and mounts the named volume apifiles on it', () => {
    const compose = read('compose.yaml')
    const mount = /^\s+- apifiles:(\/\S+)/m.exec(compose)?.[1]
    expect(mount, 'compose.yaml mounts apifiles on the api service').toBeTruthy()
    expect(/^volumes:\n(?:\s+\S+:\n)*\s+apifiles:/m.test(compose), 'apifiles is declared as a top-level volume').toBe(true)

    const docker = read('docker/api/Dockerfile')
    const envDir = /^ENV[^\n]*FILE_STORAGE_DIR=(\/\S+)/m.exec(docker)?.[1]
    const made = /mkdir -p (\/\S+)/.exec(docker)?.[1]
    expect(envDir).toBe(mount)
    // the folder is created and owned by node, so a fresh volume inherits that owner
    expect(made).toBe(mount)
    expect(docker).toMatch(new RegExp(`chown -R node:node ${posix.dirname(mount as string).replace(/\//g, '\\/')}`))

    const example = /^#?\s*FILE_STORAGE_DIR=(\/\S+)/m.exec(read('.env.api.example'))?.[1]
    expect(example).toBe(mount)
  })

  it('FILE_STORAGE_DIR is commented out in the example (required in production, not set by default)', () => {
    expect(read('.env.api.example')).not.toMatch(/^FILE_STORAGE_DIR=/m)
  })
})
