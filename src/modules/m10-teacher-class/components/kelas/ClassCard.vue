<script setup lang="ts">
/** One class card (PROPOSED, FR-M10-29): name, subject, level, "{n} pelajar", join code, QR button. */
import { DsIconChip, DsPanel } from '@/ds'

import type { GuruClass } from '../../api/types'
import { KELAS_COPY } from './copy'

defineProps<{ item: GuruClass }>()
defineEmits<{ qr: [id: number] }>()
</script>

<template>
  <li class="min-w-0" data-testid="class-card" :data-class-id="item.id">
    <DsPanel class="h-full">
      <div class="flex items-start gap-3">
        <DsIconChip icon="chalkboard-teacher" />
        <div class="flex min-w-0 grow flex-col gap-1">
          <div class="flex items-start justify-between gap-3">
            <h2
              class="min-w-0 text-subheading break-words text-highlighted"
              data-testid="class-name"
            >
              {{ item.name }}
            </h2>
            <UBadge color="neutral" variant="subtle" class="shrink-0" data-testid="class-code">{{
              item.joinCode
            }}</UBadge>
          </div>
          <p class="text-body text-default" data-testid="class-subject">
            {{ item.subjectName ?? KELAS_COPY.noSubject }}
          </p>
          <p class="text-caption text-muted">
            <span data-testid="class-level">{{ item.levelLabel }}</span>
            ·
            <span class="tabular" data-testid="class-count">{{ item.studentCount }} pelajar</span>
          </p>
        </div>
      </div>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-qr-code-duotone"
        class="mt-3 min-h-11"
        data-testid="class-qr"
        @click="$emit('qr', item.id)"
      >
        {{ KELAS_COPY.qrButton }}
      </UButton>
    </DsPanel>
  </li>
</template>
