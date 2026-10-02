<script setup lang="ts">
/**
 * S8 `/admin/comp-students/:id` "Pelajar Komplimen - {name}" (M02-T7; FR-M02-74, 75).
 *
 * Back link, the label/value card (2 columns), the two toggle buttons (no confirmation; INFERRED labels
 * "Matikan syiling" / "Aktifkan akaun" for the opposite state) and the card "Kelas didaftar ({n})". Each
 * toggle reloads the page data and shows the API `status` as the success flash (UNVERIFIED COPY). The wallet
 * reads 0 / 0 until M14 registers its source (SRS §6.15).
 */
import { ArrowLeft, Presentation } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { setRouteOutcome } from '@/app/router'
import { isApiError } from '@/api'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi, useFlash, usePageMeta } from '@/composables'

import { fetchCompStudent, toggleCompActive, toggleCompCoins } from '../api/comp-students'
import { accountClass, COMP_LIST_PATH } from '../lib/comp-students'
import { errorLines } from '../lib/user-form-errors'
import { formatUserDate } from '../lib/user-list'

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

const LABEL = 'text-xs font-semibold tracking-wide text-slate-500 uppercase'
const VALUE = 'mt-0.5 min-w-0 text-sm break-words text-slate-800'
const ACTION =
  'inline-flex min-h-11 items-center justify-center rounded-lg border bg-white px-3 py-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60'
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-4" data-testid="comp-detail-page">
    <RouterLink
      :to="COMP_LIST_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
      data-testid="comp-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Senarai pelajar komplimen
    </RouterLink>

    <div v-if="error && !notFound" class="space-y-3" data-testid="comp-load-error">
      <AlertBox :messages="errorLines(error)" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white"
        data-testid="comp-retry"
        @click="reload()"
      >
        Cuba Lagi
      </button>
    </div>

    <div v-else-if="!student && !notFound" class="space-y-4" data-testid="comp-skeleton">
      <div class="h-64 animate-pulse rounded-2xl bg-white shadow"></div>
      <div class="h-40 animate-pulse rounded-2xl bg-white shadow"></div>
    </div>

    <template v-else-if="student">
      <section class="rounded-2xl bg-white p-5 shadow sm:p-6" data-testid="comp-card">
        <dl class="grid grid-cols-2 gap-x-6 gap-y-4">
          <div class="min-w-0">
            <dt :class="LABEL">Username</dt>
            <dd :class="[VALUE, 'font-mono text-xs break-all']" data-testid="comp-username">
              {{ student.username }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">No. KP</dt>
            <dd :class="VALUE" data-testid="comp-ic">{{ student.icNumber ?? '—' }}</dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">Sekolah asal</dt>
            <dd :class="VALUE" data-testid="comp-school">
              {{ student.originalSchoolName ?? '—' }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">Tingkatan</dt>
            <dd :class="VALUE" data-testid="comp-level">{{ student.classLevel ?? '—' }}</dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">Status akaun</dt>
            <dd
              :class="[VALUE, 'font-bold', accountClass(student.isActive)]"
              data-testid="comp-status"
            >
              {{ student.isActive ? 'AKTIF' : 'TIDAK AKTIF' }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">Syiling</dt>
            <dd
              :class="[
                VALUE,
                'font-bold',
                student.coinsEnabled ? 'text-amber-700' : 'text-rose-600',
              ]"
              data-testid="comp-coins"
            >
              {{ student.coinsEnabled ? 'ON' : 'OFF (tak boleh kumpul/claim)' }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">Pakej tamat</dt>
            <dd :class="VALUE" data-testid="comp-expiry">
              {{ formatUserDate(student.packageExpiresAt) }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt :class="LABEL">Baki syiling / coins</dt>
            <dd :class="VALUE" data-testid="comp-balance">
              {{ student.syilingBalance }} syiling · {{ student.coinBalance }} coins
            </dd>
          </div>
        </dl>

        <div class="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <form method="post" @submit.prevent="run('coins')">
            <button
              type="submit"
              :disabled="busy !== null"
              :class="[ACTION, 'border-emerald-300 text-emerald-700 hover:bg-emerald-50']"
              data-testid="comp-toggle-coins"
            >
              {{ student.coinsEnabled ? 'Matikan syiling' : 'Hidupkan syiling' }}
            </button>
          </form>
          <form method="post" @submit.prevent="run('active')">
            <button
              type="submit"
              :disabled="busy !== null"
              :class="[ACTION, 'border-slate-300 text-slate-700 hover:bg-slate-50']"
              data-testid="comp-toggle-active"
            >
              {{ student.isActive ? 'Nyahaktif akaun' : 'Aktifkan akaun' }}
            </button>
          </form>
        </div>
      </section>

      <DataTableCard :min-width="480">
        <template #header>
          <h3
            class="flex items-center gap-2 px-4 py-4 text-sm font-bold text-slate-800 sm:px-5"
            data-testid="comp-classes-title"
          >
            <Presentation class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Kelas didaftar ({{ student.classes.length }})
          </h3>
        </template>
        <table :class="T.table" data-testid="comp-classes">
          <thead class="bg-slate-50">
            <tr>
              <th scope="col" :class="T.th">Kelas</th>
              <th scope="col" :class="T.th">Subjek</th>
              <th scope="col" :class="T.th">Cikgu</th>
              <th scope="col" :class="T.th">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, i) in student.classes"
              :key="i"
              :class="T.row"
              data-testid="comp-class-row"
            >
              <td :class="T.td">
                {{ c.name }} <span class="text-xs text-slate-400">{{ c.classCode }}</span>
              </td>
              <td :class="T.td">{{ c.subjectName ?? '—' }}</td>
              <td :class="T.td">{{ c.teacherName }}</td>
              <td
                :class="[
                  T.td,
                  'text-xs font-semibold uppercase',
                  c.status === 'active' ? 'text-emerald-700' : 'text-slate-500',
                ]"
              >
                {{ c.status }}
              </td>
            </tr>
          </tbody>
        </table>
      </DataTableCard>
    </template>
  </div>
</template>
