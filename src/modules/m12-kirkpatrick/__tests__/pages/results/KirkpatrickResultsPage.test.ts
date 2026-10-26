// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { DsChart } from '@/ds'

import KirkpatrickResultsPage from '../../../pages/KirkpatrickResultsPage.vue'
import { all, captions, flat, has, mountPage, rowOf, squash, t, tiles } from '../fixtures'
import { results, resultsNoCounts, resultsNoHistory } from './fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickResults: vi.fn() }))
vi.mock('../../../api', () => api)

let wrapper: VueWrapper | undefined

async function open(prefix = '/admin/kirkpatrick', query = '') {
  const m = await mountPage(
    KirkpatrickResultsPage,
    { basePath: prefix },
    `${prefix}/results${query}`,
    `${prefix}/results`,
  )
  wrapper = m.wrapper
  return m
}

beforeEach(() => {
  vi.clearAllMocks()
  setRouteOutcome(null)
  api.fetchKirkpatrickResults.mockResolvedValue(results())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S5 KPI cards (AC-M12-19.1 ... 19.3)', () => {
  it('shows the platform values and captions', async () => {
    const { wrapper: w } = await open()
    expect(tiles(w).map((x) => x.label)).toEqual([
      'GPS Headcount',
      'Kadar Lulus',
      'Pelajar Gred A',
      'Ketepatan Platform',
      'Pelajar Aktif',
      'Rekod Headcount',
    ])
    expect(tiles(w).map((x) => x.value)).toEqual([
      '4.30',
      '96.7%',
      '52',
      '82.8%',
      '946',
      '4378',
    ])
    expect(captions(w)).toEqual([
      '41 rekod · 2025',
      '174/180 calon',
      '28.9% daripada 180',
      '306,133 soalan',
      '22.8% daripada 4,158',
      'Data OTR',
    ])
  })

  it('shows the 8080 values (GPS with two decimals, "100%", "0% daripada 1")', async () => {
    api.fetchKirkpatrickResults.mockResolvedValue(
      results({
        kpi: {
          gps: 4,
          gpsYear: 2026,
          recordsLabel: 41,
          passPct: 100,
          pass: 1,
          candidates: 1,
          gradeA: 0,
          gradeAPct: 0,
          accuracy: 75.6,
          answers: 15007,
          active: 53,
          activePct: 28.8,
          t4t5: 184,
          records: 4378,
        },
      }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=8080')
    expect(api.fetchKirkpatrickResults).toHaveBeenCalledWith({ schoolId: 8080 }, expect.anything())
    expect(tiles(w).map((x) => x.value)).toEqual([
      '4.00',
      '100%',
      '0',
      '75.6%',
      '53',
      '4378',
    ])
    expect(captions(w)).toEqual([
      '41 rekod · 2026',
      '1/1 calon',
      '0% daripada 1',
      '15,007 soalan',
      '28.8% daripada 184',
      'Data OTR',
    ])
  })

  it('shows the no-history state of school 9167 ("-", "41 rekod" without the year, 0/0 calon)', async () => {
    api.fetchKirkpatrickResults.mockResolvedValue(resultsNoHistory())
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=9167')
    const values = tiles(w).map((x) => x.value)
    expect(values.slice(0, 3)).toEqual(['-', '0%', '0'])
    expect(values[4]).toBe('5')
    expect(captions(w)).toEqual([
      '41 rekod',
      '0/0 calon',
      '0% daripada 0',
      '545 soalan',
      '62.5% daripada 8',
      'Data OTR',
    ])
    expect(has(w, 'res-grades')).toBe(false)
    expect(t(w, 'roi-gps').text()).toBe('-')
    const insights = all(w, 'insight-row').map((r) => squash(r.text()))
    expect(insights).toHaveLength(2)
    expect(insights.join(' ')).not.toContain('GPS keseluruhan')
    expect(has(w, 'insight-disclaimer')).toBe(true)
  })

  it('school 8880 (D9): GPS and 150 candidates, "-" for Kadar Lulus and Gred A, no 0/0 calon, no distribution', async () => {
    api.fetchKirkpatrickResults.mockResolvedValue(resultsNoCounts())
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=8880')
    expect(
      tiles(w).map((x) => x.value)
        .slice(0, 3),
    ).toEqual(['2.88', '-', '-'])
    const lines = captions(w)
    expect(lines.slice(0, 3)).toEqual(['41 rekod · 2026', '150 calon', '150 calon'])
    expect(lines.join(' ')).not.toContain('0/0')
    expect(has(w, 'res-grades')).toBe(false)
  })

  it('KPI grid is 2 columns, 3 from md and the tab strip marks T4 active', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'res-kpis').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-3']),
    )
    expect(t(w, 'kirk-tab-results').attributes('data-active')).toBe('true')
  })
})

