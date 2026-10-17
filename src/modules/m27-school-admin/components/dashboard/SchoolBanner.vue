<script setup lang="ts">
/**
 * S0 breadcrumb and red school banner (FR-M27-18…22). The breadcrumb sits between the Perutusan card and the
 * banner: "← Papan Pemuka" (link to `/dashboard`), a separator and "Dashboard Sekolah" in bold (not a link).
 * The banner is plain text: building icon, the school name (capitals by CSS only), the role line below it and
 * up to three chips (state, PPD, "# Kod: …"); a null PPD or an empty code omits its chip (FR-M27-21).
 */
import { Building2, Map, MapPin } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { usePrototypeScope } from '@/composables'

import type { SchoolDashboard } from '../../api/dashboard'
import { PATHS } from './dashboard-format'

defineProps<{ school: SchoolDashboard['school']; roleLabel: string }>()
const { allows } = usePrototypeScope()
</script>

<template>
  <nav class="flex min-w-0 flex-wrap items-center gap-x-2 text-sm" data-testid="sd-breadcrumb">
    <!-- Prototype scope (D43): the school admin has no "Papan Pemuka" (`/dashboard`) in the matrix. -->
    <template v-if="allows(PATHS.home)">
      <RouterLink
        :to="PATHS.home"
        class="inline-flex min-h-11 items-center text-slate-500 hover:text-slate-700"
        data-testid="sd-crumb-back"
        >← Papan Pemuka</RouterLink
      >
      <span class="text-slate-300">/</span>
    </template>
    <span class="font-bold text-slate-700" data-testid="sd-crumb-current">Dashboard Sekolah</span>
  </nav>

  <section
    class="flex min-w-0 flex-col gap-4 rounded-2xl bg-gradient-to-r from-red-800 to-red-600 p-4 text-white shadow sm:flex-row sm:items-center sm:p-6"
    data-testid="sd-banner"
  >
    <span
      class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20 sm:h-16 sm:w-16"
    >
      <Building2 class="h-8 w-8" data-testid="sd-banner-icon" />
    </span>
    <div class="min-w-0">
      <h2
        class="text-lg leading-tight font-bold break-words uppercase sm:text-2xl"
        data-testid="sd-banner-name"
      >
        {{ school.name }}
      </h2>
      <p class="mt-1 text-xs font-semibold text-red-100" data-testid="sd-banner-role">
        {{ roleLabel }}
      </p>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-red-50" data-testid="sd-chips">
        <li class="flex items-center gap-1" data-testid="sd-chip-state">
          <MapPin class="h-3.5 w-3.5 shrink-0" data-testid="sd-chip-icon" />{{ school.state }}
        </li>
        <li v-if="school.ppd" class="flex items-center gap-1" data-testid="sd-chip-ppd">
          <Map class="h-3.5 w-3.5 shrink-0" data-testid="sd-chip-icon" />{{ school.ppd }}
        </li>
        <li v-if="school.code" class="flex items-center gap-1" data-testid="sd-chip-code">
          # Kod: {{ school.code }}
        </li>
      </ul>
    </div>
  </section>
</template>
