<script setup lang="ts">
/**
 * Set Builder landing (`/admin/studio/sets`, S4.1, PRD30 Q-13): "Mula kosong", "Jana set" with Kertas (D83 D-6), Tahun, Negeri and
 * Bilangan (PO decision item 5) and "Pratonton kolam", then the only list of sets (FR-ADM-Q13.1). Minimum clicks as V2: Jana set (1) +
 * Terbitkan (1): the title is prefilled and every field has a default.
 */
import type { BijakLevelScope, BijakPoolPreview } from '@pp/contract'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { DsBadge, DsCluster, DsEmptyState, DsFormField, DsGrid, DsLoadError, DsNativeSelect, DsPage, DsPanel, DsStack, DsStatusBadge, DsText, useConfirm } from '@/ds'

import { ADMIN_ROUTES } from '../../papers/ui'
import { KONTRAK_ROUTES } from '../../kontrak/server/api'
import PoolPreviewCard from '../components/PoolPreviewCard.vue'
import { builderCopy as t, LEVEL_SCOPE_ITEMS, levelScopeLabel } from '../domain/copy'
import { BuilderError, builderMessage, builderPath } from '../server/api'
import { builderServer } from '../server/client'
import { formatDateTime } from '../../../lib/use-bijak'

const api = builderServer()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

const sets = useApi(() => api.listSets())
const subjects = useApi(() => api.builderSubjects())

const subjectOf = (code: string) => subjects.data.value?.find((s) => s.code === code)
const kertasOf = (code: string): number[] => subjectOf(code)?.kertas ?? []
const scopeOf = (code: string, kertas: string): BijakLevelScope => subjectOf(code)?.levelScopes?.[Number(kertas)] ?? 't4_t5'
const defaultTitle = (code: string, kertas: string): string => (code && kertas ? t.defaultTitle(subjectOf(code)?.name ?? code, Number(kertas)) : '')

/* ------------------------------------------------------------------ Mula kosong */
const blankTitle = ref('')
const blankTitleEdited = ref(false)
const blankSubject = ref('')
const blankKertas = ref('')
const blankScope = ref<BijakLevelScope>('t4_t5')
const blankBusy = ref(false)
const blankTried = ref(false)

watch(blankSubject, (s) => {
  const k = kertasOf(s)
  blankKertas.value = k.length === 1 ? String(k[0]) : ''
})
watch([blankSubject, blankKertas], ([s, k]) => {
  if (!blankTitleEdited.value) blankTitle.value = defaultTitle(s, k)
  blankScope.value = scopeOf(s, k)
})
const blankTitleError = computed(() => (blankTried.value && !blankTitle.value.trim() ? t.titleRequiredSet : undefined))
const blankSubjectError = computed(() => (blankTried.value && !blankSubject.value ? t.subjectRequired : undefined))
const blankKertasError = computed(() => (blankTried.value && blankSubject.value && !blankKertas.value ? t.kertasInvalid : undefined))

async function startBlank(): Promise<void> {
  blankTried.value = true
  if (!blankTitle.value.trim() || !blankSubject.value || !blankKertas.value) return
  blankBusy.value = true
  try {
    const id = await api.create({ subject: blankSubject.value, kertas: Number(blankKertas.value), title: blankTitle.value, levelScope: blankScope.value })
    flash.show({ type: 'success', message: t.blankCreated })
    await router.push(builderPath(id))
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
  } finally {
    blankBusy.value = false
  }
}

/* ---------------------------------------------------------------------- Jana set */
const genTitle = ref('')
const genTitleEdited = ref(false)
const genSubject = ref('')
const genKertas = ref('')
const genCount = ref('')
const genCountEdited = ref(false)
const genYears = ref<number[]>([])
const genNegeri = ref<string[]>([])
const genScope = ref<BijakLevelScope>('t4_t5')
const genBusy = ref(false)
const pool = ref<BijakPoolPreview | null>(null)
const poolState = ref<'idle' | 'loading' | 'none' | 'error' | 'ready'>('idle')
const previewOpen = ref(false)
let poolSeq = 0
let countTimer: ReturnType<typeof setTimeout> | undefined
onBeforeUnmount(() => clearTimeout(countTimer))

