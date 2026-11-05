<script setup lang="ts">
/**
 * Block "Alat Soalan" of S21 (FR-GUR-44-8, D-T06-1): six tool tiles, each a link. A tile shows only when its
 * target is a registered route (`useRouteExists`, the catch-all 404 does not count), the prototype scope allows
 * it and the viewer's role may open it, so the block never holds a dead link. With no tile it renders nothing.
 */
import { getActivePinia } from 'pinia'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { usePrototypeScope, useRouteExists } from '@/composables'
import { DsIconChip, DsPanel } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { ALAT_SOALAN, roleMayOpen } from './alat-soalan'

const router = useRouter()
const { allows } = usePrototypeScope()
const { routeExists } = useRouteExists()
const session = getActivePinia() !== undefined ? useSessionStore() : null

const tiles = computed(() =>
  ALAT_SOALAN.filter((t) => {
    if (!routeExists(t.to) || !allows(t.to)) return false
    return roleMayOpen(router.resolve(t.to).meta.roles, session?.role ?? null)
  }),
)
</script>

<template>
  <DsPanel v-if="tiles.length" data-testid="alat-soalan">
    <h2 class="mb-3 flex items-center gap-2 text-subheading text-highlighted">
      <UIcon name="i-ph-wrench-duotone" class="size-5 text-primary-t" />
      Alat Soalan
    </h2>
    <ul class="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="t in tiles" :key="t.to" class="min-w-0">
        <UButton
          :to="t.to"
          color="neutral"
          variant="soft"
          block
          class="h-auto min-h-11 justify-start p-3"
          data-testid="alat-tile"
        >
          <DsIconChip :icon="t.icon" :accent="t.accent" />
          <span class="min-w-0">
            <span class="block text-label text-highlighted">{{ t.title }}</span>
            <span class="block text-caption text-muted">{{ t.caption }}</span>
          </span>
        </UButton>
      </li>
    </ul>
  </DsPanel>
</template>
