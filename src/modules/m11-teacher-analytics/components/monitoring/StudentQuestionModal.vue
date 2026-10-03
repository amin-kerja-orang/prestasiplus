<script setup lang="ts">
/**
 * S4 question modal (FN-M11-4.2.10; FR-M11-71): pill Betul / Salah, subject · chapter, source / Aras /
 * time, the question HTML, the options (correct green, the pupil's wrong pick red), the "deleted
 * options" copy and the explanation. Closes with ✕ or a click outside (D10: no ARIA or focus trap).
 */
import { Bookmark, CircleCheck, CircleX, Clock, Lightbulb, Signal, X } from '@lucide/vue'

import { BaseModal } from '@/components/overlay'

import type { StudentAnswerRow } from '../../api/types'
import { rawTime } from './monitoring-format'
import { safeHtml } from './safe-html'

defineProps<{ row: StudentAnswerRow | null }>()
const emit = defineEmits<{ close: [] }>()

function optionClass(row: StudentAnswerRow, label: string): string {
  if (label === row.correctLabel) return 'border-green-400 bg-green-50'
  if (label === row.selectedLabel) return 'border-red-400 bg-red-50'
  return 'border-slate-200 bg-white'
}
function badgeClass(row: StudentAnswerRow, label: string): string {
  if (label === row.correctLabel) return 'bg-green-500 text-white'
  if (label === row.selectedLabel) return 'bg-red-500 text-white'
  return 'bg-slate-200 text-slate-500'
}
</script>

<template>
  <BaseModal
    :open="row !== null"
    container-class="fixed inset-0 z-50 flex items-center justify-center p-4"
    backdrop-class="absolute inset-0 bg-black/50"
    panel-class="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
    data-testid="mon-modal"
    @update:open="emit('close')"
  >
    <div v-if="row">
      <div
        class="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-6"
      >
        <div class="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
          <span
            :class="[
              'rounded-full px-2.5 py-0.5 text-xs font-semibold',
              row.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600',
            ]"
            data-testid="mon-modal-result"
            >{{ row.isCorrect ? 'Betul' : 'Salah' }}</span
          >
          <span class="min-w-0 break-words" data-testid="mon-modal-subject"
            >{{ row.subjectName
            }}<template v-if="row.chapterLabel"> · {{ row.chapterLabel }}</template></span
          >
        </div>
        <button
          type="button"
          class="-mt-1 -mr-2 flex min-h-11 min-w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600 lg:min-h-9 lg:min-w-9"
          data-testid="mon-modal-close"
          @click="emit('close')"
        >
          <X class="h-5 w-5" />
        </button>
      </div>
      <div class="space-y-4 px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
          <span v-if="row.source" class="flex items-center gap-1"
            ><Bookmark class="h-3.5 w-3.5" />{{ row.source }}</span
          >
          <span class="flex items-center gap-1"
            ><Signal class="h-3.5 w-3.5" />Aras {{ row.difficulty }}</span
          >
          <span class="flex items-center gap-1" data-testid="mon-modal-time"
            ><Clock class="h-3.5 w-3.5" />{{ rawTime(row.answeredAt) }}</span
          >
        </div>
        <!-- eslint-disable vue/no-v-html -->
        <div
          class="rounded-xl border border-slate-100 bg-slate-50 p-3 break-words text-slate-800"
          data-testid="mon-modal-question"
          v-html="safeHtml(row.html)"
        />
        <!-- eslint-enable vue/no-v-html -->

        <div>
          <h4 class="mb-2 text-xs font-bold text-slate-500 uppercase">Pilihan Jawapan</h4>
          <p
            v-if="row.options.length === 0"
            class="text-sm text-slate-500"
            data-testid="mon-modal-no-options"
          >
            Pilihan jawapan telah dipadam dari sistem.
          </p>
          <div v-else class="space-y-2">
            <div
              v-for="o in row.options"
              :key="o.label"
              :class="['flex items-start gap-3 rounded-xl border-2 p-3', optionClass(row, o.label)]"
              data-testid="mon-modal-option"
            >
              <span
                :class="[
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                  badgeClass(row, o.label),
                ]"
                >{{ o.label }}</span
              >
              <div class="min-w-0">
                <p class="text-sm break-words text-slate-800">{{ o.text }}</p>
                <p
                  v-if="o.label === row.correctLabel"
                  class="flex items-center gap-1 text-xs font-semibold text-green-600"
                >
                  <CircleCheck class="h-3 w-3" />Jawapan Betul
                </p>
                <p
                  v-else-if="o.label === row.selectedLabel"
                  class="flex items-center gap-1 text-xs font-semibold text-red-600"
                >
                  <CircleX class="h-3 w-3" />Jawapan Pelajar
                </p>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="row.explanation"
          class="rounded-xl bg-blue-50 p-3"
          data-testid="mon-modal-explanation"
        >
          <h4 class="mb-1 flex items-center gap-1.5 text-xs font-bold text-blue-700">
            <Lightbulb class="h-3.5 w-3.5" />Penjelasan
          </h4>
          <p class="text-sm break-words text-blue-800">{{ row.explanation }}</p>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
