<script setup lang="ts">
/**
 * S3 `/cikgu/rph/baharu` RPH form (FR-M13-38..46; URS FT-M13-3.2). Native validation only (no
 * `novalidate`, no custom messages); on a valid submit the button is busy until #3 answers, then the
 * browser goes to V1. The class select appears only for a viewer who owns classes (PROPOSED).
 */
import { Bot } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { clock, formatDateKey } from '@/lib/time'

import { createRph, fetchCikguClasses, fetchCikguSubjects, LEVELS } from '../api'
import { RPH_COPY as C } from '../components/teacher/copy'
import { errorLines, levelCodeOfSlug } from '../components/teacher/lib'

const router = useRouter()

const { data: classes } = useApi((signal) => fetchCikguClasses({ signal }))
const { data: subjects } = useApi((signal) => fetchCikguSubjects({ signal }))

const classLoaded = computed(() => classes.value !== null)
const ownClasses = computed(() => classes.value ?? [])
const subjectNames = computed(() =>
  (subjects.value ?? []).map((s) => s.name).sort((a, b) => a.localeCompare(b, 'ms')),
)

const classPick = ref('')
const subjectName = ref('')
const level = ref('')
const tajuk = ref('')
const className = ref('')
const lessonDate = ref(formatDateKey(clock.now()))
const duration = ref<number | string>(60)
const timeSlot = ref('')
const tema = ref('')
const keperluan = ref('')

const busy = ref(false)
const errors = ref<string[]>([])

/** FN-M13-3.2.3 `applyClassroomDefaults`: copy the class's subject, level and name. */
function applyClassDefaults(): void {
  const picked = ownClasses.value.find((c) => String(c.id) === classPick.value)
  if (!picked) return
  subjectName.value = picked.subjectName ?? ''
  level.value = levelCodeOfSlug(picked.educationLevel)
  className.value = picked.name
}

function optional(value: string): string | null {
  const t = value.trim()
  return t === '' ? null : t
}

async function onSubmit(): Promise<void> {
  if (busy.value) return
  busy.value = true
  errors.value = []
  try {
    const minutes = typeof duration.value === 'number' ? duration.value : Number(duration.value)
    const rph = await createRph({
      subjectName: subjectName.value.trim(),
      level: level.value,
      tajuk: tajuk.value.trim(),
      className: optional(className.value),
      lessonDate: optional(lessonDate.value),
      durationMinutes: Number.isFinite(minutes) && duration.value !== '' ? minutes : null,
      timeSlot: optional(timeSlot.value),
      tema: optional(tema.value),
      pengajaranKeperluan: optional(keperluan.value),
    })
    await router.push(`/cikgu/rph/${String(rph.id)}`)
  } catch (err) {
    errors.value = errorLines(err, C.saveFailed)
  } finally {
    busy.value = false
  }
}

const LABEL = 'mb-1 block text-sm font-semibold text-slate-700'
const BTN =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-center text-sm font-semibold'
</script>

