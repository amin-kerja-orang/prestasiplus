<script setup lang="ts">
/**
 * S7 `/profile` "Profil Saya - PRESTASIPLUS" (M01-T6; FR-M01-38, DV-14, BR-15), v2 restyle (B09 / A1).
 * Hero card in the shell main: avatar (uploaded picture or the initials avatar) with the crown badge, the
 * name, the email, "Ahli sejak {d MMMM yyyy}"; every role but the pupil also has the tonal button
 * "Kemaskini Profil" -> `/profile/edit`.
 *
 * Pupil (R1-MUR-A1, S5-T05 part B; FR-MUR-A1-1, in this order): hero, "Profil Awam Saya", six tiles, the in-page
 * form "Kemaskini Profil" (Bio Saya, Cita-Cita Saya, "Simpan"; replaces the button, FR-MUR-A1-7), three combo tiles, "Koleksi
 * Lencana", "Kalendar Kombo (30 Hari Terakhir)" and "Sesi Terkini". Figures come from `GET /api/me/profile-activity`
 * (API-MUR-02). The call lives here: the m01 api client belongs to S0.
 * The user comes from the cached session; a background `GET /api/me` keeps it fresh.
 */
import type { AccountProfileActivity } from '@pp/contract'
import { computed, onMounted, ref } from 'vue'

import { api } from '@/api'
import { DsCluster, DsHeading, DsLoadError, DsStack, DsText } from '@/ds'
import { formatDateLong } from '@/lib/time'
import { useSessionStore } from '@/stores/session'

import type { UserMe } from '../api'
import { errorLines } from '../lib/error-lines'
import ProfileAspirationField from './ProfileAspirationField.vue'
import ProfileBadgeCollection from './ProfileBadgeCollection.vue'
import ProfileKomboCalendar from './ProfileKomboCalendar.vue'
import ProfilePublicCard from './ProfilePublicCard.vue'
import ProfileRecentSessions from './ProfileRecentSessions.vue'
import ProfileStatTiles from './ProfileStatTiles.vue'

const BIO_MAX = 1000
const BIO_TOO_LONG = 'Bio tidak boleh melebihi 1000 aksara.'
const ASPIRATION_MAX = 255
const ASPIRATION_TOO_LONG = 'Cita-cita tidak boleh melebihi 255 aksara.'
const SAVED_TEXT = 'Profil berjaya dikemaskini.'
const SAVED_MS = 4000

const session = useSessionStore()
const user = computed(() => session.user)
const isPupil = computed(() => user.value?.role === 'student')

const activity = ref<AccountProfileActivity | null>(null)
const loadState = ref<'loading' | 'ready' | 'error'>('loading')
const loadError = ref('')

async function load(): Promise<void> {
  loadState.value = 'loading'
  try {
    activity.value = await api.get<AccountProfileActivity>('/api/me/profile-activity')
    loadState.value = 'ready'
  } catch (err) {
    loadError.value = errorLines(err)[0] ?? ''
    loadState.value = 'error'
  }
}

const publicUrl = computed(() =>
  activity.value ? `${window.location.origin}${activity.value.publicProfilePath}` : '',
)

// --- the in-page form "Kemaskini Profil" (FR-MUR-A1-3) ---------------------------------------------
const bio = ref(user.value?.bio ?? '')
const bioTouched = ref(false)
const aspiration = ref(user.value?.aspiration ?? '')
const aspirationTouched = ref(false)
const saving = ref(false)
const saved = ref(false)
const formErrors = ref<string[]>([])
let savedTimer: ReturnType<typeof setTimeout> | undefined

const bioTooLong = computed(() => bio.value.length > BIO_MAX)
const aspirationTooLong = computed(() => aspiration.value.length > ASPIRATION_MAX)

async function save(): Promise<void> {
  formErrors.value = []
  saved.value = false
  if (bioTooLong.value || aspirationTooLong.value) {
    formErrors.value = [
      ...(bioTooLong.value ? [BIO_TOO_LONG] : []),
      ...(aspirationTooLong.value ? [ASPIRATION_TOO_LONG] : []),
    ]
    return
  }
  saving.value = true
  try {
    // Partial update (FR-MUR-A1-9): only bio and aspiration are sent; a blank value clears it.
    const result = await api.put<{ data: UserMe; status: string }>('/api/me', {
      body: {
        bio: bio.value.trim() === '' ? null : bio.value.trim(),
        aspiration: aspiration.value.trim() === '' ? null : aspiration.value.trim(),
      },
      raw: true,
    })
    session.setUser(result.data)
    bio.value = result.data.bio ?? ''
    aspiration.value = result.data.aspiration ?? ''
    saved.value = true
    clearTimeout(savedTimer)
    savedTimer = setTimeout(() => {
      saved.value = false
    }, SAVED_MS)
  } catch (err) {
    // The typed text stays; the server text shows.
    formErrors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void session.refreshUser().then(() => {
    if (!bioTouched.value) bio.value = session.user?.bio ?? ''
    if (!aspirationTouched.value) aspiration.value = session.user?.aspiration ?? ''
  })
  if (isPupil.value) void load()
})
</script>

