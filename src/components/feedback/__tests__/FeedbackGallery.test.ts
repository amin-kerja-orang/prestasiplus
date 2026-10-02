// @vitest-environment jsdom
import { config, enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import FeedbackGallery from '../gallery/FeedbackGallery.vue'

config.global.stubs = {
  transition: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        slots.default?.(),
  }),
}
enableAutoUnmount(afterEach)

const modal = () => document.body.querySelector<HTMLElement>('[data-testid="cmp-modal"]')

describe('FeedbackGallery (dev demo)', () => {
  it('shows every F-15 component and opens both modal variants', async () => {
    const w = mount(FeedbackGallery, { attachTo: document.body })
    expect(w.findAll('[data-variant="error"]')).toHaveLength(2)
    expect(w.find('[data-testid="cmp-flash"]').exists()).toBe(true)
    expect(w.find('svg.animate-spin').exists()).toBe(true)
    expect(w.text()).toContain('99+')
    expect(w.text()).toContain('6,144')

    const [margin, sheet] = w.findAll('button').filter((b) => b.text().endsWith('modal'))
    await margin?.trigger('click')
    expect(modal()?.dataset.variant).toBe('margin')
    document.body.querySelector<HTMLElement>('[data-testid="cmp-modal-backdrop"]')?.click()
    await nextTick()
    expect(modal()).toBeNull()
    expect(w.text()).toContain('Last close: backdrop')

    await sheet?.trigger('click')
    expect(modal()?.dataset.variant).toBe('sheet')
  })
})
