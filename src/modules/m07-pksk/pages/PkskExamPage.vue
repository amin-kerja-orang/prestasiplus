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
import { AlertBox } from '@/components/feedback'

import { fetchPkskExam, submitPkskExam } from '../api/pksk'
import type { PkskAnswer, PkskLevel } from '../api/types'
import BackLink from '../components/BackLink.vue'
import LoadError from '../components/LoadError.vue'
import QuestionItem from '../components/QuestionItem.vue'
import { isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()
const router = useRouter()

const { data, error, reload } = usePkskData((signal) => fetchPkskExam(props.level, { signal }), [
  () => props.level,
])
const loadFailed = computed(() => isLoadError(error.value))

const answers = reactive<Record<number, PkskAnswer>>({})
const saving = ref(false)
const submitError = ref<string | null>(null)

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
  <div class="min-w-0 space-y-5" data-testid="pksk-exam" data-provisional="L-3">
    <BackLink :to="`/pksk/level/${level}`" label="Kembali ke Dashboard" />

    <LoadError v-if="loadFailed" @retry="reload()" />

    <form v-else-if="data" class="space-y-6" novalidate @submit.prevent="submit">
      <h2 class="text-xl font-bold text-slate-800 sm:text-2xl" data-testid="exam-title">
        Peperiksaan Penuh
      </h2>
      <AlertBox v-if="submitError" :messages="submitError" />
      <section
        v-for="s in data.sections"
        :key="s.bahagian"
        class="space-y-3"
        :data-testid="`exam-section-${s.bahagian}`"
      >
        <h3 class="text-lg font-bold text-slate-800">{{ SECTION_TITLE[s.bahagian] }}</h3>
        <QuestionItem
          v-for="(q, i) in s.questions"
          :key="q.id"
          :question="q"
          :index="i + 1"
          :model-value="answerOf(q.id)"
          @update:model-value="answers[q.id] = $event"
        />
      </section>
      <button
        type="submit"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
        :disabled="saving"
        data-testid="exam-submit"
      >
        Hantar
      </button>
    </form>
  </div>
</template>
