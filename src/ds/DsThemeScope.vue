<script setup lang="ts">
/**
 * Applies one personality and colour scheme to a subtree, so a gallery (or a preview) can show
 * staff and learner, light and dark side by side. It mirrors what a portal layout puts on <html>
 * (`data-personality` + `.dark`); `.light` stops an outer `.dark` from leaking in.
 */
import { computed, toRef } from 'vue'

import type { Personality, Scheme } from '@/theme/color-mode'

import { providePersonality } from './personality'

const props = defineProps<{
  personality: Personality
  scheme: Scheme
}>()

providePersonality(toRef(props, 'personality'))

/** Marker class read by the token scopes in `tokens.css` (not a utility). */
const marker = computed(() => (props.scheme === 'dark' ? 'dark' : 'light'))
</script>

<template>
  <div
    class="min-w-0 rounded-card bg-muted p-4 text-default"
    :class="marker"
    :data-personality="personality"
    :data-scheme="scheme"
    data-ds="theme-scope"
  >
    <slot />
  </div>
</template>
