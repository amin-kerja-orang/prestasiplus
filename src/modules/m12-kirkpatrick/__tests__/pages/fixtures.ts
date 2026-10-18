import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import USelect from '@nuxt/ui/components/Select.vue'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { FilterOptions, Learning, Overview, Reaction } from '../../api/types'

export const overview = (over: Partial<Overview> = {}): Overview => ({
  scope: { schoolId: null, state: null },
  t4: { gps: 4.3, gpsYear: 2025, recordsLabel: 4378 },
  t3: { active: 946, t4t5: 4158, sessions: 20991, accuracy: 82.8 },
  t2: { accuracy: 82.8, answers: 306133 },
  t1: { satisfaction: 4.6, responses: 336 },
  comparison: {
    subtitle: 'Januari 2026 vs September 2026',
    before: {
      month: '2026-01',
      from: '2026-01-01',
      to: '2026-01-31',
      active: 2,
      accuracy: 33.3,
      answers: 3,
      champions: 0,
    },
    after: {
      month: '2026-09',
      from: '2026-09-01',
      to: '2026-09-25',
      active: 58,
      accuracy: 87,
      answers: 13968,
      champions: 28,
    },
    delta: { active: 56, accuracy: 53.7, answers: 13965, champions: 28 },
    sentences: [
      'Peningkatan 53.7% dalam ketepatan jawapan.',
      '56 pelajar baru mula aktif.',
      'Jumlah jawapan meningkat 465500%.',
      '28 pelajar naik ke tahap Champion.',
    ],
  },
  kpi: { t4t5: 4158, answers: 306133, teachersLoggedIn: 277, teachers: 522, accuracy: 82.8 },
  bands: [
    { key: 'champion', count: 513, pct: 12.3 },
    { key: 'konsisten', count: 259, pct: 6.2 },
    { key: 'berkembang', count: 169, pct: 4.1 },
    { key: 'minimum', count: 5, pct: 0.1 },
    { key: 'tidakTerlibat', count: 3212, pct: 77.2 },
  ],
  ...over,
})

export const options: FilterOptions = {
  schools: [
    { id: 8080, name: 'SMK Demo Satu' },
    { id: 9167, name: 'SMK Demo Dua' },
  ],
  states: ['Johor', 'Kelantan'],
}

export const reaction: Reaction = {
  npsStudent: 8.4,
  npsTeacher: 6.5,
  npsAdmin: 9.6,
  satisfaction: 4.6,
}

export const learning = (over: Partial<Learning> = {}): Learning => ({
  kpi: {
    answers: 306133,
    accuracy: 82.8,
    avgScore: 80.3,
    sessionsCompleted: 20991,
    sessions: 20991,
    completionPct: 100,
  },
  subjects: [
    { subjectId: 1, name: 'Pendidikan Muzik', answers: 20, accuracy: 100, status: 'Mastered' },
    { subjectId: 2, name: 'Sejarah', answers: 57695, accuracy: 76.3, status: 'Developing' },
    { subjectId: 3, name: 'Biologi', answers: 30, accuracy: 33.3, status: 'Beginning' },
  ],
  schools: [
    {
      schoolId: 8880,
      name: 'SMK Demo A',
      students: 53,
      answers: 71408,
      accuracy: 89.9,
      avgScore: 84.7,
      subjects: 5,
    },
    {
      schoolId: 8080,
      name: 'SMK Demo B',
      students: 184,
      answers: 15007,
      accuracy: 55,
      avgScore: 73.3,
      subjects: 3,
    },
    {
      schoolId: 940,
      name: 'SMK Demo C',
      students: 1,
      answers: 0,
      accuracy: 0,
      avgScore: 0,
      subjects: 1,
    },
  ],
  ...over,
})

/** Mounts a page on a memory router (a catch-all route lets every RouterLink resolve). */
export async function mountPage(
  component: Component,
  props: Record<string, unknown>,
  url: string,
  path: string,
): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path, component: { template: '<div />' } },
      { path: '/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

export const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
export const all = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`)
export const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()
export const squash = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Visible text with a space between elements (Vue strips the whitespace between tags). */
export const flat = (w: { html: () => string }) =>
  squash(
    w
      .html()
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&'),
  )

/** The `USelect` with this `name` prop (a Reka select has no native `option` elements to query). */
export const select = (w: VueWrapper, name: string) => {
  const found = w
    .findAllComponents(USelect)
    .find((c) => (c.props() as Record<string, unknown>).name === name)
  if (!found) throw new Error(`no USelect named ${name}`)
  return found as unknown as {
    props: (key: string) => unknown
    vm: { $emit: (event: string, value: unknown) => void }
  }
}
/** Labels of a `USelect`'s items. */
export const itemLabels = (w: VueWrapper, name: string) =>
  (select(w, name).props('items') as { label: string }[]).map((i) => i.label)
/** Picks an item value of a `USelect`. */
export const pick = async (w: VueWrapper, name: string, value: string) => {
  select(w, name).vm.$emit('update:modelValue', value)
  await flushPromises()
}
/** The table row (or card item) that holds the element. */
export const rowOf = (el: { element: Element }) =>
  new DOMWrapper(el.element.closest('tr') ?? el.element.closest('li') ?? el.element)

/** Labels of the options of the native `<select>` with this `name` (`DsNativeSelect`). */
export const nativeLabels = (w: VueWrapper, name: string) =>
  w.findAll(`select[name="${name}"] option`).map((o) => o.text())
/** Picks a value of the native `<select>` with this `name`. */
export const nativePick = async (w: VueWrapper, name: string, value: string) => {
  await w.get(`select[name="${name}"]`).setValue(value)
  await flushPromises()
}
/** The "Reset" link of the filter chips row (`DsActiveFilters`, live label). */
export const resetLink = (w: VueWrapper) => w.find('[data-testid="active-filters-reset"]')

/** The `DsStatTile`s of a page: big number, label and the optional caption line. */
export const tiles = (w: VueWrapper) =>
  w.findAll('[data-ds="stat-tile"]').map((tile) => {
    const value = tile.get('.tabular')
    const sub = tile.find('[data-ds="stat-tile-sub"]')
    return {
      value: value.text(),
      label: value.element.nextElementSibling?.textContent?.trim() ?? '',
      sub: sub.exists() ? sub.text() : undefined,
    }
  })
/** The caption lines of the stat tiles that have one. */
export const captions = (w: VueWrapper) =>
  tiles(w).flatMap((x) => (x.sub === undefined ? [] : [x.sub]))
