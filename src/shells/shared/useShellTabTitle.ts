/**
 * Keeps the browser tab title equal to the title the shell prints (user decision 2026-10-29):
 * `{shell header title} | PRESTASIPLUS`. A page-set dynamic title (`usePageMeta().setTitle`) and an
 * in-place 403/404/scope outcome keep priority over the shell's title.
 */

import { watchEffect, type Ref } from 'vue'

import { useRouteOutcome } from '@/app/router/outcome'
import { formatTabTitle } from '@/composables/tabTitle'
import { usePageMeta } from '@/composables/usePageMeta'

export function useShellTabTitle(title: Readonly<Ref<string>>): void {
  const pageMeta = usePageMeta()
  const outcome = useRouteOutcome()
  watchEffect(
    () => {
      if (typeof document === 'undefined') return
      const name = title.value.trim()
      if (name === '' || outcome.value !== null || pageMeta.state.title !== null) return
      document.title = formatTabTitle(name)
    },
    { flush: 'post' },
  )
}
