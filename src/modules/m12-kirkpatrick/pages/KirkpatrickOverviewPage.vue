<script setup lang="ts">
/**
 * S1 Overview (FR-M12-18..31; URS EP-M12-2). One component for `/admin/kirkpatrick`, the `/guru/kirkpatrick`
 * twin and the `/admin-sekolah/kirkpatrick` alias: the route prefix is a prop and every link is built from it.
 * `detailLinks` (on for every mount since S6-T02: the school administrator reaches all seven screens) turns the level
 * cards, the flow circles and the KPI links into links; off, they are plain boxes.
 * `showComparison` (off on `/guru/kirkpatrick`, AC-GUR-11-2): the "Perbandingan Sebelum & Selepas" panel.
 *
 * The filter lives in the query (`school_id`, `state`); "Tapis" navigates to the same prefix with both.
 * `scopeForced` (the school-admin mount): the API forces the viewer's own school whatever the query says, so
 * `school_id` and `state` are ignored (no chips, no selects, not sent) and the filter card is replaced by a
 * read-only school label (FR-AS-11-2, DV-M12-38).
 */
import { computed } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { useSession } from '@/composables/useSession'
import {
  DsCluster,
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'

import { fetchKirkpatrickFilterOptions, fetchKirkpatrickOverview } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  kirkpatrickPaths,
  queryString,
  useKirkpatrickFilters,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'
import OverviewBands from '../components/kirkpatrick/overview/OverviewBands.vue'
import OverviewComparison from '../components/kirkpatrick/overview/OverviewComparison.vue'
import OverviewFlow from '../components/kirkpatrick/overview/OverviewFlow.vue'
import OverviewInfo from '../components/kirkpatrick/overview/OverviewInfo.vue'
import OverviewInfoToggle from '../components/kirkpatrick/overview/OverviewInfoToggle.vue'
import { useInfoOpen } from '../components/kirkpatrick/overview/use-info-open'
import OverviewKpis from '../components/kirkpatrick/overview/OverviewKpis.vue'
import OverviewLevelCards from '../components/kirkpatrick/overview/OverviewLevelCards.vue'

const props = withDefaults(
  defineProps<{
    basePath?: string
    detailLinks?: boolean
    scopeForced?: boolean
    showComparison?: boolean
  }>(),
  { basePath: KIRKPATRICK_ADMIN_BASE, detailLinks: true, scopeForced: false, showComparison: true },
)

const route = useRoute()
const router = useRouter()
const paths = computed(() => kirkpatrickPaths(props.basePath))
const info = useInfoOpen()
const { user } = useSession()
const INFO_ID = 'kirk-info-panel'

const schoolId = computed(() => (props.scopeForced ? '' : queryString(route.query.school_id)))
const state = computed(() => (props.scopeForced ? '' : queryString(route.query.state)))

const { data, error, loading, reload } = useKirkpatrickPage(
  (signal) =>
    fetchKirkpatrickOverview(
      {
        schoolId: /^\d+$/.test(schoolId.value) ? Number(schoolId.value) : null,
        state: state.value,
      },
      { signal },
    ),
  () => route.fullPath,
)
const { data: options } = useApi((signal) =>
  props.scopeForced ? Promise.resolve(null) : fetchKirkpatrickFilterOptions({ signal }),
)

/** The locked school label: line 1 the name, line 2 "{kod} · {PPD} · {negeri}" (empty parts skipped). */
const school = computed(() => {
  const s = user.value?.school
  if (!s) return null
  const detail = [s.code, s.district, s.state].filter((p): p is string => !!p && p.trim() !== '')
  return { name: s.name, detail: detail.join(' · ') }
})

const filters = useKirkpatrickFilters(options, { schoolId, state }, (value) => void apply(value))

async function apply(value: { schoolId: string; state: string }) {
  const failure = await router.push({
    path: props.basePath,
    query: { school_id: value.schoolId, state: value.state },
  })
  if (isNavigationFailure(failure, NavigationFailureType.duplicated)) void reload()
}
</script>

<template>
  <DsPage
    data-testid="kirk-overview-page"
    subtitle="Analisis Keberkesanan Platform — Model Penilaian 4 Tahap"
  >
    <DsPanel v-if="scopeForced" data-testid="kirk-filter">
      <DsCluster justify="between">
        <DsStack gap="2xs" data-testid="kirk-school-label">
          <DsText variant="body-strong">{{ school?.name }}</DsText>
          <DsText v-if="school?.detail" variant="caption">{{ school.detail }}</DsText>
        </DsStack>
        <OverviewInfoToggle :open="info.open.value" :controls="INFO_ID" @toggle="info.toggle" />
      </DsCluster>
    </DsPanel>
    <!-- Live copy: "Tapis" and "Reset" (FR-M12-19, 41). -->
    <DsFilterBar
      v-else
      :chips="filters.chips.value"
      :show-reset="false"
      apply-label="Tapis"
      reset-label="Reset"
      data-testid="kirk-filter"
      @apply="filters.apply"
      @remove-chip="filters.removeChip"
      @reset="router.push(paths.overview)"
    >
      <DsFormField v-slot="{ id }" native label="Sekolah" class="w-full md:w-64">
        <DsNativeSelect
          :id="id"
          v-model="filters.school.value"
          name="school_id"
          data-testid="kirk-filter-school"
        >
          <option value="">Semua Sekolah</option>
          <option v-for="s in options?.schools ?? []" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Negeri" class="w-full md:w-48">
        <DsNativeSelect
          :id="id"
          v-model="filters.state.value"
          name="state"
          data-testid="kirk-filter-state"
        >
          <option value="">Semua Negeri</option>
          <option v-for="s in options?.states ?? []" :key="s" :value="s">{{ s }}</option>
        </DsNativeSelect>
      </DsFormField>
      <template #actions>
        <OverviewInfoToggle :open="info.open.value" :controls="INFO_ID" @toggle="info.toggle" />
      </template>
    </DsFilterBar>
    <OverviewInfo :open="info.open.value" :id="INFO_ID" />

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
      <OverviewKpis :kpi="data.kpi" :paths="paths" :detail="detailLinks" />
      <OverviewLevelCards :data="data" :paths="paths" :detail="detailLinks" />
      <OverviewFlow :data="data" :paths="paths" :detail="detailLinks" />
      <OverviewComparison v-if="showComparison" :comparison="data.comparison" />
      <OverviewBands :bands="data.bands" :behavior-path="detailLinks ? paths.behavior : null" />
    </template>
  </DsPage>
</template>
