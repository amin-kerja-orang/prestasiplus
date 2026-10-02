<script setup lang="ts">
/**
 * S7 session modal (FN-M17-5.4.10, FR-M17-58): "{subjek} — {topik}", the subtitle
 * "{date} | Kesukaran: {n|-} | Masa: {m}m {s}s", the stats (Ketepatan >= 70 emerald, < 50 rose, else
 * amber) and the question rows. Opens above the sessions modal.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCcSession } from '../../api/command-center'
import { accuracyTone, dmyTime, hms, pct2, TONE_TEXT } from './cc-format'
import CcModal from './CcModal.vue'
import CcModalStats from './CcModalStats.vue'

const props = defineProps<{ sessionId: string }>()
const emit = defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCcSession(props.sessionId, { signal }))

const title = computed(() =>
  data.value ? `${data.value.subjectLabel} — ${data.value.topic ?? '-'}` : 'Sesi',
)
const subtitle = computed(() => {
  const d = data.value
  if (!d) return undefined
  const difficulty = d.difficulty === null ? '-' : String(d.difficulty)
  return `${dmyTime(d.completedAt)} | Kesukaran: ${difficulty} | Masa: ${String(d.timeSpent.m)}m ${String(d.timeSpent.s)}s`
})
const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Soalan', value: String(d.total) },
    { label: 'Betul', value: String(d.correctCount), tone: 'text-emerald-400' },
    { label: 'Salah', value: String(d.wrongCount), tone: 'text-rose-400' },
    { label: 'Ketepatan', value: pct2(d.accuracy), tone: TONE_TEXT[accuracyTone(d.accuracy)] },
  ]
})
</script>

<template>
  <CcModal
    :title="title"
    :subtitle="subtitle"
    stacked
    testid="cc-session-modal"
    @close="emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-modal-error">
      Ralat memuatkan data
    </p>
    <p v-else-if="!data" class="text-sm text-slate-400" data-testid="cc-modal-loading">
      Memuatkan soalan...
    </p>
    <template v-else>
      <CcModalStats :stats="stats" />
      <p
        v-if="data.answers.length === 0"
        class="mt-4 text-sm text-slate-400"
        data-testid="cc-modal-empty"
      >
        Tiada data soalan
      </p>
      <ol v-else class="mt-4 divide-y divide-slate-700/60" data-testid="cc-session-answers">
        <li
          v-for="a in data.answers"
          :key="a.no"
          class="flex gap-2 py-3 sm:gap-3"
          data-testid="cc-answer-row"
          :data-correct="a.correct"
        >
          <span class="w-6 shrink-0 text-right font-mono text-xs text-slate-500">{{ a.no }}</span>
          <span
            :class="['w-5 shrink-0 text-center', a.correct ? 'text-emerald-400' : 'text-rose-400']"
            aria-hidden="true"
            >{{ a.correct ? '✓' : '✗' }}</span
          >
          <div class="min-w-0 flex-1">
            <div
              :class="['text-sm break-words', a.correct ? 'text-slate-50' : 'text-rose-300']"
              data-testid="cc-answer-text"
            >
              {{ a.questionText }}
            </div>
            <template v-if="a.correct">
              <div v-if="a.correctAnswer" class="mt-1 text-xs break-words text-emerald-400">
                {{ a.correctAnswer }}
              </div>
            </template>
            <template v-else>
              <div v-if="a.selectedAnswer" class="mt-1 text-xs break-words text-rose-400">
                Jawapan anda: {{ a.selectedAnswer }}
              </div>
              <div v-if="a.correctAnswer" class="text-xs break-words text-emerald-400">
                Jawapan betul: {{ a.correctAnswer }}
              </div>
            </template>
          </div>
          <span class="shrink-0 font-mono text-xs text-slate-500">{{ hms(a.answeredAt) }}</span>
        </li>
      </ol>
    </template>
  </CcModal>
</template>
