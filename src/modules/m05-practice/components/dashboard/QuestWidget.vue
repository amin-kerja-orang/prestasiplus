<script setup lang="ts">
/**
 * FR-M05-12…15: "Misi Harian" — the 10 daily quests (M14 values) and the daily chest. A completed
 * quest and the open chest use the PROPOSED placeholder styling of SRS §8.3 (UNVERIFIED, LS-9).
 */
import { computed } from 'vue'

import type { DashboardQuest } from '../../api/types'
import { chestDots, QUEST_DIFFICULTY, QUEST_TOTAL, questBarPct } from './dashboard-lib'

const props = defineProps<{ quests: DashboardQuest[]; completed: number }>()

const dots = computed(() => chestDots(props.completed))
const remaining = computed(() => Math.max(0, QUEST_TOTAL - props.completed))
const chestOpen = computed(() => props.completed >= QUEST_TOTAL)
</script>

<template>
  <div class="card relative overflow-hidden" data-testid="dash-quests">
    <div
      class="pointer-events-none absolute top-0 right-0 h-64 w-64 opacity-5"
      style="
        background: radial-gradient(circle, #8b5cf6 0%, transparent 70%);
        transform: translate(30%, -30%);
      "
    ></div>
    <div class="mb-6 flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h2
          class="flex items-center gap-3 text-2xl font-black text-slate-800 md:text-3xl"
          style="font-family: 'Outfit', sans-serif"
        >
          <span class="icon-sparkle text-3xl">📱</span> Misi Harian
        </h2>
        <p class="mt-1 text-sm font-semibold text-slate-500">
          Selesaikan semua misi → buka Peti Harian! 🎁
        </p>
      </div>
      <div class="text-right">
        <div class="mb-1 text-xs font-bold tracking-wider text-slate-400 uppercase">Progres</div>
        <div class="text-2xl font-black" style="font-family: 'Outfit', sans-serif">
          <span class="text-purple-600" data-testid="dash-quest-done">{{ completed }}</span>
          <span class="text-slate-300">/</span>
          <span class="text-slate-500">{{ QUEST_TOTAL }}</span>
        </div>
      </div>
    </div>

    <div class="mb-6 space-y-3" data-testid="dash-quest-list">
      <div
        v-for="q in quests"
        :key="q.key"
        :class="[
          'flex items-center gap-4 rounded-2xl border-2 bg-linear-to-r p-4 transition-all duration-300 hover:scale-[1.01]',
          q.completed
            ? 'border-emerald-300 from-emerald-50 to-emerald-100'
            : 'border-slate-200 from-slate-50 to-slate-100',
        ]"
        :data-state="q.completed ? 'completed' : 'open'"
        data-testid="dash-quest"
      >
        <div
          class="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-purple-400 to-indigo-500 text-2xl shadow-md transition-transform duration-300 hover:scale-110 hover:rotate-12"
        >
          {{ q.emoji }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="mb-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              class="text-base font-bold break-words text-slate-800"
              style="font-family: 'Outfit', sans-serif"
              data-testid="dash-quest-title"
              >{{ q.title }}</span
            >
            <span
              :class="[
                'rounded-full px-2 py-0.5 text-xs font-bold tracking-wider uppercase',
                QUEST_DIFFICULTY[q.difficulty].chip,
              ]"
              data-testid="dash-quest-chip"
            >
              {{ QUEST_DIFFICULTY[q.difficulty].label }}
            </span>
          </div>
          <p class="mb-2 text-xs font-semibold text-slate-500">{{ q.description }}</p>
          <div class="flex items-center gap-3">
            <div class="h-3 flex-1 overflow-hidden rounded-full bg-slate-200 shadow-inner">
              <div
                :class="[
                  'h-full rounded-full transition-all duration-1000 ease-out',
                  q.completed ? 'bg-emerald-500' : 'bg-linear-to-r from-purple-400 to-indigo-500',
                ]"
                :style="{ width: `${questBarPct(q)}%` }"
                data-testid="dash-quest-bar"
              ></div>
            </div>
            <span
              class="text-xs font-black whitespace-nowrap text-slate-600"
              style="font-family: 'Outfit', sans-serif"
              data-testid="dash-quest-progress"
            >
              {{ q.progress }}/{{ q.target }}<template v-if="q.completed"> ✓</template>
            </span>
          </div>
        </div>
        <div class="flex-shrink-0 text-center">
          <div class="mb-0.5 text-xl">🪙</div>
          <div class="text-xs font-black text-amber-600" data-testid="dash-quest-reward">
            +{{ q.reward }}
          </div>
        </div>
      </div>
    </div>

    <div
      class="relative rounded-2xl border-2 border-dashed border-slate-300 bg-linear-to-br from-slate-50 to-slate-100 p-6 text-center"
      :data-state="chestOpen ? 'open' : 'locked'"
      data-testid="dash-chest"
    >
      <template v-if="chestOpen">
        <div class="mb-3 text-5xl">🎁</div>
        <p class="text-sm font-bold text-emerald-600" style="font-family: 'Outfit', sans-serif">
          Peti Harian dibuka! 🎉
        </p>
      </template>
      <template v-else>
        <div class="mb-3 text-5xl opacity-40" style="filter: grayscale(1)">🎁</div>
        <p class="text-sm font-bold text-slate-400" style="font-family: 'Outfit', sans-serif">
          Selesaikan {{ remaining }} lagi misi untuk buka peti! 🔒
        </p>
      </template>
      <div class="mt-3 flex items-center justify-center gap-2" data-testid="dash-chest-dots">
        <div
          v-for="(done, i) in dots"
          :key="i"
          :class="[
            'h-4 w-4 rounded-full transition-all duration-500',
            done ? 'bg-purple-500' : 'bg-slate-300',
          ]"
          :data-done="done ? 'true' : 'false'"
        ></div>
      </div>
    </div>
  </div>
</template>
