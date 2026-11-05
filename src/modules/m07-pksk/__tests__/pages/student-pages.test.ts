// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router'
import { defineComponent, h } from 'vue'

import { ApiError } from '@/api'
import { useRouteOutcome } from '@/app/router/outcome'

import type {
  PkskDashboard,
  PkskDomain,
  PkskDomainSection,
  PkskExam,
  PkskExamAttempt,
  PkskPractice,
  PkskPracticeResult,
} from '../../api/types'
import PkskDashboardPage from '../../pages/PkskDashboardPage.vue'
import PkskDomainsPage from '../../pages/PkskDomainsPage.vue'
import PkskExamPage from '../../pages/PkskExamPage.vue'
import PkskHistoryPage from '../../pages/PkskHistoryPage.vue'
import PkskHubPage from '../../pages/PkskHubPage.vue'
import PkskPracticePage from '../../pages/PkskPracticePage.vue'
import { PKSK_PACKAGES } from '../../lib/levels'
import { pkskRefusal } from '../../lib/load'
import studentRoutes from '../../routes/student'

const api = vi.hoisted(() => ({
  fetchPkskAccess: vi.fn(),
  fetchPkskDomains: vi.fn(),
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
  wrapper?.unmount()
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, component, props: (r) => ({ ...r.params, ...props }) },
      { path: '/pksk', component: { template: '<div id="hub"/>' } },
      { path: '/pksk/:rest(.*)*', component: { template: '<div id="other"/>' } },
    ],
  })
  await router.push(path)
  // Mounted through a RouterView so `onBeforeRouteLeave` finds its route record.
  wrapper = mount(defineComponent({ render: () => h(RouterView) }), {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  pkskRefusal.value = null
  api.fetchPkskDomains.mockResolvedValue([])
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
    expect(w.get('[data-testid=level-card-T1]').attributes('data-active')).toBe('true')
    expect(w.get('[data-testid=start-T1]').attributes('href')).toBe('/pksk/level/T1')
    expect(w.get('[data-testid=start-T4]').attributes('href')).toBe('/pksk/level/T4')
    expect(w.get('[data-testid=start-T4]').text()).toBe('Mula Latihan')
  })

  it('shows no badge and no green border for a level without access', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: false })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.findAll('[data-testid=badge-aktif]')).toHaveLength(1)
    const t4 = w.get('[data-testid=level-card-T4]')
    expect(t4.attributes('data-active')).toBe('false')
    expect(w.find('[data-testid=start-T4]').exists()).toBe(true)
  })

  const dom = (
    order: number,
    bahagian: 'A' | 'B' | 'C',
    name: string,
    questionCount: number,
    isActive = true,
  ): PkskDomain => ({
    id: order,
    bahagian,
    name,
    nameEn: name,
    code: `PKSK_${String(order)}`,
    icon: 'x',
    color: '#000',
    order,
    isActive,
    questionCount,
    createdAt: '',
    updatedAt: '',
  })

  it('shows the count tiles, the Bahagian sums and the 12 largest domains, with or without a grant', async () => {
    const list = [
      ...Array.from({ length: 14 }, (_, i) =>
        dom(i + 1, i < 3 ? 'A' : 'B', `Domain ${String(i + 1)}`, i + 1),
      ),
      dom(15, 'C', 'Esei', 4),
      dom(16, 'B', 'Tidak aktif', 999, false),
    ]
    for (const access of [
      { T1: false, T4: false },
      { T1: true, T4: false },
    ]) {
      api.fetchPkskAccess.mockResolvedValue(access)
      api.fetchPkskDomains.mockResolvedValue(list)
      const w = await render(PkskHubPage, '/pksk', '/pksk')
      // 1..14 and 4 = 109 (the inactive domain is left out); A = 1+2+3; C = 4.
      expect(w.get('[data-testid=tile-total]').text()).toContain('109')
      expect(w.get('[data-testid=tile-total]').text()).toContain('Jumlah soalan')
      expect(w.get('[data-testid=tile-bahagian]').text()).toContain('3')
      expect(w.get('[data-testid=tile-domain]').text()).toContain('15')
      expect(w.get('[data-testid=bahagian-row-A]').text()).toBe('Bahagian A6')
      expect(w.get('[data-testid=bahagian-row-B]').text()).toBe('Bahagian B99')
      expect(w.get('[data-testid=bahagian-row-C]').text()).toBe('Bahagian C4')
      const top = w.findAll('[data-testid=top-domain]').map((r) => r.text())
      expect(top).toHaveLength(12)
      expect(top[0]).toBe('Domain 14' + '14 soalan')
      // 4 soalan is tied between Domain 4 and Esei: the lower order comes first.
      expect(top[10]).toBe('Domain 4' + '4 soalan')
      expect(top[11]).toBe('Esei' + '4 soalan')
      expect(top.join()).not.toContain('Tidak aktif')
      w.unmount()
      wrapper = null
    }
  })

  it('breaks ties of Domain teratas by the domain order', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: false })
    api.fetchPkskDomains.mockResolvedValue([dom(2, 'B', 'Kedua', 5), dom(1, 'A', 'Pertama', 5)])
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.findAll('[data-testid=top-domain]').map((r) => r.text())).toEqual([
      'Pertama5 soalan',
      'Kedua5 soalan',
    ])
  })

  it('lists the five static packages with the owner note', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: false })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    const block = w.get('[data-testid=block-pakej]')
    expect(block.text()).toContain('Pakej ini diaktifkan oleh pentadbir sekolah anda.')
    expect(w.findAll('[data-testid=pakej-row]').map((r) => r.text())).toEqual(
      PKSK_PACKAGES.map((p) => `${p.name}${p.price}`),
    )
    expect(PKSK_PACKAGES.map((p) => p.price)).toEqual([
      'RM0.00',
      'RM0.00',
      'RM0.00',
      'RM39.00',
      'RM79.00',
    ])
  })

  it('shows the no-access banner and hides Mula Latihan when neither level is granted', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: false, T4: false })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    const banner = w.get('[data-testid=no-access-banner]').text()
    expect(banner).toContain('Anda belum mempunyai akses PKSK PRO')
    expect(banner).toContain(
      'Akses PKSK diberikan oleh pentadbir sekolah anda. Hubungi guru atau pentadbir sekolah untuk mengaktifkan pakej.',
    )
    expect(w.find('[data-testid=start-T1]').exists()).toBe(false)
    expect(w.find('[data-testid=start-T4]').exists()).toBe(false)
    // The Bahagian cards stay plain boxes without a grant.
    expect(w.get('[data-testid=format-A]').element.tagName).toBe('DIV')
  })

  it('has no banner with a grant and links the Bahagian cards to the first granted level', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: false, T4: true })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.find('[data-testid=no-access-banner]').exists()).toBe(false)
    for (const b of ['A', 'B', 'C']) {
      expect(w.get(`[data-testid=format-${b}]`).attributes('href')).toBe('/pksk/level/T4/domains')
    }
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: true })
    const w2 = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w2.get('[data-testid=format-A]').attributes('href')).toBe('/pksk/level/T1/domains')
  })

  it('shows the API refusal message kept from a 403 of a level page', async () => {
    api.fetchPkskDashboard.mockRejectedValue(
      new ApiError({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Anda tidak dibenarkan melakukan tindakan ini.',
      }),
    )
    await render(PkskDashboardPage, '/pksk/level/T1', '/pksk/level/:level', { level: 'T1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk')
    expect(pkskRefusal.value).toBe('Anda tidak dibenarkan melakukan tindakan ini.')
    wrapper?.unmount()
    api.fetchPkskAccess.mockResolvedValue({ T1: false, T4: false })
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.get('[data-testid=pksk-refusal]').text()).toContain(
      'Anda tidak dibenarkan melakukan tindakan ini.',
    )
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
    expect(w.get('[data-testid=exam-count]').text()).toContain('0')
    expect(w.get('[data-testid=avg-b]').text()).toContain('0.0%')
    expect(w.get('[data-ds=back-link]').attributes('href')).toBe('/pksk')
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
    expect(w.get('[data-testid=mastery-bar]').html()).toContain('70')
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
    expect(w.get('[data-testid=avg-b]').text()).toContain('59.7%')
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
        domains: [
          domain('PKSK_INSANIAH', 'Kecerdasan Insaniah', { questionCount: 12, masteryPct: 0 }),
        ],
      },
      {
        bahagian: 'B',
        name: 'Kecerdasan Intelek',
        subtitle: 'Kognitif & penaakulan',
        domains: [domain('PKSK_MATH', 'Matematik', { questionCount: 27, masteryPct: 70 })],
      },
    ]
    api.fetchPkskDomainSections.mockResolvedValue(sections)
    const w = await render(
      PkskDomainsPage,
      '/pksk/level/T1/domains',
      '/pksk/level/:level/domains',
      {
        level: 'T1',
      },
    )
    expect(w.get('[data-ds=back-link]').text()).toBe('Kembali ke Dashboard')
    expect(w.get('[data-ds=back-link]').attributes('href')).toBe('/pksk/level/T1')
    expect(w.get('[data-testid=section-B] h2').text()).toBe('Kecerdasan Intelek')
    expect(w.get('[data-testid=section-B] [data-testid=section-badge]').text()).toBe('B')
    const card = w.get('[data-testid=section-B] [data-testid=domain-card]')
    expect(card.attributes('href')).toBe('/pksk/level/T1/domain/PKSK_MATH')
    expect(card.get('[data-testid=question-count]').text()).toBe('27')
    expect(card.text()).toContain('Soalan')
    expect(card.get('[data-testid=mastery-pct]').text()).toBe('70%')
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

  it('renders the read-only table, newest first, dd/mm/yyyy', async () => {
    api.fetchPkskExamAttempts.mockResolvedValue(attempts)
    const w = await render(
      PkskHistoryPage,
      '/pksk/level/T1/history',
      '/pksk/level/:level/history',
      {
        level: 'T1',
      },
    )
    expect(w.get('[data-testid=pksk-history]').attributes('data-provisional')).toBeUndefined()
    expect(w.find('[data-provisional]').exists()).toBe(false)
    expect(w.findAll('th').map((t) => t.text())).toEqual(['Tarikh', 'Skor', 'Gred'])
    expect(w.findAll('tbody tr').map((r) => r.findAll('td').map((c) => c.text()))).toEqual([
      ['20/09/2026', '64%', 'C'],
      ['10/09/2026', '46%', 'D'],
    ])
    expect(w.get('table').findAll('a, button, select, input')).toHaveLength(0)
  })

  it('shows the empty text instead of the table', async () => {
    api.fetchPkskExamAttempts.mockResolvedValue([])
    const w = await render(
      PkskHistoryPage,
      '/pksk/level/T4/history',
      '/pksk/level/:level/history',
      {
        level: 'T4',
      },
    )
    expect(w.get('[data-testid=history-empty]').text()).toBe('Belum ada sejarah peperiksaan.')
    expect(w.find('table').exists()).toBe(false)
  })
})

