<script setup lang="ts">
/**
 * Load error (design language 10): subtle error alert, warning icon, message and a tonal
 * "Cuba Semula" button. One component for the 11 module copies of `LoadError`/`ErrorBox`.
 * `inline` is the compact one-line form for use inside a panel.
 */
import { computed } from 'vue'

import { dsCopy } from './copy'

const props = withDefaults(
  defineProps<{
    message?: string
    title?: string
    retryLabel?: string
    /** `alert` = full alert; `inline` = one line inside a panel. */
    variant?: 'alert' | 'inline'
    /** @deprecated use `variant="inline"`. */
    inline?: boolean
    /** The retry is running. */
    loading?: boolean
    testid?: string
    /** `data-testid` of the retry button. */
    retryTestid?: string
  }>(),
  {
    message: dsCopy.loadError,
    title: undefined,
    retryLabel: dsCopy.retry,
    variant: undefined,
    inline: false,
    loading: false,
    testid: undefined,
    retryTestid: undefined,
  },
)

const isInline = computed(() => (props.variant ?? (props.inline ? 'inline' : 'alert')) === 'inline')

const emit = defineEmits<{ retry: [] }>()

/** The retry button of the alert form (`UAlert` takes button props; the test id rides along as an attribute). */
const actions = computed(() => [
  {
    label: props.retryLabel,
    color: 'neutral' as const,
    variant: 'soft' as const,
    loading: props.loading,
    onClick: () => emit('retry'),
    ...(props.retryTestid ? { 'data-testid': props.retryTestid } : {}),
  },
])
</script>

<template>
  <div
    v-if="isInline"
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
      :loading="loading"
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
