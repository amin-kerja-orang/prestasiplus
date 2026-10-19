/**
 * Shared state of the simulated voice (SRS M13 v1.1 BR-M13-20, §6.9; D4: no Web Speech API, no
 * microphone). The test hooks `cikguVoice`, `cikguVoiceError` and `cikguSpoken` write it; the S1
 * screen (M13-T2) reads it. Plain module state: it carries no data of the mock store.
 */

import { shallowRef } from 'vue'

export interface VoiceConfig {
  /** `false` renders the live "browser does not support voice" state (FR-M13-31). */
  supported: boolean
  transcript: { interim: string; final: string }
  delays: { interim: number; final: number; errorHold: number }
}

export const DEFAULT_VOICE_CONFIG: Readonly<VoiceConfig> = Object.freeze({
  supported: true,
  transcript: Object.freeze({
    interim: 'Terangkan pecahan',
    final: 'Terangkan pecahan setara dengan contoh',
  }),
  delays: Object.freeze({ interim: 600, final: 1200, errorHold: 1000 }),
})

/** Reactive so S1 reacts when a test hook flips `supported` while the screen is open. */
const state = shallowRef<VoiceConfig>(clone(DEFAULT_VOICE_CONFIG))
const spoken: string[] = []
const errorListeners = new Set<() => void>()

function clone(c: Readonly<VoiceConfig>): VoiceConfig {
  return { supported: c.supported, transcript: { ...c.transcript }, delays: { ...c.delays } }
}

export function getVoiceConfig(): Readonly<VoiceConfig> {
  return state.value
}

/** `cikguVoice(...)`: merges the given parts into the configuration. */
export function configureVoice(patch: {
  supported?: boolean
  transcript?: { interim?: string; final?: string }
  delays?: { interim?: number; final?: number; errorHold?: number }
}): VoiceConfig {
  if (patch.supported !== undefined && typeof patch.supported !== 'boolean') {
    throw new TypeError('cikguVoice: supported must be a boolean')
  }
  for (const [k, v] of Object.entries(patch.delays ?? {})) {
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      throw new RangeError(`cikguVoice: invalid delay ${k}`)
    }
  }
  const prev = state.value
  state.value = {
    supported: patch.supported ?? prev.supported,
    transcript: { ...prev.transcript, ...patch.transcript },
    delays: { ...prev.delays, ...patch.delays },
  }
  return state.value
}

export function resetVoice(): void {
  state.value = clone(DEFAULT_VOICE_CONFIG)
  spoken.length = 0
}

/** `cikguVoiceError()`: fires the error step of the current session (listeners = the screen). */
export function fireVoiceError(): void {
  for (const listener of [...errorListeners]) listener()
}

export function onVoiceError(listener: () => void): () => void {
  errorListeners.add(listener)
  return () => void errorListeners.delete(listener)
}

/** The simulated speaker records what it was asked to say (`cikguSpoken()`). */
export function recordSpoken(text: string): void {
  spoken.push(text)
}

export function spokenTexts(): string[] {
  return [...spoken]
}
