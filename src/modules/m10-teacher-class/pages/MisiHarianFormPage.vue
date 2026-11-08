<script setup lang="ts">
/**
 * R1-GUR-2b form card "Cipta Misi" (API-GUR-11 `POST /api/guru/missions`; S6-T07). Rendered inside
 * `MisiHarianPage` when "Misi Baru" is pressed (or `?baru=1`); it is the only create path (the
 * V1 separate create page is not used). Seven fields, validated here and by the server with the same
 * BM texts: a 422 shows each `fields.*` message under its field, a message-only 422 (the daily cap
 * "Had 5 misi sehari telah dicapai.") and every other failure show in the box above the fields.
 * Success: toast "Misi dicipta." and `created` (the list reloads and the card closes).
 */
import { MISSION_MESSAGES, MISSION_REWARD_MAX, MISSION_TARGET_MAX } from '@pp/contract'
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import { DsCluster, DsFormField, DsGrid, DsHeading, DsNativeSelect, DsPanel, DsStack } from '@/ds'
import { clock, formatDateKey } from '@/lib/time'

import { createTeacherMission, fetchGuruClasses } from '../api/guru'
import { fetchSubjectOptions } from '../components/kelas/subjects'
import { moduleMessage } from '../lib/generic-server-text'

const emit = defineEmits<{ created: []; cancel: [] }>()

const flash = useFlash()
const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
const { data: classList } = useApi((signal) => fetchGuruClasses({ signal }))
const classes = computed(() => (classList.value?.data ?? []).filter((c) => c.isActive))

const COPY = {
  title: 'Cipta Misi',
  name: 'Tajuk Misi',
  namePlaceholder: 'cth: Jawab 20 soalan Matematik',
  description: 'Keterangan (opsional)',
  descriptionPlaceholder: 'cth: Fokus Bab 3 Algebra sebelum ujian',
  target: 'Sasaran Soalan',
  reward: 'Ganjaran Syiling',
  date: 'Tarikh',
  classroom: 'Kelas (opsional)',
  allClasses: 'Semua kelas saya',
  subject: 'Subjek',
  subjectPlaceholder: '-- Pilih subjek --',
  submit: 'Cipta Misi',
  submitting: 'Menyimpan...',
  cancel: 'Batal',
  failed: 'Misi tidak dapat disimpan. Sila cuba lagi.',
} as const

/** Today (MYT), the lowest date the server accepts. */
const today = formatDateKey(clock.now())
const title = ref('')
const description = ref('')
const target = ref('10')
const reward = ref('10')
const date = ref(today)
const classroomId = ref('')
const subjectId = ref('')
const submitting = ref(false)
const fields = ref<Record<string, string>>({})
const failure = ref<string[]>([])
const INLINE_FIELDS = [
  'title',
  'description',
  'targetQuestions',
  'rewardCoins',
  'date',
  'classroomId',
  'subjectId',
]

/** A number input hands over a number once edited (Nuxt UI casts `type=number`), a string until then. */
const asInt = (v: unknown): number => (String(v).trim() === '' ? Number.NaN : Number(v))

/** The same rules and texts as `TeacherMissionCreateSchema`; "not before today" is MYT, as the server. */
function validate(): Record<string, string> {
  const e: Record<string, string> = {}
  const t = title.value.trim()
  if (t === '') e.title = MISSION_MESSAGES.titleRequired
  else if (t.length > 255) e.title = MISSION_MESSAGES.titleTooLong
  if (description.value.length > 500) e.description = MISSION_MESSAGES.descriptionTooLong
  const n = asInt(target.value)
  if (!Number.isInteger(n) || n < 1 || n > MISSION_TARGET_MAX)
    e.targetQuestions = MISSION_MESSAGES.target
  const r = asInt(reward.value)
  if (!Number.isInteger(r) || r < 0 || r > MISSION_REWARD_MAX)
    e.rewardCoins = MISSION_MESSAGES.reward
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date.value)) e.date = MISSION_MESSAGES.dateInvalid
  else if (date.value < today) e.date = MISSION_MESSAGES.datePast
  if (subjectId.value === '') e.subjectId = MISSION_MESSAGES.subjectRequired
  return e
}

