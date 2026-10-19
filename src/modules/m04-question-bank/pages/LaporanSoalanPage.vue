<script setup lang="ts">
/**
 * S13 `/laporan-soalan` "Laporan Soalan Saya" (M04-T6b; FR-M04-82, FN-M04-3.3.1…3.3.3). User shell.
 *
 * - Five counter cards from `GET /api/question-reports/mine` (`meta.counts`): Jumlah, Menunggu, Disemak,
 *   Diperbaiki, Ditolak; 2 per row, 5 from `sm`.
 * - Empty: "📋" / "Tiada Laporan" / "Anda belum menghantar sebarang laporan soalan.".
 * - INFERRED / UNVERIFIED COPY (SRS FR-M04-82, never observed on live): one row per report with
 *   "Soalan #{id}" / "Soalan Struktur #{id}", reason pills, the status badge (labels as S7), the
 *   "Status tindakan admin:" note and the relative time.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsEmptyState, DsLoadError, DsPage, DsPanel, DsStatRow, DsStatusBadge, type StatItem } from '@/ds'
import { diffForHumans } from '@/lib/time'

import { fetchMyReports } from '../api/reports'
import { DISPLAY_STATUS_DS, DISPLAY_STATUS_LABEL } from '../lib/report-reasons'
import { LOAD_ERROR } from '../lib/ui-errors'

const { data, error, reload } = useApi((signal) => fetchMyReports({ signal }))

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const COUNTERS = [
  { key: 'all', label: 'Jumlah', icon: 'stack', accent: 'action' },
  { key: 'pending', label: 'Menunggu', icon: 'hourglass', accent: 'trial' },
  { key: 'reviewed', label: 'Disemak', icon: 'eye', accent: 'friend' },
  { key: 'fixed', label: 'Diperbaiki', icon: 'check-circle', accent: 'win' },
  { key: 'dismissed', label: 'Ditolak', icon: 'x-circle', accent: 'heat' },
] as const

const counters = computed<StatItem[]>(() =>
  COUNTERS.map((c) => ({
    key: c.key,
    label: c.label,
    value: counts.value?.[c.key] ?? 0,
    icon: c.icon,
    accent: c.accent,
  })),
)

</script>

<template>
  <DsPage data-testid="my-reports-page">
    <DsStatRow
      :items="counters"
      :loading="!counts"
      prefix="my-reports-count"
      data-testid="my-reports-counters"
    />

    <DsLoadError
      v-if="error"
      :message="LOAD_ERROR"
      testid="my-reports-error"
      retry-testid="my-reports-retry"
      @retry="reload()"
    />

    <USkeleton v-else-if="firstLoad" class="h-40 w-full" data-testid="my-reports-skeleton" />

    <DsPanel v-else-if="rows.length === 0" data-testid="my-reports-empty">
      <DsEmptyState
        title="Tiada Laporan"
        description="Anda belum menghantar sebarang laporan soalan."
        icon="clipboard-text"
      />
    </DsPanel>

    <ul v-else class="grid grid-cols-1 gap-3 xl:grid-cols-2" data-testid="my-reports-list">
      <li
        v-for="r in rows"
        :key="r.id"
        class="min-w-0"
        :data-testid="`my-report-${String(r.id)}`"
      >
        <DsPanel>
          <div class="flex flex-col gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="text-label text-highlighted" data-testid="my-report-title">
                {{ r.questionType === 'structured' ? 'Soalan Struktur' : 'Soalan' }} #{{
                  r.questionId
                }}
              </h3>
              <DsStatusBadge
                :status="DISPLAY_STATUS_DS[r.displayStatus]"
                :label="DISPLAY_STATUS_LABEL[r.displayStatus]"
                data-testid="my-report-status"
              />
              <span class="text-caption text-muted" data-testid="my-report-time">{{
                diffForHumans(r.createdAt)
              }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge
                v-for="(label, i) in r.reasonLabels"
                :key="`${String(i)}-${label}`"
                color="neutral"
                variant="soft"
                :label="label"
                data-testid="my-report-reason"
              />
            </div>
            <UAlert
              v-if="r.adminNotes"
              color="neutral"
              variant="subtle"
              icon="i-ph-note"
              title="Status tindakan admin:"
              :description="r.adminNotes"
              data-testid="my-report-notes"
            />
          </div>
        </DsPanel>
      </li>
    </ul>
  </DsPage>
</template>
