<script setup lang="ts">
/**
 * S23 `/tournament` (FR-M16-105, 106; URS FN-M16-8.1.1 ... 8.1.3): the hero, "Cipta Tournament Baru"
 * for admins only and the active tournaments of #42 (PROPOSED cards) or the empty card "Tiada
 * tournament aktif buat masa ini." (the seed). S25-S27 leagues are not linked from here (no link to
 * `/liga` on live, Q-M16-4).
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
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="m16-tournament-page">
    <section
      class="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-linear-to-r from-indigo-600 to-purple-600 p-4 text-white shadow-lg sm:p-6"
      data-testid="tournament-hero"
    >
      <div class="flex min-w-0 items-center gap-3">
        <Trophy class="h-8 w-8 shrink-0 text-yellow-300" />
        <div class="min-w-0">
          <h2 class="text-xl font-bold text-white sm:text-2xl">{{ COPY.heading }}</h2>
          <p class="mt-1 text-sm text-white">{{ COPY.sub }}</p>
        </div>
      </div>
      <RouterLink
        v-if="isAdmin"
        :to="COPY.createTo"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-50"
        data-testid="tournament-create"
      >
        <Plus class="h-4 w-4" />
        {{ COPY.create }}
      </RouterLink>
    </section>

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
      class="rounded-2xl bg-white p-8 text-center shadow-sm"
      data-testid="tournament-empty"
    >
      <Trophy class="mx-auto h-10 w-10 text-gray-300" />
      <p class="mt-3 text-gray-600">{{ COPY.empty }}</p>
    </div>
    <div v-else class="space-y-3" data-testid="tournament-list">
      <TournamentCard v-for="t in view.data.value" :key="t.uuid" :item="t" />
    </div>
  </div>
</template>
