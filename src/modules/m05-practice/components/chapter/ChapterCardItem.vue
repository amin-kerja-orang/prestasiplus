<script setup lang="ts">
/**
 * One chapter card of S5 (FR-M05-62…65, 132; BR-16), restyled for v2. Open: number chip (A1), title,
 * stats line, mastery bar and four count links. Locked: dimmed, a lock chip, the same title / stats /
 * bar and the chip "Kunci bab sebelumnya". DV-M05-09: the title wraps (no `truncate`). DV-M05-15: the
 * count links are 44 px high.
 */
import { computed } from 'vue'

import { DsIconChip } from '@/ds'

import type { ChapterCard } from '../../api/types'
import { CHAPTER_COUNTS, chapterQuizHref, chapterStats, progressWidth } from './chapter-lib'

const props = defineProps<{ code: string; chapter: ChapterCard }>()

// V2 (REQ-A-005, S-65): a chapter with no question is a locked chip "Tiada soalan", never a start link.
const empty = computed(() => props.chapter.total <= 0)
const locked = computed(() => props.chapter.state === 'locked')
const title = computed(() =>
  props.chapter.number === null
    ? props.chapter.name
    : `Bab ${String(props.chapter.number)}: ${props.chapter.name}`,
)
const progress = computed(() => progressWidth(props.chapter))
</script>

<template>
  <UCard
    :data-testid="`chapter-card-${String(chapter.id)}`"
    :data-state="chapter.state"
  >
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex min-w-0 flex-1 flex-col gap-3">
        <div class="flex items-center gap-3">
          <DsIconChip
            v-if="locked"
            icon="i-ph-lock-duotone"
            size="lg"
            :data-testid="`chapter-tile-${String(chapter.id)}`"
          />
          <UBadge
            v-else
            color="primary"
            variant="solid"
            size="xl"
            :data-testid="`chapter-tile-${String(chapter.id)}`"
            >{{ chapter.number }}</UBadge
          >
          <div class="flex min-w-0 flex-col gap-1">
            <h3
              class="text-subheading break-words text-highlighted"
              :data-testid="`chapter-title-${String(chapter.id)}`"
            >
              {{ title }}
            </h3>
            <p class="text-caption text-muted" :data-testid="`chapter-stats-${String(chapter.id)}`">
              {{ chapterStats(chapter) }}
            </p>
          </div>
        </div>
        <UProgress
          :model-value="progress"
          :max="100"
          :aria-label="`Kemajuan bab ${progress}%`"
          :data-testid="`chapter-bar-${String(chapter.id)}`"
        />
      </div>

      <div class="flex flex-wrap gap-2 lg:justify-end">
        <UBadge
          v-if="empty"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-lock-bold"
          :title="`Belum ada soalan untuk ${chapter.name}`"
          :data-testid="`chapter-empty-${String(chapter.id)}`"
          >Tiada soalan</UBadge
        >
        <UBadge
          v-else-if="locked"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-lock-bold"
          :data-testid="`chapter-locked-${String(chapter.id)}`"
          >Kunci bab sebelumnya</UBadge
        >
        <template v-else>
          <UButton
            v-for="n in CHAPTER_COUNTS"
            :key="n"
            :to="chapterQuizHref(code, chapter.id, n)"
            class="min-h-11"
            :data-testid="`chapter-count-${String(chapter.id)}-${String(n)}`"
          >
            {{ n }} soalan
          </UButton>
        </template>
      </div>
    </div>
  </UCard>
</template>
