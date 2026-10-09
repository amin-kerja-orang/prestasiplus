<script setup lang="ts">
/**
 * S1 `/pksk` "PKSK" hub (M07-T2; FR-M07-01..05, FN-M07-1.1.*): hero, the "Format Peperiksaan" card
 * and the two level cards. The "AKTIF" badge and green border follow `GET /api/pksk/me/access`; a
 * level without access has no badge and no green border (INFERRED only, L-1).
 */
import { RouterLink } from 'vue-router'

import { AppIcon } from '@/components/icon'

import { fetchPkskAccess } from '../api/pksk'
import { FORMAT_TILES, LEVEL_CARDS } from '../lib/levels'
import { useApi } from '@/composables'

const { data: access } = useApi((signal) => fetchPkskAccess({ signal }))
</script>

<template>
  <div class="min-w-0 space-y-6" data-testid="pksk-hub">
    <div
      class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 text-center shadow-xl sm:p-10"
      data-testid="pksk-banner"
    >
      <div
        class="absolute inset-0 opacity-20"
        style="
          background-image: radial-gradient(circle, #fff 1.5px, transparent 1.5px);
          background-size: 24px 24px;
        "
      ></div>
      <div class="relative">
        <AppIcon name="fa-graduation-cap" class="mx-auto mb-4 h-14 w-14 text-white" />
        <h1
          class="text-4xl font-bold text-white md:text-5xl"
          data-testid="hub-title"
          style="color: #ffffff"
        >
          Persediaan Kemasukan
        </h1>
        <p class="mt-1 text-xl font-semibold text-white/90 md:text-2xl">SBP / MRSM / SMKA</p>
        <p class="mx-auto mt-3 max-w-2xl text-sm text-white/90 sm:text-base">
          Latih tubi soalan dan peperiksaan penuh untuk persediaan kemasukan sekolah berasrama penuh
        </p>
      </div>
    </div>

    <section class="rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="format-card">
      <h2 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
        <AppIcon name="fa-clipboard-list" class="h-5 w-5 text-indigo-600" /> Format Peperiksaan
      </h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          v-for="t in FORMAT_TILES"
          :key="t.bahagian"
          class="flex min-w-0 items-start gap-3 rounded-2xl bg-slate-50 p-4"
          :data-testid="`format-${t.bahagian}`"
        >
          <span
            :class="[
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white',
              t.circle,
            ]"
            data-testid="format-circle"
            >{{ t.bahagian }}</span
          >
          <div class="min-w-0">
            <h3 class="font-bold text-slate-800">{{ t.name }}</h3>
            <p class="text-sm text-slate-600">
              <strong class="text-slate-800">{{ t.count }}</strong> {{ t.unit }}
            </p>
            <p class="text-sm text-slate-500">Pemberat: {{ t.weight }}%</p>
            <span
              class="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-slate-600"
            >
              <AppIcon :name="t.icon" class="h-3.5 w-3.5" /> {{ t.chip }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <section data-testid="level-section">
      <h2 class="mb-4 flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
        <AppIcon name="fa-layer-group" class="h-5 w-5 text-indigo-600" /> Pilih Tingkatan Anda
      </h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div
          v-for="c in LEVEL_CARDS"
          :key="c.level"
          :class="[
            'relative min-w-0 rounded-2xl bg-white p-5 sm:p-6',
            access?.[c.level]
              ? 'border-4 border-green-400 shadow-xl shadow-green-500/30'
              : 'border border-slate-100 shadow-sm',
          ]"
          :data-testid="`level-card-${c.level}`"
          :data-active="access?.[c.level] ? 'true' : 'false'"
        >
          <span
            v-if="access?.[c.level]"
            class="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-green-500 px-3 py-1 text-xs font-bold text-white"
            data-testid="badge-aktif"
          >
            <AppIcon name="fa-unlock" class="h-3 w-3" /> AKTIF
          </span>
          <span
            :class="[
              'flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br text-xl font-bold text-white',
              c.tile,
            ]"
            >{{ c.level }}</span
          >
          <h3 class="mt-4 text-xl font-bold text-slate-800">{{ c.name }}</h3>
          <p class="mt-1 text-sm text-slate-600">{{ c.text }}</p>
          <RouterLink
            :to="`/pksk/level/${c.level}`"
            :class="[
              'mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r px-5 py-3 font-bold text-white transition hover:scale-105',
              c.button,
            ]"
            :data-testid="`start-${c.level}`"
            style="color: #ffffff"
          >
            <AppIcon name="fa-play" class="h-4 w-4" /> Mula Latihan
          </RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
