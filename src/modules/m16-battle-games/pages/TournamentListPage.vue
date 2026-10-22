<script setup lang="ts">
/**
 * S23 `/tournament` (FR-M16-105, 106; URS FN-M16-8.1.1 ... 8.1.3): the hero, "Cipta Tournament Baru"
 * for admins only and the active tournaments of #42 (PROPOSED cards) or the empty card "Tiada
 * tournament aktif buat masa ini." (the seed). S25-S27 leagues are not linked from here (no link to
 * `/liga` on live, Q-M16-4).
 *
 * Layout follows the live capture (`tournament-desktop.png`): an indigo-violet-pink hero with a
 * decorative circle, the create button on its own row below it, and a large white empty card with a
 * grey trophy. DV-M16-39 (D9): live paints the hero heading dark on the violet gradient (about
 * 2.7 to 2.9:1, unreadable), the rebuild keeps it white.
 */
import { computed } from 'vue'

import { useApi, useRouteExists, useSession } from '@/composables'
import { DsArt3D, DsEmptyState, DsPage, DsLoadError } from '@/ds'

import { fetchTournaments } from '../api'
import { LIST_COPY as COPY } from '../components/tournament/copy'
import TournamentCard from '../components/tournament/TournamentCard.vue'
import { LOAD_COPY } from '../components/competition/copy'

const { role } = useSession()
const isAdmin = computed(() => role.value === 'admin')
const { routeExists } = useRouteExists()
const view = useApi((signal) => fetchTournaments({ signal }))
</script>

<template>
  <DsPage data-testid="m16-tournament-page">
    <UCard data-testid="tournament-hero">
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1">
          <h2 class="text-title text-highlighted">{{ COPY.heading }}</h2>
          <p class="max-w-prose text-body text-muted">{{ COPY.sub }}</p>
        </div>
        <DsArt3D name="trophy" size="hero" float class="hidden sm:block" />
      </div>
    </UCard>

    <!--
      `/tournament/admin/create` (S24) is the T6 remainder and is not routed yet (XR-M16-11: S24 admin
      is deferred, outside the 1.0 student scope). The button is hidden until the route exists (D9,
      dead link; DV-M16-40).
    -->
    <UButton
      v-if="isAdmin && routeExists(COPY.createTo)"
      :to="COPY.createTo"
      size="xl"
      color="primary"
      icon="i-ph-plus-bold"
      class="min-h-12 justify-center sm:self-start"
      data-testid="tournament-create"
    >
      {{ COPY.create }}
    </UButton>

    <DsLoadError v-if="view.error.value" :message="LOAD_COPY.failed" testid="m16-load-error" retry-testid="m16-retry" @retry="view.reload()" />
    <div
      v-else-if="!view.data.value"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="tournament-loading"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>
    <DsEmptyState
      v-else-if="view.data.value.length === 0"
      :title="COPY.empty"
      icon="trophy"
      data-testid="tournament-empty"
    />
    <div v-else class="flex flex-col gap-3" data-testid="tournament-list">
      <TournamentCard v-for="t in view.data.value" :key="t.uuid" :item="t" />
    </div>
  </DsPage>
</template>
