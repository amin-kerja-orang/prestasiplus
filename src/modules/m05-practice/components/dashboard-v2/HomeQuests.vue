<script setup lang="ts">
/** "Misi Harian" (lime "win" card; FR-M05-12…15): progress, the quest list and the chest dots. */
import { computed } from 'vue'

import { DsCharacterCard } from '@/ds'

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
      <div class="flex items-center justify-between gap-3">
        <span class="text-overline text-muted">Progres</span>
        <b class="tabular text-subheading text-highlighted">
          <span data-testid="dash-quest-done">{{ completed }}</span> / {{ QUEST_TOTAL }}
        </b>
      </div>
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
          <span class="text-heading" aria-hidden="true">{{ q.emoji }}</span>
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-label text-highlighted" data-testid="dash-quest-title">{{
                q.title
              }}</span>
              <UBadge
                :color="BADGE_COLOR[q.difficulty]"
                variant="subtle"
                size="sm"
                data-testid="dash-quest-chip"
                >{{ QUEST_DIFFICULTY[q.difficulty].label }}</UBadge
              >
            </div>
            <p class="text-caption text-muted">{{ q.description }}</p>
            <div class="flex items-center gap-2">
              <UProgress
                :model-value="questBarPct(q)"
                :max="100"
                size="sm"
                class="flex-1"
                :color="q.completed ? 'success' : 'primary'"
                :aria-label="`Progres ${q.title}`"
                data-testid="dash-quest-bar"
              />
              <span class="tabular text-caption text-muted" data-testid="dash-quest-progress"
                >{{ q.progress }}/{{ q.target }}<template v-if="q.completed"> ✓</template></span
              >
            </div>
          </div>
          <div class="flex shrink-0 flex-col items-center">
            <span aria-hidden="true">🪙</span>
            <span class="tabular text-caption text-highlighted" data-testid="dash-quest-reward"
              >+{{ q.reward }}</span
            >
          </div>
        </UCard>
      </li>
    </ul>
    <div
      class="mt-3 flex flex-col gap-2"
      :data-state="chestOpen ? 'open' : 'locked'"
      data-testid="dash-chest"
    >
      <p v-if="chestOpen" class="text-label text-toned">🎁 Peti Harian dibuka! 🎉</p>
      <p v-else class="text-label text-toned">
        🎁 Selesaikan {{ remaining }} lagi misi untuk buka peti! 🔒
      </p>
      <ul class="flex gap-1" aria-hidden="true" data-testid="dash-chest-dots">
        <li
          v-for="(done, i) in dots"
          :key="i"
          :class="done ? 'text-primary-t' : 'text-dimmed'"
          :data-done="done ? 'true' : 'false'"
        >
          ●
        </li>
      </ul>
    </div>
  </DsCharacterCard>
</template>
