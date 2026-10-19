<script setup lang="ts">
/**
 * S5 `/cikgu/essay/baharu` essay form (FR-M13-51..55; URS FT-M13-4.2). Client only: "Hantar ke Cikgu
 * Alesa" (`type=button`) trims the fields, alerts when the essay is under 50 characters, otherwise
 * stores the essay in `sessionStorage.cikgu_pending_essay` and opens S1 with the hand-off query. The
 * form has no action and no control has a `name`; Enter does nothing (no submit button).
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { alertNative } from '@/composables'
import { DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsPage } from '@/ds'

import { RUBRICS } from '../api'
import { PENDING_ESSAY_KEY } from '../components/chat/chat-lib'
import { ESSAY_COPY as C } from '../components/teacher/copy'
import { handoffQuery, wordCount } from '../components/teacher/lib'

const router = useRouter()

const rubric = ref(RUBRICS[0]?.key ?? 'spm_bm_karangan')
const subject = ref('')
const level = ref('')
const student = ref('')
const title = ref('')
const essay = ref('')

const words = computed(() => wordCount(essay.value))

function submitToChat(): void {
  const text = essay.value.trim()
  if (text.length < 50) {
    alertNative(C.tooShort)
    return
  }
  try {
    sessionStorage.setItem(PENDING_ESSAY_KEY, text)
  } catch {
    /* storage unavailable: S1 then opens with an empty input (as without a stored essay) */
  }
  void router.push(
    `/cikgu?${handoffQuery({
      rubric: rubric.value,
      subject: subject.value.trim(),
      level: level.value.trim(),
      student: student.value.trim(),
      title: title.value.trim(),
    })}`,
  )
}
</script>

<template>
  <DsPage class="max-w-4xl" :title="C.formTitle" data-testid="essay-form-page">
    <template #breadcrumb>
      <div>
        <UButton
          to="/cikgu/essay"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          data-testid="essay-back"
          >{{ C.back }}</UButton
        >
      </div>
    </template>
    <template #subtitle>
      {{ C.intro }} Klik <strong>{{ C.introBold }}</strong> {{ C.introAfter }}
    </template>

    <form id="essay-form" class="flex flex-col gap-6" @submit.prevent>
      <DsFormSection
        title="Maklumat Karangan"
        description="Rubric, subjek, tahap, nama pelajar dan tajuk."
        icon="pen-nib"
        :columns="2"
      >
        <DsFormField native for="rubric_key" :label="C.rubric">
          <template #default="{ id }">
            <DsNativeSelect :id="id" v-model="rubric">
              <option v-for="r in RUBRICS" :key="r.key" :value="r.key">{{ r.label }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <DsFormField native for="subject_name" :label="C.subject">
          <template #default="{ id }">
            <UInput
              :id="id"
              v-model="subject"
              type="text"
              :placeholder="C.subjectPh"
              class="w-full"
            />
          </template>
        </DsFormField>
        <DsFormField native for="level" :label="C.level">
          <template #default="{ id }">
            <UInput :id="id" v-model="level" type="text" :placeholder="C.levelPh" class="w-full" />
          </template>
        </DsFormField>
        <DsFormField native for="student_name" :label="C.student">
          <template #default="{ id }">
            <UInput :id="id" v-model="student" type="text" class="w-full" />
          </template>
        </DsFormField>
        <div class="sm:col-span-2">
          <DsFormField native for="essay_title" :label="C.essayTitle">
            <template #default="{ id }">
              <UInput :id="id" v-model="title" type="text" class="w-full" />
            </template>
          </DsFormField>
        </div>
      </DsFormSection>

      <DsFormSection
        title="Teks Karangan"
        description="Salin dan tampal karangan pelajar (minimum 50 aksara)."
        icon="i-ph-article"
      >
        <DsFormField native for="essay_text" :label="C.essayText">
          <template #default="{ id }">
            <UTextarea
              :id="id"
              v-model="essay"
              :rows="14"
              required
              minlength="50"
              :placeholder="C.essayPh"
              class="w-full"
            />
            <p id="word-counter" class="text-caption text-muted">{{ words }} perkataan</p>
          </template>
        </DsFormField>
      </DsFormSection>

      <UAlert color="warning" variant="subtle" icon="i-ph-info-duotone" data-testid="essay-amber">
        <template #description>
          <strong>{{ C.amberBold }}</strong> {{ C.amber }}
        </template>
      </UAlert>

      <DsFormBar :cancel-label="C.cancel" cancel-to="/cikgu/essay">
        <template #submit>
          <UButton
            id="essay-submit"
            type="button"
            icon="i-ph-robot"
            class="min-h-11"
            :label="C.submit"
            @click="submitToChat"
          />
        </template>
      </DsFormBar>
    </form>
  </DsPage>
</template>
