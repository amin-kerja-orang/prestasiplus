<script setup lang="ts" generic="T extends Record<string, unknown>">
/**
 * Carousel (design system 6, "Info carousel"): `UCarousel` with dots and a named region. Slides
 * are rendered by the caller through the `item` slot. Dots are the navigation (44px targets come
 * from the theme); arrows stay off on touch layouts.
 */
withDefaults(
  defineProps<{
    items: T[]
    /** Accessible name of the carousel region (BM). */
    label: string
    arrows?: boolean
    dots?: boolean
    loop?: boolean
  }>(),
  { arrows: false, dots: true, loop: false },
)

// Arrows sit in the dots row (inside the carousel), never in the page gutter. The `translate-y-0` cancels the
// theme's vertical centring (`-translate-y-1/2`).
const ARROW_PREV = 'top-auto bottom-0 start-0 translate-y-0 sm:start-0'
const ARROW_NEXT = 'top-auto bottom-0 end-0 translate-y-0 sm:end-0'
defineSlots<{ item(props: { item: T; index: number }): unknown }>()
</script>

<template>
  <UCarousel
    v-slot="{ item, index }"
    :items="items"
    :arrows="arrows"
    :dots="dots"
    :loop="loop"
    :aria-label="label"
    :ui="{
      item: 'basis-full',
      dots: 'mt-3 bottom-auto relative inset-x-0',
      dot: 'bg-accented data-[state=active]:bg-friend',
      prev: ARROW_PREV,
      next: ARROW_NEXT,
    }"
    data-ds="carousel"
  >
    <slot name="item" :item="item as T" :index="index" />
  </UCarousel>
</template>
