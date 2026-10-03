<script setup lang="ts">
/**
 * S4 "Jawapan Salah" (FN-M11-4.2.7; FR-M11-68): one card per wrong answer, newest first, every card
 * shown (DV-M11-06).
 */
import { Bookmark, CircleX, Lightbulb } from '@lucide/vue'

import type { StudentAnswerRow, StudentDetail } from '../../api/types'
import { CARD, dmyHm } from './monitoring-format'
import { safeHtml } from './safe-html'

defineProps<{ wrong: StudentDetail['wrong'] }>()

const optionText = (row: StudentAnswerRow, label: string | null) =>
  row.options.find((o) => o.label === label)?.text ?? ''
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-panel-wrong">
    <h3
      class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800"
      data-testid="mon-wrong-heading"
    >
      <CircleX class="h-5 w-5 text-red-500" />Jawapan Salah ({{ wrong.count }} jawapan,
      {{ wrong.unique }} soalan unik)
    </h3>
    <div class="space-y-3">
      <article
        v-for="(r, i) in wrong.rows"
        :key="`${String(r.questionId)}-${String(i)}`"
        class="rounded-xl border border-red-200 bg-red-50/30 p-3"
        data-testid="mon-wrong-card"
      >
        <div class="flex flex-wrap items-start justify-between gap-x-3 text-xs text-slate-400">
          <span class="min-w-0 break-words"
            >#{{ i + 1 }} · {{ r.subjectName
            }}<template v-if="r.chapterLabel"> · {{ r.chapterLabel }}</template></span
          >
          <span>{{ dmyHm(r.answeredAt) }}</span>
        </div>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="my-2 break-words text-slate-800" v-html="safeHtml(r.html)" />
        <div
          class="mb-1.5 flex items-center justify-between gap-2 rounded-lg bg-green-100 px-3 py-2 text-sm text-green-900"
        >
          <span class="flex min-w-0 items-center gap-2"
            ><span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white"
              >{{ r.correctLabel }}</span
            ><span class="min-w-0 break-words">{{ optionText(r, r.correctLabel) }}</span></span
          >
          <span class="shrink-0 text-xs text-green-600">Jawapan betul</span>
        </div>
        <div
          class="flex items-center justify-between gap-2 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-900"
        >
          <span class="flex min-w-0 items-center gap-2"
            ><span
              class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white"
              >{{ r.selectedLabel }}</span
            ><span class="min-w-0 break-words">{{ optionText(r, r.selectedLabel) }}</span></span
          >
          <span class="shrink-0 text-xs text-red-600">Jawapan pelajar</span>
        </div>
        <p
          v-if="r.explanation"
          class="mt-2 flex items-start gap-2 rounded-lg bg-blue-50 p-2.5 text-sm text-blue-800"
        >
          <Lightbulb class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /><span
            class="min-w-0 break-words"
            >{{ r.explanation }}</span
          >
        </p>
        <p v-if="r.source" class="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
          <Bookmark class="h-3.5 w-3.5" />Sumber: {{ r.source }}
        </p>
      </article>
    </div>
  </section>
</template>
