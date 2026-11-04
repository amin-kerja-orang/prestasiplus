// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { KANDUNGAN_ROUTES } from '../admin/kandungan/api'
import KandunganHubPage from '../admin/kandungan/pages/KandunganHubPage.vue'
import LaneDatabankPage from '../admin/kandungan/pages/LaneDatabankPage.vue'
import LaneLatihTubiPage from '../admin/kandungan/pages/LaneLatihTubiPage.vue'
import LaneSimulasiPage from '../admin/kandungan/pages/LaneSimulasiPage.vue'
import LaneSubjektifPage from '../admin/kandungan/pages/LaneSubjektifPage.vue'

const server = vi.hoisted(() => ({
  overview: vi.fn(),
  databankLane: vi.fn(),
  paperLane: vi.fn(),
  subjektifLane: vi.fn(),
  latihTubiLane: vi.fn(),
}))
const builder = vi.hoisted(() => ({ copy: vi.fn(), studentView: vi.fn() }))
const flash = vi.hoisted(() => ({ show: vi.fn() }))
vi.mock('../admin/kandungan/client', () => ({ kandunganServer: () => server }))
vi.mock('../admin/builder/server/client', () => ({ builderServer: () => builder }))
vi.mock('@/composables/useFlash', () => ({ useFlash: () => flash }))

const act = (activity: string, label: string, attention: number) => ({ activity, label, served: 10 - attention, total: 10, attention, basis: 'sql' })
const card = (lane: string, title: string, description: string, attention: number, attentionLabel: string, total = 10) => ({
  lane, title, description, total, attention, attentionLabel,
  attentionLines: attention > 0 ? [{ count: attention, text: `${String(attention)} ${attentionLabel}` }] : [],
})
const SUBJECTS = [{ id: 'MAT', name: 'Matematik' }]
const OVERVIEW = {
  bank: 10,
  cards: [
    card('databank', 'Databank Soalan', 'Bank soalan objektif SPM mengikut subjek.', 3, 'tidak boleh ditanda', 1234),
    card('tracking-a', 'Tracking A', 'Set objektif penuh dan lane bahasa.', 2, 'set tidak lengkap'),
    {
      ...card('subjektif', 'Subjektif', 'Soalan berstruktur dan esei.', 5, 'tiada skema — tidak disajikan'),
      attentionLines: [
        { count: 4, text: '4 tiada skema — tidak disajikan' },
        { count: 1, text: '1 tiada kunci jawapan' },
      ],
    },
    card('bijak-spm', 'Bijak SPM', 'Kertas SPM penuh dalam format sebenar.', 0, 'tiada kunci jawapan'),
    { ...card('kertas-subjektif', 'Kertas Subjektif', 'Kertas 2, 3 & 4 percubaan negeri.', 0, ''), attentionOpen: true },
    card('latih-tubi', 'Latih Tubi', 'Latihan ikut topik dan bab.', 0, 'tidak boleh ditanda'),
  ],
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
  for (const f of [...Object.values(server), ...Object.values(builder), flash.show]) f.mockReset()
  server.overview.mockResolvedValue(OVERVIEW)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

/** The lanes with a screen in this card; Tracking A and Kertas Subjektif arrive with S3-T05 and S3-T06. */
async function mountAt(component: object, path: string, extraRoutes: RouteRecordRaw[] = []): Promise<void> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spm', name: KANDUNGAN_ROUTES.hub, component },
      { path: '/admin/spm/databank', name: KANDUNGAN_ROUTES.databank, component },
      { path: '/admin/spm/simulasi', name: KANDUNGAN_ROUTES.simulasi, component },
      { path: '/admin/spm/subjektif', name: KANDUNGAN_ROUTES.subjektif, component },
      { path: '/admin/spm/latih-tubi', name: KANDUNGAN_ROUTES.latihTubi, component },
      { path: '/spm/tahun-lepas', name: 'm06.spm.databank', component: stub },
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/admin/set-builder/:id', component: stub },
      ...extraRoutes,
      { path: '/admin/spm/soalan/:qid/sunting', name: 'm28.admin.bank.edit', component: stub },
      { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: stub },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
}

const cardNames = (): (string | null)[] => [...document.body.querySelectorAll('[data-testid^="kandungan-card-"] h2')].map((h) => h.textContent)

