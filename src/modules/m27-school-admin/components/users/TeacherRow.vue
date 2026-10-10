<script setup lang="ts">
/**
 * One S7 row (FR-M27-101, 102; BR-M27-36): #, Nama (initials avatar; link to S10 for an active teacher), Emel,
 * Telefon, Kelas ("{n} kelas" or "-"), Login Terakhir (relative time or "Belum login"), "Aktif?" (a form button as
 * M02 FR-M02-08: the page asks the native confirm and calls the toggle), Tarikh, Tindakan.
 */
import { CircleCheck, CircleX, LoaderCircle } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { SchoolTeacherRow } from '../../api/school-admin'
import { formatDate, lastLoginText, phoneText, TEACHER_LIST_PATH } from './users-format'
import ImpersonateButton from './ImpersonateButton.vue'
import UserRowActions from './UserRowActions.vue'

defineProps<{ row: SchoolTeacherRow; index: number; toggling: boolean }>()
defineEmits<{ toggle: [row: SchoolTeacherRow] }>()
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
          :to="`${TEACHER_LIST_PATH}/${row.id}`"
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
    <td :class="[CELL, 'whitespace-nowrap']" data-testid="user-classes">
      {{ row.classCount > 0 ? `${row.classCount} kelas` : '-' }}
    </td>
    <td :class="[CELL, 'whitespace-nowrap']" data-testid="user-last-login">
      {{ lastLoginText(row.lastLoginAt) }}
    </td>
    <td :class="CELL">
      <form method="post" @submit.prevent="$emit('toggle', row)">
        <button
          type="submit"
          :disabled="toggling"
          :class="[
            'inline-flex min-h-11 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait lg:min-h-8',
            row.isActive
              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
              : 'bg-red-100 text-red-700 hover:bg-red-200',
          ]"
          data-testid="user-toggle"
        >
          <LoaderCircle v-if="toggling" class="h-4 w-4 animate-spin" aria-hidden="true" />
          <template v-else-if="row.isActive">
            <CircleCheck class="h-3.5 w-3.5" aria-hidden="true" />Aktif
          </template>
          <template v-else> <CircleX class="h-3.5 w-3.5" aria-hidden="true" />Tidak </template>
        </button>
      </form>
    </td>
    <td :class="[CELL, 'whitespace-nowrap']" data-testid="user-date">
      {{ formatDate(row.createdAt) }}
    </td>
    <td :class="CELL">
      <UserRowActions :edit-to="`${TEACHER_LIST_PATH}/${row.id}`" :can-edit="row.canEdit">
        <ImpersonateButton
          :user-id="row.id"
          :name="row.name"
          :is-active="row.isActive"
          role="teacher"
        />
        <slot name="actions" />
      </UserRowActions>
    </td>
  </tr>
</template>
