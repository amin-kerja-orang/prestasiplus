<script setup lang="ts">
/**
 * Quiz feedback sheet (design system 6, "Feedback sheet"). Bottom panel in a green (good) or red
 * (bad) mix: round glyph + title, explanation, an optional friend / AI line in an elevated bubble,
 * a combo chip and the full-width continue button. Only the text block (title, explanation, AI
 * line) is a polite `role="status"` region, never the button. No
 * celebration on a wrong answer: the "bad" tone only shows an x glyph and the text from the caller.
 */
import { computed } from 'vue'

import DsArt3D from './DsArt3D.vue'
import { warnDeprecated } from './deprecate'

/** `good` / `bad` are deprecated aliases of `success` / `error`. */
type FeedbackTone = 'success' | 'error' | 'good' | 'bad'

const props = withDefaults(
  defineProps<{
    tone: FeedbackTone
    title: string
    body?: string
    /** Friend / AI line (elevated bubble). */
    aiLine?: string
    /** Small tag before the AI line, e.g. "AI". */
    aiLabel?: string
    /** Combo chip text, e.g. "+10". Shown with the flame. */
    combo?: string
    continueLabel: string
    /** Optional test ids of the inner parts (callers with E2E contracts). */
    testids?: { title?: string; body?: string; ai?: string; continue?: string }
  }>(),
  { body: undefined, aiLine: undefined, aiLabel: undefined, combo: undefined, testids: undefined },
)

defineEmits<{ continue: [] }>()

if (props.tone === 'good' || props.tone === 'bad') {
  warnDeprecated('DsFeedbackSheet', 'tone good/bad', 'tone success/error')
}
const good = computed(() => props.tone === 'success' || props.tone === 'good')
</script>

<template>
  <section
    class="relative animate-ds-sheet overflow-hidden rounded-sheet bg-default p-3.5 motion-reduce:animate-none"
    :data-tone="tone"
    data-ds="feedback-sheet"
  >
    <span
      class="pointer-events-none absolute inset-0"
      :class="good ? 'bg-success/16' : 'bg-error/14'"
      aria-hidden="true"
    />
    <div class="relative flex flex-col gap-3">
      <div class="flex flex-col gap-1" role="status" aria-live="polite" data-ds="feedback-live">
        <h3
          class="flex items-center gap-2 font-display text-heading font-extrabold text-highlighted"
          :data-testid="testids?.title"
        >
          <span
            class="inline-grid size-6.5 shrink-0 place-items-center rounded-full text-on-sem"
            :class="good ? 'bg-success' : 'bg-error'"
            aria-hidden="true"
          >
            <UIcon
              :data-glyph="good ? 'check' : 'x'"
              :name="good ? 'i-ph-check-bold' : 'i-ph-x-bold'"
              class="size-4"
            />
          </span>
          {{ title }}
        </h3>
        <p v-if="body" class="text-body text-default" :data-testid="testids?.body">{{ body }}</p>
        <p
          v-if="aiLine"
          class="mt-1.5 rounded-chip bg-elevated px-3 py-2 text-body text-highlighted"
          data-ds="feedback-ai"
          :data-testid="testids?.ai"
        >
          <UBadge v-if="aiLabel" color="info" variant="solid" size="sm" class="me-2">{{
            aiLabel
          }}</UBadge
          >{{ aiLine }}
        </p>
        <span
          v-if="combo"
          class="mt-1 inline-flex items-center gap-1.5 self-start rounded-full bg-default py-1 pr-3 pl-2 font-display font-extrabold text-highlighted"
          data-ds="feedback-combo"
        >
          <DsArt3D name="fire" size="xs" />
          {{ combo }}
        </span>
      </div>
      <UButton
        color="primary"
        variant="solid"
        size="lg"
        block
        data-ds="feedback-continue"
        :data-testid="testids?.continue"
        @click="$emit('continue')"
        >{{ continueLabel }}</UButton
      >
    </div>
  </section>
</template>
