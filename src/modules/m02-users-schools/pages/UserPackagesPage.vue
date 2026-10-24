<script setup lang="ts">
/**
 * S16 `/admin/users/:id/packages` "Tetapkan Pakej SPM - {name}" (M02-T9; FR-M02-47..50, BR-13), v2 staff theme.
 *
 * Header card (school, "{type} · {state} · {district}", badges name / "Admin Sekolah" / code) and one
 * card per package (T4, T5) with its status badge ("Belum Ditetapkan", or "Ditetapkan" once assigned,
 * UNVERIFIED COPY) and a form: quota 1-2000 (DV-M02-07), "Tetapkan Pakej {code}". Success reloads the
 * data (badge and saved quota) and shows the API `status` as the flash.
 */
import { nextTick, reactive, ref, watch } from 'vue'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash, usePageMeta } from '@/composables'
import { DsBackLink, DsFormField, DsIconChip, DsLoadError, DsPage, DsPanel } from '@/ds'

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
const quotas = reactive<Record<string, number | string>>({ t4: '', t5: '' })
const placeholders: Record<string, string> = { t4: 'Cth: 150', t5: 'Cth: 120' }

watch(
  data,
  (value) => {
    if (!value) return
    pageMeta.setHeader({
      title: 'Tetapkan Pakej SPM',
      subtitle: `${value.user.name} — ${value.school?.name ?? ''}`,
    })
    pageMeta.setTitle(`Tetapkan Pakej SPM - ${value.user.name}`)
    for (const card of value.packages) {
      if (seeded.has(card.formLevel)) continue
      seeded.add(card.formLevel)
      quotas[card.formLevel] = card.assigned?.studentQuota ?? ''
    }
  },
  { immediate: true },
)

const alertBox = ref<HTMLElement | null>(null)
const saving = ref<string | null>(null)
const errors = ref<string[]>([])

async function assign(card: AdminPackageCard): Promise<void> {
  const quota = quotas[card.formLevel]
  if (saving.value !== null || quota === undefined || quota === '') return
  saving.value = card.formLevel
  errors.value = []
  try {
    const result = await assignUserPackage(props.id, {
      formLevel: card.formLevel,
      packageId: card.packageId,
      studentQuota: Number(quota),
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
</script>

<template>
  <DsPage data-testid="packages-page">
    <div
      v-if="error && !isNotFound(error)"
      class="flex flex-col gap-3"
      data-testid="packages-error"
    >
      <DsLoadError
        message="Tidak dapat memuatkan pakej pengguna. Sila cuba semula."
        @retry="reload()"
      />
      <DsBackLink to="/admin/users?role=school_admin" label="Kembali ke Senarai" />
    </div>

    <div v-else-if="!data" class="flex flex-col gap-4" data-testid="packages-skeleton">
      <USkeleton class="h-28 w-full" />
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <USkeleton class="h-56 w-full" />
        <USkeleton class="h-56 w-full" />
      </div>
    </div>

    <template v-else>
      <div ref="alertBox">
        <UAlert
          v-if="errors.length > 0"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          data-testid="packages-alert"
        >
          <template #description>
            <div class="flex flex-col gap-1">
              <p v-for="m in errors" :key="m">{{ m }}</p>
            </div>
          </template>
        </UAlert>
      </div>

      <DsPanel data-testid="packages-school">
        <div class="flex items-center gap-4">
          <DsIconChip icon="buildings" />
          <div class="flex min-w-0 flex-col gap-1">
            <h3
              class="text-heading break-words text-highlighted"
              data-testid="packages-school-name"
            >
              {{ data.school?.name }}
            </h3>
            <p v-if="data.school" class="text-label text-muted" data-testid="packages-school-meta">
              {{ schoolMeta(data.school) }}
            </p>
            <div class="flex flex-wrap gap-2">
              <UBadge color="neutral" variant="subtle" icon="i-ph-user" :label="data.user.name" />
              <UBadge
                color="neutral"
                variant="subtle"
                icon="i-ph-shield-check"
                label="Admin Sekolah"
              />
              <UBadge
                v-if="data.school"
                color="neutral"
                variant="subtle"
                icon="i-ph-barcode"
                :label="data.school.code"
              />
            </div>
          </div>
        </div>
      </DsPanel>

      <div class="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <DsPanel v-for="card in data.packages" :key="card.formLevel">
          <form
            method="post"
            class="flex flex-col gap-4"
            :data-testid="`package-card-${card.formLevel}`"
            @submit.prevent="assign(card)"
          >
            <div class="flex items-start gap-3">
              <UBadge :label="card.code" />
              <div class="min-w-0 flex-1">
                <h3 class="text-subheading text-highlighted">
                  {{ card.name.replace('SPM ', '') }}
                </h3>
                <p class="text-caption text-muted">{{ card.priceLabel }}</p>
              </div>
              <UBadge
                :color="card.assigned ? 'success' : 'neutral'"
                variant="subtle"
                :label="card.assigned ? 'Ditetapkan' : 'Belum Ditetapkan'"
                data-testid="package-status"
              />
            </div>

            <DsFormField
              native
              :for="`package-quota-${card.formLevel}`"
              :label="`Kuota Pelajar ${card.code}`"
            >
              <UInput
                :id="`package-quota-${card.formLevel}`"
                v-model="quotas[card.formLevel]"
                type="number"
                name="student_quota"
                required
                :min="QUOTA_MIN"
                :max="QUOTA_MAX"
                :placeholder="placeholders[card.formLevel]"
                class="w-full"
                data-testid="package-quota"
              />
              <p
                v-if="card.formLevel === 't5'"
                class="flex items-center gap-2 text-caption text-muted"
                data-testid="package-t5-count"
              >
                <UIcon name="i-ph-info" class="size-4" aria-hidden="true" />
                {{ data.existingT5Count }} pelajar T5 sedia ada dalam sistem
              </p>
            </DsFormField>

            <UButton
              type="submit"
              block
              icon="i-ph-plus-circle"
              :label="`Tetapkan Pakej ${card.code}`"
              :disabled="saving !== null"
              :loading="saving === card.formLevel"
              data-testid="package-submit"
            />
          </form>
        </DsPanel>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton
          to="/admin/users?role=school_admin"
          color="neutral"
          variant="ghost"
          icon="i-ph-arrow-left"
          label="Kembali ke Senarai"
          data-testid="packages-back"
        />
        <UButton
          :to="`/admin/users/${id}/edit`"
          color="neutral"
          variant="soft"
          icon="i-ph-pencil-simple"
          label="Edit Pengguna"
          data-testid="packages-edit"
        />
      </div>
    </template>
  </DsPage>
</template>
