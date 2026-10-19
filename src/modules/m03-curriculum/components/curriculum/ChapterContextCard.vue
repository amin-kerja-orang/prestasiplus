<script setup lang="ts">
/** S4/S5 chapter context card (FR-M03-32): tile, label "Bab", heading "Bab {n}: {name}", subject and level chips. */
import { DsIconChip } from '@/ds'

import type { ChapterDetail } from '../../api/admin-curriculum'
import { chapterHeading } from '../../lib/curriculum-paths'

defineProps<{ chapter: ChapterDetail }>()

</script>

<template>
  <UCard data-testid="chapter-context">
    <div class="flex items-start gap-3">
      <DsIconChip icon="book-open" size="lg" />
      <div class="min-w-0 flex-1">
        <p class="text-overline text-muted">Bab</p>
        <h2 class="text-subheading break-words text-highlighted">
          {{ chapterHeading(chapter) }}
        </h2>
        <div class="mt-2 flex flex-wrap gap-2">
          <UBadge
            color="neutral"
            variant="subtle"
            icon="i-ph-book"
            :label="chapter.subject.name"
            data-testid="context-subject"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            icon="i-ph-graduation-cap"
            :label="chapter.level.name"
            data-testid="context-level"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
