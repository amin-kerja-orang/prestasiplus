<script setup lang="ts">
/** One class card (PROPOSED, FR-M10-29): name, subject, level, "{n} pelajar", join code, QR button. */
import { DsIconChip, DsPanel, DsCluster, DsStack, DsHeading, DsText } from '@/ds'

import type { GuruClass } from '../../api/types'
import { KELAS_COPY } from './copy'

defineProps<{ item: GuruClass }>()
defineEmits<{ qr: [id: number] }>()
</script>

<template>
  <li class="min-w-0" data-testid="class-card" :data-class-id="item.id">
    <DsPanel class="h-full">
      <DsCluster align="start" :wrap="false">
        <DsIconChip icon="chalkboard-teacher" />
        <DsStack gap="2xs" class="grow">
          <DsCluster align="start" justify="between" :wrap="false">
            <DsHeading
              :level="2"
              variant="subheading"
              wrap="anywhere"
              class="min-w-0"
              data-testid="class-name"
            >
              {{ item.name }}
            </DsHeading>
            <UBadge color="neutral" variant="subtle" class="shrink-0" data-testid="class-code">{{
              item.joinCode
            }}</UBadge>
          </DsCluster>
          <DsText variant="body" data-testid="class-subject">
            {{ item.subjectName ?? KELAS_COPY.noSubject }}
          </DsText>
          <DsText variant="caption">
            <span data-testid="class-level">{{ item.levelLabel }}</span>
            ·
            <span class="tabular" data-testid="class-count">{{ item.studentCount }} pelajar</span>
          </DsText>
        </DsStack>
      </DsCluster>
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
