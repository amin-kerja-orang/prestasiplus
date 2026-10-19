<script setup lang="ts">
/**
 * Dev-only token gallery (F-02 acceptance). Renders every custom token of theme.css / motion.css.
 * Registered as a dev-mode route by the router task (F-13); never part of the demo build.
 */
import {
  colorTokens,
  fontTokens,
  gradientTokens,
  motionTokens,
  shadowTokens,
  variantTokens,
} from '../tokens'
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4 sm:p-8" data-testid="dev-token-gallery">
    <h1 class="text-2xl font-bold">Design tokens</h1>

    <section class="mt-8">
      <h2 class="text-lg font-bold">Fonts</h2>
      <ul class="mt-3 space-y-2">
        <li v-for="t in fontTokens" :key="t.className" :class="t.className" class="text-lg">
          {{ t.className }} — {{ t.note }} — Aa Bb 123 · كتاب
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="text-lg font-bold">Colours</h2>
      <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <li v-for="t in colorTokens" :key="t.className" class="rounded-xl bg-white p-3 text-xs">
          <div :class="t.className" class="h-12 rounded-lg border border-slate-200" />
          <p class="mt-2 font-semibold break-all">{{ t.className }}</p>
          <p class="text-slate-500">{{ t.note }}</p>
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="text-lg font-bold">Gradients and backgrounds</h2>
      <ul class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li v-for="t in gradientTokens" :key="t.className" class="rounded-xl bg-white p-3 text-xs">
          <div :class="t.className" class="h-16 rounded-lg" />
          <p class="mt-2 font-semibold">{{ t.className }}</p>
          <p class="text-slate-500">{{ t.note }}</p>
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="text-lg font-bold">Shadows</h2>
      <ul class="mt-3 grid grid-cols-2 gap-6 sm:grid-cols-3">
        <li v-for="t in shadowTokens" :key="t.className" class="text-xs">
          <div :class="t.className" class="h-16 rounded-2xl bg-white" />
          <p class="mt-2 font-semibold">{{ t.className }}</p>
          <p class="text-slate-500">{{ t.note }}</p>
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="text-lg font-bold">Motion</h2>
      <ul class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <li v-for="t in motionTokens" :key="t.className" class="rounded-xl bg-white p-3 text-xs">
          <div
            :class="t.className"
            class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-auth text-2xl"
          >
            🎓
          </div>
          <p class="mt-2 font-semibold">{{ t.className }}</p>
          <p class="text-slate-500">{{ t.note }}</p>
        </li>
      </ul>
    </section>

    <section class="mt-8">
      <h2 class="text-lg font-bold">Variants</h2>
      <ul class="mt-3 space-y-2 text-sm">
        <li v-for="t in variantTokens" :key="t.className">
          <span :class="t.className" class="opacity-30">{{ t.className }}</span>
          — {{ t.note }} (full opacity on touch devices)
        </li>
      </ul>
    </section>
  </div>
</template>
