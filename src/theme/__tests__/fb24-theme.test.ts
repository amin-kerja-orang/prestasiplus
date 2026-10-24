import { tv } from 'tailwind-variants'
import { describe, expect, it } from 'vitest'

import { uiConfig } from '../ui.config'
import { componentDefaults } from '../ui/components'

const button = tv(uiConfig.button as Parameters<typeof tv>[0])
const base = (props: Record<string, unknown>): string =>
  (button as unknown as (p: Record<string, unknown>) => { base: (p?: unknown) => string })(props).base()

describe('neutral tonal buttons (FB-024 #11)', () => {
  it('get a 1px edge in light and none in dark, for soft, subtle and outline', () => {
    for (const variant of ['soft', 'subtle', 'outline']) {
      const cls = base({ color: 'neutral', variant, loading: false })
      expect(cls).toContain('ring-1')
      expect(cls).toContain('ring-inset')
      expect(cls).toContain('dark:ring-0')
    }
  })
  it('ghost and other colours are untouched', () => {
    expect(base({ color: 'neutral', variant: 'ghost', loading: false })).not.toContain('ring-1')
    expect(base({ color: 'primary', variant: 'soft', loading: false })).not.toContain('ring-1')
  })
})

describe('file drop zone (FB-024 #12)', () => {
  it('has a dashed edge that turns primary on hover and while dragging', () => {
    const b = componentDefaults.fileUpload.slots.base
    expect(b).toContain('border-2')
    expect(b).toContain('border-dashed')
    expect(b).toContain('hover:border-primary')
    expect(b).toContain('data-[dragging=true]:border-primary')
    expect(b).not.toContain('border-0')
  })
})
