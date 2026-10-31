<script setup lang="ts">
/**
 * V2 tick "Terbitkan walaupun tidak memenuhi kontrak blueprint" (design S4.2/S4.4). Offered only when
 * every blocker is a structural blueprint line ("Soalan {id} tidak layak: ..."), the only kind the
 * server lets through (R1-T34); the reason (5+ characters) is audited server-side.
 */
import { computed, ref } from 'vue'

import { builderCopy as t } from '../domain/copy'

const props = defineProps<{ blockers: readonly string[]; busy?: boolean }>()
const emit = defineEmits<{ override: [reason: string] }>()

/** Only structural blueprint lines are overridable. */
const offered = computed(() => props.blockers.length > 0 && props.blockers.every((b) => /tidak layak/i.test(b)))
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
