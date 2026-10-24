<script setup lang="ts">
/**
 * S3 `/battle/ranking-sekolah` "Papan Ranking Sekolah" (M16-T3; SRS M16 v1.6 FR-M16-43..46,
 * BR-M16-13; URS FN-M16-3.2). Hero, period links (GET, keeping `state`), state select, the podium
 * (national rows 1-3, only when rows exist) and the "Senarai Penuh" table. An unknown `period`
 * shows all-time rows with no pill active (`activePeriod` null). The table scrolls in its card.
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsArt3D, DsEmptyState, DsPage, DsLoadError } from '@/ds'

import { fetchSchoolStandings } from '../api'
import { BATTLE_STATES } from '../components/battle/battle-lib'
import RankedRow from '../components/battle/RankedRow.vue'

const route = useRoute()
const router = useRouter()

const periodQuery = computed(() => {
  const p = route.query.period
  return typeof p === 'string' ? p : ''
})
const stateQuery = computed(() => {
  const s = route.query.state
  return typeof s === 'string' ? s : ''
})

const { data, error, loading, reload } = useApi(
  (signal) =>
    fetchSchoolStandings(
      {
        ...(periodQuery.value ? { period: periodQuery.value } : {}),
        ...(stateQuery.value ? { state: stateQuery.value } : {}),
      },
      { signal },
    ),
  [periodQuery, stateQuery],
)

const PERIODS = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'all_time', label: 'Sepanjang Masa' },
] as const

/** The period the links and the select carry: the queried one, else the default. */
const currentPeriod = computed(() => periodQuery.value || 'weekly')

function periodTo(value: string) {
  return {
    path: '/battle/ranking-sekolah',
    query: { period: value, ...(stateQuery.value ? { state: stateQuery.value } : {}) },
  }
}

/** `USelect` cannot hold an empty value: "Semua Negeri" is carried as this sentinel. */
const ALL_STATES = '__semua__'
const stateItems = [
  { value: ALL_STATES, label: 'Semua Negeri' },
  ...BATTLE_STATES.map((s) => ({ value: s, label: s })),
]

function onState(picked: string): void {
  const value = picked === ALL_STATES ? '' : picked
  void router.push({
    path: '/battle/ranking-sekolah',
    query: { period: currentPeriod.value, state: value },
  })
}

const rows = computed(() => data.value?.rows ?? [])
const podiumOrder = computed(() => {
  const byColumn = new Map((data.value?.podium ?? []).map((p) => [p.column, p]))
  return [2, 1, 3]
    .map((c) => byColumn.get(c as 1 | 2 | 3))
    .filter((p): p is NonNullable<typeof p> => p !== undefined)
})
</script>

<template>
  <DsPage data-testid="battle-schools">
    <UCard>
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <h2 class="text-title text-highlighted">Papan Kedudukan Sekolah</h2>
          <p class="text-body text-muted">Sekolah mana paling hebat? Wakili sekolah anda!</p>
        </div>
        <DsArt3D name="trophy" size="hero" float class="hidden sm:block" />
      </div>
    </UCard>

    <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <UButton
        v-for="p in PERIODS"
        :key="p.value"
        :to="periodTo(p.value)"
        size="xl"
        :color="(data?.activePeriod ?? currentPeriod) === p.value ? 'primary' : 'neutral'"
        :variant="(data?.activePeriod ?? currentPeriod) === p.value ? 'solid' : 'soft'"
        class="min-h-12 justify-center"
        :data-testid="`battle-period-${p.value}`"
        >{{ p.label }}</UButton
      >
      <USelect
        :model-value="stateQuery === '' ? ALL_STATES : stateQuery"
        :items="stateItems"
        size="xl"
        class="w-full sm:ml-auto sm:w-56"
        data-testid="battle-state-select"
        @update:model-value="onState(String($event))"
      />
    </div>

    <DsLoadError
      v-if="error"
      message="Maaf, berlaku ralat. Sila cuba semula."
      testid="battle-load-error"
      @retry="reload()"
    />
    <div v-else-if="loading && !data" class="flex flex-col gap-2" aria-busy="true">
      <USkeleton v-for="n in 4" :key="n" class="h-16 w-full" />
    </div>
    <template v-else>
      <!-- Podium: 2nd, 1st (raised), 3rd -->
      <div
        v-if="podiumOrder.length > 0"
        class="grid grid-cols-3 items-end gap-2 sm:gap-4"
        data-testid="battle-podium"
      >
        <UCard
          v-for="p in podiumOrder"
          :key="p.column"
          :ui="{ body: 'p-2 sm:p-4' }"
          :data-testid="`battle-podium-${p.column}`"
        >
          <div class="flex min-w-0 flex-col items-center gap-1 text-center">
            <DsArt3D v-if="p.column === 1" name="trophy" size="md" float />
            <UBadge v-else color="neutral" variant="soft" size="lg">{{ p.column }}</UBadge>
            <p class="text-label break-words text-highlighted">
              {{ p.name }}
            </p>
            <p class="text-caption text-muted">{{ p.state }}</p>
            <p
              class="tabular text-heading"
              :class="p.column === 1 ? 'text-primary-t' : 'text-highlighted'"
            >
              {{ p.skor }}
            </p>
            <p class="text-caption text-muted">mata</p>
          </div>
        </UCard>
      </div>

      <UCard>
        <h3 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-list-numbers-duotone" class="size-5 text-primary-t" aria-hidden="true" />
          Senarai Penuh
        </h3>
        <DsEmptyState
          v-if="rows.length === 0"
          title="Belum ada data kedudukan. Mula battle untuk melihat kedudukan sekolah!"
          icon="trophy"
          data-testid="battle-schools-empty"
        />
        <ul v-else class="mt-3 flex flex-col gap-2" data-testid="battle-schools-scroll">
          <RankedRow
            v-for="r in rows"
            :key="r.schoolId"
            :rank="r.rank"
            :title="r.name"
            :subtitle="`${r.state} · ${r.type}`"
            :to="`/battle/ranking-sekolah/${r.schoolId}`"
            data-testid="battle-school-row"
          >
            <div class="flex flex-col">
              <dt class="text-caption text-muted">Battle</dt>
              <dd class="tabular text-label text-highlighted">{{ r.battles }}</dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-caption text-muted">M/S/K</dt>
              <dd class="tabular text-label" data-testid="battle-msk">
                <span class="text-success">{{ r.menang }}</span
                >/<span class="text-muted">{{ r.seri }}</span
                >/<span class="text-error">{{ r.kalah }}</span>
              </dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-caption text-muted">Ketepatan</dt>
              <dd class="tabular text-label text-highlighted">{{ r.ketepatan }}%</dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-caption text-muted">Pelajar</dt>
              <dd class="tabular text-label text-highlighted">{{ r.pelajar }}</dd>
            </div>
            <div class="flex flex-col">
              <dt class="text-caption text-muted">Skor</dt>
              <dd class="tabular text-label text-primary-t">{{ r.skor }}</dd>
            </div>
          </RankedRow>
        </ul>
      </UCard>
    </template>
  </DsPage>
</template>
