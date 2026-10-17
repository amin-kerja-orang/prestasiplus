<script setup lang="ts">
/**
 * Brand strip of the auth pages below `xl` (v2 shells §6): the A1 gradient with one floating 3D
 * object and a friend face with a short greeting, so the mobile screen is not bare. Decorative.
 */
import { DsArt3D, DsFriendAvatar } from '@/ds'
</script>

<template>
  <div
    class="relative flex items-center gap-3 overflow-hidden bg-gradient-primary px-4 py-3 text-primary-on xl:hidden"
    aria-hidden="true"
    data-testid="auth-strip"
  >
    <DsFriendAvatar friend="aiman" mood="happy" size="sm" />
    <span class="font-display text-label">Jom sambung belajar!</span>
    <DsArt3D name="rocket" size="lg" float class="ml-auto" />
    <DsArt3D name="coin" size="sm" float class="absolute right-20 bottom-1 opacity-90" />
  </div>
</template>
