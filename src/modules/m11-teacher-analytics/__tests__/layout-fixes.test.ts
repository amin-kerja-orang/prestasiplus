// @vitest-environment jsdom
/**
 * G5-M11 layout fixes (DV-M11-33): class and prop contracts, so a fit-at-320 fix cannot be lost by a later
 * edit. jsdom has no layout engine, so these assert the classes that carry the behaviour; the widths
 * (320 / 375 / 768 / 1280) were measured in a browser. Not covered, because not fixed in m11: the S2 KPI tile
 * labels and the S3 pill-row wrap (both need a design-system change).
 */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import type { ItemAnalysis, MonitoringOverview, SchoolDetail } from '../api/types'
import ItemTable from '../components/analisis-item/ItemTable.vue'
import AnalisisItemPage from '../pages/AnalisisItemPage.vue'
import LaporanPage from '../pages/LaporanPage.vue'
import MonitoringPage from '../pages/MonitoringPage.vue'
import MonitoringSchoolPage from '../pages/MonitoringSchoolPage.vue'
import analisisItemRoutes from '../routes/analisis-item'
import laporanRoutes from '../routes/laporan'
import { emptyReport } from './laporan/fixtures'

const api = vi.hoisted(() => ({
  fetchMonitoringOverview: vi.fn(),
  fetchSchoolDetail: vi.fn(),
  fetchTeacherReport: vi.fn(),
  fetchItemAnalysis: vi.fn(),
}))
vi.mock('../api', () => api)

const OVERVIEW: MonitoringOverview = {
  filters: { period: '', state: '', tahap: '' },
  kpi: {
    schools: 57,
    students: 4158,
    engaged: 1462,
    engagementPct: 16.7,
    answers: 472371,
    avgPerStudent: 323.1,
    teachers: 522,
    teachersLoggedIn: 277,
    teacherPct: 53.1,
  },
  studentRows: [],
  teacherRows: [],
  weeks: [],
  weekly: [],
  signals: { best: [], attention: [], suggestions: [] },
}

const SCHOOL: SchoolDetail = {
  school: { id: 8080, name: 'SMK Contoh', code: 'KOD1', state: 'Selangor' },
  subscription: null,
  warning: null,
  tahap: 'Cemerlang',
  pct: 50,
  cards: { students: 1, engaged: 1, answers: 3, teachers: 1, teachersLoggedIn: 1 },
  flags: { review: 0, excluded: 0 },
  students: [
    {
      id: 1,
      name: 'Ali Demo',
      email: 'ali.panjang.sekali@example.test',
      level: 'T4',
      answers: 3,
      status: 'aktif',
      engaged: true,
      flag: null,
      lastLoginAt: '2026-06-16T14:11:00+08:00',
      lastActivityAt: '2026-06-16T14:19:00+08:00',
    },
  ],
  teachers: [
    {
      id: 9,
      name: 'Guru Demo',
      email: 'guru.panjang.sekali@example.test',
      loggedIn: true,
      lastLoginAt: '2026-06-16T14:11:00+08:00',
      createdAt: '2026-01-01T00:00:00+08:00',
    },
  ],
}

let wrapper: VueWrapper | undefined

