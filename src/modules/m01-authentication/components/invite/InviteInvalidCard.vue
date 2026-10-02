<script setup lang="ts">
/**
 * L45 S2 invalid state: the standalone "Link Tidak Sah" page (FR-L45-19, OBSERVED copy; layout from
 * `docs/discovery/img/L45/terima-invalid-token-desktop.png`). Light pink page, white card (~448px)
 * with a slate-gradient header, yellow info box, pink-red "Log Masuk" button, outlined "Laman Utama"
 * button and the footer line. Icons: Lucide stand-ins of `fa-link-slash`, `fa-info-circle`,
 * `fa-sign-in-alt`, `fa-home`, `fa-graduation-cap`. Tap targets are at least 44px.
 */
import { GraduationCap, House, Info, Link2Off, LogIn } from '@lucide/vue'
import { RouterLink } from 'vue-router'
</script>

<template>
  <main
    class="flex min-h-screen flex-col items-center justify-center bg-linear-to-br from-rose-50 to-pink-100 px-3 py-8 font-sans sm:px-4"
    data-testid="invite-invalid"
  >
    <div class="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl">
      <div class="bg-linear-to-br from-slate-500 to-slate-700 px-5 py-6 text-center text-white">
        <Link2Off class="mx-auto h-14 w-14 text-slate-300" data-testid="invite-invalid-icon" />
        <h1 class="mt-3 font-heading text-xl font-bold break-words text-white">Link Tidak Sah</h1>
        <p class="mt-1 text-sm text-slate-100">
          Link jemputan ini tidak sah atau telah tamat tempoh.
        </p>
      </div>
      <div class="space-y-3 p-5 sm:p-6">
        <div
          class="rounded-xl border border-yellow-200 bg-yellow-50 p-3 text-center text-sm text-amber-800"
          data-testid="invite-invalid-info"
        >
          <Info class="mr-1 inline h-4 w-4 align-text-bottom" />
          Link ini mungkin telah tamat tempoh atau dibatalkan. Sila minta anak anda menghantar
          jemputan baharu.
        </div>
        <RouterLink
          to="/login"
          class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-bold text-white shadow-lg transition bg-cta-gradient hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-pink-400 focus-visible:ring-offset-2 focus-visible:outline-none"
          data-testid="invite-invalid-login"
        >
          <LogIn class="h-4 w-4" />
          Log Masuk
        </RouterLink>
        <RouterLink
          to="/"
          class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 font-bold text-slate-600 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:outline-none"
          data-testid="invite-invalid-home"
        >
          <House class="h-4 w-4" />
          Laman Utama
        </RouterLink>
      </div>
    </div>
    <RouterLink
      to="/"
      class="mt-4 inline-flex min-h-11 items-center gap-2 text-center text-sm text-slate-500 hover:text-slate-700"
      data-testid="invite-invalid-footer"
    >
      <GraduationCap class="h-4 w-4 shrink-0" />
      PRESTASIPLUS — Platform Latih Tubi Interaktif Malaysia
    </RouterLink>
  </main>
</template>
