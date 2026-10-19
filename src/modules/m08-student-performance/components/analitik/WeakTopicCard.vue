<script setup lang="ts">
/**
 * One weak-SP card of S7 (FR-M08-45, FR-M08-47): the accuracy badge, "{code} — {title}" cut at `max`
 * characters, "{Subjek} · {n} soalan dijawab" and the full-width "Latihan Fokus ({k} soalan)" link
 * (k = min(available, 25) in label and link, DV-M08-14). The top block also shows the trend icon.
 */
import { DsPanel, DsStack, DsCluster, DsText } from '@/ds'
import type { Trend, WeakSp } from '../../api/types'
import { TREND_ICON, TREND_TEXT, focusHref, weakTitle } from '../../lib/analitik'
import { usePhIcon } from '../../lib/icons'

const props = defineProps<{
  sp: WeakSp
  max: number
  levelId: number | null
  trend?: Trend
}>()

const icon = usePhIcon()

const href = (): string =>
  focusHref({
    subjectCode: props.sp.subjectCode,
    spId: props.sp.spId,
    count: Math.min(props.sp.available, 25),
    levelId: props.levelId,
  })
const TREND_LABEL: Record<Trend, string> = {
  up: 'Naik',
  down: 'Turun',
  stable: 'Tetap',
}
</script>

<template>
  <DsPanel class="h-full min-w-0" :data-testid="`weak-card-${sp.spId}`">
    <DsStack gap="sm" class="h-full">
      <DsCluster gap="xs" justify="between" :wrap="false">
        <UBadge color="warning" variant="subtle" size="lg" :label="`${sp.accuracy}%`" />
        <template v-if="trend">
          <span :class="TREND_TEXT[trend]" :data-testid="`trend-${trend}`">
            <UIcon
              :name="icon(TREND_ICON[trend])"
              class="size-5"
              role="img"
              :aria-label="TREND_LABEL[trend]"
            />
          </span>
        </template>
      </DsCluster>
      <DsText variant="label" as="p" tone="highlighted" wrap="anywhere">{{
        weakTitle(sp, max)
      }}</DsText>
      <DsText variant="caption">{{ sp.subjectName }} · {{ sp.answered }} soalan dijawab</DsText>
      <UButton
        :to="href()"
        block
        size="lg"
        class="mt-auto"
        :icon="icon('barbell')"
        :label="`Latihan Fokus (${Math.min(sp.available, 25)} soalan)`"
        data-testid="focus-link"
      />
    </DsStack>
  </DsPanel>
</template>
