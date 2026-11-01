<script setup lang="ts">
/**
 * V2 tick "Terbitkan walaupun tidak memenuhi kontrak blueprint" (design S4.2/S4.4). Offered when
 * `available` (the server's `canOverride`: no hard blocker, at least one overridable); the reason
 * (5+ characters) is audited server-side.
 */
import { computed, ref } from 'vue'

import { builderCopy as t } from '../domain/copy'

const props = withDefaults(defineProps<{ blockers: readonly string[]; available?: boolean; busy?: boolean }>(), {
  available: false,
  busy: false,
})
const emit = defineEmits<{ override: [reason: string] }>()

const offered = computed(() => props.blockers.length > 0 && props.available)
const ticked = ref(false)
const reason = ref('')
const ok = computed(() => ticked.value && reason.value.trim().length >= 5)
</script>

<template>
  <div v-if="offered" class="flex flex-col gap-2 rounded-lg bg-muted p-3" data-testid="publish-override">
    <UCheckbox v-model="ticked" :label="t.overrideTick" data-testid="override-tick" />
    <UFormField v-if="ticked" :label="t.overrideReason">
      <UInput v-model="reason" class="w-full" data-testid="override-reason" />
    </UFormField>
    <UButton
      v-if="ticked"
      icon="i-ph-upload-simple"
      :label="t.publish"
      class="min-h-11 self-start"
      :disabled="!ok"
      :loading="busy"
      data-testid="override-publish"
      @click="emit('override', reason.trim())"
    />
  </div>
</template>
