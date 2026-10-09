<script setup lang="ts">
/**
 * S1 `/cikgu` Cikgu Alesa chat (FR-M13-12..33; URS FT-M13-2.1..2.4; M13-T2). The AI and the voice are
 * simulated (D4): `POST /api/cikgu/send` is read through `api.raw` (SQ-M13-01), the recogniser and the
 * speaker are `api/voice-sim` (no Web Speech API, no microphone, no network). Everything the live page
 * styles inline keeps the live values (URS FN-M13-2.1.1); messages are text nodes, never HTML.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

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
const inputEl = ref<HTMLInputElement | null>(null)

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
  inputEl.value?.focus()
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
  const query = route.fullPath.includes('?') ? route.fullPath.slice(route.fullPath.indexOf('?') + 1) : ''
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
    inputEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  })
}

type SpeakWindow = Window & { cikguAlesaSpeak?: (text: string) => void }
let offVoiceError: (() => void) | undefined

onMounted(() => {
  ;(window as SpeakWindow).cikguAlesaSpeak = speak
  offVoiceError = onVoiceError(failVoice)
  applyPrefill()
})

onBeforeUnmount(() => {
  clearVoiceTimers()
  clearTimeout(speakTimer)
  offVoiceError?.()
  delete (window as SpeakWindow).cikguAlesaSpeak
})
</script>

<template>
  <div class="cikgu-alesa-shell" data-testid="cikgu-chat">
    <header class="ca-head">
      <div class="ca-avatar" aria-hidden="true">CA</div>
      <div class="ca-head-text">
        <h1 class="ca-title">Cikgu Alesa</h1>
        <p class="ca-sub">Guru maya · Powered by {{ poweredBy }} + 50K+ soalan DSKP</p>
      </div>
    </header>

    <section id="cikgu-history" ref="historyEl" class="ca-history">
      <div
        v-for="m in messages"
        :key="m.id"
        class="cikgu-msg"
        :class="m.role === 'bot' ? 'cikgu-msg-bot' : 'cikgu-msg-user'"
      >
        <strong>{{ m.role === 'bot' ? CHAT_COPY.botPrefix : CHAT_COPY.userPrefix }}</strong
        ><span class="cikgu-msg-body"
          ><template v-for="(line, i) in messageLines(m.text)" :key="i"
            ><br v-if="i > 0" />{{ line }}</template
          ></span
        >
      </div>
    </section>

    <div id="cikgu-voice-toolbar" class="ca-toolbar">
      <span class="ca-voice-label">🎙️ Voice Mode:</span>
      <label class="ca-voice-switch">
        <input
          id="cikgu-voice-mode"
          v-model="voiceOn"
          type="checkbox"
          @change="onVoiceModeChange"
        />
        Cikgu jawab dengan suara (auto)
      </label>
      <span id="cikgu-voice-status" class="ca-voice-status">{{ status }}</span>
    </div>

    <form id="cikgu-form" ref="formEl" class="ca-form" @submit.prevent="onSubmit">
      <input id="cikgu-thread-id" v-model="threadId" type="hidden" />
      <button
        id="cikgu-mic"
        type="button"
        class="ca-mic"
        :class="{ 'ca-mic-on': listening, 'ca-mic-off': !supported }"
        :disabled="!supported"
        :title="supported ? CHAT_COPY.micTitle : CHAT_COPY.micUnsupported"
        @click="onMic"
      >
        {{ listening ? '🔴' : '🎤' }}
      </button>
      <input
        id="cikgu-input"
        ref="inputEl"
        v-model="input"
        type="text"
        class="ca-input"
        placeholder="Taip atau tekan 🎤 untuk cakap…"
        required
        maxlength="4000"
        autocomplete="off"
      />
      <button id="cikgu-send" type="submit" class="ca-send" :disabled="sending">Hantar</button>
    </form>

    <div id="cikgu-meta" class="ca-meta">{{ meta }}</div>
  </div>
</template>

<style scoped>
/* Live inline styles of S1 (URS FN-M13-2.1.1..2.4.6): values replicated as observed. */
.cikgu-alesa-shell {
  max-width: 880px;
  margin: 24px auto;
  padding: 16px;
  min-width: 0;
}
.ca-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.ca-avatar {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  color: #fff;
  font-size: 18px;
  font-weight: 700;
}
.ca-head-text {
  min-width: 0;
}
.ca-title {
  margin: 0;
  font-size: 20px;
}
.ca-sub {
  margin: 2px 0 0;
  font-size: 13px;
  color: #6b7280;
}
.ca-history {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  padding: 16px;
  min-height: 360px;
  max-height: 520px;
  overflow-y: auto;
  overflow-wrap: anywhere;
}
.cikgu-msg + .cikgu-msg {
  margin-top: 10px;
}
.ca-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin: 12px 0;
  padding: 8px 12px;
  border-radius: 10px;
  background: linear-gradient(90deg, #ede9fe, #fce7f3);
}
.ca-voice-label {
  font-size: 13px;
  font-weight: 600;
  color: #6d28d9;
}
.ca-voice-switch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.ca-voice-status {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: #6d28d9;
}
.ca-form {
  display: flex;
  gap: 8px;
}
.ca-mic {
  flex: none;
  width: 54px;
  height: 48px;
  border: 1px solid #8b5cf6;
  border-radius: 10px;
  background: #fff;
  color: #6d28d9;
  font-size: 18px;
  cursor: pointer;
}
.ca-mic-on {
  background: #fee2e2;
}
.ca-mic-off {
  opacity: 0.4;
  cursor: not-allowed;
}
.ca-input {
  flex: 1;
  min-width: 0;
  height: 48px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 10px;
  background: #fff;
}
.ca-send {
  flex: none;
  width: 92px;
  height: 48px;
  border: 0;
  border-radius: 10px;
  background: #3b82f6;
  color: #fff;
  font-weight: 600;
  cursor: pointer;
}
.ca-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.ca-meta {
  min-height: 18px;
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
}
</style>
