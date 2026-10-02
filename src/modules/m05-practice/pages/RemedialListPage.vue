<script setup lang="ts">
/**
 * S13 `/remedial/saya` "Ujian Remedial Saya" (M05-T7; FR-M05-115, FR-M05-140, DV-M05-01).
 * Heading 🔬 + subtitle; with no test the observed empty state 🎯; otherwise one card per test
 * (PROPOSED layout, §8.3; LS-12): subject, "{n} soalan", "Daripada: {teacher}", date, status chip and,
 * for an active test, "Mula Ujian" → Q4.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatDate } from '@/lib/time'

import { fetchRemedialTests } from '../api/practice'
import { remedialChip } from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchRemedialTests({ signal }))
const items = computed(() => data.value?.data ?? [])
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8" data-testid="remedial-page">
    <div class="mx-auto max-w-3xl">
      <div class="mb-6 flex items-start gap-3" data-testid="remedial-heading">
        <span class="text-3xl" aria-hidden="true">🔬</span>
        <div class="min-w-0">
          <h1
            class="font-heading text-xl font-extrabold text-slate-900 sm:text-2xl"
            data-testid="remedial-h1"
          >
            Ujian Remedial Saya
          </h1>
          <p class="text-sm text-slate-500">Ujian khas untuk topik yang perlu diperbaiki</p>
        </div>
      </div>

      <template v-if="data">
        <div v-if="items.length === 0" class="py-12 text-center" data-testid="remedial-empty">
          <div class="mb-3 text-5xl" aria-hidden="true">🎯</div>
          <p class="text-slate-500">Tiada ujian remedial. Bagus — teruskan usaha!</p>
        </div>

        <ul v-else class="space-y-3" data-testid="remedial-list">
          <li
            v-for="t in items"
            :key="t.id"
            class="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5"
            :data-testid="`remedial-card-${String(t.id)}`"
          >
            <div class="min-w-0">
              <div class="mb-1 flex flex-wrap items-center gap-2">
                <h3
                  class="font-heading text-base font-bold break-words text-slate-800"
                  data-testid="remedial-subject"
                >
                  {{ t.subjectName }}
                </h3>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-semibold"
                  :class="remedialChip(t.status).cls"
                  data-testid="remedial-status"
                  >{{ remedialChip(t.status).label }}</span
                >
              </div>
              <p class="text-sm text-slate-600" data-testid="remedial-count">
                {{ t.totalQuestions }} soalan
              </p>
              <p class="text-xs text-slate-500" data-testid="remedial-meta">
                Daripada: {{ t.teacherName }} · {{ formatDate(t.createdAt) }}
              </p>
            </div>
            <RouterLink
              v-if="t.status === 'active'"
              :to="`/remedial/${String(t.id)}`"
              class="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-bold text-white hover:bg-indigo-700"
              data-testid="remedial-start"
            >
              Mula Ujian
            </RouterLink>
          </li>
        </ul>
      </template>

      <div v-else-if="error" class="space-y-3" data-testid="remedial-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
          data-testid="remedial-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>
    </div>
  </div>
</template>
