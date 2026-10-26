<script setup lang="ts">
/**
 * S1 "Kirkpatrick Evaluation Flow" (FN-M12-2.3.1..2.3.3; FR-M12-24, 25, 92): from `sm` four steps T1 to T4,
 * each a link with an icon chip, label, sub-label and pill; below `sm` the same four as a vertical list with
 * a caret. `detail` off renders plain boxes (the alias has no level pages).
 */
import { computed } from 'vue'

import { DsCluster, DsIconChip, DsPanel } from '@/ds'

import type { Overview } from '../../../api/types'
import { gps, KirkpatrickLink, mean, pct, plain, type KirkpatrickPaths } from '../common'

const props = defineProps<{ data: Overview; paths: KirkpatrickPaths; detail: boolean }>()

interface Step {
  key: string
  label: string
  sub: string
  pill: string
  to: string | null
  icon: string
}

const to = (path: string) => (props.detail ? path : null)

const steps = computed<Step[]>(() => [
  {
    key: 't1',
    label: 'T1: Reaksi',
    sub: 'Kepuasan pengguna',
    pill: `${mean(props.data.t1.satisfaction)}/5`,
    to: to(props.paths.reaction),
    icon: 'i-ph-smiley',
  },
  {
    key: 't2',
    label: 'T2: Pembelajaran',
    sub: 'Peningkatan kemahiran',
    pill: `${pct(props.data.t2.accuracy)} ketepatan`,
    to: to(props.paths.learning),
    icon: 'i-ph-brain',
  },
  {
    key: 't3',
    label: 'T3: Tingkah Laku',
    sub: 'Konsistensi penggunaan',
    pill: `${plain(props.data.t3.active)} pelajar aktif`,
    to: to(props.paths.behavior),
    icon: 'i-ph-footprints',
  },
  {
    key: 't4',
    label: 'T4: Hasil',
    sub: 'Keputusan peperiksaan',
    pill: `GPS ${props.data.t4.gps === null ? '-' : gps(props.data.t4.gps)}`,
    to: to(props.paths.results),
    icon: 'i-ph-trophy',
  },
])
</script>

<template>
  <DsPanel
    title="Kirkpatrick Evaluation Flow"
    description="Klik mana-mana tahap untuk lihat detail"
    icon="i-ph-flow-arrow"
    data-testid="kirk-flow"
  >
    <div class="hidden sm:block" data-testid="kirk-flow-circles">
      <div class="grid grid-cols-4 gap-2">
        <KirkpatrickLink
          v-for="s in steps"
          :key="s.key"
          :to="s.to"
          class="flex min-w-0 flex-col items-center gap-1 text-center"
          :data-testid="`kirk-flow-${s.key}`"
        >
          <DsIconChip :icon="s.icon" size="lg" />
          <span class="text-label text-highlighted">{{ s.label }}</span>
          <span class="text-body text-muted">{{ s.sub }}</span>
          <UBadge color="primary" variant="soft" :label="s.pill" data-testid="kirk-flow-pill" />
        </KirkpatrickLink>
      </div>
    </div>

    <ul class="flex flex-col gap-2 sm:hidden" data-testid="kirk-flow-list">
      <li v-for="s in steps" :key="s.key">
        <KirkpatrickLink
          :to="s.to"
          class="block min-h-11 p-2"
          :data-testid="`kirk-flow-list-${s.key}`"
        >
          <!-- Wraps: below 320 the pill and caret drop to a second line instead of overlapping the label (DV-M12-34). -->
          <DsCluster gap="sm" row-gap="2xs" align="center">
            <DsIconChip :icon="s.icon" size="sm" />
            <span class="min-w-40 flex-1">
              <span class="block text-label text-highlighted">{{ s.label }}</span>
              <span class="block text-body text-muted">{{ s.sub }}</span>
            </span>
            <span class="ms-auto shrink-0">
              <DsCluster as="span" gap="xs" :wrap="false">
                <span class="text-body text-primary-t" data-testid="kirk-flow-pill">{{
                  s.pill
                }}</span>
                <UIcon
                  v-if="s.to !== null"
                  name="i-ph-caret-right"
                  class="size-4 shrink-0 text-dimmed"
                />
              </DsCluster>
            </span>
          </DsCluster>
        </KirkpatrickLink>
      </li>
    </ul>
  </DsPanel>
</template>
