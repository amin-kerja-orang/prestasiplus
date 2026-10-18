import { flushPromises, type DOMWrapper, type VueWrapper } from '@vue/test-utils'

type Root = VueWrapper | DOMWrapper<Element>

/** The labels of the open "..." menu (it renders in a portal on `document.body`). */
export function menuLabels(): string[] {
  return [...document.body.querySelectorAll('[role="menuitem"]')].map((el) => el.textContent.trim())
}

/** Closes an open menu (Escape on its content). */
export function closeMenus(): void {
  document.body
    .querySelector('[role="menu"]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
}

/** Opens the row menu inside `rowSelector` (keyboard, as a user would) and returns its labels. */
export async function openRowMenu(root: Root, rowSelector: string): Promise<string[]> {
  await root.get(`${rowSelector} [data-testid="row-menu"]`).trigger('keydown', { key: 'Enter' })
  await flushPromises()
  return menuLabels()
}

/** Opens the row menu and picks the item with the given label. */
export async function pickRowMenuItem(
  root: Root,
  rowSelector: string,
  label: string,
): Promise<void> {
  await openRowMenu(root, rowSelector)
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (el) => el.textContent.trim() === label,
  )
  if (!item) throw new Error(`Menu item "${label}" not found`)
  item.click()
  await flushPromises()
}
