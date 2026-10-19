<script setup lang="ts">
/**
 * S2 `/admin/users/create` "Tambah Pengguna Baru" (M02-T5; FR-M02-20…36), v2 staff theme. A role-driven
 * form: only "Peranan *" shows until a role is chosen, then that role's section (standard roles,
 * `school_admin` generator, `ppd_officer` / `jpn_officer`). Choosing a role resets only the generator, the
 * JPN / PPD choice and the linked children (FR-M02-21); the standard fields, the grade, the IC and the
 * student / teacher school pick keep their values, and, as live, a checked grade and that school pick are
 * sent for every standard role.
 *
 * Native HTML5 validation only, as live: `role` is `required`, the other inputs are not (server-validated,
 * 5). A server `VALIDATION_ERROR` shows in the red alert above the form (one line per error), keeps the
 * role and the values, and clears the passwords (the generated password is kept). Success queues the flash
 * (UNVERIFIED COPY, the API `status`) and goes to the user list.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { Role } from '@/modules/m01-authentication'

import { useFlash } from '@/composables'
import { DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsPage } from '@/ds'

import { fetchJpnList, type Jpn, type SchoolSummary } from '../api/schools'
import {
  createAdminUser,
  fetchAdminDefaults,
  type AdminDefaults,
  type CreateAdminUserRequest,
  type StudentSearchItem,
} from '../api/users'
import GradeCards from '../components/GradeCards.vue'
import OfficerSelects from '../components/OfficerSelects.vue'
import ParentStudentLinker from '../components/ParentStudentLinker.vue'
import SchoolAdminGenerator from '../components/SchoolAdminGenerator.vue'
import StudentSchoolPicker from '../components/StudentSchoolPicker.vue'
import UserFormSwitch from '../components/UserFormSwitch.vue'
import { errorLines, USERS_LIST_PATH } from '../lib/user-list'
import {
  generatedAdminEmail,
  generatedAdminName,
  isOfficerRole,
  isStandardRole,
  ROLE_OPTIONS,
} from '../lib/user-form-options'

const router = useRouter()
const flash = useFlash()

const role = ref<Role | ''>('')

/** The standard fields; officers share name, email and the passwords (FR-M02-21 keeps them on a role change). */
const form = reactive({
  name: '',
  email: '',
  phone: '',
  password: '',
  passwordConfirmation: '',
  isActive: true,
  icNumber: '',
})
const grade = ref<number | null>(null)
const stdSchool = ref<SchoolSummary | null>(null)
const linked = ref<StudentSearchItem[]>([])

// school_admin generator
const genSchool = ref<SchoolSummary | null>(null)
const generated = ref(false)
const genName = ref('')
const genPhone = ref('')
const generating = ref(false)
const defaults = ref<AdminDefaults | null>(null)

// officers
const jpns = ref<Jpn[]>([])
const jpnState = ref('')
const ppdDistrict = ref('')

const copied = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | null = null
const saving = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

const isStandard = computed(() => role.value !== '' && isStandardRole(role.value))
const isOfficer = computed(() => role.value !== '' && isOfficerRole(role.value))
const isSchoolAdmin = computed(() => role.value === 'school_admin')
/** The officer role for `OfficerSelects` (only rendered while an officer role is chosen). */
const officerRole = computed(() => (role.value === 'ppd_officer' ? 'ppd_officer' : 'jpn_officer'))

onMounted(() => {
  // FR-M02-33: loaded once when the page opens; on failure the select keeps only its first option.
  fetchJpnList().then(
    (rows) => {
      jpns.value = rows
    },
    (err: unknown) => {
      console.error('JPN load error:', err)
    },
  )
  // INFERRED endpoint: the fixture default passwords the generator shows (FR-M02-30).
  fetchAdminDefaults().then(
    (value) => {
      defaults.value = value
    },
    () => undefined,
  )
})
onBeforeUnmount(() => {
  if (copiedTimer) clearTimeout(copiedTimer)
})

// FR-M02-21: a role change resets the generator, the JPN / PPD choice and the linked children only.
watch(role, () => {
  genSchool.value = null
  generated.value = false
  genName.value = ''
  genPhone.value = ''
  jpnState.value = ''
  ppdDistrict.value = ''
  linked.value = []
})

