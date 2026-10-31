<script setup lang="ts">
/**
 * Admin page-template building blocks (batch 0a) in the `/__ds` gallery: DsBadge, DsDefinitionList,
 * DsCallout, DsDrawer and the changed DsStatRow / DsStatTile / DsPanel / DsPillNav / DsSplit /
 * DsDataTable / DsPageHeader. Dev / demo only; sample copy is BM, names are fictitious.
 */
import { ref } from 'vue'

import type { TableColumn } from '@nuxt/ui'

import {
  DsBadge,
  DsCallout,
  DsDataTable,
  DsDefinitionList,
  DsDrawer,
  DsPageHeader,
  DsPanel,
  DsPillNav,
  DsSplit,
  DsStatRow,
} from '@/ds'

const drawer = ref(false)
const tab = ref('semua')
const tabs = [
  { key: 'semua', label: 'Semua', count: 1271 },
  { key: 'terbuka', label: 'Terbuka', count: 33 },
  { key: 'selesai', label: 'Selesai', count: 1238 },
  { key: 'tutup', label: 'Ditutup' },
]
const strip = (n: number) =>
  [
    { key: 'a', label: 'Pengguna', value: 1271, icon: 'users', accent: 'action' as const, sub: '+4 minggu ini' },
    { key: 'b', label: 'Sekolah', value: 245, icon: 'buildings', accent: 'friend' as const },
    { key: 'c', label: 'Bank Soalan', value: 12840, icon: 'question', accent: 'win' as const },
    { key: 'd', label: 'Langganan Aktif', value: 98, icon: 'receipt', accent: 'heat' as const },
    {
      key: 'e',
      label: 'Tiket Terbuka',
      value: null,
      icon: 'lifebuoy',
      accent: 'trial' as const,
      valueTone: 'dimmed' as const,
    },
  ].slice(0, n)

const defs = [
  { key: 'nama', label: 'Nama Sekolah', value: 'SMK Contoh Satu' },
  { key: 'kod', label: 'Kod', value: 'ABC1234', mono: true },
  { key: 'murid', label: 'Murid', value: 1271 },
  { key: 'pautan', label: 'Pentadbir', value: 'Pentadbir Contoh', to: '/admin/users' },
  { key: 'nota', label: 'Nota', value: null },
]

type Row = { nama: string; kelas: string }
const rows: Row[] = Array.from({ length: 8 }, (_, i) => ({
  nama: `Murid Contoh ${i + 1}`,
  kelas: `4 Bestari ${(i % 3) + 1}`,
}))
const columns: TableColumn<Row>[] = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'kelas', header: 'Kelas' },
]
</script>

