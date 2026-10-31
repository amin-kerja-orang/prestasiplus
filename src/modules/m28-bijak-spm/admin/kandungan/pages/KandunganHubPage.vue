<script setup lang="ts">
/**
 * Kandungan SPM hub (`/admin/spm`, V2 `admin.spm.hub` / Panel `/spm`, AC-R1-21.1): one card per lane in the V2 order with
 * its V2 description, the attention count and "Buka senarai". A lane without a screen in R1 shows its card with no button
 * (no link to a missing screen). Counts come from `GET /api/admin/servability/overview`.
 */
import { computed } from 'vue'

import { useApi } from '@/composables/useApi'
import { DsLoadError, DsPage } from '@/ds'

import { KANDUNGAN_ROUTES } from '../api'
import { kandunganServer } from '../client'
import { hubCopy, LANE_CARDS, type LaneCard } from '../lanes'

const server = kandunganServer()
const { data, error, loading, reload } = useApi(() => server.overview())

const attentionOf = computed(() => {
  const by = new Map((data.value?.activities ?? []).map((a) => [a.activity, a.attention]))
  return (c: LaneCard): number | null => (c.activity ? (by.get(c.activity) ?? null) : null)
})

const routeOf = (c: LaneCard): string => (c.key === 'databank' ? KANDUNGAN_ROUTES.databank : KANDUNGAN_ROUTES.simulasi)
</script>

<template>
  <DsPage :title="hubCopy.title" layout="list" data-testid="kandungan-hub">
    <template #subtitle>
      <p class="text-body text-muted" data-testid="kandungan-intro">{{ hubCopy.intro }}</p>
    </template>

    <DsLoadError v-if="error" message="Tidak dapat memuatkan ringkasan kandungan." @retry="reload()" />
    <div v-else-if="loading && !data" class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
      <USkeleton v-for="n in 6" :key="n" class="h-40 w-full" />
    </div>
    <ul v-else class="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="kandungan-cards">
      <li v-for="c in LANE_CARDS" :key="c.key" class="min-w-0">
        <UCard class="h-full" :data-testid="`kandungan-card-${c.key}`">
          <div class="flex h-full flex-col gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="text-heading text-highlighted">{{ c.name }}</h2>
              <UBadge v-if="c.flagOff" color="neutral" variant="subtle">{{ hubCopy.flagOff }}</UBadge>
            </div>
            <p class="text-body text-toned">{{ c.desc }}</p>
            <div class="flex-1">
              <template v-if="attentionOf(c) !== null">
                <UBadge
                  v-if="attentionOf(c)! > 0"
                  color="error"
                  variant="subtle"
                  :data-testid="`kandungan-attention-${c.key}`"
                  >{{ attentionOf(c) }} {{ hubCopy.attention }}</UBadge
                >
                <UBadge v-else color="success" variant="subtle" :data-testid="`kandungan-attention-${c.key}`">{{
                  hubCopy.allGood
                }}</UBadge>
              </template>
            </div>
            <UButton
              v-if="c.inR1"
              :to="{ name: routeOf(c) }"
              color="neutral"
              variant="outline"
              class="min-h-11 justify-center"
              :data-testid="`kandungan-open-${c.key}`"
              >{{ hubCopy.open }}</UButton
            >
            <p v-else class="text-caption text-muted" :data-testid="`kandungan-notyet-${c.key}`">{{ hubCopy.notYet }}</p>
          </div>
        </UCard>
      </li>
    </ul>
  </DsPage>
</template>
