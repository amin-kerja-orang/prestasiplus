<script setup lang="ts">
/** Staff "Belum tersedia dalam prototaip" page for a Pentadbiran item that is not built yet. */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsEmptyState } from '@/ds'
import { SCOPE_PAGE_HEADING, SCOPE_PAGE_MESSAGE } from '@/app/prototype-scope'

import { groupOf, itemById } from './menu'

const route = useRoute()
const item = computed(() => itemById(String(route.params.itemId ?? '')))
const group = computed(() => (item.value ? groupOf(item.value.id) : undefined))
</script>

<template>
  <div class="flex flex-col gap-2" data-testid="pentadbiran-placeholder">
    <p v-if="group && item" class="text-caption text-muted">
      {{ group.label }}{{ item.sub ? ` › ${item.sub}` : '' }} › {{ item.label }}
    </p>
    <DsEmptyState :title="SCOPE_PAGE_HEADING" :description="SCOPE_PAGE_MESSAGE" icon="i-ph-flask">
      <template #actions>
        <UButton to="/admin/command-center" label="Ke Pemantauan Langsung" />
      </template>
    </DsEmptyState>
  </div>
</template>
