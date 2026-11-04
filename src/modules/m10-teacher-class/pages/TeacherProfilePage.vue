<script setup lang="ts">
/**
 * S5-T05 part C `/guru/profil/:id` "Profil Guru" (R1-GUR-A1 FR-GUR-A1-4; API-GUR-22 `GET /api/public/teachers/:id`; cross-sector S6).
 * Read-only card of another teacher for a signed-in teacher, admin or school admin: name, "Tentang" (Bio; empty:
 * "Guru ini belum menulis bio."), "Maklumat Profesional" (Subjek Utama, Kelayakan, Pengalaman; "—" when empty).
 * Never the IC, the e-mail or the phone: the API does not send them.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { api } from '@/api'
import { DsLoadError } from '@/ds'

import { moduleMessage } from '../lib/generic-server-text'

/** `data` of `GET /api/public/teachers/:id` (contract `AccountTeacherPublic`). */
interface TeacherCard {
  name: string
  subject: string | null
  bio: string | null
  qualification: string | null
  experienceYears: number
}

const EMPTY = '—'
const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

const card = ref<TeacherCard | null>(null)
const state = ref<'loading' | 'ready' | 'error'>('loading')
const errorText = ref('')
let seq = 0

async function load(): Promise<void> {
  const mine = ++seq
  state.value = 'loading'
  card.value = null
  try {
    const data = await api.get<TeacherCard>(`/api/public/teachers/${encodeURIComponent(id.value)}`)
    if (mine !== seq) return
    card.value = data
    state.value = 'ready'
  } catch (err) {
    if (mine !== seq) return
    errorText.value = moduleMessage(err) ?? ''
    state.value = 'error'
  }
}

const rows = computed(() => {
  const c = card.value
  if (!c) return []
  return [
    { key: 'subject', label: 'Subjek Utama', value: c.subject?.trim() || EMPTY },
    { key: 'qualification', label: 'Kelayakan', value: c.qualification?.trim() || EMPTY },
    { key: 'experience', label: 'Pengalaman', value: `${String(c.experienceYears)} tahun` },
  ]
})

watch(id, load, { immediate: true })
</script>

<template>
  <section class="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6" data-testid="teacher-public-page">
    <USkeleton v-if="state === 'loading'" class="h-48 w-full" role="status" aria-busy="true" data-testid="teacher-public-loading" />

    <DsLoadError v-else-if="state === 'error'" :message="errorText || undefined" testid="teacher-public-error" @retry="load" />

    <template v-else-if="card">
      <UCard data-testid="teacher-public-hero">
        <div class="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-start">
          <UAvatar :alt="card.name" size="3xl" aria-hidden="true" />
          <div class="min-w-0">
            <h2 class="max-w-full text-heading break-words text-highlighted" data-testid="teacher-public-name">{{ card.name }}</h2>
          </div>
        </div>
      </UCard>

      <UCard data-testid="teacher-public-about">
        <div class="flex flex-col gap-2">
          <h2 class="text-subheading text-highlighted">Tentang</h2>
          <p v-if="card.bio?.trim()" class="text-body break-words whitespace-pre-line text-highlighted" data-testid="teacher-public-bio">{{ card.bio }}</p>
          <p v-else class="text-body text-muted" data-testid="teacher-public-bio-empty">Guru ini belum menulis bio.</p>
        </div>
      </UCard>

      <UCard data-testid="teacher-public-professional">
        <div class="flex flex-col gap-3">
          <h2 class="text-subheading text-highlighted">Maklumat Profesional</h2>
          <dl class="flex flex-col gap-3">
            <div v-for="row in rows" :key="row.key" class="flex min-h-11 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <dt class="text-label text-muted">{{ row.label }}</dt>
              <dd class="min-w-0 text-body break-words text-highlighted sm:text-end" :data-testid="`teacher-public-${row.key}`">{{ row.value }}</dd>
            </div>
          </dl>
        </div>
      </UCard>
    </template>
  </section>
</template>
