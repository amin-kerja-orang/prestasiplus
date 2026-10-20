import { IntakePageListEnvelopeSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { IntakeFiguresService } from '../../../src/modules/intake/files'
import { scanPdf } from '../pdf-fixtures'
import { binary, bootIntakeApp, createBatch, type IntakeTestApp, loginAs, type LoggedIn, uploadOk } from '../helpers'

let t: IntakeTestApp
let teacher: LoggedIn
let fileId: string
let pageId: string
let batchId: string

beforeAll(async () => {
  t = await bootIntakeApp()
  teacher = await loginAs(t, 'guru@demo.test')
  const b = await createBatch(teacher)
  batchId = b.id
  fileId = (await uploadOk(teacher, b.id, [{ bytes: scanPdf(1, 116, 112) }])).files[0]!.id
  await t.drain()
  pageId = (await t.db.query<{ id: string }>(`select id::text from intake_pages where intake_file_id = $1`, [fileId]))[0]!.id
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('figure crops (BE-38 hook)', () => {
  it('a crop job stores the crop and lists it on the page; the same box is the same figure', async () => {
    const svc = t.app.get(IntakeFiguresService)
    const box = { x: 0.1, y: 0.2, w: 0.5, h: 0.3 }
    expect(await svc.enqueueCrop(pageId, box, 'Rajah graf garis')).toBe(true)
    expect(await svc.enqueueCrop(pageId, box)).toBe(true) // same key: still one job
    expect(await t.db.query(`select 1 from jobs where type = 'intake.crop_figure'`)).toHaveLength(1)
    await t.drain()
    const list = IntakePageListEnvelopeSchema.parse((await teacher.agent.get(`/api/intake/files/${fileId}/pages`)).body).data
    expect(list.pages[0]!.figures).toHaveLength(1)
    expect(list.pages[0]!.figures[0]).toMatchObject({ bbox: box, altTextSuggestion: 'Rajah graf garis' })
    const figureId = list.pages[0]!.figures[0]!.id
    const img = await teacher.agent.get(`/api/intake/figures/${figureId}/image`).buffer().parse(binary)
    expect(img.status).toBe(200)
    expect(img.headers['content-type']).toBe('image/png')
    const { loadImage } = await import('@napi-rs/canvas')
    const decoded = await loadImage(img.body as Buffer)
    const page = list.pages[0]!
    expect(decoded.width).toBe(Math.round(0.5 * page.width!))
    expect(decoded.height).toBe(Math.round(0.3 * page.height!))

    const again = await svc.crop(pageId, box)
    expect(again?.figureId).toBe(figureId)
    expect(await t.db.query(`select 1 from intake_figures`)).toHaveLength(1)
  })

  it('refuses an empty or malformed box and an unknown page, and does nothing for a cancelled batch', async () => {
    const svc = t.app.get(IntakeFiguresService)
    await expect(svc.crop(pageId, { x: 0, y: 0, w: 0, h: 0.5 })).rejects.toMatchObject({ code: 'INVALID_BBOX', retryable: false })
    await expect(svc.crop(pageId, { x: 2, y: 0, w: 1, h: 1 })).rejects.toMatchObject({ code: 'INVALID_BBOX' })
    await expect(svc.crop('987654321', { x: 0, y: 0, w: 1, h: 1 })).rejects.toMatchObject({ code: 'PAGE_NOT_FOUND' })
    expect(await svc.enqueueCrop('987654321', { x: 0, y: 0, w: 1, h: 1 })).toBe(false)
    await t.db.query(`update intake_batches set status = 'cancelled' where id = $1`, [batchId])
    expect(await svc.crop(pageId, { x: 0.3, y: 0.3, w: 0.2, h: 0.2 })).toBeNull()
    expect(await t.db.query(`select 1 from intake_figures`)).toHaveLength(1)
  })
})
