/**
 * "The shell already prints this page's title" signal. A portal layout that renders the page title
 * in its own header calls `provideShellTitle()`; a route can also say so with `meta.shellTitle`.
 * `DsPageHeader` (`showTitle="auto"`) then leaves its `h1` out, so a page has one `h1` only.
 */
import { inject, provide, type InjectionKey } from 'vue'
import { routeLocationKey } from 'vue-router'

const shellTitleKey: InjectionKey<boolean> = Symbol('ds-shell-title')

export function provideShellTitle(value = true): void {
  provide(shellTitleKey, value)
}

/** True when the layout or the route meta says the shell prints the title. Safe without a router. */
export function useShellPrintsTitle(): boolean {
  const route = inject(routeLocationKey, null)
  return inject(shellTitleKey, false) || route?.meta.shellTitle === true
}
