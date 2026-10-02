<script setup lang="ts">
/**
 * A select with an inline "add" button and panel (FN-M10-11.1.2 / 11.2.2): Bab, Topik, Bidang, SK and
 * SP of S22. The "+" button is disabled until `addDisabled` clears; it opens a panel whose fields keep
 * their typed values when "Batal" hides it. "Simpan" emits `add` with the field values; the owner does
 * nothing when a field is empty (live) and closes the panel through `close()` after a success.
 */
import { Plus } from '@lucide/vue'
import { reactive, ref } from 'vue'

import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form'

import type { PanelField, SelectOption } from './lib'

const props = defineProps<{
  id: string
  label: string
  placeholder: string
  options: readonly SelectOption[]
  disabled?: boolean
  addDisabled?: boolean
  addTitle: string
  panelTitle: string
  panelFields: readonly PanelField[]
  testid: string
}>()

const model = defineModel<string>({ required: true })
const emit = defineEmits<{ add: [values: Record<string, string>] }>()

const open = ref(false)
const values = reactive<Record<string, string>>(
  Object.fromEntries(props.panelFields.map((f) => [f.key, ''])),
)

function save(): void {
  emit('add', { ...values })
}

/** Called by the owner after a successful add: empties and hides the panel. */
function done(): void {
  for (const f of props.panelFields) values[f.key] = ''
  open.value = false
}
defineExpose({ done })

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
</script>

<template>
  <div class="min-w-0" :data-testid="testid">
    <label :for="id" :class="LABEL">{{ label }}</label>
    <div class="flex min-w-0 items-center gap-2">
      <select
        :id="id"
        v-model="model"
        :disabled="disabled"
        :class="[
          FORM_SELECT_CLASS,
          'min-h-11 min-w-0 flex-1 bg-white disabled:bg-slate-50 disabled:text-slate-400',
        ]"
        :data-testid="`${testid}-select`"
      >
        <option value="">{{ placeholder }}</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <button
        type="button"
        :disabled="addDisabled"
        :title="addTitle"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 transition hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
        :data-testid="`${testid}-add`"
        @click="open = !open"
      >
        <Plus class="h-4 w-4" />
      </button>
    </div>
    <div
      v-show="open"
      class="mt-2 min-w-0 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3"
      :data-testid="`${testid}-panel`"
    >
      <p class="text-sm font-semibold text-slate-700">{{ panelTitle }}</p>
      <div class="flex min-w-0 flex-wrap gap-2">
        <input
          v-for="f in panelFields"
          :key="f.key"
          v-model="values[f.key]"
          :type="f.type ?? 'text'"
          :min="f.min"
          :max="f.max"
          :placeholder="f.placeholder"
          :class="[
            FORM_INPUT_CLASS,
            'min-h-11',
            f.narrow ? 'w-32 shrink-0' : 'min-w-0 flex-1 basis-40',
          ]"
          :data-testid="`${testid}-field-${f.key}`"
        />
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex min-h-11 items-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          :data-testid="`${testid}-save`"
          @click="save"
        >
          Simpan
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          :data-testid="`${testid}-cancel`"
          @click="open = false"
        >
          Batal
        </button>
      </div>
    </div>
  </div>
</template>
