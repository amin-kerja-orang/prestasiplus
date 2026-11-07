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
import { DsGrid, DsIconChip, DsListRow, DsPanel } from '@/ds'
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
  <DsPanel
    v-if="tiles.length"
    title="Alat Soalan"
    icon="squares-four"
    accent="action"
    data-testid="alat-soalan"
  >
    <DsGrid as="ul" :cols="{ base: 1, sm: 2, xl: 3 }" gap="sm">
      <DsListRow
        v-for="t in tiles"
        :key="t.to"
        :title="t.title"
        :sub="t.caption"
        :to="t.to"
        data-testid="alat-tile"
      >
        <template #leading><DsIconChip :icon="t.icon" :accent="t.accent" /></template>
      </DsListRow>
    </DsGrid>
  </DsPanel>
</template>
