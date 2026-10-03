<script setup lang="ts">
/** FR-M05-02: the hero greeting (live section "1. HERO GREETING"). */
import { computed } from 'vue'

import type { GreetingPeriod } from '../../api/types'
import { greetingText } from './dashboard-lib'

const props = defineProps<{ period: GreetingPeriod; name: string }>()
const text = computed(() => greetingText(props.period, props.name))
</script>

<template>
  <div class="hero-gradient relative z-10 p-5 sm:p-10 md:p-14" data-testid="dash-hero">
    <div class="relative z-20 flex items-center justify-between">
      <div class="min-w-0">
        <h1
          class="mb-2 text-xl leading-tight font-black break-words text-white sm:mb-4 sm:text-4xl md:text-6xl"
          style="font-family: 'Outfit', sans-serif; text-shadow: 0 4px 12px rgba(0, 0, 0, 0.2)"
          data-testid="dash-greeting"
        >
          {{ text }}
          <span class="wave-emoji text-2xl sm:text-5xl md:text-7xl">👋</span>
        </h1>
        <p
          class="text-sm font-bold text-blue-50 sm:text-lg md:text-2xl"
          style="text-shadow: 0 2px 8px rgba(0, 0, 0, 0.15)"
          data-testid="dash-greeting-line"
        >
          Jom teruskan latihan hari ini! 🚀
        </p>
      </div>
      <!-- The sparkle is an inner element: its unlayered `display` would override `hidden`. -->
      <div class="hidden text-8xl opacity-90 md:block lg:text-9xl" data-testid="dash-hero-cap">
        <div class="icon-sparkle">🎓</div>
      </div>
    </div>
  </div>
</template>
