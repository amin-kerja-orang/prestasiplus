<script setup lang="ts">
/**
 * S21 cards "Sumbang Set Audio KBAT / Ujian Mendengar" (FN-M10-7.1.6) and the static "AI
 * Auto-Generate Soalan" (FN-M10-7.1.7, DV-M10-10: no link, button or form, as live). The two template
 * links download a file (contract #63; live answers 200 with the file) and "Cipta Set" / "Senarai Set"
 * go to S26 / S25.
 */
import { DsIconChip, DsPanel } from '@/ds'
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
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4">
    <DsPanel data-testid="audio-kbat-card">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <DsIconChip icon="headphones" size="lg" />
          <div class="min-w-0">
            <h2 class="text-subheading text-highlighted">
              Sumbang Set Audio KBAT / Ujian Mendengar
            </h2>
            <p class="text-body text-muted">
              Format khas berturutan tetap: 4 bahagian audio, 30 soalan MCQ, skema A-D, dan transkrip
              untuk semakan admin.
            </p>
            <p class="text-body text-muted">
              Sesuai untuk bahan cikgu seperti audio soalan 1-8, 9-16, 17-24 dan 25-30.
            </p>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            href="/guru/audio-kbat/template"
            color="neutral"
            variant="soft"
            icon="i-ph-file-xls-duotone"
            class="min-h-11"
            data-testid="audio-template-xlsx"
            @click.prevent="download('xlsx', 'templat-audio-kbat.xlsx')"
            >Templat XLSX</UButton
          >
          <UButton
            href="/guru/audio-kbat/template-word"
            color="neutral"
            variant="soft"
            icon="i-ph-file-doc-duotone"
            class="min-h-11"
            data-testid="audio-template-word"
            @click.prevent="download('word', 'templat-audio-kbat.docx')"
            >Templat Word</UButton
          >
          <UButton
            to="/guru/audio-kbat/create"
            icon="i-ph-plus"
            class="min-h-11"
            data-testid="audio-create"
            >Cipta Set</UButton
          >
          <UButton
            to="/guru/audio-kbat"
            color="neutral"
            variant="soft"
            icon="i-ph-list-bullets-duotone"
            class="min-h-11"
            data-testid="audio-list"
            >Senarai Set</UButton
          >
        </div>
      </div>
    </DsPanel>

    <DsPanel data-testid="ai-card">
      <div class="flex min-w-0 items-center gap-3">
        <DsIconChip icon="sparkle" size="lg" />
        <div class="min-w-0">
          <h2 class="text-subheading text-highlighted">Jana Soalan Auto AI</h2>
          <p class="text-body text-muted">Muat naik dokumen DOCX/PDF, AI mengekstrak soalan secara automatik</p>
        </div>
      </div>
    </DsPanel>
  </div>
</template>