<template>
  <div class="mx-auto min-w-0 max-w-3xl space-y-4" data-testid="rph-form-page">
    <RouterLink
      to="/cikgu/rph"
      class="inline-flex min-h-11 items-center text-sm font-medium text-purple-600 hover:underline"
      data-testid="rph-back"
      >{{ C.back }}</RouterLink
    >

    <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
      <div class="mb-4 flex items-center gap-3">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-purple-500 to-pink-500 text-white"
        >
          <Bot class="h-5 w-5" />
        </span>
        <div class="min-w-0">
          <h1 class="font-heading text-xl font-bold text-slate-800">{{ C.formTitle }}</h1>
          <p
            v-if="classLoaded && ownClasses.length === 0"
            class="text-sm text-slate-500"
            data-testid="rph-no-class"
          >
            {{ C.noClass }}
          </p>
        </div>
      </div>

      <AlertBox v-if="errors.length > 0" :messages="errors" class="mb-4" />

      <form id="rph-create-form" class="space-y-4" @submit.prevent="onSubmit">
        <div v-if="ownClasses.length > 0">
          <label for="rph-class-pick" :class="LABEL">{{ C.classLabel }}</label>
          <select
            id="rph-class-pick"
            v-model="classPick"
            :class="FORM_SELECT_CLASS"
            data-testid="rph-class-pick"
            @change="applyClassDefaults"
          >
            <option value="">{{ C.classPlaceholder }}</option>
            <option
              v-for="c in ownClasses"
              :key="c.id"
              :value="String(c.id)"
              :data-subject="c.subjectName ?? ''"
              :data-level="levelCodeOfSlug(c.educationLevel)"
              :data-class="c.name"
            >
              {{ c.name }}
            </option>
          </select>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="min-w-0">
            <label for="subject_name" :class="LABEL">Subjek <span class="text-red-500">*</span></label>
            <input
              id="subject_name"
              v-model="subjectName"
              name="subject_name"
              type="text"
              list="subject-list"
              required
              placeholder="cth: Matematik, Sains, Bahasa Melayu"
              :class="FORM_INPUT_CLASS"
            />
            <datalist id="subject-list">
              <option v-for="n in subjectNames" :key="n" :value="n" />
            </datalist>
          </div>
          <div class="min-w-0">
            <label for="level" :class="LABEL"
              >Tingkatan / Tahun <span class="text-red-500">*</span></label
            >
            <select id="level" v-model="level" name="level" required :class="FORM_SELECT_CLASS">
              <option value="">— Pilih —</option>
              <option v-for="l in LEVELS" :key="l.code" :value="l.code">{{ l.label }}</option>
            </select>
          </div>
        </div>

        <div class="min-w-0">
          <label for="tajuk" :class="LABEL"
            >Tajuk Pengajaran <span class="text-red-500">*</span></label
          >
          <input
            id="tajuk"
            v-model="tajuk"
            name="tajuk"
            type="text"
            required
            maxlength="200"
            placeholder="cth: Pecahan Setara, Sel Sebagai Unit Asas Hidupan, Persamaan Kuadratik"
            :class="FORM_INPUT_CLASS"
          />
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div class="min-w-0">
            <label for="class_name" :class="LABEL">Kelas</label>
            <input
              id="class_name"
              v-model="className"
              name="class_name"
              type="text"
              placeholder="cth: 4 Bestari"
              :class="FORM_INPUT_CLASS"
            />
          </div>
          <div class="min-w-0">
            <label for="lesson_date" :class="LABEL">Tarikh</label>
            <input
              id="lesson_date"
              v-model="lessonDate"
              name="lesson_date"
              type="date"
              :class="FORM_INPUT_CLASS"
            />
          </div>
          <div class="min-w-0">
            <label for="duration_minutes" :class="LABEL">Tempoh (minit)</label>
            <input
              id="duration_minutes"
              v-model.number="duration"
              name="duration_minutes"
              type="number"
              min="15"
              max="240"
              :class="FORM_INPUT_CLASS"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div class="min-w-0">
            <label for="time_slot" :class="LABEL">Masa Slot</label>
            <input
              id="time_slot"
              v-model="timeSlot"
              name="time_slot"
              type="text"
              placeholder="cth: 8.00-9.00 pagi"
              :class="FORM_INPUT_CLASS"
            />
          </div>
          <div class="min-w-0">
            <label for="tema" :class="LABEL">Tema (opsyenal)</label>
            <input
              id="tema"
              v-model="tema"
              name="tema"
              type="text"
              placeholder="cth: Nombor & Operasi"
              :class="FORM_INPUT_CLASS"
            />
          </div>
        </div>

        <div class="min-w-0">
          <label for="pengajaran_keperluan" :class="LABEL">Keperluan Khas (opsyenal)</label>
          <textarea
            id="pengajaran_keperluan"
            v-model="keperluan"
            name="pengajaran_keperluan"
            rows="2"
            maxlength="500"
            placeholder="cth: Kelas mixed-ability. Atau: 5 minit set induksi je sebab masa pendek."
            :class="FORM_TEXTAREA_CLASS"
          />
        </div>

        <div
          class="rounded-xl border border-purple-200 bg-purple-50 p-4 text-sm text-purple-900"
          data-testid="rph-info"
        >
          <p class="font-semibold">{{ C.infoTitle }}</p>
          <ul class="mt-1 list-disc space-y-0.5 pl-5">
            <li v-for="b in C.infoBullets" :key="b">{{ b }}</li>
          </ul>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            id="submit-btn"
            type="submit"
            :disabled="busy"
            :class="[
              BTN,
              'bg-linear-to-r from-purple-500 to-pink-500 text-white hover:opacity-90',
              busy && 'opacity-60',
            ]"
          >
            <Bot class="h-4 w-4 shrink-0" />
            <span id="submit-label">{{ busy ? C.busy : C.submit }}</span>
          </button>
          <RouterLink
            to="/cikgu/rph"
            :class="[BTN, 'bg-slate-200 text-slate-700 hover:bg-slate-300']"
            data-testid="rph-cancel"
            >{{ C.cancel }}</RouterLink
          >
          <p class="text-xs text-slate-400">{{ C.note }}</p>
        </div>
      </form>
    </section>
  </div>
</template>
