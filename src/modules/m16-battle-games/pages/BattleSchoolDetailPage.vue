<script setup lang="ts">
/**
 * S4 `/battle/ranking-sekolah/:id` school detail (M16-T3; SRS M16 v1.6 FR-M16-47..50, BR-M16-14;
 * URS FN-M16-3.3). Hero with the loaded school, four all-time cards (2 columns, 4 from `md`), the
 * "Minggu Ini" / "Bulan Ini" boxes (stacked below `md`), the weekly best fighters and the last 10
 * battles (scrolling inside their card below 768 px). An id that is not a school is the 404 page.
 * The shell header and the tab title are the school name (set from the loaded record).
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, usePageMeta } from '@/composables'
import { DsArt3D, DsLeaderRow, DsPage, DsStatTile, DsLoadError } from '@/ds'

import { fetchSchoolDetail } from '../api'
import BattleRecentList from '../components/battle/BattleRecentList.vue'
import { mskText } from '../components/battle/battle-lib'

const route = useRoute()
const id = computed(() => Number(route.params.id))
const { data, error, reload } = useApi((signal) => fetchSchoolDetail(id.value, { signal }), id)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)

const meta = usePageMeta()
watch(
  data,
  (d) => {
    if (!d) return
    meta.setTitle(d.school.name)
    meta.setHeader({ title: d.school.name, subtitle: `${d.school.state} · ${d.school.type}` })
  },
  { immediate: true },
)

const heroLine = computed(() => {
  const s = data.value?.school
  if (!s) return ''
  // `ppd` already carries the "PPD " prefix (M02 district names), as on live "PPD HULU LANGAT · Selangor · SMK".
  return [s.ppd ?? null, s.state, s.type].filter((p) => p !== null).join(' · ')
})

const cards = computed(() => {
  const a = data.value?.allTime
  if (!a) return []
  return [
    {
      id: 'battles',
      label: 'Jumlah Battle',
      value: String(a.battles),
      icon: 'i-ph-lightning-duotone',
      accent: 'heat' as const,
    },
    {
      id: 'menang',
      label: 'Kemenangan',
      value: String(a.menang),
      icon: 'i-ph-trophy-duotone',
      accent: 'win' as const,
    },
    {
      id: 'ketepatan',
      label: 'Ketepatan',
      value: `${String(a.ketepatan)}%`,
      icon: 'i-ph-target-duotone',
      accent: 'action' as const,
    },
    {
      id: 'pelajar',
      label: 'Pelajar Aktif',
      value: String(a.pelajar),
      icon: 'i-ph-users-three-duotone',
      accent: 'friend' as const,
    },
  ]
})

const boxes = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    {
      id: 'week',
      title: 'Minggu Ini',
      icon: 'i-ph-calendar-dots-duotone',
      box: d.week,
      empty: 'Tiada data minggu ini',
    },
    {
      id: 'month',
      title: 'Bulan Ini',
      icon: 'i-ph-calendar-duotone',
      box: d.month,
      empty: 'Tiada data bulan ini',
    },
  ]
})
</script>

<template>
  <DsPage data-testid="battle-school-detail">
    <div v-if="!data && !error" class="flex flex-col gap-4" aria-busy="true">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>
    <DsLoadError
      v-else-if="error && !notFound"
      message="Maaf, berlaku ralat. Sila cuba semula."
      testid="battle-load-error"
      @retry="reload()"
    />

    <template v-else-if="data">
      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <h2 class="text-title break-words text-highlighted" data-testid="battle-school-name">
              {{ data.school.name }}
            </h2>
            <p class="text-body text-muted" data-testid="battle-school-line">{{ heroLine }}</p>
          </div>
          <DsArt3D name="cap" size="hero" float class="hidden sm:block" />
        </div>
      </UCard>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <DsStatTile
          v-for="c in cards"
          :key="c.id"
          :value="c.value"
          :unit="c.label"
          :icon="c.icon"
          :accent="c.accent"
          :data-testid="`battle-card-${c.id}`"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <UCard v-for="b in boxes" :key="b.id" :data-testid="`battle-period-box-${b.id}`">
          <h3 class="flex items-center gap-2 text-subheading text-highlighted">
            <UIcon :name="b.icon" class="size-5 text-primary-t" aria-hidden="true" /> {{ b.title }}
          </h3>
          <dl v-if="b.box" class="mt-3 flex flex-col gap-2">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-body text-muted">Kedudukan Nasional</dt>
              <dd class="tabular text-label text-primary-t" data-testid="battle-box-rank">
                #{{ b.box.rank }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-body text-muted">Battle</dt>
              <dd class="tabular text-label text-highlighted" data-testid="battle-box-battles">
                {{ b.box.battles }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-body text-muted">Menang/Seri/Kalah</dt>
              <dd class="tabular text-label text-highlighted" data-testid="battle-box-msk">
                {{ mskText(b.box.menang, b.box.seri, b.box.kalah) }}
              </dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-body text-muted">Skor</dt>
              <dd class="tabular text-label text-primary-t" data-testid="battle-box-skor">
                {{ b.box.skor }}
              </dd>
            </div>
          </dl>
          <p v-else class="mt-3 text-body text-muted" data-testid="battle-box-empty">
            {{ b.empty }}
          </p>
        </UCard>
      </div>

      <UCard>
        <h3 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-medal-duotone" class="size-5 text-primary-t" aria-hidden="true" />
          Pejuang Terbaik Minggu Ini
        </h3>
        <ul v-if="data.fighters.length > 0" class="mt-3 flex flex-col gap-2" data-testid="battle-fighters">
          <DsLeaderRow
            v-for="(f, i) in data.fighters"
            :key="f.userId"
            :rank="i + 1"
            :name="f.name"
            :points="f.skor"
            medal="trophy"
          />
        </ul>
        <p v-else class="mt-3 text-body text-muted" data-testid="battle-fighters-empty">
          Tiada data pejuang minggu ini
        </p>
      </UCard>

      <UCard>
        <h3 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-clock-counter-clockwise-duotone" class="size-5 text-primary-t" aria-hidden="true" />
          Battle Terkini
        </h3>
        <div class="mt-3">
          <BattleRecentList v-if="data.recent.length > 0" :rows="data.recent" home-colour />
          <p v-else class="text-body text-muted" data-testid="battle-recent-empty">
            Tiada battle terkini
          </p>
        </div>
      </UCard>
    </template>
  </DsPage>
</template>
