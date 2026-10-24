<script setup lang="ts">
/**
 * S1 card "Ibu Bapa Dihubungkan" (L45 FR-L45-14..16). One row per linked parent: icon tile (never an
 * image, D22), name and email, both truncated. No relationship chip (DV-L45-02) and no remove control
 * (BR-L45-09). Empty state with plain emoji text.
 */
import { DsIconChip } from '@/ds'

import type { LinkedParent } from '../../api/parent-invite'

defineProps<{ parents: readonly LinkedParent[] }>()
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
      </li>
    </ul>

    <div v-else class="py-6 text-center" data-testid="jemput-empty">
      <div class="text-display">👨‍👩‍👧</div>
      <p class="mt-3 text-label text-highlighted">Belum ada ibu bapa dihubungkan</p>
      <p class="mt-1 text-caption text-muted">Hantar pautan jemputan di atas</p>
    </div>
  </section>
</template>
