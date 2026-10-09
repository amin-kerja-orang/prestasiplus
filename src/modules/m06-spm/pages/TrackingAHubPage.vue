<script setup lang="ts">
/**
 * S5 `/spm/ramalan` "Tracking A SPM" (M06-T3; FR-M06-35…41, BR-M06-09…11, BR-M06-30).
 *
 * Two lane cards, the "Admin Readiness" card (rendered only when the server sends it: admin only), the
 * "Tracking A Bahasa" section (BM and BI → S7) and one card per open objective subject → S6. The cards
 * and chips replicate the live copy; icons are Lucide stand-ins for the Font Awesome names.
 */
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CircleCheck,
  Database,
  FileCheck,
  FileText,
  Languages,
  Layers,
  Target,
  WandSparkles,
} from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchTrackingAHub } from '../api'
import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import { bahasaHref, lockChip, targetChip, tileTarget } from '../lib/tracking'

const { data, error, reload } = useApi((signal) => fetchTrackingAHub({ signal }))

const CHIP =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap'
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="tracking-hub-page">
    <div class="mx-auto max-w-7xl">
      <RouterLink
        to="/spm"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali ke Mod SPM
      </RouterLink>

      <div class="mb-5 sm:mb-8">
        <div class="flex flex-wrap items-center gap-2">
          <h1
            class="flex items-center gap-2 font-heading text-2xl font-extrabold text-slate-800 sm:text-3xl"
            data-testid="spm-heading"
          >
            <WandSparkles
              class="h-6 w-6 shrink-0 text-purple-600 sm:h-7 sm:w-7"
              aria-hidden="true"
            />
            Tracking A SPM
          </h1>
          <span
            class="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold tracking-wider text-purple-700"
            data-testid="tracking-pill"
            >TRACKING A</span
          >
        </div>
        <p class="mt-1 text-sm text-slate-600 sm:text-base" data-testid="spm-sub">
          Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!
        </p>
      </div>

      <template v-if="data">
        <!-- Lanes -->
        <div class="mb-6 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2" data-testid="lanes">
          <div
            class="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-4 text-white shadow-sm sm:p-6"
            data-testid="lane-objektif"
          >
            <p class="text-xs font-bold tracking-wider text-indigo-100 uppercase">
              Tracking A Objektif
            </p>
            <h3 class="mt-1 font-heading text-lg font-extrabold text-white">
              Subjek objektif penuh
            </h3>
            <p class="mt-1 text-sm text-indigo-50">
              Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span :class="[CHIP, 'bg-white/20 text-white']" data-testid="lane-badge"
                >{{ data.objectiveLane.subjects }} subjek</span
              >
              <span :class="[CHIP, 'bg-white/20 text-white']" data-testid="lane-sets">
                <Layers class="h-3 w-3" aria-hidden="true" />
                {{ formatCount(data.objectiveLane.sets) }} set
              </span>
              <span :class="[CHIP, 'bg-white/20 text-white']" data-testid="lane-questions">
                <FileCheck class="h-3 w-3" aria-hidden="true" />
                {{ formatCount(data.objectiveLane.questions) }} soalan
              </span>
            </div>
          </div>
          <div
            class="rounded-2xl bg-gradient-to-br from-purple-600 to-fuchsia-700 p-4 text-white shadow-sm sm:p-6"
            data-testid="lane-bahasa"
          >
            <p class="text-xs font-bold tracking-wider text-purple-100 uppercase">
              Tracking A Bahasa
            </p>
            <h3 class="mt-1 font-heading text-lg font-extrabold text-white">
              BM dan BI format sebenar
            </h3>
            <p class="mt-1 text-sm text-purple-50">
              Lane khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ.
            </p>
            <div class="mt-3 flex flex-wrap gap-2">
              <span :class="[CHIP, 'bg-white/20 text-white']" data-testid="lane-badge"
                >{{ data.bahasaLane.subjects }} subjek</span
              >
              <span :class="[CHIP, 'bg-white/20 text-white']" data-testid="lane-sets">
                <Layers class="h-3 w-3" aria-hidden="true" />
                {{ formatCount(data.bahasaLane.sets) }} set
              </span>
              <span :class="[CHIP, 'bg-white/20 text-white']" data-testid="lane-paper">
                <Languages class="h-3 w-3" aria-hidden="true" />
                Paper-based tracking
              </span>
            </div>
          </div>
        </div>

        <!-- Admin readiness (admin only, BR-M06-30) -->
        <section
          v-if="data.readiness"
          class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-3 sm:p-6"
          data-testid="readiness"
        >
          <p class="text-xs font-bold tracking-wider text-amber-700 uppercase">Admin Readiness</p>
          <h2 class="mt-1 font-heading text-lg font-extrabold text-slate-800 sm:text-xl">
            Status set Tracking A SPM semasa
          </h2>
          <p class="mt-1 text-sm text-slate-600">
            Laporan ini bezakan set bersih, set bank besar, dan set yang masih lock supaya bacaan
            readiness lebih jujur.
          </p>
          <div class="mt-3 flex flex-wrap gap-2" data-testid="readiness-summary">
            <span :class="[CHIP, 'bg-emerald-100 text-emerald-700']"
              >Set Bersih: {{ data.readiness.summary.bersih }} set</span
            >
            <span :class="[CHIP, 'bg-blue-100 text-blue-700']"
              >Bank Besar: {{ data.readiness.summary.bankBesar }} set</span
            >
            <span :class="[CHIP, 'bg-amber-100 text-amber-800']"
              >Locked: {{ data.readiness.summary.locked }} set</span
            >
          </div>
          <div class="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="readiness-tiles">
            <article
              v-for="t in data.readiness.tiles"
              :key="t.code"
              class="min-w-0 rounded-xl border border-slate-100 bg-white p-3 sm:p-4"
              :data-testid="`tile-${t.code}`"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3
                    class="font-heading text-base font-extrabold break-words text-slate-800"
                    data-testid="tile-name"
                  >
                    {{ t.name }}
                  </h3>
                  <p class="text-xs break-words text-slate-500" data-testid="tile-target">
                    {{ tileTarget(t.code, t.targetSize) }}
                  </p>
                </div>
                <span
                  class="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-bold whitespace-nowrap text-slate-700"
                  data-testid="tile-badge"
                  >{{ t.bersih }}/{{ t.total }} set bersih</span
                >
              </div>
              <dl class="mt-3 grid grid-cols-4 gap-1.5 text-center">
                <div class="min-w-0 rounded-lg bg-emerald-50 px-1 py-2">
                  <dt class="text-xs text-slate-500">Set Bersih</dt>
                  <dd class="text-base font-extrabold text-emerald-700" data-testid="tile-bersih">
                    {{ t.bersih }}
                  </dd>
                </div>
                <div class="min-w-0 rounded-lg bg-blue-50 px-1 py-2">
                  <dt class="text-xs text-slate-500">Bank Besar</dt>
                  <dd class="text-base font-extrabold text-blue-700" data-testid="tile-bank">
                    {{ t.bankBesar }}
                  </dd>
                </div>
                <div class="min-w-0 rounded-lg bg-amber-50 px-1 py-2">
                  <dt class="text-xs text-slate-500">Locked</dt>
                  <dd class="text-base font-extrabold text-amber-700" data-testid="tile-locked">
                    {{ t.locked }}
                  </dd>
                </div>
                <div class="min-w-0 rounded-lg bg-purple-50 px-1 py-2">
                  <dt class="text-xs text-slate-500">Readiness</dt>
                  <dd class="text-base font-extrabold text-purple-700" data-testid="tile-readiness">
                    {{ t.readiness }}%
                  </dd>
                </div>
              </dl>
              <p
                v-if="t.hasBankBesar"
                class="mt-3 text-xs text-slate-600"
                data-testid="tile-bank-note"
              >
                Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. Rujuk page
                subjek untuk beza set bersih vs bank besar.
              </p>
              <div v-if="t.locked > 0" class="mt-3" data-testid="tile-locks">
                <p class="text-xs font-bold tracking-wider text-slate-500 uppercase">
                  Set Masih Lock
                </p>
                <div class="mt-1 flex flex-wrap gap-1.5">
                  <span
                    v-for="s in t.lockedSets"
                    :key="s.setNo"
                    :class="[CHIP, 'bg-amber-100 text-amber-800']"
                    data-testid="tile-lock-chip"
                    >{{ lockChip(s) }}</span
                  >
                </div>
              </div>
            </article>
          </div>
        </section>

        <!-- Bahasa section -->
        <section class="mb-6" data-testid="bahasa-section">
          <p class="text-xs font-bold tracking-wider text-purple-700 uppercase">
            Tracking A Bahasa
          </p>
          <div class="mt-1 flex flex-wrap items-center gap-2">
            <h2 class="font-heading text-lg font-extrabold text-slate-800 sm:text-xl">
              BM dan BI ikut format kertas sebenar
            </h2>
            <span :class="[CHIP, 'bg-purple-100 text-purple-700']" data-testid="bahasa-paper-pill"
              >Paper-based tracking</span
            >
          </div>
          <p class="mt-1 text-sm text-slate-600">
            Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan
            komponen sebenar peperiksaan.
          </p>
          <div class="mt-3 grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
            <RouterLink
              v-for="b in data.bahasa"
              :key="b.code"
              :to="bahasaHref(b.subjectId)"
              class="group flex min-h-11 flex-col gap-2 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              :data-testid="`bahasa-card-${b.code}`"
            >
              <div>
                <h3
                  class="font-heading text-base font-extrabold break-words text-slate-800"
                  data-testid="bahasa-name"
                >
                  {{ b.name }}
                </h3>
                <p class="text-xs text-slate-500" data-testid="bahasa-name-en">{{ b.nameEn }}</p>
              </div>
              <div class="flex flex-wrap gap-1.5">
                <span :class="[CHIP, 'bg-purple-50 text-purple-700']" data-testid="bahasa-sets"
                  >{{ formatCount(b.sets) }} set</span
                >
                <span :class="[CHIP, 'bg-slate-100 text-slate-700']"
                  >Berstruktur / respons sebenar</span
                >
              </div>
              <span
                class="inline-flex items-center gap-1 text-sm font-bold text-purple-700"
                data-testid="bahasa-cta"
              >
                Buka Tracking A Bahasa
                <ArrowRight class="h-4 w-4" aria-hidden="true" />
              </span>
            </RouterLink>
          </div>
        </section>

        <!-- Open objective subjects -->
        <section data-testid="open-section">
          <div
            data-testid="open-subjects"
            class="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            <RouterLink
              v-for="c in data.openSubjects"
              :key="c.code"
              :to="`/spm/ramalan/${c.code}`"
              class="group flex min-w-0 flex-col justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              :data-testid="`open-card-${c.code}`"
            >
              <div>
                <h3
                  class="font-heading text-base font-extrabold break-words text-slate-800"
                  data-testid="open-name"
                >
                  {{ c.name }}
                </h3>
                <p class="text-xs text-slate-500" data-testid="open-name-en">{{ c.nameEn }}</p>
                <div class="mt-3 flex flex-wrap gap-1.5" data-testid="open-chips">
                  <span :class="[CHIP, 'bg-purple-50 text-purple-700']" data-testid="chip-ready">
                    <FileText class="h-3 w-3" aria-hidden="true" />
                    {{ formatCount(c.readyQuestions) }} soalan kuiz siap guna
                  </span>
                  <span
                    v-if="c.bankBesarSets > 0"
                    :class="[CHIP, 'bg-blue-50 text-blue-700']"
                    data-testid="chip-bank"
                  >
                    <Layers class="h-3 w-3" aria-hidden="true" />
                    {{ c.bankBesarSets }} bank besar
                  </span>
                  <span
                    v-if="c.targetType !== null && c.bersihSets > 0"
                    :class="[CHIP, 'bg-emerald-50 text-emerald-700']"
                    data-testid="chip-bersih"
                  >
                    <CircleCheck class="h-3 w-3" aria-hidden="true" />
                    {{ c.bersihSets }} set bersih
                  </span>
                  <span
                    v-if="c.targetType !== null && c.targetSize !== null"
                    :class="[CHIP, 'bg-amber-50 text-amber-800']"
                    data-testid="chip-target"
                  >
                    <Target class="h-3 w-3" aria-hidden="true" />
                    {{ targetChip(c.targetType, c.targetSize) }}
                  </span>
                  <span
                    v-if="c.bankSource !== null"
                    :class="[CHIP, 'bg-slate-100 text-slate-700']"
                    data-testid="chip-source"
                  >
                    <Database class="h-3 w-3" aria-hidden="true" />
                    Bank source: {{ formatCount(c.bankSource) }}
                  </span>
                  <span :class="[CHIP, 'bg-slate-100 text-slate-700']" data-testid="chip-sets"
                    >{{ c.startableSets }} set</span
                  >
                </div>
              </div>
              <span
                class="flex items-center justify-between border-t border-slate-100 pt-2 text-sm font-bold text-purple-700"
                data-testid="open-footer"
              >
                Pilih Set
                <ChevronRight class="h-4 w-4" aria-hidden="true" />
              </span>
            </RouterLink>
          </div>
        </section>
      </template>
      <LoadError v-else-if="error" @retry="reload()" />
      <SkeletonCards v-else />
    </div>
  </div>
</template>
