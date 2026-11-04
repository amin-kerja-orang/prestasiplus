<script setup lang="ts">
/**
 * S6 "Cadangan" (FR-M08-44): the BR-M08-13 sentences in order, each with an icon chip (the icon per kind
 * is INFERRED). Recommendations are friend/info content, so the chip uses the info accent.
 */
import { usePrototypeScope } from '@/composables'
import { DsIconChip, DsPanel } from '@/ds'

import type { StudentPerformance } from '../../api/types'
import { usePhIcon, type PhIcon } from '../../lib/icons'

defineProps<{ items: StudentPerformance['suggestions'] }>()

const icon = usePhIcon()
// A teacher / admin reading a pupil's 360 may have no `/practice` in their scope: no link then (D6).
const { allows } = usePrototypeScope()

const ICON: Record<string, PhIcon> = {
  inactive: 'star',
  'no-sessions': 'star',
  start: 'star',
  subject: 'books',
  topic: 'target',
  headcount: 'target',
}
</script>

<template>
  <DsPanel data-testid="suggestions">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon :name="icon('lightbulb')" class="size-5 text-primary-t" />Cadangan
      </h2>
      <p v-if="items.length === 0" class="text-body text-muted" data-testid="suggestions-empty">
        Belum cukup data untuk cadangan.
        <UButton
          v-if="allows('/practice')"
          to="/practice"
          variant="link"
          color="primary"
          label="Mula latihan →"
          data-testid="suggestions-start"
        />
      </p>
      <ul v-else class="flex flex-col gap-2">
        <li
          v-for="(s, i) in items"
          :key="`${s.kind}-${String(i)}`"
          class="flex items-center gap-3 bg-soft p-3"
          data-testid="suggestion"
        >
          <DsIconChip :icon="icon(ICON[s.kind] ?? 'star')" accent="friend" />
          <p class="min-w-0 text-body break-words text-default">{{ s.text }}</p>
        </li>
      </ul>
    </div>
  </DsPanel>
</template>
