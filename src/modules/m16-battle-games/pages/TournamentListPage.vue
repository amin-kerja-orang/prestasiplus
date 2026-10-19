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

import { useApi, useSession } from '@/composables'
import {
  DsArt3D,
  DsEmptyState,
  DsPage,
  DsLoadError,
  DsCluster,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'

import { fetchTournaments } from '../api'
import { LIST_COPY as COPY } from '../components/tournament/copy'
import TournamentCard from '../components/tournament/TournamentCard.vue'
import { LOAD_COPY } from '../components/competition/copy'

const { role } = useSession()
const isAdmin = computed(() => role.value === 'admin')
const view = useApi((signal) => fetchTournaments({ signal }))
</script>

<template>
  <DsPage data-testid="m16-tournament-page">
    <UCard data-testid="tournament-hero">
      <DsCluster gap="md" justify="between" :wrap="false">
        <DsStack gap="2xs">
          <DsHeading :level="2" variant="title">{{ COPY.heading }}</DsHeading>
          <DsText variant="body" tone="muted" class="max-w-prose">{{ COPY.sub }}</DsText>
        </DsStack>
        <DsArt3D name="trophy" size="hero" float class="hidden sm:block" />
      </DsCluster>
    </UCard>

    <!--
      Known dead link until S24 lands: `/tournament/admin/create` is the T6 remainder and is not
      routed yet, so the admin sees the global 404 page there (XR-M16-11: S24 admin is deferred,
      outside the 1.0 student scope; recorded in TRACKER).
    -->
    <UButton
      v-if="isAdmin"
      :to="COPY.createTo"
      size="xl"
      color="primary"
      icon="i-ph-plus-bold"
      class="min-h-12 justify-center sm:self-start"
      data-testid="tournament-create"
    >
      {{ COPY.create }}
    </UButton>

    <DsLoadError
      v-if="view.error.value"
      :message="LOAD_COPY.failed"
      testid="m16-load-error"
      retry-testid="m16-retry"
      @retry="view.reload()"
    />
    <DsStack
      v-else-if="!view.data.value"
      gap="sm"
      aria-busy="true"
      data-testid="tournament-loading"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </DsStack>
    <DsEmptyState
      v-else-if="view.data.value.length === 0"
      :title="COPY.empty"
      icon="trophy"
      data-testid="tournament-empty"
    />
    <DsStack v-else gap="sm" data-testid="tournament-list">
      <TournamentCard v-for="t in view.data.value" :key="t.uuid" :item="t" />
    </DsStack>
  </DsPage>
</template>
