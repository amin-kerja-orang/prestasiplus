<script setup lang="ts">
/**
 * `/sekolah-bersaing` (R1-AS-45, FR-AS-45-1..6, API-AS-14): the live board of the top schools by
 * average session accuracy, in the rank order of the API, with no week of its own. Ranks 1 to 3 are
 * medals; the accuracy is a whole-number pill whose colour follows the rounded value, so 69.6 shows a
 * green "70%". `DsDataTable` gives the table from 768 px and cards below it; the card slot carries the
 * same pill and hides no field (FR-AS-45-5). Text is at least 14 px at 375, hence the body type on the
 * card labels and the large pill. An empty array is the empty state (FR-AS-45-3).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsDataTable, DsEmptyState, DsPage, DsLoadError } from '@/ds'
import { formatCount, roundHalfUp } from '@/lib/number'

import { fetchSekolahBersaing } from '../api'
import { SB_COPY as COPY, SB_MEDALS } from '../components/sekolah-bersaing/copy'
import { LOAD_COPY } from '../components/competition/copy'

const view = useApi((signal) => fetchSekolahBersaing({ signal }))
const data = computed(() => view.data.value)

interface Row extends Record<string, unknown> {
  rank: number
  rankText: string
  school: string
  state: string
  accuracyText: string
  accuracyColor: 'success' | 'warning' | 'error'
  pupilsText: string
}

/** FR-AS-45-2: the colour of the value shown, not of the decimal on the wire. */
function accuracyColor(rounded: number): Row['accuracyColor'] {
  if (rounded >= 70) return 'success'
  return rounded >= 50 ? 'warning' : 'error'
}

const rows = computed<Row[]>(() =>
  (data.value ?? []).map((r) => {
    const rounded = roundHalfUp(r.accuracy)
    return {
      rank: r.rank,
      rankText: SB_MEDALS[r.rank - 1] ?? String(r.rank),
      school: r.school,
      state: r.state,
      accuracyText: `${String(rounded)}%`,
      accuracyColor: accuracyColor(rounded),
      pupilsText: formatCount(r.pupils),
    }
  }),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'rankText', header: COPY.headers[0] },
  { accessorKey: 'school', header: COPY.headers[1] },
  { accessorKey: 'state', header: COPY.headers[2] },
  { accessorKey: 'accuracyText', header: COPY.headers[3] },
  { accessorKey: 'pupilsText', header: COPY.headers[4] },
]
</script>

<template>
  <DsPage :title="COPY.heading" :subtitle="COPY.sub" data-testid="m16-sekolah-bersaing-page">
    <p class="text-label text-muted" data-testid="sb-label">{{ COPY.label }}</p>

    <DsLoadError v-if="view.error.value" :message="LOAD_COPY.failed" testid="m16-load-error" retry-testid="m16-retry" @retry="view.reload()" />
    <USkeleton v-else-if="!data" class="h-48 w-full" data-testid="sb-loading" />

    <DsEmptyState
      v-else-if="data.length === 0"
      :title="COPY.emptyTitle"
      :description="COPY.emptyHint"
      icon="chart-bar"
      data-testid="sb-empty"
    />

    <DsDataTable
      v-else
      :data="rows"
      :columns="columns"
      :page-size="Math.max(rows.length, 1)"
      :caption="COPY.label"
      data-testid="sb-table"
    >
      <template #rankText-cell="{ row }">
        <span data-testid="sb-rank">{{ row.original.rankText }}</span>
      </template>
      <template #school-cell="{ row }">
        <span :data-rank="row.original.rank" data-testid="sb-row">
          <span data-testid="sb-school">{{ row.original.school }}</span>
        </span>
      </template>
      <template #state-cell="{ row }">
        <span data-testid="sb-state">{{ row.original.state }}</span>
      </template>
      <template #accuracyText-cell="{ row }">
        <UBadge :color="row.original.accuracyColor" variant="soft" size="lg" data-testid="sb-accuracy">{{
          row.original.accuracyText
        }}</UBadge>
      </template>
      <template #pupilsText-cell="{ row }">
        <span data-testid="sb-pupils">{{ row.original.pupilsText }}</span>
      </template>

      <template #card="{ row }">
        <div class="flex min-w-0 flex-col gap-1" :data-rank="row.rank" data-testid="sb-row">
          <p class="text-label text-highlighted">
            <span data-testid="sb-rank">{{ row.rankText }}</span>
            {{ ' ' }}
            <span data-testid="sb-school">{{ row.school }}</span>
          </p>
          <dl class="grid grid-cols-2 gap-1">
            <div class="min-w-0">
              <dt class="text-body text-muted">{{ COPY.headers[2] }}</dt>
              <dd data-testid="sb-state">{{ row.state }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-body text-muted">{{ COPY.headers[3] }}</dt>
              <dd>
                <UBadge :color="row.accuracyColor" variant="soft" size="lg" data-testid="sb-accuracy">{{
                  row.accuracyText
                }}</UBadge>
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-body text-muted">{{ COPY.headers[4] }}</dt>
              <dd data-testid="sb-pupils">{{ row.pupilsText }}</dd>
            </div>
          </dl>
        </div>
      </template>
    </DsDataTable>
  </DsPage>
</template>
