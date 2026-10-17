<script setup lang="ts">
/**
 * S1 `/cikgu` Cikgu Alesa chat (FR-M13-12..33; URS FT-M13-2.1..2.4; M13-T2). The AI and the voice are
 * simulated (D4): `POST /api/cikgu/send` is read through `api.raw` (SQ-M13-01), the recogniser and the
 * speaker are `api/voice-sim` (no Web Speech API, no microphone, no network). Everything the live page
 * styles inline keeps the live values (URS FN-M13-2.1.1); messages are text nodes, never HTML.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { DsIconChip, DsPage } from '@/ds'

import {
  buildHandoffMessage,
  getVoiceConfig,
  GREETING,
  onVoiceError,
  POWERED_BY,
  recordSpoken,
  sendChat,
  SPEAKING_STATUS,
} from '../api'
import {
  AUTO_SUBMIT_MIN_CHARS,
  CHAT_COPY,
  messageLines,
  PENDING_ESSAY_KEY,
  resolveChat,
  resolvePrefill,
  speakDuration,
  VOICE_STORAGE_KEY,
  type ChatMessage,
} from '../components/chat/chat-lib'

const route = useRoute()

const input = ref('')
const threadId = ref('')
const meta = ref('')
const status = ref('')
const sending = ref(false)
const listening = ref(false)
const voiceOn = ref(readVoiceMode())
const messages = ref<ChatMessage[]>([{ id: 0, role: 'bot', text: GREETING }])

const historyEl = ref<HTMLElement | null>(null)
const formEl = ref<HTMLFormElement | null>(null)
const inputEl = ref<{ inputRef: HTMLInputElement | null } | null>(null)

const supported = computed(() => getVoiceConfig().supported)
const poweredBy = POWERED_BY.join(' · ')

let nextId = 1

function readVoiceMode(): boolean {
  try {
    return localStorage.getItem(VOICE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function onVoiceModeChange(): void {
  try {
    localStorage.setItem(VOICE_STORAGE_KEY, voiceOn.value ? '1' : '0')
  } catch {
    /* storage unavailable: the choice is not persisted */
  }
}

/** FR-M13-15: append, then scroll the box to the bottom (instant). */
function append(role: ChatMessage['role'], text: string): void {
  messages.value.push({ id: nextId++, role, text })
  void nextTick(() => {
    if (historyEl.value) historyEl.value.scrollTop = historyEl.value.scrollHeight
  })
}

function focusInput(): void {
  inputEl.value?.inputRef?.focus()
}

/** FR-M13-18..20. Native validation stops an empty input; whitespace only returns silently. */
async function onSubmit(): Promise<void> {
  const text = input.value.trim()
  if (text === '') return
  append('user', text)
  input.value = ''
  sending.value = true
  meta.value = CHAT_COPY.thinking
  try {
    const res = await sendChat({ message: text, thread_id: threadId.value || null })
    const outcome = resolveChat(res.status, res.body, voiceOn.value)
    if (outcome.kind === 'reply') {
      if (outcome.threadId !== null) threadId.value = outcome.threadId
      append('bot', outcome.reply)
      meta.value = outcome.meta
      if (outcome.speak) speak(outcome.reply)
    } else if (outcome.kind === 'error') {
      append('bot', outcome.text)
      meta.value = outcome.meta
    } else {
      append('bot', outcome.text)
    }
  } catch {
    append('bot', CHAT_COPY.network)
  } finally {
    sending.value = false
    focusInput()
  }
}

// --- simulated speaker (FR-M13-30, DV-M13-02): a status text, no audio ---------------------------

let speakTimer: ReturnType<typeof setTimeout> | undefined

function speak(text: string): void {
  recordSpoken(text)
  clearTimeout(speakTimer)
  status.value = SPEAKING_STATUS
  speakTimer = setTimeout(() => {
    if (status.value === SPEAKING_STATUS) status.value = ''
  }, speakDuration(text))
}

// --- simulated recogniser (FR-M13-31..33, BR-M13-20) ---------------------------------------------

let voiceTimers: ReturnType<typeof setTimeout>[] = []

function clearVoiceTimers(): void {
  for (const t of voiceTimers) clearTimeout(t)
  voiceTimers = []
}

/** Live `onend`: mic back, status cleared, auto-submit through a `submit` event (bypasses the lock). */
function endVoice(): void {
  clearVoiceTimers()
  listening.value = false
  status.value = ''
  if (input.value.trim().length > AUTO_SUBMIT_MIN_CHARS) {
    formEl.value?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  }
}

function startVoice(): void {
  clearVoiceTimers()
  const { delays, transcript } = getVoiceConfig()
  listening.value = true
  status.value = CHAT_COPY.listening
  voiceTimers = [
    setTimeout(() => {
      input.value = transcript.interim
    }, delays.interim),
    setTimeout(() => {
      input.value = transcript.final
      endVoice()
    }, delays.final),
  ]
}

function onMic(): void {
  if (!supported.value) return
  if (listening.value) endVoice()
  else startVoice()
}

/** Live `onerror` then `onend`: the error status shows for a moment, then the end step runs. */
function failVoice(): void {
  if (!listening.value) return
  clearVoiceTimers()
  listening.value = false
  status.value = CHAT_COPY.noHear
  voiceTimers = [setTimeout(endVoice, getVoiceConfig().delays.errorHold)]
}

// --- entry points (FR-M13-21, 22) ----------------------------------------------------------------

