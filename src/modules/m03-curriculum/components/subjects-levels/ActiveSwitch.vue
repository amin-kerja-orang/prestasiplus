<script setup lang="ts">
/**
 * The "Aktif?" switch of S6 and S9 (FR-42, FR-59): pill track, emerald when on, slate when off.
 * Presentational: it only emits `toggle`; the page flips the value at once, calls the API and
 * reverts on failure. No ARIA beyond live (D10); the 44 px hit area is the button, the track inside
 * is 44 x 24.
 */
import type { Accent } from '../../lib/subjects-levels'

withDefaults(defineProps<{ active: boolean; accent?: Accent }>(), { accent: 'indigo' })
defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg focus:outline-none focus-visible:ring-2"
    :class="accent === 'pink' ? 'focus-visible:ring-pink-500' : 'focus-visible:ring-indigo-500'"
    @click="$emit('toggle')"
  >
    <span
      class="relative inline-block h-6 w-11 shrink-0 rounded-full transition-colors"
      :class="active ? 'bg-emerald-500' : 'bg-slate-300'"
      data-testid="switch-track"
    >
      <span
        class="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
        :class="active ? 'translate-x-5' : 'translate-x-0'"
      ></span>
    </span>
  </button>
</template>
