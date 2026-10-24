<script setup lang="ts">
/**
 * A select with an inline "add" button and panel (FN-M10-11.1.2 / 11.2.2): Bab, Topik, Bidang, SK and
 * SP of S22. The "+" button is disabled until `addDisabled` clears; it opens a panel whose fields keep
 * their typed values when "Batal" hides it. "Simpan" emits `add` with the field values; the owner does
 * nothing when a field is empty (live) and closes the panel through `close()` after a success.
 * Enter inside a panel field saves the panel (it must not submit the surrounding question form: UAT G-49).
 * The select stays a native `<select>` (native validation and keyboard, cascading option lists).
 */
import { DsPanel, DsNativeSelect } from '@/ds'
import { reactive, ref } from 'vue'

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
</script>

<template>
  <div class="min-w-0" :data-testid="testid">
    <label :for="id" class="mb-2 block text-label text-highlighted">{{ label }}</label>
    <div class="flex min-w-0 items-center gap-2">
      <DsNativeSelect :id="id" v-model="model" :disabled="disabled" :data-testid="`${testid}-select`">
        <option value="">{{ placeholder }}</option>
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </DsNativeSelect>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-plus"
        :disabled="addDisabled"
        :title="addTitle"
        :aria-label="addTitle"
        class="size-11 shrink-0 justify-center"
        :data-testid="`${testid}-add`"
        @click="open = !open"
      />
    </div>
    <DsPanel v-show="open" tone="inset" class="mt-2" :data-testid="`${testid}-panel`">
<div class="flex min-w-0 flex-col gap-2">
      <p class="text-label text-highlighted">{{ panelTitle }}</p>
      <div class="flex min-w-0 flex-wrap gap-2">
        <UInput
          v-for="f in panelFields"
          :key="f.key"
          v-model="values[f.key]"
          :type="f.type ?? 'text'"
          :min="f.min"
          :max="f.max"
          :placeholder="f.placeholder"
          :aria-label="f.placeholder"
          class="min-w-0 flex-1 basis-40"
          :data-testid="`${testid}-field-${f.key}`"
          @keydown.enter.prevent="save"
        />
      </div>
      <div class="flex gap-2">
        <UButton type="button" class="min-h-11" :data-testid="`${testid}-save`" @click="save"
          >Simpan</UButton
        >
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          :data-testid="`${testid}-cancel`"
          @click="open = false"
          >Batal</UButton
        >
      </div>
    </div>
</DsPanel>
  </div>
</template>
