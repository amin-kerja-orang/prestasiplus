<script setup lang="ts">
/**
 * S7 `/papan-bijak` "Papan Bijak" lobby (SRS M16 v1.6 FR-M16-54..61; URS FT-M16-5.1..5.3; M16-T4). The
 * hero, the create form, the join form with "Cara Bermain:", the quick match and the Top 10, from
 * `GET /api/games/papan-bijak/lobby` (#23). An unknown or refused code returns to the lobby with the red
 * flash "Bilik tidak dijumpai." at the top of the content (DV-M16-07 pattern, INFERRED).
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsArt3D, DsPage, DsStack, DsCluster, DsHeading, DsText } from '@/ds'

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
  <DsPage data-testid="pb-page">
    <DsStack v-if="loading" aria-busy="true" data-testid="pb-loading">
      <USkeleton class="h-28 w-full" />
      <USkeleton class="h-40 w-full" />
    </DsStack>
    <UAlert
      v-else-if="error"
      color="error"
      variant="subtle"
      :title="LOAD_ERROR"
      data-testid="pb-error"
    />
    <template v-else-if="lobby">
      <UCard>
        <DsCluster gap="md" justify="between" :wrap="false">
          <DsStack gap="2xs">
            <DsHeading :level="1" data-testid="pb-h1">
              {{ meta.emoji }} {{ meta.title }}
            </DsHeading>
            <DsText variant="body" tone="muted" class="max-w-prose" data-testid="pb-subtitle">
              {{ meta.subtitle }}
            </DsText>
          </DsStack>
          <DsArt3D name="party" size="hero" float class="hidden sm:block" />
        </DsCluster>
      </UCard>

      <div class="grid gap-4 md:grid-cols-2 md:gap-6">
        <RoomCreateForm
          :game="GAME"
          :auto-grade="lobby.autoGrade"
          :auto-grade-name="lobby.autoGradeName"
          @created="openRoom"
        />
        <JoinCodeForm
          heading="🔑 Masuk Bilik"
          label="Kod Bilik (6 aksara)"
          placeholder="ABC123"
          :required="true"
          button="🚀 Masuk Bilik"
          :busy="joining"
          variant="pb"
          @submit="join"
        >
          <div class="mt-4" data-testid="pb-how-to">
            <DsHeading :level="2" variant="label">Cara Bermain:</DsHeading>
            <ul class="mt-2 flex flex-col gap-2 text-caption text-success">
              <li v-for="line in PB_HOW_TO" :key="line">{{ line }}</li>
            </ul>
          </div>
        </JoinCodeForm>
      </div>

      <QuickMatchCard @matched="openRoom" />

      <TopTenTable v-if="lobby.top10 && lobby.top10.length > 0" :rows="lobby.top10" />
    </template>
  </DsPage>
</template>
