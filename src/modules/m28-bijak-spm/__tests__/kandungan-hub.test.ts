// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { KANDUNGAN_ROUTES } from '../admin/kandungan/api'
import KandunganHubPage from '../admin/kandungan/pages/KandunganHubPage.vue'
import LaneDatabankPage from '../admin/kandungan/pages/LaneDatabankPage.vue'
import LaneSimulasiPage from '../admin/kandungan/pages/LaneSimulasiPage.vue'

const server = vi.hoisted(() => ({
  overview: vi.fn(),
  subjects: vi.fn(),
  databankLane: vi.fn(),
  paperLane: vi.fn(),
}))
vi.mock('../admin/kandungan/client', () => ({ kandunganServer: () => server }))

const act = (activity: string, label: string, attention: number) => ({ activity, label, served: 10 - attention, total: 10, attention, basis: 'sql' })
const OVERVIEW = {
  bank: 10,
  activities: [
    act('databank', 'Databank Soalan', 3),
    act('latih_tubi_spm', 'Latih Tubi SPM', 0),
    act('bab', 'Latihan Bab', 0),
    act('simulasi_paper', 'Simulasi (kertas)', 0),
    act('simulasi_kuiz', 'Simulasi Kuiz', 0),
    act('jana_kertas', 'Jana Kertas', 0),
  ],
}

let wrapper: VueWrapper | null = null
const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)
const text = (sel: string): string => q(sel)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const media = (wide: boolean): void => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener() {}, removeEventListener() {} }))
}

