<script setup lang="ts">
/**
 * The room-code form: "🔑 Masuk Bilik" on S7 (required, "Kod Bilik (6 aksara)", "🚀 Masuk Bilik") and
 * "🔑 Masuk Dengan Kod" on S8–S12 (not required, "Contoh: ABC123", "Masuk"). The code is at most 6
 * characters, shown and sent upper case (SRS M16 v1.6 FR-M16-56, FR-M16-64). The parent posts #25.
 * Look (live screenshots): `pb` a green-tinted panel with a large centred code box over a green button;
 * `lobby` a white bordered card with the code box and the "Masuk" button on ONE row, in the game colour.
 */
import { computed, ref, useId } from 'vue'

const props = defineProps<{
  heading: string
  /** Visible label (S7 only). */
  label?: string
  placeholder: string
  required: boolean
  button: string
  busy?: boolean
  variant: 'pb' | 'lobby'
  /** Lobby only: the solid button classes of the game colour. */
  buttonClass?: string
}>()

const emit = defineEmits<{ submit: [code: string] }>()

const code = ref('')
const inputId = useId()
const pb = computed(() => props.variant === 'pb')

function onInput(e: Event): void {
  code.value = (e.target as HTMLInputElement).value.toUpperCase()
}

function onSubmit(): void {
  emit('submit', code.value.trim().toUpperCase())
}
</script>

<template>
  <section
    :class="
      pb
        ? 'rounded-3xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-green-100 p-5 shadow-sm sm:p-6'
        : 'rounded-2xl border border-slate-700 bg-white p-5 shadow-sm sm:p-6'
    "
    data-testid="join-card"
  >
    <h2 class="font-heading text-base font-bold text-slate-800 sm:text-lg">{{ heading }}</h2>
    <form
      :class="pb ? 'mt-4 space-y-4' : 'mt-4 flex items-center gap-2'"
      data-testid="join-form"
      @submit.prevent="onSubmit"
    >
      <div :class="pb ? '' : 'min-w-0 flex-1'">
        <label
          v-if="label"
          :for="inputId"
          class="mb-1 block text-xs font-bold tracking-wide text-emerald-700 uppercase"
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
          class="min-h-11 w-full rounded-xl px-3.5 py-2.5 text-center font-mono uppercase outline-none"
          :class="
            pb
              ? 'border-0 bg-white text-xl font-bold tracking-[0.4em] text-slate-600 shadow-sm focus:ring-2 focus:ring-emerald-300'
              : 'border border-slate-700 bg-white text-sm tracking-widest text-slate-700 focus:ring-2 focus:ring-blue-300'
          "
          data-testid="join-input"
          @input="onInput"
        />
      </div>
      <button
        type="submit"
        :disabled="busy"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        :class="
          pb
            ? 'w-full bg-linear-to-r from-emerald-600 to-green-600 tracking-wide uppercase'
            : (buttonClass ?? 'bg-violet-600')
        "
        data-testid="join-submit"
      >
        {{ button }}
      </button>
    </form>
    <slot />
  </section>
</template>
