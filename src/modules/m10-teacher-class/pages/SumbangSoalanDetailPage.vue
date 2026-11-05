<script setup lang="ts">
/**
 * S23 `/guru/soalan/:id` "Detail Soalan" (M10-T6; FR-M10-107; FN-M10-7.3.1–7.3.3): chips subject /
 * source / "Tahap {n}" / type, the question and its image, options "A)" … "D)" (correct highlighted),
 * "Penerangan" and "Statistik". A question that is not own or unknown is the standard 404 (BR-M10-01). The status chip, the "Sebab: {reason}" of a rejected item and "Edit Soalan" (editable only) follow FR-GUR-44-10.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import {
  DsArt3D,
  DsBackLink,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatRow,
  DsStatusBadge,
  type StatItem,
} from '@/ds'

import { fetchContributedQuestion } from '../api/guru'
import {
  COPY,
  difficultyStars,
  difficultyWord,
  isLoadableImage,
  OPTION_LETTERS,
  rejectionLine,
  STATUS_BADGE,
  STATUS_WORDS,
} from '../components/soalan/lib'

const props = defineProps<{ id: number }>()

const { data, error, reload } = useApi(
  (signal) => fetchContributedQuestion(props.id, { signal }),
  () => props.id,
)

const usageStats = computed<StatItem[]>(() => {
  const u = data.value?.usage
  if (!u) return []
  return [
    {
      key: 'attempts',
      label: 'Kali Digunakan',
      value: u.attempts,
      icon: 'repeat',
      accent: 'action',
    },
    { key: 'correct', label: 'Jawab Betul', value: u.correct, icon: 'check-circle', accent: 'win' },
    {
      key: 'accuracy',
      label: 'Ketepatan',
      value: `${String(u.accuracy)}%`,
      icon: 'target',
      accent: 'heat',
    },
  ]
})

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="soalan-detail-page">
    <DsLoadError
      v-if="error && !notFound"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="detail-error"
      @retry="reload"
    />
    <div v-else-if="!data && !notFound" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <template v-else-if="data">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <DsBackLink to="/guru/soalan" data-testid="detail-back" />
        <UButton
          v-if="data.editable"
          :to="`/guru/soalan/${String(data.id)}/edit`"
          icon="i-ph-pencil-simple-duotone"
          class="min-h-11"
          data-testid="detail-edit"
          >Edit Soalan</UButton
        >
      </div>

      <DsPanel data-testid="detail-card">
        <div class="mb-3 flex flex-wrap gap-2">
          <UBadge color="neutral" variant="subtle" data-testid="detail-subject">{{
            data.subjectName
          }}</UBadge>
          <UBadge v-if="data.source" color="neutral" variant="subtle" data-testid="detail-source">{{
            data.source
          }}</UBadge>
          <UBadge
            color="neutral"
            variant="subtle"
            :aria-label="`Kesukaran: ${difficultyWord(data.difficultyLevel)}`"
            :title="difficultyWord(data.difficultyLevel)"
            data-testid="detail-tahap"
            >{{ difficultyStars(data.difficultyLevel) }}</UBadge
          >
          <UBadge v-if="data.tp !== null" color="neutral" variant="subtle" data-testid="detail-tp"
            >TP {{ data.tp }}</UBadge
          >
          <DsStatusBadge
            :status="STATUS_BADGE[data.status]"
            :label="STATUS_WORDS[data.status]"
            :emphasis="data.status === 'rejected' ? 'strong' : 'soft'"
            data-testid="detail-status"
          />
          <UBadge color="primary" variant="subtle" data-testid="detail-type">{{
            data.questionType
          }}</UBadge>
        </div>
        <p
          v-if="data.status === 'rejected' && data.rejectionReason"
          class="mb-3 min-w-0 text-body break-words text-error"
          data-testid="detail-reason"
        >
          {{ rejectionLine(data.rejectionReason) }}
        </p>
        <p
          class="min-w-0 text-body break-words whitespace-pre-wrap text-default"
          data-testid="detail-text"
        >
          {{ data.questionText }}
        </p>
        <DsArt3D
          v-if="isLoadableImage(data.questionImage)"
          variant="plain"
          :src="data.questionImage"
          alt="Imej soalan"
          class="mt-3 max-h-64 object-contain"
        />
        <ul v-if="data.options" class="mt-4 flex flex-col gap-2">
          <li
            v-for="(opt, i) in data.options"
            :key="i"
            class="min-w-0"
            :data-correct="data.correctAnswer === i ? 'true' : 'false'"
            data-testid="detail-option"
          >
            <DsPanel tone="inset">
              <div class="flex min-w-0 items-center justify-between gap-2">
                <span class="min-w-0 text-body break-words text-default"
                  ><strong>{{ OPTION_LETTERS[i] }})</strong> {{ opt }}</span
                >
                <UBadge
                  v-if="data.correctAnswer === i"
                  color="success"
                  variant="subtle"
                  icon="i-ph-check-circle-duotone"
                  >Betul</UBadge
                >
              </div>
            </DsPanel>
          </li>
        </ul>
      </DsPanel>

      <DsPanel v-if="data.explanation" data-testid="detail-explanation">
        <h2 class="mb-1 text-subheading text-highlighted">Penerangan</h2>
        <p class="min-w-0 text-body break-words whitespace-pre-wrap text-default">
          {{ data.explanation }}
        </p>
      </DsPanel>

      <section data-testid="detail-stats">
        <h2 class="mb-3 text-subheading text-highlighted">Statistik</h2>
        <DsStatRow :items="usageStats" prefix="stat" :cols="3" />
      </section>
    </template>
  </DsPage>
</template>
