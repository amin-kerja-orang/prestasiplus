<script setup lang="ts">
/**
 * S9 "Soalan Paling Banyak Salah — Perlu Perhatian Khas" (FR-M08-142): the stored item-statistics
 * questions in rank order; the subject pills filter client-side (no request); a click on a card toggles
 * its detail ("Jawapan Betul", "Jawapan Salah Paling Popular", "Pelajar Yang Salah").
 */
import { DsPanel } from '@/ds'
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
  <section class="flex min-w-0 flex-col gap-4" data-testid="questions-card">
    <div class="flex flex-col gap-1">
      <h2 class="text-subheading text-highlighted">
        Soalan Paling Banyak Salah — Perlu Perhatian Khas
      </h2>
      <p class="text-body text-muted">
        Soalan yang majoriti pelajar jawab salah. Fokuskan pengajaran khas di sini.
      </p>
    </div>

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

    <ul class="flex flex-col gap-3" data-testid="question-list">
      <li v-for="q in shown" :key="q.questionId" :data-testid="`question-${q.questionId}`">
        <DsPanel>
          <div class="flex min-w-0 flex-col gap-3">
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
                <span class="flex flex-wrap items-center gap-2">
                  <span class="tabular text-label text-muted">#{{ q.rank }}</span>
                  <UBadge
                    :color="LEVEL_BADGE[q.level]"
                    variant="subtle"
                    :icon="icon(LEVEL_ICON[q.level])"
                    :label="q.level"
                  />
                </span>
                <span class="text-label break-words text-highlighted">{{ q.stem }}</span>
                <span v-if="q.chips.length" class="flex flex-wrap gap-1">
                  <UBadge
                    v-for="(chip, i) in q.chips"
                    :key="i"
                    color="neutral"
                    variant="subtle"
                    size="sm"
                    :label="chip"
                  />
                </span>
                <span class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
                  <span class="text-error"
                    >{{ formatNumber(q.wrongPct, { decimals: 1 }) }}% salah</span
                  >
                  <span>{{ q.attempts }} pelajar cuba</span>
                  <span>{{ formatNumber(q.pupilsPct, { decimals: 1 }) }}% pelajar terlibat</span>
                </span>
                <span v-if="q.wrongPupils.length > 0" class="text-caption text-primary">
                  {{ q.wrongPupils.length }} pelajar salah — klik untuk lihat
                </span>
              </span>
            </UButton>

            <div
              v-if="open.has(q.questionId)"
              class="flex min-w-0 flex-col gap-3"
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
              <div v-if="q.wrongPupils.length > 0" class="flex flex-col gap-2">
                <p class="text-label text-highlighted">Pelajar Yang Salah</p>
                <div class="flex flex-wrap gap-2">
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
                </div>
              </div>
            </div>
          </div>
        </DsPanel>
      </li>
    </ul>
  </section>
</template>
