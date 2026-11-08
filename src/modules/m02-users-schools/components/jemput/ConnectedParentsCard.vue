<script setup lang="ts">
/**
 * S1 card "Ibu Bapa Dihubungkan" (L45 FR-L45-14..16). One row per linked parent: icon tile (never an
 * image, D22), name and email, both truncated, and "Buang" (R1-MUR-40, dialog "Buang ibu bapa ini?"). No
 * relationship chip (DV-L45-02). Empty state with plain emoji text.
 */
import { computed, ref } from 'vue'

import { DsDialog, DsIconChip, DsText } from '@/ds'

import type { LinkedParent } from '../../api/parent-invite'

defineProps<{ parents: readonly LinkedParent[]; removing?: boolean }>()
const emit = defineEmits<{ remove: [parent: LinkedParent] }>()

/** R1-MUR-40: "Buang ibu bapa" asks first (dialog "Buang ibu bapa ini?"). */
const target = ref<LinkedParent | null>(null)
const dialogOpen = computed({
  get: () => target.value !== null,
  set: (open: boolean) => {
    if (!open) target.value = null
  },
})

function confirm(): void {
  const parent = target.value
  target.value = null
  if (parent) emit('remove', parent)
}
</script>

<template>
  <section class="rounded-card bg-default p-5 shadow-lift sm:p-6" data-testid="jemput-parents-card">
    <h2 class="flex items-center gap-2 text-heading text-highlighted">
      <UIcon name="i-ph-users-three-duotone" class="size-5 text-friend" aria-hidden="true" />
      Ibu Bapa Dihubungkan
    </h2>

    <ul v-if="parents.length > 0" class="mt-4 flex flex-col gap-2" data-testid="jemput-parents">
      <li
        v-for="parent in parents"
        :key="parent.id"
        class="flex min-w-0 items-center gap-3 rounded-chip bg-elevated p-3"
        data-testid="jemput-parent"
      >
        <DsIconChip icon="i-ph-user-duotone" accent="friend" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-label text-highlighted" data-testid="jemput-parent-name">
            {{ parent.name }}
          </p>
          <p class="truncate text-caption text-muted" data-testid="jemput-parent-email">
            {{ parent.email }}
          </p>
        </div>
        <UButton
          v-if="parent.linkId !== undefined"
          type="button"
          color="error"
          variant="ghost"
          label="Buang"
          :disabled="removing"
          data-testid="jemput-parent-remove"
          @click="target = parent"
        />
      </li>
    </ul>

    <div v-else class="py-6 text-center" data-testid="jemput-empty">
      <div class="text-display">👨‍👩‍👧</div>
      <p class="mt-3 text-label text-highlighted">Belum ada ibu bapa dihubungkan</p>
      <p class="mt-1 text-caption text-muted">Hantar link jemputan di atas</p>
    </div>

    <DsDialog v-model:open="dialogOpen" title="Buang ibu bapa ini?" data-testid="jemput-remove-modal">
      <DsText v-if="target" variant="body">
        {{ target.name }} tidak lagi dapat memantau kemajuan anda.
      </DsText>
      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          label="Batal"
          data-testid="jemput-remove-cancel"
          @click="target = null"
        />
        <UButton
          type="button"
          color="error"
          label="Buang"
          data-testid="jemput-remove-confirm"
          @click="confirm"
        />
      </template>
    </DsDialog>
  </section>
</template>