describe('S5 Taburan Gred (AC-M12-20.1)', () => {
  it('titles the card by year and charts the ten grades with the % in each label', async () => {
    const { wrapper: w } = await open()
    const card = t(w, 'res-grades')
    expect(squash(card.get('h2').text())).toBe('Taburan Gred (2025)')
    expect(card.text()).toContain('Berdasarkan 180 calon — sumber: Headcount OTR')
    const chart = card.getComponent(DsChart)
    const labels = chart.props('labels')
    expect(labels).toHaveLength(10)
    expect(labels[0]).toBe('A+ · 5.6%')
    expect(labels[1]).toBe('A · 10%')
    expect(labels[9]).toBe('G · 0.6%')
    expect(chart.props('horizontal')).toBe(true)
  })

  it('charts the counts as given (B+ and B are the largest)', async () => {
    const { wrapper: w } = await open()
    const data = t(w, 'res-grades').getComponent(DsChart).props('series')[0]!.data
    expect(data[0]).toBe(10)
    expect(data[3]).toBe(Math.max(...data))
    expect(data[4]).toBe(Math.max(...data))
  })

  it('shows "0%" and a zero count for a zero grade', async () => {
    api.fetchKirkpatrickResults.mockResolvedValue(
      results({
        distribution: {
          year: 2026,
          candidates: 1,
          rows: ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'].map((g) => ({
            grade: g as 'A+',
            n: g === 'B+' ? 1 : 0,
            pct: g === 'B+' ? 100 : 0,
          })),
        },
      }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=8080')
    const chart = t(w, 'res-grades').getComponent(DsChart)
    expect(chart.props('labels')[3]).toBe('B+ · 100%')
    expect(chart.props('labels')[0]).toBe('A+ · 0%')
    expect(chart.props('series')[0]!.data[0]).toBe(0)
  })
})

describe('S5 subject GPS and trend (AC-M12-21.1 ... 21.4)', () => {
  it('lists the subjects by GPS ascending with grade, candidates, arrow and previous GPS', async () => {
    const { wrapper: w } = await open()
    const card = t(w, 'res-subject-gps')
    expect(squash(card.get('h2').text())).toBe('GPS Mengikut Subjek (2026)')
    const rows = all(w, 'cell-subject').map(rowOf)
    expect(rows.map((r) => r.get('[data-testid="cell-subject"]').text())).toEqual([
      'Matematik',
      'Bahasa Melayu',
      'Bahasa Inggeris',
    ])
    expect(rows.map((r) => r.get('[data-testid="cell-gps"]').text())).toEqual([
      '2.50',
      '2.80',
      '3.20',
    ])
    expect(rows.map((r) => r.get('[data-testid="cell-grade"]').text())).toEqual(['A-', 'A-', 'B+'])
    expect(rows[0]?.get('[data-testid="cell-trend"]').text()).toBe('4.45')
    expect(rows[0]?.get('[data-testid="cell-trend"] span').classes()).toContain('text-success')
    expect(card.text()).toContain('GPS rendah = lebih baik. Trend: berbanding tahun sebelumnya.')
  })

  it('keeps the subject cell plain: no title, no link', async () => {
    const { wrapper: w } = await open()
    const cell = all(w, 'cell-subject')[0]!
    expect(cell.attributes('title')).toBeUndefined()
    expect(cell.find('a').exists()).toBe(false)
  })

  it('shows the trend table with colours, dimmed dashes and the legend', async () => {
    const { wrapper: w } = await open()
    const card = t(w, 'res-trend')
    expect(squash(card.get('h2').text())).toBe('Trend GPS (2022–2026)')
    expect(card.findAll('thead th').map((h) => h.text())).toEqual([
      'Subjek',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
      'Trend',
    ])
    const names = all(w, 'res-trend-row')
    expect(names[0]?.classes()).toContain('text-primary-t')
    expect(names[1]?.classes()).not.toContain('text-primary-t')
    const rows = names.map(rowOf)
    const cells = rows[0]!.findAll('[data-testid="res-trend-cell"]')
    expect(cells.map((c) => c.text())).toEqual(['5.20', '4.80', '4.50', '4.30', '-'])
    expect(cells[0]?.classes()).toContain('text-warning')
    expect(cells[4]?.classes()).toContain('text-dimmed')
    const bm = rows[1]!.findAll('[data-testid="res-trend-cell"]')
    expect(bm[3]?.text()).toBe('4.00')
    expect(bm[3]?.classes()).toContain('text-success')
    expect(rows[2]?.findAll('[data-testid="res-trend-cell"]')[4]?.classes()).toContain(
      'text-dimmed',
    )
    expect(flat(card)).toContain('= GPS menurun (improving). Sumber: Headcount OTR & SPM sebenar.')
  })

  it('both tables scroll inside their cards', async () => {
    const { wrapper: w } = await open()
    for (const id of [
      'res-subject-gps',
      'res-trend',
      'res-schools',
      'res-predictions',
      'res-alesa',
    ]) {
      expect(t(w, id).find('[data-ds="data-table"]').exists()).toBe(true)
    }
  })
})

