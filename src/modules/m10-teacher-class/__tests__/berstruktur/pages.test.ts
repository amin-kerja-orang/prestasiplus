// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'
import { useFlashStore } from '@/stores/flash'

import SoalanBerstrukturCiptaPage from '../../pages/SoalanBerstrukturCiptaPage.vue'
import SoalanBerstrukturEditPage from '../../pages/SoalanBerstrukturEditPage.vue'

const sub = vi.hoisted(() => ({
  createStructuredSubmission: vi.fn(),
  updateStructuredSubmission: vi.fn(),
  deleteStructuredSubmission: vi.fn(),
  fetchStructuredSubmission: vi.fn(),
  uploadStimulusImage: vi.fn(),
}))
vi.mock('../../api/structured-submit', () => sub)
vi.mock('../../api/guru', () => ({
  fetchChapters: vi.fn(() => Promise.resolve([])),
  fetchBidang: vi.fn(() => Promise.resolve([])),
  fetchSk: vi.fn(() => Promise.resolve([])),
  fetchSp: vi.fn(() => Promise.resolve([])),
}))
vi.mock('../../components/soalan/data', () => ({
  fetchLevelOptions: vi.fn(() => Promise.resolve([{ id: 11, name: 'Tingkatan 5' }])),
  fetchSubjectOptions: vi.fn(() => Promise.resolve([{ id: 4, name: 'Perniagaan' }])),
}))

let router: Router
let wrapper: VueWrapper | null = null
const t = (id: string) => wrapper!.get(`[data-testid="${id}"]`)
const all = (id: string) => wrapper!.findAll(`[data-testid="${id}"]`)

const stub = { template: '<div />' }
function makeRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: stub },
      { path: '/guru/soalan-berstruktur', component: stub },
      { path: '/guru/soalan-berstruktur/cipta', component: stub },
      { path: '/guru/soalan-berstruktur/:id', component: stub },
    ],
  })
}

async function fill(): Promise<void> {
  await t('s-level').setValue('11')
  await t('s-subject').setValue('4')
  await t('s-difficulty').setValue('3')
  await t('s-stimulus').setValue('Petikan.')
  await flushPromises()
  await all('s-part-text')[0]!.setValue('Soalan (a)')
  await all('s-part-marks')[0]!.setValue('4')
  await all('s-part-scheme')[0]!.setValue('Skema (a)')
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  router = makeRouter()
  for (const f of Object.values(sub)) f.mockReset()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

async function mountCipta(): Promise<void> {
  await router.push('/guru/soalan-berstruktur/cipta')
  wrapper = mount(SoalanBerstrukturCiptaPage, { global: { plugins: [router] } })
  await flushPromises()
}

describe('/guru/soalan-berstruktur/cipta', () => {
  it('posts the body, flashes "Soalan berstruktur dihantar untuk semakan." and returns to the list', async () => {
    sub.createStructuredSubmission.mockResolvedValue({ id: 'g1' })
    await mountCipta()
    await fill()
    await t('structured-form').trigger('submit')
    await flushPromises()
    expect(sub.createStructuredSubmission).toHaveBeenCalledWith({
      subjectId: '4',
      educationLevelId: '11',
      difficultyLevel: 3,
      stimulus: 'Petikan.',
      parts: [{ text: 'Soalan (a)', marks: 4, scheme: 'Skema (a)' }],
    })
    expect(useFlashStore().consume()?.message).toBe('Soalan berstruktur dihantar untuk semakan.')
    expect(router.currentRoute.value.path).toBe('/guru/soalan-berstruktur')
  })

  it('uploads the stimulus image first and sends its token as stimulusImageId', async () => {
    sub.uploadStimulusImage.mockResolvedValue('AbCdEfGhIjKlMnOpQrStUv')
    sub.createStructuredSubmission.mockResolvedValue({ id: 'g1' })
    await mountCipta()
    await fill()
    const { pickFiles } = await import('../soalan/pick-file')
    await pickFiles(wrapper!, 's-image', [new File(['x'], 'r.png', { type: 'image/png' })])
    await t('structured-form').trigger('submit')
    await flushPromises()
    expect(sub.uploadStimulusImage).toHaveBeenCalledTimes(1)
    expect(sub.createStructuredSubmission.mock.calls[0]![0]).toMatchObject({
      stimulusImageId: 'AbCdEfGhIjKlMnOpQrStUv',
    })
  })

  it('a 422 shows its messages under the form and keeps the typed values', async () => {
    sub.createStructuredSubmission.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { 'parts.0.scheme': 'Sila isi skema jawapan.' },
      }),
    )
    await mountCipta()
    await fill()
    await t('structured-form').trigger('submit')
    await flushPromises()
    expect(t('form-errors').text()).toContain('Sila isi skema jawapan.')
    expect((all('s-part-text')[0]!.element as HTMLTextAreaElement).value).toBe('Soalan (a)')
    expect(router.currentRoute.value.path).toBe('/guru/soalan-berstruktur/cipta')
  })

  it('any other failure shows a fixed BM line and does not leave the page', async () => {
    sub.createStructuredSubmission.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' }),
    )
    await mountCipta()
    await fill()
    await t('structured-form').trigger('submit')
    await flushPromises()
    expect(t('form-errors').text()).toBe('Gagal menghantar soalan berstruktur. Sila cuba lagi.')
  })

  it('"Batal" leaves without saving', async () => {
    await mountCipta()
    await t('form-cancel').trigger('click')
    await flushPromises()
    expect(sub.createStructuredSubmission).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/guru/soalan-berstruktur')
  })
})

