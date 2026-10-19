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
import {
  DsBackLink,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsGrid,
  DsHeading,
  DsText,
} from '@/ds'

import type { SchoolSummary } from '../api/schools'
import {
  fetchAdminUser,
  updateAdminUser,
  type AdminUserDetail,
  type StudentSearchItem,
  type SubscriptionPackage,
  type UpdateAdminUserRequest,
} from '../api/users'
import AdminSchoolPicker from '../components/AdminSchoolPicker.vue'
import GradeCards from '../components/GradeCards.vue'
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
  <DsPage
    title="Edit Pengguna"
    subtitle="Kemaskini maklumat dan akses pengguna."
    data-testid="user-edit-page"
  >
    <!-- Unknown id or a failed load: red box + the way back (INFERRED). -->
    <DsStack v-if="loadError && !notFound" data-testid="user-load-error">
      <DsLoadError message="Tidak dapat memuatkan pengguna. Sila cuba semula." @retry="reload()" />
      <DsBackLink :to="USERS_LIST_PATH" />
    </DsStack>

    <DsPanel v-else-if="!ready || loaded === null" padding="none" data-testid="user-form-skeleton">
      <div class="flex flex-col gap-6 p-6">
        <USkeleton class="h-16 w-full" />
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </DsPanel>

    <template v-else>
      <DsStack
        method="post"
        as="form"
        gap="lg"
        class="w-full"
        data-testid="user-form"
        @submit.prevent="submit"
      >
        <!-- FR-M02-37: profile header -->
        <DsPanel padding="none" data-testid="user-profile">
          <div class="flex flex-wrap items-center gap-4 p-4 sm:p-6">
            <UAvatar
              :src="loaded.avatarUrl || undefined"
              :text="initialsOf(loaded.name)"
              alt="Avatar"
              size="3xl"
            />
            <DsStack gap="2xs">
              <DsHeading :level="3" variant="heading" truncate data-testid="user-profile-name">
                {{ loaded.name }}
              </DsHeading>
              <DsText variant="body" tone="muted" truncate data-testid="user-profile-email">
                {{ loaded.email }}
              </DsText>
              <p class="flex flex-wrap gap-x-6 gap-y-1 text-label text-muted">
                <span class="inline-flex items-center gap-2" data-testid="user-profile-created">
                  <UIcon name="i-ph-calendar-blank" class="size-4" aria-hidden="true" />
                  Daftar: {{ formatDate(loaded.createdAt) }}
                </span>
                <span class="inline-flex items-center gap-2" data-testid="user-profile-updated">
                  <UIcon name="i-ph-clock" class="size-4" aria-hidden="true" />
                  Kemaskini: {{ formatDateTime(loaded.updatedAt) }}
                </span>
              </p>
            </DsStack>
          </div>
        </DsPanel>

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
              <DsStack gap="2xs">
                <p v-for="m in errors" :key="m">{{ m }}</p>
              </DsStack>
            </template>
          </UAlert>
        </div>

        <DsFormSection
          title="Maklumat Akaun"
          description="Nama, emel, telefon dan peranan."
          icon="identification-card"
          :columns="2"
        >
          <DsFormField native for="user-name" label="Nama" required>
            <UInput
              id="user-name"
              v-model="form.name"
              type="text"
              name="name"
              required
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
              required
              class="w-full"
              data-testid="user-email"
            />
          </DsFormField>

          <DsFormField native for="user-phone" label="No. Telefon">
            <template #label-extra>
              <DsText variant="caption" as="span">(Pilihan)</DsText></template
            >
            <UInput
              id="user-phone"
              v-model="form.phone"
              type="tel"
              name="phone"
              maxlength="14"
              placeholder="Cth: 0191234567"
              class="w-full"
              data-testid="user-phone"
            />
          </DsFormField>

          <DsFormField native for="user-role" label="Peranan" required>
            <DsNativeSelect
              id="user-role"
              v-model="form.role"
              name="role"
              required
              data-testid="user-role"
            >
              <option v-for="o in ROLE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <div class="sm:col-span-2">
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
          </div>
        </DsFormSection>

        <!-- student: FR-M02-39, 40 -->
        <template v-if="showStudent">
          <DsFormSection
            title="Maklumat Pelajar"
            description="Tahap pendidikan dan No. Kad Pengenalan."
            icon="graduation-cap"
            :columns="2"
          >
            <div class="sm:col-span-2"><GradeCards v-model="grade" /></div>

            <DsFormField
              native
              for="user-ic"
              label="No. Kad Pengenalan"
              hint="12 digit MyKad. Dilindungi PDPA."
            >
              <template #label-extra>
                <DsText variant="caption" as="span">(Pilihan)</DsText></template
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
          </DsFormSection>

          <DsFormSection
            title="Pakej Langganan"
            description="Tukar pakej secara manual. Tarikh tamat dikira automatik mengikut jenis pakej."
            icon="crown"
            data-testid="user-package-block"
            :columns="2"
          >
            <DsFormField native for="user-package" label="Pakej Soalan">
              <DsNativeSelect
                id="user-package"
                v-model="form.subscriptionPackage"
                name="subscription_package"
                data-testid="user-package"
              >
                <option v-for="o in PACKAGE_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </DsNativeSelect>
            </DsFormField>
            <div class="self-end">
              <UserFormSwitch
                v-model="form.hasPksk"
                name="has_pksk_subscription"
                label="Pakej PKSK"
                hint="RM20 — Akses penuh PKSK (tiada tarikh tamat)"
                testid="user-pksk"
              >
                <template #aside>
                  <UBadge
                    :color="loaded.hasPkskSubscription ? 'success' : 'neutral'"
                    variant="subtle"
                    :label="loaded.hasPkskSubscription ? 'Aktif' : 'Tiada Akses'"
                    data-testid="user-pksk-status"
                  />
                </template>
              </UserFormSwitch>
            </div>
          </DsFormSection>
        </template>

        <!-- student, teacher: FR-M02-41 -->
        <DsFormSection
          v-if="showSchool"
          title="Sekolah"
          description="Sekolah pengguna ini."
          icon="buildings"
          :columns="2"
        >
          <div class="sm:col-span-2"><AdminSchoolPicker v-model="school" /></div>
        </DsFormSection>

        <!-- parent: FR-M02-42 -->
        <DsFormSection
          v-if="showParent"
          title="Anak yang Dipautkan"
          description="Pelajar yang dipautkan kepada ibu bapa ini."
          icon="users"
          :columns="2"
        >
          <div class="sm:col-span-2"><ParentStudentLinker v-model="linked" variant="edit" /></div>
        </DsFormSection>

        <!-- FR-M02-43: password reset -->
        <DsPanel padding="none">
          <div class="flex flex-col gap-4 p-4 sm:p-6">
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
            <DsText v-if="!passwordOpen" variant="label" as="p" tone="muted">
              Klik untuk buka bahagian reset kata laluan
            </DsText>
            <DsPanel
              v-show="passwordOpen"
              id="user-password-panel"
              tone="inset"
              data-testid="user-password-panel"
            >
              <DsStack>
                <DsGrid :cols="{ base: 1, md: 2 }" gap="lg">
                  <DsFormField native for="user-new-password" label="Kata Laluan Baru">
                    <UInput
                      id="user-new-password"
                      v-model="form.newPassword"
                      type="password"
                      name="new_password"
                      autocomplete="new-password"
                      placeholder="Minimum 6 aksara"
                      class="w-full"
                      data-testid="user-new-password"
                    />
                  </DsFormField>
                  <DsFormField
                    native
                    for="user-new-password-confirm"
                    label="Sahkan Kata Laluan Baru"
                  >
                    <UInput
                      id="user-new-password-confirm"
                      v-model="form.newPasswordConfirmation"
                      type="password"
                      name="new_password_confirmation"
                      autocomplete="new-password"
                      placeholder="Taip semula kata laluan baru"
                      class="w-full"
                      data-testid="user-new-password-confirm"
                    />
                  </DsFormField>
                </DsGrid>
                <p class="flex items-start gap-2 text-label text-muted">
                  <UIcon name="i-ph-info" class="size-4 shrink-0" aria-hidden="true" />
                  Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa
                  serta-merta.
                </p>
              </DsStack>
            </DsPanel>
          </div>
        </DsPanel>

        <!-- FR-M02-44: "Nota Keselamatan" -->
        <DsPanel padding="none" data-testid="user-security-notes">
          <div class="p-4 sm:p-6">
            <h3 class="mb-4 flex items-center gap-2 text-body text-highlighted">
              <UIcon name="i-ph-info" class="size-5 text-muted" aria-hidden="true" />
              Nota Keselamatan
            </h3>
            <ul class="flex flex-col gap-2 text-body text-muted">
              <li v-for="note in SECURITY_NOTES" :key="note" class="flex items-start gap-2">
                <UIcon name="i-ph-check" class="mt-1 size-4 shrink-0" aria-hidden="true" />
                <span>{{ note }}</span>
              </li>
            </ul>
          </div>
        </DsPanel>

        <DsFormBar :cancel-to="USERS_LIST_PATH" submit-label="Kemaskini" :saving="saving" />
      </DsStack>
    </template>
  </DsPage>
</template>
