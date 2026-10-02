<script setup lang="ts">
/**
 * S7 sessions modal (FN-M17-5.4.8, FR-M17-56): the sessions of one week, all sessions, or one subject.
 * Titles "Minggu {dd/mm} ({start} ~ {end})", "Semua Sesi Latihan", "{subjek} — Semua Sesi"; "Memuatkan...";
 * summary tiles; the table ("Topik" instead of "Subjek" for a subject); empties and the error copy.
 * A row opens the session modal (the parent handles `open-session`).
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { formatMyt } from '@/lib/time'

import {
  fetchCcStudentAllSessions,
  fetchCcStudentSubject,
  fetchCcStudentWeek,
} from '../../api/command-center'
import {
  accuracyTone,
  CC_TABLE as T,
  count,
  pct1,
  pct2,
  TONE_TEXT,
  type CcSessionsSource,
} from './cc-format'
import CcModal from './CcModal.vue'
import CcModalStats from './CcModalStats.vue'

const props = defineProps<{ userId: number; source: CcSessionsSource }>()
const emit = defineEmits<{ close: []; 'open-session': [sessionId: string] }>()

const title = computed(() => {
  const s = props.source
  if (s.kind === 'week') return `Minggu ${s.label} (${s.start} ~ ${s.end})`
  if (s.kind === 'all') return 'Semua Sesi Latihan'
  return `${s.name} — Semua Sesi`
})

const { data, error } = useApi((signal) => {
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
const COLUMNS = ['Tarikh', 'Soalan', 'Betul', 'Ketepatan', 'Masa']
</script>

<template>
  <CcModal :title="title" testid="cc-sessions-modal" @close="emit('close')">
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-modal-error">
      Ralat memuatkan data
    </p>
    <p v-else-if="!data" class="text-sm text-slate-400" data-testid="cc-modal-loading">
      Memuatkan...
    </p>
    <template v-else>
      <CcModalStats :stats="stats" />
      <p
        v-if="data.sessions.length === 0"
        class="mt-4 text-sm text-slate-400"
        data-testid="cc-modal-empty"
      >
        {{ emptyCopy }}
      </p>
      <div v-else class="mt-4 overflow-x-auto" data-testid="cc-sessions-scroller">
        <table :class="[T.table, 'min-w-[520px]']" data-testid="cc-sessions-table">
          <thead>
            <tr>
              <th :class="T.th">{{ COLUMNS[0] }}</th>
              <th :class="T.th">{{ secondColumn }}</th>
              <th v-for="c in COLUMNS.slice(1)" :key="c" :class="T.th">{{ c }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in data.sessions"
              :key="row.id"
              :class="[T.row, T.rowLink]"
              :title="rowTitle"
              data-testid="cc-session-row"
              :data-session-id="row.id"
              @click="emit('open-session', row.id)"
            >
              <td :class="[T.td, 'whitespace-nowrap']">
                {{ formatMyt(row.completedAt, 'dd/MM HH:mm') }}
              </td>
              <td :class="T.td">
                {{ source.kind === 'subject' ? (row.topic ?? '-') : row.subjectLabel }}
              </td>
              <td :class="[T.td, 'whitespace-nowrap']">
                <span data-testid="cc-session-open"
                  >{{ row.total }} <span aria-hidden="true">🔍</span></span
                >
              </td>
              <td :class="[T.td, 'text-emerald-400']">{{ row.correct }}</td>
              <td :class="[T.td, TONE_TEXT[accuracyTone(row.accuracy)]]">
                {{ pct2(row.accuracy) }}
              </td>
              <td :class="T.td">{{ row.minutes }}m</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </CcModal>
</template>
