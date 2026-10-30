<script setup lang="ts">
/**
 * S2 "Sekolah Terbaik", "Perhatian Segera" and "Cadangan Tindakan", `#section-perhatian`
 * (FN-M11-3.7.1..3.7.4; FR-M11-45..48). The three lists come from `signals` of #3. `part` picks the tab:
 * "perhatian" (best + attention) or "cadangan" (suggestions). Long lists show the first rows and expand.
 */
import { computed, ref } from 'vue'

import { DsBadge, DsEmptyState, DsPanel } from '@/ds'

import type { MonitoringOverview, Signal } from '../../api/types'
import { count, pct } from './monitoring-format'

const props = defineProps<{
  signals: MonitoringOverview['signals']
  part: 'perhatian' | 'cadangan'
}>()

const empty = computed(() =>
  props.part === 'cadangan'
    ? props.signals.suggestions.length === 0
    : props.signals.best.length === 0 && props.signals.attention.length === 0,
)

const LIMIT = 6
const open = ref({ best: false, attention: false, suggestions: false })
function shown<T>(list: readonly T[], key: keyof typeof open.value): readonly T[] {
  return open.value[key] ? list : list.slice(0, LIMIT)
}

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
</script>

<template>
  <section
    :id="part === 'cadangan' ? 'section-cadangan' : 'section-perhatian'"
    data-testid="mon-signals"
  >
    <DsPanel v-if="empty" data-testid="mon-signals-empty">
      <DsEmptyState
        size="sm"
        icon="check-circle"
        title="Tiada pemerhatian yang perlu diberi perhatian buat masa ini."
      />
    </DsPanel>
    <div v-else-if="part === 'perhatian'" class="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
      <DsPanel
        v-if="signals.best.length > 0"
        title="Sekolah Terbaik"
        icon="trophy"
        accent="win"
        data-testid="mon-best"
      >
        <template #actions>
          <DsBadge tone="success" class="tabular" :label="count(signals.best.length)" />
        </template>
        <div class="flex flex-col gap-4">
          <ul class="flex flex-col gap-3 text-body text-default">
            <li
              v-for="s in shown(signals.best, 'best')"
              :key="s.schoolId"
              class="flex items-start gap-3"
              data-testid="mon-best-item"
            >
              <UIcon name="i-ph-star" class="mt-1 size-5 shrink-0 text-success" />
              <span class="min-w-0 break-words"
                >{{ s.name }} — {{ pct(s.pct) }} penglibatan ({{ count(s.engaged) }}/{{
                  count(s.registered)
                }}
                pelajar aktif)</span
              >
            </li>
          </ul>
          <UButton
            v-if="signals.best.length > LIMIT"
            type="button"
            color="neutral"
            variant="soft"
            size="md"
            class="self-start"
            :label="open.best ? 'Tunjuk kurang' : `Tunjuk semua (${count(signals.best.length)})`"
            @click="open.best = !open.best"
          />
        </div>
      </DsPanel>
      <DsPanel
        v-if="signals.attention.length > 0"
        title="Perhatian Segera"
        icon="warning"
        accent="heat"
        data-testid="mon-attention"
      >
        <template #actions>
          <DsBadge tone="error" class="tabular" :label="count(signals.attention.length)" />
        </template>
        <div class="flex flex-col gap-4">
          <ul class="flex flex-col gap-3 text-body text-default">
            <li
              v-for="s in shown(signals.attention, 'attention')"
              :key="s.schoolId"
              class="flex items-start gap-3"
              data-testid="mon-attention-item"
            >
              <UIcon name="i-ph-warning-circle" class="mt-1 size-5 shrink-0 text-error" />
              <span class="min-w-0 break-words">{{ attention(s) }}</span>
            </li>
          </ul>
          <UButton
            v-if="signals.attention.length > LIMIT"
            type="button"
            color="neutral"
            variant="soft"
            size="md"
            class="self-start"
            :label="
              open.attention ? 'Tunjuk kurang' : `Tunjuk semua (${count(signals.attention.length)})`
            "
            @click="open.attention = !open.attention"
          />
        </div>
      </DsPanel>
    </div>
    <DsPanel
      v-else
      title="Cadangan Tindakan"
      icon="lightbulb"
      accent="friend"
      data-testid="mon-suggestions"
    >
      <template #actions>
        <DsBadge tone="info" class="tabular" :label="count(signals.suggestions.length)" />
      </template>
      <div class="flex flex-col gap-4">
        <ul class="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <li
            v-for="s in shown(signals.suggestions, 'suggestions')"
            :key="s.schoolId"
            class="flex items-start gap-3 text-body text-default"
            data-testid="mon-suggestion-item"
          >
            <UIcon name="i-ph-arrow-right" class="mt-1 size-5 shrink-0 text-info" />
            <span class="min-w-0 break-words">{{ suggestion(s) }}</span>
          </li>
        </ul>
        <UButton
          v-if="signals.suggestions.length > LIMIT"
          type="button"
          color="neutral"
          variant="soft"
          size="md"
          class="self-start"
          :label="
            open.suggestions
              ? 'Tunjuk kurang'
              : `Tunjuk semua (${count(signals.suggestions.length)})`
          "
          @click="open.suggestions = !open.suggestions"
        />
      </div>
    </DsPanel>
  </section>
</template>
