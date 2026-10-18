<script setup lang="ts">
/**
 * One of the 30 question blocks of S13 (FN-M09-5.2.5, FR-M09-69): heading "Soalan {n}", badge "KBAT
 * Audio", "Teks Soalan", "Pilihan A" to "Pilihan D", "Jawapan" (A, default), "Markah" (1–20,
 * default 1), "KBAT Level" (1–5, default 3), "DSKP SP ID" and "Skema / Penjelasan". Native
 * validation: question text, the four options and the answer are required. The four options sit in
 * one column below `md` and two from `md`. The state object belongs to the parent form.
 */
import { ANSWER_OPTIONS, type QuestionState } from '../../lib/admin-media/audio'
import AdminField from '../admin-kit/AdminField.vue'
import NativeSelect from '../admin-kit/native/NativeSelect.vue'

defineProps<{ no: number }>()

const question = defineModel<QuestionState>({ required: true })

const OPTIONS = [
  { key: 'optionA', name: 'option_a', label: 'Pilihan A' },
  { key: 'optionB', name: 'option_b', label: 'Pilihan B' },
  { key: 'optionC', name: 'option_c', label: 'Pilihan C' },
  { key: 'optionD', name: 'option_d', label: 'Pilihan D' },
] as const
</script>

<template>
  <UCard :ui="{ body: 'p-6' }" data-testid="question-block" :data-question-no="no">
    <div class="flex flex-col gap-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-label text-highlighted">Soalan {{ no }}</h3>
        <UBadge color="warning" variant="subtle" label="KBAT Audio" />
      </div>

      <AdminField :for="`q${String(no)}-text`" label="Teks Soalan">
        <UTextarea
          :id="`q${String(no)}-text`"
          v-model="question.questionText"
          :name="`questions[${String(no)}][question_text]`"
          required
          :rows="2"
          size="md"
          class="w-full"
          data-testid="q-text"
        />
      </AdminField>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <AdminField
          v-for="option in OPTIONS"
          :key="option.key"
          :for="`q${String(no)}-${option.key}`"
          :label="option.label"
        >
          <UInput
            :id="`q${String(no)}-${option.key}`"
            v-model="question[option.key]"
            type="text"
            :name="`questions[${String(no)}][${option.name}]`"
            required
            size="md"
            class="w-full"
            :data-testid="`q-${option.key}`"
          />
        </AdminField>
      </div>

      <div class="grid grid-cols-2 gap-6 md:grid-cols-4">
        <AdminField :for="`q${String(no)}-answer`" label="Jawapan">
          <NativeSelect
            :id="`q${String(no)}-answer`"
            v-model="question.correctAnswer"
            :name="`questions[${String(no)}][correct_answer]`"
            required
            data-testid="q-answer"
          >
            <option v-for="letter in ANSWER_OPTIONS" :key="letter" :value="letter">
              {{ letter }}
            </option>
          </NativeSelect>
        </AdminField>
        <AdminField :for="`q${String(no)}-marks`" label="Markah">
          <UInput
            :id="`q${String(no)}-marks`"
            v-model.number="question.marks"
            type="number"
            :name="`questions[${String(no)}][marks]`"
            min="1"
            max="20"
            size="md"
            class="w-full"
            data-testid="q-marks"
          />
        </AdminField>
        <AdminField :for="`q${String(no)}-kbat`" label="KBAT Level">
          <UInput
            :id="`q${String(no)}-kbat`"
            v-model.number="question.kbatLevel"
            type="number"
            :name="`questions[${String(no)}][kbat_level]`"
            min="1"
            max="5"
            size="md"
            class="w-full"
            data-testid="q-kbat"
          />
        </AdminField>
        <AdminField :for="`q${String(no)}-dskp`" label="DSKP SP ID">
          <UInput
            :id="`q${String(no)}-dskp`"
            v-model.number="question.dskpSpId"
            type="number"
            :name="`questions[${String(no)}][dskp_sp_id]`"
            placeholder="Optional"
            size="md"
            class="w-full"
            data-testid="q-dskp"
          />
        </AdminField>
      </div>

      <AdminField :for="`q${String(no)}-explanation`" label="Skema / Penjelasan">
        <UTextarea
          :id="`q${String(no)}-explanation`"
          v-model="question.explanation"
          :name="`questions[${String(no)}][explanation]`"
          :rows="2"
          size="md"
          class="w-full"
          data-testid="q-explanation"
        />
      </AdminField>
    </div>
  </UCard>
</template>
