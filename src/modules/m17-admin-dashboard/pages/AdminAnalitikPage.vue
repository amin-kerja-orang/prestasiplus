<script setup lang="ts">
/**
 * M-05 `/admin/analytics` "Analitik & Statistik - Admin Panel" (PRD-30 R1-ADM-M-05; FR-ADM-M05.1..M05.4;
 * API-ADM-12). No inputs (the last 30 days). Regions: platform tiles, `Taburan Status Soalan`,
 * `Top 10 Subjek Aktif`, the questions per level, the answer trend and the top schools. The import tiles,
 * `Kandungan Sokongan` and `Matriks Liputan Subjek` need data `AdminAnalytics` does not return, so they are
 * not drawn. Accuracy is a whole-number percent, rounded half up (40 FR-X4). Empty: "Tiada data analitik.";
 * failed: "Tidak dapat dimuatkan." with `Cuba lagi`.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsChart,
  DsEmptyState,
  DsGrid,
  DsGridItem,
  DsListRow,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
  DsStateView,
  DsStatTile,
  tileLayout,
} from '@/ds'
import { formatCount, formatPercent, percentOf } from '@/lib/number'

import { fetchAdminAnalytics } from '../api/command-center'

const { data, error, loading, reload } = useApi((signal) => fetchAdminAnalytics('30d', { signal }))

// Five KPI tiles: 3 + 2 at md, five across at xl; no orphan row (design 13).
const KPI_SPAN = tileLayout(5).spans

const n = (v: number): string => formatCount(v)
const pct = (v: number): string => formatPercent(v, { decimals: 0 })

const empty = computed(() => {
  const d = data.value
  if (!d) return false
  const s = d.bank.byStatus
  return s.draft + s.review + s.approved + s.archived === 0 && d.platform.answered === 0
})

const statusRows = computed(() => {
  const s = data.value?.bank.byStatus
  if (!s) return { rows: [], total: 0 }
  const total = s.draft + s.review + s.approved + s.archived
  const rows = [
    ['Draf', s.draft],
    ['Menunggu Semakan', s.review],
    ['Diluluskan', s.approved],
    ['Diarkibkan', s.archived],
  ].map(([label, count]) => ({
    label: label as string,
    text: `${n(count as number)} (${pct(percentOf(count as number, total))})`,
  }))
  return { rows, total }
})

const topSubjects = computed(() =>
  [...(data.value?.bank.bySubject ?? [])]
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'ms-MY'))
    .slice(0, 10),
)
const trendLabels = computed(() =>
  (data.value?.trend ?? []).map((t) => `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}`),
)
const trendSeries = computed(() => [
  { label: 'Soalan Dijawab', data: (data.value?.trend ?? []).map((t) => t.answered) },
])
</script>

<template>
  <DsPage layout="report" data-testid="adm-analytics">
    <DsLoadError
      v-if="error && !data"
      message="Tidak dapat dimuatkan."
      retry-label="Cuba lagi"
      testid="adm-analytics-error"
      @retry="reload"
    />
    <DsStateView
      v-else-if="!data && loading"
      status="loading"
      skeleton="stats"
      :rows="4"
      data-testid="adm-analytics-loading"
    />
    <DsPanel v-else-if="empty" data-testid="adm-analytics-empty">
      <DsEmptyState size="sm" title="Tiada data analitik." icon="chart-bar" />
    </DsPanel>
    <template v-else-if="data">
      <DsGrid :tiles="KPI_SPAN.length" gap="md" data-testid="adm-an-tiles">
        <DsGridItem :span="KPI_SPAN[0]">
          <DsStatTile
            :value="data.platform.schools"
            unit="Sekolah Berdaftar"
            :sub="`${n(data.platform.activeSubscriptions)} langganan aktif`"
            icon="buildings"
            part-prefix="an-schools"
          />
        </DsGridItem>
        <DsGridItem :span="KPI_SPAN[1]">
          <DsStatTile
            :value="data.platform.students"
            unit="Pelajar Berdaftar"
            :sub="`${n(data.platform.activeStudents)} pernah aktif menjawab`"
            icon="users"
            part-prefix="an-students"
          />
        </DsGridItem>
        <DsGridItem :span="KPI_SPAN[2]">
          <DsStatTile
            :value="data.platform.answered"
            unit="Soalan Dijawab"
            sub="30 hari lepas"
            icon="question"
            part-prefix="an-answered"
          />
        </DsGridItem>
        <DsGridItem :span="KPI_SPAN[3]">
          <DsStatTile
            :value="data.platform.accuracy === null ? '—' : pct(data.platform.accuracy)"
            unit="Ketepatan Purata"
            sub="keseluruhan platform"
            icon="target"
            part-prefix="an-accuracy"
          />
        </DsGridItem>
        <DsGridItem :span="KPI_SPAN[4]">
          <DsStatTile
            :value="pct(data.bank.dskpTaggedShare)"
            unit="Soalan Bertag DSKP"
            sub="daripada semua soalan"
            icon="tag"
            part-prefix="an-dskp"
          />
        </DsGridItem>
      </DsGrid>

      <DsGrid :cols="{ base: 1, md: 2, xl: 12 }" gap="md" :equal-height="false">
        <DsGridItem :span="{ xl: 3 }">
          <DsPanel title="Taburan Status Soalan" as="section" data-testid="adm-an-status">
            <DsStack as="ul" gap="sm">
              <DsListRow
                v-for="r in statusRows.rows"
                :key="r.label"
                :title="r.label"
                :meta="r.text"
              />
            </DsStack>
            <DsText variant="label" as="p" data-testid="adm-an-status-total">
              Jumlah: {{ n(statusRows.total) }} soalan
            </DsText>
          </DsPanel>
        </DsGridItem>

        <DsGridItem :span="{ xl: 3 }">
          <DsPanel title="Top 10 Subjek Aktif" as="section" data-testid="adm-an-subjects">
            <DsStack as="ul" gap="sm">
              <DsListRow
                v-for="(s, i) in topSubjects"
                :key="s.id"
                :rank="i + 1"
                :title="s.name"
                :meta="`${n(s.total)} soalan`"
              />
            </DsStack>
          </DsPanel>
        </DsGridItem>

        <DsGridItem :span="{ xl: 3 }">
          <DsPanel title="Soalan Mengikut Tahap Pendidikan" as="section" data-testid="adm-an-levels">
            <DsStack as="ul" gap="sm">
              <DsListRow
                v-for="l in data.bank.byLevel"
                :key="l.id"
                :title="l.name"
                :meta="`${n(l.total)} soalan`"
              />
            </DsStack>
          </DsPanel>
        </DsGridItem>

        <DsGridItem :span="{ xl: 3 }">
          <DsPanel title="Mood Pelajar" as="section" data-testid="adm-an-mood">
            <DsStack as="ul" gap="sm">
              <DsListRow
                v-for="b in data.mood.breakdown"
                :key="b.key"
                :title="b.label"
                :meta="n(b.count)"
                :data-testid="`adm-an-mood-${b.key}`"
              />
            </DsStack>
          </DsPanel>
        </DsGridItem>

        <DsGridItem :span="{ xl: 4 }">
          <DsPanel title="Top Sekolah" as="section" data-testid="adm-an-schools">
            <DsEmptyState
              v-if="data.topSchools.length === 0"
              size="sm"
              title="Tiada data analitik."
            />
            <DsStack v-else as="ul" gap="sm">
              <DsListRow
                v-for="(s, i) in data.topSchools"
                :key="s.schoolId"
                :rank="i + 1"
                :title="s.school"
              >
                <template #meta>
                  <span class="whitespace-nowrap">{{ n(s.answered) }} soalan dijawab</span>
                </template>
              </DsListRow>
            </DsStack>
          </DsPanel>
        </DsGridItem>

        <DsGridItem :span="{ xl: 4 }">
          <DsPanel title="Pelajar Teratas" as="section" data-testid="adm-an-students">
            <DsEmptyState
              v-if="data.topStudents.length === 0"
              size="sm"
              title="Tiada data analitik."
            />
            <DsStack v-else as="ul" gap="sm">
              <DsListRow
                v-for="(s, i) in data.topStudents"
                :key="s.userId"
                :rank="i + 1"
                :title="s.name"
                :sub="s.school ?? undefined"
                :meta="`${n(s.answered)} soalan minggu ini`"
              />
            </DsStack>
          </DsPanel>
        </DsGridItem>

        <DsGridItem :span="{ md: 2, xl: 4 }">
          <DsPanel title="Laporan Soalan" as="section" data-testid="adm-an-reports">
            <DsStack as="ul" gap="sm">
              <DsListRow
                title="Baru"
                :meta="n(data.reports.baru)"
                data-testid="adm-an-reports-baru"
              />
              <DsListRow
                title="Selesai"
                :meta="n(data.reports.selesai)"
                data-testid="adm-an-reports-selesai"
              />
            </DsStack>
          </DsPanel>
        </DsGridItem>
      </DsGrid>

      <DsPanel as="section">
        <DsEmptyState
          v-if="trendSeries[0]?.data.length === 0"
          size="sm"
          title="Tiada data analitik."
          icon="chart-bar"
        />
        <DsChart
          v-else
          type="line"
          title="Trend Soalan Dijawab"
          :labels="trendLabels"
          :series="trendSeries"
          table-label="Soalan dijawab setiap hari"
        />
      </DsPanel>
    </template>
  </DsPage>
</template>
