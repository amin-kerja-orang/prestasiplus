<script setup lang="ts">
/**
 * S3 `/admin/users/:id/edit` "Edit Pengguna" (M02-T5; FR-M02-37…46). One card: the profile header (avatar,
 * name, e-mail, "Daftar" / "Kemaskini"), the common fields and the role sections, which follow the "Peranan"
 * select (DV-M02-04, FR-M02-45): `student` -> grade, IC, "Pakej Langganan" and school; `teacher` -> school;
 * `parent` -> "Anak yang Dipautkan"; any other role -> none. The state of a hidden section is kept, so
 * returning to the saved role shows it again; a section shown for a role the record did not have starts
 * empty (only the saved role's section is loaded from the record). Hidden sections are not submitted (BR-11).
 *
 * "Tukar Kata Laluan" toggles the reset fields; a filled new password is sent with its confirmation.
 * Native HTML5 validation only; a server `VALIDATION_ERROR` shows in the red alert above the form, keeps
 * the values and clears the passwords. Success queues the flash (UNVERIFIED COPY) and goes to the list.
 */
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  ChevronDown,
  Clock,
  Crown,
  IdCard,
  Info,
  KeyRound,
  Lock,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  ToggleRight,
  User,
  UserCog,
} from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { Role } from '@/modules/m01-authentication'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'
import { avatarSrc } from '@/shells/shared/avatar'

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
import { errorLines, USERS_LIST_PATH } from '../lib/user-list'
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
  // FR-M02-45: only the saved role's section is loaded; the others start empty.
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

