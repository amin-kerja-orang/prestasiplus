<script setup lang="ts">
/**
 * S4 `/practice/chapter` "Soalan by Chapter" (M05-T5; FR-M05-57, 58, BR-15; roles-matrix L14 for
 * Murid and Guru: there is no role rule), restyled for v2 (AR-HUB, batch B01). Title block with
 * "Latih Tubi Rawak" and one card per chapter subject (#7; grid 1 / `md` 2 / `xl` 3) linking to S5.
 * DV-M05-15: "Latih Tubi Rawak" is 44 px high below `lg`.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { DsIconChip } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchChapterSubjects } from '../api/practice'
import LoadError from '../components/quiz/LoadError.vue'
import { subjectGlyph } from '../components/quiz/subject-glyph'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchChapterSubjects({ signal }))
const subjects = computed(() => data.value?.data ?? [])
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="chapter-index-page">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between" data-testid="chapter-hero">
      <div class="flex min-w-0 flex-col gap-1">
        <p class="text-overline text-primary">Mode Sistematik</p>
        <h1 class="text-title text-highlighted">Soalan by Chapter</h1>
        <p class="max-w-prose text-body text-muted">
          Pelajar jawab bab demi bab. Bab seterusnya hanya terbuka selepas bab sebelumnya lengkap
          dan mencapai sekurang-kurangnya 70%.
        </p>
      </div>
      <UButton
        to="/practice"
        color="neutral"
        variant="soft"
        icon="i-ph-shuffle-duotone"
        class="min-h-11 self-start sm:self-auto"
        data-testid="chapter-random"
        >Latih Tubi Rawak</UButton
      >
    </div>

    <ul
      v-if="data"
      class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3"
      data-testid="chapter-subject-grid"
    >
      <li v-for="s in subjects" :key="s.code" class="min-w-0">
        <RouterLink
          :to="`/practice/chapter/${s.code}`"
          class="block h-full"
          :data-testid="`chapter-subject-${s.code}`"
        >
          <UCard class="h-full">
            <div class="flex items-center gap-4">
              <DsIconChip
                :icon="subjectGlyph(s.icon)"
                size="lg"
                data-testid="chapter-subject-icon"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <h2
                  class="truncate text-subheading text-highlighted"
                  data-testid="chapter-subject-name"
                >
                  {{ s.name }}
                </h2>
                <p class="text-caption text-muted" data-testid="chapter-subject-chapters">
                  {{ s.chapterCount }} bab tersedia
                </p>
                <p class="text-label text-primary" data-testid="chapter-subject-questions">
                  {{ formatCount(s.questionCount) }} soalan chapter
                </p>
              </div>
              <UIcon name="i-ph-caret-right-bold" class="size-5 shrink-0 text-muted" aria-hidden="true" />
            </div>
          </UCard>
        </RouterLink>
      </li>
    </ul>

    <LoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="chapter-retry"
      data-testid="chapter-error"
      @retry="reload()"
    />
  </div>
</template>
