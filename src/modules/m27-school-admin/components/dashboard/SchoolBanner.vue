<script setup lang="ts">
/**
 * S0 school header (FR-M27-18…22; restyle spec AS-2). No breadcrumb: this is the landing page of the
 * school admin (FR-AS-2-4). The header is a calm card (staff has no gradient hero): school icon, the school
 * name, the role line and up to three chips (state, PPD, "# Kod: …"); a null PPD or an empty code omits
 * its chip (FR-M27-21).
 */
import { DsIconChip, DsPanel } from '@/ds'

import type { SchoolDashboard } from '../../api/dashboard'

defineProps<{ school: SchoolDashboard['school']; roleLabel: string }>()
</script>

<template>
  <DsPanel data-testid="sd-banner">
    <div class="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center">
      <DsIconChip icon="buildings" size="lg" data-testid="sd-banner-icon" />
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
