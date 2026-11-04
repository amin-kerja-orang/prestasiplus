// @vitest-environment jsdom
// S8-T06: DsSplitPane (two-pane to tabs), DsDataTable card fallback, DsDrawer close, form scroll clearance.
import { readFileSync } from 'node:fs'

import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { DsDataTable, DsDrawer, DsFormField, DsSplitPane } from '@/ds'

/** Stubs `matchMedia` for a viewport width: `(min-width: Npx)` matches when `N <= width`. */
function setWidth(width: number): void {
  window.matchMedia = ((query: string) => {
    const min = /min-width:\s*(\d+)px/.exec(query)
    return {
      matches: min ? Number(min[1]) <= width : false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
      onchange: null,
    }
  })
}

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})
afterEach(() => {
  document.body.innerHTML = ''
})

const panes = [
  { id: 'soalan', label: 'Soalan' },
  { id: 'sumber', label: 'Sumber' },
]
function pane(props: Record<string, unknown> = {}) {
  return mount(DsSplitPane, {
    props: { panes, ariaLabel: 'Paparan', ...props },
    slots: {
      'pane-soalan': '<input data-testid="in" />',
      'pane-sumber': '<p data-testid="src">Sumber teks</p>',
    },
    attachTo: document.body,
  })
}

describe('DsSplitPane', () => {
  it.each([
    ['md', 375, 'tabs'],
    ['md', 768, 'split'],
    ['md', 1280, 'split'],
    ['lg', 375, 'tabs'],
    ['lg', 768, 'tabs'],
    ['lg', 1280, 'split'],
  ] as const)('FR-X6-11: breakpoint %s at %ipx renders %s', async (breakpoint, width, mode) => {
    setWidth(width)
    const w = pane({ breakpoint })
    await w.vm.$nextTick()
    expect(w.get('[data-ds=split-pane]').attributes('data-mode')).toBe(mode)
    if (mode === 'split') {
      expect(w.find('[role=tablist]').exists()).toBe(false)
      expect(w.get('[data-mode=split]').classes()).toContain(`${breakpoint}:grid-cols-12`)
      expect(w.find('[data-ds=split-main] input').exists()).toBe(true)
      expect(w.get('aside').text()).toContain('Sumber teks')
    } else {
      expect(w.find('[data-mode=split]').exists()).toBe(false)
      expect(w.findAll('[role=tab]')).toHaveLength(2)
    }
    w.unmount()
  })

  it('FR-X6-11: split mode passes ratio, sticky and align to DsSplit', async () => {
    setWidth(1280)
    const w = pane({ ratio: '5-7', stickyAside: true, align: 'stretch' })
    await w.vm.$nextTick()
    expect(w.get('[data-ds=split-main]').classes()).toContain('md:col-span-5')
    expect(w.get('aside').classes()).toContain('md:sticky')
    expect(w.get('[data-mode=split]').classes()).toContain('items-stretch')
    w.unmount()
  })

  it('FR-X6-4: tabs have ARIA wiring and 44px touch targets at 375px', async () => {
    setWidth(375)
    const w = pane()
    await w.vm.$nextTick()
    expect(w.get('[role=tablist]').attributes('aria-label')).toBe('Paparan')
    const tabs = w.findAll('[role=tab]')
    expect(tabs.map((t) => t.text())).toEqual(['Soalan', 'Sumber'])
    expect(tabs[0]!.attributes('aria-selected')).toBe('true')
    expect(tabs[1]!.attributes('aria-selected')).toBe('false')
    expect(tabs[0]!.attributes('tabindex')).toBe('0')
    expect(tabs[1]!.attributes('tabindex')).toBe('-1')
    for (const t of tabs) expect(t.classes()).toContain('min-h-11')
    const panels = w.findAll('[role=tabpanel]')
    expect(panels).toHaveLength(2)
    tabs.forEach((t, i) => {
      expect(t.attributes('aria-controls')).toBe(panels[i]!.attributes('id'))
      expect(panels[i]!.attributes('aria-labelledby')).toBe(t.attributes('id'))
    })
    w.unmount()
  })

  it('FR-X6-11: both panes stay mounted, the inactive one is hidden by class, one tree', async () => {
    setWidth(375)
    const w = pane()
    await w.vm.$nextTick()
    expect(w.findAll('[data-testid=in]')).toHaveLength(1)
    expect(w.findAll('[data-testid=src]')).toHaveLength(1)
    const [a, b] = w.findAll('[role=tabpanel]')
    expect(a!.classes()).not.toContain('hidden')
    expect(b!.classes()).toContain('hidden')
    await w.findAll('[role=tab]')[1]!.trigger('click')
    expect(a!.classes()).toContain('hidden')
    expect(b!.classes()).not.toContain('hidden')
    expect(w.findAll('[data-testid=in]')).toHaveLength(1)
    w.unmount()
  })

  it('FR-X6-11: keeps typed state and the last pane when switching', async () => {
    setWidth(375)
    const w = pane()
    await w.vm.$nextTick()
    w.get<HTMLInputElement>('[data-testid=in]').element.value = 'jawapan'
    await w.findAll('[role=tab]')[1]!.trigger('click')
    await w.findAll('[role=tab]')[0]!.trigger('click')
    expect(w.get<HTMLInputElement>('[data-testid=in]').element.value).toBe('jawapan')
    await w.findAll('[role=tab]')[1]!.trigger('click')
    expect(w.findAll('[role=tab]')[1]!.attributes('aria-selected')).toBe('true')
    w.unmount()
  })

  it('FR-X6-11: defaultPane selects the starting pane; an unknown id falls back to the first', async () => {
    setWidth(375)
    const a = pane({ defaultPane: 'sumber' })
    await a.vm.$nextTick()
    expect(a.findAll('[role=tab]')[1]!.attributes('aria-selected')).toBe('true')
    a.unmount()
    const b = pane({ defaultPane: 'xx' })
    await b.vm.$nextTick()
    expect(b.findAll('[role=tab]')[0]!.attributes('aria-selected')).toBe('true')
    b.unmount()
  })

  it('FR-X6-4: ArrowRight/ArrowLeft/Home/End move selection and focus', async () => {
    setWidth(375)
    const w = pane()
    await w.vm.$nextTick()
    const tab = (i: number) => w.findAll('[role=tab]')[i]!
    await tab(0).trigger('keydown', { key: 'ArrowRight' })
    expect(tab(1).attributes('aria-selected')).toBe('true')
    expect(document.activeElement).toBe(tab(1).element)
    await tab(1).trigger('keydown', { key: 'ArrowRight' })
    expect(tab(0).attributes('aria-selected')).toBe('true')
    await tab(0).trigger('keydown', { key: 'ArrowLeft' })
    expect(tab(1).attributes('aria-selected')).toBe('true')
    await tab(1).trigger('keydown', { key: 'Home' })
    expect(tab(0).attributes('aria-selected')).toBe('true')
    await tab(0).trigger('keydown', { key: 'End' })
    expect(tab(1).attributes('aria-selected')).toBe('true')
    w.unmount()
  })

  it('FR-X6-11: v-model:pane emits update:pane and can drive the pane', async () => {
    setWidth(375)
    const w = pane()
    await w.vm.$nextTick()
    await w.findAll('[role=tab]')[1]!.trigger('click')
    expect(w.emitted('update:pane')?.at(-1)).toEqual(['sumber'])
    await w.setProps({ pane: 'soalan' })
    expect(w.findAll('[role=tab]')[0]!.attributes('aria-selected')).toBe('true')
    w.unmount()
  })
})

