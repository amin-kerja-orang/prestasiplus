// @vitest-environment jsdom
// S3-T06 admin UI: Kertas Subjektif detail (FR-ADM-Q18.2, FR-ADM-Q18.8, fields 18-09, 18-10, 18-11).
import { BIJAK_BUILDER_MESSAGES as M } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'

import { setBuilderServerForTests } from '../admin/builder/server/client'
import { MockBuilderServer } from '../admin/builder/server/memory'
import SubjektifPaperDetailPage from '../admin/papers/SubjektifPaperDetailPage.vue'
import { SUBJEKTIF_ROUTES } from '../admin/papers/ui'

let wrapper: VueWrapper | null = null
let api: MockBuilderServer

async function render(id: string): Promise<VueWrapper> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/kertas-subjektif', name: SUBJEKTIF_ROUTES.list, component: stub },
      { path: '/admin/kertas-subjektif/:id', name: SUBJEKTIF_ROUTES.detail, component: SubjektifPaperDetailPage },
      { path: '/admin/studio/questions/:id(\\d+)/sunting', name: 'm04.studio.edit', component: stub },
      { path: '/admin/studio/sets/:id/builder', component: stub },
    ],
  })
  await router.push(`/admin/kertas-subjektif/${id}`)
  wrapper = mount(SubjektifPaperDetailPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

const body = (): HTMLElement => document.body
const byTid = (id: string): HTMLElement | null => body().querySelector(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  // jsdom has no blob URLs; the file list of the upload field asks for one.
  URL.createObjectURL = () => 'blob:test'
  api = new MockBuilderServer()
  setBuilderServerForTests(api)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  setBuilderServerForTests(null)
})

describe('Kandungan tab (18-11)', () => {
  it('lists placements by section and links to the Set Builder and the pupil view', async () => {
    await render('sj-1')
    expect(byTid('sj-title')!.textContent).toBe('Bahasa Melayu Kertas 2 - Percubaan Contoh')
    expect(byTid('sj-section-sj-1-s1')!.textContent).toContain('Bahagian A')
    expect(byTid('sj-placement-9001')!.textContent).toContain('Soalan contoh 1')
    expect(body().textContent).toContain('Muat naik PDF sumber')
    expect(byTid('sj-open-builder')!.getAttribute('href')).toBe('/admin/studio/sets/sj-1/builder')
    expect(byTid('sj-open-builder')!.textContent).toContain('Buka di Set Builder')
    expect(byTid('sj-as-pupil')!.getAttribute('href')).toBe('/kertas-subjektif/sj-1')
    expect(byTid('sj-as-pupil')!.textContent).toContain('Lihat sebagai pelajar')
  })

  it('an empty draft says there is no question', async () => {
    await render('sj-3')
    expect(byTid('sj-content-empty')).not.toBeNull()
  })
})

describe('Skema tab (18-10, FR-ADM-Q18.8)', () => {
  it('flags a question without a scheme "tiada skema — tidak disajikan" and links every question to the Studio editor', async () => {
    await render('sj-2')
    ;byTid('sj-tab-skema')!.click()
    await flushPromises()
    expect(byTid('sj-scheme-missing-9004')!.textContent).toContain('tiada skema — tidak disajikan')
    expect(byTid('sj-scheme-missing-9004')!.textContent).toContain(M.subjektifNoScheme)
    expect(byTid('sj-scheme-ok-9003')).not.toBeNull()
    expect(byTid('sj-scheme-edit-9004')!.getAttribute('href')).toBe('/admin/studio/questions/9004/sunting')
  })
})

describe('Muat naik PDF sumber (18-09)', () => {
  const pdf = (name: string, size = 4) => {
    const f = new File([new Uint8Array(4)], name, { type: 'application/pdf' })
    Object.defineProperty(f, 'size', { value: size })
    return f
  }
  async function pick(testId: string, file: File): Promise<void> {
    const input = byTid(testId) as HTMLInputElement
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
  }

  it('needs Kertas (PDF); a non-pdf shows the invalid-format message', async () => {
    await render('sj-3')
    byTid('sj-upload-open')!.click()
    await flushPromises()
    expect(body().textContent).toContain('Kertas (PDF)')
    expect(body().textContent).toContain('Skema (PDF)')
    byTid('sj-upload-submit')!.click()
    await flushPromises()
    expect(body().textContent).toContain(M.sourcePdfInvalid)
  })

  it('too large a file shows the 30 MB message', async () => {
    await render('sj-3')
    byTid('sj-upload-open')!.click()
    await flushPromises()
    await pick('sj-file-paper', pdf('kertas.pdf', 31 * 1024 * 1024))
    byTid('sj-upload-submit')!.click()
    await flushPromises()
    expect(body().textContent).toContain(M.sourcePdfTooLarge)
  })

  it('while the source route is missing (404) the dialog shows the generic error, no success flash', async () => {
    await render('sj-3')
    const spy = vi.spyOn(api, 'uploadSource')
    byTid('sj-upload-open')!.click()
    await flushPromises()
    await pick('sj-file-paper', pdf('kertas.pdf'))
    byTid('sj-upload-submit')!.click()
    await flushPromises()
    expect(spy).toHaveBeenCalledOnce()
    expect(byTid('sj-upload-error')!.textContent).toBe('Sesuatu tidak kena. Sila cuba lagi.')
    expect(useFlashStore().current).toBeNull()
  })
})
