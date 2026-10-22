<script setup lang="ts">
/** S23 card "Penglibatan Latih Tubi (Kombo)" (design 4.1 item 4): four figures, two per row below `lg`. */
import { computed } from 'vue'

import { DsGrid, DsGridItem, DsPanel, DsStack, DsText } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranKombo } from '../../api/amaran'
import { formatAvg } from './ringkasan-format'

const props = defineProps<{ kombo: AmaranKombo }>()

const figures = computed(() => [
  { key: 'avg', label: 'Purata Kombo', value: formatAvg(props.kombo.avg) },
  { key: 'max', label: 'Kombo Tertinggi', value: formatCount(props.kombo.max) },
  { key: 'active', label: 'Pelajar Aktif Kombo', value: formatCount(props.kombo.active) },
  { key: 'today', label: 'Aktif Hari Ini', value: formatCount(props.kombo.today) },
])
</script>

<template>
  <DsPanel title="Penglibatan Latih Tubi (Kombo)" class="break-inside-avoid" data-testid="rk-kombo">
    <DsGrid as="ul" :cols="{ base: 2, lg: 4 }">
      <DsGridItem v-for="f in figures" :key="f.key" as="li">
        <DsStack gap="2xs">
          <DsText variant="body" tone="muted">{{ f.label }}</DsText>
          <DsText variant="heading" tabular :data-testid="`rk-kombo-${f.key}`">{{ f.value }}</DsText>
        </DsStack>
      </DsGridItem>
    </DsGrid>
  </DsPanel>
</template>
