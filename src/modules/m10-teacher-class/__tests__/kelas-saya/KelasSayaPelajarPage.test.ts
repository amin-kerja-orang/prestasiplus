// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import KelasSayaPelajarPage from '../../pages/KelasSayaPelajarPage.vue'
import { joinErrorMessage } from '../../components/kelas-saya/join-message'

const api = vi.hoisted(() => ({ fetchJoinedClasses: vi.fn(), joinClass: vi.fn() }))
vi.mock('../../api/guru', () => api)

const stub = { template: '<div />' }
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }
const list = (data: unknown[]) => ({ data, meta: { ...META, totalItems: data.length } })

const CLASS = {
  id: 2002,
  name: '5 MARIKH - Sejarah',
  subjectName: 'Sejarah',
  teacherName: 'Guru Demo',
  levelLabel: 'Ting. 5',
}

let wrapper: VueWrapper | null = null

async function mountPage(path = '/kelas-saya') {
  const r = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/kelas-saya', component: stub }],
  })
  await r.push(path)
  await r.isReady()
  wrapper = mount(KelasSayaPelajarPage, { global: { plugins: [r] } })
  await flushPromises()
  return wrapper
}

function refusal(status: number, message: string) {
  return new ApiError({
    status,
    code: status === 404 ? 'NOT_FOUND' : 'CONFLICT',
    message,
  })
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.resetAllMocks()
})

describe('S33 Kelas Saya (student)', () => {
  it('renders the join card and the observed empty state', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([]))
    const w = await mountPage()
    const input = t(w, 'class-code')
    expect(input.attributes('maxlength')).toBe('6')
    expect(input.attributes('required')).toBeDefined()
    expect(input.attributes('placeholder')).toBe('cth: MAT5B2')
    expect(w.get('label[for="class_code"]').text()).toBe('Masukkan Kod Kelas')
    expect(t(w, 'join-submit').text()).toBe('Sertai')
    const empty = t(w, 'classes-empty')
    expect(empty.text()).toContain('Belum Sertai Mana-Mana Kelas')
    expect(empty.text()).toContain('Minta kod kelas daripada guru anda dan masukkan di atas')
  })

  it('shows the loading state before the list arrives', () => {
    api.fetchJoinedClasses.mockReturnValue(new Promise(() => undefined))
    wrapper = mount(KelasSayaPelajarPage, {
      global: { plugins: [createRouter({ history: createMemoryHistory(), routes: [] })] },
    })
    expect(wrapper.find('[data-testid="classes-loading"]').exists()).toBe(true)
  })

  it('lists joined classes instead of the empty card', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([CLASS]))
    const w = await mountPage()
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(false)
    expect(t(w, 'class-name').text()).toBe('5 MARIKH - Sejarah')
    expect(t(w, 'class-subject').text()).toBe('Sejarah')
    expect(t(w, 'class-teacher').text()).toBe('Guru Demo')
    expect(t(w, 'class-level').text()).toBe('Ting. 5')
  })

  it('shows an error state with retry when the list fails (@provisional not on live)', async () => {
    api.fetchJoinedClasses.mockRejectedValueOnce(new Error('x'))
    const w = await mountPage()
    expect(t(w, 'classes-error').text()).toContain('Ralat memuatkan data. Sila cuba semula.')
    api.fetchJoinedClasses.mockResolvedValueOnce(list([]))
    await w.get('[data-testid="classes-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(true)
  })

  it('pre-fills the code from ?kod= without joining (@provisional PROPOSED OQ-M10-04)', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([]))
    const w = await mountPage('/kelas-saya?kod=DEMO-4S')
    expect((t(w, 'class-code').element as HTMLInputElement).value).toBe('DEMO-4S')
    expect(api.joinClass).not.toHaveBeenCalled()
  })

  it('joins, shows the message, clears the field and reloads the list', async () => {
    api.fetchJoinedClasses.mockResolvedValueOnce(list([])).mockResolvedValueOnce(list([CLASS]))
    api.joinClass.mockResolvedValue({
      data: { classroomId: 2002 },
      message: 'Berjaya menyertai kelas 5 MARIKH - Sejarah.',
    })
    const w = await mountPage()
    await t(w, 'class-code').setValue(' DMO102 ')
    await t(w, 'join-form').trigger('submit')
    await flushPromises()
    expect(api.joinClass).toHaveBeenCalledWith('DMO102')
    expect(t(w, 'join-success').text()).toContain('Berjaya menyertai kelas')
    expect((t(w, 'class-code').element as HTMLInputElement).value).toBe('')
    expect(w.findAll('[data-testid="joined-class"]')).toHaveLength(1)
  })

  it('shows the response message of an unknown code and of an already-joined class (@provisional UNVERIFIED COPY)', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([]))
    api.joinClass.mockRejectedValueOnce(refusal(404, 'Kod kelas tidak sah.'))
    const w = await mountPage()
    await t(w, 'class-code').setValue('ZZZ999')
    await t(w, 'join-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'join-error').text()).toContain('Kod kelas tidak sah.')
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(true)

    api.joinClass.mockRejectedValueOnce(refusal(409, 'Anda sudah menyertai kelas ini.'))
    await t(w, 'join-form').trigger('submit')
    await flushPromises()
    expect(t(w, 'join-error').text()).toContain('Anda sudah menyertai kelas ini.')
    expect(w.find('[data-testid="join-success"]').exists()).toBe(false)
  })
})

describe('joinErrorMessage', () => {
  it('maps validation, network and unknown errors', () => {
    expect(
      joinErrorMessage(
        new ApiError({
          status: 422,
          code: 'VALIDATION_ERROR',
          message: 'x',
          fields: { classCode: 'Sila masukkan kod kelas.' },
        }),
      ),
    ).toBe('Sila masukkan kod kelas.')
    expect(joinErrorMessage(new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'n' }))).toBe(
      'Ralat rangkaian. Sila cuba lagi.',
    )
    expect(joinErrorMessage(new Error('boom'))).toBe('Gagal menyertai kelas. Sila cuba lagi.')
  })
})
