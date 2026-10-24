<script setup lang="ts">
/**
 * L45 S2 invalid state: the standalone "Pautan Tidak Sah" page (FR-L45-19, OBSERVED copy; layout from
 * `docs/discovery/img/L45/terima-invalid-token-desktop.png`). A raised card with a neutral header,
 * an info box, the "Log Masuk" and "Laman Utama" buttons and the footer line. Tap targets are at
 * least 44px.
 */
import { useThemeMode } from '@/theme/color-mode'

useThemeMode('learner')
</script>

<template>
  <main
    class="flex min-h-dvh flex-col items-center justify-center bg-muted px-3 py-8 sm:px-4"
    data-testid="invite-invalid"
  >
    <div class="w-full max-w-md overflow-hidden rounded-sheet bg-default shadow-lift">
      <div class="bg-elevated px-5 py-6 text-center">
        <UIcon
          name="i-ph-link-break-duotone"
          class="mx-auto size-14 text-muted"
          data-testid="invite-invalid-icon"
        />
        <h1 class="mt-3 font-display text-heading break-words text-highlighted">Pautan Tidak Sah</h1>
        <p class="mt-1 text-label text-muted">
          Pautan jemputan ini tidak sah atau telah tamat tempoh.
        </p>
      </div>
      <div class="flex flex-col gap-3 p-5 sm:p-6">
        <UAlert
          color="warning"
          variant="subtle"
          icon="i-ph-info-duotone"
          description="Pautan ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar jemputan baharu."
          data-testid="invite-invalid-info"
        />
        <UButton
          to="/login"
          block
          size="xl"
          variant="solid"
          icon="i-ph-sign-in-duotone"
          data-testid="invite-invalid-login"
          >Log Masuk</UButton
        >
        <UButton
          to="/"
          block
          size="xl"
          color="neutral"
          icon="i-ph-house-duotone"
          data-testid="invite-invalid-home"
          >Laman Utama</UButton
        >
      </div>
    </div>
    <UButton
      to="/"
      variant="link"
      color="neutral"
      icon="i-ph-graduation-cap-duotone"
      class="mt-4 min-h-11 text-center"
      data-testid="invite-invalid-footer"
      >PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia</UButton
    >
  </main>
</template>
