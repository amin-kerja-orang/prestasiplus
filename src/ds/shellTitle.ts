/**
 * "The shell already prints this page's title" signal. A portal layout that renders the page title
 * in its own header calls `provideShellTitle()`; a route can also say so with `meta.shellTitle`.
 * `DsPageHeader` (`showTitle="auto"`) then leaves its `h1` out, so a page has one `h1` only.
 */
import {
  inject,
  onScopeDispose,
  provide,
  readonly,
  ref,
  toValue,
  watchEffect,
  type InjectionKey,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue'
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

/**
 * Entity title hook (design page-templates 1.2 / 2.J, DS change D11). A detail page calls
 * `useShellEntityTitle(() => school.name)`; the shell then appends the name as the last crumb
 * ("Pemantauan / Langsung / SMK Demo Satu") and puts it in the tab title. The navbar `h1` stays the
 * menu label. The name is cleared when the page unmounts; `null`/empty clears it.
 */
const entityTitle = ref<string | null>(null)

/** Read side for the shell layout. */
export const shellEntityTitle: Readonly<Ref<string | null>> = readonly(entityTitle)

export function useShellEntityTitle(name: MaybeRefOrGetter<string | null | undefined>): void {
  watchEffect(() => {
    const value = toValue(name)?.trim()
    entityTitle.value = value ? value : null
  })
  onScopeDispose(() => {
    entityTitle.value = null
  })
}
