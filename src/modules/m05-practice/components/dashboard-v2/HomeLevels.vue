<script setup lang="ts">
/** "Tahap Pendidikan" (FR-M05-25): three level groups of pills "{name} ({count})". */
import { computed } from 'vue'

import type { DashboardLevelPill } from '../../api/types'
import { LEVEL_GROUPS } from '../dashboard/dashboard-lib'
import { DsCluster, DsStack, DsHeading } from '@/ds'

const props = defineProps<{ pills: DashboardLevelPill[] }>()

const groups = computed(() =>
  LEVEL_GROUPS.map((g) => ({ ...g, pills: props.pills.filter((p) => p.stage === g.stage) })),
)
</script>

<template>
  <DsStack as="section" gap="sm" aria-labelledby="dash-levels-h" data-testid="dash-levels">
    <DsHeading id="dash-levels-h" :level="2">🎓 Tahap Pendidikan</DsHeading>
    <UCard :ui="{ body: 'flex flex-col gap-4 p-4' }">
      <DsStack
        v-for="g in groups"
        :key="g.stage"
        gap="xs"
        :data-testid="`dash-level-group-${g.stage}`"
      >
        <h3 class="flex items-center gap-2 text-subheading text-highlighted">
          <span aria-hidden="true">{{ g.emoji }}</span>
          <span>{{ g.label }}</span>
        </h3>
        <DsCluster as="ul" gap="xs" align="stretch">
          <li v-for="p in g.pills" :key="p.code">
            <UButton
              :to="`/practice?level=${p.code}`"
              color="neutral"
              variant="soft"
              size="md"
              class="min-h-11"
              data-testid="dash-level-pill"
              >{{ p.name }} <span class="text-muted">({{ p.count }})</span></UButton
            >
          </li>
        </DsCluster>
      </DsStack>
    </UCard>
  </DsStack>
</template>
