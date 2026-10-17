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
    }"
    data-ds="carousel"
  >
    <slot name="item" :item="item as T" :index="index" />
  </UCarousel>
</template>
