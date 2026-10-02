<script setup lang="ts">
/**
 * S9 `/admin/structured-questions/:id` "Detail Soalan Berstruktur" (M04-T7; FR-M04-88..90,
 * FN-M04-4.2.1..4.2.6). Read-only: back link, header card (pills, "ID: #n", stimulus box with line
 * breaks kept, meta line), "Bahagian Soalan (n sub-soalan)" with one card per sub-question and the
 * "Edit Soalan" (M10 teacher form) / "Balik ke Senarai" actions. An unknown id is the standard 404.
 */
import { ArrowLeft, Calendar, Circle, Eye, List, SquarePen, User } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchStructuredQuestion } from '../api/structured'
import { formatEnDate } from '../lib/audit-format'
import { STRUCTURED_LIST_PATH, structuredEditPath } from '../lib/audit-routes'
import { kbatLabel, partLabelText } from '../lib/structured-options'
import { LOAD_ERROR, isNotFound } from '../lib/ui-errors'

const props = defineProps<{ id: number }>()

const {
  data: question,
  error,
  reload,
} = useApi(
  (signal) => fetchStructuredQuestion(props.id, { signal }),
  () => props.id,
)

/** An unknown id is the standard 404 page; other load failures keep the red box. */
const notFound = computed(() => isNotFound(error.value))
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const PILL = 'inline-block rounded-full px-3 py-1 text-xs font-semibold'
const BACK_LINK =
  'inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-4 sm:space-y-6" data-testid="structured-detail">
    <RouterLink :to="STRUCTURED_LIST_PATH" :class="BACK_LINK" data-testid="structured-back">
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Kembali ke senarai
    </RouterLink>

    <div v-if="error && !notFound" class="space-y-3" data-testid="structured-detail-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        data-testid="structured-detail-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <div v-else-if="!question" class="space-y-4" data-testid="structured-detail-skeleton">
      <div class="h-56 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="h-32 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <template v-else>
      <section class="rounded-2xl bg-white p-4 shadow sm:p-6" data-testid="structured-header">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-wrap gap-2">
            <span
              v-if="question.subject"
              :class="[PILL, 'bg-indigo-50 text-indigo-700']"
              data-testid="structured-pill-subject"
              >{{ question.subject.name }}</span
            >
            <span
              v-if="question.level"
              :class="[PILL, 'bg-slate-100 text-slate-600']"
              data-testid="structured-pill-level"
              >{{ question.level.name }}</span
            >
            <span :class="[PILL, 'bg-blue-50 text-blue-700']" data-testid="structured-pill-kbat"
              >KBAT: {{ kbatLabel(question.kbatLevel) }}</span
            >
            <span
              :class="[PILL, 'bg-emerald-100 text-emerald-700']"
              data-testid="structured-pill-marks"
              >{{ question.totalMarks }} Markah</span
            >
          </div>
          <span class="text-xs text-slate-400" data-testid="structured-id"
            >ID: #{{ question.id }}</span
          >
        </div>

        <div class="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p class="mb-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Stimulus / Konteks Soalan
          </p>
          <p
            class="text-base break-words whitespace-pre-line text-slate-800"
            data-testid="structured-stimulus"
          >
            {{ question.stimulus }}
          </p>
        </div>

        <div
          class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500"
          data-testid="structured-meta"
        >
          <span class="inline-flex items-center gap-1.5">
            <User class="h-3.5 w-3.5" aria-hidden="true" />
            Dicipta oleh: {{ question.createdBy.name ?? '—' }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <Calendar class="h-3.5 w-3.5" aria-hidden="true" />
            {{ formatEnDate(question.createdAt) }}
          </span>
          <span class="inline-flex items-center gap-1.5">
            <Eye class="h-3.5 w-3.5" aria-hidden="true" />
            Visibiliti: Public
          </span>
          <span class="inline-flex items-center gap-1.5 text-emerald-600">
            <Circle class="h-2.5 w-2.5 fill-current" aria-hidden="true" />
            {{ question.status === 'published' ? 'Published' : 'Draft' }}
          </span>
        </div>
      </section>

      <h2
        class="font-heading text-lg font-bold text-slate-800"
        data-testid="structured-subs-heading"
      >
        Bahagian Soalan ({{ question.subQuestions.length }} sub-soalan)
      </h2>

      <section
        v-for="sub in question.subQuestions"
        :key="sub.id"
        class="rounded-2xl bg-white p-4 shadow sm:p-6"
        data-testid="structured-sub"
      >
        <div class="flex items-start gap-3">
          <span
            class="inline-flex min-h-8 min-w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 px-2 text-xs font-bold text-white"
            data-testid="structured-sub-label"
            >{{ partLabelText(question.questionNumber, sub.partLabel) }}</span
          >
          <p class="min-w-0 flex-1 text-base break-words text-slate-800">
            {{ sub.questionText }}
          </p>
          <span
            class="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500"
            data-testid="structured-sub-marks"
            >{{ sub.marks }}m</span
          >
        </div>
        <div class="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <p class="mb-1 text-xs font-bold tracking-wide text-emerald-700 uppercase">
            Jawapan Model
          </p>
          <p class="text-sm break-words whitespace-pre-line text-slate-700">
            {{ sub.modelAnswer }}
          </p>
        </div>
      </section>

      <div class="flex flex-wrap gap-3">
        <RouterLink
          :to="structuredEditPath(question.id)"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          data-testid="structured-edit"
        >
          <SquarePen class="h-4 w-4" aria-hidden="true" />
          Edit Soalan
        </RouterLink>
        <RouterLink
          :to="STRUCTURED_LIST_PATH"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="structured-back-list"
        >
          <List class="h-4 w-4" aria-hidden="true" />
          Balik ke Senarai
        </RouterLink>
      </div>
    </template>
  </div>
</template>
