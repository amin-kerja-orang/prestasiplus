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
  { label: 'Skor Total', value: String(score.value) },
  { label: 'Selesai', value: `${String(solved.value)}/${String(puzzles.value.length)}` },
  { label: 'Syiling Diperolehi', value: `${String(result.value.credited)} 🪙` },
])

watch(darjah, () => void start(), { immediate: true })
</script>

<template>
  <div class="mx-auto w-full max-w-xl" data-testid="solo-susun-jawapan">
    <DarjahPicker
      v-if="darjah === null"
      emoji="🧩"
      title="Susun Jawapan"
      color="var(--color-violet-500)"
    />
    <LoadState :loading="loading" :error="error" />

    <div v-if="phase === 'playing' && current" class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <RouterLink
          to="/permainan"
          class="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft :size="16" /> Kembali
        </RouterLink>
        <div class="flex gap-2">
          <span
            class="rounded-full bg-indigo-100 px-3 py-1 text-sm font-bold text-indigo-700"
            data-testid="solo-score"
            >Skor {{ score }}</span
          >
          <span
            class="rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-700"
            data-testid="solo-coins"
            >🪙 {{ coinsShown }}</span
          >
        </div>
      </div>

      <h2 class="text-center font-heading text-xl font-extrabold text-slate-800">
        🧩 Susun Jawapan
      </h2>
      <div class="flex flex-wrap justify-center gap-1.5" data-testid="solo-dots">
        <span
          v-for="(dot, i) in dots"
          :key="i"
          class="h-3 w-3 rounded-full"
          :class="[
            i === index ? 'active ring-2 ring-indigo-400' : '',
            dot === 'done'
              ? 'done bg-emerald-500'
              : dot === 'wrong'
                ? 'wrong bg-red-400'
                : 'bg-slate-300',
          ]"
          data-testid="solo-dot"
        />
      </div>

      <div class="space-y-4 rounded-3xl bg-white p-5 shadow-md" data-testid="solo-card">
        <p class="text-xs font-bold tracking-wide text-slate-500">
          Soalan {{ index + 1 }} daripada {{ puzzles.length }}
        </p>
        <p class="text-lg font-semibold break-words text-slate-800">{{ current.question }}</p>

        <div>
          <p class="mb-1 text-xs font-bold text-slate-500">📥 Jawapan Kamu:</p>
          <div
            class="flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-3"
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
              class="min-h-11 min-w-11 rounded-xl bg-indigo-500 px-3 py-2 text-base font-bold text-white"
              data-testid="solo-placed"
              @click.stop="remove(tile.i)"
            >
              {{ tile.text }}
            </button>
          </div>
        </div>

        <div>
          <p class="mb-1 text-xs font-bold text-slate-500">🔤 Pilihan:</p>
          <div class="flex flex-wrap gap-2" data-testid="solo-source">
            <button
              v-for="tile in sourceTiles"
              :key="tile.i"
              type="button"
              class="min-h-11 min-w-11 rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-base font-bold text-slate-800 hover:border-indigo-400 disabled:opacity-50"
              :disabled="check !== 'idle'"
              data-testid="solo-tile"
              @click="place(tile.i)"
            >
              {{ tile.text }}
            </button>
          </div>
        </div>

        <div v-if="check === 'idle'" class="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            class="min-h-11 rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
            :disabled="placed.length === 0"
            data-testid="solo-check"
            @click="verify"
          >
            ✅ Semak Jawapan
          </button>
          <button
            type="button"
            class="min-h-11 rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
            data-testid="solo-skip-question"
            @click="skip"
          >
            ⏭️ Langkau Soalan Ini
          </button>
        </div>

        <div v-else-if="check === 'correct'" class="space-y-3 text-center">
          <p class="text-lg font-extrabold text-emerald-600" data-testid="solo-feedback">
            🎉 BETUL! +{{ lastPoints }} mata
          </p>
          <button
            type="button"
            class="min-h-11 w-full rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white hover:bg-indigo-700"
            data-testid="solo-next"
            @click="next"
          >
            Seterusnya →
          </button>
        </div>

        <div v-else class="space-y-3 text-center">
          <p class="text-base font-extrabold text-red-600" data-testid="solo-feedback">
            ❌ Cuba lagi atau langkau
          </p>
          <div class="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              class="min-h-11 rounded-xl bg-indigo-600 px-3 py-3 text-sm font-bold text-white hover:bg-indigo-700"
              data-testid="solo-retry"
              @click="retry"
            >
              🔄 Cuba Lagi
            </button>
            <button
              type="button"
              class="min-h-11 rounded-xl bg-slate-100 px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
              data-testid="solo-skip"
              @click="skip"
            >
              ⏭️ Langkau
            </button>
          </div>
        </div>
      </div>
    </div>

    <ResultCard
      v-else-if="phase === 'done'"
      :title="susunTitle(solved, puzzles.length)"
      subtitle="Susun Jawapan selesai!"
      :tiles="tiles"
      :new-record="false"
      again-label="🔄 Main Lagi"
      :coins-credited="result.credited"
      @again="start"
    />
  </div>
</template>
