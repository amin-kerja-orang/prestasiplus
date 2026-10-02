<script setup lang="ts">
/**
 * S16 `/admin/users/:id/packages` "Assign Pakej SPM - {name}" (M02-T9; FR-M02-47..50, BR-13).
 *
 * Header card (school, "{type} · {state} · {district}", badges name / "Admin Sekolah" / code) and one
 * card per package (T4, T5) with its status badge ("Belum Ditetapkan", or "Ditetapkan" once assigned,
 * UNVERIFIED COPY) and a form: quota 1-2000 (DV-M02-07), "Tetapkan Pakej {code}". Success reloads the
 * data (badge and saved quota) and shows the API `status` as the flash.
 */
import {
  ArrowLeft,
  Barcode,
  CirclePlus,
  Info,
  Pencil,
  School,
  Shield,
  User,
  Users,
} from '@lucide/vue'
import { nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi, useFlash, usePageMeta } from '@/composables'

import { assignUserPackage, fetchUserPackages, type AdminPackageCard } from '../api/users'
import { schoolMeta } from '../lib/user-form-options'
import { errorLines } from '../lib/school-errors'
import { isNotFound, QUOTA_MAX, QUOTA_MIN } from '../lib/subscription-options'

const props = defineProps<{ id: number }>()

const flash = useFlash()
const pageMeta = usePageMeta()

const { data, error, reload } = useApi(
  (signal) => fetchUserPackages(props.id, { signal }),
  () => props.id,
)

