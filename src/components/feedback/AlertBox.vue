<script setup lang="ts">
/**
 * Red error / green success alert box (F-15; design-system §5, §7.8; overview §9).
 * One `<p>` per message line (server VALIDATION_ERROR lists one line per field message).
 * Renders nothing when there is no message and no slot content, so a screen can bind
 * `:messages="errors"` directly. No ARIA role: live has none (D10).
 */
import { CircleAlert, CircleCheck } from '@lucide/vue'
import { computed, useSlots } from 'vue'

import { ALERT_BOX_CLASSES, ALERT_ICON_CLASS } from './classes'
import type { AlertVariant } from './types'

const props = withDefaults(
  defineProps<{
    variant?: AlertVariant
    /** One line or one line per error. Empty strings are dropped. */
    messages?: string | readonly string[] | null
    /** Replaces the default box classes (for screens whose live box differs). */
    boxClass?: string
  }>(),
  { variant: 'error', messages: null, boxClass: undefined },
)

defineSlots<{ default?: () => unknown }>()
const slots = useSlots()

const lines = computed<string[]>(() => {
  const m = props.messages
  if (m == null) return []
  return (typeof m === 'string' ? [m] : [...m]).filter((line) => line !== '')
})

const visible = computed(() => lines.value.length > 0 || slots.default !== undefined)
const icon = computed(() => (props.variant === 'success' ? CircleCheck : CircleAlert))
</script>

<template>
  <div v-if="visible" :class="boxClass ?? ALERT_BOX_CLASSES[variant]" :data-variant="variant">
    <component :is="icon" :class="ALERT_ICON_CLASS" />
    <div class="min-w-0 flex-1 break-words">
      <slot>
        <p v-for="(line, i) in lines" :key="i">{{ line }}</p>
      </slot>
    </div>
  </div>
</template>
