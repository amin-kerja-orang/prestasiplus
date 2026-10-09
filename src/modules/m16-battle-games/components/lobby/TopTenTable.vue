<script setup lang="ts">
/**
 * "🏆 Papan Markah — Top 10 Juara" of S7 (SRS M16 v1.6 FR-M16-61; URS FN-M16-5.3.1; BR-M16-22). The server
 * sends the ordered rows, the 15-character names and the initials; this renders the medals, the rank-1–3
 * row styles, the initials circle and the Kadar pill. Look (live screenshot): a pink-tinted panel whose rows
 * are separate rounded cards (gold, silver and bronze for 1–3, large rank numbers after). The table scrolls
 * inside its card below 768 px (no sticky column, DV-M16-13 pattern).
 */
import type { GameLobby } from '../../api'
import { MEDALS } from './lobby-config'
import { kadarClass, topRowClass } from './lobby-lib'

defineProps<{ rows: NonNullable<GameLobby['top10']> }>()
</script>

<template>
  <section
    class="rounded-3xl border border-pink-200 bg-linear-to-br from-pink-50 to-pink-100 p-5 shadow-sm sm:p-6"
    data-testid="top10-card"
  >
    <h2 class="font-heading text-lg font-bold text-rose-900">🏆 Papan Markah — Top 10 Juara</h2>
    <div class="mt-3 overflow-x-auto" data-testid="top10-scroll">
      <table
        class="w-full min-w-[34rem] border-separate border-spacing-y-2 text-left text-sm"
        data-testid="top10-table"
      >
        <thead>
          <tr class="text-xs font-bold tracking-wide text-slate-600 uppercase">
            <th class="px-3 py-1">#</th>
            <th class="px-3 py-1">Pemain</th>
            <th class="px-3 py-1">🏆 Menang</th>
            <th class="px-3 py-1">🎮 Jumlah</th>
            <th class="px-3 py-1">📊 Kadar</th>
            <th class="px-3 py-1">⭐ Skor</th>
            <th class="px-3 py-1">✅ Betul</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.userId"
            :class="topRowClass(row.rank)"
            class="[&>td:first-child]:rounded-l-xl [&>td:last-child]:rounded-r-xl"
            data-testid="top10-row"
          >
            <td class="px-3 py-2.5 font-bold" data-testid="top10-rank">
              <span v-if="MEDALS[row.rank - 1]">{{ MEDALS[row.rank - 1] }}</span>
              <span v-else class="text-xl font-medium text-slate-600">{{ row.rank }}</span>
            </td>
            <td class="px-3 py-2.5">
              <div class="flex items-center gap-2">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500 text-xs font-bold text-white"
                  data-testid="top10-initials"
                  >{{ row.initials }}</span
                >
                <span class="font-semibold text-slate-700" data-testid="top10-name">{{
                  row.name
                }}</span>
              </div>
            </td>
            <td class="px-3 py-2.5 font-bold text-amber-700">{{ row.menang }}</td>
            <td class="px-3 py-2.5 text-slate-500">{{ row.jumlah }}</td>
            <td class="px-3 py-2.5">
              <span
                :class="['rounded-full px-2.5 py-0.5 text-xs font-bold', kadarClass(row.kadar)]"
                data-testid="top10-kadar"
                >{{ row.kadar }}%</span
              >
            </td>
            <td class="px-3 py-2.5 font-bold text-violet-700">{{ row.skor }}</td>
            <td
              class="px-3 py-2.5 font-bold"
              :class="row.rank === 3 ? 'text-emerald-800' : 'text-emerald-600'"
            >
              {{ row.betul }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
