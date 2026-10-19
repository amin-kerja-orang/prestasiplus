<script setup lang="ts">
/**
 * S6 "Peta Aktiviti (90 Hari)" (FR-M08-42): 90 cells, oldest first, coloured by BR-M08-11 buckets (a five-step
 * ramp from `bg-elevated` to `bg-primary`). `mouseenter` sets and a mouse leaving clears the active day,
 * `click` toggles it; the active day shows the tooltip "{dd/mm} ({hari}) — Tiada aktiviti | {n} sesi".
 */
import { DsPanel, DsStack, DsCluster } from '@/ds'
import { computed, ref } from 'vue'

import type { StudentPerformance } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { HEAT_RAMP, dayLabel, heatClass } from '../../lib/analitik'

const props = defineProps<{ days: StudentPerformance['heatmap'] }>()

const icon = usePhIcon()

/**
 * `hover` follows the pointer (mouseenter sets, mouseleave clears); `pinned` is the click toggle. A tap on
 * a touch screen fires mouseenter and then click, so on live a single `activeDay` would hide the tooltip
 * the tap just opened; keeping both makes click and hover each work (D9, touch).
 */
const hover = ref('')
const pinned = ref('')
const activeDay = computed(() => hover.value || pinned.value)
const tooltip = computed(() => {
  const d = props.days.find((x) => x.date === activeDay.value)
  return d ? dayLabel(d.date, d.sessions) : ''
})
/** A mouse leaving clears the day as on live (FR-M08-42); a touch tap keeps its pin. */
const leave = (e: PointerEvent): void => {
  hover.value = ''
  if (e.pointerType === 'mouse') pinned.value = ''
}
const toggle = (date: string): void => {
  if (pinned.value === date) {
    pinned.value = ''
    hover.value = ''
  } else {
    pinned.value = date
    hover.value = date
  }
}

const LEGEND = ['0', '1-1', '2-2', '3-3', '4+']
</script>

<template>
  <DsPanel data-testid="heatmap-card">
    <DsStack>
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon :name="icon('calendar-dots')" class="size-5 text-primary-t" />Peta Aktiviti (90 Hari)
      </h2>
      <DsCluster gap="2xs" align="stretch" data-testid="heatmap">
        <UButton
          v-for="d in days"
          :key="d.date"
          type="button"
          color="neutral"
          variant="ghost"
          size="xs"
          square
          class="size-6 p-0"
          :class="activeDay === d.date ? 'bg-default' : heatClass(d.sessions)"
          :aria-label="dayLabel(d.date, d.sessions)"
          :aria-pressed="pinned === d.date"
          :data-date="d.date"
          data-testid="heat-cell"
          @mouseenter="hover = d.date"
          @pointerleave="leave"
          @click="toggle(d.date)"
        />
      </DsCluster>
      <p
        v-if="tooltip"
        class="inline-flex items-center gap-2 self-start bg-elevated p-3 text-caption text-highlighted"
        data-testid="heat-tooltip"
      >
        <UIcon :name="icon('clock')" class="size-4" />{{ tooltip }}
      </p>
      <div class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
        <template v-for="(label, i) in LEGEND" :key="label">
          <span>{{ label }}</span>
          <span
            :class="[HEAT_RAMP[i] ?? 'bg-elevated', 'inline-block size-4']"
            aria-hidden="true"
          />
        </template>
        <span class="text-dimmed">sesi/hari</span>
      </div>
    </DsStack>
  </DsPanel>
</template>
