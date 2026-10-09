<script setup lang="ts">
/**
 * S16 `/permainan/susun-jawapan` Susun Jawapan (FR-M16-82..85, 91, 92; URS FT-M16-6.5; BR-M16-26).
 * 20 puzzles, no timer, no countdown: it plays as soon as a darjah is chosen. Clicking a source tile
 * places it, clicking a placed tile (or the drop area, which removes the last one) returns it.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

import DarjahPicker from '../components/solo/DarjahPicker.vue'
import GamePanel from '../components/solo/GamePanel.vue'
import LoadState from '../components/solo/LoadState.vue'
import ResultCard from '../components/solo/ResultCard.vue'
import { susunGain, susunMatches, susunTitle } from '../components/solo/solo-lib'
import { useGameTimers } from '../components/solo/useGameTimers'
import { playCoins, submitResult, useSoloGame } from '../components/solo/useSoloGame'

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
  { label: 'Skor Total', value: String(score.value), tone: 'text-teal-300' },
  {
    label: 'Selesai',
    value: `${String(solved.value)}/${String(puzzles.value.length)}`,
    tone: 'text-emerald-400',
  },
  {
    label: 'Syiling Diperolehi',
    value: `${String(result.value.credited)} 🪙`,
    tone: 'text-yellow-300',
    wide: true,
  },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div data-testid="solo-susun-jawapan">
    <DarjahPicker
      v-if="darjah === null"
      emoji="🧩"
      title="Susun Jawapan"
      color="var(--color-teal-500)"
    />
    <GamePanel theme="teal">
      <LoadState :loading="loading" :error="error" />

      <div v-if="phase === 'playing' && current" class="mx-auto max-w-xl space-y-4">
        <div class="flex items-center justify-between gap-2">
          <RouterLink
            to="/permainan"
            class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-teal-300 hover:text-teal-100"
          >
            <ArrowLeft :size="16" /> Kembali
          </RouterLink>
          <div class="flex gap-2">
            <span
              class="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-slate-300"
              data-testid="solo-score"
              >Skor <b class="ml-1 text-teal-300">{{ score }}</b></span
            >
            <span
              class="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm font-bold text-yellow-300"
              data-testid="solo-coins"
              >🪙 {{ coinsShown }}</span
            >
          </div>
        </div>

        <!-- Live paints this heading dark on the dark panel (≈ 1.3:1); DV-M16-46 paints it white. -->
        <h2 class="text-center font-heading text-xl font-extrabold text-white">🧩 Susun Jawapan</h2>
        <div class="flex flex-wrap justify-center gap-1.5" data-testid="solo-dots">
          <span
            v-for="(dot, i) in dots"
            :key="i"
            class="h-3 w-3 rounded-full"
            :class="[
              i === index ? 'active bg-teal-400 ring-2 ring-teal-300/50' : '',
              dot === 'done'
                ? 'done bg-emerald-400'
                : dot === 'wrong'
                  ? 'wrong bg-red-400'
                  : i === index
                    ? ''
                    : 'bg-white/20',
            ]"
            data-testid="solo-dot"
          />
        </div>

        <div
          class="rounded-3xl border border-white/10 bg-white/5 p-5 text-center"
          data-testid="solo-card"
        >
          <p class="text-xs font-bold tracking-wider text-teal-300 uppercase">
            Soalan {{ index + 1 }} daripada {{ puzzles.length }}
          </p>
          <p class="mt-2 font-heading text-lg font-bold break-words text-white">
            {{ current.question }}
          </p>
        </div>

        <div class="text-center">
          <p class="mb-2 text-xs text-slate-300">📥 Jawapan Kamu:</p>
          <div
            class="flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl border border-teal-500/30 bg-white/5 p-3"
            data-testid="solo-drop"
            @click="removeLast"
          >
            <span v-if="placedTiles.length === 0" class="text-sm text-slate-400"
              >Klik huruf/perkataan di bawah untuk susun</span
            >
            <button
              v-for="tile in placedTiles"
              :key="tile.i"
              type="button"
              class="min-h-11 min-w-11 rounded-xl border-2 px-3 py-2 text-base font-bold"
              :class="
                check === 'wrong'
                  ? 'border-red-400 bg-red-500/10 text-red-300'
                  : 'border-teal-400 bg-teal-500/20 text-teal-100'
              "
              data-testid="solo-placed"
              @click.stop="remove(tile.i)"
            >
              {{ tile.text }}
            </button>
          </div>
        </div>

        <div class="text-center">
          <p class="mb-2 text-xs text-slate-300">🔤 Pilihan:</p>
          <div
            class="flex min-h-20 flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-white/15 bg-white/5 p-3"
            data-testid="solo-source"
          >
            <button
              v-for="tile in sourceTiles"
              :key="tile.i"
              type="button"
              class="min-h-11 min-w-11 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-base font-bold text-white hover:border-teal-300 disabled:opacity-50"
              :disabled="check !== 'idle'"
              data-testid="solo-tile"
              @click="place(tile.i)"
            >
              {{ tile.text }}
            </button>
          </div>
        </div>

        <div v-if="check === 'idle'" class="space-y-3">
          <button
            type="button"
            class="min-h-14 w-full rounded-2xl bg-gradient-to-r from-teal-400 to-teal-500 px-3 py-3 text-lg font-bold text-teal-950 shadow-lg hover:brightness-105 disabled:opacity-40"
            :disabled="placed.length === 0"
            data-testid="solo-check"
            @click="verify"
          >
            ✅ Semak Jawapan
          </button>
          <button
            type="button"
            class="min-h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-bold text-slate-200 hover:bg-white/10"
            data-testid="solo-skip-question"
            @click="skip"
          >
            ⏭️ Langkau Soalan Ini
          </button>
        </div>

        <div v-else-if="check === 'correct'" class="space-y-3 text-center">
          <p class="text-lg font-extrabold text-emerald-300" data-testid="solo-feedback">
            🎉 BETUL! +{{ lastPoints }} mata
          </p>
          <button
            type="button"
            class="min-h-14 w-full rounded-2xl bg-gradient-to-r from-teal-400 to-teal-500 px-3 py-3 text-lg font-bold text-teal-950 shadow-lg hover:brightness-105"
            data-testid="solo-next"
            @click="next"
          >
            Seterusnya →
          </button>
        </div>

        <div v-else class="space-y-3 text-center">
          <p class="text-base font-bold text-red-300" data-testid="solo-feedback">
            ❌ Cuba lagi atau langkau
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-12 rounded-2xl bg-gradient-to-r from-teal-400 to-teal-500 px-3 py-3 text-base font-bold text-teal-950 shadow-lg hover:brightness-105"
              data-testid="solo-retry"
              @click="retry"
            >
              🔄 Cuba Lagi
            </button>
            <button
              type="button"
              class="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-base font-bold text-slate-200 hover:bg-white/10"
              data-testid="solo-skip"
              @click="skip"
            >
              ⏭️ Langkau
            </button>
          </div>
        </div>
      </div>

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
