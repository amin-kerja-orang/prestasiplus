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
  DsNativeSelect,
  DsRtlScope,
} from '@/ds'

const tahap = ref('')
const file = ref<File | File[] | null>(null)
const saving = ref(false)
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
