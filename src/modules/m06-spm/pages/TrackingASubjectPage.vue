<script setup lang="ts">
/**
 * S6 `/spm/ramalan/:code` "Tracking A SPM — {Subjek}" (M06-T3; FR-M06-42, 48…50, BR-M06-08).
 *
 * Summary chips, h2 "Tracking A 2026" and the set cards: startable first (links to `?year=2026&set=n`,
 * which opens Q3), then locked (inert). A subject without sets shows the empty block. BM and BI answer
 * a redirect to S7 and are replaced at once; an unknown code is the global 404 page.
 */
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import {
  DsBackLink,
  DsEmptyState,
  DsIconChip,
  DsLoadError,
  DsCluster,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'
import { formatCount } from '@/lib/number'
import { subjectGlyph } from '@/modules/m05-practice'

import { fetchTrackingASubject, type TrackingASubject } from '../api'
import SkeletonCards from '../components/SkeletonCards.vue'
import { targetName } from '../lib/latih-tubi'
import { SET_STATUS, dskpLine, isStartable, setHref, setSize } from '../lib/tracking'
import { LOAD_ERROR } from '../lib/copy'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const {
  data: result,
  error,
  reload,
} = useApi((signal) => fetchTrackingASubject(code.value, { signal }), code)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// BM / BI: replace with the S7 URL (FR-M06-42).
watch(
  result,
  (r) => {
    if (r && 'redirect' in r) void router.replace(r.redirect)
  },
  { immediate: true },
)

const subject = computed<TrackingASubject | null>(() => {
  const r = result.value
  return r && !('redirect' in r) ? r : null
})

// DV-M06-07: tab title and header "Tracking A SPM — {Subjek}", no subtitle.
watch(
  subject,
  (s) => {
    if (!s) return
    pageMeta.setTitle(`Tracking A SPM — ${s.name}`)
    pageMeta.setHeader({ title: `Tracking A SPM — ${s.name}` })
  },
  { immediate: true },
)

const typeName = computed(() =>
  subject.value?.targetType ? targetName(subject.value.targetType) : '',
)
const hasTarget = computed(
  () => subject.value?.targetType != null && subject.value.targetSize != null,
)
const size = computed(() => setSize(subject.value?.targetSize ?? null))
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="tracking-subject-page">
    <template v-if="subject">
      <DsBackLink to="/spm/ramalan" label="Kembali" data-testid="spm-back" />

      <UCard data-testid="subject-hero">
        <DsCluster gap="md" :wrap="false">
          <DsIconChip :icon="subjectGlyph(subject.icon)" size="lg" data-testid="subject-icon" />
          <DsStack gap="2xs">
            <DsHeading :level="1" wrap="anywhere" data-testid="subject-title">
              {{ subject.name }}
            </DsHeading>
            <DsText variant="body" tone="muted" data-testid="subject-sub">
              Tracking A SPM<template v-if="hasTarget">
                · Target {{ typeName }} set: {{ subject.targetSize }} soalan</template
              >
            </DsText>
          </DsStack>
        </DsCluster>
      </UCard>

      <DsCluster gap="xs" align="stretch" data-testid="subject-summary">
        <UBadge
          color="success"
          variant="soft"
          size="lg"
          icon="i-ph-check-circle-bold"
          data-testid="sum-bersih"
          >{{ subject.summary.bersih }} set bersih</UBadge
        >
        <UBadge color="info" variant="soft" size="lg" icon="i-ph-stack-bold" data-testid="sum-bank"
          >{{ subject.summary.bankBesar }} set bank besar</UBadge
        >
        <UBadge
          color="secondary"
          variant="soft"
          size="lg"
          icon="i-ph-file-check-bold"
          data-testid="sum-ready"
          >{{ formatCount(subject.summary.readyQuestions) }} soalan kuiz siap guna</UBadge
        >
        <UBadge
          v-if="subject.summary.belumCukup > 0"
          color="warning"
          variant="soft"
          size="lg"
          icon="i-ph-lock-bold"
          data-testid="sum-locked"
          >{{ subject.summary.belumCukup }} set belum cukup</UBadge
        >
        <UBadge
          v-if="hasTarget"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-target-bold"
          data-testid="sum-target"
          >Target {{ typeName }}: {{ subject.targetSize }} / set</UBadge
        >
      </DsCluster>

      <template v-if="subject.sets.length > 0">
        <h2
          class="flex items-center gap-2 text-heading text-highlighted"
          data-testid="year-heading"
        >
          <UIcon
            name="i-ph-calendar-blank-duotone"
            class="size-6 text-primary-t"
            aria-hidden="true"
          />
          Tracking A 2026
        </h2>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4" data-testid="set-grid">
          <component
            :is="isStartable(s.status) ? RouterLink : 'div'"
            v-for="s in subject.sets"
            :key="s.setNo"
            v-bind="
              isStartable(s.status)
                ? { to: setHref(subject.code, s.setNo) }
                : { 'data-inert': 'true' }
            "
            :class="isStartable(s.status) ? 'block min-w-0' : 'pointer-events-none block min-w-0'"
            :data-testid="`set-card-${s.setNo}`"
            :data-status="s.status"
          >
            <UCard class="h-full" :ui="{ body: 'flex items-center gap-3 p-4' }">
              <div class="flex min-w-0 flex-1 flex-col gap-1">
                <DsCluster gap="xs">
                  <DsHeading :level="3" data-testid="set-title"> Set {{ s.setNo }} </DsHeading>
                  <UBadge
                    :color="SET_STATUS[s.status].color"
                    variant="soft"
                    data-testid="set-badge"
                    >{{ SET_STATUS[s.status].label }}</UBadge
                  >
                </DsCluster>
                <DsText variant="body" data-testid="set-ready">
                  {{ formatCount(s.readyCount) }} soalan kuiz siap guna
                </DsText>
                <DsText
                  v-if="hasTarget || !isStartable(s.status)"
                  variant="caption"
                  data-testid="set-format"
                >
                  Format set: {{ s.readyCount }} / {{ size }}
                </DsText>
                <DsText
                  v-if="s.status === 'bank_besar'"
                  variant="caption"
                  tone="info"
                  data-testid="set-bank"
                >
                  Bank source: {{ s.bankSource }}. Sistem tetap ambil {{ size }} soalan ikut
                  prioriti semasa.
                </DsText>
                <DsText
                  v-if="s.status === 'belum_cukup'"
                  variant="caption"
                  tone="warning"
                  data-testid="set-locked-note"
                >
                  Belum cukup soalan untuk format KPM.
                </DsText>
                <p
                  class="inline-flex items-center gap-1 text-caption text-muted"
                  data-testid="set-dskp"
                >
                  <UIcon name="i-ph-tag-bold" class="size-3.5" aria-hidden="true" />
                  {{ dskpLine(s) }}
                </p>
              </div>
              <DsIconChip
                :icon="isStartable(s.status) ? 'i-ph-play-bold' : 'i-ph-lock-bold'"
                :accent="isStartable(s.status) ? 'action' : 'trial'"
                size="sm"
                data-testid="set-tile"
              />
            </UCard>
          </component>
        </div>
      </template>
      <UCard v-else data-testid="subject-empty">
        <DsEmptyState
          title="Belum Ada Set Tracking A"
          description="Set Tracking A untuk subjek ini akan ditambah tidak lama lagi."
          icon="tray"
        />
      </UCard>
    </template>
    <DsLoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      testid="spm-error"
      retry-testid="spm-retry"
      @retry="reload()"
    />
    <SkeletonCards v-else-if="!notFound" :count="4" />
  </div>
</template>