const body = (sel: string): HTMLElement | null => document.body.querySelector(sel)
const press = async (sel: string): Promise<void> => {
  const el = body(sel)
  if (!el) throw new Error(`missing ${sel}`)
  el.click()
  await flushPromises()
}

describe('PkskPracticePage (S4a)', () => {
  const practice: PkskPractice = {
    domain: { id: 2, code: 'PKSK_MATH', name: 'Matematik', bahagian: 'B' },
    questions: [
      { id: 11, questionText: 'Soalan satu', options: [{ text: 'a' }, { text: 'b' }] },
      { id: 12, questionText: 'Soalan dua', options: [{ text: 'c' }, { text: 'd' }] },
    ],
  }
  const props = { level: 'T1', code: 'PKSK_MATH' }
  const path = '/pksk/level/T1/domain/PKSK_MATH'
  const route = '/pksk/level/:level/domain/:code'
  const result = (extra: Partial<PkskPracticeResult> = {}): PkskPracticeResult => ({
    correct: 1,
    total: 2,
    masteryPct: 50,
    sessionId: 's',
    gamification: { coinsEarned: 5, pointsEarned: 20, streakCount: 1, totalBalance: 5 },
    review: [
      {
        questionId: 11,
        selectedIndex: 1,
        correctIndex: 0,
        isCorrect: false,
        explanation: 'Kerana a.',
      },
      { questionId: 12, selectedIndex: 0, correctIndex: 0, isCorrect: true, explanation: null },
    ],
    ...extra,
  })

  it('shows the domain name and an input per item, with no provisional tag', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, path, route, props)
    expect(w.find('[data-provisional]').exists()).toBe(false)
    expect(w.get('h2').text()).toBe('Matematik')
    expect(w.findAll('[data-testid=pksk-item]')).toHaveLength(2)
    expect(w.findAll('[data-testid=pksk-option]')).toHaveLength(4)
    expect(api.submitPkskPractice).not.toHaveBeenCalled()
  })

  it('asks to confirm Hantar, naming the blank count, and posts only after Hantar', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    api.submitPkskPractice.mockResolvedValue(result())
    const w = await render(PkskPracticePage, path, route, props)
    await w.findAll('[data-testid=pksk-option]')[1]?.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitPkskPractice).not.toHaveBeenCalled()
    const dialog = document.body.textContent ?? ''
    expect(dialog).toContain('Anda belum menjawab 1 soalan.')
    expect(dialog).toContain('Hantar jawapan anda sekarang?')
    expect(body('[data-testid=confirm-cancel]')?.textContent?.trim()).toBe('Batal')
    expect(body('[data-testid=confirm-submit]')?.textContent?.trim()).toBe('Hantar')
    await press('[data-testid=confirm-submit]')
    expect(api.submitPkskPractice).toHaveBeenCalledWith('T1', 'PKSK_MATH', [
      { questionId: 11, optionIndex: 1 },
      { questionId: 12 },
    ])
    // The result view replaces the set; no redirect.
    expect(router.currentRoute.value.path).toBe(path)
    expect(w.find('[data-testid=practice-result]').exists()).toBe(true)
  })

  it('leaves the blank line out when everything is answered, and Batal sends nothing', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, path, route, props)
    const options = w.findAll('[data-testid=pksk-option]')
    await options[0]?.trigger('click')
    await options[2]?.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    const dialog = document.body.textContent ?? ''
    expect(dialog).not.toContain('Anda belum menjawab')
    expect(dialog).toContain('Hantar jawapan anda sekarang?')
    await press('[data-testid=confirm-cancel]')
    expect(api.submitPkskPractice).not.toHaveBeenCalled()
    expect(body('[data-testid=confirm-cancel]')).toBeNull()
  })

  it('counts an essay with only spaces as blank', async () => {
    api.fetchPkskPractice.mockResolvedValue({
      domain: { id: 15, code: 'PKSK_ESSAY', name: 'Artikulasi Penulisan', bahagian: 'C' },
      questions: [{ id: 99, questionText: 'Tulis esei', options: [] }],
    })
    const w = await render(PkskPracticePage, '/pksk/level/T1/domain/PKSK_ESSAY', route, {
      level: 'T1',
      code: 'PKSK_ESSAY',
    })
    await w.get('[data-testid=pksk-essay]').setValue('   ')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(document.body.textContent).toContain('Anda belum menjawab 1 soalan.')
  })

  it('shows Menghantar... on the primary button while sending', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    let finish: (r: PkskPracticeResult) => void = () => undefined
    api.submitPkskPractice.mockReturnValue(new Promise((r) => (finish = r)))
    const w = await render(PkskPracticePage, path, route, props)
    await w.get('form').trigger('submit')
    await flushPromises()
    await press('[data-testid=confirm-submit]')
    expect(body('[data-testid=confirm-submit]')?.textContent).toContain('Menghantar...')
    finish(result())
    await flushPromises()
    expect(w.find('[data-testid=practice-result]').exists()).toBe(true)
  })

  it('guards the header close with the leave dialog once an answer exists, and Teruskan Kuiz stays', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, path, route, props)
    await w.findAll('[data-testid=pksk-option]')[0]?.trigger('click')
    await w.get('[data-ds=quiz-close]').trigger('click')
    await flushPromises()
    const dialog = document.body.textContent ?? ''
    expect(dialog).toContain('Keluar daripada kuiz?')
    expect(dialog).toContain('Jawapan anda belum dihantar dan akan hilang.')
    expect(body('[data-testid=leave-stay]')?.textContent?.trim()).toBe('Teruskan Kuiz')
    expect(body('[data-testid=leave-confirm]')?.textContent?.trim()).toBe('Keluar')
    expect(router.currentRoute.value.path).toBe(path)
    await press('[data-testid=leave-stay]')
    expect(router.currentRoute.value.path).toBe(path)
    expect(body('[data-testid=leave-stay]')).toBeNull()
  })

  it('guards the back link too, and Keluar leaves', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, path, route, props)
    await w.findAll('[data-testid=pksk-option]')[0]?.trigger('click')
    await w.get('[data-ds=back-link]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(path)
    expect(body('[data-testid=leave-confirm]')).not.toBeNull()
    await press('[data-testid=leave-confirm]')
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1/domains')
  })

  it('does not guard without an answer', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, path, route, props)
    await w.get('[data-ds=quiz-close]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1/domains')
  })

  it('does not guard after a successful submit', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    api.submitPkskPractice.mockResolvedValue(result())
    const w = await render(PkskPracticePage, path, route, props)
    await w.findAll('[data-testid=pksk-option]')[0]?.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    await press('[data-testid=confirm-submit]')
    await router.push('/pksk/level/T1/domains')
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1/domains')
    expect(body('[data-testid=leave-confirm]')).toBeNull()
  })

  it('renders the result view: heading, tiles and the review of every question', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    api.submitPkskPractice.mockResolvedValue(result())
    const w = await render(PkskPracticePage, path, route, props)
    await w.findAll('[data-testid=pksk-option]')[1]?.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    await press('[data-testid=confirm-submit]')
    expect(w.get('[data-testid=result-title]').text()).toBe('Kuiz Selesai!')
    expect(w.get('[data-testid=result-sub]').text()).toBe(
      'Tahniah, anda telah lengkapkan Matematik.',
    )
    expect(w.get('[data-testid=tile-markah]').text()).toContain('1/2')
    expect(w.get('[data-testid=tile-markah]').text()).toContain('Markah')
    expect(w.get('[data-testid=tile-ketepatan]').text()).toContain('50%')
    expect(w.get('[data-testid=tile-syiling]').text()).toContain('+5')
    expect(w.get('[data-testid=tile-syiling]').text()).toContain('Syiling')
    expect(w.get('[data-testid=tile-mata]').text()).toContain('+20')
    const items = w.findAll('[data-testid=review-item]')
    expect(items).toHaveLength(2)
    expect(items[0]?.get('[data-testid=review-verdict]').text()).toBe('Salah')
    expect(items[0]?.get('[data-testid=review-chosen]').text()).toContain('B. b')
    expect(items[0]?.get('[data-testid=review-correct]').text()).toContain('A. a')
    expect(items[0]?.get('[data-testid=review-explanation]').text()).toContain('Kerana a.')
    expect(items[1]?.get('[data-testid=review-verdict]').text()).toBe('Betul')
    expect(items[1]?.find('[data-testid=review-explanation]').exists()).toBe(false)
    // No essay: no indicative label or note.
    expect(w.find('[data-testid=review-indicative]').exists()).toBe(false)
    expect(w.find('[data-testid=essay-note]').exists()).toBe(false)
    expect(w.get('[data-testid=result-domains]').attributes('href')).toBe('/pksk/level/T1/domains')
    expect(w.get('[data-testid=result-retry]').text()).toBe('↻ Cuba Lagi')
  })

  it('labels a Bahagian C result as indicative and shows the typed essay', async () => {
    api.fetchPkskPractice.mockResolvedValue({
      domain: { id: 15, code: 'PKSK_ESSAY', name: 'Artikulasi Penulisan', bahagian: 'C' },
      questions: [{ id: 99, questionText: 'Tulis esei', options: [] }],
    })
    api.submitPkskPractice.mockResolvedValue(
      result({
        correct: 0,
        total: 1,
        masteryPct: 0,
        review: [
          {
            questionId: 99,
            selectedIndex: null,
            correctIndex: null,
            isCorrect: false,
            explanation: null,
          },
        ],
      }),
    )
    const w = await render(PkskPracticePage, '/pksk/level/T1/domain/PKSK_ESSAY', route, {
      level: 'T1',
      code: 'PKSK_ESSAY',
    })
    await w.get('[data-testid=pksk-essay]').setValue('Esei saya')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitPkskPractice).not.toHaveBeenCalled()
    await press('[data-testid=confirm-submit]')
    expect(api.submitPkskPractice).toHaveBeenCalledWith('T1', 'PKSK_ESSAY', [
      { questionId: 99, text: 'Esei saya' },
    ])
    const item = w.get('[data-testid=review-item]')
    expect(item.get('[data-testid=review-indicative]').text()).toBe('Keputusan indikatif')
    expect(item.get('[data-testid=review-chosen]').text()).toContain('Esei saya')
    expect(item.find('[data-testid=review-correct]').exists()).toBe(false)
    expect(w.get('[data-testid=essay-note]').text()).toBe('Markah esei ialah penilaian indikatif.')
  })

  it('Cuba Lagi fetches a new set and resets the answers and the result', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    api.submitPkskPractice.mockResolvedValue(result())
    const w = await render(PkskPracticePage, path, route, props)
    await w.findAll('[data-testid=pksk-option]')[1]?.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    await press('[data-testid=confirm-submit]')
    api.fetchPkskPractice.mockResolvedValue({
      ...practice,
      questions: [{ id: 21, questionText: 'Soalan baru', options: [{ text: 'x' }] }],
    })
    await w.get('[data-testid=result-retry]').trigger('click')
    await flushPromises()
    expect(api.fetchPkskPractice).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid=practice-result]').exists()).toBe(false)
    expect(w.findAll('[data-testid=pksk-item]')).toHaveLength(1)
    // Nothing answered: leaving is not guarded.
    await w.get('[data-ds=quiz-close]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1/domains')
  })

  it('shows the API message when the submit is refused', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    api.submitPkskPractice.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Jawapan tidak sah.' }),
    )
    const w = await render(PkskPracticePage, path, route, props)
    await w.get('form').trigger('submit')
    await flushPromises()
    await press('[data-testid=confirm-submit]')
    expect(w.get('[data-testid=submit-error]').text()).toContain('Jawapan tidak sah.')
    expect(w.find('[data-testid=practice-result]').exists()).toBe(false)
  })

  it('raises the 404 outcome for an unknown domain code', async () => {
    api.fetchPkskPractice.mockRejectedValue(notFound())
    await render(PkskPracticePage, '/pksk/level/T1/domain/PKSK_XYZ', route, {
      level: 'T1',
      code: 'PKSK_XYZ',
    })
    expect(useRouteOutcome().value).toBe(404)
  })
})

