import { BijakBuilderEditorSchema, BijakBuilderPaperCreateResultSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FakeBank, matBank } from './fakes'
import { ACCOUNTS, bootBuilderApp, loginAs, type BuilderTestApp, type Client } from './helpers'
import { serveSeededBlueprints } from '../support/serve-blueprints'

/**
 * D9 (R1 smoke): a paper created without a title is named "Percubaan SPM {subjek} Kertas {n} (draf)". The " (draf)" is a wrong label once the
 * paper is Terbit and a pupil reads it. Terbit drops it from that exact default title only; every other title is the admin's and stays as typed.
 */
const Editor = envelopeOf(BijakBuilderEditorSchema)
const Created = envelopeOf(BijakBuilderPaperCreateResultSchema)
const FULL = { A: ['700001', '700002', '700003'], B: ['700004'], C: ['700005', '700006'] }

describe('Terbit drops "(draf)" from the auto title only (D9)', () => {
  let t: BuilderTestApp
  let bank: FakeBank
  let admin: Client
  let student: Client

  beforeAll(async () => {
    bank = matBank()
    t = await bootBuilderApp({ builderSource: bank, papersSource: bank, pool: 'builder-source' })
    await serveSeededBlueprints(t.db)
    admin = await loginAs(t, ACCOUNTS.admin)
    student = await loginAs(t, ACCOUNTS.student)
  })
  afterAll(async () => {
    await t.close()
  })

  async function terbit(body: Record<string, unknown> = {}, kertas = 2): Promise<{ id: string; draftTitle: string }> {
    const made = await admin.post('/api/admin/papers', { subject: 'MAT', kertas, ...body })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const id = Created.parse(made.body).data.id
    const [sa, sb, sc] = Editor.parse((await admin.get(`/api/admin/papers/${id}`)).body).data.paper.sections
    const put = await admin.put(`/api/admin/papers/${id}`, {
      sections: [
        { id: sa!.id, questionIds: FULL.A },
        { id: sb!.id, questionIds: FULL.B },
        { id: sc!.id, questionIds: FULL.C },
      ],
    })
    expect(put.status, JSON.stringify(put.body)).toBe(200)
    const draftTitle = Editor.parse(put.body).data.paper.title
    const res = await admin.post(`/api/admin/papers/${id}/publish`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toMatchObject({ ok: true })
    return { id, draftTitle }
  }
  const dbTitle = async (id: string) => (await t.db.query<{ title: string }>('select title from papers where id = $1', [id]))[0]!.title
  const pupilTitle = async (id: string) => ((await student.get('/api/bijak/papers')).body.data as { id: string; title: string }[]).find((p) => p.id === id)?.title

  it('(a) the auto default title loses " (draf)" at Terbit', async () => {
    const { id, draftTitle } = await terbit()
    expect(draftTitle).toMatch(/^Percubaan SPM .+ Kertas 2 \(draf\)$/)
    expect(await dbTitle(id)).toBe(draftTitle.slice(0, -' (draf)'.length))
    expect(await dbTitle(id)).not.toContain('(draf)')
  })

  it('(b) a custom title is unchanged', async () => {
    const { id } = await terbit({ title: 'Set Ujian Pertengahan' })
    expect(await dbTitle(id)).toBe('Set Ujian Pertengahan')
  })

  it('(c) a custom title that ends in "(draf)", or equals the default of ANOTHER kertas, is unchanged', async () => {
    const own = await terbit({ title: 'Set Pantas (draf)' })
    expect(await dbTitle(own.id)).toBe('Set Pantas (draf)')
    const sameShape = await terbit({ title: 'Percubaan SPM Matematik Kertas 2 Set B (draf)' })
    expect(await dbTitle(sameShape.id)).toBe('Percubaan SPM Matematik Kertas 2 Set B (draf)')
    // the default text of kertas 1, typed by hand on a kertas 2 paper, is not this paper's default
    const other = await terbit({ title: 'Percubaan SPM Matematik Kertas 1 (draf)' })
    expect(await dbTitle(other.id)).toBe('Percubaan SPM Matematik Kertas 1 (draf)')
  })

  it('(d) the pupil list shows the clean title of an auto-titled paper and the typed title of a custom one', async () => {
    const auto = await terbit()
    expect(await pupilTitle(auto.id)).toBe(auto.draftTitle.slice(0, -' (draf)'.length))
    const custom = await terbit({ title: 'Set Akhir (draf)' })
    expect(await pupilTitle(custom.id)).toBe('Set Akhir (draf)')
    const cover = (await student.get(`/api/bijak/papers/${auto.id}`)).body.data as { title: string }
    expect(cover.title).not.toContain('(draf)')
  })
})
