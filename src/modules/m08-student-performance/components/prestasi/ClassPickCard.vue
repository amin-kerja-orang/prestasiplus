<script setup lang="ts">
/**
 * Class card of S10 (FR-M08-63) and the populated S4 picker (FR-M08-30, PROPOSED: the S10 pattern):
 * border `{colour}30`, background `{colour}10`, icon tile in the subject colour.
 */
import { ArrowRight, BookOpen, Calendar, Users } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { ClassCard } from '../../api/types'
import { withAlpha } from '../../lib/prestasi/format'

defineProps<{ item: ClassCard; to: string; action: string }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="block min-w-0 rounded-2xl border p-4 transition hover:shadow-md"
    :style="{
      borderColor: withAlpha(item.color, '30'),
      backgroundColor: withAlpha(item.color, '10'),
    }"
    :data-testid="`class-card-${item.id}`"
  >
    <div class="flex items-start gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
        :style="{ backgroundColor: item.color }"
      >
        <BookOpen class="h-5 w-5" />
      </span>
      <div class="min-w-0 flex-1">
        <h3 class="flex items-center gap-2 text-base font-bold text-slate-800">
          <span class="min-w-0 break-words">{{ item.name }}</span>
          <span
            v-if="item.isActive"
            class="h-2 w-2 shrink-0 rounded-full bg-green-500"
            title="Aktif"
          ></span>
        </h3>
        <p v-if="item.subjectName" class="text-sm text-slate-500">{{ item.subjectName }}</p>
      </div>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span class="flex items-center gap-1"
        ><Users class="h-3.5 w-3.5 text-indigo-400" />{{ item.students }} pelajar</span
      >
      <span class="flex items-center gap-1"><Calendar class="h-3.5 w-3.5" />{{ item.year }}</span>
      <span class="font-mono">{{ item.joinCode }}</span>
    </div>
    <p class="mt-3 flex items-center gap-1 text-sm font-semibold text-indigo-600">
      {{ action }} <ArrowRight class="h-4 w-4" />
    </p>
  </RouterLink>
</template>