const contractTotal = computed(() => pool.value?.contractTotal ?? pool.value?.sections.reduce((n, s) => n + s.slots, 0) ?? 0)
const requested = computed(() => Number(genCount.value))
const countError = computed(() => {
  if (!pool.value) return undefined
  if (!Number.isInteger(requested.value) || requested.value < 1) return t.countRange
  if (requested.value > contractTotal.value) return t.countAbove(contractTotal.value)
  // The contract total itself is sent as no count, so only a scaled size has the ceiling of 100.
  return requested.value > 100 && requested.value !== contractTotal.value ? t.countRange : undefined
})
/** The size sent: the contract total is the default, so it is left out. */
const scaledCount = computed(() => (pool.value && !countError.value && requested.value < contractTotal.value ? requested.value : undefined))
const janaFilters = computed(() => ({
  ...(genYears.value.length ? { years: genYears.value } : {}),
  ...(genNegeri.value.length ? { negeri: genNegeri.value } : {}),
  ...(scaledCount.value === undefined ? {} : { count: scaledCount.value }),
}))

async function loadPool(): Promise<void> {
  const seq = ++poolSeq
  const s = genSubject.value
  const k = genKertas.value
  if (!s || !k) {
    pool.value = null
    poolState.value = 'idle'
    return
  }
  if (!pool.value) poolState.value = 'loading'
  try {
    const p = await api.poolPreview(s, Number(k), janaFilters.value)
    if (seq !== poolSeq) return
    pool.value = p
    poolState.value = 'ready'
    if (!genCountEdited.value) genCount.value = String(p.contractTotal ?? p.sections.reduce((n, x) => n + x.slots, 0))
  } catch (e) {
    if (seq !== poolSeq) return
    pool.value = null
    poolState.value = e instanceof BuilderError && e.kind === 'no_blueprint' ? 'none' : 'error'
  }
}

watch(genSubject, (s) => {
  const k = kertasOf(s)
  genKertas.value = k.length === 1 ? String(k[0]) : ''
})
watch([genSubject, genKertas], ([s, k]) => {
  if (!genTitleEdited.value) genTitle.value = defaultTitle(s, k)
  genScope.value = scopeOf(s, k)
  genYears.value = []
  genNegeri.value = []
  genCountEdited.value = false
  genCount.value = ''
  pool.value = null
  void loadPool()
})
watch([genYears, genNegeri], () => void loadPool())
watch(scaledCount, () => {
  clearTimeout(countTimer)
  countTimer = setTimeout(() => void loadPool(), 250)
})

const toggleYear = (y: number): void => {
  genYears.value = genYears.value.includes(y) ? genYears.value.filter((x) => x !== y) : [...genYears.value, y]
}
const toggleNegeri = (n: string): void => {
  genNegeri.value = genNegeri.value.includes(n) ? genNegeri.value.filter((x) => x !== n) : [...genNegeri.value, n]
}

const genTitleError = computed(() => (genSubject.value && !genTitle.value.trim() ? t.titleRequiredSet : undefined))
const poolShort = computed(() => !!pool.value && (pool.value.verdict === 'tidak_boleh' || requested.value > pool.value.eligibleTotal))
/** 13-10: on only when the pool holds the set asked for; the title and the count must be valid. */
const canGenerate = computed(
  () => poolState.value === 'ready' && pool.value?.verdict === 'boleh' && !countError.value && requested.value <= pool.value.eligibleTotal && !genTitleError.value,
)
const subjectName = computed(() => subjectOf(genSubject.value)?.name ?? genSubject.value)

async function generate(): Promise<void> {
  if (!canGenerate.value) return
  genBusy.value = true
  try {
    const id = await api.generate(genSubject.value, Number(genKertas.value), { ...janaFilters.value, title: genTitle.value, levelScope: genScope.value })
    const ed = await api.getEditor(id)
    const n = ed.paper.sections.reduce((c, s) => c + s.questionIds.length, 0)
    flash.show({ type: 'success', message: t.generated(n) })
    await router.push(builderPath(id))
  } catch (e) {
    if (e instanceof BuilderError && e.kind === 'shortage') {
      flash.show({ type: 'error', message: e.message || t.errGenerateShortage })
      void loadPool()
    } else {
      flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
    }
  } finally {
    genBusy.value = false
  }
}

/* -------------------------------------------------------------------------- list */
const PAGE_SIZE = 25
const shownCount = ref(PAGE_SIZE)
const shownSets = computed(() => (sets.data.value ?? []).slice(0, shownCount.value))

async function copySet(id: string): Promise<void> {
  try {
    const nid = await api.copy(id)
    flash.show({ type: 'success', message: t.copied })
    await router.push(builderPath(nid))
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
  }
}

async function deleteSet(id: string, status: string): Promise<void> {
  if (status === 'terbit') {
    flash.show({ type: 'error', message: t.deleteTerbit })
    return
  }
  if (!(await confirm({ title: t.deleteSetTitle, message: t.deleteSetBody, confirmLabel: t.deleteSetOk, tone: 'error' }))) return
  try {
    await api.deleteSet(id)
    await sets.reload()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, t.errGenerate) })
  }
}
</script>

