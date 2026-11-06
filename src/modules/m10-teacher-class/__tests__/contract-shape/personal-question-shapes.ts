/**
 * The server shape of API-GUR-24 mirrored from PRD-60 2.17.2 (`PersonalQuestion` and its create / update body). The
 * contract package has no schema for it yet (the BE is blocked on S6-T16's schema request), so it is written out here;
 * once `packages/contract` has it, replace this file by an import. Ids are opaque strings on the wire (`GuruId`).
 */
import { z } from 'zod'

const COGNITIVE = [
  'mengingat',
  'memahami',
  'mengaplikasi',
  'menganalisis',
  'menilai',
  'mencipta',
] as const
const GuruId = z.string().trim().min(1).max(64)

/** POST and PUT: `PersonalQuestion` without id, subjectName and createdAt. */
export const PersonalQuestionRequestSchema = z
  .object({
    subjectId: GuruId,
    educationLevelId: GuruId,
    chapterId: GuruId.nullable().optional(),
    spIds: z.array(GuruId).min(1).max(3).optional(),
    tp: z.number().int().min(1).max(6).nullable().optional(),
    cognitiveLevel: z.enum(COGNITIVE).nullable().optional(),
    difficulty: z.number().int().min(1).max(5),
    text: z.string().trim().min(1).max(2000),
    options: z.array(z.object({ text: z.string().trim().min(1).max(500) }).strict()).length(4),
    correctIndex: z.number().int().min(0).max(3),
    referenceUrl: z
      .string()
      .max(2048)
      .regex(/^https?:\/\//i)
      .nullable()
      .optional(),
  })
  .strict()

const Id = z.string().min(1).or(z.number())
export const PersonalQuestionSchema = z
  .object({
    id: Id,
    subjectId: Id,
    subjectName: z.string(),
    educationLevelId: Id,
    difficulty: z.number().int().min(1).max(5),
    text: z.string(),
    chapterId: Id.nullable(),
    spIds: z.array(Id).max(3),
    tp: z.number().int().min(1).max(6).nullable(),
    cognitiveLevel: z.enum(COGNITIVE).nullable(),
    options: z.array(z.object({ text: z.string() })).length(4),
    correctIndex: z.number().int().min(0).max(3),
    referenceUrl: z.string().nullable(),
    createdAt: z.string(),
  })
  .strict()