describe('hub SPM (R1-ADM-Q-01)', () => {
  it('hides a card whose screen is not registered, in the PRD order (FR-ADM-Q01.4)', async () => {
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(cardNames()).toEqual(['Databank Soalan', 'Subjektif', 'Bijak SPM', 'Latih Tubi'])
    expect(text('[data-testid=kandungan-card-databank]')).toContain('Bank soalan objektif SPM mengikut subjek.')
    expect(text('[data-testid=kandungan-card-simulasi]')).toContain('Kertas SPM penuh dalam format sebenar.')
    for (const k of ['tracking-a', 'kertas-subjektif']) expect(q(`[data-testid=kandungan-card-${k}]`), k).toBeNull()
    expect(text('[data-testid=kandungan-intro]')).toBe(
      'Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
    )
  })

  it('shows all six cards in the PRD order once every screen exists (AC-ADM-Q01.1)', async () => {
    const stub = { template: '<i/>' }
    await mountAt(KandunganHubPage, '/admin/spm', [
      { path: '/admin/spm/tracking-a', name: KANDUNGAN_ROUTES.trackingA, component: stub },
      { path: '/admin/spm/kertas-subjektif', name: KANDUNGAN_ROUTES.kertasSubjektif, component: stub },
    ])
    expect(cardNames()).toEqual(['Databank Soalan', 'Tracking A', 'Subjektif', 'Bijak SPM', 'Kertas Subjektif', 'Latih Tubi'])
  })

  it('shows the item count as a big number and every attention line', async () => {
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(text('[data-testid=kandungan-total-databank]')).toBe('1,234')
    expect(text('[data-testid=kandungan-attention-subjektif]')).toBe('4 tiada skema — tidak disajikan1 tiada kunci jawapan')
  })

  it('shows neither a count nor "Semua elok" on a card whose attention rule is open', async () => {
    await mountAt(KandunganHubPage, '/admin/spm', [
      { path: '/admin/spm/kertas-subjektif', name: KANDUNGAN_ROUTES.kertasSubjektif, component: { template: '<i/>' } },
    ])
    expect(q('[data-testid=kandungan-attention-kertas-subjektif]')).toBeNull()
    expect(text('[data-testid=kandungan-card-kertas-subjektif]')).not.toContain('Semua elok')
  })

  it('shows the error and Cuba lagi on a failed card only; the other cards stay (SR-3)', async () => {
    const failed = { ...OVERVIEW, cards: OVERVIEW.cards.map((c) => (c.lane === 'subjektif' ? { ...c, total: 0, attention: 0, attentionLines: [], failed: true } : c)) }
    server.overview.mockResolvedValueOnce(failed).mockResolvedValue(OVERVIEW)
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(text('[data-testid=kandungan-failed-subjektif]')).toContain('Tidak dapat dimuatkan.')
    expect(q('[data-testid=kandungan-total-subjektif]')).toBeNull()
    expect(text('[data-testid=kandungan-total-databank]')).toBe('1,234')
    q('[data-testid=kandungan-retry-subjektif]')!.click()
    await flushPromises()
    expect(q('[data-testid=kandungan-failed-subjektif]')).toBeNull()
    expect(text('[data-testid=kandungan-total-subjektif]')).toBe('10')
  })

  it('keeps the other cards when Cuba lagi fails (SR-3)', async () => {
    const failed = { ...OVERVIEW, cards: OVERVIEW.cards.map((c) => (c.lane === 'subjektif' ? { ...c, total: 0, attention: 0, attentionLines: [], failed: true } : c)) }
    server.overview.mockResolvedValueOnce(failed).mockRejectedValue(new Error('429'))
    await mountAt(KandunganHubPage, '/admin/spm')
    q('[data-testid=kandungan-retry-subjektif]')!.click()
    await flushPromises()
    expect(text('[data-testid=kandungan-total-databank]')).toBe('1,234')
    expect(q('[data-testid=kandungan-failed-subjektif]')).not.toBeNull()
    expect(document.body.textContent).not.toContain('Tidak dapat memuatkan ringkasan kandungan.')
  })

  it('links lihat sisi pelajar only when the pupil route exists (FR-ADM-Q01.5)', async () => {
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(text('[data-testid=kandungan-pupil-databank]')).toBe('lihat sisi pelajar')
    expect(q('[data-testid=kandungan-pupil-databank]')?.getAttribute('href')).toBe('/spm/tahun-lepas')
    expect(q('[data-testid=kandungan-pupil-subjektif]')).toBeNull()
  })

  it('shows the attention text or "Semua elok", and "Buka senarai" on each card', async () => {
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(text('[data-testid=kandungan-attention-databank]')).toBe('3 tidak boleh ditanda')
    expect(text('[data-testid=kandungan-attention-simulasi]')).toBe('Semua elok')
    expect(text('[data-testid=kandungan-open-databank]')).toBe('Buka senarai')
    expect(text('[data-testid=kandungan-open-simulasi]')).toBe('Buka senarai')
    expect(q('[data-testid=kandungan-open-subjektif]')?.getAttribute('href')).toBe('/admin/spm/subjektif')
    expect(q('[data-testid=kandungan-open-latih-tubi]')?.getAttribute('href')).toBe('/admin/spm/latih-tubi')
  })

  it('shows a retryable error when the overview fails', async () => {
    server.overview.mockRejectedValueOnce(new Error('boom')).mockResolvedValue(OVERVIEW)
    await mountAt(KandunganHubPage, '/admin/spm')
    expect(document.body.textContent).toContain('Tidak dapat memuatkan ringkasan kandungan.')
  })
})

