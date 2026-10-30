<script setup lang="ts">
/**
 * Tone badge (admin page templates G1): one pill for a severity, mood, category or result
 * ("Betul" / "Salah"). `DsStatusBadge` stays the badge of the status enum; this is every other
 * badge. `tone` is the semantic colour; `accent` is a categorical colour (a tinted pill with a
 * coloured dot, so the colour never carries the meaning alone). `emphasis="strong"` is solid. The
 * text is the `label` prop or the default slot; an `icon` is a Phosphor base name.
 */
import { computed } from 'vue'

import { accentSolid, accentTint } from './accent'
import DsIcon from './DsIcon.vue'
import type { DsAccent, DsIconProp, DsTone } from './types'

const props = withDefaults(
  defineProps<{
    label?: string
    tone?: DsTone
    /** Categorical colour; wins over `tone`. */
    accent?: DsAccent
    icon?: DsIconProp
    size?: 'sm' | 'md'
    /** `soft` = tinted (default); `strong` = solid. */
    emphasis?: 'soft' | 'strong'
  }>(),
  { label: undefined, tone: 'neutral', accent: undefined, icon: undefined, size: 'md', emphasis: 'soft' },
)

const color = computed(() => props.tone)
const variant = computed(() => (props.emphasis === 'strong' ? 'solid' : 'subtle'))
/** Accent: tinted (soft) or solid pill; the text stays `text-highlighted` on the tint. */
const accentClass = computed(() => {
  if (!props.accent) return ''
  return props.emphasis === 'strong' ? accentSolid[props.accent] : `${accentTint[props.accent]} text-highlighted`
})
const dotClass = computed(() => (props.accent ? accentSolid[props.accent].split(' ')[0] : ''))
</script>

<template>
  <UBadge
    :color="accent ? 'neutral' : color"
    :variant="accent ? 'subtle' : variant"
    :size="size"
    class="max-w-full gap-1 whitespace-nowrap"
    :class="accentClass"
    data-ds="badge"
    :data-tone="accent ? undefined : tone"
    :data-accent="accent"
    :data-emphasis="emphasis"
  >
    <span
      v-if="accent && emphasis === 'soft' && !icon"
      class="size-1.5 shrink-0 rounded-full"
      :class="dotClass"
      aria-hidden="true"
    />
    <DsIcon v-if="icon" :name="icon" weight="bold" class="size-3.5 shrink-0" />
    <slot>{{ label }}</slot>
  </UBadge>
</template>
