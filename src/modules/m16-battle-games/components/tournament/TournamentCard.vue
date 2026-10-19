<script setup lang="ts">
/** One PROPOSED S23 card (FN-M16-8.1.3): the trophy, the title and the banner line, linking to the detail. */
import { RouterLink } from 'vue-router'

import { DsArt3D, DsText } from '@/ds'

import type { TournamentListItem } from '../../api'
import { STATUS_LINE } from './copy'

defineProps<{ item: TournamentListItem }>()
</script>

<template>
  <RouterLink
    :to="`/tournament/${item.uuid}`"
    class="flex min-h-14 items-center gap-3 rounded-card bg-default p-3 learner:shadow-lift"
    data-testid="tournament-card"
  >
    <DsArt3D name="trophy" size="lg" />
    <span class="min-w-0 flex-1">
      <DsText
        variant="label"
        tone="highlighted"
        truncate
        class="block"
        data-testid="tournament-title"
      >
        {{ item.title }}
      </DsText>
      <DsText variant="caption" as="span" class="block" data-testid="tournament-line">
        {{ STATUS_LINE[item.status] }}
      </DsText>
    </span>
    <UIcon name="i-ph-caret-right-bold" class="size-5 shrink-0 text-muted" aria-hidden="true" />
  </RouterLink>
</template>
