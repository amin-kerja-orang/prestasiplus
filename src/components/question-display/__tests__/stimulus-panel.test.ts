// @vitest-environment jsdom
// S8-T02 part 1: stimulus panel once, sticky, zoomable (FR-X1-4d, FR-X6-1/6/7, FR-PA-03, FR-PA-37, AC-X6-2).
/* eslint-disable vue/one-component-per-file -- two small stubs */
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import { groupLabel, stimuliLabel } from '../lib/stimulus-data'
import { resetStimulusOpen, useStimulusOpen } from '../lib/useStimulusOpen'
import StimulusFigure from '../StimulusFigure.vue'
import StimulusGroup from '../StimulusGroup.vue'
import type { StimulusData } from '../types'

const fig: StimulusData = { id: 'f1', kind: 'image', label: 'Rajah 1', src: '/x.png', alt: 'Litar bersiri' }
const pas: StimulusData = { id: 'p1', kind: 'passage', label: 'Petikan A', text: 'Teks petikan.' }

const DrawerStub = defineComponent({
  props: { open: { type: Boolean, default: false }, title: { type: String, default: '' } },
  emits: ['update:open'],
  setup(p, { slots, emit }) {
    return () =>
      h('div', { 'data-stub': 'drawer', 'data-open': String(p.open), 'data-title': p.title }, [
        p.open ? (slots.body?.() ?? []) : [],
        h('button', { 'data-testid': 'drawer-close', onClick: () => emit('update:open', false) }, 'Tutup'),
      ])
  },
})
const ModalStub = defineComponent({
  props: {
    open: { type: Boolean, default: false },
    title: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  emits: ['update:open'],
  setup(p, { slots, emit }) {
    return () =>
      h(
        'div',
        {
          onKeydown: (e: KeyboardEvent) => e.key === 'Escape' && emit('update:open', false),
          'data-stub': 'modal', 'data-open': String(p.open), 'data-title': p.title, 'data-desc': p.description },
        p.open ? (slots.body?.() ?? []) : [],
      )
  },
})
const stubs = { UDrawer: DrawerStub, Drawer: DrawerStub, UModal: ModalStub, Modal: ModalStub }

const media = (wide: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}
const mountGroup = async (wide: boolean, props: Record<string, unknown>) => {
  media(wide)
  const w = mount(StimulusGroup, {
    props,
    slots: { default: '<p data-testid="q">S1</p><p data-testid="q">S2</p><p data-testid="q">S3</p>' },
    global: { stubs },
    attachTo: document.body,
  })
  await nextTick()
  return w
}

enableAutoUnmount(afterEach)
beforeEach(() => resetStimulusOpen())
afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('FR-X1-4d StimulusGroup stimuli[]', () => {
  it('renders every stimulus in order with the joined label "Rajah 1 dan Petikan A"', async () => {
    const w = await mountGroup(true, { stimuli: [fig, pas] })
    expect(w.findAll('[data-testid=stimulus]').map((e) => e.attributes('data-stimulus'))).toEqual(['f1', 'p1'])
    expect(w.find('[data-testid=stimulus-pane]').attributes('aria-label')).toBe('Rajah 1 dan Petikan A')
    expect(stimuliLabel([fig, pas])).toBe('Rajah 1 dan Petikan A')
  })

  it('the single `stimulus` prop is treated as [stimulus]', async () => {
    const w = await mountGroup(true, { stimulus: fig })
    expect(w.findAll('[data-testid=stimulus]')).toHaveLength(1)
    expect(w.find('[data-testid=stimulus-pane]').attributes('aria-label')).toBe('Rajah 1')
  })

  it('emits loaded and error per stimulus with its id', async () => {
    const w = await mountGroup(true, { stimuli: [fig, { ...fig, id: 'f2', label: 'Rajah 2' }] })
    const imgs = w.findAll('img')
    await imgs[0]!.trigger('load')
    await imgs[1]!.trigger('error')
    expect(w.emitted('loaded')).toEqual([['f1']])
    expect(w.emitted('error')).toEqual([['f2']])
  })
})

describe('FR-PA-03 header is the chip below 1024px, pinned from 1024px', () => {
  it('375: the header is one chip "Lihat Rajah 1 dan Petikan A" opening the drawer', async () => {
    const w = await mountGroup(false, { stimuli: [fig, pas] })
    expect(w.findAll('[data-testid=stimulus-chip]')).toHaveLength(1)
    expect(w.find('[data-testid=stimulus-chip]').text()).toContain('Lihat Rajah 1 dan Petikan A')
    expect(w.find('[data-testid=stimulus-pane]').exists()).toBe(false)
    expect(w.find('[data-stub=drawer]').attributes('data-title')).toBe('Rajah 1 dan Petikan A')
  })

  it('768: stacked, chip and group are full width', async () => {
    const w = await mountGroup(false, { stimuli: [fig] })
    expect(w.find('[data-layout=stacked]').classes()).toContain('w-full')
    expect(w.find('[data-testid=stimulus-chip]').classes()).toContain('w-full')
  })

  it('1280: pinned sticky pane, no chip, no drawer', async () => {
    const w = await mountGroup(true, { stimuli: [fig] })
    expect(w.find('[data-testid=stimulus-pane]').classes()).toContain('sticky')
    expect(w.find('[data-testid=stimulus-chip]').exists()).toBe(false)
    expect(w.find('[data-stub=drawer]').exists()).toBe(false)
  })
})

describe('FR-X6-6 useStimulusOpen', () => {
  it('is open the first time a group id appears', () => {
    expect(useStimulusOpen('g1').value).toBe(true)
  })
  it('keeps closed after the pupil closes it, also on a remount', () => {
    useStimulusOpen('g1').value = false
    expect(useStimulusOpen('g1').value).toBe(false)
  })
  it('is separate per group id', () => {
    useStimulusOpen('g1').value = false
    expect(useStimulusOpen('g2').value).toBe(true)
  })
  it('StimulusGroup with groupId: drawer open first, closed by the pupil, still closed after remount', async () => {
    const a = await mountGroup(false, { stimuli: [fig], groupId: 'g9' })
    expect(a.find('[data-stub=drawer]').attributes('data-open')).toBe('true')
    await a.find('[data-testid=drawer-close]').trigger('click')
    expect(a.find('[data-stub=drawer]').attributes('data-open')).toBe('false')
    a.unmount()
    const b = await mountGroup(false, { stimuli: [fig], groupId: 'g9' })
    expect(b.find('[data-stub=drawer]').attributes('data-open')).toBe('false')
  })
  it('without groupId the v-model open default (false) is unchanged', async () => {
    const w = await mountGroup(false, { stimuli: [fig] })
    expect(w.find('[data-stub=drawer]').attributes('data-open')).toBe('false')
  })
})

describe('FR-X6-7 figure zoom', () => {
  const mountFig = async () => {
    const w = mount(StimulusFigure, { props: { stimulus: fig }, global: { stubs }, attachTo: document.body })
    await w.find('img').trigger('load')
    return w
  }
  const modalOpen = (w: Awaited<ReturnType<typeof mountFig>>) => w.find('[data-stub=modal]').attributes('data-open')

  it('opens on tap, announces the alt text, and "Tutup" closes it (44 px)', async () => {
    const w = await mountFig()
    expect(modalOpen(w)).toBe('false')
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    expect(modalOpen(w)).toBe('true')
    const m = w.find('[data-stub=modal]')
    expect(m.attributes('data-title')).toBe('Litar bersiri')
    expect(m.attributes('data-desc')).toBe('Litar bersiri')
    expect(w.find('[data-testid=stimulus-zoom-img]').attributes('alt')).toBe('Litar bersiri')
    const close = w.find('[data-testid=stimulus-zoom-close]')
    expect(close.text()).toBe('Tutup')
    expect(close.classes()).toEqual(expect.arrayContaining(['min-h-11', 'min-w-11']))
    await close.trigger('click')
    expect(modalOpen(w)).toBe('false')
  })

  it('Back (popstate) closes it; a history entry is pushed while open', async () => {
    const push = vi.spyOn(window.history, 'pushState')
    const w = await mountFig()
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await nextTick()
    expect(modalOpen(w)).toBe('false')
  })

  it('double-tap toggles 2x and back to fit', async () => {
    const w = await mountFig()
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    const area = w.find('[data-testid=stimulus-zoom-area]')
    const tap = async () => {
      await area.trigger('pointerdown')
      await area.trigger('pointerup')
    }
    await tap()
    await tap()
    expect(w.find('[data-testid=stimulus-zoom-img]').attributes('data-scale')).toBe('2')
    await tap()
    await tap()
    expect(w.find('[data-testid=stimulus-zoom-img]').attributes('data-scale')).toBe('1')
  })
})

describe('FR-PA-37 source line', () => {
  it.each(['image', 'diagram', 'map', 'infographic', 'graph'] as const)('%s shows "Sumber: {text}"', (kind) => {
    const w = mount(StimulusFigure, {
      props: { stimulus: { id: 'a', kind, src: '/a.png', source: 'Buku Teks' } },
      global: { stubs },
    })
    expect(w.find('[data-testid=stimulus-source]').text()).toBe('Sumber: Buku Teks')
  })
  it('table and passage show it too', () => {
    const t = mount(StimulusFigure, {
      props: { stimulus: { id: 't', kind: 'table', table: { head: ['a'], rows: [['1']] }, source: 'JPN' } },
      global: { stubs },
    })
    expect(t.find('[data-testid=stimulus-source]').text()).toBe('Sumber: JPN')
    const p = mount(StimulusFigure, { props: { stimulus: { ...pas, source: 'Akhbar' } }, global: { stubs } })
    expect(p.find('[data-testid=stimulus-source]').text()).toBe('Sumber: Akhbar')
  })
})

describe('R1-04 table and graph rendering', () => {
  it('with no flag a table without rows renders as before (no notice)', () => {
    const w = mount(StimulusFigure, {
      props: { stimulus: { id: 't', kind: 'table', table: { head: ['a'], rows: [] } } },
      global: { stubs },
    })
    expect(w.find('[data-testid=not-served]').exists()).toBe(false)
    expect(w.find('[data-testid=stimulus]').exists()).toBe(true)
  })

  it('a non-table kind with rows and no picture is drawn as a table', () => {
    const w = mount(StimulusFigure, {
      props: { stimulus: { id: 'g', kind: 'graph', table: { head: ['x'], rows: [['1']] } } },
      global: { stubs },
    })
    expect(w.find('table').exists()).toBe(true)
  })
})

describe('FR-X6-1 long content scrolls inside', () => {
  it('passage block is overflow-x-auto', () => {
    const w = mount(StimulusFigure, { props: { stimulus: pas }, global: { stubs } })
    expect(w.find('[data-testid=stimulus-passage]').classes()).toContain('overflow-x-auto')
  })
})

describe('AC-X6-2 one figure + 3 questions at 375', () => {
  it('shows the figure once, with the 3 questions beside the chip', async () => {
    const w = await mountGroup(false, { stimuli: [fig], groupId: 'ac-x6-2' })
    expect(w.findAll('[data-testid=stimulus]')).toHaveLength(1)
    expect(w.findAll('[data-testid=q]')).toHaveLength(3)
    expect(w.findAll('[data-testid=stimulus-chip]')).toHaveLength(1)
  })
})

describe('FR-X6-7 zoom: ESC, unmount, cancel', () => {
  it('ESC closes the viewer', async () => {
    const w = mount(StimulusFigure, { props: { stimulus: fig }, global: { stubs }, attachTo: document.body })
    await w.find('img').trigger('load')
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    await w.find('[data-stub=modal]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-stub=modal]').attributes('data-open')).toBe('false')
  })

  it('unmount while open removes the listener and never calls history.back()', async () => {
    const back = vi.spyOn(window.history, 'back')
    const remove = vi.spyOn(window, 'removeEventListener')
    const w = mount(StimulusFigure, { props: { stimulus: fig }, global: { stubs }, attachTo: document.body })
    await w.find('img').trigger('load')
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    w.unmount()
    expect(back).not.toHaveBeenCalled()
    expect(remove).toHaveBeenCalledWith('popstate', expect.any(Function), true)
  })

  it('pointercancel is not a tap (no double-tap zoom)', async () => {
    const w = mount(StimulusFigure, { props: { stimulus: fig }, global: { stubs }, attachTo: document.body })
    await w.find('img').trigger('load')
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    const area = w.find('[data-testid=stimulus-zoom-area]')
    for (let i = 0; i < 2; i++) {
      await area.trigger('pointerdown')
      await area.trigger('pointercancel')
    }
    expect(w.find('[data-testid=stimulus-zoom-img]').attributes('data-scale')).toBe('1')
  })
})

