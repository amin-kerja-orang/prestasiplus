<script setup lang="ts">
/**
 * One student row of S6 (PROPOSED, FR-M10-36/37): name, level, the viewer's class chips. On the
 * "Pelajar Saya" tab each chip with a known class id has a remove button (#17); on the school tab
 * the row has an add button (#16) for the class chosen in the "Tambah pelajar ke:" bar.
 */
import { Plus, X } from '@lucide/vue'

import type { GuruStudent } from '../../api/types'
import { PELAJAR_COPY } from './copy'

defineProps<{
  student: GuruStudent
  mode: 'mine' | 'school'
  /** Class name → id for the chips that can be removed (unique active class names only). */
  classIds?: ReadonlyMap<string, number>
  /** School tab: a class is chosen. */
  canAdd?: boolean
  /** School tab: the student is already in the chosen class. */
  alreadyIn?: boolean
  busy?: boolean
}>()
defineEmits<{ add: [studentId: number]; remove: [studentId: number, classId: number] }>()
</script>

<template>
  <li
    class="flex min-w-0 flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-3 shadow-sm"
    data-testid="student-row"
    :data-student-id="student.id"
  >
    <div class="min-w-0 flex-1">
      <p class="font-semibold break-words text-slate-800" data-testid="student-name">
        {{ student.name }}
      </p>
      <p v-if="student.levelName" class="text-xs text-slate-500" data-testid="student-level">
        {{ student.levelName }}
      </p>
      <ul v-if="student.classNames.length > 0" class="mt-1.5 flex flex-wrap gap-1.5">
        <li
          v-for="cls in student.classNames"
          :key="cls"
          class="inline-flex items-center gap-1 rounded-full bg-indigo-50 pl-2.5 text-xs font-semibold text-indigo-700"
          :class="mode === 'mine' && classIds?.has(cls) ? 'pr-0.5' : 'pr-2.5'"
          data-testid="student-class"
        >
          {{ cls }}
          <button
            v-if="mode === 'mine' && classIds?.has(cls)"
            type="button"
            class="inline-flex h-11 w-11 items-center justify-center rounded-full text-indigo-400 hover:text-red-600 disabled:opacity-50"
            :disabled="busy"
            data-testid="student-remove"
            @click="$emit('remove', student.id, classIds?.get(cls) as number)"
          >
            <X class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </div>
    <template v-if="mode === 'school'">
      <span
        v-if="alreadyIn"
        class="text-xs font-semibold text-emerald-600"
        data-testid="student-in-class"
        >{{ PELAJAR_COPY.inClass }}</span
      >
      <button
        v-else
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-300"
        :disabled="!canAdd || busy"
        data-testid="student-add"
        @click="$emit('add', student.id)"
      >
        <Plus class="h-4 w-4" />{{ PELAJAR_COPY.add }}
      </button>
    </template>
  </li>
</template>
