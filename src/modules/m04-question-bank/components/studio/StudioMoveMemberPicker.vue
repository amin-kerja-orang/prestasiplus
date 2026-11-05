<script setup lang="ts">
/**
 * `Pindah ke kumpulan lain` (FR-ADM-QE2.7, FR-QA-06): a picker of the other groups of the same Subjek and Kertas. The move
 * itself is one call by the group editor; a mixed target is refused by the server, whose text the editor shows.
 */
import { computed, ref, watch } from 'vue'

import { DsCluster, DsDialog, DsLoadError, DsStack, DsSurface, DsText } from '@/ds'

import { listGroups, type GroupListRow } from '../../api/studio'
import { LOAD_ERROR } from '../../lib/ui-errors'

const props = defineProps<{ fromGroupId: string; subjectId: string | null; memberLabel: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [groupId: string] }>()

const rows = ref<GroupListRow[]>([])
const loading = ref(false)
const failed = ref(false)
const others = computed(() => rows.value.filter((g) => g.id !== props.fromGroupId))

async function load(): Promise<void> {
  loading.value = true
  failed.value = false
  try {
    rows.value = (await listGroups({ subjectId: props.subjectId, pageSize: 20 })).data
  } catch {
    rows.value = []
    failed.value = true
  } finally {
    loading.value = false
  }
}
watch(open, (on) => {
  if (on) void load()
})

const title = (g: GroupListRow): string => g.label?.trim() || g.stimuli.map((s) => s.label).join(', ') || `Kumpulan #${g.id}`
</script>

<template>
  <DsDialog v-model:open="open" title="Pindah ke kumpulan lain" :description="memberLabel" data-testid="studio-move-picker">
    <DsStack gap="sm">
      <DsLoadError v-if="failed" :message="LOAD_ERROR" testid="studio-move-error" retry-testid="studio-move-retry" @retry="load" />
      <DsText v-else-if="loading" variant="body" tone="muted">Memuatkan…</DsText>
      <DsText v-else-if="others.length === 0" variant="body" tone="muted" data-testid="studio-move-empty">Tiada kumpulan dijumpai.</DsText>
      <DsStack v-else as="ul" gap="xs" data-testid="studio-move-groups">
        <DsSurface v-for="g in others" :key="g.id" as="li" level="soft" padding="sm" shadow="none">
          <DsCluster gap="xs" :wrap="false">
            <DsText variant="body" truncate>{{ title(g) }} · {{ g.memberCount }} soalan</DsText>
            <UButton type="button" color="primary" variant="soft" :data-testid="`studio-move-to-${g.id}`" @click="emit('pick', g.id)">Pilih</UButton>
          </DsCluster>
        </DsSurface>
      </DsStack>
    </DsStack>
  </DsDialog>
</template>
