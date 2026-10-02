// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { QualitySummary } from '../../api/quality'
import QuestionQualityPage from '../../pages/QuestionQualityPage.vue'

const api = vi.hoisted(() => ({ fetchQualitySummary: vi.fn(), runQualityAudit: vi.fn() }))
vi.mock('../../api/quality', () => api)

const SUMMARY: QualitySummary = {
  total: 465278,
  average: 94.1,
  scoredCount: 147026,
  excellentCount: 146275,
  activeActionCount: 2,
  buckets: { baik: 749, lemahKritikal: 2, legacyGeneric: 373 },
  distribution: { cemerlang: 99.5, baik: 0.5, lemah: 0, kritikal: 0 },
  bySubject: [
    { subjectId: 1, name: 'Sejarah', count: 9192, average: 96, excellentPct: 100 },
    { subjectId: 2, name: 'Matematik', count: 13335, average: 60.2, excellentPct: 99 },
  ],
  byLevel: [{ levelId: 1, name: 'Darjah 1', count: 4325, average: 95.4 }],
  actionList: [
    {
      id: 129114,
      questionText: '34^-1/2 =',
      subject: { id: 3, name: 'Matematik' },
      level: { id: 11, name: 'Tingkatan 5' },
      sourceSet: 'set_demo_k1',
      qualityScore: 50,
    },
  ],
  lastAuditAt: null,
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions/:id/edit', component: stub },
      { path: '/page', component: QuestionQualityPage },
    ],
  })
  await router.push('/page')
  wrapper = mount(QuestionQualityPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)

beforeEach(() => {
  setActivePinia(createPinia())
  api.fetchQualitySummary.mockReset().mockResolvedValue(SUMMARY)
  api.runQualityAudit.mockReset()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('QuestionQualityPage (M04 S6)', () => {
  it('shows the KPI cards and the bucket cards with separators and one decimal', async () => {
    const w = await render()
    expect(t(w, 'kpi-total-value').text()).toBe('465,278')
    expect(t(w, 'kpi-average-value').text()).toBe('94.1')
    expect(t(w, 'kpi-excellent-value').text()).toBe('146,275')
    expect(t(w, 'kpi-action-value').text()).toBe('2')
    expect(t(w, 'bucket-baik-value').text()).toBe('749')
    expect(t(w, 'bucket-lemah-value').text()).toBe('2')
    expect(t(w, 'bucket-legacy-value').text()).toBe('373')
    expect(t(w, 'bucket-legacy').text()).toContain('`source_type=ai_generated`')
  })

  it('draws the distribution, keeping the narrow segment label outside the bar', async () => {
    const w = await render()
    expect(t(w, 'dist-cemerlang').text()).toBe('99.5%')
    expect(t(w, 'dist-baik').text()).toBe('')
    expect(t(w, 'dist-label-baik').text()).toBe('Baik 0.5%')
    expect(w.find('[data-testid=dist-lemah]').exists()).toBe(false)
  })

  it('lists subjects (pill colour by average), levels and the action row with its edit link', async () => {
    const w = await render()
    const subjects = w.findAll('[data-testid=subject-row]')
    expect(subjects).toHaveLength(2)
    expect(subjects[0]?.text()).toContain('96.0')
    expect(subjects[0]?.find('span').classes()).toContain('bg-emerald-100')
    expect(subjects[1]?.find('span').classes()).toContain('bg-amber-100')
    expect(t(w, 'level-row').text()).toContain('4,325 soalan · 95.4')
    expect(t(w, 'action-count').text()).toBe('1 soalan')
    const row = t(w, 'action-row')
    expect(row.text()).toContain('#129114')
    expect(t(w, 'action-edit').attributes('href')).toBe('/admin/questions/129114/edit')
  })

  it('runs the audit without confirm, shows "Sedang audit...", reloads and flashes the status', async () => {
    let done: (v: unknown) => void = () => undefined
    api.runQualityAudit.mockReturnValue(new Promise((r) => (done = r)))
    const w = await render()
    await t(w, 'quality-audit').trigger('click')
    expect(t(w, 'quality-audit').text()).toBe('Sedang audit...')
    expect(t(w, 'quality-audit').attributes('disabled')).toBeDefined()
    done({ data: { lastAuditAt: 'x' }, status: 'Audit kualiti selesai.' })
    await flushPromises()
    expect(api.fetchQualitySummary).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toEqual({ type: 'success', message: 'Audit kualiti selesai.' })
    expect(t(w, 'quality-audit').text()).toBe('Jalankan Audit Semula')
  })

  it('shows the red alert with "Cuba Semula" when the dashboard fails to load', async () => {
    api.fetchQualitySummary.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan.' }),
    )
    const w = await render()
    expect(t(w, 'quality-error').text()).toContain('Maaf, berlaku ralat. Sila cuba semula.')
    await t(w, 'quality-retry').trigger('click')
    await flushPromises()
    expect(t(w, 'kpi-total-value').text()).toBe('465,278')
  })
})
