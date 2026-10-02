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
import { useSessionStore } from '@/stores/session'

import { DEFAULT_LAYOUT, resolveShell, shellComponents, useRouteOutcome } from './router'

const route = useRoute()
const session = useSessionStore()
const outcome = useRouteOutcome()

const shellKind = computed(() =>
  outcome.value === null
    ? resolveShell(route.meta.layout ?? DEFAULT_LAYOUT, {
        isLoggedIn: session.isLoggedIn,
        role: session.role,
      })
    : null,
)
const shell = computed(() => (shellKind.value ? shellComponents[shellKind.value] : null))
</script>

<template>
  <ForbiddenPage v-if="outcome === 403" />
  <NotFoundPage v-else-if="outcome === 404" />
  <component :is="shell" v-else-if="shell" :key="shellKind">
    <RouterView />
  </component>
  <RouterView v-else />
</template>
