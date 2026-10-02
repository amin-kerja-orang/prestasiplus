<script setup lang="ts">
/**
 * S9 "Soalan Paling Banyak Salah — Perlu Perhatian Khas" (FR-M08-142): the stored item-statistics
 * questions in rank order; the subject pills filter client-side (no request); a click on a card toggles
 * its detail ("Jawapan Betul", "Jawapan Salah Paling Popular", "Pelajar Yang Salah").
 */
import { Filter, Frown, Meh, Smile, User } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { formatNumber } from '@/lib/number'

import type { SchoolItemQuestion } from '../../api/types'
import { LEVEL_PILL } from '../../lib/prestasi/format'

const props = defineProps<{ questions: SchoolItemQuestion[] }>()

const subject = ref<string | null>(null)
const open = ref<ReadonlySet<number>>(new Set())

const subjects = computed(() => {
  const counts = new Map<string, number>()
  for (const q of props.questions) counts.set(q.subjectName, (counts.get(q.subjectName) ?? 0) + 1)
  // Live lists the subject pills alphabetically (AC-M08-20.3, discovery M18 S30).
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
})
const shown = computed(() =>
  subject.value === null
    ? props.questions
    : props.questions.filter((q) => q.subjectName === subject.value),
)

function toggle(id: number): void {
  const next = new Set(open.value)
  if (!next.delete(id)) next.add(id)
  open.value = next
}

const ICON = { Sukar: Frown, Sederhana: Meh, Mudah: Smile } as const
const PILL = 'min-h-11 rounded-full px-4 text-xs font-semibold transition'
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="questions-card">
    <h3 class="text-base font-bold text-slate-800">
      Soalan Paling Banyak Salah — Perlu Perhatian Khas
    </h3>
    <p class="mb-4 text-sm text-slate-500">
      Soalan yang majoriti pelajar jawab salah. Fokuskan pengajaran khas di sini.
    </p>

    <div class="mb-4 flex flex-wrap items-center gap-2" data-testid="question-filters">
      <span class="flex items-center gap-1 text-sm text-slate-500"
        ><Filter class="h-4 w-4" />Tapis:</span
      >
      <button
        type="button"
        :class="[
          PILL,
          subject === null ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600',
        ]"
        data-testid="filter-all"
        @click="subject = null"
      >
        Semua ({{ questions.length }})
      </button>
      <button
        v-for="s in subjects"
        :key="s.name"
        type="button"
        :class="[
          PILL,
          subject === s.name ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600',
        ]"
        :data-testid="`filter-${s.name}`"
        @click="subject = s.name"
      >
        {{ s.name }} ({{ s.count }})
      </button>
    </div>

    <div class="space-y-3" data-testid="question-list">
      <article
        v-for="q in shown"
        :key="q.questionId"
        class="min-w-0 rounded-xl border border-slate-200 p-4"
        :data-testid="`question-${q.questionId}`"
      >
        <button
          type="button"
          class="block w-full text-left"
          :data-testid="`question-toggle-${q.questionId}`"
          @click="toggle(q.questionId)"
        >
          <span class="mb-2 flex flex-wrap items-center gap-2">
            <span class="text-sm font-bold text-slate-400">#{{ q.rank }}</span>
            <span
              :class="[
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
                LEVEL_PILL[q.level],
              ]"
            >
              <component :is="ICON[q.level]" class="h-3.5 w-3.5" />{{ q.level }}
            </span>
          </span>
          <span class="block text-sm font-semibold break-words text-slate-800">{{ q.stem }}</span>
          <span v-if="q.chips.length" class="mt-2 flex flex-wrap gap-1.5">
            <span
              v-for="(chip, i) in q.chips"
              :key="i"
              class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
              >{{ chip }}</span
            >
          </span>
          <span class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
            <span class="font-semibold text-red-600"
              >{{ formatNumber(q.wrongPct, { decimals: 1 }) }}% salah</span
            >
            <span>{{ q.attempts }} pelajar cuba</span>
            <span>{{ formatNumber(q.pupilsPct, { decimals: 1 }) }}% pelajar terlibat</span>
          </span>
          <span v-if="q.wrongPupils.length > 0" class="mt-2 block text-xs text-indigo-600">
            {{ q.wrongPupils.length }} pelajar salah — klik untuk lihat
          </span>
        </button>

        <div
          v-if="open.has(q.questionId)"
          class="mt-3 space-y-3 border-t border-slate-100 pt-3"
          :data-testid="`question-detail-${q.questionId}`"
        >
          <div class="rounded-lg bg-green-100 p-3 text-sm">
            <p class="text-xs font-semibold text-green-800">Jawapan Betul</p>
            <p class="mt-1 text-slate-800">
              <span
                class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-green-600 text-xs font-bold text-white"
                >{{ q.correctOption.letter }}</span
              >{{ q.correctOption.text }}
            </p>
          </div>
          <div v-if="q.popularWrongOption" class="rounded-lg bg-amber-100 p-3 text-sm">
            <p class="text-xs font-semibold text-amber-800">
              Jawapan Salah Paling Popular ({{ q.popularWrongCount }}x dipilih)
            </p>
            <p class="mt-1 text-slate-800">
              <span
                class="mr-2 inline-flex h-6 w-6 items-center justify-center rounded bg-amber-600 text-xs font-bold text-white"
                >{{ q.popularWrongOption.letter }}</span
              >{{ q.popularWrongOption.text }}
            </p>
          </div>
          <div v-if="q.wrongPupils.length > 0">
            <p class="mb-2 text-xs font-semibold text-slate-600">Pelajar Yang Salah</p>
            <div class="flex flex-wrap gap-2">
              <RouterLink
                v-for="p in q.wrongPupils"
                :key="p.userId"
                :to="`/prestasi/${p.userId}`"
                class="inline-flex min-h-11 items-center gap-1 rounded-full bg-red-100 px-3 text-xs text-red-800"
              >
                <User class="h-3.5 w-3.5" />{{ p.name }} · {{ p.classLabel }} · {{ p.wrongOption }}
              </RouterLink>
            </div>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
