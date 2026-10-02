<script setup lang="ts">
/**
 * One of the 30 question blocks of S13 (FN-M09-5.2.5, FR-M09-69): heading "Soalan {n}", pill "KBAT
 * Audio", "Teks Soalan", "Pilihan A" to "Pilihan D", "Jawapan" (A, default), "Markah" (1–20,
 * default 1), "KBAT Level" (1–5, default 3), "DSKP SP ID" and "Skema / Penjelasan". Native
 * validation: question text, the four options and the answer are required. The four options sit in
 * one column below `md` and two from `md`. The state object belongs to the parent form.
 */
import { INPUT_CLASS, LABEL_CLASS } from '../../lib/admin-media/common'
import { ANSWER_OPTIONS, type QuestionState } from '../../lib/admin-media/audio'

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
  <section
    class="space-y-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5"
    data-testid="question-block"
    :data-question-no="no"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="font-heading text-base font-bold text-slate-800">Soalan {{ no }}</h3>
      <span class="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700"
        >KBAT Audio</span
      >
    </div>

    <div>
      <label :for="`q${String(no)}-text`" :class="LABEL_CLASS">Teks Soalan</label>
      <textarea
        :id="`q${String(no)}-text`"
        v-model="question.questionText"
        :name="`questions[${String(no)}][question_text]`"
        required
        rows="2"
        :class="INPUT_CLASS"
        data-testid="q-text"
      ></textarea>
    </div>

    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div v-for="option in OPTIONS" :key="option.key">
        <label :for="`q${String(no)}-${option.key}`" :class="LABEL_CLASS">{{ option.label }}</label>
        <input
          :id="`q${String(no)}-${option.key}`"
          v-model="question[option.key]"
          type="text"
          :name="`questions[${String(no)}][${option.name}]`"
          required
          :class="INPUT_CLASS"
          :data-testid="`q-${option.key}`"
        />
      </div>
    </div>

    <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
      <div>
        <label :for="`q${String(no)}-answer`" :class="LABEL_CLASS">Jawapan</label>
        <select
          :id="`q${String(no)}-answer`"
          v-model="question.correctAnswer"
          :name="`questions[${String(no)}][correct_answer]`"
          required
          :class="INPUT_CLASS"
          data-testid="q-answer"
        >
          <option v-for="letter in ANSWER_OPTIONS" :key="letter" :value="letter">
            {{ letter }}
          </option>
        </select>
      </div>
      <div>
        <label :for="`q${String(no)}-marks`" :class="LABEL_CLASS">Markah</label>
        <input
          :id="`q${String(no)}-marks`"
          v-model.number="question.marks"
          type="number"
          :name="`questions[${String(no)}][marks]`"
          min="1"
          max="20"
          :class="INPUT_CLASS"
          data-testid="q-marks"
        />
      </div>
      <div>
        <label :for="`q${String(no)}-kbat`" :class="LABEL_CLASS">KBAT Level</label>
        <input
          :id="`q${String(no)}-kbat`"
          v-model.number="question.kbatLevel"
          type="number"
          :name="`questions[${String(no)}][kbat_level]`"
          min="1"
          max="5"
          :class="INPUT_CLASS"
          data-testid="q-kbat"
        />
      </div>
      <div>
        <label :for="`q${String(no)}-dskp`" :class="LABEL_CLASS">DSKP SP ID</label>
        <input
          :id="`q${String(no)}-dskp`"
          v-model.number="question.dskpSpId"
          type="number"
          :name="`questions[${String(no)}][dskp_sp_id]`"
          placeholder="Optional"
          :class="INPUT_CLASS"
          data-testid="q-dskp"
        />
      </div>
    </div>

    <div>
      <label :for="`q${String(no)}-explanation`" :class="LABEL_CLASS">Skema / Penjelasan</label>
      <textarea
        :id="`q${String(no)}-explanation`"
        v-model="question.explanation"
        :name="`questions[${String(no)}][explanation]`"
        rows="2"
        :class="INPUT_CLASS"
        data-testid="q-explanation"
      ></textarea>
    </div>
  </section>
</template>
