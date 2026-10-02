<script setup lang="ts">
/**
 * S4 `/guru/kelas` (FR-M10-28..30; URS FT-M10-3.1): "{n} kelas aktif", "Cipta Kelas Baru", the
 * empty card, PROPOSED class cards (1 / 2 / 3 per row) and the quick-QR modal.
 */
import { Plus } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchGuruClasses } from '../api/guru'
import ClassCard from '../components/kelas/ClassCard.vue'
import { KELAS_COPY } from '../components/kelas/copy'
import QrModal from '../components/kelas/QrModal.vue'

const { data, error } = useApi((signal) => fetchGuruClasses({ signal }))
const classes = computed(() => data.value?.data ?? [])
const activeCount = computed(() => classes.value.filter((c) => c.isActive).length)
const qrClassId = ref<number | null>(null)

const CTA =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-semibold text-white shadow hover:opacity-90'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="kelas-list-page">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="font-heading text-2xl font-bold text-slate-800">{{ KELAS_COPY.title }}</h1>
        <p class="text-sm text-slate-500" data-testid="kelas-active-count">
          {{ activeCount }} kelas aktif
        </p>
      </div>
      <RouterLink to="/guru/kelas/cipta" :class="CTA" data-testid="kelas-create">
        <Plus class="h-4 w-4" />{{ KELAS_COPY.create }}
      </RouterLink>
    </div>

    <AlertBox v-if="error" :messages="KELAS_COPY.loadFailed" />
    <div
      v-else-if="!data"
      class="flex justify-center py-10 text-slate-400"
      data-testid="kelas-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <section
      v-else-if="classes.length === 0"
      class="rounded-2xl bg-white px-6 py-10 text-center shadow-sm"
      data-testid="kelas-empty"
    >
      <p class="text-5xl">🏫</p>
      <h2 class="mt-3 font-heading text-lg font-bold text-slate-800">
        {{ KELAS_COPY.emptyTitle }}
      </h2>
      <p class="mt-1 text-slate-500">{{ KELAS_COPY.emptyBody }}</p>
      <RouterLink
        to="/guru/kelas/cipta"
        class="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-6 text-sm font-semibold text-white hover:bg-indigo-600"
        data-testid="kelas-empty-create"
      >
        <Plus class="h-4 w-4" />{{ KELAS_COPY.createShort }}
      </RouterLink>
    </section>

    <ul
      v-else
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      data-testid="kelas-grid"
    >
      <ClassCard v-for="item in classes" :key="item.id" :item="item" @qr="qrClassId = $event" />
    </ul>

    <QrModal :class-id="qrClassId" @close="qrClassId = null" />
  </div>
</template>
