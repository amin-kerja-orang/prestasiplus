<script setup lang="ts">
/**
 * S19 `/ranking` "Kedudukan" (R1-MUR-18, API-RPT-13; card S7-T06).
 *
 * - Top line "Syiling anda" with the balance and the note "Kedudukan dikira berdasarkan baki syiling.".
 * - One rank card per applicable scope ("Dalam kelas" only for a pupil in a class, "Dalam sekolah", "Dalam
 *   negeri", "Kebangsaan"): "#{rank}", "/ {total}" and "Kumpulan {p}% teratas"; "Belum tersedia" without a state.
 * - "Sekitar anda" with the scope as sub-label: up to 2 pupils above, the own row marked "ANDA", up to 2 below
 *   (other pupils by first name only).
 * - Link "Lihat papan pendahulu penuh" (Papan Pendahulu). No scopes: "Kedudukan belum tersedia".
 * - No filters and no query string (FR-MUR-18-6).
 */
import { computed, watchEffect } from 'vue'

import { useApi, usePageMeta } from '@/composables'
import {
  DsEmptyState,
  DsLeaderRow,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatRow,
  type StatItem,
} from '@/ds'
import { formatNumber } from '@/lib/number'

import { fetchRankings } from '../api/performance'
import {
  EMPTY_TEXT,
  EMPTY_TITLE,
  FULL_BOARD_LABEL,
  FULL_BOARD_PATH,
  RANKING_SUBTITLE,
  RANKING_TITLE,
  SCOPE_META,
  SYILING_NOTE,
  nearbyCard,
  rankSub,
  rankText,
} from '../lib/ranking'
import { LOAD_ERROR } from '../lib/prestasi/load'

const pageMeta = usePageMeta()
watchEffect(() => {
  pageMeta.setTitle(RANKING_TITLE)
})

const { data, error, reload } = useApi((signal) => fetchRankings({ signal }))

const firstLoad = computed(() => data.value === null && error.value === null)
const scopes = computed(() => data.value?.scopes ?? [])

const cards = computed<StatItem[]>(() =>
  scopes.value.map((c) => {
    const meta = SCOPE_META[c.scope]
    return {
      key: c.scope,
      label: meta.label,
      icon: meta.icon,
      accent: meta.accent as StatItem['accent'],
      value: rankText(c),
      sub: rankSub(c),
    }
  }),
)

const nearby = computed(() => nearbyCard(scopes.value))
</script>

<template>
  <DsPage title="Kedudukan" :subtitle="RANKING_SUBTITLE" data-testid="ranking-page">
    <DsLoadError v-if="error" :message="LOAD_ERROR" testid="ranking-error" @retry="reload()" />

    <div
      v-else-if="firstLoad"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="ranking-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <!-- Syiling anda -->
      <DsPanel data-testid="ranking-syiling">
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <p class="text-caption font-semibold tracking-wide text-muted uppercase">Syiling anda</p>
            <p class="tabular font-display text-display text-highlighted" data-testid="ranking-syiling-value">
              {{ formatNumber(data?.syiling ?? 0) }}
            </p>
            <p class="text-caption text-muted">{{ SYILING_NOTE }}</p>
          </div>
          <UIcon name="i-ph-ranking" class="size-10 shrink-0 text-primary-t" aria-hidden="true" />
        </div>
      </DsPanel>

      <!-- Empty -->
      <div v-if="scopes.length === 0" data-testid="ranking-empty">
        <DsEmptyState :title="EMPTY_TITLE" :description="EMPTY_TEXT" icon="ranking" />
      </div>

      <template v-else>
        <!-- One card per applicable scope -->
        <DsStatRow :items="cards" prefix="ranking-card" :cols="4" data-testid="ranking-cards" />

        <!-- Sekitar anda -->
        <DsPanel v-if="nearby" data-testid="ranking-nearby">
          <h2 class="text-heading text-highlighted">Sekitar anda</h2>
          <p class="mb-3 text-caption text-muted" data-testid="ranking-nearby-scope">
            {{ SCOPE_META[nearby.scope].label }}
          </p>
          <p v-if="nearby.nearby.length <= 1" class="text-body text-muted" data-testid="ranking-nearby-alone">
            Tiada pelajar lain untuk dibandingkan dalam skop ini.
          </p>
          <ul v-else class="flex flex-col gap-2" data-testid="ranking-nearby-list">
            <DsLeaderRow
              v-for="n in nearby.nearby"
              :key="n.rank"
              :rank="n.rank"
              :name="n.name"
              :points="formatNumber(n.syiling)"
              :own="n.me"
              own-label="ANDA"
              data-testid="ranking-nearby-row"
            />
          </ul>
        </DsPanel>

        <p class="text-center">
          <UButton
            :to="FULL_BOARD_PATH"
            :label="FULL_BOARD_LABEL"
            trailing-icon="i-ph-arrow-right"
            variant="link"
            data-testid="ranking-full-board"
          />
        </p>
      </template>
    </template>
  </DsPage>
</template>
