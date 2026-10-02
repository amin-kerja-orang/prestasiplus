<script setup lang="ts">
/** One class card (PROPOSED, FR-M10-29): name, subject, level, "{n} pelajar", join code, QR button. */
import { QrCode } from '@lucide/vue'

import type { GuruClass } from '../../api/types'
import { KELAS_COPY } from './copy'

defineProps<{ item: GuruClass }>()
defineEmits<{ qr: [id: number] }>()
</script>

<template>
  <li
    class="min-w-0 rounded-2xl bg-white p-4 shadow-sm"
    data-testid="class-card"
    :data-class-id="item.id"
  >
    <div class="flex items-start justify-between gap-3">
      <h2
        class="min-w-0 font-heading text-base font-bold break-words text-slate-800"
        data-testid="class-name"
      >
        {{ item.name }}
      </h2>
      <span
        class="shrink-0 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700"
        data-testid="class-code"
        >{{ item.joinCode }}</span
      >
    </div>
    <p class="mt-1 text-sm text-slate-600" data-testid="class-subject">
      {{ item.subjectName ?? KELAS_COPY.noSubject }}
    </p>
    <p class="text-sm text-slate-500">
      <span data-testid="class-level">{{ item.levelLabel }}</span>
      ·
      <span data-testid="class-count">{{ item.studentCount }} pelajar</span>
    </p>
    <button
      type="button"
      class="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white hover:bg-indigo-600"
      data-testid="class-qr"
      @click="$emit('qr', item.id)"
    >
      <QrCode class="h-4 w-4" />{{ KELAS_COPY.qrButton }}
    </button>
  </li>
</template>
