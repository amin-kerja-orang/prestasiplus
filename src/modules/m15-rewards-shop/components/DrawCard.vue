<script setup lang="ts">
/**
 * One open-draw card (FR-M15-55, FR-M15-56; URS FN-M15-7.1.3, 7.1.4; layout and copy PROPOSED).
 * "🎟️ Beli Tiket" is disabled when the balance is below the ticket price or the cap is reached.
 */
import { computed } from 'vue'

import { DsCluster, DsIconChip, DsRewardChip, DsStack, DsText } from '@/ds'

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
  <UCard :data-testid="`draw-${String(draw.id)}`">
    <article class="flex min-w-0 flex-col gap-3">
      <div class="flex min-w-0 items-start gap-3">
        <DsIconChip icon="ticket" accent="heat" size="lg" />
        <div class="flex min-w-0 flex-col gap-1">
          <h3 class="text-heading break-words text-highlighted">{{ draw.title }}</h3>
          <p v-if="draw.description" class="text-body break-words text-muted">
            {{ draw.description }}
          </p>
        </div>
      </div>
      <dl class="grid gap-2 text-body text-default sm:grid-cols-3">
        <div class="flex items-center gap-2" data-testid="draw-price">
          Harga tiket:
          <DsRewardChip :value="draw.ticketCostSyiling" art="coin" />
        </div>
        <div v-if="draw.closesAt" data-testid="draw-closes">
          Tutup: {{ formatDate(draw.closesAt) }}
        </div>
      </dl>
      <DsStack gap="2xs" data-testid="draw-fairness">
        <DsText variant="caption" tone="muted" data-testid="draw-fair-equal">{{ DRAW_COPY.fairEqual }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="draw-owned">{{ DRAW_COPY.ticketsOwned(draw.ticketsOwned, draw.maxTicketsPerStudent) }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="draw-sold">{{ DRAW_COPY.ticketsSold(draw.ticketsSold) }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="draw-coin-note">{{ DRAW_COPY.coinNote }}</DsText>
      </DsStack>
      <ul v-if="draw.prizePool.length > 0" class="flex flex-wrap gap-2">
        <li v-for="(p, i) in draw.prizePool" :key="i" data-testid="draw-prize">
          <UBadge color="neutral" variant="soft" size="lg">{{ p.label }} × {{ p.qty }}</UBadge>
        </li>
      </ul>
      <DsCluster gap="sm">
        <UButton
          size="xl"
          class="min-h-14 w-full justify-center sm:w-auto sm:self-start"
          :disabled="!canBuy || busy"
          data-testid="draw-buy"
          @click="$emit('buy', draw.id)"
        >
          {{ DRAW_COPY.buy }}
        </UButton>
        <DsText variant="label" tone="default" data-testid="draw-counter">{{ DRAW_COPY.counter(draw.ticketsOwned, draw.maxTicketsPerStudent) }}</DsText>
      </DsCluster>
    </article>
  </UCard>
</template>
