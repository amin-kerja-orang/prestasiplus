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

import { useApi, useFlash } from '@/composables'
import { DsArt3D, DsPage } from '@/ds'

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
  <DsPage data-testid="lobby-page">
    <h1 v-if="!lobby" class="sr-only">{{ meta.title }}</h1>
    <div v-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="lobby-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="LOAD_ERROR"
      data-testid="lobby-error"
    />
    <template v-else-if="lobby">
      <UCard>
        <div class="flex items-center justify-between gap-4">
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title text-highlighted" data-testid="lobby-h1">
              {{ meta.emoji }} {{ meta.title }}
            </h1>
            <p class="max-w-prose text-body text-muted" data-testid="lobby-subtitle">
              {{ meta.subtitle }}
            </p>
            <p class="text-caption text-muted" data-testid="lobby-rule">{{ meta.rule }}</p>
          </div>
          <DsArt3D :name="theme.art" size="hero" float class="hidden sm:block" />
        </div>
      </UCard>

      <div class="grid gap-4 md:grid-cols-2 md:gap-6">
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
          :color="theme.color"
          @submit="join"
        />
      </div>

      <LeadersCard
        v-if="lobby.leaders && lobby.leaders.length > 0"
        :leaders="lobby.leaders"
        :unit="meta.unit"
      />
    </template>
  </DsPage>
</template>
