// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import PanduanPage from '../../pages/PanduanPage.vue'
import { GUIDE_ROLES, resolveGuideRole, roleFromHash, roleFromQuery } from '../../lib/panduan-content'
import panduanRoutes from '../../routes/panduan'

const api = vi.hoisted(() => ({ fetchSupportConfig: vi.fn() }))
vi.mock('../../api/content', () => api)

const session = vi.hoisted(() => ({ loggedIn: false }))
vi.mock('@/composables/useSession', async () => {
  const { computed } = await import('vue')
  return { useSession: () => ({ isLoggedIn: computed(() => session.loggedIn) }) }
})

const scrollTo = vi.fn()
let wrapper: VueWrapper | null = null
let currentRouter: Router | null = null

async function render(url = '/panduan', loggedIn = false): Promise<VueWrapper> {
  const pinia = createPinia()
  setActivePinia(pinia)
  session.loggedIn = loggedIn
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/panduan', component: PanduanPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  currentRouter = router
  wrapper = mount(PanduanPage, { global: { plugins: [pinia, router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  api.fetchSupportConfig.mockResolvedValue({
    email: 'support@prestasiplus.my',
    phone: '',
    whatsapp: '60123456789',
    hours: '',
  })
  window.scrollTo = scrollTo
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.restoreAllMocks()
})

describe('panduan route fragment', () => {
  it('declares S26 public and S27 auth, both bare with the exact title', () => {
    expect(
      panduanRoutes.map((r) => [r.path, r.meta?.access, r.meta?.layout, r.meta?.title]),
    ).toEqual([
      ['/panduan', 'public', 'bare', 'Panduan Pengguna — PRESTASIPLUS'],
      ['/pusat-tuisyen/panduan', 'auth', 'bare', 'Panduan Pengguna — PRESTASIPLUS'],
    ])
  })
})

describe('roleFromHash', () => {
  it('defaults to pelajar and keeps an unknown hash as is', () => {
    expect(roleFromHash('')).toBe('pelajar')
    expect(roleFromHash('#guru')).toBe('guru')
    expect(roleFromHash('#xyz')).toBe('xyz')
  })
})

describe('?peranan= mapping', () => {
  it.each([
    ['pelajar', 'pelajar'],
    ['guru', 'guru'],
    ['ibu-bapa', 'ibubapa'],
    ['admin-sekolah', 'admin'],
    ['ppd', 'ppd'],
  ] as const)('%s opens the %s tab', (query, id) => {
    expect(roleFromQuery(query)).toBe(id)
  })

  it('an unknown, empty or missing value gives pelajar', () => {
    for (const v of ['xyz', '', undefined, null, 'ibubapa', 'constructor', ['xyz']]) {
      expect(roleFromQuery(v)).toBe('pelajar')
    }
    expect(roleFromQuery(['guru', 'ppd'])).toBe('guru')
  })

  it('the hash wins over the query and the default stays pelajar', () => {
    expect(resolveGuideRole('#ppd', 'guru')).toBe('ppd')
    expect(resolveGuideRole('', 'guru')).toBe('guru')
    expect(resolveGuideRole('', undefined)).toBe('pelajar')
  })
})

describe('PanduanPage ?peranan=', () => {
  it.each([
    ['pelajar', 'pelajar'],
    ['guru', 'guru'],
    ['ibu-bapa', 'ibubapa'],
    ['admin-sekolah', 'admin'],
    ['ppd', 'ppd'],
  ] as const)('?peranan=%s opens the %s panel', async (query, id) => {
    const w = await render(`/panduan?peranan=${query}`)
    expect(w.find(`[data-testid="panduan-tab-${id}"]`).attributes('data-active')).toBe('true')
    expect(w.find(`[data-testid="panduan-panel-${id}"]`).exists()).toBe(true)
  })

  it('an unknown ?peranan= opens pelajar', async () => {
    const w = await render('/panduan?peranan=xyz')
    expect(w.find('[data-testid="panduan-tab-pelajar"]').attributes('data-active')).toBe('true')
    expect(w.find('[data-testid="panduan-panel-pelajar"]').exists()).toBe(true)
  })

  it('the hash beats the query', async () => {
    const w = await render('/panduan?peranan=guru#ppd')
    expect(w.find('[data-testid="panduan-panel-ppd"]').exists()).toBe(true)
    expect(w.find('[data-testid="panduan-panel-guru"]').exists()).toBe(false)
  })

  it('reacts when only the query changes', async () => {
    const w = await render('/panduan?peranan=guru')
    expect(w.find('[data-testid="panduan-panel-guru"]').exists()).toBe(true)
    await currentRouter!.push('/panduan?peranan=ibu-bapa')
    await flushPromises()
    expect(w.find('[data-testid="panduan-panel-ibubapa"]').exists()).toBe(true)
    expect(w.find('[data-testid="panduan-panel-guru"]').exists()).toBe(false)
  })
})

describe('Guru steps', () => {
  it('renames "Kongsi Kod Kelas" to "Tambah Pelajar" with the new sentence', async () => {
    const w = await render('/panduan#guru')
    expect(w.text()).toContain('Tambah Pelajar')
    expect(w.text()).toContain('Tambah pelajar ke kelas anda daripada Kelas Saya.')
    expect(w.text()).not.toContain('Kongsi Kod Kelas')
    expect(w.text()).not.toContain('LZ0942')
  })
})

describe('PanduanPage', () => {
  it('opens the Pelajar panel by default with the hero and 5 tabs', async () => {
    const w = await render()
    expect(w.find('h1').text()).toBe('Panduan Pengguna PRESTASIPLUS')
    expect(w.findAll('[data-testid^="panduan-tab-"]')).toHaveLength(5)
    expect(w.find('[data-testid="panduan-tab-pelajar"]').attributes('data-active')).toBe('true')
    expect(w.text()).toContain('Cara Daftar Akaun Pelajar')
    expect(w.findAll('[data-testid="panduan-feature"]')).toHaveLength(6)
  })

  it.each(GUIDE_ROLES.map((r) => [r.id, r.stepsTitle] as const))(
    'hash #%s opens its panel',
    async (id, title) => {
      const w = await render(`/panduan#${id}`)
      expect(w.text()).toContain(title)
      expect(w.find(`[data-testid="panduan-panel-${id}"]`).exists()).toBe(true)
    },
  )

  it('an unknown hash shows no panel and no active tab, but the help box stays', async () => {
    const w = await render('/panduan#xyz')
    expect(w.find('[data-testid^="panduan-panel-"]').exists()).toBe(false)
    expect(w.findAll('[data-active="true"]')).toHaveLength(0)
    expect(w.find('[data-testid="panduan-help"]').exists()).toBe(true)
  })

  it('a tab click switches the panel, replaces the hash and scrolls to the top', async () => {
    const w = await render()
    const spy = vi.spyOn(window.history, 'replaceState')
    await w.find('[data-testid="panduan-tab-guru"]').trigger('click')
    expect(w.text()).toContain('Cara Daftar Akaun Guru')
    expect(w.text()).not.toContain('Cara Daftar Akaun Pelajar')
    expect(spy.mock.calls[0]?.[2]).toBe('#guru')
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' })
  })

  it('FAQ items toggle independently', async () => {
    const w = await render()
    const buttons = w.findAll('[data-testid="panduan-faq-toggle"]')
    await buttons[0]!.trigger('click')
    await buttons[2]!.trigger('click')
    expect(w.findAll('[data-testid="panduan-faq-answer"]')).toHaveLength(2)
    await buttons[0]!.trigger('click')
    const answers = w.findAll('[data-testid="panduan-faq-answer"]')
    expect(answers).toHaveLength(1)
    expect(answers[0]!.text()).toContain('Kombo bermaksud')
  })

  it('FAQ toggle buttons carry aria-expanded that follows each item', async () => {
    const w = await render()
    const buttons = w.findAll('[data-testid="panduan-faq-toggle"]')
    expect(buttons[0]!.attributes('aria-expanded')).toBe('false')
    await buttons[0]!.trigger('click')
    expect(buttons[0]!.attributes('aria-expanded')).toBe('true')
    expect(buttons[1]!.attributes('aria-expanded')).toBe('false')
    await buttons[0]!.trigger('click')
    expect(buttons[0]!.attributes('aria-expanded')).toBe('false')
  })

  it('builds the help box links from the support config', async () => {
    api.fetchSupportConfig.mockResolvedValue({ email: 'a@b.my', phone: '', whatsapp: '60111111111', hours: '' })
    const w = await render()
    expect(w.find('[data-testid="panduan-email"]').attributes('href')).toBe('mailto:a@b.my')
    const wa = w.find('[data-testid="panduan-whatsapp"]')
    expect(wa.attributes('href')).toBe('https://wa.me/60111111111')
    expect(wa.attributes('target')).toBe('_blank')
  })

  it('hides the contact block for an empty config but keeps the guest register button', async () => {
    api.fetchSupportConfig.mockResolvedValue({ email: '', phone: '', whatsapp: '', hours: '' })
    const w = await render()
    expect(w.find('[data-testid="panduan-contact"]').exists()).toBe(false)
    expect(w.find('[data-testid="panduan-email"]').exists()).toBe(false)
    expect(w.find('[data-testid="panduan-whatsapp"]').exists()).toBe(false)
    expect(w.text()).not.toContain('E-mel Kami')
    expect(w.find('[data-testid="panduan-register"]').exists()).toBe(true)
  })

  it('hides the whole help card for an empty config when logged in', async () => {
    api.fetchSupportConfig.mockResolvedValue({ email: '', phone: '', whatsapp: '', hours: '' })
    const w = await render('/panduan', true)
    expect(w.find('[data-testid="panduan-help"]').exists()).toBe(false)
  })

  it('shows nothing, and no default contact, when the config call fails', async () => {
    api.fetchSupportConfig.mockRejectedValue(new Error('x'))
    const w = await render()
    expect(w.find('[data-testid="panduan-contact"]').exists()).toBe(false)
    expect(w.find('[data-testid="panduan-email"]').exists()).toBe(false)
    expect(w.find('[data-testid="panduan-whatsapp"]').exists()).toBe(false)
    expect(w.html()).not.toContain('support@prestasiplus.my')
    expect(w.html()).not.toContain('60123456789')
  })

  it('shows only the e-mail button when only the e-mail is set', async () => {
    api.fetchSupportConfig.mockResolvedValue({ email: 'a@b.my', phone: '', whatsapp: '', hours: '' })
    const w = await render()
    expect(w.find('[data-testid="panduan-contact"]').exists()).toBe(true)
    expect(w.find('[data-testid="panduan-email"]').attributes('href')).toBe('mailto:a@b.my')
    expect(w.find('[data-testid="panduan-whatsapp"]').exists()).toBe(false)
  })

  it('shows only the WhatsApp button when only the number is set', async () => {
    api.fetchSupportConfig.mockResolvedValue({ email: '', phone: '', whatsapp: '60111111111', hours: '' })
    const w = await render()
    expect(w.find('[data-testid="panduan-email"]').exists()).toBe(false)
    expect(w.find('[data-testid="panduan-whatsapp"]').attributes('href')).toBe(
      'https://wa.me/60111111111',
    )
  })

  it('shows the guest links and the register button for a guest', async () => {
    const w = await render()
    expect(w.find('[data-testid="panduan-register"]').text()).toContain('Daftar Percuma Sekarang')
    expect(w.find('[data-testid="panduan-links"]').text()).toContain('Log Masuk')
    expect(w.find('[data-testid="panduan-links"]').text()).not.toContain('Dashboard')
  })

  it('shows Dashboard and no register button when logged in', async () => {
    const w = await render('/panduan', true)
    expect(w.find('[data-testid="panduan-register"]').exists()).toBe(false)
    expect(w.find('[data-testid="panduan-links"]').text()).toContain('Dashboard')
  })

  it('the menu toggle opens and closes the mobile menu', async () => {
    const w = await render()
    expect(w.find('[data-testid="panduan-mobile-menu"]').exists()).toBe(false)
    await w.find('[data-testid="panduan-menu-toggle"]').trigger('click')
    expect(w.find('[data-testid="panduan-mobile-menu"]').exists()).toBe(true)
    await w.find('[data-testid="panduan-menu-toggle"]').trigger('click')
    expect(w.find('[data-testid="panduan-mobile-menu"]').exists()).toBe(false)
  })

  it('renders the footer copy', async () => {
    const w = await render()
    expect(w.find('footer').text()).toContain('© 2026 🇲🇾')
    expect(w.find('footer').text()).toContain('Platform Latih Tubi Nasional')
  })
})
