<script setup lang="ts">
/** "Percubaan Percuma" card (amber). The button is hidden when /pricing is outside the prototype scope. */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { usePrototypeScope } from '@/composables/usePrototypeScope'
import { DsCharacterCard, DsText } from '@/ds'

import type { TrialStatus } from '../../api/types'

defineProps<{ trial: TrialStatus }>()
const router = useRouter()
const { allows } = usePrototypeScope()
const cta = computed(() => (allows('/pricing') ? '🚀 Langgan Sekarang' : undefined))
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
    <DsText variant="subheading" data-testid="dash-trial-remaining">
      Baki {{ trial.remaining }} / {{ trial.limit }} soalan
    </DsText>
  </DsCharacterCard>
</template>
