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

import { AdminFormSection, AdminPageHeader, AdminStickyBar } from '@/ds/admin'
import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import {
  fetchTeacherClassrooms,
  fetchTeachers,
  registerCompStudents,
  type TeacherClassroomOption,
} from '../api/comp-students'
import { fetchAdminDefaults } from '../api/users'
import AdminAlert from '../components/AdminAlert.vue'
import AdminField from '../components/AdminField.vue'
import { COMP_LIST_PATH, COMP_PASTE_PLACEHOLDER, defaultPackageExpiry } from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import AdminSelect from '../components/native/AdminSelect.vue'

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
  <DsPage data-testid="comp-create-page">
    <AdminPageHeader
      title="Daftar Pelajar Komplimen"
      subtitle="Daftarkan pelajar komplimen ke kelas guru."
    />

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
        <AdminAlert :messages="errors" data-testid="comp-alert" />
      </div>

      <AdminFormSection
        title="Kelas"
        description="Pilih guru, kelasnya dan tarikh tamat pakej."
        icon="i-ph-chalkboard-teacher"
      >
        <AdminField for="comp-teacher" label="Guru">
          <AdminSelect id="comp-teacher" v-model="teacherId" data-testid="comp-teacher">
            <option value="">— Pilih guru —</option>
            <option v-for="t in teachers.data.value ?? []" :key="t.id" :value="String(t.id)">
              {{ t.name }} ({{ t.email }})
            </option>
          </AdminSelect>
        </AdminField>

        <AdminField for="comp-class" label="Kelas guru">
          <AdminSelect
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
          </AdminSelect>
          <p
            v-if="teacherId !== '' && classes.length === 0"
            class="text-label text-muted"
            data-testid="comp-no-class"
          >
            Guru ini tiada kelas aktif.
          </p>
        </AdminField>

        <AdminField for="comp-expiry" label="Tarikh tamat pakej">
          <UInput
            id="comp-expiry"
            v-model="expiresAt"
            type="date"
            name="package_expires_at"
            required
            class="w-full"
            data-testid="comp-expiry"
          />
        </AdminField>
      </AdminFormSection>

      <AdminFormSection
        title="Senarai Pelajar"
        description="Satu pelajar setiap baris."
        icon="i-ph-student"
      >
        <div class="md:col-span-2">
          <AdminField for="comp-students" label="Senarai pelajar">
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
          </AdminField>
        </div>
      </AdminFormSection>

      <AdminStickyBar>
        <UButton
          :to="COMP_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          label="Senarai pelajar komplimen"
          data-testid="comp-back"
        />
        <UButton
          type="submit"
          icon="i-ph-user-plus"
          label="Daftar Pelajar Komplimen"
          :loading="submitting"
          :disabled="submitting"
          data-testid="comp-submit"
        />
      </AdminStickyBar>
    </form>
  </DsPage>
</template>
