<script setup lang="ts">
/**
 * One of the 4 section cards of S13 (FN-M09-5.2.4, FR-M09-68): "Bahagian {n} · Soalan {a}-{b}", the
 * note, "Tajuk Audio" (prefilled "Audio n"), "Fail Audio" (optional, live `accept`) and "Transkrip
 * Audio Untuk Audit". The state object belongs to the parent form.
 */
import { AUDIO_ACCEPT, type SectionState } from '../../lib/admin-media/audio'
import AdminField from '../admin-kit/AdminField.vue'
import AdminSection from '../admin-kit/AdminSection.vue'
import NativeFile from '../admin-kit/native/NativeFile.vue'

defineProps<{ no: number; from: number; to: number }>()

const section = defineModel<SectionState>({ required: true })

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  section.value.audio = input.files?.[0] ?? null
}
</script>

<template>
  <div data-testid="section-card" :data-section-no="no">
    <AdminSection
      :title="`Bahagian ${String(no)} · Soalan ${String(from)}-${String(to)}`"
      description="Audio section ini akan kekal bersama semua soalan dalam range ini."
      icon="i-ph-headphones"
      accent="heat"
    >
      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AdminField :for="`s${String(no)}-title`" label="Tajuk Audio">
          <UInput
            :id="`s${String(no)}-title`"
            v-model="section.title"
            type="text"
            :name="`sections[${String(no)}][title]`"
            size="md"
            class="w-full"
            data-testid="section-title"
          />
        </AdminField>
        <AdminField :for="`s${String(no)}-audio`" label="Fail Audio">
          <div class="flex min-w-0 flex-wrap items-center gap-3">
            <NativeFile
              :id="`s${String(no)}-audio`"
              :name="`sections[${String(no)}][audio]`"
              :accept="AUDIO_ACCEPT"
              input-testid="section-audio"
              @change="onFile"
            >
              <UIcon name="i-ph-upload-simple" class="size-5" aria-hidden="true" />
              Pilih fail
            </NativeFile>
            <span class="min-w-0 truncate text-caption text-muted" data-testid="section-audio-name">
              {{ section.audio ? section.audio.name : 'Tiada fail dipilih' }}
            </span>
          </div>
        </AdminField>
      </div>
      <AdminField :for="`s${String(no)}-transcript`" label="Transkrip Audio Untuk Audit">
        <UTextarea
          :id="`s${String(no)}-transcript`"
          v-model="section.transcript"
          :name="`sections[${String(no)}][transcript]`"
          :rows="3"
          placeholder="Wajib digalakkan untuk semakan admin."
          size="md"
          class="w-full"
          data-testid="section-transcript"
        />
      </AdminField>
    </AdminSection>
  </div>
</template>
