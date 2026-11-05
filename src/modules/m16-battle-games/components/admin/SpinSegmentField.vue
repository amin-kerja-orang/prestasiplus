<script setup lang="ts">
/**
 * One editable value of a Roda Nasib segment (48 GAME-14 "Segmen Roda Nasib"), used by both the table row and the phone
 * card of `TetapanPermainanPage`. The value is held as typed; the page sends it and the server answers per field.
 */
import { GAMES_ADMIN_COPY } from '@pp/contract'
import { computed } from 'vue'

import { DsStack, DsSwitchField, DsText } from '@/ds'

import type { SpinSegmentForm } from '../../api/game-types'

const props = defineProps<{
  segment: SpinSegmentForm
  field: 'label' | 'syiling' | 'weight' | 'active'
  error?: string
}>()

const emit = defineEmits<{ update: [field: 'label' | 'syiling' | 'weight', value: string]; toggle: [value: boolean] }>()

const COLUMNS = GAMES_ADMIN_COPY.segmentColumns
const name = computed(() => `${COLUMNS[props.field]} ${String(props.segment.position)}`)
const testid = computed(() => `gs-seg-${String(props.segment.position)}-${props.field}`)
const invalid = computed(() => (props.error ? 'true' : undefined))
</script>

<template>
  <DsStack gap="xs">
    <DsSwitchField
      v-if="field === 'active'"
      :model-value="segment.active"
      :label="name"
      :data-testid="testid"
      @update:model-value="emit('toggle', $event)"
    />
    <UInput
      v-else-if="field === 'label'"
      :model-value="segment.label"
      type="text"
      maxlength="20"
      :aria-label="name"
      :aria-invalid="invalid"
      :data-testid="testid"
      @update:model-value="emit('update', 'label', String($event))"
    />
    <UInput
      v-else
      :model-value="segment[field]"
      type="number"
      inputmode="numeric"
      step="any"
      :aria-label="name"
      :aria-invalid="invalid"
      :data-testid="testid"
      @update:model-value="emit('update', field as 'syiling' | 'weight', String($event))"
    />
    <DsText v-if="error" variant="caption" tone="error" role="alert" data-testid="field-error">{{
      error
    }}</DsText>
  </DsStack>
</template>