async function generate(): Promise<void> {
  const school = genSchool.value
  if (!school || school.code === '' || generating.value) return
  generating.value = true
  try {
    defaults.value ??= await fetchAdminDefaults()
    genName.value = generatedAdminName(school.name)
    generated.value = true
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    generating.value = false
  }
}

/** FR-M02-31: copy to the clipboard, then the "Disalin!" toast for 2 s. */
async function copyText(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    return
  }
  if (copiedTimer) clearTimeout(copiedTimer)
  copied.value = false
  await nextTick()
  copied.value = true
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

/** FR-M02-35: only the visible section's fields (plus the two live exceptions of FR-M02-21). */
function buildRequest(): CreateAdminUserRequest | null {
  const r = role.value
  if (r === '') return null
  if (r === 'school_admin') {
    const school = genSchool.value
    const password = defaults.value?.schoolAdminDefaultPassword
    if (!school || !generated.value || password === undefined) return null
    return {
      role: r,
      name: genName.value,
      email: generatedAdminEmail(school.code),
      phone: genPhone.value,
      password,
      passwordConfirmation: password,
      isActive: true,
      schoolId: school.id,
      ppdState: school.state,
      ppdDistrict: school.district,
    }
  }
  const base: CreateAdminUserRequest = {
    role: r,
    name: form.name,
    email: form.email,
    password: form.password,
    passwordConfirmation: form.passwordConfirmation,
  }
  if (isOfficerRole(r)) {
    return {
      ...base,
      isActive: true,
      ppdState: jpnState.value,
      ...(r === 'ppd_officer' ? { ppdDistrict: ppdDistrict.value } : {}),
    }
  }
  const request: CreateAdminUserRequest = { ...base, phone: form.phone, isActive: form.isActive }
  if (grade.value !== null) request.grade = grade.value
  if (r === 'student') request.icNumber = form.icNumber
  if (stdSchool.value) request.schoolId = stdSchool.value.id
  if (r === 'parent') request.linkedStudentIds = linked.value.map((s) => s.id)
  return request
}

