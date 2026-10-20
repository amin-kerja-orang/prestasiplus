// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import IntakeUploadPage from '../admin/intake/pages/IntakeUploadPage.vue'
import { checkFile, PDF_ONLY_MESSAGE } from '../admin/intake/lib/ocr'
import adminIntakeRoutes from '../routes/admin-intake'

async function renderUpload(): Promise<{ accept: string | null; html: string }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<i/>' } }, ...adminIntakeRoutes],
  })
  await router.push('/')
  const w = mount(IntakeUploadPage, {
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  const accept = document.querySelector('input[type="file"]')?.getAttribute('accept') ?? null
  const html = w.html()
  w.unmount()
  return { accept, html }
}

describe('intake upload accept', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('http mode accepts .pdf only and says so', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const { accept, html } = await renderUpload()
    expect(accept).toBe('.pdf')
    expect(html).toContain('Hanya PDF')
  })

  it('mock mode keeps PDF, PNG and JPG', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const { accept, html } = await renderUpload()
    expect(accept).toBe('application/pdf,image/png,image/jpeg')
    expect(html).not.toContain('Hanya PDF')
  })

  it('refuses a non-PDF client-side in http mode with the backend message', () => {
    const png = new File(['x'], 'a.png', { type: 'image/png' })
    const pdf = new File(['x'], 'a.pdf', { type: 'application/pdf' })
    expect(checkFile(png, true)).toBe(PDF_ONLY_MESSAGE)
    expect(PDF_ONLY_MESSAGE).toBe('Jenis fail tidak disokong. Gunakan PDF.')
    expect(checkFile(pdf, true)).toBeNull()
    expect(checkFile(png)).toBeNull()
  })
})
