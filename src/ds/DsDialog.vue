<script setup lang="ts">
/**
 * Dialog: `UModal` from `sm` up, bottom-sheet `UDrawer` below `sm`. No dividers. Body is the
 * default slot, actions go in `footer`. Esc / scrim close it unless `dismissible` is false.
 */
import { useMedia } from './useMedia'

withDefaults(
  defineProps<{
    title: string
    description?: string
    dismissible?: boolean
  }>(),
  { description: undefined, dismissible: true },
)

const open = defineModel<boolean>('open', { default: false })
const roomy = useMedia('(min-width: 640px)')
</script>

<template>
  <UModal
    v-if="roomy"
    v-model:open="open"
    :title="title"
    :description="description ?? ' '"
    :dismissible="dismissible"
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
    :dismissible="dismissible"
    data-ds="dialog"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer>
      <div class="flex w-full flex-col gap-2"><slot name="footer" /></div>
    </template>
  </UDrawer>
</template>
