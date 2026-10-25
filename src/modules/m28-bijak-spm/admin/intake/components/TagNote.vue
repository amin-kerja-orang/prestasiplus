<script setup lang="ts">
/**
 * One-line note under a Tag DSKP control (design 3.7): an icon and a caption. `status` makes it a
 * polite live region (the tingkatan and unit notices); `tone` is info for a notice, warning for the
 * "AI found no match" caption, muted for "changed from the AI suggestion".
 */
import { DsCluster, DsText } from '@/ds'

withDefaults(
  defineProps<{
    icon?: string
    tone?: 'info' | 'warning' | 'muted'
    status?: boolean
  }>(),
  { icon: 'i-ph-info', tone: 'info', status: false },
)
</script>

<template>
  <DsCluster gap="xs" align="start" :wrap="false" :role="status ? 'status' : undefined">
    <UIcon :name="icon" class="size-4 shrink-0" aria-hidden="true" />
    <DsText variant="caption" as="span" :tone="tone"><slot /></DsText>
  </DsCluster>
</template>