<template>
  <DsPage layout="list" :title="t.landingTitle" :subtitle="t.landingSubtitle" data-testid="set-builder-page">
    <template #actions>
      <UButton :to="{ name: KONTRAK_ROUTES.list }" color="neutral" variant="soft" :label="t.contractButton" data-testid="landing-contract" />
    </template>

    <DsPanel>
      <div class="grid gap-6 lg:grid-cols-2">
        <div class="flex flex-col gap-1">
          <p class="text-caption text-muted">{{ t.introKicker }}</p>
          <h2 class="text-heading text-highlighted">{{ t.introTitle }}</h2>
          <p class="text-body text-muted">{{ t.introText }}</p>
        </div>
        <form class="flex flex-col gap-3" data-testid="blank-form" novalidate @submit.prevent="startBlank">
          <h3 class="text-subheading text-highlighted">{{ t.blankTitle }}</h3>
          <UFormField :label="t.blankTitleField" required :error="blankTitleError">
            <UInput v-model="blankTitle" class="w-full" maxlength="200" data-testid="blank-title" @update:model-value="blankTitleEdited = true" />
          </UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t.subject" required :error="blankSubjectError">
              <DsNativeSelect v-model="blankSubject" :aria-label="t.subject" data-testid="blank-subject">
                <option value="">{{ t.blankSubjectPlaceholder }}</option>
                <option v-for="s in subjects.data.value ?? []" :key="s.code" :value="s.code">{{ s.name }}</option>
              </DsNativeSelect>
            </UFormField>
            <UFormField :label="t.kertas" required :error="blankKertasError">
              <DsNativeSelect v-model="blankKertas" :aria-label="t.kertas" data-testid="blank-kertas">
                <option value="">{{ t.kertasPlaceholder }}</option>
                <option v-for="k in kertasOf(blankSubject)" :key="k" :value="String(k)">Kertas {{ k }}</option>
              </DsNativeSelect>
            </UFormField>
          </div>
          <DsFormField :label="t.levelField" required>
            <DsNativeSelect v-model="blankScope" :aria-label="t.levelField" :items="LEVEL_SCOPE_ITEMS" data-testid="blank-scope" />
          </DsFormField>
          <UButton
            type="submit"
            icon="i-ph-plus"
            :label="t.blankTitle"
            class="min-h-11 self-start"
            :loading="blankBusy"
            data-testid="blank-submit"
          />
        </form>
      </div>
    </DsPanel>

    <DsPanel>
      <div class="grid gap-6 lg:grid-cols-3">
        <form class="flex flex-col gap-3 lg:col-span-2" data-testid="generate-form" novalidate @submit.prevent="generate">
          <div>
            <h2 class="text-heading text-highlighted">{{ t.generateTitle }}</h2>
            <p class="text-caption text-muted">{{ t.generateSub }}</p>
          </div>
          <DsFormField :label="t.genTitleField" required :error="genTitleError">
            <UInput
              v-model="genTitle"
              class="w-full"
              maxlength="200"
              :placeholder="t.genTitlePlaceholder"
              data-testid="gen-title"
              @update:model-value="genTitleEdited = true"
            />
          </DsFormField>
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
          <DsGrid v-if="pool" :cols="{ base: 1, sm: 2 }" gap="sm">
            <DsFormField :label="t.countField" required :hint="t.countHint(subjectName, Number(genKertas))" :error="countError">
              <UInput
                v-model="genCount"
                type="number"
                inputmode="numeric"
                min="1"
                :max="contractTotal"
                class="w-full"
                data-testid="gen-count"
                @update:model-value="genCountEdited = true"
              />
            </DsFormField>
            <DsFormField :label="t.levelField" required>
              <DsNativeSelect v-model="genScope" :aria-label="`${t.levelField} ${t.generateTitle}`" :items="LEVEL_SCOPE_ITEMS" data-testid="gen-scope" />
            </DsFormField>
          </DsGrid>
          <DsText v-if="scaledCount !== undefined" variant="caption" tone="muted" data-testid="gen-scaled">{{ t.scaledHint(contractTotal) }}</DsText>
          <DsStack v-if="pool?.filters?.years.length" gap="xs" data-testid="gen-years">
            <DsText variant="label" tone="highlighted">{{ t.tahunAll }}</DsText>
            <DsCluster gap="xs">
              <UButton
                v-for="y in pool.filters.years"
                :key="y"
                :color="genYears.includes(y) ? 'primary' : 'neutral'"
                :variant="genYears.includes(y) ? 'solid' : 'soft'"
                :label="String(y)"
                :aria-pressed="genYears.includes(y)"
                :data-testid="`gen-year-${y}`"
                @click="toggleYear(y)"
              />
            </DsCluster>
          </DsStack>
          <DsStack v-if="pool?.filters?.negeri.length" gap="xs" data-testid="gen-negeri">
            <DsText variant="label" tone="highlighted">{{ t.negeriAll }}</DsText>
            <DsCluster gap="xs">
              <UButton
                v-for="n in pool.filters.negeri"
                :key="n"
                :color="genNegeri.includes(n) ? 'primary' : 'neutral'"
                :variant="genNegeri.includes(n) ? 'solid' : 'soft'"
                :label="n"
                :aria-pressed="genNegeri.includes(n)"
                :data-testid="`gen-negeri-${n}`"
                @click="toggleNegeri(n)"
              />
            </DsCluster>
          </DsStack>
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
            <DsText v-if="!genSubject" variant="caption" tone="muted" data-testid="gen-reason">{{ t.subjectRequired }}</DsText>
            <DsText v-else-if="poolState === 'none'" variant="caption" tone="muted" data-testid="gen-reason">{{ t.noBlueprint }}</DsText>
            <DsText v-else-if="poolState === 'ready' && !canGenerate && !countError && !genTitleError" variant="caption" tone="error" data-testid="gen-reason">
              {{ t.generateBlocked }}
            </DsText>
          </div>
        </form>

        <aside class="flex flex-col gap-2 rounded-lg bg-muted p-4" aria-labelledby="pool-title" data-testid="pool-aside">
          <h3 id="pool-title" class="text-subheading text-highlighted">{{ t.poolTitle }}</h3>
          <template v-if="pool">
            <p class="text-body" data-testid="pool-available">{{ pool.groupTotal ? `${t.poolAvailable(pool.eligibleTotal)} · ${t.poolGroups(pool.groupTotal)}` : t.poolAvailable(pool.eligibleTotal) }}</p>
            <p class="text-body text-muted">{{ t.poolRequested(requested) }}</p>
            <p v-if="pool.eligibleTotal === 0" class="text-caption text-error">{{ t.poolNoScheme }}</p>
            <p v-else-if="requested === pool.eligibleTotal" class="text-caption text-warning">{{ t.poolSame }}</p>
            <p v-if="poolShort" class="text-caption text-warning">{{ t.poolReduce }}</p>
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
      <DsLoadError v-if="sets.error.value" :message="t.loadError" :error="sets.error.value" @retry="sets.reload()" />
      <DsEmptyState v-else-if="sets.data.value && !sets.data.value.length" :title="t.listEmpty" icon="scroll" />
      <ul v-else class="flex flex-col gap-2" data-testid="sets-list">
        <li
          v-for="s in shownSets"
          :key="s.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted p-3"
          :data-testid="`set-${s.id}`"
        >
          <div class="flex min-w-0 flex-col">
            <span class="text-label text-highlighted break-words">{{ s.title }}</span>
            <span class="text-caption text-muted">{{ t.listLine(s.subjectName, s.kertas, s.questionCount, s.marks) }} · {{ formatDateTime(s.updatedAt) }}</span>
            <DsText variant="caption" tone="muted" :data-testid="`set-scope-${s.id}`">{{ t.levelField }}: {{ levelScopeLabel(s.levelScope) }}</DsText>
            <DsCluster v-if="s.origins?.length" gap="2xs" :data-testid="`set-origins-${s.id}`">
              <DsBadge v-for="o in s.origins.slice(0, 4)" :key="o.negeri" :label="`${o.negeri} ${o.count}`" />
              <DsBadge v-if="s.origins.length > 4" :label="t.moreOrigins(s.origins.length - 4)" />
            </DsCluster>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <DsStatusBadge :status="s.status === 'terbit' ? 'published' : 'draft'" />
            <UButton :to="builderPath(s.id)" icon="i-ph-pencil-simple" :label="t.open" class="min-h-11" :data-testid="`set-open-${s.id}`" />
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
            <UButton
              :to="{ name: KONTRAK_ROUTES.edit, params: { subjek: s.subject, kertas: String(s.kertas) } }"
              color="neutral"
              variant="ghost"
              :label="t.editContract"
              :data-testid="`set-contract-${s.id}`"
            />
            <UButton
              color="error"
              variant="ghost"
              :label="t.deleteSet"
              :data-testid="`set-delete-${s.id}`"
              @click="deleteSet(s.id, s.status)"
            />
          </div>
        </li>
      </ul>
      <DsCluster v-if="(sets.data.value?.length ?? 0) > shownCount" justify="center">
        <UButton color="neutral" variant="soft" :label="t.poolMore" data-testid="sets-more" @click="shownCount += PAGE_SIZE" />
      </DsCluster>
    </section>
  </DsPage>
</template>
