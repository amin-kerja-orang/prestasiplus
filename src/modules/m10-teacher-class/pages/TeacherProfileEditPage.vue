<script setup lang="ts">
/**
 * S5-T05 part C `/guru/profil/edit` "Edit Profil Guru" (R1-GUR-A1; API-GUR-22; cross-sector S6, m10 is S6's folder).
 * Cards in order: "Maklumat Peribadi" (Nama Penuh, E-mel read-only, Bio, No Kad Pengenalan), "Sekolah" (the school
 * NAME, read-only: FR-GUR-A1-6), "Maklumat Profesional" (Subjek Utama, Kelayakan, Pengalaman (tahun)), the action row
 * ("Batal", "Simpan Profil") and "Profil Awam Anda" ("Salin Link", "Lihat").
 * Data: `GET /api/account/teacher-profile`; save: `PUT /api/account/teacher-profile` (no school, no phone, no e-mail).
 * The IC shows only its masked value; it is sent only when the teacher typed a new one. Every message is the PRD text;
 * a failed save keeps all typed values.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { api, isApiError } from '@/api'
import { useFlash } from '@/composables/useFlash'
import { DsLoadError } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { moduleMessage } from '../lib/generic-server-text'

/** `data` of `GET/PUT /api/account/teacher-profile` (contract `AccountTeacherProfile`). */
interface TeacherProfile {
  name: string
  bio: string | null
  icMasked: string | null
  subject: string | null
  qualification: string | null
  experienceYears: number
  school: { name: string } | null
}

const MESSAGES = {
  nameRequired: 'Sila isi nama penuh.',
  nameMax: 'Nama penuh tidak boleh melebihi 255 aksara.',
  bioMax: 'Bio tidak boleh melebihi 1000 aksara.',
  icFormat: 'No. IC mesti 12 digit tanpa sempang.',
  subjectMax: 'Subjek utama tidak boleh melebihi 100 aksara.',
  qualificationMax: 'Kelayakan tidak boleh melebihi 150 aksara.',
  experienceRange: 'Pengalaman mesti antara 0 dan 60 tahun.',
  saved: 'Profil dikemaskini.',
  generic: 'Ralat berlaku. Sila cuba lagi.',
} as const
const COPIED_MS = 2000

type FieldKey = 'name' | 'bio' | 'ic' | 'subject' | 'qualification' | 'experienceYears'

const router = useRouter()
const flash = useFlash()
const session = useSessionStore()
const email = computed(() => session.user?.email ?? '')

const state = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')
const schoolName = ref('')
const loadedMasked = ref('')
const form = reactive({ name: '', bio: '', ic: '', subject: '', qualification: '', experienceYears: '0' })
const errors = reactive<Partial<Record<FieldKey, string>>>({})
const saving = ref(false)
const copied = ref(false)
const manual = ref(false)
let copiedTimer: ReturnType<typeof setTimeout> | undefined

const publicPath = computed(() => `/guru/profil/${String(session.user?.id ?? '')}`)
const publicUrl = computed(() => `${window.location.origin}${publicPath.value}`)

function fill(p: TeacherProfile): void {
  form.name = p.name
  form.bio = p.bio ?? ''
  form.ic = p.icMasked ?? ''
  loadedMasked.value = p.icMasked ?? ''
  form.subject = p.subject ?? ''
  form.qualification = p.qualification ?? ''
  form.experienceYears = String(p.experienceYears)
  schoolName.value = p.school?.name ?? ''
}

async function load(): Promise<void> {
  state.value = 'loading'
  try {
    fill(await api.get<TeacherProfile>('/api/account/teacher-profile'))
    state.value = 'ready'
  } catch (err) {
    loadError.value = moduleMessage(err) ?? ''
    state.value = 'error'
  }
}

function clearErrors(): void {
  for (const key of Object.keys(errors)) delete errors[key as FieldKey]
}

/** The IC the teacher typed, or `null` when it is blank or still the masked value (nothing to send). */
function typedIc(): string | null {
  const value = form.ic.trim()
  return value === '' || value === loadedMasked.value ? null : value
}