describe('S5 school table (AC-M12-22.1)', () => {
  it('fades the inactive rows and prints "-" for Ketepatan, Soalan and (without a session) Engagement', async () => {
    const { wrapper: w } = await open()
    const links = all(w, 'res-school-link')
    const rows = links.map(rowOf)
    expect(rows).toHaveLength(4)
    expect(rows[0]?.get('[data-testid="res-school-link"]').attributes('href')).toBe(
      '/admin/monitoring/sekolah/9681',
    )
    expect(rows[0]?.get('[data-testid="cell-accuracy"]').classes()).toContain('text-success')
    expect(rows[1]?.get('[data-testid="cell-accuracy"]').classes()).toContain('text-warning')
    expect(links.map((r) => r.attributes('data-faded'))).toEqual(['false', 'false', 'true', 'true'])
    expect(links[2]?.classes()).toContain('text-dimmed')
    expect(rows[2]?.get('[data-testid="cell-accuracy"]').text()).toBe('-')
    expect(rows[2]?.get('[data-testid="cell-accuracy"]').classes()).toContain('text-dimmed')
    expect(rows[2]?.get('[data-testid="cell-answers"]').text()).toBe('-')
    expect(rows[2]?.get('[data-testid="cell-engagement"]').text()).toBe('2')
    expect(rows[3]?.get('[data-testid="cell-engagement"]').text()).toBe('-')
    expect(rows[3]?.get('[data-testid="cell-tahap"]').text()).toBe('Tidak Terlibat')
  })
})

