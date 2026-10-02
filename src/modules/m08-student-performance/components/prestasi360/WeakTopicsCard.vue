<script setup lang="ts">
/**
 * S6 "Topik Perlu Perhatian" (FR-M08-43): red rows with the accuracy tile, the SP label cut at ~70
 * characters, "{CODE} · {n} percubaan", the badge "Fokus {k}" and the "Fokus" button (text from 640px) →
 * `/practice/{CODE}/quiz?level=…&dskp_sp_id=…&count={k}` (`level` omitted when unknown). Empty: green
 * check "Tiada topik lemah! Teruskan usaha.".
 */
import { CircleCheck, TriangleAlert, Zap } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { WeakTopic } from '../../api/types'
import { cut, focusHref } from '../../lib/analitik'

defineProps<{ topics: WeakTopic[] }>()

const href = (t: WeakTopic): string =>
  focusHref({
    subjectCode: t.subjectCode,
    spId: t.spId,
    count: t.focusCount,
    levelId: t.levelId,
  })
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="weak-block">
    <h2 class="mb-4 flex items-center gap-2 text-base font-bold text-slate-800">
      <TriangleAlert class="h-5 w-5 text-red-500" />Topik Perlu Perhatian
    </h2>
    <div
      v-if="topics.length === 0"
      class="flex flex-col items-center gap-2 py-8 text-sm text-slate-500"
      data-testid="weak-empty"
    >
      <CircleCheck class="h-8 w-8 text-green-500" />
      <p>Tiada topik lemah! Teruskan usaha.</p>
    </div>
    <template v-else>
      <ul class="space-y-2" data-testid="weak-list">
        <li
          v-for="t in topics"
          :key="t.spId"
          class="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3"
          :data-testid="`weak-${t.spId}`"
        >
          <span
            class="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-lg bg-red-100 px-1 text-xs font-bold text-red-600"
            >{{ t.accuracy }}%</span
          >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold break-words text-slate-800">
              {{ t.code === null ? t.label : cut(t.label, 70) }}
            </p>
            <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
              <span>{{ t.subjectCode }} · {{ t.attempts }} percubaan</span>
              <span
                class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
                ><Zap class="h-3 w-3" />Fokus {{ t.focusCount }}</span
              >
            </p>
          </div>
          <RouterLink
            :to="href(t)"
            :title="`Klik untuk ${String(t.focusCount)} soalan fokus`"
            class="flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-lg border border-red-200 bg-white px-2.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
            data-testid="focus-link"
          >
            <Zap class="h-4 w-4" /><span class="hidden sm:inline">Fokus</span>
          </RouterLink>
        </li>
      </ul>
      <p class="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span
          class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700"
          ><Zap class="h-3 w-3" />Fokus</span
        >
        Klik untuk buka set latihan tertumpu pada topik lemah itu sahaja.
      </p>
    </template>
  </section>
</template>
