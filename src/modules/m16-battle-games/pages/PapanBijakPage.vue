<script setup lang="ts">
/**
 * S7 `/papan-bijak` "Papan Bijak" lobby (SRS M16 v1.6 FR-M16-54..61; URS FT-M16-5.1..5.3; M16-T4). The
 * hero, the create form, the join form with "Cara Bermain:", the quick match and the Top 10, from
 * `GET /api/games/papan-bijak/lobby` (#23). An unknown or refused code returns to the lobby with the red
 * flash "Bilik tidak dijumpai." at the top of the content (DV-M16-07 pattern, INFERRED).
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchGameLobby, joinRoom } from '../api'
import JoinCodeForm from '../components/lobby/JoinCodeForm.vue'
import {
  LOAD_ERROR,
  PB_HOW_TO,
  ROOM_GAME_META,
  ROOM_NOT_FOUND,
  roomPath,
} from '../components/lobby/lobby-config'
import { errorLines, isNotFoundError } from '../components/lobby/lobby-lib'
import QuickMatchCard from '../components/lobby/QuickMatchCard.vue'
import RoomCreateForm from '../components/lobby/RoomCreateForm.vue'
import TopTenTable from '../components/lobby/TopTenTable.vue'

const GAME = 'papan-bijak'
const meta = ROOM_GAME_META[GAME]

const router = useRouter()
const flash = useFlash()
const { data: lobby, error } = useApi((signal) => fetchGameLobby(GAME, { signal }))
const loading = computed(() => lobby.value === null && error.value === null)

const joining = ref(false)

function openRoom(code: string): void {
  void router.push(roomPath(GAME, code))
}

async function join(code: string): Promise<void> {
  if (joining.value) return
  joining.value = true
  try {
    const res = await joinRoom(GAME, code)
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
  <div class="mx-auto max-w-5xl space-y-4 sm:space-y-6" data-testid="pb-page">
    <div v-if="loading" class="flex justify-center py-16 text-indigo-500" data-testid="pb-loading">
      <LoadingSpinner :size="32" />
    </div>
    <AlertBox v-else-if="error" :messages="LOAD_ERROR" data-testid="pb-error" />
    <template v-else-if="lobby">
      <header class="rounded-2xl bg-white p-5 shadow sm:p-6">
        <h1 class="font-heading text-2xl font-bold text-slate-800 sm:text-3xl" data-testid="pb-h1">
          {{ meta.emoji }} {{ meta.title }}
        </h1>
        <p class="mt-1 text-sm text-slate-500 sm:text-base" data-testid="pb-subtitle">
          {{ meta.subtitle }}
        </p>
      </header>

      <div class="grid gap-4 sm:gap-6 md:grid-cols-2">
        <RoomCreateForm
          :game="GAME"
          :auto-grade="lobby.autoGrade"
          :auto-grade-name="lobby.autoGradeName"
          @created="openRoom"
        />
        <div class="space-y-4 sm:space-y-6">
          <JoinCodeForm
            heading="🔑 Masuk Bilik"
            label="Kod Bilik (6 aksara)"
            placeholder="ABC123"
            :required="true"
            button="🚀 Masuk Bilik"
            :busy="joining"
            @submit="join"
          />
          <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="pb-how-to">
            <h2 class="text-sm font-bold text-slate-700">Cara Bermain:</h2>
            <ul class="mt-2 space-y-1 text-sm text-slate-600">
              <li v-for="line in PB_HOW_TO" :key="line">{{ line }}</li>
            </ul>
          </section>
        </div>
      </div>

      <QuickMatchCard @matched="openRoom" />

      <TopTenTable v-if="lobby.top10 && lobby.top10.length > 0" :rows="lobby.top10" />
    </template>
  </div>
</template>
