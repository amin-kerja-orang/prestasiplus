<script setup lang="ts">
/**
 * http mode only (D59b): the one-time credentials the server generated for the accounts an admin just created
 * (S2 create, S3 password reset, S4 bulk import). Same block and BM copy as M27 `PupilCredentialBlock`
 * ("Maklumat log masuk {who} - catat sekarang, ia tidak akan dipaparkan semula."): the password is held in
 * component memory only, never persisted or logged, and a reload shows nothing.
 *
 * One account without a `line` is a name / e-mail / password list; rows with a `line` (the import) are one card
 * per row.
 */
import { computed } from 'vue'

import { DsGrid, DsPanel, DsStack, DsText } from '@/ds'

import type { CredentialRow } from '../lib/credential-row'

const props = withDefaults(defineProps<{ rows: CredentialRow[]; who?: string }>(), {
  who: 'pengguna',
})

const single = computed(() => props.rows.length === 1 && props.rows[0]?.line === undefined)
const first = computed(() => props.rows[0])
</script>

<template>
  <DsPanel data-testid="generated-credentials">
    <DsStack>
      <UAlert
        color="warning"
        variant="subtle"
        icon="i-ph-key"
        :title="`Maklumat log masuk ${who} — catat sekarang, ia tidak akan dipaparkan semula.`"
      />
      <DsGrid v-if="single && first" as="div" :cols="{ base: 1, sm: 2 }" gap="sm">
        <template v-if="first.name">
          <DsText as="span" variant="label" tone="muted">Nama:</DsText>
          <DsText as="div" variant="body" wrap="anywhere" data-testid="credential-name">
            {{ first.name }}
          </DsText>
        </template>
        <DsText as="span" variant="label" tone="muted">Emel:</DsText>
        <DsText as="div" variant="body" wrap="anywhere" data-testid="credential-email">
          {{ first.email }}
        </DsText>
        <DsText as="span" variant="label" tone="muted">Kata laluan:</DsText>
        <DsText as="div" variant="body" wrap="anywhere" tabular data-testid="credential-password">
          {{ first.password }}
        </DsText>
      </DsGrid>
      <DsStack v-else as="ul" data-testid="credential-table">
        <li v-for="row in rows" :key="`${row.line ?? 0}-${row.email}`" data-testid="credential-row">
          <DsPanel tone="inset">
            <DsGrid :cols="{ base: 1, sm: 2 }" gap="sm">
              <DsText as="span" variant="label" tone="muted">Baris:</DsText>
              <DsText as="div" variant="body" tabular>{{ row.line }}</DsText>
              <DsText as="span" variant="label" tone="muted">Emel:</DsText>
              <DsText as="div" variant="body" wrap="anywhere" data-testid="credential-row-email">
                {{ row.email }}
              </DsText>
              <DsText as="span" variant="label" tone="muted">Kata laluan:</DsText>
              <DsText
                as="div"
                variant="body"
                wrap="anywhere"
                tabular
                data-testid="credential-row-password"
              >
                {{ row.password }}
              </DsText>
            </DsGrid>
          </DsPanel>
        </li>
      </DsStack>
    </DsStack>
  </DsPanel>
</template>
