<script setup lang="ts">
/**
 * Row actions of an admin table or card in one `UDropdownMenu` ("..." trigger, 44 px). Link actions use
 * `to`; the others emit through `onSelect`. Destructive items use the error colour.
 */
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed } from 'vue'

export interface RowAction {
  label: string
  icon: string
  to?: string
  danger?: boolean
  disabled?: boolean
  onSelect?: () => void
}

const props = withDefaults(
  defineProps<{ actions: RowAction[]; label?: string; testid?: string }>(),
  {
    label: 'Tindakan',
    testid: 'row-menu',
  },
)

const items = computed<DropdownMenuItem[][]>(() => {
  const toItem = (a: RowAction): DropdownMenuItem => ({
    label: a.label,
    icon: a.icon,
    ...(a.to ? { to: a.to } : {}),
    ...(a.danger ? { color: 'error' as const } : {}),
    disabled: a.disabled ?? false,
    ...(a.onSelect ? { onSelect: a.onSelect } : {}),
  })
  const safe = props.actions.filter((a) => !a.danger).map(toItem)
  const danger = props.actions.filter((a) => a.danger).map(toItem)
  return danger.length > 0 && safe.length > 0 ? [safe, danger] : [[...safe, ...danger]]
})
</script>

<template>
  <UDropdownMenu :items="items" :content="{ align: 'end' }">
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      icon="i-ph-dots-three-vertical"
      :aria-label="label"
      :title="label"
      class="min-h-11 min-w-11 justify-center"
      :data-testid="testid"
    />
  </UDropdownMenu>
</template>
