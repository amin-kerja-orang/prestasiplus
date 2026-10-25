// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

import CcDialog from '../../components/command-center/CcDialog.vue'

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
