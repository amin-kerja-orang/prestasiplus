<script setup lang="ts">
/**
 * S6 open-rooms strip (SRS M16 v1.6 FR-M16-51; URS FN-M16-4.1.2). Empty state as live ("🌙", "Tiada bilik
 * terbuka buat masa ini.", "Cipta bilik permainan dan jemput rakan-rakan!"); with waiting rooms one chip
 * per room (PROPOSED layout): game emoji + game name + code + "{players}/{max}", linking to the room.
 */
import type { GamesHub } from '../../api'
import { ROOM_GAME_META, roomPath } from '../lobby/lobby-config'
import { HUB_NO_ROOMS } from './hub-cards'

defineProps<{ rooms: GamesHub['openRooms'] }>()
</script>

<template>
  <UCard data-testid="hub-open-rooms">
    <div v-if="rooms.length === 0" class="py-2 text-center" data-testid="hub-open-rooms-empty">
      <div class="text-title">{{ HUB_NO_ROOMS.emoji }}</div>
      <p class="mt-1 text-label text-toned">{{ HUB_NO_ROOMS.title }}</p>
      <p class="text-body text-muted">{{ HUB_NO_ROOMS.hint }}</p>
    </div>
    <ul v-else class="flex flex-wrap gap-2">
      <li v-for="room in rooms" :key="room.code">
        <UButton
          :to="roomPath(room.game, room.code)"
          color="primary"
          variant="soft"
          size="lg"
          class="min-h-11 gap-2"
          data-testid="hub-open-room"
        >
          <span>{{ ROOM_GAME_META[room.game].emoji }}</span>
          <span>{{ ROOM_GAME_META[room.game].title }}</span>
          <span class="tabular">{{ room.code }}</span>
          <span class="tabular">{{ room.players }}/{{ room.max }}</span>
        </UButton>
      </li>
    </ul>
  </UCard>
</template>
