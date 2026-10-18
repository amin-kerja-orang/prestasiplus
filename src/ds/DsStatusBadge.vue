<script setup lang="ts">
/**
 * Status badge (glossary 4): one status maps to one icon, one BM word and one colour, so a state
 * never relies on colour alone. `label` overrides the word only for a documented live exception.
 */
import { computed } from 'vue'

import DsIcon from './DsIcon.vue'
import { statusMap } from './status'
import type { DsStatus } from './status'

const props = withDefaults(
  defineProps<{
    status: DsStatus
    /** Replaces the word (live exception). */
    label?: string
    size?: 'sm' | 'md'
  }>(),
  { label: undefined, size: 'md' },
)

const def = computed(() => statusMap[props.status])
</script>

<template>
  <UBadge
    :color="def.color"
    variant="subtle"
    :size="size"
    class="gap-1 whitespace-nowrap"
    data-ds="status-badge"
    :data-status="status"
  >
    <DsIcon :name="def.icon" weight="bold" class="size-4 shrink-0" />
    {{ label ?? def.word }}
  </UBadge>
</template>
