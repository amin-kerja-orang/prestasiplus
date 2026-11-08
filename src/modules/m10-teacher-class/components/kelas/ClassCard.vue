<script setup lang="ts">
/** One class card (R1-GUR-8): name, subject, level, "{n} pelajar" and the "Edit" link. No join code, no QR. */
import { DsIconChip, DsPanel } from '@/ds'

import type { GuruClass } from '../../api/types'
import { KELAS_COPY } from './copy'

defineProps<{ item: GuruClass }>()
</script>

<template>
  <li class="min-w-0" data-testid="class-card" :data-class-id="item.id">
    <DsPanel class="h-full">
      <div class="flex items-start gap-3">
        <DsIconChip icon="chalkboard-teacher" />
        <div class="flex min-w-0 grow flex-col gap-1">
          <h2 class="min-w-0 text-subheading break-words text-highlighted" data-testid="class-name">
            {{ item.name }}
          </h2>
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
        :to="`/guru/kelas/${encodeURIComponent(String(item.id))}/edit`"
        color="neutral"
        variant="soft"
        icon="i-ph-pencil-simple-duotone"
        class="mt-3 min-h-11"
        data-testid="class-edit"
      >
        {{ KELAS_COPY.edit }}
      </UButton>
    </DsPanel>
  </li>
</template>
