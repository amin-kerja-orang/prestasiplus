<script setup lang="ts">
/**
 * KPI, status and state components (T0d) in the `/__ds` gallery: `DsStatRow` / `DsStatTile`
 * (sub, delta, tone, link, loading), `DsStatusBadge` (every status), `DsLoadError`, `DsEmptyState`
 * (sizes, filtered) and `DsIconChip` sizes. Dev / demo only; sample copy is BM.
 */
import {
  DsEmptyState,
  DsIconChip,
  DsIdentity,
  DsLoadError,
  DsStatRow,
  DsStatusBadge,
  statusMap,
} from '@/ds'
import type { DsStatus, StatItem } from '@/ds'

const statuses = Object.keys(statusMap) as DsStatus[]

const kpis: StatItem[] = [
  {
    key: 'murid',
    label: 'Murid',
    value: 1240,
    icon: 'users',
    sub: '32 kelas',
    delta: { value: '+4.2%', dir: 'up' },
  },
  {
    key: 'aktif',
    label: 'Aktif minggu ini',
    value: 912,
    icon: 'pulse',
    delta: { value: '-1.1%', dir: 'down' },
  },
  {
    key: 'sederhana',
    label: 'Risiko Sederhana',
    value: 87,
    icon: 'warning',
    tone: 'warning',
    to: '/__ds',
  },
  {
    key: 'tinggi',
    label: 'Risiko Tinggi',
    value: 23,
    icon: 'warning-octagon',
    tone: 'error',
    sub: 'Perlu tindakan',
  },
  {
    key: 'lulus',
    label: 'Lulus',
    value: '78%',
    icon: 'check-circle',
    tone: 'success',
    delta: { value: '0%', dir: 'flat' },
  },
]
</script>

<template>
  <div class="flex min-w-0 flex-col gap-8" data-testid="ds-states">
    <section class="flex flex-col gap-3" aria-labelledby="s-stat">
      <h3 id="s-stat" class="text-subheading">DsStatRow, DsStatTile</h3>
      <DsStatRow prefix="gal" :items="kpis" />
      <DsStatRow :items="kpis.slice(0, 3)" density="roomy" />
      <DsStatRow :items="kpis.slice(0, 4)" loading />
      <DsStatRow
        :items="kpis.slice(0, 4).map((k, i) => ({ ...k, to: '/__ds', active: i === 1 }))"
        density="compact"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="s-identity">
      <h3 id="s-identity" class="text-subheading">DsIdentity</h3>
      <div class="flex flex-wrap gap-6">
        <DsIdentity name="Aini Contoh" sub="aini@contoh.test" initials="AC" />
        <DsIdentity name="Kod sekolah" sub="ABA0001" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="s-chip">
      <h3 id="s-chip" class="text-subheading">DsIconChip (sm, md, lg; nama asas)</h3>
      <div class="flex flex-wrap items-center gap-3">
        <DsIconChip icon="funnel" size="xs" />
        <DsIconChip icon="funnel" size="sm" />
        <DsIconChip icon="funnel" size="md" />
        <DsIconChip icon="funnel" size="lg" />
        <DsIconChip icon="warning" size="md" tone="warning" />
        <DsIconChip icon="warning-octagon" size="md" tone="error" />
        <DsIconChip icon="check-circle" size="md" tone="success" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="s-badge">
      <h3 id="s-badge" class="text-subheading">DsStatusBadge</h3>
      <div class="flex flex-wrap items-center gap-2">
        <DsStatusBadge v-for="s in statuses" :key="s" :status="s" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DsStatusBadge status="active" size="sm" />
        <DsStatusBadge status="new" label="BARU" size="sm" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="s-error">
      <h3 id="s-error" class="text-subheading">DsLoadError</h3>
      <DsLoadError />
      <DsLoadError title="Soalan" message="Tidak dapat memuatkan soalan. Sila cuba semula." />
      <DsLoadError variant="inline" />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="s-empty">
      <h3 id="s-empty" class="text-subheading">DsEmptyState (belum ada, ditapis, sm)</h3>
      <DsEmptyState item="tiket sokongan" />
      <DsEmptyState item="soalan" filtered @reset="() => undefined" />
      <DsEmptyState size="sm" title="Tiada data untuk tempoh ini." />
    </section>
  </div>
</template>
