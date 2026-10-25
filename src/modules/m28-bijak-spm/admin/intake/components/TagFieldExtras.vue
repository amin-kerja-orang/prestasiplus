<script setup lang="ts">
/**
 * What sits under a Tag DSKP control for its AI state (UX spec 3.6): the "AI found no match" caption,
 * the "changed from the AI suggestion" caption, and the "Saya sahkan ..." box (only while the value is
 * still the suggestion). The box keeps the `confirm-tag.{field}` test id and the 44 px row.
 */
import type { TagField } from '../domain/suggestion'
import { TAG_COPY, confirmText } from '../domain/tag-view'
import type { AiFieldState } from '../domain/tag-view'
import TagNote from './TagNote.vue'

defineProps<{
  field: TagField
  state: AiFieldState
  /** Label of the AI value a person changed away from. */
  changedLabel?: string
  disabled?: boolean
}>()
const emit = defineEmits<{ confirm: [on: boolean] }>()
</script>

<template>
  <TagNote v-if="state.noMatch" tone="warning" icon="i-ph-warning" data-testid="ai-no-match">
    {{ TAG_COPY.aiNoMatch(field === 'unit' ? 'unit' : 'SP') }}
  </TagNote>
  <TagNote v-else-if="changedLabel !== undefined" tone="muted" data-testid="ai-changed">
    {{ TAG_COPY.aiChanged(changedLabel) }}
  </TagNote>
  <UCheckbox
    v-if="state.confirm"
    :model-value="state.confirmed"
    :disabled="disabled"
    :data-testid="`confirm-tag.${field}`"
    @update:model-value="(v: boolean | 'indeterminate') => emit('confirm', v === true)"
  >
    <template #label>
      <span class="block min-h-11 cursor-pointer">{{ confirmText(field) }}</span>
    </template>
  </UCheckbox>
</template>
