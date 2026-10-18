<script setup lang="ts">
/**
 * Load error (design language 10): subtle error alert, warning icon, message and a tonal
 * "Cuba Semula" button. One component for the 11 module copies of `LoadError`/`ErrorBox`.
 * `inline` is the compact one-line form for use inside a panel.
 */
import { dsCopy } from './copy'

withDefaults(
  defineProps<{
    message?: string
    title?: string
    retryLabel?: string
    inline?: boolean
    testid?: string
  }>(),
  {
    message: dsCopy.loadError,
    title: undefined,
    retryLabel: dsCopy.retry,
    inline: false,
    testid: undefined,
  },
)

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div
    v-if="inline"
    class="flex flex-wrap items-center gap-3 text-body text-error"
    role="alert"
    data-ds="load-error"
    :data-testid="testid"
  >
    <UIcon name="i-ph-warning-circle" class="size-5 shrink-0" />
    <span class="min-w-0 grow">{{ message }}</span>
    <UButton
      type="button"
      color="neutral"
      variant="soft"
      :label="retryLabel"
      @click="emit('retry')"
    />
  </div>
  <UAlert
    v-else
    color="error"
    variant="subtle"
    icon="i-ph-warning-circle"
    :title="title ?? message"
    :description="title ? message : undefined"
    :actions="[
      { label: retryLabel, color: 'neutral', variant: 'soft', onClick: () => emit('retry') },
    ]"
    role="alert"
    data-ds="load-error"
    :data-testid="testid"
  />
</template>
