<script setup lang="ts">
/**
 * Kandungan SPM hub (`/admin/spm`, V2 `admin.spm.hub` / Panel `/spm`, AC-R1-21.1): one card per lane in the V2 order with
 * its V2 description, the attention count and "Buka senarai". Lanes without a screen in R1 (Tracking A, Subjektif, Kertas
 * Subjektif, Latih Tubi) are not in `overview.cards`, so they are hidden, as AC-R1-21.1 says (UX-20). The cards (V2 title,
 * description, count and attention label) come from `GET /api/admin/servability/overview` (T45 `cards`).
 */
import type { ServabilityHubCard } from '@pp/contract'

import { useApi } from '@/composables/useApi'
import { DsLoadError, DsPage } from '@/ds'

import { KANDUNGAN_ROUTES } from '../api'
import { kandunganServer } from '../client'
import { hubCopy } from '../lanes'

const server = kandunganServer()
const { data, error, loading, reload } = useApi(() => server.overview())

/** The cards come from the API (T45 `overview.cards`: V2 title, description, count and attention label); only the two lanes that have a screen here. */
const cards = (): readonly ServabilityHubCard[] => (data.value?.cards ?? []).filter((c) => c.lane === 'databank' || c.lane === 'bijak-spm')
/** Test ids keep the V2 lane key: `databank` and `simulasi` (the Bijak SPM lane). */
const keyOf = (c: ServabilityHubCard): string => (c.lane === 'databank' ? 'databank' : 'simulasi')
const routeOf = (c: ServabilityHubCard): string => (c.lane === 'databank' ? KANDUNGAN_ROUTES.databank : KANDUNGAN_ROUTES.simulasi)
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
      <li v-for="c in cards()" :key="c.lane" class="min-w-0">
        <UCard class="h-full" :data-testid="`kandungan-card-${keyOf(c)}`">
          <div class="flex h-full flex-col gap-3">
            <h2 class="text-heading text-highlighted">{{ c.title }}</h2>
            <p class="text-body text-toned">{{ c.description }}</p>
            <div class="flex-1">
              <UBadge v-if="c.attention > 0" color="error" variant="subtle" :data-testid="`kandungan-attention-${keyOf(c)}`"
                >{{ c.attention }} {{ c.attentionLabel }}</UBadge
              >
              <UBadge v-else color="success" variant="subtle" :data-testid="`kandungan-attention-${keyOf(c)}`">{{ hubCopy.allGood }}</UBadge>
            </div>
            <UButton
              :to="{ name: routeOf(c) }"
              color="neutral"
              variant="outline"
              class="min-h-11 justify-center"
              :data-testid="`kandungan-open-${keyOf(c)}`"
              >{{ hubCopy.open }}</UButton
            >
          </div>
        </UCard>
      </li>
    </ul>
  </DsPage>
</template>
