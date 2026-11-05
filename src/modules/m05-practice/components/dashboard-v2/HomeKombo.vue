<script setup lang="ts">
/**
 * Kombo card (FR-MUR-2-3, AC-MUR-2-1). At risk (streak >= 1, no practice today): the orange warning
 * "Kombo {n} hari akan putus!" with "Mula Latihan". Otherwise the banner "Kombo {n} hari!" with the pill
 * "Belum" / "Selesai". Both end with "Rekod terbaik: {n} hari" when the record is known.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsCharacterCard } from '@/ds'

import { bestStreakText } from '../dashboard/dashboard-lib'

const props = defineProps<{
  count: number
  atRisk: boolean
  practisedToday: boolean
  best: number | null
}>()
const router = useRouter()
const record = computed(() => bestStreakText(props.best, props.count))
</script>

<template>
  <DsCharacterCard
    v-if="atRisk"
    accent="heat"
    art="fire"
    :title="`Kombo ${count} hari akan putus!`"
    description="Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini."
    cta-label="Mula Latihan"
    data-testid="dash-kombo"
    @cta="router.push('/practice')"
  >
    <p v-if="record" class="text-label text-muted" data-testid="dash-kombo-best">{{ record }}</p>
  </DsCharacterCard>
  <DsCharacterCard
    v-else
    accent="heat"
    art="fire"
    :title="`Kombo ${count} hari!`"
    :description="
      practisedToday
        ? 'Tahniah, dah buat latihan hari ini!'
        : 'Jom mula latihan untuk teruskan streak!'
    "
    data-testid="dash-kombo"
  >
    <UBadge
      :color="practisedToday ? 'success' : 'neutral'"
      variant="subtle"
      class="w-fit"
      data-testid="dash-kombo-pill"
      >{{ practisedToday ? 'Selesai' : 'Belum' }}</UBadge
    >
    <p v-if="record" class="text-label text-muted" data-testid="dash-kombo-best">{{ record }}</p>
  </DsCharacterCard>
</template>
