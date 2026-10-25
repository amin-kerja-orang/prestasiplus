// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

import DsDialog from '../DsDialog.vue'

/** `DsDialog` maps `size` to the modal panel width; `xl` is the wide size (896px from `sm` up). */
beforeAll(() => {
  window.matchMedia = (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })
})

const UModalStub = defineComponent({
  name: 'UModal',
  inheritAttrs: false,
  props: { ui: { type: Object, default: () => ({}) } },
  setup(props) {
    return () => h('div', { 'data-content': (props.ui as { content?: string }).content })
  },
})

const widthFor = async (size?: 'sm' | 'md' | 'lg' | 'xl') => {
  const w = mount(DsDialog, {
    props: { title: 'T', ...(size ? { size } : {}) },
    global: { stubs: { Modal: UModalStub, Drawer: true } },
  })
  await nextTick()
  return w.find('[data-content]').attributes('data-content')
}

describe('DsDialog size', () => {
  it.each([
    ['sm', 'sm:max-w-sm'],
    ['md', 'sm:max-w-lg'],
    ['lg', 'sm:max-w-2xl'],
    ['xl', 'sm:max-w-4xl'],
  ] as const)('size "%s" sets the panel width %s', async (size, cls) => {
    expect(await widthFor(size)).toBe(cls)
  })

  it('defaults to md', async () => {
    expect(await widthFor()).toBe('sm:max-w-lg')
  })
})
