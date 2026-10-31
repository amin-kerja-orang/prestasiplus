<script setup lang="ts">
/**
 * Studio "Kumpulan rangsangan" (D90, T13): manage ONE shared stimulus and its questions on its own page. Members are added,
 * removed and reordered here and saved together; the group carries no marks.
 */
import { ref } from 'vue'

import { DsCallout, DsPage } from '@/ds'

import { STUDIO_UNAVAILABLE, studioAvailable } from '../api/studio'
import StudioGroupEditor from '../components/studio/StudioGroupEditor.vue'

const props = defineProps<{ id: string }>()
const groupId = ref<string | null>(props.id)
</script>

<template>
  <DsPage layout="form" back-to="/admin/studio" data-testid="studio-group-page">
    <DsCallout v-if="!studioAvailable()" tone="info" data-testid="studio-unavailable">{{ STUDIO_UNAVAILABLE }}</DsCallout>
    <StudioGroupEditor v-else v-model:group-id="groupId" />
  </DsPage>
</template>