const saved = {
  id: 'g7',
  status: 'review',
  editable: true,
  totalMarks: 5,
  source: 'submission',
  stimulus: 'Petikan lama.',
  stimulusImage: null,
  subQuestions: [
    {
      partLabel: 'a',
      questionText: 'Lama?',
      marks: 5,
      cognitiveLevel: null,
      modelAnswer: 'Skema lama',
    },
  ],
  form: {
    subjectId: 4,
    educationLevelId: 11,
    chapterId: null,
    spIds: [],
    tp: null,
    cognitiveLevel: null,
    difficultyLevel: 2,
    stimulusImageId: 'TOKEN-SAVED',
    rejectionReason: null,
  },
}

async function mountEdit(id = 'g7'): Promise<void> {
  await router.push('/guru/soalan-berstruktur')
  wrapper = mount(SoalanBerstrukturEditPage, { props: { id }, global: { plugins: [router] } })
  await flushPromises()
}

describe('/guru/soalan-berstruktur/:id/edit', () => {
  it('preloads the saved values and PUTs the full body, keeping the saved image', async () => {
    sub.fetchStructuredSubmission.mockResolvedValue(saved)
    sub.updateStructuredSubmission.mockResolvedValue({ id: 'g7' })
    await mountEdit()
    expect((t('s-level').element as HTMLSelectElement).value).toBe('11')
    expect((t('s-subject').element as HTMLSelectElement).value).toBe('4')
    expect((t('s-difficulty').element as HTMLSelectElement).value).toBe('2')
    expect((t('s-stimulus').element as HTMLTextAreaElement).value).toBe('Petikan lama.')
    expect((all('s-part-scheme')[0]!.element as HTMLTextAreaElement).value).toBe('Skema lama')
    expect(t('s-total').text()).toBe('Jumlah markah: 5')
    await all('s-part-marks')[0]!.setValue('6')
    await t('structured-form').trigger('submit')
    await flushPromises()
    expect(sub.updateStructuredSubmission).toHaveBeenCalledWith('g7', {
      subjectId: '4',
      educationLevelId: '11',
      difficultyLevel: 2,
      stimulus: 'Petikan lama.',
      stimulusImageId: 'TOKEN-SAVED',
      parts: [{ text: 'Lama?', marks: 6, scheme: 'Skema lama' }],
    })
    expect(router.currentRoute.value.path).toBe('/guru/soalan-berstruktur')
  })

  it('shows the 409 message of the server and stays', async () => {
    sub.fetchStructuredSubmission.mockResolvedValue(saved)
    sub.updateStructuredSubmission.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Soalan ini sudah diterima atau diluluskan dan tidak boleh diubah.',
      }),
    )
    await mountEdit()
    await t('structured-form').trigger('submit')
    await flushPromises()
    expect(t('form-errors').text()).toBe(
      'Soalan ini sudah diterima atau diluluskan dan tidak boleh diubah.',
    )
  })

  it("AC-GUR-44b-6: another teacher's id (404) is the standard 404", async () => {
    sub.fetchStructuredSubmission.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }),
    )
    await mountEdit('g9')
    expect(useRouteOutcome().value).toBe(404)
  })

  it('an approved question (no form) is a 404 too', async () => {
    sub.fetchStructuredSubmission.mockResolvedValue({ ...saved, source: 'question', form: null })
    await mountEdit()
    expect(useRouteOutcome().value).toBe(404)
  })

  it('"Padam" asks first, deletes and returns to the list', async () => {
    sub.fetchStructuredSubmission.mockResolvedValue(saved)
    sub.deleteStructuredSubmission.mockResolvedValue({ removed: 1 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    await mountEdit()
    await t('berstruktur-delete').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalled()
    expect(sub.deleteStructuredSubmission).toHaveBeenCalledWith('g7')
    expect(router.currentRoute.value.path).toBe('/guru/soalan-berstruktur')
    confirm.mockRestore()
  })
})
