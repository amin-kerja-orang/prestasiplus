<script setup lang="ts">
/**
 * S6 "Headcount — Prestasi SPM" (FR-M08-39): one card per config, newest update first. The status badge by
 * BR-M08-08 rule (1), the chip row TOV → OTRn (AR chips only) → ETR joined by chevrons; the row wraps
 * on narrow screens (DV-M08-10). "Lihat Penuh" → `/headcount/student/{id}`.
 */
import { DsPanel, DsStack, DsGrid, DsCluster, DsHeading, DsText } from '@/ds'
import type { StudentPerformance } from '../../api/types'
import { usePhIcon } from '../../lib/icons'

defineProps<{ userId: number; cards: StudentPerformance['headcount'] }>()

type Card = StudentPerformance['headcount'][number]
type Chip = Card['chips'][number]

const icon = usePhIcon()

const STATUS: Record<Card['status'], { text: string; color: 'success' | 'error' | 'neutral' }> = {
  on: { text: 'On Track', color: 'success' },
  below: { text: 'Below', color: 'error' },
  none: { text: '—', color: 'neutral' },
}

/** TOV and ETR are neutral; OTR chips are success (AR ≥ target) or error (below, or no target). */
function chipColor(chip: Chip): 'neutral' | 'success' | 'error' {
  if (chip.label === 'TOV' || chip.label === 'ETR') return 'neutral'
  return chip.tone === 'on' ? 'success' : 'error'
}

const chipText = (chip: Chip): string =>
  `${chip.label}: ${chip.value === null ? '—' : `${String(Math.round(chip.value))}%`}`
</script>

<template>
  <DsPanel data-testid="headcount-block">
    <DsStack>
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon :name="icon('chart-line-up')" class="size-5 text-primary-t" />Headcount — Prestasi
        SPM
      </h2>
      <DsGrid :cols="{ base: 1, lg: 2 }" gap="sm">
        <article
          v-for="c in cards"
          :key="c.configId"
          class="flex min-w-0 flex-col gap-3 bg-soft p-4"
          :data-testid="`headcount-${c.configId}`"
        >
          <DsCluster gap="xs" align="start" justify="between" :wrap="false">
            <DsStack gap="none">
              <DsHeading :level="3" variant="label" wrap="anywhere">{{ c.subject }}</DsHeading>
              <DsText variant="caption">{{ c.className }} · {{ c.year }}</DsText>
            </DsStack>
            <UBadge
              :color="STATUS[c.status].color"
              variant="subtle"
              :label="STATUS[c.status].text"
              data-testid="status-pill"
            />
          </DsCluster>
          <DsCluster gap="2xs" data-testid="chip-row">
            <template v-for="(chip, i) in c.chips" :key="chip.label">
              <UIcon v-if="i > 0" :name="icon('caret-right')" class="size-4 shrink-0 text-dimmed" />
              <UBadge
                :color="chipColor(chip)"
                variant="subtle"
                :label="chipText(chip)"
                data-testid="chip"
              />
            </template>
          </DsCluster>
          <UButton
            :to="`/headcount/student/${String(userId)}`"
            color="neutral"
            variant="link"
            class="min-h-11 self-start"
            :icon="icon('arrow-square-out')"
            label="Lihat Penuh"
          />
        </article>
      </DsGrid>
    </DsStack>
  </DsPanel>
</template>
