import { tv } from 'tailwind-variants'
import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config'

/**
 * Size scale (FB-073): pages use `size="xl"` (buttons, fields) and `lg` / `xl` (badges), so the theme
 * must define every size they ask for instead of leaving the stock Nuxt UI sizing.
 */
type Slots = Record<string, (p?: Record<string, unknown>) => string>
const slots = (config: unknown, props: Record<string, unknown>): Slots =>
  (tv(config as Parameters<typeof tv>[0]) as unknown as (p: Record<string, unknown>) => Slots)(
    props,
  )

describe('theme size scale', () => {
  it('button: xl is the large step (same height and padding as lg), glyphs stay at lg size', () => {
    const lg = slots(uiConfig.button, { size: 'lg' }).base!()
    const xl = slots(uiConfig.button, { size: 'xl' }).base!()
    expect(xl).toBe(lg)
    expect(xl).toContain('min-h-12')
    expect(xl).toContain('learner:min-h-14')
    expect(uiConfig.button.variants.size.xl.leadingIcon).toBe('size-5')
    expect(uiConfig.button.variants.size.xl.trailingIcon).toBe('size-5')
  })

  it('button: an icon-only xl button stays a 44px square in both personalities', () => {
    const cls = slots(uiConfig.button, { size: 'xl', square: true }).base!()
    expect(cls).toContain('min-w-11')
    expect(cls).toContain('learner:min-h-11')
    expect(cls).toContain('learner:px-2')
  })

  it.each(['input', 'textarea', 'select'] as const)(
    '%s: md, lg and xl share one height',
    (name) => {
      const heights = ['md', 'lg', 'xl'].map((size) => slots(uiConfig[name], { size }).base!())
      expect(new Set(heights).size).toBe(1)
      expect(heights[0]).toContain('min-h-11')
      expect(heights[0]).toContain('learner:min-h-13')
    },
  )

  it('select: xl popup rows are the lg rows', () => {
    const xl = slots(uiConfig.select, { size: 'xl' })
    expect(xl.item!()).toContain('text-sm')
    expect(xl.item!()).toContain('p-2')
  })

  it('badge: lg and xl are pills themed like md with a larger type role', () => {
    for (const size of ['lg', 'xl']) {
      const cls = slots(uiConfig.badge, { size }).base!()
      expect(cls).toContain('rounded-full')
      expect(cls).toMatch(/\bpx-3/)
      expect(cls).toMatch(/\bpy-1\b/)
    }
    expect(slots(uiConfig.badge, { size: 'lg' }).base!()).toContain('text-label')
    expect(slots(uiConfig.badge, { size: 'xl' }).base!()).toContain('text-base')
  })
})
