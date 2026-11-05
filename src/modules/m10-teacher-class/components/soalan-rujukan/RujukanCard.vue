<script setup lang="ts">
/**
 * One row of the Soalan & Rujukan list (PRD-20 R1-GUR-44a): the columns Teks (120 characters), Subjek, Tahap, Kesukaran
 * (stars) and Rujukan (a link icon when set, opening in a new tab), with the actions "Edit" and "Padam". A card list, so
 * it needs no sideways scroll at 375 px.
 */
import { DsCluster, DsDefinitionList, DsPanel, DsStack, DsText } from '@/ds'
import { computed } from 'vue'

import type { PersonalQuestion } from '../../api/personal-questions-types'
import { difficultyStars, difficultyWord } from '../soalan/lib'
import { excerpt } from './form'

const props = defineProps<{ question: PersonalQuestion; levelName: string; deleting?: boolean }>()
const emit = defineEmits<{ remove: [id: number] }>()

const items = computed(() => [
  { key: 'subject', label: 'Subjek', value: props.question.subjectName },
  { key: 'level', label: 'Tahap', value: props.levelName },
  { key: 'difficulty', label: 'Kesukaran', value: difficultyStars(props.question.difficulty) },
  { key: 'link', label: 'Rujukan', value: props.question.referenceUrl },
])
</script>

<template>
  <li class="min-w-0" :data-question-id="question.id" data-testid="rujukan-card">
    <DsPanel>
      <DsStack gap="sm">
        <DsText variant="label" tone="highlighted" wrap="anywhere" data-testid="rujukan-text">{{
          excerpt(question.text)
        }}</DsText>
        <DsDefinitionList :items="items">
          <template #value-difficulty="{ item }">
            <span
              :aria-label="difficultyWord(question.difficulty)"
              :title="difficultyWord(question.difficulty)"
              data-testid="rujukan-difficulty"
              >{{ item.value }}</span
            >
          </template>
          <template #value-link>
            <UButton
              v-if="question.referenceUrl"
              :to="question.referenceUrl"
              target="_blank"
              rel="noopener noreferrer"
              color="neutral"
              variant="ghost"
              icon="i-ph-link-duotone"
              aria-label="Buka pautan rujukan"
              class="min-h-11 min-w-11"
              data-testid="rujukan-link"
            />
            <DsText v-else variant="body" tone="dimmed" data-testid="rujukan-none">-</DsText>
          </template>
        </DsDefinitionList>
        <DsCluster justify="end" data-testid="rujukan-actions">
          <UButton
            :to="`/guru/soalan-guru/${String(question.id)}/sunting`"
            color="neutral"
            variant="soft"
            icon="i-ph-pencil-simple-duotone"
            class="min-h-11"
            data-testid="rujukan-edit"
            >Edit</UButton
          >
          <UButton
            type="button"
            color="error"
            variant="soft"
            icon="i-ph-trash-duotone"
            class="min-h-11"
            :disabled="deleting"
            data-testid="rujukan-delete"
            @click="emit('remove', question.id)"
            >Padam</UButton
          >
        </DsCluster>
      </DsStack>
    </DsPanel>
  </li>
</template>
