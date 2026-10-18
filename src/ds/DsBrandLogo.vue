<script setup lang="ts">
/**
 * Official PRESTASIPLUS logo (alt "PRESTASIPLUS", `public/images/prestasiplus-logo.svg`). The logo
 * has dark blue lettering, so in dark mode (or when `backed`, on a coloured bar) it sits on a light
 * backing chip (`ds-extras.css`); the artwork itself is never recoloured.
 */
withDefaults(defineProps<{ backed?: boolean }>(), { backed: false })

// Runtime URL (`:src`), not a literal `src`, so the template compiler does not make it an import.
const LOGO_URL = `${import.meta.env.BASE_URL}images/prestasiplus-logo.svg`
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center"
    data-ds="brand-logo"
    :data-backed="backed"
  >
    <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-6 w-auto sm:h-8" />
  </span>
</template>
