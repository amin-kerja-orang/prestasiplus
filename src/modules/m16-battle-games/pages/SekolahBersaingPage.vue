<script setup lang="ts">
/**
 * S28 `/sekolah-bersaing` (`?week=`; FR-M16-127..131, BR-M16-35; URS FN-M16-10.1.1 ... 10.1.6): the
 * heading, the week line "Minggu {dd Mon yyyy} · {n} sekolah dalam pertandingan", the stored rows in
 * stored rank order (staff table, card list below `md`) and the footer tip. A week without a snapshot
 * shows the heading and the plain "Data minggu ini belum dijana." (no week line). `?week=` has no UI
 * control (as live); an invalid value is ignored by #50 (DV-M16-30). User shell for every role
 * (DV-M16-02), the school admin included.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsPage, type CardField } from '@/ds'
import { formatDateEn } from '@/lib/time'

import { fetchSekolahBersaing } from '../api'
import PageLoadError from '../components/competition/PageLoadError.vue'
import { SB_COPY as COPY, SB_MEDALS } from '../components/sekolah-bersaing/copy'

const route = useRoute()

/** The raw `?week=` text (a repeated key uses its first value); `undefined` when absent. */
const week = computed(() => {
  const q = route.query.week
  const v = Array.isArray(q) ? q[0] : q
  return typeof v === 'string' && v !== '' ? v : undefined
})

const view = useApi((signal) => fetchSekolahBersaing(week.value, { signal }), week)
const data = computed(() => view.data.value)
const weekLabel = computed(() => (data.value ? formatDateEn(data.value.weekStart) : ''))

interface Row extends Record<string, unknown> {
  rank: number
  rankText: string
  school: string
  state: string
  anonymous: boolean
  aktif: string
  streak: string
  nota: string
}

const rows = computed<Row[]>(() =>
  (data.value?.rows ?? []).map((r) => ({
    rank: r.rank,
    rankText: r.rank >= 1 && r.rank <= 3 ? (SB_MEDALS[r.rank - 1] ?? '') : `#${String(r.rank)}`,
    school: r.anonymous ? COPY.anonymous : r.schoolName,
    state: r.anonymous ? '' : r.state,
    anonymous: r.anonymous,
    aktif: `${r.aktifPct.toFixed(1)}% ${COPY.aktif}`,
    streak: `${r.streakAvg.toFixed(1)} ${COPY.hari}`,
    nota: `${r.notaPer10.toFixed(1)} ${COPY.per10}`,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'rankText', header: COPY.headers[0] },
  { accessorKey: 'school', header: COPY.headers[1] },
  { accessorKey: 'aktif', header: COPY.headers[2] },
  { accessorKey: 'streak', header: COPY.headers[3] },
  { accessorKey: 'nota', header: COPY.headers[4] },
]
const cardFields: CardField[] = [
  { key: 'rankText', label: COPY.headers[0] },
  { key: 'state', label: 'Negeri' },
  { key: 'aktif', label: COPY.headers[2] },
  { key: 'streak', label: COPY.headers[3] },
  { key: 'nota', label: COPY.headers[4] },
]
</script>

<template>
  <DsPage :title="COPY.heading" :subtitle="COPY.sub" data-testid="m16-sekolah-bersaing-page">

    <PageLoadError v-if="view.error.value" @retry="view.reload()" />
    <USkeleton v-else-if="!data" class="h-48 w-full" data-testid="sb-loading" />

    <UCard v-else-if="data.rows.length === 0" data-testid="sb-empty">
      <div class="flex flex-col items-center gap-1 py-6 text-center">
        <UIcon name="i-ph-chart-bar-duotone" class="size-10 text-dimmed" />
        <p class="text-subheading text-highlighted">{{ COPY.emptyTitle }}</p>
        <p class="text-body text-muted">{{ COPY.emptyHint }}</p>
      </div>
    </UCard>

    <template v-else>
      <p class="text-body text-default" data-testid="sb-week">
        {{ COPY.weekPrefix }}
        <strong class="text-highlighted" data-testid="sb-week-date">{{ weekLabel }}</strong> ·
        <strong class="text-highlighted" data-testid="sb-count">{{ data.count }}</strong>
        {{ COPY.weekSuffix }}
      </p>

      <DsDataTable
        :data="rows"
        :columns="columns"
        :page-size="Math.max(rows.length, 1)"
        caption="Leaderboard sekolah mingguan"
        card-title="school"
        :card-fields="cardFields"
        data-testid="sb-table"
      >
        <template #rankText-cell="{ row }">
          <span class="text-label text-highlighted" data-testid="sb-rank">{{
            row.original.rankText
          }}</span>
        </template>
        <template #school-cell="{ row }">
          <div class="flex min-w-0 flex-col" :data-rank="row.original.rank" data-testid="sb-row">
            <span class="truncate text-label text-highlighted" data-testid="sb-school">{{
              row.original.school
            }}</span>
            <span
              v-if="!row.original.anonymous"
              class="truncate text-caption text-muted"
              data-testid="sb-state"
              >{{ row.original.state }}</span
            >
          </div>
        </template>
      </DsDataTable>

      <UAlert color="neutral" variant="soft" icon="i-ph-lightbulb-duotone" data-testid="sb-tip">
        <template #description>
          <strong>{{ COPY.tipLabel }}</strong> {{ COPY.tip }}
        </template>
      </UAlert>
    </template>
  </DsPage>
</template>
