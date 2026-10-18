<script setup lang="ts">
/**
 * The S6 "Ikon" cell (FR-41, BR-05, DV-M03-01): a rounded tile with the subject colour at 12.5 %
 * alpha as background and the resolved icon (Lucide, mapped Font Awesome class or emoji) in the
 * colour itself. An empty or unresolvable value leaves the tile empty.
 */
import { computed } from 'vue'

import { AppIcon } from '@/components/icon'

import { tileBackground } from '../../lib/subjects-levels'

const props = defineProps<{ icon: string | null; color: string }>()

const style = computed(() => ({ backgroundColor: tileBackground(props.color), color: props.color }))
</script>

<template>
  <span
    class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-body leading-none"
    :style="style"
    data-testid="subject-icon"
  >
    <AppIcon :name="icon" class="h-5 w-5" />
  </span>
</template>
