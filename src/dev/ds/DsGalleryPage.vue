<script setup lang="ts">
/**
 * Page chrome in the `/__ds` gallery (T0b): DsPageHeader (all slots), DsBackLink, DsBreadcrumb,
 * DsPillNav and the DsPanel header. Dev / demo only; sample copy is BM and names are fictitious.
 */
import { ref } from 'vue'

import { DsBackLink, DsBreadcrumb, DsPageHeader, DsPanel, DsPillNav } from '@/ds'

const tempoh = ref<string | number>('bulan')
const tempohItems = [
  { key: 'bulan', label: 'Bulan' },
  { key: 'tahun', label: 'Tahun' },
  { key: 'semua', label: 'Semua', icon: 'i-ph-calendar' },
]
const crumbs = [
  { label: 'Utama', to: '/' },
  { label: 'Kelas', to: '/' },
  { label: 'Laporan', to: '/' },
  { label: 'Bulanan' },
]
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="gallery-page">
    <h2 class="text-heading">Kepala halaman (DsPageHeader)</h2>

    <DsPanel>
      <DsPageHeader title="Senarai Pengguna" subtitle="Urus akaun guru dan murid." :show-title="true">
        <template #breadcrumb><DsBreadcrumb :items="crumbs" /></template>
        <template #actions>
          <UButton color="neutral" variant="soft" label="Muat Turun" />
          <UButton variant="solid" icon="i-ph-plus" label="Tambah Pengguna" />
        </template>
        <template #meta>
          <UBadge color="neutral" variant="soft" label="248 pengguna" />
        </template>
        <template #tabs>
          <DsPillNav
            :items="tempohItems"
            :active="tempoh"
            label="Tempoh"
            testid-prefix="demo"
            @select="tempoh = $event"
          />
        </template>
      </DsPageHeader>
    </DsPanel>

    <DsPanel>
      <DsPageHeader
        title="Sunting Pengguna"
        subtitle="Dengan pautan kembali dan pimpinan."
        back-to="/"
        :show-title="true"
      >
        <template #leading>
          <UAvatar text="MC" size="lg" />
        </template>
      </DsPageHeader>
    </DsPanel>

    <DsPanel title="Panel dengan tajuk" description="Tajuk, penerangan dan tindakan" icon="i-ph-chart-bar">
      <template #actions>
        <DsBackLink to="/" />
      </template>
      <p class="text-body text-muted">Kandungan panel.</p>
    </DsPanel>
  </div>
</template>
