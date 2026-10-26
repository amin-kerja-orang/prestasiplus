import { expect } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

/**
 * BUG-06 (G5-M02, DV-M02-31, AC-M02-32.4): the forms were two columns from 640px, the dialog 512px wide
 * from 640px. The forms must be one column below 768px (`md`). jsdom has no layout, so this pins the
 * class contract: every form section keeps a one-column outer grid and puts its two-column grid at `md:`,
 * and no field spans two columns from `sm:` (that would open an implicit second column at 640-767px).
 */
export function expectOneColumnBelowMd(w: VueWrapper): void {
  const sections = w.findAll('[data-ds="form-section"]')
  expect(sections.length).toBeGreaterThan(0)
  for (const section of sections) {
    const grids = section.findAll('[data-testid=form-section-grid]')
    expect(grids).toHaveLength(1)
    const grid = grids[0]!
    expect(grid.classes()).toContain('md:grid-cols-2')
    expect(grid.classes()).not.toContain('sm:grid-cols-2')
    // The DsFormSection grid around it stays a single column at every width.
    const outer = grid.element.parentElement
    expect(outer?.classList.contains('sm:grid-cols-2')).toBe(false)
    expect(outer?.classList.contains('md:grid-cols-2')).toBe(false)
    expect(section.element.querySelector('.sm\\:col-span-2')).toBeNull()
  }
}