describe('DsDataTable cards (S8-T06)', () => {
  const data = [{ id: 1, nama: 'Murid satu', kelas: '4 Bestari', skor: 80 }]
  const columns = [
    { accessorKey: 'nama', header: 'Nama' },
    { accessorKey: 'kelas', header: 'Kelas' },
    { accessorKey: 'skor', header: 'Skor' },
  ]
  function cards(props: Record<string, unknown> = {}) {
    setWidth(375)
    return mount(DsDataTable, { props: { data, columns, ...props } })
  }

  it('FR-X6-4: cards fall back to every column when no card fields or title are set', async () => {
    const w = cards()
    await w.vm.$nextTick()
    expect(w.findAll('[data-ds=data-table-cards] dt').map((d) => d.text())).toEqual(['Nama', 'Kelas', 'Skor'])
    expect(w.findAll('[data-ds=data-table-cards] dd').map((d) => d.text())).toEqual(['Murid satu', '4 Bestari', '80'])
  })

  it('FR-X6-4: explicit cardFields and a card title keep the configured fields only', async () => {
    const w = cards({ cardFields: [{ key: 'kelas', label: 'Kelas' }] })
    await w.vm.$nextTick()
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['Kelas'])
    const t = cards({ cardTitle: 'nama' })
    await t.vm.$nextTick()
    expect(t.findAll('dt')).toHaveLength(0)
  })

  it('NFR-1: card values wrap instead of truncating', async () => {
    const w = cards()
    await w.vm.$nextTick()
    const dd = w.get('dd')
    expect(dd.classes()).toContain('break-words')
    expect(dd.classes()).toContain('whitespace-normal')
    expect(dd.classes()).not.toContain('truncate')
  })

  it('FR-X6-4: the card title button is at least 44px high', async () => {
    const w = cards({ cardTitle: 'nama' })
    await w.vm.$nextTick()
    const btn = w.get('[data-ds=data-table-cards] button')
    expect(btn.classes()).toContain('min-h-11')
    expect(btn.text()).toBe('Murid satu')
  })
})

