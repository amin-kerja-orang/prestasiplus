<script setup lang="ts">
/**
 * S7 `/profile` "Profil Saya - PRESTASIPLUS" (M01-T6; FR-M01-38, DV-14, BR-15). One hero card in the
 * user shell: avatar (uploaded picture or the generated initials image on `#4F46E5`) with the orange
 * crown badge, the name in white (DV-14), the email, "Ahli sejak {d MMMM yyyy}" and the pill
 * "Kemaskini Profil" -> `/profile/edit`. No other blocks (the live page shows no statistics).
 * The user comes from the cached session; a background `GET /api/me` keeps it fresh.
 */
import { Calendar, Crown, Pen } from '@lucide/vue'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import { formatDateLong } from '@/lib/time'
import { initialsAvatarUrl } from '@/shells/shared/avatar'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const user = computed(() => session.user)

/** BR-15: 200px initials image on `#4F46E5` for the profile hero. */
const avatar = computed(() =>
  user.value ? user.value.avatarUrl || initialsAvatarUrl(user.value.name, '#4F46E5') : '',
)

onMounted(() => {
  void session.refreshUser()
})
</script>

<template>
  <section v-if="user" data-testid="profile-page">
    <!-- Hero gradient #667EEA -> #764BA2, rounded-3xl (FR-M01-38). -->
    <div
      class="flex flex-col items-center gap-3 rounded-3xl bg-linear-to-br from-[#667eea] to-[#764ba2] px-4 py-8 text-center shadow-lg sm:px-8 sm:py-10"
      data-testid="profile-hero"
    >
      <div class="relative">
        <img
          :src="avatar"
          alt="Avatar"
          class="h-32 w-32 rounded-full object-cover ring-[6px] ring-white sm:h-40 sm:w-40"
          data-testid="profile-avatar"
        />
        <span
          class="absolute right-1 bottom-1 flex h-10 w-10 items-center justify-center rounded-full bg-orange-500 text-white shadow-md ring-2 ring-white"
          data-testid="profile-crown"
        >
          <Crown class="h-5 w-5" />
        </span>
      </div>

      <h2
        class="max-w-full font-heading text-3xl font-bold break-words text-white"
        data-testid="profile-name"
      >
        {{ user.name }}
      </h2>
      <p class="max-w-full text-base font-medium break-all text-white" data-testid="profile-email">
        {{ user.email }}
      </p>
      <p
        class="flex items-center gap-2 text-sm font-medium text-white"
        data-testid="profile-member-since"
      >
        <Calendar class="h-4 w-4" />
        Ahli sejak {{ formatDateLong(user.createdAt) }}
      </p>

      <RouterLink
        to="/profile/edit"
        class="mt-2 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/20 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/30 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
        data-testid="profile-edit-link"
      >
        <Pen class="h-4 w-4" />
        Kemaskini Profil
      </RouterLink>
    </div>
  </section>
</template>
