<script setup lang="ts">
/**
 * S16 `/permainan/susun-jawapan` Susun Jawapan (FR-M16-82..85, 91, 92; URS FT-M16-6.5; BR-M16-26).
 * 20 puzzles, no timer, no countdown: it plays as soon as a darjah is chosen. Clicking a source tile
 * places it, clicking a placed tile (or the drop area, which removes the last one) returns it.
 */
import { computed, ref, watch } from 'vue'

import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import { susunGain, susunMatches, susunTitle } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { playCoins, submitResult, useSoloGame } from '../components/solo/useSoloGame'
import { DsLoadError, DsStack, DsCluster, DsGrid, DsHeading, DsText } from '@/ds'

const timers = useGameTimers()
const { darjah, payload, loading, error, load } = useSoloGame('susun-jawapan')

type Phase = 'idle' | 'playing' | 'submitting' | 'done'
type Check = 'idle' | 'correct' | 'wrong'
type Dot = 'pending' | 'done' | 'wrong'

const phase = ref<Phase>('idle')
const index = ref(0)
const placed = ref<number[]>([])
const check = ref<Check>('idle')
const score = ref(0)
const coins = ref(0)
const solved = ref(0)
const lastPoints = ref(0)
const dots = ref<Dot[]>([])
const result = ref({ newRecord: false, credited: 0 })

const puzzles = computed(() => payload.value?.puzzles ?? [])
const current = computed(() => puzzles.value[index.value])
const coinsShown = computed(() => playCoins(payload.value?.canEarnSyiling, coins.value))
const placedTiles = computed(() =>
  placed.value.map((i) => ({ i, text: current.value?.scrambled[i] ?? '' })),
)
const sourceTiles = computed(() =>
  (current.value?.scrambled ?? [])
    .map((text, i) => ({ i, text }))
    .filter((t) => !placed.value.includes(t.i)),
)

function reset(): void {
  timers.clearAll()
  phase.value = 'idle'
  index.value = 0
  placed.value = []
  check.value = 'idle'
  score.value = 0
  coins.value = 0
  solved.value = 0
  lastPoints.value = 0
  dots.value = []
  result.value = { newRecord: false, credited: 0 }
}

async function start(): Promise<void> {
  reset()
  if (!(await load())) return
  if (timers.isDisposed()) return // left the page while the session loaded
  dots.value = puzzles.value.map(() => 'pending')
  phase.value = 'playing'
}

function place(i: number): void {
  if (check.value !== 'idle' || placed.value.includes(i)) return
  placed.value = [...placed.value, i]
}

function remove(i: number): void {
  if (check.value !== 'idle') return
  placed.value = placed.value.filter((x) => x !== i)
}

function removeLast(): void {
  if (check.value !== 'idle') return
  placed.value = placed.value.slice(0, -1)
}

function verify(): void {
  const p = current.value
  if (!p || placed.value.length === 0 || check.value !== 'idle') return
  const tiles = placed.value.map((i) => p.scrambled[i] ?? '')
  if (susunMatches(tiles, p.type, p.answer)) {
    const gain = susunGain(p.points)
    score.value += gain.points
    coins.value += gain.coins
    solved.value += 1
    lastPoints.value = p.points
    dots.value[index.value] = 'done'
    check.value = 'correct'
  } else {
    check.value = 'wrong'
  }
}

function retry(): void {
  placed.value = []
  check.value = 'idle'
}

function next(): void {
  if (check.value !== 'correct') return
  advance()
}

function skip(): void {
  if (phase.value !== 'playing') return
  if (dots.value[index.value] !== 'done') dots.value[index.value] = 'wrong'
  advance()
}

function advance(): void {
  placed.value = []
  check.value = 'idle'
  if (index.value + 1 >= puzzles.value.length) {
    void finish()
    return
  }
  index.value += 1
}

async function finish(): Promise<void> {
  if (phase.value !== 'playing') return
  phase.value = 'submitting'
  const res = await submitResult('susun-jawapan', {
    session_id: payload.value?.sessionId ?? '',
    solved_count: solved.value,
    total_puzzles: puzzles.value.length,
    score: score.value,
    syiling_earned: coins.value,
  })
  result.value = { newRecord: res?.is_new_record === true, credited: res?.syiling_awarded ?? 0 }
  phase.value = 'done'
}

