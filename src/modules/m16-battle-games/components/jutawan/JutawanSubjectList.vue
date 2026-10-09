<script setup lang="ts">
/**
 * The subject links of S19 (URS FN-M16-7.2.2): emoji, name, "{count} soalan" and a chevron, one column
 * below `md`, two from `md`. Each links to `/permainan/jutawan/main?subject={id}&darjah={n}`.
 */
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'

import type { JutawanPage } from '../../api'
import { questionCountLabel } from '../solo/solo-lib'

defineProps<{ heading: string; subjects: NonNullable<JutawanPage['subjects']>; darjah: number }>()
</script>

<template>
  <section data-testid="jutawan-subjects">
    <h3 class="mb-3 text-sm font-extrabold tracking-wide text-slate-600">
      📚 PILIH SUBJEK ({{ heading }})
    </h3>
    <div class="grid gap-3 md:grid-cols-2">
      <RouterLink
        v-for="s in subjects"
        :key="s.id"
        :to="{
          path: '/permainan/jutawan/main',
          query: { subject: String(s.id), darjah: String(darjah) },
        }"
        class="flex min-h-14 items-center gap-3 rounded-2xl border-l-4 bg-white p-4 shadow-sm transition hover:shadow-md"
        :style="{ borderLeftColor: s.colour }"
        data-testid="jutawan-subject"
      >
        <span class="text-2xl">{{ s.emoji }}</span>
        <span class="min-w-0 flex-1">
          <span class="block font-bold break-words text-slate-800">{{ s.name }}</span>
          <span class="block text-xs text-slate-500">{{ questionCountLabel(s.count) }}</span>
        </span>
        <ChevronRight :size="18" class="shrink-0 text-slate-400" />
      </RouterLink>
    </div>
  </section>
</template>
