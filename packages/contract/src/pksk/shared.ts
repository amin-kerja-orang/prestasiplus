import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { z } from '../zod'

/**
 * Primitives shared by the student and admin halves of the PKSK contract (BE-42, M07). Only add
 * exports here; never rename or remove one. Every exported name and `.meta({ id })` carries the
 * `Pksk` prefix. Ids are `IdSchema` strings (UD-1); the frontend mock sends numbers.
 */

/** PKSK level (BR-M07-19): case-sensitive `T1` or `T4`. */
export const PKSK_LEVELS = ['T1', 'T4'] as const
export const PkskLevelSchema = z.enum(PKSK_LEVELS).meta({
  id: 'PkskLevel',
  description: 'PKSK level, case-sensitive: T1 (Tingkatan 1) or T4 (Tingkatan 4).',
})
export type PkskLevel = z.infer<typeof PkskLevelSchema>

/** Bahagian (exam part): A Kecerdasan Insaniah, B Kecerdasan Intelek, C Artikulasi Penulisan. */
export const PKSK_BAHAGIAN = ['A', 'B', 'C'] as const
export const PkskBahagianSchema = z.enum(PKSK_BAHAGIAN).meta({
  id: 'PkskBahagian',
  description: 'Exam part: A (Kecerdasan Insaniah), B (Kecerdasan Intelek) or C (Artikulasi Penulisan).',
})
export type PkskBahagian = z.infer<typeof PkskBahagianSchema>

/** Grade of a percentage (BR-M07-10): A >= 80, B 65-79, C 50-64, D 40-49, E < 40. */
export const PKSK_GRADES = ['A', 'B', 'C', 'D', 'E'] as const
export const PkskGradeSchema = z.enum(PKSK_GRADES).meta({
  id: 'PkskGrade',
  description: 'Grade of a percentage: A at 80 or more, B 65 to 79, C 50 to 64, D 40 to 49, E below 40.',
})
export type PkskGrade = z.infer<typeof PkskGradeSchema>

/** The 15 fixed domain codes (reference data, mock `data/domains.ts`; ids 1 to 15 in this order). */
export const PKSK_DOMAIN_CODES = [
  'PKSK_INSANIAH',
  'PKSK_MATH',
  'PKSK_SCI',
  'PKSK_ENG',
  'PKSK_SEJ',
  'PKSK_GEO',
  'PKSK_BUDAYA',
  'PKSK_SUKAN',
  'PKSK_MERCU',
  'PKSK_ALAM',
  'PKSK_TECH',
  'PKSK_EKON',
  'PKSK_INOV',
  'PKSK_GLOBAL',
  'PKSK_ESSAY',
] as const
export const PkskDomainCodeSchema = z.enum(PKSK_DOMAIN_CODES).meta({
  id: 'PkskDomainCode',
  description: 'Code of one of the 15 fixed PKSK domains.',
})
export type PkskDomainCode = z.infer<typeof PkskDomainCodeSchema>

/** Status of a PKSK question (BR-M07-02): any status may follow any other. */
export const PKSK_QUESTION_STATUSES = ['pending', 'approved', 'rejected'] as const
export const PkskQuestionStatusSchema = z.enum(PKSK_QUESTION_STATUSES).meta({
  id: 'PkskQuestionStatus',
  description: 'PKSK question status. Only approved questions are served to students.',
})
export type PkskQuestionStatus = z.infer<typeof PkskQuestionStatusSchema>

/** Level of a package: a single level or `ALL` (Kombo, both levels). */
export const PKSK_PACKAGE_LEVELS = ['T1', 'T4', 'ALL'] as const
export const PkskPackageLevelSchema = z.enum(PKSK_PACKAGE_LEVELS).meta({
  id: 'PkskPackageLevel',
  description: 'Level a package unlocks: T1, T4 or ALL (Kombo).',
})
export type PkskPackageLevel = z.infer<typeof PkskPackageLevelSchema>

/** Compact domain reference carried by dashboards, sections and admin lists. */
export const PkskDomainRefSchema = z
  .object({
    id: IdSchema,
    code: PkskDomainCodeSchema,
    name: z.string().min(1).max(100).meta({ description: 'BM name, e.g. "Matematik".' }),
    icon: z.string().min(1).max(50).meta({ description: 'Icon class string, e.g. "fa-calculator".' }),
    color: z.string().min(1).max(20).meta({ description: 'Hex colour, e.g. "#3b82f6".' }),
  })
  .meta({ id: 'PkskDomainRef' })
export type PkskDomainRef = z.infer<typeof PkskDomainRefSchema>

/** A domain as shipped by `GET /api/pksk-domains` (the live shape, `nameEn` included). */
export const PkskDomainSchema = PkskDomainRefSchema.extend({
  bahagian: PkskBahagianSchema,
  nameEn: z.string().min(1).max(100),
  order: z.number().int().min(1),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
}).meta({ id: 'PkskDomain' })
export type PkskDomain = z.infer<typeof PkskDomainSchema>

/** A percentage from 0 to 100, whole or with one decimal. */
export const PkskPercentSchema = z.number().min(0).max(100)

/** Components of this file for the OpenAPI document (registered once by the lead). */
export const PKSK_SHARED_COMPONENT_SCHEMAS = {
  PkskLevel: PkskLevelSchema,
  PkskBahagian: PkskBahagianSchema,
  PkskGrade: PkskGradeSchema,
  PkskDomainCode: PkskDomainCodeSchema,
  PkskQuestionStatus: PkskQuestionStatusSchema,
  PkskPackageLevel: PkskPackageLevelSchema,
  PkskDomainRef: PkskDomainRefSchema,
  PkskDomain: PkskDomainSchema,
} as const
