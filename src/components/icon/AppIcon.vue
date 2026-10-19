<script setup lang="ts">
/**
 * Data-driven icon (F-14, ADR-0010, overview §8.3). Takes a Font Awesome class as
 * live stores it (`fas fa-home`, `fa-solid fa-house`, `fa-book`), a Lucide name
 * (`book-open`, `BookOpen`) or an emoji, and renders the Lucide component, the
 * emoji text, or nothing (resolution order in `resolve.ts`).
 *
 * Sizing and colour come from the caller's attributes (`class="h-5 w-5 text-..."`,
 * `:size`, `:stroke-width`), which fall through to the rendered element. Page code
 * with a fixed icon uses the named Lucide component directly instead.
 */
import { computed, watchEffect } from 'vue'

import { loadLucideIndex, lucideIndex, resolveIcon } from './resolve'

const props = defineProps<{
  /** FA class, Lucide name or emoji; empty / unknown renders nothing. */
  name?: string | null
}>()

const resolved = computed(() => resolveIcon(props.name, lucideIndex.value))

watchEffect(() => {
  if (resolved.value.kind === 'lookup') void loadLucideIndex()
})
</script>

<template>
  <component :is="resolved.icon" v-if="resolved.kind === 'icon'" />
  <span v-else-if="resolved.kind === 'emoji'">{{ resolved.text }}</span>
</template>
