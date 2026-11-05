<script setup lang="ts">
/**
 * S13 `/remedial/saya` "Ujian Remedial Saya" (M05-T7; FR-M05-115, FR-M05-140, DV-M05-01; S5-T07
 * R1-MUR-12). Three sections in order (FR-MUR-12-1): completed drill sets, "Perlu Pemulihan Sekarang"
 * cards (`GET /practice/remedial-suggestions`), then the teacher-assigned tests (one card per test:
 * subject, "{n} soalan", "Daripada: {teacher}", date, status chip, "Mula Ujian" → Q4). With all three
 * empty: "Tiada topik lemah!" (AC-MUR-12-3, FR-MUR-12-8). The drill is `/practice/revision/:code`.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsCluster,
  DsEmptyState,
  DsIconChip,
  DsLoadError,
  DsPage,
  DsProgress,
  DsSection,
  DsStack,
  DsText,
} from '@/ds'
import { formatDate } from '@/lib/time'

import { fetchRemedialSuggestions, fetchRemedialTests } from '../api/practice'
import {
  accuracyBarWidth,
  deltaColorClass,
  deltaLabel,
  pctOrDash,
  remedialChip,
} from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchRemedialTests({ signal }))
const suggestions = useApi((signal) => fetchRemedialSuggestions({ signal }))
const items = computed(() => data.value?.data ?? [])
const completed = computed(() => suggestions.data.value?.completed ?? [])
const needed = computed(() => suggestions.data.value?.needed ?? [])
const ready = computed(() => !!data.value && !!suggestions.data.value)
const failed = computed(() => !!error.value || !!suggestions.error.value)
const isEmpty = computed(
  () => completed.value.length === 0 && needed.value.length === 0 && items.value.length === 0,
)

function retry(): void {
  reload()
  suggestions.reload()
}
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

    <template v-if="ready">
      <DsEmptyState
        v-if="isEmpty"
        friend="aiman"
        title="Tiada topik lemah!"
        description="Prestasi anda baik merentas semua subjek. Teruskan!"
        data-testid="remedial-empty"
      >
        <template #actions>
          <UButton to="/practice" size="lg" class="min-h-11" data-testid="remedial-empty-cta"
            >Terus Berlatih →</UButton
          >
        </template>
      </DsEmptyState>

      <DsStack v-else gap="xl">
        <ul v-if="completed.length > 0" class="flex flex-col gap-3" data-testid="remedial-set-list">
          <li
            v-for="c in completed"
            :key="`${c.subjectCode}-${String(c.setNo)}`"
            class="min-w-0"
          >
            <UCard :data-testid="`remedial-set-${c.subjectCode}-${String(c.setNo)}`">
              <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <DsStack gap="xs" class="min-w-0">
                  <DsCluster gap="sm">
                    <h2
                      class="text-subheading break-words text-highlighted"
                      data-testid="remedial-set-title"
                    >
                      Remedial Set {{ c.setNo }} — {{ c.subjectName }}
                    </h2>
                    <UBadge
                      :color="remedialChip('completed').color"
                      variant="solid"
                      icon="i-ph-check-circle-bold"
                      data-testid="remedial-set-status"
                      >Selesai</UBadge
                    >
                  </DsCluster>
                  <DsText variant="body" data-testid="remedial-set-count"
                    >{{ c.questionCount }} soalan</DsText
                  >
                  <DsCluster gap="md">
                    <DsText variant="caption" tone="muted" data-testid="remedial-set-before"
                      >Sebelum: {{ pctOrDash(c.before) }}</DsText
                    >
                    <DsText variant="caption" tone="muted" data-testid="remedial-set-after"
                      >Selepas: {{ pctOrDash(c.after) }}
                      <template v-if="c.delta !== null"
                        >(<span
                          :class="deltaColorClass(c.delta)"
                          :data-tone="c.delta < 0 ? 'error' : 'success'"
                          data-testid="remedial-set-delta"
                          >{{ deltaLabel(c.delta) }}</span
                        >)</template
                      ></DsText
                    >
                  </DsCluster>
                  <div>
                    <UBadge color="neutral" variant="subtle" data-testid="remedial-set-chip"
                      >{{ c.subjectName }} (Umum)</UBadge
                    >
                  </div>
                </DsStack>
                <UButton
                  :to="`/practice/revision/${encodeURIComponent(c.subjectCode)}`"
                  size="lg"
                  class="min-h-11 shrink-0 justify-center"
                  data-testid="remedial-set-redo"
                  >🎯 Ulang Latihan →</UButton
                >
              </div>
            </UCard>
          </li>
        </ul>

        <DsSection v-if="needed.length > 0" title="Perlu Pemulihan Sekarang">
          <ul class="flex flex-col gap-3" data-testid="remedial-needed-list">
            <li v-for="n in needed" :key="n.subjectCode" class="min-w-0">
              <UCard :data-testid="`remedial-needed-${n.subjectCode}`">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <DsStack gap="xs" class="min-w-0 flex-1">
                    <DsCluster gap="sm">
                      <h3
                        class="text-subheading break-words text-highlighted"
                        data-testid="remedial-needed-subject"
                      >
                        {{ n.subjectName }}
                      </h3>
                      <UBadge
                        color="error"
                        variant="solid"
                        icon="i-ph-warning-bold"
                        data-testid="remedial-needed-status"
                        >Perlu Pemulihan</UBadge
                      >
                    </DsCluster>
                    <DsText variant="body" data-testid="remedial-needed-count"
                      >{{ n.answered }} soalan</DsText
                    >
                    <DsCluster gap="md">
                      <DsText variant="caption" tone="muted" data-testid="remedial-needed-accuracy"
                        >Ketepatan: {{ n.accuracy }}%</DsText
                      >
                      <DsText variant="caption" tone="muted" data-testid="remedial-needed-target"
                        >Sasaran: {{ n.target }}%</DsText
                      >
                    </DsCluster>
                    <DsProgress
                      :value="accuracyBarWidth(n.accuracy, n.target)"
                      :show-value="false"
                      tone="error"
                      :aria-label="`Ketepatan ${String(n.accuracy)}% daripada sasaran ${String(n.target)}%`"
                      data-testid="remedial-needed-bar"
                      :data-width="accuracyBarWidth(n.accuracy, n.target)"
                    />
                    <div>
                      <UBadge color="neutral" variant="subtle" data-testid="remedial-needed-chip"
                        >{{ n.subjectName }} (Umum)</UBadge
                      >
                    </div>
                  </DsStack>
                  <UButton
                    :to="`/practice/revision/${encodeURIComponent(n.subjectCode)}`"
                    size="lg"
                    class="min-h-11 shrink-0 justify-center"
                    data-testid="remedial-needed-start"
                    >🎯 Latihan Pemulihan →</UButton
                  >
                </div>
              </UCard>
            </li>
          </ul>
        </DsSection>

        <DsSection v-if="items.length > 0" title="Ujian Daripada Guru">
          <ul class="flex flex-col gap-3" data-testid="remedial-list">
            <li v-for="t in items" :key="t.id" class="min-w-0">
              <UCard :data-testid="`remedial-card-${String(t.id)}`">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div class="flex min-w-0 items-start gap-3">
                    <DsIconChip icon="lifebuoy" accent="heat" size="lg" />
                    <div class="flex min-w-0 flex-col gap-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <h3
                          class="text-subheading break-words text-highlighted"
                          data-testid="remedial-subject"
                        >
                          {{ t.subjectName }}
                        </h3>
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
        </DsSection>
      </DsStack>
    </template>

    <DsLoadError
      v-else-if="failed"
      :message="LOAD_ERROR"
      retry-testid="remedial-retry"
      testid="remedial-error"
      @retry="retry()"
    />
  </DsPage>
</template>
