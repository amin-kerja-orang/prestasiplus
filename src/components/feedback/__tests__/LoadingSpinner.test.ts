// @vitest-environment jsdom
import { LoaderCircle } from '@lucide/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LoadingSpinner from '../LoadingSpinner.vue'

describe('LoadingSpinner', () => {
  it('renders LoaderCircle with animate-spin at 1em by default', () => {
    const svg = mount(LoadingSpinner).get('svg')
    expect(svg.classes()).toContain('animate-spin')
    expect(svg.attributes('width')).toBe('1em')
    expect(svg.element.innerHTML).toBe(mount(LoaderCircle).get('svg').element.innerHTML)
  })

  it('takes size and caller classes', () => {
    const svg = mount(LoadingSpinner, {
      props: { size: 20 },
      attrs: { class: 'h-5 w-5 text-indigo-500' },
    }).get('svg')
    expect(svg.attributes('width')).toBe('20')
    expect(svg.classes()).toEqual(
      expect.arrayContaining(['animate-spin', 'h-5', 'w-5', 'text-indigo-500']),
    )
  })
})
