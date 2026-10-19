// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { usePageMeta } from '@/composables'

import type {
  ChapterCard,
  ChapterSubject,
  ChapterSubjectDetail,
  RevisionOverview,
  RevisionSubject,
} from '../../api/types'
import {
  chapterListHref,
  chapterQuizHref,
  chapterQuizTitle,
  chapterStats,
  formatScore,
  parseLevelParam,
  progressWidth,
} from '../../components/chapter/chapter-lib'
import { setRevisionFlash, takeRevisionFlash } from '../../components/revision/revision-flash'
import ChapterIndexPage from '../../pages/ChapterIndexPage.vue'
import ChapterQuizPage from '../../pages/ChapterQuizPage.vue'
import ChapterSubjectPage from '../../pages/ChapterSubjectPage.vue'
import RevisionListPage from '../../pages/RevisionListPage.vue'
import RevisionQuizPage from '../../pages/RevisionQuizPage.vue'

const api = vi.hoisted(() => ({
  fetchChapterSubjects: vi.fn(),
  fetchChapterSubject: vi.fn(),
  fetchRevisionOverview: vi.fn(),
  fetchRevisionSubject: vi.fn(),
}))
vi.mock('../../api/practice', () => api)

const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

/** The runner is covered by its own tests: here only the props the pages give it matter. */
const mounts = vi.hoisted(() => [] as string[])
vi.mock('../../components/quiz/QuizRunner.vue', () => ({
  default: defineComponent({
    props: {
      start: { type: null, default: null },
      headerTitle: { type: null, default: null },
      labels: { type: null, default: null },
      revisionChips: Boolean,
      correctedLine: Boolean,
      backUrl: { type: null, default: null },
      lockedUrl: { type: null, default: null },
      retry: { type: null, default: null },
      report: { type: null, default: null },
      accentColor: { type: null, default: null },
    },
    setup: (props) => {
      mounts.push(JSON.stringify(props.start))
      return () => h('div', { 'data-testid': 'runner', 'data-props': JSON.stringify(props) })
    },
  }),
}))

const card = (over: Partial<ChapterCard>): ChapterCard => ({
  id: 1,
  number: 1,
  name: 'Nombor Bulat hingga 100',
  total: 464,
  answered: 0,
  correct: 0,
  scorePct: 0,
  remaining: 464,
  state: 'open',
  complete: false,
  ...over,
})

