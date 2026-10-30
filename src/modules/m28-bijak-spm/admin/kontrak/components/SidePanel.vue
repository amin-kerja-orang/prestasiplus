<script setup lang="ts">
/**
 * Right slide-over from `sm` up, bottom sheet below (design 4.4 and 4.9). Body is the default
 * slot, buttons go in `footer`. Esc / scrim close it unless `dismissible` is false.
 */
import { useMedia } from '@/ds/useMedia'

withDefaults(
  defineProps<{ title: string; description?: string; dismissible?: boolean }>(),
  { description: undefined, dismissible: true },
)
const open = defineModel<boolean>('open', { default: false })
const roomy = useMedia('(min-width: 640px)')
</script>

<template>
  <USlideover
    v-if="roomy"
    v-model:open="open"
    side="right"
    :title="title"
    :description="description ?? ' '"
    :dismissible="dismissible"
    :ui="{ content: 'sm:max-w-md' }"
    data-testid="side-panel"
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
    :dismissible="dismissible"
    data-testid="side-panel"
  >
    <template #body><slot /></template>
    <template v-if="$slots.footer" #footer>
      <div class="flex w-full flex-col gap-2"><slot name="footer" /></div>
    </template>
  </UDrawer>
</template>
