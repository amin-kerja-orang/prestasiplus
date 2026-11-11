// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { BehaviorSchoolRow, InterventionRow, ResultsSchoolRow } from '../../api/types'
import BehaviorSchoolTable from '../../components/kirkpatrick/behavior/BehaviorSchoolTable.vue'
import { kirkpatrickPaths } from '../../components/kirkpatrick/common/kirkpatrick-paths'
import InterventionList from '../../components/kirkpatrick/interventions/InterventionList.vue'
import LearningSchools from '../../components/kirkpatrick/learning/LearningSchools.vue'
import ResultsPredictions from '../../components/kirkpatrick/results/ResultsPredictions.vue'
import ResultsSchools from '../../components/kirkpatrick/results/ResultsSchools.vue'
import ResultsTrend from '../../components/kirkpatrick/results/ResultsTrend.vue'
import { learning, mountPage } from '../pages/fixtures'
import { behavior } from '../pages/behavior/fixtures'
import { results } from '../pages/results/fixtures'

/**
 * C-62: below 768px DsDataTable draws a card list from the `card` slot or the card fields, never the cell
 * slots of the table. Every m12 table keeps its links, status and trend content (same testids) in the card.
 */
const paths = kirkpatrickPaths('/admin/kirkpatrick')
const schoolPath = paths.monitoringSchool

let original: typeof window.matchMedia | undefined
let wrapper: VueWrapper | undefined

beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/unbound-method -- saved and restored as is, never called here
  original = window.matchMedia
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  })
})
afterEach(() => {
  if (original) window.matchMedia = original
  wrapper?.unmount()
  wrapper = undefined
})

async function open(component: object, props: Record<string, unknown>, role?: string) {
  const m = await mountPage(component, props, '/admin/kirkpatrick/x', '/admin/kirkpatrick/x', null, role)
  wrapper = m.wrapper
  return m.wrapper
}

const cards = (w: VueWrapper) => w.findAll('[data-ds="data-table-cards"] > li')
const ids = (li: { findAll: (s: string) => unknown[] }, id: string) =>
  li.findAll(`[data-testid="${id}"]`) as { text: () => string; attributes: (n?: string) => unknown }[]

