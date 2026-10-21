<script setup lang="ts">
/**
 * S16 `/permainan/susun-jawapan` Susun Jawapan (FR-M16-82..85, 91, 92; URS FT-M16-6.5; BR-M16-26).
 * 20 puzzles, no timer, no countdown: it plays as soon as a darjah is chosen. Clicking a source tile
 * places it, clicking a placed tile (or the drop area, which removes the last one) returns it.
 *
 * D58a (http mode only): the payload is keyless and the server allows ONE check per puzzle. FORCED DEVIATION:
 * the FIRST "Semak" of a puzzle goes to `POST /check`, which decides correct/wrong and the scoring. After
 * "Cuba lagi" a later "Semak" is judged locally against the answer that first check revealed; a match resolves
 * the puzzle but scores NOTHING (shows "+0 mata", no solved count, the dot ends red as for a skip), because the
 * server stored the puzzle as wrong. A 409 on the first check is treated as a skip (0 points, red dot, next puzzle).
 * Mock mode is unchanged.
 */
import { computed, ref, watch } from 'vue'

import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import { CONFLICT, createInflight, judgeSusunJawapan, settle } from '../components/solo/solo-check'
import { susunGain, susunMatches, susunTitle } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { playCoins, submitResult, useSoloGame } from '../components/solo/useSoloGame'
import { isHttpMode } from '@/api/mode'
import { DsLoadError } from '@/ds'

const timers = useGameTimers()
const inflight = createInflight()
const { darjah, payload, loading, error, load } = useSoloGame('susun-jawapan')

interface ResultState {
  newRecord: boolean
  credited: number
  serverScore?: number
  serverCorrect?: number
  serverAnswered?: number
}

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
/** `server*`: the values the server computed (http mode); they replace the local ones on the result card. */
const result = ref<ResultState>({ newRecord: false, credited: 0 })
/** http mode: a check is in flight / the answer the first check revealed / the puzzle was resolved locally. */
const checking = ref(false)
const revealed = ref<string | null>(null)
const localSolved = ref(false)
let run = 0

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

function resetPuzzleState(): void {
  checking.value = false
  revealed.value = null
  localSolved.value = false
}

function reset(): void {
  run += 1
  resetPuzzleState()
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
  if (check.value !== 'idle' || checking.value || placed.value.includes(i)) return
  placed.value = [...placed.value, i]
}

function remove(i: number): void {
  if (check.value !== 'idle' || checking.value) return
  placed.value = placed.value.filter((x) => x !== i)
}

function removeLast(): void {
  if (check.value !== 'idle' || checking.value) return
  placed.value = placed.value.slice(0, -1)
}

function verify(): void {
  const p = current.value
  if (!p || placed.value.length === 0 || check.value !== 'idle' || checking.value) return
  const tiles = placed.value.map((i) => p.scrambled[i] ?? '')
  if (revealed.value !== null) {
    // http mode, a later attempt: judged against the revealed answer, scores nothing.
    if (susunMatches(tiles, p.type, revealed.value)) {
      lastPoints.value = 0
      localSolved.value = true
      check.value = 'correct'
    } else {
      check.value = 'wrong'
    }
    return
  }
  const qi = index.value
  const myRun = run
  checking.value = true
  settle(judgeSusunJawapan(payload.value?.sessionId ?? '', p, tiles, inflight), (r) => {
    if (myRun !== run) return // restarted: reset() already cleared the flag
    if (phase.value !== 'playing' || index.value !== qi) {
      checking.value = false
      return // stale
    }
    checking.value = false
    if (r === CONFLICT) {
      // 409: the server already holds a check for this puzzle, so it can never be accepted and its answer is
      // unknown here. Treat it as a skip (0 points, red dot, next puzzle) so nothing claims "BETUL!" and
      // "Cuba lagi" can never re-post it.
      dots.value[index.value] = 'wrong'
      advance()
      return
    }
    if (r?.correct === true) {
      const gain = susunGain(p.points)
      score.value += gain.points
      coins.value += gain.coins
      solved.value += 1
      lastPoints.value = p.points
      dots.value[index.value] = 'done'
      check.value = 'correct'
    } else {
      if (isHttpMode()) revealed.value = r?.answer ?? null // r is null on a network failure: a retry re-posts
      check.value = 'wrong'
    }
  })
}

function retry(): void {
  placed.value = []
  check.value = 'idle'
}

function next(): void {
  if (check.value !== 'correct') return
  if (localSolved.value) dots.value[index.value] = 'wrong' // resolved without score, as a skip
  advance()
}

