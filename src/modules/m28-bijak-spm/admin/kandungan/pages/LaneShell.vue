<script setup lang="ts">
/**
 * The frame above a Kandungan SPM lane list (R1-ADM-Q-02): the link "← Semua laluan SPM", the line "{n} item ·" with
 * `lihat sisi pelajar`, the filters Subjek ("Semua Subjek"), Status ("Semua Status", not on Latih Tubi), Cari, and the buttons
 * Tapis / Set Semula. The shell header carries the lane name (route meta); the page puts the list after this frame.
 */
import type { ServabilityHubLane } from '@pp/contract'
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { DsCluster, DsFilterBar, DsLink, DsNativeSelect, DsStack, DsText, formatCount } from '@/ds'

import { KANDUNGAN_ROUTES, type LaneSubject } from '../api'
import { laneCopy, pupilRouteOf } from '../lanes'

const SEARCH_MAX = 100

const props = defineProps<{
  lane: ServabilityHubLane
  count: number
  subjects: LaneSubject[]
  statuses?: { value: string; label: string }[]
  chips: { key: string; label: string }[]
}>()
const filters = defineModel<{ subjectId: string; status: string; search: string }>('filters', { required: true })
const emit = defineEmits<{ apply: []; reset: []; 'remove-chip': [key: string] }>()
const draft = reactive({ subjectId: '', status: '', search: '' })
const searchError = ref('')
const router = useRouter()
const pupil = computed(() => pupilRouteOf(router, props.lane))

function apply(): void {
  searchError.value = draft.search.trim().length > SEARCH_MAX ? laneCopy.searchTooLong : ''
  if (searchError.value) return
  filters.value = { ...draft }
  emit('apply')
}
function reset(): void {
  Object.assign(draft, { subjectId: '', status: '', search: '' })
  searchError.value = ''
  filters.value = { subjectId: '', status: '', search: '' }
  emit('reset')
}
</script>

<template>
  <DsStack gap="sm">
    <DsLink :to="{ name: KANDUNGAN_ROUTES.hub }" data-testid="lane-back">{{ laneCopy.back }}</DsLink>
    <DsCluster gap="xs">
      <DsText variant="body" tone="muted" data-testid="lane-count">{{ formatCount(count) }} {{ laneCopy.items }}</DsText>
      <DsLink v-if="pupil" :to="pupil" data-testid="lane-pupil">{{ laneCopy.pupil }}</DsLink>
    </DsCluster>
    <DsFilterBar
      :chips="chips"
      :active-count="chips.length"
      :apply-label="laneCopy.apply"
      :reset-label="laneCopy.reset"
      data-testid="lane-filter"
      @apply="apply"
      @reset="reset"
      @remove-chip="(k: string) => emit('remove-chip', k)"
    >
      <template #search>
        <UInput
          v-model="draft.search"
          type="text"
          :aria-label="laneCopy.search"
          :placeholder="`${laneCopy.search}...`"
          icon="i-ph-magnifying-glass"
          class="w-full md:min-w-64 md:flex-1"
          data-testid="lane-search"
        />
      </template>
      <DsNativeSelect v-model="draft.subjectId" aria-label="Subjek" class="md:w-44" data-testid="lane-subject">
        <option value="">{{ laneCopy.allSubjects }}</option>
        <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
      </DsNativeSelect>
      <DsNativeSelect v-if="statuses" v-model="draft.status" aria-label="Status" class="md:w-44" data-testid="lane-status">
        <option value="">{{ laneCopy.allStatuses }}</option>
        <option v-for="s in statuses" :key="s.value" :value="s.value">{{ s.label }}</option>
      </DsNativeSelect>
    </DsFilterBar>
    <DsText v-if="searchError" as="p" variant="caption" tone="error" role="alert" data-testid="lane-search-error">{{ searchError }}</DsText>
  </DsStack>
</template>
