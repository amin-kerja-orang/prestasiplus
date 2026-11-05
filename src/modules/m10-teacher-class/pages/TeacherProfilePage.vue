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
import { DsCluster, DsDefinitionList, DsHeading, DsLoadError, DsStack, DsText } from '@/ds'

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
  <DsStack as="section" gap="section" class="mx-auto w-full max-w-3xl" data-testid="teacher-public-page">
    <USkeleton v-if="state === 'loading'" class="h-48 w-full" role="status" aria-busy="true" data-testid="teacher-public-loading" />

    <DsLoadError v-else-if="state === 'error'" :message="errorText || undefined" testid="teacher-public-error" @retry="load" />

    <template v-else-if="card">
      <UCard data-testid="teacher-public-hero">
        <DsCluster gap="sm" stack-below="sm" class="text-center sm:text-start">
          <UAvatar :alt="card.name" size="3xl" aria-hidden="true" />
          <DsHeading :level="2" variant="heading" wrap="anywhere" data-testid="teacher-public-name">{{ card.name }}</DsHeading>
        </DsCluster>
      </UCard>

      <UCard data-testid="teacher-public-about">
        <DsStack gap="xs">
          <DsHeading :level="2" variant="subheading">Tentang</DsHeading>
          <DsText v-if="card.bio?.trim()" variant="body" tone="highlighted" wrap="anywhere" class="whitespace-pre-line" data-testid="teacher-public-bio">{{ card.bio }}</DsText>
          <DsText v-else variant="body" tone="muted" data-testid="teacher-public-bio-empty">Guru ini belum menulis bio.</DsText>
        </DsStack>
      </UCard>

      <UCard data-testid="teacher-public-professional">
        <DsStack gap="sm">
          <DsHeading :level="2" variant="subheading">Maklumat Profesional</DsHeading>
          <DsDefinitionList :items="rows">
            <template v-for="row in rows" :key="row.key" #[`value-${row.key}`]>
              <span :data-testid="`teacher-public-${row.key}`">{{ row.value }}</span>
            </template>
          </DsDefinitionList>
        </DsStack>
      </UCard>
    </template>
  </DsStack>
</template>
