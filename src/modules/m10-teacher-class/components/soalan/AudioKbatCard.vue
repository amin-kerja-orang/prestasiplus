<script setup lang="ts">
/**
 * S21 cards "Sumbang Set Audio KBAT / Ujian Mendengar" (FN-M10-7.1.6) and the static "AI
 * Auto-Generate Soalan" (FN-M10-7.1.7, DV-M10-10: no link, button or form, as live). The two template
 * links download a file (contract #63; live answers 200 with the file) and "Cipta Set" / "Senarai Set"
 * go to S26 / S25.
 */
import { DsIconChip, DsPanel, DsStack, DsCluster, DsHeading, DsText } from '@/ds'
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
  <DsStack>
    <DsPanel data-testid="audio-kbat-card">
      <DsCluster justify="between">
        <DsCluster align="start" :wrap="false">
          <DsIconChip icon="headphones" size="lg" />
          <div class="min-w-0">
            <DsHeading :level="2" variant="subheading">
              Sumbang Set Audio KBAT / Ujian Mendengar
            </DsHeading>
            <DsText variant="body" tone="muted">
              Format khas fixed sequence: 4 audio section, 30 soalan MCQ, skema A-D, dan transkrip
              untuk semakan admin.
            </DsText>
            <DsText variant="body" tone="muted">
              Sesuai untuk bahan cikgu seperti audio soalan 1-8, 9-16, 17-24 dan 25-30.
            </DsText>
          </div>
        </DsCluster>
        <DsCluster gap="xs" align="stretch">
          <UButton
            href="/guru/audio-kbat/template"
            color="neutral"
            variant="soft"
            icon="i-ph-file-xls-duotone"
            class="min-h-11"
            data-testid="audio-template-xlsx"
            @click.prevent="download('xlsx', 'template-audio-kbat.xlsx')"
            >Template XLSX</UButton
          >
          <UButton
            href="/guru/audio-kbat/template-word"
            color="neutral"
            variant="soft"
            icon="i-ph-file-doc-duotone"
            class="min-h-11"
            data-testid="audio-template-word"
            @click.prevent="download('word', 'template-audio-kbat.docx')"
            >Template Word</UButton
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
        </DsCluster>
      </DsCluster>
    </DsPanel>

    <DsPanel data-testid="ai-card">
      <DsCluster :wrap="false">
        <DsIconChip icon="sparkle" size="lg" />
        <div class="min-w-0">
          <DsHeading :level="2" variant="subheading">AI Auto-Generate Soalan</DsHeading>
          <DsText variant="body" tone="muted"
            >Upload dokumen DOCX/PDF, AI extract soalan automatik</DsText
          >
        </div>
      </DsCluster>
    </DsPanel>
  </DsStack>
</template>
