<script setup lang="ts">
/**
 * The four level cards of S6 (FN-M12-7.2.1 ... 7.2.5; FR-M12-62 ... 66): one column below `lg` (vertical
 * chain), four from `lg` with an arrow between the cards. The level badge is success for T1, T2 and warning
 * for T3, T4 as observed (words and `data-tone` carry the meaning, not colour alone). The T3 consistency
 * labels are the English ones of live (DV-M12-18 rejected).
 */
import { computed } from 'vue'

import type { Chain } from '../../../api/types'
import { count, gps, mean, pct, plain, type KirkColor } from '../common/kirkpatrick-format'

const props = defineProps<{ chain: Chain }>()

const LABELS: Record<string, string> = {
  champion: 'Juara',
  konsisten: 'Konsisten',
  berkembang: 'Berkembang',
  minimum: 'Minimum',
  tidakTerlibat: 'Tidak Terlibat',
}

interface Step {
  key: string
  tag: string
  title: string
  sub: string
  color: KirkColor
  rows: { label: string; value: string }[]
}

const steps = computed<Step[]>(() => {
  const c = props.chain
  return [
    {
      key: 't1',
      tag: 'T1',
      title: 'Reaksi',
      sub: 'Kepuasan pengguna terhadap Prestasi Plus',
      color: 'success',
      rows: [
        { label: 'NPS Purata', value: `${mean(c.t1.nps)}/10` },
        { label: 'Kepuasan', value: `${mean(c.t1.satisfaction)}/5` },
        { label: 'Responden', value: plain(c.t1.responses) },
      ],
    },
    {
      key: 't2',
      tag: 'T2',
      title: 'Pembelajaran',
      sub: 'Perkembangan akademik melalui Head Count',
      color: 'success',
      rows: [
        { label: 'Ketepatan', value: pct(c.t2.accuracy) },
        { label: 'Soalan Dijawab', value: count(c.t2.answers) },
        { label: 'Skor Purata', value: pct(c.t2.avgScore) },
      ],
    },
    {
      key: 't3',
      tag: 'T3',
      title: 'Tingkah Laku',
      sub: 'Konsistensi penggunaan platform (Mastery Learning)',
      color: 'warning',
      rows: [
        {
          label: 'Pelajar Aktif',
          value: `${plain(c.t3.active)}/${plain(c.t3.t4t5)} (${pct(c.t3.pct)})`,
        },
        { label: 'Sesi Latihan', value: count(c.t3.sessions) },
      ],
    },
    {
      key: 't4',
      tag: 'T4',
      title: 'Hasil / Impak',
      sub: 'Korelasi penggunaan dengan pencapaian',
      color: 'warning',
      rows: [
        { label: 'GPS', value: c.t4.gps === null ? '-' : gps(c.t4.gps) },
        { label: 'Korelasi (r)', value: String(c.t4.r) },
        { label: 'Kekuatan', value: String(c.t4.strength) },
      ],
    },
  ]
})
</script>

<template>
  <div class="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-2" data-testid="chain-cards">
    <template v-for="(s, i) in steps" :key="s.key">
      <UCard class="min-w-0 flex-1" :data-testid="`chain-${s.key}`" :data-tone="s.color">
        <template #header>
          <div class="flex items-start gap-3">
            <UBadge :color="s.color" variant="soft" :label="s.tag" />
            <div class="flex min-w-0 flex-col gap-1">
              <h2 class="text-label text-highlighted">{{ s.title }}</h2>
              <p class="text-body text-muted">{{ s.sub }}</p>
            </div>
          </div>
        </template>
        <dl class="flex flex-col gap-2">
          <div
            v-for="r in s.rows"
            :key="r.label"
            class="flex items-baseline justify-between gap-3 text-label"
          >
            <dt class="text-muted">{{ r.label }}</dt>
            <dd class="tabular text-right text-highlighted" data-testid="chain-value">
              {{ r.value }}
            </dd>
          </div>
        </dl>
        <template v-if="s.key === 't3'">
          <p class="mt-3 text-body text-muted">Taburan Konsistensi:</p>
          <ul class="mt-1 flex flex-col gap-1 text-body text-default" data-testid="chain-bands">
            <li
              v-for="b in chain.t3.bands"
              :key="b.key"
              class="flex justify-between gap-3"
              :data-band="b.key"
            >
              <span>{{ LABELS[b.key] }}</span
              ><span class="tabular text-highlighted">{{ plain(b.count) }}</span>
            </li>
          </ul>
        </template>
      </UCard>
      <div
        v-if="i < steps.length - 1"
        class="hidden items-center text-dimmed lg:flex"
        data-testid="chain-arrow"
      >
        <UIcon name="i-ph-arrow-right" class="size-5" />
      </div>
    </template>
  </div>
</template>
