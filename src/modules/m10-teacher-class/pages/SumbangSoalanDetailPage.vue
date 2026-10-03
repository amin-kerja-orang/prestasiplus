<script setup lang="ts">
/**
 * S23 `/guru/soalan/:id` "Detail Soalan" (M10-T6; FR-M10-107; FN-M10-7.3.1–7.3.3): chips subject /
 * source / "Tahap {n}" / type, the question and its image, options "A)" … "D)" (correct highlighted),
 * "Penerangan" and "Statistik". A question that is not own or unknown is the standard 404 (BR-M10-01).
 */
import { ArrowLeft, Check, Pencil } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchContributedQuestion } from '../api/guru'
import { COPY, isLoadableImage, OPTION_LETTERS } from '../components/soalan/lib'

const props = defineProps<{ id: number }>()

const { data, error, reload } = useApi(
  (signal) => fetchContributedQuestion(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})

const CHIP = 'rounded-full px-2.5 py-0.5 text-xs font-medium'
</script>

<template>
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="soalan-detail-page">
    <div
      v-if="error && !notFound"
      class="space-y-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="detail-error"
    >
      <AlertBox :messages="COPY.loadFailed" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-800"
        data-testid="detail-retry"
        @click="reload"
      >
        {{ COPY.retry }}
      </button>
    </div>
    <div
      v-else-if="!data && !notFound"
      class="flex justify-center rounded-2xl bg-white px-4 py-10 text-slate-400 shadow-sm"
    >
      <LoadingSpinner :size="24" />
    </div>

    <template v-else-if="data">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <RouterLink
          to="/guru/soalan"
          class="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
          data-testid="detail-back"
        >
          <ArrowLeft class="h-4 w-4" />
          Kembali
        </RouterLink>
        <RouterLink
          :to="`/guru/soalan/${String(data.id)}/edit`"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          data-testid="detail-edit"
        >
          <Pencil class="h-4 w-4" />
          Edit Soalan
        </RouterLink>
      </div>

      <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="detail-card">
        <div class="mb-3 flex flex-wrap gap-1.5">
          <span :class="[CHIP, 'bg-indigo-50 text-indigo-700']" data-testid="detail-subject">
            {{ data.subjectName }}
          </span>
          <span
            v-if="data.source"
            :class="[CHIP, 'bg-slate-100 text-slate-600']"
            data-testid="detail-source"
          >
            {{ data.source }}
          </span>
          <span :class="[CHIP, 'bg-amber-50 text-amber-800']" data-testid="detail-tahap">
            Tahap {{ data.difficultyLevel }}
          </span>
          <span :class="[CHIP, 'bg-emerald-50 text-emerald-700']" data-testid="detail-type">
            {{ data.questionType }}
          </span>
        </div>
        <p
          class="min-w-0 text-sm break-words whitespace-pre-wrap text-slate-800"
          data-testid="detail-text"
        >
          {{ data.questionText }}
        </p>
        <img
          v-if="isLoadableImage(data.questionImage)"
          :src="data.questionImage"
          alt="Imej soalan"
          class="mt-3 max-h-64 max-w-full rounded-lg border border-slate-200 object-contain"
        />
        <ul v-if="data.options" class="mt-4 space-y-2">
          <li
            v-for="(opt, i) in data.options"
            :key="i"
            :class="[
              'flex min-w-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-sm',
              data.correctAnswer === i
                ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-700',
            ]"
            :data-correct="data.correctAnswer === i ? 'true' : 'false'"
            data-testid="detail-option"
          >
            <span class="min-w-0 break-words"
              ><strong>{{ OPTION_LETTERS[i] }})</strong> {{ opt }}</span
            >
            <Check v-if="data.correctAnswer === i" class="h-4 w-4 shrink-0 text-emerald-600" />
          </li>
        </ul>
      </section>

      <section
        v-if="data.explanation"
        class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        data-testid="detail-explanation"
      >
        <h2 class="mb-1 text-sm font-bold text-slate-800">Penerangan</h2>
        <p class="min-w-0 text-sm break-words whitespace-pre-wrap text-indigo-800">
          {{ data.explanation }}
        </p>
      </section>

      <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="detail-stats">
        <h2 class="mb-3 text-sm font-bold text-slate-800">Statistik</h2>
        <div class="grid grid-cols-3 gap-2 text-center">
          <div>
            <div class="text-xl font-bold text-indigo-600" data-testid="stat-attempts">
              {{ data.usage.attempts }}
            </div>
            <div class="text-xs text-slate-500 uppercase">Kali Digunakan</div>
          </div>
          <div>
            <div class="text-xl font-bold text-emerald-600" data-testid="stat-correct">
              {{ data.usage.correct }}
            </div>
            <div class="text-xs text-slate-500 uppercase">Jawab Betul</div>
          </div>
          <div>
            <div class="text-xl font-bold text-orange-600" data-testid="stat-accuracy">
              {{ data.usage.accuracy }}%
            </div>
            <div class="text-xs text-slate-500 uppercase">Ketepatan</div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
