<script setup lang="ts">
/**
 * The coin reward animation of a result (live `JBCoinFly.play({syiling, mata: 0})`, DV-M16-23): "🪙 +n"
 * rises and fades (DS float-score, no motion for reduced motion). It exists only for a credited
 * amount above 0, so with the M14 seed it never renders. Decorative; removes itself after 1.4 s.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { DsFloatScore } from '@/ds'

const props = defineProps<{ coins: number }>()
const visible = ref(true)
let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  timer = setTimeout(() => {
    visible.value = false
  }, 1400)
})
onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
})
</script>

<template>
  <div
    v-if="visible && props.coins > 0"
    class="pointer-events-none absolute inset-x-0 top-2 flex justify-center"
    data-testid="coin-fly"
  >
    <DsFloatScore :text="`🪙 +${String(props.coins)}`" />
  </div>
</template>
