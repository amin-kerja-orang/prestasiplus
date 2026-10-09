<script setup lang="ts">
/**
 * "Cari Lawan Auto" of S7 (SRS M16 v1.6 FR-M16-59, FR-M16-60; URS FN-M16-5.2.1..5.2.3; §7.1). Starts #29,
 * counts "Mencari lawan... {n}s" every second, polls #30 every 3 s (matched → emit the room code; expired →
 * error; cancelled → idle; no client timeout) and cancels through #31. The error line stays visible below
 * the button until the next search (DV-M16-20). All timers stop when the card is left.
 */
import { onBeforeUnmount, ref, useId } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { FORM_SELECT_CLASS } from '@/components/form/classes'

import {
  cancelPbQuickMatch,
  pollPbQuickMatch,
  startPbQuickMatch,
  type PbQuickMatchStart,
  type RoomSubject,
} from '../../api'
import { useRoomPolling } from '../../composables/useRoomPolling'
import { PB_SUBJECTS, QM_MATCH_OPTIONS, QM_MESSAGES } from './lobby-config'

const emit = defineEmits<{ matched: [roomCode: string] }>()

const subject = ref<RoomSubject>('MATEMATIK')
const matchMode = ref<'same_grade' | 'same_level'>('same_grade')
const searching = ref(false)
const starting = ref(false)
const elapsed = ref(0)
const error = ref('')
const subjectId = useId()
const modeId = useId()

let counter: ReturnType<typeof setInterval> | null = null

const poller = useRoomPolling(async (signal) => {
  let res
  try {
    res = await pollPbQuickMatch({ signal })
  } catch {
    return // a failed poll keeps searching (no client timeout, §7.1)
  }
  if (!searching.value) return
  const body = res.body
  if (body.status === 'matched' && 'room_code' in body) {
    endSearch()
    emit('matched', body.room_code)
  } else if (body.status === 'expired') {
    endSearch()
    error.value = QM_MESSAGES.expired
  } else if (body.status === 'cancelled') {
    endSearch()
  }
})

function endSearch(): void {
  poller.stop()
  if (counter !== null) clearInterval(counter)
  counter = null
  searching.value = false
}

async function start(): Promise<void> {
  if (searching.value || starting.value) return
  error.value = ''
  starting.value = true
  try {
    const res = await startPbQuickMatch({ subject: subject.value, match_mode: matchMode.value })
    const body: PbQuickMatchStart = res.body
    if ('status' in body && body.status === 'searching') {
      elapsed.value = 0
      searching.value = true
      counter = setInterval(() => {
        elapsed.value += 1
      }, 1000)
      poller.start()
    } else {
      error.value = 'error' in body && body.error ? body.error : QM_MESSAGES.network
    }
  } catch {
    error.value = QM_MESSAGES.network
  } finally {
    starting.value = false
  }
}

async function cancel(): Promise<void> {
  endSearch()
  try {
    await cancelPbQuickMatch()
  } catch {
    /* the card is already idle; a failed cancel changes nothing on screen */
  }
}

onBeforeUnmount(endSearch)
</script>

<template>
  <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="quick-match">
    <div class="flex items-start gap-3">
      <span class="text-3xl">🔍</span>
      <div>
        <h2 class="font-heading text-lg font-bold text-slate-800">Cari Lawan Auto</h2>
        <p class="text-xs text-slate-500">Sistem cari pemain sepadan secara automatik</p>
      </div>
    </div>

    <div v-if="!searching" class="mt-4 space-y-4" data-testid="quick-match-form">
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label :for="subjectId" class="mb-1 block text-sm font-semibold text-slate-600"
            >Subjek</label
          >
          <select
            :id="subjectId"
            v-model="subject"
            :class="[FORM_SELECT_CLASS, 'min-h-11']"
            data-testid="qm-subject"
          >
            <option v-for="s in PB_SUBJECTS" :key="s.value" :value="s.value">{{ s.label }}</option>
          </select>
        </div>
        <div>
          <label :for="modeId" class="mb-1 block text-sm font-semibold text-slate-600"
            >Padanan</label
          >
          <select
            :id="modeId"
            v-model="matchMode"
            :class="[FORM_SELECT_CLASS, 'min-h-11']"
            data-testid="qm-mode"
          >
            <option v-for="o in QM_MATCH_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
      </div>
      <button
        type="button"
        :disabled="starting"
        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition bg-primary-gradient hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        data-testid="qm-start"
        @click="start"
      >
        🔍 Cari Lawan Sekarang
      </button>
      <p v-if="error" class="text-sm font-semibold text-red-600" data-testid="qm-error">
        {{ error }}
      </p>
    </div>

    <div v-else class="mt-4 space-y-3 text-center" data-testid="qm-searching">
      <div class="flex items-center justify-center gap-2 text-indigo-600">
        <LoadingSpinner :size="20" />
        <span class="font-bold" data-testid="qm-elapsed">Mencari lawan... {{ elapsed }}s</span>
      </div>
      <p class="text-sm text-slate-500">Sila tunggu, sistem sedang mencari pemain sepadan</p>
      <button
        type="button"
        class="min-h-11 rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50"
        data-testid="qm-cancel"
        @click="cancel"
      >
        Batal Carian
      </button>
    </div>
  </section>
</template>