<template>
  <DsStack v-if="user" as="section" gap="section" class="mx-auto w-full max-w-3xl" data-testid="profile-page">
    <UCard data-testid="profile-hero">
      <div class="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-start">
        <div class="relative shrink-0">
          <UAvatar
            :src="user.avatarUrl || undefined"
            :alt="user.avatarUrl ? 'Avatar' : user.name"
            size="3xl"
            data-testid="profile-avatar"
          />
          <UBadge
            icon="i-ph-crown-fill"
            color="warning"
            variant="solid"
            size="lg"
            class="absolute -end-1 -bottom-1"
            aria-hidden="true"
            data-testid="profile-crown"
          />
        </div>

        <div class="flex min-w-0 flex-1 flex-col items-center gap-1 sm:items-start">
          <h2
            class="max-w-full text-heading break-words text-highlighted"
            data-testid="profile-name"
          >
            {{ user.name }}
          </h2>
          <p class="max-w-full text-body break-all text-muted" data-testid="profile-email">
            {{ user.email }}
          </p>
          <DsText as="div" variant="caption" data-testid="profile-member-since">
            <DsCluster gap="xs">
              <UIcon name="i-ph-calendar-blank" class="size-4" aria-hidden="true" />
              Ahli sejak {{ formatDateLong(user.createdAt) }}
            </DsCluster>
          </DsText>
        </div>

        <UButton
          v-if="!isPupil"
          to="/profile/edit"
          color="primary"
          variant="soft"
          size="lg"
          icon="i-ph-pencil-simple"
          class="min-h-11"
          data-testid="profile-edit-link"
          >Kemaskini Profil</UButton
        >
      </div>
    </UCard>

    <template v-if="isPupil">
      <USkeleton v-if="loadState === 'loading'" class="h-16 w-full" data-testid="profile-activity-loading" />

      <DsLoadError
        v-else-if="loadState === 'error'"
        :message="loadError"
        testid="profile-activity-error"
        @retry="load"
      />

      <template v-else-if="activity">
        <ProfilePublicCard :url="publicUrl" />
        <ProfileStatTiles :tiles="activity.tiles" kind="main" />

        <UCard data-testid="profile-form-card">
          <DsStack as="form" gap="md" data-testid="profile-bio-form" @submit.prevent="save">
            <DsStack gap="none">
              <DsCluster gap="xs">
                <UIcon name="i-ph-pencil-simple" class="size-5" aria-hidden="true" />
                <DsHeading :level="2" variant="subheading">Kemaskini Profil</DsHeading>
              </DsCluster>
              <DsText variant="caption">Ceritakan tentang diri dan cita-cita anda</DsText>
            </DsStack>

            <UFormField label="Bio Saya">
              <UTextarea
                v-model="bio"
                name="bio"
                :rows="4"
                placeholder="Tulis sedikit tentang diri anda..."
                size="lg"
                class="w-full"
                data-testid="profile-bio-input"
                @input="bioTouched = true"
              />
              <template #help>
                <DsText
                  as="span"
                  variant="caption"
                  :tone="bioTooLong ? 'error' : 'muted'"
                  data-testid="profile-bio-counter"
                  >{{ bio.length }}/{{ BIO_MAX }}</DsText
                >
              </template>
            </UFormField>

            <div @input="aspirationTouched = true">
              <ProfileAspirationField v-model="aspiration" />
            </div>

            <DsText
              v-for="line in formErrors"
              :key="line"
              variant="caption"
              tone="error"
              role="alert"
              data-testid="profile-form-error"
            >
              {{ line }}
            </DsText>
            <DsText v-if="saved" variant="caption" tone="success" role="status" data-testid="profile-form-saved">
              {{ SAVED_TEXT }}
            </DsText>

            <DsCluster justify="end">
              <UButton
                type="submit"
                color="primary"
                size="lg"
                icon="i-ph-floppy-disk"
                class="min-h-11"
                :loading="saving"
                :disabled="saving"
                data-testid="profile-save"
                >{{ saving ? 'Menyimpan...' : 'Simpan' }}</UButton
              >
            </DsCluster>
          </DsStack>
        </UCard>

        <ProfileStatTiles :tiles="activity.tiles" kind="combo" />
        <ProfileBadgeCollection :badges="activity.badges" />
        <ProfileKomboCalendar :days="activity.calendar30d" />
        <ProfileRecentSessions :sessions="activity.recentSessions" />
      </template>
    </template>
  </DsStack>
</template>
