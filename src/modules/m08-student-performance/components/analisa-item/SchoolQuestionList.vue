<script setup lang="ts">
/**
 * S9 "Soalan Paling Banyak Salah — Perlu Perhatian Khas" (FR-M08-142): the stored item-statistics
 * questions; the subject pills filter client-side (no request); a click on a card toggles its detail
 * ("Jawapan Betul", "Jawapan Salah Paling Popular", "Pelajar Yang Salah"). R1-AS-6: "Cari soalan..." (from 2
 * characters) and the sort select "Susun" (default "Paling Sukar Dahulu" = the stored rank), both kept in the
 * query string (`q`, `susun`); 25 per page. The school payload has no discrimination, so the two class tabs are
 * not offered here.
 */
import { DsCluster, DsPanel, DsText } from '@/ds'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { SchoolItemQuestion } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { LEVEL_BADGE, LEVEL_ICON, pctWhole } from '../../lib/prestasi/format'
import {
  DEFAULT_SORT,
  SEARCH_MIN,
  SEARCH_TOO_SHORT,
  SORT_OPTIONS,
  parseSort,
  searchTooShort,
  type SortKey,
} from '../../lib/prestasi/item-analysis'

import OptionCallout from './OptionCallout.vue'

const props = defineProps<{ questions: SchoolItemQuestion[] }>()

const PAGE_SIZE = 25
const icon = usePhIcon()
const route = useRoute()
const router = useRouter()
const subject = ref<string | null>(null)
const open = ref<ReadonlySet<number>>(new Set())
const page = ref(1)

const search = ref(typeof route.query.q === 'string' ? route.query.q : '')
const sort = ref<SortKey>(parseSort(route.query.susun))
watch([search, sort, subject], () => {
  page.value = 1
})
watch([search, sort], () => {
  const q = search.value.trim() === '' ? undefined : search.value
  const susun = sort.value === DEFAULT_SORT ? undefined : sort.value
  void router.replace({ query: { ...route.query, q, susun } })
})
const tooShort = computed(() => searchTooShort(search.value))

/** Ketepatan of the stored row (100 − % salah); the order of the others follows the same figures. */
const accuracyOf = (q: SchoolItemQuestion): number => 100 - q.wrongPct
const SORTERS: Record<SortKey, (a: SchoolItemQuestion, b: SchoolItemQuestion) => number> = {
  difficulty_desc: (a, b) => a.rank - b.rank,
  difficulty_asc: (a, b) => b.rank - a.rank,
  accuracy_asc: (a, b) => accuracyOf(a) - accuracyOf(b),
  accuracy_desc: (a, b) => accuracyOf(b) - accuracyOf(a),
  attempts_desc: (a, b) => b.attempts - a.attempts,
}

const subjects = computed(() => {
  const counts = new Map<string, number>()
  for (const q of props.questions) counts.set(q.subjectName, (counts.get(q.subjectName) ?? 0) + 1)
  // Live lists the subject pills alphabetically (AC-M08-20.3, discovery M18 S30).
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
})
const found = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const bySubject =
    subject.value === null
      ? props.questions
      : props.questions.filter((q) => q.subjectName === subject.value)
  const matched =
    needle.length < SEARCH_MIN
      ? bySubject
      : bySubject.filter((q) => q.stem.toLowerCase().includes(needle))
  const sorter = SORTERS[sort.value]
  return [...matched].sort((a, b) => sorter(a, b) || a.questionId - b.questionId)
})
const pages = computed(() => Math.max(1, Math.ceil(found.value.length / PAGE_SIZE)))
const shown = computed(() => {
  const from = (Math.min(page.value, pages.value) - 1) * PAGE_SIZE
  return found.value.slice(from, from + PAGE_SIZE)
})

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

    <DsCluster align="start" data-testid="question-search-bar">
      <UInput
        v-model="search"
        type="text"
        placeholder="Cari soalan..."
        aria-label="Cari soalan"
        size="lg"
        class="w-full sm:w-72"
        :color="tooShort ? 'error' : undefined"
        :aria-invalid="tooShort"
        aria-describedby="question-search-hint"
        data-testid="question-search"
      />
      <USelect
        v-model="sort"
        :items="[...SORT_OPTIONS]"
        aria-label="Susunan soalan"
        size="lg"
        class="w-full sm:w-64"
        data-testid="question-sort"
      />
      <DsText
        v-if="tooShort"
        id="question-search-hint"
        variant="caption"
        tone="error"
        role="status"
        class="w-full"
        data-testid="question-search-hint"
      >
        {{ SEARCH_TOO_SHORT }}
      </DsText>
    </DsCluster>

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
                  <span class="text-error">{{ pctWhole(q.wrongPct) }} salah</span>
                  <span>{{ q.attempts }} pelajar cuba</span>
                  <span>{{ pctWhole(q.pupilsPct) }} pelajar terlibat</span>
                </span>
                <span v-if="q.wrongPupils.length > 0" class="text-caption text-primary-t">
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
                :letter="q.correctOption?.letter ?? null"
                :text="q.correctOption?.text ?? ''"
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

    <DsCluster
      v-if="pages > 1"
      as="nav"
      justify="between"
      aria-label="Halaman"
      data-testid="question-pager"
    >
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        size="lg"
        class="min-h-11"
        :disabled="page <= 1"
        label="Sebelum"
        @click="page -= 1"
      />
      <DsText as="span" variant="meta">Halaman {{ page }} daripada {{ pages }}</DsText>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        size="lg"
        class="min-h-11"
        :disabled="page >= pages"
        label="Seterusnya"
        @click="page += 1"
      />
    </DsCluster>
  </section>
</template>
