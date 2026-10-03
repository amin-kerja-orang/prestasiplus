<script setup lang="ts">
/**
 * "Lencana: {nama}" (FR-M10-25, BR-M10-16): "Memuatkan senarai pelajar...", "{n} pelajar memiliki lencana
 * ini" and the table # · Pelajar · Ketepatan · Tarikh Anugerah, or "Belum ada pelajar yang memiliki lencana ini.".
 */
import { useApi } from '@/composables'
import { formatMyt } from '@/lib/time'

import { fetchBadgeHolders } from '../../api/command-center'
import { useOpenTab } from './composables'
import { accuracyTone, studentPath, TBL } from './copy'
import DarkModal from './DarkModal.vue'

const props = defineProps<{ badge: { id: number; name: string } }>()
defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchBadgeHolders(props.badge.id, { signal }))
const openTab = useOpenTab()
const HEADERS = ['#', 'Pelajar', 'Ketepatan', 'Tarikh Anugerah']
</script>

<template>
  <DarkModal
    :title="`Lencana: ${data?.badge.name ?? badge.name}`"
    testid="cc-holders-modal"
    stacked
    @close="$emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-holders-loading">
      Memuatkan senarai pelajar...
    </p>
    <template v-else>
      <p class="mb-2 text-sm text-slate-400" data-testid="cc-holders-desc">
        {{ data.badge.description }}
      </p>
      <p
        v-if="data.holders.length === 0"
        class="text-base text-slate-50"
        data-testid="cc-holders-empty"
      >
        Belum ada pelajar yang memiliki lencana ini.
      </p>
      <template v-else>
        <p class="mb-2 text-sm font-semibold text-slate-200" data-testid="cc-holders-count">
          {{ data.holders.length }} pelajar memiliki lencana ini
        </p>
        <div :class="TBL.wrap">
          <table :class="TBL.table" data-testid="cc-holders-table">
            <thead>
              <tr>
                <th v-for="h in HEADERS" :key="h" :class="TBL.th">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(h, i) in data.holders"
                :key="h.studentId"
                :class="[TBL.row, TBL.link]"
                data-testid="cc-holders-row"
                @click="openTab(studentPath(h.studentId))"
              >
                <td :class="TBL.td">{{ i + 1 }}</td>
                <td :class="[TBL.td, 'text-slate-50']">{{ h.name }}</td>
                <td :class="[TBL.td, 'font-mono', accuracyTone(h.accuracy)]">{{ h.accuracy }}%</td>
                <td :class="TBL.td">{{ formatMyt(h.awardedAt, 'dd/MM/yyyy') }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </DarkModal>
</template>
