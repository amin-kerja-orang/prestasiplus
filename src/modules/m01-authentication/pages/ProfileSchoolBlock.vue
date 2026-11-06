<script setup lang="ts">
/**
 * R1-AS-A1 school block of `/profile` for the school admin (S5-T05 item 5; FR-AS-A1-1, AC-AS-A1-3): the read-only
 * rows "Nama Sekolah", "# Kod", "PPD" and "Negeri". The values come from the `school` object of `GET /api/me`
 * (name, code, district = PPD, state), per the #458 ruling; there is no school endpoint and no input here.
 */
import { computed } from 'vue'

import { DsCluster, DsDefinitionList, DsHeading, DsStack } from '@/ds'

import type { SchoolSummary } from '../api'

const props = defineProps<{ school: SchoolSummary | null }>()

const EMPTY = '—'

const rows = computed(() => [
  { key: 'name', label: 'Nama Sekolah', value: props.school?.name?.trim() || EMPTY },
  { key: 'code', label: '# Kod', value: props.school?.code?.trim() || EMPTY },
  { key: 'ppd', label: 'PPD', value: props.school?.district?.trim() || EMPTY },
  { key: 'state', label: 'Negeri', value: props.school?.state?.trim() || EMPTY },
])
</script>

<template>
  <UCard data-testid="profile-school-block">
    <DsStack gap="md">
      <DsCluster gap="xs">
        <UIcon name="i-ph-buildings" class="size-5" aria-hidden="true" />
        <DsHeading :level="2" variant="subheading">Sekolah</DsHeading>
      </DsCluster>

      <DsDefinitionList :items="rows" data-testid="profile-school-rows">
        <template v-for="row in rows" :key="row.key" #[`value-${row.key}`]>
          <span :data-testid="`profile-school-${row.key}`">{{ row.value }}</span>
        </template>
      </DsDefinitionList>
    </DsStack>
  </UCard>
</template>
