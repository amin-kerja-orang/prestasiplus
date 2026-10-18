<script setup lang="ts">
/**
 * Friend speech bubble (design system 6, "Friend greeting" and "Win screen"): raised surface,
 * radius 18/18/18/6, optional name caption, and a typing-dots state. Copy comes from the caller.
 */
withDefaults(
  defineProps<{
    /** Name caption above the line (e.g. the friend's name). */
    name?: string
    /** Show the three typing dots instead of the content. */
    typing?: boolean
    /** Screen-reader text while typing (BM, from the caller). */
    typingLabel?: string
    /** Announce content changes politely (win dialog, feedback). */
    live?: boolean
  }>(),
  { name: undefined, typing: false, typingLabel: undefined, live: false },
)
</script>

<template>
  <div
    class="flex min-w-0 animate-ds-rise flex-col gap-0.5 rounded-card rounded-bl-md bg-default px-3.5 py-2.5 text-body text-highlighted shadow-lift motion-reduce:animate-none"
    :role="live ? 'status' : undefined"
    :aria-live="live ? 'polite' : undefined"
    data-ds="speech-bubble"
  >
    <template v-if="typing">
      <span v-if="typingLabel" class="sr-only">{{ typingLabel }}</span>
      <span class="flex h-5.5 items-center gap-1.5" aria-hidden="true" data-ds="typing-dots">
        <span class="size-1.5 animate-bounce rounded-full bg-accented motion-reduce:animate-none" />
        <span
          class="size-1.5 animate-bounce rounded-full bg-accented delay-150 motion-reduce:animate-none"
        />
        <span
          class="size-1.5 animate-bounce rounded-full bg-accented delay-300 motion-reduce:animate-none"
        />
      </span>
    </template>
    <template v-else>
      <span v-if="name" class="text-caption text-muted">{{ name }}</span>
      <slot />
    </template>
  </div>
</template>
