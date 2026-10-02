<script setup lang="ts">
/**
 * S18 `/pelajar/{id}` public student profile (M08-T3; FR-M08-104..107, BR-M08-25, FN-M08-6.3.*), from
 * `GET /api/public/students/:id` (no session needed). A `bare` page: it draws its own top bar. An unknown id
 * is the standard 404 page. Tab title "{nama} — Pelajar PRESTASIPLUS". Sections marked `.reveal` fade in when
 * 10% visible. Post text is untrusted and rendered as text only.
 */
import {
  BookOpen,
  Calendar,
  CalendarCheck,
  CircleCheck,
  Clock,
  Flame,
  GraduationCap,
  HandHeart,
  Heart,
  House,
  Info,
  Layers,
  School,
  Share2,
  Star,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { usePageMeta } from '@/composables/usePageMeta'
import { formatDateLong } from '@/lib/time'

import { fetchPublicProfile } from '../api/performance'
import PostCard from '../components/timeline/PostCard.vue'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'
import { shareProfile } from '../lib/timeline/clipboard'
import { sortPosts } from '../lib/timeline/posts'
import {
  absoluteUrl,
  count,
  initialOf,
  percent,
  tierColour,
  tierName,
} from '../lib/timeline/profile'

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
const colour = computed(() => (data.value ? tierColour(data.value.tier.key) : '#cd7f32'))
const nextTier = computed(() => {
  const t = data.value?.tier
  return t && t.toNext !== null && t.nextKey
    ? `${count(t.toNext)} syiling lagi ke ${tierName(t.nextKey)}`
    : ''
})
const ring = computed(
  () => `conic-gradient(${colour.value} ${String(data.value?.tier.progressPct ?? 0)}%, #e2e8f0 0)`,
)

const stats = computed(() => {
  const d = data.value
  if (!d) return []
  return [
    { id: 'syiling', emoji: '🪙', value: count(d.syiling), label: 'Syiling', tile: 'bg-amber-100' },
    {
      id: 'kombo',
      emoji: '🔥',
      value: count(d.streak.current),
      label: 'Kombo Hari',
      tile: 'bg-orange-100',
    },
    {
      id: 'sesi',
      emoji: '📚',
      value: count(d.activity.sessions),
      label: 'Sesi Latihan',
      tile: 'bg-blue-100',
    },
    {
      id: 'tepat',
      emoji: '🎯',
      value: percent(d.accuracy),
      label: 'Ketepatan',
      tile: 'bg-green-100',
    },
  ]
})

const summary = computed(() => {
  const a = data.value?.activity
  if (!a) return []
  return [
    {
      id: 'sesi',
      icon: BookOpen,
      text: `${count(a.sessions)} sesi latihan`,
      tile: 'bg-blue-50 text-blue-600',
    },
    {
      id: 'hari',
      icon: CalendarCheck,
      text: `${count(a.practiceDays)} hari berlatih`,
      tile: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'betul',
      icon: CircleCheck,
      text: `${count(a.correct)} jawapan betul`,
      tile: 'bg-green-50 text-green-600',
    },
    {
      id: 'kombo',
      icon: Flame,
      text: `${count(a.bestStreak)} kombo terpanjang`,
      tile: 'bg-purple-50 text-purple-600',
    },
  ]
})

const publicUrl = (): string => absoluteUrl(`/pelajar/${String(userId.value)}`)
const share = (): void => {
  if (data.value) void shareProfile(data.value.name, publicUrl())
}

// `.reveal` sections fade in when 10% visible (FR-M08-107): the observer adds `.visible`.
let observer: IntersectionObserver | null = null
watch(data, async (d) => {
  if (!d) return
  await nextTick()
  const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
  if (typeof IntersectionObserver === 'undefined') {
    els.forEach((el) => el.classList.add('visible'))
    return
  }
  observer?.disconnect()
  observer = new IntersectionObserver(
    (entries, obs) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('visible')
          obs.unobserve(e.target)
        }
      }
    },
    { threshold: 0.1 },
  )
  els.forEach((el) => observer?.observe(el))
})
onBeforeUnmount(() => {
  observer?.disconnect()
})

const CARD = 'rounded-2xl border border-slate-100 bg-white shadow-sm'
</script>

