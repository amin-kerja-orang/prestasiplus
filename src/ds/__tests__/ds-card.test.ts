// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import DsCard from '../DsCard.vue'
import { resolveValueClass } from '../valueTone'

describe('DsCard', () => {
  const body = (props: Record<string, unknown>) =>
    mount(DsCard, { props, slots: { default: 'x' } }).get('[data-slot="body"]').classes()
  it('maps padding to the body class at every width and keeps extra body utilities', () => {
    expect(body({ padding: 'sm' })).toEqual(expect.arrayContaining(['p-3', 'sm:p-3']))
    const none = body({ padding: 'none', ui: { body: 'flex' } })
    expect(none).toEqual(expect.arrayContaining(['p-0', 'sm:p-0', 'flex']))
    expect(none).not.toContain('sm:p-5')
  })
  it('leaves the theme default when no padding is given', () => {
    expect(body({})).toEqual(expect.arrayContaining(['p-4', 'sm:p-5']))
  })
})

describe('valueTone dimmed', () => {
  it('maps to text-dimmed', () => {
    expect(resolveValueClass('dimmed', undefined)).toBe('text-dimmed')
  })
})
