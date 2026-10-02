<script setup lang="ts">
/**
 * S7 headcount modal (FN-M17-5.4.9, FR-M57): "HeadCount: {subjek}", the tiles "Pelajar", "Purata TOV",
 * "Purata ETR", "Kadar Lulus" and the table "#", "Pelajar", "TOV", "ETR", "RS", "Gred" (A+/A/A- emerald,
 * D/E/G rose, else amber). Error copy "Ralat".
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCcHeadcount } from '../../api/command-center'
import { CC_TABLE as T, gradeTone, score2, TONE_TEXT } from './cc-format'
import CcModal from './CcModal.vue'
import CcModalStats from './CcModalStats.vue'

const props = defineProps<{ configId: number; subject: string }>()
const emit = defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCcHeadcount(props.configId, { signal }))

const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Pelajar', value: String(d.totalStudents) },
    { label: 'Purata TOV', value: String(d.avgTov) },
    { label: 'Purata ETR', value: String(d.avgEtr) },
    { label: 'Kadar Lulus', value: `${String(d.passRate)}%` },
  ]
})
const COLUMNS = ['#', 'Pelajar', 'TOV', 'ETR', 'RS', 'Gred']
</script>

<template>
  <CcModal :title="`HeadCount: ${subject}`" testid="cc-headcount-modal" @close="emit('close')">
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-modal-error">Ralat</p>
    <p v-else-if="!data" class="text-sm text-slate-400" data-testid="cc-modal-loading">
      Memuatkan...
    </p>
    <template v-else>
      <CcModalStats :stats="stats" />
      <div class="mt-4 overflow-x-auto" data-testid="cc-headcount-scroller">
        <table :class="[T.table, 'min-w-[420px]']" data-testid="cc-headcount-table">
          <thead>
            <tr>
              <th v-for="c in COLUMNS" :key="c" :class="T.th">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(s, i) in data.students"
              :key="s.userId"
              :class="T.row"
              data-testid="cc-headcount-student"
            >
              <td :class="T.td">{{ i + 1 }}</td>
              <td :class="T.td">{{ s.name }}</td>
              <td :class="[T.td, 'font-mono']">{{ score2(s.tov) }}</td>
              <td :class="[T.td, 'font-mono']">{{ score2(s.etr) }}</td>
              <td :class="[T.td, 'font-mono']">{{ score2(s.rs) }}</td>
              <td :class="[T.td, 'font-semibold', TONE_TEXT[gradeTone(s.grade)]]">
                {{ s.grade ?? '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </CcModal>
</template>
