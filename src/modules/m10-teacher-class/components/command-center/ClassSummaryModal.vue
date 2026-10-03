<script setup lang="ts">
/**
 * "👩‍🏫 Kelas" -> "Kelas Saya — Ringkasan Prestasi" (FR-M10-20, FN-M10-2.2.8): fetches `live-data` again,
 * three cards and the class table; a class row opens the mounted M17 class page in a new tab.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'

import { fetchCommandCenterLiveData } from '../../api/command-center'
import { useOpenTab } from './composables'
import { accuracyTone, classPath, TBL } from './copy'
import DarkModal from './DarkModal.vue'
import StatCards from './StatCards.vue'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterLiveData({ signal }))
const openTab = useOpenTab()
const cards = computed(() => {
  const d = data.value
  return [
    { label: 'Jumlah Pelajar', value: String(d?.totalStudentsRaw ?? 0), tone: 'text-indigo-300' },
    { label: 'Aktif', value: String(d?.activeStudentsRaw ?? 0), tone: 'text-emerald-300' },
    { label: 'Ketepatan', value: `${String(d?.accuracy ?? 0)}%`, tone: 'text-amber-300' },
  ]
})
const HEADERS = ['#', 'Kelas', 'Tingkatan', 'Pelajar', 'Aktif', 'Ketepatan']
</script>

<template>
  <DarkModal
    title="Kelas Saya — Ringkasan Prestasi"
    testid="cc-kelas-modal"
    @close="$emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-modal-loading">
      Menganalisis prestasi guru...
    </p>
    <template v-else>
      <StatCards :cards="cards" cols="grid-cols-3" />
      <div :class="[TBL.wrap, 'mt-4']">
        <table :class="TBL.table" data-testid="cc-kelas-table">
          <thead>
            <tr>
              <th v-for="h in HEADERS" :key="h" :class="TBL.th">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, i) in data.classes"
              :key="c.id"
              :class="[TBL.row, TBL.link]"
              data-testid="cc-kelas-row"
              @click="openTab(classPath(c.id))"
            >
              <td :class="TBL.td">{{ i + 1 }}</td>
              <td :class="[TBL.td, 'text-slate-50']">{{ c.name }}</td>
              <td :class="TBL.td">{{ c.educationLevel }}</td>
              <td :class="[TBL.td, 'font-mono']">{{ c.studentCount }}</td>
              <td :class="[TBL.td, 'font-mono']">{{ c.active }}</td>
              <td :class="[TBL.td, 'font-mono', accuracyTone(c.accuracy)]">{{ c.accuracy }}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </DarkModal>
</template>
