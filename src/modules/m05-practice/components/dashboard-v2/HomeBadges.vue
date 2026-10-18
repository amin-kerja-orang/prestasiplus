<script setup lang="ts">
/** "Lencana" shelf (lime card; FR-M05-16, 17): the earned badges, or the empty message. */
import { DsCharacterCard } from '@/ds'

import type { DashboardBadge } from '../../api/types'

defineProps<{ badges: DashboardBadge[] }>()
</script>

<template>
  <DsCharacterCard
    v-if="badges.length === 0"
    accent="win"
    art="trophy"
    title="Belum Ada Lencana Lagi!"
    description="Jom kumpul lencana pertama dengan menjawab soalan! 🚀"
    data-testid="dash-badges-empty"
  />
  <section v-else aria-label="Lencana" data-testid="dash-badges">
    <ul class="flex gap-3 overflow-x-auto pb-2">
      <li v-for="b in badges" :key="b.id" class="shrink-0" data-testid="dash-badge">
        <UCard :ui="{ body: 'flex w-24 flex-col items-center gap-1 p-3' }">
          <span class="text-title" aria-hidden="true">{{ b.icon }}</span>
          <p class="text-center text-caption text-highlighted">{{ b.name }}</p>
        </UCard>
      </li>
    </ul>
  </section>
</template>
