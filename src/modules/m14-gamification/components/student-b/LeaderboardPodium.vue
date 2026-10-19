<script setup lang="ts">
/**
 * S14 podium (FR-M14-40, FN-M14-5.1.2): three narrow cards in the order silver, gold (raised),
 * bronze. The cards share the row width and never push the page wider (DV-M14-07, 320–1280).
 * v2: the gold card carries the 3D trophy.
 */
import { computed } from 'vue'

import { DsArt3D, DsStack, DsText } from '@/ds'
import { formatNumber } from '@/lib/number'

import type { PodiumEntry } from '../../api'
import { LEADERBOARD_COPY, podiumSlots } from '../../lib/student/leaderboard-lib'

const props = defineProps<{ podium: readonly PodiumEntry[] }>()

const slots = computed(() => podiumSlots(props.podium))
</script>

<template>
  <div class="grid grid-cols-3 items-end gap-2 sm:gap-4" data-testid="lb-podium">
    <UCard
      v-for="slot in slots"
      :key="slot.entry.rank"
      class="min-w-0"
      :class="slot.raised ? 'bg-highlight-soft' : ''"
      :data-rank="slot.entry.rank"
      data-testid="lb-podium-card"
    >
      <DsStack gap="2xs" align="center" class="text-center">
        <DsArt3D v-if="slot.raised" name="trophy" size="lg" float />
        <DsText v-else variant="title" as="span" aria-hidden="true">{{ slot.medal }}</DsText>
        <UAvatar :text="slot.entry.initials" size="xl" data-testid="lb-podium-avatar" />
        <DsText
          variant="label"
          as="div"
          tone="highlighted"
          wrap="anywhere"
          class="w-full"
          data-testid="lb-podium-name"
        >
          {{ slot.entry.name }}
        </DsText>
        <DsText variant="caption" as="div" wrap="anywhere" data-testid="lb-podium-score">
          {{ formatNumber(slot.entry.totalSyilingEarned) }} {{ LEADERBOARD_COPY.syiling }}
        </DsText>
        <div class="flex items-center gap-1 text-caption text-toned" data-testid="lb-podium-tier">
          <span aria-hidden="true">{{ slot.entry.tier.icon }}</span>
          <span>{{ slot.entry.tier.labelMs }}</span>
        </div>
      </DsStack>
    </UCard>
  </div>
</template>
