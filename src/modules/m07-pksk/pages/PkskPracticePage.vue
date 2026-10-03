<script setup lang="ts">
/**
 * S4a `/pksk/level/:level/domain/:code` (M07-T2; FR-M07-16, FR-M07-65): **provisional** neutral practice
 * page (UNVERIFIED, L-2): the domain name, the served questions with answer inputs and "Hantar"
 * (PROPOSED COPY). "Hantar" posts #21 (one M05 session, mode `pksk`) and opens the domain list. No
 * layout, timer, feedback or result is specified; replaced after L-2.
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { isApiError } from '@/api'

import { fetchPkskPractice, submitPkskPractice } from '../api/pksk'
import type { PkskAnswer, PkskLevel } from '../api/types'
import BackLink from '../components/BackLink.vue'
import LoadError from '../components/LoadError.vue'
import QuestionItem from '../components/QuestionItem.vue'
import { isLoadError, usePkskData } from '../lib/load'

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
  <div class="min-w-0 space-y-5" data-testid="pksk-practice" data-provisional="L-2">
    <BackLink :to="`/pksk/level/${level}/domains`" label="Kembali ke Domain" />

    <LoadError v-if="loadFailed" @retry="reload()" />

    <form v-else-if="data" class="space-y-4" novalidate @submit.prevent="submit">
      <h2 class="text-xl font-bold text-slate-800 sm:text-2xl" data-testid="practice-title">
        {{ data.domain.name }}
      </h2>
      <AlertBox v-if="submitError" :messages="submitError" />
      <QuestionItem
        v-for="(q, i) in data.questions"
        :key="q.id"
        :question="q"
        :index="i + 1"
        :model-value="answerOf(q.id)"
        @update:model-value="answers[q.id] = $event"
      />
      <button
        type="submit"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 disabled:opacity-60 sm:w-auto"
        :disabled="saving"
        data-testid="practice-submit"
      >
        Hantar
      </button>
    </form>
  </div>
</template>
