<script setup lang="ts">
/**
 * S0 "Perutusan Terkini" card (FR-M27-12…17): dark card, gold icon, heading, "Lihat semua →" to the M09
 * list, and up to 3 plain-text rows (initials avatar, title, "{role label} · {relative time}"). No rows: the
 * list is hidden and no sentence is shown (FR-M27-16).
 */
import { Megaphone } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { diffForHumans } from '@/lib/time'

import type { DashboardPerutusan } from '../../api/dashboard'
import { PATHS } from './dashboard-format'

defineProps<{ rows: readonly DashboardPerutusan[] }>()
</script>

<template>
  <section
    class="min-w-0 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white shadow sm:p-5"
    data-testid="sd-perutusan"
  >
    <div class="flex items-center justify-between gap-3">
      <h2 class="flex min-w-0 items-center gap-2 text-sm font-bold">
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400"
        >
          <Megaphone class="h-4 w-4" />
        </span>
        Perutusan Terkini
      </h2>
      <RouterLink
        :to="PATHS.perutusan"
        class="inline-flex min-h-11 shrink-0 items-center text-xs font-semibold text-blue-300 hover:text-blue-200"
        data-testid="sd-perutusan-all"
        >Lihat semua →</RouterLink
      >
    </div>
    <ul v-if="rows.length > 0" class="mt-1 space-y-3" data-testid="sd-perutusan-rows">
      <li
        v-for="row in rows"
        :key="row.id"
        class="flex min-w-0 items-center gap-3"
        data-testid="sd-perutusan-row"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-bold"
          data-testid="sd-perutusan-initials"
          >{{ row.author.initials }}</span
        >
        <div class="min-w-0">
          <p class="text-sm font-semibold break-words" data-testid="sd-perutusan-title">
            {{ row.title }}
          </p>
          <p class="text-xs text-slate-300" data-testid="sd-perutusan-meta">
            {{ row.author.roleLabel }} · {{ diffForHumans(row.createdAt) }}
          </p>
        </div>
      </li>
    </ul>
  </section>
</template>
