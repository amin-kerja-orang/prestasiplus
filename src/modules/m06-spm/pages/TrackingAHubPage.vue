<script setup lang="ts">
/**
 * S5 `/spm/ramalan` "Tracking A SPM" (M06-T3; FR-M06-35…41, BR-M06-09…11, BR-M06-30), restyled for v2.
 *
 * Two lane cards, the "Kesediaan Admin" card (rendered only when the server sends it: admin only), the
 * "Tracking A Bahasa" section (BM and BI → S7) and one card per open objective subject → S6. The cards
 * and chips replicate the live copy; icons are Phosphor stand-ins for the Font Awesome names.
 */
import { RouterLink } from 'vue-router'

import { useApi } from '@/composables'
import { DsBackLink, DsCharacterCard, DsIconChip, DsPage, DsPanel, DsLoadError } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchTrackingAHub } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import { bahasaHref, lockChip, targetChip, tileTarget } from '../lib/tracking'
import { LOAD_ERROR } from '../lib/copy'

const { data, error, reload } = useApi((signal) => fetchTrackingAHub({ signal }))
</script>

<template>
  <DsPage
    title="Tracking A SPM"
    subtitle="Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!"
    :show-title="true"
    title-testid="spm-heading"
    subtitle-testid="spm-sub"
    data-testid="tracking-hub-page"
  >
    <template #breadcrumb>
      <DsBackLink to="/spm" label="Kembali ke Mod SPM" data-testid="spm-back" />
    </template>
    <template #meta>
      <UBadge
        color="secondary"
        variant="soft"
        icon="i-ph-magic-wand-duotone"
        size="lg"
        data-testid="tracking-pill"
        >TRACKING A</UBadge
      >
    </template>

    <template v-if="data">
      <!-- Lanes -->
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4" data-testid="lanes">
        <DsCharacterCard
          accent="action"
          art="rocket"
          title="Subjek objektif penuh"
          description="Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set."
          data-testid="lane-objektif"
        >
          <p class="text-overline text-primary-t">Tracking A Objektif</p>
          <div class="flex flex-wrap gap-2">
            <UBadge color="neutral" variant="soft" data-testid="lane-badge"
              >{{ data.objectiveLane.subjects }} subjek</UBadge
            >
            <UBadge color="neutral" variant="soft" icon="i-ph-stack-bold" data-testid="lane-sets"
              >{{ formatCount(data.objectiveLane.sets) }} set</UBadge
            >
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-ph-file-text-bold"
              data-testid="lane-questions"
              >{{ formatCount(data.objectiveLane.questions) }} soalan</UBadge
            >
          </div>
        </DsCharacterCard>
        <DsCharacterCard
          accent="friend"
          art="books"
          title="BM dan BI format sebenar"
          description="Laluan khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ."
          data-testid="lane-bahasa"
        >
          <p class="text-overline text-primary-t">Tracking A Bahasa</p>
          <div class="flex flex-wrap gap-2">
            <UBadge color="neutral" variant="soft" data-testid="lane-badge"
              >{{ data.bahasaLane.subjects }} subjek</UBadge
            >
            <UBadge color="neutral" variant="soft" icon="i-ph-stack-bold" data-testid="lane-sets"
              >{{ formatCount(data.bahasaLane.sets) }} set</UBadge
            >
            <UBadge
              color="neutral"
              variant="soft"
              icon="i-ph-translate-bold"
              data-testid="lane-paper"
              >Penjejakan berasaskan kertas</UBadge
            >
          </div>
        </DsCharacterCard>
      </div>

      <!-- Admin readiness (admin only, BR-M06-30) -->
      <DsPanel
        v-if="data.readiness"
        title="Status set Tracking A SPM semasa"
        description="Laporan ini membezakan set bersih, set bank besar dan set yang masih terkunci supaya bacaan kesediaan lebih jujur."
        icon="i-ph-gauge-duotone"
        accent="trial"
        data-testid="readiness"
      >
        <div class="flex flex-col gap-4">
          <p class="text-overline text-warning">Kesediaan Admin</p>
          <div class="flex flex-wrap gap-2" data-testid="readiness-summary">
            <UBadge color="success" variant="soft"
              >Set Bersih: {{ data.readiness.summary.bersih }} set</UBadge
            >
            <UBadge color="info" variant="soft"
              >Bank Besar: {{ data.readiness.summary.bankBesar }} set</UBadge
            >
            <UBadge color="warning" variant="soft"
              >Locked: {{ data.readiness.summary.locked }} set</UBadge
            >
          </div>
          <div class="grid grid-cols-1 gap-3 lg:grid-cols-2" data-testid="readiness-tiles">
            <UCard
              v-for="t in data.readiness.tiles"
              :key="t.code"
              variant="subtle"
              class="min-w-0"
              :ui="{ body: 'flex flex-col gap-3 p-3' }"
              :data-testid="`tile-${t.code}`"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <h3 class="text-subheading break-words text-highlighted" data-testid="tile-name">
                    {{ t.name }}
                  </h3>
                  <p class="text-caption break-words text-muted" data-testid="tile-target">
                    {{ tileTarget(t.code, t.targetSize) }}
                  </p>
                </div>
                <UBadge color="neutral" variant="subtle" class="shrink-0" data-testid="tile-badge"
                  >{{ t.bersih }}/{{ t.total }} set bersih</UBadge
                >
              </div>
              <dl class="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div class="min-w-0">
                  <dt class="text-caption text-muted">Set Bersih</dt>
                  <dd class="tabular text-heading text-success" data-testid="tile-bersih">
                    {{ t.bersih }}
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-caption text-muted">Bank Besar</dt>
                  <dd class="tabular text-heading text-info" data-testid="tile-bank">
                    {{ t.bankBesar }}
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-caption text-muted">Terkunci</dt>
                  <dd class="tabular text-heading text-warning" data-testid="tile-locked">
                    {{ t.locked }}
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-caption text-muted">Kesediaan</dt>
                  <dd class="tabular text-heading text-primary-t" data-testid="tile-readiness">
                    {{ t.readiness }}%
                  </dd>
                </div>
              </dl>
              <p v-if="t.hasBankBesar" class="text-caption text-muted" data-testid="tile-bank-note">
                Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. Rujuk halaman
                subjek untuk perbezaan set bersih berbanding bank besar.
              </p>
              <div v-if="t.locked > 0" class="flex flex-col gap-1" data-testid="tile-locks">
                <p class="text-overline text-muted">Set Masih Terkunci</p>
                <div class="flex flex-wrap gap-2">
                  <UBadge
                    v-for="s in t.lockedSets"
                    :key="s.setNo"
                    color="warning"
                    variant="soft"
                    data-testid="tile-lock-chip"
                    >{{ lockChip(s) }}</UBadge
                  >
                </div>
              </div>
            </UCard>
          </div>
        </div>
      </DsPanel>

      <!-- Bahasa section -->
      <section class="flex flex-col gap-3" data-testid="bahasa-section">
        <div class="flex flex-col gap-1">
          <p class="text-overline text-primary-t">Tracking A Bahasa</p>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-heading text-highlighted">BM dan BI ikut format kertas sebenar</h2>
            <UBadge color="secondary" variant="soft" data-testid="bahasa-paper-pill"
              >Penjejakan berasaskan kertas</UBadge
            >
          </div>
          <p class="text-body text-muted">
            Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan
            komponen sebenar peperiksaan.
          </p>
        </div>
        <ul class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
          <li v-for="b in data.bahasa" :key="b.code" class="min-w-0">
            <RouterLink
              :to="bahasaHref(b.subjectId)"
              class="block h-full"
              :data-testid="`bahasa-card-${b.code}`"
            >
              <UCard
                class="h-full"
                :ui="{ body: 'flex h-full flex-col gap-3 p-4' }"
              >
                <div class="flex items-center gap-3">
                  <DsIconChip icon="translate" accent="friend" size="lg" />
                  <div class="min-w-0">
                    <h3 class="text-subheading break-words text-highlighted" data-testid="bahasa-name">
                      {{ b.name }}
                    </h3>
                    <p class="text-caption text-muted" data-testid="bahasa-name-en">
                      {{ b.nameEn }}
                    </p>
                  </div>
                </div>
                <div class="flex flex-wrap gap-2">
                  <UBadge color="secondary" variant="soft" data-testid="bahasa-sets"
                    >{{ formatCount(b.sets) }} set</UBadge
                  >
                  <UBadge color="neutral" variant="soft">Berstruktur / respons sebenar</UBadge>
                </div>
                <span
                  class="mt-auto inline-flex items-center gap-1 text-label text-primary-t"
                  data-testid="bahasa-cta"
                >
                  Buka Tracking A Bahasa
                  <UIcon name="i-ph-arrow-right-bold" class="size-4" aria-hidden="true" />
                </span>
              </UCard>
            </RouterLink>
          </li>
        </ul>
      </section>

      <!-- Open objective subjects -->
      <section data-testid="open-section">
        <ul
          data-testid="open-subjects"
          class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3"
        >
          <li v-for="c in data.openSubjects" :key="c.code" class="min-w-0">
            <RouterLink
              :to="`/spm/ramalan/${c.code}`"
              class="block h-full"
              :data-testid="`open-card-${c.code}`"
            >
              <UCard
                class="h-full"
                :ui="{ body: 'flex h-full flex-col justify-between gap-3 p-4' }"
              >
                <div class="flex flex-col gap-3">
                  <div class="flex items-center gap-3">
                    <DsIconChip icon="target" accent="action" size="lg" />
                    <div class="min-w-0">
                      <h3 class="text-subheading break-words text-highlighted" data-testid="open-name">
                        {{ c.name }}
                      </h3>
                      <p class="text-caption text-muted" data-testid="open-name-en">
                        {{ c.nameEn }}
                      </p>
                    </div>
                  </div>
                  <div class="flex flex-wrap gap-2" data-testid="open-chips">
                    <UBadge
                      color="secondary"
                      variant="soft"
                      icon="i-ph-file-text-bold"
                      data-testid="chip-ready"
                      >{{ formatCount(c.readyQuestions) }} soalan kuiz siap guna</UBadge
                    >
                    <UBadge
                      v-if="c.bankBesarSets > 0"
                      color="info"
                      variant="soft"
                      icon="i-ph-stack-bold"
                      data-testid="chip-bank"
                      >{{ c.bankBesarSets }} bank besar</UBadge
                    >
                    <UBadge
                      v-if="c.targetType !== null && c.bersihSets > 0"
                      color="success"
                      variant="soft"
                      icon="i-ph-check-circle-bold"
                      data-testid="chip-bersih"
                      >{{ c.bersihSets }} set bersih</UBadge
                    >
                    <UBadge
                      v-if="c.targetType !== null && c.targetSize !== null"
                      color="warning"
                      variant="soft"
                      icon="i-ph-target-bold"
                      data-testid="chip-target"
                      >{{ targetChip(c.targetType, c.targetSize) }}</UBadge
                    >
                    <UBadge
                      v-if="c.bankSource !== null"
                      color="neutral"
                      variant="soft"
                      icon="i-ph-database-bold"
                      data-testid="chip-source"
                      >Bank source: {{ formatCount(c.bankSource) }}</UBadge
                    >
                    <UBadge color="neutral" variant="soft" data-testid="chip-sets"
                      >{{ c.startableSets }} set</UBadge
                    >
                  </div>
                </div>
                <span
                  class="flex items-center justify-between pt-1 text-label text-primary-t"
                  data-testid="open-footer"
                >
                  Pilih Set
                  <UIcon name="i-ph-caret-right-bold" class="size-4" aria-hidden="true" />
                </span>
              </UCard>
            </RouterLink>
          </li>
        </ul>
      </section>
    </template>
    <DsLoadError v-else-if="error" :message="LOAD_ERROR" testid="spm-error" retry-testid="spm-retry" @retry="reload()" />
    <SkeletonCards v-else />
  </DsPage>
</template>
