<script setup lang="ts">
/**
 * `Pindah ke kumpulan lain` (FR-ADM-QE2.7, FR-QA-06): a picker of the other groups of the same Subjek and Kertas. The move
 * itself is one call by the group editor; a mixed target is refused by the server, whose text the editor shows.
 */
import { computed, watch } from 'vue'

import { DsCluster, DsDialog, DsFormField, DsLoadError, DsStack, DsSurface, DsText } from '@/ds'

import type { GroupListRow } from '../../api/studio'
import { useGroupBrowse } from '../../lib/studio/group-members'
import { LOAD_ERROR } from '../../lib/ui-errors'

const props = defineProps<{ fromGroupId: string; subjectId: string | null; memberLabel: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ pick: [groupId: string] }>()

const { search, rows, page, pages, loading, failed, load, onSearch } = useGroupBrowse(() => props.subjectId)
const others = computed(() => rows.value.filter((g) => g.id !== props.fromGroupId))
watch(open, (on) => {
  if (!on) return
  search.value = ''
  void load(1)
})

const title = (g: GroupListRow): string => g.label?.trim() || g.stimuli.map((s) => s.label).join(', ') || `Kumpulan #${g.id}`
</script>

<template>
  <DsDialog v-model:open="open" title="Pindah ke kumpulan lain" :description="memberLabel" data-testid="studio-move-picker">
    <DsStack gap="sm">
      <DsFormField v-slot="{ id }" native label="Cari kumpulan" for="studio-move-search">
        <UInput :id="id" v-model="search" placeholder="Label atau tajuk rangsangan" maxlength="200" data-testid="studio-move-search" @update:model-value="onSearch" />
      </DsFormField>
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
      <DsCluster v-if="pages > 1" gap="sm">
        <UButton type="button" color="neutral" variant="soft" :disabled="page <= 1 || loading" data-testid="studio-move-prev" @click="load(page - 1)">Sebelumnya</UButton>
        <DsText variant="caption" tone="muted">Halaman {{ page }} / {{ pages }}</DsText>
        <UButton type="button" color="neutral" variant="soft" :disabled="page >= pages || loading" data-testid="studio-move-next" @click="load(page + 1)">Seterusnya</UButton>
      </DsCluster>
    </DsStack>
  </DsDialog>
</template>
