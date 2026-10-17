<script setup lang="ts">
/**
 * S3 `/admin/users/:id/edit` "Edit Pengguna" (M02-T5; FR-M02-37…46), v2 staff theme. One card: the profile
 * header (avatar, name, e-mail, "Daftar" / "Kemaskini"), the common fields and the role sections, which
 * follow the "Peranan" select (DV-M02-04, FR-M02-45): `student` -> grade, IC, "Pakej Langganan" and school;
 * `teacher` -> school; `parent` -> "Anak yang Dipautkan"; any other role -> none. The state of a hidden
 * section is kept, so returning to the saved role shows it again; a section shown for a role the record did
 * not have starts empty (only the saved role's section is loaded from the record). Hidden sections are not
 * submitted (BR-11).
 *
 * "Tukar Kata Laluan" toggles the reset fields; a filled new password is sent with its confirmation.
 * Native HTML5 validation only; a server `VALIDATION_ERROR` shows in the red alert above the form, keeps
 * the values and clears the passwords. Success queues the flash (UNVERIFIED COPY) and goes to the list.
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import type { Role } from '@/modules/m01-authentication'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import type { SchoolSummary } from '../api/schools'
import {
  fetchAdminUser,
  updateAdminUser,
  type AdminUserDetail,
  type StudentSearchItem,
  type SubscriptionPackage,
  type UpdateAdminUserRequest,
} from '../api/users'
import AdminAlert from '../components/AdminAlert.vue'
import AdminField from '../components/AdminField.vue'
import AdminSchoolPicker from '../components/AdminSchoolPicker.vue'
import GradeCards from '../components/GradeCards.vue'
import NativePanel from '../components/native/NativePanel.vue'
import NativeSelect from '../components/native/NativeSelect.vue'
import ParentStudentLinker from '../components/ParentStudentLinker.vue'
import UserFormSwitch from '../components/UserFormSwitch.vue'
import { errorLines, initialsOf, USERS_LIST_PATH } from '../lib/user-list'
import {
  formatDate,
  formatDateTime,
  PACKAGE_OPTIONS,
  ROLE_OPTIONS,
  SECURITY_NOTES,
} from '../lib/user-form-options'

const props = defineProps<{ id: number }>()

const router = useRouter()
const flash = useFlash()

const {
  data: loaded,
  error: loadError,
  reload,
} = useApi(
  (signal) => fetchAdminUser(props.id, { signal }),
  () => props.id,
)

interface EditForm {
  name: string
  email: string
  phone: string
  role: Role | ''
  isActive: boolean
  icNumber: string
  subscriptionPackage: SubscriptionPackage
  hasPksk: boolean
  newPassword: string
  newPasswordConfirmation: string
}

const form = reactive<EditForm>({
  name: '',
  email: '',
  phone: '',
  role: '',
  isActive: true,
  icNumber: '',
  subscriptionPackage: 'none',
  hasPksk: false,
  newPassword: '',
  newPasswordConfirmation: '',
})
const grade = ref<number | null>(null)
const school = ref<SchoolSummary | null>(null)
const linked = ref<StudentSearchItem[]>([])
const passwordOpen = ref(false)
/** The IC as loaded (masked for a runtime-set IC, DV-M02-16): only sent when the admin edits it. */
const loadedIc = ref('')

function fill(user: AdminUserDetail): void {
  form.name = user.name
  form.email = user.email
  form.phone = user.phone ?? ''
  form.role = user.role === 'unmapped' ? '' : user.role
  form.isActive = user.isActive
  const student = user.role === 'student'
  grade.value = student ? user.grade : null
  form.icNumber = student ? (user.icNumber ?? '') : ''
  loadedIc.value = form.icNumber
  form.subscriptionPackage = student ? user.subscriptionPackage : 'none'
  form.hasPksk = student ? user.hasPkskSubscription : false
  school.value = student || user.role === 'teacher' ? user.school : null
  linked.value = user.role === 'parent' ? [...user.linkedStudents] : []
  form.newPassword = ''
  form.newPasswordConfirmation = ''
  passwordOpen.value = false
}

