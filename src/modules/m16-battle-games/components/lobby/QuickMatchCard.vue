<script setup lang="ts">
/**
 * "Cari Lawan Auto" of S7 (SRS M16 v1.6 FR-M16-59, FR-M16-60; URS FN-M16-5.2.1..5.2.3; §7.1). Starts #29,
 * counts "Mencari lawan... {n}s" every second, polls #30 every 3 s (matched → emit the room code; expired →
 * error; cancelled → idle; no client timeout) and cancels through #31. The error line stays visible below
 * the button until the next search (DV-M16-20). All timers stop when the card is left.
 */
import { onBeforeUnmount, ref } from 'vue'

import { DsArt3D, DsCluster, DsGrid, DsHeading, DsText } from '@/ds'

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

const subjectItems = PB_SUBJECTS.map((s) => ({ value: s.value, label: s.label }))
const modeItems = QM_MATCH_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

const cancelling = ref(false)
let unmounted = false
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
  if (searching.value || starting.value || cancelling.value) return
  error.value = ''
  starting.value = true
  try {
    const res = await startPbQuickMatch({ subject: subject.value, match_mode: matchMode.value })
    // The card was left while #29 was in flight: start no timer.
    if (unmounted) return
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
    if (!unmounted) error.value = QM_MESSAGES.network
  } finally {
    starting.value = false
  }
}

/** "Batal Carian": back to idle at once; "Cari Lawan Sekarang" stays disabled until #31 has settled. */
async function cancel(): Promise<void> {
  endSearch()
  cancelling.value = true
  try {
    await cancelPbQuickMatch()
  } catch {
    /* the card is already idle; a failed cancel changes nothing on screen */
  } finally {
    cancelling.value = false
  }
}

onBeforeUnmount(() => {
  unmounted = true
  endSearch()
})
</script>

<template>
  <UCard data-testid="quick-match">
    <DsCluster :wrap="false">
      <DsArt3D name="bolt" size="lg" />
      <div class="min-w-0">
        <DsHeading :level="2" variant="subheading">Cari Lawan Auto</DsHeading>
        <DsText variant="caption">Sistem cari pemain sepadan secara automatik</DsText>
      </div>
    </DsCluster>

    <div v-if="!searching" class="mt-4 flex flex-col gap-4" data-testid="quick-match-form">
      <DsGrid :cols="{ sm: 2 }" gap="sm">
        <UFormField label="Subjek">
          <USelect
            v-model="subject"
            :items="subjectItems"
            size="xl"
            class="w-full"
            data-testid="qm-subject"
          />
        </UFormField>
        <UFormField label="Padanan">
          <USelect
            v-model="matchMode"
            :items="modeItems"
            size="xl"
            class="w-full"
            data-testid="qm-mode"
          />
        </UFormField>
      </DsGrid>
      <UButton
        size="xl"
        color="primary"
        icon="i-ph-magnifying-glass-bold"
        :disabled="starting || cancelling"
        class="min-h-12 w-full justify-center"
        data-testid="qm-start"
        @click="start"
      >
        🔍 Cari Lawan Sekarang
      </UButton>
      <DsText v-if="error" variant="label" as="p" tone="error" role="alert" data-testid="qm-error">
        {{ error }}
      </DsText>
    </div>

    <div
      v-else
      class="mt-4 flex flex-col items-center gap-3 text-center"
      data-testid="qm-searching"
    >
      <div class="flex items-center justify-center gap-2 text-primary-t">
        <UIcon
          name="i-ph-spinner-gap-bold"
          class="size-5 animate-spin motion-reduce:animate-none"
          aria-hidden="true"
        />
        <DsText variant="label" data-testid="qm-elapsed">Mencari lawan... {{ elapsed }}s</DsText>
      </div>
      <DsText variant="body" tone="muted">Sila tunggu, sistem sedang mencari pemain sepadan</DsText>
      <UButton
        color="neutral"
        variant="soft"
        size="xl"
        class="min-h-12"
        data-testid="qm-cancel"
        @click="cancel"
      >
        Batal Carian
      </UButton>
    </div>
  </UCard>
</template>
