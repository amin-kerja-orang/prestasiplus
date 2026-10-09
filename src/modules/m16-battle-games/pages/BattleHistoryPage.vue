<script setup lang="ts">
/**
 * S5 `/battle/history` "Sejarah Battle" (M16-T3; SRS M16 v1.6 FR-M16-39, 40; URS FN-M16-2.6).
 * Empty card "Tiada sejarah battle" with the "Mula Battle" link, or (PROPOSED) the viewer's finished
 * battles newest first in the S4 "Battle Terkini" row format.
 */
import { Zap } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchBattleHistory } from '../api'
import BattleRecentList from '../components/battle/BattleRecentList.vue'

const { data, error, reload } = useApi((signal) => fetchBattleHistory({ signal }))
</script>

<template>
  <div class="mx-auto w-full max-w-4xl" data-testid="battle-history">
    <div v-if="error" class="space-y-3" data-testid="battle-load-error">
      <AlertBox messages="Maaf, berlaku ralat. Sila cuba semula." />
      <button
        type="button"
        class="min-h-11 rounded-xl border-2 border-slate-200 px-4 text-sm font-semibold text-slate-700"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>
    <div v-else-if="!data" class="flex justify-center py-10 text-slate-400">
      <LoadingSpinner :size="28" />
    </div>
    <div
      v-else-if="data.length === 0"
      class="rounded-2xl bg-white p-8 text-center shadow-md"
      data-testid="battle-history-empty"
    >
      <span class="mx-auto flex h-14 w-14 items-center justify-center text-slate-300">
        <Zap class="h-10 w-10" />
      </span>
      <h3 class="mt-4 text-lg font-bold text-slate-800">Tiada sejarah battle</h3>
      <p class="mt-1 text-sm text-slate-500">Mulakan pertandingan pertama anda sekarang!</p>
      <RouterLink
        to="/battle"
        class="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 px-5 text-sm font-bold text-white"
        data-testid="battle-history-start"
      >
        <Zap class="h-4 w-4" /> Mula Battle
      </RouterLink>
    </div>
    <div v-else class="rounded-2xl bg-white p-4 shadow-md">
      <BattleRecentList :rows="data" home-colour />
    </div>
  </div>
</template>
