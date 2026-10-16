<script setup lang="ts">
/** Kombo warning (orange "heat" card). */
import { useRouter } from 'vue-router'

import { DsCharacterCard } from '@/ds'

defineProps<{ count: number }>()
const router = useRouter()
</script>

<template>
  <DsCharacterCard
    variant="warning"
    art="fire"
    :title="`Kombo ${count} hari akan putus!`"
    description="Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini."
    cta-label="Mula Latihan"
    data-testid="dash-kombo"
    @cta="router.push('/practice')"
  />
</template>
