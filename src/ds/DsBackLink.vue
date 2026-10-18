<script setup lang="ts">
/** Back link: ghost button with an arrow, 44px touch target, default label "Kembali". */
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'

withDefaults(defineProps<{ to: RouteLocationRaw; label?: string }>(), { label: dsCopy.back })
</script>

<template>
  <UButton
    :to="to"
    color="neutral"
    variant="ghost"
    icon="i-ph-arrow-left"
    :label="label"
    class="min-h-11 w-fit"
    data-ds="back-link"
  />
</template>