describe('S5 prediction table (AC-M12-22.2, NFR-M12-01)', () => {
  it('renders the first 50 of the 946 rows with a pager (D9: one 946-row page is too heavy)', async () => {
    const { wrapper: w } = await open()
    expect(all(w, 'res-pred-row')).toHaveLength(50)
    expect(t(w, 'res-predictions').text()).toContain('Menunjukkan 1-50 daripada 946 hasil')
  })

  it('keeps the accuracy non-increasing and the first row at school 8090', async () => {
    const { wrapper: w } = await open()
    const accuracy = all(w, 'pred-accuracy').map((c) => Number.parseFloat(c.text()))
    for (let i = 1; i < accuracy.length; i++)
      expect(accuracy[i]).toBeLessThanOrEqual(accuracy[i - 1]!)
    expect(all(w, 'pred-school')[0]?.attributes('href')).toBe('/admin/monitoring/sekolah/8090')
  })

  it('links the student and the school to the monitoring pages of the mount', async () => {
    const { wrapper: w } = await open()
    expect(all(w, 'pred-student')[0]?.attributes('href')).toBe(
      '/admin/monitoring/sekolah/8090/pelajar/1000',
    )
    wrapper?.unmount()
    const guru = await open('/guru/kirkpatrick')
    expect(all(guru.wrapper, 'pred-school')[1]?.attributes('href')).toBe(
      '/guru/monitoring/sekolah/8080',
    )
  })

  it('navigates in-app from a row link', async () => {
    const { wrapper: w, router } = await open()
    const push = vi.spyOn(router, 'push')
    await all(w, 'pred-student')[2]!.trigger('click')
    expect(push).toHaveBeenCalledWith('/admin/monitoring/sekolah/8080/pelajar/1002')
  })

  it('colours the grade pill by band and shows the footnote', async () => {
    const { wrapper: w } = await open()
    const grades = all(w, 'pred-grade')
    expect(grades[0]?.text()).toBe('A+')
    expect(grades[0]?.classes()).toContain('text-success')
    for (const pill of grades) {
      const grade = pill.text()
      const token = grade.startsWith('A')
        ? 'text-success'
        : grade.startsWith('B')
          ? 'text-info'
          : grade === 'G'
            ? 'text-error'
            : 'text-warning'
      expect(pill.classes()).toContain(token)
    }
    expect(t(w, 'res-predictions').text()).toContain(
      'Ramalan ini berdasarkan ketepatan menjawab soalan dalam platform sahaja. Ramalan penuh memerlukan lebih banyak data termasuk keputusan peperiksaan terdahulu.',
    )
  })
})

describe('S5 ALESA (AC-M12-23.1 ... 23.4)', () => {
  it('shows a visible heading icon, the subtitle and the three tiles from the API', async () => {
    const { wrapper: w } = await open()
    const card = t(w, 'res-alesa')
    expect(card.find('[data-ds="icon-chip"]').exists()).toBe(true)
    expect(card.text()).toContain('Ramalan ALESA (Predictive Grade)')
    expect(card.text()).toContain(
      'Berdasarkan ketepatan, konsistensi, trend mingguan, dan jumlah latihan pelajar',
    )
    expect(all(w, 'tile-value').map((e) => e.text())).toEqual(['48', '2', '4'])
    expect(card.text()).toContain('Dijangka Lulus')
    expect(card.text()).toContain('Dijangka Gagal')
    expect(card.text()).toContain('Perlu Intervensi')
  })

  it('shows the rows with pills, Keyakinan and the Cadangan of the stored band', async () => {
    const { wrapper: w } = await open()
    const rows = all(w, 'alesa-row')
    expect(rows).toHaveLength(5)
    expect(all(w, 'alesa-grade').map((e) => e.text())).toEqual(['A+', 'A', 'B+', 'C', 'E'])
    expect(all(w, 'alesa-confidence').map((e) => e.text())).toEqual([
      'Rendah',
      'Sederhana',
      'Tinggi',
      'Rendah',
      'Rendah',
    ])
    expect(all(w, 'alesa-confidence')[1]?.classes()).toContain('text-warning')
    expect(all(w, 'alesa-confidence')[2]?.classes()).toContain('text-success')
    expect(all(w, 'alesa-cadangan').map((e) => squash(e.text()))).toEqual([
      'Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan.',
      'Teruskan konsistensi latihan. Fokus pada topik yang masih lemah untuk capai kecemerlangan.',
      'Tingkatkan latihan harian. Perlu tambah 20-30 soalan/minggu untuk naik ke gred A.',
      'Pelajar ini perlu meningkatkan jumlah latihan. Cadangan: minimum 10 soalan sehari.',
      'Pelajar memerlukan intervensi segera. Cadangan: bimbingan guru dan program pemulihan.',
    ])
  })

  it('shows the footer from the computed counts with the bold lead', async () => {
    const { wrapper: w } = await open()
    const footer = t(w, 'alesa-footer')
    expect(squash(footer.text())).toBe(
      '48 pelajar dijangka lulus, 4 pelajar perlu intervensi segera. Ramalan ini berdasarkan formula berwajaran: Ketepatan (40%), Konsistensi (20%), Trend (20%), Volume (20%).',
    )
    expect(footer.get('strong').text()).toBe('48 pelajar dijangka lulus')
  })

  it('takes the Cadangan text from the stored band, not the grade (8080 student B: grade C, D/E text)', async () => {
    const base = results()
    api.fetchKirkpatrickResults.mockResolvedValue(
      results({
        alesa: {
          ...base.alesa,
          rows: [{ ...base.alesa.rows[3]!, grade: 'C', cadanganBand: 'D/E' }],
        },
      }),
    )
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=8080')
    expect(all(w, 'alesa-grade')[0]?.text()).toBe('C')
    expect(squash(all(w, 'alesa-cadangan')[0]!.text())).toContain('intervensi segera')
  })
})

