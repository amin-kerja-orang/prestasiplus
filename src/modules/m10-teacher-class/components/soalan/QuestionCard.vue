<script setup lang="ts">
/**
 * One card of "Soalan Saya" (44-F2; FR-M10-96, 97; FR-GUR-44-10). Clicking the head toggles it open:
 * the question, options "A." … "D." (correct highlighted), "Penjelasan", footer "#{id}"
 * and the actions "Edit" (→ S24) and "Padam" (the owner confirms and deletes), which show only
 * while the server says the item is `editable`. The status chip says Menunggu Semakan / Diluluskan / Ditolak and a
 * rejected item shows "Sebab: {reason}".
 */
import { DsPanel, DsStatusBadge, DsText } from '@/ds'
import { ref } from 'vue'

import { formatDateEn } from '@/lib/time'

import type { ContributedQuestion } from '../../api/types'
import {
  difficultyStars,
  difficultyWord,
  OPTION_LETTERS,
  rejectionLine,
  STATUS_BADGE,
  STATUS_WORDS,
} from './lib'

defineProps<{ question: ContributedQuestion; deleting?: boolean }>()
const emit = defineEmits<{ remove: [id: number] }>()

const open = ref(false)
</script>

<template>
  <li class="min-w-0" :data-question-id="question.id" data-testid="question-card">
    <DsPanel>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        block
        class="h-auto min-h-11 justify-start p-0 text-left whitespace-normal"
        :aria-expanded="open"
        data-testid="question-toggle"
        @click="open = !open"
      >
        <span class="line-clamp-2 block min-w-0 text-label break-words text-highlighted">
          {{ question.questionText }}
        </span>
        <span class="mt-2 flex flex-wrap items-center gap-2">
          <UBadge color="neutral" variant="subtle" data-testid="chip-subject">{{
            question.subjectName
          }}</UBadge>
          <UBadge color="neutral" variant="subtle" data-testid="chip-level">{{
            question.levelName
          }}</UBadge>
          <UBadge
            color="neutral"
            variant="subtle"
            :aria-label="`Kesukaran: ${difficultyWord(question.difficultyLevel)}`"
            :title="difficultyWord(question.difficultyLevel)"
            data-testid="chip-difficulty"
            >{{ difficultyStars(question.difficultyLevel) }}</UBadge
          >
          <UBadge
            v-if="question.dskpTagged"
            color="primary"
            variant="subtle"
            icon="i-ph-check-circle-duotone"
            data-testid="chip-dskp"
            >DSKP</UBadge
          >
          <DsStatusBadge
            :status="STATUS_BADGE[question.status]"
            :label="STATUS_WORDS[question.status]"
            :emphasis="question.status === 'rejected' ? 'strong' : 'soft'"
            :data-status-word="question.status"
            data-testid="chip-status"
          />
          <span class="text-caption text-muted" data-testid="question-date">
            {{ formatDateEn(question.createdAt) }}
          </span>
        </span>
      </UButton>

      <DsText
        v-if="question.status === 'rejected' && question.rejectionReason"
        variant="body"
        tone="error"
        wrap="anywhere"
        data-testid="question-reason"
        >{{ rejectionLine(question.rejectionReason) }}</DsText
      >

      <div v-if="open" class="mt-4 flex min-w-0 flex-col gap-3" data-testid="question-body">
        <p class="min-w-0 text-body break-words text-default">{{ question.questionText }}</p>
        <ul v-if="question.options" class="flex flex-col gap-2">
          <li
            v-for="(opt, i) in question.options"
            :key="i"
            class="min-w-0"
            :data-correct="question.correctAnswer === i ? 'true' : 'false'"
            data-testid="question-option"
          >
            <DsPanel tone="inset">
              <div class="flex min-w-0 items-start gap-2">
                <span class="min-w-0 grow text-body break-words text-default"
                  ><strong>{{ OPTION_LETTERS[i] }}.</strong> {{ opt }}</span
                >
                <UBadge
                  v-if="question.correctAnswer === i"
                  color="success"
                  variant="subtle"
                  icon="i-ph-check-circle-duotone"
                  >Betul</UBadge
                >
              </div>
            </DsPanel>
          </li>
        </ul>
        <DsPanel v-if="question.explanation" tone="inset" data-testid="question-explanation">
          <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-lightbulb-duotone" class="size-4 text-primary-t" />
            Penjelasan
          </p>
          <p class="text-body break-words text-default">{{ question.explanation }}</p>
        </DsPanel>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-3 text-caption text-muted">
            <span class="inline-flex items-center gap-1" data-testid="question-id">
              <UIcon name="i-ph-hash" class="size-4" />{{ question.id }}
            </span>
          </div>
          <div v-if="question.editable" class="flex gap-2" data-testid="question-actions">
            <UButton
              :to="`/guru/soalan/${String(question.id)}/edit`"
              color="neutral"
              variant="soft"
              icon="i-ph-pencil-simple-duotone"
              class="min-h-11"
              data-testid="question-edit"
              >Edit</UButton
            >
            <UButton
              type="button"
              color="error"
              variant="soft"
              icon="i-ph-trash-duotone"
              class="min-h-11"
              :disabled="deleting"
              data-testid="question-delete"
              @click="emit('remove', question.id)"
              >Padam</UButton
            >
          </div>
        </div>
      </div>
    </DsPanel>
  </li>
</template>
