<script setup lang="ts">
/**
 * The locked school label of S11 and S12 (FR-M27-108, 117): the school name and the meta line
 * "{code} · {district} · {state}" without empty parts. No search, no input: the school is the session school.
 * Locked-field treatment: muted surface, lock icon, no focus ring.
 */
import { DsFormField, DsPanel, DsCluster, DsText } from '@/ds'

import type { SchoolInfo } from '../../api/school-admin'
import { schoolMeta } from './users-format'

defineProps<{ school: Pick<SchoolInfo, 'name' | 'code' | 'district' | 'state'> }>()
</script>

<template>
  <DsFormField label="Sekolah" data-testid="user-school">
    <DsPanel tone="inset">
      <DsCluster :wrap="false" class="min-h-11">
        <UIcon name="i-ph-buildings" class="size-5 shrink-0 text-muted" aria-hidden="true" />
        <div class="min-w-0 flex-1">
          <DsText
            variant="label"
            as="p"
            tone="highlighted"
            wrap="anywhere"
            data-testid="user-school-name"
          >
            {{ school.name }}
          </DsText>
          <DsText variant="caption" wrap="anywhere" data-testid="user-school-meta">
            {{ schoolMeta(school) }}
          </DsText>
        </div>
        <UIcon name="i-ph-lock-simple" class="size-5 shrink-0 text-dimmed" aria-hidden="true" />
      </DsCluster>
    </DsPanel>
  </DsFormField>
</template>
