<script setup lang="ts">
/**
 * Reveal / draw container (spin wheel or box open). `spin()` runs a spin of `duration` ms and then
 * reveals the `result` slot; under `prefers-reduced-motion` the result is shown at once. The
 * `prize` slot is the wheel / box graphic; `result` holds the prize and the result sticker. The
 * result is announced politely. The caller decides what the prize is; this only animates.
 */
import { onBeforeUnmount, ref } from 'vue'

import { dsCopy } from './copy'
import { useMedia } from './useMedia'

type WheelState = 'idle' | 'spinning' | 'revealed'

const props = withDefaults(
  defineProps<{
    /** Accessible name of the region (BM). */
    label: string
    spinLabel?: string
    spinningLabel?: string
    resetLabel?: string
    duration?: number
    /** Hide the built-in button and drive it with the exposed `spin()`. */
    hideButton?: boolean
  }>(),
  {
    spinLabel: dsCopy.wheelSpin,
    spinningLabel: dsCopy.wheelSpinning,
    resetLabel: dsCopy.wheelReset,
    duration: 2400,
    hideButton: false,
  },
)

const emit = defineEmits<{ revealed: []; reset: [] }>()

const state = ref<WheelState>('idle')
const reduced = useMedia('(prefers-reduced-motion: reduce)', false)
let timer: ReturnType<typeof setTimeout> | undefined

function reveal(): void {
  state.value = 'revealed'
  emit('revealed')
}
function spin(): void {
  if (state.value === 'spinning') return
  if (reduced.value) {
    reveal()
    return
  }
  state.value = 'spinning'
  timer = setTimeout(reveal, props.duration)
}
function reset(): void {
  clearTimeout(timer)
  state.value = 'idle'
  emit('reset')
}
onBeforeUnmount(() => clearTimeout(timer))
defineExpose({ spin, reset, state })
</script>

<template>
  <section
    class="flex flex-col items-center gap-4"
    :aria-label="label"
    :data-state="state"
    data-ds="wheel"
  >
    <div
      class="grid place-items-center"
      :class="state === 'spinning' ? 'animate-spin motion-reduce:animate-none' : ''"
      data-ds="wheel-prize"
    >
      <slot name="prize" :state="state" />
    </div>
    <div class="flex min-h-12 flex-col items-center gap-2" role="status" aria-live="polite">
      <slot v-if="state === 'revealed'" name="result" />
      <span v-else-if="state === 'spinning'" class="text-label text-muted">{{ spinningLabel }}</span>
    </div>
    <template v-if="!hideButton">
      <UButton
        v-if="state === 'revealed'"
        type="button"
        color="neutral"
        variant="soft"
        size="xl"
        :label="resetLabel"
        @click="reset"
      />
      <UButton
        v-else
        type="button"
        size="xl"
        :label="spinLabel"
        :loading="state === 'spinning'"
        :disabled="state === 'spinning'"
        data-ds="wheel-spin"
        @click="spin"
      />
    </template>
  </section>
</template>
