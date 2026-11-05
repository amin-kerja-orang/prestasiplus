<script setup lang="ts">
/**
 * `/guru/soalan-guru` "Soalan & Rujukan" (PRD-20 R1-GUR-44a; FR-GUR-44a-1, -8; AC-GUR-44a-5, -9): the teacher's own
 * private questions, newest first, 20 per page (`?page=`), with the filter "Tahap" (`?educationLevelId=`, "-- Semua
 * tahap --" first, then Tingkatan 1 to 5), "Tambah Soalan", "Edit" and "Padam". A delete asks first; a 409 ("Soalan
 * sedang digunakan dalam misi.") shows the server message and the question stays in the list.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsCluster,
  DsEmptyState,
  DsFormField,
  DsGrid,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
  useConfirm,
} from '@/ds'

import { deletePersonalQuestion, fetchPersonalQuestions } from '../api/personal-questions'
import { RUJUKAN_COPY } from '../components/soalan-rujukan/copy'
import RujukanCard from '../components/soalan-rujukan/RujukanCard.vue'
import { fetchLevelOptions, type NamedLookup } from '../components/soalan/data'
import { COPY } from '../components/soalan/lib'
import { moduleMessage } from '../lib/generic-server-text'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

const page = computed(() => {
  const n = Number(route.query.page)
  return Number.isInteger(n) && n >= 1 ? n : 1
})
const level = computed(() => {
  const n = Number(route.query.educationLevelId)
  return Number.isInteger(n) && n >= 1 ? n : undefined
})

const levels = ref<NamedLookup[]>([])
onMounted(async () => {
  try {
    levels.value = await fetchLevelOptions()
  } catch {
    levels.value = []
  }
})
const levelName = (id: number): string => levels.value.find((l) => l.id === id)?.name ?? ''

const list = useApi(
  (signal) =>
    fetchPersonalQuestions(
      { page: page.value, ...(level.value !== undefined ? { educationLevelId: level.value } : {}) },
      { signal },
    ),
  [page, level],
)

function setLevel(value: string | number): void {
  const next = String(value)
  void router.push({ path: route.path, query: next === '' ? {} : { educationLevelId: next } })
}
function go(next: number): void {
  void router.push({
    path: route.path,
    query: {
      ...(level.value !== undefined ? { educationLevelId: String(level.value) } : {}),
      ...(next > 1 ? { page: String(next) } : {}),
    },
  })
}

const deleting = ref(false)
const deleteError = ref<string[]>([])

async function remove(id: number): Promise<void> {
  if (
    deleting.value ||
    !(await confirm({ message: RUJUKAN_COPY.confirmDelete(id), tone: 'error' }))
  ) {
    return
  }
  deleting.value = true
  deleteError.value = []
  try {
    await deletePersonalQuestion(id)
    flash.show({ type: 'success', message: COPY.deleted })
    await list.reload()
  } catch (err) {
    deleteError.value = [moduleMessage(err) ?? COPY.saveFailed]
  } finally {
    deleting.value = false
  }
}

const pagerText = computed(() => {
  const meta = list.data.value?.meta
  const rows = list.data.value?.data.length ?? 0
  if (!meta) return ''
  const from = rows === 0 ? 0 : (page.value - 1) * meta.pageSize + 1
  const to = rows === 0 ? 0 : (page.value - 1) * meta.pageSize + rows
  return `Menunjukkan ${String(from)}-${String(to)} daripada ${String(meta.totalItems)} hasil`
})
</script>

<template>
  <DsPage data-testid="rujukan-page">
    <DsCluster justify="between" align="end">
      <DsFormField native :label="RUJUKAN_COPY.filterLabel" for="r-filter" class="w-full sm:w-64">
        <template #default="{ id }">
          <DsNativeSelect
            :id="id"
            :model-value="level === undefined ? '' : String(level)"
            name="educationLevelId"
            data-testid="rujukan-filter"
            @update:model-value="setLevel"
          >
            <option value="">{{ RUJUKAN_COPY.allLevels }}</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </DsNativeSelect>
        </template>
      </DsFormField>
      <UButton
        to="/guru/soalan-guru/cipta"
        icon="i-ph-plus-circle-duotone"
        class="min-h-11"
        data-testid="rujukan-add"
        >{{ RUJUKAN_COPY.add }}</UButton
      >
    </DsCluster>

    <UAlert
      v-if="deleteError.length"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      data-testid="rujukan-delete-error"
    >
      <template #description>
        <p v-for="(m, i) in deleteError" :key="i">{{ m }}</p>
      </template>
    </UAlert>

    <DsLoadError
      v-if="list.error.value"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="rujukan-error"
      @retry="list.reload"
    />
    <DsStack v-else-if="!list.data.value" gap="sm" aria-busy="true" data-testid="rujukan-loading">
      <USkeleton v-for="n in 3" :key="n" class="h-28 w-full" />
    </DsStack>
    <template v-else>
      <DsPanel v-if="list.data.value.data.length === 0" data-testid="rujukan-empty">
        <DsEmptyState :title="RUJUKAN_COPY.empty" icon="note-pencil">
          <template #actions>
            <UButton
              to="/guru/soalan-guru/cipta"
              icon="i-ph-plus-circle-duotone"
              class="min-h-11"
              data-testid="rujukan-add-empty"
              >{{ RUJUKAN_COPY.add }}</UButton
            >
          </template>
        </DsEmptyState>
      </DsPanel>
      <DsGrid v-else as="ul" :cols="1" gap="sm" data-testid="rujukan-list">
        <RujukanCard
          v-for="q in list.data.value.data"
          :key="q.id"
          :question="q"
          :level-name="levelName(q.educationLevelId)"
          :deleting="deleting"
          @remove="remove"
        />
      </DsGrid>
      <DsCluster
        v-if="list.data.value.meta.totalItems > list.data.value.meta.pageSize"
        justify="between"
        data-testid="rujukan-pager"
      >
        <DsText variant="caption" tone="muted" role="status" data-testid="rujukan-pager-text">{{
          pagerText
        }}</DsText>
        <UPagination
          :page="page"
          :total="list.data.value.meta.totalItems"
          :items-per-page="list.data.value.meta.pageSize"
          :prev="{ 'aria-label': 'Sebelum' }"
          :next="{ 'aria-label': 'Seterusnya' }"
          @update:page="go"
        />
      </DsCluster>
    </template>
  </DsPage>
</template>
