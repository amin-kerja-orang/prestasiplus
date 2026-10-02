<script setup lang="ts">
/**
 * S6 `/admin/subjects` "Pengurusan Subjek - Admin PRESTASIPLUS" (M03-T2; FR-M03-39..46, FR-98).
 *
 * - Heading "Senarai Subjek", "Jumlah: {n} subjek" and "Tambah"; every subject in one table (no
 *   paging, search or filter; order from the API, BR-08).
 * - Icon tile (BR-05), level line under the name, colour swatch (hex hidden below `sm`), Teras /
 *   Elektif, "Soalan" (number only below `sm`).
 * - The "Aktif?" switch flips at once, PATCHes, and reverts with a native alert on failure
 *   (DV-M03-07). No confirm, no success message.
 * - Delete: native confirm, DELETE, reload with the success flash.
 * - The table fits its card from 1280 and scrolls inside the card below (DV-M03-03).
 */
import { GraduationCap, Plus, SquarePen, Star, Trash } from '@lucide/vue'
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { alertNative, confirmNative, useApi, useFlash } from '@/composables'

import {
  deleteSubject,
  fetchAdminSubjects,
  setSubjectActive,
  type AdminSubjectListItem,
} from '../api/admin-subjects-levels'
import ActiveSwitch from '../components/subjects-levels/ActiveSwitch.vue'
import SubjectIconTile from '../components/subjects-levels/SubjectIconTile.vue'
import {
  ACCENT_BUTTON_CLASS,
  COPY,
  iconButtonClass,
  SUBJECT_ROUTES,
  errorLines,
  isNetworkFailure,
} from '../lib/subjects-levels'

const flash = useFlash()

const { data, error, reload } = useApi((signal) => fetchAdminSubjects({ signal }))

/** Local copy so the switch can flip before the server answers. */
const rows = ref<AdminSubjectListItem[]>([])
watch(data, (result) => {
  rows.value = result ? result.data.map((row) => ({ ...row })) : []
})

const COLUMNS = [
  '#',
  'Ikon',
  'Nama (BM)',
  'Nama (EN)',
  'Kod',
  'Warna',
  'Teras?',
  'Soalan',
  'Aktif?',
  'Tindakan',
] as const

/** Rows whose PATCH is in flight: further clicks on them are ignored (no race). */
const switching = new Set<number>()

async function toggle(row: AdminSubjectListItem): Promise<void> {
  if (switching.has(row.id)) return
  switching.add(row.id)
  const next = !row.isActive
  row.isActive = next
  try {
    await setSubjectActive(row.id, next)
  } catch (err) {
    row.isActive = !next
    alertNative(isNetworkFailure(err) ? COPY.networkError : COPY.switchFailed)
  } finally {
    switching.delete(row.id)
  }
}

const deleting = ref(false)

async function remove(row: AdminSubjectListItem): Promise<void> {
  if (!confirmNative(COPY.confirmDeleteSubject)) return
  if (deleting.value) return
  deleting.value = true
  try {
    const result = await deleteSubject(row.id)
    await reload()
    flash.show({ type: 'success', message: result.status })
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="space-y-4" data-testid="subjects-page">
    <AlertBox v-if="error" :messages="COPY.loadFailed" data-testid="subjects-error" />

    <DataTableCard v-else-if="data" :min-width="860">
      <template #header>
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div>
            <h2 class="font-heading text-lg font-bold text-slate-800">Senarai Subjek</h2>
            <p class="text-sm text-slate-500" data-testid="subjects-count">
              Jumlah: {{ rows.length }} subjek
            </p>
          </div>
          <RouterLink
            :to="{ name: SUBJECT_ROUTES.create }"
            :class="[
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition focus:outline-none',
              ACCENT_BUTTON_CLASS.indigo,
            ]"
            data-testid="subjects-add"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            Tambah
          </RouterLink>
        </div>
      </template>

      <table :class="T.table" data-testid="subjects-table">
        <thead>
          <tr>
            <th
              v-for="label in COLUMNS"
              :key="label"
              scope="col"
              :class="[T.th, 'px-3!']"
              data-testid="subjects-th"
            >
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="[T.row, 'align-middle']"
            data-testid="subject-row"
            :data-subject-id="row.id"
          >
            <td :class="[T.td, 'px-3! text-xs text-slate-500']">{{ row.id }}</td>
            <td :class="[T.td, 'px-3!']">
              <SubjectIconTile :icon="row.icon" :color="row.color" />
            </td>
            <td :class="[T.td, 'px-3! text-xs']">
              <div class="font-semibold text-slate-800">{{ row.name }}</div>
              <div
                v-if="row.levels.length > 0"
                class="mt-1 flex items-start gap-1.5 text-xs text-slate-500"
                data-testid="subject-levels"
              >
                <GraduationCap class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{{ row.levels.map((level) => level.name).join(', ') }}</span>
              </div>
            </td>
            <td :class="[T.td, 'px-3! text-xs']">{{ row.nameEn }}</td>
            <td :class="[T.td, 'px-3!']">
              <span
                class="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-slate-600"
                data-testid="subject-code"
                >{{ row.code }}</span
              >
            </td>
            <td :class="[T.td, 'px-3!']">
              <span class="inline-flex items-center gap-2" data-testid="subject-color">
                <span
                  class="inline-block h-5 w-5 shrink-0 rounded-full border border-slate-200"
                  :style="{ backgroundColor: row.color }"
                ></span>
                <span
                  class="hidden font-mono text-xs text-slate-500 sm:inline"
                  data-testid="subject-color-hex"
                  >{{ row.color }}</span
                >
              </span>
            </td>
            <td :class="[T.td, 'px-3!']">
              <span
                v-if="row.isCore"
                class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700"
                data-testid="subject-core"
              >
                <Star class="h-3 w-3" aria-hidden="true" />Teras
              </span>
              <span
                v-else
                class="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-600"
                data-testid="subject-core"
                >Elektif</span
              >
            </td>
            <td :class="[T.td, 'px-3!']">
              <span
                class="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-amber-700"
                data-testid="subject-questions"
                >{{ row.questionCount }}<span class="hidden sm:inline">{{ ' soalan' }}</span></span
              >
            </td>
            <td :class="[T.td, 'px-3!']">
              <ActiveSwitch
                :active="row.isActive"
                accent="indigo"
                data-testid="subject-switch"
                @toggle="toggle(row)"
              />
            </td>
            <td :class="[T.td, 'px-3!']">
              <div class="flex items-center gap-1.5">
                <RouterLink
                  :to="{ name: SUBJECT_ROUTES.edit, params: { id: row.id } }"
                  title="Edit"
                  :class="[
                    iconButtonClass('indigo'),
                    'bg-slate-100 text-slate-500 hover:bg-slate-200',
                  ]"
                  data-testid="subject-edit"
                >
                  <SquarePen class="h-4 w-4" aria-hidden="true" />
                </RouterLink>
                <button
                  type="button"
                  title="Padam"
                  :disabled="deleting"
                  :class="[
                    iconButtonClass('indigo'),
                    'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60',
                  ]"
                  data-testid="subject-delete"
                  @click="remove(row)"
                >
                  <Trash class="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </DataTableCard>
  </div>
</template>
