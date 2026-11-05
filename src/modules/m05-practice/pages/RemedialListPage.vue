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
  DsHeading,
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
  deltaTone,
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
  void reload()
  void suggestions.reload()
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
      <DsText variant="title" as="span" aria-hidden="true">🔬</DsText>
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
          <UButton to="/practice" size="xl" data-testid="remedial-empty-cta">Terus Berlatih →</UButton>
        </template>
      </DsEmptyState>

      <DsStack v-else gap="xl">
        <DsStack v-if="completed.length > 0" as="ul" gap="sm" data-testid="remedial-set-list">
          <li v-for="c in completed" :key="`${c.subjectCode}-${String(c.setNo)}`">
            <UCard :data-testid="`remedial-set-${c.subjectCode}-${String(c.setNo)}`">
              <DsCluster justify="between" align="center" stack-below="sm" gap="md">
                <DsStack gap="xs">
                  <DsCluster gap="sm">
                    <DsHeading :level="2" variant="subheading" data-testid="remedial-set-title"
                      >Remedial Set {{ c.setNo }} — {{ c.subjectName }}</DsHeading
                    >
                    <UBadge
                      color="success"
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
                        >(<DsText
                          as="span"
                          variant="caption"
                          :tone="deltaTone(c.delta)"
                          :data-tone="deltaTone(c.delta)"
                          data-testid="remedial-set-delta"
                          >{{ deltaLabel(c.delta) }}</DsText
                        >)</template
                      ></DsText
                    >
                  </DsCluster>
                  <DsCluster>
                    <UBadge color="neutral" variant="subtle" data-testid="remedial-set-chip"
                      >{{ c.subjectName }} (Umum)</UBadge
                    >
                  </DsCluster>
                </DsStack>
                <UButton
                  :to="`/practice/revision/${encodeURIComponent(c.subjectCode)}`"
                  size="xl"
                  data-testid="remedial-set-redo"
                  >🎯 Ulang Latihan →</UButton
                >
              </DsCluster>
            </UCard>
          </li>
        </DsStack>

        <DsSection v-if="needed.length > 0" title="Perlu Pemulihan Sekarang">
          <DsStack as="ul" gap="sm" data-testid="remedial-needed-list">
            <li v-for="n in needed" :key="n.subjectCode">
              <UCard :data-testid="`remedial-needed-${n.subjectCode}`">
                <DsCluster justify="between" align="center" stack-below="sm" gap="md">
                  <DsStack gap="xs">
                    <DsCluster gap="sm">
                      <DsHeading :level="3" variant="subheading" data-testid="remedial-needed-subject">{{
                        n.subjectName
                      }}</DsHeading>
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
                    <DsCluster>
                      <UBadge color="neutral" variant="subtle" data-testid="remedial-needed-chip"
                        >{{ n.subjectName }} (Umum)</UBadge
                      >
                    </DsCluster>
                  </DsStack>
                  <UButton
                    :to="`/practice/revision/${encodeURIComponent(n.subjectCode)}`"
                    size="xl"
                    data-testid="remedial-needed-start"
                    >🎯 Latihan Pemulihan →</UButton
                  >
                </DsCluster>
              </UCard>
            </li>
          </DsStack>
        </DsSection>

        <DsSection v-if="items.length > 0" title="Ujian Daripada Guru">
          <DsStack as="ul" gap="sm" data-testid="remedial-list">
            <li v-for="t in items" :key="t.id">
              <UCard :data-testid="`remedial-card-${String(t.id)}`">
                <DsCluster justify="between" align="center" stack-below="sm" gap="md">
                  <DsCluster align="start" gap="sm" :wrap="false">
                    <DsIconChip icon="lifebuoy" accent="heat" size="lg" />
                    <DsStack gap="xs">
                      <DsCluster gap="sm">
                        <DsHeading :level="3" variant="subheading" data-testid="remedial-subject">{{
                          t.subjectName
                        }}</DsHeading>
                        <UBadge
                          :color="remedialChip(t.status).color"
                          variant="solid"
                          :icon="t.status === 'completed' ? 'i-ph-check-circle-bold' : 'i-ph-clock-bold'"
                          data-testid="remedial-status"
                          >{{ remedialChip(t.status).label }}</UBadge
                        >
                      </DsCluster>
                      <DsText variant="body" data-testid="remedial-count"
                        >{{ t.totalQuestions }} soalan</DsText
                      >
                      <DsText variant="caption" tone="muted" data-testid="remedial-meta"
                        >Daripada: {{ t.teacherName }} · {{ formatDate(t.createdAt) }}</DsText
                      >
                    </DsStack>
                  </DsCluster>
                  <UButton
                    v-if="t.status === 'active'"
                    :to="`/remedial/${String(t.id)}`"
                    size="xl"
                    data-testid="remedial-start"
                    >Mula Ujian</UButton
                  >
                </DsCluster>
              </UCard>
            </li>
          </DsStack>
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
