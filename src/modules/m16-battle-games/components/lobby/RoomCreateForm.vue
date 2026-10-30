<script setup lang="ts">
/**
 * The "Cipta Bilik Baru" form shared by S7 (Papan Bijak) and S8–S12 (SRS M16 v1.6 FR-M16-54, 55, 57, 63;
 * URS FN-M16-5.1.2/5.1.3/5.4.2). Posts #24 and emits the new room code. S7 adds the emoji subjects, the
 * custom range and "Maks Pemain"; S8–S12 send three fields. Native validation only; server errors render
 * as the red box above the form. v2 look: one card, Nuxt UI fields, the submit in the game colour.
 */
import { computed, reactive, ref } from 'vue'

import { createRoom, type RoomGame } from '../../api'
import GradeField from './GradeField.vue'
import {
  CUSTOM_GRADE_OPTIONS,
  LOBBY_SUBJECTS,
  MAX_PLAYER_OPTIONS,
  PB_SUBJECTS,
  ROOM_GAME_META,
  ROOM_THEME,
  sameLevelLabel,
} from './lobby-config'
import { buildCreateBody, errorLines, type CreateFormValues } from './lobby-lib'

const props = defineProps<{
  game: RoomGame
  autoGrade: string | null
  autoGradeName: string | null
}>()

const emit = defineEmits<{ created: [code: string] }>()

const isPb = computed(() => props.game === 'papan-bijak')
const meta = computed(() => ROOM_GAME_META[props.game])
const color = computed(() => ROOM_THEME[props.game].color)

const form: CreateFormValues = reactive({
  subject: 'MATEMATIK',
  gradeLevel: props.autoGrade ?? 'TINGKATAN_1',
  matchMode: 'same_grade',
  gradeMin: 7,
  gradeMax: 11,
  maxPlayers: 4,
})

const busy = ref(false)
const errors = ref<string[]>([])

const subjectItems = computed(() =>
  isPb.value
    ? PB_SUBJECTS.map((s) => ({ value: s.value, label: `${s.emoji} ${s.label}` }))
    : LOBBY_SUBJECTS.map((s) => ({ value: s.value, label: s.label })),
)
const sameLevelText = computed(() =>
  isPb.value ? sameLevelLabel(form.gradeLevel) : 'Semua Tingkatan',
)
const modeItems = computed(() => [
  { value: 'same_grade', label: 'Tahap sama sahaja' },
  { value: 'same_level', label: sameLevelText.value },
  ...(isPb.value ? [{ value: 'custom', label: 'Pilih julat khas' }] : []),
])
const rangeItems = CUSTOM_GRADE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))
const playerItems = MAX_PLAYER_OPTIONS.map((n) => ({ value: n, label: `${n} Pemain` }))

async function submit(): Promise<void> {
  if (busy.value) return
  busy.value = true
  errors.value = []
  try {
    const res = await createRoom(props.game, buildCreateBody(props.game, form))
    emit('created', res.code)
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UCard data-testid="create-card">
    <h2 class="text-subheading text-highlighted">{{ isPb ? '🆕' : '🏠' }} Cipta Bilik Baru</h2>
    <form class="mt-4 flex flex-col gap-4" data-testid="create-form" @submit.prevent="submit">
      <UAlert
        v-if="errors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        data-testid="create-errors"
      >
        <template #description>
          <ul class="flex flex-col gap-1">
            <li v-for="line in errors" :key="line">{{ line }}</li>
          </ul>
        </template>
      </UAlert>

      <div class="grid items-start gap-4" :class="isPb ? '' : 'sm:grid-cols-2'">
        <UFormField label="Subjek">
          <USelect
            v-model="form.subject"
            :items="subjectItems"
            size="xl"
            class="w-full"
            data-testid="create-subject"
          />
        </UFormField>

        <GradeField
          v-model="form.gradeLevel"
          :label="isPb ? 'Tahap Soalan' : 'Tahap'"
          :auto-grade="autoGrade"
          :auto-grade-name="autoGradeName"
          :auto-hint="isPb ? '(auto dari profil anda)' : '(auto)'"
          :allow-back="isPb"
        />
      </div>

      <UFormField :label="isPb ? 'Siapa Boleh Join?' : 'Siapa boleh join?'">
        <USelect
          v-model="form.matchMode"
          :items="modeItems"
          size="xl"
          class="w-full"
          data-testid="create-mode"
        />
      </UFormField>

      <div
        v-if="isPb && form.matchMode === 'custom'"
        class="grid grid-cols-2 gap-3"
        data-testid="create-range"
      >
        <UFormField label="Dari">
          <USelect
            v-model="form.gradeMin"
            :items="rangeItems"
            size="xl"
            class="w-full"
            data-testid="create-grade-min"
          />
        </UFormField>
        <UFormField label="Hingga">
          <USelect
            v-model="form.gradeMax"
            :items="rangeItems"
            size="xl"
            class="w-full"
            data-testid="create-grade-max"
          />
        </UFormField>
      </div>

      <UFormField v-if="isPb" label="Maks Pemain">
        <USelect
          v-model="form.maxPlayers"
          :items="playerItems"
          size="xl"
          class="w-full"
          data-testid="create-max-players"
        />
      </UFormField>

      <UButton
        type="submit"
        size="xl"
        :color="color"
        :loading="busy"
        :disabled="busy"
        class="min-h-12 w-full justify-center"
        data-testid="create-submit"
      >
        {{ isPb ? '🎲' : meta.emoji }} Cipta Bilik
      </UButton>
    </form>
  </UCard>
</template>
