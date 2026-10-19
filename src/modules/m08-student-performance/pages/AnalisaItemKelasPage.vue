<script setup lang="ts">
/**
 * S11 `/analisa-item/kelas/{id}` "Papan Guru" (M08-T5; FR-M08-64…74). The API answers 403 for an unknown
 * class or one the viewer may not open, which is the 403 page (FR-M08-08; the route guard already gives
 * it to every role but admin and teacher).
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { DsBreadcrumb, DsLoadError, DsPage, DsPageHeader, DsPanel, DsPillNav, type PillItem } from '@/ds'
import { usePrototypeScope } from '@/composables'

import { fetchClassItemAnalysis, fetchItemAnalysisClasses } from '../api/performance'
import DifficultyTab from '../components/analisa-item/DifficultyTab.vue'
import DiscriminationTab from '../components/analisa-item/DiscriminationTab.vue'
import { usePhIcon } from '../lib/icons'
import { LEVEL_BADGE, LEVEL_ICON } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'

const route = useRoute()
const { home } = usePrototypeScope()
const icon = usePhIcon()
const classId = computed(() => Number(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchClassItemAnalysis(classId.value, { signal }),
  () => classId.value,
  { notFoundAs403: true },
)
const classes = useRouteData((signal) => fetchItemAnalysisClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))

const tab = ref<'difficulty' | 'discrimination'>('difficulty')
watch(classId, () => {
  tab.value = 'difficulty'
})

const summary = computed(() => {
  const a = data.value?.analysis
  if (!a) return []
  const q = a.questionCount
  const pct = (n: number): string | null =>
    q > 0 ? `${String(Math.round((n / q) * 100))}% daripada soalan` : null
  return [
    {
      id: 'mudah',
      label: 'Mudah',
      level: 'Mudah',
      count: a.summary.mudah,
      pct: pct(a.summary.mudah),
    },
    {
      id: 'sederhana',
      label: 'Sederhana',
      level: 'Sederhana',
      count: a.summary.sederhana,
      pct: pct(a.summary.sederhana),
    },
    {
      id: 'sukar',
      label: 'Sukar',
      level: 'Sukar',
      count: a.summary.sukar,
      pct: pct(a.summary.sukar),
    },
  ] as const
})
const classPills = computed<PillItem<number>[]>(() =>
  (classes.data.value ?? []).map((c) => ({
    key: c.id,
    label: c.name,
    to: `/analisa-item/kelas/${String(c.id)}`,
  })),
)
</script>

<template>
  <DsPage data-testid="analisa-item-kelas-page">
    <h1 v-if="loadFailed || !data" class="sr-only">Analisa Item</h1>
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsBreadcrumb
        :items="[{ label: 'Papan Pemuka', to: home }, { label: 'Pilih Kelas', to: '/analisa-item/kelas' }, { label: data.class.name }]"
        aria-label="Breadcrumb"
        data-testid="breadcrumb"
      />

      <DsPanel data-testid="class-card">
        <div class="flex flex-wrap items-center gap-4">
          <div class="flex min-w-0 grow flex-col gap-1">
            <DsPageHeader
              :show-title="true" :title="data.class.name"
              :subtitle="`${data.class.subjectName ?? 'Tiada Subjek'} • ${data.class.levelSlug} • Tahun ${data.class.year}`"
              title-testid="class-name"
            />
          </div>
          <dl class="flex gap-6 text-center">
            <div class="flex flex-col-reverse gap-1">
              <dt class="text-caption text-muted">Pelajar</dt>
              <dd class="tabular text-title text-highlighted" data-testid="class-students">
                {{ data.class.students }}
              </dd>
            </div>
            <div class="flex flex-col-reverse gap-1">
              <dt class="text-caption text-muted">Soalan Diuji</dt>
              <dd class="tabular text-title text-highlighted" data-testid="class-questions">
                {{ data.analysis.questionCount }}
              </dd>
            </div>
          </dl>
        </div>
      </DsPanel>

      <ul class="grid grid-cols-3 gap-2 md:gap-4" data-testid="summary-cards">
        <li v-for="c in summary" :key="c.id" class="min-w-0" :data-testid="`summary-${c.id}`">
          <DsPanel class="h-full">
            <div class="flex flex-col gap-2">
              <UBadge
                :color="LEVEL_BADGE[c.level]"
                variant="subtle"
                :icon="icon(LEVEL_ICON[c.level])"
                :label="c.label"
                class="self-start"
              />
              <p class="tabular text-title text-highlighted" data-testid="summary-count">
                {{ c.count }}
              </p>
              <p v-if="c.pct" class="text-caption text-muted" data-testid="summary-pct">
                {{ c.pct }}
              </p>
            </div>
          </DsPanel>
        </li>
      </ul>

      <div
        class="flex max-w-full gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label="Jenis analisa"
        data-testid="tabs"
      >
        <UButton
          type="button"
          size="lg"
          class="shrink-0 whitespace-nowrap"
          :color="tab === 'difficulty' ? 'primary' : 'neutral'"
          :variant="tab === 'difficulty' ? 'solid' : 'soft'"
          :aria-pressed="tab === 'difficulty'"
          :icon="icon('chart-bar')"
          data-testid="tab-difficulty"
          @click="tab = 'difficulty'"
        >
          Indeks Kesukaran
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="String(data.analysis.questionCount)"
          />
        </UButton>
        <UButton
          type="button"
          size="lg"
          class="shrink-0 whitespace-nowrap"
          :color="tab === 'discrimination' ? 'primary' : 'neutral'"
          :variant="tab === 'discrimination' ? 'solid' : 'soft'"
          :aria-pressed="tab === 'discrimination'"
          :icon="icon('funnel')"
          data-testid="tab-discrimination"
          @click="tab = 'discrimination'"
        >
          Indeks Diskriminasi
          <UBadge
            color="neutral"
            variant="subtle"
            size="sm"
            :label="String(data.analysis.questionCount)"
          />
        </UButton>
      </div>

      <DifficultyTab v-if="tab === 'difficulty'" :analysis="data.analysis" />
      <DiscriminationTab v-else :discrimination="data.analysis.discrimination" />

      <DsPanel v-if="classes.data.value" data-testid="switch-class">
        <div class="flex flex-col gap-3">
          <h2 class="text-subheading text-highlighted">Tukar Kelas</h2>
          <DsPillNav
            :items="classPills"
            :active="data.class.id"
            label="Tukar Kelas"
            testid-prefix="switch"
          />
        </div>
      </DsPanel>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
