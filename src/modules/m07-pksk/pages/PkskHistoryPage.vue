<script setup lang="ts">
/**
 * S4 `/pksk/level/:level/history` "Sejarah PKSK - {L}" (M07-T2; FR-M07-14, FR-M07-15; DV-M07-01,
 * PROPOSED COPY, L-4: live answers HTTP 500). Read-only table of the user's completed full exams,
 * newest first. Provisional page.
 */
import { computed, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { formatDate } from '@/lib/time'

import { fetchPkskExamAttempts } from '../api/pksk'
import type { PkskLevel } from '../api/types'
import BackLink from '../components/BackLink.vue'
import LoadError from '../components/LoadError.vue'
import { isLoadError, usePkskData } from '../lib/load'

const props = defineProps<{ level: PkskLevel }>()

const pageMeta = usePageMeta()
watch(
  () => props.level,
  (level) => {
    pageMeta.setHeader({ title: `Sejarah PKSK - ${level}`, subtitle: 'Lihat prestasi lepas' })
  },
  { immediate: true },
)

const { data, error, reload } = usePkskData(
  (signal) => fetchPkskExamAttempts(props.level, { signal }),
  [() => props.level],
)
const loadFailed = computed(() => isLoadError(error.value))
</script>

<template>
  <div class="min-w-0 space-y-6" data-testid="pksk-history" data-provisional="L-4">
    <BackLink :to="`/pksk/level/${level}`" label="Kembali ke Dashboard" />

    <LoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <p
        v-if="data.length === 0"
        class="rounded-2xl bg-white p-6 text-center text-slate-600 shadow-sm"
        data-testid="history-empty"
      >
        Tiada sejarah peperiksaan.
      </p>
      <div v-else class="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table class="w-full text-left text-sm" data-testid="history-table">
          <thead class="bg-slate-50 text-slate-600">
            <tr>
              <th class="px-4 py-3 font-semibold">Tarikh</th>
              <th class="px-4 py-3 font-semibold">Skor</th>
              <th class="px-4 py-3 font-semibold">Gred</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="a in data"
              :key="a.id"
              class="border-t border-slate-100"
              data-testid="history-row"
            >
              <td class="px-4 py-3">{{ formatDate(a.completedAt) }}</td>
              <td class="px-4 py-3">{{ Math.round(a.scorePct) }}%</td>
              <td class="px-4 py-3 font-bold">{{ a.grade }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
