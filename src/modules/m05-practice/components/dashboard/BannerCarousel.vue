<script setup lang="ts">
/**
 * FR-M05-04…08: the announcement carousel (live `bannerCarousel(n)`). One slide at a time; every
 * slide has its own "Baca Selanjutnya" / "Tutup" toggle (state kept per slide), prev / next arrows
 * (modulo the slide count), dots and a counter. It advances every 5,000 ms; the pointer entering
 * pauses it and leaving resumes it.
 */
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lightbulb,
  Megaphone,
  Star,
  Tag,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import type { DashboardBanner } from '../../api/types'
import { bannerKind, bannerStyle, CAROUSEL_INTERVAL_MS, type BannerKind } from './dashboard-lib'

const props = defineProps<{ banners: DashboardBanner[] }>()

const ICONS: Record<BannerKind, unknown> = {
  HERO: Star,
  FEATURE: Lightbulb,
  PROMOTIONAL: Tag,

  ANNOUNCEMENT: Megaphone,
}

const total = computed(() => props.banners.length)
const current = ref(0)
const expanded = reactive<Record<number, boolean>>({})
let timer: ReturnType<typeof setInterval> | null = null

function next(): void {
  if (total.value > 0) current.value = (current.value + 1) % total.value
}
function prev(): void {
  if (total.value > 0) current.value = (current.value - 1 + total.value) % total.value
}
function goTo(index: number): void {
  current.value = index
}
function pause(): void {
  if (timer !== null) clearInterval(timer)
  timer = null
}
function resume(): void {
  pause()
  timer = setInterval(next, CAROUSEL_INTERVAL_MS)
}

onMounted(resume)
onBeforeUnmount(pause)
</script>

<template>
  <div class="relative" data-testid="dash-carousel" @mouseenter="pause" @mouseleave="resume">
    <div class="relative overflow-hidden rounded-2xl" style="min-height: 90px">
      <template v-for="(banner, i) in banners" :key="i">
        <Transition
          enter-active-class="transition ease-out duration-[400ms]"
          enter-from-class="opacity-0 translate-x-6"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition ease-in duration-200 absolute inset-0"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0 -translate-x-6"
        >
          <div
            v-show="current === i"
            :class="[
              'announcement-card flex items-start gap-4 rounded-2xl border-2 bg-linear-to-r p-5 shadow-lg',
              bannerStyle(banner).card,
            ]"
            :data-testid="`dash-slide-${i}`"
          >
            <div
              :class="[
                'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-linear-to-br text-white shadow-md',
                bannerStyle(banner).tile,
              ]"
            >
              <component :is="ICONS[bannerKind(banner)]" class="h-6 w-6" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="mb-1 flex items-center gap-2">
                <span
                  :class="[
                    'inline-block rounded-full px-2 py-0.5 text-xs font-bold',
                    bannerStyle(banner).badge,
                  ]"
                  data-testid="dash-slide-badge"
                  >{{ banner.type }}</span
                >
              </div>
              <p
                class="mb-1 text-base font-extrabold break-words text-slate-800"
                style="font-family: 'Outfit', sans-serif"
                data-testid="dash-slide-title"
              >
                {{ banner.title }}
              </p>
              <template v-if="banner.body">
                <p
                  :class="[
                    'mb-2 text-sm break-words text-slate-600',
                    expanded[i] ? '' : 'line-clamp-2',
                  ]"
                  data-testid="dash-slide-body"
                >
                  {{ banner.body }}
                </p>
                <button
                  type="button"
                  :class="[
                    'inline-flex min-h-11 items-center gap-1.5 text-sm font-bold transition lg:min-h-0',
                    bannerStyle(banner).toggle,
                  ]"
                  data-testid="dash-slide-toggle"
                  @click="expanded[i] = !expanded[i]"
                >
                  <span>{{ expanded[i] ? 'Tutup' : 'Baca Selanjutnya' }}</span>
                  <ChevronDown
                    :class="[
                      'h-3 w-3 transition-transform duration-200',
                      expanded[i] ? 'rotate-180' : '',
                    ]"
                  />
                </button>
              </template>
            </div>
            <div class="flex flex-shrink-0 items-center gap-1">
              <button
                type="button"
                class="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/70 shadow transition after:absolute after:-inset-1.5 after:content-[''] hover:scale-110 hover:bg-white"
                data-testid="dash-prev"
                @click="prev"
              >
                <ChevronLeft class="h-3 w-3 text-slate-600" />
              </button>
              <button
                type="button"
                class="relative flex h-8 w-8 items-center justify-center rounded-full bg-white/70 shadow transition after:absolute after:-inset-1.5 after:content-[''] hover:scale-110 hover:bg-white"
                data-testid="dash-next"
                @click="next"
              >
                <ChevronRight class="h-3 w-3 text-slate-600" />
              </button>
            </div>
          </div>
        </Transition>
      </template>
    </div>

    <div class="mt-3 flex items-center justify-center gap-2" data-testid="dash-dots">
      <button
        v-for="(_, i) in banners"
        :key="i"
        type="button"
        :class="[
          'rounded-full transition-all duration-300',
          current === i
            ? 'h-2.5 w-6 bg-linear-to-r from-pink-500 to-amber-400 shadow-md'
            : 'h-2.5 w-2.5 bg-slate-300 hover:bg-slate-400',
        ]"
        :data-active="current === i ? 'true' : 'false'"
        :data-testid="`dash-dot-${i}`"
        @click="goTo(i)"
      ></button>
      <span class="ml-2 text-xs font-semibold text-slate-400" data-testid="dash-counter"
        >{{ current + 1 }} / {{ total }}</span
      >
    </div>
  </div>
</template>
