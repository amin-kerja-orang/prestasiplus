<script setup lang="ts">
/**
 * Wave 0 composites (restyle spec section 4) in the `/__ds` gallery. Dev / demo only; sample copy
 * is BM and names are fictitious.
 */
import { ref } from 'vue'

import type { TableColumn } from '@nuxt/ui'

import coinPng from '@/assets/v2/3d/coin_3d.png'

import {
  DsArt3D,
  DsAudioPlayer,
  DsBadgeTile,
  DsChart,
  DsConfirmHost,
  DsDataTable,
  DsDialog,
  DsErrorPage,
  DsFilterBar,
  DsGameTile,
  DsHeatGrid,
  DsLeaderRow,
  DsLevelMap,
  DsMediaCard,
  DsPage,
  DsPrintSheet,
  DsProse,
  DsShopCard,
  DsWheel,
  useConfirm,
} from '@/ds'

const confirm = useConfirm()
const confirmed = ref('')
async function ask(): Promise<void> {
  const ok = await confirm({
    message: 'Padam rekod ini?',
    confirmLabel: 'Padam',
    tone: 'error',
  })
  confirmed.value = ok ? 'Disahkan' : 'Dibatalkan'
}

const dialogOpen = ref(false)
const filterQ = ref('')
const filterLevel = ref('Semua')

type Row = { nama: string; kelas: string; skor: number }
const people: Row[] = Array.from({ length: 23 }, (_, i) => ({
  nama: `Murid Contoh ${i + 1}`,
  kelas: `5 Bestari ${(i % 3) + 1}`,
  skor: 50 + ((i * 7) % 50),
}))
const columns: TableColumn<Row>[] = [
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'kelas', header: 'Kelas' },
  { accessorKey: 'skor', header: 'Skor (%)' },
]
const page = ref(1)
const sort = ref<string>()

const labels = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei']

const heatRows = [
  { id: 'a', label: 'Kelas 5 Bestari 1', cells: [12, 38, 55, 76, 94] },
  { id: 'b', label: 'Kelas 5 Bestari 2', cells: [30, null, 48, 62, 81] },
]
const levels = [
  { id: 'l1', label: 'Tahap 1: Asas', state: 'done' as const },
  { id: 'l2', label: 'Tahap 2: Pecahan', state: 'current' as const },
  { id: 'l3', label: 'Tahap 3: Perpuluhan', state: 'locked' as const },
]
const coinUrl = coinPng
</script>

