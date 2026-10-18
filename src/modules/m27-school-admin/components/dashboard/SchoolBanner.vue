<script setup lang="ts">
/**
 * S0 breadcrumb and school header (FR-M27-18…22; restyle spec AS-2). The breadcrumb sits between the
 * Perutusan card and the header: "← Papan Pemuka" (link to `/dashboard`), a separator and "Dashboard
 * Sekolah" (not a link). The header is a calm card (staff has no gradient hero): school icon, the school
 * name, the role line and up to three chips (state, PPD, "# Kod: …"); a null PPD or an empty code omits
 * its chip (FR-M27-21).
 */
import { usePrototypeScope } from '@/composables'
import { computed } from 'vue'

import { DsBreadcrumb, DsIconChip, DsPanel } from '@/ds'

import type { SchoolDashboard } from '../../api/dashboard'
import { PATHS } from './dashboard-format'

defineProps<{ school: SchoolDashboard['school']; roleLabel: string }>()
const { allows } = usePrototypeScope()

// Prototype scope (D43): the school admin has no 'Papan Pemuka' (`/dashboard`) in the matrix.
const crumbs = computed(() => [
  ...(allows(PATHS.home) ? [{ label: 'Papan Pemuka', to: PATHS.home }] : []),
  { label: 'Dashboard Sekolah' },
])
</script>

<template>
  <DsBreadcrumb v-if="crumbs.length > 1" :items="crumbs" data-testid="sd-breadcrumb" />

  <DsPanel data-testid="sd-banner">
    <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
      <DsIconChip icon="i-ph-buildings-duotone" size="lg" data-testid="sd-banner-icon" />
      <div class="flex min-w-0 flex-col gap-1">
        <h2 class="text-title break-words text-highlighted" data-testid="sd-banner-name">
          {{ school.name }}
        </h2>
        <p class="text-label text-muted" data-testid="sd-banner-role">{{ roleLabel }}</p>
        <ul class="mt-2 flex flex-wrap gap-2" data-testid="sd-chips">
          <li data-testid="sd-chip-state">
            <UBadge color="neutral" variant="soft" icon="i-ph-map-pin" :label="school.state" />
          </li>
          <li v-if="school.ppd" data-testid="sd-chip-ppd">
            <UBadge color="neutral" variant="soft" icon="i-ph-map-trifold" :label="school.ppd" />
          </li>
          <li v-if="school.code" data-testid="sd-chip-code">
            <UBadge color="neutral" variant="soft" :label="`# Kod: ${school.code}`" />
          </li>
        </ul>
      </div>
    </div>
  </DsPanel>
</template>
