<script setup lang="ts">
/**
 * One weak-SP card of S7 (FR-M08-45, FR-M08-47): the accuracy pill, "{code} — {title}" cut at `max`
 * characters, "{Subjek} · {n} soalan dijawab" and the full-width "Latihan Fokus ({k} soalan)" link
 * (k = min(available, 25) in label and link, DV-M08-14). The top block also shows the trend icon.
 */
import { ArrowDown, ArrowUp, Dumbbell, Minus } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { Trend, WeakSp } from '../../api/types'
import { TREND_TEXT, focusHref, weakTitle } from '../../lib/analitik'

const props = defineProps<{
  sp: WeakSp
  max: number
  levelId: number | null
  trend?: Trend
}>()

const href = (): string =>
  focusHref({
    subjectCode: props.sp.subjectCode,
    spId: props.sp.spId,
    count: Math.min(props.sp.available, 25),
    levelId: props.levelId,
  })
</script>

<template>
  <article
    class="flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-4 shadow"
    :data-testid="`weak-card-${sp.spId}`"
  >
    <div class="flex items-center justify-between gap-2">
      <span class="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700"
        >{{ sp.accuracy }}%</span
      >
      <template v-if="trend">
        <ArrowUp v-if="trend === 'up'" :class="['h-4 w-4', TREND_TEXT.up]" data-testid="trend-up" />
        <ArrowDown
          v-else-if="trend === 'down'"
          :class="['h-4 w-4', TREND_TEXT.down]"
          data-testid="trend-down"
        />
        <Minus v-else :class="['h-4 w-4', TREND_TEXT.stable]" data-testid="trend-stable" />
      </template>
    </div>
    <p class="text-sm font-semibold break-words text-slate-800">{{ weakTitle(sp, max) }}</p>
    <p class="text-xs text-slate-400">{{ sp.subjectName }} · {{ sp.answered }} soalan dijawab</p>
    <RouterLink
      :to="href()"
      class="mt-auto flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-blue-700"
      data-testid="focus-link"
    >
      <Dumbbell class="h-4 w-4 shrink-0" />
      <span>Latihan Fokus ({{ Math.min(sp.available, 25) }} soalan)</span>
    </RouterLink>
  </article>
</template>
