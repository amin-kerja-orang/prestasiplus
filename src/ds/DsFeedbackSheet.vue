<script setup lang="ts">
/**
 * Quiz feedback sheet (design system 6, "Feedback sheet"). Bottom panel in a green (good) or red
 * (bad) mix: round glyph + title, explanation, an optional friend / AI line in an elevated bubble,
 * a combo chip and the full-width continue button. A polite `role="status"` region. No
 * celebration on a wrong answer: the "bad" tone only shows an x glyph and the text from the caller.
 */
import DsArt3D from './DsArt3D.vue'

type FeedbackTone = 'good' | 'bad'

withDefaults(
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
  }>(),
  { body: undefined, aiLine: undefined, aiLabel: undefined, combo: undefined },
)

defineEmits<{ continue: [] }>()
</script>

<template>
  <section
    class="relative animate-ds-sheet overflow-hidden rounded-3xl bg-default p-3.5 motion-reduce:animate-none"
    role="status"
    aria-live="polite"
    :data-tone="tone"
    data-ds="feedback-sheet"
  >
    <span
      class="pointer-events-none absolute inset-0"
      :class="tone === 'good' ? 'bg-success/16' : 'bg-error/14'"
      aria-hidden="true"
    />
    <div class="relative flex flex-col gap-3">
      <div class="flex flex-col gap-1">
        <h3
          class="flex items-center gap-2 font-display text-heading font-extrabold text-highlighted"
        >
          <span
            class="inline-grid size-6.5 shrink-0 place-items-center rounded-full text-on-sem"
            :class="tone === 'good' ? 'bg-success' : 'bg-error'"
            aria-hidden="true"
          >
            <UIcon
              :data-glyph="tone === 'good' ? 'check' : 'x'"
              :name="tone === 'good' ? 'i-ph-check-bold' : 'i-ph-x-bold'"
              class="size-4"
            />
          </span>
          {{ title }}
        </h3>
        <p v-if="body" class="text-body text-default">{{ body }}</p>
        <p
          v-if="aiLine"
          class="mt-1.5 rounded-xl bg-elevated px-3 py-2 text-body text-highlighted"
          data-ds="feedback-ai"
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
        @click="$emit('continue')"
        >{{ continueLabel }}</UButton
      >
    </div>
  </section>
</template>
