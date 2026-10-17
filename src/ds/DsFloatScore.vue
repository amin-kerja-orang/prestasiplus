<script setup lang="ts">
/**
 * "+n Mata" float-up pill (design system 6, "Toast / float"). CSS animation only and `aria-hidden`:
 * it is NOT announced. Callers must announce the score through `DsFeedbackSheet` (its text block
 * is the live region), for example by naming the points in the title or body.
 */
defineProps<{
  /** Text of the pill, e.g. "+10". */
  text: string
}>()
</script>

<template>
  <span
    class="pointer-events-none inline-flex animate-ds-floatup rounded-full bg-highlight px-2.5 py-0.5 font-display text-subheading font-extrabold text-on-highlight motion-reduce:animate-none"
    aria-hidden="true"
    data-ds="float-score"
    >{{ text }}</span
  >
</template>
