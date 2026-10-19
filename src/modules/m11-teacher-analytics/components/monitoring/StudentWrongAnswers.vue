<script setup lang="ts">
/**
 * S4 "Jawapan Salah" (FN-M11-4.2.7; FR-M11-68): one card per wrong answer, newest first, every card
 * shown (DV-M11-06).
 */
import type { StudentAnswerRow, StudentDetail } from '../../api/types'
import { dmyHm } from './monitoring-format'
import { safeHtml } from './safe-html'
import { DsCluster, DsStack, DsText } from '@/ds'

defineProps<{ wrong: StudentDetail['wrong'] }>()

const optionText = (row: StudentAnswerRow, label: string | null) =>
  row.options.find((o) => o.label === label)?.text ?? ''
</script>

<template>
  <UCard data-testid="mon-panel-wrong">
    <DsStack>
      <h2
        class="flex items-center gap-2 text-label text-highlighted"
        data-testid="mon-wrong-heading"
      >
        <UIcon name="i-ph-x-circle" class="size-5 text-error" />Jawapan Salah ({{
          wrong.count
        }}
        jawapan, {{ wrong.unique }} soalan unik)
      </h2>
      <DsStack gap="sm">
        <article
          v-for="(r, i) in wrong.rows"
          :key="`${String(r.questionId)}-${String(i)}`"
          class="flex flex-col gap-2 bg-soft p-3"
          data-testid="mon-wrong-card"
        >
          <div class="flex flex-wrap items-start justify-between gap-x-3 text-caption text-muted">
            <span class="min-w-0 break-words"
              >#{{ i + 1 }} · {{ r.subjectName
              }}<template v-if="r.chapterLabel"> · {{ r.chapterLabel }}</template></span
            >
            <span class="tabular">{{ dmyHm(r.answeredAt) }}</span>
          </div>
          <!-- eslint-disable-next-line vue/no-v-html -->
          <div class="text-body break-words text-highlighted" v-html="safeHtml(r.html)" />
          <div class="flex items-center justify-between gap-2 bg-default p-3 text-body">
            <DsCluster as="span" gap="xs" :wrap="false"
              ><UBadge color="success" variant="solid" :label="r.correctLabel ?? ''" /><span
                class="min-w-0 break-words text-default"
                >{{ optionText(r, r.correctLabel) }}</span
              ></DsCluster
            >
            <DsText variant="caption" as="span" tone="success" class="shrink-0"
              >Jawapan betul</DsText
            >
          </div>
          <div class="flex items-center justify-between gap-2 bg-default p-3 text-body">
            <DsCluster as="span" gap="xs" :wrap="false"
              ><UBadge color="error" variant="solid" :label="r.selectedLabel ?? ''" /><span
                class="min-w-0 break-words text-default"
                >{{ optionText(r, r.selectedLabel) }}</span
              ></DsCluster
            >
            <DsText variant="caption" as="span" tone="error" class="shrink-0"
              >Jawapan pelajar</DsText
            >
          </div>
          <p v-if="r.explanation" class="flex items-start gap-2 text-body text-default">
            <UIcon name="i-ph-lightbulb" class="mt-1 size-4 shrink-0 text-info" /><span
              class="min-w-0 break-words"
              >{{ r.explanation }}</span
            >
          </p>
          <p v-if="r.source" class="flex items-center gap-1 text-caption text-muted">
            <UIcon name="i-ph-bookmark-simple" class="size-4" />Sumber: {{ r.source }}
          </p>
        </article>
      </DsStack>
    </DsStack>
  </UCard>
</template>
