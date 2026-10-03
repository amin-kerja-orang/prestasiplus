<script setup lang="ts">
/** FN-M10-2.1.1: dismissible "Mula Di Sini" guide and its pill (FR-M10-08). */
import { CircleHelp, Lightbulb, Rocket, X } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import { DASH_COPY } from './copy'
import { readGuideHidden, writeGuideHidden } from './lib'

const hidden = ref(readGuideHidden())
const STEP_TONES = [
  'bg-indigo-100 text-indigo-600',
  'bg-emerald-100 text-emerald-600',
  'bg-amber-100 text-amber-600',
]
const LINK_TONES = ['text-indigo-600', 'text-emerald-600', 'text-amber-600']

function set(value: boolean): void {
  hidden.value = value
  writeGuideHidden(value)
}
</script>

<template>
  <div data-testid="guide-wrap">
    <button
      v-if="hidden"
      type="button"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800"
      data-testid="guide-show"
      @click="set(false)"
    >
      <CircleHelp class="h-4 w-4" />{{ DASH_COPY.showGuide }}
    </button>
    <section
      v-else
      class="relative rounded-2xl bg-linear-to-br from-indigo-50 to-blue-50 p-4 shadow-sm sm:p-5"
      data-testid="guide-card"
    >
      <button
        type="button"
        class="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600"
        data-testid="guide-close"
        @click="set(true)"
      >
        <X class="h-4 w-4" />
      </button>
      <div class="flex items-center gap-2 pr-10">
        <Rocket class="h-5 w-5 shrink-0 text-indigo-600" />
        <h3 class="font-heading text-base font-bold text-slate-800" data-testid="guide-title">
          {{ DASH_COPY.guideTitle }}
        </h3>
      </div>
      <p class="mt-1 text-sm text-slate-600">{{ DASH_COPY.guideIntro }}</p>
      <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div
          v-for="(s, i) in DASH_COPY.guideSteps"
          :key="s.title"
          class="min-w-0 rounded-xl bg-white p-4 text-center shadow-sm"
          data-testid="guide-step"
        >
          <span
            :class="[
              'mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold',
              STEP_TONES[i],
            ]"
            >{{ i + 1 }}</span
          >
          <p class="mt-2 text-sm font-bold text-slate-800">{{ s.title }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ s.text }}</p>
          <RouterLink
            :to="s.to"
            :class="['mt-2 inline-flex min-h-11 items-center text-sm font-semibold', LINK_TONES[i]]"
            data-testid="guide-link"
            >{{ s.link }}</RouterLink
          >
        </div>
      </div>
      <p class="mt-3 flex items-start gap-2 text-sm text-slate-500">
        <Lightbulb class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span
          ><strong>{{ DASH_COPY.tipLabel }}</strong> {{ DASH_COPY.tipText }}</span
        >
      </p>
    </section>
  </div>
</template>
