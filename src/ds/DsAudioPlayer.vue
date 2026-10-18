<script setup lang="ts">
/**
 * Audio player card: a 64px play / pause button, a seek slider with tabular times, a speed select
 * and a transcript accordion. Space on the card toggles playback (not while a control inside has
 * focus). Native `<audio>` does the decoding; its own controls stay hidden.
 */
import { computed, onBeforeUnmount, ref, useTemplateRef } from 'vue'

import { dsCopy } from './copy'

const props = withDefaults(
  defineProps<{
    src: string
    title: string
    transcript?: string
    speeds?: number[]
    playLabel?: string
    pauseLabel?: string
    seekLabel?: string
    speedLabel?: string
    transcriptLabel?: string
  }>(),
  {
    transcript: undefined,
    speeds: () => [0.75, 1, 1.25, 1.5],
    playLabel: dsCopy.audioPlay,
    pauseLabel: dsCopy.audioPause,
    seekLabel: dsCopy.audioSeek,
    speedLabel: dsCopy.audioSpeed,
    transcriptLabel: dsCopy.audioTranscript,
  },
)

const audio = useTemplateRef<HTMLAudioElement>('audio')
const playing = ref(false)
const current = ref(0)
const duration = ref(0)
const rate = ref(String(1))
const speedItems = computed(() => props.speeds.map((s) => ({ label: `${s}x`, value: String(s) })))

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
function toggle(): void {
  const el = audio.value
  if (!el) return
  if (el.paused) void el.play?.()
  else el.pause?.()
}
function onKey(e: KeyboardEvent): void {
  if (e.key !== ' ' && e.code !== 'Space') return
  const t = e.target as HTMLElement | null
  if (t && t !== e.currentTarget && t.closest('button, input, [role="slider"], [role="combobox"]')) return
  e.preventDefault()
  toggle()
}
function seek(v: number | undefined): void {
  if (audio.value && typeof v === 'number') audio.value.currentTime = v
}
function setRate(v: string | undefined): void {
  rate.value = v ?? '1'
  if (audio.value) audio.value.playbackRate = Number(rate.value)
}
onBeforeUnmount(() => audio.value?.pause?.())
</script>

<template>
  <UCard data-ds="audio-player" tabindex="0" :aria-label="title" @keydown="onKey">
    <audio
      ref="audio"
      :src="src"
      preload="metadata"
      class="hidden"
      @play="playing = true"
      @pause="playing = false"
      @ended="playing = false"
      @timeupdate="current = audio?.currentTime ?? 0"
      @loadedmetadata="duration = audio?.duration ?? 0"
    />
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-4">
        <UButton
          type="button"
          class="size-16 shrink-0 justify-center rounded-full"
          :icon="playing ? 'i-ph-pause-fill' : 'i-ph-play-fill'"
          :aria-label="playing ? pauseLabel : playLabel"
          data-ds="audio-toggle"
          @click="toggle"
        />
        <div class="flex min-w-0 grow flex-col gap-2">
          <h3 class="truncate text-label text-highlighted">{{ title }}</h3>
          <USlider
            :model-value="current"
            :min="0"
            :max="duration || 1"
            :step="0.1"
            :aria-label="seekLabel"
            @update:model-value="seek"
          />
          <div class="tabular flex justify-between text-caption text-muted">
            <span data-ds="audio-current">{{ fmt(current) }}</span>
            <span data-ds="audio-duration">{{ fmt(duration) }}</span>
          </div>
        </div>
      </div>
      <USelect
        :model-value="rate"
        :items="speedItems"
        :aria-label="speedLabel"
        class="w-28 self-start"
        @update:model-value="setRate"
      />
      <UCollapsible v-if="transcript">
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          trailing-icon="i-ph-caret-down"
          :label="transcriptLabel"
        />
        <template #content>
          <p class="max-w-prose p-3 text-body text-default">{{ transcript }}</p>
        </template>
      </UCollapsible>
    </div>
  </UCard>
</template>
