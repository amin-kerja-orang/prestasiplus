<script setup lang="ts">
/**
 * S5 `/battle/history` "Sejarah Battle" (M16-T3; SRS M16 v1.6 FR-M16-39, 40; URS FN-M16-2.6).
 * Empty card "Tiada sejarah battle" with the "Mula Battle" link, or (PROPOSED) the viewer's finished
 * battles newest first in the S4 "Battle Terkini" row format.
 */
import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'

import { fetchBattleHistory } from '../api'
import BattleRecentList from '../components/battle/BattleRecentList.vue'

const { data, error, reload } = useApi((signal) => fetchBattleHistory({ signal }))
</script>

<template>
  <DsPage data-testid="battle-history">
    <div v-if="error" class="flex flex-col items-start gap-3" data-testid="battle-load-error">
      <UAlert
        color="error"
        variant="subtle"
        title="Maaf, berlaku ralat. Sila cuba semula."
        class="w-full"
      />
      <UButton size="lg" class="min-h-11" @click="reload()">Cuba Lagi</UButton>
    </div>
    <div v-else-if="!data" class="flex flex-col gap-2" aria-busy="true">
      <USkeleton v-for="n in 3" :key="n" class="h-14 w-full" />
    </div>
    <DsEmptyState
      v-else-if="data.length === 0"
      title="Tiada sejarah battle"
      description="Mulakan pertandingan pertama anda sekarang!"
      icon="i-ph-lightning-duotone"
      data-testid="battle-history-empty"
    >
      <template #actions>
      <UButton
        to="/battle"
        size="xl"
        color="primary"
        icon="i-ph-lightning-bold"
        class="min-h-12"
        data-testid="battle-history-start"
      >
        Mula Battle
      </UButton>
      </template>
    </DsEmptyState>
    <UCard v-else>
      <BattleRecentList :rows="data" />
    </UCard>
  </DsPage>
</template>
