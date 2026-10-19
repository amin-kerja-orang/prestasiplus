import type {
  CompBulkActionSchema,
  CompIcMaskedSchema,
  CompStudentClassSchema,
  CompStudentDetailSchema,
  CompStudentListItemSchema,
  QuotaSchema,
  SchoolPackageAssignmentSchema,
  SchoolPackageCardSchema,
  SchoolPackageSchema,
  SchoolPackageUserViewSchema,
  StudentImportResultSchema,
  SubscriptionDetailSchema,
  SubscriptionListItemSchema,
  SubscriptionRenewalInvoiceSchema,
  SubscriptionSchoolSchema,
  SubscriptionStudentSchema,
} from '@pp/contract'
import type { z } from 'zod'

/** Wire types of the contract (it exports the schemas only). */
export type CompBulkAction = z.output<typeof CompBulkActionSchema>
export type CompIcMasked = z.output<typeof CompIcMaskedSchema>
export type CompStudentClass = z.output<typeof CompStudentClassSchema>
export type CompStudentDetail = z.output<typeof CompStudentDetailSchema>
export type CompStudentListItem = z.output<typeof CompStudentListItemSchema>
export type SchoolQuota = z.output<typeof QuotaSchema>
export type SchoolPackage = z.output<typeof SchoolPackageSchema>
export type SchoolPackageAssignment = z.output<typeof SchoolPackageAssignmentSchema>
export type SchoolPackageCard = z.output<typeof SchoolPackageCardSchema>
export type SchoolPackageUserView = z.output<typeof SchoolPackageUserViewSchema>
export type StudentImportResult = z.output<typeof StudentImportResultSchema>
export type SubscriptionDetail = z.output<typeof SubscriptionDetailSchema>
export type SubscriptionListItem = z.output<typeof SubscriptionListItemSchema>
export type SubscriptionRenewalInvoice = z.output<typeof SubscriptionRenewalInvoiceSchema>
export type SubscriptionSchool = z.output<typeof SubscriptionSchoolSchema>
export type SubscriptionStudent = z.output<typeof SubscriptionStudentSchema>
