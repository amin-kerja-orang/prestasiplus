/**
 * SRS M12 v1.6 §7 #7 `GET /api/kirkpatrick/export-pdf` (S6 "Muat Turun Laporan"; PROPOSED content, provisional):
 * one A4 page "Model Kirkpatrick - Rantaian Impak" with the four level cards (label / value rows), the
 * correlation table and the two conclusion texts, all observed copy, built from #6. The PDF is plain text (a
 * hand-written single-page document, no generated image). File name `laporan-kirkpatrick.pdf`. Admin, teacher and school
 * administrator (forced to the own school).
 */

import { blob, route, type RouteDef } from '@/mock/define'

import { chainOf } from '../repository'
import { scopedRoles, viewerScope } from './common'
import { buildPdf, reportLines } from './pdf'

export const exportRoutes: RouteDef[] = [
  route('GET', '/api/kirkpatrick/export-pdf', [scopedRoles], (req) => {
    const bytes = buildPdf(
      'Model Kirkpatrick - Rantaian Impak',
      reportLines(chainOf(viewerScope(req))),
    )
    return blob(
      new Blob([bytes as BlobPart], { type: 'application/pdf' }),
      'laporan-kirkpatrick.pdf',
    )
  }),
]
