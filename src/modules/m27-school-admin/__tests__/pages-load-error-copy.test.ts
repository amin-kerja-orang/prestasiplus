import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const PAGES = [
  'KelasSekolahPage',
  'LaporanAktivitiPage',
  'AmaranSekolahPage',
  'StatistikPenggunaanPage',
  'SchoolDashboardPage',
  'DskpHeatmapPage',
  'LaporanBulananPage',
]

describe('M27 pages: a failed load shows the BM default of DsLoadError (SWE-01)', () => {
  it.each(PAGES)('%s passes no server text to DsLoadError', (name) => {
    const source = readFileSync(join(__dirname, '../pages', `${name}.vue`), 'utf8')
    expect(source).toContain('<DsLoadError')
    expect(source).not.toMatch(/:message="error\.message"/)
    // the 403 handling stays: a refused load renders the global 403 page, not this box
    expect(source).toContain('error && !refused')
  })
})
