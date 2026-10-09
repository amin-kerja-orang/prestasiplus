<script setup lang="ts">
/**
 * S8–S12 `/{game}` multiplayer lobbies (SRS M16 v1.6 FR-M16-62..66; URS FT-M16-5.4; M16-T4): one template
 * for Perang Fakta, Benteng Ilmu, Perlumbaan Matematik, Kuiz Relay and Teka Silang Kata. Hero with the
 * rule line, "🏠 Cipta Bilik Baru", "🔑 Masuk Dengan Kod" and "🏆 Pendahulu" from `GET
 * /api/games/{game}/lobby` (#23). A refused code shows the red flash "Bilik tidak dijumpai." at the top
 * of the content.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchGameLobby, joinRoom, type RoomGame } from '../api'
import JoinCodeForm from '../components/lobby/JoinCodeForm.vue'
import LeadersCard from '../components/lobby/LeadersCard.vue'
import {
  LOAD_ERROR,
  ROOM_GAME_META,
  ROOM_NOT_FOUND,
  ROOM_THEME,
  roomPath,
} from '../components/lobby/lobby-config'
import { errorLines, isNotFoundError } from '../components/lobby/lobby-lib'
import RoomCreateForm from '../components/lobby/RoomCreateForm.vue'

const props = defineProps<{ game: RoomGame }>()

const meta = computed(() => ROOM_GAME_META[props.game])
const theme = computed(() => ROOM_THEME[props.game])

const router = useRouter()
const flash = useFlash()
const { data: lobby, error } = useApi((signal) => fetchGameLobby(props.game, { signal }))
const loading = computed(() => lobby.value === null && error.value === null)

const joining = ref(false)

function openRoom(code: string): void {
  void router.push(roomPath(props.game, code))
}

async function join(code: string): Promise<void> {
  if (joining.value) return
  joining.value = true
  try {
    const res = await joinRoom(props.game, code)
    openRoom(res.code)
  } catch (err) {
    flash.show({
      type: 'error',
      message: isNotFoundError(err) ? ROOM_NOT_FOUND : errorLines(err),
    })
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-4 sm:space-y-6" data-testid="lobby-page">
    <div
      v-if="loading"
      class="flex justify-center py-16 text-indigo-500"
      data-testid="lobby-loading"
    >
      <LoadingSpinner :size="32" />
    </div>
    <AlertBox v-else-if="error" :messages="LOAD_ERROR" data-testid="lobby-error" />
    <template v-else-if="lobby">
      <header
        class="relative overflow-hidden rounded-3xl bg-linear-to-br p-5 text-white shadow-lg sm:p-6"
        :class="theme.hero"
      >
        <h1 class="font-heading text-2xl font-bold sm:text-3xl" data-testid="lobby-h1">
          {{ meta.emoji }} {{ meta.title }}
        </h1>
        <p class="mt-1 max-w-xl text-sm sm:text-base" data-testid="lobby-subtitle">
          {{ meta.subtitle }}
        </p>
        <p class="mt-2 text-xs" data-testid="lobby-rule">{{ meta.rule }}</p>
        <span
          class="pointer-events-none absolute top-1/2 right-6 -translate-y-1/2 text-7xl opacity-20 select-none sm:text-8xl"
          >{{ meta.emoji }}</span
        >
      </header>

      <RoomCreateForm
        :game="game"
        :auto-grade="lobby.autoGrade"
        :auto-grade-name="lobby.autoGradeName"
        @created="openRoom"
      />
      <JoinCodeForm
        heading="🔑 Masuk Dengan Kod"
        placeholder="Contoh: ABC123"
        :required="false"
        button="Masuk"
        :busy="joining"
        variant="lobby"
        :button-class="theme.button"
        @submit="join"
      />

      <LeadersCard
        v-if="lobby.leaders && lobby.leaders.length > 0"
        :leaders="lobby.leaders"
        :unit="meta.unit"
        :value-class="theme.value"
      />
    </template>
  </div>
</template>
