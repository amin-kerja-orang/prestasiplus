// @vitest-environment node
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// base.css sets h1-h6 colour (slate-800), which beats text-white inherited from a dark/gradient
// container. Headings on dark backgrounds must carry the light colour class themselves.
const root = resolve(__dirname, '../..')

function heading(file: string, text: string): string {
  const src = readFileSync(resolve(root, file), 'utf8')
  const at = src.lastIndexOf(text)
  expect(at, file).toBeGreaterThan(-1)
  const start = src.lastIndexOf('<h', at)
  return src.slice(start, at)
}

describe('headings on dark backgrounds carry their own light colour', () => {
  it.each([
    ['pages/PanduanPage.vue', 'Panduan Pengguna'],
    ['components/artikel/ArtikelShareCard.vue', 'ARTIKEL_COPY.shareTitle'],
  ])('%s', (file, text) => {
    expect(heading(file, text)).toMatch(/\btext-white\b/)
  })
})
