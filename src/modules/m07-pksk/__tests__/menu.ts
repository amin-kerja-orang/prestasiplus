import { flushPromises, type VueWrapper } from '@vue/test-utils'

/**
 * Opens the row-action menu (`UDropdownMenu`, content in a body portal) of the nth row and returns its items.
 * The trigger opens on Enter (jsdom has no PointerEvent for the pointer path).
 */
export async function openRowMenu(w: VueWrapper, index = 0): Promise<HTMLElement[]> {
  closeMenus()
  const triggers = w.findAll('[data-testid=row-menu]')
  const trigger = triggers[index]
  if (!trigger) throw new Error(`No row menu at index ${String(index)}`)
  trigger.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  await flushPromises()
  return [...document.body.querySelectorAll<HTMLElement>('[role=menuitem]')]
}

/** One item of the open row menu, by its label. */
export function menuItem(items: HTMLElement[], label: string): HTMLElement | undefined {
  return items.find((el) => el.textContent.trim() === label)
}

/** Clicks one item of the nth row menu and lets the handler settle. */
export async function chooseRowAction(w: VueWrapper, index: number, label: string): Promise<void> {
  const item = menuItem(await openRowMenu(w, index), label)
  if (!item) throw new Error(`No menu item "${label}"`)
  item.click()
  await flushPromises()
}

export function closeMenus(): void {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}
