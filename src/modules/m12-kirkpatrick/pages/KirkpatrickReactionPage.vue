<script setup lang="ts">
/**
 * S2 T1 Reaksi (FR-M12-32, 33; URS EP-M12-3; R1-GUR-11 / R1-AS-11 Tahap 1): the tab strip, the four cards (NPS
 * Pelajar / Guru / Admin, Kepuasan Purata) and the sections "Butiran Maklum Balas", "Taburan Mood" and "Komen
 * Terkini". There is no filter: the API scopes the figures to the viewer (the school administrator's own school).
 * "Kepuasan Purata" reads the feedback responses; with none it prints "—" and the note "Belum ada mood check-in".
 */
import { computed, ref } from 'vue'
import type { TableColumn } from '@nuxt/ui'

import {
  DsDataTable,
  DsEmptyState,
  DsGrid,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStatRow,
  DsStatTile,
  DsText,
  type StatItem,
} from '@/ds'
import { formatPercent } from '@/lib/number'

import { fetchKirkpatrickReaction } from '../api'
import {
  count,
  dateEn,
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickTabs,
  mean,
  pct,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'

withDefaults(defineProps<{ basePath?: string }>(), { basePath: KIRKPATRICK_ADMIN_BASE })

const { data, error, loading, reload } = useKirkpatrickPage((signal) =>
  fetchKirkpatrickReaction({ signal }),
)

const DASH = '—'
const outOf = (value: number | null, max: number) => (value === null ? DASH : `${mean(value)}/${String(max)}`)

const items = computed<StatItem[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    {
      key: 'nps-student',
      label: 'NPS Pelajar',
      value: `${mean(d.npsStudent)}/10`,
      icon: 'smiley', accent: 'friend',
    },
    {
      key: 'nps-teacher',
      label: 'NPS Guru',
      value: `${mean(d.npsTeacher)}/10`,
      icon: 'chalkboard-teacher', accent: 'win',
    },
    {
      key: 'nps-admin',
      label: 'NPS Admin',
      value: `${mean(d.npsAdmin)}/10`,
      icon: 'user-gear', accent: 'trial',
    },
    {
      key: 'satisfaction',
      label: 'Kepuasan Purata',
      value: d.responses > 0 ? `${mean(d.satisfaction)}/5` : DASH,
      sub: d.responses > 0 ? `${count(d.responses)} respons` : 'Belum ada mood check-in',
      icon: 'heart', accent: 'heat',
    },
  ]
})

/** A tile of the "Butiran Maklum Balas" / "Taburan Mood" grids. */
interface Tile {
  key: string
  label: string
  value: string
  sub?: string
}

const feedbackTiles = computed<Tile[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { key: 'responses', label: 'Jumlah Respons', value: count(d.responses) },
    { key: 'usability', label: 'Mudah Diguna', value: outOf(d.usability, 5) },
    { key: 'relevance', label: 'Relevan', value: outOf(d.relevance, 5) },
    { key: 'promoters', label: 'Promoter (9–10)', value: count(d.promoters) },
    { key: 'detractors', label: 'Detractor (0–6)', value: count(d.detractors) },
    { key: 'comments', label: 'Komen Bertulis', value: count(d.writtenComments) },
  ]
})

const moodTiles = computed<Tile[]>(() => {
  const m = data.value?.mood
  if (!m) return []
  return [
    { key: 'checkins', label: 'Jumlah Check-in', value: count(m.checkIns) },
    { key: 'engaged', label: 'Pelajar Terlibat', value: `${count(m.engaged)}/${count(m.pupils)}` },
    {
      key: 'positive',
      label: 'Mood Positif',
      value: m.positivePct === null ? DASH : formatPercent(m.positivePct, { decimals: 0 }),
      sub: 'Gembira + Okay',
    },
    { key: 'last7', label: 'Check-in 7 Hari', value: count(m.last7Days) },
  ]
})

interface MoodRow extends Record<string, unknown> {
  mood: string
  count: string
  pct: string
}
const moodRows = computed<MoodRow[]>(() =>
  (data.value?.mood.rows ?? []).map((r) => ({
    mood: r.mood,
    count: count(r.count),
    pct: r.pct === null ? DASH : pct(r.pct),
  })),
)
const moodColumns: TableColumn<MoodRow>[] = [
  { accessorKey: 'mood', header: 'Mood' },
  { accessorKey: 'count', header: 'Bilangan' },
  { accessorKey: 'pct', header: 'Peratus' },
]
const moodCardFields = [
  { key: 'count', label: 'Bilangan' },
  { key: 'pct', label: 'Peratus' },
]

