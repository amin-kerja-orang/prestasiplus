<script setup lang="ts">
/**
 * The locked school label of S11 and S12 (FR-M27-108, 117): the school name and the meta line
 * "{code} · {district} · {state}" without empty parts. No search, no input: the school is the session school.
 */
import { Building2, Lock } from '@lucide/vue'

import type { SchoolInfo } from '../../api/school-admin'
import { LABEL, schoolMeta } from './users-format'

defineProps<{ school: Pick<SchoolInfo, 'name' | 'code' | 'district' | 'state'> }>()
</script>

<template>
  <div data-testid="user-school">
    <span :class="LABEL">
      <Building2 class="h-4 w-4 text-indigo-500" aria-hidden="true" />
      Sekolah
    </span>
    <div
      class="flex min-h-11 items-center gap-3 rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2"
    >
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold break-words text-slate-800" data-testid="user-school-name">
          {{ school.name }}
        </p>
        <p class="text-xs break-words text-slate-500" data-testid="user-school-meta">
          {{ schoolMeta(school) }}
        </p>
      </div>
      <Lock class="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
    </div>
  </div>
</template>
