import { QUESTION_SET_AUDIO_KBAT_CSV_TEXT, QUESTION_SET_AUDIO_KBAT_TEMPLATE as TPL } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { crc32 } from '../../src/modules/classes/question-sets/docx'
import { ADMIN, STUDENT_1, TEACHER_A, bootQsApp, client, type Client, type QsTestApp } from './qs-helpers'

/** Reads a ZIP through its central directory (stored or deflated entries), checking each CRC. */
async function unzip(buf: Buffer): Promise<Map<string, string>> {
  const { inflateRawSync } = await import('node:zlib')
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]))
  expect(eocd).toBeGreaterThanOrEqual(0)
  const total = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const out = new Map<string, string>()
  for (let i = 0; i < total; i++) {
    expect(buf.readUInt32LE(at)).toBe(0x02014b50)
    const method = buf.readUInt16LE(at + 10)
    const crc = buf.readUInt32LE(at + 16)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.subarray(at + 46, at + 46 + nameLen).toString('utf8')
    expect(buf.readUInt32LE(local)).toBe(0x04034b50)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    const data = method === 0 ? raw : inflateRawSync(raw)
    expect(crc32(data)).toBe(crc)
    out.set(name, data.toString('utf8'))
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

describe('BE-18 B: Audio KBAT templates', () => {
  let t: QsTestApp
  let teacher: Client

  beforeAll(async () => {
    t = await bootQsApp()
    teacher = await client(t, TEACHER_A)
  })
  afterAll(async () => {
    await t.close()
  })

  const binary = (c: Client, path: string) =>
    c.who.agent.get(`/api${path}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = []
      res.on('data', (d: Buffer) => chunks.push(d))
      res.on('end', () => cb(null, Buffer.concat(chunks)))
    })

  it('CSV: exact bytes (BOM, headings, example row), content type and attachment name', async () => {
    const res = await binary(teacher, '/guru/audio-kbat/template')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('text/csv; charset=UTF-8')
    expect(res.headers['content-disposition']).toBe('attachment; filename="template-audio-kbat.csv"')
    expect(res.headers['cache-control']).toContain('no-store')
    const body = res.body as Buffer
    expect(body.equals(Buffer.from(QUESTION_SET_AUDIO_KBAT_CSV_TEXT, 'utf8'))).toBe(true)
    expect(body.subarray(0, 3)).toEqual(Buffer.from([0xef, 0xbb, 0xbf]))
    expect(body.toString('utf8')).toBe('﻿tajuk,kod_subjek,kod_tingkatan,nama_fail_audio\n"Contoh: KBAT Sains Bab 1",SCI,T4,kbat-sains-1.mp3\n')
  })

  it('Word: a valid .docx with the title, intro, table headings and the example row', async () => {
    const res = await binary(teacher, '/guru/audio-kbat/template-word')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe(TPL.word.contentType)
    expect(res.headers['content-disposition']).toBe('attachment; filename="template-audio-kbat.docx"')
    const files = await unzip(res.body as Buffer)
    expect([...files.keys()]).toEqual(['[Content_Types].xml', '_rels/.rels', 'word/document.xml'])
    expect(files.get('[Content_Types].xml')).toContain('wordprocessingml.document.main+xml')
    expect(files.get('_rels/.rels')).toContain('word/document.xml')
    const doc = files.get('word/document.xml') as string
    // well-formed enough: balanced table and one row per line
    expect(doc.match(/<w:tr>/g)).toHaveLength(2)
    expect(doc.match(/<w:tc>/g)).toHaveLength(8)
    const texts = [...doc.matchAll(/<w:t xml:space="preserve">([^<]*)<\/w:t>/g)].map((m) => (m[1] as string).replaceAll('&quot;', '"'))
    expect(texts).toEqual([TPL.word.title, TPL.word.intro, ...TPL.word.headings, ...TPL.word.example])
    // the heading row is bold, the example row is not
    expect(doc.match(/<w:b\/>/g)).toHaveLength(1 + 4)
  })

  it('an admin may download both', async () => {
    const admin = await client(t, ADMIN)
    expect((await binary(admin, '/guru/audio-kbat/template')).status).toBe(200)
    expect((await binary(admin, '/guru/audio-kbat/template-word')).status).toBe(200)
  })

  it('anonymous is 401 and a student is 403 on both routes', async () => {
    const student = await client(t, STUDENT_1)
    for (const path of ['/guru/audio-kbat/template', '/guru/audio-kbat/template-word']) {
      const anon = await t.http().get(`/api${path}`)
      expect(anon.status, path).toBe(401)
      expect(anon.body.error).toMatchObject({ code: 'UNAUTHORIZED', message: 'Unauthenticated.' })
      const res = await student.get(path)
      expect(res.status, path).toBe(403)
      expect(res.body.error).toMatchObject({ code: 'FORBIDDEN', message: 'This action is unauthorized.' })
    }
  })
})

describe('BE-18 B: template downloads rate limit (D57)', () => {
  let t: QsTestApp
  beforeAll(async () => {
    t = await bootQsApp({ env: { THROTTLE_CLASSES_READ_PER_MINUTE: '2' } })
  })
  afterAll(async () => {
    await t.close()
  })

  it('429 on the third read in a minute', async () => {
    const teacher = await client(t, TEACHER_A)
    expect((await teacher.get('/guru/audio-kbat/template')).status).toBe(200)
    expect((await teacher.get('/guru/audio-kbat/template-word')).status).toBe(200)
    const res = await teacher.get('/guru/audio-kbat/template')
    expect(res.status).toBe(429)
    expect(res.body.error.code).toBe('RATE_LIMITED')
  })
})
