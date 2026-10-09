<script setup lang="ts">
/**
 * "🏆 Papan Markah — Top 10 Juara" of S7 (SRS M16 v1.6 FR-M16-61; URS FN-M16-5.3.1; BR-M16-22). The server
 * sends the ordered rows, the 15-character names and the initials; this renders the medals, the rank-1–3
 * row styles, the initials circle and the Kadar pill. The table scrolls inside its card below 768 px
 * (no sticky column, DV-M16-13 pattern).
 */
import type { GameLobby } from '../../api'
import { MEDALS } from './lobby-config'
import { kadarClass, topRowClass } from './lobby-lib'

defineProps<{ rows: NonNullable<GameLobby['top10']> }>()
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="top10-card">
    <h2 class="font-heading text-lg font-bold text-slate-800">🏆 Papan Markah — Top 10 Juara</h2>
    <div class="mt-3 overflow-x-auto" data-testid="top10-scroll">
      <table class="w-full min-w-[34rem] text-left text-sm" data-testid="top10-table">
        <thead>
          <tr class="border-b-2 border-slate-200 text-xs font-bold text-slate-500">
            <th class="px-3 py-2">#</th>
            <th class="px-3 py-2">Pemain</th>
            <th class="px-3 py-2">🏆 Menang</th>
            <th class="px-3 py-2">🎮 Jumlah</th>
            <th class="px-3 py-2">📊 Kadar</th>
            <th class="px-3 py-2">⭐ Skor</th>
            <th class="px-3 py-2">✅ Betul</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.userId"
            :class="['border-b border-slate-100', topRowClass(row.rank)]"
            data-testid="top10-row"
          >
            <td class="px-3 py-2 font-bold" data-testid="top10-rank">
              {{ MEDALS[row.rank - 1] ?? row.rank }}
            </td>
            <td class="px-3 py-2">
              <div class="flex items-center gap-2">
                <span
                  class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white"
                  data-testid="top10-initials"
                  >{{ row.initials }}</span
                >
                <span class="font-semibold text-slate-700" data-testid="top10-name">{{
                  row.name
                }}</span>
              </div>
            </td>
            <td class="px-3 py-2 font-semibold">{{ row.menang }}</td>
            <td class="px-3 py-2">{{ row.jumlah }}</td>
            <td class="px-3 py-2">
              <span
                :class="['rounded-full px-2.5 py-0.5 text-xs font-bold', kadarClass(row.kadar)]"
                data-testid="top10-kadar"
                >{{ row.kadar }}%</span
              >
            </td>
            <td class="px-3 py-2">{{ row.skor }}</td>
            <td class="px-3 py-2">{{ row.betul }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
