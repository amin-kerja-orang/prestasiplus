// @vitest-environment jsdom
/* eslint-disable vue/one-component-per-file -- inline stub components for vi.mock / router stubs; one file by design */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, type Component, type PropType } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { QuizRunner, type QuizApi, type StartSessionRequest } from '@/modules/m05-practice'

import type { TrackingAHub, TrackingASubject, SubjektifOverview } from '../../api'
import SubjektifPage from '../../pages/SubjektifPage.vue'
import TrackingACodePage from '../../pages/TrackingACodePage.vue'
import TrackingAHubPage from '../../pages/TrackingAHubPage.vue'

const api = vi.hoisted(() => ({
  fetchTrackingAHub: vi.fn(),
  fetchTrackingASubject: vi.fn(),
  fetchSubjektif: vi.fn(),
}))
vi.mock('../../api', () => api)

const m05 = vi.hoisted(() => ({ startSession: vi.fn() }))
vi.mock('@/modules/m05-practice', async () => {
  const { defineComponent, h } = await import('vue')
  return {
    subjectGlyph: () => 'i-ph-books-duotone',
    subjectAccent: () => 'action',
    QuizRunner: defineComponent({
      props: {
        start: { type: Object as PropType<StartSessionRequest>, default: null },
        api: { type: Object as PropType<QuizApi>, default: undefined },
        backUrl: { type: String, default: '' },
        report: { type: Object, default: null },
        retry: { type: String, default: '' },
      },
      setup(props) {
        props.api?.start(props.start).catch(() => undefined)
        return () => h('div', { 'data-testid': 'runner' })
      },
    }),
    startSession: m05.startSession,
    checkAnswer: vi.fn(),
    submitSession: vi.fn(),
  }
})
const Runner = QuizRunner as unknown as Component

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string): Promise<VueWrapper> {
  const Stub = defineComponent({ setup: () => () => h('div') })
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/ramalan/:code', component: TrackingACodePage },
      { path: '/:rest(.*)*', component: Stub },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const texts = (w: VueWrapper, id: string) => w.findAll(`[data-testid="${id}"]`).map((e) => e.text())

beforeEach(() => {
  for (const f of [...Object.values(api), m05.startSession]) f.mockReset()
  outcome.setRouteOutcome.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

const tile = (code: string, name: string, over: Record<string, unknown> = {}) => ({
  code,
  name,
  targetSize: 40,
  bersih: 0,
  bankBesar: 0,
  locked: 0,
  total: 0,
  readiness: 0,
  lockedSets: [],
  hasBankBesar: false,
  ...over,
})

const hub = (readiness: TrackingAHub['readiness']): TrackingAHub => ({
  objectiveLane: { subjects: 3, sets: 18, questions: 747 },
  bahasaLane: { subjects: 2, sets: 1332 },
  readiness,
  bahasa: [
    { subjectId: 1, code: 'BM', name: 'Bahasa Melayu', nameEn: 'Malay Language', sets: 559 },
    { subjectId: 2, code: 'BI', name: 'Bahasa Inggeris', nameEn: 'English Language', sets: 773 },
  ],
  openSubjects: [
    {
      subjectId: 12,
      code: 'GEO',
      name: 'Geografi',
      nameEn: 'Geography',
      icon: null,
      color: '#16a34a',
      readyQuestions: 40,
      bankBesarSets: 1,
      bersihSets: 0,
      targetType: 'spm',
      targetSize: 40,
      bankSource: 67,
      startableSets: 1,
    },
    {
      subjectId: 21,
      code: 'AKAUN',
      name: 'Prinsip Perakaunan',
      nameEn: 'Principles of Accounting',
      icon: null,
      color: '#0ea5e9',
      readyQuestions: 640,
      bankBesarSets: 0,
      bersihSets: 16,
      targetType: null,
      targetSize: null,
      bankSource: null,
      startableSets: 16,
    },
    {
      subjectId: 30,
      code: 'PSI',
      name: 'Pendidikan Syariah Islamiah',
      nameEn: 'Islamic Syariah Education',
      icon: null,
      color: '#7c3aed',
      readyQuestions: 40,
      bankBesarSets: 0,
      bersihSets: 1,
      targetType: 'latihan',
      targetSize: 40,
      bankSource: null,
      startableSets: 1,
    },
  ],
})

describe('S5 TrackingAHubPage', () => {
  it('renders the header, lanes, bahasa section and open cards for a student (no readiness)', async () => {
    api.fetchTrackingAHub.mockResolvedValue(hub(null))
    const w = await render(TrackingAHubPage, '/spm/ramalan')
    expect(t(w, 'spm-heading').text()).toBe('Tracking A SPM')
    expect(t(w, 'tracking-pill').text()).toBe('TRACKING A')
    expect(t(w, 'spm-sub').text()).toBe(
      'Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!',
    )
    expect(t(w, 'spm-back').attributes('href')).toBe('/spm')
    expect(t(w, 'lane-objektif').text()).toContain('3 subjek')
    expect(t(w, 'lane-objektif').text()).toContain('18 set')
    expect(t(w, 'lane-objektif').text()).toContain('747 soalan')
    expect(t(w, 'lane-bahasa').text()).toContain('1,332 set')
    expect(t(w, 'lane-bahasa').text()).toContain('Penjejakan berasaskan kertas')
    expect(w.find('[data-testid=readiness]').exists()).toBe(false)

    const bm = t(w, 'bahasa-card-BM')
    expect(bm.attributes('href')).toBe('/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa')
    expect(bm.text()).toContain('559 set')
    expect(bm.text()).toContain('Buka Tracking A Bahasa')
    expect(t(w, 'bahasa-card-BI').attributes('href')).toContain('subject_id=2')

    const geo = t(w, 'open-card-GEO')
    expect(geo.attributes('href')).toBe('/spm/ramalan/GEO')
    expect(geo.findAll('[data-testid=open-chips] > span').map((c) => c.text())).toEqual([
      '40 soalan kuiz siap guna',
      '1 bank besar',
      'Target SPM: 40',
      'Bank source: 67',
      '1 set',
    ])
    const akaun = t(w, 'open-card-AKAUN')
    expect(akaun.findAll('[data-testid=open-chips] > span').map((c) => c.text())).toEqual([
      '640 soalan kuiz siap guna',
      '16 set',
    ])
    const psi = t(w, 'open-card-PSI')
    expect(psi.findAll('[data-testid=open-chips] > span').map((c) => c.text())).toEqual([
      '40 soalan kuiz siap guna',
      '1 set bersih',
      'Target Latihan: 40',
      '1 set',
    ])
    expect(geo.text()).toContain('Pilih Set')
  })

  it('renders the readiness card with chips, tiles, lock chips and the bank note when sent', async () => {
    api.fetchTrackingAHub.mockResolvedValue(
      hub({
        summary: { bersih: 1, bankBesar: 1, locked: 58 },
        tiles: [
          tile('BI', 'Bahasa Inggeris', { targetSize: 36 }),
          tile('MATH', 'Matematik', {
            locked: 11,
            total: 11,
            lockedSets: [1, 2, 3, 4, 5, 6].map((n) => ({
              setNo: 42 + n,
              readyCount: 30 + n,
              target: 40,
            })),
          }),
          tile('GEO', 'Geografi', {
            bankBesar: 1,
            locked: 9,
            total: 10,
            readiness: 10,
            hasBankBesar: true,
            lockedSets: [{ setNo: 2, readyCount: 31, target: 40 }],
          }),
        ],
      }),
    )
    const w = await render(TrackingAHubPage, '/spm/ramalan')
    expect(w.get('[data-testid=readiness]').text()).toContain('Kesediaan Admin')
    expect(w.get('[data-testid=readiness]').text()).toContain('Status set Tracking A SPM semasa')
    expect(w.findAll('[data-testid=readiness-summary] > span').map((c) => c.text())).toEqual([
      'Set Bersih: 1 set',
      'Bank Besar: 1 set',
      'Locked: 58 set',
    ])
    expect(w.findAll('[data-testid^=tile-]').length).toBeGreaterThan(0)
    expect(t(w, 'tile-BI').get('[data-testid=tile-target]').text()).toBe(
      'BI · Target set: 36 soalan',
    )
    expect(t(w, 'tile-BI').get('[data-testid=tile-badge]').text()).toBe('0/0 set bersih')
    expect(t(w, 'tile-BI').find('[data-testid=tile-locks]').exists()).toBe(false)
    expect(t(w, 'tile-BI').find('[data-testid=tile-bank-note]').exists()).toBe(false)
    expect(
      t(w, 'tile-MATH')
        .findAll('[data-testid=tile-lock-chip]')
        .map((c) => c.text()),
    ).toEqual([
      '2026 Set 43 · 31/40',
      '2026 Set 44 · 32/40',
      '2026 Set 45 · 33/40',
      '2026 Set 46 · 34/40',
      '2026 Set 47 · 35/40',
      '2026 Set 48 · 36/40',
    ])
    const geo = t(w, 'tile-GEO')
    expect(geo.get('[data-testid=tile-readiness]').text()).toBe('10%')
    expect(geo.get('[data-testid=tile-badge]').text()).toBe('0/10 set bersih')
    expect(geo.get('[data-testid=tile-bank-note]').text()).toContain(
      'Set bank besar boleh dibuka, tetapi bank sumber melebihi target set.',
    )
    expect(geo.text()).toContain('Set Masih Terkunci')
  })

  it('shows the error block and retries', async () => {
    api.fetchTrackingAHub.mockRejectedValueOnce(new Error('boom'))
    const w = await render(TrackingAHubPage, '/spm/ramalan')
    expect(w.find('[data-testid=spm-error]').exists()).toBe(true)
    api.fetchTrackingAHub.mockResolvedValue(hub(null))
    await t(w, 'spm-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=lanes]').exists()).toBe(true)
  })
})

const geoSubject: TrackingASubject = {
  code: 'GEO',
  name: 'Geografi',
  icon: null,
  color: '#16a34a',
  targetType: 'spm',
  targetSize: 40,
  summary: { bersih: 0, bankBesar: 1, readyQuestions: 309, belumCukup: 9 },
  sets: [
    {
      setNo: 1,
      status: 'bank_besar',
      readyCount: 40,
      bankSource: 67,
      dskpTagged: 67,
      dskpTotal: 67,
    },
    {
      setNo: 2,
      status: 'belum_cukup',
      readyCount: 31,
      bankSource: null,
      dskpTagged: 31,
      dskpTotal: 31,
    },
  ],
}

describe('S6 TrackingASubjectPage', () => {
  it('renders the header, chips and the startable then locked cards', async () => {
    api.fetchTrackingASubject.mockResolvedValue(geoSubject)
    const w = await render(TrackingACodePage, '/spm/ramalan/GEO')
    expect(api.fetchTrackingASubject).toHaveBeenCalledWith('GEO', expect.anything())
    expect(t(w, 'spm-back').attributes('href')).toBe('/spm/ramalan')
    expect(t(w, 'subject-title').text()).toBe('Geografi')
    expect(t(w, 'subject-sub').text()).toBe('Tracking A SPM · Target SPM set: 40 soalan')
    expect(t(w, 'sum-bersih').text()).toBe('0 set bersih')
    expect(t(w, 'sum-bank').text()).toBe('1 set bank besar')
    expect(t(w, 'sum-ready').text()).toBe('309 soalan kuiz siap guna')
    expect(t(w, 'sum-locked').text()).toBe('9 set belum cukup')
    expect(t(w, 'sum-target').text()).toBe('Target SPM: 40 / set')
    expect(t(w, 'year-heading').text()).toBe('Tracking A 2026')

    const one = t(w, 'set-card-1')
    expect(one.attributes('href')).toBe('/spm/ramalan/GEO?year=2026&set=1')
    expect(one.get('[data-testid=set-badge]').text()).toBe('Bank Besar Sedia')
    expect(one.get('[data-testid=set-bank]').text()).toBe(
      'Bank source: 67. Sistem tetap ambil 40 soalan ikut prioriti semasa.',
    )
    expect(one.get('[data-testid=set-dskp]').text()).toBe('DSKP: 67/67 (100%)')
    expect(one.get('[data-testid=set-format]').text()).toBe('Format set: 40 / 40')

    const two = t(w, 'set-card-2')
    expect(two.attributes('href')).toBeUndefined()
    expect(two.classes()).toContain('pointer-events-none')
    expect(two.get('[data-testid=set-badge]').text()).toBe('Belum Cukup')
    expect(two.get('[data-testid=set-locked-note]').text()).toBe(
      'Belum cukup soalan untuk format KPM.',
    )
    expect(two.get('[data-testid=set-format]').text()).toBe('Format set: 31 / 40')
  })

  it('has no target line, no "Format set" and no locked chip for AKAUN', async () => {
    api.fetchTrackingASubject.mockResolvedValue({
      ...geoSubject,
      code: 'AKAUN',
      name: 'Prinsip Perakaunan',
      targetType: null,
      targetSize: null,
      summary: { bersih: 1, bankBesar: 0, readyQuestions: 40, belumCukup: 0 },
      sets: [
        {
          setNo: 1,
          status: 'bersih',
          readyCount: 40,
          bankSource: null,
          dskpTagged: 40,
          dskpTotal: 40,
        },
      ],
    })
    const w = await render(TrackingACodePage, '/spm/ramalan/AKAUN')
    expect(t(w, 'subject-sub').text()).toBe('Tracking A SPM')
    expect(w.find('[data-testid=sum-target]').exists()).toBe(false)
    expect(w.find('[data-testid=sum-locked]').exists()).toBe(false)
    expect(w.find('[data-testid=set-format]').exists()).toBe(false)
    expect(t(w, 'set-card-1').get('[data-testid=set-badge]').text()).toBe('Set Bersih')
  })

  it('shows the empty block with the zero chips and the target chip for BA', async () => {
    api.fetchTrackingASubject.mockResolvedValue({
      ...geoSubject,
      code: 'BA',
      name: 'Bahasa Arab',
      targetType: 'latihan',
      summary: { bersih: 0, bankBesar: 0, readyQuestions: 0, belumCukup: 0 },
      sets: [],
    })
    const w = await render(TrackingACodePage, '/spm/ramalan/BA')
    expect(t(w, 'sum-bersih').text()).toBe('0 set bersih')
    expect(t(w, 'sum-target').text()).toBe('Target Latihan: 40 / set')
    expect(t(w, 'subject-empty').text()).toContain('Belum Ada Set Tracking A')
    expect(t(w, 'subject-empty').text()).toContain(
      'Set Tracking A untuk subjek ini akan ditambah tidak lama lagi.',
    )
    expect(w.find('[data-testid=year-heading]').exists()).toBe(false)
  })

  it('replaces the URL with the S7 list for BM/BI', async () => {
    api.fetchTrackingASubject.mockResolvedValue({
      redirect: '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa',
    })
    await render(TrackingACodePage, '/spm/ramalan/BM')
    expect(router.currentRoute.value.fullPath).toBe(
      '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa',
    )
  })

  it('raises the 404 outcome for an unknown code', async () => {
    api.fetchTrackingASubject.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(TrackingACodePage, '/spm/ramalan/XYZ')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })
})

describe('Q3 TrackingASetQuizPage', () => {
  it('mounts the runner with the ramalan start and the S6 back link', async () => {
    m05.startSession.mockResolvedValue({})
    const w = await render(TrackingACodePage, '/spm/ramalan/AKAUN?year=2026&set=3')
    expect(api.fetchTrackingASubject).not.toHaveBeenCalled()
    const r = w.getComponent(Runner) as unknown as { props(k: string): unknown }
    expect(r.props('start')).toEqual({
      mode: 'ramalan',
      subjectCode: 'AKAUN',
      year: 2026,
      setNo: 3,
    })
    expect(r.props('backUrl')).toBe('/spm/ramalan/AKAUN')
    expect(r.props('report')).toEqual({ source: 'spm' })
    expect(r.props('retry')).toBe('restart')
    expect(m05.startSession).toHaveBeenCalledWith({
      mode: 'ramalan',
      subjectCode: 'AKAUN',
      year: 2026,
      setNo: 3,
    })
  })

  it('treats year without set as the set list', async () => {
    api.fetchTrackingASubject.mockResolvedValue(geoSubject)
    const w = await render(TrackingACodePage, '/spm/ramalan/GEO?year=2026')
    expect(w.find('[data-testid=runner]').exists()).toBe(false)
    expect(t(w, 'subject-title').text()).toBe('Geografi')
  })

  it.each([
    ['422 SET_NOT_READY', new ApiError({ status: 422, code: 'SET_NOT_READY', message: 'x' })],
    ['404', new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' })],
  ])('replaces the URL with S6 when the start is refused (%s)', async (_n, err) => {
    m05.startSession.mockRejectedValue(err)
    await render(TrackingACodePage, '/spm/ramalan/GEO?year=2026&set=2')
    expect(router.currentRoute.value.fullPath).toBe('/spm/ramalan/GEO')
  })

  it('surfaces any other 422 as a normal error (no replace to S6)', async () => {
    m05.startSession.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x' }),
    )
    await render(TrackingACodePage, '/spm/ramalan/GEO?year=2026&set=2')
    expect(router.currentRoute.value.fullPath).toBe('/spm/ramalan/GEO?year=2026&set=2')
  })
})

const overview = (over: Partial<SubjektifOverview['stats']> = {}): SubjektifOverview => ({
  stats: { setsAnswered: 0, subjectsTried: 0, bestScore: null, bestSetsSaved: 0, ...over },
  subjects: [
    {
      subjectId: 2,
      name: 'Bahasa Inggeris',
      nameEn: 'English Language',
      group: 'teras',
      icon: null,
      color: '#2563eb',
      sets: 773,
    },
    {
      subjectId: 1,
      name: 'Bahasa Melayu',
      nameEn: 'Malay Language',
      group: 'teras',
      icon: null,
      color: '#dc2626',
      sets: 559,
    },
    {
      subjectId: 11,
      name: 'Biologi',
      nameEn: 'Biology',
      group: 'elektif',
      icon: null,
      color: '#16a34a',
      sets: 217,
    },
    {
      subjectId: 17,
      name: 'Sains Komputer',
      nameEn: 'Computer Science',
      group: 'elektif',
      icon: null,
      color: '#0891b2',
      sets: 22,
    },
  ],
})

describe('S8 SubjektifPage', () => {
  it('renders the header, info box and the empty stats', async () => {
    api.fetchSubjektif.mockResolvedValue(overview())
    const w = await render(SubjektifPage, '/spm/subjektif')
    expect(t(w, 'spm-heading').text()).toBe('Latihan Subjektif SPM')
    expect(t(w, 'spm-sub').text()).toBe(
      'Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan 4 dan 5.',
    )
    expect(t(w, 'subjektif-info').text()).toContain('Bagaimana ia berfungsi?')
    const cards = w.findAll('[data-testid^=subjektif-stat-]')
    ;[
      ['Set Dijawab', '0'],
      ['Subjek Dicuba', '0'],
      ['Skor Terbaik', 'Belum Ada'],
      ['Set Terbaik Disimpan', '0'],
    ].forEach(([label, value], i) => {
      expect(cards[i]!.text()).toContain(label)
      expect(cards[i]!.text()).toContain(value)
    })
    expect(texts(w, 'stat-caption')[2]).toBe('Skor tertinggi merentas semua set subjektif SPM')
  })

  it('shows "{p}%" for the best score', async () => {
    api.fetchSubjektif.mockResolvedValue(
      overview({ setsAnswered: 2, subjectsTried: 2, bestScore: 75, bestSetsSaved: 2 }),
    )
    const w = await render(SubjektifPage, '/spm/subjektif')
    const cards = w.findAll('[data-testid^=subjektif-stat-]')
    ;['2', '2', '75%', '2'].forEach((v, i) => expect(cards[i]!.text()).toContain(v))
  })

  it('switches the grid with the tabs and styles the active tab', async () => {
    api.fetchSubjektif.mockResolvedValue(overview())
    const w = await render(SubjektifPage, '/spm/subjektif')
    expect(t(w, 'tab-all').attributes('data-active')).toBe('true')
    expect(w.findAll('[data-testid^=subjektif-card-]')).toHaveLength(4)
    expect(t(w, 'tab-all').get('[data-testid=tab-count]').text()).toBe('4')
    expect(t(w, 'tab-teras').get('[data-testid=tab-count]').text()).toBe('2')

    await t(w, 'tab-teras').trigger('click')
    expect(t(w, 'tab-teras').attributes('data-active')).toBe('true')
    expect(w.findAll('[data-testid^=subjektif-card-]')).toHaveLength(2)
    expect(texts(w, 'subjektif-badge')).toEqual(['Teras', 'Teras'])

    await t(w, 'tab-elektif').trigger('click')
    expect(t(w, 'tab-elektif').attributes('data-active')).toBe('true')
    expect(texts(w, 'subjektif-name')).toEqual(['Biologi', 'Sains Komputer'])
  })

  it('links every card to the S9 list and shows its set count', async () => {
    api.fetchSubjektif.mockResolvedValue(overview())
    const w = await render(SubjektifPage, '/spm/subjektif')
    const card = t(w, 'subjektif-card-2')
    expect(card.attributes('href')).toBe('/latihan-berstruktur?subject_id=2&scope=spm')
    expect(card.text()).toContain('English Language')
    expect(card.get('[data-testid=subjektif-sets]').text()).toBe('773 set subjektif')
    expect(t(w, 'subjektif-card-17').attributes('href')).toBe(
      '/latihan-berstruktur?subject_id=17&scope=spm',
    )
  })

  it('shows the error block when the load fails', async () => {
    api.fetchSubjektif.mockRejectedValue(new Error('boom'))
    const w = await render(SubjektifPage, '/spm/subjektif')
    expect(w.get('[data-testid=spm-error]').text()).toContain(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
  })
})
