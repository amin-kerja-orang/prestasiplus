import { tv } from 'tailwind-variants'
import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config'

/**
 * Disabled primary (FB-007): a flat neutral fill with a readable label, but a busy button keeps its
 * fill, because Nuxt UI sets `disabled` while `loading` too.
 */
const button = tv(uiConfig.button as Parameters<typeof tv>[0])
const base = (props: Record<string, unknown>): string =>
  (button as unknown as (p: Record<string, unknown>) => { base: (p?: unknown) => string })(props).base()

describe('disabled primary button', () => {
  it('solid primary gets the flat disabled look with a dimmed label at full opacity', () => {
    const cls = base({ color: 'primary', variant: 'solid', loading: false })
    expect(cls).toContain('disabled:bg-elevated')
    expect(cls).toContain('disabled:bg-none')
    expect(cls).toContain('disabled:text-dimmed')
    expect(cls).toContain('disabled:opacity-100')
    expect(cls).toContain('aria-disabled:bg-elevated')
    expect(cls).toContain('dark:disabled:bg-muted')
    expect(cls).toContain('learner:disabled:text-muted')
  })

  it('solid primary keeps the stock dimmed gradient while loading', () => {
    const cls = base({ color: 'primary', variant: 'solid', loading: true })
    expect(cls).not.toContain('disabled:bg-elevated')
    expect(cls).not.toContain('disabled:text-dimmed')
    expect(cls).not.toContain('disabled:opacity-100')
    expect(cls).toContain('disabled:opacity-(--ds-disabled-opacity)')
    expect(cls).toContain('bg-gradient-primary')
  })

  it('the staff tonal primary default follows the same rule, scoped to staff', () => {
    const idle = base({ color: 'primary', variant: 'soft', loading: false })
    expect(idle).toContain('staff:disabled:bg-elevated')
    expect(idle).toContain('staff:disabled:text-dimmed')
    const busy = base({ color: 'primary', variant: 'soft', loading: true })
    expect(busy).not.toContain('staff:disabled:bg-elevated')
  })

  it('other colours and variants are untouched', () => {
    expect(base({ color: 'neutral', variant: 'soft', loading: false })).not.toContain(
      'disabled:bg-elevated',
    )
    expect(base({ color: 'error', variant: 'solid', loading: false })).not.toContain(
      'disabled:text-dimmed',
    )
  })
})