/** The same limits as the server (20 R1-GUR-A1 field table); first message per field. */
function validate(): boolean {
  clearErrors()
  if (form.name.trim() === '') errors.name = MESSAGES.nameRequired
  else if (form.name.trim().length > 255) errors.name = MESSAGES.nameMax
  if (form.bio.trim().length > 1000) errors.bio = MESSAGES.bioMax
  const ic = typedIc()
  if (ic !== null && !/^\d{12}$/.test(ic)) errors.ic = MESSAGES.icFormat
  if (form.subject.trim().length > 100) errors.subject = MESSAGES.subjectMax
  if (form.qualification.trim().length > 150) errors.qualification = MESSAGES.qualificationMax
  // A number input may hand the model back as a number (or null when emptied): read it as text.
  const rawYears = String(form.experienceYears ?? '').trim()
  const years = Number(rawYears)
  if (rawYears === '' || !Number.isInteger(years) || years < 0 || years > 60) {
    errors.experienceYears = MESSAGES.experienceRange
  }
  return Object.keys(errors).length === 0
}

async function save(): Promise<void> {
  flash.clear()
  if (!validate()) return
  saving.value = true
  try {
    const ic = typedIc()
    const result = await api.put<{ data: TeacherProfile; status: string }>('/api/account/teacher-profile', {
      body: {
        name: form.name.trim(),
        bio: form.bio.trim(),
        ...(ic !== null ? { ic } : {}),
        subject: form.subject.trim(),
        qualification: form.qualification.trim(),
        experienceYears: Number(String(form.experienceYears).trim()),
      },
      raw: true,
    })
    fill(result.data)
    flash.show({ type: 'success', message: result.status || MESSAGES.saved })
    window.scrollTo({ top: 0, behavior: 'smooth' })
    void session.refreshUser()
  } catch (err) {
    // Typed values stay. Field texts go under their fields; anything else shows in the flash.
    const fields = isApiError(err) ? (err.fields ?? {}) : {}
    let placed = false
    for (const [key, text] of Object.entries(fields)) {
      if (key in form) {
        errors[key as FieldKey] = text
        placed = true
      }
    }
    if (!placed) flash.show({ type: 'error', message: moduleMessage(err) ?? MESSAGES.generic })
  } finally {
    saving.value = false
  }
}

async function copyLink(): Promise<void> {
  manual.value = false
  try {
    await navigator.clipboard.writeText(publicUrl.value)
  } catch {
    manual.value = true
    return
  }
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => {
    copied.value = false
  }, COPIED_MS)
}

/** "Batal" leaves without saving and without a dialog. */
function cancel(): void {
  void router.push('/profile')
}