const tiles = computed(() => [
  { label: 'Skor Total', value: String(score.value), tone: 'text-primary-t' },
  {
    label: 'Selesai',
    value: `${String(solved.value)}/${String(puzzles.value.length)}`,
    tone: 'text-success',
  },
  {
    label: 'Syiling Diperolehi',
    value: `${String(result.value.credited)} 🪙`,
    tone: 'text-warning',
    wide: true,
  },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-susun-jawapan">
    <DarjahPicker v-if="darjah === null" title="Susun Jawapan" art="books" />
    <GamePanel>
      <DsStack v-if="loading" gap="sm" aria-busy="true" data-testid="solo-loading">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </DsStack>
      <DsLoadError v-else-if="error" :message="error" @retry="load()" />

      <DsStack v-if="phase === 'playing' && current">
        <DsCluster gap="xs" justify="between" :wrap="false">
          <UButton
            to="/permainan"
            color="neutral"
            variant="ghost"
            icon="i-ph-arrow-left"
            class="min-h-11"
          >
            Kembali
          </UButton>
          <DsCluster gap="xs" align="stretch" :wrap="false">
            <UBadge color="primary" variant="soft" size="xl" data-testid="solo-score"
              >Skor <b class="ms-1">{{ score }}</b></UBadge
            >
            <UBadge color="warning" variant="soft" size="xl" data-testid="solo-coins"
              >🪙 {{ coinsShown }}</UBadge
            >
          </DsCluster>
        </DsCluster>

        <DsHeading :level="1" align="center">🧩 Susun Jawapan</DsHeading>
        <DsCluster gap="xs" align="stretch" justify="center" data-testid="solo-dots">
          <UBadge
            v-for="(dot, i) in dots"
            :key="i"
            :color="
              dot === 'done'
                ? 'success'
                : dot === 'wrong'
                  ? 'error'
                  : i === index
                    ? 'primary'
                    : 'neutral'
            "
            variant="solid"
            size="sm"
            class="size-3 p-0"
            :data-state="dot"
            :data-active="i === index"
            data-testid="solo-dot"
          />
        </DsCluster>

        <UCard class="text-center" data-testid="solo-card">
          <DsText variant="overline" as="p" tone="primary">
            Soalan {{ index + 1 }} daripada {{ puzzles.length }}
          </DsText>
          <p class="mt-2 text-subheading break-words text-highlighted">
            {{ current.question }}
          </p>
        </UCard>

        <DsStack gap="xs" class="text-center">
          <DsText variant="caption">📥 Jawapan Kamu:</DsText>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" data-testid="solo-drop" @click="removeLast">
            <DsCluster gap="xs" justify="center" class="min-h-16">
              <DsText v-if="placedTiles.length === 0" variant="body" as="span" tone="muted"
                >Klik huruf/perkataan di bawah untuk susun</DsText
              >
              <UButton
                v-for="tile in placedTiles"
                :key="tile.i"
                type="button"
                size="lg"
                :color="check === 'wrong' ? 'error' : 'primary'"
                variant="soft"
                class="min-h-11 min-w-11 justify-center"
                data-testid="solo-placed"
                @click.stop="remove(tile.i)"
              >
                {{ tile.text }}
              </UButton>
            </DsCluster>
          </UCard>
        </DsStack>

        <DsStack gap="xs" class="text-center">
          <DsText variant="caption">🔤 Pilihan:</DsText>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" data-testid="solo-source">
            <DsCluster gap="xs" justify="center" class="min-h-16">
              <UButton
                v-for="tile in sourceTiles"
                :key="tile.i"
                type="button"
                size="lg"
                color="neutral"
                variant="soft"
                class="min-h-11 min-w-11 justify-center"
                :disabled="check !== 'idle'"
                data-testid="solo-tile"
                @click="place(tile.i)"
              >
                {{ tile.text }}
              </UButton>
            </DsCluster>
          </UCard>
        </DsStack>

        <DsStack v-if="check === 'idle'" gap="sm">
          <UButton
            type="button"
            size="xl"
            color="primary"
            variant="solid"
            class="min-h-14 w-full justify-center"
            :disabled="placed.length === 0"
            data-testid="solo-check"
            @click="verify"
          >
            ✅ Semak Jawapan
          </UButton>
          <UButton
            type="button"
            size="lg"
            color="neutral"
            variant="soft"
            class="min-h-12 w-full justify-center"
            data-testid="solo-skip-question"
            @click="skip"
          >
            ⏭️ Langkau Soalan Ini
          </UButton>
        </DsStack>

        <DsStack v-else-if="check === 'correct'" gap="sm" class="text-center">
          <DsText variant="subheading" tone="success" data-testid="solo-feedback">
            🎉 BETUL! +{{ lastPoints }} mata
          </DsText>
          <UButton
            type="button"
            size="xl"
            color="primary"
            variant="solid"
            class="min-h-14 w-full justify-center"
            data-testid="solo-next"
            @click="next"
          >
            Seterusnya →
          </UButton>
        </DsStack>

        <DsStack v-else gap="sm" class="text-center">
          <DsText variant="label" as="p" tone="error" data-testid="solo-feedback"
            >❌ Cuba lagi atau langkau</DsText
          >
          <DsGrid :cols="{ sm: 2 }" gap="sm">
            <UButton
              type="button"
              size="xl"
              color="primary"
              variant="solid"
              class="min-h-12 justify-center"
              data-testid="solo-retry"
              @click="retry"
            >
              🔄 Cuba Lagi
            </UButton>
            <UButton
              type="button"
              size="xl"
              color="neutral"
              variant="soft"
              class="min-h-12 justify-center"
              data-testid="solo-skip"
              @click="skip"
            >
              ⏭️ Langkau
            </UButton>
          </DsGrid>
        </DsStack>
      </DsStack>

      <ResultCard
        v-if="phase === 'done'"
        theme="teal"
        :title="susunTitle(solved, puzzles.length)"
        subtitle="Susun Jawapan selesai!"
        :tiles="tiles"
        :new-record="false"
        again-label="🔄 Main Lagi"
        :coins-credited="result.credited"
        @again="start"
      />
    </GamePanel>
  </div>
</template>
