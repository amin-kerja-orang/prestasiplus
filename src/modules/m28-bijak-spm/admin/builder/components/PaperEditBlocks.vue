<script setup lang="ts">
/**
 * "Sunting bahagian" and "Sunting petikan" of Semak Kertas (S4.4; V2 cloud-student-mechanism 3.4).
 * Bahagian: label, instruction, "Soalan ini mesti dijawab"; the answering rule and the count are
 * shown read-only (the blueprint owns them). Petikan: the title of each stimulus group on the paper.
 * Each row saves on its own (own flash line, V2).
 */
import { reactive, watch } from 'vue'

import type { PaperEditorData } from '../../../domain/admin-types'
import { builderCopy as t } from '../domain/copy'
import { hasStimulus } from '../domain/stimulus'
import type { SectionPatch } from '../server/api'

const props = defineProps<{ editor: PaperEditorData; readonly?: boolean; busy?: boolean }>()
const emit = defineEmits<{
  section: [sectionId: string, patch: SectionPatch]
  passage: [groupId: string, label: string]
}>()

interface Draft {
  label: string
  instruction: string
  compulsory: boolean
}
const sections = reactive<Record<string, Draft>>({})
const passages = reactive<Record<string, string>>({})

watch(
  () => props.editor,
  (ed) => {
    for (const s of ed.paper.sections)
      sections[s.id] = { label: s.label, instruction: s.instruction ?? '', compulsory: !!s.compulsory }
    for (const g of ed.groups) passages[g.id] = g.stimulus.label ?? ''
  },
  { immediate: true },
)

/** Groups that are on the paper, in paper order. */
function placedGroups(): { id: string }[] {
  const placed = new Set(props.editor.paper.sections.flatMap((s) => s.questionIds))
  // A group without stimulus content (T07 placeholder) has no title to edit.
  return props.editor.groups.filter((g) => g.questionIds.some((q) => placed.has(q)) && hasStimulus(g.stimulus))
}
const ruleText = (r: { type: 'all' } | { type: 'choose'; n: number }): string =>
  r.type === 'all' ? 'Jawab Semua' : `Pilih ${r.n}`

function saveSection(id: string): void {
  const d = sections[id]
  if (!d || !d.label.trim()) return
  emit('section', id, { label: d.label.trim(), instruction: d.instruction.trim() || null, compulsory: d.compulsory })
}
function savePassage(id: string): void {
  const v = (passages[id] ?? '').trim()
  if (v) emit('passage', id, v)
}
</script>

<template>
  <div class="flex flex-col gap-6" data-testid="edit-blocks">
    <section class="flex flex-col gap-3" data-testid="edit-sections">
      <h3 class="text-heading text-highlighted">{{ t.sectionsEdit }}</h3>
      <form
        v-for="(s, si) in editor.paper.sections"
        :key="s.id"
        class="flex flex-col gap-3 rounded-lg bg-muted p-3"
        :data-testid="`edit-section-${si}`"
        @submit.prevent="saveSection(s.id)"
      >
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="t.sectionLabel" required>
            <UInput v-if="sections[s.id]" v-model="sections[s.id]!.label" class="w-full" :disabled="readonly" :data-testid="`section-label-${si}`" />
          </UFormField>
          <UFormField :label="t.sectionRule">
            <UInput :model-value="`${ruleText(s.rule)} · ${s.questionCount}`" readonly disabled class="w-full" :aria-label="`${t.sectionRule}, ${t.sectionCount}`" />
          </UFormField>
        </div>
        <UFormField :label="t.sectionInstruction">
          <UTextarea v-if="sections[s.id]" v-model="sections[s.id]!.instruction" :rows="2" autoresize class="w-full" :disabled="readonly" :data-testid="`section-instruction-${si}`" />
        </UFormField>
        <UCheckbox v-if="sections[s.id]" v-model="sections[s.id]!.compulsory" :label="t.sectionCompulsory" :disabled="readonly" />
        <UButton
          v-if="!readonly"
          type="submit"
          icon="i-ph-floppy-disk"
          :label="t.sectionSave"
          class="min-h-11 self-start"
          :loading="busy"
          :disabled="!sections[s.id]?.label.trim()"
          :data-testid="`section-save-${si}`"
        />
      </form>
    </section>

    <section v-if="placedGroups().length" class="flex flex-col gap-3" data-testid="edit-passages">
      <h3 class="text-heading text-highlighted">{{ t.passagesEdit }}</h3>
      <p class="text-caption text-muted">{{ t.passageShared }}</p>
      <form
        v-for="g in placedGroups()"
        :key="g.id"
        class="flex flex-wrap items-end gap-3 rounded-lg bg-muted p-3"
        :data-testid="`edit-passage-${g.id}`"
        @submit.prevent="savePassage(g.id)"
      >
        <UFormField :label="t.passageTitle" class="min-w-0 grow">
          <UInput v-model="passages[g.id]" class="w-full" :disabled="readonly" :data-testid="`passage-title-${g.id}`" />
        </UFormField>
        <UButton
          v-if="!readonly"
          type="submit"
          icon="i-ph-floppy-disk"
          :label="t.passageSave"
          class="min-h-11"
          :loading="busy"
          :disabled="!(passages[g.id] ?? '').trim()"
          :data-testid="`passage-save-${g.id}`"
        />
      </form>
    </section>
  </div>
</template>
