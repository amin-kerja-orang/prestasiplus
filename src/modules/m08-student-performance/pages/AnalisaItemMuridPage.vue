<script setup lang="ts">
/**
 * `/analisa-item` "Analisa Item" for the pupil (R1-MUR-6, S10-T03; API-RPT-05 `GET /api/item-analysis/me`).
 * Four tiles, "Subjek Perlu Perhatian Sekarang" cards, the filter chips "Tapis Item" (`tapis` in the query
 * string; it filters the lists only, the tiles and subject cards follow the whole data), then the lists
 * Isyarat Awal (hidden when empty), Pemulihan and Pengukuhan. A pupil with no answers sees the empty copy.
 * Every percentage is a whole number rounded half up (decision 11). A question of a stimulus group is shown
 * under its stimulus once per list (FR-MUR-6-7).
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import {
  DsCluster,
  DsDefinitionList,
  DsEmptyState,
  DsGrid,
  DsGridItem,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  DsSection,
  DsStack,
  DsStatRow,
  DsText,
  StimulusFigure,
  type DefinitionItem,
  type PillItem,
  type StimulusData,
} from '@/ds'

// The shared question display library predates the `@/components/*` freeze (as m28's `lib/question-display.ts`);
// `@/ds` does not export `RichText` (stem, options and maths with KaTeX), so it is read by path.
import { RichText } from '../../../components/question-display'
import { fetchItemAnalysisMe } from '../api/performance'
import type {
  ItemMeCategory,
  ItemMeItem,
  ItemMeStimulusGroup,
  ItemMeSubject,
  ItemMeTapis,
} from '../api/types'
import { usePhIcon } from '../lib/icons'
import { pctWhole, type Tone } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const route = useRoute()
const icon = usePhIcon()
const statItems = useStatItems()

const TAPIS_VALUES: readonly ItemMeTapis[] = ['semua', 'ada_betul', 'selalu_salah']
const first = (v: unknown): string | undefined => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : undefined
}
/** An unknown `tapis` reads as "Semua". */
const tapis = computed<ItemMeTapis>(() => {
  const v = first(route.query.tapis)
  return TAPIS_VALUES.find((t) => t === v) ?? 'semua'
})
/** Optional deep link `?subjectCode=`: the tiles, counts and lists follow it (S10-T03 decision 7). */
const subjectCode = computed(() => first(route.query.subjectCode) ?? '')

const { data, error, reload } = useRouteData(
  (signal) =>
    fetchItemAnalysisMe({
      tapis: tapis.value,
      ...(subjectCode.value ? { subjectCode: subjectCode.value } : {}),
      signal,
    }),
  [() => tapis.value, () => subjectCode.value],
)
const loadFailed = computed(() => isLoadError(error.value))

const chips = computed<PillItem<ItemMeTapis>[]>(() => {
  const withTapis = (t: ItemMeTapis) => ({
    path: '/analisa-item',
    query: {
      ...route.query,
      tapis: t === 'semua' ? undefined : t,
    },
  })
  return [
    { key: 'semua', label: 'Semua', to: withTapis('semua') },
    { key: 'ada_betul', label: 'Ada Betul', to: withTapis('ada_betul') },
    { key: 'selalu_salah', label: 'Selalu Salah', to: withTapis('selalu_salah') },
  ]
})

const empty = computed(() => (data.value ? data.value.tiles.answered === 0 : false))

const stats = computed<StatSpec[]>(() => {
  const t = data.value?.tiles
  if (!t) return []
  return [
    { id: 'dijawab', label: 'Soalan Dijawab', value: String(t.answered), icon: 'question', accent: 'action' },
    { id: 'pemulihan', label: 'Perlu Pemulihan', value: String(t.needRemedial), icon: 'warning', accent: 'heat' },
    { id: 'pengukuhan', label: 'Perlu Pengukuhan', value: String(t.needStrengthen), icon: 'barbell', accent: 'trial' },
    {
      id: 'penguasaan',
      label: 'Tahap Penguasaan',
      value: t.mastery === null ? '0%' : pctWhole(t.mastery),
      icon: 'medal',
      accent: 'win',
    },
  ]
})

/** The three counters of a subject card (R1-MUR-6 exact labels). */
const counters = (s: ItemMeSubject): DefinitionItem[] => [
  { key: 'wrong', label: 'Jawapan salah', value: s.wrongAnswers },
  { key: 'repeated', label: 'Item berulang lemah', value: s.weakRepeated },
  { key: 'early', label: 'Isyarat awal lemah', value: s.earlySignalWeak },
]

/** The accuracy pill is red below 60 (R1-MUR-6). */
const pillTone = (accuracy: number | null): Tone =>
  // the tone follows the whole number shown on screen (decision 11): 59.6 shows 60% and is not red
  accuracy === null ? 'neutral' : Math.round(accuracy) < 60 ? 'error' : 'success'

