import { expect } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

/**
 * BUG-05 (G5-M02, DV-M02-29): the "Pautkan Anak (Pelajar)" result list widened the form column past the
 * card at 375 / 320 px, because the form grid has a single implicit `auto` track below `sm` and its
 * item (the wrapper of the finder) sized itself to the min-content of the result rows (non-wrapping
 * name and a fixed 10rem school badge). jsdom has no layout, so this pins the classes that stop it: every box from
 * the grid item down to the row may shrink (`min-w-0`) and the row wraps instead of pushing the width.
 */
export function expectFinderWidthContract(w: VueWrapper, linkerTestId: string): void {
  const root = w.get(`[data-testid=${linkerTestId}]`)
  expect(root.classes()).toContain('min-w-0')
  // The grid item of the form section that holds the finder.
  const gridItem = root.element.parentElement
  expect(gridItem?.classList.contains('min-w-0')).toBe(true)
  expect(gridItem?.classList.contains('sm:col-span-2')).toBe(true)

  const list = w.get('[data-testid=linker-dropdown]')
  expect(list.classes()).toContain('min-w-0')
  expect(list.element.parentElement?.classList.contains('min-w-0')).toBe(true)

  const rows = w.findAll('[data-testid=linker-result]')
  expect(rows.length).toBeGreaterThan(0)
  for (const row of rows) {
    expect(row.classes()).toContain('min-w-0')
    expect(row.classes()).toContain('whitespace-normal')
    const inner = row.get('[data-testid=linker-result-row]')
    expect(inner.classes()).toEqual(expect.arrayContaining(['min-w-0', 'flex-wrap']))
    const parts = Array.from(inner.element.children)
    expect(parts.length).toBeGreaterThan(0)
    for (const part of parts) {
      // No part refuses to shrink.
      expect(part.classList.contains('shrink-0')).toBe(false)
    }
    // The name wraps instead of pushing the width.
    expect(parts[0]?.classList.contains('break-words')).toBe(true)
    expect(parts[0]?.classList.contains('truncate')).toBe(false)
    // The school badge is capped by the row below `sm` (its own line, ellipsis) and keeps the base 10rem cap from `sm` up.
    const school = inner.find('[data-testid=linker-result-school]')
    if (school.exists()) {
      expect(school.classes()).toEqual(expect.arrayContaining(['max-w-full', 'sm:max-w-40']))
      expect(school.classes()).not.toContain('max-w-40')
    }
  }
}
