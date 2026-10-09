<script setup lang="ts">
/**
 * The subject links of S19 (URS FN-M16-7.2.2; live jutawan-subjects): glass cards with a tinted emoji
 * square, the subject name, a "{count} soalan" pill and an amber chevron, one column below `md`, two from
 * `md`. Each links to `/permainan/jutawan/main?subject={id}&darjah={n}`.
 */
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'

import type { JutawanPage } from '../../api'
import { questionCountLabel } from '../solo/solo-lib'

defineProps<{ heading: string; subjects: NonNullable<JutawanPage['subjects']>; darjah: number }>()
</script>

<template>
  <section data-testid="jutawan-subjects">
    <h3 class="mb-3 text-xs font-bold tracking-widest text-slate-300 uppercase">
      📚 PILIH SUBJEK ({{ heading }})
    </h3>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <RouterLink
        v-for="s in subjects"
        :key="s.id"
        :to="{
          path: '/permainan/jutawan/main',
          query: { subject: String(s.id), darjah: String(darjah) },
        }"
        class="flex min-h-20 min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition hover:border-amber-400/50 hover:bg-white/10"
        data-testid="jutawan-subject"
      >
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
          :style="{ backgroundColor: `color-mix(in srgb, ${s.colour} 25%, transparent)` }"
          >{{ s.emoji }}</span
        >
        <span class="min-w-0 flex-1">
          <span class="block truncate font-bold text-white">{{ s.name }}</span>
          <span
            class="mt-1 inline-block rounded-md bg-white/10 px-2 py-0.5 text-xs text-slate-300"
            >{{ questionCountLabel(s.count) }}</span
          >
        </span>
        <ChevronRight :size="18" class="shrink-0 text-amber-400" />
      </RouterLink>
    </div>
  </section>
</template>
