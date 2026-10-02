<script setup lang="ts">
/**
 * One role panel of S26/S27 (FR-M09-114, FR-M09-115): the numbered steps ending in the green "done"
 * step, the feature grid and the FAQ accordion. Every FAQ item toggles on its own (`open`).
 */
import { ChevronDown, Gamepad2, Presentation, UserPlus, Wrench } from '@lucide/vue'
import { reactive, type Component } from 'vue'

import type { GuideRole, RoleIconKey, RoleSectionIconKey, Segment } from '../../lib/panduan-content'

const props = defineProps<{ role: GuideRole }>()

/** Heading icons, only where a screenshot shows one (Pelajar, Guru). */
const STEP_ICONS: Record<RoleIconKey, Component> = {
  'user-plus': UserPlus,
  presentation: Presentation,
}
const SECTION_ICONS: Record<RoleSectionIconKey, Component> = { gamepad: Gamepad2, wrench: Wrench }

const ACCENT_BG = {
  blue: 'bg-blue-500',
  green: 'bg-emerald-500',
  purple: 'bg-purple-500',
  amber: 'bg-amber-500',
  teal: 'bg-teal-500',
} as const
const ACCENT_TEXT = {
  blue: 'text-blue-500',
  green: 'text-emerald-500',
  purple: 'text-purple-500',
  amber: 'text-amber-500',
  teal: 'text-teal-500',
} as const

const open = reactive<Record<number, boolean>>({})

function toggle(index: number): void {
  open[index] = !open[index]
}

function isBold(seg: Segment): seg is { b: string } {
  return typeof seg !== 'string'
}
</script>

<template>
  <div class="space-y-5" :data-testid="`panduan-panel-${props.role.id}`">
    <section class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
      <h2
        class="mb-5 flex items-center gap-2 font-heading text-lg font-bold text-slate-900 sm:text-xl"
      >
        <component
          :is="STEP_ICONS[props.role.stepsIcon]"
          v-if="props.role.stepsIcon"
          class="h-5 w-5 flex-shrink-0"
          :class="ACCENT_TEXT[props.role.accent]"
          aria-hidden="true"
        />
        {{ props.role.stepsTitle }}
      </h2>
      <ol class="space-y-4">
        <li v-for="(step, i) in props.role.steps" :key="step.title" class="flex gap-3">
          <span
            class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
            :class="ACCENT_BG[props.role.accent]"
            >{{ i + 1 }}</span
          >
          <div class="min-w-0">
            <h3 class="font-heading font-bold text-slate-900">{{ step.title }}</h3>
            <p class="text-sm text-slate-600">
              <template v-for="(seg, j) in step.text" :key="j"
                ><strong v-if="isBold(seg)" class="font-bold text-slate-700">{{ seg.b }}</strong
                ><template v-else>{{ seg }}</template></template
              >
            </p>
          </div>
        </li>
        <li class="flex gap-3" data-testid="panduan-done-step">
          <span
            class="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white"
            aria-hidden="true"
            >✓</span
          >
          <div class="min-w-0">
            <h3 class="font-heading font-bold text-emerald-600">{{ props.role.done.title }}</h3>
            <p class="text-sm text-slate-600">
              <template v-for="(seg, j) in props.role.done.text" :key="j">{{ seg }}</template>
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
      <h2
        class="mb-5 flex items-center gap-2 font-heading text-lg font-bold text-slate-900 sm:text-xl"
      >
        <component
          :is="SECTION_ICONS[props.role.featuresIcon]"
          v-if="props.role.featuresIcon"
          class="h-5 w-5 flex-shrink-0 text-purple-500"
          aria-hidden="true"
        />
        {{ props.role.featuresTitle }}
      </h2>
      <div
        class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="panduan-features"
      >
        <div
          v-for="(feature, i) in props.role.features"
          :key="`${feature.title}-${String(i)}`"
          class="rounded-2xl border border-slate-200 bg-white p-4"
          data-testid="panduan-feature"
        >
          <div class="mb-1 text-xl" aria-hidden="true">{{ feature.emoji }}</div>
          <h3 class="font-heading text-sm font-bold text-slate-900">{{ feature.title }}</h3>
          <p class="text-xs text-slate-500">{{ feature.text }}</p>
        </div>
      </div>
    </section>

    <section class="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
      <h2
        class="mb-5 flex items-center gap-2 font-heading text-lg font-bold text-slate-900 sm:text-xl"
      >
        <span
          class="inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white"
          aria-hidden="true"
          >?</span
        >
        {{ props.role.faqTitle }}
      </h2>
      <div class="space-y-2">
        <div
          v-for="(faq, i) in props.role.faqs"
          :key="faq.q"
          class="rounded-xl border border-slate-100 bg-slate-50"
          data-testid="panduan-faq"
        >
          <div
            class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 px-4 py-2 text-left text-sm font-semibold text-slate-800"
            data-testid="panduan-faq-toggle"
            @click="toggle(i)"
          >
            <span>{{ faq.q }}</span>
            <ChevronDown
              class="h-4 w-4 flex-shrink-0 text-slate-400 transition-transform"
              :class="{ 'rotate-180': open[i] }"
              aria-hidden="true"
            />
          </div>
          <p
            v-if="open[i]"
            class="px-4 pb-3 text-sm text-slate-600"
            data-testid="panduan-faq-answer"
          >
            {{ faq.a }}
          </p>
        </div>
      </div>
    </section>
  </div>
</template>
