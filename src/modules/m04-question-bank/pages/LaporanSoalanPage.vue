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
import { DsPage, DsPanel, DsStatTile } from '@/ds'
import { diffForHumans } from '@/lib/time'

import ErrorBox from '../components/ErrorBox.vue'
import { fetchMyReports, type ReportDisplayStatus } from '../api/reports'
import { DISPLAY_STATUS_LABEL } from '../lib/report-reasons'
import { LOAD_ERROR } from '../lib/ui-errors'

const { data, error, reload } = useApi((signal) => fetchMyReports({ signal }))

const rows = computed(() => data.value?.data ?? [])
const counts = computed(() => data.value?.meta.counts ?? null)
const firstLoad = computed(() => data.value === null && error.value === null)

const COUNTERS = [
  { key: 'all', label: 'Jumlah', icon: 'i-ph-stack', accent: 'action' },
  { key: 'pending', label: 'Menunggu', icon: 'i-ph-hourglass', accent: 'trial' },
  { key: 'reviewed', label: 'Disemak', icon: 'i-ph-eye', accent: 'friend' },
  { key: 'fixed', label: 'Diperbaiki', icon: 'i-ph-check-circle', accent: 'win' },
  { key: 'dismissed', label: 'Ditolak', icon: 'i-ph-x-circle', accent: 'heat' },
] as const

const STATUS_COLOR: Record<
  ReportDisplayStatus,
  'warning' | 'info' | 'success' | 'error' | 'neutral'
> = {
  pending: 'warning',
  reviewed: 'info',
  fixed: 'success',
  removed: 'error',
  dismissed: 'neutral',
}
</script>

<template>
  <DsPage data-testid="my-reports-page">
    <section
      class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5"
      data-testid="my-reports-counters"
    >
      <template v-if="counts">
        <DsStatTile
          v-for="c in COUNTERS"
          :key="c.key"
          :value="counts[c.key]"
          :unit="c.label"
          :icon="c.icon"
          :accent="c.accent"
          :data-testid="`my-reports-count-${c.key}`"
        />
      </template>
      <USkeleton v-for="n in COUNTERS" v-else :key="n.key" class="h-24 w-full" />
    </section>

    <div v-if="error" class="flex flex-col gap-3" data-testid="my-reports-error">
      <ErrorBox :messages="LOAD_ERROR" />
      <div>
        <UButton type="button" data-testid="my-reports-retry" @click="reload()">
          Cuba Semula
        </UButton>
      </div>
    </div>

    <USkeleton v-else-if="firstLoad" class="h-40 w-full" data-testid="my-reports-skeleton" />

    <DsPanel v-else-if="rows.length === 0" data-testid="my-reports-empty">
      <div class="flex flex-col items-center gap-2 p-8 text-center">
        <div class="text-title" aria-hidden="true">📋</div>
        <h3 class="text-subheading text-highlighted">Tiada Laporan</h3>
        <p class="text-body text-muted">Anda belum menghantar sebarang laporan soalan.</p>
      </div>
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
              <UBadge
                :color="STATUS_COLOR[r.displayStatus]"
                variant="subtle"
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
            <div v-if="r.adminNotes" class="rounded-chip bg-elevated p-3" data-testid="my-report-notes">
              <p class="flex items-center gap-2 text-label text-highlighted">
                <UIcon name="i-ph-note" class="size-4" aria-hidden="true" />
                Status tindakan admin:
              </p>
              <p class="mt-1 text-body break-words whitespace-pre-line text-default">
                {{ r.adminNotes }}
              </p>
            </div>
          </div>
        </DsPanel>
      </li>
    </ul>
  </DsPage>
</template>