function skip(): void {
  if (phase.value !== 'playing' || checking.value) return
  if (dots.value[index.value] !== 'done') dots.value[index.value] = 'wrong'
  advance()
}

function advance(): void {
  resetPuzzleState()
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
  }, inflight)
  result.value = {
    newRecord: res?.is_new_record === true,
    credited: res?.syiling_awarded ?? 0,
    serverScore: res?.score,
    serverCorrect: res?.correct_count,
    serverAnswered: res?.total_answered,
  }
  phase.value = 'done'
}

const shownScore = computed(() => result.value.serverScore ?? score.value)
const shownSolved = computed(() => result.value.serverCorrect ?? solved.value)
const tiles = computed(() => [
  { label: 'Skor Total', value: String(shownScore.value), tone: 'text-primary-t' },
  {
    label: 'Selesai',
    value: `${String(shownSolved.value)}/${String(puzzles.value.length)}`,
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
      <div v-if="loading" class="flex flex-col gap-3" aria-busy="true" data-testid="solo-loading">
        <USkeleton class="h-16 w-full" />
        <USkeleton class="h-16 w-full" />
      </div>
      <DsLoadError v-else-if="error" :message="error" @retry="load()" />

      <div v-if="phase === 'playing' && current" class="flex flex-col gap-4">
        <div class="flex items-center justify-between gap-2">
          <UButton
            to="/permainan"
            color="neutral"
            variant="ghost"
            icon="i-ph-arrow-left"
            class="min-h-11"
          >
            Kembali
          </UButton>
          <div class="flex gap-2">
            <UBadge color="primary" variant="soft" size="xl" data-testid="solo-score"
              >Skor <b class="ms-1">{{ score }}</b></UBadge
            >
            <UBadge color="warning" variant="soft" size="xl" data-testid="solo-coins"
              >🪙 {{ coinsShown }}</UBadge
            >
          </div>
        </div>

        <h1 class="text-center text-title text-highlighted">🧩 Susun Jawapan</h1>
        <div class="flex flex-wrap justify-center gap-2" data-testid="solo-dots">
          <UBadge
            v-for="(dot, i) in dots"
            :key="i"
            :color="dot === 'done' ? 'success' : dot === 'wrong' ? 'error' : i === index ? 'primary' : 'neutral'"
            variant="solid"
            size="sm"
            class="size-3 p-0"
            :data-state="dot"
            :data-active="i === index"
            data-testid="solo-dot"
          />
        </div>

        <UCard class="text-center" data-testid="solo-card">
          <p class="text-overline text-primary-t">
            Soalan {{ index + 1 }} daripada {{ puzzles.length }}
          </p>
          <p class="mt-2 text-subheading break-words text-highlighted">
            {{ current.question }}
          </p>
        </UCard>

        <div class="flex flex-col gap-2 text-center">
          <p class="text-caption text-muted">📥 Jawapan Kamu:</p>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" data-testid="solo-drop" @click="removeLast">
            <div class="flex min-h-16 flex-wrap items-center justify-center gap-2">
              <span v-if="placedTiles.length === 0" class="text-body text-muted"
                >Klik huruf/perkataan di bawah untuk susun</span
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
            </div>
          </UCard>
        </div>

        <div class="flex flex-col gap-2 text-center">
          <p class="text-caption text-muted">🔤 Pilihan:</p>
          <UCard :ui="{ body: 'p-3 sm:p-3' }" data-testid="solo-source">
            <div class="flex min-h-16 flex-wrap items-center justify-center gap-2">
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
            </div>
          </UCard>
        </div>

        <div v-if="check === 'idle'" class="flex flex-col gap-3">
          <UButton
            type="button"
            size="xl"
            color="primary"
            variant="solid"
            class="min-h-14 w-full justify-center"
            :disabled="placed.length === 0 || checking"
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
            :disabled="checking"
            data-testid="solo-skip-question"
            @click="skip"
          >
            ⏭️ Langkau Soalan Ini
          </UButton>
        </div>

        <div v-else-if="check === 'correct'" class="flex flex-col gap-3 text-center">
          <p class="text-subheading text-success" data-testid="solo-feedback">
            🎉 BETUL! +{{ lastPoints }} mata
          </p>
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
        </div>

        <div v-else class="flex flex-col gap-3 text-center">
          <p class="text-label text-error" data-testid="solo-feedback">❌ Cuba lagi atau langkau</p>
          <div class="grid gap-3 sm:grid-cols-2">
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
          </div>
        </div>
      </div>

      <ResultCard
        v-if="phase === 'done'"
        theme="teal"
        :title="susunTitle(shownSolved, puzzles.length)"
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
