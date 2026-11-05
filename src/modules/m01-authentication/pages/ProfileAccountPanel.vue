<script setup lang="ts">
/**
 * "Tetapan Akaun" block of `/tetapan` for every role (S5-T05 part C; R1-MUR-A2, R1-GUR-A2, R1-AS-A2): the read-only rows
 * "📧 E-mel", "📱 Telefon" ("—" when empty), "🏫 Sekolah" ("—" when none) and "👤 Peranan", read from `GET /api/me`.
 * The role value is the BM label of OPT-PERANAN ("Admin Sekolah" for a school admin).
 * The row "✅ Status" shows a fixed "● Aktif" for every role (#458 ruling). No API field: the status is derived from
 * the active session (`session-resolver.service.ts` rejects sessions of inactive users), so "● Tidak aktif" cannot
 * be reached and is not built.
 */
import { computed } from 'vue'

import type { Role, UserMe } from '../api'

const props = defineProps<{ user: UserMe }>()

/** OPT-PERANAN (20 section A), plus the roles it does not list. */
const ROLE_LABELS: Record<Role, string> = {
  student: 'Pelajar',
  teacher: 'Guru',
  parent: 'Ibu Bapa',
  sponsor: 'Penaja',
  school_admin: 'Admin Sekolah',
  ppd_officer: 'Pegawai PPD',
  jpn_officer: 'Pegawai JPN',
  admin: 'Admin',
}

const EMPTY = '—'
const roleLabel = computed(() => ROLE_LABELS[props.user.role] ?? props.user.role)

const rows = computed(() => [
  { key: 'email', label: '📧 E-mel', value: props.user.email || EMPTY },
  { key: 'phone', label: '📱 Telefon', value: props.user.phone?.trim() || EMPTY },
  { key: 'school', label: '🏫 Sekolah', value: props.user.school?.name || EMPTY },
  { key: 'role', label: '👤 Peranan', value: roleLabel.value },
  // Derived from the active session: `session-resolver.service.ts` rejects inactive users, so this page is only
  // reachable by an active account. Fixed text, no API field.
  { key: 'status', label: '✅ Status', value: '● Aktif' },
])

const isPupil = computed(() => props.user.role === 'student')
const isTeacher = computed(() => props.user.role === 'teacher')
/** FR-MUR-A2-5 for the pupil; FR-GUR-A2 footer (link to the profile) for the others. */
const profileLink = computed(() => (isTeacher.value ? '/guru/profil/edit' : '/profile'))
</script>

<template>
  <UCard data-testid="account-panel">
    <div class="flex flex-col gap-4">
      <div class="flex items-center gap-3">
        <UAvatar :src="user.avatarUrl || undefined" :alt="user.name" size="lg" aria-hidden="true" />
        <div class="min-w-0">
          <h2 class="text-subheading text-highlighted" data-testid="account-title">Tetapan Akaun</h2>
          <p class="max-w-full text-caption break-words text-muted" data-testid="account-name">
            {{ user.name }} · {{ roleLabel }}
          </p>
        </div>
      </div>

      <dl class="flex flex-col gap-3" data-testid="account-rows">
        <div
          v-for="row in rows"
          :key="row.key"
          class="flex min-h-11 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
        >
          <dt class="text-label text-muted">{{ row.label }}</dt>
          <dd
            class="min-w-0 text-body break-all text-highlighted sm:text-end"
            :data-testid="`account-${row.key}`"
          >
            {{ row.value }}
          </dd>
        </div>
      </dl>

      <p class="text-caption text-muted" data-testid="account-note">
        <template v-if="isPupil">
          Untuk menukar e-mel, telefon atau sekolah, hubungi guru atau pentadbir sekolah anda.
        </template>
        <template v-else>
          Untuk menukar maklumat akaun, buka
          <UButton :to="profileLink" variant="link" color="primary" class="p-0" data-testid="account-note-link"
            >Profil Saya</UButton
          >.
        </template>
      </p>
    </div>
  </UCard>
</template>
