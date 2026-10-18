<script setup lang="ts">
/**
 * Class card of S10 (FR-M08-63) and the populated S4 picker (FR-M08-30, PROPOSED: the S10 pattern):
 * AR-HUB choice card with an icon chip, the name, the muted counts and the action text.
 */
import { DsIconChip, DsPanel, DsStatusBadge } from '@/ds'
import { RouterLink } from 'vue-router'

import type { ClassCard } from '../../api/types'
import { usePhIcon } from '../../lib/icons'

defineProps<{ item: ClassCard; to: string; action: string }>()

const icon = usePhIcon()
</script>

<template>
  <RouterLink :to="to" class="block min-w-0" :data-testid="`class-card-${item.id}`">
    <DsPanel class="h-full">
      <div class="flex items-center gap-3">
        <DsIconChip :icon="icon('chalkboard')" />
        <div class="flex min-w-0 grow flex-col gap-1">
          <span class="flex flex-wrap items-center gap-2 text-label text-highlighted">
            <span class="min-w-0 break-words">{{ item.name }}</span>
            <DsStatusBadge v-if="item.isActive" status="active" size="sm" label="Aktif" />
          </span>
          <span v-if="item.subjectName" class="text-caption text-muted">{{
            item.subjectName
          }}</span>
          <span class="tabular text-caption text-muted"
            >{{ item.students }} pelajar · {{ item.year }} · {{ item.joinCode }}</span
          >
          <span class="text-label text-primary">{{ action }}</span>
        </div>
        <UIcon :name="icon('caret-right')" class="size-5 shrink-0 text-dimmed" />
      </div>
    </DsPanel>
  </RouterLink>
</template>
