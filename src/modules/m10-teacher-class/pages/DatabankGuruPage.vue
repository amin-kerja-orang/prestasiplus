<script setup lang="ts">
/**
 * S6-T19 `/guru/databank` "Databank Soalan" (R1-GUR-44d; FR-GUR-44d-1..6, FR-X1-4d/4e/4f): hero, the
 * two stat cards, the Teras and Elektif subject tiles (select to filter, select again to clear), the
 * search ("Cari", at least 2 characters, checked here before any call) and "Senarai Soalan" (20 units per
 * page). A stimulus group is one unit: its stimuli once, then its questions. Read-only.
 */
import { DATABANK_MESSAGES, DATABANK_SEARCH_MIN } from '@pp/contract'
import { computed, ref } from 'vue'

import { useApi } from '@/composables'
import {
  DsBadge,
  DsCluster,
  DsEmptyState,
  DsGrid,
  DsHeading,
  DsPage,
  DsSection,
  DsStack,
  DsStateView,
  DsStatTile,
  DsSurface,
  DsText,
  formatCount,
} from '@/ds'

import { StimulusGroup } from '../../../components/question-display'
import { fetchDatabankOverview, fetchDatabankQuestions } from '../api/guru'
import type { DatabankQuestion, DatabankStimulus, DatabankSubjectTile } from '../api/types'
import type { StimulusData } from '../../../components/question-display'

const COPY = {
  heroTitle: 'Databank Soalan SPM',
  heroText: 'Terokai koleksi soalan sedia ada dalam bank soalan PrestasiPlus',
  totalLabel: 'Jumlah Soalan',
  activeLabel: 'Subjek Aktif',
  hint: 'Klik mana-mana subjek untuk lihat soalannya di bawah.',
  listTitle: 'Senarai Soalan',
  searchPlaceholder: 'Cari teks soalan...',
  searchButton: 'Cari',
  searchMin: DATABANK_MESSAGES.searchMin,
  empty: DATABANK_MESSAGES.empty,
  status: 'Diluluskan',
  previous: 'Sebelum',
  next: 'Seterusnya',
} as const

const MIN_SEARCH = DATABANK_SEARCH_MIN
const CUT_AT = 55

const overview = useApi((signal) => fetchDatabankOverview({ signal }))

const subjectId = ref<number | null>(null)
const draft = ref('')
const term = ref('')
const page = ref(1)
const tooShort = ref(false)

const list = useApi(
  (signal) =>
    fetchDatabankQuestions(
      {
        ...(subjectId.value === null ? {} : { subjectId: subjectId.value }),
        ...(term.value === '' ? {} : { q: term.value }),
        page: page.value,
      },
      { signal },
    ),
  [subjectId, term, page],
)

function pick(tile: DatabankSubjectTile): void {
  subjectId.value = subjectId.value === tile.subjectId ? null : tile.subjectId
  page.value = 1
}

function search(): void {
  const text = draft.value.trim()
  if (text.length > 0 && text.length < MIN_SEARCH) {
    tooShort.value = true
    return
  }
  tooShort.value = false
  term.value = text
  page.value = 1
}

function go(next: number): void {
  page.value = next
}

/** The text cut with "..." after about 55 characters. */
function cut(text: string): string {
  return text.length > CUT_AT ? `${text.slice(0, CUT_AT)}...` : text
}

const stars = (n: number): string => '⭐'.repeat(Math.min(5, Math.max(1, n)))

interface Row {
  key: string
  stimuli: StimulusData[]
  questions: DatabankQuestion[]
}

/** The shared display shape of a stimulus; a picture is served by `GET /files/:id`. */
function toStimulus(st: DatabankStimulus): StimulusData {
  return {
    id: String(st.id),
    kind: st.kind,
    label: st.label,
    ...((st.bodyMs ?? st.bodyEn) ? { text: st.bodyMs ?? st.bodyEn ?? '' } : {}),
    ...(st.imageId === null ? {} : { src: `/files/${String(st.imageId)}` }),
    ...(st.alt ? { alt: st.alt } : {}),
    ...(st.caption ? { caption: st.caption } : {}),
    ...(st.sourceCitation ? { source: st.sourceCitation } : {}),
    ...(st.tableData ? { table: st.tableData } : {}),
  }
}

const stemOf = (q: DatabankQuestion): string => q.stemMs ?? q.stemEn ?? ''

/** One row per unit: a group keeps its stimuli once above all its questions; a single question shows its own. */
const rows = computed<Row[]>(() =>
  (list.data.value?.data ?? []).map((u) => ({
    key: u.unitId,
    stimuli: (u.group ? u.group.stimuli : (u.questions[0]?.stimuli ?? [])).map(toStimulus),
    questions: u.questions,
  })),
)

const meta = computed(() => list.data.value?.meta ?? null)
const lastPage = computed(() => meta.value?.totalPages ?? 1)
const pagerText = computed(() => {
  const m = meta.value
  if (!m) return ''
  return `Menunjukkan ${formatCount(m.from)}-${formatCount(m.to)} daripada ${formatCount(m.totalItems)} hasil`
})

const retryAll = (): void => {
  void overview.reload()
}
</script>

