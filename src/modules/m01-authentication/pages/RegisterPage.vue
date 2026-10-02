<script setup lang="ts">
/**
 * S2 `/register` "Daftar - PRESTASIPLUS" (M01-T3; FR-M01-01, 04, 08, 15..26, 66, 70).
 * One page with native HTML5 validation (`required`, `type=email`, `maxlength`); the role cards and
 * grade buttons are click/tap targets without keyboard semantics, as live (FR-M01-66, DV-15
 * rejected). The URL query never changes the form: `?role=` is ignored and `?ref=` is only carried
 * in the background (FR-M01-18, 70). On success the new session is stored (not remembered) and the
 * app goes to the role landing page (FR-M01-25, INFERRED); on failure the red alert lists the
 * server messages and every value is kept except the two passwords (FR-M01-26, INFERRED).
 */
import {
  Building,
  GraduationCap,
  Handshake,
  House,
  IdCard,
  Info,
  Lock,
  Mail,
  Phone,
  School,
  Search,
  Shield,
  User,
  UserPlus,
  X,
} from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useSessionStore } from '@/stores/session'

import { register, type RegisterRequest, type SchoolSummary } from '../api'
import AuthLayout from '../components/auth/AuthLayout.vue'
import AuthWelcomePanel from '../components/auth/AuthWelcomePanel.vue'
import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SUBMIT_CLASS,
} from '../components/auth/classes'
import PasswordInput from '../components/auth/PasswordInput.vue'
import { REGISTER_TILES } from '../components/auth/welcome-tiles'
import { SCHOOL_MIN_QUERY, useSchoolSearch } from '../composables/useSchoolSearch'
import { errorLines } from '../lib/error-lines'
import {
  DARJAH_GRADES,
  REGISTER_STATE_OPTIONS,
  ROLE_CARDS,
  TINGKATAN_GRADES,
  type RegisterRole,
} from '../lib/lookups'
import { clearPendingRef, getPendingRef, setPendingRef } from '../lib/pending-ref'

const route = useRoute()
const router = useRouter()
const session = useSessionStore()

// FR-M01-70: a `ref` code is only carried in the background; the form is unchanged.
const refParam = route.query.ref
const refCode = Array.isArray(refParam) ? refParam[0] : refParam
if (typeof refCode === 'string' && refCode !== '') setPendingRef(refCode)

const name = ref('')
const email = ref('')
const phone = ref('')
const role = ref<RegisterRole>('student')
const grade = ref<number | null>(null)
const icNumber = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const loading = ref(false)
const errors = ref<string[]>([])

const pickerRoot = ref<HTMLElement | null>(null)
const { picker, state, setState } = useSchoolSearch({ limit: 15, root: pickerRoot })

function onSearchInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
}

function onStateChange(event: Event): void {
  setState((event.target as HTMLSelectElement).value)
}

function clearSchool(): void {
  picker.selected.value = null
}

function schoolDetail(school: SchoolSummary, withDistrict: boolean): string {
  const parts = [school.type, school.state]
  if (withDistrict && school.district) parts.push(school.district)
  return parts.join(' · ')
}

/** State select and school search sit side by side at every width (SRS §10); tighter padding keeps them unclipped down to 320px. */
const PAIR_INPUT_CLASS = `${AUTH_INPUT_CLASS} min-w-0 px-3! text-sm! placeholder:text-xs`

const selectedButton = 'bg-linear-to-r from-indigo-500 to-violet-500 text-white shadow-lg'
const idleButton = 'bg-gray-100 text-gray-700'

