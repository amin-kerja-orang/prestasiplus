<script setup lang="ts">
/**
 * S4 `/practice/chapter` "Soalan by Chapter" (M05-T5; FR-M05-57, 58, BR-15; roles-matrix L14 for
 * Murid and Guru: there is no role rule). Hero "Mode Sistematik" with "Latih Tubi Rawak" and one
 * card per chapter subject (#7; grid 1 / `sm` 2 / `xl` 3) linking to S5. The subject name truncates
 * when long, as live. DV-M05-15: "Latih Tubi Rawak" is 44 px high below `lg`.
 */
import { ChevronRight, Shuffle } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchChapterSubjects } from '../api/practice'
import SubjectIcon from '../components/quiz/SubjectIcon.vue'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchChapterSubjects({ signal }))
const subjects = computed(() => data.value?.data ?? [])
</script>

<template>
  <div class="space-y-6" data-testid="chapter-index-page">
    <div
      class="rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-6 text-white shadow-xl sm:p-8"
      data-testid="chapter-hero"
    >
      <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs font-black tracking-[0.3em] text-cyan-100 uppercase">Mode Sistematik</p>
          <h1 class="mt-2 font-heading text-2xl font-black sm:text-4xl">Soalan by Chapter</h1>
          <p class="mt-3 max-w-2xl text-sm text-cyan-50 sm:text-base">
            Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap
            dan mencapai sekurang-kurangnya 70%.
          </p>
        </div>
        <RouterLink
          to="/practice"
          class="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm font-bold transition hover:bg-white/25 max-lg:min-h-11"
          data-testid="chapter-random"
        >
          <Shuffle class="mr-2 h-4 w-4" /> Latih Tubi Rawak
        </RouterLink>
      </div>
    </div>

    <div
      v-if="data"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      data-testid="chapter-subject-grid"
    >
      <RouterLink
        v-for="s in subjects"
        :key="s.code"
        :to="`/practice/chapter/${s.code}`"
        class="group rounded-3xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
        :data-testid="`chapter-subject-${s.code}`"
      >
        <div class="flex items-start gap-4">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg"
            :style="{ background: s.color }"
            data-testid="chapter-subject-icon"
          >
            <SubjectIcon :icon="s.icon" class="h-6 w-6 text-xl" />
          </div>
          <div class="min-w-0 flex-1">
            <h3
              class="truncate font-heading font-black text-slate-900 group-hover:text-teal-700"
              data-testid="chapter-subject-name"
            >
              {{ s.name }}
            </h3>
            <p class="mt-1 text-xs text-slate-500" data-testid="chapter-subject-chapters">
              {{ s.chapterCount }} bab tersedia
            </p>
            <p class="mt-3 text-sm font-bold text-teal-700" data-testid="chapter-subject-questions">
              {{ formatCount(s.questionCount) }} soalan chapter
            </p>
          </div>
          <ChevronRight class="mt-3 h-4 w-4 shrink-0 text-slate-300 group-hover:text-teal-500" />
        </div>
      </RouterLink>
    </div>

    <div v-else-if="error" class="max-w-xl space-y-3" data-testid="chapter-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="chapter-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>
  </div>
</template>
