<script setup lang="ts">
/**
 * The level tab strip of S2, S3, S4, S5 and S7 (FN-M12-1.1.9; FR-M12-09), V2 labels: six plain links
 * to unfiltered URLs of the mount, the current one active. S1 and S6 show no strip. The strip is a
 * `DsPillNav` (it scrolls inside itself on a narrow screen). Targets are built from `basePath` (see
 * `kirkpatrick-paths.ts`).
 *
 * ONE strip per screen (C-53): the Pentadbiran shell (`/admin`, and Admin Pusat on `/guru`) and the
 * Pembelajaran shell for the teacher (`/guru`) draw their own section strip, so this one renders only
 * on the school administrator's mount, whose Pembelajaran menu has a single Kirkpatrick row (no group).
 */
import { computed } from 'vue'

import { DsPillNav, type PillItem } from '@/ds'

import { SCHOOL_ADMIN_MOUNT } from '../../../routes/mount'
import { kirkpatrickPaths } from './kirkpatrick-paths'

export type KirkpatrickTab =
  'overview' | 'reaction' | 'learning' | 'behavior' | 'results' | 'interventions'

const props = defineProps<{ basePath: string; current: KirkpatrickTab }>()

const paths = computed(() => kirkpatrickPaths(props.basePath))
const TABS: { key: KirkpatrickTab; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: 'i-ph-squares-four' },
  { key: 'reaction', label: 'T1: Reaksi', icon: 'i-ph-smiley' },
  { key: 'learning', label: 'T2: Pembelajaran', icon: 'i-ph-brain' },
  { key: 'behavior', label: 'T3: Tingkah Laku', icon: 'i-ph-footprints' },
  { key: 'results', label: 'T4: Hasil', icon: 'i-ph-trophy' },
  { key: 'interventions', label: 'Intervensi', icon: 'i-ph-hand-heart' },
]
const items = computed<PillItem<KirkpatrickTab>[]>(() =>
  TABS.map((t) => ({ ...t, to: paths.value[t.key] })),
)
</script>

<template>
  <DsPillNav
    v-if="basePath === SCHOOL_ADMIN_MOUNT.prefix"
    :items="items"
    :active="current"
    label="Tahap Kirkpatrick"
    testid-prefix="kirk-tab"
    data-testid="kirk-tabs"
  />
</template>
