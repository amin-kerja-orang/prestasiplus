// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router/outcome'

import type {
  PkskDashboard,
  PkskDomainSection,
  PkskExam,
  PkskExamAttempt,
  PkskPractice,
} from '../../api/types'
import PkskDashboardPage from '../../pages/PkskDashboardPage.vue'
import PkskDomainsPage from '../../pages/PkskDomainsPage.vue'
import PkskExamPage from '../../pages/PkskExamPage.vue'
import PkskHistoryPage from '../../pages/PkskHistoryPage.vue'
import PkskHubPage from '../../pages/PkskHubPage.vue'
import PkskPracticePage from '../../pages/PkskPracticePage.vue'
import studentRoutes from '../../routes/student'

const api = vi.hoisted(() => ({
  fetchPkskAccess: vi.fn(),
  fetchPkskDashboard: vi.fn(),
  fetchPkskDomainSections: vi.fn(),
  fetchPkskExamAttempts: vi.fn(),
  fetchPkskPractice: vi.fn(),
  submitPkskPractice: vi.fn(),
  fetchPkskExam: vi.fn(),
  submitPkskExam: vi.fn(),
}))
vi.mock('../../api/pksk', () => api)

const forbidden = () => new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Akses ditolak.' })
const notFound = () => new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' })

const domain = <T extends object>(code: string, name: string, extra: T) => ({
  id: 2,
  code,
  name,
  icon: 'fa-calculator',
  color: '#3b82f6',
  ...extra,
})

let wrapper: VueWrapper | null = null
let router: Router

async function render(
  component: object,
  path: string,
  routePath: string,
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, component, props: true },
      { path: '/pksk', component: { template: '<div id="hub"/>' } },
      { path: '/pksk/:rest(.*)*', component: { template: '<div id="other"/>' } },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('routes', () => {
  it('limits the level to T1 / T4 and tags every page with the generic tab title', () => {
    const paths = studentRoutes.map((r) => r.path)
    expect(paths).toContain('/pksk/level/:level(T1|T4)/history')
    expect(paths).toHaveLength(6)
    for (const r of studentRoutes) {
      expect(r.meta?.title).toBe('PRESTASIPLUS - Platform Latih Tubi Nasional')
      expect(r.meta?.layout).toBe('user')
    }
    expect(studentRoutes[0]?.meta?.header).toEqual({
      title: 'PKSK',
      subtitle: 'Persediaan Kemasukan SBP / MRSM / SMKA',
    })
  })
})

describe('PkskHubPage (S1)', () => {
  it('shows the hero, the format tiles and two active level cards with the hrefs', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: true })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.get('h1').text()).toBe('Persediaan Kemasukan')
    expect(w.text()).toContain('Latih tubi soalan dan peperiksaan penuh')
    expect(w.findAll('[data-testid=format-circle]').map((c) => c.text())).toEqual(['A', 'B', 'C'])
    expect(w.get('[data-testid=format-B]').text()).toContain('70')
    expect(w.get('[data-testid=format-B]').text()).toContain('Pemberat: 70%')
    expect(w.get('[data-testid=format-C]').text()).toContain('esei')
    expect(w.findAll('[data-testid=badge-aktif]').map((b) => b.text())).toEqual(['AKTIF', 'AKTIF'])
    expect(w.get('[data-testid=level-card-T1]').classes()).toContain('border-green-400')
    expect(w.get('[data-testid=start-T1]').attributes('href')).toBe('/pksk/level/T1')
    expect(w.get('[data-testid=start-T4]').attributes('href')).toBe('/pksk/level/T4')
    expect(w.get('[data-testid=start-T4]').text()).toBe('Mula Latihan')
  })

  it('shows no badge and no green border for a level without access, and no price', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: false })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.findAll('[data-testid=badge-aktif]')).toHaveLength(1)
    const t4 = w.get('[data-testid=level-card-T4]')
    expect(t4.classes()).not.toContain('border-green-400')
    expect(t4.attributes('data-active')).toBe('false')
    expect(w.find('[data-testid=start-T4]').exists()).toBe(true)
    expect(w.text()).not.toMatch(/RM\s?\d/)
  })
})

