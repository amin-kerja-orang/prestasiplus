<script setup lang="ts">
/**
 * The reward animation of the quiz (live `JBCoinFly.play({syiling, mata, sourceEl, mini})`): "🪙 +n"
 * and "⭐ +n" rise from the card that hosts it and fade out. Decorative; it removes itself after the
 * animation (the host re-keys it to play again). Placed inside a `relative` parent.
 */
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{ coins?: number; points?: number }>(), {
  coins: 0,
  points: 0,
})

const emit = defineEmits<{ done: [] }>()

const visible = ref(true)
let timer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  timer = setTimeout(() => {
    visible.value = false
    emit('done')
  }, 1400)
})
onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
})
</script>

<template>
  <div
    v-if="visible && (props.coins > 0 || props.points > 0)"
    class="m05-coin-fly pointer-events-none absolute top-0 left-1/2 z-10 flex -translate-x-1/2 gap-3 text-lg font-extrabold"
    data-testid="coin-fly"
  >
    <span v-if="props.coins > 0" class="text-amber-500">🪙 +{{ props.coins }}</span>
    <span v-if="props.points > 0" class="text-purple-500">⭐ +{{ props.points }}</span>
  </div>
</template>

<style scoped>
.m05-coin-fly {
  animation: m05-coin-fly 1.4s ease-out forwards;
}

@keyframes m05-coin-fly {
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
