<script setup lang="ts">
/**
 * "Analisis Korelasi: Penggunaan → Pencapaian" (FN-M12-7.3.1 / 7.3.2; FR-M12-67 / 68): the three constant rows with the bar
 * (`bg-yellow-500` below 60, `bg-green-500` otherwise; DV-M12-02) and the "Kesimpulan ALESA:" box. The
 * difference is 100+ minus 1-20, one decimal, signed.
 */
import { computed } from 'vue'

import { formatNumber } from '@/lib/number'

import type { Chain } from '../../../api/types'
import { pct, plain } from '../common/kirkpatrick-format'

const props = defineProps<{
  correlation: Chain['correlation']
  strength: Chain['t4']['strength']
}>()

const low = computed(
  () =>
    props.correlation.bands.find((b) => b.label === '1-20 soalan') ?? props.correlation.bands[0],
)
const high = computed(
  () =>
    props.correlation.bands.find((b) => b.label === '100+ soalan') ??
    props.correlation.bands[props.correlation.bands.length - 1],
)
const diff = computed(() =>
  formatNumber((high.value?.acc ?? 0) - (low.value?.acc ?? 0), { decimals: 1, signed: true }),
)
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border-2 border-gray-200 bg-white p-4 sm:p-5"
    data-testid="chain-correlation"
  >
    <h2 class="mb-3 font-heading text-base font-bold text-gray-800">
      Analisis Korelasi: Penggunaan → Pencapaian
    </h2>
    <div class="overflow-x-auto">
      <table class="w-full min-w-96 text-left text-sm">
        <thead class="bg-gray-50 text-gray-700">
          <tr>
            <th class="px-3 py-2 font-semibold">Tahap Penggunaan</th>
            <th class="px-3 py-2 text-center font-semibold">Bil. Pelajar</th>
            <th class="px-3 py-2 text-center font-semibold">Purata Ketepatan</th>
            <th class="px-3 py-2 font-semibold">Visual</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in correlation.bands"
            :key="b.label"
            class="border-t border-gray-200"
            data-testid="corr-row"
          >
            <td class="px-3 py-2 text-gray-700">{{ b.label }}</td>
            <td class="px-3 py-2 text-center text-gray-600">{{ plain(b.n) }}</td>
            <td class="px-3 py-2 text-center font-medium text-gray-700">{{ pct(b.acc) }}</td>
            <td class="px-3 py-2">
              <div class="h-3 w-28 overflow-hidden rounded-full bg-gray-100">
                <div
                  :class="['h-3 rounded-full', b.acc < 60 ? 'bg-yellow-500' : 'bg-green-500']"
                  :style="{ width: `${b.acc}%` }"
                  data-testid="corr-bar"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p
      class="mt-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-700"
      data-testid="corr-conclusion"
    >
      <strong>Kesimpulan ALESA:</strong> Pelajar yang menjawab 100+ soalan mencapai ketepatan
      {{ pct(high?.acc ?? 0) }}, berbanding {{ pct(low?.acc ?? 0) }} bagi pelajar dengan kurang 20
      soalan (perbezaan {{ diff }}%). Korelasi Pearson antara penggunaan dan ketepatan: r =
      {{ correlation.r }} ({{ strength }}).
    </p>
  </section>
</template>
