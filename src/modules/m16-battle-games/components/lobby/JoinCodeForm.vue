<script setup lang="ts">
/**
 * The room-code form: "🔑 Masuk Bilik" on S7 (required, "Kod Bilik (6 aksara)", "🚀 Masuk Bilik") and
 * "🔑 Masuk Dengan Kod" on S8–S12 (not required, "Contoh: ABC123", "Masuk"). The code is at most 6
 * characters, shown and sent upper case (SRS M16 v1.6 FR-M16-56, FR-M16-64). The parent posts #25.
 * v2 look: a card with a large centred code field; S7 stacks the button, S8–S12 keep field and button on
 * one row in the game colour.
 */
import { ref } from 'vue'

import { ROOM_CODE_INVALID, ROOM_CODE_PATTERN, type RoomColor } from './lobby-config'

defineProps<{
  heading: string
  /** Visible label (S7 only). */
  label?: string
  placeholder: string
  required: boolean
  button: string
  busy?: boolean
  variant: 'pb' | 'lobby'
  /** Lobby only: the semantic colour of the game. */
  color?: RoomColor
}>()

const emit = defineEmits<{ submit: [code: string] }>()

const code = ref('')
/** ERR-GAME-06 (inline): shown when the code is not 6 characters A-Z0-9; no request is sent. */
const invalid = ref(false)

function onInput(e: Event): void {
  code.value = (e.target as HTMLInputElement).value.toUpperCase()
  invalid.value = false
}

function onSubmit(): void {
  const value = code.value.trim().toUpperCase()
  if (!ROOM_CODE_PATTERN.test(value)) {
    invalid.value = true
    return
  }
  invalid.value = false
  emit('submit', value)
}
</script>

<template>
  <UCard data-testid="join-card">
    <h2 class="text-subheading text-highlighted">{{ heading }}</h2>
    <form
      class="mt-4 flex gap-3"
      :class="variant === 'pb' ? 'flex-col' : 'items-end'"
      data-testid="join-form"
      @submit.prevent="onSubmit"
    >
      <UFormField :label="label" :error="invalid ? ROOM_CODE_INVALID : undefined" class="min-w-0 flex-1">
        <UInput
          :model-value="code"
          type="text"
          name="room_code"
          maxlength="6"
          autocomplete="off"
          :required="required"
          :aria-invalid="invalid"
          :placeholder="placeholder"
          size="xl"
          class="w-full"
          :ui="{ base: 'text-center font-display uppercase tracking-widest' }"
          data-testid="join-input"
          @input="onInput"
        />
      </UFormField>
      <UButton
        type="submit"
        :loading="busy"
        :disabled="busy"
        size="xl"
        :color="color ?? 'primary'"
        class="min-h-12 justify-center"
        :class="variant === 'pb' ? 'w-full' : ''"
        data-testid="join-submit"
      >
        {{ button }}
      </UButton>
    </form>
    <slot />
  </UCard>
</template>
