// @vitest-environment jsdom
/** S8-T02 part 2: the sitting uses the one StimulusGroup (open once per group, blocked group blocks Seterusnya). */
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { resetStimulusOpen } from '../../../components/question-display/lib/useStimulusOpen'
import AttemptPage from '../pages/AttemptPage.vue'

const server = vi.hoisted(() => ({
  getAttemptView: vi.fn(),
  saveAnswers: vi.fn(),
  submit: vi.fn(),
  serverNow: () => Date.now(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server, browserStorage: () => window.localStorage }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const DrawerStub = defineComponent({
  props: { open: Boolean, title: String, description: String },
  emits: ['update:open'],
  setup(p, { slots }) {
    return () =>
      h('div', { 'data-testid': 'drawer', 'data-open': String(p.open), 'data-title': p.title }, [
        p.open ? slots.body?.() : null,
      ])
  },
})
const stubs = { UDrawer: DrawerStub, Drawer: DrawerStub }

const q = (sel: string): Element | null => document.body.querySelector(sel)
const groupDrawer = (): Element | null => q('[data-testid=drawer][data-title="Rajah 1"]')
let wrapper: VueWrapper | null = null

function width(wide: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: wide,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

function view(): unknown {
  return {
    attempt: {
      id: 'a1',
      title: 'Kertas Contoh',
      mode: 'exam',
      status: 'in_progress',
      startedAt: Date.now(),
      deadline: null,
      answers: {},
      flags: [],
      picks: {},
      position: 0,
    },
    sections: [],
    groups: [
      {
        id: 'g1',
        questionIds: ['q1', 'q2'],
        stimulus: { id: 's1', kind: 'image', label: 'Rajah 1', alt: 'Carta', image: { url: '/api/files/s1' } },
      },
    ],
    checks: [],
    questions: [
      { id: 'q1', number: 1, mcq: true, sectionId: 's1', stem: 'Soalan satu?', options: [], groupId: 'g1' },
      { id: 'q2', number: 2, mcq: true, sectionId: 's1', stem: 'Soalan dua?', options: [], groupId: 'g1' },
    ],
  }
}

async function render(): Promise<void> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', name: 'm28.bijak', component: stub },
      { path: '/spm/bijak/percubaan/:attemptId', name: 'm28.bijak.attempt', component: stub },
      { path: '/r/:attemptId', name: 'm28.bijak.result', component: stub },
    ],
  })
  await router.push('/spm/bijak/percubaan/a1')
  wrapper = mount(AttemptPage, { global: { plugins: [router], stubs }, attachTo: document.body })
  await flushPromises()
}

beforeEach(() => {
  resetStimulusOpen()
  Element.prototype.scrollTo = vi.fn()
  server.getAttemptView.mockReset()
  server.getAttemptView.mockResolvedValue(view())
  width(false)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('AttemptPage at 375: one StimulusGroup', () => {
  it('renders one group chip and no separate pinned aside', async () => {
    await render()
    expect(document.body.querySelectorAll('[data-testid=stimulus-group]')).toHaveLength(1)
    expect(document.body.querySelectorAll('[data-testid=stimulus-chip]')).toHaveLength(1)
    expect(q('[data-testid=pinned-stimulus]')).toBeNull()
    expect(q('[data-testid=stimulus-chip]')?.textContent).toContain('Lihat Rajah 1')
  })

  it('is open the first time, and stays closed after closing when moving to the next member question', async () => {
    await render()
    expect(groupDrawer()?.getAttribute('data-open')).toBe('true')
    const drawer = wrapper!.findAllComponents(DrawerStub).find((d) => d.props('title') === 'Rajah 1')!
    drawer.vm.$emit('update:open', false)
    await flushPromises()
    expect(groupDrawer()?.getAttribute('data-open')).toBe('false')
    ;(q('[data-testid=next]') as HTMLElement).click()
    await flushPromises()
    expect(q('[data-testid=position]')?.textContent).toContain('Soalan 2 / 2')
    expect(groupDrawer()?.getAttribute('data-open')).toBe('false')
  })

  it('a failing figure still blocks Seterusnya', async () => {
    await render()
    expect(q('[data-testid=next]')?.hasAttribute('disabled')).toBe(false)
    q('[data-testid=drawer] img')!.dispatchEvent(new Event('error'))
    await flushPromises()
    expect(q('[data-testid=next]')?.hasAttribute('disabled')).toBe(true)
    expect(q('[data-testid=need-stimulus]')).not.toBeNull()
  })

  it('at 1280 the split keeps the V3 ratio: stimulus 4 : questions 5', async () => {
    width(true)
    await render()
    const g = q('[data-testid=stimulus-group]')!
    expect(g.getAttribute('data-layout')).toBe('split')
    expect(g.classList.contains('grid-cols-9')).toBe(true)
    expect(q('[data-testid=stimulus-pane]')!.classList.contains('col-span-4')).toBe(true)
    expect(q('[data-testid=stimulus-questions]')!.classList.contains('col-span-5')).toBe(true)
  })
})