beforeEach(() => {
  media(true)
  for (const f of Object.values(server)) f.mockReset()
  server.overview.mockResolvedValue(OVERVIEW)
  server.subjects.mockResolvedValue([{ id: 'MAT', name: 'Matematik' }])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function mountAt(component: object, path: string): Promise<void> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spm', name: KANDUNGAN_ROUTES.hub, component },
      { path: '/admin/spm/databank', name: KANDUNGAN_ROUTES.databank, component },
      { path: '/admin/spm/simulasi', name: KANDUNGAN_ROUTES.simulasi, component },
      { path: '/admin/spm/soalan/:qid/sunting', name: 'm28.admin.bank.edit', component: stub },
      { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: stub },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

describe('Kandungan SPM hub (AC-R1-21.1)', () => {
  it('shows the R1 lane cards in the V2 order with the V2 descriptions; lanes without a screen are hidden (AC-R1-21.1)', async () => {
    await mountAt(KandunganHubPage, '/admin/spm')
    const names = [...document.body.querySelectorAll('[data-testid^="kandungan-card-"] h2')].map((h) => h.textContent)
    expect(names).toEqual(['Databank Soalan', 'Bijak SPM'])
    expect(text('[data-testid=kandungan-card-databank]')).toContain('Bank soalan objektif SPM mengikut subjek.')
    expect(text('[data-testid=kandungan-card-simulasi]')).toContain('Kertas SPM penuh dalam format sebenar.')
    for (const k of ['tracking-a', 'subjektif', 'kertas', 'latih-tubi']) expect(q(`[data-testid=kandungan-card-${k}]`), k).toBeNull()
    expect(text('[data-testid=kandungan-intro]')).toContain('Setiap kad ialah satu laluan')
  })

  it('shows the attention count or "Semua elok", and "Buka senarai" on each card', async () => {
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(text('[data-testid=kandungan-attention-databank]')).toContain('3')
    expect(text('[data-testid=kandungan-attention-simulasi]')).toBe('Semua elok')
    expect(text('[data-testid=kandungan-open-databank]')).toBe('Buka senarai')
    expect(text('[data-testid=kandungan-open-simulasi]')).toBe('Buka senarai')
  })

  it('shows a retryable error when the overview fails', async () => {
    server.overview.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(OVERVIEW)
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(document.body.textContent).toContain('Tidak dapat memuatkan ringkasan kandungan.')
  })
})

describe('lane Databank Soalan (AC-R1-21.2)', () => {
  const row = (id: string, status: string, attention: { code: string; message: string }[] = []) => ({
    questionId: id, title: `Soalan ${id}`, subject: { id: 'MAT', name: 'Matematik' }, status, attention,
  })
  beforeEach(() => {
    server.databankLane.mockResolvedValue({
      rows: [row('1', 'approved'), row('2', 'draft', [{ code: 'not_approved', message: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.' }])],
      page: 1, pageSize: 25, total: 2,
    })
  })

  it('has the V2 filters, buttons and columns, and lists the reasons in Perhatian', async () => {
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    const body = document.body.textContent ?? ''
    // "Set Semula" appears once a filter is active (DsFilterBar showReset auto); it is asserted in the apply test below.
    for (const s of ['Semua Subjek', 'Semua Status', 'Tapis', 'Senarai', 'Tajuk', 'Perhatian', 'Tindakan']) expect(body, s).toContain(s)
    expect(q('[data-testid=lane-search]')).not.toBeNull()
    expect(text('[data-testid=lane-databank]')).toContain('Belum diluluskan — tekan Terbitkan untuk memaparkannya.')
    expect(q('[data-testid=lane-edit-2]')).not.toBeNull()
  })

  it('applies Subjek, Status and Cari with Tapis and clears them with Set Semula', async () => {
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    expect(server.databankLane).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
    const set = async (sel: string, v: string): Promise<void> => {
      const el = q(sel) as HTMLInputElement
      el.value = v
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
      await flushPromises()
    }
    await set('[data-testid=lane-subject]', 'MAT')
    await set('[data-testid=lane-status]', 'draft')
    await set('[data-testid=lane-search] input, input[data-testid=lane-search]', 'luas')
    const apply = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tapis')
    expect(apply).toBeDefined()
    apply!.click()
    await flushPromises()
    expect(server.databankLane).toHaveBeenLastCalledWith({ subjectId: 'MAT', status: 'draft', search: 'luas', page: 1, pageSize: 25 })
    const reset = [...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Set Semula')
    reset!.click()
    await flushPromises()
    expect(server.databankLane).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
  })
})

describe('lane Bijak SPM (AC-R1-21.2)', () => {
  const paper = (id: string, status: 'draft' | 'published', questionCount: number, attention: { code: string; message: string; count: number }[] = []) => ({
    paperId: id, title: `Kertas ${id}`, subject: { id: 'MAT', name: 'Matematik' }, status, questionCount, attentionCount: attention.length, attention,
  })
  it('on a narrow screen the card list carries the same Perhatian text and Sunting', async () => {
    media(false)
    server.paperLane.mockResolvedValue({
      rows: [paper('p1', 'published', 0)],
      page: 1, pageSize: 25, total: 1,
    })
    await mountAt(LaneSimulasiPage, '/admin/spm/simulasi')
    expect(document.body.textContent).toContain('Disajikan tetapi tiada soalan')
    expect(q('[data-testid=lane-edit-p1]')).not.toBeNull()
  })

  it('shows Terbit/Draf, "{subjek} · {n} soalan", Perhatian text and Sunting to the paper editor', async () => {
    server.paperLane.mockResolvedValue({
      rows: [
        paper('p1', 'published', 0),
        paper('p2', 'published', 5, [{ code: 'no_scheme', message: 'Tiada skema — tidak disajikan.', count: 2 }]),
        paper('p3', 'draft', 4),
      ],
      page: 1, pageSize: 25, total: 3,
    })
    await mountAt(LaneSimulasiPage, '/admin/spm/simulasi')
    expect(text('[data-testid=attention-p1]')).toBe('Disajikan tetapi tiada soalan')
    expect(text('[data-testid=attention-p2]')).toBe('2 soalan: Tiada skema — tidak disajikan.')
    expect(q('[data-testid=attention-p3]')).toBeNull()
    const body = document.body.textContent ?? ''
    expect(body).toContain('Matematik · 5 soalan')
    expect(body).toContain('Terbit')
    expect(body).toContain('Draf')
    expect(q('[data-testid=lane-edit-p2]')).not.toBeNull()
  })
})