describe('PkskDashboardPage (S2)', () => {
  const dash = (extra: Partial<PkskDashboard> = {}): PkskDashboard => ({
    level: 'T1',
    readiness: { scorePct: 0, grade: 'E' },
    examCount: 0,
    bahagianBAvgPct: 0,
    domains: [domain('PKSK_MATH', 'Matematik', { masteryPct: 70 })],
    ...extra,
  })

  it('renders the zero state, the shortcuts and the domain card', async () => {
    api.fetchPkskDashboard.mockResolvedValue(dash())
    const w = await render(PkskDashboardPage, '/pksk/level/T1', '/pksk/level/:level', {
      level: 'T1',
    })
    expect(w.get('[data-testid=score]').text()).toBe('0%')
    expect(w.get('[data-testid=grade]').text()).toBe('E')
    expect(w.get('[data-testid=readiness]').text()).toContain('Teruskan usaha anda!')
    expect(w.get('[data-testid=exam-count]').text()).toBe('0')
    expect(w.get('[data-testid=avg-b]').text()).toBe('0.0%')
    expect(w.get('[data-testid=back-link]').attributes('href')).toBe('/pksk')
    expect(w.get('[data-testid=shortcut-domains]').attributes('href')).toBe(
      '/pksk/level/T1/domains',
    )
    expect(w.get('[data-testid=shortcut-exam]').attributes('href')).toBe('/pksk/level/T1/exam')
    expect(w.get('[data-testid=shortcut-history]').text()).toContain('Lihat prestasi lepas')
    expect(w.get('[data-testid=practice-link]').attributes('href')).toBe(
      '/pksk/level/T1/domain/PKSK_MATH',
    )
    expect(w.get('[data-testid=practice-link]').text()).toBe('Latih Sekarang')
    expect(w.get('[data-testid=mastery-pct]').text()).toBe('70%')
    expect(w.get('[data-testid=mastery-bar]').attributes('style')).toContain('width: 70%')
  })

  it('shows rounded score, one-decimal average and the grade', async () => {
    api.fetchPkskDashboard.mockResolvedValue(
      dash({ readiness: { scorePct: 55, grade: 'C' }, examCount: 2, bahagianBAvgPct: 59.7 }),
    )
    const w = await render(PkskDashboardPage, '/pksk/level/T1', '/pksk/level/:level', {
      level: 'T1',
    })
    expect(w.get('[data-testid=score]').text()).toBe('55%')
    expect(w.get('[data-testid=grade]').text()).toBe('C')
    expect(w.get('[data-testid=avg-b]').text()).toBe('59.7%')
  })

  it('redirects to /pksk on 403 and shows nothing', async () => {
    api.fetchPkskDashboard.mockRejectedValue(forbidden())
    const w = await render(PkskDashboardPage, '/pksk/level/T4', '/pksk/level/:level', {
      level: 'T4',
    })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk')
    expect(w.find('[data-testid=page-error]').exists()).toBe(false)
  })

  it('shows the load error with a retry on any other failure', async () => {
    api.fetchPkskDashboard.mockRejectedValueOnce(new Error('boom'))
    api.fetchPkskDashboard.mockResolvedValue(dash())
    const w = await render(PkskDashboardPage, '/pksk/level/T1', '/pksk/level/:level', {
      level: 'T1',
    })
    expect(w.get('[data-testid=page-error]').text()).toContain('Maaf, berlaku ralat.')
    await w.get('[data-testid=page-error] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=page-error]').exists()).toBe(false)
    expect(w.find('[data-testid=score]').exists()).toBe(true)
  })
})

