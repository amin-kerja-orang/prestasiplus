<script setup lang="ts">
/**
 * Q4 read-only preview for the test's teacher and an admin (FR-M05-141, SRS §8.3 "Q4 teacher/admin
 * preview", PROPOSED; BR-32), restyled for v2 (staff density, no win screen). Loads
 * `GET /api/remedial-tests/:id`: the banner "Pratonton — jawapan tidak direkodkan.", then per
 * question the text, options A–D and the correct option in green with a tick. No timer, no
 * buttons, nothing is written. Any other viewer gets a 404 from the API, which is the global 404
 * page. The header card (subject, student, counts) is INFERRED.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'

import { fetchRemedialPreview } from '../../api/practice'
import LoadError from '../quiz/LoadError.vue'

const props = defineProps<{ id: number }>()

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi(
  (signal) => fetchRemedialPreview(props.id, { signal }),
  [() => props.id],
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)
</script>

<template>
  <div class="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-4" data-testid="remedial-preview">
    <template v-if="data">
      <UButton
        to="/remedial/saya"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-start"
        data-testid="preview-back"
        >Kembali</UButton
      >

      <UCard data-testid="preview-header">
        <div class="flex flex-col gap-1">
          <h1 class="text-heading break-words text-highlighted" data-testid="preview-title">
            Ujian Remedial — {{ data.subjectName }}
          </h1>
          <p class="text-body text-muted" data-testid="preview-meta">
            {{ data.studentName }} · {{ data.totalQuestions }} soalan
          </p>
        </div>
      </UCard>

      <UAlert
        color="neutral"
        variant="soft"
        icon="i-ph-eye-duotone"
        title="Pratonton — jawapan tidak direkodkan."
        data-testid="preview-banner"
      />

      <UCard
        v-for="(q, i) in data.questions"
        :key="q.id"
        :data-testid="`preview-q-${String(i + 1)}`"
      >
        <article class="flex flex-col gap-3">
          <p class="text-caption text-muted">Soalan {{ i + 1 }}</p>
          <p
            class="text-body break-words whitespace-pre-line text-highlighted"
            :dir="q.textDirection"
            data-testid="preview-text"
          >
            {{ q.questionText }}
          </p>
          <ul class="flex flex-col gap-2">
            <li
              v-for="o in q.options"
              :key="o.id"
              class="flex items-start gap-3 text-body text-default"
              :data-correct="o.id === q.correctOptionId ? 'true' : 'false'"
              data-testid="preview-option"
            >
              <UBadge
                :color="o.id === q.correctOptionId ? 'success' : 'neutral'"
                :variant="o.id === q.correctOptionId ? 'solid' : 'soft'"
                >{{ o.label }}.</UBadge
              >
              <span class="min-w-0 flex-1 break-words">{{ o.text }}</span>
              <template v-if="o.id === q.correctOptionId">
                <UIcon
                  name="i-ph-check-circle-duotone"
                  class="size-5 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span class="sr-only">(jawapan betul)</span>
              </template>
            </li>
          </ul>
        </article>
      </UCard>
    </template>

    <LoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      retry-testid="preview-retry"
      data-testid="preview-error"
      @retry="reload()"
    />
  </div>
</template>
