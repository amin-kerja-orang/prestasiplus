<script setup lang="ts">
/**
 * S1 card "Mengikut Mod Latihan" (FR-M27-54): table "Mod", "Sesi", "Ketepatan Purata", one row per session
 * label with sessions in the window (server order). It scrolls inside its card. With no completed session
 * the empty card replaces it (FR-M27-55): "Tiada data untuk tempoh ini" and the period sentence; for `today`
 * the sentence links "7 Hari" and "30 Hari" to `?period=7days` and `?period=30days`.
 */
import { RouterLink } from 'vue-router'

import type { SchoolUsage } from '../../api/school-admin'
import { accuracy, count, USAGE_PATH } from './usage-format'

defineProps<{ modes: SchoolUsage['modes']; period: SchoolUsage['period']; label: string }>()
</script>

<template>
  <section
    v-if="modes.length > 0"
    class="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm"
    data-testid="su-modes"
  >
    <h2 class="px-4 pt-4 text-base font-bold text-slate-800 sm:px-5" data-testid="su-modes-title">
      Mengikut Mod Latihan
    </h2>
    <div class="mt-3 overflow-x-auto px-4 pb-4 sm:px-5" data-testid="su-modes-scroll">
      <table class="w-full min-w-[20rem] text-left text-sm" data-testid="su-modes-table">
        <thead>
          <tr class="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
            <th scope="col" class="py-2 pr-3">Mod</th>
            <th scope="col" class="px-3 py-2 text-right">Sesi</th>
            <th scope="col" class="py-2 pl-3 text-right">Ketepatan Purata</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="m in modes"
            :key="m.label"
            class="border-b border-slate-100 last:border-0"
            data-testid="su-mode-row"
          >
            <td class="py-2.5 pr-3 font-semibold text-slate-700" data-testid="su-mode-label">
              {{ m.label }}
            </td>
            <td class="px-3 py-2.5 text-right tabular-nums" data-testid="su-mode-sessions">
              {{ count(m.sessions) }}
            </td>
            <td class="py-2.5 pl-3 text-right tabular-nums" data-testid="su-mode-accuracy">
              {{ accuracy(m.accuracy) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>

  <section
    v-else
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10"
    data-testid="su-empty"
  >
    <p class="text-base font-bold text-slate-700" data-testid="su-empty-title">
      Tiada data untuk tempoh ini
    </p>
    <p v-if="period === 'today'" class="mt-1 text-sm text-slate-500" data-testid="su-empty-text">
      Belum ada pelajar buat latihan hari ini. Cuba lihat
      <RouterLink
        :to="{ path: USAGE_PATH, query: { period: '7days' } }"
        class="inline-flex min-h-11 items-center font-semibold text-indigo-600 underline"
        data-testid="su-empty-7days"
        >7 Hari</RouterLink
      >
      atau
      <RouterLink
        :to="{ path: USAGE_PATH, query: { period: '30days' } }"
        class="inline-flex min-h-11 items-center font-semibold text-indigo-600 underline"
        data-testid="su-empty-30days"
        >30 Hari</RouterLink
      >.
    </p>
    <p v-else class="mt-1 text-sm text-slate-500" data-testid="su-empty-text">
      Tiada aktiviti latihan dalam tempoh {{ label }} yang lepas.
    </p>
  </section>
</template>
