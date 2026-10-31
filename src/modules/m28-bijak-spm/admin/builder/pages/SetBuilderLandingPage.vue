<script setup lang="ts">
/**
 * Set Builder landing (`/admin/studio/sets`, S4.1): "Mula kosong", "Jana set" with a Kertas choice
 * (D83 D-6) and "Pratonton kolam", then the list of sets. Minimum clicks as V2: Jana set (1) +
 * Terbitkan (1).
 */
import type { BijakPoolPreview } from '@pp/contract'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { DsEmptyState, DsLoadError, DsNativeSelect, DsPage, DsPanel, DsStatusBadge } from '@/ds'

import { ADMIN_ROUTES } from '../../papers/ui'
import PoolPreviewCard from '../components/PoolPreviewCard.vue'
import { builderCopy as t } from '../domain/copy'
import { BuilderError, builderMessage, builderPath } from '../server/api'
import { builderServer } from '../server/client'
import { formatDateTime } from '../../../lib/use-bijak'

const api = builderServer()
const router = useRouter()
const flash = useFlash()

const sets = useApi(() => api.listSets())
const subjects = useApi(() => api.subjects())

/* ------------------------------------------------------------------ Mula kosong */
const blankTitle = ref('')
const blankSubject = ref('')
const blankKertas = ref('')
const blankBusy = ref(false)

const kertasOf = (code: string): number[] => subjects.data.value?.find((s) => s.code === code)?.kertas ?? []
watch(blankSubject, (s) => {
  const k = kertasOf(s)
  blankKertas.value = k.length === 1 ? String(k[0]) : ''
})

async function startBlank(): Promise<void> {
  if (!blankSubject.value || !blankKertas.value) return
  blankBusy.value = true
  try {
    const id = await api.create({ subject: blankSubject.value, kertas: Number(blankKertas.value), title: blankTitle.value })
    flash.show({ type: 'success', message: t.blankCreated })
    await router.push(builderPath(id))
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
  } finally {
    blankBusy.value = false
  }
}

/* ---------------------------------------------------------------------- Jana set */
const genSubject = ref('')
const genKertas = ref('')
const genBusy = ref(false)
const pool = ref<BijakPoolPreview | null>(null)
const poolState = ref<'idle' | 'loading' | 'none' | 'error' | 'ready'>('idle')
const previewOpen = ref(false)
let poolSeq = 0

watch(genSubject, (s) => {
  const k = kertasOf(s)
  genKertas.value = k.length === 1 ? String(k[0]) : ''
})
watch([genSubject, genKertas], async ([s, k]) => {
  pool.value = null
  const seq = ++poolSeq
  if (!s || !k) {
    poolState.value = 'idle'
    return
  }
  poolState.value = 'loading'
  try {
    const p = await api.poolPreview(s, Number(k))
    if (seq !== poolSeq) return
    pool.value = p
    poolState.value = 'ready'
  } catch (e) {
    if (seq !== poolSeq) return
    poolState.value = e instanceof BuilderError && e.kind === 'no_blueprint' ? 'none' : 'error'
  }
})

const requested = computed(() => pool.value?.sections.reduce((n, s) => n + s.slots, 0) ?? 0)
const canGenerate = computed(() => poolState.value === 'ready' && pool.value?.verdict === 'boleh')
const subjectName = computed(() => subjects.data.value?.find((s) => s.code === genSubject.value)?.name ?? genSubject.value)

async function generate(): Promise<void> {
  if (!canGenerate.value) return
  genBusy.value = true
  try {
    const id = await api.generate(genSubject.value, Number(genKertas.value))
    const ed = await api.getEditor(id)
    const n = ed.paper.sections.reduce((c, s) => c + s.questionIds.length, 0)
    flash.show({ type: 'success', message: t.generated(n) })
    await router.push(builderPath(id))
  } catch (e) {
    if (e instanceof BuilderError && e.kind === 'shortage') {
      flash.show({ type: 'error', message: e.message || t.errGenerateShortage })
      poolState.value = 'error'
      void api.poolPreview(genSubject.value, Number(genKertas.value)).then(
        (p) => {
          pool.value = p
          poolState.value = 'ready'
        },
        () => {},
      )
    } else {
      flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
    }
  } finally {
    genBusy.value = false
  }
}