async function submit(): Promise<void> {
  if (submitting.value) return
  failure.value = []
  fields.value = validate()
  if (Object.keys(fields.value).length > 0) return
  submitting.value = true
  try {
    await createTeacherMission({
      title: title.value.trim(),
      description: description.value.trim() === '' ? null : description.value.trim(),
      targetQuestions: asInt(target.value),
      rewardCoins: asInt(reward.value),
      date: date.value,
      classroomId: classroomId.value === '' ? null : classroomId.value,
      subjectId: subjectId.value,
    })
    flash.show({ type: 'success', message: MISSION_MESSAGES.created })
    emit('created')
  } catch (err) {
    if (err instanceof ApiError && err.fields) {
      fields.value = err.fields
      // A field without an inline slot goes to the box, so no message is lost.
      failure.value = Object.entries(err.fields)
        .filter(([key]) => !INLINE_FIELDS.includes(key))
        .map(([, message]) => message)
    } else failure.value = [moduleMessage(err) ?? COPY.failed]
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DsPanel data-testid="misi-form-card">
    <DsStack gap="md">
      <DsCluster gap="xs">
        <UIcon name="i-ph-target-duotone" />
        <DsHeading :level="2" variant="subheading">{{ COPY.title }}</DsHeading>
      </DsCluster>
      <DsStack as="form" gap="md" novalidate data-testid="misi-form" @submit.prevent="submit">
        <UAlert
          v-if="failure.length"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle-duotone"
          :title="failure.join(' ')"
          role="alert"
          data-testid="misi-failure"
        />

        <DsFormField :label="`${COPY.name} *`" name="misi-title" :error="fields.title">
          <UInput
            id="misi-title"
            v-model="title"
            type="text"
            maxlength="255"
            :placeholder="COPY.namePlaceholder"
            class="w-full"
            data-testid="misi-title"
          />
        </DsFormField>

        <DsFormField :label="COPY.description" name="misi-description" :error="fields.description">
          <UTextarea
            id="misi-description"
            v-model="description"
            :rows="3"
            :placeholder="COPY.descriptionPlaceholder"
            class="w-full"
            data-testid="misi-description"
          />
        </DsFormField>

        <DsGrid :cols="{ base: 1, md: 3 }" gap="md">
          <DsFormField
            :label="`${COPY.target} *`"
            name="misi-target"
            :error="fields.targetQuestions"
          >
            <UInput
              id="misi-target"
              v-model="target"
              type="number"
              inputmode="numeric"
              :min="1"
              :max="MISSION_TARGET_MAX"
              class="w-full"
              data-testid="misi-target"
            />
          </DsFormField>
          <DsFormField :label="`${COPY.reward} *`" name="misi-reward" :error="fields.rewardCoins">
            <UInput
              id="misi-reward"
              v-model="reward"
              type="number"
              inputmode="numeric"
              :min="0"
              :max="MISSION_REWARD_MAX"
              class="w-full"
              data-testid="misi-reward"
            />
          </DsFormField>
          <DsFormField :label="`${COPY.date} *`" name="misi-date" :error="fields.date">
            <UInput
              id="misi-date"
              v-model="date"
              type="date"
              :min="today"
              class="w-full"
              data-testid="misi-date"
            />
          </DsFormField>
        </DsGrid>

        <DsGrid :cols="{ base: 1, md: 2 }" gap="md">
          <DsFormField :label="COPY.classroom" name="misi-class" :error="fields.classroomId">
            <DsNativeSelect id="misi-class" v-model="classroomId" data-testid="misi-class">
              <option value="">{{ COPY.allClasses }}</option>
              <option v-for="c in classes" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField :label="`${COPY.subject} *`" name="misi-subject" :error="fields.subjectId">
            <DsNativeSelect id="misi-subject" v-model="subjectId" data-testid="misi-subject">
              <option value="">{{ COPY.subjectPlaceholder }}</option>
              <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
                {{ s.name }}
              </option>
            </DsNativeSelect>
          </DsFormField>
        </DsGrid>

        <DsCluster stack-below="sm">
          <UButton
            type="submit"
            size="xl"
            class="min-h-11 sm:min-w-48"
            :loading="submitting"
            :disabled="submitting"
            :icon="submitting ? undefined : 'i-ph-plus-circle-duotone'"
            data-testid="misi-submit"
          >
            {{ submitting ? COPY.submitting : COPY.submit }}
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            size="xl"
            class="min-h-11"
            :disabled="submitting"
            data-testid="misi-cancel"
            @click="emit('cancel')"
            >{{ COPY.cancel }}</UButton
          >
        </DsCluster>
      </DsStack>
    </DsStack>
  </DsPanel>
</template>
