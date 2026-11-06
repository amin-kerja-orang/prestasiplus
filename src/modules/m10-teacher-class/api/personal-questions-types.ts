/**
 * API-GUR-24 "Soalan & Rujukan" (PRD-60 2.17.2): the teacher's personal MCQ with an optional reference link.
 * Separate from `types.ts` (S6-T16 owns it). The response id fields are numbers in the mock and opaque strings in
 * http mode (`wireId`); the UI keeps whatever the API returned.
 */

/** Aras Pemikiran as the API sends it (the same six words as the bank form). */
export type PersonalCognitiveLevel = string

/** One option of the wire shape (exactly four). */
export interface PersonalOption {
  text: string
}

/**
 * `PersonalQuestion` (PRD-60 2.17.2). `GET /:id` returns the same shape (lead ruling 7 on #492), so the list row and
 * the detail are one type. The "Tahap" column of the list is the name of `educationLevelId`, looked up beside the list.
 */
export interface PersonalQuestion {
  id: number
  subjectId: number
  subjectName: string
  /** Tingkatan 1 to 5, required. */
  educationLevelId: number
  difficulty: number
  text: string
  chapterId: number | null
  /** 0 to 3 SP ids. */
  spIds: number[]
  tp: number | null
  cognitiveLevel: PersonalCognitiveLevel | null
  options: PersonalOption[]
  correctIndex: number
  referenceUrl: string | null
  /** ISO 8601 with +08:00. */
  createdAt: string
}

/** The body of `POST` and `PUT` (the PersonalQuestion without id, subjectName and createdAt). */
export interface PersonalQuestionRequest {
  subjectId: number
  educationLevelId: number
  chapterId?: number
  spIds?: number[]
  tp?: number
  cognitiveLevel?: PersonalCognitiveLevel
  difficulty: number
  text: string
  options: PersonalOption[]
  correctIndex: number
  referenceUrl?: string
}
