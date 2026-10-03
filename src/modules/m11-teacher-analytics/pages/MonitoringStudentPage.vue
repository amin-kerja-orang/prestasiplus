<script setup lang="ts">
/**
 * S4 Detail Pelajar (FR-M11-62..71, 87; URS FT-M11-4.2). Header, four cards, five client-side tabs (one
 * panel visible at a time, default "Mengikut Subjek"), the "Pemerhatian" card under every tab and the
 * question modal. The breadcrumb uses the school of the URL (BR-M11-29). The route prefix is a prop.
 */
import { Book, CircleX, Crosshair, GraduationCap, Layers, Lightbulb, List } from '@lucide/vue'
import { computed, ref, type Component } from 'vue'

import { LoadingSpinner } from '@/components/feedback'

import { fetchStudentDetail } from '../api'
import type { StudentAnswerRow } from '../api/types'
import MonitoringCrumbs from '../components/monitoring/MonitoringCrumbs.vue'
import MonitoringStatCard from '../components/monitoring/MonitoringStatCard.vue'
import {
  ACCURACY_TEXT_700,
  CARD,
  LOAD_ERROR_COPY,
  STAT_TONE,
  accuracyBand,
  count,
  dmyHm,
  pct1,
} from '../components/monitoring/monitoring-format'
import { MONITORING_BASE, monitoringPaths } from '../components/monitoring/monitoring-paths'
import StudentGaps from '../components/monitoring/StudentGaps.vue'
import StudentQuestionList from '../components/monitoring/StudentQuestionList.vue'
import StudentQuestionModal from '../components/monitoring/StudentQuestionModal.vue'
import StudentSubjects from '../components/monitoring/StudentSubjects.vue'
import StudentTopics from '../components/monitoring/StudentTopics.vue'
import StudentWrongAnswers from '../components/monitoring/StudentWrongAnswers.vue'
import { useMonitoringPage } from '../components/monitoring/use-monitoring-page'

const props = withDefaults(defineProps<{ schoolId: number; userId: number; basePath?: string }>(), {
  basePath: MONITORING_BASE,
})
const paths = computed(() => monitoringPaths(props.basePath))

const { data, error, blocked } = useMonitoringPage(
  (signal) => fetchStudentDetail(props.schoolId, props.userId, { signal }),
  [() => props.schoolId, () => props.userId],
  (d) => `${d.student.name} - Detail Pelajar`,
)

type Tab = 'subject' | 'topic' | 'list' | 'wrong' | 'gaps'
const tab = ref<Tab>('subject')
const modalRow = ref<StudentAnswerRow | null>(null)

const tabs = computed<
  { key: Tab; label: string; icon: Component; chip?: { n: number; cls: string } }[]
>(() => [
  { key: 'subject', label: 'Mengikut Subjek', icon: Book },
  { key: 'topic', label: 'Mengikut Tajuk', icon: Layers },
  { key: 'list', label: 'Senarai Soalan', icon: List },
  {
    key: 'wrong',
    label: 'Jawapan Salah',
    icon: CircleX,
    chip: { n: data.value?.wrong.count ?? 0, cls: 'bg-red-100 text-red-600' },
  },
  {
    key: 'gaps',
    label: 'Gap Analysis',
    icon: Crosshair,
    chip: { n: data.value?.gaps.count ?? 0, cls: 'bg-amber-100 text-amber-700' },
  },
])

const accuracy = computed(() => {
  const c = data.value?.cards
  if (!c) return ''
  return c.answered === 0 ? '0%' : pct1(c.accuracy)
})
const accuracyColour = computed(() =>
  data.value ? ACCURACY_TEXT_700[accuracyBand(data.value.cards.accuracy)] : '',
)

