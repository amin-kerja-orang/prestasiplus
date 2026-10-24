<script setup lang="ts">
/**
 * One of the 4 section cards of S13 (FN-M09-5.2.4, FR-M09-68): "Bahagian {n} · Soalan {a}-{b}", the
 * note, "Tajuk Audio" (prefilled "Audio n"), "Fail Audio" (optional, live `accept`) and "Transkrip
 * Audio Untuk Audit". The state object belongs to the parent form.
 */
import { computed } from 'vue'

import { DsFileField, DsFormField, DsFormSection } from '@/ds'

import { AUDIO_ACCEPT, type SectionState } from '../../lib/admin-media/audio'

defineProps<{ no: number; from: number; to: number }>()

const section = defineModel<SectionState>({ required: true })

/** The picked file as the `DsFileField` model (one file or none). */
const audio = computed<File | null>({
  get: () => section.value.audio,
  set: (file) => {
    section.value.audio = file
  },
})
</script>

<template>
  <div data-testid="section-card" :data-section-no="no">
    <DsFormSection
      :title="`Bahagian ${String(no)} · Soalan ${String(from)}-${String(to)}`"
      description="Bahagian audio ini akan kekal bersama semua soalan dalam julat ini."
      icon="headphones"
      accent="heat"
      :columns="2"
    >
      <DsFormField native :for="`s${String(no)}-title`" label="Tajuk Audio">
        <template #default="{ id }">
          <UInput
            :id="id"
            v-model="section.title"
            type="text"
            :name="`sections[${String(no)}][title]`"
            class="w-full"
            data-testid="section-title"
          />
        </template>
      </DsFormField>
      <DsFormField native :for="`s${String(no)}-audio`" label="Fail Audio">
        <template #default>
          <DsFileField
            v-model="audio"
            :name="`sections[${String(no)}][audio]`"
            :accept="AUDIO_ACCEPT"
            preview="none"
            label="Pilih fail"
            data-testid="section-audio"
          />
          <span class="min-w-0 truncate text-caption text-muted" data-testid="section-audio-name">
            {{ section.audio ? section.audio.name : 'Tiada fail dipilih' }}
          </span>
        </template>
      </DsFormField>
      <div class="sm:col-span-2">
        <DsFormField native :for="`s${String(no)}-transcript`" label="Transkrip Audio Untuk Audit">
          <template #default="{ id }">
            <UTextarea
              :id="id"
              v-model="section.transcript"
              :name="`sections[${String(no)}][transcript]`"
              :rows="3"
              placeholder="Wajib digalakkan untuk semakan admin."
              class="w-full"
              data-testid="section-transcript"
            />
          </template>
        </DsFormField>
      </div>
    </DsFormSection>
  </div>
</template>
