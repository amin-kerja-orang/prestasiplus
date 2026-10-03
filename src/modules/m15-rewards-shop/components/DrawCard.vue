<script setup lang="ts">
/**
 * One open-draw card (FR-M15-55, FR-M15-56; URS FN-M15-7.1.3, 7.1.4; layout and copy PROPOSED).
 * "🎟️ Beli Tiket" is disabled when the balance is below the ticket price or the cap is reached.
 */
import { computed } from 'vue'

import type { OpenDrawView } from '../api'
import { DRAW_COPY } from './copy'
import { formatDate } from './format'

const props = defineProps<{ draw: OpenDrawView; syilingBalance: number; busy: boolean }>()
defineEmits<{ buy: [drawId: number] }>()

const canBuy = computed(
  () =>
    props.syilingBalance >= props.draw.ticketCostSyiling &&
    props.draw.ticketsOwned < props.draw.maxTicketsPerStudent,
)
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:p-5"
    :data-testid="`draw-${String(draw.id)}`"
  >
    <div class="min-w-0">
      <h3 class="font-heading text-lg font-bold break-words text-slate-800">{{ draw.title }}</h3>
      <p v-if="draw.description" class="mt-1 text-sm break-words text-slate-600">
        {{ draw.description }}
      </p>
    </div>
    <dl class="grid gap-1 text-sm text-slate-700 sm:grid-cols-3">
      <div data-testid="draw-price">Harga tiket: {{ draw.ticketCostSyiling }} 🪙</div>
      <div data-testid="draw-owned">
        Tiket anda: {{ draw.ticketsOwned }}/{{ draw.maxTicketsPerStudent }}
      </div>
      <div v-if="draw.closesAt" data-testid="draw-closes">
        Tutup: {{ formatDate(draw.closesAt) }}
      </div>
    </dl>
    <ul v-if="draw.prizePool.length > 0" class="space-y-1 text-sm text-slate-700">
      <li v-for="(p, i) in draw.prizePool" :key="i" data-testid="draw-prize">
        {{ p.label }} × {{ p.qty }}
      </li>
    </ul>
    <button
      type="button"
      class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-linear-to-r from-indigo-600 to-fuchsia-600 px-6 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:self-start"
      :disabled="!canBuy || busy"
      data-testid="draw-buy"
      @click="$emit('buy', draw.id)"
    >
      {{ DRAW_COPY.buy }}
    </button>
  </article>
</template>