<template>
  <div
    class="min-h-screen overflow-x-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50"
    data-testid="public-profile-page"
  >
    <header class="sticky top-0 z-20 border-b border-slate-100 bg-white/95 backdrop-blur">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-2.5 sm:px-6">
        <RouterLink
          to="/"
          class="flex min-h-11 min-w-0 items-center gap-2 text-lg font-extrabold text-slate-800"
          data-testid="logo"
        >
          <GraduationCap class="h-6 w-6 shrink-0 text-indigo-600" /> PRESTASIPLUS
        </RouterLink>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-200"
            data-testid="share"
            @click="share"
          >
            <Share2 class="h-4 w-4" /> Kongsi
          </button>
          <RouterLink
            to="/"
            class="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-3 text-sm font-bold text-white shadow"
            data-testid="home"
          >
            <House class="h-4 w-4" /> <span class="hidden sm:inline">Utama</span>
          </RouterLink>
        </div>
      </div>
    </header>

    <div v-if="loadFailed" class="mx-auto max-w-3xl space-y-3 px-4 py-8" data-testid="page-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>

    <template v-else-if="data">
      <div
        class="relative h-48 overflow-hidden bg-gradient-to-br from-purple-500 via-indigo-500 to-purple-600 sm:h-56 md:h-64"
        data-testid="cover"
      >
        <span class="absolute -top-10 -left-10 h-48 w-48 rounded-full bg-white/10"></span>
        <span class="absolute -right-10 -bottom-16 h-64 w-64 rounded-full bg-white/10"></span>
        <div
          class="mx-auto hidden max-w-7xl justify-end gap-3 px-6 pt-8 lg:flex"
          data-testid="cover-chips"
        >
          <span
            class="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-semibold text-white"
          >
            <GraduationCap class="h-4 w-4" /> Pelajar PRESTASIPLUS
          </span>
          <span
            class="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/20 px-4 py-2 text-sm font-semibold text-white"
            data-testid="days-with"
          >
            <Clock class="h-4 w-4" /> {{ count(data.daysWith) }} hari bersama
          </span>
        </div>
      </div>

      <main class="relative z-10 mx-auto -mt-24 max-w-7xl space-y-5 px-4 pb-10 sm:px-6 md:-mt-28">
        <section
          class="reveal flex flex-col items-center gap-5 p-5 text-center sm:p-8 md:flex-row md:items-center md:text-left"
          :class="CARD"
          data-reveal
          data-testid="profile-card"
        >
          <div class="relative shrink-0">
            <div
              class="flex h-28 w-28 items-center justify-center rounded-full p-1.5 sm:h-32 sm:w-32"
              :style="{ background: ring }"
              data-testid="avatar-ring"
            >
              <span
                class="flex h-full w-full items-center justify-center rounded-full bg-white text-4xl font-bold text-slate-500"
                data-testid="avatar"
                >{{ initialOf(data.name) }}</span
              >
            </div>
            <span
              class="absolute right-0 bottom-0 flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg shadow"
              :style="{ border: `2px solid ${colour}33` }"
              data-testid="tier-badge"
              >{{ data.tier.emoji }}</span
            >
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <h1
                class="text-2xl font-extrabold break-words text-slate-900 sm:text-3xl"
                data-testid="name"
              >
                {{ data.name }}
              </h1>
              <span
                class="rounded-full px-2.5 py-1 text-xs font-bold"
                :style="{ background: `${colour}26`, color: colour }"
                data-testid="tier-pill"
                >{{ data.tier.emoji }} {{ tierName(data.tier.key) }}</span
              >
            </div>
            <p class="mt-1 text-sm text-slate-500">Pelajar PRESTASIPLUS</p>
            <div
              class="mt-3 flex flex-wrap justify-center gap-2 text-sm text-slate-600 md:justify-start"
            >
              <span
                v-if="data.schoolName"
                class="inline-flex min-w-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"
                data-testid="chip-school"
              >
                <School class="h-4 w-4 shrink-0 text-indigo-500" />
                <span class="break-words">{{ data.schoolName }}</span>
              </span>
              <span
                v-if="data.levelName"
                class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"
                data-testid="chip-level"
              >
                <Layers class="h-4 w-4 shrink-0 text-blue-500" /> {{ data.levelName }}
              </span>
              <span
                class="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5"
                data-testid="chip-joined"
              >
                <Calendar class="h-4 w-4 shrink-0 text-slate-400" /> Ahli sejak
                {{ formatDateLong(data.joinedAt) }}
              </span>
            </div>
          </div>

          <div class="flex shrink-0 flex-col items-center gap-2">
            <div
              class="w-36 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 px-4 py-3 text-center text-white shadow"
              data-testid="coin-card"
            >
              <p class="text-xs font-medium">🪙 Syiling</p>
              <p class="text-3xl font-extrabold" data-testid="coin-value">
                {{ count(data.syiling) }}
              </p>
            </div>
            <div class="flex gap-2">
              <div
                class="w-[4.25rem] rounded-xl border border-orange-200 bg-orange-50 px-2 py-2 text-center"
                data-testid="mini-kombo"
              >
                <p class="text-lg font-bold text-orange-700">{{ count(data.streak.current) }}</p>
                <p class="text-xs font-semibold text-orange-700">🔥 Kombo</p>
              </div>
              <div
                class="w-[4.25rem] rounded-xl border border-green-200 bg-green-50 px-2 py-2 text-center"
                data-testid="mini-tepat"
              >
                <p class="text-lg font-bold text-green-700">{{ percent(data.accuracy) }}</p>
                <p class="text-xs font-semibold text-green-700">🎯 Tepat</p>
              </div>
            </div>
          </div>
        </section>

        <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div class="min-w-0 space-y-5">
            <section
              class="reveal rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white shadow"
              data-reveal
              data-testid="tier-card"
            >
              <div class="flex items-center justify-between gap-2">
                <p class="flex items-center gap-2 text-lg font-bold">
                  <span class="text-2xl">{{ data.tier.emoji }}</span>
                  {{ tierName(data.tier.key) }}
                </p>
                <span class="text-sm">Tahap {{ data.tier.ordinal }}</span>
              </div>
              <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-white/25">
                <div
                  class="h-full rounded-full bg-white"
                  :style="{ width: `${String(data.tier.progressPct)}%` }"
                  data-testid="tier-bar"
                ></div>
              </div>
              <p v-if="nextTier" class="mt-2 text-xs text-white/90" data-testid="tier-next">
                {{ nextTier }}
              </p>
            </section>

            <section class="reveal p-5" :class="CARD" data-reveal data-testid="activity-summary">
              <h2 class="flex items-center gap-2 text-base font-bold text-slate-800">
                <Info class="h-4 w-4 text-blue-500" /> Ringkasan Aktiviti
              </h2>
              <ul class="mt-3 space-y-2">
                <li
                  v-for="s in summary"
                  :key="s.id"
                  class="flex items-center gap-3 text-sm text-slate-700"
                >
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                    :class="s.tile"
                  >
                    <component :is="s.icon" class="h-4 w-4" />
                  </span>
                  <span data-testid="summary-item">{{ s.text }}</span>
                </li>
              </ul>
            </section>
          </div>

          <div class="min-w-0 space-y-5 lg:col-span-2">
            <section
              class="reveal grid grid-cols-2 gap-3 sm:grid-cols-4"
              data-reveal
              data-testid="stat-cards"
            >
              <div
                v-for="s in stats"
                :key="s.id"
                class="min-w-0 p-4 text-center"
                :class="CARD"
                data-testid="stat-card"
              >
                <span
                  class="mx-auto flex h-10 w-10 items-center justify-center rounded-xl text-lg"
                  :class="s.tile"
                  >{{ s.emoji }}</span
                >
                <p class="mt-2 text-xl font-extrabold text-slate-800" data-testid="stat-value">
                  {{ s.value }}
                </p>
                <p class="text-xs text-slate-500">{{ s.label }}</p>
              </div>
            </section>

            <section
              v-if="posts.length"
              class="reveal space-y-3"
              data-reveal
              data-testid="profile-posts"
            >
              <h2 class="text-base font-bold text-slate-800">Timeline</h2>
              <PostCard v-for="p in posts" :key="p.id" :post="p" />
            </section>

            <section
              class="reveal rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-center text-white shadow sm:p-8"
              data-reveal
              data-testid="sponsor-cta"
            >
              <span
                class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/20"
              >
                <HandHeart class="h-7 w-7" />
              </span>
              <h3 class="mt-3 text-xl font-bold">Ingin menyokong pelajar ini?</h3>
              <p class="mt-1 text-sm text-white/90">
                Jadilah penaja "Anak Angkat" dan bantu pelajar cemerlang!
              </p>
              <RouterLink
                to="/sponsor/register"
                class="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-6 py-2.5 text-sm font-bold text-indigo-600 shadow"
                data-testid="sponsor-link"
              >
                <Heart class="h-4 w-4" /> Jadi Penaja
              </RouterLink>
            </section>
          </div>
        </div>

        <footer class="reveal pt-4 text-center" data-reveal data-testid="profile-footer">
          <div
            class="mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm"
          >
            <span
              class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white"
            >
              <Star class="h-5 w-5" />
            </span>
            <div class="min-w-0">
              <p class="text-sm font-semibold break-words text-slate-800" data-testid="footer-line">
                Teruskan usaha {{ data.firstName }}!
              </p>
              <p class="text-xs text-slate-500">Setiap latihan membawa kejayaan ⭐</p>
            </div>
          </div>
          <p class="mt-6 text-sm text-slate-400">
            <GraduationCap class="mr-1 inline h-4 w-4" />
            <RouterLink to="/" class="inline-flex min-h-11 items-center" data-testid="footer-logo"
              >PRESTASIPLUS</RouterLink
            >
            — Platform Latih Tubi Interaktif Malaysia
          </p>
        </footer>
      </main>
    </template>
  </div>
</template>

<style scoped>
.reveal {
  opacity: 0;
  transform: translateY(16px);
  transition:
    opacity 0.6s ease,
    transform 0.6s ease;
}
.reveal.visible {
  opacity: 1;
  transform: none;
}
</style>
