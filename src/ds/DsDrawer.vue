<script setup lang="ts">
/**
 * Side drawer (admin page templates G10): a slide-over from the right (or left) from `sm` up and a
 * bottom sheet below `sm`, the same split as `DsDialog`. For a filter-style panel, a detail or a
 * side form. Body is the default slot, actions go in `footer`. Esc / scrim close it unless
 * `dismissible` is false; `loading` (the action is running) blocks dismissal and sets `aria-busy`.
 * `size` sets the panel width (sm 24rem, md 32rem, lg 42rem).
 */
import { computed } from 'vue'

import { useMedia } from './useMedia'

const props = withDefaults(
  defineProps<{
    title: string
    description?: string
    side?: 'right' | 'left'
    size?: 'sm' | 'md' | 'lg'
    dismissible?: boolean
    loading?: boolean
  }>(),
  { description: undefined, side: 'right', size: 'md', dismissible: true, loading: false },
)

const open = defineModel<boolean>('open', { default: false })
const roomy = useMedia('(min-width: 640px)')

const canDismiss = computed(() => props.dismissible && !props.loading)
const WIDTH = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' } as const
/** Close button of both surfaces: Nuxt UI renders none on `UDrawer` by default, and its slide-over one is 32px. */
const closeButton = { class: 'min-h-11 min-w-11 justify-center' }
const ui = computed(() => ({
  content: `${WIDTH[props.size]} w-full`,
  title: 'text-heading text-highlighted',
  description: 'text-body text-muted',
  body: 'p-5',
  header: 'p-5',
  footer: 'p-5',
}))
</script>

<template>
  <USlideover
    v-if="roomy"
    v-model:open="open"
    :title="title"
    :description="description ?? ' '"
    :side="side"
    :dismissible="canDismiss"
    :close="closeButton"
    :ui="ui"
    :aria-busy="loading ? 'true' : undefined"
    :data-side="side"
    :data-size="size"
    data-ds="drawer"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer>
      <div class="flex w-full flex-wrap justify-end gap-2"><slot name="footer" /></div>
    </template>
  </USlideover>
  <UDrawer
    v-else
    v-model:open="open"
    :title="title"
    :description="description ?? ' '"
    :dismissible="canDismiss"
    :close="closeButton"
    :aria-busy="loading ? 'true' : undefined"
    :data-size="size"
    data-ds="drawer"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer>
      <div class="flex w-full flex-col gap-2"><slot name="footer" /></div>
    </template>
  </UDrawer>
</template>
