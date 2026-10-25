// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import CcDialog from '../../components/command-center/CcDialog.vue'
import CcScroll from '../../components/command-center/CcScroll.vue'
import { S2_COPY } from '../../components/command-center/copy'

/**
 * G5-M10 B3. `DsDialog` sets the panel width from its `size` prop and ignores a `class`, so the Command
 * Center dialogs (Kelas, Remedial, drill ...) stayed at 512px. The width must travel as `size`.
 */
const seen: { size?: unknown; cls?: unknown }[] = []
const DsDialogStub = defineComponent({
  name: 'DsDialog',
  inheritAttrs: false,
  props: {
    size: { type: String, default: 'md' },
    open: Boolean,
    title: { type: String, default: '' },
  },
  setup(props, { slots, attrs }) {
    seen.push({ size: props.size, cls: attrs.class })
    return () => h('div', { 'data-size': props.size }, [slots.default?.(), slots.footer?.()])
  },
})

const mountDialog = (props: { wide?: boolean }) =>
  mount(CcDialog, {
    props: { title: 'T', testid: 'x', ...props },
    slots: { default: '<p>body</p>' },
    global: { stubs: { DsDialog: DsDialogStub, UButton: true } },
  })

beforeEach(() => {
  seen.length = 0
})

describe('CcDialog width (G5-M10 B3)', () => {
  it.each([
    ['not wide', false],
    ['wide', true],
  ])('passes the DS size "lg" (672px) when %s, and no width class', (_label, wide) => {
    const w = mountDialog({ wide })
    expect(w.findComponent(DsDialogStub).props('size')).toBe('lg')
    expect(w.find('[data-size]').attributes('data-size')).toBe('lg')
    expect(seen.at(-1)?.cls).toBeUndefined()
  })

  it('keeps closing: the DS open model emits close', async () => {
    const w = mountDialog({})
    w.findComponent(DsDialogStub).vm.$emit('update:open', false)
    await w.vm.$nextTick()
    expect(w.emitted('close')).toHaveLength(1)
  })
})

describe('CcScroll hint (G5-M10 B3)', () => {
  let resize: (() => void) | undefined
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(cb: () => void) {
          resize = cb
        }
        observe() {}
        disconnect() {}
      },
    )
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    resize = undefined
  })

  const slot = '<div data-ds="drill-table"><table /></div>'
  const setWidths = (el: Element, scrollWidth: number, clientWidth: number) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth })
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth })
  }

  it('shows the BM hint only while the table is wider than its container', async () => {
    const w = mount(CcScroll, { slots: { default: slot }, attachTo: document.body })
    const box = w.find('[data-ds="drill-table"]').element
    expect(w.find('[data-testid="cc-scroll-hint"]').exists()).toBe(false)

    setWidths(box, 619, 343)
    resize?.()
    await w.vm.$nextTick()
    expect(w.find('[data-testid="cc-scroll-hint"]').text()).toBe(S2_COPY.scrollHint)
    expect(S2_COPY.scrollHint).toBe('Leret ke sisi untuk melihat semua lajur')

    setWidths(box, 624, 624)
    resize?.()
    await w.vm.$nextTick()
    expect(w.find('[data-testid="cc-scroll-hint"]').exists()).toBe(false)
    w.unmount()
  })

  it('shows the hint on mount when the table already overflows', async () => {
    vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(600)
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(300)
    const w = mount(CcScroll, { slots: { default: slot }, attachTo: document.body })
    await w.vm.$nextTick()
    expect(w.find('[data-testid="cc-scroll-hint"]').exists()).toBe(true)
    w.unmount()
  })
})
