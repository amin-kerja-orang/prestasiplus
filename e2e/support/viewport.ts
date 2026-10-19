/**
 * Viewport helpers (overview §12.2). Specs run on all three projects and branch on the viewport,
 * **never on the project name**.
 */

import type { Page } from '@playwright/test'

/** The three project widths (CLAUDE.md §7, overview §12.2). */
export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
} as const

export type ViewportName = keyof typeof VIEWPORTS

/** Tailwind `lg`: the user shell shows the sidebar (and hides drawer and bottom nav) from here. */
export const DESKTOP_SHELL_MIN_WIDTH = 1024

/** Tailwind `sm`. */
export const SM_MIN_WIDTH = 640

export function viewportWidth(page: Page): number {
  const size = page.viewportSize()
  if (!size) throw new Error('viewportWidth: the page has no fixed viewport')
  return size.width
}

/** Desktop shell layout (≥ 1024 px): sidebar instead of drawer and bottom nav. */
export function isDesktopShell(page: Page): boolean {
  return viewportWidth(page) >= DESKTOP_SHELL_MIN_WIDTH
}

/** Below Tailwind `sm` (the 375 project). */
export function isMobileWidth(page: Page): boolean {
  return viewportWidth(page) < SM_MIN_WIDTH
}

/** The named project size the current viewport corresponds to (for messages and screenshots). */
export function viewportName(page: Page): ViewportName {
  const width = viewportWidth(page)
  if (width >= DESKTOP_SHELL_MIN_WIDTH) return 'desktop'
  if (width >= SM_MIN_WIDTH) return 'tablet'
  return 'mobile'
}