const MATH: ChapterSubjectDetail = {
  subject: { code: 'MATH', name: 'Matematik', color: '#EF4444' },
  levels: [
    { id: 1, name: 'Darjah 1', count: 2734 },
    { id: 2, name: 'Darjah 2', count: 2129 },
  ],
  levelId: 1,
  chapters: [
    card({ id: 1, answered: 18, remaining: 446, scorePct: 44.4 }),
    card({
      id: 2,
      number: 2,
      name: 'Sukatan dan Geometri',
      total: 302,
      remaining: 302,
      state: 'locked',
    }),
  ],
}
const MATH_D2: ChapterSubjectDetail = {
  ...MATH,
  levelId: 2,
  chapters: [card({ id: 3, number: 1, name: 'Nombor hingga 1000' })],
}
const ADDMATH: ChapterSubjectDetail = {
  subject: { code: 'ADDMATH', name: 'Matematik Tambahan', color: '#6366F1' },
  levels: [],
  levelId: null,
  chapters: [],
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(component: unknown, url: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/practice/chapter', component: ChapterIndexPage },
      { path: '/practice/chapter/:code', component: ChapterSubjectPage },
      { path: '/practice/chapter/:code/:chapterId(\\d+)/quiz', component: ChapterQuizPage },
      { path: '/practice/revision', component: RevisionListPage },
      { path: '/practice/revision/:code', component: RevisionQuizPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(component as never, { global: { plugins: [router], stubs: { teleport: true } } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const runnerProps = (w: VueWrapper) =>
  JSON.parse(t(w, 'runner').attributes('data-props') ?? '{}') as Record<string, unknown>

beforeEach(() => {
  mounts.length = 0
  for (const f of Object.values(api)) f.mockReset()
  outcome.setRouteOutcome.mockReset()
  takeRevisionFlash()
  api.fetchChapterSubject.mockImplementation((_code: string, q?: { levelId?: number | null }) =>
    Promise.resolve(q?.levelId === 2 ? MATH_D2 : MATH),
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('chapter-lib', () => {
  it('formats the score with 1 decimal and drops a trailing ".0" (BR-03, BR-16)', () => {
    expect(formatScore(44.4)).toBe('44.4')
    expect(formatScore(60)).toBe('60')
    expect(formatScore(60.0)).toBe('60')
    expect(formatScore(0)).toBe('0')
    expect(formatScore(33.333)).toBe('33.3')
    expect(formatScore(Number.NaN)).toBe('0')
  })

  it('builds the stats line of BR-16', () => {
    expect(chapterStats({ answered: 18, total: 320, scorePct: 44.4, remaining: 302 })).toBe(
      '18/320 soalan unik · Skor 44.4% · 302 baki',
    )
    expect(chapterStats({ answered: 0, total: 464, scorePct: 0, remaining: 464 })).toBe(
      '0/464 soalan unik · Skor 0% · 464 baki',
    )
  })

  it('clamps the bar width and handles an empty chapter', () => {
    expect(progressWidth({ answered: 18, total: 320 })).toBeCloseTo(5.625)
    expect(progressWidth({ answered: 5, total: 0 })).toBe(0)
    expect(progressWidth({ answered: 9, total: 3 })).toBe(100)
  })

  it('builds the Q2 and S5 URLs and reads ?level=', () => {
    expect(chapterQuizHref('MATH', 1, 5)).toBe('/practice/chapter/MATH/1/quiz?count=5')
    expect(chapterListHref('MATH', 2)).toBe('/practice/chapter/MATH?level=2')
    expect(chapterListHref('MATH', null)).toBe('/practice/chapter/MATH')
    expect(parseLevelParam('2')).toBe(2)
    expect(parseLevelParam(['3', '4'])).toBe(3)
    expect(parseLevelParam('0')).toBeNull()
    expect(parseLevelParam('x')).toBeNull()
    expect(parseLevelParam(undefined)).toBeNull()
  })

  it('titles the chapter quiz "Bab {n}: {chapter}"', () => {
    expect(chapterQuizTitle({ number: 3, name: 'Pecahan' })).toBe('Bab 3: Pecahan')
    expect(chapterQuizTitle({ number: null, name: 'Pecahan' })).toBe('Pecahan')
    expect(chapterQuizTitle({ number: 2, name: null })).toBe('Bab 2: ')
    expect(chapterQuizTitle(undefined)).toBe('')
  })
})

describe('revision flash', () => {
  it('is returned once and then cleared', () => {
    expect(takeRevisionFlash()).toBeNull()
    setRevisionFlash()
    expect(takeRevisionFlash()).toBe('Tiada soalan salah untuk subjek ini. Tahniah!')
    expect(takeRevisionFlash()).toBeNull()
  })
})

describe('S4 ChapterIndexPage', () => {
  const SUBJECTS: ChapterSubject[] = [
    {
      code: 'BM',
      name: 'Bahasa Melayu',
      icon: 'book-open',
      color: '#3B82F6',
      chapterCount: 18,
      questionCount: 4833,
    },
    {
      code: 'MATH',
      name: 'Matematik',
      icon: 'calculator',
      color: '#EF4444',
      chapterCount: 25,
      questionCount: 6538,
    },
  ]

  it('shows the hero, the random-drill link and one card per subject (FR-M05-57, 58)', async () => {
    api.fetchChapterSubjects.mockResolvedValue({ data: SUBJECTS, meta: {} })
    const w = await render(ChapterIndexPage, '/practice/chapter')
    expect(w.text()).toContain('Mode Sistematik')
    expect(t(w, 'chapter-index-page').get('h1').text()).toBe('Soalan by Chapter')
    expect(w.text()).toContain(
      'Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap dan mencapai sekurang-kurangnya 70%.',
    )
    expect(t(w, 'chapter-random').attributes('href')).toBe('/practice')
    expect(t(w, 'chapter-random').text()).toBe('Latih Tubi Rawak')
    const cards = w
      .findAll('[data-testid^=chapter-subject-]')
      .filter((c) => c.element.tagName === 'A')
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      '/practice/chapter/BM',
      '/practice/chapter/MATH',
    ])
    const math = t(w, 'chapter-subject-MATH')
    expect(math.get('[data-testid=chapter-subject-name]').text()).toBe('Matematik')
    expect(math.get('[data-testid=chapter-subject-chapters]').text()).toBe('25 bab tersedia')
    expect(math.get('[data-testid=chapter-subject-questions]').text()).toBe('6,538 soalan chapter')
    // The name truncates when long, as live.
    expect(math.get('[data-testid=chapter-subject-name]').classes()).toContain('truncate')
    expect(math.find('[data-testid=chapter-subject-icon]').find('svg, span').exists()).toBe(true)
  })

  it('shows an error box with a retry when the list fails', async () => {
    api.fetchChapterSubjects.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    api.fetchChapterSubjects.mockResolvedValue({ data: SUBJECTS, meta: {} })
    const w = await render(ChapterIndexPage, '/practice/chapter')
    expect(t(w, 'chapter-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w, 'chapter-retry').trigger('click')
    await flushPromises()
    expect(t(w, 'chapter-subject-grid').findAll('a')).toHaveLength(2)
  })
})

describe('S5 ChapterSubjectPage', () => {
  it('renders the hero, the level select and the open and locked cards (FR-M05-59…64)', async () => {
    const w = await render(ChapterSubjectPage, '/practice/chapter/MATH')
    expect(api.fetchChapterSubject).toHaveBeenCalledWith(
      'MATH',
      { levelId: null },
      expect.anything(),
    )
    expect(t(w, 'chapter-all-subjects').attributes('href')).toBe('/practice/chapter')
    expect(w.text()).toContain('Progressive Unlock')
    expect(t(w, 'chapter-subject-name').text()).toBe('Matematik')
    expect(w.text()).toContain(
      'Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya.',
    )
    const select = w.findComponent({ name: 'Select' })
    expect((select.props('items') as { label: string }[]).map((o) => o.label)).toEqual([
      'Darjah 1 — 2,734 soalan',
      'Darjah 2 — 2,129 soalan',
    ])
    expect(select.props('modelValue')).toBe(1)

    const open = t(w, 'chapter-card-1')
    expect(open.attributes('data-state')).toBe('open')
    expect(t(w, 'chapter-title-1').text()).toBe('Bab 1: Nombor Bulat hingga 100')
    expect(t(w, 'chapter-stats-1').text()).toBe('18/464 soalan unik · Skor 44.4% · 446 baki')
    expect(open.findAll('a').map((a) => [a.text(), a.attributes('href')])).toEqual([
      ['5 soalan', '/practice/chapter/MATH/1/quiz?count=5'],
      ['10 soalan', '/practice/chapter/MATH/1/quiz?count=10'],
      ['15 soalan', '/practice/chapter/MATH/1/quiz?count=15'],
      ['20 soalan', '/practice/chapter/MATH/1/quiz?count=20'],
    ])
    expect(Number(t(w, 'chapter-bar-1').get('[role=progressbar]').attributes('aria-valuenow'))).toBeCloseTo(3.879, 2)

    const locked = t(w, 'chapter-card-2')
    expect(locked.attributes('data-state')).toBe('locked')
        expect(locked.find('svg').exists()).toBe(true)
    expect(t(w, 'chapter-locked-2').text()).toBe('Kunci bab sebelumnya')
    expect(locked.findAll('a')).toHaveLength(0)
    // Locked chapters still show their stats (D-7).
    expect(t(w, 'chapter-stats-2').text()).toBe('0/302 soalan unik · Skor 0% · 302 baki')
  })

  it('lets chapter titles wrap (DV-M05-09: no truncate)', async () => {
    const w = await render(ChapterSubjectPage, '/practice/chapter/MATH')
    for (const id of [1, 2]) {
      const classes = t(w, `chapter-title-${String(id)}`).classes()
      expect(classes).not.toContain('truncate')
      expect(classes).toContain('break-words')
    }
  })

  it('navigates to ?level= when the select changes and passes ?level= to the API', async () => {
    const w = await render(ChapterSubjectPage, '/practice/chapter/MATH')
    w.findComponent({ name: 'Select' }).vm.$emit('update:modelValue', 2)
    await flushPromises()
    await flushPromises()
    expect(router.currentRoute.value.fullPath).toBe('/practice/chapter/MATH?level=2')
    expect(api.fetchChapterSubject).toHaveBeenLastCalledWith(
      'MATH',
      { levelId: 2 },
      expect.anything(),
    )
    expect(t(w, 'chapter-card-3').attributes('data-state')).toBe('open')
  })

  it('shows the empty text and no select for a subject without a level (DV-M05-07)', async () => {
    api.fetchChapterSubject.mockResolvedValue(ADDMATH)
    const w = await render(ChapterSubjectPage, '/practice/chapter/ADDMATH')
    expect(w.find('[data-testid=chapter-level-select]').exists()).toBe(false)
    expect(t(w, 'chapter-empty').text()).toBe('Tiada bab tersedia untuk tahap ini.')
  })

  it('raises the global 404 page for an unknown code', async () => {
    api.fetchChapterSubject.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    const w = await render(ChapterSubjectPage, '/practice/chapter/XYZ')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    expect(w.find('[data-testid=chapter-error]').exists()).toBe(false)
  })
})

describe('Q2 ChapterQuizPage', () => {
  it('starts a chapter session once the level is known and wires the host URLs (FR-M05-52, 66)', async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/1/quiz?count=15')
    const p = runnerProps(w)
    expect(p.start).toEqual({ mode: 'chapter', chapterId: 1, count: 15 })
    expect(p.backUrl).toBe('/practice/chapter/MATH?level=1')
    expect(p.lockedUrl).toBe('/practice/chapter/MATH?level=1')
    expect(p.retry).toBe('restart')
    expect(p.report).toEqual({ source: 'latihan' })
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
  })

  it('finds the level of a chapter that is not in the default level', async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/3/quiz?count=5')
    expect(runnerProps(w).backUrl).toBe('/practice/chapter/MATH?level=2')
    // The default level was read first, then level 2 (the chapter is not in the default level).
    expect(api.fetchChapterSubject.mock.calls.map((c) => c[1])).toEqual([{}, { levelId: 2 }])
  })

  it('does not touch the next page when it is unmounted while the level is being resolved', async () => {
    usePageMeta().reset()
    let release: (d: ChapterSubjectDetail) => void = () => {}
    let signal: AbortSignal | undefined
    api.fetchChapterSubject.mockImplementation(
      (_c: string, _q: unknown, o?: { signal?: AbortSignal }) => {
        signal = o?.signal
        return new Promise<ChapterSubjectDetail>((res) => (release = res))
      },
    )
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/1/quiz?count=5')
    expect(t(w, 'chapter-quiz-resolving').text()).toContain('Memuat Soalan...')
    w.unmount()
    wrapper = null
    expect(signal?.aborted).toBe(true)
    release(MATH)
    await flushPromises()
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
    expect(usePageMeta().state.title).toBeNull()
    expect(usePageMeta().state.header).toBeNull()
    expect(mounts).toHaveLength(0)
  })

  it('a late 404 after unmount does not raise the error page either', async () => {
    let fail: (e: unknown) => void = () => {}
    api.fetchChapterSubject.mockImplementation(() => new Promise((_r, rej) => (fail = rej)))
    const w = await render(ChapterQuizPage, '/practice/chapter/XYZ/1/quiz?count=5')
    w.unmount()
    wrapper = null
    fail(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await flushPromises()
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
  })

  it('starts a new session when the count, the chapter or the code changes (re-keying)', async () => {
    await render(ChapterQuizPage, '/practice/chapter/MATH/1/quiz?count=5')
    expect(mounts).toEqual([JSON.stringify({ mode: 'chapter', chapterId: 1, count: 5 })])
    await router.push('/practice/chapter/MATH/1/quiz?count=10')
    await flushPromises()
    expect(mounts).toHaveLength(2)
    expect(mounts[1]).toBe(JSON.stringify({ mode: 'chapter', chapterId: 1, count: 10 }))
    await router.push('/practice/chapter/MATH/2/quiz?count=10')
    await flushPromises()
    expect(mounts).toHaveLength(3)
    expect(mounts[2]).toBe(JSON.stringify({ mode: 'chapter', chapterId: 2, count: 10 }))
    await router.push('/practice/chapter/MATH/3/quiz?count=10')
    await flushPromises()
    expect(mounts).toHaveLength(4)
    expect(mounts[3]).toBe(JSON.stringify({ mode: 'chapter', chapterId: 3, count: 10 }))
  })

  it('defaults an invalid count to 10', async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/1/quiz?count=7')
    expect((runnerProps(w).start as { count: number }).count).toBe(10)
  })

  it("answers the 404 page for a chapter that is not the subject's and for an unknown code", async () => {
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/99/quiz?count=5')
    expect(w.find('[data-testid=runner]').exists()).toBe(false)
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
    wrapper?.unmount()
    outcome.setRouteOutcome.mockReset()
    api.fetchChapterSubject.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(ChapterQuizPage, '/practice/chapter/XYZ/1/quiz?count=5')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })

  it('shows a retry when resolving the chapter fails with a server error', async () => {
    api.fetchChapterSubject.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    const w = await render(ChapterQuizPage, '/practice/chapter/MATH/1/quiz?count=5')
    expect(t(w, 'chapter-quiz-error').text()).toContain('Maaf, berlaku ralat.')
    await t(w, 'chapter-quiz-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=runner]').exists()).toBe(true)
  })
})

describe('S6 RevisionListPage', () => {
  const OVERVIEW: RevisionOverview = {
    total: 72,
    subjects: [
      {
        code: 'BM',
        name: 'Bahasa Melayu',
        nameEn: 'Malay Language',
        icon: 'book-open',
        color: '#3B82F6',
        count: 46,
      },
      {
        code: 'SEJ',
        name: 'Sejarah',
        nameEn: 'History',
        icon: 'clock',
        color: '#F59E0B',
        count: 26,
      },
    ],
  }

  it('shows the banner, the cards, the tips and the back link (FR-M05-68…71)', async () => {
    api.fetchRevisionOverview.mockResolvedValue(OVERVIEW)
    const w = await render(RevisionListPage, '/practice/revision')
    expect(t(w, 'revision-list-page').get('h1').text()).toBe('Soalan Aku Salah')
    expect(w.text()).toContain('Ulang kaji soalan yang pernah dijawab salah')
    expect(t(w, 'revision-total').text()).toBe('72 soalan perlu diulang kaji')
    const cards = w
      .findAll('[data-testid^=revision-subject-]')
      .filter((c) => c.element.tagName === 'A')
    expect(cards.map((c) => c.attributes('href'))).toEqual([
      '/practice/revision/BM',
      '/practice/revision/SEJ',
    ])
    expect(t(w, 'revision-subject-BM').get('[data-testid=revision-subject-count]').text()).toBe(
      '46 soalan salah',
    )
    expect(t(w, 'revision-subject-BM').text()).toContain('Malay Language')
    expect(t(w, 'revision-tips').text()).toContain('Tips Ulang Kaji')
    expect(t(w, 'revision-tips').findAll('li')).toHaveLength(3)
    expect(t(w, 'revision-back').attributes('href')).toBe('/practice')
    expect(t(w, 'revision-back').text()).toBe('Kembali ke Latihan')
    expect(w.find('[data-testid=revision-flash]').exists()).toBe(false)
  })

  it('with nothing queued shows "0 soalan perlu diulang kaji", no card, the tips and the back link (FR-M05-73)', async () => {
    api.fetchRevisionOverview.mockResolvedValue({ total: 0, subjects: [] })
    const w = await render(RevisionListPage, '/practice/revision')
    expect(t(w, 'revision-total').text()).toBe('0 soalan perlu diulang kaji')
    expect(w.find('[data-testid=revision-grid]').exists()).toBe(false)
    expect(t(w, 'revision-tips').text()).toContain('Tips Ulang Kaji')
    expect(t(w, 'revision-back').text()).toBe('Kembali ke Latihan')
  })

  it('shows the pending flash once (FR-M05-72)', async () => {
    api.fetchRevisionOverview.mockResolvedValue(OVERVIEW)
    setRevisionFlash()
    const w = await render(RevisionListPage, '/practice/revision')
    expect(t(w, 'revision-flash').text()).toBe('Tiada soalan salah untuk subjek ini. Tahniah!')
    wrapper?.unmount()
    const again = await render(RevisionListPage, '/practice/revision')
    expect(again.find('[data-testid=revision-flash]').exists()).toBe(false)
  })
})

describe('S7 RevisionQuizPage', () => {
  const BM: RevisionSubject = {
    subject: { id: 1, code: 'BM', name: 'Bahasa Melayu', color: '#3B82F6' },
    count: 46,
  }

  it('mounts the runner with the S7 labels, chips and reload retry (FR-M05-74, 75, 138)', async () => {
    api.fetchRevisionSubject.mockResolvedValue(BM)
    const w = await render(RevisionQuizPage, '/practice/revision/BM')
    expect(api.fetchRevisionSubject).toHaveBeenCalledWith('BM', expect.anything())
    const p = runnerProps(w)
    expect(p.start).toEqual({ mode: 'revision', subjectCode: 'BM', count: 20 })
    expect(p.revisionChips).toBe(true)
    expect(p.correctedLine).toBe(true)
    expect(p.backUrl).toBe('/practice/revision')
    expect(p.retry).toBe('reload')
    expect(p.accentColor).toBe('#3B82F6')
    expect((p.labels as { loadingTitle: string }).loadingTitle).toBe('Memuat Soalan Ulang Kaji...')
    expect((p.report as { source: string }).source).toBe('revision')
  })

  it('goes to S6 with the one-time flash when the subject has no queued question (FR-M05-72)', async () => {
    api.fetchRevisionSubject.mockResolvedValue({ ...BM, count: 0 })
    const w = await render(RevisionQuizPage, '/practice/revision/MATH')
    expect(w.find('[data-testid=runner]').exists()).toBe(false)
    expect(router.currentRoute.value.fullPath).toBe('/practice/revision')
    expect(takeRevisionFlash()).toBe('Tiada soalan salah untuk subjek ini. Tahniah!')
  })

  it('raises the global 404 page for an unknown code', async () => {
    api.fetchRevisionSubject.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await render(RevisionQuizPage, '/practice/revision/XYZ')
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })

  it('shows an error box with "Cuba Semula" on a non-404 failure and loads again on retry', async () => {
    api.fetchRevisionSubject.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }),
    )
    api.fetchRevisionSubject.mockResolvedValue(BM)
    const w = await render(RevisionQuizPage, '/practice/revision/BM')
    expect(outcome.setRouteOutcome).not.toHaveBeenCalled()
    expect(t(w, 'revision-quiz-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    expect(t(w, 'revision-quiz-retry').text()).toBe('Cuba Semula')
    expect(w.find('[data-testid=runner]').exists()).toBe(false)
    await t(w, 'revision-quiz-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=runner]').exists()).toBe(true)
  })
})
