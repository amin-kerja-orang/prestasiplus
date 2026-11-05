<script setup lang="ts">
/** Text with `$latex$` spans, rendered with KaTeX (see lib/rich-text.ts). `markup` opts in to sanitised HTML + markers. */
import 'katex/dist/katex.min.css'
import { computed } from 'vue'

import { renderMarkup, renderMath, renderRich } from './lib/rich-text'

const props = withDefaults(defineProps<{ text: string; mathOnly?: boolean; markup?: boolean }>(), {
  mathOnly: false,
  markup: false,
})

const html = computed(() => {
  if (props.mathOnly) return renderMath(props.text)
  return props.markup ? renderMarkup(props.text) : renderRich(props.text)
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- escaped text + KaTeX output (trust: false) -->
  <span class="break-words" data-testid="rich-text" v-html="html" />
</template>
