<script setup lang="ts">
/**
 * S2 `/battle/leaderboard` "Ranking Pelajar Battle" (M16-T3; SRS M16 v1.6 FR-M16-41, 42;
 * URS FN-M16-3.1). Pills "Mingguan" (default) / "Bulanan" reload the period (DV-M16-04); the
 * URL parameter `period` is ignored as on live. The seven-column table scrolls inside its card.
 */
import { computed, ref } from 'vue'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage, DsLoadError } from '@/ds'

import { fetchStudentStandings } from '../api'
import { mskText } from '../components/battle/battle-lib'
import RankedRow from '../components/battle/RankedRow.vue'

const period = ref<'weekly' | 'monthly'>('weekly')
const { data, error, loading, reload } = useApi(
  (signal) => fetchStudentStandings(period.value, { signal }),
  period,
)
const rows = computed(() => data.value ?? [])

const PILLS = [
  { value: 'weekly', label: 'Mingguan' },
  { value: 'monthly', label: 'Bulanan' },
] as const
</script>

<template>
  <DsPage data-testid="battle-leaderboard">
    <div class="grid grid-cols-2 gap-2 sm:flex" data-testid="battle-leaderboard-pills">
      <UButton
        v-for="p in PILLS"
        :key="p.value"
        size="xl"
        :color="period === p.value ? 'primary' : 'neutral'"
        :variant="period === p.value ? 'solid' : 'soft'"
        class="min-h-12 justify-center"
        :aria-pressed="period === p.value"
        :data-testid="`battle-pill-${p.value}`"
        @click="period = p.value"
      >
        {{ p.label }}
      </UButton>
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
    <DsEmptyState
      v-else-if="rows.length === 0"
      title="Belum ada data kedudukan. Mula battle untuk muncul di sini!"
      icon="medal"
      data-testid="battle-leaderboard-empty"
    />
    <ul v-else class="flex flex-col gap-2" data-testid="battle-leaderboard-scroll">
      <RankedRow
        v-for="r in rows"
        :key="r.userId"
        :rank="r.rank"
        :title="r.name"
        :subtitle="r.school"
        :initials="r.name.slice(0, 2).toUpperCase()"
        data-testid="battle-leaderboard-row"
      >
        <div class="flex flex-col">
          <dt class="text-caption text-muted">M/S/K</dt>
          <dd class="tabular text-label text-highlighted" data-testid="battle-msk">
            {{ mskText(r.menang, r.seri, r.kalah) }}
          </dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-caption text-muted">Ketepatan</dt>
          <dd class="tabular text-label text-highlighted">{{ r.ketepatan }}%</dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-caption text-muted">Streak</dt>
          <dd class="tabular text-label text-highlighted">{{ r.streak }}</dd>
        </div>
        <div class="flex flex-col">
          <dt class="text-caption text-muted">Skor</dt>
          <dd class="tabular text-label text-primary-t">{{ r.skor }}</dd>
        </div>
      </RankedRow>
    </ul>
  </DsPage>
</template>
