<script setup lang="ts">
/**
 * S15 badge card (FR-M14-47, FN-M14-6.1.4): icon, name, description, rarity tag, reward line
 * "🪙 {syiling} · ⭐ {xp} XP" and, for the five kuiz-count badges, a progress bar with "{n}/{target}".
 * v2: an unlocked card shows the 3D medal; a locked card shows a lock glyph on `bg-elevated` and is
 * dimmed. An unlocked card is clickable and emits `open`. No ARIA beyond live (D10).
 */
import { computed } from 'vue'

import { DsArt3D, DsStack, DsHeading, DsText } from '@/ds'

import type { AchievementItem } from '../../api'
import { progressPct } from '../../lib/student/achievements-lib'

const props = defineProps<{ item: AchievementItem }>()
const emit = defineEmits<{ open: [item: AchievementItem] }>()

const pct = computed(() => (props.item.progress ? progressPct(props.item.progress) : 0))

function onClick(): void {
  if (props.item.unlocked) emit('open', props.item)
}
</script>

<template>
  <UCard
    class="h-full min-w-0"
    :class="item.unlocked ? 'cursor-pointer' : 'opacity-60'"
    :data-locked="item.unlocked ? 'false' : 'true'"
    data-testid="badge-card"
    @click="onClick"
  >
    <DsStack gap="xs" align="center" class="text-center">
      <DsArt3D v-if="item.unlocked" name="trophy" size="xl" />
      <span
        v-else
        class="grid size-19 place-items-center rounded-full bg-elevated text-muted"
        aria-hidden="true"
      >
        <UIcon name="i-ph-lock-simple-duotone" class="size-10" />
      </span>
      <span class="text-title" aria-hidden="true" data-testid="badge-icon">{{ item.icon }}</span>
      <DsHeading :level="3" variant="label" wrap="anywhere" data-testid="badge-name">
        {{ item.name }}
      </DsHeading>
      <DsText variant="caption" wrap="anywhere" data-testid="badge-desc">
        {{ item.description }}
      </DsText>
      <UBadge
        :color="item.unlocked ? 'secondary' : 'neutral'"
        variant="subtle"
        size="sm"
        class="uppercase"
        data-testid="badge-rarity"
        >{{ item.rarityLabel }}</UBadge
      >
      <DsText variant="caption" tone="toned" data-testid="badge-reward">
        🪙 {{ item.rewardSyiling }} · ⭐ {{ item.rewardXp }} XP
      </DsText>
      <DsStack v-if="item.progress" gap="2xs" class="w-full" data-testid="badge-progress">
        <UProgress
          :model-value="pct"
          :max="100"
          size="sm"
          :aria-label="`Kemajuan ${item.name}`"
          :data-value="pct"
        />
        <DsText variant="caption" tabular data-testid="badge-progress-text">
          {{ item.progress.value }}/{{ item.progress.target }}
        </DsText>
      </DsStack>
    </DsStack>
  </UCard>
</template>