/* -------------------------------------------------------------------------- list */
async function copySet(id: string): Promise<void> {
  try {
    const nid = await api.copy(id)
    flash.show({ type: 'success', message: t.copied })
    await router.push(builderPath(nid))
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
  }
}
</script>

<template>
  <DsPage layout="list" :title="t.landingTitle" :subtitle="t.landingSubtitle" data-testid="set-builder-page">
    <DsPanel>
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-1">
          <p class="text-caption text-muted">{{ t.introKicker }}</p>
          <h2 class="text-heading text-highlighted">{{ t.introTitle }}</h2>
          <p class="text-body text-muted">{{ t.introText }}</p>
        </div>
        <form class="flex flex-col gap-3" data-testid="blank-form" @submit.prevent="startBlank">
          <h3 class="text-subheading text-highlighted">{{ t.blankTitle }}</h3>
          <UFormField :label="t.blankTitleField">
            <UInput v-model="blankTitle" class="w-full" data-testid="blank-title" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t.subject" required>
              <DsNativeSelect v-model="blankSubject" :aria-label="t.subject" data-testid="blank-subject">
                <option value="">{{ t.subjectPlaceholder }}</option>
                <option v-for="s in subjects.data.value ?? []" :key="s.code" :value="s.code">{{ s.name }}</option>
              </DsNativeSelect>
            </UFormField>
            <UFormField :label="t.kertas" required>
              <DsNativeSelect v-model="blankKertas" :aria-label="t.kertas" data-testid="blank-kertas">
                <option value="">{{ t.kertasPlaceholder }}</option>
                <option v-for="k in kertasOf(blankSubject)" :key="k" :value="String(k)">Kertas {{ k }}</option>
              </DsNativeSelect>
            </UFormField>
          </div>
          <UButton
            type="submit"
            icon="i-ph-plus"
            :label="t.blankTitle"
            class="min-h-11 self-start"
            :loading="blankBusy"
            :disabled="!blankSubject || !blankKertas"
            data-testid="blank-submit"
          />
        </form>
      </div>
    </DsPanel>

    <DsPanel>
      <div class="grid gap-6 lg:grid-cols-3">
        <form class="flex flex-col gap-3 lg:col-span-2" data-testid="generate-form" @submit.prevent="generate">
          <div>
            <h2 class="text-heading text-highlighted">{{ t.generateTitle }}</h2>
            <p class="text-caption text-muted">{{ t.generateSub }}</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t.subject" required>
              <DsNativeSelect v-model="genSubject" :aria-label="`${t.subject} ${t.generateTitle}`" data-testid="gen-subject">
                <option value="">{{ t.subjectPlaceholder }}</option>
                <option v-for="s in subjects.data.value ?? []" :key="s.code" :value="s.code">{{ s.name }}</option>
              </DsNativeSelect>
            </UFormField>
            <UFormField :label="t.kertas" required>
              <DsNativeSelect v-model="genKertas" :aria-label="`${t.kertas} ${t.generateTitle}`" data-testid="gen-kertas">
                <option value="">{{ t.kertasPlaceholder }}</option>
                <option v-for="k in kertasOf(genSubject)" :key="k" :value="String(k)">Kertas {{ k }}</option>
              </DsNativeSelect>
            </UFormField>
          </div>
          <UFormField v-if="pool" :label="t.countField" :hint="t.countHint(subjectName, Number(genKertas))">
            <UInput :model-value="requested" readonly class="w-full sm:w-40" data-testid="gen-count" />
          </UFormField>
          <div class="flex flex-col gap-1">
            <UButton
              type="submit"
              icon="i-ph-shuffle"
              :label="t.generateTitle"
              class="min-h-11 self-start"
              :loading="genBusy"
              :disabled="!canGenerate"
              data-testid="gen-submit"
            />
            <p v-if="poolState === 'none'" class="text-caption text-muted" data-testid="gen-reason">{{ t.noBlueprint }}</p>
            <p
              v-else-if="poolState === 'ready' && !canGenerate"
              class="text-caption text-error"
              data-testid="gen-reason"
            >
              {{ t.generateBlocked }}
            </p>
          </div>
        </form>

        <aside class="flex flex-col gap-2 rounded-lg bg-muted p-4" aria-labelledby="pool-title" data-testid="pool-aside">
          <h3 id="pool-title" class="text-subheading text-highlighted">{{ t.poolTitle }}</h3>
          <template v-if="pool">
            <p class="text-body" data-testid="pool-available">{{ t.poolAvailable(pool.eligibleTotal) }}</p>
            <p class="text-body text-muted">{{ t.poolRequested(requested) }}</p>
            <p v-if="pool.eligibleTotal === 0" class="text-caption text-error">{{ t.poolNoScheme }}</p>
            <p v-else-if="requested === pool.eligibleTotal" class="text-caption text-warning">{{ t.poolSame }}</p>
            <p v-if="pool.verdict === 'tidak_boleh'" class="text-caption text-warning">{{ t.poolReduce }}</p>
            <UButton
              color="neutral"
              variant="soft"
              class="min-h-11 self-start"
              :icon="previewOpen ? 'i-ph-caret-up' : 'i-ph-caret-down'"
              :label="t.poolPreview"
              :aria-expanded="previewOpen"
              aria-controls="pool-preview-region"
              data-testid="pool-toggle"
              @click="previewOpen = !previewOpen"
            />
            <div v-show="previewOpen" id="pool-preview-region">
              <PoolPreviewCard :preview="pool" :subject="genSubject" :kertas="Number(genKertas)" />
            </div>
          </template>
          <p v-else-if="poolState === 'loading'" class="text-caption text-muted">…</p>
          <p v-else-if="poolState === 'error'" class="text-caption text-error" role="alert">{{ t.errPool }}</p>
          <p v-else class="text-caption text-muted">{{ t.poolAvailable(0) }}</p>
        </aside>
      </div>
    </DsPanel>

    <section aria-labelledby="sets-title" class="flex flex-col gap-3">
      <h2 id="sets-title" class="text-heading text-highlighted">{{ t.listTitle }}</h2>
      <DsLoadError v-if="sets.error.value" :message="t.loadError" @retry="sets.reload()" />
      <DsEmptyState v-else-if="sets.data.value && !sets.data.value.length" :title="t.listEmpty" icon="scroll" />
      <ul v-else class="flex flex-col gap-2" data-testid="sets-list">
        <li
          v-for="s in sets.data.value ?? []"
          :key="s.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3"
          :data-testid="`set-${s.id}`"
        >
          <div class="flex min-w-0 flex-col">
            <span class="text-label text-highlighted break-words">{{ s.title }}</span>
            <span class="text-caption text-muted">
              {{ s.subjectName }} · Kertas {{ s.kertas }} · {{ s.marks }} / {{ s.budget }} markah ·
              {{ formatDateTime(s.updatedAt) }}
            </span>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <DsStatusBadge :status="s.status === 'terbit' ? 'published' : 'draft'" />
            <UButton
              :to="builderPath(s.id)"
              icon="i-ph-pencil-simple"
              :label="t.open"
              class="min-h-11"
              :data-testid="`set-open-${s.id}`"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-ph-copy"
              :label="t.copy"
              class="min-h-11"
              :data-testid="`set-copy-${s.id}`"
              @click="copySet(s.id)"
            />
            <UButton
              :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: s.id } }"
              color="neutral"
              variant="ghost"
              icon="i-ph-seal-check"
              label="Semak"
              class="min-h-11"
            />
          </div>
        </li>
      </ul>
    </section>
  </DsPage>
</template>
