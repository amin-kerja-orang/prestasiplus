<script setup lang="ts">
/**
 * The one mystery-box block (48 GAME-23, FR-GM-23.1 to 23.4; 10-murid R1-MUR-35): cost, balance, the state notice with
 * the action, the "Peluang ganjaran" table (scrolls inside its own container, AC-GM-23.7) and the disclaimer. The odds
 * table and the disclaimer are always shown (FR-GM-23.4). The open button asks the page to confirm first.
 *
 * States, in the server's order: no box or no prize that can be won (N5) -> daily limit reached -> balance short
 * ("Kumpul syiling" opens Latih Tubi) -> ready. The open button is disabled in every state but the last.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { DsCluster, DsHeading, DsRewardChip, DsStack, DsText } from '@/ds'

import type { MysteryBoxesView } from '../api'
import { BOX_COPY } from './copy'

const props = defineProps<{ view: MysteryBoxesView; busy: boolean }>()
const emit = defineEmits<{ open: [boxId: number] }>()

const box = computed(() => props.view.box)
const cost = computed(() => box.value?.costSyiling ?? 0)
const missing = computed(() => Math.max(0, cost.value - props.view.syilingBalance))
const state = computed<'unavailable' | 'limit' | 'short' | 'ready'>(() => {
  if (!box.value || !props.view.available) return 'unavailable'
  if (props.view.openedToday >= props.view.dailyMax) return 'limit'
  return missing.value > 0 ? 'short' : 'ready'
})

interface OddsRow {
  label: string
  chance: string
}

/** The odds table: prize then chance ("40%"; one decimal only when the chances were renormalised). */
const rows = computed<OddsRow[]>(() =>
  (box.value?.prizes ?? []).map((p) => ({ label: p.label, chance: `${String(p.chance)}%` })),
)
const columns: TableColumn<OddsRow>[] = [
  { accessorKey: 'label', header: BOX_COPY.oddsPrize },
  { accessorKey: 'chance', header: BOX_COPY.oddsChance },
]

function submit(): void {
  if (state.value === 'ready' && box.value && !props.busy) emit('open', box.value.id)
}
</script>

<template>
  <DsStack as="section" gap="md" data-testid="box-card">
    <form @submit.prevent="submit">
      <DsStack gap="md">
        <DsText v-if="box" variant="body-strong" tone="highlighted" data-testid="box-cost">{{
          BOX_COPY.cost(box.costSyiling)
        }}</DsText>
        <DsCluster gap="sm" data-testid="box-chip">
          <DsText variant="label" tone="muted" as="span">{{ BOX_COPY.balance }}</DsText>
          <DsRewardChip :value="view.syilingBalance" art="coin" data-testid="box-chip-value" />
        </DsCluster>

        <DsText
          v-if="state === 'unavailable'"
          variant="body"
          tone="warning"
          role="status"
          data-testid="box-unavailable"
          >{{ BOX_COPY.unavailable }}</DsText
        >
        <DsText
          v-else-if="state === 'limit'"
          variant="body"
          tone="warning"
          role="status"
          data-testid="box-daily"
          >{{ BOX_COPY.daily }}</DsText
        >
        <DsText
          v-else-if="state === 'short'"
          variant="body"
          tone="warning"
          role="status"
          data-testid="box-short"
          >{{ BOX_COPY.short(missing) }}</DsText
        >

        <DsCluster gap="sm">
          <UButton
            v-if="state === 'short'"
            to="/practice"
            size="xl"
            color="neutral"
            variant="soft"
            block
            class="min-h-14"
            data-testid="box-collect"
            >{{ BOX_COPY.collect }}</UButton
          >
          <UButton
            type="submit"
            size="xl"
            block
            class="min-h-14"
            :color="state === 'ready' ? 'primary' : 'neutral'"
            :variant="state === 'ready' ? 'solid' : 'soft'"
            :disabled="state !== 'ready' || busy"
            :loading="busy"
            data-testid="box-btn"
          >
            {{ state === 'short' ? BOX_COPY.shortButton : BOX_COPY.open }}
          </UButton>
        </DsCluster>
      </DsStack>
    </form>

    <DsStack as="section" gap="sm" data-testid="box-odds">
      <DsHeading :level="2" variant="heading">{{ BOX_COPY.oddsHeading }}</DsHeading>
      <div
        class="overflow-x-auto"
        tabindex="0"
        role="region"
        :aria-label="BOX_COPY.oddsHeading"
        data-testid="box-odds-scroll"
      >
        <div class="min-w-80">
          <UTable :data="rows" :columns="columns" data-testid="box-odds-table" />
        </div>
      </div>
      <DsText variant="caption" tone="muted" data-testid="box-disclaimer">{{ BOX_COPY.disclaimer }}</DsText>
    </DsStack>
  </DsStack>
</template>
