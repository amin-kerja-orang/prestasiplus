<script setup lang="ts">
/**
 * S8 `/admin/comp-students/:id` "Pelajar Komplimen - {name}" (M02-T7; FR-M02-74, 75), v2 staff theme.
 *
 * Back button, the profile card (label/value grid with status badges), the two toggle buttons (no
 * confirmation; INFERRED labels "Matikan syiling" / "Aktifkan akaun" for the opposite state) and the
 * card "Kelas didaftar ({n})". Each toggle reloads the page data and shows the API `status` as the success
 * flash (UNVERIFIED COPY). The wallet reads 0 / 0 until M14 registers its source (SRS §6.15).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'

import { setRouteOutcome } from '@/app/router'
import { isApiError } from '@/api'
import { useApi, useFlash, usePageMeta } from '@/composables'
import { DsDataTable, DsIdentity, DsLoadError, DsPage, DsPanel, DsStatusBadge } from '@/ds'

import {
  fetchCompStudent,
  toggleCompActive,
  toggleCompCoins,
  type CompStudentClass,
} from '../api/comp-students'
import { COMP_LIST_PATH, coinsColor } from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import { formatUserDate, initialsOf } from '../lib/user-list'

const props = defineProps<{ id: number }>()

const flash = useFlash()
const pageMeta = usePageMeta()

const {
  data: student,
  error,
  reload,
} = useApi(
  (signal) => fetchCompStudent(props.id, { signal }),
  () => props.id,
)

/** An unknown id is the standard 404 page, as live (module decision); other load failures keep the red box. */
const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

watch(
  student,
  (row) => {
    if (!row) return
    pageMeta.setHeader({ title: row.name, subtitle: 'Detail pelajar komplimen' })
    pageMeta.setTitle(`Pelajar Komplimen - ${row.name}`)
  },
  { immediate: true },
)

const busy = ref<'coins' | 'active' | null>(null)

async function run(kind: 'coins' | 'active'): Promise<void> {
  if (busy.value !== null) return
  busy.value = kind
  try {
    const result = await (kind === 'coins' ? toggleCompCoins(props.id) : toggleCompActive(props.id))
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    busy.value = null
  }
}

type ClassRow = CompStudentClass & Record<string, unknown>
const CLASS_COLUMNS: TableColumn<ClassRow>[] = [
  { id: 'class', header: 'Kelas' },
  { id: 'subject', header: 'Subjek' },
  { accessorKey: 'teacherName', header: 'Cikgu' },
  { id: 'status', header: 'Status' },
]
const classRows = computed(() => (student.value?.classes ?? []) as ClassRow[])
</script>

