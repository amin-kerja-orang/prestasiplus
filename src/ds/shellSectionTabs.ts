/**
 * "The shell already prints this page's section tabs" signal. A portal layout that renders the
 * tab strip of a folded menu section (Kirkpatrick) above the page calls `provideShellSectionTabs()`
 * with a ref that is true while that strip is on screen. A page that has a strip of its own
 * (`KirkpatrickTabs`) leaves it out then, so one set of tabs shows, never two (UAT G-16, A-PM11).
 */
import { computed, inject, provide, ref, unref, type InjectionKey, type Ref } from 'vue'

const shellSectionTabsKey: InjectionKey<Readonly<Ref<boolean>>> = Symbol('ds-shell-section-tabs')

export function provideShellSectionTabs(shown: Readonly<Ref<boolean>>): void {
  provide(shellSectionTabsKey, shown)
}

/** True while the shell prints the section tabs. False outside a portal layout. */
export function useShellPrintsSectionTabs(): Readonly<Ref<boolean>> {
  const shown = inject(shellSectionTabsKey, null)
  return computed(() => unref(shown ?? ref(false)))
}