<template>
  <div class="flex min-w-0 flex-col gap-8" data-testid="ds-admin-templates">
    <section class="flex flex-col gap-3" aria-labelledby="a-badge">
      <h3 id="a-badge" class="text-subheading">DsBadge</h3>
      <div class="flex flex-wrap items-center gap-2">
        <DsBadge label="Neutral" />
        <DsBadge label="Primary" tone="primary" />
        <DsBadge label="Betul" tone="success" icon="check" />
        <DsBadge label="Amaran" tone="warning" icon="warning" />
        <DsBadge label="Salah" tone="error" icon="x" />
        <DsBadge label="Info" tone="info" />
        <DsBadge label="Strong" tone="primary" emphasis="strong" />
        <DsBadge label="Kecil" size="sm" tone="info" />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <DsBadge label="Action" accent="action" />
        <DsBadge label="Win" accent="win" />
        <DsBadge label="Heat" accent="heat" />
        <DsBadge label="Friend" accent="friend" />
        <DsBadge label="Trial" accent="trial" />
        <DsBadge label="Win solid" accent="win" emphasis="strong" />
        <DsBadge label="Heat solid" accent="heat" emphasis="strong" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-stat">
      <h3 id="a-stat" class="text-subheading">DsStatRow (2 / 3 / 4 / 5 tiles), roomy, #sub, null, dimmed</h3>
      <DsStatRow density="roomy" :items="strip(2)" />
      <DsStatRow density="roomy" :items="strip(3)" />
      <DsStatRow density="roomy" :items="strip(4)" />
      <DsStatRow density="roomy" :items="strip(5)">
        <template #sub="{ item }">
          <DsBadge v-if="item.key === 'a'" label="+4" tone="success" size="sm" />
        </template>
      </DsStatRow>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-pill">
      <h3 id="a-pill" class="text-subheading">DsPillNav with count</h3>
      <DsPillNav label="Status" :items="tabs" :active="tab" @select="tab = String($event)" />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-header">
      <h3 id="a-header" class="text-subheading">DsPageHeader (subtitle, tonal + primary actions, meta)</h3>
      <DsPageHeader subtitle="Senarai sekolah yang didaftarkan dalam platform">
        <template #meta><DsBadge label="Aktif" tone="success" /></template>
        <template #actions>
          <UButton color="neutral" variant="soft" label="Import Pelajar" />
          <UButton color="neutral" variant="soft" label="Muat Turun Templat XLSX" />
          <UButton icon="i-ph-plus" label="Daftar Sekolah" />
        </template>
      </DsPageHeader>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-callout">
      <h3 id="a-callout" class="text-subheading">DsCallout</h3>
      <DsCallout tone="info" title="Soalan disimpan sebagai draf" description="Semak dan terbitkan selepas import." />
      <DsCallout tone="success" description="Pelajar berjaya diimport." />
      <DsCallout tone="warning" title="Langganan hampir tamat" dismissible description="Baki 7 hari." />
      <DsCallout tone="error" title="Sila betulkan 2 medan di bawah.">
        <template #actions><UButton size="xs" color="neutral" variant="soft" label="Cuba Semula" /></template>
      </DsCallout>
      <DsCallout tone="info" title="Panduan format (tertutup secara lalai)" collapsible storage-key="gallery-guide">
        Kolum diperlukan: nama, kelas. Kolum opsyenal: emel, telefon.
      </DsCallout>
      <DsCallout tone="info" title="Panduan (buka melalui defaultOpen)" collapsible default-open>
        Panduan ringkas: pilih tempoh, negeri dan tahap, kemudian tekan Cari. Teks kekal pada lebar yang selesa dibaca walaupun halaman luas.
      </DsCallout>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-def">
      <h3 id="a-def" class="text-subheading">DsDefinitionList (1 and 2 columns)</h3>
      <DsSplit ratio="1-1" stack-below="md">
        <DsPanel title="Maklumat" icon="info"><DsDefinitionList :items="defs" /></DsPanel>
        <template #aside>
          <DsPanel title="Status" icon="check-circle"><DsDefinitionList :items="defs" :columns="2" /></DsPanel>
        </template>
      </DsSplit>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-panel">
      <h3 id="a-panel" class="text-subheading">DsPanel moreTo, DsDataTable pager none, DsSplit 5-7 / 8-4</h3>
      <DsSplit ratio="5-7" stack-below="lg">
        <DsPanel title="Tiket Terbuka" icon="lifebuoy" description="5 terkini" more-to="/admin/tiket" padding="none">
          <DsDataTable
            :data="rows.slice(0, 5)"
            :columns="columns"
            variant="bare"
            density="tight"
            pager="none"
            card-title="nama"
            :card-fields="[{ key: 'kelas', label: 'Kelas' }]"
          />
        </DsPanel>
        <template #aside>
          <DsPanel title="Pintasan" icon="lightning" more-to="/admin" more-label="Semua">
            <DsDefinitionList :items="defs.slice(0, 3)" />
          </DsPanel>
        </template>
      </DsSplit>
      <DsSplit ratio="8-4" stack-below="lg">
        <DsPanel title="8"><DsDefinitionList :items="defs.slice(0, 2)" /></DsPanel>
        <template #aside>
          <DsPanel title="4"><DsDefinitionList :items="defs.slice(0, 2)" /></DsPanel>
        </template>
      </DsSplit>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="a-drawer">
      <h3 id="a-drawer" class="text-subheading">DsDrawer</h3>
      <div><UButton label="Buka laci" @click="drawer = true" /></div>
      <DsDrawer v-model:open="drawer" title="Penapis" description="Pilih penapis tambahan.">
        <DsDefinitionList :items="defs" />
        <template #footer>
          <UButton color="neutral" variant="ghost" label="Set Semula" />
          <UButton label="Guna" @click="drawer = false" />
        </template>
      </DsDrawer>
    </section>
  </div>
</template>