describe('PkskDomainsPage (S3)', () => {
  it('lists the three sections with counts, hrefs and mastery', async () => {
    const sections: PkskDomainSection[] = [
      {
        bahagian: 'A',
        name: 'Kecerdasan Insaniah',
        subtitle: 'Nilai, akhlak & sahsiah',
        domains: [domain('PKSK_INSANIAH', 'Kecerdasan Insaniah', { questionCount: 12, masteryPct: 0 })],
      },
      {
        bahagian: 'B',
        name: 'Kecerdasan Intelek',
        subtitle: 'Kognitif & penaakulan',
        domains: [domain('PKSK_MATH', 'Matematik', { questionCount: 27, masteryPct: 70 })],
      },
    ]
    api.fetchPkskDomainSections.mockResolvedValue(sections)
    const w = await render(PkskDomainsPage, '/pksk/level/T1/domains', '/pksk/level/:level/domains', {
      level: 'T1',
    })
    expect(w.get('[data-testid=back-link]').text()).toBe('Kembali ke Dashboard')
    expect(w.get('[data-testid=back-link]').attributes('href')).toBe('/pksk/level/T1')
    expect(w.get('[data-testid=section-B] h2').text()).toBe('Kecerdasan Intelek')
    expect(w.get('[data-testid=section-B] [data-testid=section-badge]').classes()).toContain(
      'bg-purple-500',
    )
    const card = w.get('[data-testid=section-B] [data-testid=domain-card]')
    expect(card.attributes('href')).toBe('/pksk/level/T1/domain/PKSK_MATH')
    expect(card.get('[data-testid=question-count]').text()).toBe('27')
    expect(card.text()).toContain('Soalan')
    expect(card.get('[data-testid=mastery-pct]').text()).toBe('70%')
    expect(card.classes()).toContain('hover:border-purple-300')
  })

  it('redirects to /pksk on 403', async () => {
    api.fetchPkskDomainSections.mockRejectedValue(forbidden())
    await render(PkskDomainsPage, '/pksk/level/T1/domains', '/pksk/level/:level/domains', {
      level: 'T1',
    })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk')
  })
})

describe('PkskHistoryPage (S4, DV-M07-01)', () => {
  const attempts: PkskExamAttempt[] = [
    { id: 2, completedAt: '2026-09-20T20:00:00+08:00', scorePct: 64, grade: 'C' },
    { id: 1, completedAt: '2026-09-10T20:00:00+08:00', scorePct: 46, grade: 'D' },
  ]

  it('renders the read-only table, newest first, dd/mm/yyyy, and is tagged provisional', async () => {
    api.fetchPkskExamAttempts.mockResolvedValue(attempts)
    const w = await render(PkskHistoryPage, '/pksk/level/T1/history', '/pksk/level/:level/history', {
      level: 'T1',
    })
    expect(w.get('[data-testid=pksk-history]').attributes('data-provisional')).toBe('L-4')
    expect(w.findAll('th').map((t) => t.text())).toEqual(['Tarikh', 'Skor', 'Gred'])
    expect(w.findAll('[data-testid=history-row]').map((r) => r.findAll('td').map((c) => c.text()))).toEqual([
      ['20/09/2026', '64%', 'C'],
      ['10/09/2026', '46%', 'D'],
    ])
    expect(w.get('table').findAll('a, button, select, input')).toHaveLength(0)
  })

  it('shows the empty text instead of the table', async () => {
    api.fetchPkskExamAttempts.mockResolvedValue([])
    const w = await render(PkskHistoryPage, '/pksk/level/T4/history', '/pksk/level/:level/history', {
      level: 'T4',
    })
    expect(w.get('[data-testid=history-empty]').text()).toBe('Tiada sejarah peperiksaan.')
    expect(w.find('table').exists()).toBe(false)
  })
})

