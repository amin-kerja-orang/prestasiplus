<script setup lang="ts">
/**
 * S7 session modal (FN-M17-5.4.10, FR-M17-58): "{subjek} — {topik}", the subtitle
 * "{date} | Kesukaran: {n|-} | Masa: {m}m {s}s", the stats and the question rows. Opens above the sessions modal.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsDialog, DsLoadError, DsStatRow } from '@/ds'

import { fetchCcSession } from '../../api/command-center'
import { dmyTime, hms, MODAL_ERROR_COPY, pct2, statItems } from './cc-format'
import { useCcDialog } from './use-cc-dialog'

const props = defineProps<{ sessionId: string }>()
const emit = defineEmits<{ close: [] }>()

const open = useCcDialog(() => emit('close'))

const { data, error, reload } = useApi((signal) => fetchCcSession(props.sessionId, { signal }))

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
    { label: 'Betul', value: String(d.correctCount) },
    { label: 'Salah', value: String(d.wrongCount) },
    { label: 'Ketepatan', value: pct2(d.accuracy) },
  ]
})
</script>

<template>
  <DsDialog v-model:open="open" :title="title" class="sm:max-w-2xl">
    <div class="flex min-w-0 flex-col gap-4" data-testid="cc-session-modal">
      <p v-if="subtitle" class="text-body text-muted" data-testid="cc-modal-subtitle">
        {{ subtitle }}
      </p>
      <DsLoadError
        v-if="error"
        inline
        :message="MODAL_ERROR_COPY"
        testid="cc-modal-error"
        @retry="reload"
      />
      <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
        Memuatkan soalan...
      </p>
      <template v-else>
        <DsStatRow :items="statItems(stats)" data-testid="cc-modal-stats" />
        <p
          v-if="data.answers.length === 0"
          class="text-body text-muted"
          data-testid="cc-modal-empty"
        >
          Tiada data soalan
        </p>
        <ol v-else class="flex flex-col gap-2" data-testid="cc-session-answers">
          <li
            v-for="a in data.answers"
            :key="a.no"
            class="flex gap-2 bg-soft p-3 sm:gap-3"
            data-testid="cc-answer-row"
            :data-correct="a.correct"
          >
            <span class="tabular w-6 shrink-0 text-end text-caption text-muted">{{ a.no }}</span>
            <UIcon
              :name="a.correct ? 'i-ph-check-circle' : 'i-ph-x-circle'"
              :class="['size-5 shrink-0', a.correct ? 'text-success' : 'text-error']"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <div
                :class="['text-body break-words', a.correct ? 'text-highlighted' : 'text-error']"
                data-testid="cc-answer-text"
              >
                {{ a.questionText }}
              </div>
              <template v-if="a.correct">
                <div v-if="a.correctAnswer" class="mt-1 text-caption break-words text-success">
                  {{ a.correctAnswer }}
                </div>
              </template>
              <template v-else>
                <div v-if="a.selectedAnswer" class="mt-1 text-caption break-words text-error">
                  Jawapan anda: {{ a.selectedAnswer }}
                </div>
                <div v-if="a.correctAnswer" class="text-caption break-words text-success">
                  Jawapan betul: {{ a.correctAnswer }}
                </div>
              </template>
            </div>
            <span class="tabular shrink-0 text-caption text-muted">{{ hms(a.answeredAt) }}</span>
          </li>
        </ol>
      </template>
    </div>
    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        label="Tutup"
        data-testid="cc-modal-close"
        @click="open = false"
      />
    </template>
  </DsDialog>
</template>
