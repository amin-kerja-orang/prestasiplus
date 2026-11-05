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
    class="qd-lang-toggle"
    data-testid="language-toggle"
  >
    <UButton
      v-for="o in options"
      :key="o.value"
      type="button"
      color="neutral"
      :variant="lang === o.value ? 'solid' : 'ghost'"
      :aria-pressed="lang === o.value"
      class="qd-lang-btn min-h-11"
      :data-testid="`lang-${o.value}`"
      @click="setLang(o.value)"
      >{{ o.label }}</UButton
    >
  </div>
</template>

<style scoped>
/* Segmented control chrome (no utility classes). */
.qd-lang-toggle {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: var(--ds-r-card);
  background: var(--ui-bg-muted);
}
.qd-lang-toggle :deep(.qd-lang-btn) {
  padding-inline: 1rem;
  border-radius: var(--ds-r-chip, var(--ds-r-card));
}
</style>