describe('PkskExamPage (S4b)', () => {
  const q = (id: number, options: { text: string }[]) => ({
    id,
    questionText: `S${String(id)}`,
    options,
  })
  const exam: PkskExam = {
    sections: [
      { bahagian: 'A', weightPct: 20, questions: [q(1, [{ text: 'x' }, { text: 'y' }])] },
      {
        bahagian: 'B',
        weightPct: 70,
        questions: [q(2, [{ text: 'x' }, { text: 'y' }]), q(4, [{ text: 'x' }])],
      },
      { bahagian: 'C', weightPct: 10, questions: [q(3, [])] },
    ],
  }
  const path = '/pksk/level/T1/exam'
  const route = '/pksk/level/:level/exam'

  it('groups the items A / B / C with the real counts and an answered counter', async () => {
    api.fetchPkskExam.mockResolvedValue(exam)
    const w = await render(PkskExamPage, path, route, { level: 'T1' })
    expect(w.find('[data-provisional]').exists()).toBe(false)
    expect(w.get('h2').text()).toBe('Peperiksaan Penuh')
    expect(w.findAll('h3').map((h) => h.text())).toEqual([
      'Bahagian A (1 soalan)',
      'Bahagian B (2 soalan)',
      'Bahagian C (1 esei)',
    ])
    expect(w.findAll('[data-testid=pksk-item]')).toHaveLength(4)
    expect(w.get('[data-testid=exam-counter]').text()).toBe('0/4')
    await w.findAll('[data-testid=pksk-option]')[0]?.trigger('click')
    expect(w.get('[data-testid=exam-counter]').text()).toBe('1/4')
  })

  it('confirms Hantar with the blank count, posts every item, then shows the result in place', async () => {
    api.fetchPkskExam.mockResolvedValue(exam)
    api.submitPkskExam.mockResolvedValue({
      id: 1,
      completedAt: '',
      scorePct: 64.4,
      grade: 'C',
    })
    const w = await render(PkskExamPage, path, route, { level: 'T1' })
    await w.findAll('[data-testid=pksk-option]')[0]?.trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(api.submitPkskExam).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('Anda belum menjawab 3 soalan.')
    expect(document.body.textContent).toContain('Hantar jawapan anda sekarang?')
    await press('[data-testid=confirm-submit]')
    expect(api.submitPkskExam).toHaveBeenCalledWith('T1', [
      { questionId: 1, optionIndex: 0 },
      { questionId: 2 },
      { questionId: 4 },
      { questionId: 3 },
    ])
    expect(router.currentRoute.value.path).toBe(path)
    expect(w.get('[data-testid=result-title]').text()).toBe('Keputusan Peperiksaan')
    expect(w.get('[data-testid=tile-markah]').text()).toContain('64%')
    expect(w.get('[data-testid=tile-markah]').text()).toContain('Markah')
    expect(w.get('[data-testid=tile-gred]').text()).toContain('C')
    expect(w.get('[data-testid=tile-gred]').text()).toContain('Gred')
    expect(w.get('[data-testid=essay-note]').text()).toContain('Keputusan indikatif')
    expect(w.get('[data-testid=essay-note]').text()).toContain(
      'Markah esei ialah penilaian indikatif.',
    )
    expect(w.get('[data-testid=result-dashboard]').attributes('href')).toBe('/pksk/level/T1')
    expect(w.get('[data-testid=result-history]').attributes('href')).toBe('/pksk/level/T1/history')
    expect(w.get('[data-testid=result-history]').text()).toBe('Sejarah')
    // Leaving after the result is not guarded.
    await router.push('/pksk/level/T1')
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1')
  })

  it('leaves the blank line out when all are answered', async () => {
    api.fetchPkskExam.mockResolvedValue({
      sections: [{ bahagian: 'A', weightPct: 100, questions: [q(1, [{ text: 'x' }])] }],
    })
    const w = await render(PkskExamPage, path, route, { level: 'T1' })
    await w.get('[data-testid=pksk-option]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(document.body.textContent).not.toContain('Anda belum menjawab')
    expect(document.body.textContent).toContain('Hantar jawapan anda sekarang?')
  })

  it('guards the close button once an answer exists and Keluar leaves', async () => {
    api.fetchPkskExam.mockResolvedValue(exam)
    const w = await render(PkskExamPage, path, route, { level: 'T1' })
    await w.get('[data-testid=pksk-option]').trigger('click')
    await w.get('[data-ds=quiz-close]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(path)
    expect(document.body.textContent).toContain('Keluar daripada kuiz?')
    expect(document.body.textContent).toContain('Jawapan anda belum dihantar dan akan hilang.')
    await press('[data-testid=leave-stay]')
    expect(router.currentRoute.value.path).toBe(path)
    await w.get('[data-ds=back-link]').trigger('click')
    await flushPromises()
    await press('[data-testid=leave-confirm]')
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1')
  })

  it('redirects to /pksk on 403', async () => {
    api.fetchPkskExam.mockRejectedValue(forbidden())
    await render(PkskExamPage, path, route, { level: 'T1' })
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/pksk')
  })
})

describe('review fixes (S5-T13)', () => {
  const focusOn = (sel: string): boolean => document.activeElement === body(sel)
  const waitFocus = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()
  }
  const practice: PkskPractice = {
    domain: { id: 2, code: 'PKSK_MATH', name: 'Matematik', bahagian: 'B' },
    questions: [{ id: 11, questionText: 'Soalan satu', options: [{ text: 'a' }, { text: 'b' }] }],
  }
  const pPath = '/pksk/level/T1/domain/PKSK_MATH'
  const pRoute = '/pksk/level/:level/domain/:code'
  const esc = async (): Promise<void> => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    )
    await new Promise((r) => setTimeout(r, 50))
    await flushPromises()
  }

  it('shows no refusal on a normal hub visit, and the 403 message only once', async () => {
    api.fetchPkskAccess.mockResolvedValue({ T1: true, T4: false })
    let w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.find('[data-testid=pksk-refusal]').exists()).toBe(false)
    pkskRefusal.value = 'Akses ditolak.'
    w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.get('[data-testid=pksk-refusal]').text()).toContain('Akses ditolak.')
    expect(pkskRefusal.value).toBeNull()
    w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.find('[data-testid=pksk-refusal]').exists()).toBe(false)
  })

  it('hides Mula Latihan while the access is still loading', async () => {
    api.fetchPkskAccess.mockReturnValue(new Promise(() => undefined))
    const w = await render(PkskHubPage, '/pksk', '/pksk')
    expect(w.find('[data-testid=start-T1]').exists()).toBe(false)
  })

  it('focuses Batal when the Hantar dialog opens, and Esc keeps the page without sending', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, pPath, pRoute, { level: 'T1', code: 'PKSK_MATH' })
    await w.get('form').trigger('submit')
    await waitFocus()
    expect(focusOn('[data-testid=confirm-cancel]')).toBe(true)
    await esc()
    expect(api.submitPkskPractice).not.toHaveBeenCalled()
    expect(body('[data-testid=confirm-cancel]')).toBeNull()
    expect(w.find('[data-testid=pksk-item]').exists()).toBe(true)
  })

  it('focuses Teruskan Kuiz when the leave dialog opens, and Esc stays', async () => {
    api.fetchPkskPractice.mockResolvedValue(practice)
    const w = await render(PkskPracticePage, pPath, pRoute, { level: 'T1', code: 'PKSK_MATH' })
    await w.get('[data-testid=pksk-option]').trigger('click')
    await w.get('[data-ds=quiz-close]').trigger('click')
    await waitFocus()
    expect(focusOn('[data-testid=leave-stay]')).toBe(true)
    await esc()
    expect(body('[data-testid=leave-stay]')).toBeNull()
    expect(router.currentRoute.value.path).toBe(pPath)
  })

  it('does the same on the exam page', async () => {
    api.fetchPkskExam.mockResolvedValue({
      sections: [
        {
          bahagian: 'A',
          weightPct: 100,
          questions: [{ id: 1, questionText: 'S1', options: [{ text: 'x' }] }],
        },
      ],
    })
    const w = await render(PkskExamPage, '/pksk/level/T1/exam', '/pksk/level/:level/exam', {
      level: 'T1',
    })
    await w.get('form').trigger('submit')
    await waitFocus()
    expect(focusOn('[data-testid=confirm-cancel]')).toBe(true)
    await esc()
    expect(api.submitPkskExam).not.toHaveBeenCalled()
    await w.get('[data-testid=pksk-option]').trigger('click')
    await w.get('[data-ds=quiz-close]').trigger('click')
    await waitFocus()
    expect(focusOn('[data-testid=leave-stay]')).toBe(true)
    await esc()
    expect(router.currentRoute.value.path).toBe('/pksk/level/T1/exam')
  })

  it('shows no essay note for an empty Bahagian C section', async () => {
    api.fetchPkskExam.mockResolvedValue({
      sections: [
        {
          bahagian: 'A',
          weightPct: 90,
          questions: [{ id: 1, questionText: 'S1', options: [{ text: 'x' }] }],
        },
        { bahagian: 'C', weightPct: 10, questions: [] },
      ],
    })
    api.submitPkskExam.mockResolvedValue({ id: 1, completedAt: '', scorePct: 10, grade: 'E' })
    const w = await render(PkskExamPage, '/pksk/level/T1/exam', '/pksk/level/:level/exam', {
      level: 'T1',
    })
    await w.get('form').trigger('submit')
    await flushPromises()
    await press('[data-testid=confirm-submit]')
    expect(w.find('[data-testid=exam-result]').exists()).toBe(true)
    expect(w.find('[data-testid=essay-note]').exists()).toBe(false)
  })
})
