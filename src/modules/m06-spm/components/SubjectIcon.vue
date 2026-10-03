<script setup lang="ts">
/**
 * A subject's icon (DV-M06-03): the stored `icon` (Lucide name, Font Awesome class or emoji) resolved
 * like `AppIcon`, so no tile shows a blank glyph as on live. A subject with no icon, or one that
 * resolves to nothing, shows a book. Size and colour come from the caller's classes.
 */
import { BookOpen } from '@lucide/vue'
import { computed, watchEffect } from 'vue'

import { loadLucideIndex, lucideIndex, resolveIcon } from '@/components/icon/resolve'

const props = defineProps<{ icon: string | null | undefined }>()

const resolved = computed(() => resolveIcon(props.icon, lucideIndex.value))

watchEffect(() => {
  if (resolved.value.kind === 'lookup') void loadLucideIndex()
})
</script>

<template>
  <component :is="resolved.icon" v-if="resolved.kind === 'icon'" />
  <span v-else-if="resolved.kind === 'emoji'">{{ resolved.text }}</span>
  <BookOpen v-else />
</template>
