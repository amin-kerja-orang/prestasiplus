import { ConfigService } from '@nestjs/config'
import { SPM_WALKTHROUGH_SUBJECTS, SpmWalkthroughResponseSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CANNED_WALKTHROUGH, WALKTHROUGH_DELAY_MS } from '../../src/modules/spm/config'
import { WalkthroughService } from '../../src/modules/spm/walkthrough.service'
import { bootSpmApp, countRows, expectError, loginAgent, type SpmTestApp } from './helpers'

let t: SpmTestApp
let me: Awaited<ReturnType<typeof loginAgent>>

beforeAll(async () => {
  t = await bootSpmApp()
  me = await loginAgent(t, 'student')
}, 120_000)
afterAll(async () => {
  await t.close()
})

const URL = '/api/spm-walkthrough/solve'
const png = (bytes: number) => Buffer.alloc(bytes, 7)

interface Form {
  subject?: string
  text?: string
  image?: { data: Buffer; type: string; name?: string }
}
function solve(form: Form) {
  let r = me.agent.post(URL).set('X-CSRF-Token', me.csrf)
  if (form.subject !== undefined) r = r.field('subject', form.subject)
  if (form.text !== undefined) r = r.field('question_text', form.text)
  if (form.image) r = r.attach('image', form.image.data, { filename: form.image.name ?? 'soalan.png', contentType: form.image.type })
  return r
}

describe('AC13 walkthrough (M06-13)', () => {
  it('answers the canned text with the question echoed (Matematik, Sejarah, default)', async () => {
    const m = await solve({ subject: 'Matematik', text: 'Selesaikan 2x + 3 = 11' })
    expect(m.status).toBe(200)
    expect(SpmWalkthroughResponseSchema.parse(m.body)).toEqual({ ok: true, walkthrough: `Soalan: Selesaikan 2x + 3 = 11\n\n${CANNED_WALKTHROUGH.Matematik}` })
    expect((await solve({ subject: 'Sejarah', text: 'x' })).body.walkthrough).toBe(`Soalan: x\n\n${CANNED_WALKTHROUGH.Sejarah}`)
    const d = await solve({ subject: 'Fizik', text: 'y'.repeat(120) })
    expect(d.body.walkthrough).toBe(`Soalan: ${'y'.repeat(80)}\n\nLangkah 1: Baca soalan dengan teliti.\nLangkah 2: Kenal pasti konsep utama dalam buku teks.\nLangkah 3: Jawab mengikut format skema pemarkahan.`)
    // The text is trimmed before it is echoed.
    expect((await solve({ subject: 'Sejarah', text: '   isi   ' })).body.walkthrough).toMatch(/^Soalan: isi\n\n/)
  })

  it('every one of the 15 listed subjects is accepted', async () => {
    expect(SPM_WALKTHROUGH_SUBJECTS).toHaveLength(15)
    for (const subject of SPM_WALKTHROUGH_SUBJECTS) {
      const r = await solve({ subject, text: 'soalan' })
      expect(r.body.ok, subject).toBe(true)
    }
  })

  it('an image alone is enough: the echo says (gambar); with text the text is echoed', async () => {
    const r = await solve({ subject: 'Kimia', text: '', image: { data: png(10), type: 'image/png' } })
    expect(r.status).toBe(200)
    expect(r.body.ok).toBe(true)
    expect(r.body.walkthrough.startsWith('Soalan: (gambar)\n\n')).toBe(true)
    expect((await solve({ subject: 'Kimia', text: 'huraikan', image: { data: png(10), type: 'image/jpeg' } })).body.walkthrough).toMatch(/^Soalan: huraikan\n\n/)
    // An empty file part counts as no image.
    expect((await solve({ subject: 'Kimia', text: 'ada', image: { data: Buffer.alloc(0), type: 'image/png' } })).body.ok).toBe(true)
  })

  it('no text and no image is a business error: HTTP 200 { ok: false, error }', async () => {
    for (const form of [{ subject: 'Matematik', text: '   ' }, { subject: 'Matematik' }, { subject: 'Matematik', text: '', image: { data: Buffer.alloc(0), type: 'image/png' } }]) {
      const r = await solve(form)
      expect(r.status).toBe(200)
      expect(r.body).toEqual({ ok: false, error: 'Sila masukkan soalan atau muat naik gambar soalan.' })
    }
  })

  it('an image that is not image/* is HTTP 200 { ok: false, error: "Gambar tidak sah." }, even with text', async () => {
    const r = await solve({ subject: 'Matematik', text: 'x', image: { data: Buffer.from('%PDF-1.4'), type: 'application/pdf', name: 'a.pdf' } })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: false, error: 'Gambar tidak sah.' })
  })

  it('a 5 MB image is accepted; one byte more (and a much larger one) is 200 "Gambar tidak sah.", not 413', async () => {
    const five = 5 * 1024 * 1024
    expect((await solve({ subject: 'Matematik', text: 'x', image: { data: png(five), type: 'image/png' } })).body.ok).toBe(true)
    for (const size of [five + 1, five + 2 * 1024 * 1024]) {
      const r = await solve({ subject: 'Matematik', text: 'x', image: { data: png(size), type: 'image/png' } })
      expect(r.status, `size ${String(size)}`).toBe(200)
      expect(r.body).toEqual({ ok: false, error: 'Gambar tidak sah.' })
    }
  })

  it('an unlisted or empty subject is 422 fields.subject "Sila pilih subjek."', async () => {
    for (const form of [{ subject: '', text: 'x' }, { subject: 'Muzik', text: 'x' }, { text: 'x' }, { subject: 'matematik', text: 'x' }]) {
      const e = expectError(await solve(form), 'VALIDATION_ERROR')
      expect(e.fields?.subject).toBe('Sila pilih subjek.')
    }
  })

  it('also reads a JSON body; the answer is the raw body without a data envelope', async () => {
    const r = await me.agent.post(URL).set('X-CSRF-Token', me.csrf).send({ subject: 'Sejarah', question_text: 'json' })
    expect(r.status).toBe(200)
    expect(Object.keys(r.body).sort()).toEqual(['ok', 'walkthrough'])
  })

  it('stores nothing: no file row, no spm row', async () => {
    const before = [await countRows(t.db, 'files'), await countRows(t.db, 'spm_mock_exams')]
    await solve({ subject: 'Matematik', text: 'x', image: { data: png(2000), type: 'image/png' } })
    expect([await countRows(t.db, 'files'), await countRows(t.db, 'spm_mock_exams')]).toEqual(before)
  })
})

describe('AC13 the simulated delay is configurable', () => {
  const service = (env: string | undefined) => new WalkthroughService({ get: () => env } as unknown as ConfigService)

  it('the default is the mock\'s 1500 ms', () => {
    expect(WALKTHROUGH_DELAY_MS).toBe(1500)
  })

  it('SPM_WALKTHROUGH_DELAY_MS delays a success, but not a refusal', async () => {
    const slow = service('60')
    const started = Date.now()
    expect(await slow.solve({ subject: 'Sejarah', questionText: 'x' })).toMatchObject({ ok: true })
    expect(Date.now() - started).toBeGreaterThanOrEqual(50)
    const quick = Date.now()
    expect(await slow.solve({ subject: 'Sejarah', questionText: '' })).toMatchObject({ ok: false })
    expect(Date.now() - quick).toBeLessThan(50)
  })

  it('0 means no delay', async () => {
    const started = Date.now()
    await service('0').solve({ subject: 'Sejarah', questionText: 'x' })
    expect(Date.now() - started).toBeLessThan(50)
  })
})
