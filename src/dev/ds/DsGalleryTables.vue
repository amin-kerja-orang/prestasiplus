<script setup lang="ts">
/**
 * Tables and filters (T0c) in the `/__ds` gallery: one `DsDataTable` in its three variants,
 * selection, server paging, `DsFilterBar` with chips and the "Lagi Penapis" popover, and
 * `DsRowActions`. Dev / demo only; sample copy is BM and names are fictitious.
 */
import { computed, ref } from 'vue'

import type { TableColumn } from '@nuxt/ui'

import {
  DsActiveFilters,
  DsDataTable,
  DsFilterBar,
  DsPanel,
  DsRowActions,
  DsStatusBadge,
  type RowAction,
} from '@/ds'

type Row = { id: number; nama: string; kelas: string; skor: number }
const people: Row[] = Array.from({ length: 47 }, (_, i) => ({
  id: i + 1,
  nama: `Murid Contoh ${i + 1}`,
  kelas: `5 Bestari ${(i % 3) + 1}`,
  skor: 50 + ((i * 7) % 50),
}))
const columns: TableColumn<Row>[] = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'kelas', header: 'Kelas' },
  { accessorKey: 'skor', header: 'Skor (%)' },
  { id: 'status', header: 'Status' },
  { id: 'actions', header: '' },
]
const cardFields = [
  { key: 'kelas', label: 'Kelas' },
  { key: 'skor', label: 'Skor (%)' },
]

const page = ref(1)
const pageSize = ref(10)
const flushPage = ref(1)
const selection = ref<Row[]>([])
const serverPage = ref(2)

const lastAction = ref('')
function actionsFor(r: Row): RowAction[] {
  return [
    { label: 'Lihat', icon: 'i-ph-eye', onSelect: () => (lastAction.value = `Lihat ${r.nama}`) },
    {
      label: 'Edit',
      icon: 'i-ph-pencil-simple',
      onSelect: () => (lastAction.value = `Edit ${r.nama}`),
    },
    {
      label: 'Padam',
      icon: 'i-ph-trash',
      danger: true,
      confirm: { title: 'Padam Murid?', body: `Anda pasti mahu memadam ${r.nama}? Tindakan ini tidak boleh dibatalkan.` },
      onSelect: () => (lastAction.value = `Padam ${r.nama}`),
    },
  ]
}

const q = ref('')
const level = ref<string | undefined>('Tingkatan 4')
const status = ref<string | undefined>('Aktif')
const chips = computed(() => [
  ...(level.value ? [{ key: 'level', label: level.value }] : []),
  ...(status.value ? [{ key: 'status', label: status.value }] : []),
])
function removeChip(key: string): void {
  if (key === 'level') level.value = undefined
  if (key === 'status') status.value = undefined
}
function resetFilters(): void {
  level.value = undefined
  status.value = undefined
  q.value = ''
}
const levels = ['Tingkatan 1', 'Tingkatan 2', 'Tingkatan 4']
const statuses = ['Aktif', 'Tidak Aktif']
</script>

<template>
  <div class="flex min-w-0 flex-col gap-8" data-testid="ds-tables">
    <section class="flex flex-col gap-3" aria-labelledby="t-filter">
      <h3 id="t-filter" class="text-subheading">DsFilterBar, DsActiveFilters</h3>
      <DsFilterBar
        :chips="chips"
        :more-count="status ? 1 : 0"
        @reset="resetFilters"
        @remove-chip="removeChip"
      >
        <template #search>
          <UInput v-model="q" placeholder="Cari murid..." aria-label="Cari" class="min-w-0 grow" />
        </template>
        <USelect
          v-model="level"
          :items="levels"
          placeholder="Semua Tingkatan"
          aria-label="Tingkatan"
          class="min-w-40"
        />
        <template #more>
          <USelect
            v-model="status"
            :items="statuses"
            placeholder="Semua Status"
            aria-label="Status"
          />
        </template>
      </DsFilterBar>
      <h3 class="text-label text-muted">Tone plain, tanpa penapis aktif</h3>
      <DsFilterBar tone="plain" :active-count="0">
        <template #search>
          <UInput placeholder="Cari soalan..." aria-label="Cari soalan" class="min-w-0 grow" />
        </template>
      </DsFilterBar>
      <DsActiveFilters
        :chips="[{ key: 'a', label: 'Tahun 2026' }]"
        @remove="lastAction = 'Buang penapis'"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="t-card">
      <h3 id="t-card" class="text-subheading">DsDataTable variant card, pilihan baris, saiz halaman</h3>
      <DsDataTable
        v-model:page="page"
        v-model:page-size="pageSize"
        v-model:selection="selection"
        selectable
        row-key="id"
        :data="people"
        :columns="columns"
        :page-size-options="[10, 20, 50]"
        caption="Senarai murid"
        card-title="nama"
        :card-fields="cardFields"
      >
        <template #status-cell="{ row }">
          <DsStatusBadge :status="row.original.id % 2 ? 'active' : 'inactive'" size="sm" />
        </template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="actionsFor(row.original)" :inline="1" />
        </template>
        <template #card-actions="{ row }">
          <DsRowActions :actions="actionsFor(row)" />
        </template>
      </DsDataTable>
      <p class="text-caption text-muted">
        Dipilih: {{ selection.length }}. Tindakan terakhir: {{ lastAction || 'tiada' }}
      </p>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="t-flush">
      <h3 id="t-flush" class="text-subheading">variant flush, layout fixed, density tight</h3>
      <DsDataTable
        v-model:page="flushPage"
        variant="flush"
        layout="fixed"
        density="tight"
        :data="people"
        :columns="columns.slice(0, 3)"
        :page-size-options="[10, 20]"
        caption="Jadual padat"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="t-bare">
      <h3 id="t-bare" class="text-subheading">variant bare dalam DsPanel, kad tersuai (#card)</h3>
      <DsPanel>
        <DsDataTable
          variant="bare"
          :data="people.slice(0, 14)"
          :columns="columns.slice(0, 3)"
          :page-size-options="[10, 20]"
          caption="Jadual tanpa permukaan"
        >
          <template #card="{ row }">
            <p class="text-label">{{ row.nama }}</p>
            <p class="text-caption text-muted">{{ row.kelas }}</p>
          </template>
        </DsDataTable>
      </DsPanel>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="t-state">
      <h3 id="t-state" class="text-subheading">Server paging, kosong, kosong ditapis, ralat, memuat</h3>
      <DsDataTable
        v-model:page="serverPage"
        :data="people.slice(10, 20)"
        :columns="columns.slice(0, 3)"
        :total="120"
        :page-size="10"
        caption="Halaman pelayan"
      />
      <DsDataTable :data="[]" :columns="columns.slice(0, 3)" empty-title="Belum ada murid." />
      <DsDataTable :data="[]" :columns="columns.slice(0, 3)" filtered />
      <DsDataTable :data="[]" :columns="columns.slice(0, 3)" error="Tidak dapat memuatkan murid." />
      <DsDataTable :data="[]" :columns="columns.slice(0, 3)" loading />
    </section>
  </div>
</template>