/** An unknown id is the standard 404 page, as live (module decision); other load failures keep the red box. */
const notFound = computed(() => isApiError(loadError.value) && loadError.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

watch(loaded, (user) => {
  if (user) fill(user)
})

const ready = computed(() => loaded.value !== null)
const saving = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

const showStudent = computed(() => form.role === 'student')
const showSchool = computed(() => form.role === 'student' || form.role === 'teacher')
const showParent = computed(() => form.role === 'parent')

/** FR-M02-46: the common fields, the visible section's fields and, when filled, the new password. */
function buildRequest(role: Role): UpdateAdminUserRequest {
  const request: UpdateAdminUserRequest = {
    name: form.name,
    email: form.email,
    phone: form.phone,
    role,
    isActive: form.isActive,
  }
  if (role === 'student') {
    if (grade.value !== null) request.grade = grade.value
    if (form.icNumber !== loadedIc.value) request.icNumber = form.icNumber
    request.subscriptionPackage = form.subscriptionPackage
    request.hasPkskSubscription = form.hasPksk
  }
  if (role === 'student' || role === 'teacher') request.schoolId = school.value?.id ?? null
  if (role === 'parent') request.linkedStudentIds = linked.value.map((s) => s.id)
  if (form.newPassword !== '' || form.newPasswordConfirmation !== '') {
    request.newPassword = form.newPassword
    request.newPasswordConfirmation = form.newPasswordConfirmation
  }
  return request
}

async function submit(): Promise<void> {
  if (saving.value || form.role === '') return
  saving.value = true
  errors.value = []
  try {
    const result = await updateAdminUser(props.id, buildRequest(form.role))
    flash.success(result.status)
    await router.push(USERS_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
    form.newPassword = ''
    form.newPasswordConfirmation = ''
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage data-testid="user-edit-page">
    <!-- Unknown id or a failed load: red box + the way back (INFERRED). -->
    <div v-if="loadError && !notFound" class="flex flex-col gap-3" data-testid="user-load-error">
      <AdminAlert :messages="errorLines(loadError)" />
      <div class="flex flex-wrap gap-3">
        <UButton label="Cuba Lagi" @click="reload()" />
        <UButton
          :to="USERS_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          label="Batal"
          data-testid="user-back"
        />
      </div>
    </div>

    <UCard v-else-if="!ready || loaded === null" class="max-w-4xl" data-testid="user-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton class="h-14 w-full" />
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </UCard>

    <template v-else>
      <UCard class="max-w-4xl">
        <form
          method="post"
          class="flex min-w-0 flex-col gap-6"
          data-testid="user-form"
          @submit.prevent="submit"
        >
          <!-- FR-M02-37: profile header -->
          <div class="flex items-center gap-4" data-testid="user-profile">
            <UAvatar
              :src="loaded.avatarUrl || undefined"
              :text="initialsOf(loaded.name)"
              alt="Avatar"
              size="3xl"
            />
            <div class="flex min-w-0 flex-col gap-1">
              <h3 class="truncate text-subheading text-highlighted" data-testid="user-profile-name">
                {{ loaded.name }}
              </h3>
              <p class="truncate text-label text-muted" data-testid="user-profile-email">
                {{ loaded.email }}
              </p>
              <p class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
                <span class="inline-flex items-center gap-1" data-testid="user-profile-created">
                  <UIcon name="i-ph-calendar-blank" class="size-4" aria-hidden="true" />
                  Daftar: {{ formatDate(loaded.createdAt) }}
                </span>
                <span class="inline-flex items-center gap-1" data-testid="user-profile-updated">
                  <UIcon name="i-ph-clock" class="size-4" aria-hidden="true" />
                  Kemaskini: {{ formatDateTime(loaded.updatedAt) }}
                </span>
              </p>
            </div>
          </div>

          <div ref="alertBox">
            <AdminAlert :messages="errors" data-testid="user-form-alert" />
          </div>

          <AdminField for="user-name" label="Nama" icon="i-ph-user" required>
            <UInput
              id="user-name"
              v-model="form.name"
              type="text"
              name="name"
              required
              size="lg"
              class="w-full"
              data-testid="user-name"
            />
          </AdminField>

          <AdminField for="user-email" label="Emel" icon="i-ph-envelope-simple" required>
            <UInput
              id="user-email"
              v-model="form.email"
              type="email"
              name="email"
              required
              size="lg"
              class="w-full"
              data-testid="user-email"
            />
          </AdminField>

          <AdminField for="user-phone" label="No. Telefon" icon="i-ph-phone" optional>
            <UInput
              id="user-phone"
              v-model="form.phone"
              type="tel"
              name="phone"
              maxlength="14"
              placeholder="Cth: 0191234567"
              size="lg"
              class="w-full"
              data-testid="user-phone"
            />
          </AdminField>

          <AdminField for="user-role" label="Peranan" icon="i-ph-user-gear" required>
            <NativeSelect
              id="user-role"
              v-model="form.role"
              name="role"
              required
              data-testid="user-role"
            >
              <option v-for="o in ROLE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </NativeSelect>
          </AdminField>

          <!-- student: FR-M02-39, 40 -->
          <template v-if="showStudent">
            <GradeCards v-model="grade" />

            <AdminField
              for="user-ic"
              label="No. Kad Pengenalan"
              icon="i-ph-identification-card"
              optional
              hint="12 digit MyKad. Dilindungi PDPA."
            >
              <UInput
                id="user-ic"
                v-model="form.icNumber"
                type="text"
                name="ic_number"
                maxlength="14"
                inputmode="numeric"
                placeholder="Cth: 031215101234"
                size="lg"
                class="w-full"
                data-testid="user-ic"
              />
            </AdminField>

            <NativePanel tone="soft" class="flex flex-col gap-3 p-4" data-testid="user-package-block">
              <h3 class="flex items-center gap-2 text-label text-highlighted">
                <UIcon name="i-ph-crown" class="size-4 text-muted" aria-hidden="true" />
                Pakej Langganan
              </h3>
              <AdminField for="user-package" label="Pakej Soalan" icon="i-ph-book-open">
                <NativeSelect
                  id="user-package"
                  v-model="form.subscriptionPackage"
                  name="subscription_package"
                  data-testid="user-package"
                >
                  <option v-for="o in PACKAGE_OPTIONS" :key="o.value" :value="o.value">
                    {{ o.label }}
                  </option>
                </NativeSelect>
              </AdminField>
              <UserFormSwitch
                v-model="form.hasPksk"
                name="has_pksk_subscription"
                label="Pakej PKSK"
                hint="RM20 — Akses penuh PKSK (tiada tarikh tamat)"
                testid="user-pksk"
              >
                <template #aside>
                  <span class="shrink-0 text-caption text-muted" data-testid="user-pksk-status">
                    {{ loaded.hasPkskSubscription ? 'Aktif' : 'Tiada Akses' }}
                  </span>
                </template>
              </UserFormSwitch>
              <p class="flex items-start gap-2 text-caption text-muted">
                <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" aria-hidden="true" />
                Tukar pakej secara manual. Tarikh tamat dikira automatik mengikut jenis pakej.
              </p>
            </NativePanel>
          </template>

          <!-- student, teacher: FR-M02-41 -->
          <AdminSchoolPicker v-if="showSchool" v-model="school" />

          <!-- parent: FR-M02-42 -->
          <NativePanel v-if="showParent" tone="soft" class="p-4">
            <ParentStudentLinker v-model="linked" variant="edit" />
          </NativePanel>

          <!-- FR-M02-43: password reset -->
          <div class="flex flex-col gap-3">
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              block
              icon="i-ph-key"
              trailing-icon="i-ph-caret-down"
              label="Tukar Kata Laluan"
              :aria-expanded="passwordOpen"
              aria-controls="user-password-panel"
              data-testid="user-password-toggle"
              @click="passwordOpen = !passwordOpen"
            />
            <p v-if="!passwordOpen" class="text-caption text-muted">
              Klik untuk buka bahagian reset kata laluan
            </p>
            <NativePanel
              v-show="passwordOpen"
              id="user-password-panel"
              tone="soft"
              class="flex flex-col gap-4 p-4"
              data-testid="user-password-panel"
            >
              <AdminField for="user-new-password" label="Kata Laluan Baru" icon="i-ph-lock">
                <UInput
                  id="user-new-password"
                  v-model="form.newPassword"
                  type="password"
                  name="new_password"
                  autocomplete="new-password"
                  placeholder="Minimum 6 aksara"
                  size="lg"
                  class="w-full"
                  data-testid="user-new-password"
                />
              </AdminField>
              <AdminField
                for="user-new-password-confirm"
                label="Sahkan Kata Laluan Baru"
                icon="i-ph-lock"
              >
                <UInput
                  id="user-new-password-confirm"
                  v-model="form.newPasswordConfirmation"
                  type="password"
                  name="new_password_confirmation"
                  autocomplete="new-password"
                  placeholder="Taip semula kata laluan baru"
                  size="lg"
                  class="w-full"
                  data-testid="user-new-password-confirm"
                />
              </AdminField>
              <p class="flex items-start gap-2 text-caption text-muted">
                <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" aria-hidden="true" />
                Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa
                serta-merta.
              </p>
            </NativePanel>
          </div>

          <UserFormSwitch
            v-model="form.isActive"
            name="is_active"
            label="Status Aktif"
            hint="Pengguna yang tidak aktif tidak boleh log masuk"
            testid="user-active"
          >
            <template #icon>
              <UIcon name="i-ph-toggle-right" class="size-4 text-muted" aria-hidden="true" />
            </template>
          </UserFormSwitch>

          <div class="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <UButton
              :to="USERS_LIST_PATH"
              color="neutral"
              variant="soft"
              icon="i-ph-arrow-left"
              label="Batal"
              data-testid="user-cancel"
            />
            <UButton
              type="submit"
              icon="i-ph-floppy-disk"
              label="Kemaskini"
              :loading="saving"
              :disabled="saving"
              data-testid="user-submit"
            />
          </div>
        </form>
      </UCard>

      <!-- FR-M02-44: "Nota Keselamatan" -->
      <UCard class="max-w-4xl" data-testid="user-security-notes">
        <h3 class="mb-3 flex items-center gap-2 text-label text-highlighted">
          <UIcon name="i-ph-info" class="size-5 text-muted" aria-hidden="true" />
          Nota Keselamatan
        </h3>
        <ul class="flex flex-col gap-2 text-label text-muted">
          <li v-for="note in SECURITY_NOTES" :key="note" class="flex items-start gap-2">
            <UIcon name="i-ph-check" class="mt-1 size-4 shrink-0" aria-hidden="true" />
            <span>{{ note }}</span>
          </li>
        </ul>
      </UCard>
    </template>
  </DsPage>
</template>
