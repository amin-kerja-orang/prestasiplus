<script setup lang="ts">
/**
 * Layout and typography primitives (v2-ds-hardening section 3) plus the `DsPage` archetypes in the
 * `/__ds` gallery. Dev / demo only; sample copy is BM. Renders in whatever personality and scheme
 * the surrounding `DsThemeScope` sets, so each block shows in both personalities and both modes.
 */
import { ref } from 'vue'

import {
  DsCluster,
  DsGrid,
  DsGridItem,
  DsHeading,
  DsPage,
  DsSection,
  DsSpacer,
  DsSplit,
  DsStack,
  DsStateView,
  DsSurface,
  DsText,
  type DsPageLayout,
  type DsTextRole,
} from '@/ds'

const roles: DsTextRole[] = [
  'display',
  'title',
  'heading',
  'subheading',
  'body',
  'body-strong',
  'label',
  'caption',
  'meta',
  'overline',
  'kpi',
]
const archetypes: DsPageLayout[] = ['list', 'form', 'report', 'dashboard', 'detail', 'learner']
const stateStatus = ref<'loading' | 'error' | 'empty' | 'ready'>('ready')
const statuses = ['loading', 'error', 'empty', 'ready'] as const
const selected = ref(true)
</script>

<template>
  <DsStack gap="xl" data-testid="ds-primitives">
    <DsSection title="Primitif susun atur dan tipografi" :level="3" variant="subheading">
      <DsStack gap="lg">
        <DsStack gap="xs" data-testid="ds-prim-text">
          <DsHeading :level="4">DsText, DsHeading</DsHeading>
          <DsText v-for="r in roles" :key="r" :variant="r">{{ r }}: Latihan Matematik Tahun 5</DsText>
          <DsText variant="body" tone="muted" truncate>Teks panjang dipotong dengan elipsis apabila ruang tidak cukup untuk memaparkan seluruh ayat ini.</DsText>
          <DsText variant="body" :clamp="2">Teks dua baris maksimum. Latihan harian membantu murid mengukuhkan kemahiran asas sebelum peperiksaan, dan guru boleh menjejak kemajuan setiap murid dengan mudah.</DsText>
          <DsCluster gap="sm">
            <DsText v-for="t in ['primary', 'success', 'warning', 'error', 'info'] as const" :key="t" variant="label" :tone="t">{{ t }}</DsText>
          </DsCluster>
        </DsStack>

        <DsStack gap="xs" data-testid="ds-prim-stack">
          <DsHeading :level="4">DsStack, DsCluster, DsSpacer</DsHeading>
          <DsCluster gap="sm">
            <UButton label="Satu" />
            <UButton label="Dua" color="neutral" variant="soft" />
            <DsSpacer />
            <UButton label="Hujung" color="neutral" variant="soft" />
          </DsCluster>
          <DsCluster stack-below="md" gap="sm">
            <UButton label="Tindakan 1" />
            <UButton label="Tindakan 2" color="neutral" variant="soft" />
          </DsCluster>
          <DsStack gap="xs">
            <DsSurface level="soft" padding="sm">Item 1</DsSurface>
            <DsSurface level="soft" padding="sm">Item 2</DsSurface>
          </DsStack>
        </DsStack>

        <DsStack gap="xs" data-testid="ds-prim-grid">
          <DsHeading :level="4">DsGrid, DsGridItem, DsSplit</DsHeading>
          <DsGrid :cols="{ base: 1, sm: 2, xl: 3 }" gap="sm">
            <DsGridItem v-for="n in 5" :key="n"><DsSurface level="soft" padding="sm">Sel {{ n }}</DsSurface></DsGridItem>
          </DsGrid>
          <DsGrid min-item="xs" gap="sm">
            <DsGridItem v-for="n in 4" :key="n"><DsSurface level="elevated" padding="sm">Auto {{ n }}</DsSurface></DsGridItem>
          </DsGrid>
          <DsSplit stack-below="lg" gap="md">
            <DsSurface padding="md">Utama (8)</DsSurface>
            <template #aside><DsSurface level="soft" padding="md">Sisi (4)</DsSurface></template>
          </DsSplit>
        </DsStack>

        <DsStack gap="xs" data-testid="ds-prim-surface">
          <DsHeading :level="4">DsSurface (lapisan, bersarang, keadaan)</DsHeading>
          <DsGrid min-item="sm" gap="sm">
            <DsSurface level="raised">raised<DsSurface level="soft" padding="sm">bersarang (radius auto)</DsSurface></DsSurface>
            <DsSurface level="elevated">elevated</DsSurface>
            <DsSurface level="soft">soft</DsSurface>
            <DsSurface level="accented">accented</DsSurface>
            <DsSurface level="inverted">inverted</DsSurface>
            <DsSurface tone="primary">tone primary</DsSurface>
            <DsSurface tone="success" emphasis="strong">success kuat</DsSurface>
          </DsGrid>
          <DsText variant="overline">Matriks keadaan</DsText>
          <DsGrid min-item="xs" gap="sm" data-testid="ds-surface-states">
            <DsSurface type="button" interactive @click="selected = !selected">interactive</DsSurface>
            <DsSurface type="button" interactive :selected="selected">selected</DsSurface>
            <DsSurface interactive disabled>disabled</DsSurface>
            <DsSurface loading>
              loading
              <template #skeleton><USkeleton class="h-6 w-full" /></template>
            </DsSurface>
            <DsSurface invalid>invalid</DsSurface>
          </DsGrid>
        </DsStack>

        <DsStack gap="xs" data-testid="ds-prim-state-view">
          <DsHeading :level="4">DsStateView</DsHeading>
          <DsCluster gap="xs">
            <UButton
              v-for="s in statuses"
              :key="s"
              size="sm"
              :variant="stateStatus === s ? 'solid' : 'soft'"
              color="neutral"
              :label="s"
              @click="stateStatus = s"
            />
          </DsCluster>
          <DsSurface>
            <DsStateView
              :status="stateStatus"
              error="Tidak dapat memuatkan data."
              item="soalan"
              skeleton="list"
              :rows="3"
              @retry="stateStatus = 'loading'"
            >
              <DsText variant="body">Data sedia dipaparkan.</DsText>
            </DsStateView>
          </DsSurface>
        </DsStack>

        <DsStack gap="xs" data-testid="ds-prim-page">
          <DsHeading :level="4">DsPage layout (arketaip)</DsHeading>
          <DsGrid :cols="{ base: 1, md: 2 }" gap="sm">
            <DsSurface v-for="a in archetypes" :key="a" level="soft" padding="sm">
              <DsPage :layout="a" :show-title="false" title="Tajuk" gap="sm" :data-testid="`ds-page-${a}`">
                <DsText variant="label">layout="{{ a }}"</DsText>
                <DsSurface level="raised" padding="sm">kandungan</DsSurface>
              </DsPage>
            </DsSurface>
          </DsGrid>
        </DsStack>
      </DsStack>
    </DsSection>
  </DsStack>
</template>