describe('C-62 m12 tables in card mode (below 768px)', () => {
  it('S3 LearningSchools: the card keeps the school link and the accuracy colour', async () => {
    const w = await open(LearningSchools, { schools: learning().schools, paths })
    expect(w.find('tbody').exists()).toBe(false)
    const li = cards(w)
    expect(li).toHaveLength(3)
    const link = ids(li[0]!, 'kirk-school-link')
    expect(link).toHaveLength(1)
    expect(link[0]!.attributes('href')).toBe('/admin/monitoring/sekolah/8880')
    expect(link[0]!.text()).toBe('SMK Demo A')
    const accuracy = ids(li[1]!, 'kirk-school-accuracy')
    expect(accuracy).toHaveLength(1)
    expect(accuracy[0]!.text()).toBe('55%')
  })

  it('S4 BehaviorSchoolTable: link, code and every cell-* testid sit in the card', async () => {
    const rows: BehaviorSchoolRow[] = behavior().schools
    const w = await open(BehaviorSchoolTable, { rows, schoolPath })
    const li = cards(w)
    expect(li).toHaveLength(3)
    const first = li[0]!
    expect(ids(first, 'beh-school-link')[0]!.attributes('href')).toBe('/admin/monitoring/sekolah/9681')
    expect(ids(first, 'beh-school-code')[0]!.text()).toBe('DEMO001')
    for (const id of [
      'cell-students',
      'cell-active',
      'cell-answers',
      'cell-sessions',
      'cell-per-active',
      'cell-score',
      'cell-tahap',
    ]) {
      expect(ids(first, id), id).toHaveLength(1)
    }
    expect(ids(first, 'cell-tahap')[0]!.text()).toBe('Champion')
    expect(ids(li[2]!, 'cell-active')[0]!.text()).toBe('0')
  })

  it('S5 ResultsSchools: link (with data-faded), accuracy, engagement and tahap sit in the card', async () => {
    const rows: ResultsSchoolRow[] = results().schools
    const w = await open(ResultsSchools, { rows, schoolPath })
    const li = cards(w)
    expect(li).toHaveLength(4)
    expect(ids(li[0]!, 'res-school-link')[0]!.attributes('href')).toBe('/admin/monitoring/sekolah/9681')
    expect(ids(li[0]!, 'res-school-link')[0]!.attributes('data-faded')).toBe('false')
    expect(ids(li[2]!, 'res-school-link')[0]!.attributes('data-faded')).toBe('true')
    expect(ids(li[2]!, 'cell-accuracy')[0]!.text()).toBe('-')
    expect(ids(li[2]!, 'cell-answers')[0]!.text()).toBe('-')
    expect(ids(li[0]!, 'cell-active')).toHaveLength(1)
    expect(ids(li[0]!, 'cell-engagement')).toHaveLength(1)
    expect(ids(li[0]!, 'cell-tahap')[0]!.text()).toBe('Champion')
  })

  it('S5 ResultsPredictions: student and school links, accuracy and grade sit in the card', async () => {
    const rows = results().predictions.slice(0, 3)
    const w = await open(ResultsPredictions, { rows, schoolPath })
    const li = cards(w)
    expect(li).toHaveLength(3)
    const student = ids(li[0]!, 'pred-student')
    expect(student).toHaveLength(1)
    expect(student[0]!.attributes('href')).toBe('/admin/monitoring/sekolah/8090/pelajar/1000')
    expect(ids(li[0]!, 'pred-school')[0]!.attributes('href')).toBe('/admin/monitoring/sekolah/8090')
    expect(ids(li[1]!, 'pred-student')[0]!.attributes('href')).toBe('/admin/monitoring/sekolah/8080/pelajar/1001')
    expect(ids(li[0]!, 'pred-accuracy')).toHaveLength(1)
    expect(ids(li[0]!, 'pred-grade')[0]!.text()).toBe('A+')
  })

  it('S5 ResultsTrend: the card keeps the subject row marker and a coloured cell per year', async () => {
    const w = await open(ResultsTrend, { trend: results().trend })
    const li = cards(w)
    expect(li).toHaveLength(3)
    expect(ids(li[0]!, 'res-trend-row')[0]!.text()).toBe('Keseluruhan')
    const cells = ids(li[0]!, 'res-trend-cell')
    expect(cells.map((c) => c.text())).toEqual(['5.20', '4.80', '4.50', '4.30', '-'])
    expect(li[0]!.findAll('dt').map((d) => d.text())).toEqual(['2022', '2023', '2024', '2025', '2026'])
    // BR-M12-20: a missing year is dimmed, a value above 4.00 is warning, at or below it success.
    expect((cells[0] as unknown as { classes: () => string[] }).classes()).toContain('text-warning')
    expect((cells[4] as unknown as { classes: () => string[] }).classes()).toContain('text-dimmed')
    const second = ids(li[1]!, 'res-trend-cell') as unknown as { classes: () => string[] }[]
    expect(second[3]!.classes()).toContain('text-success')
  })

  it('S7 InterventionList: student, before/after, status badge and review sit in the card', async () => {
    const row: InterventionRow = {
      id: 1,
      studentId: 4664,
      alertType: 'inactive',
      actionDate: '2026-09-25',
      alertDescription: 'Tidak aktif',
      actionTaken: 'Hubungi guru kelas',
      beforeAccuracy: 40,
      afterAccuracy: null,
      beforeMood: null,
      afterMood: null,
      createdBy: 1,
      createdAt: '2026-09-25T15:40:00+08:00',
      updatedAt: '2026-09-25T15:40:00+08:00',
      status: 'Menunggu Semakan',
      studentName: 'Pelajar Demo 004664',
    }
    const w = await open(InterventionList, { rows: [row] }, 'admin')
    const li = cards(w)
    expect(li).toHaveLength(1)
    expect(ids(li[0]!, 'int-row-student')[0]!.text()).toContain('4664')
    expect(ids(li[0]!, 'int-row-before')).toHaveLength(1)
    expect(ids(li[0]!, 'int-row-after')).toHaveLength(1)
    expect(ids(li[0]!, 'int-row-status')[0]!.text()).toBe('Menunggu Semakan')
    expect(ids(li[0]!, 'int-row-review')).toHaveLength(1)
  })
})