describe('FR-PA-37 source line keeps one prefix', () => {
  it('adds "Sumber: " once and never doubles a stored prefix', async () => {
    const { sourceLine } = await import('../copy')
    expect(sourceLine('buku teks')).toBe('Sumber: buku teks')
    expect(sourceLine('Sumber: buku teks')).toBe('Sumber: buku teks')
    expect(sourceLine('  sumber:kajian ')).toBe('sumber:kajian')
  })
})

describe('FR-X6-7 zoom Back and the router', () => {
  it('Back closes the viewer; the route does not change and no guard is run', async () => {
    const { createRouter, createWebHistory } = await import('vue-router')
    const router = createRouter({
      history: createWebHistory(),
      routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
    })
    await router.push('/soalan')
    await router.isReady()
    const guard = vi.fn()
    router.beforeEach(guard)
    const w = mount(StimulusFigure, {
      props: { stimulus: fig },
      global: { stubs, plugins: [router] },
      attachTo: document.body,
    })
    await w.find('img').trigger('load')
    await w.find('[data-testid=stimulus-zoom-open]').trigger('click')
    expect(w.find('[data-stub=modal]').attributes('data-open')).toBe('true')
    window.history.back()
    await new Promise((r) => setTimeout(r, 50))
    expect(w.find('[data-stub=modal]').attributes('data-open')).toBe('false')
    expect(router.currentRoute.value.fullPath).toBe('/soalan')
    expect(guard).not.toHaveBeenCalled()
  })
})

