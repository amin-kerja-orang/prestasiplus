<script setup lang="ts">
/**
 * One chapter card of S5 (FR-M05-62…65, 132; BR-16). Open: teal number tile, title, stats line, bar
 * and four count links. Locked: 75 % opacity, slate tile with a lock, the same title / stats / bar
 * and the chip "Kunci bab sebelumnya". DV-M05-09: the title wraps (no `truncate`). DV-M05-15: the
 * count links are 44 px high below `lg`.
 */
import { Lock } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { ChapterCard } from '../../api/types'
import { CHAPTER_COUNTS, chapterQuizHref, chapterStats, progressWidth } from './chapter-lib'

const props = defineProps<{ code: string; chapter: ChapterCard }>()

const locked = computed(() => props.chapter.state === 'locked')
const title = computed(() =>
  props.chapter.number === null
    ? props.chapter.name
    : `Bab ${String(props.chapter.number)}: ${props.chapter.name}`,
)
</script>

<template>
  <div
    :class="[
      'rounded-3xl border bg-white p-5 shadow-sm',
      locked ? 'border-slate-100 opacity-75' : 'border-emerald-100',
    ]"
    :data-testid="`chapter-card-${String(chapter.id)}`"
    :data-state="chapter.state"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-3">
          <div
            :class="[
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl font-black',
              locked ? 'bg-slate-100 text-slate-400' : 'bg-teal-100 text-teal-700',
            ]"
            :data-testid="`chapter-tile-${String(chapter.id)}`"
          >
            <Lock v-if="locked" class="h-4 w-4" />
            <template v-else>{{ chapter.number }}</template>
          </div>
          <div class="min-w-0">
            <h3
              class="font-heading font-black break-words text-slate-900"
              :data-testid="`chapter-title-${String(chapter.id)}`"
            >
              {{ title }}
            </h3>
            <p
              class="mt-1 text-xs text-slate-500"
              :data-testid="`chapter-stats-${String(chapter.id)}`"
            >
              {{ chapterStats(chapter) }}
            </p>
          </div>
        </div>
        <div class="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
          <div
            class="h-full rounded-full bg-teal-500"
            :style="{ width: `${String(progressWidth(chapter))}%` }"
            :data-testid="`chapter-bar-${String(chapter.id)}`"
          ></div>
        </div>
      </div>

      <div class="flex flex-wrap gap-2 lg:justify-end">
        <span
          v-if="locked"
          class="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-500"
          :data-testid="`chapter-locked-${String(chapter.id)}`"
          >Kunci bab sebelumnya</span
        >
        <template v-else>
          <RouterLink
            v-for="n in CHAPTER_COUNTS"
            :key="n"
            :to="chapterQuizHref(code, chapter.id, n)"
            class="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-emerald-700 max-lg:min-h-11"
            :data-testid="`chapter-count-${String(chapter.id)}-${String(n)}`"
          >
            {{ n }} soalan
          </RouterLink>
        </template>
      </div>
    </div>
  </div>
</template>
