<script setup lang="ts">
/** Three reward tiles (streak, koin, mata) with 3D art, then the "Sambung latihan" hero. */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsHeroCard, DsStatTile, DsStack, DsGrid } from '@/ds'

import type { Dashboard } from '../../api/types'
import { COUNT_RULES, QUEST_TOTAL, questPct } from '../dashboard/dashboard-lib'
import { useDisplayCount } from './useDisplayCount'

const props = defineProps<{ data: Dashboard }>()
const router = useRouter()

const streak = useDisplayCount(() => props.data.streak.count, COUNT_RULES.streak)
const coins = useDisplayCount(() => props.data.wallet.coins, COUNT_RULES.coins)
const points = useDisplayCount(() => props.data.wallet.points, COUNT_RULES.points)

const questPctValue = computed(() => Math.round(questPct(props.data.questsCompleted, QUEST_TOTAL)))
const subtitle = computed(() => `${props.data.questsCompleted} daripada ${QUEST_TOTAL} misi harian`)
</script>

<template>
  <DsStack>
    <DsGrid :cols="3" gap="sm" as="ul" aria-label="Ganjaran awak" data-testid="dash-rewards">
      <li class="min-w-0">
        <DsStatTile
          :value="streak"
          unit="hari streak"
          art="fire"
          data-testid="dash-reward-streak"
        />
      </li>
      <li class="min-w-0">
        <DsStatTile :value="coins" unit="koin" art="coin" data-testid="dash-reward-coins" />
      </li>
      <li class="min-w-0">
        <DsStatTile :value="points" unit="mata" art="bolt" data-testid="dash-reward-points" />
      </li>
    </DsGrid>
    <DsHeroCard
      overline="Sambung latihan"
      title="Teruskan Latih Tubi"
      :subtitle="subtitle"
      :progress="questPctValue"
      ring-label="Kemajuan misi harian"
      art="rocket"
      cta-label="Mula"
      data-testid="dash-continue"
      @cta="router.push('/practice')"
    />
  </DsStack>
</template>
