<script setup lang="ts">
/**
 * PHASE 1: fold into DsDataTable built-in pager (pageSizeOptions) (docs/design/v2-ds-consolidation.md). Interim kit for the M02/M22/M03
 * admin revamp; do not build new screens on it.
 */
/** Footer strip of a list card: "Menunjukkan a-b daripada n hasil" plus `UPagination` (BM labels). */
defineProps<{
  summary: string
  total: number
  page: number
  pageSize: number
}>()
const emit = defineEmits<{ 'update:page': [page: number] }>()
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-4 p-4 empty:hidden"
    data-ds="admin-pager"
  >
    <p v-if="summary" class="text-label text-muted" role="status">{{ summary }}</p>
    <UPagination
      v-if="total > pageSize"
      :page="page"
      :total="total"
      :items-per-page="pageSize"
      :prev="{ 'aria-label': 'Sebelum' }"
      :next="{ 'aria-label': 'Seterusnya' }"
      @update:page="emit('update:page', $event)"
    />
  </div>
</template>
