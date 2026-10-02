<script setup lang="ts">
/**
 * Timed toast, no queue (F-15; overview §9). Replicates the live Alpine pattern
 * `flag = true; setTimeout(() => flag = false, ms)`: M02 S2 "Disalin!" (2 s, fade) and
 * M10 S28 report toast (4 s, slide). Showing again, or changing the message while shown,
 * restarts the timer. No ARIA live region: live has none (D10).
 *
 * Teleported to `body` by default so a transformed ancestor (page-transition, hover lift)
 * cannot shift the fixed position.
 */
import { computed, onBeforeUnmount, watch } from 'vue'

import { TOAST_DEFAULT_CLASS, TOAST_TRANSITIONS } from './classes'
import type { ToastTransition } from './types'

const props = withDefaults(
  defineProps<{
    show: boolean
    message?: string
    /** Milliseconds before the toast hides itself. */
    duration?: number
    transition?: ToastTransition
    /** Replaces the default (INFERRED) toast classes. */
    toastClass?: string
    teleportTo?: string
    teleportDisabled?: boolean
  }>(),
  {
    message: '',
    duration: 2000,
    transition: 'fade',
    toastClass: TOAST_DEFAULT_CLASS,
    teleportTo: 'body',
    teleportDisabled: false,
  },
)

const emit = defineEmits<{
  'update:show': [value: false]
  hide: []
}>()

defineSlots<{ default?: () => unknown }>()

let timer: ReturnType<typeof setTimeout> | undefined

function clearTimer() {
  if (timer !== undefined) clearTimeout(timer)
  timer = undefined
}

function startTimer() {
  clearTimer()
  timer = setTimeout(() => {
    timer = undefined
    emit('update:show', false)
    emit('hide')
  }, props.duration)
}

watch(
  () => [props.show, props.message] as const,
  ([show], old) => {
    if (!show) return clearTimer()
    const wasShown = old?.[0] === true
    const messageChanged = old !== undefined && old[1] !== props.message
    if (!wasShown || messageChanged) startTimer()
  },
  { immediate: true },
)

onBeforeUnmount(clearTimer)

const transitionClasses = computed(() => TOAST_TRANSITIONS[props.transition])
</script>

<template>
  <Teleport :to="teleportTo" :disabled="teleportDisabled">
    <Transition v-bind="transitionClasses">
      <div v-if="show" :class="toastClass" data-testid="cmp-toast">
        <slot>{{ message }}</slot>
      </div>
    </Transition>
  </Teleport>
</template>
