<script setup lang="ts">
/**
 * The question of a room round (PROVISIONAL, URS FN-M16-5.5.3: the Betul atau Salah / Cabaran Kilat cards
 * are reused). `mcq` shows the options as buttons (Perang Fakta's "Betul" / "Salah" are options 0 / 1 of the
 * same shape); `word` (Teka Silang Kata) shows a text box for the typed word. Emits the chosen option or the
 * typed word; the page posts #28. v2: `DsQuizOption` for the options.
 */
import { ref, watch } from 'vue'

import { DsQuizOption, DsStack, DsCluster, DsGrid, DsText } from '@/ds'

import type { RoomQuestion } from '../../api'

const props = defineProps<{
  question: RoomQuestion
  mode: 'mcq' | 'word'
  busy: boolean
  /** Only the acting player may answer. */
  disabled: boolean
  /** Optional countdown text ("10s") in the corner. */
  countdown?: string | null
}>()

const emit = defineEmits<{ answer: [answer: { optionId?: number; value?: string }] }>()

const word = ref('')

watch(
  () => props.question.id,
  () => {
    word.value = ''
  },
)

function pick(optionId: number): void {
  if (props.busy || props.disabled) return
  emit('answer', { optionId })
}

function submitWord(): void {
  if (props.busy || props.disabled) return
  emit('answer', { value: word.value })
}
</script>

<template>
  <DsStack data-testid="room-question">
    <DsCluster align="start" justify="between" :wrap="false">
      <DsText variant="heading" wrap="anywhere" data-testid="room-question-text">
        {{ question.text }}
      </DsText>
      <UBadge
        v-if="countdown"
        color="primary"
        variant="soft"
        size="lg"
        class="tabular shrink-0"
        data-testid="room-countdown"
        >{{ countdown }}</UBadge
      >
    </DsCluster>

    <DsGrid v-if="mode === 'mcq'" :cols="{ sm: 2 }" gap="xs">
      <DsQuizOption
        v-for="o in question.options"
        :key="o.id"
        :letter="o.label"
        :state="busy || disabled ? 'dimmed' : 'idle'"
        data-testid="room-option"
        @select="pick(o.id)"
        >{{ o.text }}</DsQuizOption
      >
    </DsGrid>

    <DsStack v-else as="form" gap="sm" data-testid="room-word-form" @submit.prevent="submitWord">
      <UFormField label="Jawapan">
        <UInput
          v-model="word"
          type="text"
          autocomplete="off"
          size="xl"
          class="w-full"
          :disabled="busy || disabled"
          data-testid="room-word-input"
        />
      </UFormField>
      <UButton
        type="submit"
        size="xl"
        color="primary"
        :disabled="busy || disabled"
        class="min-h-12 justify-center sm:self-start"
        data-testid="room-word-submit"
      >
        Hantar
      </UButton>
    </DsStack>
  </DsStack>
</template>
