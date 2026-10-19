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
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isPrototypeRole, isPrototypeScopeOn } from '@/app/prototype-scope'
import { DsFormField, DsNativeSelect, DsPanel } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { register, type RegisterRequest, type SchoolSummary } from '../api'
import AuthAlert from '../components/auth/AuthAlert.vue'
import AuthLayout from '../components/auth/AuthLayout.vue'
import AuthWelcomePanel from '../components/auth/AuthWelcomePanel.vue'
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

// Prototype scope (D43): no parent card and no sponsor-registration link.
const scoped = isPrototypeScopeOn()
const roleCards = computed(() =>
  ROLE_CARDS.filter((card) => !scoped || isPrototypeRole(card.value)),
)
const grade = ref<number | null>(null)
const icNumber = ref('')
const password = ref('')
const passwordConfirmation = ref('')
const loading = ref(false)
const errors = ref<string[]>([])

const pickerRoot = ref<HTMLElement | null>(null)
const { picker, state, setState } = useSchoolSearch({ limit: 15, root: pickerRoot })

function onSearchInput(value: string | number): void {
  picker.setTerm(String(value))
}

function onStateChange(value: string | number): void {
  setState(String(value))
}

function clearSchool(): void {
  picker.selected.value = null
}

function schoolDetail(school: SchoolSummary, withDistrict: boolean): string {
  const parts = [school.type, school.state]
  if (withDistrict && school.district) parts.push(school.district)
  return parts.join(' · ')
}