<template>
  <div class="flex min-w-0 flex-col gap-8" data-testid="ds-wave0">
    <section class="flex flex-col gap-3" aria-labelledby="w-page">
      <h3 id="w-page" class="text-subheading">DsPage, DsFilterBar</h3>
      <DsPage title="Tajuk Halaman" subtitle="Sub-tajuk ringkas untuk halaman ini.">
        <template #actions><UButton label="Tindakan" /></template>
        <DsFilterBar :active-count="filterLevel === 'Semua' ? 0 : 1" @reset="filterLevel = 'Semua'">
          <template #search>
            <UInput v-model="filterQ" placeholder="Cari nama" aria-label="Cari nama" class="w-full" />
          </template>
          <USelect v-model="filterLevel" :items="['Semua', 'Tahun 4', 'Tahun 5']" class="w-full sm:w-48" />
        </DsFilterBar>
      </DsPage>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-table">
      <h3 id="w-table" class="text-subheading">DsDataTable</h3>
      <DsDataTable
        v-model:page="page"
        v-model:sort="sort"
        :data="people"
        :columns="columns"
        caption="Senarai murid"
        card-title="nama"
        :card-fields="[
          { key: 'kelas', label: 'Kelas' },
          { key: 'skor', label: 'Skor (%)' },
        ]"
        :sort-items="[
          { label: 'Nama', value: 'nama' },
          { label: 'Skor', value: 'skor' },
        ]"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-chart">
      <h3 id="w-chart" class="text-subheading">DsChart</h3>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UCard>
          <DsChart
            title="Purata skor bulanan"
            :labels="labels"
            :series="[{ label: 'Purata', data: [62, 68, 71, 75, 80] }]"
            unit="%"
          />
        </UCard>
        <UCard>
          <DsChart
            title="Tren mengikut kelas"
            type="line"
            :labels="labels"
            :series="[
              { label: '5 Bestari 1', data: [60, 64, 70, 72, 78] },
              { label: '5 Bestari 2', data: [55, 61, 63, 70, 74] },
            ]"
          />
        </UCard>
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-dialog">
      <h3 id="w-dialog" class="text-subheading">DsDialog, useConfirm</h3>
      <div class="flex flex-wrap items-center gap-2">
        <UButton label="Buka dialog" @click="dialogOpen = true" />
        <UButton label="Padam (sahkan)" color="error" variant="soft" @click="ask" />
        <span v-if="confirmed" class="text-label text-muted" role="status">{{ confirmed }}</span>
      </div>
      <DsDialog v-model:open="dialogOpen" title="Tajuk dialog" description="Penerangan ringkas.">
        <p class="text-body">Kandungan dialog.</p>
        <template #footer>
          <UButton color="neutral" variant="ghost" label="Tutup" @click="dialogOpen = false" />
        </template>
      </DsDialog>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-error">
      <h3 id="w-error" class="text-subheading">DsErrorPage</h3>
      <DsErrorPage :code="403">
        <template #actions>
          <UButton block label="Kembali ke Papan Pemuka" />
        </template>
      </DsErrorPage>
      <DsErrorPage :code="404" />
    </section>

    <DsConfirmHost />

    <section class="flex flex-col gap-3" aria-labelledby="w-leader">
      <h3 id="w-leader" class="text-subheading">DsLeaderRow, DsHeatGrid</h3>
      <ul class="flex flex-col gap-2">
        <DsLeaderRow :rank="1" name="Murid Contoh A" school="Sekolah Contoh" :points="2480" unit="mata" medal="trophy" />
        <DsLeaderRow :rank="2" name="Murid Contoh B" school="Sekolah Contoh" :points="2310" unit="mata" />
        <DsLeaderRow :rank="9" name="Murid Contoh C" school="Sekolah Contoh" :points="1520" unit="mata" own />
      </ul>
      <DsHeatGrid label="Penguasaan topik" :columns="['Bab 1', 'Bab 2', 'Bab 3', 'Bab 4', 'Bab 5']" :rows="heatRows" />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-media">
      <h3 id="w-media" class="text-subheading">DsMediaCard, DsProse, DsAudioPlayer</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <DsMediaCard title="Memahami pecahan dengan mudah" duration="4:30" category="Matematik" meta="1.2k tontonan" :progress="45" />
        <DsMediaCard kind="article" title="Petua menjawab soalan KBAT" category="Artikel" meta="3 min baca" />
        <DsMediaCard kind="audio" title="Latihan mendengar Bab 2" duration="6:10" category="Audio" />
      </div>
      <DsProse>
        <h2>Tajuk Bahagian</h2>
        <p>Perenggan contoh dengan <strong>penekanan</strong> dan <span>pautan</span>.</p>
        <ul><li>Butir pertama</li><li>Butir kedua</li></ul>
        <blockquote>Petikan ringkas pada latar timbul.</blockquote>
      </DsProse>
      <DsAudioPlayer src="/audio/contoh.mp3" title="Latihan mendengar Bab 2" transcript="Transkrip contoh untuk audio ini." />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-shop">
      <h3 id="w-shop" class="text-subheading">DsShopCard, DsBadgeTile, DsGameTile</h3>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <DsShopCard name="Pensel Edisi Khas" :price="120" art="books" stock="Baki 3" action-label="Tebus" />
        <DsShopCard name="Topi Graduasi" :price="900" art="cap" action-label="Tebus" disabled-reason="Koin tidak cukup" />
        <DsBadgeTile title="Juara Mingguan" date="1 Okt 2026" is-new />
        <DsBadgeTile state="locked" title="Pakar Pecahan" />
        <DsBadgeTile state="progress" title="Rentetan 30 Hari" :progress="60" />
        <DsGameTile name="Roda Nasib" art="party" mode="Solo" />
        <DsGameTile name="Cabaran Kelas" icon="i-ph-sword-duotone" mode="Kumpulan" live-label="LANGSUNG" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-wheel">
      <h3 id="w-wheel" class="text-subheading">DsWheel, DsLevelMap</h3>
      <DsWheel label="Roda Nasib">
        <template #prize><DsArt3D name="party" size="hero" /></template>
        <template #result><p class="text-heading">+50 mata!</p></template>
      </DsWheel>
      <DsLevelMap label="Peta tahap" :levels="levels">
        <template #detail="{ level }"><p class="text-body">{{ level.label }}: 3 daripada 5 latihan siap.</p></template>
      </DsLevelMap>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="w-print">
      <h3 id="w-print" class="text-subheading">DsPrintSheet, DsArt3D plain</h3>
      <DsPrintSheet print-label="Cetak">
        <h2 class="text-heading">Laporan Contoh</h2>
        <p class="text-body">Kandungan lembaran A4 sentiasa menggunakan token cerah.</p>
      </DsPrintSheet>
      <div class="w-48"><DsArt3D variant="plain" :src="coinUrl" alt="Gambar contoh" ratio="video" /></div>
    </section>
  </div>
</template>
