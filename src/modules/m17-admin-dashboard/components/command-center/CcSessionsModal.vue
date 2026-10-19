<script setup lang="ts">
/**
 * S7 sessions modal (FN-M17-5.4.8, FR-M17-56): the sessions of one week, all sessions, or one subject.
 * Titles "Minggu {dd/mm} ({start} ~ {end})", "Semua Sesi Latihan", "{subjek} — Semua Sesi"; "Memuatkan...";
 * summary tiles; the table ("Topik" instead of "Subjek" for a subject); empties and the error copy.
 * A row opens the session modal (the parent handles `open-session`).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsDialog, DsDrillTable, DsLoadError, DsStatRow, DsStack, DsText } from '@/ds'
import { formatMyt } from '@/lib/time'

import {
  fetchCcStudentAllSessions,
  fetchCcStudentSubject,
  fetchCcStudentWeek,
} from '../../api/command-center'
import type { CcSessionRow } from '../../api/command-center-types'
import {
  accuracyTone,
  count,
  MODAL_ERROR_COPY,
  pct1,
  pct2,
  statItems,
  TONE_TEXT,
  type CcSessionsSource,
} from './cc-format'
import { useCcDialog } from './use-cc-dialog'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcSessionRow]: CcSessionRow[K] }

const props = defineProps<{ userId: number; source: CcSessionsSource }>()
const emit = defineEmits<{ close: []; 'open-session': [sessionId: string] }>()

const title = computed(() => {
  const s = props.source
  if (s.kind === 'week') return `Minggu ${s.label} (${s.start} ~ ${s.end})`
  if (s.kind === 'all') return 'Semua Sesi Latihan'
  return `${s.name} — Semua Sesi`
})

const open = useCcDialog(() => emit('close'))

const { data, error, reload } = useApi((signal) => {
  const s = props.source
  if (s.kind === 'week') return fetchCcStudentWeek(props.userId, s.start, s.end, { signal })
  if (s.kind === 'all') return fetchCcStudentAllSessions(props.userId, { signal })
  return fetchCcStudentSubject(props.userId, s.code, { signal })
})

const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { label: 'Jawapan', value: count(d.totalAnswers) },
    { label: 'Sesi', value: count(d.totalSessions) },
    { label: 'Ketepatan', value: pct1(d.accuracy) },
    {
      label: props.source.kind === 'all' ? 'Jumlah Masa' : 'Masa',
      value: `${count(d.timeSpentMinutes)}m`,
    },
  ]
})
const emptyCopy = computed(() =>
  props.source.kind === 'week' ? 'Tiada sesi minggu ini' : 'Tiada sesi',
)
/** Live titles: the week rows "Klik untuk lihat soalan", the subject rows "Klik soalan", all sessions none. */
const rowTitle = computed(() => {
  if (props.source.kind === 'week') return 'Klik untuk lihat soalan'
  if (props.source.kind === 'subject') return 'Klik soalan'
  return undefined
})
const secondColumn = computed(() => (props.source.kind === 'subject' ? 'Topik' : 'Subjek'))
const columns = computed<TableColumn<Row>[]>(() => [
  { id: 'date', header: 'Tarikh' },
  { id: 'second', header: secondColumn.value },
  { id: 'total', header: 'Soalan' },
  { id: 'correct', header: 'Betul' },
  { id: 'acc', header: 'Ketepatan' },
  { id: 'time', header: 'Masa' },
])
const sessions = computed(() => data.value?.sessions ?? [])
</script>

<template>
  <DsDialog v-model:open="open" :title="title" class="sm:max-w-2xl">
    <DsStack data-testid="cc-sessions-modal">
      <DsLoadError
        v-if="error"
        variant="inline"
        :message="MODAL_ERROR_COPY"
        testid="cc-modal-error"
        @retry="reload"
      />
      <DsText v-else-if="!data" variant="body" tone="muted" data-testid="cc-modal-loading">
        Memuatkan...
      </DsText>
      <template v-else>
        <DsStatRow :items="statItems(stats)" data-testid="cc-modal-stats" />
        <DsText
          v-if="data.sessions.length === 0"
          variant="body"
          tone="muted"
          data-testid="cc-modal-empty"
        >
          {{ emptyCopy }}
        </DsText>
        <div v-else data-testid="cc-sessions-scroller">
          <DsDrillTable
            :data="sessions"
            :columns="columns"
            :caption="title"
            data-testid="cc-sessions-table"
            @drill="(row: Row) => emit('open-session', row.id)"
          >
            <template #date-cell="{ row }">
              <span
                :title="rowTitle"
                data-testid="cc-session-row"
                :data-session-id="row.original.id"
                >{{ formatMyt(row.original.completedAt, 'dd/MM HH:mm') }}</span
              >
            </template>
            <template #second-cell="{ row }">
              {{
                source.kind === 'subject' ? (row.original.topic ?? '-') : row.original.subjectLabel
              }}
            </template>
            <template #total-cell="{ row }">
              <UButton
                variant="link"
                color="primary"
                size="sm"
                trailing-icon="i-ph-magnifying-glass"
                class="h-auto p-0"
                :label="String(row.original.total)"
                data-testid="cc-session-open"
                @click.stop="emit('open-session', row.original.id)"
              />
            </template>
            <template #correct-cell="{ row }"
              ><span class="text-success">{{ row.original.correct }}</span></template
            >
            <template #acc-cell="{ row }">
              <span :class="TONE_TEXT[accuracyTone(row.original.accuracy)]">{{
                pct2(row.original.accuracy)
              }}</span>
            </template>
            <template #time-cell="{ row }">{{ row.original.minutes }}m</template>
          </DsDrillTable>
        </div>
      </template>
    </DsStack>
    <template #footer>
      <UButton
        color="neutral"
        variant="soft"
        label="Tutup"
        data-testid="cc-modal-close"
        @click="open = false"
      />
    </template>
  </DsDialog>
</template>
