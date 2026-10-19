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
import { accuracyTone, studentPath } from './copy'
import type { DrillRow } from './drill-table'
import { DsText } from '@/ds'

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
    <DsText v-if="error" variant="body" tone="error">Ralat: {{ error.message }}</DsText>
    <DsText v-else-if="!data" variant="body" tone="muted" data-testid="cc-holders-loading">
      Memuatkan senarai pelajar...
    </DsText>
    <template v-else>
      <DsText variant="body" tone="muted" data-testid="cc-holders-desc">
        {{ data.badge.description }}
      </DsText>
      <DsText
        v-if="data.holders.length === 0"
        variant="body"
        tone="highlighted"
        data-testid="cc-holders-empty"
      >
        Belum ada pelajar yang memiliki lencana ini.
      </DsText>
      <template v-else>
        <DsText variant="label" as="p" tone="toned" data-testid="cc-holders-count">
          {{ data.holders.length }} pelajar memiliki lencana ini
        </DsText>
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
