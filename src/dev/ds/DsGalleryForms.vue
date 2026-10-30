<script setup lang="ts">
/**
 * Form building blocks in the `/__ds` gallery (T0a): DsFormField (default and native), DsFormSection,
 * DsNativeSelect, DsFileField, DsRtlScope and DsFormBar. Dev / demo only; sample copy is BM and
 * names are fictitious.
 */
import { ref } from 'vue'

import {
  DsFileField,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsFilterBar,
  DsNativeSelect,
  DsRtlScope,
  DsSwitchField,
} from '@/ds'

const tahap = ref('')
const file = ref<File | File[] | null>(null)
const saving = ref(false)
const pick = ref('5')
const longPick = ref('')
const auto = ref(true)
const auto2 = ref(false)
const years = [
  { label: 'Tahun 4', value: '4' },
  { label: 'Tahun 5', value: '5' },
  { label: 'Tahun 6', value: '6', disabled: true },
  { label: 'Tingkatan 4', value: 'f4' },
]
const many = Array.from({ length: 24 }, (_, i) => ({ label: `Sekolah Contoh ${i + 1}`, value: String(i + 1) }))
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="gallery-forms">
    <h2 class="text-heading">Borang (DsForm*)</h2>

    <DsFormSection
      title="Maklumat Asas"
      description="Medan wajib bertanda bintang."
      icon="i-ph-user"
      :columns="2"
    >
      <DsFormField label="Nama Penuh" name="nama" required hint="Seperti dalam kad pengenalan">
        <UInput class="w-full" placeholder="Murid Contoh" />
      </DsFormField>
      <DsFormField label="E-mel" name="email" error="E-mel sudah digunakan">
        <UInput class="w-full" type="email" />
      </DsFormField>
      <DsFormField v-slot="{ id, describedby, invalid }" label="Tahap" native required>
        <DsNativeSelect
          :id="id"
          v-model="tahap"
          :aria-describedby="describedby"
          :invalid="invalid"
          blank
          required
          :items="[
            { label: 'Tahun 4', value: '4' },
            { label: 'Tahun 5', value: '5' },
          ]"
        />
      </DsFormField>
      <DsFormField v-slot="{ id, invalid }" label="Tahap (ralat)" native error="Sila pilih tahap">
        <DsNativeSelect :id="id" model-value="" :invalid="invalid" blank />
      </DsFormField>
    </DsFormSection>

    <DsFormSection title="Pilihan (DsNativeSelect / DsSelect)" description="Senarai tersuai: caret berpadding, baris 40px+, tanda semak." :columns="2">
      <DsFormField v-slot="{ id }" label="Tahap (items)" native>
        <DsNativeSelect :id="id" v-model="pick" :items="years" data-testid="gal-select" />
      </DsFormField>
      <DsFormField v-slot="{ id }" label="Slot option + blank" native>
        <DsNativeSelect :id="id" v-model="longPick" data-testid="gal-select-slot">
          <option value="">Semua Negeri</option>
          <option v-for="n in ['Johor', 'Kedah', 'Selangor']" :key="n" :value="n">{{ n }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" label="Boleh dicari (searchable)" native>
        <DsNativeSelect :id="id" v-model="longPick" searchable blank :items="many" />
      </DsFormField>
      <DsFormField v-slot="{ id }" label="Natif (cetak)" native>
        <DsNativeSelect :id="id" v-model="pick" native :items="years" />
      </DsFormField>
      <DsFormField v-slot="{ id }" label="Baca sahaja / dimuatkan" native>
        <DsNativeSelect :id="id" v-model="pick" readonly :items="years" />
      </DsFormField>
      <DsFormField v-slot="{ id }" label="Dilumpuhkan" native>
        <DsNativeSelect :id="id" v-model="pick" disabled :items="years" />
      </DsFormField>
    </DsFormSection>

    <DsFormSection title="Suis dengan label (DsSwitchField)" icon="i-ph-toggle-right" :columns="2">
      <DsSwitchField v-model="auto" label="Muat semula automatik" data-testid="gal-switch" />
      <DsSwitchField v-model="auto2" label="Aktifkan akaun" description="Pengguna boleh log masuk selepas diaktifkan." />
    </DsFormSection>

    <DsFilterBar :chips="[]" data-testid="gal-filterbar">
      <DsNativeSelect v-model="pick" aria-label="Tahap" :items="years" />
    </DsFilterBar>
    <DsFilterBar :chips="[]">
      <template #search><UInput class="w-full" placeholder="Cari sekolah..." icon="i-ph-magnifying-glass" aria-label="Cari" /></template>
      <DsNativeSelect v-model="pick" aria-label="Tahap" :items="years" />
      <DsNativeSelect v-model="longPick" aria-label="Negeri" blank placeholder="Semua Negeri" :items="many" />
    </DsFilterBar>

    <DsFormSection title="Gambar" icon="i-ph-image" accent="friend">
      <DsFileField
        v-model="file"
        accept="image/*"
        :max-size-mb="2"
        hint="PNG atau JPG, maksimum 2 MB"
      />
      <DsRtlScope>
        <p>بسم الله الرحمن الرحيم</p>
      </DsRtlScope>
    </DsFormSection>

    <DsFormSection title="Zon Bahaya" icon="warning" tone="error">
      <p class="text-body text-muted">Tindakan di sini tidak boleh dibatalkan.</p>
      <template #actions>
        <UButton color="error" variant="soft" label="Padam Akaun" />
      </template>
    </DsFormSection>

    <DsFormBar :sticky="false" :saving="saving" @cancel="saving = false">
      <template #status>Perubahan belum disimpan</template>
    </DsFormBar>
    <UButton
      color="neutral"
      variant="soft"
      label="Tukar keadaan menyimpan"
      class="w-fit"
      @click="saving = !saving"
    />
  </div>
</template>
