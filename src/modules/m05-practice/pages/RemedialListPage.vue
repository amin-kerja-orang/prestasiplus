<script setup lang="ts">
/**
 * S13 `/remedial/saya` "Ujian Remedial Saya" (M05-T7; FR-M05-115, FR-M05-140, DV-M05-01), restyled
 * for v2 (batch B01). Heading 🔬 + subtitle; with no test the observed empty state 🎯 (friend, good
 * news); otherwise one card per test (PROPOSED layout, §8.3; LS-12): subject, "{n} soalan",
 * "Daripada: {teacher}", date, status chip and, for an active test, "Mula Ujian" → Q4.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsEmptyState, DsIconChip, DsLoadError, DsPage } from '@/ds'
import { formatDate } from '@/lib/time'

import { fetchRemedialTests } from '../api/practice'
import { remedialChip } from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchRemedialTests({ signal }))
const items = computed(() => data.value?.data ?? [])
</script>

<template>
  <DsPage
    title="Ujian Remedial Saya"
    subtitle="Ujian khas untuk topik yang perlu diperbaiki"
    title-testid="remedial-h1"
    data-testid="remedial-page"
  >
    <template #leading>
      <span class="text-title" aria-hidden="true">🔬</span>
    </template>

    <template v-if="data">
      <DsEmptyState
        v-if="items.length === 0"
        friend="aiman"
        title="Tiada ujian remedial. Bagus — teruskan usaha!"
        data-testid="remedial-empty"
      />

      <ul v-else class="flex flex-col gap-3" data-testid="remedial-list">
        <li v-for="t in items" :key="t.id" class="min-w-0">
          <UCard :data-testid="`remedial-card-${String(t.id)}`">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 items-start gap-3">
                <DsIconChip icon="i-ph-lifebuoy-duotone" accent="heat" size="lg" />
                <div class="flex min-w-0 flex-col gap-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2
                      class="text-subheading break-words text-highlighted"
                      data-testid="remedial-subject"
                    >
                      {{ t.subjectName }}
                    </h2>
                    <UBadge
                      :color="remedialChip(t.status).color"
                      variant="solid"
                      :icon="t.status === 'completed' ? 'i-ph-check-circle-bold' : 'i-ph-clock-bold'"
                      data-testid="remedial-status"
                      >{{ remedialChip(t.status).label }}</UBadge
                    >
                  </div>
                  <p class="text-body text-default" data-testid="remedial-count">
                    {{ t.totalQuestions }} soalan
                  </p>
                  <p class="text-caption text-muted" data-testid="remedial-meta">
                    Daripada: {{ t.teacherName }} · {{ formatDate(t.createdAt) }}
                  </p>
                </div>
              </div>
              <UButton
                v-if="t.status === 'active'"
                :to="`/remedial/${String(t.id)}`"
                size="lg"
                class="min-h-14 shrink-0 justify-center"
                data-testid="remedial-start"
                >Mula Ujian</UButton
              >
            </div>
          </UCard>
        </li>
      </ul>
    </template>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="remedial-retry"
      testid="remedial-error"
      @retry="reload()"
    />
  </DsPage>
</template>
