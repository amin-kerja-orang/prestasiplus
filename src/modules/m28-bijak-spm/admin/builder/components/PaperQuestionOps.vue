<script setup lang="ts">
/**
 * "Tambah soalan" and "Padam soalan" of Semak Kertas (S4.4; V2 cloud-student-mechanism 3.4), server
 * backed: Tambah = `POST /admin/papers/:id/placements` (a bank question; one beyond the Bahagian
 * count is allowed but blocks Terbitkan with "Lebih N soalan"), Padam = `DELETE .../placements/:qid`
 * (clears that blocker). A stimulus group is added and removed whole (D90). Server messages are shown
 * verbatim by the page (for example "Kertas Terbit tidak boleh disunting. Tarik balik dahulu.").
 */
import { ref } from 'vue'

import { useConfirm } from '@/ds'

import RichText from '../../../components/RichText.vue'
import type { PaperEditorData } from '../../../domain/admin-types'
import { sectionUnits } from '../domain/units'
import { builderCopy as t } from '../domain/copy'
import type { SectionPool } from '../server/api'

const props = defineProps<{
  editor: PaperEditorData
  readonly?: boolean
  busy?: boolean
  loadPool: (sectionId: string, q: string) => Promise<SectionPool>
}>()
const emit = defineEmits<{ add: [sectionId: string, questionId: string]; remove: [questionId: string] }>()

const confirm = useConfirm()
const openSection = ref<string | null>(null)
const search = ref('')
const pool = ref<SectionPool | null>(null)
const failed = ref(false)

async function load(): Promise<void> {
  if (!openSection.value) return
  failed.value = false
  try {
    pool.value = await props.loadPool(openSection.value, search.value)
  } catch {
    pool.value = null
    failed.value = true
  }
}
async function toggle(sectionId: string): Promise<void> {
  openSection.value = openSection.value === sectionId ? null : sectionId
  search.value = ''
  pool.value = null
  await load()
}
async function askRemove(questionId: string): Promise<void> {
  const ok = await confirm({ message: t.deleteConfirm, confirmLabel: t.deleteQuestion, tone: 'error' })
  if (ok) emit('remove', questionId)
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="question-ops">
    <h3 class="text-heading text-highlighted">{{ t.addQuestion }} / {{ t.deleteQuestion }}</h3>
    <section
      v-for="(s, si) in editor.paper.sections"
      :key="s.id"
      class="flex flex-col gap-2 rounded-lg bg-muted p-3"
      :data-testid="`ops-section-${si}`"
    >
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-subheading text-highlighted">{{ s.label }}</h4>
        <span class="text-caption text-muted">{{ t.fill(s.questionIds.length, s.questionCount) }}</span>
      </div>
      <ul class="flex flex-col gap-2">
        <li
          v-for="u in sectionUnits(editor, s.id)"
          :key="u.ids.join('|')"
          class="flex items-start gap-2"
          :data-testid="`ops-unit-${u.ids[0]}`"
        >
          <div class="flex min-w-0 grow flex-col gap-1">
            <span v-if="u.groupId" class="text-caption font-semibold text-info">{{ t.groupMembers(u.ids.length) }}</span>
            <span v-for="q in u.questions" :key="q.id" class="line-clamp-2 text-body"><RichText :text="q.preview" /></span>
          </div>
          <UButton
            v-if="!readonly"
            color="error"
            variant="ghost"
            icon="i-ph-trash"
            :aria-label="`${t.deleteQuestion}${u.groupId ? ' (kumpulan)' : ''}`"
            class="min-h-11 min-w-11"
            :disabled="busy"
            :data-testid="`ops-delete-${u.ids[0]}`"
            @click="askRemove(u.ids[0]!)"
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
        <UInput v-model="search" icon="i-ph-magnifying-glass" :placeholder="t.search" :aria-label="t.search" class="w-full" @update:model-value="load" />
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
              :disabled="busy || u.placed || !u.eligible"
              :data-testid="`ops-pick-add-${u.questionIds[0]}`"
              @click="emit('add', s.id, u.questionIds[0]!)"
            />
          </li>
        </ul>
      </div>
    </section>
  </div>
</template>