const STATE_ITEMS = REGISTER_STATE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

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
    <div class="mb-6 flex items-center justify-center gap-2" data-testid="register-steps">
      <template v-for="n in 3" :key="n">
        <USeparator v-if="n > 1" class="w-8" />
        <UBadge
          :label="String(n)"
          :color="n === 1 ? 'primary' : 'neutral'"
          :variant="n === 1 ? 'solid' : 'subtle'"
          size="lg"
          class="size-8 justify-center"
          :data-active="n === 1 ? 'true' : 'false'"
        />
      </template>
    </div>

    <form data-testid="register-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <AuthAlert :messages="errors" data-testid="register-alert" />

      <DsFormField native for="name" label="Nama Penuh">
        <UInput
          id="name"
          v-model="name"
          type="text"
          name="name"
          required
          placeholder="Muhammad Fulan bin Fulan"
          icon="i-ph-user-duotone"
          size="xl"
          class="w-full"
          data-testid="register-name"
        />
      </DsFormField>

      <DsFormField native for="email" label="Alamat Email">
        <UInput
          id="email"
          v-model="email"
          type="email"
          name="email"
          required
          placeholder="nama@email.com"
          icon="i-ph-envelope-simple-duotone"
          size="xl"
          class="w-full"
          data-testid="register-email"
        />
      </DsFormField>

      <DsFormField native for="phone" label="No. Telefon (Pilihan)">
        <UInput
          id="phone"
          v-model="phone"
          type="tel"
          name="phone"
          maxlength="14"
          inputmode="tel"
          placeholder="Cth: 0191234567"
          icon="i-ph-phone-duotone"
          size="xl"
          class="w-full"
          data-testid="register-phone"
        />
      </DsFormField>

      <div class="flex flex-col gap-2">
        <p class="text-label text-default">Saya adalah...</p>
        <div class="grid gap-2 sm:gap-3" :class="scoped ? 'grid-cols-2' : 'grid-cols-3'">
          <!-- Click/tap only, no keyboard or ARIA semantics (FR-M01-66). -->
          <DsPanel
            v-for="card in roleCards"
            :key="card.value"
            :tone="role === card.value ? 'tint' : 'inset'"
            class="min-h-11 text-center"
            :data-selected="role === card.value"
            :data-testid="`role-${card.value}`"
            @click="role = card.value"
          >
            <div class="text-heading">{{ card.emoji }}</div>
            <div class="text-label text-highlighted">{{ card.title }}</div>
            <div class="text-caption text-muted">{{ card.text }}</div>
          </DsPanel>
        </div>
      </div>

      <div v-if="role === 'student'" class="flex flex-col gap-3" data-testid="register-levels">
        <p class="flex items-center gap-2 text-label text-default">
          <UIcon name="i-ph-graduation-cap-duotone" class="size-4 text-primary-t" />
          Pilih Tahap Anda
        </p>
        <div class="flex flex-col gap-2">
          <p class="flex items-center gap-2 text-overline text-muted">
            <UIcon name="i-ph-student-duotone" class="size-4" />
            Sekolah Rendah
          </p>
          <div class="grid grid-cols-3 gap-2">
            <DsPanel
              v-for="n in DARJAH_GRADES"
              :key="n"
              :tone="grade === n ? 'tint' : 'inset'"
              class="flex min-h-11 flex-col items-center justify-center text-center"
              :data-selected="grade === n"
              :data-testid="`grade-${String(n)}`"
              @click="grade = n"
            >
              <span class="text-caption text-muted">Darjah</span>
              <span class="text-subheading text-highlighted">{{ n }}</span>
            </DsPanel>
          </div>
        </div>
        <div class="flex flex-col gap-2">
          <p class="flex items-center gap-2 text-overline text-muted">
            <UIcon name="i-ph-buildings-duotone" class="size-4" />
            Sekolah Menengah
          </p>
          <div class="grid grid-cols-5 gap-2">
            <DsPanel
              v-for="n in TINGKATAN_GRADES"
              :key="n"
              :tone="grade === n + 6 ? 'tint' : 'inset'"
              class="flex min-h-11 flex-col items-center justify-center text-center"
              :data-selected="grade === n + 6"
              :data-testid="`grade-${String(n + 6)}`"
              @click="grade = n + 6"
            >
              <span class="text-caption text-muted">Ting.</span>
              <span class="text-subheading text-highlighted">{{ n }}</span>
            </DsPanel>
          </div>
        </div>
      </div>

      <DsFormField
        v-if="role === 'student'"
        native
        for="ic_number"
        label="No. Kad Pengenalan (Pilihan)"
        hint="Dilindungi PDPA. Hanya 2 digit terakhir akan dipaparkan."
      >
        <UInput
          id="ic_number"
          v-model="icNumber"
          type="text"
          name="ic_number"
          maxlength="14"
          inputmode="numeric"
          placeholder="Cth: 031215101234"
          icon="i-ph-identification-card-duotone"
          size="xl"
          class="w-full"
          data-testid="register-ic"
        />
      </DsFormField>

      <div ref="pickerRoot" class="relative flex flex-col gap-2" data-testid="register-school">
        <label for="school_search" class="text-label text-default">Sekolah (Pilihan)</label>

        <DsPanel
          v-if="picker.selected.value"
          tone="tint"
          class="flex items-center gap-3"
          data-testid="school-chip"
        >
          <div class="min-w-0 flex-1">
            <div class="text-label break-words text-highlighted">
              {{ picker.selected.value.name }}
            </div>
            <div class="text-caption text-muted">
              {{ schoolDetail(picker.selected.value, false) }}
            </div>
          </div>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-ph-x-duotone"
            class="min-h-11 shrink-0"
            data-testid="school-clear"
            @click="clearSchool"
          />
        </DsPanel>

        <template v-else>
          <div class="grid grid-cols-2 gap-2 sm:gap-3">
            <DsNativeSelect
              :model-value="state"
              :items="STATE_ITEMS"
              placeholder="Negeri"
              data-testid="register-state"
              @update:model-value="onStateChange"
            />
            <UInput
              id="school_search"
              type="text"
              autocomplete="off"
              placeholder="Taip nama sekolah..."
              :model-value="picker.term.value"
              size="xl"
              class="w-full min-w-0"
              data-testid="register-school-search"
              @focus="picker.onFocus"
              @update:model-value="onSearchInput"
            />
          </div>

          <DsPanel
            v-if="
              picker.open.value &&
              (picker.results.value.length > 0 || picker.term.value.length >= SCHOOL_MIN_QUERY)
            "
            behavior="float"
            class="top-full"
            data-testid="school-dropdown"
          >
            <UButton
              v-for="school in picker.results.value"
              :key="school.id"
              type="button"
              color="neutral"
              variant="ghost"
              block
              class="h-auto min-h-11 flex-col items-start justify-start py-3 text-left"
              data-testid="school-option"
              @click="picker.select(school)"
            >
              <span class="text-label break-words text-highlighted">{{ school.name }}</span>
              <span class="text-caption text-muted">{{ schoolDetail(school, true) }}</span>
            </UButton>
            <div
              v-if="
                picker.results.value.length === 0 &&
                picker.term.value.length >= SCHOOL_MIN_QUERY &&
                !picker.searching.value
              "
              class="flex flex-col items-center gap-1 px-4 py-6 text-label text-muted"
              data-testid="school-empty"
            >
              <UIcon name="i-ph-magnifying-glass-duotone" class="size-5" />
              Tiada sekolah dijumpai
            </div>
          </DsPanel>
        </template>
      </div>

      <DsFormField native for="password" label="Kata Laluan" hint="Minimum 6 aksara">
        <PasswordInput
          id="password"
          v-model="password"
          name="password"
          placeholder="••••••••"
          autocomplete="new-password"
          testid="register-password"
        />
      </DsFormField>

      <DsFormField native for="password_confirmation" label="Sahkan Kata Laluan">
        <PasswordInput
          id="password_confirmation"
          v-model="passwordConfirmation"
          name="password_confirmation"
          placeholder="••••••••"
          autocomplete="new-password"
          testid="register-password-confirm"
        />
      </DsFormField>

      <UButton
        type="submit"
        block
        size="xl"
        variant="solid"
        :loading="loading"
        :disabled="loading"
        icon="i-ph-user-plus-duotone"
        data-testid="register-submit"
      >
        {{ loading ? 'Sedang Mendaftar...' : 'Daftar Sekarang' }}
      </UButton>

      <UButton to="/login" variant="link" color="neutral" class="min-h-11 justify-center">
        <span>Sudah ada akaun? <strong class="text-primary-t">Log Masuk 🔑</strong></span>
      </UButton>

      <UButton
        v-if="!scoped"
        to="/sponsor/register"
        variant="link"
        color="neutral"
        icon="i-ph-handshake-duotone"
        class="min-h-11 justify-center"
      >
        <span>Mewakili organisasi? <strong>Daftar sebagai Penaja</strong></span>
      </UButton>

      <UButton
        to="/"
        variant="link"
        color="neutral"
        icon="i-ph-house-duotone"
        class="min-h-11 justify-center"
        >Kembali ke Laman Utama</UButton
      >
    </form>
  </AuthLayout>
</template>
