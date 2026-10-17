<script setup lang="ts">
/**
 * S23 `/guru/soalan/:id` "Detail Soalan" (M10-T6; FR-M10-107; FN-M10-7.3.1–7.3.3): chips subject /
 * source / "Tahap {n}" / type, the question and its image, options "A)" … "D)" (correct highlighted),
 * "Penerangan" and "Statistik". A question that is not own or unknown is the standard 404 (BR-M10-01).
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsPage, DsStatTile } from '@/ds'

import { fetchContributedQuestion } from '../api/guru'
import { COPY, isLoadableImage, OPTION_LETTERS } from '../components/soalan/lib'
import PreviewImage from '../components/native/PreviewImage.vue'

const props = defineProps<{ id: number }>()

const { data, error, reload } = useApi(
  (signal) => fetchContributedQuestion(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="soalan-detail-page">
    <UCard v-if="error && !notFound" data-testid="detail-error">
      <UAlert
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="COPY.loadFailed"
        role="alert"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        class="mt-3 min-h-11"
        data-testid="detail-retry"
        @click="reload"
        >{{ COPY.retry }}</UButton
      >
    </UCard>
    <div v-else-if="!data && !notFound" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-10 w-full" />
      <USkeleton class="h-48 w-full" />
    </div>

    <template v-else-if="data">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          to="/guru/soalan"
          color="neutral"
          variant="ghost"
          icon="i-ph-arrow-left"
          class="min-h-11"
          data-testid="detail-back"
          >Kembali</UButton
        >
        <UButton
          :to="`/guru/soalan/${String(data.id)}/edit`"
          icon="i-ph-pencil-simple-duotone"
          class="min-h-11"
          data-testid="detail-edit"
          >Edit Soalan</UButton
        >
      </div>

      <UCard data-testid="detail-card">
        <div class="mb-3 flex flex-wrap gap-2">
          <UBadge color="neutral" variant="subtle" data-testid="detail-subject">{{
            data.subjectName
          }}</UBadge>
          <UBadge v-if="data.source" color="neutral" variant="subtle" data-testid="detail-source">{{
            data.source
          }}</UBadge>
          <UBadge color="neutral" variant="subtle" data-testid="detail-tahap"
            >Tahap {{ data.difficultyLevel }}</UBadge
          >
          <UBadge color="primary" variant="subtle" data-testid="detail-type">{{
            data.questionType
          }}</UBadge>
        </div>
        <p
          class="min-w-0 text-body break-words whitespace-pre-wrap text-default"
          data-testid="detail-text"
        >
          {{ data.questionText }}
        </p>
        <PreviewImage
          v-if="isLoadableImage(data.questionImage)"
          :src="data.questionImage"
          alt="Imej soalan"
          class="mt-3"
        />
        <ul v-if="data.options" class="mt-4 flex flex-col gap-2">
          <li
            v-for="(opt, i) in data.options"
            :key="i"
            class="min-w-0"
            :data-correct="data.correctAnswer === i ? 'true' : 'false'"
            data-testid="detail-option"
          >
            <UCard
              variant="subtle"
              :ui="{ body: 'flex min-w-0 items-center justify-between gap-2 p-3 sm:p-3' }"
            >
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
            </UCard>
          </li>
        </ul>
      </UCard>

      <UCard v-if="data.explanation" data-testid="detail-explanation">
        <h2 class="mb-1 text-subheading text-highlighted">Penerangan</h2>
        <p class="min-w-0 text-body break-words whitespace-pre-wrap text-default">
          {{ data.explanation }}
        </p>
      </UCard>

      <section data-testid="detail-stats">
        <h2 class="mb-3 text-subheading text-highlighted">Statistik</h2>
        <div class="grid grid-cols-3 gap-3">
          <div data-testid="stat-attempts">
            <DsStatTile
              :value="data.usage.attempts"
              unit="Kali Digunakan"
              icon="i-ph-repeat-duotone"
            />
          </div>
          <div data-testid="stat-correct">
            <DsStatTile
              :value="data.usage.correct"
              unit="Jawab Betul"
              icon="i-ph-check-circle-duotone"
            />
          </div>
          <div data-testid="stat-accuracy">
            <DsStatTile
              :value="`${data.usage.accuracy}%`"
              unit="Ketepatan"
              icon="i-ph-target-duotone"
            />
          </div>
        </div>
      </section>
    </template>
  </DsPage>
</template>
