<script setup lang="ts">
/**
 * The one-time credential block of S12 (FR-M27-118, BR-M27-41): the only place a password is rendered. It holds
 * the `credential` of the create response in component memory only; it is never persisted or logged, and a reload
 * of the page shows nothing.
 */
import { KeyRound } from '@lucide/vue'

import type { CreatePupilResult } from '../../api/school-admin'

defineProps<{ credential: CreatePupilResult['credential'] }>()
</script>

<template>
  <section
    class="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow sm:p-6"
    data-testid="pupil-credential"
  >
    <h3 class="mb-3 flex items-start gap-2 text-sm font-bold text-amber-900">
      <KeyRound class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      Maklumat log masuk pelajar — catat sekarang, ia tidak akan dipaparkan semula.
    </h3>
    <dl class="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt class="font-semibold text-slate-700">Nama:</dt>
      <dd class="min-w-0 break-words text-slate-800" data-testid="credential-name">
        {{ credential.name }}
      </dd>
      <dt class="font-semibold text-slate-700">Sekolah:</dt>
      <dd class="min-w-0 break-words text-slate-800" data-testid="credential-school">
        {{ credential.school }}
      </dd>
      <dt class="font-semibold text-slate-700">Emel:</dt>
      <dd class="min-w-0 break-all text-slate-800" data-testid="credential-email">
        {{ credential.email }}
      </dd>
      <dt class="font-semibold text-slate-700">Kata laluan:</dt>
      <dd class="min-w-0 break-all font-mono text-slate-900" data-testid="credential-password">
        {{ credential.password }}
      </dd>
    </dl>
  </section>
</template>
