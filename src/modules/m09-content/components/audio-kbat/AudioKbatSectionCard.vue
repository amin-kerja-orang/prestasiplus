<script setup lang="ts">
/**
 * One section of the provisional player (L-3): "Bahagian n · Soalan a-b", its `<audio controls>`
 * and its questions shown together, each a radio group A–D (FR-M09-75).
 */
import type { AudioSection } from '../../api'
import { CHOICES, PLAYER_COPY, sectionRange, type Choice } from '../../lib/audio-kbat'

defineProps<{
  section: AudioSection
  answers: Readonly<Record<number, Choice | undefined>>
  disabled?: boolean
}>()

defineEmits<{ choose: [no: number, choice: Choice] }>()
</script>

<template>
  <section
    class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-5"
    :aria-labelledby="`section-${String(section.no)}-title`"
    data-testid="audio-section"
    :data-section-no="section.no"
  >
    <h2
      :id="`section-${String(section.no)}-title`"
      class="font-heading text-lg font-bold break-words"
    >
      {{ PLAYER_COPY.sectionPrefix }} {{ section.no }} · {{ PLAYER_COPY.questionPrefix }}
      {{ sectionRange(section.questions) }}
      <span class="block text-sm font-medium text-slate-500" data-testid="section-title">{{
        section.title
      }}</span>
    </h2>

    <audio
      v-if="section.audioUrl"
      controls
      preload="none"
      :src="section.audioUrl"
      class="mt-3 w-full"
      data-testid="section-audio"
    ></audio>
    <p v-else class="mt-3 text-sm text-slate-500" data-testid="section-no-audio">
      {{ PLAYER_COPY.noAudio }}
    </p>

    <ol class="mt-4 space-y-4">
      <li v-for="q in section.questions" :key="q.no" class="min-w-0" data-testid="audio-question">
        <fieldset class="min-w-0" :disabled="disabled">
          <legend class="text-sm font-semibold break-words text-slate-800">
            {{ q.no }}. {{ q.questionText }}
          </legend>
          <div class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
            <label
              v-for="choice in CHOICES"
              :key="choice"
              class="flex min-h-11 min-w-0 cursor-pointer items-start gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-50"
            >
              <input
                type="radio"
                :name="`q${String(q.no)}`"
                :value="choice"
                :checked="answers[q.no] === choice"
                class="mt-0.5 h-4 w-4 shrink-0 accent-amber-600"
                :data-testid="`q${String(q.no)}-${choice}`"
                @change="$emit('choose', q.no, choice)"
              />
              <span class="min-w-0 break-words"
                ><b>{{ choice }}.</b> {{ q.options[choice] }}</span
              >
            </label>
          </div>
        </fieldset>
      </li>
    </ol>
  </section>
</template>
