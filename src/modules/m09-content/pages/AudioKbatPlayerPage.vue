<script setup lang="ts">
/**
 * Provisional player `/audio-kbat/:id` (M09; FR-M09-75, BR-M09-16; route INFERRED, L-3). Set title,
 * instructions and the 4 sections, each a `DsAudioPlayer` and its questions shown together
 * (radio A–D); one "Hantar" (PROPOSED COPY) posts #26 and shows the stored score. No timer, no
 * review, no result layout is asserted. An unknown or not approved set shows the 404 message.
 */
import { computed, reactive, ref, watch } from 'vue'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsLoadError, DsPage, DsStack, DsCluster, DsHeading, DsText } from '@/ds'

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
  reload,
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
  <DsPage data-testid="audio-player-page">
    <UButton
      :to="{ name: AUDIO_KBAT_ROUTES.list }"
      color="neutral"
      variant="ghost"
      icon="i-ph-arrow-left"
      class="self-start"
      data-testid="player-back"
      >{{ PLAYER_COPY.back }}</UButton
    >

    <DsLoadError
      v-if="error"
      :message="loadErrors.join(' ')"
      testid="player-error"
      @retry="reload()"
    />

    <DsStack
      v-else-if="loading && !set"
      gap="sm"
      role="status"
      aria-busy="true"
      data-testid="player-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
    </DsStack>

    <form
      v-else-if="set"
      class="flex min-w-0 flex-col gap-4 md:gap-6"
      data-testid="player-form"
      @submit.prevent="submit"
    >
      <DsStack as="header" gap="xs">
        <DsHeading :level="1" wrap="anywhere" data-testid="player-title">
          {{ set.title }}
        </DsHeading>
        <DsText
          v-if="set.instructions"
          variant="body"
          tone="muted"
          wrap="anywhere"
          class="max-w-prose"
          data-testid="player-instructions"
        >
          {{ set.instructions }}
        </DsText>
      </DsStack>

      <AudioKbatSectionCard
        v-for="section in set.sections"
        :key="section.no"
        :section="section"
        :answers="answers"
        :disabled="result !== null"
        @choose="(no, choice) => (answers[no] = choice)"
      />

      <UAlert
        v-if="submitErrors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :description="submitErrors.join(' ')"
        data-testid="submit-error"
      />

      <UCard v-if="result" role="status" data-testid="player-result">
        <DsText variant="label" as="p" tone="muted">{{ PLAYER_COPY.resultTitle }}</DsText>
        <DsText variant="heading" tabular>
          <span data-testid="result-score">{{ result.score }}</span> /
          <span data-testid="result-total">{{ result.totalMarks }}</span>
        </DsText>
      </UCard>

      <DsCluster v-else gap="none" align="stretch" justify="end" :wrap="false">
        <UButton
          type="submit"
          size="xl"
          icon="i-ph-paper-plane-tilt-fill"
          :loading="submitting"
          class="w-full justify-center sm:w-auto"
          data-testid="player-submit"
          >{{ PLAYER_COPY.submit }}</UButton
        >
      </DsCluster>
    </form>
  </DsPage>
</template>
