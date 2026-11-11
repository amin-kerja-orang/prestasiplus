/**
 * Keeps the browser tab title equal to the title the shell prints (user decision 2026-10-29):
 * `{shell header title} | PRESTASIPLUS`. A page-set dynamic title (`usePageMeta().setTitle`) and an
 * in-place 403/404/scope outcome keep priority over the shell's title. The catch-all 404 route (it
 * renders inside the Pentadbiran shell for `/admin/command-center/...`) is not an outcome, so its
 * own tab title wins too.
 */

import { watchEffect, type Ref } from 'vue'
import { useRoute } from 'vue-router'

import { useRouteOutcome, NOT_FOUND_TITLE } from '@/app/router/outcome'
import { formatTabTitle } from '@/composables/tabTitle'
import { usePageMeta } from '@/composables/usePageMeta'

export function useShellTabTitle(title: Readonly<Ref<string>>): void {
  const pageMeta = usePageMeta()
  const outcome = useRouteOutcome()
  const route = useRoute()
  watchEffect(
    () => {
      if (typeof document === 'undefined') return
      if (route.name === 'core.not-found') {
        document.title = NOT_FOUND_TITLE
        return
      }
      const name = title.value.trim()
      if (name === '' || outcome.value !== null || pageMeta.state.title !== null) return
      document.title = formatTabTitle(name)
    },
    { flush: 'post' },
  )
}
