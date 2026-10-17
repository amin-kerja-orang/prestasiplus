<script setup lang="ts">
/**
 * S33 card "Masukkan Kod Kelas" (FN-M10-3.4.1): text `class_code` (`required`, `maxlength=6`), primary
 * "Sertai". `initialCode` pre-fills the field from `?kod=` (PROPOSED, OQ-M10-04); it is set from
 * script, so a stored code longer than 6 characters (e.g. "DEMO-4S") still fits. "Sertai" calls
 * #74; the response message of a refusal (404 / 409) is shown and the page stays (FR-M10-39).
 */
import { ref, watch } from 'vue'

import { joinClass } from '../../api/guru'
import { KELAS_COPY } from './copy'
import { joinErrorMessage } from './join-message'

const props = withDefaults(defineProps<{ initialCode?: string }>(), { initialCode: '' })
const emit = defineEmits<{ joined: [] }>()

const code = ref(props.initialCode)
watch(
  () => props.initialCode,
  (next) => {
    code.value = next
  },
)

const submitting = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  error.value = null
  success.value = null
  try {
    const res = await joinClass(code.value.trim())
    success.value = res.message
    code.value = ''
    emit('joined')
  } catch (err) {
    error.value = joinErrorMessage(err)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UCard data-testid="join-card">
    <form class="flex min-w-0 flex-col gap-3" data-testid="join-form" @submit.prevent="submit">
      <label for="class_code" class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-key-duotone" class="size-5" aria-hidden="true" />
        {{ KELAS_COPY.label }}
      </label>
      <div class="flex min-w-0 items-stretch gap-3">
        <UInput
          id="class_code"
          v-model="code"
          type="text"
          name="class_code"
          required
          maxlength="6"
          autocomplete="off"
          size="xl"
          :placeholder="KELAS_COPY.placeholder"
          class="min-w-0 flex-1"
          :ui="{ base: 'font-mono tracking-wider uppercase' }"
          data-testid="class-code"
        />
        <UButton
          type="submit"
          size="xl"
          icon="i-ph-sign-in-duotone"
          class="shrink-0 justify-center"
          :loading="submitting"
          :disabled="submitting"
          data-testid="join-submit"
          >{{ KELAS_COPY.submit }}</UButton
        >
      </div>
    </form>
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="error"
      class="mt-3"
      data-testid="join-error"
    />
    <UAlert
      v-else-if="success"
      color="success"
      variant="soft"
      icon="i-ph-check-circle-duotone"
      :title="success"
      class="mt-3"
      data-testid="join-success"
    />
  </UCard>
</template>
