<script setup lang="ts">
/**
 * Row actions of a table row or card (design language 9.2): the first `inline` non-danger actions
 * are ghost icon buttons with a label, the rest sit in a "..." `UDropdownMenu` (44px trigger). Danger
 * actions get their own group at the end of the menu. An action with `confirm` asks through
 * `useConfirm()` before `onSelect` runs; `to` makes it a link.
 */
import type { DropdownMenuItem } from '@nuxt/ui'
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import { useConfirm } from './useConfirm'

export interface RowAction {
  label: string
  /** Phosphor class (`i-ph-pencil-simple`). */
  icon?: string
  to?: RouteLocationRaw
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
  /** Ask first. `true` uses the glossary dialog ("Padam {label}?"). */
  confirm?: boolean | { title?: string; body?: string; confirmLabel?: string }
}

const props = withDefaults(
  defineProps<{
    actions: RowAction[]
    /** Number of leading non-danger actions shown as buttons. */
    inline?: number
    /** Accessible name of the menu trigger. */
    label?: string
    testid?: string
  }>(),
  { inline: 0, label: dsCopy.rowActions, testid: 'row-menu' },
)

const confirm = useConfirm()

async function run(a: RowAction): Promise<void> {
  if (a.confirm) {
    const c = typeof a.confirm === 'object' ? a.confirm : {}
    const ok = await confirm({
      title: c.title ?? `${a.label}?`,
      message: c.body ?? dsCopy.actionIrreversible,
      confirmLabel: c.confirmLabel ?? a.label,
      cancelLabel: dsCopy.actionCancel,
      tone: a.danger ? 'danger' : 'primary',
    })
    if (!ok) return
  }
  a.onSelect?.()
}

const inlineActions = computed(() =>
  props.actions.filter((a) => !a.danger).slice(0, Math.max(0, props.inline)),
)
const menuActions = computed(() => props.actions.filter((a) => !inlineActions.value.includes(a)))

const items = computed<DropdownMenuItem[][]>(() => {
  const toItem = (a: RowAction): DropdownMenuItem => ({
    label: a.label,
    ...(a.icon ? { icon: a.icon } : {}),
    ...(a.to ? { to: a.to } : {}),
    ...(a.danger ? { color: 'error' as const } : {}),
    disabled: a.disabled ?? false,
    onSelect: () => {
      void run(a)
    },
  })
  const safe = menuActions.value.filter((a) => !a.danger).map(toItem)
  const danger = menuActions.value.filter((a) => a.danger).map(toItem)
  return danger.length > 0 && safe.length > 0 ? [safe, danger] : [[...safe, ...danger]]
})
</script>

<template>
  <div class="flex items-center justify-end gap-1" data-ds="row-actions">
    <UButton
      v-for="a in inlineActions"
      :key="a.label"
      type="button"
      color="neutral"
      variant="ghost"
      class="min-h-11"
      :icon="a.icon"
      :label="a.label"
      :to="a.to"
      :disabled="a.disabled"
      @click="run(a)"
    />
    <UDropdownMenu v-if="menuActions.length" :items="items" :content="{ align: 'end' }">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-ph-dots-three"
        :aria-label="label"
        :title="label"
        class="min-h-11 min-w-11 justify-center"
        :data-testid="testid"
      />
    </UDropdownMenu>
  </div>
</template>