async function submit(): Promise<void> {
  loading.value = true
  errors.value = []
  const isStudent = role.value === 'student'
  const request: RegisterRequest = {
    name: name.value,
    email: email.value,
    phone: phone.value === '' ? null : phone.value,
    role: role.value,
    ...(isStudent
      ? { grade: grade.value, icNumber: icNumber.value === '' ? null : icNumber.value }
      : {}),
    schoolId: picker.selected.value?.id ?? null,
    password: password.value,
    passwordConfirmation: passwordConfirmation.value,
    referralCode: getPendingRef(),
  }
  try {
    const next = await register(request)
    clearPendingRef()
    session.setSession(next)
    await router.push(next.user.landingPath)
  } catch (err) {
    errors.value = errorLines(err)
    password.value = ''
    passwordConfirmation.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout tagline="Daftar Akaun Baru 🇲🇾">
    <template #welcome>
      <AuthWelcomePanel mascot="🎒" heading="Sertai Kami! 🌟" :tiles="REGISTER_TILES">
        Daftar sekarang dan mulakan perjalanan pembelajaran yang menyeronokkan!
      </AuthWelcomePanel>
    </template>

    <!-- Static, decorative step indicator (FR-M01-15): never interactive, never changes. -->
    <div
      class="mb-6 flex items-center justify-center gap-2 text-sm font-bold"
      data-testid="register-steps"
    >
      <span
        class="flex h-8 w-8 items-center justify-center rounded-full text-white bg-cta-gradient"
        data-active="true"
        >1</span
      >
      <span class="h-0.5 w-8 bg-gray-200"></span>
      <span
        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500"
        data-active="false"
        >2</span
      >
      <span class="h-0.5 w-8 bg-gray-200"></span>
      <span
        class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-gray-500"
        data-active="false"
        >3</span
      >
    </div>

    <form data-testid="register-form" class="space-y-5" @submit.prevent="submit">
      <AlertBox :messages="errors" data-testid="register-alert" />

      <div>
        <label for="name" :class="AUTH_LABEL_CLASS">
          <User class="h-4 w-4 text-blue-500" />
          Nama Penuh
        </label>
        <input
          id="name"
          v-model="name"
          type="text"
          name="name"
          required
          placeholder="Muhammad Fulan bin Fulan"
          :class="AUTH_INPUT_CLASS"
          data-testid="register-name"
        />
      </div>

      <div>
        <label for="email" :class="AUTH_LABEL_CLASS">
          <Mail class="h-4 w-4 text-blue-500" />
          Alamat Email
        </label>
        <input
          id="email"
          v-model="email"
          type="email"
          name="email"
          required
          placeholder="nama@email.com"
          :class="AUTH_INPUT_CLASS"
          data-testid="register-email"
        />
      </div>

      <div>
        <label for="phone" :class="AUTH_LABEL_CLASS">
          <Phone class="h-4 w-4 text-green-500" />
          No. Telefon (Pilihan)
        </label>
        <input
          id="phone"
          v-model="phone"
          type="tel"
          name="phone"
          maxlength="14"
          inputmode="tel"
          placeholder="Cth: 0191234567"
          :class="AUTH_INPUT_CLASS"
          data-testid="register-phone"
        />
      </div>

      <div>
        <div :class="AUTH_LABEL_CLASS">Saya adalah...</div>
        <div class="grid grid-cols-3 gap-2 sm:gap-3">
          <!-- Click/tap only, no keyboard or ARIA semantics (FR-M01-66). -->
          <div
            v-for="card in ROLE_CARDS"
            :key="card.value"
            class="min-h-11 cursor-pointer rounded-2xl border-2 p-2 text-center transition hover:-translate-y-1 sm:p-3"
            :class="
              role === card.value
                ? 'border-indigo-500 bg-linear-to-br from-indigo-50 to-indigo-100 ring-[3px] ring-indigo-500/20'
                : 'border-gray-200 bg-white'
            "
            :data-selected="role === card.value"
            :data-testid="`role-${card.value}`"
            @click="role = card.value"
          >
            <div class="text-2xl sm:text-3xl">{{ card.emoji }}</div>
            <div class="text-sm font-bold text-gray-800">{{ card.title }}</div>
            <div class="text-xs text-gray-500">{{ card.text }}</div>
          </div>
        </div>
      </div>

      <div v-if="role === 'student'" data-testid="register-levels">
        <div :class="AUTH_LABEL_CLASS">
          <GraduationCap class="h-4 w-4 text-indigo-500" />
          Pilih Tahap Anda
        </div>
        <div class="mb-3">
          <div
            class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
          >
            <School class="h-4 w-4" />
            Sekolah Rendah
          </div>
          <div class="grid grid-cols-3 gap-2">
            <div
              v-for="n in DARJAH_GRADES"
              :key="n"
              class="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl py-2 transition hover:scale-105"
              :class="grade === n ? selectedButton : idleButton"
              :data-selected="grade === n"
              :data-testid="`grade-${String(n)}`"
              @click="grade = n"
            >
              <span class="text-xs">Darjah</span>
              <span class="text-lg font-bold">{{ n }}</span>
            </div>
          </div>
        </div>
        <div>
          <div
            class="mb-2 flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-500 uppercase"
          >
            <Building class="h-4 w-4" />
            Sekolah Menengah
          </div>
          <div class="grid grid-cols-5 gap-2">
            <div
              v-for="n in TINGKATAN_GRADES"
              :key="n"
              class="flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl py-2 transition hover:scale-105"
              :class="grade === n + 6 ? selectedButton : idleButton"
              :data-selected="grade === n + 6"
              :data-testid="`grade-${String(n + 6)}`"
              @click="grade = n + 6"
            >
              <span class="text-xs">Ting.</span>
              <span class="text-lg font-bold">{{ n }}</span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="role === 'student'">
        <label for="ic_number" :class="AUTH_LABEL_CLASS">
          <IdCard class="h-4 w-4 text-purple-500" />
          No. Kad Pengenalan (Pilihan)
        </label>
        <input
          id="ic_number"
          v-model="icNumber"
          type="text"
          name="ic_number"
          maxlength="14"
          inputmode="numeric"
          placeholder="Cth: 031215101234"
          :class="AUTH_INPUT_CLASS"
          data-testid="register-ic"
        />
        <p class="mt-2 flex items-center gap-2 text-xs text-green-700">
          <Shield class="h-4 w-4 shrink-0" />
          Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan.
        </p>
      </div>

      <div ref="pickerRoot" class="relative" data-testid="register-school">
        <label for="school_search" :class="AUTH_LABEL_CLASS">
          <School class="h-4 w-4 text-orange-500" />
          Sekolah (Pilihan)
        </label>

        <div
          v-if="picker.selected.value"
          class="flex items-center gap-3 rounded-2xl border-2 border-green-200 bg-green-50 p-3"
          data-testid="school-chip"
        >
          <div class="min-w-0 flex-1">
            <div class="font-semibold break-words text-gray-800">
              {{ picker.selected.value.name }}
            </div>
            <div class="text-xs text-gray-600">
              {{ schoolDetail(picker.selected.value, false) }}
            </div>
          </div>
          <button
            type="button"
            class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-green-100"
            data-testid="school-clear"
            @click="clearSchool"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <template v-else>
          <div class="grid grid-cols-2 gap-2 sm:gap-3">
            <select
              :value="state"
              :class="PAIR_INPUT_CLASS"
              data-testid="register-state"
              @change="onStateChange"
            >
              <option value="">Negeri</option>
              <option
                v-for="option in REGISTER_STATE_OPTIONS"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </option>
            </select>
            <input
              id="school_search"
              type="text"
              autocomplete="off"
              placeholder="Taip nama sekolah..."
              :value="picker.term.value"
              :class="PAIR_INPUT_CLASS"
              data-testid="register-school-search"
              @focus="picker.onFocus"
              @input="onSearchInput"
            />
          </div>

          <div
            v-if="
              picker.open.value &&
              (picker.results.value.length > 0 || picker.term.value.length >= SCHOOL_MIN_QUERY)
            "
            class="absolute right-0 left-0 z-20 mt-2 max-h-64 overflow-y-auto rounded-2xl border-2 border-gray-200 bg-white shadow-xl"
            data-testid="school-dropdown"
          >
            <div
              v-for="school in picker.results.value"
              :key="school.id"
              class="cursor-pointer border-b border-gray-100 px-4 py-3 last:border-b-0 hover:bg-indigo-50"
              data-testid="school-option"
              @click="picker.select(school)"
            >
              <div class="text-sm font-bold break-words text-gray-800">{{ school.name }}</div>
              <div class="text-xs text-gray-500">{{ schoolDetail(school, true) }}</div>
            </div>
            <div
              v-if="
                picker.results.value.length === 0 &&
                picker.term.value.length >= SCHOOL_MIN_QUERY &&
                !picker.searching.value
              "
              class="flex flex-col items-center gap-1 px-4 py-6 text-sm text-gray-500"
              data-testid="school-empty"
            >
              <Search class="h-5 w-5" />
              Tiada sekolah dijumpai
            </div>
          </div>
        </template>
      </div>

      <div>
        <label for="password" :class="AUTH_LABEL_CLASS">
          <Lock class="h-4 w-4 text-green-500" />
          Kata Laluan
        </label>
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="••••••••"
          autocomplete="new-password"
          testid="register-password"
        />
        <p class="mt-2 flex items-center gap-2 text-xs text-gray-500">
          <Info class="h-4 w-4 shrink-0" />
          Minimum 6 aksara
        </p>
      </div>

      <div>
        <label for="password_confirmation" :class="AUTH_LABEL_CLASS">
          <Lock class="h-4 w-4 text-green-500" />
          Sahkan Kata Laluan
        </label>
        <PasswordInput
          id="password_confirmation"
          v-model="passwordConfirmation"
          name="password_confirmation"
          placeholder="••••••••"
          autocomplete="new-password"
          testid="register-password-confirm"
        />
      </div>

      <button
        type="submit"
        :disabled="loading"
        :class="AUTH_SUBMIT_CLASS"
        data-testid="register-submit"
      >
        <template v-if="loading">
          <LoadingSpinner />
          Sedang Mendaftar...
        </template>
        <template v-else>
          <UserPlus class="h-5 w-5" />
          Daftar Sekarang
        </template>
      </button>

      <p class="text-center text-sm text-gray-600">
        <RouterLink
          to="/login"
          class="inline-flex min-h-11 items-center gap-1 text-gray-600 hover:text-gray-800"
        >
          Sudah ada akaun?
          <strong class="text-indigo-600 underline decoration-wavy underline-offset-4"
            >Log Masuk 🔑</strong
          >
        </RouterLink>
      </p>

      <p class="text-center text-sm text-gray-600">
        <RouterLink
          to="/sponsor/register"
          class="inline-flex min-h-11 items-center gap-2 text-gray-600 hover:text-gray-800"
        >
          <Handshake class="h-4 w-4" />
          <span>Mewakili organisasi? <strong>Daftar sebagai Penaja</strong></span>
        </RouterLink>
      </p>

      <p class="text-center">
        <RouterLink to="/" :class="[AUTH_LINK_CLASS, 'text-slate-500 hover:text-slate-700']">
          <House class="h-4 w-4" />
          Kembali ke Laman Utama
        </RouterLink>
      </p>
    </form>
  </AuthLayout>
</template>
