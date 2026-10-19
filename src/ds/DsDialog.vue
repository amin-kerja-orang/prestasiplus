<script setup lang="ts">
/**
 * Dialog: `UModal` from `sm` up, bottom-sheet `UDrawer` below `sm`. No dividers. Body is the
 * default slot, actions go in `footer`. Esc / scrim close it unless `dismissible` is false.
 * `size` sets the modal width, `tone="error"` marks a destructive dialog and `loading` (the
 * confirmed action is running) blocks dismissal and sets `aria-busy`.
 */
import { computed } from 'vue'

import { useMedia } from './useMedia'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    dismissible?: boolean
    size?: 'sm' | 'md' | 'lg'
    tone?: 'default' | 'error'
    loading?: boolean
  }>(),
  { description: undefined, dismissible: true, size: 'md', tone: 'default', loading: false },
)

const open = defineModel<boolean>('open', { default: false })
const roomy = useMedia('(min-width: 640px)')

const canDismiss = computed(() => props.dismissible && !props.loading)
const WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl' } as const
const modalUi = computed(() => ({
  content: WIDTH[props.size],
  ...(props.tone === 'error' ? { title: 'text-error' } : {}),
}))
</script>

<template>
  <UModal
    v-if="roomy"
    v-model:open="open"
    :title="title"
    :description="description ?? ' '"
    :dismissible="canDismiss"
    :ui="modalUi"
    :aria-busy="loading ? 'true' : undefined"
    :data-tone="tone"
    :data-size="size"
    data-ds="dialog"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer>
      <div class="flex w-full flex-wrap justify-end gap-2"><slot name="footer" /></div>
    </template>
  </UModal>
  <UDrawer
    v-else
    v-model:open="open"
    :title="title"
    :description="description ?? ' '"
    :dismissible="canDismiss"
    :aria-busy="loading ? 'true' : undefined"
    :data-tone="tone"
    :data-size="size"
    data-ds="dialog"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer>
      <div class="flex w-full flex-col gap-2"><slot name="footer" /></div>
    </template>
  </UDrawer>
</template>
