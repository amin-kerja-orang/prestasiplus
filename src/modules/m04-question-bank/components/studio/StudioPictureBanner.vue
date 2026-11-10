<script setup lang="ts">
/**
 * KP-15: a short notice on the question edit screen when the open question has a missing or held picture (the import lost it, or the
 * `stimulus_missing` flag is open). Derived from the question read (`flags`, `imageHeld`); nothing is stored or sent.
 */
import { computed } from 'vue'

import { DsCallout } from '@/ds'

const PICTURE_MISSING_NOTICE = 'Gambar soalan ini tiada. Sila muat naik semula.'

const props = defineProps<{ flags?: readonly string[] | undefined; imageHeld?: boolean | undefined }>()
const show = computed(() => props.imageHeld === true || (props.flags ?? []).includes('stimulus_missing'))
</script>

<template>
  <DsCallout v-if="show" tone="warning" data-testid="studio-picture-missing">{{ PICTURE_MISSING_NOTICE }}</DsCallout>
</template>
