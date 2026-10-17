<script setup lang="ts">
/**
 * A subject's icon (DV-M05-02 / FR-M05-125) in the v2 look: the M03 `icon` value (Lucide name, Font
 * Awesome class or emoji) picks a Phosphor Duotone glyph by keyword (design system 10.1: calculator,
 * book-open-text, translate, scroll, flask), an emoji shows as text, and anything else shows books.
 * Size and colour come from the caller's classes. Decorative.
 */
import { computed } from 'vue'

const props = defineProps<{ icon: string | null | undefined }>()

const NON_ASCII = /[^\x00-\x7F]/

const GLYPHS: readonly { match: RegExp; glyph: string }[] = [
  { match: /calc|math|sigma|function|percent|ruler/, glyph: 'i-ph-calculator-duotone' },
  { match: /language|translate|globe|speech|message|comment/, glyph: 'i-ph-translate-duotone' },
  { match: /landmark|scroll|history|hourglass|monument|castle/, glyph: 'i-ph-scroll-duotone' },
  {
    match: /flask|atom|microscope|vial|dna|beaker|test-tube|science|leaf|seedling/,
    glyph: 'i-ph-flask-duotone',
  },
  { match: /book|read|text|pen|file|graduation/, glyph: 'i-ph-book-open-text-duotone' },
]
const FALLBACK = 'i-ph-books-duotone'

const emoji = computed(() => {
  const v = props.icon?.trim() ?? ''
  return NON_ASCII.test(v) ? v : ''
})
const glyph = computed(() => {
  const v = (props.icon ?? '').toLowerCase()
  return GLYPHS.find((g) => g.match.test(v))?.glyph ?? FALLBACK
})
</script>

<template>
  <span v-if="emoji" aria-hidden="true">{{ emoji }}</span>
  <UIcon v-else :name="glyph" aria-hidden="true" />
</template>
