<script setup lang="ts">
/**
 * One open-draw card (FR-M15-55, FR-M15-56; URS FN-M15-7.1.3, 7.1.4; layout and copy PROPOSED).
 * "🎟️ Beli Tiket" is disabled when the balance is below the ticket price or the cap is reached.
 */
import { computed } from 'vue'

import { DsIconChip, DsRewardChip, DsStack, DsCluster, DsHeading, DsText } from '@/ds'

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
    <DsStack as="article" gap="sm">
      <DsCluster align="start" :wrap="false">
        <DsIconChip icon="ticket" accent="heat" size="lg" />
        <DsStack gap="2xs">
          <DsHeading :level="3" variant="heading" wrap="anywhere">{{ draw.title }}</DsHeading>
          <DsText v-if="draw.description" variant="body" tone="muted" wrap="anywhere">
            {{ draw.description }}
          </DsText>
        </DsStack>
      </DsCluster>
      <dl class="grid gap-2 text-body text-default sm:grid-cols-3">
        <DsCluster gap="xs" :wrap="false" data-testid="draw-price">
          Harga tiket:
          <DsRewardChip :value="draw.ticketCostSyiling" art="coin" />
        </DsCluster>
        <div data-testid="draw-owned">
          Tiket anda: {{ draw.ticketsOwned }}/{{ draw.maxTicketsPerStudent }}
        </div>
        <div v-if="draw.closesAt" data-testid="draw-closes">
          Tutup: {{ formatDate(draw.closesAt) }}
        </div>
      </dl>
      <DsCluster v-if="draw.prizePool.length > 0" as="ul" gap="xs" align="stretch">
        <li v-for="(p, i) in draw.prizePool" :key="i" data-testid="draw-prize">
          <UBadge color="neutral" variant="soft" size="lg">{{ p.label }} × {{ p.qty }}</UBadge>
        </li>
      </DsCluster>
      <UButton
        size="xl"
        class="min-h-14 w-full justify-center sm:w-auto sm:self-start"
        :disabled="!canBuy || busy"
        data-testid="draw-buy"
        @click="$emit('buy', draw.id)"
      >
        {{ DRAW_COPY.buy }}
      </UButton>
    </DsStack>
  </UCard>
</template>
