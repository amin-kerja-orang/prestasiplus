import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config.ts'

/** Class-string checks for the touch-target and inset-focus rules (DS audit #9, #14, #15). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- config tree is read by path only
const cfg = uiConfig as unknown as Record<string, any>
const str = (v: unknown) => (Array.isArray(v) ? v.join(' ') : String(v))

describe('touch targets stay 44px on coarse pointers', () => {
  it('shrinks pager buttons to 40px for fine pointers only', () => {
    const item = str(cfg.pagination.slots.item)
    expect(item).toContain('size-11')
    expect(item).toContain('md:pointer-fine:size-10')
    expect(item).not.toMatch(/(^|\s)md:size-10/)
  })
  it('shrinks menu rows to 40px for fine pointers only', () => {
    const row = str(cfg.select.slots.item)
    expect(row).toContain('md:pointer-fine:min-h-10')
    expect(row).not.toMatch(/(^|\s)md:min-h-10/)
  })
  it('lifts button xs and sm to 44px on coarse pointers', () => {
    expect(cfg.button.variants.size.xs.base).toContain('pointer-coarse:min-h-11')
    expect(cfg.button.variants.size.sm.base).toContain('pointer-coarse:min-h-11')
  })
  it('grows the switch hit area to 44px on coarse pointers', () => {
    expect(str(cfg.switch.slots.base)).toContain('pointer-coarse:after:-inset-y-3.5')
  })
  it('makes breadcrumb links 44px, 36px for fine pointers', () => {
    const link = str(cfg.breadcrumb.slots.link)
    expect(link).toContain('min-h-11')
    expect(link).toContain('pointer-fine:min-h-9')
  })
})

describe('clickable table rows', () => {
  it('uses an inset focus ring so the clipped table does not cut it', () => {
    const tr = str(cfg.table.slots.tr)
    expect(tr).toContain('focus-visible:-outline-offset-2')
    expect(tr).not.toContain('focus-visible:outline-offset-2')
  })
})