interface CommentRow extends Record<string, unknown> {
  comment: string
  nps: string
  satisfaction: string
  date: string
}
const commentRows = computed<CommentRow[]>(() =>
  (data.value?.latestComments ?? []).map((c) => ({
    comment: c.comment,
    nps: c.nps === null ? DASH : String(c.nps),
    satisfaction: c.satisfaction === null ? DASH : String(c.satisfaction),
    date: dateEn(c.date),
  })),
)
const commentColumns: TableColumn<CommentRow>[] = [
  { accessorKey: 'comment', header: 'Komen' },
  { accessorKey: 'nps', header: 'NPS' },
  { accessorKey: 'satisfaction', header: 'Kepuasan' },
  { accessorKey: 'date', header: 'Tarikh' },
]
const commentCardFields = [
  { key: 'nps', label: 'NPS' },
  { key: 'satisfaction', label: 'Kepuasan' },
  { key: 'date', label: 'Tarikh' },
]

/** At most 10 comments: one page. */
const PAGE_SIZES = [10]
const moodPageSize = ref(10)
const commentPageSize = ref(10)
</script>

<template>
  <DsPage
    data-testid="kirk-reaction-page"
    subtitle="Kepuasan dan persepsi pengguna terhadap platform"
  >
    <KirkpatrickTabs :base-path="basePath" current="reaction" />

    <DsLoadError v-if="error" testid="kirk-error" @retry="reload" />
    <p
      v-else-if="data === null && loading"
      class="flex items-center gap-2 text-label text-muted"
      data-testid="kirk-loading"
      role="status"
    >
      <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
    </p>

    <template v-if="data">
      <DsStatRow
        :items="items"
        prefix="kirk"
        :cols="4"
        density="roomy"
        data-testid="kirk-reaction-cards"
      />

      <DsPanel title="Butiran Maklum Balas" data-testid="rea-feedback">
        <DsGrid :cols="{ base: 2, md: 3 }" data-testid="rea-feedback-tiles">
          <DsStatTile
            v-for="x in feedbackTiles"
            :key="x.key"
            :value="x.value"
            :unit="x.label"
            :data-testid="`rea-fb-${x.key}`"
          />
        </DsGrid>
      </DsPanel>

      <DsPanel title="Taburan Mood" data-testid="rea-mood">
        <DsEmptyState
          v-if="data.mood.checkIns === 0"
          size="sm"
          icon="smiley"
          title="Belum ada mood check-in"
          description="Pelajar perlu check-in mood harian untuk mengukur reaksi (T1)."
          data-testid="rea-mood-empty"
        />
        <DsStack v-else>
          <DsGrid :cols="{ base: 2, md: 4 }" data-testid="rea-mood-tiles">
            <DsStatTile
              v-for="x in moodTiles"
              :key="x.key"
              :value="x.value"
              :unit="x.label"
              :sub="x.sub"
              :data-testid="`rea-mood-${x.key}`"
            />
          </DsGrid>
          <DsDataTable
            v-model:page-size="moodPageSize"
            variant="bare"
            :page-size-options="PAGE_SIZES"
            :data="moodRows"
            :columns="moodColumns"
            caption="Taburan mood"
            card-title="mood"
            :card-fields="moodCardFields"
            data-testid="rea-mood-table"
          />
        </DsStack>
      </DsPanel>

      <DsPanel title="Komen Terkini" data-testid="rea-comments">
        <DsEmptyState
          v-if="commentRows.length === 0"
          size="sm"
          icon="tray"
          title="Tiada komen bertulis lagi."
          data-testid="rea-comments-empty"
        />
        <DsDataTable
          v-else
          v-model:page-size="commentPageSize"
          variant="bare"
          :page-size-options="PAGE_SIZES"
          :data="commentRows"
          :columns="commentColumns"
          caption="Komen terkini"
          card-title="comment"
          :card-fields="commentCardFields"
          data-testid="rea-comments-table"
        >
          <template #comment-cell="{ row }">
            <DsText variant="body" wrap="anywhere">{{ row.original.comment }}</DsText>
          </template>
        </DsDataTable>
      </DsPanel>
    </template>
  </DsPage>
</template>
