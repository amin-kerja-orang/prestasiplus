<script setup lang="ts">
/**
 * S4b `/pksk/level/:level/exam` "Peperiksaan Penuh" (M07-T2; FR-M07-17): **provisional** neutral exam page
 * (UNVERIFIED, L-3): 30 Bahagian A + 70 Bahagian B + 1 Bahagian C item grouped A / B / C with answer
 * inputs and "Hantar" (PROPOSED COPY). "Hantar" posts #23 (a completed attempt) and opens the level
 * dashboard. No timer, auto-submit, section navigation or result layout; replaced after L-3.
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { DsLoadError, DsPage, DsQuizHeader } from '@/ds'

import { fetchPkskExam, submitPkskExam } from '../api/pksk'
import type { PkskAnswer, PkskLevel } from '../api/types'
import QuestionItem from '../components/QuestionItem.vue'
import { LOAD_ERROR, isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()
const router = useRouter()

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskExam(props.level, { signal }),
  [() => props.level],
)
const loadFailed = computed(() => isLoadError(error.value))

const answers = reactive<Record<number, PkskAnswer>>({})
const saving = ref(false)
const submitError = ref<string | null>(null)

const progress = computed(() => {
  const qs = data.value?.sections.flatMap((s) => s.questions) ?? []
  if (qs.length === 0) return 0
  const done = qs.filter(
    (q) => answerOf(q.id).optionIndex !== undefined || !!answerOf(q.id).text,
  ).length
  return (done / qs.length) * 100
})
const answerOf = (id: number): PkskAnswer => answers[id] ?? { questionId: id }
const SECTION_TITLE = { A: 'Bahagian A', B: 'Bahagian B', C: 'Bahagian C' } as const

async function submit(): Promise<void> {
  if (!data.value || saving.value) return
  saving.value = true
  submitError.value = null
  try {
    const all = data.value.sections.flatMap((s) => s.questions.map((q) => answerOf(q.id)))
    await submitPkskExam(props.level, all)
    await router.push(`/pksk/level/${props.level}`)
  } catch (err) {
    submitError.value = isApiError(err) ? err.message : 'Maaf, berlaku ralat. Sila cuba semula.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    :back-to="`/pksk/level/${level}`"
    back-label="Kembali ke Dashboard"
    class="max-w-2xl"
    data-testid="pksk-exam"
    data-provisional="L-3"
  >
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <form v-else-if="data" class="flex flex-col gap-6" novalidate @submit.prevent="submit">
      <DsQuizHeader
        close-label="Kembali ke Dashboard"
        :progress="progress"
        progress-label="Kemajuan peperiksaan"
        @close="router.push(`/pksk/level/${level}`)"
      />
      <h2 class="text-heading text-highlighted" data-testid="exam-title">Peperiksaan Penuh</h2>
      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="submitError"
      />
      <section
        v-for="s in data.sections"
        :key="s.bahagian"
        class="flex flex-col gap-3"
        :data-testid="`exam-section-${s.bahagian}`"
      >
        <h3 class="text-subheading text-highlighted">{{ SECTION_TITLE[s.bahagian] }}</h3>
        <QuestionItem
          v-for="(q, i) in s.questions"
          :key="q.id"
          :question="q"
          :index="i + 1"
          :model-value="answerOf(q.id)"
          @update:model-value="answers[q.id] = $event"
        />
      </section>
      <UButton
        type="submit"
        size="xl"
        block
        icon="i-ph-paper-plane-tilt-duotone"
        class="min-h-12"
        :loading="saving"
        :disabled="saving"
        data-testid="exam-submit"
        >Hantar</UButton
      >
    </form>
  </DsPage>
</template>
