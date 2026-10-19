// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'

import type { StructuredDetail } from '../../api/structured'
import StructuredDetailPage from '../../pages/StructuredDetailPage.vue'

const api = vi.hoisted(() => ({ fetchStructuredQuestion: vi.fn() }))
vi.mock('../../api/structured', () => api)

function detail(extra: Partial<StructuredDetail> = {}): StructuredDetail {
  const sub = (id: number, label: string, marks: number, text: string, answer: string) => ({
    id,
    structuredQuestionId: 3698,
    partLabel: label,
    questionText: text,
    marks,
    answerType: 'text' as const,
    expectedNumeric: null,
    numericTolerance: null,
    rubrics: [],
    modelAnswer: answer,
    parentSubId: null,
    order: id,
  })
  return {
    id: 3698,
    subjectId: 5,
    educationLevelId: 11,
    subject: { id: 5, name: 'Sejarah' },
    level: { id: 11, name: 'Tingkatan 5' },
    kbatLevel: 3,
    status: 'published',
    isActive: true,
    needsDiagram: false,
    estimatedMinutes: 10,
    isTrial: false,
    topic: null,
    questionNumber: 3,
    stimulus: 'Baris satu\nBaris dua',
    stimulusImage: null,
    totalMarks: 10,
    visibility: 'public',
    complianceStatus: 'OK',
    sourceFile: null,
    sourcePage: null,
    sourceSet: null,
    curriculumChapterId: null,
    curriculumTopicId: null,
    dskpSpId: null,
    scriptType: 'rumi',
    textDirection: 'ltr',
    questionTemplate: null,
    subQuestions: [
      sub(1, 'a', 2, 'Soalan A', 'Jawapan A'),
      sub(2, 'b', 8, 'Soalan B', 'Jawapan B'),
    ],
    createdBy: { id: 1, name: 'Admin Demo' },
    createdAt: '2026-04-08T09:00:00+08:00',
    updatedAt: '2026-04-08T09:00:00+08:00',
    ...extra,
  }
}

let wrapper: VueWrapper | null = null

async function render(id = 3698): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/structured-questions', component: { template: '<div />' } },
      { path: '/admin/structured-questions/:id', component: StructuredDetailPage },
      { path: '/guru/soalan-berstruktur/:id/edit', component: { template: '<div />' } },
    ],
  })
  await router.push(`/admin/structured-questions/${String(id)}`)
  wrapper = mount(StructuredDetailPage, { props: { id }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  api.fetchStructuredQuestion.mockReset()
  api.fetchStructuredQuestion.mockResolvedValue(detail())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StructuredDetailPage (M04 S9)', () => {
  it('renders the back link, the pills, the id, the stimulus and the meta line', async () => {
    const w = await render()
    const back = w.get('[data-testid=structured-back]')
    expect(back.text()).toBe('Kembali ke senarai')
    expect(back.attributes('href')).toBe('/admin/structured-questions')
    expect(w.get('[data-testid=structured-pill-subject]').text()).toBe('Sejarah')
    expect(w.get('[data-testid=structured-pill-level]').text()).toBe('Tingkatan 5')
    expect(w.get('[data-testid=structured-pill-kbat]').text()).toBe('KBAT: Mengaplikasi (L3)')
    expect(w.get('[data-testid=structured-pill-marks]').text()).toBe('10 Markah')
    expect(w.get('[data-testid=structured-id]').text()).toBe('ID: #3698')
    expect(w.text()).toContain('Stimulus / Konteks Soalan')
    expect(w.get('[data-testid=structured-stimulus]').classes()).toContain('whitespace-pre-line')
    const meta = w.get('[data-testid=structured-meta]').text()
    expect(meta).toContain('Dicipta oleh: Admin Demo')
    expect(meta).toContain('08 Apr 2026')
    expect(meta).toContain('Visibiliti: Public')
    expect(meta).toContain('Published')
  })

  it('shows a dash when the creator name is unknown', async () => {
    api.fetchStructuredQuestion.mockResolvedValue(detail({ createdBy: { id: 9, name: null } }))
    const w = await render()
    expect(w.get('[data-testid=structured-meta]').text()).toContain('Dicipta oleh: —')
  })

  it('renders one card per sub-question with label, marks and the model answer', async () => {
    const w = await render()
    expect(w.get('[data-testid=structured-subs-heading]').text()).toBe(
      'Bahagian Soalan (2 sub-soalan)',
    )
    const subs = w.findAll('[data-testid=structured-sub]')
    expect(subs).toHaveLength(2)
    expect(subs[0]?.get('[data-testid=structured-sub-label]').text()).toBe('3(A)')
    expect(subs[1]?.get('[data-testid=structured-sub-label]').text()).toBe('3(B)')
    expect(subs[0]?.get('[data-testid=structured-sub-marks]').text()).toBe('2m')
    expect(subs[0]?.text()).toContain('Jawapan Model')
    expect(subs[0]?.text()).toContain('Jawapan A')
  })

  it('shows a bare letter label when the question is unnumbered', async () => {
    api.fetchStructuredQuestion.mockResolvedValue(detail({ questionNumber: null }))
    const w = await render()
    expect(w.findAll('[data-testid=structured-sub-label]').map((l) => l.text())).toEqual(['A', 'B'])
  })

  it('links "Edit Soalan" to the M10 form and "Balik ke Senarai" to the list', async () => {
    const w = await render()
    const edit = w.get('[data-testid=structured-edit]')
    expect(edit.text()).toBe('Edit Soalan')
    expect(edit.attributes('href')).toBe('/guru/soalan-berstruktur/3698/edit')
    const back = w.get('[data-testid=structured-back-list]')
    expect(back.text()).toBe('Balik ke Senarai')
    expect(back.attributes('href')).toBe('/admin/structured-questions')
  })

  it('an unknown id sets the standard 404 outcome and no red box', async () => {
    api.fetchStructuredQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }),
    )
    const w = await render(999999)
    expect(useRouteOutcome().value).toBe(404)
    expect(w.find('[data-testid=structured-detail-error]').exists()).toBe(false)
  })

  it('any other load failure shows the red box with "Cuba Semula"', async () => {
    api.fetchStructuredQuestion.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    const w = await render()
    expect(useRouteOutcome().value).toBeNull()
    expect(w.get('[data-testid=structured-detail-error]').text()).toContain('Cuba Semula')
    await w.get('[data-testid=structured-detail-retry]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=structured-detail-error]').exists()).toBe(false)
    expect(w.find('[data-testid=structured-header]').exists()).toBe(true)
  })
})
