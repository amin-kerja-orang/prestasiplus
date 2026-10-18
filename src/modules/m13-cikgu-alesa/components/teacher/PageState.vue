<script setup lang="ts">
/** Loading, error (with retry) and loaded states shared by the M13 teacher lists and views. */
const props = defineProps<{
  loaded: boolean
  error: boolean
  message: string
  retryLabel: string
}>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="props.error" data-testid="page-error">
    <UAlert
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      :title="props.message"
      role="alert"
    >
      <template #actions>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          class="min-h-11"
          data-testid="page-retry"
          :label="props.retryLabel"
          @click="emit('retry')"
        />
      </template>
    </UAlert>
  </div>
  <div
    v-else-if="!props.loaded"
    class="flex flex-col gap-3"
    aria-busy="true"
    data-testid="page-loading"
  >
    <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
  </div>
  <slot v-else />
</template>
