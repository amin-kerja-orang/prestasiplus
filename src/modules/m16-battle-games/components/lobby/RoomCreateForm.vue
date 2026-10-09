<script setup lang="ts">
/**
 * The "Cipta Bilik Baru" form shared by S7 (Papan Bijak) and S8–S12 (SRS M16 v1.6 FR-M16-54, 55, 57, 63;
 * URS FN-M16-5.1.2/5.1.3/5.4.2). Posts #24 and emits the new room code. S7 adds the emoji subjects, the
 * custom range and "Maks Pemain"; S8–S12 send three fields. Native validation only; server errors render
 * as the red box above the form.
 */
import { computed, reactive, ref, useId } from 'vue'

import { AlertBox } from '@/components/feedback'
import { FORM_SELECT_CLASS } from '@/components/form/classes'

import { createRoom, type RoomGame } from '../../api'
import GradeField from './GradeField.vue'
import {
  CUSTOM_GRADE_OPTIONS,
  LOBBY_SUBJECTS,
  MAX_PLAYER_OPTIONS,
  PB_SUBJECTS,
  ROOM_GAME_META,
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

const form: CreateFormValues = reactive({
  subject: 'MATEMATIK',
  gradeLevel: props.autoGrade ?? 'DARJAH_1',
  matchMode: 'same_grade',
  gradeMin: 1,
  gradeMax: 6,
  maxPlayers: 4,
})

const busy = ref(false)
const errors = ref<string[]>([])
const subjectId = useId()
const modeId = useId()
const minId = useId()
const maxId = useId()
const playersId = useId()

const sameLevelText = computed(() =>
  isPb.value ? sameLevelLabel(form.gradeLevel) : 'Semua Darjah / Semua Tingkatan',
)

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
  <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="create-card">
    <h2 class="font-heading text-lg font-bold text-slate-800">
      {{ isPb ? '🆕' : '🏠' }} Cipta Bilik Baru
    </h2>
    <form class="mt-4 space-y-4" data-testid="create-form" @submit.prevent="submit">
      <AlertBox :messages="errors" data-testid="create-errors" />

      <div>
        <label :for="subjectId" class="mb-1 block text-sm font-semibold text-slate-600"
          >Subjek</label
        >
        <select
          :id="subjectId"
          v-model="form.subject"
          :class="[FORM_SELECT_CLASS, 'min-h-11']"
          data-testid="create-subject"
        >
          <template v-if="isPb">
            <option v-for="s in PB_SUBJECTS" :key="s.value" :value="s.value">
              {{ s.emoji }} {{ s.label }}
            </option>
          </template>
          <template v-else>
            <option v-for="s in LOBBY_SUBJECTS" :key="s.value" :value="s.value">
              {{ s.label }}
            </option>
          </template>
        </select>
      </div>

      <GradeField
        v-model="form.gradeLevel"
        :label="isPb ? 'Tahap Soalan' : 'Tahap'"
        :auto-grade="autoGrade"
        :auto-grade-name="autoGradeName"
        :auto-hint="isPb ? '(auto dari profil anda)' : '(auto)'"
        :allow-back="isPb"
      />

      <div>
        <label :for="modeId" class="mb-1 block text-sm font-semibold text-slate-600">{{
          isPb ? 'Siapa Boleh Join?' : 'Siapa boleh join?'
        }}</label>
        <select
          :id="modeId"
          v-model="form.matchMode"
          :class="[FORM_SELECT_CLASS, 'min-h-11']"
          data-testid="create-mode"
        >
          <option value="same_grade">Tahap sama sahaja</option>
          <option value="same_level">{{ sameLevelText }}</option>
          <option v-if="isPb" value="custom">Pilih julat khas</option>
        </select>
      </div>

      <div
        v-if="isPb && form.matchMode === 'custom'"
        class="grid grid-cols-2 gap-3"
        data-testid="create-range"
      >
        <div>
          <label :for="minId" class="mb-1 block text-sm font-semibold text-slate-600">Dari</label>
          <select
            :id="minId"
            v-model.number="form.gradeMin"
            :class="[FORM_SELECT_CLASS, 'min-h-11']"
            data-testid="create-grade-min"
          >
            <option v-for="o in CUSTOM_GRADE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
        <div>
          <label :for="maxId" class="mb-1 block text-sm font-semibold text-slate-600">Hingga</label>
          <select
            :id="maxId"
            v-model.number="form.gradeMax"
            :class="[FORM_SELECT_CLASS, 'min-h-11']"
            data-testid="create-grade-max"
          >
            <option v-for="o in CUSTOM_GRADE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="isPb">
        <label :for="playersId" class="mb-1 block text-sm font-semibold text-slate-600"
          >Maks Pemain</label
        >
        <select
          :id="playersId"
          v-model.number="form.maxPlayers"
          :class="[FORM_SELECT_CLASS, 'min-h-11']"
          data-testid="create-max-players"
        >
          <option v-for="n in MAX_PLAYER_OPTIONS" :key="n" :value="n">{{ n }} Pemain</option>
        </select>
      </div>

      <button
        type="submit"
        :disabled="busy"
        class="bg-save-gradient inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        data-testid="create-submit"
      >
        {{ isPb ? '🎲' : meta.emoji }} Cipta Bilik
      </button>
    </form>
  </section>
</template>
