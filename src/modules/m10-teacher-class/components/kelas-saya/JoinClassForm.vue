<script setup lang="ts">
/**
 * S33 card "Masukkan Kod Kelas" (FN-M10-3.4.1): text `class_code` (`required`, `maxlength=6`), indigo
 * "Sertai". `initialCode` pre-fills the field from `?kod=` (PROPOSED, OQ-M10-04); it is set from
 * script, so a stored code longer than 6 characters (e.g. "DEMO-4S") still fits. "Sertai" calls
 * #74; the response message of a refusal (404 / 409) is shown and the page stays (FR-M10-39).
 */
import { KeyRound, LogIn } from '@lucide/vue'
import { ref, watch } from 'vue'

import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form/classes'

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
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="join-card">
    <form class="min-w-0" data-testid="join-form" @submit.prevent="submit">
      <label
        for="class_code"
        class="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800"
      >
        <KeyRound class="h-4 w-4 text-slate-700" />
        {{ KELAS_COPY.label }}
      </label>
      <div class="flex min-w-0 items-stretch gap-3">
        <input
          id="class_code"
          v-model="code"
          type="text"
          name="class_code"
          required
          maxlength="6"
          autocomplete="off"
          :placeholder="KELAS_COPY.placeholder"
          :class="[FORM_INPUT_CLASS, 'min-h-11 min-w-0 flex-1 font-mono tracking-wider uppercase']"
          data-testid="class-code"
        />
        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-bold text-white transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 sm:px-6"
          data-testid="join-submit"
        >
          <LogIn class="h-4 w-4" />
          {{ KELAS_COPY.submit }}
        </button>
      </div>
    </form>
    <div v-if="error" class="mt-3" data-testid="join-error">
      <AlertBox :messages="error" />
    </div>
    <div v-else-if="success" class="mt-3" data-testid="join-success">
      <AlertBox variant="success" :messages="success" />
    </div>
  </section>
</template>
