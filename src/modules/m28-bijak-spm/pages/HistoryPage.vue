<script setup lang="ts">
/** Sejarah Bijak SPM (US-18): every sitting, newest first, with a link to its Semakan or to resume it. */
import { computed } from 'vue'

import {
  DsEmptyState,
  DsStatTile,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsGrid,
  DsCluster,
  DsText,
} from '@/ds'
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
    <DsStack v-else-if="!rows" gap="sm" aria-busy="true">
      <USkeleton v-for="n in 3" :key="n" class="h-20 w-full" />
    </DsStack>
    <DsEmptyState
      v-else-if="!rows.length"
      title="Belum ada percubaan"
      description="Mulakan kertas pertama anda di Bijak SPM."
      icon="i-ph-files"
      data-testid="history-empty"
    />
    <template v-else>
      <DsGrid :cols="3" gap="sm" as="ul" aria-label="Ringkasan" data-testid="history-summary">
        <li>
          <DsStatTile :value="rows.length" unit="Percubaan" icon="i-ph-files" accent="action" />
        </li>
        <li>
          <DsStatTile :value="`${average}%`" unit="Purata" icon="chart-line-up" accent="win" />
        </li>
        <li><DsStatTile :value="coins" unit="Koin" art="coin" /></li>
      </DsGrid>
      <DsStack as="ul" gap="sm" data-testid="history-list">
        <li v-for="r in rows" :key="r.attemptId">
          <DsPanel :data-testid="`history-${r.attemptId}`">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <DsStack gap="xs">
                <DsText variant="body" tone="highlighted">{{ r.title }}</DsText>
                <DsText variant="caption">
                  {{ formatDateTime(r.startedAt) }} · {{ formatClock(r.durationSeconds) }}
                </DsText>
                <DsCluster gap="xs" align="stretch">
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
                </DsCluster>
              </DsStack>
              <DsCluster :wrap="false">
                <DsText
                  v-if="r.max !== undefined"
                  variant="heading"
                  as="span"
                  tabular
                  data-testid="history-score"
                  >{{ r.score }} / {{ r.max }}</DsText
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
              </DsCluster>
            </div>
          </DsPanel>
        </li>
      </DsStack>
    </template>
  </DsPage>
</template>
