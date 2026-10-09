<script setup lang="ts">
/**
 * S23 `/tournament` (FR-M16-105, 106; URS FN-M16-8.1.1 ... 8.1.3): the hero, "Cipta Tournament Baru"
 * for admins only and the active tournaments of #42 (PROPOSED cards) or the empty card "Tiada
 * tournament aktif buat masa ini." (the seed). S25-S27 leagues are not linked from here (no link to
 * `/liga` on live, Q-M16-4).
 *
 * Layout follows the live capture (`tournament-desktop.png`): an indigo-violet-pink hero with a
 * decorative circle, the create button on its own row below it, and a large white empty card with a
 * grey trophy. D9: live paints the hero heading dark on the violet gradient (unreadable), the
 * rebuild keeps it white.
 */
import { Plus, Trophy } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { useApi, useSession } from '@/composables'

import { fetchTournaments } from '../api'
import PageLoadError from '../components/competition/PageLoadError.vue'
import { LIST_COPY as COPY } from '../components/tournament/copy'
import TournamentCard from '../components/tournament/TournamentCard.vue'

const { role } = useSession()
const isAdmin = computed(() => role.value === 'admin')
const view = useApi((signal) => fetchTournaments({ signal }))
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="m16-tournament-page">
    <section
      class="relative overflow-hidden rounded-2xl bg-linear-to-r from-indigo-600 via-purple-600 to-pink-500 p-4 text-white shadow-lg sm:p-6"
      data-testid="tournament-hero"
    >
      <div
        class="pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10"
      ></div>
      <div class="relative flex min-w-0 items-center gap-3">
        <Trophy class="h-8 w-8 shrink-0 text-white" />
        <h2 class="font-heading text-2xl font-bold text-white sm:text-3xl">{{ COPY.heading }}</h2>
      </div>
      <p class="relative mt-2 text-sm text-white/90 sm:text-base">{{ COPY.sub }}</p>
    </section>

    <!--
      Known dead link until S24 lands: `/tournament/admin/create` is the T6 remainder and is not
      routed yet, so the admin sees the global 404 page there (XR-M16-11: S24 admin is deferred,
      outside the 1.0 student scope; recorded in TRACKER).
    -->
    <RouterLink
      v-if="isAdmin"
      :to="COPY.createTo"
      class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700"
      data-testid="tournament-create"
    >
      <Plus class="h-4 w-4" />
      {{ COPY.create }}
    </RouterLink>

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <div
      v-else-if="!view.data.value"
      class="flex justify-center py-10 text-slate-400"
      data-testid="tournament-loading"
    >
      <LoadingSpinner :size="28" />
    </div>
    <div
      v-else-if="view.data.value.length === 0"
      class="rounded-2xl bg-white px-4 py-12 text-center shadow-sm"
      data-testid="tournament-empty"
    >
      <Trophy class="mx-auto h-14 w-14 text-gray-300" />
      <p class="mt-3 text-gray-600">{{ COPY.empty }}</p>
    </div>
    <div v-else class="space-y-3" data-testid="tournament-list">
      <TournamentCard v-for="t in view.data.value" :key="t.uuid" :item="t" />
    </div>
  </div>
</template>
