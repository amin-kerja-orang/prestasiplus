<script setup lang="ts">
/**
 * S4 Detail Pelajar (FR-M11-62..71, 87; URS FT-M11-4.2). Header, four cards, five client-side tabs (one
 * panel visible at a time, default "Mengikut Subjek"), the "Pemerhatian" card under every tab and the
 * question modal. The breadcrumb uses the school of the URL (BR-M11-29). The route prefix is a prop.
 */
import { computed, ref } from 'vue'

import { DsIconChip, DsPage } from '@/ds'

import { fetchStudentDetail } from '../api'
import type { StudentAnswerRow } from '../api/types'
import MonitoringCrumbs from '../components/monitoring/MonitoringCrumbs.vue'
import MonitoringStatCard from '../components/monitoring/MonitoringStatCard.vue'
import {
  ACCURACY_TEXT,
  LOAD_ERROR_COPY,
  accuracyBand,
  count,
  dmyHm,
  pct1,
  type UiColor,
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
  { key: Tab; label: string; icon: string; chip?: { n: number; color: UiColor } }[]
>(() => [
  { key: 'subject', label: 'Mengikut Subjek', icon: 'i-ph-book' },
  { key: 'topic', label: 'Mengikut Tajuk', icon: 'i-ph-stack' },
  { key: 'list', label: 'Senarai Soalan', icon: 'i-ph-list-bullets' },
  {
    key: 'wrong',
    label: 'Jawapan Salah',
    icon: 'i-ph-x-circle',
    chip: { n: data.value?.wrong.count ?? 0, color: 'error' },
  },
  {
    key: 'gaps',
    label: 'Gap Analysis',
    icon: 'i-ph-crosshair',
    chip: { n: data.value?.gaps.count ?? 0, color: 'warning' },
  },
])

const accuracy = computed(() => {
  const c = data.value?.cards
  if (!c) return ''
  return c.answered === 0 ? '0%' : pct1(c.accuracy)
})
const accuracyColour = computed(() =>
  data.value ? ACCURACY_TEXT[accuracyBand(data.value.cards.accuracy)] : '',
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
  <DsPage data-testid="monitoring-student-page">
    <template v-if="!blocked">
      <MonitoringCrumbs
        :paths="paths"
        :school="data?.school.name ?? ''"
        :school-id="schoolId"
        :person="data?.student.name ?? ''"
      />

      <UAlert
        v-if="error"
        color="error"
        variant="subtle"
        icon="i-ph-warning"
        :description="LOAD_ERROR_COPY"
        data-testid="mon-error"
      />
      <p
        v-else-if="!data"
        class="flex items-center gap-2 text-body text-muted"
        data-testid="mon-loading"
      >
        <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
      </p>

      <template v-if="data">
        <UCard data-testid="mon-student-header">
          <div class="flex items-center gap-4">
            <DsIconChip icon="i-ph-graduation-cap" size="lg" />
            <div class="flex min-w-0 flex-col gap-1">
              <h2 class="text-title break-words text-highlighted" data-testid="mon-student-name">
                {{ data.student.name }}
              </h2>
              <p class="text-body break-all text-muted" data-testid="mon-student-meta">
                {{ data.student.email }} · {{ data.student.level }}
              </p>
              <p class="text-body text-muted" data-testid="mon-student-last">
                Aktiviti Terakhir: {{ dmyHm(data.student.lastActivityAt) }}
              </p>
            </div>
          </div>
        </UCard>

        <section class="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="mon-student-cards">
          <MonitoringStatCard
            label="Soalan Dijawab"
            :value="count(data.cards.answered)"
            icon="i-ph-pencil-simple"
            accent="trial"
          />
          <MonitoringStatCard
            label="Betul"
            :value="count(data.cards.correct)"
            icon="i-ph-check-circle"
            accent="win"
            value-class="text-success"
          />
          <MonitoringStatCard
            label="Salah"
            :value="count(data.cards.wrong)"
            icon="i-ph-x-circle"
            accent="heat"
            value-class="text-error"
          />
          <MonitoringStatCard
            label="Ketepatan"
            :value="accuracy"
            icon="i-ph-target"
            accent="friend"
            :value-class="accuracyColour"
          />
        </section>

        <div class="flex flex-wrap gap-2" data-testid="mon-tabs">
          <UButton
            v-for="t in tabs"
            :key="t.key"
            type="button"
            size="md"
            :color="tab === t.key ? 'primary' : 'neutral'"
            :variant="tab === t.key ? 'soft' : 'ghost'"
            :icon="t.icon"
            :data-testid="`mon-tab-${t.key}`"
            :data-active="tab === t.key ? 'true' : 'false'"
            @click="tab = t.key"
          >
            {{ t.label }}
            <UBadge
              v-if="t.chip"
              :color="t.chip.color"
              variant="subtle"
              size="md"
              data-testid="mon-tab-chip"
              :label="String(t.chip.n)"
            />
          </UButton>
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

        <UCard data-testid="mon-observations">
          <div class="flex flex-col gap-4">
            <h2 class="flex items-center gap-2 text-heading text-highlighted">
              <UIcon name="i-ph-lightbulb" class="size-6 text-info" />Pemerhatian
            </h2>
            <p
              v-for="(o, i) in observations"
              :key="i"
              class="bg-soft p-4 text-body text-default"
              data-testid="mon-observation"
            >
              {{ o }}
            </p>
          </div>
        </UCard>

        <StudentQuestionModal :row="modalRow" @close="modalRow = null" />
      </template>
    </template>
  </DsPage>
</template>
