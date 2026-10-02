<script setup lang="ts">
/**
 * Facebook and Twitter brand glyphs of the S16 share card (live `fa-facebook-f`, `fa-twitter`;
 * design-system §6.9: no Lucide stand-ins for brand marks). Paths and viewBoxes: Font Awesome Free 6.7.2 by @fontawesome (https://fontawesome.com), icons licensed CC BY 4.0.
 * Size and colour come from the caller's classes (`fill: currentColor`).
 */
defineProps<{ name: 'facebook' | 'twitter' }>()

const GLYPHS = {
  facebook: {
    viewBox: '0 0 320 512',
    d: 'M80 299.3V512H196V299.3h86.5l18-97.8H196V166.9c0-51.7 20.3-71.5 72.7-71.5c16.3 0 29.4 .4 37 1.2V7.9C291.4 4 256.4 0 236.2 0C129.3 0 80 50.5 80 159.4v42.1H14v97.8H80z',
  },
  twitter: {
    viewBox: '0 0 512 512',
    d: 'M459.37 151.716c.325 4.548.325 9.097.325 13.645 0 138.72-105.583 298.558-298.558 298.558-59.452 0-114.68-17.219-161.137-47.106 8.447.974 16.568 1.299 25.34 1.299 49.055 0 94.213-16.568 130.274-44.832-46.132-.975-84.792-31.188-98.112-72.772 6.498.974 12.995 1.624 19.818 1.624 9.421 0 18.843-1.3 27.614-3.573-48.081-9.747-84.143-51.98-84.143-102.985v-1.299c13.969 7.797 30.214 12.67 47.431 13.319-28.264-18.843-46.781-51.005-46.781-87.391 0-19.492 5.197-37.36 14.294-52.954 51.655 63.675 129.3 105.258 216.365 109.807-1.624-7.797-2.599-15.918-2.599-24.04 0-57.828 46.782-104.934 104.934-104.934 30.213 0 57.502 12.67 76.67 33.137 23.715-4.548 46.456-13.32 66.599-25.34-7.798 24.366-24.366 44.833-46.132 57.827 21.117-2.273 41.584-8.122 60.426-16.243-14.292 20.791-32.161 39.308-52.628 54.253z',
  },
} as const
</script>

<template>
  <svg
    xmlns="http://www.w3.org/2000/svg"
    :viewBox="GLYPHS[name].viewBox"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="GLYPHS[name].d" />
  </svg>
</template>
