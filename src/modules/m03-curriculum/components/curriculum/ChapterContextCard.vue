<script setup lang="ts">
/** S4/S5 chapter context card (FR-M03-32): tile, label "Bab", heading "Bab {n}: {name}", subject and level chips. */
import { DsIconChip, DsCluster, DsText, DsHeading } from '@/ds'

import type { ChapterDetail } from '../../api/admin-curriculum'
import { chapterHeading } from '../../lib/curriculum-paths'

defineProps<{ chapter: ChapterDetail }>()
</script>

<template>
  <UCard data-testid="chapter-context">
    <DsCluster align="start" :wrap="false">
      <DsIconChip icon="book-open" size="lg" />
      <div class="min-w-0 flex-1">
        <DsText variant="overline" as="p">Bab</DsText>
        <DsHeading :level="2" variant="subheading" wrap="anywhere">
          {{ chapterHeading(chapter) }}
        </DsHeading>
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
    </DsCluster>
  </UCard>
</template>
