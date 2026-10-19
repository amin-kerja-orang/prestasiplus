<script setup lang="ts">
/**
 * S0 "Perutusan Terkini" card (FR-M27-12…17; restyle spec AS-2): a calm info card with the megaphone icon,
 * the heading, "Lihat semua →" to the M09 list, and up to 3 plain-text rows (initials chip, title,
 * "{role label} · {relative time}"). No rows: the list is hidden and no sentence is shown (FR-M27-16).
 */

import { DsPanel, DsCluster, DsText } from '@/ds'
import { usePrototypeScope } from '@/composables'
import { diffForHumans } from '@/lib/time'

import type { DashboardPerutusan } from '../../api/dashboard'
import { PATHS } from './dashboard-format'

defineProps<{ rows: readonly DashboardPerutusan[] }>()

// Prototype scope (D43): "Perutusan" is not in the role-access matrix, so its link is hidden.
const { allows } = usePrototypeScope()
</script>

<template>
  <DsPanel data-testid="sd-perutusan">
    <DsCluster justify="between" :wrap="false">
      <h2 class="flex min-w-0 items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-megaphone-duotone" class="size-5 shrink-0 text-info" aria-hidden="true" />
        Perutusan Terkini
      </h2>
      <UButton
        v-if="allows(PATHS.perutusan)"
        :to="PATHS.perutusan"
        color="primary"
        variant="link"
        label="Lihat semua →"
        data-testid="sd-perutusan-all"
      />
    </DsCluster>
    <ul v-if="rows.length > 0" class="mt-2 flex flex-col gap-3" data-testid="sd-perutusan-rows">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex min-w-0 items-center gap-3"
        data-testid="sd-perutusan-row"
      >
        <UAvatar
          :text="row.author.initials"
          :alt="row.author.initials"
          size="md"
          data-testid="sd-perutusan-initials"
        />
        <div class="min-w-0">
          <DsText
            variant="label"
            as="p"
            tone="highlighted"
            wrap="anywhere"
            data-testid="sd-perutusan-title"
          >
            {{ row.title }}
          </DsText>
          <DsText variant="caption" data-testid="sd-perutusan-meta">
            {{ row.author.roleLabel }} · {{ diffForHumans(row.createdAt) }}
          </DsText>
        </div>
      </li>
    </ul>
  </DsPanel>
</template>
