<script setup lang="ts">
/**
 * Provisional player `/audio-kbat/:id` (M09; FR-M09-75, BR-M09-16; route INFERRED, L-3). Set title,
 * instructions and the 4 sections, each an `<audio controls>` and its questions shown together
 * (radio A–D); one "Hantar" (PROPOSED COPY) posts #26 and shows the stored score. No timer, no
 * review, no result layout is asserted. An unknown or not approved set shows the 404 message.
 */
import { ArrowLeft, Send } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchAudioSet, submitAudioAttempt } from '../api'
import type { AudioAttemptResult } from '../api'
import AudioKbatSectionCard from '../components/audio-kbat/AudioKbatSectionCard.vue'
import { COPY, errorLines, isNotFoundError } from '../lib/admin-media/common'
import { AUDIO_KBAT_ROUTES, PLAYER_COPY, attemptBody, type Choice } from '../lib/audio-kbat'

const props = defineProps<{ id: number }>()

const {
  data: set,
  error,
  loading,
} = useApi(
  (signal) => fetchAudioSet(props.id, { signal }),
  () => props.id,
)

/** An unknown or not approved set renders the standalone 404 page in place (M02 convention). */
watch(
  () => isNotFoundError(error.value),
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

const answers = reactive<Record<number, Choice | undefined>>({})
const submitting = ref(false)
const result = ref<AudioAttemptResult | null>(null)
const submitErrors = ref<string[]>([])

const loadErrors = computed(() => (error.value ? [COPY.loadFailed] : []))

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  submitErrors.value = []
  try {
    result.value = await submitAudioAttempt(props.id, attemptBody(answers))
  } catch (err) {
    submitErrors.value = errorLines(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="audio-player-page">
    <RouterLink
      :to="{ name: AUDIO_KBAT_ROUTES.list }"
      class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
      data-testid="player-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      {{ PLAYER_COPY.back }}
    </RouterLink>

    <AlertBox v-if="error" :messages="loadErrors" data-testid="player-error" />

    <div
      v-else-if="loading && !set"
      class="flex justify-center rounded-2xl bg-white px-4 py-14 text-slate-400 shadow-sm"
      role="status"
      data-testid="player-loading"
    >
      <LoadingSpinner :size="24" />
    </div>

    <form
      v-else-if="set"
      class="min-w-0 space-y-5"
      data-testid="player-form"
      @submit.prevent="submit"
    >
      <header class="rounded-2xl bg-white p-5 shadow-sm">
        <h1 class="font-heading text-2xl font-bold break-words" data-testid="player-title">
          {{ set.title }}
        </h1>
        <p
          v-if="set.instructions"
          class="mt-2 text-sm break-words text-slate-600"
          data-testid="player-instructions"
        >
          {{ set.instructions }}
        </p>
      </header>

      <AudioKbatSectionCard
        v-for="section in set.sections"
        :key="section.no"
        :section="section"
        :answers="answers"
        :disabled="result !== null"
        @choose="(no, choice) => (answers[no] = choice)"
      />

      <AlertBox
        v-if="submitErrors.length > 0"
        :messages="submitErrors"
        data-testid="submit-error"
      />

      <div
        v-if="result"
        class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800"
        role="status"
        data-testid="player-result"
      >
        <p class="text-sm font-semibold">{{ PLAYER_COPY.resultTitle }}</p>
        <p class="font-heading text-2xl font-bold">
          <span data-testid="result-score">{{ result.score }}</span> /
          <span data-testid="result-total">{{ result.totalMarks }}</span>
        </p>
      </div>

      <div v-else class="flex justify-end">
        <button
          type="submit"
          class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-amber-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:opacity-60 sm:w-auto"
          :disabled="submitting"
          data-testid="player-submit"
        >
          <LoadingSpinner v-if="submitting" />
          <Send v-else class="h-4 w-4" aria-hidden="true" />
          {{ PLAYER_COPY.submit }}
        </button>
      </div>
    </form>
  </div>
</template>