<template>
  <DsPage layout="list" data-testid="databank-page">
    <DsSurface tone="primary" emphasis="strong" padding="lg" data-testid="databank-hero">
      <DsStack gap="xs">
        <DsHeading :level="2" variant="title" tone="on-primary">{{ COPY.heroTitle }}</DsHeading>
        <DsText variant="body" tone="on-primary">{{ COPY.heroText }}</DsText>
      </DsStack>
    </DsSurface>

    <DsStateView
      :status="overview.error.value ? 'error' : overview.data.value ? 'ready' : 'loading'"
      skeleton="cards"
      :rows="2"
      data-testid="databank-overview"
      @retry="retryAll"
    >
      <DsStack v-if="overview.data.value" gap="section">
        <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
          <DsStatTile
            :value="overview.data.value.data.totalQuestions"
            :unit="COPY.totalLabel"
            icon="database"
            part-prefix="databank-total"
            data-testid="databank-total"
          />
          <DsStatTile
            :value="overview.data.value.data.activeSubjects"
            :unit="COPY.activeLabel"
            icon="books"
            part-prefix="databank-active"
            data-testid="databank-active"
          />
        </DsGrid>

        <DsText variant="body" tone="muted" data-testid="databank-hint">{{ COPY.hint }}</DsText>

        <DsSection
          v-for="group in [
            {
              id: 'teras',
              title: `Subjek Teras (${String(overview.data.value.data.teras.length)})`,
              tiles: overview.data.value.data.teras,
            },
            {
              id: 'elektif',
              title: `Subjek Elektif (${String(overview.data.value.data.elektif.length)})`,
              tiles: overview.data.value.data.elektif,
            },
          ]"
          :key="group.id"
          :title="group.title"
          :data-testid="`databank-${group.id}`"
        >
          <DsGrid :cols="{ base: 1, md: 2, lg: 3 }" gap="md">
            <DsSurface
              v-for="tile in group.tiles"
              :key="tile.subjectId"
              type="button"
              interactive
              :selected="subjectId === tile.subjectId"
              :data-testid="`databank-tile-${String(tile.subjectId)}`"
              @click="pick(tile)"
            >
              <DsStack gap="2xs">
                <DsText variant="body-strong" tone="highlighted">{{ tile.nameMs }}</DsText>
                <DsText variant="caption" tone="muted">{{ tile.nameEn }}</DsText>
                <DsText variant="label" tone="primary" tabular>
                  {{ formatCount(tile.count) }} soalan
                </DsText>
              </DsStack>
            </DsSurface>
          </DsGrid>
        </DsSection>
      </DsStack>
    </DsStateView>

    <DsSection :title="COPY.listTitle" data-testid="databank-list-section">
      <DsStack gap="sm">
        <DsCluster as="form" role="search" gap="sm" align="start" @submit.prevent="search">
          <UInput
            v-model="draft"
            type="search"
            name="q"
            size="xl"
            icon="i-ph-magnifying-glass"
            :aria-label="COPY.searchButton"
            :placeholder="COPY.searchPlaceholder"
            data-testid="databank-search"
          />
          <UButton type="submit" size="xl" :label="COPY.searchButton" data-testid="databank-search-submit" />
        </DsCluster>
        <DsText v-if="tooShort" variant="caption" tone="error" role="alert" data-testid="databank-search-hint">
          {{ COPY.searchMin }}
        </DsText>
      </DsStack>

      <DsStateView
        :status="list.error.value ? 'error' : list.data.value ? 'ready' : 'loading'"
        skeleton="list"
        data-testid="databank-list-state"
        @retry="list.reload"
      >
        <DsEmptyState
          v-if="rows.length === 0"
          :title="COPY.empty"
          icon="magnifying-glass"
          data-testid="databank-empty"
        />
        <DsStack v-else gap="md">
          <DsStack as="ul" gap="md" data-testid="databank-units">
            <DsSurface v-for="row in rows" :key="row.key" as="li" :data-testid="`databank-unit-${row.key}`">
              <DsStack gap="md">
                <StimulusGroup v-if="row.stimuli.length > 0" :stimuli="row.stimuli" :hint="false" />
                <DsStack
                  v-for="q in row.questions"
                  :key="q.id"
                  gap="xs"
                  :data-testid="`databank-question-${String(q.id)}`"
                >
                  <DsText variant="body" tone="highlighted" wrap="anywhere">
                    {{ cut(stemOf(q)) }}
                  </DsText>
                  <DsCluster gap="sm" align="center">
                    <DsText variant="meta" tone="muted" tabular>#{{ q.id }}</DsText>
                    <DsText variant="caption" tone="toned">{{ q.subject }}</DsText>
                    <DsText variant="caption" tone="toned">{{ q.levelLabel }}</DsText>
                    <DsText
                      v-if="q.difficulty !== null"
                      variant="caption"
                      :aria-label="`${String(q.difficulty)} / 5`"
                    >
                      {{ stars(q.difficulty) }}
                    </DsText>
                    <DsBadge :label="COPY.status" tone="success" size="sm" />
                  </DsCluster>
                </DsStack>
              </DsStack>
            </DsSurface>
          </DsStack>

          <DsCluster v-if="meta && meta.totalPages > 1" justify="between" gap="md" data-testid="databank-pager">
            <DsText variant="caption" tone="muted" role="status" data-testid="databank-pager-text">
              {{ pagerText }}
            </DsText>
            <DsCluster gap="sm">
              <UButton
                type="button"
                size="xl"
                color="neutral"
                variant="soft"
                :label="COPY.previous"
                :disabled="page <= 1"
                data-testid="databank-prev"
                @click="go(page - 1)"
              />
              <UButton
                type="button"
                size="xl"
                color="neutral"
                variant="soft"
                :label="COPY.next"
                :disabled="page >= lastPage"
                data-testid="databank-next"
                @click="go(page + 1)"
              />
            </DsCluster>
          </DsCluster>
        </DsStack>
      </DsStateView>
    </DsSection>
  </DsPage>
</template>
