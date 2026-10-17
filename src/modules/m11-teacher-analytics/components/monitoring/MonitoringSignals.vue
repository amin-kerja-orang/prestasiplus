<script setup lang="ts">
/**
 * S2 "Sekolah Terbaik", "Perhatian Segera" and "Cadangan Tindakan", `#section-perhatian`
 * (FN-M11-3.7.1..3.7.4; FR-M11-45..48). The three lists come from `signals` of #3; when all are empty
 * the section is one card.
 */
import { computed } from 'vue'

import type { MonitoringOverview, Signal } from '../../api/types'
import { count, pct } from './monitoring-format'

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

const H = 'flex items-center gap-2 text-label text-highlighted'
</script>

<template>
  <section id="section-perhatian" data-testid="mon-signals">
    <UCard v-if="empty" data-testid="mon-signals-empty">
      <p class="text-center text-body text-muted">
        Tiada pemerhatian yang perlu diberi perhatian buat masa ini.
      </p>
    </UCard>
    <div v-else class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UCard v-if="signals.best.length > 0" class="min-w-0" data-testid="mon-best">
        <div class="flex flex-col gap-3">
          <h2 :class="H">
            <UIcon name="i-ph-trophy" class="size-5 text-success" />Sekolah Terbaik
          </h2>
          <ul class="flex flex-col gap-2 text-body text-default">
            <li
              v-for="s in signals.best"
              :key="s.schoolId"
              class="flex items-start gap-2"
              data-testid="mon-best-item"
            >
              <UIcon name="i-ph-star" class="mt-1 size-4 shrink-0 text-success" />
              <span class="min-w-0 break-words"
                >{{ s.name }} — {{ pct(s.pct) }} penglibatan ({{ count(s.engaged) }}/{{
                  count(s.registered)
                }}
                pelajar aktif)</span
              >
            </li>
          </ul>
        </div>
      </UCard>
      <UCard v-if="signals.attention.length > 0" class="min-w-0" data-testid="mon-attention">
        <div class="flex flex-col gap-3">
          <h2 :class="H">
            <UIcon name="i-ph-warning" class="size-5 text-error" />Perhatian Segera
          </h2>
          <ul class="flex flex-col gap-2 text-body text-default">
            <li
              v-for="s in signals.attention"
              :key="s.schoolId"
              class="flex items-start gap-2"
              data-testid="mon-attention-item"
            >
              <UIcon name="i-ph-warning-circle" class="mt-1 size-4 shrink-0 text-error" />
              <span class="min-w-0 break-words">{{ attention(s) }}</span>
            </li>
          </ul>
        </div>
      </UCard>
      <UCard
        v-if="signals.suggestions.length > 0"
        class="min-w-0 lg:col-span-2"
        data-testid="mon-suggestions"
      >
        <div class="flex flex-col gap-3">
          <h2 :class="H">
            <UIcon name="i-ph-lightbulb" class="size-5 text-info" />Cadangan Tindakan
          </h2>
          <ul class="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li
              v-for="s in signals.suggestions"
              :key="s.schoolId"
              class="flex items-start gap-2 bg-soft p-3 text-body text-default"
              data-testid="mon-suggestion-item"
            >
              <UIcon name="i-ph-arrow-right" class="mt-1 size-4 shrink-0 text-info" />
              <span class="min-w-0 break-words">{{ suggestion(s) }}</span>
            </li>
          </ul>
        </div>
      </UCard>
    </div>
  </section>
</template>
