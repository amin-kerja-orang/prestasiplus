<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { AppIcon } from '@/components/icon'

defineProps<{ to: string; label: string }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-700"
    data-testid="back-link"
  >
    <AppIcon name="fa-arrow-left" class="h-4 w-4" /> {{ label }}
  </RouterLink>
</template>
