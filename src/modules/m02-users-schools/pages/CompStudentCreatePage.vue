<script setup lang="ts">
/**
 * S7 `/admin/comp-students/create` "Daftar Pelajar Komplimen - Admin Panel" (M02-T7; FR-M02-70…73; BR-18).
 *
 * Blue info alert (with the configured default password), then the form: "Guru" (not submitted; every
 * teacher), "Kelas guru" (`classroom_id`, required, disabled without a teacher; the teacher's classes),
 * "Tarikh tamat pakej" (default 31 December of this year) and "Senarai pelajar" (one `NAMA, NOKP` per line).
 * "Guru ini tiada kelas aktif." shows whenever a teacher is chosen and the class list is empty, also while
 * loading and after a load failure (console "[comp-students] load classrooms failed"), as live. Native
 * `required` validation. Success goes to S6 with the result flash (UNVERIFIED COPY: the API `status`,
 * INFERRED: the failed lines follow it); errors show a red alert and keep the input.
 */
import { ArrowLeft, Info, LoaderCircle, UserPlus } from '@lucide/vue'
import { nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'

import {
  fetchTeacherClassrooms,
  fetchTeachers,
  registerCompStudents,
  type TeacherClassroomOption,
} from '../api/comp-students'
import { fetchAdminDefaults } from '../api/users'
import { COMP_LIST_PATH, COMP_PASTE_PLACEHOLDER, defaultPackageExpiry } from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'

const router = useRouter()
const flash = useFlash()

const teachers = useApi((signal) => fetchTeachers({ signal }))
const defaults = useApi((signal) => fetchAdminDefaults({ signal }))
watch(teachers.error, (err) => {
  if (err) console.error('[comp-students] load teachers failed', err)
})

const teacherId = ref('')
const classes = ref<TeacherClassroomOption[]>([])
const classroomId = ref('')
const expiresAt = ref(defaultPackageExpiry())
const students = ref('')

const submitting = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

let controller: AbortController | null = null

// Changing the teacher clears the class and loads that teacher's classes (FR-M02-71).
watch(teacherId, async (id) => {
  controller?.abort()
  controller = null
  classes.value = []
  classroomId.value = ''
  if (id === '') return
  const current = new AbortController()
  controller = current
  try {
    const list = await fetchTeacherClassrooms(Number(id), { signal: current.signal })
    if (controller === current) classes.value = list
  } catch (err) {
    if (controller !== current) return
    classes.value = []
    console.error('[comp-students] load classrooms failed', err)
  }
})

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  errors.value = []
  try {
    const result = await registerCompStudents({
      classroomId: classroomId.value === '' ? null : Number(classroomId.value),
      packageExpiresAt: expiresAt.value,
      students: students.value,
    })
    flash.success(result.status)
    await router.push(COMP_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    submitting.value = false
  }
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const CODE = 'rounded bg-slate-100 px-1 py-0.5 font-mono text-slate-600'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-5" data-testid="comp-create-page">
    <div
      class="flex items-start gap-3 rounded-xl border-l-4 border-blue-400 bg-blue-50 px-4 py-3 text-sm text-blue-800"
      data-testid="comp-info"
    >
      <Info class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p class="min-w-0 break-words">
        Setiap pelajar dapat: username <strong>6 digit akhir IC</strong>@prestasiplus.my, kata
        laluan
        <strong data-testid="comp-info-password">{{
          defaults.data.value?.compStudentDefaultPassword ?? ''
        }}</strong
        >, pakej penuh percuma, dan <strong>syiling dimatikan</strong> (tak boleh kumpul/claim
        walaupun jawab soalan / main game).
      </p>
    </div>

    <form
      method="post"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="comp-form"
      @submit.prevent="submit"
    >
      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" data-testid="comp-alert" />
      </div>

      <div>
        <label for="comp-teacher" :class="LABEL">Guru</label>
        <select
          id="comp-teacher"
          v-model="teacherId"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="comp-teacher"
        >
          <option value="">— Pilih guru —</option>
          <option v-for="t in teachers.data.value ?? []" :key="t.id" :value="String(t.id)">
            {{ t.name }} ({{ t.email }})
          </option>
        </select>
      </div>

      <div>
        <label for="comp-class" :class="LABEL">Kelas guru</label>
        <select
          id="comp-class"
          v-model="classroomId"
          name="classroom_id"
          required
          :disabled="teacherId === ''"
          :class="[
            FORM_INPUT_CLASS,
            'min-h-11 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
          ]"
          data-testid="comp-class"
        >
          <option value="">— Pilih kelas —</option>
          <option v-for="c in classes" :key="c.id" :value="String(c.id)">
            {{ c.name }} ({{ c.classCode }})
          </option>
        </select>
        <p
          v-if="teacherId !== '' && classes.length === 0"
          class="mt-1 text-xs text-slate-500"
          data-testid="comp-no-class"
        >
          Guru ini tiada kelas aktif.
        </p>
      </div>

      <div>
        <label for="comp-expiry" :class="LABEL">Tarikh tamat pakej</label>
        <input
          id="comp-expiry"
          v-model="expiresAt"
          type="date"
          name="package_expires_at"
          required
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="comp-expiry"
        />
      </div>

      <div>
        <label for="comp-students" :class="LABEL">Senarai pelajar</label>
        <p class="mb-2 text-xs text-slate-500" data-testid="comp-help">
          Satu pelajar setiap baris, format: <code :class="CODE">NAMA, NOKP</code> (cth:
          <code :class="CODE">MUHAMMAD FULAN BIN FULAN, 090101101234</code>)
        </p>
        <textarea
          id="comp-students"
          v-model="students"
          name="students"
          rows="8"
          required
          :placeholder="COMP_PASTE_PLACEHOLDER"
          :class="[FORM_INPUT_CLASS, 'font-mono']"
          data-testid="comp-students"
        ></textarea>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 pt-2">
        <RouterLink
          :to="COMP_LIST_PATH"
          class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          data-testid="comp-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Senarai pelajar komplimen
        </RouterLink>
        <button
          type="submit"
          :disabled="submitting"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60"
          data-testid="comp-submit"
        >
          <LoaderCircle v-if="submitting" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <UserPlus v-else class="h-4 w-4" aria-hidden="true" />
          Daftar Pelajar Komplimen
        </button>
      </div>
    </form>
  </div>
</template>
