<script setup lang="ts">
/** Sejarah Bijak SPM (US-18): every sitting, newest first, with a link to its Semakan or to resume it. */
import { computed } from 'vue'

import { DsEmptyState, DsStatTile, DsLoadError, DsPage, DsPanel } from '@/ds'
import { useApi } from '@/composables/useApi'

import { formatClock } from '../domain/paper-model'
import type { AttemptStatus } from '../domain/types'
import { formatDateTime, useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

useLearnerTheme()
const user = useBijakUser()
const server = bijakServer()
const { data: rows, error, reload } = useApi(() => server.history(user.value))

const STATUS: Record<AttemptStatus, string> = {
  in_progress: 'Sedang dijawab',
  submitted: 'Dihantar',
  auto_submitted: 'Dihantar automatik',
  abandoned: 'Ditinggalkan',
}

const done = computed(() => (rows.value ?? []).filter((r) => r.max !== undefined && r.max > 0))
const average = computed(() =>
  done.value.length
    ? Math.round(
        done.value.reduce((n, r) => n + ((r.score ?? 0) / (r.max ?? 1)) * 100, 0) /
          done.value.length,
      )
    : 0,
)
const coins = computed(() => done.value.reduce((n, r) => n + (r.score ?? 0) * 2, 0))
</script>

<template>
  <DsPage
    title="Sejarah Bijak SPM"
    back-to="/spm/bijak"
    back-label="Bijak SPM"
    data-testid="bijak-history"
  >

    <DsLoadError v-if="error" message="Sejarah tidak dapat dimuatkan." @retry="reload" />
    <div v-else-if="!rows" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
    </div>
    <DsEmptyState
      v-else-if="!rows.length"
      title="Belum ada percubaan"
      description="Mulakan kertas pertama anda di Bijak SPM."
      icon="i-ph-files"
      data-testid="history-empty"
    />
    <template v-else>
      <ul class="grid grid-cols-3 gap-3" aria-label="Ringkasan" data-testid="history-summary">
        <li><DsStatTile :value="rows.length" unit="Percubaan" icon="i-ph-files" accent="action" /></li>
        <li>
          <DsStatTile
            :value="`${average}%`"
            unit="Purata"
            icon="chart-line-up"
            accent="win"
          />
        </li>
        <li><DsStatTile :value="coins" unit="Koin" art="coin" /></li>
      </ul>
      <ul class="flex flex-col gap-3" data-testid="history-list">
        <li v-for="r in rows" :key="r.attemptId">
          <DsPanel :data-testid="`history-${r.attemptId}`">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-col gap-2">
                <p class="text-body text-highlighted">{{ r.title }}</p>
                <p class="text-caption text-muted">
                  {{ formatDateTime(r.startedAt) }} · {{ formatClock(r.durationSeconds) }}
                </p>
                <div class="flex flex-wrap gap-2">
                  <UBadge color="neutral" variant="subtle">Bijak SPM</UBadge>
                  <UBadge color="neutral" variant="subtle"
                    >{{ r.subjectName }} Kertas {{ r.kertas }}</UBadge
                  >
                  <UBadge color="neutral" variant="subtle">{{
                    r.kind === 'pilihan' ? 'Kertas Pilihan' : 'Jana Kertas'
                  }}</UBadge>
                  <UBadge color="neutral" variant="subtle">{{
                    r.mode === 'exam' ? 'Mod Peperiksaan' : 'Mod Latihan'
                  }}</UBadge>
                  <UBadge
                    :color="r.status === 'in_progress' ? 'info' : 'neutral'"
                    variant="soft"
                    data-testid="history-status"
                    >{{ STATUS[r.status] }}</UBadge
                  >
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  v-if="r.max !== undefined"
                  class="tabular text-heading text-highlighted"
                  data-testid="history-score"
                  >{{ r.score }} / {{ r.max }}</span
                >
                <UButton
                  v-if="r.status === 'in_progress'"
                  :to="{ name: 'm28.bijak.attempt', params: { attemptId: r.attemptId } }"
                  >Sambung</UButton
                >
                <UButton
                  v-else-if="r.max !== undefined"
                  color="neutral"
                  :to="{ name: 'm28.bijak.result', params: { attemptId: r.attemptId } }"
                  >Semakan</UButton
                >
              </div>
            </div>
          </DsPanel>
        </li>
      </ul>
    </template>
  </DsPage>
</template>
