<script setup lang="ts">
/**
 * The four level cards of S6 (FN-M12-7.2.1 ... 7.2.5; FR-M12-62 ... 66): 1 column below `md`, 4 from `md` with "→" between
 * the cards only from `md`. Card colours are fixed as observed (T1, T2 green; T3, T4 yellow). The T3
 * consistency labels are the English ones of live (DV-M12-18 rejected).
 */
import type { Chain } from '../../../api/types'
import { count, gps, mean, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ chain: Chain }>()

const LABELS: Record<string, string> = {
  champion: 'Champion',
  konsisten: 'Consistent',
  berkembang: 'Developing',
  minimum: 'Minimal',
  tidakTerlibat: 'Disengaged',
}
const CARD = 'min-w-0 flex-1 rounded-2xl border-2 bg-white p-4'
const ROW = 'flex items-baseline justify-between gap-3 text-sm'
</script>

<template>
  <div class="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-2" data-testid="chain-cards">
    <section :class="[CARD, 'border-green-300']" data-testid="chain-t1">
      <header class="mb-3 flex items-start gap-2">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white"
          >T1</span
        >
        <div class="min-w-0">
          <h2 class="font-heading text-sm font-bold text-gray-800">Reaksi</h2>
          <p class="text-xs text-gray-400">Kepuasan pengguna terhadap Prestasi Plus</p>
        </div>
      </header>
      <dl class="space-y-1.5">
        <div :class="ROW">
          <dt class="text-gray-500">NPS Purata</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ mean(chain.t1.nps) }}/10
          </dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Kepuasan</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ mean(chain.t1.satisfaction) }}/5
          </dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Responden</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ plain(chain.t1.responses) }}
          </dd>
        </div>
      </dl>
    </section>

    <div class="hidden items-center text-gray-300 md:flex" data-testid="chain-arrow">→</div>

    <section :class="[CARD, 'border-green-300']" data-testid="chain-t2">
      <header class="mb-3 flex items-start gap-2">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white"
          >T2</span
        >
        <div class="min-w-0">
          <h2 class="font-heading text-sm font-bold text-gray-800">Pembelajaran</h2>
          <p class="text-xs text-gray-400">Perkembangan akademik melalui Head Count</p>
        </div>
      </header>
      <dl class="space-y-1.5">
        <div :class="ROW">
          <dt class="text-gray-500">Ketepatan</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ pct(chain.t2.accuracy) }}
          </dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Soalan Dijawab</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ count(chain.t2.answers) }}
          </dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Skor Purata</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ pct(chain.t2.avgScore) }}
          </dd>
        </div>
      </dl>
    </section>

    <div class="hidden items-center text-gray-300 md:flex" data-testid="chain-arrow">→</div>

    <section :class="[CARD, 'border-yellow-300']" data-testid="chain-t3">
      <header class="mb-3 flex items-start gap-2">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white"
          >T3</span
        >
        <div class="min-w-0">
          <h2 class="font-heading text-sm font-bold text-gray-800">Tingkah Laku</h2>
          <p class="text-xs text-gray-400">Konsistensi penggunaan platform (Mastery Learning)</p>
        </div>
      </header>
      <dl class="space-y-1.5">
        <div :class="ROW">
          <dt class="text-gray-500">Pelajar Aktif</dt>
          <dd class="text-right font-semibold text-gray-800" data-testid="chain-value">
            {{ plain(chain.t3.active) }}/{{ plain(chain.t3.t4t5) }} ({{ pct(chain.t3.pct) }})
          </dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Sesi Latihan</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ count(chain.t3.sessions) }}
          </dd>
        </div>
      </dl>
      <p class="mt-3 text-xs text-gray-400">Taburan Konsistensi:</p>
      <ul class="mt-1 space-y-0.5 text-xs text-gray-700" data-testid="chain-bands">
        <li
          v-for="b in chain.t3.bands"
          :key="b.key"
          class="flex justify-between gap-3"
          :data-band="b.key"
        >
          <span>{{ LABELS[b.key] }}</span
          ><span class="font-semibold">{{ plain(b.count) }}</span>
        </li>
      </ul>
    </section>

    <div class="hidden items-center text-gray-300 md:flex" data-testid="chain-arrow">→</div>

    <section :class="[CARD, 'border-yellow-300']" data-testid="chain-t4">
      <header class="mb-3 flex items-start gap-2">
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-xs font-bold text-white"
          >T4</span
        >
        <div class="min-w-0">
          <h2 class="font-heading text-sm font-bold text-gray-800">Hasil / Impak</h2>
          <p class="text-xs text-gray-400">Korelasi penggunaan dengan pencapaian</p>
        </div>
      </header>
      <dl class="space-y-1.5">
        <div :class="ROW">
          <dt class="text-gray-500">GPS</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ chain.t4.gps === null ? '-' : gps(chain.t4.gps) }}
          </dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Korelasi (r)</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">{{ chain.t4.r }}</dd>
        </div>
        <div :class="ROW">
          <dt class="text-gray-500">Kekuatan</dt>
          <dd class="font-semibold text-gray-800" data-testid="chain-value">
            {{ chain.t4.strength }}
          </dd>
        </div>
      </dl>
    </section>
  </div>
</template>