const LABEL = 'mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700'
const ICON = 'h-4 w-4 text-indigo-500'
const BUTTON_BASE =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="space-y-4" data-testid="user-edit-page">
    <!-- Unknown id or a failed load: red box + the way back (INFERRED). -->
    <div v-if="loadError && !notFound" class="space-y-3" data-testid="user-load-error">
      <AlertBox :messages="errorLines(loadError)" />
      <div class="flex flex-wrap gap-3">
        <button
          type="button"
          :class="[BUTTON_BASE, 'bg-indigo-600 text-white shadow hover:bg-indigo-700']"
          @click="reload()"
        >
          Cuba Lagi
        </button>
        <RouterLink
          :to="USERS_LIST_PATH"
          :class="[BUTTON_BASE, 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
          data-testid="user-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Batal
        </RouterLink>
      </div>
    </div>

    <div
      v-else-if="!ready || loaded === null"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="user-form-skeleton"
    >
      <div class="h-14 animate-pulse rounded-xl bg-slate-100"></div>
      <div v-for="n in 4" :key="n" class="h-11 animate-pulse rounded-xl bg-slate-100"></div>
    </div>

    <template v-else>
      <form
        method="post"
        class="rounded-2xl bg-white p-5 shadow sm:p-6"
        data-testid="user-form"
        @submit.prevent="submit"
      >
        <!-- FR-M02-37: profile header -->
        <div
          class="mb-5 flex items-center gap-4 border-b border-slate-100 pb-5"
          data-testid="user-profile"
        >
          <img
            :src="avatarSrc(loaded)"
            alt="Avatar"
            class="h-16 w-16 shrink-0 rounded-full ring-4 ring-indigo-100"
          />
          <div class="min-w-0">
            <h3 class="truncate text-base font-bold text-slate-800" data-testid="user-profile-name">
              {{ loaded.name }}
            </h3>
            <p class="truncate text-sm text-slate-500" data-testid="user-profile-email">
              {{ loaded.email }}
            </p>
            <p class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1.5" data-testid="user-profile-created">
                <Calendar class="h-3.5 w-3.5" aria-hidden="true" />
                Daftar: {{ formatDate(loaded.createdAt) }}
              </span>
              <span class="inline-flex items-center gap-1.5" data-testid="user-profile-updated">
                <Clock class="h-3.5 w-3.5" aria-hidden="true" />
                Kemaskini: {{ formatDateTime(loaded.updatedAt) }}
              </span>
            </p>
          </div>
        </div>

        <div ref="alertBox" class="scroll-mt-4">
          <AlertBox :messages="errors" class="mb-5" data-testid="user-form-alert" />
        </div>

        <div class="space-y-5">
          <div>
            <label for="user-name" :class="LABEL">
              <User :class="ICON" aria-hidden="true" />
              Nama <span class="-ml-1.5 text-red-500">*</span>
            </label>
            <input
              id="user-name"
              v-model="form.name"
              type="text"
              name="name"
              required
              :class="[FORM_INPUT_CLASS, 'min-h-11']"
              data-testid="user-name"
            />
          </div>

          <div>
            <label for="user-email" :class="LABEL">
              <Mail :class="ICON" aria-hidden="true" />
              Emel <span class="-ml-1.5 text-red-500">*</span>
            </label>
            <input
              id="user-email"
              v-model="form.email"
              type="email"
              name="email"
              required
              :class="[FORM_INPUT_CLASS, 'min-h-11']"
              data-testid="user-email"
            />
          </div>

          <div>
            <label for="user-phone" :class="LABEL">
              <Phone class="h-4 w-4 text-emerald-500" aria-hidden="true" />
              No. Telefon <span class="-ml-1 font-normal text-slate-400">(Pilihan)</span>
            </label>
            <input
              id="user-phone"
              v-model="form.phone"
              type="tel"
              name="phone"
              maxlength="14"
              placeholder="Cth: 0191234567"
              :class="[FORM_INPUT_CLASS, 'min-h-11']"
              data-testid="user-phone"
            />
          </div>

          <div>
            <label for="user-role" :class="LABEL">
              <UserCog :class="ICON" aria-hidden="true" />
              Peranan <span class="-ml-1.5 text-red-500">*</span>
            </label>
            <select
              id="user-role"
              v-model="form.role"
              name="role"
              required
              :class="[FORM_SELECT_CLASS, 'min-h-11']"
              data-testid="user-role"
            >
              <option v-for="o in ROLE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </div>

          <!-- student: FR-M02-39, 40 -->
          <template v-if="showStudent">
            <div>
              <GradeCards v-model="grade" />
            </div>

            <div>
              <label for="user-ic" :class="LABEL">
                <IdCard class="h-4 w-4 text-amber-500" aria-hidden="true" />
                No. Kad Pengenalan <span class="-ml-1 font-normal text-slate-400">(Pilihan)</span>
              </label>
              <input
                id="user-ic"
                v-model="form.icNumber"
                type="text"
                name="ic_number"
                maxlength="14"
                inputmode="numeric"
                placeholder="Cth: 031215101234"
                :class="[FORM_INPUT_CLASS, 'min-h-11']"
                data-testid="user-ic"
              />
              <p class="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <ShieldCheck class="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
                12 digit MyKad. Dilindungi PDPA.
              </p>
            </div>

            <div
              class="rounded-2xl border border-indigo-200 bg-indigo-50 p-4"
              data-testid="user-package-block"
            >
              <h3 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
                <Crown class="h-4 w-4 text-amber-500" aria-hidden="true" />
                Pakej Langganan
              </h3>
              <label for="user-package" :class="LABEL">
                <BookOpen :class="ICON" aria-hidden="true" />
                Pakej Soalan
              </label>
              <select
                id="user-package"
                v-model="form.subscriptionPackage"
                name="subscription_package"
                :class="[FORM_SELECT_CLASS, 'min-h-11']"
                data-testid="user-package"
              >
                <option v-for="o in PACKAGE_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
              <div class="mt-3 border-t border-indigo-100 pt-3">
                <UserFormSwitch
                  v-model="form.hasPksk"
                  name="has_pksk_subscription"
                  label="Pakej PKSK"
                  hint="RM20 — Akses penuh PKSK (tiada tarikh tamat)"
                  testid="user-pksk"
                >
                  <template #aside>
                    <span class="shrink-0 text-xs text-slate-400" data-testid="user-pksk-status">
                      {{ loaded.hasPkskSubscription ? 'Aktif' : 'Tiada Akses' }}
                    </span>
                  </template>
                </UserFormSwitch>
              </div>
              <p class="mt-2 flex items-start gap-1.5 text-xs text-indigo-700">
                <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Tukar pakej secara manual. Tarikh tamat dikira automatik mengikut jenis pakej.
              </p>
            </div>
          </template>

          <!-- student, teacher: FR-M02-41 -->
          <div v-if="showSchool">
            <AdminSchoolPicker v-model="school" />
          </div>

          <!-- parent: FR-M02-42 -->
          <div v-if="showParent">
            <ParentStudentLinker v-model="linked" variant="edit" />
          </div>

          <!-- FR-M02-43: password reset -->
          <div>
            <button
              type="button"
              class="flex min-h-11 w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              data-testid="user-password-toggle"
              @click="passwordOpen = !passwordOpen"
            >
              <KeyRound class="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold text-amber-900">Tukar Kata Laluan</span>
                <span class="block text-xs text-amber-600">
                  Klik untuk buka bahagian reset kata laluan
                </span>
              </span>
              <ChevronDown
                class="h-5 w-5 shrink-0 text-amber-500 transition-transform"
                :class="passwordOpen ? 'rotate-180' : ''"
                aria-hidden="true"
              />
            </button>
            <div
              v-show="passwordOpen"
              id="user-password-panel"
              class="mt-3 space-y-4 rounded-xl border border-amber-200 p-4"
              data-testid="user-password-panel"
            >
              <div>
                <label for="user-new-password" :class="LABEL">
                  <Lock class="h-4 w-4 text-slate-500" aria-hidden="true" />
                  Kata Laluan Baru
                </label>
                <input
                  id="user-new-password"
                  v-model="form.newPassword"
                  type="password"
                  name="new_password"
                  autocomplete="new-password"
                  placeholder="Minimum 6 aksara"
                  :class="[FORM_INPUT_CLASS, 'min-h-11']"
                  data-testid="user-new-password"
                />
              </div>
              <div>
                <label for="user-new-password-confirm" :class="LABEL">
                  <Lock class="h-4 w-4 text-slate-500" aria-hidden="true" />
                  Sahkan Kata Laluan Baru
                </label>
                <input
                  id="user-new-password-confirm"
                  v-model="form.newPasswordConfirmation"
                  type="password"
                  name="new_password_confirmation"
                  autocomplete="new-password"
                  placeholder="Taip semula kata laluan baru"
                  :class="[FORM_INPUT_CLASS, 'min-h-11']"
                  data-testid="user-new-password-confirm"
                />
              </div>
              <p class="flex items-start gap-1.5 text-xs text-slate-500">
                <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa
                serta-merta.
              </p>
            </div>
          </div>

          <UserFormSwitch
            v-model="form.isActive"
            name="is_active"
            label="Status Aktif"
            hint="Pengguna yang tidak aktif tidak boleh log masuk"
            testid="user-active"
          >
            <template #icon>
              <ToggleRight class="h-4 w-4 text-emerald-500" aria-hidden="true" />
            </template>
          </UserFormSwitch>
        </div>

        <div
          class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"
        >
          <RouterLink
            :to="USERS_LIST_PATH"
            :class="[BUTTON_BASE, 'bg-slate-100 text-slate-600 hover:bg-slate-200']"
            data-testid="user-cancel"
          >
            <ArrowLeft class="h-4 w-4" aria-hidden="true" />
            Batal
          </RouterLink>
          <button
            type="submit"
            :disabled="saving"
            :class="[
              BUTTON_BASE,
              'bg-indigo-600 text-white shadow hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50',
            ]"
            data-testid="user-submit"
          >
            <LoadingSpinner v-if="saving" class="h-4 w-4" />
            <Save v-else class="h-4 w-4" aria-hidden="true" />
            Kemaskini
          </button>
        </div>
      </form>

      <!-- FR-M02-44: "Nota Keselamatan" -->
      <section
        class="rounded-2xl bg-linear-to-br from-blue-50 to-indigo-50 p-5 shadow sm:p-6"
        data-testid="user-security-notes"
      >
        <h3 class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800">
          <Info class="h-5 w-5 text-indigo-500" aria-hidden="true" />
          Nota Keselamatan
        </h3>
        <ul class="space-y-1.5 text-sm text-indigo-700">
          <li v-for="note in SECURITY_NOTES" :key="note" class="flex items-start gap-2">
            <Check class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{{ note }}</span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
