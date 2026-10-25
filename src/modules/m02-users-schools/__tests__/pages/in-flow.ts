import { expect } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'

/**
 * RS5-M1 / SWX4: a picker's result list must sit in the flow. The form-section card clips its overflow
 * (`overflow-clip`), so an `absolute` (`behavior="float"`) list was cut to a sliver and could not be
 * clicked. The list is a `DsSurface` with a `max-h-64 overflow-y-auto` scroller inside.
 */
export function expectListInFlow(w: VueWrapper, dropdownTestId: string): void {
  const list = w.get(`[data-testid=${dropdownTestId}]`)
  expect(list.attributes('data-ds')).toBe('surface')
  expect(list.attributes('data-behavior')).toBeUndefined()
  expect(list.classes()).not.toContain('absolute')
  expect(list.element.parentElement?.className ?? '').not.toContain('relative')
  const scroller = list.element.firstElementChild
  expect(scroller?.className).toContain('max-h-64')
  expect(scroller?.className).toContain('overflow-y-auto')
}
