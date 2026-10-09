<script setup lang="ts">
/**
 * The coin reward animation of a result (live `JBCoinFly.play({syiling, mata: 0})`, DV-M16-23): "🪙 +n"
 * rises and fades. It exists only for a credited amount above 0, so with the M14 seed it never renders.
 * Decorative; removes itself after the animation.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

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
    class="m16-coin-fly pointer-events-none absolute top-2 left-1/2 z-10 text-xl font-extrabold text-amber-500"
    data-testid="coin-fly"
  >
    🪙 +{{ props.coins }}
  </div>
</template>

<style scoped>
.m16-coin-fly {
  animation: m16-coin-fly 1.4s ease-out forwards;
}

@keyframes m16-coin-fly {
  from {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  to {
    opacity: 0;
    transform: translate(-50%, -3.5rem);
  }
}
</style>
