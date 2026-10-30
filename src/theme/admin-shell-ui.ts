/**
 * Theme slots of the Portal Pentadbiran chrome (`DsAdminShell`). Kept here, with the other Nuxt UI
 * theme config, because the design system's class rules forbid pseudo-element and `aria-[...]`
 * variants in components. Full class literals so Tailwind sees them; tokens only.
 *
 * Header rhythm (design page-templates 2.J): the sidebar header and the navbar are both `h-16` and
 * both carry the `shadow-bar` edge, so the line under them runs straight across the screen. The
 * nav rows, the "Cari menu" button and the collapsed icons share one row height (`h-10`) and one
 * inset (`px-3` body + `px-2.5` row).
 */

/** `UDashboardSidebar` `ui`. */
export const adminSidebarUi = {
  header: 'relative z-10 h-16 shrink-0 justify-center bg-default px-4 shadow-bar',
  body: 'gap-1 px-3 py-3',
  footer: 'p-2',
} as const

/** `UNavigationMenu` `ui` (vertical sidebar list). */
export const adminNavUi = {
  root: 'gap-0',
  label: 'px-2.5 pt-5 pb-1.5 text-overline font-semibold text-muted uppercase',
  link: 'h-10 gap-2.5 px-2.5 rounded-md hover:before:bg-elevated aria-[current=page]:before:bg-primary-soft aria-[current=page]:text-primary-t aria-[current=page]:font-semibold',
  linkLabel: 'truncate',
  linkTrailing: 'shrink-0',
} as const

/** Sub-group label (sentence case under the uppercase group label) and its nested rows. */
export const adminNavSubLabel = 'pt-3 normal-case tracking-normal'
export const adminNavNestedLink = 'ps-6'

/** "Cari menu" button: nav-row height, left-aligned, small right-aligned key hint. */
export const adminSearchUi = { label: 'grow text-start', trailing: 'ms-auto gap-0.5 pe-0' } as const
export const adminSearchKbds: { value: string; size: 'sm' }[] = [
  { value: 'meta', size: 'sm' },
  { value: 'k', size: 'sm' },
]

/** Account menu panel. */
export const adminAccountMenuUi = { content: 'min-w-56' } as const

/** Content column: shell cap 1600px, 16px gutter below `md`, 24px from `md` (rule 1.4). */
export const adminContentColumn =
  'mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-4 p-4 md:p-6'
