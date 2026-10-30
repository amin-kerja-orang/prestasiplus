<script setup lang="ts">
/**
 * "Lihat semakan lepas" (R1-B15, V2 attempt header): a link to the newest closed sitting of the paper.
 * Hidden while loading, on error and when the pupil has no (other) closed sitting. On a result page
 * `exclude` is the sitting on screen, so the link never points at itself.
 */
import { computed } from 'vue'

import { useApi } from '@/composables/useApi'

import { useBijakUser } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

const props = defineProps<{ paperId: string; exclude?: string }>()

const user = useBijakUser()
const server = bijakServer()
const paper = computed(() => props.paperId)
const { data } = useApi(() => server.pastSittings(user.value, paper.value), paper)

const target = computed(
  () => (data.value?.sittings ?? []).find((s) => s.attemptId !== props.exclude)?.attemptId ?? null,
)
</script>

<template>
  <UButton
    v-if="target"
    :to="{ name: 'm28.bijak.result', params: { attemptId: target } }"
    color="neutral"
    variant="ghost"
    icon="i-ph-clock-counter-clockwise"
    class="min-h-11"
    data-testid="past-sittings"
    >Lihat semakan lepas</UButton
  >
</template>
