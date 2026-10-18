<script setup lang="ts">
/**
 * S7 mood-day modal (FN-M17-5.4.11, FR-M17-59; SOURCE-DERIVED, never observed): "{date} — Mood: {label}" with
 * the tiles "Mood" and "Sebab", built from the page data (no request). The empty line "Tiada sesi latihan pada
 * hari ini. Pelajar hanya checkin mood." shows when the page data proves the day had no session (the week bar of
 * that day's week is 0).
 */
import { computed } from 'vue'

import { DsDialog, DsStatRow } from '@/ds'

import type { Mood } from '../../api/command-center-types'
import { MOOD, statItems } from './cc-format'
import { useCcDialog } from './use-cc-dialog'

const props = defineProps<{
  date: string
  mood: Mood
  reason: string | null
  /** True when the pupil has no practice session on this day. */
  noSession: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const open = useCcDialog(() => emit('close'))

const label = computed(() => MOOD[props.mood].label)
const stats = computed(() => [
  { label: 'Mood', value: label.value },
  { label: 'Sebab', value: props.reason && props.reason !== '' ? props.reason : '-' },
])
</script>

<template>
  <DsDialog v-model:open="open" :title="`${date} — Mood: ${label}`" class="sm:max-w-2xl">
    <div class="flex min-w-0 flex-col gap-4" data-testid="cc-mood-modal">
      <DsStatRow :items="statItems(stats)" data-testid="cc-modal-stats" />
      <p v-if="noSession" class="text-body text-muted" data-testid="cc-modal-empty">
        Tiada sesi latihan pada hari ini. Pelajar hanya checkin mood.
      </p>
    </div>
    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        label="Tutup"
        data-testid="cc-modal-close"
        @click="open = false"
      />
    </template>
  </DsDialog>
</template>
