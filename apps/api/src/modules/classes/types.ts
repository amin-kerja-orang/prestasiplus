import type {
  ClassEnrolmentSchema,
  ClassJoinedClassSchema,
  TeacherChapterOptionSchema,
  TeacherStudentSchema,
  TeacherTopicOptionSchema,
} from '@pp/contract'
import type { z } from 'zod'

/** Wire shapes of the contract that it does not export as types. */
export type ClassEnrolment = z.output<typeof ClassEnrolmentSchema>
export type ClassJoinedClass = z.output<typeof ClassJoinedClassSchema>
export type TeacherChapterOption = z.output<typeof TeacherChapterOptionSchema>
export type TeacherStudent = z.output<typeof TeacherStudentSchema>
export type TeacherTopicOption = z.output<typeof TeacherTopicOptionSchema>
