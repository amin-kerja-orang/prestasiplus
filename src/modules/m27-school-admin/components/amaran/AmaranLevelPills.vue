<script setup lang="ts">
/**
 * S4 level pills (FR-M27-75): "Semua Tingkatan" (`/amaran/sekolah`), "Tingkatan 4" (`?tingkatan=T4`),
 * "Tingkatan 5" (`T5`). The alias keeps the school admin on `/amaran/sekolah`. Pills wrap; 44 px high.
 */
import { RouterLink } from 'vue-router'

import type { LevelFilter } from '../../api/amaran'
import { AMARAN_PATH, LEVEL_PILLS } from './amaran-format'

defineProps<{ active: LevelFilter | null }>()
</script>

<template>
  <nav class="flex min-w-0 flex-wrap gap-2" data-testid="am-pills">
    <RouterLink
      v-for="p in LEVEL_PILLS"
      :key="p.label"
      :to="p.level ? { path: AMARAN_PATH, query: { tingkatan: p.level } } : { path: AMARAN_PATH }"
      :class="[
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
        p.level === active
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ]"
      :data-testid="`am-pill-${p.level ?? 'all'}`"
      :data-active="p.level === active ? 'true' : 'false'"
      >{{ p.label }}</RouterLink
    >
  </nav>
</template>