describe('S5 ROI and insights (AC-M12-24.1 ... 24.3)', () => {
  it('shows the four ROI figures and the warning note', async () => {
    const { wrapper: w } = await open()
    expect(t(w, 'roi-active').text()).toBe('946')
    expect(t(w, 'roi-per-student').text()).toBe('323.6')
    expect(t(w, 'roi-accuracy').text()).toBe('82.8%')
    expect(t(w, 'roi-gps').text()).toBe('4.30')
    const box = t(w, 'res-roi')
    expect(box.text()).toContain('ROI penuh akan dapat dikira apabila:')
    expect(box.findAll('ol li').map((l) => l.text())).toEqual([
      '1. Keputusan peperiksaan sebenar (SPM/dalaman) diimport',
      '2. Data kos langganan platform dimasukkan',
      '3. Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat',
    ])
  })

  it('prints a whole-number average per student without ".0" ("109")', async () => {
    api.fetchKirkpatrickResults.mockResolvedValue(resultsNoHistory())
    const { wrapper: w } = await open('/admin/kirkpatrick', '?school_id=9167')
    expect(t(w, 'roi-per-student').text()).toBe('109')
  })

  it('shows the three insight sentences (DV-M12-13 "(22.8%)") and the disclaimer', async () => {
    const { wrapper: w } = await open()
    expect(all(w, 'insight-row').map((r) => squash(r.text()))).toEqual([
      'Hanya 946 daripada 4158 pelajar T4/T5 (22.8%) menggunakan platform. Data perbandingan terhad kepada pelajar aktif sahaja.',
      'Purata ketepatan pelajar aktif dalam platform: 82.8%. Ini bersamaan anggaran gred A.',
      'GPS keseluruhan dari headcount (tahun 2025): 4.30. Trend menunjukkan peningkatan dari tahun ke tahun.',
    ])
    expect(squash(t(w, 'insight-disclaimer').text())).toBe(
      'Disclaimer: Data GPS Anggaran berdasarkan markah OTR headcount, bukan keputusan SPM sebenar.',
    )
  })
})

describe('S5 headings without data (BUG-08)', () => {
  it('omits the year and the range when the API sends year 0 and no years', async () => {
    api.fetchKirkpatrickResults.mockResolvedValue(
      results({ subjectGps: { year: 0, rows: [] }, trend: { years: [], rows: [] } }),
    )
    const { wrapper: w } = await open()
    expect(squash(t(w, 'res-subject-gps').get('h2').text())).toBe('GPS Mengikut Subjek')
    expect(squash(t(w, 'res-trend').get('h2').text())).toBe('Trend GPS')
  })

  it('keeps the year and the range when there is data', async () => {
    const { wrapper: w } = await open()
    expect(squash(t(w, 'res-subject-gps').get('h2').text())).toBe('GPS Mengikut Subjek (2026)')
    expect(squash(t(w, 'res-trend').get('h2').text())).toBe('Trend GPS (2022–2026)')
  })
})

describe('S5 states', () => {
  it('shows the error line when the request fails', async () => {
    api.fetchKirkpatrickResults.mockRejectedValue(new Error('boom'))
    const { wrapper: w } = await open()
    expect(has(w, 'kirk-error')).toBe(true)
    expect(has(w, 'res-kpis')).toBe(false)
  })

  it('renders the 403 page in place for a school administrator (API 403)', async () => {
    api.fetchKirkpatrickResults.mockRejectedValue(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'no' }),
    )
    await open('/guru/kirkpatrick')
    expect(useRouteOutcome().value).toBe(403)
  })
})
