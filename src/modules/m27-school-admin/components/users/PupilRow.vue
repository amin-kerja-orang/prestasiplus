<script setup lang="ts">
/**
 * One S6 row (FR-M27-90, 92; BR-M27-36): #, Nama (initials avatar; link to S9 for an active pupil), Emel,
 * Telefon, Tingkatan, Kelas, "Aktif?" (read-only badge: pupils are not activated by the school admin, G1-1),
 * Tarikh, Tindakan.
 */
import { RouterLink } from 'vue-router'

import type { SchoolPupilRow } from '../../api/school-admin'
import { formatDate, phoneText, PUPIL_LIST_PATH } from './users-format'
import ImpersonateButton from './ImpersonateButton.vue'
import UserRowActions from './UserRowActions.vue'

defineProps<{ row: SchoolPupilRow; index: number }>()
defineSlots<{ actions?: () => unknown }>()

const CELL = 'px-2.5 py-3 text-sm text-slate-700'
</script>

<template>
  <tr class="border-t border-slate-100 align-middle" data-testid="user-row" :data-user-id="row.id">
    <td :class="CELL" data-testid="user-index">{{ index }}</td>
    <td :class="[CELL, 'min-w-40 font-medium text-slate-800']">
      <div class="flex items-center gap-2">
        <span
          class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-xs font-bold text-white"
          aria-hidden="true"
          data-testid="user-avatar"
          >{{ row.initials }}</span
        >
        <RouterLink
          v-if="row.canEdit"
          :to="`${PUPIL_LIST_PATH}/${row.id}`"
          class="min-w-0 break-words text-indigo-700 hover:underline"
          data-testid="user-name"
          >{{ row.name }}</RouterLink
        >
        <span v-else class="min-w-0 break-words" data-testid="user-name">{{ row.name }}</span>
      </div>
    </td>
    <td :class="[CELL, 'min-w-36 break-all']" data-testid="user-email">{{ row.email }}</td>
    <td :class="[CELL, 'whitespace-nowrap']" data-testid="user-phone">
      {{ phoneText(row.phone) }}
    </td>
    <td :class="[CELL, 'whitespace-nowrap']" data-testid="user-grade">
      {{ row.gradeLabel ?? '-' }}
    </td>
    <td :class="[CELL, 'min-w-28 break-words']" data-testid="user-classes">
      {{ row.classNames.length > 0 ? row.classNames.join(', ') : '-' }}
    </td>
    <td :class="CELL">
      <span
        :class="[
          'inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap',
          row.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
        ]"
        data-testid="user-status"
        >{{ row.isActive ? 'Aktif' : 'Tidak' }}</span
      >
    </td>
    <td :class="[CELL, 'whitespace-nowrap']" data-testid="user-date">
      {{ formatDate(row.createdAt) }}
    </td>
    <td :class="CELL">
      <UserRowActions :edit-to="`${PUPIL_LIST_PATH}/${row.id}`" :can-edit="row.canEdit">
        <ImpersonateButton
          :user-id="row.id"
          :name="row.name"
          :is-active="row.isActive"
          role="student"
        />
        <slot name="actions" />
      </UserRowActions>
    </td>
  </tr>
</template>
