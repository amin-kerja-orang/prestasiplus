<script setup lang="ts">
/**
 * The room-code form: "🔑 Masuk Bilik" on S7 (required, "Kod Bilik (6 aksara)", "🚀 Masuk Bilik") and
 * "🔑 Masuk Dengan Kod" on S8–S12 (not required, "Contoh: ABC123", "Masuk"). The code is at most 6
 * characters, shown and sent upper case (SRS M16 v1.6 FR-M16-56, FR-M16-64). The parent posts #25.
 */
import { ref, useId } from 'vue'

import { FORM_INPUT_CLASS } from '@/components/form/classes'

defineProps<{
  heading: string
  /** Visible label (S7 only). */
  label?: string
  placeholder: string
  required: boolean
  button: string
  busy?: boolean
}>()

const emit = defineEmits<{ submit: [code: string] }>()

const code = ref('')
const inputId = useId()

function onInput(e: Event): void {
  code.value = (e.target as HTMLInputElement).value.toUpperCase()
}

function onSubmit(): void {
  emit('submit', code.value.trim().toUpperCase())
}
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="join-card">
    <h2 class="font-heading text-lg font-bold text-slate-800">{{ heading }}</h2>
    <form class="mt-4 space-y-4" data-testid="join-form" @submit.prevent="onSubmit">
      <div>
        <label
          v-if="label"
          :for="inputId"
          class="mb-1 block text-sm font-semibold text-slate-600"
          >{{ label }}</label
        >
        <input
          :id="inputId"
          :value="code"
          type="text"
          name="room_code"
          maxlength="6"
          autocomplete="off"
          :required="required"
          :placeholder="placeholder"
          :class="[FORM_INPUT_CLASS, 'min-h-11 uppercase']"
          data-testid="join-input"
          @input="onInput"
        />
      </div>
      <button
        type="submit"
        :disabled="busy"
        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition bg-primary-gradient hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        data-testid="join-submit"
      >
        {{ button }}
      </button>
    </form>
  </section>
</template>
