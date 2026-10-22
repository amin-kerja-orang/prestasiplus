import { Inject, Injectable } from '@nestjs/common'
import { KIRKPATRICK_PDF } from '@pp/contract'

import { fmt1 } from '../domain/rules'
import { PDF_PORT, type PdfPort } from '../ports/pdf.port'
import type { KirkpatrickChain } from '../types'
import { LevelsService } from './levels.service'
import type { Ctx } from './scope'

const CONCLUSION =
  'Berdasarkan analisis empat tahap Model Kirkpatrick, Prestasi Plus menunjukkan keberkesanan sebagai ' +
  'platform pembelajaran digital. Tahap 1 (Reaksi) menunjukkan maklum balas positif daripada pengguna. ' +
  'Tahap 2 (Pembelajaran) melalui Head Count menunjukkan perkembangan akademik yang dapat dipantau. ' +
  'Tahap 3 (Tingkah Laku) menunjukkan pelajar yang konsisten menggunakan platform menunjukkan corak ' +
  'Mastery Learning. Tahap 4 (Hasil) korelasi antara penggunaan aktif dengan ketepatan jawapan ' +
  'membuktikan impak positif terhadap pencapaian. Empat-empat tahap Kirkpatrick dipenuhi dalam Prestasi Plus.'

const dash = (n: number | null): string => (n === null ? '-' : fmt1(n))

/** The S6 report lines (observed copy of the mock `pdf.ts` and the chain figures). Pure. */
export function reportLines(c: KirkpatrickChain): string[] {
  const low = c.correlation.bands[0]
  const high = c.correlation.bands[c.correlation.bands.length - 1]
  const diff = high && low ? Math.round((high.acc - low.acc) * 10) / 10 : 0
  const conclusionAlesa =
    `Kesimpulan ALESA: Pelajar yang menjawab ${high?.label ?? ''} mencapai ketepatan ${String(high?.acc)}%, ` +
    `berbanding ${String(low?.acc)}% bagi pelajar dengan kurang 20 soalan ` +
    `(perbezaan ${diff >= 0 ? '+' : ''}${fmt1(diff)}%). Korelasi Pearson antara penggunaan dan ketepatan: ` +
    `r = ${String(c.t4.r)} (${c.t4.strength}).`
  return [
    'Tahap 1: Reaksi',
    `NPS Purata: ${fmt1(c.t1.nps)}`,
    `Kepuasan: ${fmt1(c.t1.satisfaction)}/5`,
    `Responden: ${String(c.t1.responses)}`,
    '',
    'Tahap 2: Pembelajaran',
    `Ketepatan: ${fmt1(c.t2.accuracy)}%`,
    `Soalan Dijawab: ${String(c.t2.answers)}`,
    `Skor Purata: ${fmt1(c.t2.avgScore)}%`,
    '',
    'Tahap 3: Tingkah Laku',
    `Pelajar aktif: ${String(c.t3.active)}/${String(c.t3.t4t5)} (${fmt1(c.t3.pct)}%)`,
    `Sesi Latihan: ${String(c.t3.sessions)}`,
    '',
    'Tahap 4: Hasil',
    `GPS: ${dash(c.t4.gps)}`,
    `Korelasi (r): ${String(c.t4.r)}`,
    `Kekuatan: ${c.t4.strength}`,
    '',
    'Analisis Korelasi: Penggunaan -> Pencapaian',
    ...c.correlation.bands.map((b) => `${b.label}: ${String(b.n)} pelajar, ketepatan ${String(b.acc)}%`),
    '',
    conclusionAlesa,
    '',
    'Kesimpulan Model Kirkpatrick',
    CONCLUSION,
  ]
}

/** "Muat Turun Laporan" (S6): the impact chain as a one-page PDF. The report has no free text of pupils. */
@Injectable()
export class ExportService {
  constructor(
    @Inject(LevelsService) private readonly levels: LevelsService,
    @Inject(PDF_PORT) private readonly pdf: PdfPort,
  ) {}

  async chainPdf(ctx: Ctx): Promise<Uint8Array> {
    return this.pdf.render(KIRKPATRICK_PDF.title, reportLines(await this.levels.chain(ctx)))
  }
}
