<script setup lang="ts">
/**
 * The "Cipta Bilik Baru" form shared by S7 (Papan Bijak) and S8–S12 (SRS M16 v1.6 FR-M16-54, 55, 57, 63;
 * URS FN-M16-5.1.2/5.1.3/5.4.2). Posts #24 and emits the new room code. S7 adds the emoji subjects, the
 * custom range and "Maks Pemain"; S8–S12 send three fields. Native validation only; server errors render
 * as the red box above the form.
 */
import { computed, reactive, ref, useId } from 'vue'

import { AlertBox } from '@/components/feedback'

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

/**
 * Live look (screenshots): S7 is a violet-tinted panel with uppercase violet labels and white fields;
 * S8–S12 are white cards with a thin dark border, small labels, bordered fields and a solid button in the
 * game colour.
 */
const cardClass = computed(() =>
  isPb.value
    ? 'rounded-3xl border border-violet-200 bg-linear-to-br from-violet-50 to-indigo-100 p-5 shadow-sm sm:p-6'
    : 'rounded-2xl border border-slate-700 bg-white p-5 shadow-sm sm:p-6',
)
const labelClass = computed(() =>
  isPb.value
    ? 'mb-1 block text-xs font-bold tracking-wide text-violet-600 uppercase'
    : 'mb-1 block text-xs font-semibold text-slate-600',
)
const selectClass = computed(() =>
  isPb.value
    ? 'min-h-11 w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-violet-300'
    : 'min-h-11 w-full rounded-xl border border-slate-700 bg-white px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-300',
)
const submitClass = computed(() =>
  isPb.value
    ? 'bg-linear-to-r from-violet-600 to-purple-600 uppercase tracking-wide'
    : ROOM_THEME[props.game].button,
)

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
  <section :class="cardClass" data-testid="create-card">
    <h2 class="font-heading text-base font-bold text-slate-800 sm:text-lg">
      {{ isPb ? '🆕' : '🏠' }} Cipta Bilik Baru
    </h2>
    <form class="mt-4 space-y-4" data-testid="create-form" @submit.prevent="submit">
      <AlertBox :messages="errors" data-testid="create-errors" />

      <div :class="isPb ? 'space-y-4' : 'grid items-start gap-4 sm:grid-cols-2'">
        <div>
          <label :for="subjectId" :class="labelClass">Subjek</label>
          <select
            :id="subjectId"
            v-model="form.subject"
            :class="selectClass"
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
          :variant="isPb ? 'pb' : 'lobby'"
        />
      </div>

      <div>
        <label :for="modeId" :class="labelClass">{{
          isPb ? 'Siapa Boleh Join?' : 'Siapa boleh join?'
        }}</label>
        <select
          :id="modeId"
          v-model="form.matchMode"
          :class="selectClass"
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
          <label :for="minId" :class="labelClass">Dari</label>
          <select
            :id="minId"
            v-model.number="form.gradeMin"
            :class="selectClass"
            data-testid="create-grade-min"
          >
            <option v-for="o in CUSTOM_GRADE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
        <div>
          <label :for="maxId" :class="labelClass">Hingga</label>
          <select
            :id="maxId"
            v-model.number="form.gradeMax"
            :class="selectClass"
            data-testid="create-grade-max"
          >
            <option v-for="o in CUSTOM_GRADE_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="isPb">
        <label :for="playersId" :class="labelClass">Maks Pemain</label>
        <select
          :id="playersId"
          v-model.number="form.maxPlayers"
          :class="selectClass"
          data-testid="create-max-players"
        >
          <option v-for="n in MAX_PLAYER_OPTIONS" :key="n" :value="n">{{ n }} Pemain</option>
        </select>
      </div>

      <button
        type="submit"
        :disabled="busy"
        :class="submitClass"
        class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
        data-testid="create-submit"
      >
        {{ isPb ? '🎲' : meta.emoji }} Cipta Bilik
      </button>
    </form>
  </section>
</template>
