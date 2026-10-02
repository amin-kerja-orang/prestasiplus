<script setup lang="ts">
/**
 * Q4 read-only preview for the test's teacher and an admin (FR-M05-141, SRS §8.3 "Q4 teacher/admin
 * preview", PROPOSED; BR-32). Loads `GET /api/remedial-tests/:id`: the slate banner "Pratonton —
 * jawapan tidak direkodkan.", then per question the text, options A–D and the correct option in green
 * with a tick. No timer, no buttons, nothing is written. Any other viewer gets a 404 from the API,
 * which is the global 404 page. The header card (subject, student, counts) is INFERRED.
 */
import { ArrowLeft, Check } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchRemedialPreview } from '../../api/practice'

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
  <div class="min-h-screen px-2 py-4 sm:px-4 sm:py-8" data-testid="remedial-preview">
    <div v-if="data" class="mx-auto max-w-2xl space-y-4">
      <RouterLink
        to="/remedial/saya"
        class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="preview-back"
      >
        <ArrowLeft class="h-4 w-4" />
        Kembali
      </RouterLink>

      <div class="rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="preview-header">
        <h2
          class="font-heading text-lg font-extrabold break-words text-slate-900 sm:text-2xl"
          data-testid="preview-title"
        >
          Ujian Remedial — {{ data.subjectName }}
        </h2>
        <p class="text-sm text-slate-500" data-testid="preview-meta">
          {{ data.studentName }} · {{ data.totalQuestions }} soalan
        </p>
      </div>

      <p
        class="rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600"
        data-testid="preview-banner"
      >
        Pratonton — jawapan tidak direkodkan.
      </p>

      <article
        v-for="(q, i) in data.questions"
        :key="q.id"
        class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        :data-testid="`preview-q-${String(i + 1)}`"
      >
        <p class="mb-1 text-xs font-bold text-slate-400">Soalan {{ i + 1 }}</p>
        <p
          class="mb-3 text-sm break-words whitespace-pre-line text-slate-800 sm:text-base"
          :dir="q.textDirection"
          data-testid="preview-text"
        >
          {{ q.questionText }}
        </p>
        <ul class="space-y-2">
          <li
            v-for="o in q.options"
            :key="o.id"
            class="flex items-start gap-3 rounded-xl border-2 px-3 py-2 text-sm"
            :class="
              o.id === q.correctOptionId
                ? 'border-green-500 bg-green-50 text-green-800'
                : 'border-slate-200 text-slate-700'
            "
            :data-correct="o.id === q.correctOptionId ? 'true' : 'false'"
            data-testid="preview-option"
          >
            <span class="font-bold">{{ o.label }}.</span>
            <span class="min-w-0 flex-1 break-words">{{ o.text }}</span>
            <Check
              v-if="o.id === q.correctOptionId"
              class="mt-0.5 h-4 w-4 shrink-0 text-green-600"
            />
          </li>
        </ul>
      </article>
    </div>

    <div
      v-else-if="error && !notFound"
      class="mx-auto max-w-xl space-y-3"
      data-testid="preview-error"
    >
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
        data-testid="preview-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>
  </div>
</template>
