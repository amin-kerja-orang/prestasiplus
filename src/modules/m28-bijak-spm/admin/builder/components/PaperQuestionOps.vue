<script setup lang="ts">
/**
 * "Tambah soalan" and "Padam soalan" of Semak Kertas (S4.4). V2 creates and deletes an EXTRA question
 * inside the paper; V3 places and un-places a BANK question (deviation UX-50, [PROPOSED] confirm).
 * One model: the page's local section lists (`ids`), saved with Simpan draf / Terbitkan, so a unit
 * already removed on screen cannot be removed again. A stimulus group is added and removed whole
 * (D90). The bank list is the section pool (`GET .../sections/:sid/pool`): search is debounced and
 * guarded against out-of-order answers, "Muat lagi" pages on.
 */
import type { BijakBuilderPoolUnit } from '@pp/contract'
import { onBeforeUnmount, reactive, ref } from 'vue'

import { useConfirm } from '@/ds'

import RichText from '../../../components/RichText.vue'
import { unitsOf } from '../../../domain/paper-builder'
import { builderCopy as t } from '../domain/copy'
import type { SectionPool } from '../server/api'

interface Row {
  id: string
  label: string
  questionCount: number
}
interface Known {
  preview: string
  groupId?: string
}

const props = defineProps<{
  sections: readonly Row[]
  /** The local (possibly unsaved) question ids of each section. */
  ids: Readonly<Record<string, string[]>>
  /** Preview text and group of the questions the editor knows. */
  known: (questionId: string) => { preview: string; groupId?: string } | undefined
  readonly?: boolean
  loadPool: (sectionId: string, q: string, page: number) => Promise<SectionPool>
}>()
const emit = defineEmits<{ add: [sectionId: string, unit: BijakBuilderPoolUnit]; remove: [sectionId: string, questionIds: string[]] }>()

const confirm = useConfirm()
const seen = reactive(new Map<string, Known>())
const info = (id: string): Known | undefined => seen.get(id) ?? props.known(id)
const groupOf = (id: string): string | undefined => info(id)?.groupId

const openSection = ref<string | null>(null)
const search = ref('')
const pool = ref<SectionPool | null>(null)
const page = ref(1)
const failed = ref(false)
const loading = ref(false)
let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(timer))

const placedAll = (): Set<string> => new Set(Object.values(props.ids).flat())

async function load(append = false): Promise<void> {
  if (!openSection.value) return
  const mine = ++seq
  loading.value = true
  failed.value = false
  try {
    const next = append ? page.value + 1 : 1
    const res = await props.loadPool(openSection.value, search.value, next)
    if (mine !== seq) return
    for (const u of res.units)
      for (const q of u.questions)
        seen.set(q.id, { preview: q.preview, ...(u.groupId ? { groupId: u.groupId } : {}) })
    page.value = next
    pool.value = append && pool.value ? { ...res, units: [...pool.value.units, ...res.units] } : res
  } catch {
    if (mine !== seq) return
    failed.value = true
    if (!append) pool.value = null
  } finally {
    if (mine === seq) loading.value = false
  }
}
function onSearch(): void {
  clearTimeout(timer)
  timer = setTimeout(() => void load(), 250)
}
async function toggle(sectionId: string): Promise<void> {
  openSection.value = openSection.value === sectionId ? null : sectionId
  search.value = ''
  pool.value = null
  page.value = 1
  await load()
}
async function askRemove(sectionId: string, qids: string[]): Promise<void> {
  const ok = await confirm({ message: t.deleteConfirm, confirmLabel: t.deleteQuestion, tone: 'error' })
  if (ok) emit('remove', sectionId, qids)
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="question-ops">
    <h3 class="text-heading text-highlighted">{{ t.addQuestion }} / {{ t.deleteQuestion }}</h3>
    <section
      v-for="(s, si) in sections"
      :key="s.id"
      class="flex flex-col gap-2 rounded-lg bg-muted p-3"
      :data-testid="`ops-section-${si}`"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-subheading text-highlighted">{{ s.label }}</h4>
        <span class="text-caption text-muted">{{ t.fill((ids[s.id] ?? []).length, s.questionCount) }}</span>
      </div>
      <ul class="flex flex-col gap-2">
        <li
          v-for="u in unitsOf(ids[s.id] ?? [], groupOf)"
          :key="u.ids.join('|')"
          class="flex items-start gap-2"
          :data-testid="`ops-unit-${u.ids[0]}`"
        >
          <div class="flex min-w-0 grow flex-col gap-1">
            <span v-if="u.groupId" class="text-caption font-semibold text-info">{{ t.groupMembers(u.ids.length) }}</span>
            <span v-for="q in u.ids" :key="q" class="line-clamp-2 text-body"><RichText :text="info(q)?.preview ?? q" /></span>
          </div>
          <UButton
            v-if="!readonly"
            color="error"
            variant="ghost"
            icon="i-ph-trash"
            :aria-label="`${t.deleteQuestion}${u.groupId ? ' (kumpulan)' : ''}`"
            class="min-h-11 min-w-11"
            :data-testid="`ops-delete-${u.ids[0]}`"
            @click="askRemove(s.id, u.ids)"
          />
        </li>
      </ul>
      <UButton
        v-if="!readonly"
        color="neutral"
        variant="soft"
        icon="i-ph-plus"
        :label="t.addQuestion"
        class="min-h-11 self-start"
        :aria-expanded="openSection === s.id"
        :data-testid="`ops-add-${si}`"
        @click="toggle(s.id)"
      />
      <div v-if="openSection === s.id" class="flex flex-col gap-2" :data-testid="`ops-pool-${si}`">
        <UInput v-model="search" icon="i-ph-magnifying-glass" :placeholder="t.search" :aria-label="t.search" class="w-full" data-testid="ops-search" @update:model-value="onSearch" />
        <p v-if="failed" class="text-body text-error" role="alert">{{ t.errPool }}</p>
        <p v-else-if="pool && !pool.units.length" class="text-body text-muted">{{ t.noMatch }}</p>
        <ul v-if="pool?.units.length" class="flex flex-col gap-2">
          <li
            v-for="u in pool.units"
            :key="u.groupId ?? u.questionIds[0]"
            class="flex items-start gap-2 rounded bg-default p-2"
            :data-testid="`ops-pick-${u.questionIds[0]}`"
          >
            <div class="flex min-w-0 grow flex-col gap-1">
              <span v-if="u.groupId" class="text-caption font-semibold text-info">{{ t.groupMembers(u.questionIds.length) }}</span>
              <span v-for="q in u.questions" :key="q.id" class="line-clamp-2 text-body"><RichText :text="q.preview" /></span>
              <span v-if="!u.eligible" class="text-caption text-error">{{ t.notServed }}: {{ u.reasons.join('; ') }}</span>
            </div>
            <UButton
              size="sm"
              icon="i-ph-plus"
              :label="t.add"
              class="min-h-11"
              :disabled="!u.eligible || u.questionIds.some((q) => placedAll().has(q))"
              :data-testid="`ops-pick-add-${u.questionIds[0]}`"
              @click="emit('add', s.id, u)"
            />
          </li>
        </ul>
        <UButton
          v-if="pool && page < pool.totalPages"
          color="neutral"
          variant="soft"
          class="min-h-11 self-start"
          :label="t.poolMore"
          :loading="loading"
          data-testid="ops-more"
          @click="load(true)"
        />
      </div>
    </section>
  </div>
</template>
