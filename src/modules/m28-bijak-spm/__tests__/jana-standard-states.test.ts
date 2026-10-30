// @vitest-environment jsdom
// BJS-F5: student Jana Kertas standard states (S1-a..e), shortage line formats, the 5-line cap.
import type { BijakGenerateShortage } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import GenerateShortageAlert from '../components/GenerateShortageAlert.vue'
import { shortageLine } from '../lib/shortage-lines'
import BijakHubPage from '../pages/BijakHubPage.vue'

const server = vi.hoisted(() => ({
  subjects: vi.fn(),
  listPapers: vi.fn(),
  listContracts: vi.fn(),
  generatePaper: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const REASON = 'Belum ada kontrak untuk subjek dan kertas ini'
const row = (extra: Record<string, unknown> = {}) => ({
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 1,
  source: 'Disahkan',
  code: '1449/1',
  durationMin: 150,
  sections: [{ label: 'Bahagian A', take: 40 }],
  canGenerate: true,
  ...extra,
})

describe('shortageLine formats (design 7.2)', () => {
  const cases: [string, BijakGenerateShortage, string][] = [
    [
      'count (AC-03.2)',
      { section: 'Bahagian A', need: 40, have: 31 },
      'Bahagian A: perlu 40 soalan, hanya 31 tersedia',
    ],
    [
      'count kind',
      { section: 'Bahagian A', need: 40, have: 31, kind: 'count' },
      'Bahagian A: perlu 40 soalan, hanya 31 tersedia',
    ],
    [
      'marks (AC-34.4)',
      { section: 'Bahagian B', need: 60, have: 0, kind: 'marks' },
      'Bahagian B: tidak dapat menyusun 60 markah daripada soalan yang tersedia',
    ],
    [
      'tp none eligible (AC-35.8)',
      { section: 'Bahagian B', need: 2, have: 0, kind: 'tp', slot: { from: 3, to: 4 }, tp: { min: 5, max: 6 } },
      'Bahagian B soalan 3-4: tiada soalan layak pada TP 5-6',
    ],
    [
      'unit by questions (AC-36.7)',
      {
        section: 'Bahagian A',
        need: 4,
        have: 2,
        kind: 'unit',
        basis: 'questions',
        unit: { kind: 'unit', nodeId: 'n1', level: 'T5', code: '5.0', title: 'Transformasi' },
      },
      'Bahagian A: perlu 4 soalan T5 5.0 Transformasi, hanya 2 tersedia',
    ],
    [
      'unit by marks (AC-36.7)',
      { section: 'Bahagian C', need: 8, have: 3, kind: 'unit', basis: 'marks', unit: { kind: 't1_t3' } },
      'Bahagian C: perlu 8 markah T1-T3, hanya 3 tersedia',
    ],
    [
      'level share (AC-36.8)',
      { section: 'Bahagian A', need: 1, have: 0, kind: 'level_share' },
      'Bahagian A: nisbah Tingkatan 4 : 5 tidak dapat dipenuhi daripada soalan yang tersedia',
    ],
    [
      'kbat (AC-37.4)',
      { section: 'Bahagian B', need: 12, have: 4, kind: 'kbat' },
      'Bahagian B: perlu 12 markah KBAT, hanya 4 tersedia',
    ],
    [
      'combination',
      { section: 'Bahagian B', need: 1, have: 0, kind: 'combination', blocking: 'kbat' },
      'Bahagian B: syarat KBAT tidak dapat dipenuhi bersama syarat lain',
    ],
    [
      'overlap',
      { section: 'Bahagian B', need: 1, have: 0, kind: 'overlap', otherSection: 'Bahagian A' },
      'Bahagian B: soalan yang diperlukan telah digunakan oleh Bahagian A',
    ],
  ]
  it.each(cases)('%s', (_n, s, text) => {
    expect(shortageLine(s)).toBe(text)
  })
})

describe('GenerateShortageAlert', () => {
  let w: VueWrapper | null = null
  afterEach(() => {
    w?.unmount()
    w = null
    document.body.innerHTML = ''
  })
  const lines = (n: number): BijakGenerateShortage[] =>
    Array.from({ length: n }, (_, i) => ({ section: `Bahagian ${i + 1}`, need: 5, have: 1 }))

  it('shows all lines without a toggle at 5', () => {
    w = mount(GenerateShortageAlert, { props: { shortages: lines(5) }, attachTo: document.body })
    expect(w.findAll('[data-testid="shortage-line"]')).toHaveLength(5)
    expect(w.find('[data-testid="shortage-more"]').exists()).toBe(false)
    expect(w.text()).toContain('Kertas tidak dapat dijana kerana soalan tidak mencukupi.')
    expect(w.text()).toContain('Cuba subjek atau kertas lain, atau cuba lagi kemudian.')
  })

  it('caps at 5 and expands behind "Tunjuk {n} lagi"', async () => {
    w = mount(GenerateShortageAlert, { props: { shortages: lines(8) }, attachTo: document.body })
    expect(w.findAll('[data-testid="shortage-line"]')).toHaveLength(5)
    const more = w.get('[data-testid="shortage-more"]')
    expect(more.text()).toBe('Tunjuk 3 lagi')
    await more.trigger('click')
    expect(w.findAll('[data-testid="shortage-line"]')).toHaveLength(8)
    expect(w.find('[data-testid="shortage-more"]').exists()).toBe(false)
  })

  it('moves focus to the alert region', async () => {
    w = mount(GenerateShortageAlert, { props: { shortages: lines(1) }, attachTo: document.body })
    await flushPromises()
    expect(document.activeElement).toBe(w.get('[data-testid="shortage-focus"]').element)
    expect(w.get('[data-testid="shortage"]').attributes('role')).toBe('alert')
  })
})

describe('BijakHubPage Jana Kertas tab', () => {
  let wrapper: VueWrapper | null = null
  const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)

  beforeEach(() => {
    server.subjects.mockReturnValue([
      { code: 'MAT', name: 'Matematik' },
      { code: 'SEJ', name: 'Sejarah' },
    ])
    server.listPapers.mockResolvedValue([])
    server.listContracts.mockResolvedValue([row()])
    server.generatePaper.mockReset()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  async function render(contracts: unknown[] = [row()]): Promise<void> {
    server.listContracts.mockResolvedValue(contracts)
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spm', component: stub },
        { path: '/spm/bijak', name: 'm28.bijak', component: stub },
        { path: '/spm/bijak/sejarah', component: stub },
        { path: '/spm/bijak/kertas/:paperId', name: 'm28.bijak.cover', component: stub },
      ],
    })
    await router.push('/spm/bijak?tab=jana')
    wrapper = mount(BijakHubPage, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
  }

  it('S1-a: usable contract shows the card and an enabled button', async () => {
    await render()
    expect(q('[data-testid="contract"]')?.textContent).toContain('Bahagian A: 40 soalan')
    expect(q('[data-testid="no-contract"]')).toBeNull()
    const btn = q('[data-testid="generate"]')!
    expect(btn.getAttribute('aria-disabled')).toBeNull()
    expect(btn.textContent).toContain('Jana Kertas')
    expect(q('[data-testid="spec-badge"]')).toBeNull()
  })

  it('S1-b: canGenerate false hides the card, explains, and press does nothing', async () => {
    await render([row({ source: 'Spec', canGenerate: false, unavailableReason: 'NO_BLUEPRINT' })])
    expect(q('[data-testid="contract"]')).toBeNull()
    const reason = q('[data-testid="no-contract"]')!
    expect(reason.textContent).toContain(REASON)
    expect(reason.getAttribute('role')).toBe('status')
    const btn = q('[data-testid="generate"]')!
    expect(btn.getAttribute('aria-disabled')).toBe('true')
    expect(btn.getAttribute('aria-describedby')).toBe(reason.id)
    btn.click()
    await flushPromises()
    expect(server.generatePaper).not.toHaveBeenCalled()
  })

  it('S1-b: no row at all (subject without contract) shows the same reason', async () => {
    await render([])
    expect(q('[data-testid="no-contract"]')?.textContent).toContain(REASON)
    expect(q('[data-testid="generate"]')?.getAttribute('aria-disabled')).toBe('true')
  })

  it('AC-39.6: a Spec contract usable by the Admin Pusat tester shows the test badge', async () => {
    await render([row({ source: 'Spec' })])
    expect(q('[data-testid="spec-badge"]')?.textContent).toContain('Spec - ujian sahaja')
    expect(q('[data-testid="spec-note"]')?.textContent).toContain(
      'Data ujian: tidak dikira dalam analitik, kedudukan atau ganjaran.',
    )
  })

  it('S1-c: generating disables the selects and shows the caption', async () => {
    let release!: (v: unknown) => void
    server.generatePaper.mockReturnValue(new Promise((r) => (release = r)))
    await render()
    q('[data-testid="generate"]')!.click()
    await flushPromises()
    expect(q('[data-testid="tab-jana"]')?.getAttribute('aria-busy')).toBe('true')
    expect(q('[data-testid="generating"]')?.textContent).toContain(
      'Menyusun kertas mengikut kontrak...',
    )
    expect(q('[data-testid="generate"]')?.textContent).toContain('Menjana...')
    release({ ok: true, paperId: 'jana-1' })
    await flushPromises()
    expect(q('[data-testid="generating"]')).toBeNull()
  })

  it('S1-d: shortage lists the first lines, caps at 5 and keeps the AC wording', async () => {
    server.generatePaper.mockResolvedValue({
      ok: false,
      reason: 'shortage',
      shortages: [
        { section: 'Bahagian A', need: 40, have: 31 },
        { section: 'Bahagian B', need: 60, have: 0, kind: 'marks' },
        { section: 'Bahagian B', need: 12, have: 4, kind: 'kbat' },
        { section: 'Bahagian C', need: 1, have: 0, kind: 'level_share' },
        { section: 'Bahagian D', need: 2, have: 0, kind: 'tp', slot: { from: 1, to: 2 }, tp: { min: 1, max: 2 } },
        { section: 'Bahagian E', need: 9, have: 1 },
        { section: 'Bahagian F', need: 9, have: 1 },
      ],
    })
    await render()
    q('[data-testid="generate"]')!.click()
    await flushPromises()
    const lines = [...document.body.querySelectorAll('[data-testid="shortage-line"]')]
    expect(lines).toHaveLength(5)
    expect(lines[0]!.textContent?.trim()).toBe('Bahagian A: perlu 40 soalan, hanya 31 tersedia')
    expect(q('[data-testid="shortage-more"]')?.textContent).toContain('Tunjuk 2 lagi')
    expect(document.activeElement).toBe(q('[data-testid="shortage-focus"]'))
    expect(q('[data-testid="generate-error"]')).toBeNull()
  })

  it('S1-e: a failure shows the error with Cuba Semula, which retries', async () => {
    server.generatePaper.mockRejectedValueOnce(new Error('offline'))
    await render()
    q('[data-testid="generate"]')!.click()
    await flushPromises()
    expect(q('[data-testid="generate-error"]')?.textContent).toContain(
      'Kertas tidak dapat dijana sekarang. Cuba lagi.',
    )
    server.generatePaper.mockResolvedValueOnce({ ok: true, paperId: 'jana-2' })
    q('[data-testid="generate-retry"]')!.click()
    await flushPromises()
    expect(server.generatePaper).toHaveBeenCalledTimes(2)
    expect(q('[data-testid="generate-error"]')).toBeNull()
  })

  it('503 GENERATE_LIMIT shows the solver-budget message with Cuba Semula, no shortage', async () => {
    server.generatePaper.mockResolvedValue({ ok: false, reason: 'limit', limitSections: [] })
    await render()
    q('[data-testid="generate"]')!.click()
    await flushPromises()
    expect(q('[data-testid="generate-error"]')?.textContent).toContain(
      'Kertas tidak dapat disusun sekarang. Cuba lagi.',
    )
    expect(q('[data-testid="generate-retry"]')).not.toBeNull()
    expect(q('[data-testid="shortage"]')).toBeNull()
  })
})
