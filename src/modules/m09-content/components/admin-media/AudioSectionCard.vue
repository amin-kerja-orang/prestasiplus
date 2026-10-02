<script setup lang="ts">
/**
 * One of the 4 section cards of S13 (FN-M09-5.2.4, FR-M09-68): "Bahagian {n} · Soalan {a}-{b}", the
 * note, "Tajuk Audio" (prefilled "Audio n"), "Fail Audio" (optional, live `accept`) and "Transkrip
 * Audio Untuk Audit". The state object belongs to the parent form.
 */
import { AUDIO_ACCEPT, type SectionState } from '../../lib/admin-media/audio'
import { INPUT_CLASS, LABEL_CLASS } from '../../lib/admin-media/common'

defineProps<{ no: number; from: number; to: number }>()

const section = defineModel<SectionState>({ required: true })

function onFile(event: Event): void {
  const input = event.target as HTMLInputElement
  section.value.audio = input.files?.[0] ?? null
}
</script>

<template>
  <section
    class="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6"
    data-testid="section-card"
    :data-section-no="no"
  >
    <div>
      <h2 class="font-heading text-lg font-bold text-slate-800">
        Bahagian {{ no }} · Soalan {{ from }}-{{ to }}
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        Audio section ini akan kekal bersama semua soalan dalam range ini.
      </p>
    </div>
    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div>
        <label :for="`s${String(no)}-title`" :class="LABEL_CLASS">Tajuk Audio</label>
        <input
          :id="`s${String(no)}-title`"
          v-model="section.title"
          type="text"
          :name="`sections[${String(no)}][title]`"
          :class="INPUT_CLASS"
          data-testid="section-title"
        />
      </div>
      <div class="min-w-0">
        <label :for="`s${String(no)}-audio`" :class="LABEL_CLASS">Fail Audio</label>
        <input
          :id="`s${String(no)}-audio`"
          type="file"
          :name="`sections[${String(no)}][audio]`"
          :accept="AUDIO_ACCEPT"
          class="block min-h-11 w-full min-w-0 rounded-xl border-2 border-slate-200 bg-white text-sm text-slate-600 file:mr-3 file:min-h-11 file:cursor-pointer file:border-0 file:bg-slate-100 file:px-4 file:text-sm file:font-semibold file:text-slate-700"
          data-testid="section-audio"
          @change="onFile"
        />
      </div>
    </div>
    <div>
      <label :for="`s${String(no)}-transcript`" :class="LABEL_CLASS"
        >Transkrip Audio Untuk Audit</label
      >
      <textarea
        :id="`s${String(no)}-transcript`"
        v-model="section.transcript"
        :name="`sections[${String(no)}][transcript]`"
        rows="3"
        placeholder="Wajib digalakkan untuk semakan admin."
        :class="INPUT_CLASS"
        data-testid="section-transcript"
      ></textarea>
    </div>
  </section>
</template>