describe('DsDrawer (S8-T06)', () => {
  function host(width: number, extra: Record<string, unknown> = {}) {
    setWidth(width)
    const open = ref(true)
    const C = defineComponent({
      setup: () => () =>
        h(
          DsDrawer,
          { open: open.value, 'onUpdate:open': (v: boolean) => (open.value = v), title: 'Tapis', ...extra },
          { default: () => h('p', 'Isi') },
        ),
    })
    return { w: mount(C, { attachTo: document.body }), open }
  }
  const settle = () => new Promise((r) => setTimeout(r, 50))
  const closeBtn = (): HTMLElement | null => document.body.querySelector('[data-slot=close]')
  const esc = () =>
    document.body
      .querySelector('[role=dialog]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: "Escape", bubbles: true, cancelable: true }))

  it.each([1280, 375])('FR-X6-4: a >=44px close button is rendered at %ipx and closes', async (width) => {
    const { w, open } = host(width)
    await settle()
    const btn = closeBtn()
    expect(btn).not.toBeNull()
    expect(btn!.className).toContain('min-h-11')
    expect(btn!.className).toContain('min-w-11')
    btn!.click()
    await settle()
    expect(open.value).toBe(false)
    w.unmount()
  })

  it.each([1280, 375])('FR-X6-4: Esc closes a dismissible drawer at %ipx', async (width) => {
    const { w, open } = host(width)
    await settle()
    esc()
    await settle()
    expect(open.value).toBe(false)
    w.unmount()
  })

  it('FR-X6-4: Esc does not close while loading', async () => {
    const { w, open } = host(1280, { loading: true })
    await settle()
    esc()
    await settle()
    expect(open.value).toBe(true)
    w.unmount()
  })
})

describe('DsFormField scroll clearance (S8-T06)', () => {
  it('FR-X6-5: states.css gives every form row a scroll margin for a sticky bar', () => {
    const css = readFileSync('src/ds/states.css', 'utf8')
    expect(css).toMatch(/\[data-ds='form-field'\]\s*\{\s*scroll-margin-bottom: 6rem;/)
    const d = mount(DsFormField, { props: { label: 'Nama' }, slots: { default: '<input />' } })
    expect(d.find('[data-ds=form-field]').exists() || d.attributes('data-ds') === 'form-field').toBe(true)
    const n = mount(DsFormField, { props: { label: 'Nama', native: true }, slots: { default: '<input />' } })
    expect(n.attributes('data-ds')).toBe('form-field')
  })
})
