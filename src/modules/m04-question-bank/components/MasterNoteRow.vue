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

const BUTTONS: { action: MasterNoteAction; label: string; testId: string; tone: string }[] = [
  {
    action: 'approve',
    label: 'Approve',
    testId: 'note-approve',
    tone: 'bg-emerald-500 hover:bg-emerald-600',
  },
  {
    action: 'regen',
    label: 'Regenerate',
    testId: 'note-regen',
    tone: 'bg-amber-500 hover:bg-amber-600',
  },
  {
    action: 'unflag',
    label: 'Clear Flag',
    testId: 'note-unflag',
    tone: 'bg-gray-500 hover:bg-gray-600',
  },
]

const state = reactive<Record<MasterNoteAction, ButtonState>>({
  approve: 'idle',
  regen: 'idle',
  unflag: 'idle',
})

const dimmed = computed(() => Object.values(state).includes('done'))

function labelOf(action: MasterNoteAction, label: string): string {
  if (state[action] === 'pending') return '...'
  if (state[action] === 'done') return 'Done'
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
  <article
    class="space-y-2 rounded-2xl bg-white p-3 shadow sm:p-4"
    :class="dimmed ? 'opacity-50' : ''"
    data-testid="note-row"
    :data-note-id="note.id"
    :data-question-id="note.questionId"
  >
    <p class="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500">
      <span><strong>question_id:</strong> {{ note.questionId }} ·</span>
      <span><strong>subject:</strong> {{ note.subjectName }} ·</span>
      <span><strong>chapter:</strong> {{ note.chapter ?? '—' }} ·</span>
      <span><strong>model:</strong> {{ note.model }} ·</span>
      <span><strong>tokens:</strong> {{ note.tokens }} ·</span>
      <span
        class="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-700"
        data-testid="note-conf"
        >conf {{ note.confidence }}</span
      >
    </p>
    <p
      class="rounded-lg bg-slate-50 px-3 py-2 text-sm break-words text-slate-600"
      data-testid="note-question"
    >
      <strong>Soalan:</strong> {{ cutText(note.questionText, 200) }}
    </p>
    <p
      class="rounded-lg bg-blue-50 px-3 py-2 text-sm break-words text-slate-700"
      data-testid="note-text"
    >
      {{ note.noteText }}
    </p>
    <p
      class="rounded-lg bg-yellow-100 px-3 py-2 text-sm break-words text-slate-700"
      data-testid="note-trap"
    >
      <strong>Trap:</strong> {{ note.trapText }}
    </p>
    <div class="flex flex-wrap gap-2 pt-1">
      <button
        v-for="b in BUTTONS"
        :key="b.action"
        type="button"
        :disabled="state[b.action] !== 'idle'"
        :class="[
          'inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-1.5 text-sm font-bold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:cursor-default',
          b.tone,
        ]"
        :data-testid="b.testId"
        :data-action="b.action"
        @click="run(b.action)"
      >
        {{ labelOf(b.action, b.label) }}
      </button>
    </div>
  </article>
</template>
