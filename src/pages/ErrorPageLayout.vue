<script setup lang="ts">
/**
 * Shared template of the standalone 404 and 403 pages (design-system §7.15): no shell, a
 * full-screen diagonal gradient, a large translucent code, an emoji, the heading and message,
 * two pill links and the "PRESTASIPLUS" caption.
 *
 * Live uses the browser's system font on these pages (00-global-ui §5, overview §8.2 item 7), so
 * the root and the h1 set `font-sans` (the h1 needs it because base.css defaults h1–h6 to Outfit).
 *
 * Classes are full strings passed in by each page (overview §8.2 item 2: no built class names).
 * Sizes and spacing were measured from the live screenshots at 1280 (INFERRED classes; discovery
 * captured no markup for these pages).
 */
import { RouterLink, type RouteLocationRaw } from 'vue-router'

export interface ErrorPageLink {
  label: string
  to: RouteLocationRaw
}

defineProps<{
  /** "404" or "403". */
  code: string
  emoji: string
  heading: string
  message: string
  primary: ErrorPageLink
  secondary: ErrorPageLink
  /** Background gradient utilities for the root. */
  backgroundClass: string
  /** Text colour of the white primary pill. */
  primaryTextClass: string
  /** Max width of the message (the two live pages wrap at different widths). */
  messageWidthClass: string
}>()
</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center px-4 py-8 font-sans"
    :class="backgroundClass"
  >
    <div class="text-center">
      <div class="text-9xl leading-none font-black text-white/30">{{ code }}</div>
      <div class="-mt-1 mb-6.5 text-[4rem] leading-none">{{ emoji }}</div>
      <h1 class="mb-2 font-sans text-2xl font-bold text-white">{{ heading }}</h1>
      <p class="mx-auto mb-9 text-[15px] leading-[1.65] text-white/80" :class="messageWidthClass">
        {{ message }}
      </p>
      <div class="flex flex-wrap justify-center gap-3">
        <RouterLink
          :to="primary.to"
          class="inline-flex items-center justify-center rounded-full border border-white bg-white px-8 py-3 leading-[normal] font-semibold"
          :class="primaryTextClass"
        >
          {{ primary.label }}
        </RouterLink>
        <RouterLink
          :to="secondary.to"
          class="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/20 px-8 py-3 leading-[normal] font-semibold text-white"
        >
          {{ secondary.label }}
        </RouterLink>
      </div>
      <div class="mt-13 text-xs font-semibold tracking-[0.2em] text-white/50">PRESTASIPLUS</div>
    </div>
  </main>
</template>
