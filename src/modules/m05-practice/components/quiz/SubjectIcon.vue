<script setup lang="ts">
/**
 * A subject's icon (DV-M05-02 / FR-M05-125) in the v2 look: the M03 `icon` value (Lucide name, Font
 * Awesome class or emoji) picks a Phosphor Duotone glyph by keyword (`subject-glyph.ts`), an emoji
 * shows as text, and anything else shows books. Size and colour come from the caller's classes.
 */
import { computed } from 'vue'

import { subjectEmoji, subjectGlyph } from './subject-glyph'

const props = defineProps<{ icon: string | null | undefined }>()

const emoji = computed(() => subjectEmoji(props.icon))
const glyph = computed(() => subjectGlyph(props.icon))
</script>

<template>
  <span v-if="emoji" aria-hidden="true">{{ emoji }}</span>
  <UIcon v-else :name="glyph" aria-hidden="true" />
</template>
