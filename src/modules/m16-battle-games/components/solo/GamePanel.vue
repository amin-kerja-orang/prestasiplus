<script setup lang="ts">
/**
 * The dark game panel of S13-S16 and S19 (live screenshots betul-salah-playing, cabaran-kilat-playing,
 * tembak-jawapan-playing, susun-jawapan-playing, jutawan-subjects): a full-height gradient area directly
 * under the shell header, in the colour of the game. Text on it is white or a light tint (≥ 4.5:1).
 */
defineProps<{ theme: 'indigo' | 'violet' | 'ember' | 'teal' | 'navy' }>()

const THEME = {
  indigo: 'from-slate-950 via-indigo-950 to-slate-900',
  violet: 'from-indigo-950 via-indigo-900 to-slate-900',
  ember: 'from-slate-950 via-stone-950 to-neutral-950',
  teal: 'from-teal-900 via-teal-950 to-slate-950',
  navy: 'from-slate-900 via-slate-900 to-blue-950',
} as const
</script>

<template>
  <div
    class="-my-3 min-h-[calc(100vh-5.5rem)] bg-gradient-to-b px-3 py-6 text-white sm:-my-6 sm:px-6 lg:bg-gradient-to-br"
    :class="THEME[theme]"
    data-testid="game-panel"
  >
    <slot />
  </div>
</template>
