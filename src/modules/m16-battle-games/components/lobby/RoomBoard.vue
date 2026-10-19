<script setup lang="ts">
/**
 * The Papan Bijak board (PROVISIONAL, BR-M16-20): 50 tiles in 5 rows of 10 (tile 1 start, 50 finish,
 * ladders 🪜, snakes 🐍, bonus 🎁, traps ⚠️, quiz tiles ❓). Players are coloured dots on their tile, in the
 * colour of their entry in the players list.
 */
import { computed } from 'vue'

import type { RoomView } from '../../api'
import { markerClass, tileTarget, tileView } from './room-lib'

const props = defineProps<{ board: string[]; room: RoomView }>()

interface Tile {
  n: number
  emoji: string
  className: string
  target: number | null
  players: number[]
}

const tiles = computed<Tile[]>(() => {
  const positions = props.room.state?.positions ?? {}
  return props.board.map((kind, i) => {
    const n = i + 1
    const view = tileView(kind)
    const here = props.room.players
      .map((p, idx) => ({ idx, at: positions[String(p.id)] ?? 1 }))
      .filter((x) => x.at === n)
      .map((x) => x.idx)
    return {
      n,
      emoji: view.emoji,
      className: view.className,
      target: tileTarget(kind),
      players: here,
    }
  })
})
</script>

<template>
  <div class="grid grid-cols-10 gap-1" data-testid="room-board">
    <div
      v-for="t in tiles"
      :key="t.n"
      class="flex min-h-11 flex-col items-center justify-between rounded-chip p-0.5 text-caption leading-none"
      :class="t.className"
      :data-tile="t.n"
      data-testid="room-tile"
    >
      <span class="tabular text-muted">{{ t.n }}</span>
      <span v-if="t.emoji">{{ t.emoji }}</span>
      <span class="flex flex-wrap justify-center gap-0.5">
        <span
          v-for="idx in t.players"
          :key="idx"
          class="size-2.5 rounded-full"
          :class="markerClass(idx)"
          data-testid="room-token"
        ></span>
      </span>
    </div>
  </div>
</template>