async function submit(): Promise<void> {
  if (saving.value) return
  const request = buildRequest()
  if (!request) return
  saving.value = true
  errors.value = []
  try {
    const result = await createAdminUser(request)
    flash.success(result.status)
    await router.push(USERS_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
    // FR-M02-36: keep the role and the values, clear the passwords (the generated one is kept).
    form.password = ''
    form.passwordConfirmation = ''
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    title="Borang Pendaftaran Pengguna"
    subtitle="Isi maklumat untuk mendaftarkan pengguna baru"
    data-testid="user-create-page"
  >
    <form
      method="post"
      class="flex w-full min-w-0 flex-col gap-6"
      data-testid="user-form"
      @submit.prevent="submit"
    >
      <div ref="alertBox" class="empty:hidden">
        <UAlert
          v-if="errors.length > 0"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          data-testid="user-form-alert"
        >
          <template #description>
            <div class="flex flex-col gap-1">
              <p v-for="m in errors" :key="m">{{ m }}</p>
            </div>
          </template>
        </UAlert>
      </div>

      <DsFormSection
        title="Peranan"
        description="Pilih peranan; borang akan menyesuaikan diri."
        icon="user-gear"
        :columns="2"
      >
        <DsFormField native for="user-role" label="Peranan" required>
          <DsNativeSelect
            id="user-role"
            v-model="role"
            name="role"
            required
            data-testid="user-role"
          >
            <option value="">-- Pilih Peranan --</option>
            <option v-for="o in ROLE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </DsNativeSelect>
        </DsFormField>
      </DsFormSection>

      <!-- school_admin (FR-M02-27…31) -->
      <DsFormSection
        v-if="isSchoolAdmin"
        title="Admin Sekolah"
        description="Cari sekolah dan janakan akaun pentadbir."
        icon="buildings"
        :columns="2"
      >
        <div class="sm:col-span-2">
          <SchoolAdminGenerator
            v-model:school="genSchool"
            v-model:generated="generated"
            v-model:name="genName"
            v-model:phone="genPhone"
            :password="defaults?.schoolAdminDefaultPassword ?? ''"
            :generating="generating"
            @generate="generate"
            @copy="copyText"
          />
        </div>
      </DsFormSection>

      <!-- standard roles and officers (FR-M02-22, FR-M02-32) -->
      <DsFormSection
        v-if="isStandard || isOfficer"
        title="Maklumat Akaun"
        :description="
          isOfficer ? 'Maklumat pegawai dan kata laluan.' : 'Maklumat pengguna dan kata laluan.'
        "
        icon="identification-card"
        data-testid="user-fields"
        :columns="2"
      >
        <DsFormField native for="user-name" label="Nama" required>
          <UInput
            id="user-name"
            v-model="form.name"
            type="text"
            name="name"
            :placeholder="isOfficer ? 'Nama penuh pegawai' : 'Nama penuh'"
            class="w-full"
            data-testid="user-name"
          />
        </DsFormField>

        <DsFormField native for="user-email" label="Emel" required>
          <UInput
            id="user-email"
            v-model="form.email"
            type="email"
            name="email"
            placeholder="contoh@email.com"
            class="w-full"
            data-testid="user-email"
          />
        </DsFormField>

        <template v-if="isStandard">
          <DsFormField native for="user-phone" label="No. Telefon">
            <template #label-extra>
              <span class="text-caption text-muted">(Pilihan)</span></template
            >
            <UInput
              id="user-phone"
              v-model="form.phone"
              type="tel"
              name="phone"
              maxlength="14"
              inputmode="tel"
              placeholder="Cth: 0191234567"
              class="w-full"
              data-testid="user-phone"
            />
          </DsFormField>

          <div v-if="role === 'parent'" class="sm:col-span-2">
            <ParentStudentLinker v-model="linked" variant="create" />
          </div>

          <template v-if="role === 'student'">
            <div class="sm:col-span-2">
              <GradeCards v-model="grade" />
            </div>
            <div class="sm:col-span-2">
              <DsFormField
                native
                for="user-ic"
                label="No. Kad Pengenalan"
                hint="12 digit MyKad. Dilindungi PDPA."
              >
                <template #label-extra>
                  <span class="text-caption text-muted">(Pilihan)</span></template
                >
                <UInput
                  id="user-ic"
                  v-model="form.icNumber"
                  type="text"
                  name="ic_number"
                  maxlength="14"
                  inputmode="numeric"
                  placeholder="Cth: 031215101234"
                  class="w-full"
                  data-testid="user-ic"
                />
              </DsFormField>
            </div>
          </template>

          <div v-if="role === 'student' || role === 'teacher'" class="sm:col-span-2">
            <StudentSchoolPicker v-model="stdSchool" />
          </div>
        </template>

        <OfficerSelects
          v-else
          :key="role"
          v-model:state="jpnState"
          v-model:district="ppdDistrict"
          :role="officerRole"
          :jpns="jpns"
        />

        <DsFormField native for="user-password" label="Kata Laluan" required>
          <UInput
            id="user-password"
            v-model="form.password"
            type="password"
            name="password"
            autocomplete="new-password"
            placeholder="Minimum 6 aksara"
            class="w-full"
            data-testid="user-password"
          />
        </DsFormField>

        <DsFormField native for="user-password-confirm" label="Sahkan Kata Laluan" required>
          <UInput
            id="user-password-confirm"
            v-model="form.passwordConfirmation"
            type="password"
            name="password_confirmation"
            autocomplete="new-password"
            placeholder="Taip semula kata laluan"
            class="w-full"
            data-testid="user-password-confirm"
          />
        </DsFormField>

        <div v-if="isStandard" class="sm:col-span-2">
          <UserFormSwitch
            v-model="form.isActive"
            name="is_active"
            label="Aktifkan Akaun"
            hint="Pengguna yang tidak aktif tidak boleh log masuk"
            testid="user-active"
          />
        </div>
      </DsFormSection>

      <!-- FR-M02-34: the footer appears once a role is chosen -->
      <DsFormBar
        v-if="role !== ''"
        :cancel-to="USERS_LIST_PATH"
        submit-label="Daftar Pengguna"
        submit-icon="i-ph-user-plus"
        :saving="saving"
        :disabled="isSchoolAdmin && !generated"
        data-testid="user-form-footer"
      />
    </form>

    <UBadge
      v-if="copied"
      color="success"
      label="Disalin!"
      role="status"
      class="fixed right-4 bottom-4"
      data-testid="copied-toast"
    />
  </DsPage>
</template>
