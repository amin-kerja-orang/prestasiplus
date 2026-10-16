<script setup lang="ts">
/** Text with `$latex$` spans, rendered with KaTeX (see lib/rich-text.ts). */
import 'katex/dist/katex.min.css'
import { computed } from 'vue'

import { renderMath, renderRich } from '../lib/rich-text'

const props = withDefaults(defineProps<{ text: string; mathOnly?: boolean }>(), { mathOnly: false })

const html = computed(() => (props.mathOnly ? renderMath(props.text) : renderRich(props.text)))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- escaped text + KaTeX output (trust: false) -->
  <span class="break-words" data-testid="rich-text" v-html="html" />
</template>
