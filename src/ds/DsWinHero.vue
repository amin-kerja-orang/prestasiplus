<script setup lang="ts">
/**
 * Win screen hero (design system 6, "Win screen"): 3D achievement art over a soft glow, the title
 * and an optional sub line. `tone="win"` glows lime, `tone="keep"` (low score) glows primary.
 * The title is a focusable heading so the screen can move focus to it on entry.
 */
import { computed, ref } from 'vue'

import type { Art3DName } from './assets'
import DsArt3D from './DsArt3D.vue'

const props = withDefaults(
  defineProps<{
    art: Art3DName
    title: string
    subtitle?: string
    /** Glow colour: `win` lime, `action` primary. */
    accent?: 'win' | 'action'
    /** @deprecated use `accent` (`keep` = `action`). */
    tone?: 'win' | 'keep'
    /** Optional test id of the title heading. */
    titleTestid?: string
  }>(),
  { subtitle: undefined, accent: undefined, tone: 'win', titleTestid: undefined },
)

const glow = computed<'win' | 'action'>(() => props.accent ?? (props.tone === 'keep' ? 'action' : 'win'))
const heading = ref<HTMLElement | null>(null)
defineExpose({ focus: () => heading.value?.focus() })
</script>

<template>
  <div class="flex flex-col items-center gap-3 text-center" :data-tone="glow === 'action' ? 'keep' : 'win'" data-ds="win-hero">
    <div class="relative grid size-32 place-items-center" aria-hidden="true">
      <span
        class="absolute -inset-6 rounded-full"
        :class="glow === 'win' ? 'bg-highlight/10' : 'bg-primary/10'"
      />
      <span
        class="absolute -inset-3 rounded-full"
        :class="glow === 'win' ? 'bg-highlight/15' : 'bg-primary/15'"
      />
      <DsArt3D :name="art" size="hero" class="relative animate-ds-hop motion-reduce:animate-none" />
    </div>
    <h2 ref="heading" tabindex="-1" :data-testid="titleTestid" class="font-display text-title font-extrabold text-highlighted">
      {{ title }}
    </h2>
    <p v-if="subtitle" class="max-w-prose text-body text-muted">{{ subtitle }}</p>
  </div>
</template>
