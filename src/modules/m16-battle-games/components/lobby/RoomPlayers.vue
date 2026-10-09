<script setup lang="ts">
/**
 * The players of a room (PROVISIONAL, SRS M16 v1.6 §8.2): name, grade ("Darjah n" / "Tingkatan n"), "Hos",
 * the Kuiz Relay team and, while the game runs, the per-game metric (board tile, HP, steps, points).
 */
import type { RoomView } from '../../api'
import { teamLabel } from './lobby-lib'
import { markerClass, metricText } from './room-lib'

defineProps<{ room: RoomView; showMetric: boolean }>()
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow" data-testid="room-players">
    <h2 class="font-heading text-base font-bold text-slate-800">
      Pemain ({{ room.players.length }}/{{ room.settings.maxPlayers }})
    </h2>
    <ul class="mt-3 space-y-2">
      <li
        v-for="(p, i) in room.players"
        :key="p.id"
        class="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2"
        data-testid="room-player"
      >
        <span
          class="h-3 w-3 shrink-0 rounded-full"
          :class="markerClass(i)"
          data-testid="room-player-marker"
        ></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold break-words text-slate-700" data-testid="room-player-name">
            {{ p.name }}
          </p>
          <p class="text-xs text-slate-500">
            {{ p.grade }}
            <span v-if="p.team !== undefined" data-testid="room-player-team">
              · Pasukan {{ teamLabel(p.team) }}</span
            >
            <span v-if="showMetric" data-testid="room-player-metric">
              · {{ metricText(room, p) }}</span
            >
          </p>
        </div>
        <span
          v-if="p.id === room.host.id"
          class="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700"
          data-testid="room-player-host"
          >Hos</span
        >
      </li>
    </ul>
  </section>
</template>
