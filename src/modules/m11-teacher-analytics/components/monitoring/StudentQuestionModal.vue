<script setup lang="ts">
/**
 * S4 question modal (FN-M11-4.2.10; FR-M11-71): badge Betul / Salah, subject · chapter, source / Aras /
 * time, the question HTML, the options (correct success, the pupil's wrong pick error), the "deleted
 * options" copy and the explanation. Closes with the footer button, Esc or a click outside.
 */
import { computed } from 'vue'

import { DsDialog, DsStack, DsCluster, DsHeading, DsText } from '@/ds'

import type { StudentAnswerRow } from '../../api/types'
import { rawTime, type UiColor } from './monitoring-format'
import { safeHtml } from './safe-html'

const props = defineProps<{ row: StudentAnswerRow | null }>()
const emit = defineEmits<{ close: [] }>()

const open = computed({
  get: () => props.row !== null,
  set: (v: boolean) => {
    if (!v) emit('close')
  },
})

function optionColor(row: StudentAnswerRow, label: string): UiColor {
  if (label === row.correctLabel) return 'success'
  if (label === row.selectedLabel) return 'error'
  return 'neutral'
}
</script>

<template>
  <DsDialog v-model:open="open" title="Soalan">
    <DsStack v-if="row" data-testid="mon-modal">
      <div class="flex flex-wrap items-center gap-2 text-caption text-muted">
        <UBadge
          :color="row.isCorrect ? 'success' : 'error'"
          variant="subtle"
          data-testid="mon-modal-result"
          :label="row.isCorrect ? 'Betul' : 'Salah'"
        />
        <span class="min-w-0 break-words" data-testid="mon-modal-subject"
          >{{ row.subjectName
          }}<template v-if="row.chapterLabel"> · {{ row.chapterLabel }}</template></span
        >
      </div>
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
        <DsCluster v-if="row.source" as="span" gap="2xs" :wrap="false"
          ><UIcon name="i-ph-bookmark-simple" class="size-4" />{{ row.source }}</DsCluster
        >
        <DsCluster as="span" gap="2xs" :wrap="false"
          ><UIcon name="i-ph-cell-signal-full" class="size-4" />Aras {{ row.difficulty }}</DsCluster
        >
        <span class="tabular flex items-center gap-1" data-testid="mon-modal-time"
          ><UIcon name="i-ph-clock" class="size-4" />{{ rawTime(row.answeredAt) }}</span
        >
      </div>
      <!-- eslint-disable vue/no-v-html -->
      <div
        class="bg-soft p-3 text-body break-words text-highlighted"
        data-testid="mon-modal-question"
        v-html="safeHtml(row.html)"
      />
      <!-- eslint-enable vue/no-v-html -->

      <DsStack gap="xs">
        <DsHeading :level="3" variant="overline" tone="muted">Pilihan Jawapan</DsHeading>
        <DsText
          v-if="row.options.length === 0"
          variant="body"
          tone="muted"
          data-testid="mon-modal-no-options"
        >
          Pilihan jawapan telah dipadam dari sistem.
        </DsText>
        <DsStack v-else gap="xs">
          <div
            v-for="o in row.options"
            :key="o.label"
            class="flex items-start gap-3 bg-soft p-3"
            data-testid="mon-modal-option"
          >
            <UBadge
              :color="optionColor(row, o.label)"
              :variant="optionColor(row, o.label) === 'neutral' ? 'subtle' : 'solid'"
              :label="o.label"
            />
            <DsStack gap="2xs">
              <DsText variant="body" wrap="anywhere">{{ o.text }}</DsText>
              <p
                v-if="o.label === row.correctLabel"
                class="flex items-center gap-1 text-caption text-success"
              >
                <UIcon name="i-ph-check-circle" class="size-3" />Jawapan Betul
              </p>
              <p
                v-else-if="o.label === row.selectedLabel"
                class="flex items-center gap-1 text-caption text-error"
              >
                <UIcon name="i-ph-x-circle" class="size-3" />Jawapan Pelajar
              </p>
            </DsStack>
          </div>
        </DsStack>
      </DsStack>

      <DsStack v-if="row.explanation" gap="2xs" data-testid="mon-modal-explanation">
        <h3 class="flex items-center gap-1 text-label text-highlighted">
          <UIcon name="i-ph-lightbulb" class="size-4 text-info" />Penjelasan
        </h3>
        <DsText variant="body" wrap="anywhere">{{ row.explanation }}</DsText>
      </DsStack>
    </DsStack>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        size="lg"
        label="Tutup"
        data-testid="mon-modal-close"
        @click="emit('close')"
      />
    </template>
  </DsDialog>
</template>
