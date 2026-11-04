<script setup lang="ts">
/**
 * Hub "SPM" (`/admin/spm`, R1-ADM-Q-01): one card per lane in the PRD order with its description, the item count as a big number,
 * the attention lines or "Semua elok", `Buka senarai` and `lihat sisi pelajar`. The API returns all six cards (`overview.cards`); a
 * card whose screen is not registered is hidden (FR-ADM-Q01.4). A card that could not be computed shows its own error; the others
 * stay (SR-3). A card whose attention rule is still open (`attentionOpen`) shows neither lines nor "Semua elok".
 */
import type { ServabilityHubCard, ServabilityOverview } from '@pp/contract'
import { computed, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { DsGrid, DsHeading, DsLink, DsLoadError, DsPage, DsSpacer, DsStack, DsSurface, DsText, formatCount } from '@/ds'

import { laneRouteOf } from '../api'
import { kandunganServer } from '../client'
import { hubCopy, pupilRouteOf } from '../lanes'

const COLS = { base: 1, md: 2, xl: 3 } as const

const router = useRouter()
const server = kandunganServer()
const { data, error, loading, reload } = useApi(() => server.overview())
/** The last good overview: a failed `Cuba lagi` must not take the other cards down (SR-3); `useApi` nulls `data` on failure. */
const overview = shallowRef<ServabilityOverview | null>(null)
watch(data, (d) => {
  if (d) overview.value = d
})

const cards = computed<readonly ServabilityHubCard[]>(() => (overview.value?.cards ?? []).filter((c) => router.hasRoute(laneRouteOf(c.lane))))
/** Test ids keep the V2 lane key: `simulasi` for the Bijak SPM lane. */
const keyOf = (c: ServabilityHubCard): string => (c.lane === 'bijak-spm' ? 'simulasi' : c.lane)
const linesOf = (c: ServabilityHubCard): string[] =>
  c.attentionLines?.map((l) => l.text) ?? (c.attention > 0 ? [`${formatCount(c.attention)} ${c.attentionLabel}`] : [])
</script>

<template>
  <DsPage :title="hubCopy.title" layout="list" data-testid="kandungan-hub">
    <template #subtitle>
      <DsText as="p" variant="body" tone="muted" data-testid="kandungan-intro">{{ hubCopy.intro }}</DsText>
    </template>

    <DsLoadError v-if="error && !overview" message="Tidak dapat memuatkan ringkasan kandungan." @retry="reload()" />
    <DsGrid v-else-if="loading && !overview" :cols="COLS" aria-busy="true">
      <USkeleton v-for="n in 6" :key="n" class="h-40 w-full" />
    </DsGrid>
    <DsGrid v-else as="ul" :cols="COLS" data-testid="kandungan-cards">
      <DsSurface v-for="c in cards" :key="c.lane" as="li" level="raised" padding="md" :data-testid="`kandungan-card-${keyOf(c)}`">
        <DsStack gap="sm" fill>
          <DsHeading :level="2" variant="heading">{{ c.title }}</DsHeading>
          <DsText as="p" variant="body" tone="toned">{{ c.description }}</DsText>
          <DsStack v-if="c.failed" gap="xs" align="start" :data-testid="`kandungan-failed-${keyOf(c)}`">
            <DsText as="p" variant="body" tone="error" role="alert">{{ hubCopy.failed }}</DsText>
            <UButton
              color="neutral"
              variant="soft"
              class="min-h-11"
              :label="hubCopy.retry"
              :loading="loading"
              :data-testid="`kandungan-retry-${keyOf(c)}`"
              @click="reload()"
            />
          </DsStack>
          <template v-else>
            <DsText as="p" variant="kpi" tone="highlighted" tabular :data-testid="`kandungan-total-${keyOf(c)}`">{{ formatCount(c.total) }}</DsText>
            <DsStack v-if="!c.attentionOpen" gap="2xs" :data-testid="`kandungan-attention-${keyOf(c)}`">
              <template v-if="linesOf(c).length">
                <DsText v-for="l in linesOf(c)" :key="l" as="p" variant="caption" tone="error">{{ l }}</DsText>
              </template>
              <DsText v-else as="p" variant="caption" tone="success">{{ hubCopy.allGood }}</DsText>
            </DsStack>
          </template>
          <DsSpacer />
          <UButton
            :to="{ name: laneRouteOf(c.lane) }"
            color="neutral"
            variant="outline"
            class="min-h-11 justify-center"
            :data-testid="`kandungan-open-${keyOf(c)}`"
            >{{ hubCopy.open }}</UButton
          >
          <DsLink v-if="pupilRouteOf(router, c.lane)" :to="pupilRouteOf(router, c.lane)!" :data-testid="`kandungan-pupil-${keyOf(c)}`">{{ hubCopy.pupil }}</DsLink>
        </DsStack>
      </DsSurface>
    </DsGrid>
  </DsPage>
</template>
