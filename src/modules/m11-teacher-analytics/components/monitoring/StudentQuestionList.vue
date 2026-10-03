<script setup lang="ts">
/**
 * S4 "Senarai Soalan" (FN-M11-4.2.6; FR-M11-67): table newest first, 20 rows at first and "Papar lagi
 * 20" adds 20 until all are shown. A row click asks the page to open the question modal.
 */
import { ChevronDown, CircleCheck, CircleX, ExternalLink } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { StudentAnswerRow, StudentDetail } from '../../api/types'
import { CARD, dmyHm } from './monitoring-format'

const props = defineProps<{ answers: StudentDetail['answers'] }>()
const emit = defineEmits<{ open: [row: StudentAnswerRow] }>()

const shown = ref(20)
const visible = computed(() => props.answers.rows.slice(0, shown.value))
const more = computed(() => shown.value < props.answers.rows.length)

const excerpt = (text: string) => (text.length > 80 ? `${text.slice(0, 80)}...` : text)
const TH = 'px-3 py-2 text-left text-xs font-bold text-slate-500'
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-panel-list">
    <h3 class="mb-3 font-heading text-base font-bold text-slate-800" data-testid="mon-list-heading">
      Senarai Soalan ({{ answers.available }} tersedia daripada {{ answers.total }})
    </h3>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[680px] text-sm">
        <thead>
          <tr class="border-b border-slate-100">
            <th :class="TH">#</th>
            <th :class="TH">Soalan</th>
            <th :class="TH">Subjek</th>
            <th :class="TH">Jawapan</th>
            <th :class="TH">Betul</th>
            <th :class="TH">Status</th>
            <th :class="TH">Tarikh</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(r, i) in visible"
            :key="`${String(r.questionId)}-${String(i)}`"
            :class="[
              'cursor-pointer border-b border-slate-50 hover:bg-slate-50',
              r.isCorrect ? '' : 'bg-red-50/30',
            ]"
            data-testid="mon-list-row"
            @click="emit('open', r)"
          >
            <td class="px-3 py-2 text-xs text-slate-400">{{ i + 1 }}</td>
            <td class="px-3 py-2 text-indigo-700" :title="r.textPlain">
              <span class="inline-flex items-start gap-1"
                >{{ excerpt(r.textPlain) }}<ExternalLink class="mt-0.5 h-3.5 w-3.5 shrink-0"
              /></span>
            </td>
            <td class="px-3 py-2 text-slate-600">{{ r.subjectName }}</td>
            <td
              :class="['px-3 py-2 font-semibold', r.isCorrect ? 'text-green-600' : 'text-red-600']"
            >
              {{ r.selectedLabel ?? '-' }}
            </td>
            <td class="px-3 py-2 font-semibold text-green-600">{{ r.correctLabel ?? '-' }}</td>
            <td class="px-3 py-2">
              <CircleCheck v-if="r.isCorrect" class="h-4 w-4 text-green-500" />
              <CircleX v-else class="h-4 w-4 text-red-500" />
            </td>
            <td class="px-3 py-2 whitespace-nowrap text-slate-500">{{ dmyHm(r.answeredAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <button
      v-if="more"
      type="button"
      class="mx-auto mt-3 flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold text-indigo-600 hover:bg-indigo-50 lg:min-h-9"
      data-testid="mon-list-more"
      @click="shown += 20"
    >
      <ChevronDown class="h-4 w-4" />Papar lagi 20 ({{ Math.min(shown, answers.rows.length) }}/{{
        answers.total
      }})
    </button>
  </section>
</template>
