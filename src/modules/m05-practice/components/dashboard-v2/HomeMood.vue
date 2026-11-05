<script setup lang="ts">
/**
 * "Bagaimana perasaan anda hari ini?" (S5-T04, R1-MUR-2, FR-MUR-2-12, AC-MUR-2-8/10): the pupil's daily mood check-in.
 * Four choices; after one the card shows "✓ {label}" and the choices are not offered again that day. Today's state comes from
 * `GET /api/me/mood/today`, so a reload (or a 409 from another tab) shows the stored choice. The page renders the card for
 * the student role only.
 */
import { useToast } from '@nuxt/ui/composables'
import { onMounted, ref } from 'vue'

import { ApiError } from '@/api'
import { DsCharacterCard } from '@/ds'

import { fetchMoodToday, postMood } from '../../api/practice'
import type { MoodValue } from '../../api/types'

const TITLE = 'Bagaimana perasaan anda hari ini?'
const SAVE_FAILED = 'Gagal menyimpan. Sila cuba lagi.'

/** Button text (emoji + word) and the word shown after the choice. */
const CHOICES: { value: MoodValue; label: string; word: string }[] = [
  { value: 'gembira', label: '😄 Gembira', word: 'Gembira' },
  { value: 'okay', label: '🙂 Okay', word: 'Okay' },
  { value: 'sedih', label: '😟 Sedih', word: 'Sedih' },
  { value: 'tertekan', label: '😣 Tertekan', word: 'Tertekan' },
]

const toast = useToast()
const loaded = ref(false)
const chosen = ref<MoodValue | null>(null)
const saving = ref(false)

const wordOf = (v: MoodValue): string => CHOICES.find((c) => c.value === v)?.word ?? v

async function readToday(): Promise<void> {
  try {
    chosen.value = (await fetchMoodToday()).mood
  } catch {
    // The read is a convenience: without it the choices are offered, and a stored choice answers 409 on the tap.
    chosen.value = null
  }
}

async function choose(value: MoodValue): Promise<void> {
  if (saving.value) return
  saving.value = true
  try {
    chosen.value = (await postMood(value)).mood
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      // Already recorded today: show the stored choice, not the one just tapped.
      await readToday()
      if (chosen.value === null) toast.add({ title: SAVE_FAILED, color: 'error' })
    } else {
      toast.add({ title: SAVE_FAILED, color: 'error' })
    }
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await readToday()
  loaded.value = true
})
</script>

<template>
  <DsCharacterCard
    v-if="loaded"
    accent="friend"
    icon="smiley"
    :title="TITLE"
    data-testid="dash-mood"
  >
    <p v-if="chosen" class="text-subheading text-highlighted" data-testid="dash-mood-done">
      ✓ {{ wordOf(chosen) }}
    </p>
    <div v-else class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="dash-mood-choices">
      <UButton
        v-for="c in CHOICES"
        :key="c.value"
        color="neutral"
        variant="outline"
        size="lg"
        block
        :disabled="saving"
        :data-testid="`dash-mood-${c.value}`"
        @click="choose(c.value)"
        >{{ c.label }}</UButton
      >
    </div>
  </DsCharacterCard>
</template>
