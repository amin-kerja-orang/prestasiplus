<script setup lang="ts">
/**
 * The players of a room (PROVISIONAL, SRS M16 v1.6 §8.2): name, grade ("Darjah n" / "Tingkatan n"), "Hos",
 * the Kuiz Relay team and, while the game runs, the per-game metric (board tile, HP, steps, points).
 */
import type { RoomView } from '../../api'
import { teamLabel } from './lobby-lib'
import { markerClass, metricText } from './room-lib'
import { DsHeading, DsText } from '@/ds'

defineProps<{ room: RoomView; showMetric: boolean }>()
</script>

<template>
  <UCard data-testid="room-players">
    <DsHeading :level="2" variant="subheading">
      Pemain ({{ room.players.length }}/{{ room.settings.maxPlayers }})
    </DsHeading>
    <ul class="mt-3 flex flex-col gap-2">
      <li
        v-for="(p, i) in room.players"
        :key="p.id"
        class="flex items-center gap-3 rounded-card bg-elevated px-3 py-2"
        data-testid="room-player"
      >
        <span
          class="size-3 shrink-0 rounded-full"
          :class="markerClass(i)"
          data-testid="room-player-marker"
        ></span>
        <div class="min-w-0 flex-1">
          <DsText
            variant="label"
            as="p"
            tone="highlighted"
            wrap="anywhere"
            data-testid="room-player-name"
          >
            {{ p.name }}
          </DsText>
          <DsText variant="caption">
            {{ p.grade }}
            <span v-if="p.team !== undefined" data-testid="room-player-team">
              · Pasukan {{ teamLabel(p.team) }}</span
            >
            <span v-if="showMetric" data-testid="room-player-metric">
              · {{ metricText(room, p) }}</span
            >
          </DsText>
        </div>
        <UBadge
          v-if="p.id === room.host.id"
          color="warning"
          variant="soft"
          data-testid="room-player-host"
          >Hos</UBadge
        >
      </li>
    </ul>
  </UCard>
</template>
