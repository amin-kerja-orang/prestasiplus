<script setup lang="ts">
/**
 * "Lencana: {nama}" (FR-M10-25, BR-M10-16): "Memuatkan senarai pelajar...", "{n} pelajar memiliki lencana
 * ini" and the table # · Pelajar · Ketepatan · Tarikh Anugerah, or "Belum ada pelajar yang memiliki lencana ini.".
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { formatMyt } from '@/lib/time'

import { fetchBadgeHolders } from '../../api/command-center'
import CcDialog from './CcDialog.vue'
import CcTable from './CcTable.vue'
import { useOpenTab } from './composables'
import { accuracyTone, S2_COPY, studentPath } from './copy'
import type { DrillRow } from './drill-table'

const props = defineProps<{ badge: { id: number; name: string } }>()
defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchBadgeHolders(props.badge.id, { signal }))
const openTab = useOpenTab()
const HEADERS = ['#', 'Pelajar', 'Ketepatan', 'Tarikh Anugerah']
const rows = computed<DrillRow[]>(() =>
  (data.value?.holders ?? []).map((h, i) => ({
    studentId: h.studentId,
    cells: [
      { text: String(i + 1) },
      { text: h.name },
      { text: `${String(h.accuracy)}%`, tone: accuracyTone(h.accuracy), mono: true },
      { text: formatMyt(h.awardedAt, 'dd/MM/yyyy') },
    ],
  })),
)
</script>

<template>
  <CcDialog
    :title="`Lencana: ${data?.badge.name ?? badge.name}`"
    testid="cc-holders-modal"
    @close="$emit('close')"
  >
    <p v-if="error" class="text-body text-error">{{ S2_COPY.loadFailed }}</p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-holders-loading">
      Memuatkan senarai pelajar...
    </p>
    <template v-else>
      <p class="text-body text-muted" data-testid="cc-holders-desc">
        {{ data.badge.description }}
      </p>
      <p
        v-if="data.holders.length === 0"
        class="text-body text-highlighted"
        data-testid="cc-holders-empty"
      >
        Belum ada pelajar yang memiliki lencana ini.
      </p>
      <template v-else>
        <p class="text-label text-toned" data-testid="cc-holders-count">
          {{ data.holders.length }} pelajar memiliki lencana ini
        </p>
        <CcTable
          :headers="HEADERS"
          :rows="rows"
          testid="cc-holders-table"
          row-testid="cc-holders-row"
          :caption="`Lencana: ${data.badge.name}`"
          @open="openTab(studentPath($event))"
        />
      </template>
    </template>
  </CcDialog>
</template>
