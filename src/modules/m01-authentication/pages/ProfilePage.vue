<script setup lang="ts">
/**
 * S7 `/profile` "Profil Saya - PRESTASIPLUS" (M01-T6; FR-M01-38, DV-14, BR-15), v2 restyle (B09 / A1).
 * One header card in the shell main: avatar (uploaded picture or the initials avatar) with
 * the crown badge, the name, the email, "Ahli sejak {d MMMM yyyy}" and the tonal button
 * "Kemaskini Profil" -> `/profile/edit`. No other blocks (the live page shows no statistics).
 * The user comes from the cached session; a background `GET /api/me` keeps it fresh.
 */
import { computed, onMounted } from 'vue'

import { formatDateLong } from '@/lib/time'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const user = computed(() => session.user)

onMounted(() => {
  void session.refreshUser()
})
</script>

<template>
  <section v-if="user" class="mx-auto w-full max-w-3xl" data-testid="profile-page">
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
          <p
            class="flex items-center gap-2 text-caption text-muted"
            data-testid="profile-member-since"
          >
            <UIcon name="i-ph-calendar-blank" class="size-4" aria-hidden="true" />
            Ahli sejak {{ formatDateLong(user.createdAt) }}
          </p>
        </div>

        <UButton
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
  </section>
</template>
