<script setup lang="ts">
/**
 * S3 `/cikgu/rph/baharu` RPH form (FR-M13-38..46; URS FT-M13-3.2). Native validation only (no
 * `novalidate`, no custom messages); on a valid submit the button is busy until #3 answers, then the
 * browser goes to V1. The class select appears only for a viewer who owns classes (PROPOSED).
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsPage } from '@/ds'
import { clock, formatDateKey } from '@/lib/time'

import { createRph, fetchCikguClasses, fetchCikguSubjects, LEVELS } from '../api'
import { RPH_COPY as C } from '../components/teacher/copy'
import { errorLines, levelCodeOfSlug } from '../components/teacher/lib'

const router = useRouter()

const { data: classes } = useApi((signal) => fetchCikguClasses({ signal }))
const { data: subjects } = useApi((signal) => fetchCikguSubjects({ signal }))

const classLoaded = computed(() => classes.value !== null)
const ownClasses = computed(() => classes.value ?? [])
const noClass = computed(() => classLoaded.value && ownClasses.value.length === 0)
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
watch(classPick, applyClassDefaults)

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
</script>

<template>
  <DsPage
    class="max-w-4xl"
    :title="C.formTitle"
    :subtitle="noClass ? C.noClass : undefined"
    :subtitle-testid="noClass ? 'rph-no-class' : undefined"
    data-testid="rph-form-page"
  >
    <template #breadcrumb>
      <div>
        <UButton
          to="/cikgu/rph"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          data-testid="rph-back"
          >{{ C.back }}</UButton
        >
      </div>
    </template>

    <form id="rph-create-form" class="flex flex-col gap-6" @submit.prevent="onSubmit">
      <UAlert
        v-if="errors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="errors.join(' ')"
        role="alert"
        data-testid="rph-errors"
      />

      <DsFormSection
        title="Butiran Pengajaran"
        description="Subjek, tahap dan tajuk untuk RPH yang akan dijana."
        icon="i-ph-robot"
        :columns="2"
      >
        <DsFormField v-if="ownClasses.length > 0" native for="rph-class-pick" :label="C.classLabel">
          <template #default="{ id }">
            <DsNativeSelect :id="id" v-model="classPick" data-testid="rph-class-pick">
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
            </DsNativeSelect>
          </template>
        </DsFormField>

        <DsFormField native for="subject_name" label="Subjek" required>
          <template #default="{ id }">
            <UInput
              :id="id"
              v-model="subjectName"
              name="subject_name"
              type="text"
              list="subject-list"
              required
              placeholder="cth: Matematik, Sains, Bahasa Melayu"
              class="w-full"
            />
            <datalist id="subject-list">
              <option v-for="n in subjectNames" :key="n" :value="n" />
            </datalist>
          </template>
        </DsFormField>

        <DsFormField native for="level" label="Tingkatan / Tahun" required>
          <template #default="{ id }">
            <DsNativeSelect :id="id" v-model="level" name="level" required>
              <option value="">— Pilih —</option>
              <option v-for="l in LEVELS" :key="l.code" :value="l.code">{{ l.label }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>

        <div class="sm:col-span-2">
          <DsFormField native for="tajuk" label="Tajuk Pengajaran" required>
            <template #default="{ id }">
              <UInput
                :id="id"
                v-model="tajuk"
                name="tajuk"
                type="text"
                required
                maxlength="200"
                placeholder="cth: Pecahan Setara, Sel Sebagai Unit Asas Hidupan, Persamaan Kuadratik"
                class="w-full"
              />
            </template>
          </DsFormField>
        </div>
      </DsFormSection>

      <DsFormSection
        title="Jadual dan Keperluan"
        description="Kelas, tarikh, tempoh dan keperluan khas."
        icon="i-ph-calendar-blank"
        :columns="2"
      >
        <DsFormField native for="class_name" label="Kelas">
          <template #default="{ id }">
            <UInput
              :id="id"
              v-model="className"
              name="class_name"
              type="text"
              placeholder="cth: 4 Bestari"
              class="w-full"
            />
          </template>
        </DsFormField>
        <DsFormField native for="lesson_date" label="Tarikh">
          <template #default="{ id }">
            <UInput :id="id" v-model="lessonDate" name="lesson_date" type="date" class="w-full" />
          </template>
        </DsFormField>
        <DsFormField native for="duration_minutes" label="Tempoh (minit)">
          <template #default="{ id }">
            <UInput
              :id="id"
              v-model.number="duration"
              name="duration_minutes"
              type="number"
              min="15"
              max="240"
              class="w-full"
            />
          </template>
        </DsFormField>
        <DsFormField native for="time_slot" label="Masa Slot">
          <template #default="{ id }">
            <UInput
              :id="id"
              v-model="timeSlot"
              name="time_slot"
              type="text"
              placeholder="cth: 8.00-9.00 pagi"
              class="w-full"
            />
          </template>
        </DsFormField>
        <DsFormField native for="tema" label="Tema (opsyenal)">
          <template #default="{ id }">
            <UInput
              :id="id"
              v-model="tema"
              name="tema"
              type="text"
              placeholder="cth: Nombor & Operasi"
              class="w-full"
            />
          </template>
        </DsFormField>
        <div class="sm:col-span-2">
          <DsFormField native for="pengajaran_keperluan" label="Keperluan Khas (opsyenal)">
            <template #default="{ id }">
              <UTextarea
                :id="id"
                v-model="keperluan"
                name="pengajaran_keperluan"
                :rows="2"
                maxlength="500"
                placeholder="cth: Kelas mixed-ability. Atau: 5 minit set induksi je sebab masa pendek."
                class="w-full"
              />
            </template>
          </DsFormField>
        </div>
      </DsFormSection>

      <UAlert
        color="info"
        variant="subtle"
        icon="i-ph-info-duotone"
        :title="C.infoTitle"
        data-testid="rph-info"
      >
        <template #description>
          <ul class="mt-1 flex flex-col gap-1">
            <li v-for="b in C.infoBullets" :key="b" class="flex gap-2">
              <span aria-hidden="true">•</span>
              <span class="min-w-0">{{ b }}</span>
            </li>
          </ul>
        </template>
      </UAlert>

      <DsFormBar
        :submit-label="busy ? C.busy : C.submit"
        submit-icon="i-ph-robot"
        :cancel-label="C.cancel"
        cancel-to="/cikgu/rph"
        :saving="busy"
      >
        <template #status>{{ C.note }}</template>
      </DsFormBar>
    </form>
  </DsPage>
</template>