<template>
  <DsPage
    title="Pelajar Komplimen"
    subtitle="Detail pelajar komplimen"
    :back-to="COMP_LIST_PATH"
    back-label="Senarai pelajar komplimen"
    data-testid="comp-detail-page"
  >
    <DsLoadError
      v-if="error && !notFound"
      message="Tidak dapat memuatkan pelajar komplimen. Sila cuba semula."
      testid="comp-load-error"
      @retry="reload()"
    />

    <div v-else-if="!student && !notFound" class="flex flex-col gap-6" data-testid="comp-skeleton">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else-if="student">
      <DsPanel padding="none" data-testid="comp-card">
        <div class="flex flex-col gap-6 p-4 sm:p-6">
          <DsIdentity
            :name="student.name"
            :sub="student.username"
            :initials="initialsOf(student.name)"
          />

          <dl class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            <div class="min-w-0">
              <dt class="text-label text-muted">Username</dt>
              <dd
                class="mt-1 min-w-0 text-body break-all text-highlighted"
                data-testid="comp-username"
              >
                {{ student.username }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">No. KP</dt>
              <dd class="mt-1 min-w-0 text-body break-words text-highlighted" data-testid="comp-ic">
                {{ student.icNumber ?? '—' }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">Sekolah asal</dt>
              <dd
                class="mt-1 min-w-0 text-body break-words text-highlighted"
                data-testid="comp-school"
              >
                {{ student.originalSchoolName ?? '—' }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">Tingkatan</dt>
              <dd
                class="mt-1 min-w-0 text-body break-words text-highlighted"
                data-testid="comp-level"
              >
                {{ student.classLevel ?? '—' }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">Status akaun</dt>
              <dd class="mt-1" data-testid="comp-status">
                <DsStatusBadge :status="student.isActive ? 'active' : 'inactive'" />
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">Syiling</dt>
              <dd class="mt-1" data-testid="comp-coins">
                <UBadge
                  :color="coinsColor(student.coinsEnabled)"
                  variant="subtle"
                  size="lg"
                  :label="student.coinsEnabled ? 'ON' : 'OFF (tak boleh kumpul/claim)'"
                />
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">Pakej tamat</dt>
              <dd class="mt-1 min-w-0 text-body text-highlighted" data-testid="comp-expiry">
                {{ formatUserDate(student.packageExpiresAt) }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="text-label text-muted">Baki syiling / coins</dt>
              <dd class="mt-1 min-w-0 text-body text-highlighted" data-testid="comp-balance">
                {{ student.syilingBalance }} syiling · {{ student.coinBalance }} coins
              </dd>
            </div>
          </dl>

          <div class="flex flex-wrap gap-3">
            <form method="post" @submit.prevent="run('coins')">
              <UButton
                type="submit"
                color="neutral"
                variant="soft"
                icon="i-ph-coins"
                :label="student.coinsEnabled ? 'Matikan syiling' : 'Hidupkan syiling'"
                :loading="busy === 'coins'"
                :disabled="busy !== null"
                data-testid="comp-toggle-coins"
              />
            </form>
            <form method="post" @submit.prevent="run('active')">
              <UButton
                type="submit"
                color="neutral"
                variant="soft"
                :icon="student.isActive ? 'i-ph-user-minus' : 'i-ph-user-check'"
                :label="student.isActive ? 'Nyahaktif akaun' : 'Aktifkan akaun'"
                :loading="busy === 'active'"
                :disabled="busy !== null"
                data-testid="comp-toggle-active"
              />
            </form>
          </div>
        </div>
      </DsPanel>

      <DsPanel padding="none">
        <h3
          class="flex items-center gap-2 p-4 text-subheading text-highlighted"
          data-testid="comp-classes-title"
        >
          <UIcon name="i-ph-presentation-chart" class="size-5 text-muted" aria-hidden="true" />
          Kelas didaftar ({{ student.classes.length }})
        </h3>
        <DsDataTable
          :data="classRows"
          :columns="CLASS_COLUMNS"
          variant="flush"
          caption="Kelas didaftar"
          :page-size="Math.max(classRows.length, 1)"
          data-testid="comp-classes"
        >
          <template #class-cell="{ row }">
            <span class="text-body text-highlighted" data-testid="comp-class-row"
              >{{ row.original.name }}
              <span class="text-label text-muted">{{ row.original.classCode }}</span></span
            >
          </template>
          <template #subject-cell="{ row }">{{ row.original.subjectName ?? '—' }}</template>
          <template #status-cell="{ row }">
            <DsStatusBadge
              :status="row.original.status === 'active' ? 'active' : 'inactive'"
              data-testid="comp-class-status"
            />
          </template>
          <template #card="{ row }">
            <p class="text-body text-highlighted" data-testid="comp-class-row">
              {{ row.name }} <span class="text-label text-muted">{{ row.classCode }}</span>
            </p>
            <p class="text-label text-muted">
              {{ row.subjectName ?? '—' }} · {{ row.teacherName }}
            </p>
            <DsStatusBadge
              class="w-fit"
              :status="row.status === 'active' ? 'active' : 'inactive'"
            />
          </template>
        </DsDataTable>
      </DsPanel>
    </template>
  </DsPage>
</template>
