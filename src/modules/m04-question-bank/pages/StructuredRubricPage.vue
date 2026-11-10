<script setup lang="ts">
/**
 * `/admin/spm/subjektif/:id/sunting` "Skema & Rubrik Pemarkahan" (V2 Panel `spm/subjektif-edit`, reached from the Sunting action of the
 * Subjektif lane). Per sub-question (a leaf part of the V3 question): "Skema (ayat penuh)" and "Poin Rubrik" rows with "Tambah";
 * "Simpan Skema & Rubrik" saves. Admin Pusat only, like the V2 PUT. A blank row removes that point on save, so every row is sent
 * (the index of a 422 `subs.<i>.points.<j>.*` field must match the row shown).
 *
 * V3 mapping: Skema is the `modelText` of the leaf's points key, a point's text its `label`. A leaf whose key is not a points key
 * (a numeric or short-answer key) has no rubric rows and is shown read-only. An approved question is saved as the next draft version.
 */
import { useToast } from '@nuxt/ui/composables'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsBackLink, DsFormField, DsLoadError, DsPage, DsPanel, DsText } from '@/ds'

import { fetchStructuredRubric, saveStructuredRubric, type StructuredRubric } from '../api/structured-rubric'
import { LOAD_ERROR, isNotFound } from '../lib/ui-errors'

const props = defineProps<{ id: string }>()
const router = useRouter()
const toast = useToast()

const LANE_PATH = '/admin/spm/subjektif'
const STATUS_LABEL: Record<string, string> = { draft: 'Draf', review: 'Menunggu Semakan', approved: 'Diluluskan', archived: 'Diarkibkan' }

interface Row {
  text: string
  marks: number
}
interface SubState {
  scheme: string
  rows: Row[]
}

const { data: loaded, error, reload } = useApi<StructuredRubric>((signal) => fetchStructuredRubric(props.id, { signal }), () => props.id)
const notFound = computed(() => isNotFound(error.value))
watch(notFound, (is404) => is404 && setRouteOutcome(404), { immediate: true })

const state = reactive<Record<string, SubState>>({})
watch(
  loaded,
  (q) => {
    for (const sub of q?.subs ?? []) {
      if (!sub.editable) continue
      state[sub.id] = {
        scheme: sub.scheme ?? '',
        rows: sub.points.length > 0 ? sub.points.map((p) => ({ text: p.text, marks: p.marks })) : [{ text: '', marks: 1 }],
      }
    }
  },
  { immediate: true },
)

const editable = computed(() => (loaded.value?.subs ?? []).filter((s) => s.editable))
const processing = ref(false)
const errors = ref<Record<string, string>>({})
const failed = ref<string | null>(null)

/** The 422 field of a sub-question: `subs.<index among the editable subs>.<rest>`. */
const fieldError = (subId: string, rest: string): string | undefined => {
  const k = editable.value.findIndex((s) => s.id === subId)
  return k < 0 ? undefined : errors.value[`subs.${String(k)}.${rest}`]
}

const addRow = (subId: string): void => void state[subId]?.rows.push({ text: '', marks: 1 })
const removeRow = (subId: string, i: number): void => void state[subId]?.rows.splice(i, 1)

