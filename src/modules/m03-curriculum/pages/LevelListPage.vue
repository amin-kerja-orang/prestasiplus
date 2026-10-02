<script setup lang="ts">
/**
 * S9 `/admin/education-levels` "Pengurusan Tahap Pendidikan - Admin PRESTASIPLUS" (M03-T2;
 * FR-M03-57..62, FR-98).
 *
 * - Heading "Senarai Tahap Pendidikan", "Jumlah: {n} tahap" and the pink "Tambah Tahap" button.
 * - Table with fixed cell sizes (`text-xs`, `px-4 py-3`) at every width: stage badge, "Soalan" and
 *   "Subjek" counts, the "Aktif?" switch (same failure handling as S6) and edit / delete actions.
 * - The table fits its card from 1280 and scrolls inside the card below (FR-46).
 */
import { Baby, BookOpenText, GraduationCap, Plus, SquarePen, Trash } from '@lucide/vue'
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { alertNative, confirmNative, useApi, useFlash } from '@/composables'

import {
  deleteLevel,
  fetchAdminLevels,
  setLevelActive,
  type AdminEducationLevelListItem,
} from '../api/admin-subjects-levels'
import ActiveSwitch from '../components/subjects-levels/ActiveSwitch.vue'
import {
  ACCENT_BUTTON_CLASS,
  COPY,
  iconButtonClass,
  LEVEL_ROUTES,
  STAGE_BADGE_CLASS,
  STAGE_LABELS,
  errorLines,
  isNetworkFailure,
} from '../lib/subjects-levels'

const flash = useFlash()

const { data, error, reload } = useApi((signal) => fetchAdminLevels({ signal }))

/** Local copy so the switch can flip before the server answers. */
const rows = ref<AdminEducationLevelListItem[]>([])
watch(data, (result) => {
  rows.value = result ? result.data.map((row) => ({ ...row })) : []
})

const COLUMNS = [
  '#',
  'Nama (BM)',
  'Nama (EN)',
  'Kod',
  'Peringkat',
  'Kurikulum',
  'Soalan',
  'Subjek',
  'Aktif?',
  'Tindakan',
] as const

const STAGE_ICON = {
  primary: Baby,
  lower_secondary: BookOpenText,
  upper_secondary: GraduationCap,
} as const

/** Rows whose PATCH is in flight: further clicks on them are ignored (no race). */
const switching = new Set<number>()

async function toggle(row: AdminEducationLevelListItem): Promise<void> {
  if (switching.has(row.id)) return
  switching.add(row.id)
  const next = !row.isActive
  row.isActive = next
  try {
    await setLevelActive(row.id, next)
  } catch (err) {
    row.isActive = !next
    alertNative(isNetworkFailure(err) ? COPY.networkError : COPY.switchFailed)
  } finally {
    switching.delete(row.id)
  }
}

const deleting = ref(false)

async function remove(row: AdminEducationLevelListItem): Promise<void> {
  if (!confirmNative(COPY.confirmDeleteLevel)) return
  if (deleting.value) return
  deleting.value = true
  try {
    const result = await deleteLevel(row.id)
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
  <div class="space-y-4" data-testid="levels-page">
    <AlertBox v-if="error" :messages="COPY.loadFailed" data-testid="levels-error" />

    <DataTableCard v-else-if="data" :min-width="860">
      <template #header>
        <div
          class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4"
        >
          <div>
            <h2 class="font-heading text-lg font-bold text-slate-800">Senarai Tahap Pendidikan</h2>
            <p class="text-sm text-slate-500" data-testid="levels-count">
              Jumlah: {{ rows.length }} tahap
            </p>
          </div>
          <RouterLink
            :to="{ name: LEVEL_ROUTES.create }"
            :class="[
              'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition focus:outline-none',
              ACCENT_BUTTON_CLASS.pink,
            ]"
            data-testid="levels-add"
          >
            <Plus class="h-4 w-4" aria-hidden="true" />
            Tambah Tahap
          </RouterLink>
        </div>
      </template>

      <table :class="T.table" data-testid="levels-table">
        <thead>
          <tr>
            <th v-for="label in COLUMNS" :key="label" scope="col" :class="[T.th, 'px-3!']">
              {{ label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.id"
            :class="[T.row, 'align-middle text-xs']"
            data-testid="level-row"
            :data-level-id="row.id"
          >
            <td :class="[T.td, 'px-3! text-xs! text-slate-500!']">{{ row.id }}</td>
            <td :class="[T.td, 'px-3! text-xs! font-semibold text-slate-800!']">{{ row.name }}</td>
            <td :class="[T.td, 'px-3! text-xs!']">{{ row.nameEn }}</td>
            <td :class="[T.td, 'px-3! text-xs!']">
              <span
                class="inline-block rounded bg-slate-100 px-2 py-0.5 font-mono text-xs whitespace-nowrap text-slate-600"
                >{{ row.code }}</span
              >
            </td>
            <td :class="[T.td, 'px-3! text-xs!']">
              <span
                :class="[
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
                  STAGE_BADGE_CLASS[row.stage],
                ]"
                data-testid="level-stage"
              >
                <component :is="STAGE_ICON[row.stage]" class="h-3 w-3" aria-hidden="true" />
                {{ STAGE_LABELS[row.stage] }}
              </span>
            </td>
            <td :class="[T.td, 'px-3! text-xs!']">{{ row.curriculum }}</td>
            <td :class="[T.td, 'px-3! text-xs!']">
              <span
                class="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-amber-700"
                data-testid="level-questions"
                >{{ row.questionCount }} soalan</span
              >
            </td>
            <td :class="[T.td, 'px-3! text-xs!']">
              <span
                class="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700"
                data-testid="level-subjects"
                >{{ row.subjectCount }} subjek</span
              >
            </td>
            <td :class="[T.td, 'px-3!']">
              <ActiveSwitch
                :active="row.isActive"
                accent="pink"
                data-testid="level-switch"
                @toggle="toggle(row)"
              />
            </td>
            <td :class="[T.td, 'px-3!']">
              <div class="flex items-center gap-1.5">
                <RouterLink
                  :to="{ name: LEVEL_ROUTES.edit, params: { id: row.id } }"
                  title="Edit"
                  :class="[
                    iconButtonClass('pink'),
                    'bg-slate-100 text-slate-500 hover:bg-slate-200',
                  ]"
                  data-testid="level-edit"
                >
                  <SquarePen class="h-4 w-4" aria-hidden="true" />
                </RouterLink>
                <button
                  type="button"
                  title="Padam"
                  :disabled="deleting"
                  :class="[
                    iconButtonClass('pink'),
                    'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60',
                  ]"
                  data-testid="level-delete"
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
