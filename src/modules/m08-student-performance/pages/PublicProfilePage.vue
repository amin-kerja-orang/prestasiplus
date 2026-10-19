<script setup lang="ts">
/**
 * S18 `/pelajar/{id}` public student profile (M08-T3; FR-M08-104..107, BR-M08-25, FN-M08-6.3.*), from
 * `GET /api/public/students/:id` (no session needed). A `bare` page: it draws its own top bar. An unknown id
 * is the standard 404 page. Tab title "{nama} — Pelajar PRESTASIPLUS". (The fade-in of the sections was dropped: style blocks are barred by the strict theme.)
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { usePageMeta } from '@/composables/usePageMeta'
import {
  DsIconChip,
  DsLoadError,
  DsPanel,
  DsScoreRing,
  DsStatRow,
  type DsAccent,
  type StatItem,
  DsSurface,
  DsCluster,
  DsStack,
  DsGrid,
  DsHeading,
  DsText,
} from '@/ds'
import { formatDateLong } from '@/lib/time'

import { fetchPublicProfile } from '../api/performance'
import PostCard from '../components/timeline/PostCard.vue'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { shareProfile } from '../lib/timeline/clipboard'
import { sortPosts } from '../lib/timeline/posts'
import { absoluteUrl, count, initialOf, percent, tierName } from '../lib/timeline/profile'

const route = useRoute()
const pageMeta = usePageMeta()
const userId = computed(() => Number(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchPublicProfile(userId.value, { signal }),
  () => userId.value,
)
const loadFailed = computed(() => isLoadError(error.value))

watch(
  data,
  (d) => {
    if (d) pageMeta.setTitle(`${d.name} — Pelajar PRESTASIPLUS`)
  },
  { immediate: true },
)

const posts = computed(() => sortPosts(data.value?.posts ?? []))
const nextTier = computed(() => {
  const t = data.value?.tier
  return t && t.toNext !== null && t.nextKey
    ? `${count(t.toNext)} syiling lagi ke ${tierName(t.nextKey)}`
    : ''
})

const stats = computed<StatItem[]>(() => {
  const d = data.value
  if (!d) return []
  return [
    { key: 'syiling', icon: 'coins', accent: 'win', value: count(d.syiling), label: 'Syiling' },
    {
      key: 'kombo',
      icon: 'fire',
      accent: 'heat',
      value: count(d.streak.current),
      label: 'Kombo Hari',
    },
    {
      key: 'sesi',
      icon: 'books',
      accent: 'action',
      value: count(d.activity.sessions),
      label: 'Sesi Latihan',
    },
    {
      key: 'tepat',
      icon: 'target',
      accent: 'friend',
      value: percent(d.accuracy),
      label: 'Ketepatan',
    },
  ]
})

const summary = computed<{ id: string; accent: DsAccent; icon: string; text: string }[]>(() => {
  const a = data.value?.activity
  if (!a) return []
  return [
    {
      id: 'sesi',
      accent: 'action',
      icon: 'i-ph-book-open',
      text: `${count(a.sessions)} sesi latihan`,
    },
    {
      id: 'hari',
      accent: 'heat',
      icon: 'i-ph-calendar-check',
      text: `${count(a.practiceDays)} hari berlatih`,
    },
    {
      id: 'betul',
      accent: 'win',
      icon: 'i-ph-check-circle',
      text: `${count(a.correct)} jawapan betul`,
    },
    {
      id: 'kombo',
      accent: 'friend',
      icon: 'i-ph-fire',
      text: `${count(a.bestStreak)} kombo terpanjang`,
    },
  ]
})

const publicUrl = (): string => absoluteUrl(`/pelajar/${String(userId.value)}`)
const share = (): void => {
  if (data.value) void shareProfile(data.value.name, publicUrl())
}
</script>

<template>
  <DsSurface
    radius="none"
    shadow="none"
    padding="none"
    :clip="false"
    class="min-h-screen overflow-x-hidden"
    data-testid="public-profile-page"
  >
    <header class="sticky top-0 bg-default">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <ULink
          to="/"
          class="flex min-h-11 min-w-0 items-center gap-2 text-heading text-highlighted"
          data-testid="logo"
        >
          <UIcon name="i-ph-graduation-cap" class="size-6 shrink-0 text-primary-t" /> PRESTASIPLUS
        </ULink>
        <DsCluster gap="xs" :wrap="false" class="shrink-0">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-ph-share-network"
            label="Kongsi"
            data-testid="share"
            @click="share"
          />
          <UButton to="/" size="lg" icon="i-ph-house" aria-label="Utama" data-testid="home">
            <span class="hidden sm:inline">Utama</span>
          </UButton>
        </DsCluster>
      </div>
    </header>

    <div v-if="loadFailed" class="mx-auto max-w-3xl px-4 py-8">
      <DsLoadError :message="LOAD_ERROR" testid="page-error" @retry="reload()" />
    </div>

    <template v-else-if="data">
      <div class="bg-elevated py-3" data-testid="cover">
        <div
          class="mx-auto hidden max-w-7xl justify-end gap-3 px-6 lg:flex"
          data-testid="cover-chips"
        >
          <UBadge
            color="neutral"
            variant="subtle"
            size="lg"
            icon="i-ph-graduation-cap"
            label="Pelajar PRESTASIPLUS"
          />
          <UBadge
            color="neutral"
            variant="subtle"
            size="lg"
            icon="i-ph-clock"
            data-testid="days-with"
          >
            {{ count(data.daysWith) }} hari bersama
          </UBadge>
        </div>
      </div>

      <main class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        <DsPanel data-testid="profile-card">
          <div class="flex flex-col items-center gap-6 text-center md:flex-row md:text-start">
            <div class="relative shrink-0">
              <DsScoreRing
                :value="data.tier.progressPct"
                size="lg"
                :display="initialOf(data.name)"
                :label="`Kemajuan tahap ${tierName(data.tier.key)}`"
                data-testid="avatar-ring"
              />
              <span class="absolute end-0 bottom-0 text-heading" data-testid="tier-badge">{{
                data.tier.emoji
              }}</span>
            </div>

            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center justify-center gap-2 md:justify-start">
                <DsHeading :level="1" wrap="anywhere" data-testid="name">
                  {{ data.name }}
                </DsHeading>
                <UBadge color="neutral" variant="subtle" data-testid="tier-pill"
                  >{{ data.tier.emoji }} {{ tierName(data.tier.key) }}</UBadge
                >
              </div>
              <p class="mt-1 text-body text-muted">Pelajar PRESTASIPLUS</p>
              <div class="mt-3 flex flex-wrap justify-center gap-2 md:justify-start">
                <UBadge
                  v-if="data.schoolName"
                  color="neutral"
                  variant="subtle"
                  size="lg"
                  icon="i-ph-student"
                  :label="data.schoolName"
                  data-testid="chip-school"
                />
                <UBadge
                  v-if="data.levelName"
                  color="neutral"
                  variant="subtle"
                  size="lg"
                  icon="i-ph-stack"
                  :label="data.levelName"
                  data-testid="chip-level"
                />
                <UBadge
                  color="neutral"
                  variant="subtle"
                  size="lg"
                  icon="i-ph-calendar-blank"
                  :label="`Ahli sejak ${formatDateLong(data.joinedAt)}`"
                  data-testid="chip-joined"
                />
              </div>
            </div>

            <DsStack gap="xs" align="center" class="shrink-0">
              <DsStack gap="none" align="center" class="w-36" data-testid="coin-card">
                <DsText variant="caption">🪙 Syiling</DsText>
                <DsText variant="title" tabular data-testid="coin-value">
                  {{ count(data.syiling) }}
                </DsText>
              </DsStack>
              <DsCluster gap="xs" align="stretch" :wrap="false">
                <div class="w-20 bg-elevated px-2 py-2 text-center" data-testid="mini-kombo">
                  <DsText variant="heading" tabular>
                    {{ count(data.streak.current) }}
                  </DsText>
                  <DsText variant="caption">🔥 Kombo</DsText>
                </div>
                <div class="w-20 bg-elevated px-2 py-2 text-center" data-testid="mini-tepat">
                  <DsText variant="heading" tabular>{{ percent(data.accuracy) }}</DsText>
                  <DsText variant="caption">🎯 Tepat</DsText>
                </div>
              </DsCluster>
            </DsStack>
          </div>
        </DsPanel>

        <DsGrid :cols="{ base: 1, lg: 3 }" gap="lg">
          <DsStack gap="lg">
            <DsPanel data-testid="tier-card">
              <DsCluster gap="xs" justify="between" :wrap="false">
                <p class="flex items-center gap-2 text-heading text-highlighted">
                  <span>{{ data.tier.emoji }}</span>
                  {{ tierName(data.tier.key) }}
                </p>
                <DsText variant="label" tone="muted">Tahap {{ data.tier.ordinal }}</DsText>
              </DsCluster>
              <UProgress
                :model-value="data.tier.progressPct"
                :max="100"
                class="mt-3"
                data-testid="tier-bar"
              />
              <p v-if="nextTier" class="mt-2 text-caption text-muted" data-testid="tier-next">
                {{ nextTier }}
              </p>
            </DsPanel>

            <DsPanel data-testid="activity-summary">
              <h2 class="flex items-center gap-2 text-heading text-highlighted">
                <UIcon name="i-ph-info" class="size-5 text-primary-t" /> Ringkasan Aktiviti
              </h2>
              <ul class="mt-3 flex flex-col gap-2">
                <li
                  v-for="s in summary"
                  :key="s.id"
                  class="flex items-center gap-3 text-body text-default"
                >
                  <DsIconChip :icon="s.icon" :accent="s.accent" size="sm" />
                  <span data-testid="summary-item">{{ s.text }}</span>
                </li>
              </ul>
            </DsPanel>
          </DsStack>

          <div class="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <DsStatRow :items="stats" prefix="stat" :cols="4" data-testid="stat-cards" />

            <DsStack v-if="posts.length" as="section" gap="sm" data-testid="profile-posts">
              <DsHeading :level="2">Timeline</DsHeading>
              <PostCard v-for="p in posts" :key="p.id" :post="p" />
            </DsStack>

            <DsPanel data-testid="sponsor-cta">
              <DsStack gap="sm" align="center" class="text-center">
                <DsIconChip icon="hand-heart" accent="friend" size="lg" />
                <DsHeading :level="3" variant="heading">Ingin menyokong pelajar ini?</DsHeading>
                <DsText variant="body" tone="muted">
                  Jadilah penaja "Anak Angkat" dan bantu pelajar cemerlang!
                </DsText>
                <UButton
                  to="/sponsor/register"
                  size="lg"
                  icon="i-ph-heart"
                  label="Jadi Penaja"
                  data-testid="sponsor-link"
                />
              </DsStack>
            </DsPanel>
          </div>
        </DsGrid>

        <DsStack
          as="footer"
          gap="lg"
          align="center"
          class="text-center"
          data-testid="profile-footer"
        >
          <DsPanel class="w-full max-w-sm">
            <DsCluster :wrap="false" class="text-start">
              <DsIconChip icon="star" accent="win" size="lg" />
              <div class="min-w-0">
                <DsText
                  variant="label"
                  as="p"
                  tone="highlighted"
                  wrap="anywhere"
                  data-testid="footer-line"
                >
                  Teruskan usaha {{ data.firstName }}!
                </DsText>
                <DsText variant="caption">Setiap latihan membawa kejayaan ⭐</DsText>
              </div>
            </DsCluster>
          </DsPanel>
          <DsText variant="body" tone="muted">
            <UIcon name="i-ph-graduation-cap" class="me-1 size-4" />
            <ULink to="/" class="inline-flex min-h-11 items-center" data-testid="footer-logo"
              >PRESTASIPLUS</ULink
            >
            — Platform Latih Tubi Interaktif Malaysia
          </DsText>
        </DsStack>
      </main>
    </template>
  </DsSurface>
</template>