onMounted(load)
onBeforeUnmount(() => {
  clearTimeout(copiedTimer)
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6" data-testid="teacher-profile-edit-page">
    <div v-if="state === 'loading'" class="flex flex-col gap-4" role="status" aria-busy="true" data-testid="teacher-profile-loading">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <DsLoadError v-else-if="state === 'error'" :message="loadError || undefined" testid="teacher-profile-error" @retry="load" />

    <template v-else>
      <form class="flex flex-col gap-4 md:gap-6" novalidate data-testid="teacher-profile-form" @submit.prevent="save">
        <UCard data-testid="teacher-card-personal">
          <div class="flex flex-col gap-4">
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-user-circle" class="size-5" aria-hidden="true" />
              Maklumat Peribadi
            </h2>

            <UFormField label="Nama Penuh *" :error="errors.name">
              <UInput v-model="form.name" type="text" name="name" size="lg" class="w-full" data-testid="teacher-name-input" />
            </UFormField>

            <UFormField label="E-mel" help="E-mel log masuk tidak boleh ditukar di sini.">
              <UInput :model-value="email" type="email" readonly disabled size="lg" class="w-full" data-testid="teacher-email-input" />
            </UFormField>

            <UFormField label="Bio" :error="errors.bio">
              <UTextarea
                v-model="form.bio"
                name="bio"
                :rows="4"
                placeholder="Ceritakan tentang diri anda sebagai pendidik..."
                size="lg"
                class="w-full"
                data-testid="teacher-bio-input"
              />
            </UFormField>

            <UFormField
              label="No Kad Pengenalan"
              help="Digunakan untuk reset kata laluan secara layan diri. Tanpa tanda sempang (-)."
              :error="errors.ic"
            >
              <UInput
                v-model="form.ic"
                type="text"
                name="ic"
                inputmode="numeric"
                autocomplete="off"
                placeholder="cth: 860101015432"
                size="lg"
                class="w-full"
                data-testid="teacher-ic-input"
              />
            </UFormField>
          </div>
        </UCard>

        <UCard data-testid="teacher-card-school">
          <div class="flex flex-col gap-2">
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-buildings" class="size-5" aria-hidden="true" />
              Sekolah
            </h2>
            <p class="text-body break-words text-highlighted" data-testid="teacher-school-name">{{ schoolName || '—' }}</p>
          </div>
        </UCard>

        <UCard data-testid="teacher-card-professional">
          <div class="flex flex-col gap-4">
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-graduation-cap" class="size-5" aria-hidden="true" />
              Maklumat Profesional
            </h2>

            <UFormField label="Subjek Utama" :error="errors.subject">
              <UInput v-model="form.subject" type="text" name="subject" placeholder="cth: Matematik, Sains" size="lg" class="w-full" data-testid="teacher-subject-input" />
            </UFormField>

            <UFormField label="Kelayakan" :error="errors.qualification">
              <UInput
                v-model="form.qualification"
                type="text"
                name="qualification"
                placeholder="cth: Ijazah Sarjana Pendidikan"
                size="lg"
                class="w-full"
                data-testid="teacher-qualification-input"
              />
            </UFormField>

            <UFormField label="Pengalaman (tahun)" :error="errors.experienceYears">
              <UInput
                v-model="form.experienceYears"
                type="number"
                name="experienceYears"
                inputmode="numeric"
                min="0"
                max="60"
                step="1"
                size="lg"
                class="w-full"
                data-testid="teacher-experience-input"
              />
            </UFormField>
          </div>
        </UCard>

        <div class="flex items-center justify-between gap-3" data-testid="teacher-profile-actions">
          <UButton color="neutral" variant="soft" size="lg" class="min-h-11" data-testid="teacher-cancel" @click="cancel">Batal</UButton>
          <UButton
            type="submit"
            color="primary"
            size="lg"
            icon="i-ph-floppy-disk"
            class="min-h-11"
            :loading="saving"
            :disabled="saving"
            data-testid="teacher-save"
            >{{ saving ? 'Menyimpan...' : 'Simpan Profil' }}</UButton
          >
        </div>
      </form>

      <UCard data-testid="teacher-card-public">
        <div class="flex flex-col gap-3">
          <div>
            <h2 class="flex items-center gap-2 text-subheading text-highlighted">
              <UIcon name="i-ph-share-network" class="size-5" aria-hidden="true" />
              Profil Awam Anda
            </h2>
            <p class="text-caption text-muted">Kongsi profil anda dengan guru-guru lain di platform.</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
            <UInput :model-value="publicUrl" readonly size="lg" class="min-w-0 flex-1" aria-label="Pautan profil awam" data-testid="teacher-public-url" />
            <div class="flex items-center gap-2">
              <UButton
                color="primary"
                variant="soft"
                size="lg"
                :icon="copied ? 'i-ph-check' : 'i-ph-copy'"
                class="min-h-11"
                data-testid="teacher-copy"
                @click="copyLink"
                >{{ copied ? 'Disalin!' : 'Salin Link' }}</UButton
              >
              <UButton :to="publicPath" target="_blank" color="neutral" variant="soft" size="lg" icon="i-ph-arrow-square-out" class="min-h-11" data-testid="teacher-view"
                >Lihat</UButton
              >
            </div>
          </div>
          <p v-if="manual" class="text-caption text-muted" role="status" data-testid="teacher-copy-manual">Salin pautan secara manual.</p>
        </div>
      </UCard>
    </template>
  </div>
</template>
