<script setup lang="ts">
/**
 * Class card of S10 (FR-M08-63) and the populated S4 picker (FR-M08-30, PROPOSED: the S10 pattern):
 * AR-HUB choice card with an icon chip, the name, the muted counts and the action text.
 */
import { DsIconChip, DsPanel, DsStatusBadge, DsCluster, DsStack, DsText } from '@/ds'
import { RouterLink } from 'vue-router'

import type { ClassCard } from '../../api/types'
import { usePhIcon } from '../../lib/icons'

defineProps<{ item: ClassCard; to: string; action: string }>()

const icon = usePhIcon()
</script>

<template>
  <RouterLink :to="to" class="block min-w-0" :data-testid="`class-card-${item.id}`">
    <DsPanel class="h-full">
      <DsCluster :wrap="false">
        <DsIconChip :icon="icon('chalkboard')" />
        <DsStack gap="2xs" class="grow">
          <span class="flex flex-wrap items-center gap-2 text-label text-highlighted">
            <span class="min-w-0 break-words">{{ item.name }}</span>
            <DsStatusBadge v-if="item.isActive" status="active" size="sm" label="Aktif" />
          </span>
          <DsText v-if="item.subjectName" variant="caption" as="span">{{
            item.subjectName
          }}</DsText>
          <DsText variant="caption" as="span" tabular
            >{{ item.students }} pelajar · {{ item.year }} · {{ item.joinCode }}</DsText
          >
          <DsText variant="label" tone="primary">{{ action }}</DsText>
        </DsStack>
        <UIcon :name="icon('caret-right')" class="size-5 shrink-0 text-dimmed" />
      </DsCluster>
    </DsPanel>
  </RouterLink>
</template>
