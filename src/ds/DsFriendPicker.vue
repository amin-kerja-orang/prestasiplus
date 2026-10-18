<script setup lang="ts">
/**
 * Friend picker sheet (design system 6, "Picker sheet"): a bottom drawer with one accessible
 * radio card per friend (URadioGroup, card variant), a "Pilih" confirm that stays disabled until
 * a card is chosen, and a "Batal" cancel. All copy is passed in by the caller.
 */
import { computed, ref, watch } from 'vue'

import type { FriendId } from './assets'
import { dsCopy } from './copy'
import DsFriendFace from './DsFriendFace.vue'

export interface FriendOption {
  value: FriendId
  name: string
  /** One trait line, e.g. "Tenang & suka cabaran". */
  trait: string
}

const props = withDefaults(
  defineProps<{
    friends: FriendOption[]
    title: string
    description?: string
    confirmLabel: string
    cancelLabel?: string
    /** Accessible name of the radio group. */
    groupLabel: string
    /** Screen-reader text for the selected tick. */
    selectedLabel?: string
    /** False keeps the page behind the sheet usable (no overlay, no scroll lock). */
    modal?: boolean
  }>(),
  { description: undefined, cancelLabel: undefined, selectedLabel: dsCopy.friendSelected, modal: true },
)

/** Open state of the sheet. */
const open = defineModel<boolean>('open', { default: false })
/** The confirmed friend (current one when the sheet opens). */
const selected = defineModel<FriendId | undefined>('selected', { default: undefined })

const emit = defineEmits<{ confirm: [friend: FriendId]; cancel: [] }>()

const draft = ref<FriendId | undefined>(selected.value)
watch(open, (isOpen) => {
  if (isOpen) draft.value = selected.value
})

const items = computed(() =>
  props.friends.map((f) => ({ value: f.value, label: f.name, description: f.trait, friend: f })),
)

function confirm(): void {
  if (!draft.value) return
  selected.value = draft.value
  emit('confirm', draft.value)
  open.value = false
}
function cancel(): void {
  emit('cancel')
  open.value = false
}
</script>

<template>
  <UDrawer
    v-model:open="open"
    :modal="modal"
    :title="title"
    :description="description"
    :ui="{ content: 'rounded-t-sheet', title: 'font-display text-subheading', body: 'pb-6' }"
    data-ds="friend-picker"
  >
    <template #body>
      <URadioGroup
        v-model="draft"
        :items="items"
        :legend="groupLabel"
        variant="card"
        color="info"
        indicator="hidden"
        orientation="horizontal"
        :ui="{
          fieldset: 'grid grid-cols-2 gap-3',
          item: 'min-h-14 items-center justify-center rounded-card bg-default p-3',
          wrapper: 'w-full text-center',
          label: 'flex flex-col items-center gap-2',
          description: 'text-center text-caption text-muted',
          legend: 'sr-only',
        }"
      >
        <template #label="{ item }">
          <span class="relative inline-flex">
            <DsFriendFace :friend="item.friend.value" size="lg" :animated="false" />
            <span
              v-if="draft === item.friend.value"
              class="absolute -top-1 -right-1 inline-grid size-6 place-items-center rounded-full bg-friend text-primary-on"
              data-ds="picker-tick"
            >
              <UIcon name="i-ph-check-bold" class="size-4" aria-hidden="true" />
              <span v-if="selectedLabel" class="sr-only">{{ selectedLabel }}</span>
            </span>
          </span>
          <span class="font-display text-subheading font-extrabold text-highlighted">{{
            item.friend.name
          }}</span>
        </template>
      </URadioGroup>
    </template>
    <template #footer>
      <div class="flex w-full flex-col gap-2">
        <UButton
          color="primary"
          variant="solid"
          size="lg"
          block
          :disabled="!draft"
          data-ds="picker-confirm"
          @click="confirm"
          >{{ confirmLabel }}</UButton
        >
        <UButton
          v-if="cancelLabel"
          color="neutral"
          variant="soft"
          size="lg"
          block
          data-ds="picker-cancel"
          @click="cancel"
          >{{ cancelLabel }}</UButton
        >
      </div>
    </template>
  </UDrawer>
</template>