describe('FR-PA-37 StimulusView passage source', () => {
  it('uses the same "Sumber:" format as StimulusFigure', async () => {
    const { default: StimulusView } = await import('../StimulusView.vue')
    const w = mount(StimulusView, {
      props: { stimulus: { id: 'p', kind: 'passage', label: 'Petikan A', text: 'Teks.', source: 'Buku Teks', alt: '' } as never },
      global: { stubs },
    })
    expect(w.find('[data-testid=stimulus-source]').text()).toBe('Sumber: Buku Teks')
  })
})

describe('label fallback by kind (one rule for groupLabel and stimuliLabel)', () => {
  it('an unlabelled passage is "Petikan", an unlabelled figure is "Rajah"; labels win', () => {
    expect(stimuliLabel([{ id: 'p', kind: 'passage', text: 'x' }])).toBe('Petikan')
    expect(stimuliLabel([{ id: 'f', kind: 'image', src: '/a.png' }])).toBe('Rajah')
    expect(groupLabel([{ id: 'p', kind: 'passage', label: '', alt: '', text: 'x' }])).toBe('Petikan')
    expect(groupLabel([{ id: 'f', kind: 'image', label: '', alt: '' }])).toBe('Rajah')
    expect(stimuliLabel([{ id: 'f', kind: 'image', label: 'Rajah 2' }])).toBe('Rajah 2')
  })
})
