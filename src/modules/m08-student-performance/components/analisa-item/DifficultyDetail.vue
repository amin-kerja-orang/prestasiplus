<script setup lang="ts">
/** Expanded detail of one question on S11 (FR-M08-69): right answer, popular wrong answer, wrong pupils. */
import type { ItemAnalysis } from '../../api/types'
import { usePhIcon } from '../../lib/icons'

import OptionCallout from './OptionCallout.vue'

defineProps<{ row: ItemAnalysis['difficulty'][number] }>()

const icon = usePhIcon()
</script>

<template>
  <div class="flex min-w-0 flex-col gap-3">
    <OptionCallout
      variant="correct"
      title="Jawapan Betul"
      :letter="row.correctOption.letter"
      :text="row.correctOption.text"
    />
    <OptionCallout
      v-if="row.popularWrong"
      variant="wrong"
      :title="`Jawapan Salah Popular (${row.popularWrong.times}x dipilih)`"
      :letter="row.popularWrong.letter"
      :text="row.popularWrong.text"
    />
    <div v-if="row.wrongStudents.length > 0" class="flex flex-col gap-2">
      <p class="flex items-center gap-2 text-label text-highlighted">
        <UIcon :name="icon('warning')" class="size-4 text-warning" />Pelajar Yang Salah
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="s in row.wrongStudents"
          :key="s.userId"
          :to="`/prestasi/${s.userId}`"
          color="neutral"
          variant="soft"
          size="lg"
          :icon="icon('user')"
        >
          {{ s.name }}
          <UBadge color="error" variant="subtle" size="sm" :label="`${s.times}x salah`" />
        </UButton>
      </div>
    </div>
  </div>
</template>