const search = async (value: string): Promise<void> => {
  const el = q('[data-testid=lane-search] input, input[data-testid=lane-search]') as HTMLInputElement
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
  ;[...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tapis')!.click()
  await flushPromises()
}

describe('lane Databank Soalan (R1-ADM-Q-02)', () => {
  const row = (id: string, status: string, attention: { code: string; message: string }[] = []) => ({
    questionId: id, title: `Soalan ${id}`, subject: { id: 'MAT', name: 'Matematik' }, status, attention,
  })
  beforeEach(() => {
    server.databankLane.mockResolvedValue({
      rows: [
        { ...row('1', 'approved'), meta: '#1 · Matematik · Tingkatan 4 · 4 pilihan' },
        row('2', 'draft', [{ code: 'not_approved', message: 'Belum diluluskan — tekan Terbitkan untuk memaparkannya.' }]),
      ],
      page: 1, pageSize: 25, total: 2, subjects: SUBJECTS, count: 1234,
    })
  })

  it('has the lane frame: back link, "{n} item ·", lihat sisi pelajar, meta line and "—" (FR-ADM-Q02.1, 02-05)', async () => {
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    expect(text('[data-testid=lane-back]')).toBe('← Semua laluan SPM')
    expect(q('[data-testid=lane-back]')?.getAttribute('href')).toBe('/admin/spm')
    expect(text('[data-testid=lane-count]')).toBe('1,234 item ·')
    expect(text('[data-testid=lane-pupil]')).toBe('lihat sisi pelajar')
    expect(q('[data-testid=lane-pupil]')?.getAttribute('href')).toBe('/spm/tahun-lepas')
    const body = document.body.textContent ?? ''
    expect(body).toContain('#1 · Matematik · Tingkatan 4 · 4 pilihan · Diluluskan')
    expect(body).toContain('—')
  })

  it('lists the status labels of section 0, without the retired "Diterbitkan"', async () => {
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    const options = [...document.body.querySelectorAll('[data-testid=lane-status] option')].map((o) => o.textContent?.trim())
    expect(options).toEqual(['Semua Status', 'Draf', 'Menunggu Semakan', 'Diluluskan', 'Diarkibkan'])
  })

  it('refuses a search over 100 characters with the exact message, and clears it on the next valid search (02-03)', async () => {
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    server.databankLane.mockClear()
    await search('x'.repeat(101))
    expect(text('[data-testid=lane-search-error]')).toBe('Carian tidak boleh melebihi 100 aksara.')
    expect(server.databankLane).not.toHaveBeenCalled()
    await search('luas')
    expect(q('[data-testid=lane-search-error]')).toBeNull()
    expect(server.databankLane).toHaveBeenLastCalledWith({ search: 'luas', page: 1, pageSize: 25 })
  })

  it('shows no item count while the lane has not answered or has failed', async () => {
    server.databankLane.mockRejectedValue(new Error('boom'))
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    expect(q('[data-testid=lane-count]')).toBeNull()
    expect(document.body.textContent).toContain('Tidak dapat memuatkan senarai.')
  })

  it('does not bring a removed chip back on the next Tapis', async () => {
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    await search('luas')
    const chip = [...document.body.querySelectorAll('button')].find((b) => /Buang|Alih|Padam|luas/.test(b.getAttribute('aria-label') ?? ''))
    expect(chip).toBeDefined()
    chip!.click()
    await flushPromises()
    expect(server.databankLane).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
    ;[...document.body.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Tapis')!.click()
    await flushPromises()
    expect(server.databankLane).toHaveBeenLastCalledWith({ page: 1, pageSize: 25 })
  })

  it('shows the empty copy "Tiada item untuk penapis ini."', async () => {
    server.databankLane.mockResolvedValue({ rows: [], page: 1, pageSize: 25, total: 0, subjects: SUBJECTS, count: 0 })
    await mountAt(LaneDatabankPage, '/admin/spm/databank')
    expect(document.body.textContent).toContain('Tiada item untuk penapis ini.')
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
    // The Subjek options come from the lane response, not from a separate subjects read (REQ-A-016).
    const options = [...document.body.querySelectorAll('[data-testid=lane-subject] option')].map((o) => o.textContent?.trim())
    expect(options).toContain('Matematik')
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

describe('lane Subjektif (FR-ADM-Q23.3)', () => {
  const row = (id: string, attention: string[]) => ({ id, title: `Soalan ${id}`, meta: `#${id} · Sejarah · Tingkatan 5`, status: 'approved', attention, actions: ['preview', 'edit'] })
  beforeEach(() => {
    server.subjektifLane.mockResolvedValue({
      rows: [row('41', ['Tiada skema — tidak disajikan.', 'Tiada kunci jawapan.']), row('42', [])],
      page: 1, pageSize: 25, total: 2, subjects: SUBJECTS, count: 2,
    })
  })

  it('lists the reasons, "—" when none, and opens the Studio for Sunting', async () => {
    await mountAt(LaneSubjektifPage, '/admin/spm/subjektif')
    expect(text('[data-testid=lane-count]')).toBe('2 item ·')
    const reasons = text('[data-testid=attention-41]')
    expect(reasons).toContain('Tiada skema — tidak disajikan.')
    expect(reasons).toContain('Tiada kunci jawapan.')
    expect(q('[data-testid=attention-42]')).toBeNull()
    expect(document.body.textContent).toContain('—')
    expect(document.body.textContent).toContain('#41 · Sejarah · Tingkatan 5 · Diluluskan')
    expect(q('[data-testid=lane-edit-41]')?.getAttribute('href')).toBe('/admin/studio/questions/41/sunting')
    expect(q('[data-testid=lane-preview-41]')).toBeNull()
  })
})

describe('lane Latih Tubi (FR-ADM-Q02.4)', () => {
  const cell = (status: 'open' | 'closed', servable: number, total: number, attention: string[]) => ({
    id: `7:${status}`, title: 'Sains · Tingkatan 4', meta: `#7 · ${String(total)} soalan`, status, attention, actions: [],
    subject: { id: '7', name: 'Sains' }, level: { id: '4', name: 'Tingkatan 4' }, servable, total,
  })

  it('shows the cells with their servable count, the switch badge and no Status filter or row action', async () => {
    server.latihTubiLane.mockResolvedValue({
      rows: [cell('open', 30, 40, ['10 tidak boleh ditanda'])],
      page: 1, pageSize: 25, total: 1, subjects: SUBJECTS, count: 449503,
    })
    await mountAt(LaneLatihTubiPage, '/admin/spm/latih-tubi')
    expect(text('[data-testid=lane-count]')).toBe('449,503 item ·')
    const body = document.body.textContent ?? ''
    expect(body).toContain('Sains · Tingkatan 4')
    expect(body).toContain('#7 · 40 soalan · 30 boleh ditanda')
    expect(body).toContain('Dibuka')
    expect(text('[data-testid="attention-7:open"]')).toBe('10 tidak boleh ditanda')
    expect(q('[data-testid=lane-status]')).toBeNull()
    expect(q('[data-testid=lane-subject]')).not.toBeNull()
    expect(body).not.toContain('Tindakan')
  })

  it('labels a closed switch Ditutup', async () => {
    server.latihTubiLane.mockResolvedValue({ rows: [cell('closed', 40, 40, [])], page: 1, pageSize: 25, total: 1, subjects: SUBJECTS, count: 40 })
    await mountAt(LaneLatihTubiPage, '/admin/spm/latih-tubi')
    expect(document.body.textContent).toContain('Ditutup')
  })
})

describe('lane Bijak SPM (R1-ADM-Q-02)', () => {
  const paper = (id: string, status: 'draft' | 'ready' | 'published' | 'withdrawn', questionCount: number, attention: { code: string; message: string; count: number }[] = []) => ({
    paperId: id, title: `Kertas ${id}`, subject: { id: 'MAT', name: 'Matematik' }, status, questionCount, attentionCount: attention.length, attention,
  })
  it('on a narrow screen the card list carries the same Perhatian text and Sunting', async () => {
    media(false)
    server.paperLane.mockResolvedValue({
      rows: [paper('p1', 'published', 0)],
      page: 1, pageSize: 25, total: 1, subjects: SUBJECTS,
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
      page: 1, pageSize: 25, total: 3, subjects: SUBJECTS,
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

  it('offers Pratonton, Salin and Sunting on a Terbit paper (AC-ADM-Q02.2)', async () => {
    server.paperLane.mockResolvedValue({ rows: [paper('p1', 'published', 5)], page: 1, pageSize: 25, total: 1, subjects: SUBJECTS, count: 1 })
    builder.studentView.mockResolvedValue({ title: 'Kertas p1', code: 'K1', subjectName: 'Matematik', kertas: 1, durationMin: 60, marks: 40, instructions: [], sections: [] })
    builder.copy.mockResolvedValue('p2')
    await mountAt(LaneSimulasiPage, '/admin/spm/simulasi')
    expect(text('[data-testid=lane-preview-p1]')).toBe('Pratonton')
    expect(text('[data-testid=lane-copy-p1]')).toBe('Salin')
    expect(text('[data-testid=lane-edit-p1]')).toBe('Sunting')

    q('[data-testid=lane-preview-p1]')!.click()
    await flushPromises()
    expect(builder.studentView).toHaveBeenCalledWith('p1')

    q('[data-testid=lane-copy-p1]')!.click()
    await flushPromises()
    expect(builder.copy).toHaveBeenCalledWith('p1')
    expect(flash.show).toHaveBeenCalledWith({ type: 'success', message: 'Set disalin sebagai draf. Sunting dan terbitkan salinan baharu.' })
  })

  it('labels ready and withdrawn papers and offers all four statuses in the filter (REQ-A-022)', async () => {
    server.paperLane.mockResolvedValue({
      rows: [paper('p1', 'ready', 3), paper('p2', 'withdrawn', 2), paper('p3', 'published', 1), paper('p4', 'draft', 0)],
      page: 1, pageSize: 25, total: 4, subjects: SUBJECTS,
    })
    await mountAt(LaneSimulasiPage, '/admin/spm/simulasi')
    const body = document.body.textContent ?? ''
    expect(body).toContain('Sedia')
    expect(body).toContain('Ditarik balik')
    expect(body).not.toMatch(/\b(ready|withdrawn)\b/)
    expect(q('[data-testid=attention-p1]')).toBeNull()
    expect(q('[data-testid=attention-p2]')).toBeNull()
  })

  it('shows the question_missing reason sentence from the API (REQ-A-016)', async () => {
    const message = 'Soalan pada kertas ini tiada dalam bank soalan — kertas tidak boleh dimulakan; gantikan atau buang soalan itu.'
    server.paperLane.mockResolvedValue({
      rows: [paper('p9', 'published', 3, [{ code: 'question_missing', message, count: 1 }])],
      page: 1, pageSize: 25, total: 1, subjects: SUBJECTS,
    })
    await mountAt(LaneSimulasiPage, '/admin/spm/simulasi')
    expect(text('[data-testid=attention-p9]')).toBe(`1 soalan: ${message}`)
  })
})
