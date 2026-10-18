<script setup lang="ts">
/**
 * S4a `/pksk/level/:level/domain/:code` (M07-T2; FR-M07-16, FR-M07-65): **provisional** neutral practice
 * page (UNVERIFIED, L-2): the domain name, the served questions with answer inputs and "Hantar"
 * (PROPOSED COPY). "Hantar" posts #21 (one M05 session, mode `pksk`) and opens the domain list. No
 * layout, timer, feedback or result is specified; replaced after L-2.
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { DsLoadError, DsPage, DsQuizHeader } from '@/ds'

import { fetchPkskPractice, submitPkskPractice } from '../api/pksk'
import type { PkskAnswer, PkskLevel } from '../api/types'
import QuestionItem from '../components/QuestionItem.vue'
import { LOAD_ERROR, isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel; code: string }>()
const router = useRouter()

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskPractice(props.level, props.code, { signal }),
  [() => props.level, () => props.code],
)
const loadFailed = computed(() => isLoadError(error.value))

const answers = reactive<Record<number, PkskAnswer>>({})
const saving = ref(false)
const submitError = ref<string | null>(null)

const progress = computed(() => {
  const qs = data.value?.questions ?? []
  if (qs.length === 0) return 0
  const done = qs.filter(
    (q) => answerOf(q.id).optionIndex !== undefined || !!answerOf(q.id).text,
  ).length
  return (done / qs.length) * 100
})
const answerOf = (id: number): PkskAnswer => answers[id] ?? { questionId: id }

async function submit(): Promise<void> {
  if (!data.value || saving.value) return
  saving.value = true
  submitError.value = null
  try {
    await submitPkskPractice(
      props.level,
      props.code,
      data.value.questions.map((q) => answerOf(q.id)),
    )
    await router.push(`/pksk/level/${props.level}/domains`)
  } catch (err) {
    submitError.value = isApiError(err) ? err.message : 'Maaf, berlaku ralat. Sila cuba semula.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    :back-to="`/pksk/level/${level}/domains`"
    back-label="Kembali ke Domain"
    class="max-w-2xl"
    data-testid="pksk-practice"
    data-provisional="L-2"
  >
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <form v-else-if="data" class="flex flex-col gap-4" novalidate @submit.prevent="submit">
      <DsQuizHeader
        close-label="Kembali ke Domain"
        :progress="progress"
        progress-label="Kemajuan latihan"
        @close="router.push(`/pksk/level/${level}/domains`)"
      />
      <h2 class="text-heading text-highlighted" data-testid="practice-title">
        {{ data.domain.name }}
      </h2>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="submitError"
      />
      <QuestionItem
        v-for="(q, i) in data.questions"
        :key="q.id"
        :question="q"
        :index="i + 1"
        :model-value="answerOf(q.id)"
        @update:model-value="answers[q.id] = $event"
      />
      <UButton
        type="submit"
        size="xl"
        block
        icon="i-ph-paper-plane-tilt-duotone"
        class="min-h-12"
        :loading="saving"
        :disabled="saving"
        data-testid="practice-submit"
        >Hantar</UButton
      >
    </form>
  </DsPage>
</template>
