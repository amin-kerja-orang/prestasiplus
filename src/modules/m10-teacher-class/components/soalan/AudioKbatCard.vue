<script setup lang="ts">
/**
 * S21 cards "Sumbang Set Audio KBAT / Ujian Mendengar" (FN-M10-7.1.6) and the static "AI
 * Auto-Generate Soalan" (FN-M10-7.1.7, DV-M10-10: no link, button or form, as live). The two template
 * links download a file (contract #63; live answers 200 with the file) and "Cipta Set" / "Senarai Set"
 * go to S26 / S25.
 */
import { FileSpreadsheet, FileText, Headphones, List, Plus, Sparkles } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { saveBlob } from '@/lib/save-blob'

import { downloadAudioKbatTemplate } from '../../api/guru'

async function download(format: 'xlsx' | 'word', fallback: string): Promise<void> {
  try {
    const res = await downloadAudioKbatTemplate(format)
    saveBlob(res.blob, res.filename ?? fallback)
  } catch {
    // A failed download does nothing visible, as a dead live link would.
  }
}

const LINK =
  'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white'
</script>

<template>
  <div class="min-w-0 space-y-4">
    <section
      class="min-w-0 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-4 text-white shadow-sm sm:p-5"
      data-testid="audio-kbat-card"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <Headphones class="mt-1 h-6 w-6 shrink-0 text-white/80" />
          <div class="min-w-0">
            <h2 class="text-sm font-bold text-white sm:text-base">
              Sumbang Set Audio KBAT / Ujian Mendengar
            </h2>
            <p class="text-sm text-indigo-100">
              Format khas fixed sequence: 4 audio section, 30 soalan MCQ, skema A-D, dan transkrip
              untuk semakan admin.
            </p>
            <p class="text-sm text-indigo-100">
              Sesuai untuk bahan cikgu seperti audio soalan 1-8, 9-16, 17-24 dan 25-30.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <a
            href="/guru/audio-kbat/template"
            :class="[LINK, 'bg-white/15 hover:bg-white/25']"
            data-testid="audio-template-xlsx"
            @click.prevent="download('xlsx', 'template-audio-kbat.xlsx')"
          >
            <FileSpreadsheet class="h-4 w-4" />
            Template XLSX
          </a>
          <a
            href="/guru/audio-kbat/template-word"
            :class="[LINK, 'bg-white/15 hover:bg-white/25']"
            data-testid="audio-template-word"
            @click.prevent="download('word', 'template-audio-kbat.docx')"
          >
            <FileText class="h-4 w-4" />
            Template Word
          </a>
          <RouterLink
            to="/guru/audio-kbat/create"
            :class="[LINK, 'bg-amber-400 text-slate-900 hover:bg-amber-300']"
            data-testid="audio-create"
          >
            <Plus class="h-4 w-4" />
            Cipta Set
          </RouterLink>
          <RouterLink
            to="/guru/audio-kbat"
            :class="[LINK, 'bg-white text-indigo-700 hover:bg-indigo-50']"
            data-testid="audio-list"
          >
            <List class="h-4 w-4" />
            Senarai Set
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5" data-testid="ai-card">
      <div class="flex min-w-0 items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-fuchsia-100 text-fuchsia-600"
        >
          <Sparkles class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-bold text-slate-800 sm:text-base">AI Auto-Generate Soalan</h2>
          <p class="text-sm text-slate-500">Upload dokumen DOCX/PDF, AI extract soalan automatik</p>
        </div>
      </div>
    </section>
  </div>
</template>
