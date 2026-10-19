<script setup lang="ts">
/**
 * One card of "Soalan Saya" (FR-M10-96, 97; FN-M10-7.1.8, 7.1.9). Clicking the head toggles it open:
 * the question, options "A." … "D." (correct highlighted), "Penjelasan", footer "#{id}", source and
 * "Aktif", and the actions "Edit" (→ S24) and "Padam" (the owner confirms and deletes).
 */
import { DsPanel, DsStack, DsCluster, DsText } from '@/ds'
import { ref } from 'vue'

import { formatDateEn } from '@/lib/time'

import type { ContributedQuestion } from '../../api/types'
import { OPTION_LETTERS } from './lib'

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
        <DsText variant="label" tone="highlighted" :clamp="2" wrap="anywhere" class="block">
          {{ question.questionText }}
        </DsText>
        <span class="mt-2 flex flex-wrap items-center gap-2">
          <UBadge color="neutral" variant="subtle" data-testid="chip-subject">{{
            question.subjectName
          }}</UBadge>
          <UBadge color="neutral" variant="subtle" data-testid="chip-level">{{
            question.levelName
          }}</UBadge>
          <UBadge color="neutral" variant="subtle" data-testid="chip-difficulty">{{
            question.difficultyLabel
          }}</UBadge>
          <UBadge
            v-if="question.dskpTagged"
            color="primary"
            variant="subtle"
            icon="i-ph-check-circle-duotone"
            data-testid="chip-dskp"
            >DSKP</UBadge
          >
          <UBadge
            v-if="question.status === 'approved'"
            color="success"
            variant="subtle"
            icon="i-ph-check-circle-duotone"
            data-testid="chip-status"
            >{{ question.statusLabel }}</UBadge
          >
          <UBadge
            v-else
            color="warning"
            variant="subtle"
            icon="i-ph-hourglass-duotone"
            data-testid="chip-status"
            >{{ question.statusLabel }}</UBadge
          >
          <DsText variant="caption" as="span" data-testid="question-date">
            {{ formatDateEn(question.createdAt) }}
          </DsText>
        </span>
      </UButton>

      <div v-if="open" class="mt-4 flex min-w-0 flex-col gap-3" data-testid="question-body">
        <DsText variant="body" wrap="anywhere" class="min-w-0">{{ question.questionText }}</DsText>
        <DsStack v-if="question.options" as="ul" gap="xs">
          <li
            v-for="(opt, i) in question.options"
            :key="i"
            class="min-w-0"
            :data-correct="question.correctAnswer === i ? 'true' : 'false'"
            data-testid="question-option"
          >
            <DsPanel tone="inset">
              <DsCluster gap="xs" align="start" :wrap="false">
                <DsText variant="body" as="span" wrap="anywhere" class="min-w-0 grow"
                  ><strong>{{ OPTION_LETTERS[i] }}.</strong> {{ opt }}</DsText
                >
                <UBadge
                  v-if="question.correctAnswer === i"
                  color="success"
                  variant="subtle"
                  icon="i-ph-check-circle-duotone"
                  >Betul</UBadge
                >
              </DsCluster>
            </DsPanel>
          </li>
        </DsStack>
        <DsPanel v-if="question.explanation" tone="inset" data-testid="question-explanation">
          <p class="mb-1 flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-lightbulb-duotone" class="size-4 text-primary-t" />
            Penjelasan
          </p>
          <DsText variant="body" wrap="anywhere">{{ question.explanation }}</DsText>
        </DsPanel>
        <DsCluster justify="between">
          <div class="flex flex-wrap items-center gap-3 text-caption text-muted">
            <span class="inline-flex items-center gap-1" data-testid="question-id">
              <UIcon name="i-ph-hash" class="size-4" />{{ question.id }}
            </span>
            <span v-if="question.source" class="inline-flex items-center gap-1 break-all">
              <UIcon name="i-ph-database-duotone" class="size-4" />{{ question.source }}
            </span>
            <span class="inline-flex items-center gap-1">
              <UIcon
                :name="question.isActive ? 'i-ph-eye-duotone' : 'i-ph-eye-slash-duotone'"
                class="size-4"
              />
              {{ question.isActive ? 'Aktif' : 'Tidak Aktif' }}
            </span>
          </div>
          <DsCluster gap="xs" align="stretch" :wrap="false">
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
          </DsCluster>
        </DsCluster>
      </div>
    </DsPanel>
  </li>
</template>
