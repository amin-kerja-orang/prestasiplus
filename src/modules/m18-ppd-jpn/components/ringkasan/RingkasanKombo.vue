<script setup lang="ts">
/** S23 card "Penglibatan Latih Tubi (Kombo)" (design 4.1 item 4): four figures, two per row below `lg`. */
import { computed } from 'vue'

import { DsPanel } from '@/ds'
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
  <DsPanel class="break-inside-avoid" data-testid="rk-kombo">
    <h2 class="text-subheading text-highlighted">Penglibatan Latih Tubi (Kombo)</h2>
    <dl class="mt-3 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div v-for="f in figures" :key="f.key" class="flex min-w-0 flex-col gap-1">
        <dt class="text-body text-muted">{{ f.label }}</dt>
        <dd class="tabular text-heading text-highlighted" :data-testid="`rk-kombo-${f.key}`">
          {{ f.value }}
        </dd>
      </div>
    </dl>
  </DsPanel>
</template>
