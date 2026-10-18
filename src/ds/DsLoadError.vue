<script setup lang="ts">
/**
 * Load error (design language 10): subtle error alert, warning icon, message and a tonal
 * "Cuba Semula" button. One component for the 11 module copies of `LoadError`/`ErrorBox`.
 * `inline` is the compact one-line form for use inside a panel.
 */
import type { ButtonProps } from '@nuxt/ui'
import { computed } from 'vue'

import { dsCopy } from './copy'

const props = withDefaults(
  defineProps<{
    message?: string
    title?: string
    retryLabel?: string
    inline?: boolean
    testid?: string
    /** Test id of the retry button. */
    retryTestid?: string
  }>(),
  {
    message: dsCopy.loadError,
    title: undefined,
    retryLabel: dsCopy.retry,
    inline: false,
    testid: undefined,
    retryTestid: undefined,
  },
)

const emit = defineEmits<{ retry: [] }>()

/** The alert's action: the tonal retry button (test id passed through the button's attrs). */
const actions = computed<ButtonProps[]>(() => [
  {
    label: props.retryLabel,
    color: 'neutral',
    variant: 'soft',
    onClick: () => emit('retry'),
    ...(props.retryTestid ? { 'data-testid': props.retryTestid } : {}),
  },
])
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
      :data-testid="retryTestid"
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
    :actions="actions"
    role="alert"
    data-ds="load-error"
    :data-testid="testid"
  />
</template>
