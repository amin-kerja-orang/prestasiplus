<script setup lang="ts">
/**
 * S8 `/admin/comp-students/:id` "Pelajar Komplimen - {name}" (M02-T7; FR-M02-74, 75), v2 staff theme.
 *
 * Back button, the profile card (label/value grid with status badges), the two toggle buttons (no
 * confirmation; INFERRED labels "Matikan syiling" / "Aktifkan akaun" for the opposite state) and the
 * card "Kelas didaftar ({n})". Each toggle reloads the page data and shows the API `status` as the success
 * flash (UNVERIFIED COPY). The wallet reads 0 / 0 until M14 registers its source (SRS §6.15).
 */
import { computed, ref, watch } from 'vue'

import { setRouteOutcome } from '@/app/router'
import { isApiError } from '@/api'
import { AdminCard, AdminIdentity, AdminPageHeader } from '@/ds/admin'
import { useApi, useFlash, usePageMeta } from '@/composables'
import { DsPage } from '@/ds'

import { fetchCompStudent, toggleCompActive, toggleCompCoins } from '../api/comp-students'
import AdminAlert from '../components/AdminAlert.vue'
import { accountColor, COMP_LIST_PATH, coinsColor } from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import { formatUserDate, initialsOf } from '../lib/user-list'
import AdminCell from '../components/native/AdminCell.vue'
import AdminRow from '../components/native/AdminRow.vue'
import AdminTable from '../components/native/AdminTable.vue'

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

const CLASS_COLUMNS = [
  { key: 'class', label: 'Kelas' },
  { key: 'subject', label: 'Subjek' },
  { key: 'teacher', label: 'Cikgu' },
  { key: 'status', label: 'Status' },
]
</script>

<template>
  <DsPage data-testid="comp-detail-page">
    <AdminPageHeader title="Pelajar Komplimen" subtitle="Detail pelajar komplimen">
      <template #actions>
        <UButton
          :to="COMP_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-left"
          label="Senarai pelajar komplimen"
          data-testid="comp-back"
        />
      </template>
    </AdminPageHeader>

    <div v-if="error && !notFound" class="flex flex-col gap-4" data-testid="comp-load-error">
      <AdminAlert :messages="errorLines(error)" />
      <div>
        <UButton label="Cuba Lagi" data-testid="comp-retry" @click="reload()" />
      </div>
    </div>

    <div v-else-if="!student && !notFound" class="flex flex-col gap-6" data-testid="comp-skeleton">
      <USkeleton class="h-64 w-full" />
      <USkeleton class="h-40 w-full" />
    </div>

    <template v-else-if="student">
      <AdminCard class="flex flex-col gap-6" data-testid="comp-card">
        <AdminIdentity
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
              <UBadge
                :color="accountColor(student.isActive)"
                variant="subtle"
                size="lg"
                :label="student.isActive ? 'AKTIF' : 'TIDAK AKTIF'"
              />
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
      </AdminCard>

      <AdminTable :columns="CLASS_COLUMNS" caption="Kelas didaftar" data-testid="comp-classes">
        <template #header>
          <h3
            class="flex items-center gap-2 p-4 text-subheading text-highlighted"
            data-testid="comp-classes-title"
          >
            <UIcon name="i-ph-presentation-chart" class="size-5 text-muted" aria-hidden="true" />
            Kelas didaftar ({{ student.classes.length }})
          </h3>
        </template>
        <AdminRow v-for="(c, i) in student.classes" :key="i" data-testid="comp-class-row">
          <AdminCell label="Kelas">
            <span class="text-body text-highlighted"
              >{{ c.name }} <span class="text-label text-muted">{{ c.classCode }}</span></span
            >
          </AdminCell>
          <AdminCell label="Subjek">{{ c.subjectName ?? '—' }}</AdminCell>
          <AdminCell label="Cikgu">{{ c.teacherName }}</AdminCell>
          <AdminCell label="Status">
            <UBadge
              :color="c.status === 'active' ? 'success' : 'neutral'"
              variant="subtle"
              class=""
              :label="c.status"
              data-testid="comp-class-status"
            />
          </AdminCell>
        </AdminRow>
      </AdminTable>
    </template>
  </DsPage>
</template>
