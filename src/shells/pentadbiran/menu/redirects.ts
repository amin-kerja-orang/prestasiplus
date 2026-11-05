/**
 * Redirect routes that menu entries may point at (S0). The renderer (`render.ts`) follows these so an
 * entry whose route redirects to a page another entry already shows is not rendered twice. Keep a
 * row here only for a redirect route used by a menu row; `menu.test.ts` checks every entry against the
 * real router, so a missing or stale pair fails there. Keys and targets are paths without a query.
 */
export const MENU_REDIRECTS: Readonly<Record<string, string>> = {}
