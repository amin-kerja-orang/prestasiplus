<script setup lang="ts">
/** "Percubaan Percuma" card (amber). The button is hidden when /pricing is outside the prototype scope. */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { usePrototypeScope, useRouteExists } from '@/composables'
import { DsCharacterCard } from '@/ds'

import type { TrialStatus } from '../../api/types'

defineProps<{ trial: TrialStatus }>()
const router = useRouter()
const { allows } = usePrototypeScope()
const { routeExists } = useRouteExists()
const cta = computed(() => (allows('/pricing') && routeExists('/pricing') ? '🚀 Langgan Sekarang' : undefined))
</script>

<template>
  <DsCharacterCard
    accent="trial"
    icon="star"
    title="Percubaan Percuma"
    :cta-label="cta"
    data-testid="dash-trial"
    @cta="router.push('/pricing')"
  >
    <p class="text-subheading text-highlighted" data-testid="dash-trial-remaining">
      Baki {{ trial.remaining }} / {{ trial.limit }} soalan
    </p>
  </DsCharacterCard>
</template>