watch(
  () => isNotFound(error.value),
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

/** Quota fields are seeded once per card; a reload after one save keeps an unsaved value in the other. */
const seeded = new Set<string>()
const quotas = reactive<Record<string, number | null>>({ t4: null, t5: null })
const placeholders: Record<string, string> = { t4: 'Cth: 150', t5: 'Cth: 120' }
const gradients: Record<string, { tile: string; button: string }> = {
  t4: { tile: 'from-blue-500 to-indigo-600', button: 'from-blue-500 to-indigo-600' },
  t5: { tile: 'from-purple-500 to-fuchsia-600', button: 'from-purple-500 to-fuchsia-600' },
}

watch(
  data,
  (value) => {
    if (!value) return
    pageMeta.setHeader({
      title: 'Assign Pakej SPM',
      subtitle: `${value.user.name} — ${value.school?.name ?? ''}`,
    })
    pageMeta.setTitle(`Assign Pakej SPM - ${value.user.name}`)
    for (const card of value.packages) {
      if (seeded.has(card.formLevel)) continue
      seeded.add(card.formLevel)
      quotas[card.formLevel] = card.assigned?.studentQuota ?? null
    }
  },
  { immediate: true },
)

const alertBox = ref<HTMLElement | null>(null)
const saving = ref<string | null>(null)
const errors = ref<string[]>([])

async function assign(card: AdminPackageCard): Promise<void> {
  const quota = quotas[card.formLevel]
  if (saving.value !== null || quota === null || quota === undefined) return
  saving.value = card.formLevel
  errors.value = []
  try {
    const result = await assignUserPackage(props.id, {
      formLevel: card.formLevel,
      packageId: card.packageId,
      studentQuota: quota,
    })
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    errors.value = errorLines(err)
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = null
  }
}

const LINK =
  'inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="space-y-4 sm:space-y-6" data-testid="packages-page">
    <div v-if="error && !isNotFound(error)" class="space-y-3" data-testid="packages-error">
      <AlertBox :messages="errorLines(error)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white"
        @click="reload()"
      >
        Cuba Lagi
      </button>
      <RouterLink
        to="/admin/users?role=school_admin"
        class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali ke Senarai
      </RouterLink>
    </div>

    <div v-else-if="!data" class="space-y-4" data-testid="packages-skeleton">
      <div class="h-28 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div class="h-56 animate-pulse rounded-2xl bg-white shadow"></div>
        <div class="h-56 animate-pulse rounded-2xl bg-white shadow"></div>
      </div>
    </div>

    <template v-else>
      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" data-testid="packages-alert" />
      </div>

      <section
        class="flex items-center gap-4 rounded-2xl border-2 border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 shadow-sm sm:p-5"
        data-testid="packages-school"
      >
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white"
        >
          <School class="h-6 w-6" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h3
            class="font-heading text-lg font-bold break-words text-slate-900"
            data-testid="packages-school-name"
          >
            {{ data.school?.name }}
          </h3>
          <p v-if="data.school" class="text-sm text-slate-600" data-testid="packages-school-meta">
            {{ schoolMeta(data.school) }}
          </p>
          <div class="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            <span
              class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-blue-700"
            >
              <User class="h-3 w-3" aria-hidden="true" />{{ data.user.name }}
            </span>
            <span
              class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700"
            >
              <Shield class="h-3 w-3" aria-hidden="true" />Admin Sekolah
            </span>
            <span
              v-if="data.school"
              class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"
            >
              <Barcode class="h-3 w-3" aria-hidden="true" />{{ data.school.code }}
            </span>
          </div>
        </div>
      </section>

      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <form
          v-for="card in data.packages"
          :key="card.formLevel"
          method="post"
          class="space-y-4 rounded-2xl bg-white p-5 shadow"
          :data-testid="`package-card-${card.formLevel}`"
          @submit.prevent="assign(card)"
        >
          <div class="flex items-start gap-3">
            <span
              :class="[
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br font-heading font-bold text-white',
                gradients[card.formLevel]?.tile,
              ]"
              >{{ card.code }}</span
            >
            <div class="min-w-0 flex-1">
              <h3 class="font-heading font-bold text-slate-900">
                {{ card.name.replace('SPM ', '') }}
              </h3>
              <p class="text-xs text-slate-500">{{ card.priceLabel }}</p>
            </div>
            <span
              :class="[
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                card.assigned ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500',
              ]"
              data-testid="package-status"
              >{{ card.assigned ? 'Ditetapkan' : 'Belum Ditetapkan' }}</span
            >
          </div>

          <div>
            <label
              :for="`package-quota-${card.formLevel}`"
              class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700"
            >
              <Users class="h-4 w-4 text-indigo-400" aria-hidden="true" />
              Kuota Pelajar {{ card.code }}
            </label>
            <input
              :id="`package-quota-${card.formLevel}`"
              v-model.number="quotas[card.formLevel]"
              type="number"
              name="student_quota"
              required
              :min="QUOTA_MIN"
              :max="QUOTA_MAX"
              :placeholder="placeholders[card.formLevel]"
              :class="[FORM_INPUT_CLASS, 'min-h-11']"
              data-testid="package-quota"
            />
            <p
              v-if="card.formLevel === 't5'"
              class="mt-2 flex items-center gap-1.5 text-xs text-slate-500"
              data-testid="package-t5-count"
            >
              <Info class="h-3.5 w-3.5 text-purple-400" aria-hidden="true" />
              {{ data.existingT5Count }} pelajar T5 sedia ada dalam sistem
            </p>
          </div>

          <button
            type="submit"
            :disabled="saving !== null"
            :class="[
              'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-5 py-3 text-sm font-bold text-white shadow transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60',
              gradients[card.formLevel]?.button,
            ]"
            data-testid="package-submit"
          >
            <CirclePlus class="h-4 w-4" aria-hidden="true" />
            Tetapkan Pakej {{ card.code }}
          </button>
        </form>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <RouterLink
          to="/admin/users?role=school_admin"
          :class="[LINK, 'text-slate-500 hover:text-slate-700']"
          data-testid="packages-back"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Kembali ke Senarai
        </RouterLink>
        <RouterLink
          :to="`/admin/users/${id}/edit`"
          :class="[LINK, 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100']"
          data-testid="packages-edit"
        >
          <Pencil class="h-4 w-4" aria-hidden="true" />
          Edit Pengguna
        </RouterLink>
      </div>
    </template>
  </div>
</template>
