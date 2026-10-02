<script setup lang="ts">
/**
 * Laravel session flash outlet (F-15; overview §9, design-system §7.8).
 * Presentational: the caller (shell / auth layout) passes the flash consumed after navigation
 * from the `flash` store (F-12, `useFlash()`); it stays until the next navigation, with no timer.
 * Placement: top of `main`, or top of the form card on auth pages. Extra attributes (e.g. a
 * margin class) fall through to the alert box.
 */
import AlertBox from './AlertBox.vue'
import type { FlashMessage } from './types'

defineProps<{
  flash?: FlashMessage | null
  /** Replaces the default alert box classes. */
  boxClass?: string
}>()
</script>

<template>
  <AlertBox
    v-if="flash"
    :variant="flash.type"
    :messages="flash.message"
    :box-class="boxClass"
    data-testid="cmp-flash"
  />
</template>