interface Section {
  id: ItemMeCategory
  testid: string
  title: string
  hint: string
  emptyText: string | null
}
const SECTIONS: readonly Section[] = [
  {
    id: 'isyarat_awal',
    testid: 'isyarat-awal',
    title: 'Isyarat Awal — Soalan Baru Yang Masih Lemah',
    hint: 'Soalan yang baru dicuba SEKALI tetapi masih salah — membantu kesan subjek lemah lebih awal.',
    emptyText: null,
  },
  {
    id: 'pemulihan',
    testid: 'pemulihan',
    title: 'Pemulihan — Soalan Yang Perlu Diperbaiki',
    hint: 'Soalan yang kamu SELALU jawab salah (≥2 percubaan, 0% betul). Fokus ulang kaji di sini.',
    emptyText: 'Tiada soalan dalam kategori ini setakat ini.',
  },
  {
    id: 'pengukuhan',
    testid: 'pengukuhan',
    title: 'Pengukuhan — Soalan Yang Perlu Diperkukuhkan',
    hint: 'Kamu jawab betul kadang-kadang, tapi belum kukuh (≥2 percubaan, sebahagian betul). Latih lagi!',
    emptyText: 'Tiada soalan dalam kategori ini setakat ini.',
  },
]
const CATEGORY_TONE: Record<ItemMeCategory, Tone> = {
  isyarat_awal: 'info',
  pemulihan: 'error',
  pengukuhan: 'warning',
}
const CATEGORY_LABEL: Record<ItemMeCategory, string> = {
  isyarat_awal: 'Isyarat Awal',
  pemulihan: 'Pemulihan',
  pengukuhan: 'Pengukuhan',
}

/** One list entry: a lone question, or the questions of one stimulus group under their stimulus (shown once). */
interface Entry {
  key: string
  group: ItemMeStimulusGroup | null
  items: ItemMeItem[]
}
function entriesOf(items: readonly ItemMeItem[]): Entry[] {
  const out: Entry[] = []
  const byGroup = new Map<string, Entry>()
  for (const item of items) {
    const g = item.stimulusGroup
    if (g === null) {
      out.push({ key: `q${String(item.questionId)}`, group: null, items: [item] })
      continue
    }
    const k = String(g.id)
    const hit = byGroup.get(k)
    if (hit) hit.items.push(item)
    else {
      const e: Entry = { key: `g${k}`, group: g, items: [item] }
      byGroup.set(k, e)
      out.push(e)
    }
  }
  return out
}

const lists = computed(() =>
  SECTIONS.map((s) => {
    const items = (data.value?.items ?? []).filter((i) => i.category === s.id)
    return { ...s, items, entries: entriesOf(items) }
  }).filter((l) => l.id !== 'isyarat_awal' || l.items.length > 0),
)

