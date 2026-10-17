<script setup lang="ts">
/** Solid accent tile with a short label (level "T1", Bahagian "A"). Decorative-size tile. */
import type { DsAccent } from '@/ds'

withDefaults(defineProps<{ accent?: DsAccent; size?: 'md' | 'lg' }>(), {
  accent: 'action',
  size: 'md',
})

const fill: Record<DsAccent, string> = {
  action: 'bg-primary text-primary-on',
  win: 'bg-highlight text-on-highlight',
  heat: 'bg-heat text-on-highlight',
  friend: 'bg-friend text-primary-on',
  trial: 'bg-trial text-on-highlight',
}
</script>

<template>
  <span
    class="grid shrink-0 place-items-center rounded-2xl font-display font-extrabold"
    :class="[fill[accent], size === 'lg' ? 'size-16 text-title' : 'size-12 text-subheading']"
    data-ds="accent-badge"
  >
    <slot />
  </span>
</template>