async function mountPage(
  component: Component,
  path: string,
  routes: RouteRecordRaw[] = [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  props: Record<string, unknown> = {},
) {
  const router = createRouter({ history: createMemoryHistory(), routes })
  await router.push(path)
  await router.isReady()
  wrapper = mount(component, { props, global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

/** The real route fragment (its `meta.header` is the subtitle source), with a stub component. */
const withStub = (fragment: RouteRecordRaw[]): RouteRecordRaw[] =>
  fragment.map((r) => ({ path: r.path, meta: r.meta, component: { template: '<div />' } }))

const hasAll = (el: { classes: () => string[] }, ...cls: string[]) =>
  cls.every((c) => el.classes().includes(c))

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchMonitoringOverview.mockResolvedValue(OVERVIEW)
  api.fetchSchoolDetail.mockResolvedValue(SCHOOL)
  api.fetchTeacherReport.mockResolvedValue(emptyReport())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
})

describe('S2 section tabs show the full label (bug 1)', () => {
  it('the list scrolls sideways, triggers do not shrink, labels do not truncate', async () => {
    const w = await mountPage(MonitoringPage, '/guru/monitoring', undefined, {
      basePath: '/guru/monitoring',
    })
    const tabs = w.get('[data-testid="mon-tabs"]')
    expect(hasAll(tabs.get('[role="tablist"]'), 'overflow-x-auto')).toBe(true)
    const triggers = tabs.findAll('[role="tab"]')
    expect(triggers).toHaveLength(5)
    for (const trigger of triggers) expect(hasAll(trigger, 'shrink-0')).toBe(true)
    const labels = tabs.findAll('[role="tab"] [data-slot="label"]')
    expect(labels).toHaveLength(5)
    expect(labels.map((l) => l.text())).toContain('Sekolah Cemerlang / Perhatian Segera')
    for (const label of labels) {
      expect(hasAll(label, 'whitespace-nowrap', 'text-ellipsis')).toBe(true)
      expect(label.classes()).not.toContain('truncate')
    }
  })
})

describe('S6 question column is capped (bug 3)', () => {
  const rows: ItemAnalysis['rows'] = [
    {
      questionId: 1,
      textPlain: 'Soalan panjang '.repeat(5),
      subjectName: 'Kimia',
      attempts: 8,
      pct: 55,
      band: 'sederhana',
      discrimination: 0.4,
    },
  ]

  it('the question cell wraps inside a max width instead of growing to its text', () => {
    const w = mount(ItemTable, { props: { rows } })
    const cell = w.get('[data-testid="item-row"]')
    expect(
      hasAll(cell, 'max-w-48', 'min-w-32', 'whitespace-normal', 'break-words', 'xl:max-w-72'),
    ).toBe(true)
    expect(cell.classes()).not.toContain('min-w-48')
    w.unmount()
  })
})

describe('S1 and S6 render the route-meta subtitle (bug 8)', () => {
  it('S1 shows "Pantau penglibatan dan prestasi pelajar"', async () => {
    const w = await mountPage(LaporanPage, '/guru/laporan', withStub(laporanRoutes))
    const header = w.get('[data-ds="page-header"]')
    expect(header.text()).toContain(laporanRoutes[0]!.meta!.header!.subtitle)
    expect(header.text()).toContain('Pantau penglibatan dan prestasi pelajar')
  })

  it('S6 shows "Kenal pasti soalan yang sukar dan indeks diskriminasi"', async () => {
    api.fetchItemAnalysis.mockResolvedValue({
      options: { subjects: [], classes: [] },
      rows: [],
    } satisfies ItemAnalysis)
    const w = await mountPage(AnalisisItemPage, '/guru/analisis-item', withStub(analisisItemRoutes))
    const header = w.get('[data-ds="page-header"]')
    expect(header.text()).toContain(analisisItemRoutes[0]!.meta!.header!.subtitle)
    expect(header.text()).toContain('Kenal pasti soalan yang sukar dan indeks diskriminasi')
  })
})

describe('S3 e-mail wraps instead of truncating (bug 10)', () => {
  it('the e-mail breaks (break-all) in the pupil and teacher cards and table cells', async () => {
    const w = await mountPage(MonitoringSchoolPage, '/guru/monitoring/sekolah/8080', undefined, {
      schoolId: 8080,
    })
    const emails = w
      .findAll('span')
      .filter((s) => s.text().endsWith('@example.test') && s.element.children.length === 0)
    expect(emails.length).toBeGreaterThanOrEqual(2)
    for (const e of emails) {
      expect(e.classes()).toContain('break-all')
      expect(e.classes()).not.toContain('truncate')
    }
  })
})