/** A stored picture id is served by `/api/files/<token>`; any other value is a URL already. */
// Only a public file token renders; a stored figure id that is not a token is hidden (no broken <img>)
// until S1 resolves figure ids to tokens.
const imageSrc = (id: string): string | null => (/^[A-Za-z0-9_-]{22}$/.test(id) ? `/api/files/${id}` : null)
function stimuliOf(g: ItemMeStimulusGroup): StimulusData[] {
  return g.stimuli.map((s) => ({
    id: String(s.id),
    kind: s.kind,
    ...(s.label ? { label: s.label } : {}),
    ...(s.body?.ms ? { text: s.body.ms } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    ...(s.alt ? { alt: s.alt } : {}),
    ...(s.sourceCitation ? { source: s.sourceCitation } : {}),
    ...(s.imageId && imageSrc(s.imageId) ? { src: imageSrc(s.imageId) as string } : {}),
    ...(s.tableData ? { table: { head: s.tableData.head, rows: s.tableData.rows } } : {}),
  }))
}

const open = ref<ReadonlySet<string>>(new Set())
function toggle(id: string): void {
  const next = new Set(open.value)
  if (!next.delete(id)) next.add(id)
  open.value = next
}
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F']
</script>

<template>
  <DsPage back-to="/dashboard" back-label="Kembali ke Papan Pemuka" data-testid="analisa-item-murid-page">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsStatRow :items="statItems(stats)" :cols="4" prefix="stat" data-testid="stat-cards" />

      <div v-if="empty" data-testid="murid-empty">
        <DsEmptyState
          title="Belum ada data untuk dianalisa"
          description="Mulakan latihan untuk melihat analisa item peribadi anda di sini."
          icon="chart-bar"
        >
          <template #actions>
            <UButton to="/practice" size="lg" class="min-h-11" data-testid="mula-berlatih">
              Mula Berlatih →
            </UButton>
          </template>
        </DsEmptyState>
      </div>

      <template v-else>
        <DsSection
          v-if="data.subjects.length > 0"
          title="Subjek Perlu Perhatian Sekarang"
          description="Ringkasan ini guna SEMUA percubaan anda, jadi subjek boleh muncul di sini walaupun item yang sama belum diulang."
          data-testid="subject-section"
        >
          <DsGrid as="ul" :cols="{ base: 1, md: 2, xl: 3 }">
            <DsGridItem
              v-for="s in data.subjects"
              :key="s.code"
              as="li"
              :data-testid="`subject-${s.code}`"
            >
              <DsPanel>
                <DsStack gap="sm" align="start">
                  <DsCluster justify="between" align="start" class="w-full">
                    <DsText as="span" variant="heading" class="break-words">{{ s.name }}</DsText>
                    <UBadge
                      :color="pillTone(s.accuracy)"
                      variant="subtle"
                      size="lg"
                      :label="pctWhole(s.accuracy)"
                      data-testid="subject-accuracy"
                    />
                  </DsCluster>
                  <DsText variant="caption" data-testid="subject-attempts">
                    {{ s.attempts }} percubaan · {{ s.uniqueQuestions }} soalan unik
                  </DsText>
                  <DsDefinitionList :items="counters(s)" class="w-full" />
                  <UButton
                    :to="`/practice/revision/${encodeURIComponent(s.code)}`"
                    color="primary"
                    variant="soft"
                    size="lg"
                    class="min-h-11"
                    :data-testid="`ulang-kaji-${s.code}`"
                  >
                    Ulang Kaji Subjek Ini
                  </UButton>
                </DsStack>
              </DsPanel>
            </DsGridItem>
          </DsGrid>
        </DsSection>

        <DsCluster data-testid="tapis-bar">
          <DsText as="span" variant="label" tone="muted">Tapis Item:</DsText>
          <DsPillNav :items="chips" :active="tapis" label="Tapis Item" testid-prefix="tapis" />
        </DsCluster>

        <DsSection
          v-for="l in lists"
          :key="l.id"
          :title="l.title"
          :description="l.hint"
          :data-testid="`list-${l.testid}`"
        >
          <template #actions>
            <DsText as="span" variant="meta" :data-testid="`count-${l.testid}`"
              >{{ l.items.length }} soalan</DsText
            >
          </template>

          <DsText
            v-if="l.items.length === 0"
            variant="body"
            tone="muted"
            :data-testid="`empty-${l.testid}`"
          >
            {{ l.emptyText }}
          </DsText>

          <DsStack v-else as="ul" gap="md">
            <li v-for="e in l.entries" :key="e.key" class="min-w-0" data-testid="item-entry">
              <DsStack gap="sm">
                <DsStack v-if="e.group" gap="sm" data-testid="stimulus-block">
                  <StimulusFigure v-for="st in stimuliOf(e.group)" :key="st.id" :stimulus="st" />
                </DsStack>
                <DsPanel
                  v-for="i in e.items"
                  :key="String(i.questionId)"
                  :data-testid="`item-${String(i.questionId)}`"
                >
                  <DsStack gap="sm" align="start">
                    <DsCluster>
                      <UBadge
                        :color="CATEGORY_TONE[i.category]"
                        variant="subtle"
                        :label="CATEGORY_LABEL[i.category]"
                      />
                      <UBadge color="neutral" variant="subtle" :label="i.source" />
                    </DsCluster>
                    <DsText
                      variant="label"
                      tone="highlighted"
                      class="break-words"
                      :dir="i.question.textDirection"
                      data-testid="item-stem"
                    >
                      <RichText :text="i.question.questionText" />
                    </DsText>
                    <DsStack
                      v-if="i.question.options && i.question.options.length > 0"
                      as="ol"
                      gap="2xs"
                      :dir="i.question.textDirection"
                    >
                      <DsCluster v-for="(o, n) in i.question.options" :key="n" as="div" gap="xs" align="start" :wrap="false">
                        <DsText as="span" variant="meta">{{ LETTERS[n] }}.</DsText>
                        <DsText as="span" variant="body"><RichText :text="o" /></DsText>
                      </DsCluster>
                    </DsStack>
                    <DsText variant="caption" data-testid="item-meta">
                      {{ i.subject }}<template v-if="i.chapter"> · {{ i.chapter }}</template>
                      · {{ i.attempts }} percubaan · {{ i.correct }} betul
                    </DsText>
                    <DsStack v-if="i.explanation" gap="xs" align="start">
                      <UButton
                        type="button"
                        color="neutral"
                        variant="ghost"
                        class="min-h-11"
                        :trailing-icon="
                          open.has(String(i.questionId)) ? icon('caret-up') : icon('caret-down')
                        "
                        :aria-expanded="open.has(String(i.questionId))"
                        :data-testid="`penjelasan-toggle-${String(i.questionId)}`"
                        @click="toggle(String(i.questionId))"
                      >
                        Penjelasan
                      </UButton>
                      <DsText
                        v-if="open.has(String(i.questionId))"
                        variant="body"
                        :data-testid="`penjelasan-${String(i.questionId)}`"
                      >
                        <RichText :text="i.explanation" />
                      </DsText>
                    </DsStack>
                  </DsStack>
                </DsPanel>
              </DsStack>
            </li>
          </DsStack>
        </DsSection>

        <DsText variant="caption" data-testid="footer-note">
          Pemulihan dan Pengukuhan menggunakan soalan yang dijawab sekurang-kurangnya 2 kali,
          manakala Subjek Perlu Perhatian dan Isyarat Awal menggunakan semua percubaan.
        </DsText>
      </template>
    </template>
    <DsStack v-else-if="!error" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
