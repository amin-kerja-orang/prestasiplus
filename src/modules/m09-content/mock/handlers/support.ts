/**
 * SRS M09 v1.5 §7 #20 `GET /api/banners/active` (logged in; BR-M09-14, the M05 carousel input) and
 * #43 `GET /api/config/support` (public; the panduan help box, DV-M09-14), API-ADM-10 settings.
 */

import {
  ok,
  requireAuth,
  requireRole,
  route,
  unpaged,
  validationError,
  type MockRequest,
  type MockResponse,
  type RouteDef,
} from '@/mock/define'

import { bannersRepo, supportRepo } from '../repository'
import { requireViewer } from './common'

/** API-ADM-10 (S7-T09, page in M22): `phone` and `hours` have no store yet. */
function settings(): { email: string; phone: string; whatsapp: string; hours: string } {
  const { email, whatsappNumber } = supportRepo.contact()
  return { email, phone: '', whatsapp: whatsappNumber, hours: '' }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?[0-9]{9,13}$/

function saveSettings(req: MockRequest): MockResponse {
  const body = (
    typeof req.body === 'object' && req.body !== null && !Array.isArray(req.body) ? req.body : {}
  ) as Record<string, unknown>
  const text = (v: unknown): string | undefined =>
    v === undefined ? undefined : typeof v === 'string' ? v.trim() : ''
  const email = text(body.email)
  const whatsapp = text(body.whatsapp)
  const fields: Record<string, string> = {}
  if (email && (email.length > 120 || !EMAIL.test(email))) fields.email = 'E-mel tidak sah.'
  if (whatsapp && !PHONE.test(whatsapp)) fields.whatsapp = 'No. telefon tidak sah.'
  if (Object.keys(fields).length > 0) return validationError(fields)
  const current = supportRepo.contact()
  supportRepo.saveContact({
    email: email ?? current.email,
    whatsappNumber: whatsapp ?? current.whatsappNumber,
  })
  return ok(settings())
}

export const supportRoutes: RouteDef[] = [
  route('GET', '/api/banners/active', [requireAuth()], (req) =>
    unpaged(bannersRepo.activeFor({ role: requireViewer(req).role })),
  ),

  route('GET', '/api/config/support', () => ok(supportRepo.config())),
  route('GET', '/api/admin/settings/support', [requireRole('admin')], () => ok(settings())),
  route('PUT', '/api/admin/settings/support', [requireRole('admin')], saveSettings),
]
