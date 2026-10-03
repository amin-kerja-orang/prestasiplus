<script setup lang="ts">
/**
 * S2 "Sekolah Terbaik", "Perhatian Segera" and "Cadangan Tindakan", `#section-perhatian`
 * (FN-M11-3.7.1..3.7.4; FR-M11-45..48). The three lists come from `signals` of #3; when all are empty
 * the section is one card.
 */
import { ArrowRight, CircleAlert, Lightbulb, Star, Trophy, TriangleAlert } from '@lucide/vue'
import { computed } from 'vue'

import type { MonitoringOverview, Signal } from '../../api/types'
import { CARD, count, pct } from './monitoring-format'

const props = defineProps<{ signals: MonitoringOverview['signals'] }>()

const empty = computed(
  () =>
    props.signals.best.length === 0 &&
    props.signals.attention.length === 0 &&
    props.signals.suggestions.length === 0,
)

function attention(s: Signal): string {
  const ratio = `${count(s.engaged)}/${count(s.registered)}`
  if (s.kind === 'rendah')
    return `${s.name} — ${ratio} pelajar aktif (${pct(s.pct)}). Tahap rendah.`
  if (s.kind === 'kritikal')
    return `${s.name} — Hanya ${ratio} pelajar aktif (${pct(s.pct)}). Tahap kritikal.`
  const base = `${s.name} — ${count(s.registered)} pelajar berdaftar tetapi tiada seorang pun yang menjawab soalan. Tiada sebarang tanda penggunaan platform.`
  return s.teachersLoggedIn > 0
    ? `${base} (Nota: ${count(s.teachersLoggedIn)} guru telah login)`
    : base
}

function suggestion(s: Signal): string {
  if (s.kind === 'motivasi')
    return `${s.name}: Penglibatan sangat rendah. Cadangan: Sesi motivasi dan demonstrasi penggunaan platform kepada pelajar.`
  if (s.kind === 'hubungi')
    return `${s.name}: Hubungi pihak sekolah secara langsung untuk mengenal pasti halangan dan memberi taklimat semula.`
  return `${s.name}: Guru telah login tetapi murid belum aktif. Cadangan: Adakan sesi hands-on dengan pelajar.`
}

const BOX = [CARD, 'min-w-0 border-l-4 p-3 sm:p-5']
const H = 'mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800'
</script>

<template>
  <section id="section-perhatian" class="scroll-mt-20" data-testid="mon-signals">
    <div
      v-if="empty"
      :class="[CARD, 'p-5 text-center text-sm text-slate-500']"
      data-testid="mon-signals-empty"
    >
      Tiada pemerhatian yang perlu diberi perhatian buat masa ini.
    </div>
    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div v-if="signals.best.length > 0" :class="[BOX, 'border-green-500']" data-testid="mon-best">
        <h3 :class="H"><Trophy class="h-5 w-5 text-green-600" />Sekolah Terbaik</h3>
        <ul class="space-y-2 text-sm text-slate-600">
          <li
            v-for="s in signals.best"
            :key="s.schoolId"
            class="flex items-start gap-2"
            data-testid="mon-best-item"
          >
            <Star class="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
            <span class="min-w-0 break-words"
              >{{ s.name }} — {{ pct(s.pct) }} penglibatan ({{ count(s.engaged) }}/{{
                count(s.registered)
              }}
              pelajar aktif)</span
            >
          </li>
        </ul>
      </div>
      <div
        v-if="signals.attention.length > 0"
        :class="[BOX, 'border-red-500']"
        data-testid="mon-attention"
      >
        <h3 :class="H"><TriangleAlert class="h-5 w-5 text-red-600" />Perhatian Segera</h3>
        <ul class="space-y-2 text-sm text-slate-600">
          <li
            v-for="s in signals.attention"
            :key="s.schoolId"
            class="flex items-start gap-2"
            data-testid="mon-attention-item"
          >
            <CircleAlert class="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span class="min-w-0 break-words">{{ attention(s) }}</span>
          </li>
        </ul>
      </div>
      <div
        v-if="signals.suggestions.length > 0"
        :class="[BOX, 'border-blue-500 lg:col-span-2']"
        data-testid="mon-suggestions"
      >
        <h3 :class="H"><Lightbulb class="h-5 w-5 text-blue-600" />Cadangan Tindakan</h3>
        <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <li
            v-for="s in signals.suggestions"
            :key="s.schoolId"
            class="flex items-start gap-2 rounded-lg bg-blue-50/50 p-2.5 text-sm text-slate-600"
            data-testid="mon-suggestion-item"
          >
            <ArrowRight class="mt-0.5 h-4 w-4 shrink-0 text-blue-400" />
            <span class="min-w-0 break-words">{{ suggestion(s) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