describe('PkskPracticePage (S4a, provisional L-2)', () => {
  const practice: PkskPractice = {
    domain: { id: 2, code: 'PKSK_MATH', name: 'Matematik', bahagian: 'B' },
    questions: [
      { id: 11, questionText: 'Soalan satu', options: [{ text: 'a' }, { text: 'b' }] },
      { id: 12, questionText: 'Soalan dua', options: [{ text: 'c' }, { text: 'd' }] },
    ],
  }
  const props = { level: 'T1', code: 'PKSK_MATH' }

  it('shows the domain name, an input per item, and posts the answers then opens the domain list', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    api.submitPkskPractice.mockResolvedValue({ masteryPct: 50, sessionId: 's', gamification: {} })
    const w = await render(PkskPracticePage, '/pksk/level/T1/domain/PKSK_MATH', '/pksk/level/:level/domain/:code', props)
    expect(w.get('[data-testid=pksk-practice]').attributes('data-provisional')).toBe('L-2')
    expect(w.get('h2').text()).toBe('Matematik')
    expect(w.findAll('[data-testid=pksk-item]')).toHaveLength(2)
    expect(w.findAll('[data-testid=pksk-option]')).toHaveLength(4)
    await w.findAll('[data-testid=pksk-option]')[1]?.setValue(true)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitPkskPractice).toHaveBeenCalledWith('T1', 'PKSK_MATH', [
      { questionId: 11, optionIndex: 1 },
      { questionId: 12 },
    ])
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1/domains')
  })

  it('uses a text area for a Bahagian C item', async () => {
    api.fetchPkskPractice.mockResolvedValue({
      domain: { id: 15, code: 'PKSK_ESSAY', name: 'Artikulasi Penulisan', bahagian: 'C' },
      questions: [{ id: 99, questionText: 'Tulis esei', options: [] }],
    })
    const w = await render(PkskPracticePage, '/pksk/level/T1/domain/PKSK_ESSAY', '/pksk/level/:level/domain/:code', { level: 'T1', code: 'PKSK_ESSAY' })
    expect(w.find('[data-testid=pksk-option]').exists()).toBe(false)
    await w.get('[data-testid=pksk-essay]').setValue('Esei saya')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitPkskPractice).toHaveBeenCalledWith('T1', 'PKSK_ESSAY', [
      { questionId: 99, text: 'Esei saya' },
    ])
  })

  it('raises the 404 outcome for an unknown domain code', async () => {
    api.fetchPkskPractice.mockRejectedValue(notFound())
    await render(PkskPracticePage, '/pksk/level/T1/domain/PKSK_XYZ', '/pksk/level/:level/domain/:code', { level: 'T1', code: 'PKSK_XYZ' })
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('PkskExamPage (S4b, provisional L-3)', () => {
  it('groups the items A / B / C and posts every item then opens the dashboard', async () => {
    const q = (id: number, options: { text: string }[]) => ({ id, questionText: `S${String(id)}`, options })
    const exam: PkskExam = {
      sections: [
        { bahagian: 'A', weightPct: 20, questions: [q(1, [{ text: 'x' }, { text: 'y' }])] },
        { bahagian: 'B', weightPct: 70, questions: [q(2, [{ text: 'x' }, { text: 'y' }])] },
        { bahagian: 'C', weightPct: 10, questions: [q(3, [])] },
      ],
    }
    api.fetchPkskExam.mockResolvedValue(exam)
    api.submitPkskExam.mockResolvedValue({ id: 1, completedAt: '', scorePct: 0, grade: 'E' })
    const w = await render(PkskExamPage, '/pksk/level/T1/exam', '/pksk/level/:level/exam', { level: 'T1' })
    expect(w.get('[data-testid=pksk-exam]').attributes('data-provisional')).toBe('L-3')
    expect(w.get('h2').text()).toBe('Peperiksaan Penuh')
    expect(w.findAll('h3').map((h) => h.text())).toEqual(['Bahagian A', 'Bahagian B', 'Bahagian C'])
    expect(w.findAll('[data-testid=pksk-item]')).toHaveLength(3)
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitPkskExam).toHaveBeenCalledWith('T1', [
      { questionId: 1 },
      { questionId: 2 },
      { questionId: 3 },
    ])
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1')
  })

  it('redirects to /pksk on 403', async () => {
    api.fetchPkskExam.mockRejectedValue(forbidden())
    await render(PkskExamPage, '/pksk/level/T1/exam', '/pksk/level/:level/exam', { level: 'T1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk')
  })
})
