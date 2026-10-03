<script setup lang="ts">
/** FR-M05-25: "Tahap Pendidikan" — three level groups of pills "{name} ({count})". */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { DashboardLevelPill } from '../../api/types'
import { LEVEL_GROUPS } from './dashboard-lib'

const props = defineProps<{ pills: DashboardLevelPill[] }>()

const groups = computed(() =>
  LEVEL_GROUPS.map((g) => ({ ...g, pills: props.pills.filter((p) => p.stage === g.stage) })),
)
</script>

<template>
  <div data-testid="dash-levels">
    <h2
      class="mb-3 text-lg font-black text-slate-800 sm:mb-6 sm:text-2xl md:text-3xl"
      style="font-family: 'Outfit', sans-serif"
    >
      🎓 Tahap Pendidikan
    </h2>
    <div class="space-y-3 sm:space-y-7">
      <div
        v-for="g in groups"
        :key="g.stage"
        class="card"
        :data-testid="`dash-level-group-${g.stage}`"
      >
        <h3
          class="mb-3 text-base font-black sm:mb-6 sm:text-xl md:text-2xl"
          style="font-family: 'Outfit', sans-serif"
        >
          <span class="mr-1 text-xl sm:mr-3 sm:text-3xl">{{ g.emoji }}</span>
          <span class="gradient-text">{{ g.label }}</span>
        </h3>
        <div class="flex flex-wrap gap-4">
          <RouterLink
            v-for="p in g.pills"
            :key="p.code"
            :to="`/practice?level=${p.code}`"
            class="level-pill"
            data-testid="dash-level-pill"
          >
            {{ p.name }}
            <span class="ml-2 text-sm font-black opacity-80">({{ p.count }})</span>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
