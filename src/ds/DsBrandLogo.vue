<script setup lang="ts">
/**
 * Official PRESTASIPLUS logo (alt "PRESTASIPLUS"). Light mode shows `prestasiplus-logo.svg`; dark mode
 * shows `prestasiplus-logo-dark.svg`, the same artwork with the dark blue lettering in white, so it reads
 * on dark surfaces with no backing chip (user, 2026-10-18). `backed` is kept for API compatibility.
 */
withDefaults(
  defineProps<{ backed?: boolean; size?: 'md' | 'xl' }>(),
  { backed: false, size: 'md' },
)

// Runtime URL (`:src`), not a literal `src`, so the template compiler does not make it an import.
const LOGO_URL = `${import.meta.env.BASE_URL}images/prestasiplus-logo.svg`
const LOGO_DARK_URL = `${import.meta.env.BASE_URL}images/prestasiplus-logo-dark.svg`
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center"
    data-ds="brand-logo"
    :data-backed="backed"
  >
    <img :src="LOGO_URL" alt="PRESTASIPLUS" :class="size === 'xl' ? 'h-12 sm:h-14' : 'h-6 sm:h-8'" class="w-auto dark:hidden" />
    <img :src="LOGO_DARK_URL" alt="PRESTASIPLUS" :class="size === 'xl' ? 'h-12 sm:h-14' : 'h-6 sm:h-8'" class="hidden w-auto dark:block" />
  </span>
</template>
