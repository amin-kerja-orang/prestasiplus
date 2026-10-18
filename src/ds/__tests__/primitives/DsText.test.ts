// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsText, type DsTextRole, type DsTextTone } from '@/ds'

describe('DsText', () => {
  it('maps a variant to its role utility, default tone and element', () => {
    const w = mount(DsText, { props: { variant: 'caption' }, slots: { default: 'x' } })
    expect(w.element.tagName).toBe('P')
    expect(w.classes()).toEqual(expect.arrayContaining(['text-caption', 'text-muted']))
  })
  it('kpi is tabular and a span by default; tone and as override', () => {
    const w = mount(DsText, { props: { variant: 'kpi', tone: 'success', as: 'strong' } })
    expect(w.element.tagName).toBe('STRONG')
    expect(w.classes()).toEqual(expect.arrayContaining(['text-kpi', 'tabular-nums', 'text-success']))
  })
  it('truncate / clamp / srOnly add their utilities', () => {
    expect(mount(DsText, { props: { variant: 'body', truncate: true } }).classes()).toEqual(
      expect.arrayContaining(['truncate', 'min-w-0']),
    )
    expect(mount(DsText, { props: { variant: 'body', clamp: 3 } }).classes()).toContain('line-clamp-3')
    expect(mount(DsText, { props: { variant: 'body', srOnly: true } }).classes()).toContain('sr-only')
  })
  it('lets an ARIA role fall through (the prop is variant, not role)', () => {
    const w = mount(DsText, { props: { variant: 'body' }, attrs: { role: 'status' } })
    expect(w.attributes('role')).toBe('status')
  })
  it('only takes the declared literals', () => {
    expectTypeOf<InstanceType<typeof DsText>['$props']['variant']>().toEqualTypeOf<DsTextRole>()
    expectTypeOf<DsTextTone>().not.toEqualTypeOf<string>()
    // @ts-expect-error unknown role
    const bad: DsTextRole = 'huge'
    expect(bad).toBe('huge')
  })
})
