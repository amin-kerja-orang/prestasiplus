// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import BankEditPage from '../admin/papers/BankEditPage.vue'
import { QUICK_EDIT_OUT_OF_SCOPE } from '../server/bank-wire'

const server = vi.hoisted(() => ({ getBankEditable: vi.fn(), reviseQuestionFull: vi.fn(), subjects: () => [] }))
vi.mock('../server/client', () => ({ bijakAdminServer: () => server }))
vi.mock('@/composables/usePageMeta', () => ({ usePageMeta: () => ({ setHeader: vi.fn(), setTitle: vi.fn() }) }))

function editable(over: Record<string, unknown> = {}, gate: string[] = []) {
  return {
    row: { id: '7', status: 'terbit', subjectName: 'Sains', kind: 'objektif', version: 1 },
    question: {
      id: '7',
      label: '',
      type: 'mcq',
      stem: 'Teks soalan yang cukup panjang.',
      options: [
        { id: 'A', text: 'Satu' },
        { id: 'B', text: 'Dua' },
        { id: 'C', text: 'Tiga' },
      ],
      scheme: { kind: 'option', marks: 1, correct: 'B' },
      explanation: '',
      marks: 1,
      parts: [],
      tag: {},
    },
    pendingRevision: false,
    legacyTag: false,
    quickEdit: { outOfScope: false, gate },
    ...over,
  }
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spm/soalan', name: 'm28.admin.bank', component: stub },
      { path: '/:rest(.*)*', component: stub },
    ],
  })
  await router.push('/x')
  wrapper = mount(BankEditPage, { props: { qid: '7' }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  server.getBankEditable.mockReset().mockResolvedValue(editable())
  server.reviseQuestionFull.mockReset().mockResolvedValue({ ok: true, errors: [], message: 'Draf baharu #7 dicipta.' })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('Quick Edit on the real API (FR-ADM-Q24)', () => {
  it('saves the edited option and flashes the API text (AC-ADM-Q24.2)', async () => {
    const w = await render()
    await t(w, 'edit-option-C').setValue('Tiga baharu')
    await t(w, 'edit-submit').trigger('click')
    await flushPromises()
    const sent = server.reviseQuestionFull.mock.calls[0]?.[1] as { options: { text: string }[] }
    expect(sent.options[2]?.text).toBe('Tiga baharu')
    expect(useFlashStore().pending?.message ?? useFlashStore().current?.message).toBe('Draf baharu #7 dicipta.')
  })

  it('names a question with no correct option and refuses it (AC-ADM-Q24.1)', async () => {
    server.getBankEditable.mockResolvedValue(
      editable({ question: { ...editable().question, scheme: { kind: 'option', marks: 1, correct: '' } } }),
    )
    const w = await render()
    expect(t(w, 'edit-gate').text()).toContain('Tiada jawapan betul dipilih — soalan ini tidak boleh ditanda.')
    expect(t(w, 'edit-gate').text()).toContain('Soalan ini tidak boleh ditanda seperti sedia ada:')
    expect(t(w, 'edit-submit').attributes('disabled')).toBeDefined()
  })

  it('checks the text and every option (24-01, 24-03)', async () => {
    const w = await render()
    await t(w, 'edit-stem').setValue('pendek')
    await t(w, 'edit-option-A').setValue(' ')
    expect(t(w, 'edit-gate').text()).toContain('Teks soalan mesti sekurang-kurangnya 10 aksara.')
    expect(t(w, 'edit-gate').text()).toContain('Pilihan A tidak boleh kosong.')
    await t(w, 'edit-stem').setValue('')
    expect(t(w, 'edit-gate').text()).toContain('Teks soalan tidak boleh kosong.')
  })

  it('a question out of scope shows the text and the link, and cannot be saved (FR-ADM-Q24.1)', async () => {
    server.getBankEditable.mockResolvedValue(editable({ quickEdit: { outOfScope: true, gate: [] } }))
    const w = await render()
    expect(t(w, 'edit-out-of-scope').text()).toContain(QUICK_EDIT_OUT_OF_SCOPE)
    expect(t(w, 'edit-open-studio').attributes('href')).toBe('/admin/studio/questions/7/sunting')
    expect(t(w, 'edit-open-studio').text()).toBe('Buka editor penuh')
    expect(w.find('[data-testid="edit-stem"]').exists()).toBe(false)
    expect(t(w, 'edit-submit').attributes('disabled')).toBeDefined()
  })

  it('locks a question in Menunggu Semakan', async () => {
    server.getBankEditable.mockResolvedValue(editable({ pendingRevision: true }))
    const w = await render()
    expect(t(w, 'edit-locked').text()).toContain('Versi baharu menunggu semakan')
    expect(t(w, 'edit-submit').attributes('disabled')).toBeDefined()
  })

  it('shows what the approval gate still wants (FR-QA-44)', async () => {
    server.getBankEditable.mockResolvedValue(editable({}, ['Sila pilih Bab.']))
    const w = await render()
    expect(t(w, 'edit-completeness').text()).toContain('1 belum lengkap')
    expect(t(w, 'edit-completeness').text()).toContain('Sila pilih Bab.')
  })

  it('shows a server refusal under no gate heading', async () => {
    server.reviseQuestionFull.mockResolvedValue({ ok: false, errors: ['Ditolak pelayan.'] })
    const w = await render()
    await t(w, 'edit-submit').trigger('click')
    await flushPromises()
    expect(t(w, 'edit-server-errors').text()).toContain('Ditolak pelayan.')
    expect(w.find('[data-testid="edit-gate"]').exists()).toBe(false)
  })

  it('says when the completeness check could not load', async () => {
    server.getBankEditable.mockResolvedValue(editable({ quickEdit: { outOfScope: false, gate: null } }))
    const w = await render()
    expect(t(w, 'edit-completeness-failed').text()).toContain('tidak dapat dimuatkan')
    expect(w.find('[data-testid="edit-stem"]').exists()).toBe(true)
  })
})