function marksOf(value: string | number): number {
  // Not `|| 1`: a typed 0 must reach the server's minimum check instead of being rewritten.
  const parsed = typeof value === 'number' ? value : parseInt(value, 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

async function submit(): Promise<void> {
  errors.value = {}
  failed.value = null
  processing.value = true
  try {
    const out = await saveStructuredRubric(props.id, {
      subs: editable.value.map((s) => {
        const st = state[s.id] ?? { scheme: '', rows: [] }
        return { id: s.id, scheme: st.scheme.trim() === '' ? null : st.scheme, points: st.rows.map((r) => ({ text: r.text, marks: r.marks })) }
      }),
    })
    toast.add({ title: out.status, color: 'success' })
    await router.push(LANE_PATH)
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) {
      errors.value = e.fields ?? {}
      failed.value = Object.keys(errors.value).length === 0 ? e.message : null
    } else {
      failed.value = 'Tidak dapat menyimpan. Cuba lagi.'
    }
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <DsPage layout="form" class="max-w-5xl" data-testid="rubric-page">
    <template #breadcrumb>
      <DsBackLink :to="LANE_PATH" label="Kembali ke Subjektif" data-testid="rubric-back" />
    </template>

    <DsLoadError v-if="error && !notFound" :message="LOAD_ERROR" testid="rubric-error" retry-testid="rubric-retry" @retry="reload()" />

    <div v-else-if="!loaded" class="flex flex-col gap-4" data-testid="rubric-skeleton">
      <USkeleton class="h-40 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else>
      <DsPanel data-testid="rubric-header">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-subheading text-highlighted">Skema &amp; Rubrik Pemarkahan</h2>
          <UBadge color="neutral" variant="subtle" :label="STATUS_LABEL[loaded.question.status] ?? loaded.question.status" data-testid="rubric-status" />
        </div>
        <p class="mt-1 text-caption text-muted" data-testid="rubric-meta">
          Soalan #{{ loaded.question.id }} · {{ loaded.question.subject ?? 'Subjek' }}{{ loaded.question.level ? ` · ${loaded.question.level}` : '' }} ·
          {{ loaded.question.totalMarks }} markah
        </p>
        <p class="mt-3 text-body break-words whitespace-pre-line text-highlighted" data-testid="rubric-stimulus">{{ loaded.question.stimulus }}</p>
        <UCard variant="subtle" class="mt-4">
          <p class="text-body text-default">
            Rubrik di sini yang menentukan pemarkahan automatik. Setiap <strong>poin</strong> ialah satu isi yang diberi markah (contoh:
            <em>A1 whatsapp [1m]</em>). Jumlah markah bahagian tetap menjadi had — rubrik 5 poin pada bahagian 3 markah bermaksud &ldquo;mana-mana
            3&rdquo;.
          </p>
        </UCard>
      </DsPanel>

      <UAlert v-if="failed" color="error" variant="subtle" :title="failed" role="alert" data-testid="rubric-failed" />

      <DsPanel v-if="loaded.subs.length === 0" data-testid="rubric-none">
        <DsText variant="body" tone="muted">Soalan ini tiada bahagian jawapan, jadi tiada rubrik untuk disunting.</DsText>
      </DsPanel>

      <form v-else class="flex flex-col gap-5" novalidate data-testid="rubric-form" @submit.prevent="submit">
        <DsPanel v-for="sub in loaded.subs" :key="sub.id" data-testid="rubric-sub">
          <div class="flex items-start gap-3">
            <span class="shrink-0 text-body font-semibold text-primary" data-testid="rubric-sub-number">{{ sub.number }}</span>
            <p class="min-w-0 flex-1 text-body break-words text-highlighted">{{ sub.body }}</p>
            <UBadge color="neutral" variant="subtle" :label="`${sub.marks}m`" class="shrink-0" />
          </div>

          <template v-if="sub.editable && state[sub.id]">
            <div class="mt-4 flex flex-col gap-4">
              <DsFormField label="Skema (ayat penuh)" :for="`scheme-${sub.id}`" :error="fieldError(sub.id, 'scheme')">
                <UTextarea
                  :id="`scheme-${sub.id}`"
                  v-model="state[sub.id]!.scheme"
                  :rows="3"
                  :maxlength="4000"
                  placeholder="Contoh: Teenagers commonly use WhatsApp, Instagram, TikTok and other social media apps."
                  class="w-full"
                  :data-testid="`rubric-scheme-${sub.id}`"
                />
              </DsFormField>

              <div class="flex flex-col gap-2">
                <p class="text-overline text-muted">Poin Rubrik</p>
                <div v-for="(row, i) in state[sub.id]!.rows" :key="i" class="flex flex-col gap-1" :data-testid="`rubric-row-${sub.id}-${String(i)}`">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="w-8 shrink-0 text-caption font-bold text-muted">A{{ i + 1 }}</span>
                    <UInput
                      v-model="row.text"
                      :maxlength="500"
                      placeholder="Isi yang diberi markah…"
                      :aria-label="`Poin A${String(i + 1)}`"
                      :color="fieldError(sub.id, `points.${String(i)}.text`) ? 'error' : undefined"
                      class="min-w-0 flex-1"
                      data-testid="rubric-point-text"
                    />
                    <UInput
                      :model-value="row.marks"
                      type="number"
                      :min="1"
                      :max="20"
                      :aria-label="`Markah A${String(i + 1)}`"
                      :color="fieldError(sub.id, `points.${String(i)}.marks`) ? 'error' : undefined"
                      class="w-20"
                      data-testid="rubric-point-marks"
                      @update:model-value="row.marks = marksOf($event as string | number)"
                    />
                    <span class="text-caption text-muted">m</span>
                    <UButton
                      type="button"
                      color="neutral"
                      variant="ghost"
                      icon="i-ph-trash"
                      aria-label="Buang baris"
                      class="min-h-11 min-w-11"
                      data-testid="rubric-remove"
                      @click="removeRow(sub.id, i)"
                    />
                  </div>
                  <p v-for="m in [fieldError(sub.id, `points.${String(i)}.text`), fieldError(sub.id, `points.${String(i)}.marks`)].filter(Boolean)" :key="m" class="ms-10 text-caption text-error" role="alert">
                    {{ m }}
                  </p>
                </div>
                <p v-if="fieldError(sub.id, 'points')" class="text-caption text-error" role="alert">{{ fieldError(sub.id, 'points') }}</p>
                <UButton type="button" color="neutral" variant="outline" icon="i-ph-plus" label="Tambah" class="min-h-11 w-fit" data-testid="rubric-add" @click="addRow(sub.id)" />
                <p class="text-caption text-muted">Kosongkan baris untuk membuang poin itu.</p>
              </div>
            </div>
          </template>
        </DsPanel>

        <div v-if="editable.length > 0">
          <UButton type="submit" :loading="processing" :disabled="processing" class="min-h-11" data-testid="rubric-save">Simpan Skema &amp; Rubrik</UButton>
        </div>
      </form>
    </template>
  </DsPage>
</template>
