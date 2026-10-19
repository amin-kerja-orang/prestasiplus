// @vitest-environment jsdom
import { House, Rabbit } from '@lucide/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppIcon from '../AppIcon.vue'

const svgInner = (el: Element) => el.innerHTML

describe('AppIcon', () => {
  it('renders the mapped Lucide icon for a live FA class, with caller attributes', () => {
    const wrapper = mount(AppIcon, {
      props: { name: 'fas fa-home' },
      attrs: { class: 'h-5 w-5 text-indigo-500', 'data-testid': 'ico' },
    })
    const svg = wrapper.get('svg')
    expect(svg.classes()).toEqual(expect.arrayContaining(['h-5', 'w-5', 'text-indigo-500']))
    expect(svg.attributes('data-testid')).toBe('ico')
    expect(svgInner(svg.element)).toBe(svgInner(mount(House).get('svg').element))
  })

  it('renders the same glyph for FA names and Lucide aliases', () => {
    const inner = (name: string) => svgInner(mount(AppIcon, { props: { name } }).get('svg').element)
    const house = inner('house')
    expect(inner('fa-home')).toBe(house)
    expect(inner('fa-solid fa-house')).toBe(house)
    expect(inner('House')).toBe(house)
  })

  it('renders an emoji as text, never as an icon', () => {
    const wrapper = mount(AppIcon, { props: { name: '🧪' }, attrs: { class: 'text-2xl' } })
    expect(wrapper.find('svg').exists()).toBe(false)
    expect(wrapper.get('span').text()).toBe('🧪')
    expect(wrapper.get('span').classes()).toContain('text-2xl')
  })

  it('renders nothing for empty, unknown or markup values', () => {
    for (const name of [undefined, null, '', 'fas fa-not-a-real-icon-x', '<b>x</b>']) {
      const wrapper = mount(AppIcon, { props: { name } })
      expect(wrapper.find('svg').exists(), String(name)).toBe(false)
      expect(wrapper.text()).toBe('')
      expect(wrapper.html()).not.toContain('<b>')
    }
  })

  it('loads the full index lazily for names outside the static set', async () => {
    const wrapper = mount(AppIcon, { props: { name: 'rabbit' } })
    await expect.poll(() => wrapper.find('svg').exists()).toBe(true)
    expect(svgInner(wrapper.get('svg').element)).toBe(svgInner(mount(Rabbit).get('svg').element))
  })

  it('reacts to a changed name', async () => {
    const wrapper = mount(AppIcon, { props: { name: 'fa-home' } })
    expect(wrapper.find('svg').exists()).toBe(true)
    await wrapper.setProps({ name: '' })
    expect(wrapper.find('svg').exists()).toBe(false)
  })
})
