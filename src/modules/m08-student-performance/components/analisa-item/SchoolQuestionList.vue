<script setup lang="ts">
/**
 * S9 "Soalan Paling Banyak Salah — Perlu Perhatian Khas" (FR-M08-142): the stored item-statistics
 * questions in rank order; the subject pills filter client-side (no request); a click on a card toggles
 * its detail ("Jawapan Betul", "Jawapan Salah Paling Popular", "Pelajar Yang Salah").
 */
import { DsPanel, DsStack, DsCluster, DsHeading, DsText } from '@/ds'
import { computed, ref } from 'vue'

import { formatNumber } from '@/lib/number'

import type { SchoolItemQuestion } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { LEVEL_BADGE, LEVEL_ICON } from '../../lib/prestasi/format'

import OptionCallout from './OptionCallout.vue'

const props = defineProps<{ questions: SchoolItemQuestion[] }>()

const icon = usePhIcon()
const subject = ref<string | null>(null)
const open = ref<ReadonlySet<number>>(new Set())

const subjects = computed(() => {
  const counts = new Map<string, number>()
  for (const q of props.questions) counts.set(q.subjectName, (counts.get(q.subjectName) ?? 0) + 1)
  // Live lists the subject pills alphabetically (AC-M08-20.3, discovery M18 S30).
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
})
const shown = computed(() =>
  subject.value === null
    ? props.questions
    : props.questions.filter((q) => q.subjectName === subject.value),
)

function toggle(id: number): void {
  const next = new Set(open.value)
  if (!next.delete(id)) next.add(id)
  open.value = next
}
</script>

<template>
  <DsStack as="section" data-testid="questions-card">
    <DsStack gap="2xs">
      <DsHeading :level="2" variant="subheading">
        Soalan Paling Banyak Salah — Perlu Perhatian Khas
      </DsHeading>
      <DsText variant="body" tone="muted">
        Soalan yang majoriti pelajar jawab salah. Fokuskan pengajaran khas di sini.
      </DsText>
    </DsStack>

    <div
      class="flex max-w-full items-center gap-2 overflow-x-auto pb-1"
      data-testid="question-filters"
    >
      <span class="flex shrink-0 items-center gap-1 text-label text-muted"
        ><UIcon :name="icon('funnel')" class="size-4" />Tapis:</span
      >
      <UButton
        type="button"
        size="lg"
        class="shrink-0 whitespace-nowrap"
        :color="subject === null ? 'primary' : 'neutral'"
        :variant="subject === null ? 'solid' : 'soft'"
        :aria-pressed="subject === null"
        :label="`Semua (${questions.length})`"
        data-testid="filter-all"
        @click="subject = null"
      />
      <UButton
        v-for="s in subjects"
        :key="s.name"
        type="button"
        size="lg"
        class="shrink-0 whitespace-nowrap"
        :color="subject === s.name ? 'primary' : 'neutral'"
        :variant="subject === s.name ? 'solid' : 'soft'"
        :aria-pressed="subject === s.name"
        :label="`${s.name} (${s.count})`"
        :data-testid="`filter-${s.name}`"
        @click="subject = s.name"
      />
    </div>

    <DsStack as="ul" gap="sm" data-testid="question-list">
      <li v-for="q in shown" :key="q.questionId" :data-testid="`question-${q.questionId}`">
        <DsPanel>
          <DsStack gap="sm">
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              class="h-auto min-h-11 w-full items-start justify-between text-start whitespace-normal"
              :trailing-icon="open.has(q.questionId) ? icon('caret-up') : icon('caret-down')"
              :aria-expanded="open.has(q.questionId)"
              :data-testid="`question-toggle-${q.questionId}`"
              @click="toggle(q.questionId)"
            >
              <span class="flex min-w-0 flex-col gap-2">
                <DsCluster as="span" gap="xs">
                  <DsText variant="label" tone="muted" tabular>#{{ q.rank }}</DsText>
                  <UBadge
                    :color="LEVEL_BADGE[q.level]"
                    variant="subtle"
                    :icon="icon(LEVEL_ICON[q.level])"
                    :label="q.level"
                  />
                </DsCluster>
                <DsText variant="label" tone="highlighted" wrap="anywhere">{{ q.stem }}</DsText>
                <DsCluster v-if="q.chips.length" as="span" gap="2xs" align="stretch">
                  <UBadge
                    v-for="(chip, i) in q.chips"
                    :key="i"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    :label="chip"
                  />
                </DsCluster>
                <span class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
                  <span class="text-error"
                    >{{ formatNumber(q.wrongPct, { decimals: 1 }) }}% salah</span
                  >
                  <span>{{ q.attempts }} pelajar cuba</span>
                  <span>{{ formatNumber(q.pupilsPct, { decimals: 1 }) }}% pelajar terlibat</span>
                </span>
                <DsText v-if="q.wrongPupils.length > 0" variant="caption" as="span" tone="primary">
                  {{ q.wrongPupils.length }} pelajar salah — klik untuk lihat
                </DsText>
              </span>
            </UButton>

            <DsStack
              v-if="open.has(q.questionId)"
              gap="sm"
              :data-testid="`question-detail-${q.questionId}`"
            >
              <OptionCallout
                variant="correct"
                title="Jawapan Betul"
                :letter="q.correctOption.letter"
                :text="q.correctOption.text"
              />
              <OptionCallout
                v-if="q.popularWrongOption"
                variant="wrong"
                :title="`Jawapan Salah Paling Popular (${q.popularWrongCount}x dipilih)`"
                :letter="q.popularWrongOption.letter"
                :text="q.popularWrongOption.text"
              />
              <DsStack v-if="q.wrongPupils.length > 0" gap="xs">
                <DsText variant="label" as="p" tone="highlighted">Pelajar Yang Salah</DsText>
                <DsCluster gap="xs" align="stretch">
                  <UButton
                    v-for="p in q.wrongPupils"
                    :key="p.userId"
                    :to="`/prestasi/${p.userId}`"
                    color="neutral"
                    variant="soft"
                    size="lg"
                    :icon="icon('user')"
                    :label="`${p.name} · ${p.classLabel} · ${p.wrongOption}`"
                  />
                </DsCluster>
              </DsStack>
            </DsStack>
          </DsStack>
        </DsPanel>
      </li>
    </DsStack>
  </DsStack>
</template>
