/**
 * Inline media of a V2 stimulus body (feature slug `etl-stimulus-inline-img`): the pure rules that turn `<img src="/storage/stimuli/..">` and a raw
 * `<table>` into pieces a V3 stimulus can show (a picture stimulus, a `table_data` grid, a passage). Synthetic bodies only.
 */
import { describe, expect, it } from 'vitest'

import { hasInlineMedia, planInlineMedia, type MediaPlan } from '../../../src/migration/load/questions/stimulus-html'

const UUID = '0b5f2f3c-9d1e-4c0a-8a43-5d2f6a1c7e90'
const UUID2 = '7c1f2f3c-9d1e-4c0a-8a43-5d2f6a1c7e91'
const img = (file: string, uuid = UUID, extra = ''): string => `<img src="/storage/stimuli/${uuid}/${file}"${extra}>`
const plan = (ms: string | null, o: { en?: string | null; kind?: string; hasAsset?: boolean } = {}): MediaPlan | null =>
  planInlineMedia({ kind: o.kind ?? 'passage', ms, en: o.en ?? null, hasAsset: o.hasAsset ?? false })
const okPlan = (p: MediaPlan | null): Extract<MediaPlan, { ok: true }> => {
  if (p === null || !p.ok) throw new Error(`expected a plan, got ${JSON.stringify(p)}`)
  return p
}

describe('hasInlineMedia', () => {
  it('is true for an image under /storage/stimuli/ or a table, false for plain text', () => {
    expect(hasInlineMedia(img('a.png'))).toBe(true)
    expect(hasInlineMedia('<table><tr><td>1</td></tr></table>')).toBe(true)
    expect(hasInlineMedia('Petikan biasa <b>tebal</b>.')).toBe(false)
    expect(hasInlineMedia(null)).toBe(false)
  })
})

describe('planInlineMedia', () => {
  it('a plain text body needs nothing', () => {
    expect(plan('Petikan biasa.')).toBeNull()
    expect(plan(null)).toBeNull()
  })

  it('image only: the row becomes a picture stimulus with no body', () => {
    const p = okPlan(plan(img('rajah 1.png', UUID, ' alt="Rajah 1"')))
    expect(p.extras).toEqual([])
    expect(p.primary).toMatchObject({ kind: 'image', bodyMs: null, bodyEn: null, tableData: null, altText: 'Rajah 1', image: { path: `stimuli/${UUID}/rajah 1.png`, index: 0 } })
  })

  it('keeps the V2 picture kind (diagram, graph, map, infographic) and turns a passage or table kind into image', () => {
    expect(okPlan(plan(img('a.png'), { kind: 'diagram' })).primary.kind).toBe('diagram')
    expect(okPlan(plan(img('a.png'), { kind: 'table' })).primary.kind).toBe('image')
    expect(okPlan(plan(img('a.png'), { kind: 'passage' })).primary.kind).toBe('image')
  })

  it('decodes a percent-encoded file name', () => {
    const p = okPlan(plan(`<img src="/storage/stimuli/${UUID}/rajah%201.png">`))
    expect(p.primary.image?.path).toBe(`stimuli/${UUID}/rajah 1.png`)
  })

  it('image and text: the picture keeps the row, the text becomes a passage stimulus after it', () => {
    const p = okPlan(plan(`<p>Perhatikan rajah berikut.</p>${img('a.png')}`))
    expect(p.primary).toMatchObject({ kind: 'image', bodyMs: null, image: { path: `stimuli/${UUID}/a.png`, index: 0 } })
    expect(p.extras).toEqual([expect.objectContaining({ kind: 'passage', bodyMs: 'Perhatikan rajah berikut.', image: null })])
  })

  it('two images: the first keeps the row, the second is an image stimulus of its own (index 1)', () => {
    const p = okPlan(plan(`${img('a.png')}<br>${img('b.png', UUID2)}`))
    expect(p.primary.image).toEqual({ path: `stimuli/${UUID}/a.png`, index: 0 })
    expect(p.extras).toHaveLength(1)
    expect(p.extras[0]).toMatchObject({ kind: 'image', bodyMs: null, image: { path: `stimuli/${UUID2}/b.png`, index: 1 } })
  })

  it('a table becomes a { head, rows } grid of a table stimulus and leaves no markup', () => {
    const p = okPlan(plan('<table><thead><tr><th>Tahun</th><th>Peristiwa</th></tr></thead><tbody><tr><td>1957</td><td>Merdeka &amp; <b>Kemerdekaan</b></td></tr><tr><td>1963</td><td>Malaysia</td></tr></tbody></table>'))
    expect(p.primary).toMatchObject({ kind: 'table', bodyMs: null, image: null, tableData: { head: ['Tahun', 'Peristiwa'], rows: [['1957', 'Merdeka & Kemerdekaan'], ['1963', 'Malaysia']] } })
    expect(p.extras).toEqual([])
  })

  it('a table with a header row of td cells uses the first row as the head and pads short rows', () => {
    const p = okPlan(plan('<table><tr><td>A</td><td>B</td></tr><tr><td>1</td></tr></table>'))
    expect(p.primary.tableData).toEqual({ head: ['A', 'B'], rows: [['1', '']] })
  })

  it('text around a table becomes a passage stimulus; the table keeps the row', () => {
    const p = okPlan(plan('Jadual 1<table><tr><th>A</th></tr><tr><td>1</td></tr></table>'))
    expect(p.primary.kind).toBe('table')
    expect(p.extras).toEqual([expect.objectContaining({ kind: 'passage', bodyMs: 'Jadual 1' })])
  })

  it('a row that already has a picture (media asset) keeps it: its text stays and the inline media become extras', () => {
    const p = okPlan(plan(`Teks.${img('a.png')}`, { kind: 'diagram', hasAsset: true }))
    expect(p.primary).toMatchObject({ kind: 'diagram', bodyMs: 'Teks.', image: null })
    expect(p.extras).toEqual([expect.objectContaining({ kind: 'image', image: { path: `stimuli/${UUID}/a.png`, index: 0 } })])
  })

  it('the English column follows the Malay layout; a different layout is refused as bilingual', () => {
    const both = okPlan(plan(`Soalan ${img('a.png')}`, { en: `Question ${img('a.png')}` }))
    expect(both.extras).toEqual([expect.objectContaining({ kind: 'passage', bodyMs: 'Soalan', bodyEn: 'Question' })])
    expect(plan(`Soalan ${img('a.png')}`, { en: `Question ${img('b.png')}` })).toEqual({ ok: false, cause: 'bilingual' })
    expect(plan(img('a.png'), { en: 'Only English text' })).toEqual({ ok: false, cause: 'bilingual' })
  })

  it('an image of English column only is planned from that column', () => {
    const p = okPlan(plan(null, { en: img('a.png') }))
    expect(p.primary.image?.path).toBe(`stimuli/${UUID}/a.png`)
  })

  it('refuses what it cannot represent, with a fixed cause', () => {
    expect(plan('<img src="https://example.org/x.png">')).toEqual({ ok: false, cause: 'other_img' })
    expect(plan(`<img src="/storage/stimuli/${UUID}/%E0%A4%A.png">`)).toEqual({ ok: false, cause: 'path' })
    expect(plan('<table><tr><th>A</th></tr></table>')).toEqual({ ok: false, cause: 'table' })
    expect(plan(`<table><tr><td>${img('a.png')}</td></tr><tr><td>x</td></tr></table>`)).toEqual({ ok: false, cause: 'table' })
    expect(plan(`<table><tr><td>A</td></tr><tr><td>1</td></tr>`)).toEqual({ ok: false, cause: 'markup' })
  })
})
