<script setup lang="ts">
/** "Misi Harian" (lime "win" card; FR-M05-12…15): progress, the quest list and the chest dots. */
import { computed } from 'vue'

import { DsCharacterCard, DsCluster, DsStack, DsText } from '@/ds'

import type { DashboardQuest } from '../../api/types'
import {
  chestDots,
  QUEST_DIFFICULTY,
  QUEST_TOTAL,
  questBarPct,
  questPct,
} from '../dashboard/dashboard-lib'

const props = defineProps<{ quests: DashboardQuest[]; completed: number }>()

const dots = computed(() => chestDots(props.completed))
const remaining = computed(() => Math.max(0, QUEST_TOTAL - props.completed))
const chestOpen = computed(() => props.completed >= QUEST_TOTAL)
const BADGE_COLOR = { easy: 'success', medium: 'warning', hard: 'error' } as const
</script>

<template>
  <DsCharacterCard
    accent="win"
    icon="lightning"
    title="📱 Misi Harian"
    description="Selesaikan semua misi → buka Peti Harian! 🎁"
    data-testid="dash-quests"
  >
    <div class="mt-2 flex flex-col gap-2">
      <DsCluster justify="between" :wrap="false">
        <DsText variant="overline">Progres</DsText>
        <b class="tabular text-subheading text-highlighted">
          <span data-testid="dash-quest-done">{{ completed }}</span> / {{ QUEST_TOTAL }}
        </b>
      </DsCluster>
      <UProgress
        :model-value="questPct(completed, QUEST_TOTAL)"
        :max="100"
        aria-label="Progres misi harian"
      />
    </div>
    <ul class="mt-3 flex flex-col gap-2" data-testid="dash-quest-list">
      <li
        v-for="q in quests"
        :key="q.key"
        :data-state="q.completed ? 'completed' : 'open'"
        data-testid="dash-quest"
      >
        <UCard :ui="{ body: 'flex items-center gap-3 p-3' }">
          <DsText variant="heading" as="span" aria-hidden="true">{{ q.emoji }}</DsText>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <DsCluster gap="xs">
              <DsText variant="label" tone="highlighted" data-testid="dash-quest-title">{{
                q.title
              }}</DsText>
              <UBadge
                :color="BADGE_COLOR[q.difficulty]"
                variant="subtle"
                size="sm"
                data-testid="dash-quest-chip"
                >{{ QUEST_DIFFICULTY[q.difficulty].label }}</UBadge
              >
            </DsCluster>
            <DsText variant="caption">{{ q.description }}</DsText>
            <DsCluster gap="xs" :wrap="false">
              <UProgress
                :model-value="questBarPct(q)"
                :max="100"
                size="sm"
                class="flex-1"
                :color="q.completed ? 'success' : 'primary'"
                :aria-label="`Progres ${q.title}`"
                data-testid="dash-quest-bar"
              />
              <DsText variant="caption" as="span" tabular data-testid="dash-quest-progress"
                >{{ q.progress }}/{{ q.target }}<template v-if="q.completed"> ✓</template></DsText
              >
            </DsCluster>
          </div>
          <DsStack gap="none" align="center" class="shrink-0">
            <span aria-hidden="true">🪙</span>
            <DsText
              variant="caption"
              as="span"
              tone="highlighted"
              tabular
              data-testid="dash-quest-reward"
              >+{{ q.reward }}</DsText
            >
          </DsStack>
        </UCard>
      </li>
    </ul>
    <div
      class="mt-3 flex flex-col gap-2"
      :data-state="chestOpen ? 'open' : 'locked'"
      data-testid="dash-chest"
    >
      <DsText v-if="chestOpen" variant="label" as="p" tone="toned"
        >🎁 Peti Harian dibuka! 🎉</DsText
      >
      <DsText v-else variant="label" as="p" tone="toned">
        🎁 Selesaikan {{ remaining }} lagi misi untuk buka peti! 🔒
      </DsText>
      <DsCluster
        as="ul"
        gap="2xs"
        align="stretch"
        :wrap="false"
        aria-hidden="true"
        data-testid="dash-chest-dots"
      >
        <li
          v-for="(done, i) in dots"
          :key="i"
          :class="done ? 'text-primary-t' : 'text-dimmed'"
          :data-done="done ? 'true' : 'false'"
        >
          ●
        </li>
      </DsCluster>
    </div>
  </DsCharacterCard>
</template>
