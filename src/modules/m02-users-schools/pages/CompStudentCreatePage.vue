<script setup lang="ts">
/**
 * S7 `/admin/comp-students/create` "Daftar Pelajar Komplimen - Admin Panel" (M02-T7; FR-M02-70…73; BR-18),
 * v2 staff theme.
 *
 * Blue info alert (with the configured default password), then the form: "Guru" (not submitted; every
 * teacher), "Kelas guru" (`classroom_id`, required, disabled without a teacher; the teacher's classes),
 * "Tarikh tamat pakej" (default 31 December of this year) and "Senarai pelajar" (one `NAMA, NOKP` per line).
 * "Guru ini tiada kelas aktif." shows whenever a teacher is chosen and the class list is empty, also while
 * loading and after a load failure (console "[comp-students] load classrooms failed"), as live. Native
 * `required` validation. Success goes to S6 with the result flash (UNVERIFIED COPY: the API `status`,
 * INFERRED: the failed lines follow it); errors show a red alert and keep the input.
 */
import { nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsPage } from '@/ds'

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
</script>

<template>
  <DsPage
    title="Daftar Pelajar Komplimen"
    subtitle="Daftarkan pelajar komplimen ke kelas guru."
    data-testid="comp-create-page"
  >
    <UAlert color="info" variant="subtle" icon="i-ph-info" data-testid="comp-info">
      <template #description>
        Setiap pelajar dapat: username <strong>6 digit akhir IC</strong>@prestasiplus.my, kata
        laluan
        <strong data-testid="comp-info-password">{{
          defaults.data.value?.compStudentDefaultPassword ?? ''
        }}</strong
        >, pakej penuh percuma, dan <strong>syiling dimatikan</strong> (tak boleh kumpul/claim
        walaupun jawab soalan / main game).
      </template>
    </UAlert>

    <form
      method="post"
      class="flex w-full min-w-0 flex-col gap-6"
      data-testid="comp-form"
      @submit.prevent="submit"
    >
      <div ref="alertBox" class="empty:hidden">
        <UAlert
          v-if="errors.length > 0"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          data-testid="comp-alert"
        >
          <template #description>
            <div class="flex flex-col gap-1">
              <p v-for="m in errors" :key="m">{{ m }}</p>
            </div>
          </template>
        </UAlert>
      </div>

      <DsFormSection
        title="Kelas"
        description="Pilih guru, kelasnya dan tarikh tamat pakej."
        icon="chalkboard-teacher"
        :columns="2"
      >
        <DsFormField native for="comp-teacher" label="Guru">
          <DsNativeSelect id="comp-teacher" v-model="teacherId" data-testid="comp-teacher">
            <option value="">— Pilih guru —</option>
            <option v-for="t in teachers.data.value ?? []" :key="t.id" :value="String(t.id)">
              {{ t.name }} ({{ t.email }})
            </option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField native for="comp-class" label="Kelas guru">
          <DsNativeSelect
            id="comp-class"
            v-model="classroomId"
            name="classroom_id"
            required
            :disabled="teacherId === ''"
            data-testid="comp-class"
          >
            <option value="">— Pilih kelas —</option>
            <option v-for="c in classes" :key="c.id" :value="String(c.id)">
              {{ c.name }} ({{ c.classCode }})
            </option>
          </DsNativeSelect>
          <p
            v-if="teacherId !== '' && classes.length === 0"
            class="text-label text-muted"
            data-testid="comp-no-class"
          >
            Guru ini tiada kelas aktif.
          </p>
        </DsFormField>

        <DsFormField native for="comp-expiry" label="Tarikh tamat pakej">
          <UInput
            id="comp-expiry"
            v-model="expiresAt"
            type="date"
            name="package_expires_at"
            required
            class="w-full"
            data-testid="comp-expiry"
          />
        </DsFormField>
      </DsFormSection>

      <DsFormSection
        title="Senarai Pelajar"
        description="Satu pelajar setiap baris."
        icon="student"
        :columns="2"
      >
        <div class="sm:col-span-2">
          <DsFormField native for="comp-students" label="Senarai pelajar">
            <p class="text-label text-muted" data-testid="comp-help">
              Satu pelajar setiap baris, format:
              <code class="bg-elevated text-default">NAMA, NOKP</code>
              (cth:
              <code class="bg-elevated text-default">MUHAMMAD FULAN BIN FULAN, 090101101234</code>)
            </p>
            <UTextarea
              id="comp-students"
              v-model="students"
              name="students"
              :rows="8"
              required
              :placeholder="COMP_PASTE_PLACEHOLDER"
              class="w-full"
              data-testid="comp-students"
            />
          </DsFormField>
        </div>
      </DsFormSection>

      <DsFormBar
        :cancel-to="COMP_LIST_PATH"
        cancel-label="Senarai pelajar komplimen"
        submit-label="Daftar Pelajar Komplimen"
        submit-icon="i-ph-user-plus"
        :saving="submitting"
      />
    </form>
  </DsPage>
</template>
