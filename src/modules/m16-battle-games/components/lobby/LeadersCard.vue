<script setup lang="ts">
/**
 * "🏆 Pendahulu" of the S8–S12 lobbies (SRS M16 v1.6 FR-M16-65; URS FN-M16-5.4.4): up to 10 rows with the
 * rank and the value ("{n} menang", "{n} kali MVP"). The server orders them (value desc, stable ties,
 * DV-M16-08). v2: `DsLeaderRow` with a 3D medal for ranks 1-3.
 */
import { DsLeaderRow } from '@/ds'

import type { GameLobby } from '../../api'

defineProps<{
  leaders: NonNullable<GameLobby['leaders']>
  unit: string
}>()
</script>

<template>
  <UCard data-testid="leaders-card">
    <h2 class="text-subheading text-highlighted">🏆 Pendahulu</h2>
    <ul class="mt-3 flex flex-col gap-2" data-testid="leaders-list">
      <DsLeaderRow
        v-for="row in leaders"
        :key="row.userId"
        :rank="row.rank"
        :name="row.name"
        :points="row.value"
        :unit="unit"
        medal="trophy"
        data-testid="leaders-row"
      />
    </ul>
  </UCard>
</template>
