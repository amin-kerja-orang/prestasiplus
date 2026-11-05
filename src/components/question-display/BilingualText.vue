<script setup lang="ts">
/**
 * Bilingual text by the shared language choice (FR-PA-04): both = BM block, hairline, English block
 * (same size); `ms` / `en` = one block. A field with a single language shows it as is in every mode.
 */
import { computed } from 'vue'

import { DsStack } from '@/ds'

import { useQuestionLang } from './lib/question-lang'
import RichText from './RichText.vue'

const props = defineProps<{ text: string; en?: string; markup?: boolean }>()
const { lang } = useQuestionLang()
const bilingual = computed(() => !!props.en?.trim())
const showMs = computed(() => !bilingual.value || lang.value !== 'en')
const showEn = computed(() => bilingual.value && lang.value !== 'ms')
</script>

<template>
  <DsStack as="div" gap="xs" data-testid="bilingual-text">
    <RichText v-if="showMs" :text="text" :markup="markup" data-testid="lang-ms-block" />
    <hr v-if="showMs && showEn" class="qd-divider" data-testid="lang-divider" />
    <RichText v-if="showEn" :text="en as string" :markup="markup" data-testid="lang-en-block" />
  </DsStack>
</template>

<style scoped>
.qd-divider {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--ui-border);
}
</style>
