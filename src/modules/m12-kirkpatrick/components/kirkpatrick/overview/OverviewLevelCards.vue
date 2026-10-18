<script setup lang="ts">
/**
 * S1 level tiles (FN-M12-2.2.1..2.2.5; FR-M12-20..23, 92): `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, order
 * T4, T3, T2, T1, each a link with a kobalt icon chip, label, value, caption and "Lihat detail". `detail`
 * off (the school-administrator alias, S1 only) renders them as plain boxes without the "Lihat detail" line.
 */
import { computed } from 'vue'

import { DsIconChip } from '@/ds'

import type { Overview } from '../../../api/types'
import { count, gps, KirkpatrickLink, mean, pct, plain, type KirkpatrickPaths } from '../common'

const props = defineProps<{ data: Overview; paths: KirkpatrickPaths; detail: boolean }>()

const to = (path: string) => (props.detail ? path : null)

interface Level {
  key: string
  label: string
  icon: string
  to: string | null
  value: string
  suffix?: string
  caption: string
  muted?: boolean
}

const levels = computed<Level[]>(() => {
  const d = props.data
  return [
    d.t4.gps === null
      ? {
          key: 't4',
          label: 'Tahap 4: Hasil',
          icon: 'i-ph-trophy',
          to: to(props.paths.results),
          value: 'Belum Ada Data',
          caption: 'Import keputusan peperiksaan',
          muted: true,
        }
      : {
          key: 't4',
          label: 'Tahap 4: Hasil',
          icon: 'i-ph-trophy',
          to: to(props.paths.results),
          value: gps(d.t4.gps),
          caption: `GPS Sekolah · ${plain(d.t4.recordsLabel)} rekod headcount`,
        },
    {
      key: 't3',
      label: 'Tahap 3: Tingkah Laku',
      icon: 'i-ph-footprints',
      to: to(props.paths.behavior),
      value: plain(d.t3.active),
      suffix: `/${plain(d.t3.t4t5)}`,
      caption: `Pelajar aktif · ${plain(d.t3.sessions)} sesi · ${pct(d.t3.accuracy)} ketepatan`,
    },
    {
      key: 't2',
      label: 'Tahap 2: Pembelajaran',
      icon: 'i-ph-brain',
      to: to(props.paths.learning),
      value: pct(d.t2.accuracy),
      caption: `Ketepatan · ${count(d.t2.answers)} soalan dijawab`,
    },
    {
      key: 't1',
      label: 'Tahap 1: Reaksi',
      icon: 'i-ph-smiley',
      to: to(props.paths.reaction),
      value: mean(d.t1.satisfaction),
      suffix: '/5',
      caption: `Kepuasan purata · ${plain(d.t1.responses)} respon`,
    },
  ]
})
</script>

<template>
  <div
    class="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-4"
    data-testid="kirk-levels"
  >
    <KirkpatrickLink
      v-for="l in levels"
      :key="l.key"
      :to="l.to"
      class="block min-w-0"
      :data-testid="`kirk-level-${l.key}`"
    >
      <UCard class="h-full">
        <div class="flex items-start justify-between gap-2">
          <p class="text-label text-muted">{{ l.label }}</p>
          <DsIconChip :icon="l.icon" size="sm" />
        </div>
        <p
          :class="['tabular mt-2 text-title', l.muted ? 'text-dimmed' : 'text-highlighted']"
          data-testid="kirk-level-value"
        >
          {{ l.value }}<span v-if="l.suffix" class="text-label text-muted">{{ l.suffix }}</span>
        </p>
        <p class="text-body text-muted" data-testid="kirk-level-caption">{{ l.caption }}</p>
        <p v-if="detail" class="mt-2 flex items-center gap-1 text-body text-primary-t">
          Lihat detail <UIcon name="i-ph-arrow-right" class="size-4" />
        </p>
      </UCard>
    </KirkpatrickLink>
  </div>
</template>
