<script setup lang="ts">
/**
 * Segmented control "BM" / "English" / "BM + English" (FR-PA-04). Reads and writes the shared,
 * persisted choice (`useQuestionLang`). Render it only when the content is bilingual: the parent decides.
 */
import { langCopy } from './copy'
import { type QuestionLang, useQuestionLang } from './lib/question-lang'

const { lang, setLang } = useQuestionLang()
const options: { value: QuestionLang; label: string }[] = [
  { value: 'ms', label: langCopy.ms },
  { value: 'en', label: langCopy.en },
  { value: 'both', label: langCopy.both },
]
</script>

<template>
  <div
    role="group"
    :aria-label="langCopy.aria"
    class="inline-flex flex-wrap gap-1 rounded-2xl bg-muted p-1"
    data-testid="language-toggle"
  >
    <UButton
      v-for="o in options"
      :key="o.value"
      type="button"
      color="neutral"
      :variant="lang === o.value ? 'solid' : 'ghost'"
      :aria-pressed="lang === o.value"
      class="min-h-11 rounded-xl px-4"
      :data-testid="`lang-${o.value}`"
      @click="setLang(o.value)"
      >{{ o.label }}</UButton
    >
  </div>
</template>
