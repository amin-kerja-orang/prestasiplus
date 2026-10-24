<script setup lang="ts">
/**
 * One master note of S12 (FN-M04-5.3.4..5.3.6): meta line with the "conf n" badge, "Soalan:" box, the
 * note, the yellow "Trap:" box and the three buttons. A click disables the button and calls the API at
 * once (no confirm), label "..." while waiting. An HTTP 2xx dims the row to 50% and the clicked button
 * reads "Done" and stays disabled; a failure restores the label and re-enables it (FR-M04-104). The
 * response body is never read.
 */
import { computed, reactive } from 'vue'

import { actOnMasterNote, type MasterNoteAction, type MasterNoteRow } from '../api/master-notes'
import { cutText } from '../lib/audit-format'

const props = defineProps<{ note: MasterNoteRow }>()

type ButtonState = 'idle' | 'pending' | 'done'

const BUTTONS: {
  action: MasterNoteAction
  label: string
  testId: string
  color: 'success' | 'warning' | 'neutral'
}[] = [
  { action: 'approve', label: 'Luluskan', testId: 'note-approve', color: 'success' },
  { action: 'regen', label: 'Jana Semula', testId: 'note-regen', color: 'warning' },
  { action: 'unflag', label: 'Buang Tanda', testId: 'note-unflag', color: 'neutral' },
]

const state = reactive<Record<MasterNoteAction, ButtonState>>({
  approve: 'idle',
  regen: 'idle',
  unflag: 'idle',
})

const dimmed = computed(() => Object.values(state).includes('done'))

function labelOf(action: MasterNoteAction, label: string): string {
  if (state[action] === 'pending') return '...'
  if (state[action] === 'done') return 'Selesai'
  return label
}

async function run(action: MasterNoteAction): Promise<void> {
  if (state[action] !== 'idle') return
  state[action] = 'pending'
  try {
    await actOnMasterNote(props.note.id, action)
    state[action] = 'done'
  } catch {
    state[action] = 'idle'
  }
}
</script>

<template>
  <UCard
    :variant="dimmed ? 'subtle' : 'outline'"
    data-testid="note-row"
    :data-dimmed="dimmed ? 'true' : 'false'"
    :data-note-id="note.id"
    :data-question-id="note.questionId"
  >
    <article class="flex flex-col gap-3" :class="dimmed ? 'text-dimmed' : ''">
      <p class="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
        <span><strong>question_id:</strong> {{ note.questionId }} ·</span>
        <span><strong>subject:</strong> {{ note.subjectName }} ·</span>
        <span><strong>chapter:</strong> {{ note.chapter ?? '—' }} ·</span>
        <span><strong>model:</strong> {{ note.model }} ·</span>
        <span><strong>tokens:</strong> {{ note.tokens }} ·</span>
        <UBadge
          color="success"
          variant="subtle"
          :label="`conf ${note.confidence}`"
          data-testid="note-conf"
        />
      </p>
      <p class="text-body break-words text-muted" data-testid="note-question">
        <strong>Soalan:</strong> {{ cutText(note.questionText, 200) }}
      </p>
      <UCard variant="subtle">
        <p class="text-body break-words text-default" data-testid="note-text">
          {{ note.noteText }}
        </p>
      </UCard>
      <UAlert color="warning" variant="subtle" icon="i-ph-warning" data-testid="note-trap">
        <template #description>
          <span class="break-words"><strong>Perangkap:</strong> {{ note.trapText }}</span>
        </template>
      </UAlert>
      <div class="flex flex-wrap gap-2 pt-1">
        <UButton
          v-for="b in BUTTONS"
          :key="b.action"
          type="button"
          :color="b.color"
          :variant="b.action === 'approve' ? 'solid' : 'soft'"
          :disabled="state[b.action] !== 'idle'"
          class="min-h-11"
          :data-testid="b.testId"
          :data-action="b.action"
          @click="run(b.action)"
        >
          {{ labelOf(b.action, b.label) }}
        </UButton>
      </div>
    </article>
  </UCard>
</template>