const observations = computed(() =>
  (data.value?.observations ?? []).map((o) =>
    o.kind === 'strong'
      ? `Kekuatan dalam ${o.subjectName} (${pct1(o.pct)} ketepatan). Boleh jadikan motivasi.`
      : `Kerap salah dalam ${o.subjectName} (${String(o.wrong)}/${String(o.total)} salah = ${pct1(o.pct)} ketepatan). Cadangan: Fokus latihan tambahan.`,
  ),
)
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="monitoring-student-page">
    <template v-if="!blocked">
      <MonitoringCrumbs
        :paths="paths"
        :school="data?.school.name ?? ''"
        :school-id="schoolId"
        :person="data?.student.name ?? ''"
      />

      <p v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700" data-testid="mon-error">
        {{ LOAD_ERROR_COPY }}
      </p>
      <p
        v-else-if="!data"
        class="flex items-center gap-2 text-sm text-slate-500"
        data-testid="mon-loading"
      >
        <LoadingSpinner class="h-4 w-4" />Memuatkan...
      </p>

      <template v-if="data">
        <section
          :class="[CARD, 'flex items-center gap-4 p-4 sm:p-6']"
          data-testid="mon-student-header"
        >
          <span
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
          >
            <GraduationCap class="h-6 w-6" />
          </span>
          <div class="min-w-0">
            <h2
              class="font-heading text-lg font-bold break-words text-slate-800"
              data-testid="mon-student-name"
            >
              {{ data.student.name }}
            </h2>
            <p class="text-sm break-all text-slate-500" data-testid="mon-student-meta">
              {{ data.student.email }} · {{ data.student.level }}
            </p>
            <p class="text-xs text-slate-400" data-testid="mon-student-last">
              Aktiviti Terakhir: {{ dmyHm(data.student.lastActivityAt) }}
            </p>
          </div>
        </section>

        <section class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="mon-student-cards">
          <MonitoringStatCard
            label="Soalan Dijawab"
            :value="count(data.cards.answered)"
            :tone="STAT_TONE.blue"
          />
          <MonitoringStatCard
            label="Betul"
            :value="count(data.cards.correct)"
            :tone="STAT_TONE.green"
          />
          <MonitoringStatCard
            label="Salah"
            :value="count(data.cards.wrong)"
            :tone="STAT_TONE.red"
          />
          <MonitoringStatCard label="Ketepatan" :value="accuracy" :tone="STAT_TONE.amber">
            <span :class="accuracyColour">{{ accuracy }}</span>
          </MonitoringStatCard>
        </section>

        <div class="flex flex-wrap gap-2" data-testid="mon-tabs">
          <button
            v-for="t in tabs"
            :key="t.key"
            type="button"
            :class="[
              'flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium lg:min-h-9',
              tab === t.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'border border-slate-200 bg-white text-slate-700',
            ]"
            :data-testid="`mon-tab-${t.key}`"
            :data-active="tab === t.key ? 'true' : 'false'"
            @click="tab = t.key"
          >
            <component :is="t.icon" class="h-4 w-4" />{{ t.label }}
            <span
              v-if="t.chip"
              :class="['rounded-full px-1.5 text-xs font-semibold', t.chip.cls]"
              data-testid="mon-tab-chip"
              >{{ t.chip.n }}</span
            >
          </button>
        </div>

        <StudentSubjects v-if="tab === 'subject'" :subjects="data.subjects" />
        <StudentTopics v-else-if="tab === 'topic'" :topics="data.topics" />
        <StudentQuestionList
          v-else-if="tab === 'list'"
          :answers="data.answers"
          @open="modalRow = $event"
        />
        <StudentWrongAnswers v-else-if="tab === 'wrong'" :wrong="data.wrong" />
        <StudentGaps v-else :gaps="data.gaps" />

        <section
          :class="[CARD, 'border-l-4 border-l-blue-500 p-3 sm:p-5']"
          data-testid="mon-observations"
        >
          <h3 class="mb-2 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
            <Lightbulb class="h-5 w-5 text-blue-500" />Pemerhatian
          </h3>
          <p
            v-for="(o, i) in observations"
            :key="i"
            class="mb-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-600 last:mb-0"
            data-testid="mon-observation"
          >
            {{ o }}
          </p>
        </section>

        <StudentQuestionModal :row="modalRow" @close="modalRow = null" />
      </template>
    </template>
  </div>
</template>
