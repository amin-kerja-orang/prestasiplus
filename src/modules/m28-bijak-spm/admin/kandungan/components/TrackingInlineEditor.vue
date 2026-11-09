<script setup lang="ts">
/**
 * The inline question editor of the Tracking A set editor (V2: the right pane that loads `/spm/soalan/{q}` beside the list). It is the flat quick edit
 * of one single-leaf MCQ - text, options, key, explanation - the same form and the same save as `BankEditPage` (a new version in the review queue;
 * the live one keeps serving), without leaving the set. Any other question, and a question with a revision waiting, say so and point at the full editor.
 * The set draft is not touched by a save here; `saved` only tells the list to refresh the row's text.
 */
import { computed, ref, watch } from 'vue'

import { DsCallout, DsCluster, DsFormField, DsLoadError, DsStack, DsText } from '@/ds'

import { bijakAdminServer } from '../../../server/client'
import { QUICK_EDIT_OUT_OF_SCOPE } from '../../../server/bank-wire'
import { detailMessage } from '../../papers/ui'
import type { IntakeQuestion } from '../../intake/types'

const props = defineProps<{ qid: string }>()
const emit = defineEmits<{ saved: [qid: string, stem: string] }>()

const server = bijakAdminServer()

type Editable = Awaited<ReturnType<typeof server.getBankEditable>>
const data = ref<Editable | null>(null)
const draft = ref<IntakeQuestion | null>(null)
const loading = ref(false)
const failed = ref(false)
const busy = ref(false)
const errors = ref<string[]>([])
const notice = ref('')

const quick = computed(() => data.value?.quickEdit ?? null)
const outOfScope = computed(() => quick.value === null || quick.value.outOfScope === true)
const locked = computed(() => data.value?.pendingRevision === true)
const readOnly = computed(() => outOfScope.value || locked.value)

const correct = computed({
  get: () => (draft.value?.scheme?.kind === 'option' ? draft.value.scheme.correct : ''),
  set: (value: string) => {
    if (draft.value?.scheme?.kind === 'option') draft.value.scheme = { ...draft.value.scheme, correct: value }
  },
})
const correctItems = computed(() => (draft.value?.options ?? []).map((o) => ({ value: o.id, label: o.id })))

/** Fields 24-01 and 24-03, as on the full page. */
const issues = computed<string[]>(() => {
  const q = draft.value
  if (!q || readOnly.value) return []
  const out: string[] = []
  const stem = q.stem.trim()
  if (stem === '') out.push('Teks soalan tidak boleh kosong.')
  else if (stem.length < 10) out.push('Teks soalan mesti sekurang-kurangnya 10 aksara.')
  for (const o of q.options) if (o.text.trim() === '') out.push(`Pilihan ${o.id} tidak boleh kosong.`)
  if (q.scheme?.kind !== 'option' || !q.scheme.correct) out.push('Tiada jawapan betul dipilih — soalan ini tidak boleh ditanda.')
  return out
})

async function load(): Promise<void> {
  data.value = null
  draft.value = null
  failed.value = false
  errors.value = []
  notice.value = ''
  loading.value = true
  const qid = props.qid
  try {
    const res = await server.getBankEditable(qid)
    if (qid !== props.qid) return // a later selection won
    data.value = res
    draft.value = JSON.parse(JSON.stringify(res.question)) as IntakeQuestion
  } catch {
    if (qid === props.qid) failed.value = true
  } finally {
    if (qid === props.qid) loading.value = false
  }
}

async function save(): Promise<void> {
  const q = draft.value
  if (!q || readOnly.value || issues.value.length > 0 || busy.value) return
  const qid = props.qid
  busy.value = true
  errors.value = []
  notice.value = ''
  try {
    const res = await server.reviseQuestionFull(qid, q, undefined, '')
    if (qid !== props.qid) return
    if (!res.ok) {
      errors.value = res.errors
      return
    }
    notice.value = res.message ?? 'Soalan dikemas kini.'
    emit('saved', qid, q.stem)
  } catch (e) {
    if (qid === props.qid) errors.value = [detailMessage(e)]
  } finally {
    busy.value = false
  }
}

watch(() => props.qid, () => void load(), { immediate: true })
</script>

<template>
  <DsStack gap="sm" data-testid="tracking-inline">
    <DsText v-if="loading" as="p" variant="body" tone="muted" data-testid="tracking-inline-loading">Memuatkan…</DsText>
    <DsLoadError v-else-if="failed" message="Gagal memuatkan soalan ini." @retry="load()" />
    <template v-else-if="draft && data">
      <DsCallout v-if="outOfScope" tone="warning" data-testid="tracking-inline-scope">{{ QUICK_EDIT_OUT_OF_SCOPE }}</DsCallout>
      <DsCallout v-else-if="locked" tone="warning" data-testid="tracking-inline-locked">Versi baharu menunggu semakan</DsCallout>
      <DsStack v-if="!outOfScope" as="fieldset" gap="sm" :disabled="locked">
        <DsText as="legend" variant="subheading" tone="highlighted">Soalan objektif #{{ data.row.id }}</DsText>
        <DsFormField native :for="`inline-stem-${qid}`" label="Teks soalan" required>
          <UTextarea :id="`inline-stem-${qid}`" v-model="draft.stem" :rows="4" maxlength="2000" class="w-full" data-testid="tracking-inline-stem" />
        </DsFormField>
        <DsFormField v-for="(o, i) in draft.options" :key="o.id" native :for="`inline-option-${qid}-${o.id}`" :label="`Pilihan ${o.id}`" required>
          <UInput :id="`inline-option-${qid}-${o.id}`" v-model="draft.options[i]!.text" maxlength="500" class="w-full" :data-testid="`tracking-inline-option-${o.id}`" />
        </DsFormField>
        <URadioGroup v-model="correct" required legend="Pilihan jawapan — pilih yang betul" :items="correctItems" orientation="horizontal" variant="card" data-testid="tracking-inline-correct" />
        <DsFormField native :for="`inline-explanation-${qid}`" label="Penjelasan">
          <UTextarea :id="`inline-explanation-${qid}`" v-model="draft.explanation" :rows="3" class="w-full" data-testid="tracking-inline-explanation" />
        </DsFormField>
      </DsStack>
      <DsStack v-if="issues.length > 0" as="ul" gap="2xs" data-testid="tracking-inline-issues">
        <DsText v-for="e in issues" :key="e" as="li" variant="caption" tone="error">{{ e }}</DsText>
      </DsStack>
      <DsStack v-if="errors.length > 0" as="ul" gap="2xs" role="alert" data-testid="tracking-inline-errors">
        <DsText v-for="e in errors" :key="e" as="li" variant="caption" tone="error">{{ e }}</DsText>
      </DsStack>
      <DsText v-if="notice" as="p" variant="caption" role="status" data-testid="tracking-inline-saved">{{ notice }}</DsText>
      <DsCluster v-if="!readOnly" gap="xs">
        <UButton label="Simpan soalan" :loading="busy" :disabled="issues.length > 0" data-testid="tracking-inline-save" @click="save()" />
      </DsCluster>
    </template>
  </DsStack>
</template>
