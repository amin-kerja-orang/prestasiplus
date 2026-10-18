<script setup lang="ts">
/**
 * Quiz header (design system 6, "Combo chip" and the full-screen quiz): close button, a progress
 * bar with the A1 to AI gradient, and the combo chip with the flame. The flame is lit (and
 * flickers, unless reduced motion) when the combo is at least 1. The close button needs a BM
 * label; the full-screen quiz must keep an exit control.
 */
import DsIcon from './DsIcon.vue'

withDefaults(
  defineProps<{
    /** Accessible name of the close button (BM). */
    closeLabel: string
    /** Progress 0 to 100. */
    progress: number
    /** Accessible name of the progress bar (BM), e.g. "Kemajuan latihan". */
    progressLabel: string
    combo?: number
    /** Screen-reader word for the combo (BM), e.g. "Kombo". */
    comboLabel?: string
  }>(),
  { combo: 0, comboLabel: undefined },
)

defineEmits<{ close: [] }>()
</script>

<template>
  <header class="flex items-center gap-2.5" data-ds="quiz-header">
    <UButton
      color="neutral"
      variant="soft"
      icon="i-ph-x"
      class="size-11 shrink-0 justify-center rounded-chip bg-default"
      :aria-label="closeLabel"
      data-ds="quiz-close"
      @click="$emit('close')"
    />
    <UProgress
      class="min-w-0 flex-1"
      :model-value="Math.min(Math.max(progress, 0), 100)"
      :max="100"
      size="md"
      :aria-label="progressLabel"
      :get-value-label="() => progressLabel"
      :ui="{ base: 'bg-elevated rounded-full', indicator: 'rounded-full bg-gradient-primary-h' }"
    />
    <span
      class="tabular inline-flex h-11 min-w-14 items-center justify-center gap-1 rounded-chip bg-default px-2.5 font-display font-extrabold"
      :class="combo > 0 ? 'text-highlighted' : 'text-muted'"
      :data-lit="combo > 0"
      data-ds="combo-chip"
    >
      <DsIcon
        name="fire"
        weight="bold"
        class="size-5"
        :class="
          combo > 0 ? 'animate-ds-flicker text-flame motion-reduce:animate-none' : 'text-dimmed'
        "
        aria-hidden="true"
      />
      <span v-if="comboLabel" class="sr-only">{{ comboLabel }}</span>
      {{ combo }}
    </span>
  </header>
</template>
