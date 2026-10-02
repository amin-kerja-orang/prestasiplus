<script setup lang="ts">
/**
 * One card of "Soalan Saya" (FR-M10-96, 97; FN-M10-7.1.8, 7.1.9). Clicking the head toggles it open:
 * the question, options "A." … "D." (correct highlighted), "Penjelasan", footer "#{id}", source and
 * "Aktif", and the actions "Edit" (→ S24) and "Padam" (the owner confirms and deletes).
 */
import { CircleCheck, Database, Eye, EyeOff, Hash, Lightbulb, Pencil, Trash2 } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { formatDateEn } from '@/lib/time'

import type { ContributedQuestion } from '../../api/types'
import { OPTION_LETTERS } from './lib'

defineProps<{ question: ContributedQuestion; deleting?: boolean }>()
const emit = defineEmits<{ remove: [id: number] }>()

const open = ref(false)

const CHIP = 'rounded-full px-2.5 py-0.5 text-xs font-medium'
</script>

<template>
  <li
    class="min-w-0 rounded-2xl border border-slate-100 bg-white shadow-sm"
    :data-question-id="question.id"
    data-testid="question-card"
  >
    <button
      type="button"
      class="block min-h-11 w-full min-w-0 rounded-2xl p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      data-testid="question-toggle"
      @click="open = !open"
    >
      <span class="block min-w-0 text-sm font-semibold break-words text-slate-800">
        {{ question.questionText }}
      </span>
      <span class="mt-2 flex flex-wrap items-center gap-1.5">
        <span :class="[CHIP, 'bg-indigo-50 text-indigo-700']" data-testid="chip-subject">
          {{ question.subjectName }}
        </span>
        <span :class="[CHIP, 'bg-sky-50 text-sky-700']" data-testid="chip-level">
          {{ question.levelName }}
        </span>
        <span :class="[CHIP, 'bg-amber-50 text-amber-800']" data-testid="chip-difficulty">
          {{ question.difficultyLabel }}
        </span>
        <span
          v-if="question.dskpTagged"
          :class="[CHIP, 'inline-flex items-center gap-1 bg-emerald-50 text-emerald-700']"
          data-testid="chip-dskp"
        >
          <CircleCheck class="h-3 w-3" />
          DSKP
        </span>
        <span
          :class="[
            CHIP,
            question.status === 'approved'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-amber-50 text-amber-800',
          ]"
          data-testid="chip-status"
        >
          {{ question.statusLabel }}
        </span>
        <span class="text-xs text-slate-500" data-testid="question-date">
          {{ formatDateEn(question.createdAt) }}
        </span>
      </span>
    </button>

    <div
      v-if="open"
      class="min-w-0 space-y-3 border-t border-slate-100 p-4"
      data-testid="question-body"
    >
      <p class="min-w-0 text-sm break-words text-slate-800">{{ question.questionText }}</p>
      <ul v-if="question.options" class="space-y-1.5">
        <li
          v-for="(opt, i) in question.options"
          :key="i"
          :class="[
            'min-w-0 rounded-lg border px-3 py-2 text-sm break-words',
            question.correctAnswer === i
              ? 'border-emerald-300 bg-emerald-50 font-semibold text-emerald-800'
              : 'border-slate-200 bg-slate-50 text-slate-700',
          ]"
          :data-correct="question.correctAnswer === i ? 'true' : 'false'"
          data-testid="question-option"
        >
          <strong>{{ OPTION_LETTERS[i] }}.</strong> {{ opt }}
        </li>
      </ul>
      <div
        v-if="question.explanation"
        class="rounded-lg bg-amber-50 p-3 text-sm text-slate-700"
        data-testid="question-explanation"
      >
        <p class="mb-1 flex items-center gap-1.5 font-semibold text-amber-800">
          <Lightbulb class="h-4 w-4" />
          Penjelasan
        </p>
        <p class="break-words">{{ question.explanation }}</p>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span class="inline-flex items-center gap-1" data-testid="question-id">
            <Hash class="h-3.5 w-3.5" />{{ question.id }}
          </span>
          <span v-if="question.source" class="inline-flex items-center gap-1 break-all">
            <Database class="h-3.5 w-3.5" />{{ question.source }}
          </span>
          <span class="inline-flex items-center gap-1">
            <Eye v-if="question.isActive" class="h-3.5 w-3.5" />
            <EyeOff v-else class="h-3.5 w-3.5" />
            {{ question.isActive ? 'Aktif' : 'Tidak Aktif' }}
          </span>
        </div>
        <div class="flex gap-2">
          <RouterLink
            :to="`/guru/soalan/${String(question.id)}/edit`"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-amber-100 px-4 text-sm font-semibold text-amber-800 hover:bg-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            data-testid="question-edit"
          >
            <Pencil class="h-4 w-4" />
            Edit
          </RouterLink>
          <button
            type="button"
            :disabled="deleting"
            class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-red-50 px-4 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:opacity-50"
            data-testid="question-delete"
            @click="emit('remove', question.id)"
          >
            <Trash2 class="h-4 w-4" />
            Padam
          </button>
        </div>
      </div>
    </div>
  </li>
</template>
