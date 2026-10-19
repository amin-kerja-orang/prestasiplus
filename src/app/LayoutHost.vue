<script setup lang="ts">
/**
 * LayoutHost (overview §5.3, ADR-0008): picks the frame from `route.meta.layout` and the session,
 * and wraps `<RouterView>`. The shell component is keyed by its kind only, so it stays mounted
 * while consecutive routes resolve to the same shell (drawer and sidebar state survive), and only
 * the page area changes.
 *
 * An in-place outcome (guard `onForbidden: '403' | '404'`) renders the standalone error page
 * instead of the route's page, with the URL unchanged.
 */
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'

import ForbiddenPage from '@/pages/ForbiddenPage.vue'
import NotFoundPage from '@/pages/NotFoundPage.vue'
import PrototypeUnavailablePage from '@/pages/PrototypeUnavailablePage.vue'
import { useSessionStore } from '@/stores/session'

import {
  DEFAULT_LAYOUT,
  resolveShellForPath,
  shellComponents,
  useRouteOutcome,
  userShellFor,
} from './router'

const route = useRoute()
const session = useSessionStore()
const outcome = useRouteOutcome()

const shellKind = computed(() => {
  if (outcome.value !== null && outcome.value !== 'scope') return null
  const kind = resolveShellForPath(
    route.meta.layout ?? DEFAULT_LAYOUT,
    { isLoggedIn: session.isLoggedIn, role: session.role },
    route.path,
  )
  // The "not available" page (prototype scope) always sits inside a shell for a logged-in user,
  // so the menus stay usable even when the blocked route is a bare page.
  return outcome.value === 'scope' && kind === null && session.isLoggedIn
    ? userShellFor(session.role)
    : kind
})
const shell = computed(() => (shellKind.value ? shellComponents[shellKind.value] : null))
</script>

<template>
  <ForbiddenPage v-if="outcome === 403" />
  <NotFoundPage v-else-if="outcome === 404" />
  <component :is="shell" v-else-if="shell" :key="shellKind">
    <PrototypeUnavailablePage v-if="outcome === 'scope'" />
    <RouterView v-else />
  </component>
  <PrototypeUnavailablePage v-else-if="outcome === 'scope'" />
  <RouterView v-else />
</template>