function applyPrefill(): void {
  const query = route.fullPath.includes('?')
    ? route.fullPath.slice(route.fullPath.indexOf('?') + 1)
    : ''
  let stored: string | null = null
  try {
    stored = sessionStorage.getItem(PENDING_ESSAY_KEY)
  } catch {
    stored = null
  }
  const prefill = resolvePrefill(query, stored, buildHandoffMessage)
  if (prefill.consumedEssay) {
    try {
      sessionStorage.removeItem(PENDING_ESSAY_KEY)
    } catch {
      /* ignore */
    }
  }
  if (prefill.text === null) return
  input.value = prefill.text
  void nextTick(() => {
    focusInput()
    inputEl.value?.inputRef?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

type SpeakWindow = Window & { cikguAlesaSpeak?: (text: string) => void }
let offVoiceError: (() => void) | undefined

onMounted(() => {
  ;(window as SpeakWindow).cikguAlesaSpeak = speak
  offVoiceError = onVoiceError(failVoice)
  applyPrefill()
})

// A link to /cikgu?ask=... while already on /cikgu re-applies the prefill (same precedence rules).
watch(
  () => route.fullPath,
  (now, before) => {
    if (now !== before) applyPrefill()
  },
)

onBeforeUnmount(() => {
  clearVoiceTimers()
  clearTimeout(speakTimer)
  offVoiceError?.()
  delete (window as SpeakWindow).cikguAlesaSpeak
})
</script>

<template>
  <DsPage data-testid="cikgu-chat">
    <div class="grid min-w-0 grid-cols-1 gap-4 md:gap-6 xl:grid-cols-12">
      <header
        class="flex min-w-0 items-center gap-3 self-start rounded-card bg-default p-4 shadow-lift xl:sticky xl:top-4 xl:col-span-4 xl:flex-col xl:items-start"
      >
        <DsIconChip icon="i-ph-sparkle-duotone" accent="friend" size="lg" />
        <div class="min-w-0">
          <h1
            class="flex flex-wrap items-center gap-2 font-display text-title font-extrabold text-highlighted"
          >
            Cikgu Alesa
            <span
              class="rounded-full bg-friend px-2 py-0.5 text-overline text-primary-on"
              data-testid="ca-ai-pill"
              >AI</span
            >
          </h1>
          <p class="mt-1 text-body text-muted" data-testid="ca-sub">
            Guru maya · Powered by {{ poweredBy }} + 50K+ soalan DSKP
          </p>
        </div>
      </header>

      <div class="flex min-w-0 flex-col gap-3 xl:col-span-8">
        <section
          id="cikgu-history"
          ref="historyEl"
          class="flex max-h-96 min-h-80 flex-col gap-3 overflow-y-auto rounded-card bg-elevated p-4 break-words"
        >
          <div
            v-for="m in messages"
            :key="m.id"
            class="max-w-sm min-w-0 rounded-2xl px-3.5 py-2.5 text-body md:max-w-md"
            :class="
              m.role === 'bot'
                ? 'self-start rounded-bl-md bg-default text-highlighted shadow-lift'
                : 'self-end rounded-br-md bg-primary text-primary-on'
            "
            data-msg
            :data-role="m.role"
          >
            <strong>{{ m.role === 'bot' ? CHAT_COPY.botPrefix : CHAT_COPY.userPrefix }}</strong
            ><span data-msg-body
              ><template v-for="(line, i) in messageLines(m.text)" :key="i"
                ><br v-if="i > 0" />{{ line }}</template
              ></span
            >
          </div>
        </section>

        <div
          id="cikgu-voice-toolbar"
          class="flex flex-wrap items-center gap-3 rounded-chip bg-friend/16 px-3 py-2"
        >
          <span class="text-label text-highlighted">🎙️ Voice Mode:</span>
          <UCheckbox
            id="cikgu-voice-mode"
            v-model="voiceOn"
            label="Cikgu jawab dengan suara (auto)"
            @update:model-value="onVoiceModeChange"
          />
          <span id="cikgu-voice-status" class="ms-auto text-caption font-semibold text-friend">{{
            status
          }}</span>
        </div>

        <form id="cikgu-form" ref="formEl" class="flex gap-2" @submit.prevent="onSubmit">
          <UInput id="cikgu-thread-id" v-model="threadId" type="hidden" />
          <UButton
            id="cikgu-mic"
            type="button"
            size="xl"
            :color="listening ? 'error' : 'neutral'"
            variant="soft"
            class="min-h-12 min-w-14 shrink-0 justify-center"
            :data-listening="listening ? 'true' : 'false'"
            :data-unsupported="supported ? 'false' : 'true'"
            :disabled="!supported"
            :title="supported ? CHAT_COPY.micTitle : CHAT_COPY.micUnsupported"
            @click="onMic"
          >
            {{ listening ? '🔴' : '🎤' }}
          </UButton>
          <UInput
            id="cikgu-input"
            ref="inputEl"
            v-model="input"
            type="text"
            size="xl"
            class="min-w-0 flex-1"
            placeholder="Taip atau tekan 🎤 untuk cakap…"
            required
            maxlength="4000"
            autocomplete="off"
          />
          <UButton
            id="cikgu-send"
            type="submit"
            size="xl"
            class="min-h-12 shrink-0 justify-center"
            :disabled="sending"
            >Hantar</UButton
          >
        </form>

        <div id="cikgu-meta" class="min-h-5 text-caption text-muted">{{ meta }}</div>
      </div>
    </div>
  </DsPage>
</template>
