/**
 * PoC data of the Bijak SPM prototype (D45): three subjects, four papers, four blueprints and the
 * question pool behind them, exported ONCE from `src/modules/m28-bijak-spm/data/registry.ts`
 * (commit a020318d) so that API code and seeds never import the frontend tree. Invented, fictitious
 * practice content only (no real papers, no real people). Do not edit by hand: change the source of
 * truth in the prototype and re-export, or replace the data by the BE-09 question bank.
 *
 * Shape = the prototype types (`domain/types.ts`): `QuestionDef`, `SchemeDef`, `StimulusDef`,
 * `GroupDef`, `PaperDef`, `Blueprint`, `PoolEntry`. Subject codes are the Bijak wire codes
 * (MAT, SN, SEJ); the curriculum codes are mapped in `../subject-codes.ts`.
 *
 * The mark schemes (`schemes`) stay in this file for the future question loader; no endpoint of
 * BE-15 returns them (AC 6).
 */
import type { PocBank } from './types'

export const POC_BANK: PocBank = {
  "subjects": [
    {
      "code": "MAT",
      "name": "Matematik"
    },
    {
      "code": "SN",
      "name": "Sains"
    },
    {
      "code": "SEJ",
      "name": "Sejarah"
    }
  ],
  "papers": [
    {
      "id": "mat-k1-2025-a",
      "title": "Percubaan SPM Matematik Kertas 1 Set A",
      "subject": "MAT",
      "kertas": 1,
      "year": 2025,
      "code": "1449/1",
      "durationMin": 75,
      "instructions": [
        "Kertas ini mengandungi 40 soalan objektif.",
        "Jawab semua soalan. Pilih satu jawapan sahaja bagi setiap soalan.",
        "Rajah tidak dilukis mengikut skala kecuali dinyatakan."
      ],
      "reference": [
        {
          "title": "Rumus (ringkas)",
          "items": [
            "Teorem Pythagoras: $c^2 = a^2 + b^2$",
            "Kecerunan: $m = \\frac{y_2 - y_1}{x_2 - x_1}$",
            "Luas segi tiga: $\\frac{1}{2} \\times \\text{tapak} \\times \\text{tinggi}$",
            "Luas bulatan: $\\pi j^2$, $\\pi = \\frac{22}{7}$",
            "Min: $\\frac{\\text{jumlah nilai}}{\\text{bilangan nilai}}$"
          ]
        }
      ],
      "sections": [
        {
          "id": "mat-k1-2025-a-s1",
          "label": "Objektif",
          "rule": {
            "type": "all"
          },
          "markBudget": 10,
          "questionCount": 10,
          "questionIds": [
            "mat1-pecahan-v1",
            "mat1-peratus-v1",
            "mat1-bentuk-piawai-v1",
            "mat1-persamaan-v1",
            "mat1-g1-q1",
            "mat1-g1-q2",
            "mat1-g1-q3",
            "mat1-g1-q4",
            "mat1-kembang-v1",
            "mat1-faktor-v1"
          ]
        }
      ]
    },
    {
      "id": "mat-k2-2025-a",
      "title": "Percubaan SPM Matematik Kertas 2 Set A",
      "subject": "MAT",
      "kertas": 2,
      "year": 2025,
      "code": "1449/2",
      "durationMin": 150,
      "instructions": [
        "Kertas ini mengandungi tiga bahagian: Bahagian A, Bahagian B dan Bahagian C.",
        "Jawab semua soalan dalam Bahagian A dan Bahagian B, dan satu soalan dalam Bahagian C.",
        "Tunjukkan langkah kerja anda. Markah boleh diberi untuk kaedah yang betul."
      ],
      "reference": [
        {
          "title": "Rumus (ringkas)",
          "items": [
            "Teorem Pythagoras: $c^2 = a^2 + b^2$",
            "Kecerunan: $m = \\frac{y_2 - y_1}{x_2 - x_1}$",
            "Luas segi tiga: $\\frac{1}{2} \\times \\text{tapak} \\times \\text{tinggi}$",
            "Luas bulatan: $\\pi j^2$, $\\pi = \\frac{22}{7}$",
            "Min: $\\frac{\\text{jumlah nilai}}{\\text{bilangan nilai}}$"
          ]
        }
      ],
      "sections": [
        {
          "id": "mat-k2-2025-a-s1",
          "label": "Bahagian A",
          "rule": {
            "type": "all"
          },
          "markBudget": 9,
          "questionCount": 3,
          "questionIds": [
            "mat2-segitiga-v1-q1",
            "mat2-segitiga-v1-q2",
            "mat2-diskaun-v1"
          ]
        },
        {
          "id": "mat-k2-2025-a-s2",
          "label": "Bahagian B",
          "rule": {
            "type": "all"
          },
          "markBudget": 6,
          "questionCount": 1,
          "questionIds": [
            "mat2-garis-v1"
          ]
        },
        {
          "id": "mat-k2-2025-a-s3",
          "label": "Bahagian C",
          "instruction": "Jawab 1 daripada 2 soalan.",
          "rule": {
            "type": "choose",
            "n": 1
          },
          "markBudget": 6,
          "questionCount": 2,
          "questionIds": [
            "mat2-statistik-v1",
            "mat2-kuadratik-v1"
          ]
        }
      ]
    },
    {
      "id": "sn-k2-2025-a",
      "title": "Percubaan SPM Sains Kertas 2 (Contoh Pendek)",
      "subject": "SN",
      "kertas": 2,
      "year": 2025,
      "code": "4541/2",
      "durationMin": 60,
      "instructions": [
        "Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.",
        "Jawab semua soalan dalam Bahagian A dan satu soalan dalam Bahagian B."
      ],
      "sections": [
        {
          "id": "sn-k2-2025-a-s1",
          "label": "Bahagian A",
          "rule": {
            "type": "all"
          },
          "markBudget": 9,
          "questionCount": 3,
          "questionIds": [
            "sn2-sel-q1",
            "sn2-sel-q2",
            "sn2-laju-v1"
          ]
        },
        {
          "id": "sn-k2-2025-a-s2",
          "label": "Bahagian B",
          "instruction": "Jawab 1 daripada 2 soalan.",
          "rule": {
            "type": "choose",
            "n": 1
          },
          "markBudget": 4,
          "questionCount": 2,
          "questionIds": [
            "sn2-osmosis",
            "sn2-fotosintesis"
          ]
        }
      ]
    },
    {
      "id": "sej-k2-2025-a",
      "title": "Percubaan SPM Sejarah Kertas 2 (Contoh Pendek)",
      "subject": "SEJ",
      "kertas": 2,
      "year": 2025,
      "code": "1249/2",
      "durationMin": 90,
      "instructions": [
        "Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.",
        "Jawab semua soalan dalam Bahagian A dan satu soalan dalam Bahagian B.",
        "Esei dinilai oleh guru mengikut band; markah tidak diberi secara automatik."
      ],
      "sections": [
        {
          "id": "sej-k2-2025-a-s1",
          "label": "Bahagian A",
          "rule": {
            "type": "all"
          },
          "markBudget": 9,
          "questionCount": 2,
          "questionIds": [
            "sej2-q1",
            "sej2-q2"
          ]
        },
        {
          "id": "sej-k2-2025-a-s2",
          "label": "Bahagian B",
          "instruction": "Jawab 1 daripada 2 soalan.",
          "rule": {
            "type": "choose",
            "n": 1
          },
          "markBudget": 10,
          "questionCount": 2,
          "questionIds": [
            "sej2-q3",
            "sej2-q4"
          ]
        }
      ]
    }
  ],
  "blueprints": [
    {
      "subject": "MAT",
      "kertas": 1,
      "source": "Spec",
      "code": "1449/1",
      "durationMin": 75,
      "instructions": [
        "Kertas ini mengandungi 40 soalan objektif.",
        "Jawab semua soalan. Pilih satu jawapan sahaja bagi setiap soalan.",
        "Rajah tidak dilukis mengikut skala kecuali dinyatakan."
      ],
      "reference": [
        {
          "title": "Rumus (ringkas)",
          "items": [
            "Teorem Pythagoras: $c^2 = a^2 + b^2$",
            "Kecerunan: $m = \\frac{y_2 - y_1}{x_2 - x_1}$",
            "Luas segi tiga: $\\frac{1}{2} \\times \\text{tapak} \\times \\text{tinggi}$",
            "Luas bulatan: $\\pi j^2$, $\\pi = \\frac{22}{7}$",
            "Min: $\\frac{\\text{jumlah nilai}}{\\text{bilangan nilai}}$"
          ]
        }
      ],
      "sections": [
        {
          "label": "Objektif",
          "rule": {
            "type": "all"
          },
          "pool": "MAT1-A",
          "take": 10,
          "markBudget": 10
        }
      ]
    },
    {
      "subject": "MAT",
      "kertas": 2,
      "source": "Spec",
      "code": "1449/2",
      "durationMin": 150,
      "instructions": [
        "Kertas ini mengandungi tiga bahagian: Bahagian A, Bahagian B dan Bahagian C.",
        "Jawab semua soalan dalam Bahagian A dan Bahagian B, dan satu soalan dalam Bahagian C.",
        "Tunjukkan langkah kerja anda. Markah boleh diberi untuk kaedah yang betul."
      ],
      "reference": [
        {
          "title": "Rumus (ringkas)",
          "items": [
            "Teorem Pythagoras: $c^2 = a^2 + b^2$",
            "Kecerunan: $m = \\frac{y_2 - y_1}{x_2 - x_1}$",
            "Luas segi tiga: $\\frac{1}{2} \\times \\text{tapak} \\times \\text{tinggi}$",
            "Luas bulatan: $\\pi j^2$, $\\pi = \\frac{22}{7}$",
            "Min: $\\frac{\\text{jumlah nilai}}{\\text{bilangan nilai}}$"
          ]
        }
      ],
      "sections": [
        {
          "label": "Bahagian A",
          "rule": {
            "type": "all"
          },
          "pool": "MAT2-A",
          "take": 3
        },
        {
          "label": "Bahagian B",
          "rule": {
            "type": "all"
          },
          "pool": "MAT2-B",
          "take": 1
        },
        {
          "label": "Bahagian C",
          "instruction": "Jawab 1 daripada 2 soalan.",
          "rule": {
            "type": "choose",
            "n": 1
          },
          "pool": "MAT2-C",
          "take": 2
        }
      ]
    },
    {
      "subject": "SN",
      "kertas": 2,
      "source": "Spec",
      "code": "4541/2",
      "durationMin": 60,
      "instructions": [
        "Kertas ini mengandungi dua bahagian: Bahagian A dan Bahagian B.",
        "Jawab semua soalan dalam Bahagian A dan satu soalan dalam Bahagian B."
      ],
      "sections": [
        {
          "label": "Bahagian A",
          "rule": {
            "type": "all"
          },
          "pool": "SN2-A",
          "take": 3
        },
        {
          "label": "Bahagian B",
          "instruction": "Jawab 1 daripada 2 soalan.",
          "rule": {
            "type": "choose",
            "n": 1
          },
          "pool": "SN2-B",
          "take": 2
        }
      ]
    },
    {
      "subject": "SN",
      "kertas": 1,
      "source": "Spec",
      "code": "4541/1",
      "durationMin": 60,
      "instructions": [
        "Kertas ini mengandungi 40 soalan objektif."
      ],
      "sections": [
        {
          "label": "Bahagian A",
          "rule": {
            "type": "all"
          },
          "pool": "SN1-A",
          "take": 40
        }
      ]
    }
  ],
  "pool": [
    {
      "questionId": "mat1-pecahan-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-pecahan-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-peratus-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-peratus-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-bentuk-piawai-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-bentuk-piawai-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-persamaan-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-persamaan-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-kembang-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-kembang-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-faktor-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-faktor-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-indeks-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-indeks-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-kecerunan-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-kecerunan-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-kebarangkalian-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-kebarangkalian-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-min-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-min-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-ketaksamaan-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-ketaksamaan-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-laju-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-laju-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-poligon-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-poligon-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-pythagoras-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-pythagoras-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-bulatan-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-bulatan-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-set-v1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-set-v2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g1-q1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g1-q2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g1-q3",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g1-q4",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g2-q1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g2-q2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g2-q3",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g2-q4",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g3-q1",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g3-q2",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g3-q3",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat1-g3-q4",
      "pool": "MAT1-A"
    },
    {
      "questionId": "mat2-algebra-v1",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-algebra-v2",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-segitiga-v1-q1",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-segitiga-v1-q2",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-segitiga-v2-q1",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-segitiga-v2-q2",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-diskaun-v1",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-diskaun-v2",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-diskaun-v3",
      "pool": "MAT2-A"
    },
    {
      "questionId": "mat2-garis-v1",
      "pool": "MAT2-B"
    },
    {
      "questionId": "mat2-garis-v2",
      "pool": "MAT2-B"
    },
    {
      "questionId": "mat2-statistik-v1",
      "pool": "MAT2-C"
    },
    {
      "questionId": "mat2-statistik-v2",
      "pool": "MAT2-C"
    },
    {
      "questionId": "mat2-kuadratik-v1",
      "pool": "MAT2-C"
    },
    {
      "questionId": "mat2-kuadratik-v2",
      "pool": "MAT2-C"
    },
    {
      "questionId": "sn2-sel-q1",
      "pool": "SN2-A"
    },
    {
      "questionId": "sn2-sel-q2",
      "pool": "SN2-A"
    },
    {
      "questionId": "sn2-laju-v1",
      "pool": "SN2-A"
    },
    {
      "questionId": "sn2-laju-v2",
      "pool": "SN2-A"
    },
    {
      "questionId": "sn2-laju-v3",
      "pool": "SN2-A"
    },
    {
      "questionId": "sn2-osmosis",
      "pool": "SN2-B"
    },
    {
      "questionId": "sn2-fotosintesis",
      "pool": "SN2-B"
    }
  ],
  "groups": [
    {
      "id": "mat1-g1",
      "stimulusId": "mat1-s1",
      "questionIds": [
        "mat1-g1-q1",
        "mat1-g1-q2",
        "mat1-g1-q3",
        "mat1-g1-q4"
      ]
    },
    {
      "id": "mat1-g2",
      "stimulusId": "mat1-s2",
      "questionIds": [
        "mat1-g2-q1",
        "mat1-g2-q2",
        "mat1-g2-q3",
        "mat1-g2-q4"
      ]
    },
    {
      "id": "mat1-g3",
      "stimulusId": "mat1-s3",
      "questionIds": [
        "mat1-g3-q1",
        "mat1-g3-q2",
        "mat1-g3-q3",
        "mat1-g3-q4"
      ]
    },
    {
      "id": "mat2-segitiga-v1",
      "stimulusId": "mat2-segitiga-s1",
      "questionIds": [
        "mat2-segitiga-v1-q1",
        "mat2-segitiga-v1-q2"
      ]
    },
    {
      "id": "mat2-segitiga-v2",
      "stimulusId": "mat2-segitiga-s2",
      "questionIds": [
        "mat2-segitiga-v2-q1",
        "mat2-segitiga-v2-q2"
      ]
    },
    {
      "id": "sn2-sel",
      "stimulusId": "sn2-sel-s1",
      "questionIds": [
        "sn2-sel-q1",
        "sn2-sel-q2"
      ]
    },
    {
      "id": "sej2-bahan1",
      "stimulusId": "sej2-s1",
      "questionIds": [
        "sej2-q1"
      ]
    },
    {
      "id": "sej2-bahan2",
      "stimulusId": "sej2-s2",
      "questionIds": [
        "sej2-q2"
      ],
      "optionBank": [
        {
          "id": "A",
          "text": "1946"
        },
        {
          "id": "B",
          "text": "1948"
        },
        {
          "id": "C",
          "text": "1955"
        },
        {
          "id": "D",
          "text": "1957"
        },
        {
          "id": "E",
          "text": "1963"
        }
      ]
    }
  ],
  "stimuli": [
    {
      "id": "mat1-s1",
      "kind": "diagram",
      "label": "Rajah 1",
      "caption": "Segi tiga ABC dengan sudut tegak di B.",
      "alt": "Segi tiga ABC bersudut tegak di B, AB 8 cm dan BC 6 cm.",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 220\" role=\"img\" aria-label=\"Segi tiga ABC bersudut tegak di B, AB 8 cm dan BC 6 cm.\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" font-family=\"sans-serif\" font-size=\"15\"><path d=\"M50 180 L50 40 L155 180 Z\" fill=\"currentColor\" fill-opacity=\"0.08\"/><path d=\"M50 166 L64 166 L64 180\"/><text x=\"38\" y=\"44\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">A</text><text x=\"38\" y=\"194\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">B</text><text x=\"169\" y=\"194\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">C</text><text x=\"40\" y=\"115\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">8 cm</text><text x=\"102.5\" y=\"204\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">6 cm</text></svg>"
    },
    {
      "id": "mat1-s2",
      "kind": "diagram",
      "label": "Rajah 2",
      "caption": "Markah seorang murid dalam lima mata pelajaran.",
      "alt": "Carta palang markah: BM 60, BI 75, Mat 80, Sej 45, Sains 90.",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 230\" role=\"img\" aria-label=\"Carta palang markah: BM 60, BI 75, Mat 80, Sej 45, Sains 90.\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" font-family=\"sans-serif\" font-size=\"15\"><text x=\"160\" y=\"20\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">Markah murid</text><path d=\"M40 30 L40 190 L310 190\"/><rect x=\"47.8\" y=\"87.33333333333333\" width=\"36.4\" height=\"102.66666666666667\" fill=\"currentColor\" fill-opacity=\"0.25\"/><text x=\"66\" y=\"81.33333333333333\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">60</text><text x=\"66\" y=\"208\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">BM</text><rect x=\"99.8\" y=\"61.66666666666666\" width=\"36.4\" height=\"128.33333333333334\" fill=\"currentColor\" fill-opacity=\"0.25\"/><text x=\"118\" y=\"55.66666666666666\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">75</text><text x=\"118\" y=\"208\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">BI</text><rect x=\"151.8\" y=\"53.111111111111114\" width=\"36.4\" height=\"136.88888888888889\" fill=\"currentColor\" fill-opacity=\"0.25\"/><text x=\"170\" y=\"47.111111111111114\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">80</text><text x=\"170\" y=\"208\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">Mat</text><rect x=\"203.8\" y=\"113\" width=\"36.4\" height=\"77\" fill=\"currentColor\" fill-opacity=\"0.25\"/><text x=\"222\" y=\"107\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">45</text><text x=\"222\" y=\"208\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">Sej</text><rect x=\"255.8\" y=\"36\" width=\"36.4\" height=\"154\" fill=\"currentColor\" fill-opacity=\"0.25\"/><text x=\"274\" y=\"30\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">90</text><text x=\"274\" y=\"208\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">Sn</text></svg>"
    },
    {
      "id": "mat1-s3",
      "kind": "diagram",
      "label": "Rajah 3",
      "caption": "Titik P(1, 2) dan Q(5, 5) pada satah Cartes.",
      "alt": "Satah Cartes dengan titik P(1, 2) dan Q(5, 5) disambung dengan garis lurus.",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 260\" role=\"img\" aria-label=\"Satah Cartes dengan titik P(1, 2) dan Q(5, 5).\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" font-family=\"sans-serif\" font-size=\"15\"><path d=\"M40 220 L40 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 220 L264 220\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"40\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">0</text><path d=\"M68 220 L68 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 192 L264 192\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"68\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">1</text><text x=\"30\" y=\"197\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">1</text><path d=\"M96 220 L96 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 164 L264 164\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"96\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">2</text><text x=\"30\" y=\"169\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">2</text><path d=\"M124 220 L124 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 136 L264 136\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"124\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">3</text><text x=\"30\" y=\"141\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">3</text><path d=\"M152 220 L152 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 108 L264 108\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"152\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">4</text><text x=\"30\" y=\"113\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">4</text><path d=\"M180 220 L180 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 80 L264 80\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"180\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">5</text><text x=\"30\" y=\"85\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">5</text><path d=\"M208 220 L208 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 52 L264 52\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"208\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">6</text><text x=\"30\" y=\"57\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">6</text><path d=\"M236 220 L236 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><path d=\"M40 24 L264 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"236\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">7</text><text x=\"30\" y=\"29\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">7</text><path d=\"M264 220 L264 24\" stroke-opacity=\"0.15\" stroke-width=\"1\"/><text x=\"264\" y=\"236\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">8</text><path d=\"M40 224 L40 18\"/><path d=\"M36 220 L270 220\"/><text x=\"276\" y=\"225\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">x</text><text x=\"40\" y=\"12\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">y</text><path d=\"M68 164 L180 80\"/><circle cx=\"68\" cy=\"164\" r=\"4\" fill=\"currentColor\"/><text x=\"78\" y=\"156\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"start\">P</text><circle cx=\"180\" cy=\"80\" r=\"4\" fill=\"currentColor\"/><text x=\"190\" y=\"72\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"start\">Q</text></svg>"
    },
    {
      "id": "mat2-segitiga-s1",
      "kind": "diagram",
      "label": "Rajah 1",
      "caption": "Segi tiga ABC bersudut tegak di B.",
      "alt": "Segi tiga ABC bersudut tegak di B, AB 12 cm dan BC 5 cm.",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 220\" role=\"img\" aria-label=\"Segi tiga ABC bersudut tegak di B, AB 12 cm dan BC 5 cm.\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" font-family=\"sans-serif\" font-size=\"15\"><path d=\"M50 180 L50 40 L108.33333333333333 180 Z\" fill=\"currentColor\" fill-opacity=\"0.08\"/><path d=\"M50 166 L64 166 L64 180\"/><text x=\"38\" y=\"44\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">A</text><text x=\"38\" y=\"194\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">B</text><text x=\"122.33333333333333\" y=\"194\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">C</text><text x=\"40\" y=\"115\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">12 cm</text><text x=\"79.16666666666666\" y=\"204\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">5 cm</text></svg>"
    },
    {
      "id": "mat2-segitiga-s2",
      "kind": "diagram",
      "label": "Rajah 1",
      "caption": "Segi tiga ABC bersudut tegak di B.",
      "alt": "Segi tiga ABC bersudut tegak di B, AB 8 cm dan BC 6 cm.",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 220\" role=\"img\" aria-label=\"Segi tiga ABC bersudut tegak di B, AB 8 cm dan BC 6 cm.\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" font-family=\"sans-serif\" font-size=\"15\"><path d=\"M50 180 L50 40 L155 180 Z\" fill=\"currentColor\" fill-opacity=\"0.08\"/><path d=\"M50 166 L64 166 L64 180\"/><text x=\"38\" y=\"44\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">A</text><text x=\"38\" y=\"194\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">B</text><text x=\"169\" y=\"194\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">C</text><text x=\"40\" y=\"115\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"end\">8 cm</text><text x=\"102.5\" y=\"204\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">6 cm</text></svg>"
    },
    {
      "id": "sn2-sel-s1",
      "kind": "diagram",
      "label": "Rajah 1",
      "caption": "Struktur sebuah sel tumbuhan.",
      "alt": "Sel tumbuhan dengan dinding sel, nukleus (P), kloroplas (Q) dan vakuol (R).",
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 320 240\" role=\"img\" aria-label=\"Sel tumbuhan dengan dinding sel, nukleus (P), kloroplas (Q) dan vakuol (R).\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" font-family=\"sans-serif\" font-size=\"15\"><rect x=\"30\" y=\"20\" width=\"260\" height=\"200\" rx=\"26\"/><rect x=\"40\" y=\"30\" width=\"240\" height=\"180\" rx=\"20\" stroke-opacity=\"0.45\"/><ellipse cx=\"110\" cy=\"120\" rx=\"48\" ry=\"30\" fill=\"currentColor\" fill-opacity=\"0.12\"/><circle cx=\"110\" cy=\"120\" r=\"9\" fill=\"currentColor\" fill-opacity=\"0.4\"/><ellipse cx=\"210\" cy=\"82\" rx=\"30\" ry=\"17\" fill=\"currentColor\" fill-opacity=\"0.2\"/><path d=\"M192 82 Q210 70 228 82\" stroke-opacity=\"0.6\"/><ellipse cx=\"206\" cy=\"160\" rx=\"34\" ry=\"24\" stroke-dasharray=\"5 4\"/><text x=\"110\" y=\"172\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">P</text><text x=\"250\" y=\"78\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">Q</text><text x=\"206\" y=\"196\" fill=\"currentColor\" stroke=\"none\" text-anchor=\"middle\">R</text></svg>"
    },
    {
      "id": "sej2-s1",
      "kind": "passage",
      "label": "Bahan 1",
      "alt": "Petikan ringkas tentang usaha rakyat mencapai kemerdekaan.",
      "text": "Sebelum merdeka, pemimpin pelbagai kaum berunding dan bersetuju tentang asas negara baharu. Mereka menubuhkan satu gabungan, bertanding dalam pilihan raya dan menyediakan perlembagaan yang diterima bersama."
    },
    {
      "id": "sej2-s2",
      "kind": "table",
      "label": "Bahan 2",
      "alt": "Senarai tahun: A 1946, B 1948, C 1955, D 1957, E 1963.",
      "table": {
        "head": [
          "Huruf",
          "Tahun"
        ],
        "rows": [
          [
            "A",
            "1946"
          ],
          [
            "B",
            "1948"
          ],
          [
            "C",
            "1955"
          ],
          [
            "D",
            "1957"
          ],
          [
            "E",
            "1963"
          ]
        ]
      }
    }
  ],
  "questions": [
    {
      "id": "mat1-pecahan-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Pecahan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Nilaikan $\\frac{1}{2} + \\frac{1}{3}$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-pecahan-v1-o1",
            "text": "$\\frac{2}{5}$"
          },
          {
            "id": "mat1-pecahan-v1-o2",
            "text": "$\\frac{1}{6}$"
          },
          {
            "id": "mat1-pecahan-v1-o3",
            "text": "$\\frac{5}{6}$"
          },
          {
            "id": "mat1-pecahan-v1-o4",
            "text": "1"
          }
        ]
      }
    },
    {
      "id": "mat1-pecahan-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Pecahan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Nilaikan $\\frac{1}{4} + \\frac{2}{3}$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-pecahan-v2-o1",
            "text": "$\\frac{3}{7}$"
          },
          {
            "id": "mat1-pecahan-v2-o2",
            "text": "$\\frac{1}{6}$"
          },
          {
            "id": "mat1-pecahan-v2-o3",
            "text": "$\\frac{11}{7}$"
          },
          {
            "id": "mat1-pecahan-v2-o4",
            "text": "$\\frac{11}{12}$"
          }
        ]
      }
    },
    {
      "id": "mat1-peratus-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Peratusan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung 15% daripada RM240.",
      "mcq": {
        "options": [
          {
            "id": "mat1-peratus-v1-o1",
            "text": "RM204"
          },
          {
            "id": "mat1-peratus-v1-o2",
            "text": "RM360"
          },
          {
            "id": "mat1-peratus-v1-o3",
            "text": "RM36"
          },
          {
            "id": "mat1-peratus-v1-o4",
            "text": "RM16"
          }
        ]
      }
    },
    {
      "id": "mat1-peratus-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Peratusan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung 20% daripada RM150.",
      "mcq": {
        "options": [
          {
            "id": "mat1-peratus-v2-o1",
            "text": "RM120"
          },
          {
            "id": "mat1-peratus-v2-o2",
            "text": "RM300"
          },
          {
            "id": "mat1-peratus-v2-o3",
            "text": "RM7.5"
          },
          {
            "id": "mat1-peratus-v2-o4",
            "text": "RM30"
          }
        ]
      }
    },
    {
      "id": "mat1-bentuk-piawai-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Bentuk piawai",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Ungkapkan 45000 dalam bentuk piawai.",
      "mcq": {
        "options": [
          {
            "id": "mat1-bentuk-piawai-v1-o1",
            "text": "$4.5 \\times 10^{5}$"
          },
          {
            "id": "mat1-bentuk-piawai-v1-o2",
            "text": "$4.5 \\times 10^{3}$"
          },
          {
            "id": "mat1-bentuk-piawai-v1-o3",
            "text": "$45 \\times 10^{3}$"
          },
          {
            "id": "mat1-bentuk-piawai-v1-o4",
            "text": "$4.5 \\times 10^{4}$"
          }
        ]
      }
    },
    {
      "id": "mat1-bentuk-piawai-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Bentuk piawai",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Ungkapkan 0,00032 dalam bentuk piawai.",
      "mcq": {
        "options": [
          {
            "id": "mat1-bentuk-piawai-v2-o1",
            "text": "$3.2 \\times 10^{-4}$"
          },
          {
            "id": "mat1-bentuk-piawai-v2-o2",
            "text": "$3.2 \\times 10^{-3}$"
          },
          {
            "id": "mat1-bentuk-piawai-v2-o3",
            "text": "$3.2 \\times 10^{-5}$"
          },
          {
            "id": "mat1-bentuk-piawai-v2-o4",
            "text": "$32 \\times 10^{-5}$"
          }
        ]
      }
    },
    {
      "id": "mat1-persamaan-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Persamaan linear",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Selesaikan persamaan $3x + 5 = 17$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-persamaan-v1-o1",
            "text": "$x = 4$"
          },
          {
            "id": "mat1-persamaan-v1-o2",
            "text": "$x = 7.333333333333333$"
          },
          {
            "id": "mat1-persamaan-v1-o3",
            "text": "$x = 12$"
          },
          {
            "id": "mat1-persamaan-v1-o4",
            "text": "$x = 5$"
          }
        ]
      }
    },
    {
      "id": "mat1-persamaan-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Persamaan linear",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Selesaikan persamaan $2x - 3 = 11$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-persamaan-v2-o1",
            "text": "$x = 4$"
          },
          {
            "id": "mat1-persamaan-v2-o2",
            "text": "$x = 7$"
          },
          {
            "id": "mat1-persamaan-v2-o3",
            "text": "$x = 14$"
          },
          {
            "id": "mat1-persamaan-v2-o4",
            "text": "$x = 8$"
          }
        ]
      }
    },
    {
      "id": "mat1-kembang-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Ungkapan algebra",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Kembangkan $(x + 2)(x + 3)$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-kembang-v1-o1",
            "text": "$x^2 + 6x + 5$"
          },
          {
            "id": "mat1-kembang-v1-o2",
            "text": "$x^2 + 5x + 6$"
          },
          {
            "id": "mat1-kembang-v1-o3",
            "text": "$x^2 + 5x + 5$"
          },
          {
            "id": "mat1-kembang-v1-o4",
            "text": "$x^2 - 1x + 6$"
          }
        ]
      }
    },
    {
      "id": "mat1-kembang-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Ungkapan algebra",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Kembangkan $(x + 1)(x + 4)$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-kembang-v2-o1",
            "text": "$x^2 + 4x + 5$"
          },
          {
            "id": "mat1-kembang-v2-o2",
            "text": "$x^2 + 5x + 5$"
          },
          {
            "id": "mat1-kembang-v2-o3",
            "text": "$x^2 + 5x + 4$"
          },
          {
            "id": "mat1-kembang-v2-o4",
            "text": "$x^2 - 3x + 4$"
          }
        ]
      }
    },
    {
      "id": "mat1-faktor-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Pemfaktoran",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Faktorkan $x^2 - 7x + 10$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-faktor-v1-o1",
            "text": "$(x + 2)(x + 5)$"
          },
          {
            "id": "mat1-faktor-v1-o2",
            "text": "$(x - 2)(x - 5)$"
          },
          {
            "id": "mat1-faktor-v1-o3",
            "text": "$(x - 2)(x + 5)$"
          },
          {
            "id": "mat1-faktor-v1-o4",
            "text": "$(x + 2)(x - 5)$"
          }
        ]
      }
    },
    {
      "id": "mat1-faktor-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Pemfaktoran",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Faktorkan $x^2 - 7x + 12$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-faktor-v2-o1",
            "text": "$(x + 3)(x + 4)$"
          },
          {
            "id": "mat1-faktor-v2-o2",
            "text": "$(x - 3)(x + 4)$"
          },
          {
            "id": "mat1-faktor-v2-o3",
            "text": "$(x - 3)(x - 4)$"
          },
          {
            "id": "mat1-faktor-v2-o4",
            "text": "$(x + 3)(x - 4)$"
          }
        ]
      }
    },
    {
      "id": "mat1-indeks-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Indeks",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Ringkaskan $3^{5} \\div 3^{2}$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-indeks-v1-o1",
            "text": "$3^{7}$"
          },
          {
            "id": "mat1-indeks-v1-o2",
            "text": "$3^{10}$"
          },
          {
            "id": "mat1-indeks-v1-o3",
            "text": "$3^{3}$"
          },
          {
            "id": "mat1-indeks-v1-o4",
            "text": "$3^{4}$"
          }
        ]
      }
    },
    {
      "id": "mat1-indeks-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Indeks",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Ringkaskan $2^{6} \\div 2^{4}$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-indeks-v2-o1",
            "text": "$2^{10}$"
          },
          {
            "id": "mat1-indeks-v2-o2",
            "text": "$2^{24}$"
          },
          {
            "id": "mat1-indeks-v2-o3",
            "text": "$2^{3}$"
          },
          {
            "id": "mat1-indeks-v2-o4",
            "text": "$2^{2}$"
          }
        ]
      }
    },
    {
      "id": "mat1-kecerunan-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Cari kecerunan garis lurus yang melalui titik $(1, 2)$ dan $(3, 8)$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-kecerunan-v1-o1",
            "text": "3"
          },
          {
            "id": "mat1-kecerunan-v1-o2",
            "text": "$\\frac{1}{3}$"
          },
          {
            "id": "mat1-kecerunan-v1-o3",
            "text": "$\\frac{5}{2}$"
          },
          {
            "id": "mat1-kecerunan-v1-o4",
            "text": "-3"
          }
        ]
      }
    },
    {
      "id": "mat1-kecerunan-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Cari kecerunan garis lurus yang melalui titik $(0, 1)$ dan $(4, 9)$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-kecerunan-v2-o1",
            "text": "$\\frac{1}{2}$"
          },
          {
            "id": "mat1-kecerunan-v2-o2",
            "text": "2"
          },
          {
            "id": "mat1-kecerunan-v2-o3",
            "text": "$\\frac{5}{2}$"
          },
          {
            "id": "mat1-kecerunan-v2-o4",
            "text": "-2"
          }
        ]
      }
    },
    {
      "id": "mat1-kebarangkalian-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Kebarangkalian",
        "sp": [],
        "tp": 2,
        "formOrigin": "T5"
      },
      "stem": "Sebuah beg mengandungi 3 bola merah, 5 bola biru dan 2 bola hijau. Sebiji bola dipilih secara rawak. Cari kebarangkalian bola itu merah.",
      "mcq": {
        "options": [
          {
            "id": "mat1-kebarangkalian-v1-o1",
            "text": "$\\frac{3}{7}$"
          },
          {
            "id": "mat1-kebarangkalian-v1-o2",
            "text": "$\\frac{1}{2}$"
          },
          {
            "id": "mat1-kebarangkalian-v1-o3",
            "text": "$\\frac{4}{5}$"
          },
          {
            "id": "mat1-kebarangkalian-v1-o4",
            "text": "$\\frac{3}{10}$"
          }
        ]
      }
    },
    {
      "id": "mat1-kebarangkalian-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Kebarangkalian",
        "sp": [],
        "tp": 2,
        "formOrigin": "T5"
      },
      "stem": "Sebuah beg mengandungi 4 bola merah, 3 bola biru dan 5 bola hijau. Sebiji bola dipilih secara rawak. Cari kebarangkalian bola itu merah.",
      "mcq": {
        "options": [
          {
            "id": "mat1-kebarangkalian-v2-o1",
            "text": "$\\frac{1}{3}$"
          },
          {
            "id": "mat1-kebarangkalian-v2-o2",
            "text": "$\\frac{1}{2}$"
          },
          {
            "id": "mat1-kebarangkalian-v2-o3",
            "text": "$\\frac{1}{4}$"
          },
          {
            "id": "mat1-kebarangkalian-v2-o4",
            "text": "$\\frac{7}{12}$"
          }
        ]
      }
    },
    {
      "id": "mat1-min-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Cari min bagi data 4, 6, 7, 9, 14.",
      "mcq": {
        "options": [
          {
            "id": "mat1-min-v1-o1",
            "text": "7"
          },
          {
            "id": "mat1-min-v1-o2",
            "text": "9"
          },
          {
            "id": "mat1-min-v1-o3",
            "text": "8"
          },
          {
            "id": "mat1-min-v1-o4",
            "text": "10"
          }
        ]
      }
    },
    {
      "id": "mat1-min-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Cari min bagi data 3, 5, 8, 8, 11.",
      "mcq": {
        "options": [
          {
            "id": "mat1-min-v2-o1",
            "text": "8"
          },
          {
            "id": "mat1-min-v2-o2",
            "text": "9"
          },
          {
            "id": "mat1-min-v2-o3",
            "text": "11"
          },
          {
            "id": "mat1-min-v2-o4",
            "text": "7"
          }
        ]
      }
    },
    {
      "id": "mat1-ketaksamaan-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Ketaksamaan linear",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Selesaikan ketaksamaan $2x + 3 < 11$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-ketaksamaan-v1-o1",
            "text": "$x > 4$"
          },
          {
            "id": "mat1-ketaksamaan-v1-o2",
            "text": "$x < 4$"
          },
          {
            "id": "mat1-ketaksamaan-v1-o3",
            "text": "$x < 8$"
          },
          {
            "id": "mat1-ketaksamaan-v1-o4",
            "text": "$x < 7$"
          }
        ]
      }
    },
    {
      "id": "mat1-ketaksamaan-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Ketaksamaan linear",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Selesaikan ketaksamaan $3x + 1 < 16$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-ketaksamaan-v2-o1",
            "text": "$x > 5$"
          },
          {
            "id": "mat1-ketaksamaan-v2-o2",
            "text": "$x < 15$"
          },
          {
            "id": "mat1-ketaksamaan-v2-o3",
            "text": "$x < 5$"
          },
          {
            "id": "mat1-ketaksamaan-v2-o4",
            "text": "$x < 5.666666666666667$"
          }
        ]
      }
    },
    {
      "id": "mat1-laju-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Laju, jarak dan masa",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Sebuah bas bergerak sejauh 180 km dalam masa 3 jam. Hitung laju purata bas itu.",
      "mcq": {
        "options": [
          {
            "id": "mat1-laju-v1-o1",
            "text": "60 km/j"
          },
          {
            "id": "mat1-laju-v1-o2",
            "text": "540 km/j"
          },
          {
            "id": "mat1-laju-v1-o3",
            "text": "0.016666666666666666 km/j"
          },
          {
            "id": "mat1-laju-v1-o4",
            "text": "70 km/j"
          }
        ]
      }
    },
    {
      "id": "mat1-laju-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Laju, jarak dan masa",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Sebuah bas bergerak sejauh 240 km dalam masa 4 jam. Hitung laju purata bas itu.",
      "mcq": {
        "options": [
          {
            "id": "mat1-laju-v2-o1",
            "text": "960 km/j"
          },
          {
            "id": "mat1-laju-v2-o2",
            "text": "60 km/j"
          },
          {
            "id": "mat1-laju-v2-o3",
            "text": "0.016666666666666666 km/j"
          },
          {
            "id": "mat1-laju-v2-o4",
            "text": "70 km/j"
          }
        ]
      }
    },
    {
      "id": "mat1-poligon-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Poligon",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung sudut pedalaman bagi sebuah poligon sekata yang mempunyai 5 sisi.",
      "mcq": {
        "options": [
          {
            "id": "mat1-poligon-v1-o1",
            "text": "72°"
          },
          {
            "id": "mat1-poligon-v1-o2",
            "text": "540°"
          },
          {
            "id": "mat1-poligon-v1-o3",
            "text": "108°"
          },
          {
            "id": "mat1-poligon-v1-o4",
            "text": "126°"
          }
        ]
      }
    },
    {
      "id": "mat1-poligon-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Poligon",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung sudut pedalaman bagi sebuah poligon sekata yang mempunyai 6 sisi.",
      "mcq": {
        "options": [
          {
            "id": "mat1-poligon-v2-o1",
            "text": "60°"
          },
          {
            "id": "mat1-poligon-v2-o2",
            "text": "720°"
          },
          {
            "id": "mat1-poligon-v2-o3",
            "text": "126°"
          },
          {
            "id": "mat1-poligon-v2-o4",
            "text": "120°"
          }
        ]
      }
    },
    {
      "id": "mat1-pythagoras-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Teorem Pythagoras",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Dalam segi tiga bersudut tegak, dua sisi yang membentuk sudut tegak ialah 3 cm dan 4 cm. Hitung panjang hipotenus.",
      "mcq": {
        "options": [
          {
            "id": "mat1-pythagoras-v1-o1",
            "text": "5 cm"
          },
          {
            "id": "mat1-pythagoras-v1-o2",
            "text": "7 cm"
          },
          {
            "id": "mat1-pythagoras-v1-o3",
            "text": "1 cm"
          },
          {
            "id": "mat1-pythagoras-v1-o4",
            "text": "12 cm"
          }
        ]
      }
    },
    {
      "id": "mat1-pythagoras-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Teorem Pythagoras",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Dalam segi tiga bersudut tegak, dua sisi yang membentuk sudut tegak ialah 5 cm dan 12 cm. Hitung panjang hipotenus.",
      "mcq": {
        "options": [
          {
            "id": "mat1-pythagoras-v2-o1",
            "text": "17 cm"
          },
          {
            "id": "mat1-pythagoras-v2-o2",
            "text": "13 cm"
          },
          {
            "id": "mat1-pythagoras-v2-o3",
            "text": "7 cm"
          },
          {
            "id": "mat1-pythagoras-v2-o4",
            "text": "60 cm"
          }
        ]
      }
    },
    {
      "id": "mat1-bulatan-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Bulatan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung luas sebuah bulatan berjejari 7 cm. [Guna $\\pi = \\frac{22}{7}$]",
      "mcq": {
        "options": [
          {
            "id": "mat1-bulatan-v1-o1",
            "text": "44 cm²"
          },
          {
            "id": "mat1-bulatan-v1-o2",
            "text": "308 cm²"
          },
          {
            "id": "mat1-bulatan-v1-o3",
            "text": "165 cm²"
          },
          {
            "id": "mat1-bulatan-v1-o4",
            "text": "154 cm²"
          }
        ]
      }
    },
    {
      "id": "mat1-bulatan-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Bulatan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung luas sebuah bulatan berjejari 14 cm. [Guna $\\pi = \\frac{22}{7}$]",
      "mcq": {
        "options": [
          {
            "id": "mat1-bulatan-v2-o1",
            "text": "616 cm²"
          },
          {
            "id": "mat1-bulatan-v2-o2",
            "text": "88 cm²"
          },
          {
            "id": "mat1-bulatan-v2-o3",
            "text": "1232 cm²"
          },
          {
            "id": "mat1-bulatan-v2-o4",
            "text": "627 cm²"
          }
        ]
      }
    },
    {
      "id": "mat1-set-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Set",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Diberi $n(A) = 12$, $n(B) = 9$ dan $n(A \\cap B) = 4$. Cari $n(A \\cup B)$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-set-v1-o1",
            "text": "21"
          },
          {
            "id": "mat1-set-v1-o2",
            "text": "25"
          },
          {
            "id": "mat1-set-v1-o3",
            "text": "17"
          },
          {
            "id": "mat1-set-v1-o4",
            "text": "8"
          }
        ]
      }
    },
    {
      "id": "mat1-set-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Set",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Diberi $n(A) = 20$, $n(B) = 15$ dan $n(A \\cap B) = 8$. Cari $n(A \\cup B)$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-set-v2-o1",
            "text": "35"
          },
          {
            "id": "mat1-set-v2-o2",
            "text": "43"
          },
          {
            "id": "mat1-set-v2-o3",
            "text": "12"
          },
          {
            "id": "mat1-set-v2-o4",
            "text": "27"
          }
        ]
      }
    },
    {
      "id": "mat1-g1-q1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Teorem Pythagoras",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung panjang AC.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g1-q1-o1",
            "text": "14 cm"
          },
          {
            "id": "mat1-g1-q1-o2",
            "text": "2 cm"
          },
          {
            "id": "mat1-g1-q1-o3",
            "text": "48 cm"
          },
          {
            "id": "mat1-g1-q1-o4",
            "text": "10 cm"
          }
        ]
      },
      "groupId": "mat1-g1"
    },
    {
      "id": "mat1-g1-q2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Perimeter",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung perimeter segi tiga ABC.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g1-q2-o1",
            "text": "24 cm"
          },
          {
            "id": "mat1-g1-q2-o2",
            "text": "14 cm"
          },
          {
            "id": "mat1-g1-q2-o3",
            "text": "48 cm"
          },
          {
            "id": "mat1-g1-q2-o4",
            "text": "22 cm"
          }
        ]
      },
      "groupId": "mat1-g1"
    },
    {
      "id": "mat1-g1-q3",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Luas",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung luas segi tiga ABC.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g1-q3-o1",
            "text": "48 cm²"
          },
          {
            "id": "mat1-g1-q3-o2",
            "text": "24 cm²"
          },
          {
            "id": "mat1-g1-q3-o3",
            "text": "14 cm²"
          },
          {
            "id": "mat1-g1-q3-o4",
            "text": "30 cm²"
          }
        ]
      },
      "groupId": "mat1-g1"
    },
    {
      "id": "mat1-g1-q4",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Trigonometri",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Cari nilai $\\tan \\angle ACB$.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g1-q4-o1",
            "text": "$\\frac{3}{4}$"
          },
          {
            "id": "mat1-g1-q4-o2",
            "text": "$\\frac{4}{5}$"
          },
          {
            "id": "mat1-g1-q4-o3",
            "text": "$\\frac{4}{3}$"
          },
          {
            "id": "mat1-g1-q4-o4",
            "text": "$\\frac{3}{5}$"
          }
        ]
      },
      "groupId": "mat1-g1"
    },
    {
      "id": "mat1-g2-q1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Cari beza antara markah tertinggi dengan markah terendah.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g2-q1-o1",
            "text": "35"
          },
          {
            "id": "mat1-g2-q1-o2",
            "text": "55"
          },
          {
            "id": "mat1-g2-q1-o3",
            "text": "45"
          },
          {
            "id": "mat1-g2-q1-o4",
            "text": "90"
          }
        ]
      },
      "groupId": "mat1-g2"
    },
    {
      "id": "mat1-g2-q2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung jumlah markah bagi kelima-lima mata pelajaran.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g2-q2-o1",
            "text": "340"
          },
          {
            "id": "mat1-g2-q2-o2",
            "text": "360"
          },
          {
            "id": "mat1-g2-q2-o3",
            "text": "70"
          },
          {
            "id": "mat1-g2-q2-o4",
            "text": "350"
          }
        ]
      },
      "groupId": "mat1-g2"
    },
    {
      "id": "mat1-g2-q3",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Hitung min markah.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g2-q3-o1",
            "text": "70"
          },
          {
            "id": "mat1-g2-q3-o2",
            "text": "75"
          },
          {
            "id": "mat1-g2-q3-o3",
            "text": "80"
          },
          {
            "id": "mat1-g2-q3-o4",
            "text": "65"
          }
        ]
      },
      "groupId": "mat1-g2"
    },
    {
      "id": "mat1-g2-q4",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Berapakah bilangan mata pelajaran dengan markah melebihi min?",
      "mcq": {
        "options": [
          {
            "id": "mat1-g2-q4-o1",
            "text": "2"
          },
          {
            "id": "mat1-g2-q4-o2",
            "text": "3"
          },
          {
            "id": "mat1-g2-q4-o3",
            "text": "4"
          },
          {
            "id": "mat1-g2-q4-o4",
            "text": "5"
          }
        ]
      },
      "groupId": "mat1-g2"
    },
    {
      "id": "mat1-g3-q1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Cari kecerunan garis PQ.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g3-q1-o1",
            "text": "$\\frac{4}{3}$"
          },
          {
            "id": "mat1-g3-q1-o2",
            "text": "$\\frac{3}{4}$"
          },
          {
            "id": "mat1-g3-q1-o3",
            "text": "$3$"
          },
          {
            "id": "mat1-g3-q1-o4",
            "text": "$\\frac{5}{4}$"
          }
        ]
      },
      "groupId": "mat1-g3"
    },
    {
      "id": "mat1-g3-q2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Cari titik tengah PQ.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g3-q2-o1",
            "text": "$(3, 3)$"
          },
          {
            "id": "mat1-g3-q2-o2",
            "text": "$(4, 3.5)$"
          },
          {
            "id": "mat1-g3-q2-o3",
            "text": "$(3, 3.5)$"
          },
          {
            "id": "mat1-g3-q2-o4",
            "text": "$(2, 3.5)$"
          }
        ]
      },
      "groupId": "mat1-g3"
    },
    {
      "id": "mat1-g3-q3",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Hitung jarak PQ.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g3-q3-o1",
            "text": "7 unit"
          },
          {
            "id": "mat1-g3-q3-o2",
            "text": "25 unit"
          },
          {
            "id": "mat1-g3-q3-o3",
            "text": "4 unit"
          },
          {
            "id": "mat1-g3-q3-o4",
            "text": "5 unit"
          }
        ]
      },
      "groupId": "mat1-g3"
    },
    {
      "id": "mat1-g3-q4",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Cari pintasan-y bagi garis PQ.",
      "mcq": {
        "options": [
          {
            "id": "mat1-g3-q4-o1",
            "text": "$\\frac{5}{4}$"
          },
          {
            "id": "mat1-g3-q4-o2",
            "text": "$2$"
          },
          {
            "id": "mat1-g3-q4-o3",
            "text": "$\\frac{3}{4}$"
          },
          {
            "id": "mat1-g3-q4-o4",
            "text": "$-\\frac{5}{4}$"
          }
        ]
      },
      "groupId": "mat1-g3"
    },
    {
      "id": "mat2-algebra-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Algebra",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Jawab semua soalan.",
      "parts": [
        {
          "id": "mat2-algebra-v1-a",
          "label": "(a)",
          "prompt": "Faktorkan sepenuhnya $3x^2 - 12$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-algebra-v1-b",
          "label": "(b)",
          "prompt": "Selesaikan persamaan $2(x - 3) = 10$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        }
      ]
    },
    {
      "id": "mat2-algebra-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Algebra",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Jawab semua soalan.",
      "parts": [
        {
          "id": "mat2-algebra-v2-a",
          "label": "(a)",
          "prompt": "Faktorkan sepenuhnya $2x^2 - 18$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-algebra-v2-b",
          "label": "(b)",
          "prompt": "Selesaikan persamaan $3(x - 2) = 12$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        }
      ]
    },
    {
      "id": "mat2-segitiga-v1-q1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Teorem Pythagoras",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Rajah menunjukkan segi tiga ABC bersudut tegak di B. AB = 12 cm dan BC = 5 cm.",
      "parts": [
        {
          "id": "mat2-segitiga-v1-q1-a",
          "label": "(a)",
          "prompt": "Hitung panjang, dalam cm, AC.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "cm"
          }
        }
      ],
      "groupId": "mat2-segitiga-v1"
    },
    {
      "id": "mat2-segitiga-v1-q2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Luas dan trigonometri",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Berdasarkan Rajah itu,",
      "parts": [
        {
          "id": "mat2-segitiga-v1-q2-a",
          "label": "(a)",
          "prompt": "hitung luas, dalam cm², segi tiga ABC.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "cm²"
          }
        },
        {
          "id": "mat2-segitiga-v1-q2-b",
          "label": "(b)",
          "prompt": "cari nilai $\\sin \\angle ACB$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        }
      ],
      "groupId": "mat2-segitiga-v1"
    },
    {
      "id": "mat2-segitiga-v2-q1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Teorem Pythagoras",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Rajah menunjukkan segi tiga ABC bersudut tegak di B. AB = 8 cm dan BC = 6 cm.",
      "parts": [
        {
          "id": "mat2-segitiga-v2-q1-a",
          "label": "(a)",
          "prompt": "Hitung panjang, dalam cm, AC.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "cm"
          }
        }
      ],
      "groupId": "mat2-segitiga-v2"
    },
    {
      "id": "mat2-segitiga-v2-q2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Luas dan trigonometri",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Berdasarkan Rajah itu,",
      "parts": [
        {
          "id": "mat2-segitiga-v2-q2-a",
          "label": "(a)",
          "prompt": "hitung luas, dalam cm², segi tiga ABC.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "cm²"
          }
        },
        {
          "id": "mat2-segitiga-v2-q2-b",
          "label": "(b)",
          "prompt": "cari nilai $\\sin \\angle ACB$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        }
      ],
      "groupId": "mat2-segitiga-v2"
    },
    {
      "id": "mat2-diskaun-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Peratusan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Harga asal sehelai baju ialah RM80. Kedai itu memberi diskaun 15%.",
      "parts": [
        {
          "id": "mat2-diskaun-v1-a",
          "label": "(a)",
          "prompt": "Hitung jumlah diskaun, dalam RM.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "RM"
          }
        },
        {
          "id": "mat2-diskaun-v1-b",
          "label": "(b)",
          "prompt": "Hitung harga jualan baju itu selepas diskaun, dalam RM.",
          "marks": 1,
          "answer": {
            "kind": "numeric",
            "unit": "RM"
          }
        }
      ]
    },
    {
      "id": "mat2-diskaun-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Peratusan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Harga asal sehelai baju ialah RM100. Kedai itu memberi diskaun 20%.",
      "parts": [
        {
          "id": "mat2-diskaun-v2-a",
          "label": "(a)",
          "prompt": "Hitung jumlah diskaun, dalam RM.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "RM"
          }
        },
        {
          "id": "mat2-diskaun-v2-b",
          "label": "(b)",
          "prompt": "Hitung harga jualan baju itu selepas diskaun, dalam RM.",
          "marks": 1,
          "answer": {
            "kind": "numeric",
            "unit": "RM"
          }
        }
      ]
    },
    {
      "id": "mat2-diskaun-v3",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Peratusan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Harga asal sehelai baju ialah RM250. Kedai itu memberi diskaun 12%.",
      "parts": [
        {
          "id": "mat2-diskaun-v3-a",
          "label": "(a)",
          "prompt": "Hitung jumlah diskaun, dalam RM.",
          "marks": 2,
          "answer": {
            "kind": "working",
            "unit": "RM"
          }
        },
        {
          "id": "mat2-diskaun-v3-b",
          "label": "(b)",
          "prompt": "Hitung harga jualan baju itu selepas diskaun, dalam RM.",
          "marks": 1,
          "answer": {
            "kind": "numeric",
            "unit": "RM"
          }
        }
      ]
    },
    {
      "id": "mat2-garis-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Persamaan satu garis lurus ialah $y = 2x + 3$.",
      "parts": [
        {
          "id": "mat2-garis-v1-a",
          "label": "(a)",
          "prompt": "Nyatakan kecerunan garis lurus itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        },
        {
          "id": "mat2-garis-v1-b",
          "label": "(b)",
          "prompt": "Nyatakan pintasan-y garis lurus itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        },
        {
          "id": "mat2-garis-v1-c",
          "label": "(c)",
          "prompt": "Cari",
          "marks": 0,
          "children": [
            {
              "id": "mat2-garis-v1-c1",
              "label": "(i)",
              "prompt": "nilai y apabila $x = 4$,",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            },
            {
              "id": "mat2-garis-v1-c2",
              "label": "(ii)",
              "prompt": "nilai x apabila $y = 9$.",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "mat2-garis-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Garis lurus",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Persamaan satu garis lurus ialah $y = 3x + 1$.",
      "parts": [
        {
          "id": "mat2-garis-v2-a",
          "label": "(a)",
          "prompt": "Nyatakan kecerunan garis lurus itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        },
        {
          "id": "mat2-garis-v2-b",
          "label": "(b)",
          "prompt": "Nyatakan pintasan-y garis lurus itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        },
        {
          "id": "mat2-garis-v2-c",
          "label": "(c)",
          "prompt": "Cari",
          "marks": 0,
          "children": [
            {
              "id": "mat2-garis-v2-c1",
              "label": "(i)",
              "prompt": "nilai y apabila $x = 4$,",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            },
            {
              "id": "mat2-garis-v2-c2",
              "label": "(ii)",
              "prompt": "nilai x apabila $y = 10$.",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "mat2-statistik-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Data berikut menunjukkan bilangan buku yang dibaca oleh sekumpulan murid: 4, 6, 7, 7, 9, 12.",
      "parts": [
        {
          "id": "mat2-statistik-v1-a",
          "label": "(a)",
          "prompt": "Hitung min data itu.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-statistik-v1-b",
          "label": "(b)",
          "prompt": "Nyatakan mod data itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        },
        {
          "id": "mat2-statistik-v1-c",
          "label": "(c)",
          "prompt": "Nyatakan median data itu.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-statistik-v1-d",
          "label": "(d)",
          "prompt": "Cari julat data itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        }
      ]
    },
    {
      "id": "mat2-statistik-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Statistik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T1-T3"
      },
      "stem": "Data berikut menunjukkan bilangan buku yang dibaca oleh sekumpulan murid: 3, 5, 5, 8, 9.",
      "parts": [
        {
          "id": "mat2-statistik-v2-a",
          "label": "(a)",
          "prompt": "Hitung min data itu.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-statistik-v2-b",
          "label": "(b)",
          "prompt": "Nyatakan mod data itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        },
        {
          "id": "mat2-statistik-v2-c",
          "label": "(c)",
          "prompt": "Nyatakan median data itu.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-statistik-v2-d",
          "label": "(d)",
          "prompt": "Cari julat data itu.",
          "marks": 1,
          "answer": {
            "kind": "numeric"
          }
        }
      ]
    },
    {
      "id": "mat2-kuadratik-v1",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Persamaan kuadratik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Diberi persamaan kuadratik $x^2 - 5x + 6 = 0$.",
      "parts": [
        {
          "id": "mat2-kuadratik-v1-a",
          "label": "(a)",
          "prompt": "Faktorkan $x^2 - 5x + 6$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-kuadratik-v1-b",
          "label": "(b)",
          "prompt": "Seterusnya,",
          "marks": 0,
          "children": [
            {
              "id": "mat2-kuadratik-v1-b1",
              "label": "(i)",
              "prompt": "selesaikan persamaan kuadratik itu,",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            },
            {
              "id": "mat2-kuadratik-v1-b2",
              "label": "(ii)",
              "prompt": "cari hasil tambah punca-punca persamaan itu.",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "mat2-kuadratik-v2",
      "curriculum": {
        "subject": "MAT",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Persamaan kuadratik",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Diberi persamaan kuadratik $x^2 - 7x + 10 = 0$.",
      "parts": [
        {
          "id": "mat2-kuadratik-v2-a",
          "label": "(a)",
          "prompt": "Faktorkan $x^2 - 7x + 10$.",
          "marks": 2,
          "answer": {
            "kind": "working"
          }
        },
        {
          "id": "mat2-kuadratik-v2-b",
          "label": "(b)",
          "prompt": "Seterusnya,",
          "marks": 0,
          "children": [
            {
              "id": "mat2-kuadratik-v2-b1",
              "label": "(i)",
              "prompt": "selesaikan persamaan kuadratik itu,",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            },
            {
              "id": "mat2-kuadratik-v2-b2",
              "label": "(ii)",
              "prompt": "cari hasil tambah punca-punca persamaan itu.",
              "marks": 2,
              "answer": {
                "kind": "working"
              }
            }
          ]
        }
      ]
    },
    {
      "id": "sn2-sel-q1",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Sel",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Rajah 1 menunjukkan struktur sebuah sel tumbuhan.",
      "parts": [
        {
          "id": "sn2-sel-q1-a",
          "label": "(a)",
          "prompt": "Namakan organel P.",
          "marks": 1,
          "answer": {
            "kind": "short_text"
          }
        },
        {
          "id": "sn2-sel-q1-b",
          "label": "(b)",
          "prompt": "Nyatakan satu fungsi organel Q.",
          "marks": 1,
          "answer": {
            "kind": "short_text"
          }
        },
        {
          "id": "sn2-sel-q1-c",
          "label": "(c)",
          "prompt": "Mengapakah sel ini ialah sel tumbuhan? Beri satu sebab.",
          "marks": 1,
          "answer": {
            "kind": "short_text"
          }
        }
      ],
      "groupId": "sn2-sel"
    },
    {
      "id": "sn2-sel-q2",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Sel",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Berdasarkan Rajah 1,",
      "parts": [
        {
          "id": "sn2-sel-q2-a",
          "label": "(a)",
          "prompt": "namakan organel R.",
          "marks": 1,
          "answer": {
            "kind": "short_text"
          }
        },
        {
          "id": "sn2-sel-q2-b",
          "label": "(b)",
          "prompt": "terangkan fungsi organel R.",
          "marks": 2,
          "answer": {
            "kind": "short_text"
          }
        }
      ],
      "groupId": "sn2-sel"
    },
    {
      "id": "sn2-laju-v1",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Daya dan gerakan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Sebuah kereta mainan bergerak sejauh 600 m dalam masa 40 s.",
      "parts": [
        {
          "id": "sn2-laju-v1-a",
          "label": "(a)",
          "prompt": "Hitung laju kereta mainan itu.",
          "marks": 3,
          "answer": {
            "kind": "working",
            "unit": "m/s"
          }
        }
      ]
    },
    {
      "id": "sn2-laju-v2",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Daya dan gerakan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Sebuah kereta mainan bergerak sejauh 450 m dalam masa 30 s.",
      "parts": [
        {
          "id": "sn2-laju-v2-a",
          "label": "(a)",
          "prompt": "Hitung laju kereta mainan itu.",
          "marks": 3,
          "answer": {
            "kind": "working",
            "unit": "m/s"
          }
        }
      ]
    },
    {
      "id": "sn2-laju-v3",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Daya dan gerakan",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Sebuah kereta mainan bergerak sejauh 900 m dalam masa 60 s.",
      "parts": [
        {
          "id": "sn2-laju-v3-a",
          "label": "(a)",
          "prompt": "Hitung laju kereta mainan itu.",
          "marks": 3,
          "answer": {
            "kind": "working",
            "unit": "m/s"
          }
        }
      ]
    },
    {
      "id": "sn2-osmosis",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Pergerakan bahan merentasi membran",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Terangkan bagaimana air meresap masuk ke dalam sel akar tumbuhan melalui osmosis.",
      "parts": [
        {
          "id": "sn2-osmosis-a",
          "label": "",
          "prompt": "Jawapan anda.",
          "marks": 4,
          "answer": {
            "kind": "short_text"
          }
        }
      ]
    },
    {
      "id": "sn2-fotosintesis",
      "curriculum": {
        "subject": "SN",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Fotosintesis",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Nyatakan empat faktor yang mempengaruhi kadar fotosintesis.",
      "parts": [
        {
          "id": "sn2-fotosintesis-a",
          "label": "",
          "prompt": "Jawapan anda.",
          "marks": 4,
          "answer": {
            "kind": "short_text"
          }
        }
      ]
    },
    {
      "id": "sej2-q1",
      "curriculum": {
        "subject": "SEJ",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Kemerdekaan Tanah Melayu",
        "sp": [],
        "tp": 3,
        "formOrigin": "T4"
      },
      "stem": "Bahan 1 menerangkan usaha rakyat sebelum negara merdeka. Berdasarkan Bahan 1,",
      "parts": [
        {
          "id": "sej2-q1-a",
          "label": "(a)",
          "prompt": "nyatakan dua fakta tentang usaha mencapai kemerdekaan.",
          "marks": 2,
          "answer": {
            "kind": "short_text"
          }
        },
        {
          "id": "sej2-q1-b",
          "label": "(b)",
          "prompt": "jelaskan empat contoh kerjasama antara kaum yang membantu kemerdekaan.",
          "marks": 4,
          "answer": {
            "kind": "short_text"
          }
        }
      ],
      "groupId": "sej2-bahan1"
    },
    {
      "id": "sej2-q2",
      "curriculum": {
        "subject": "SEJ",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Kronologi sejarah negara",
        "sp": [],
        "tp": 2,
        "formOrigin": "T4"
      },
      "stem": "Padankan setiap peristiwa dengan tahun yang betul daripada Bahan 2.",
      "parts": [
        {
          "id": "sej2-q2-a",
          "label": "(a)",
          "prompt": "Persekutuan Tanah Melayu ditubuhkan.",
          "marks": 1,
          "answer": {
            "kind": "match_letter"
          }
        },
        {
          "id": "sej2-q2-b",
          "label": "(b)",
          "prompt": "Pilihan raya umum pertama diadakan.",
          "marks": 1,
          "answer": {
            "kind": "match_letter"
          }
        },
        {
          "id": "sej2-q2-c",
          "label": "(c)",
          "prompt": "Negara mencapai kemerdekaan.",
          "marks": 1,
          "answer": {
            "kind": "match_letter"
          }
        }
      ],
      "groupId": "sej2-bahan2"
    },
    {
      "id": "sej2-q3",
      "curriculum": {
        "subject": "SEJ",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Kemerdekaan Tanah Melayu",
        "sp": [],
        "tp": 4,
        "formOrigin": "T4"
      },
      "stem": "Huraikan kepentingan perlembagaan kepada sebuah negara yang baharu merdeka.",
      "parts": [
        {
          "id": "sej2-q3-a",
          "label": "",
          "prompt": "Jawapan anda (100 hingga 200 patah perkataan).",
          "marks": 10,
          "answer": {
            "kind": "essay",
            "wordRange": {
              "min": 100,
              "max": 200
            }
          }
        }
      ]
    },
    {
      "id": "sej2-q4",
      "curriculum": {
        "subject": "SEJ",
        "level": "T4+T5",
        "unit": null,
        "unitLabel": "Kemerdekaan Tanah Melayu",
        "sp": [],
        "tp": 4,
        "formOrigin": "T4"
      },
      "stem": "Jelaskan peranan kerjasama antara kaum dalam membina perpaduan negara.",
      "parts": [
        {
          "id": "sej2-q4-a",
          "label": "",
          "prompt": "Jawapan anda (100 hingga 200 patah perkataan).",
          "marks": 10,
          "answer": {
            "kind": "essay",
            "wordRange": {
              "min": 100,
              "max": 200
            }
          }
        }
      ]
    }
  ],
  "schemes": [
    {
      "id": "mat1-pecahan-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-pecahan-v1-o3",
        "reason": "Samakan penyebut: 5/6."
      }
    },
    {
      "id": "mat1-pecahan-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-pecahan-v2-o4",
        "reason": "Samakan penyebut: 11/12."
      }
    },
    {
      "id": "mat1-peratus-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-peratus-v1-o3",
        "reason": "15/100 x 240 = 36."
      }
    },
    {
      "id": "mat1-peratus-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-peratus-v2-o4",
        "reason": "20/100 x 150 = 30."
      }
    },
    {
      "id": "mat1-bentuk-piawai-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-bentuk-piawai-v1-o4",
        "reason": "4.5 x 10^4."
      }
    },
    {
      "id": "mat1-bentuk-piawai-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-bentuk-piawai-v2-o1",
        "reason": "3.2 x 10^-4."
      }
    },
    {
      "id": "mat1-persamaan-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-persamaan-v1-o1",
        "reason": "3x = 12, x = 4."
      }
    },
    {
      "id": "mat1-persamaan-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-persamaan-v2-o2",
        "reason": "2x = 14, x = 7."
      }
    },
    {
      "id": "mat1-kembang-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-kembang-v1-o2",
        "reason": "x^2 + 5x + 6."
      }
    },
    {
      "id": "mat1-kembang-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-kembang-v2-o3",
        "reason": "x^2 + 5x + 4."
      }
    },
    {
      "id": "mat1-faktor-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-faktor-v1-o2",
        "reason": "Dua nombor hasil darab 10, hasil tambah 7."
      }
    },
    {
      "id": "mat1-faktor-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-faktor-v2-o3",
        "reason": "Dua nombor hasil darab 12, hasil tambah 7."
      }
    },
    {
      "id": "mat1-indeks-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-indeks-v1-o3",
        "reason": "5 - 2 = 3."
      }
    },
    {
      "id": "mat1-indeks-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-indeks-v2-o4",
        "reason": "6 - 4 = 2."
      }
    },
    {
      "id": "mat1-kecerunan-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-kecerunan-v1-o1",
        "reason": "m = (8 - 2) / (3 - 1)."
      }
    },
    {
      "id": "mat1-kecerunan-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-kecerunan-v2-o2",
        "reason": "m = (9 - 1) / (4 - 0)."
      }
    },
    {
      "id": "mat1-kebarangkalian-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-kebarangkalian-v1-o4",
        "reason": "3 / 10."
      }
    },
    {
      "id": "mat1-kebarangkalian-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-kebarangkalian-v2-o1",
        "reason": "4 / 12."
      }
    },
    {
      "id": "mat1-min-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-min-v1-o3",
        "reason": "Jumlah 40 dibahagi 5."
      }
    },
    {
      "id": "mat1-min-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-min-v2-o4",
        "reason": "Jumlah 35 dibahagi 5."
      }
    },
    {
      "id": "mat1-ketaksamaan-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-ketaksamaan-v1-o2",
        "reason": "2x < 8."
      }
    },
    {
      "id": "mat1-ketaksamaan-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-ketaksamaan-v2-o3",
        "reason": "3x < 15."
      }
    },
    {
      "id": "mat1-laju-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-laju-v1-o1",
        "reason": "180 / 3 = 60."
      }
    },
    {
      "id": "mat1-laju-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-laju-v2-o2",
        "reason": "240 / 4 = 60."
      }
    },
    {
      "id": "mat1-poligon-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-poligon-v1-o3",
        "reason": "(5 - 2) x 180 / 5."
      }
    },
    {
      "id": "mat1-poligon-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-poligon-v2-o4",
        "reason": "(6 - 2) x 180 / 6."
      }
    },
    {
      "id": "mat1-pythagoras-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-pythagoras-v1-o1",
        "reason": "Akar punca kuasa dua (3^2 + 4^2) = 5."
      }
    },
    {
      "id": "mat1-pythagoras-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-pythagoras-v2-o2",
        "reason": "Akar punca kuasa dua (5^2 + 12^2) = 13."
      }
    },
    {
      "id": "mat1-bulatan-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-bulatan-v1-o4",
        "reason": "22/7 x 7^2 = 154."
      }
    },
    {
      "id": "mat1-bulatan-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-bulatan-v2-o1",
        "reason": "22/7 x 14^2 = 616."
      }
    },
    {
      "id": "mat1-set-v1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-set-v1-o3",
        "reason": "12 + 9 - 4."
      }
    },
    {
      "id": "mat1-set-v2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-set-v2-o4",
        "reason": "20 + 15 - 8."
      }
    },
    {
      "id": "mat1-g1-q1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g1-q1-o4",
        "reason": "AC = akar (8^2 + 6^2) = 10."
      }
    },
    {
      "id": "mat1-g1-q2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g1-q2-o1",
        "reason": "8 + 6 + 10 = 24."
      }
    },
    {
      "id": "mat1-g1-q3",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g1-q3-o2",
        "reason": "1/2 x 8 x 6 = 24."
      }
    },
    {
      "id": "mat1-g1-q4",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g1-q4-o3",
        "reason": "tan = bertentangan / bersebelahan = 8/6."
      }
    },
    {
      "id": "mat1-g2-q1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g2-q1-o3",
        "reason": "90 - 45 = 45."
      }
    },
    {
      "id": "mat1-g2-q2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g2-q2-o4",
        "reason": "60 + 75 + 80 + 45 + 90."
      }
    },
    {
      "id": "mat1-g2-q3",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g2-q3-o1",
        "reason": "350 / 5."
      }
    },
    {
      "id": "mat1-g2-q4",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g2-q4-o2",
        "reason": "75, 80 dan 90 melebihi 70."
      }
    },
    {
      "id": "mat1-g3-q1",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g3-q1-o2",
        "reason": "(5 - 2) / (5 - 1)."
      }
    },
    {
      "id": "mat1-g3-q2",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g3-q2-o3",
        "reason": "((1+5)/2, (2+5)/2)."
      }
    },
    {
      "id": "mat1-g3-q3",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g3-q3-o4",
        "reason": "akar (4^2 + 3^2) = 5."
      }
    },
    {
      "id": "mat1-g3-q4",
      "scheme": {
        "kind": "option",
        "marks": 1,
        "correct": "mat1-g3-q4-o1",
        "reason": "c = 2 - (3/4)(1)."
      }
    },
    {
      "id": "mat2-algebra-v1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Mengeluarkan faktor sepunya",
            "match": {
              "type": "step",
              "accept": [
                "3(x^2-4)"
              ]
            },
            "id": "mat2-algebra-v1-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Faktor lengkap",
            "match": {
              "type": "final"
            },
            "id": "mat2-algebra-v1-a-p2"
          }
        ],
        "final": {
          "accept": [
            "3(x-2)(x+2)"
          ],
          "display": "3(x - 2)(x + 2)",
          "mustContain": "(",
          "formHint": "Jawapan mesti dalam bentuk faktor."
        }
      }
    },
    {
      "id": "mat2-algebra-v1-b",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Kembangkan atau bahagi kedua-dua belah",
            "match": {
              "type": "step",
              "accept": [
                "x-3=5",
                "2x-6=10",
                "2x=16"
              ]
            },
            "id": "mat2-algebra-v1-b-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai x betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-algebra-v1-b-p2"
          }
        ],
        "final": {
          "accept": [
            "8"
          ],
          "display": "x = 8"
        }
      }
    },
    {
      "id": "mat2-algebra-v2-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Mengeluarkan faktor sepunya",
            "match": {
              "type": "step",
              "accept": [
                "2(x^2-9)"
              ]
            },
            "id": "mat2-algebra-v2-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Faktor lengkap",
            "match": {
              "type": "final"
            },
            "id": "mat2-algebra-v2-a-p2"
          }
        ],
        "final": {
          "accept": [
            "2(x-3)(x+3)"
          ],
          "display": "2(x - 3)(x + 3)",
          "mustContain": "(",
          "formHint": "Jawapan mesti dalam bentuk faktor."
        }
      }
    },
    {
      "id": "mat2-algebra-v2-b",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Kembangkan atau bahagi kedua-dua belah",
            "match": {
              "type": "step",
              "accept": [
                "x-2=4",
                "3x-6=12",
                "3x=18"
              ]
            },
            "id": "mat2-algebra-v2-b-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai x betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-algebra-v2-b-p2"
          }
        ],
        "final": {
          "accept": [
            "6"
          ],
          "display": "x = 6"
        }
      }
    },
    {
      "id": "mat2-segitiga-v1-q1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menggunakan teorem Pythagoras",
            "match": {
              "type": "step",
              "accept": [
                "12^2+5^2",
                "sqrt(12^2+5^2)",
                "169"
              ]
            },
            "id": "mat2-segitiga-v1-q1-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Panjang AC betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-segitiga-v1-q1-a-p2"
          }
        ],
        "final": {
          "accept": [
            "13"
          ],
          "unit": "cm",
          "display": "13\\text{ cm}"
        }
      }
    },
    {
      "id": "mat2-segitiga-v1-q2-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menggunakan luas = 1/2 x tapak x tinggi",
            "match": {
              "type": "step",
              "accept": [
                "1/2*12*5",
                "(12*5)/2",
                "60/2"
              ]
            },
            "id": "mat2-segitiga-v1-q2-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Luas betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-segitiga-v1-q2-a-p2"
          }
        ],
        "final": {
          "accept": [
            "30"
          ],
          "unit": "cm²",
          "display": "30\\text{ cm}^{2}"
        }
      }
    },
    {
      "id": "mat2-segitiga-v1-q2-b",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Sisi bertentangan / hipotenus",
            "match": {
              "type": "step",
              "accept": [
                "12/13",
                "AB/AC"
              ]
            },
            "id": "mat2-segitiga-v1-q2-b-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai sin betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-segitiga-v1-q2-b-p2"
          }
        ],
        "final": {
          "accept": [
            "12/13"
          ],
          "tolerance": 0.001,
          "display": "\\frac{12}{13}"
        }
      }
    },
    {
      "id": "mat2-segitiga-v2-q1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menggunakan teorem Pythagoras",
            "match": {
              "type": "step",
              "accept": [
                "8^2+6^2",
                "sqrt(8^2+6^2)",
                "100"
              ]
            },
            "id": "mat2-segitiga-v2-q1-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Panjang AC betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-segitiga-v2-q1-a-p2"
          }
        ],
        "final": {
          "accept": [
            "10"
          ],
          "unit": "cm",
          "display": "10\\text{ cm}"
        }
      }
    },
    {
      "id": "mat2-segitiga-v2-q2-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menggunakan luas = 1/2 x tapak x tinggi",
            "match": {
              "type": "step",
              "accept": [
                "1/2*8*6",
                "(8*6)/2",
                "48/2"
              ]
            },
            "id": "mat2-segitiga-v2-q2-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Luas betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-segitiga-v2-q2-a-p2"
          }
        ],
        "final": {
          "accept": [
            "24"
          ],
          "unit": "cm²",
          "display": "24\\text{ cm}^{2}"
        }
      }
    },
    {
      "id": "mat2-segitiga-v2-q2-b",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Sisi bertentangan / hipotenus",
            "match": {
              "type": "step",
              "accept": [
                "8/10",
                "AB/AC"
              ]
            },
            "id": "mat2-segitiga-v2-q2-b-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai sin betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-segitiga-v2-q2-b-p2"
          }
        ],
        "final": {
          "accept": [
            "8/10"
          ],
          "tolerance": 0.001,
          "display": "\\frac{8}{10}"
        }
      }
    },
    {
      "id": "mat2-diskaun-v1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Peratus x harga asal",
            "match": {
              "type": "step",
              "accept": [
                "15/100*80",
                "0.15*80",
                "15%*80"
              ]
            },
            "id": "mat2-diskaun-v1-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Diskaun betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-diskaun-v1-a-p2"
          }
        ],
        "final": {
          "accept": [
            "12"
          ],
          "unit": "RM",
          "display": "\\text{RM}12"
        }
      }
    },
    {
      "id": "mat2-diskaun-v1-b",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "code": "N",
            "marks": 1,
            "label": "Harga jualan betul",
            "match": {
              "type": "final"
            },
            "ecf": {
              "fromPart": "mat2-diskaun-v1-a",
              "rule": {
                "op": "sub_from",
                "k": 80
              },
              "note": "Diterima mengikut ECF: jawapan (a) dibawa ke hadapan."
            },
            "id": "mat2-diskaun-v1-b-p1"
          }
        ],
        "final": {
          "accept": [
            "68"
          ],
          "unit": "RM",
          "display": "\\text{RM}68"
        }
      }
    },
    {
      "id": "mat2-diskaun-v2-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Peratus x harga asal",
            "match": {
              "type": "step",
              "accept": [
                "20/100*100",
                "0.2*100",
                "20%*100"
              ]
            },
            "id": "mat2-diskaun-v2-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Diskaun betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-diskaun-v2-a-p2"
          }
        ],
        "final": {
          "accept": [
            "20"
          ],
          "unit": "RM",
          "display": "\\text{RM}20"
        }
      }
    },
    {
      "id": "mat2-diskaun-v2-b",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "code": "N",
            "marks": 1,
            "label": "Harga jualan betul",
            "match": {
              "type": "final"
            },
            "ecf": {
              "fromPart": "mat2-diskaun-v2-a",
              "rule": {
                "op": "sub_from",
                "k": 100
              },
              "note": "Diterima mengikut ECF: jawapan (a) dibawa ke hadapan."
            },
            "id": "mat2-diskaun-v2-b-p1"
          }
        ],
        "final": {
          "accept": [
            "80"
          ],
          "unit": "RM",
          "display": "\\text{RM}80"
        }
      }
    },
    {
      "id": "mat2-diskaun-v3-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Peratus x harga asal",
            "match": {
              "type": "step",
              "accept": [
                "12/100*250",
                "0.12*250",
                "12%*250"
              ]
            },
            "id": "mat2-diskaun-v3-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Diskaun betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-diskaun-v3-a-p2"
          }
        ],
        "final": {
          "accept": [
            "30"
          ],
          "unit": "RM",
          "display": "\\text{RM}30"
        }
      }
    },
    {
      "id": "mat2-diskaun-v3-b",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "code": "N",
            "marks": 1,
            "label": "Harga jualan betul",
            "match": {
              "type": "final"
            },
            "ecf": {
              "fromPart": "mat2-diskaun-v3-a",
              "rule": {
                "op": "sub_from",
                "k": 250
              },
              "note": "Diterima mengikut ECF: jawapan (a) dibawa ke hadapan."
            },
            "id": "mat2-diskaun-v3-b-p1"
          }
        ],
        "final": {
          "accept": [
            "220"
          ],
          "unit": "RM",
          "display": "\\text{RM}220"
        }
      }
    },
    {
      "id": "mat2-garis-v1-a",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "2"
          }
        ]
      }
    },
    {
      "id": "mat2-garis-v1-b",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "3"
          }
        ]
      }
    },
    {
      "id": "mat2-garis-v1-c1",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Gantikan nilai x",
            "match": {
              "type": "step",
              "accept": [
                "2*4+3",
                "8+3"
              ]
            },
            "id": "mat2-garis-v1-c1-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai y betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-garis-v1-c1-p2"
          }
        ],
        "final": {
          "accept": [
            "11"
          ],
          "display": "y = 11"
        }
      }
    },
    {
      "id": "mat2-garis-v1-c2",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Gantikan nilai y",
            "match": {
              "type": "step",
              "accept": [
                "2x+3=9",
                "2x=6",
                "9=2x+3"
              ]
            },
            "id": "mat2-garis-v1-c2-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai x betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-garis-v1-c2-p2"
          }
        ],
        "final": {
          "accept": [
            "3"
          ],
          "display": "x = 3"
        }
      }
    },
    {
      "id": "mat2-garis-v2-a",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "3"
          }
        ]
      }
    },
    {
      "id": "mat2-garis-v2-b",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "1"
          }
        ]
      }
    },
    {
      "id": "mat2-garis-v2-c1",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Gantikan nilai x",
            "match": {
              "type": "step",
              "accept": [
                "3*4+1",
                "12+1"
              ]
            },
            "id": "mat2-garis-v2-c1-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai y betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-garis-v2-c1-p2"
          }
        ],
        "final": {
          "accept": [
            "13"
          ],
          "display": "y = 13"
        }
      }
    },
    {
      "id": "mat2-garis-v2-c2",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Gantikan nilai y",
            "match": {
              "type": "step",
              "accept": [
                "3x+1=10",
                "3x=9",
                "10=3x+1"
              ]
            },
            "id": "mat2-garis-v2-c2-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Nilai x betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-garis-v2-c2-p2"
          }
        ],
        "final": {
          "accept": [
            "3"
          ],
          "display": "x = 3"
        }
      }
    },
    {
      "id": "mat2-statistik-v1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Jumlah dibahagi bilangan nilai",
            "match": {
              "type": "step",
              "accept": [
                "45/6"
              ]
            },
            "id": "mat2-statistik-v1-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Min betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-statistik-v1-a-p2"
          }
        ],
        "final": {
          "accept": [
            "7.5"
          ],
          "display": "7.5"
        }
      }
    },
    {
      "id": "mat2-statistik-v1-b",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "7"
          }
        ]
      }
    },
    {
      "id": "mat2-statistik-v1-d",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "8"
          }
        ]
      }
    },
    {
      "id": "mat2-statistik-v1-c",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menyusun data dan mengenal pasti nilai tengah",
            "match": {
              "type": "step",
              "accept": [
                "(7+7)/2"
              ]
            },
            "id": "mat2-statistik-v1-c-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Median betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-statistik-v1-c-p2"
          }
        ],
        "final": {
          "accept": [
            "7"
          ],
          "display": "7"
        }
      }
    },
    {
      "id": "mat2-statistik-v2-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Jumlah dibahagi bilangan nilai",
            "match": {
              "type": "step",
              "accept": [
                "30/5"
              ]
            },
            "id": "mat2-statistik-v2-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Min betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-statistik-v2-a-p2"
          }
        ],
        "final": {
          "accept": [
            "6"
          ],
          "display": "6"
        }
      }
    },
    {
      "id": "mat2-statistik-v2-b",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "5"
          }
        ]
      }
    },
    {
      "id": "mat2-statistik-v2-d",
      "scheme": {
        "kind": "accepted",
        "marks": 1,
        "values": [
          {
            "v": "6"
          }
        ]
      }
    },
    {
      "id": "mat2-statistik-v2-c",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menyusun data dan mengenal pasti nilai tengah",
            "match": {
              "type": "step",
              "accept": [
                "5"
              ]
            },
            "id": "mat2-statistik-v2-c-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Median betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-statistik-v2-c-p2"
          }
        ],
        "final": {
          "accept": [
            "5"
          ],
          "display": "5"
        }
      }
    },
    {
      "id": "mat2-kuadratik-v1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Dua faktor dengan satu sebutan betul",
            "match": {
              "type": "step",
              "accept": [
                "(x-2)(x-3)"
              ]
            },
            "id": "mat2-kuadratik-v1-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Faktor betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-kuadratik-v1-a-p2"
          }
        ],
        "final": {
          "accept": [
            "(x-2)(x-3)"
          ],
          "mustContain": "(",
          "formHint": "Jawapan mesti dalam bentuk faktor.",
          "display": "(x - 2)(x - 3)"
        }
      }
    },
    {
      "id": "mat2-kuadratik-v1-b1",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menyamakan setiap faktor dengan sifar",
            "match": {
              "type": "step",
              "accept": [
                "x-2=0",
                "x-3=0"
              ]
            },
            "id": "mat2-kuadratik-v1-b1-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Kedua-dua punca betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-kuadratik-v1-b1-p2"
          }
        ],
        "final": {
          "accept": [
            "2, 3"
          ],
          "display": "x = 2,\\ x = 3"
        }
      }
    },
    {
      "id": "mat2-kuadratik-v1-b2",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menambah kedua-dua punca",
            "match": {
              "type": "step",
              "accept": [
                "2+3"
              ]
            },
            "id": "mat2-kuadratik-v1-b2-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Hasil tambah betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-kuadratik-v1-b2-p2"
          }
        ],
        "final": {
          "accept": [
            "5"
          ],
          "display": "5"
        }
      }
    },
    {
      "id": "mat2-kuadratik-v2-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Dua faktor dengan satu sebutan betul",
            "match": {
              "type": "step",
              "accept": [
                "(x-2)(x-5)"
              ]
            },
            "id": "mat2-kuadratik-v2-a-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Faktor betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-kuadratik-v2-a-p2"
          }
        ],
        "final": {
          "accept": [
            "(x-2)(x-5)"
          ],
          "mustContain": "(",
          "formHint": "Jawapan mesti dalam bentuk faktor.",
          "display": "(x - 2)(x - 5)"
        }
      }
    },
    {
      "id": "mat2-kuadratik-v2-b1",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menyamakan setiap faktor dengan sifar",
            "match": {
              "type": "step",
              "accept": [
                "x-2=0",
                "x-5=0"
              ]
            },
            "id": "mat2-kuadratik-v2-b1-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Kedua-dua punca betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-kuadratik-v2-b1-p2"
          }
        ],
        "final": {
          "accept": [
            "2, 5"
          ],
          "display": "x = 2,\\ x = 5"
        }
      }
    },
    {
      "id": "mat2-kuadratik-v2-b2",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "code": "K",
            "marks": 1,
            "label": "Menambah kedua-dua punca",
            "match": {
              "type": "step",
              "accept": [
                "2+5"
              ]
            },
            "id": "mat2-kuadratik-v2-b2-p1"
          },
          {
            "code": "N",
            "marks": 1,
            "label": "Hasil tambah betul",
            "match": {
              "type": "final"
            },
            "id": "mat2-kuadratik-v2-b2-p2"
          }
        ],
        "final": {
          "accept": [
            "7"
          ],
          "display": "7"
        }
      }
    },
    {
      "id": "sn2-sel-q1-a",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "id": "sn2-sel-q1-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Nukleus",
            "match": {
              "type": "keywords",
              "anyOf": [
                "nukleus",
                "nucleus",
                "inti sel"
              ]
            }
          }
        ],
        "model": "nukleus"
      }
    },
    {
      "id": "sn2-sel-q1-b",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "id": "sn2-sel-q1-b-p1",
            "code": "M",
            "marks": 1,
            "label": "Fotosintesis / menghasilkan makanan",
            "match": {
              "type": "keywords",
              "anyOf": [
                "fotosintesis",
                "menghasilkan makanan",
                "klorofil",
                "tenaga cahaya"
              ]
            }
          }
        ],
        "model": "fotosintesis"
      }
    },
    {
      "id": "sn2-sel-q1-c",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "id": "sn2-sel-q1-c-p1",
            "code": "M",
            "marks": 1,
            "label": "Mempunyai dinding sel / kloroplas / vakuol besar",
            "match": {
              "type": "keywords",
              "anyOf": [
                "dinding sel",
                "kloroplas",
                "vakuol besar"
              ]
            }
          }
        ],
        "model": "dinding sel"
      }
    },
    {
      "id": "sn2-sel-q2-a",
      "scheme": {
        "kind": "points",
        "marks": 1,
        "points": [
          {
            "id": "sn2-sel-q2-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Vakuol",
            "match": {
              "type": "keywords",
              "anyOf": [
                "vakuol"
              ]
            }
          }
        ],
        "model": "vakuol"
      }
    },
    {
      "id": "sn2-sel-q2-b",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "id": "sn2-sel-q2-b-p1",
            "code": "M",
            "marks": 1,
            "label": "Menyimpan air / bahan terlarut",
            "match": {
              "type": "keywords",
              "anyOf": [
                "menyimpan",
                "simpan",
                "air"
              ]
            }
          },
          {
            "id": "sn2-sel-q2-b-p2",
            "code": "M",
            "marks": 1,
            "label": "Mengekalkan tekanan turgor / bentuk sel",
            "match": {
              "type": "keywords",
              "anyOf": [
                "turgor",
                "kekal tegang",
                "mengekalkan bentuk"
              ]
            }
          }
        ],
        "model": "Menyimpan air dan mengekalkan tekanan turgor supaya sel kekal tegang."
      }
    },
    {
      "id": "sn2-laju-v1-a",
      "scheme": {
        "kind": "points",
        "marks": 3,
        "points": [
          {
            "id": "sn2-laju-v1-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Jarak / masa",
            "match": {
              "type": "step",
              "accept": [
                "600/40"
              ]
            }
          },
          {
            "id": "sn2-laju-v1-a-p2",
            "code": "M",
            "marks": 1,
            "label": "Nilai laju betul",
            "match": {
              "type": "final"
            }
          },
          {
            "id": "sn2-laju-v1-a-p3",
            "code": "M",
            "marks": 1,
            "label": "Unit betul (m/s)",
            "match": {
              "type": "unit"
            }
          }
        ],
        "final": {
          "accept": [
            "15"
          ],
          "unit": "m/s",
          "display": "15\\text{ m/s}"
        }
      }
    },
    {
      "id": "sn2-laju-v2-a",
      "scheme": {
        "kind": "points",
        "marks": 3,
        "points": [
          {
            "id": "sn2-laju-v2-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Jarak / masa",
            "match": {
              "type": "step",
              "accept": [
                "450/30"
              ]
            }
          },
          {
            "id": "sn2-laju-v2-a-p2",
            "code": "M",
            "marks": 1,
            "label": "Nilai laju betul",
            "match": {
              "type": "final"
            }
          },
          {
            "id": "sn2-laju-v2-a-p3",
            "code": "M",
            "marks": 1,
            "label": "Unit betul (m/s)",
            "match": {
              "type": "unit"
            }
          }
        ],
        "final": {
          "accept": [
            "15"
          ],
          "unit": "m/s",
          "display": "15\\text{ m/s}"
        }
      }
    },
    {
      "id": "sn2-laju-v3-a",
      "scheme": {
        "kind": "points",
        "marks": 3,
        "points": [
          {
            "id": "sn2-laju-v3-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Jarak / masa",
            "match": {
              "type": "step",
              "accept": [
                "900/60"
              ]
            }
          },
          {
            "id": "sn2-laju-v3-a-p2",
            "code": "M",
            "marks": 1,
            "label": "Nilai laju betul",
            "match": {
              "type": "final"
            }
          },
          {
            "id": "sn2-laju-v3-a-p3",
            "code": "M",
            "marks": 1,
            "label": "Unit betul (m/s)",
            "match": {
              "type": "unit"
            }
          }
        ],
        "final": {
          "accept": [
            "15"
          ],
          "unit": "m/s",
          "display": "15\\text{ m/s}"
        }
      }
    },
    {
      "id": "sn2-osmosis-a",
      "scheme": {
        "kind": "points",
        "marks": 4,
        "points": [
          {
            "id": "sn2-osmosis-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Membran separa telap",
            "match": {
              "type": "keywords",
              "anyOf": [
                "separa telap",
                "membran separa"
              ]
            }
          },
          {
            "id": "sn2-osmosis-a-p2",
            "code": "M",
            "marks": 1,
            "label": "Kepekatan larutan di luar sel lebih rendah (hipotonik)",
            "match": {
              "type": "keywords",
              "anyOf": [
                "lebih rendah",
                "kurang pekat",
                "hipotonik",
                "kepekatan rendah"
              ]
            }
          },
          {
            "id": "sn2-osmosis-a-p3",
            "code": "M",
            "marks": 1,
            "label": "Air bergerak dari kepekatan rendah ke tinggi",
            "match": {
              "type": "keywords",
              "anyOf": [
                "kepekatan tinggi",
                "lebih pekat",
                "hipertonik",
                "rendah ke tinggi"
              ]
            }
          },
          {
            "id": "sn2-osmosis-a-p4",
            "code": "M",
            "marks": 1,
            "label": "Sel menjadi tegang (turgid)",
            "match": {
              "type": "keywords",
              "anyOf": [
                "turgid",
                "tegang",
                "turgor"
              ]
            }
          }
        ],
        "model": "Air meresap melalui membran separa telap dari larutan berkepekatan rendah ke kepekatan tinggi dalam sel; sel menjadi turgid."
      }
    },
    {
      "id": "sn2-fotosintesis-a",
      "scheme": {
        "kind": "points",
        "marks": 4,
        "points": [
          {
            "id": "sn2-fotosintesis-a-p1",
            "code": "M",
            "marks": 1,
            "label": "Keamatan cahaya",
            "match": {
              "type": "keywords",
              "anyOf": [
                "cahaya"
              ]
            }
          },
          {
            "id": "sn2-fotosintesis-a-p2",
            "code": "M",
            "marks": 1,
            "label": "Kepekatan karbon dioksida",
            "match": {
              "type": "keywords",
              "anyOf": [
                "karbon dioksida",
                "co2"
              ]
            }
          },
          {
            "id": "sn2-fotosintesis-a-p3",
            "code": "M",
            "marks": 1,
            "label": "Suhu",
            "match": {
              "type": "keywords",
              "anyOf": [
                "suhu"
              ]
            }
          },
          {
            "id": "sn2-fotosintesis-a-p4",
            "code": "M",
            "marks": 1,
            "label": "Bekalan air",
            "match": {
              "type": "keywords",
              "anyOf": [
                "air"
              ]
            }
          },
          {
            "id": "sn2-fotosintesis-a-p5",
            "code": "M",
            "marks": 1,
            "label": "Kandungan klorofil",
            "match": {
              "type": "keywords",
              "anyOf": [
                "klorofil"
              ]
            }
          },
          {
            "id": "sn2-fotosintesis-a-p6",
            "code": "M",
            "marks": 1,
            "label": "Bilangan stoma",
            "match": {
              "type": "keywords",
              "anyOf": [
                "stoma"
              ]
            }
          }
        ],
        "groups": [
          {
            "id": "g1",
            "anyN": 4,
            "pointIds": [
              "sn2-fotosintesis-a-p1",
              "sn2-fotosintesis-a-p2",
              "sn2-fotosintesis-a-p3",
              "sn2-fotosintesis-a-p4",
              "sn2-fotosintesis-a-p5",
              "sn2-fotosintesis-a-p6"
            ]
          }
        ],
        "model": "Mana-mana empat: cahaya, karbon dioksida, suhu, air, klorofil, bilangan stoma."
      }
    },
    {
      "id": "sej2-q1-a",
      "scheme": {
        "kind": "points",
        "marks": 2,
        "points": [
          {
            "id": "sej2-q1-a-p1",
            "code": "F",
            "marks": 1,
            "label": "Rundingan dengan pihak British",
            "match": {
              "type": "keywords",
              "anyOf": [
                "rundingan",
                "berunding"
              ]
            }
          },
          {
            "id": "sej2-q1-a-p2",
            "code": "F",
            "marks": 1,
            "label": "Pilihan raya umum pertama",
            "match": {
              "type": "keywords",
              "anyOf": [
                "pilihan raya"
              ]
            }
          },
          {
            "id": "sej2-q1-a-p3",
            "code": "F",
            "marks": 1,
            "label": "Perlembagaan digubal",
            "match": {
              "type": "keywords",
              "anyOf": [
                "perlembagaan"
              ]
            }
          },
          {
            "id": "sej2-q1-a-p4",
            "code": "F",
            "marks": 1,
            "label": "Kerjasama parti politik pelbagai kaum",
            "match": {
              "type": "keywords",
              "anyOf": [
                "perikatan",
                "parti"
              ]
            }
          }
        ],
        "groups": [
          {
            "id": "g1",
            "anyN": 2,
            "pointIds": [
              "sej2-q1-a-p1",
              "sej2-q1-a-p2",
              "sej2-q1-a-p3",
              "sej2-q1-a-p4"
            ]
          }
        ],
        "model": "Mana-mana 2 fakta: rundingan, pilihan raya, perlembagaan, kerjasama parti."
      }
    },
    {
      "id": "sej2-q1-b",
      "scheme": {
        "kind": "points",
        "marks": 4,
        "points": [
          {
            "id": "sej2-q1-b-p1",
            "code": "C",
            "marks": 1,
            "label": "Kaum bekerjasama dalam satu pertubuhan politik",
            "match": {
              "type": "keywords",
              "anyOf": [
                "pertubuhan",
                "parti"
              ]
            }
          },
          {
            "id": "sej2-q1-b-p2",
            "code": "C",
            "marks": 1,
            "label": "Wakil pelbagai kaum menyertai rundingan",
            "match": {
              "type": "keywords",
              "anyOf": [
                "wakil",
                "delegasi"
              ]
            }
          },
          {
            "id": "sej2-q1-b-p3",
            "code": "C",
            "marks": 1,
            "label": "Persetujuan tentang kerakyatan",
            "match": {
              "type": "keywords",
              "anyOf": [
                "kerakyatan"
              ]
            }
          },
          {
            "id": "sej2-q1-b-p4",
            "code": "C",
            "marks": 1,
            "label": "Persetujuan tentang bahasa kebangsaan",
            "match": {
              "type": "keywords",
              "anyOf": [
                "bahasa kebangsaan",
                "bahasa melayu"
              ]
            }
          },
          {
            "id": "sej2-q1-b-p5",
            "code": "C",
            "marks": 1,
            "label": "Persetujuan tentang kedudukan agama",
            "match": {
              "type": "keywords",
              "anyOf": [
                "agama"
              ]
            }
          },
          {
            "id": "sej2-q1-b-p6",
            "code": "C",
            "marks": 1,
            "label": "Semangat tolak ansur",
            "match": {
              "type": "keywords",
              "anyOf": [
                "tolak ansur",
                "tolak-ansur"
              ]
            }
          }
        ],
        "groups": [
          {
            "id": "g1",
            "anyN": 4,
            "pointIds": [
              "sej2-q1-b-p1",
              "sej2-q1-b-p2",
              "sej2-q1-b-p3",
              "sej2-q1-b-p4",
              "sej2-q1-b-p5",
              "sej2-q1-b-p6"
            ]
          }
        ],
        "model": "Mana-mana 4 contoh, setiap satu dengan huraian ringkas."
      }
    },
    {
      "id": "sej2-q2-a",
      "scheme": {
        "kind": "mapping",
        "marks": 1,
        "map": {
          "sej2-q2-a": "B"
        }
      }
    },
    {
      "id": "sej2-q2-b",
      "scheme": {
        "kind": "mapping",
        "marks": 1,
        "map": {
          "sej2-q2-b": "C"
        }
      }
    },
    {
      "id": "sej2-q2-c",
      "scheme": {
        "kind": "mapping",
        "marks": 1,
        "map": {
          "sej2-q2-c": "D"
        }
      }
    },
    {
      "id": "sej2-q3-a",
      "scheme": {
        "kind": "rubric",
        "marks": 10,
        "criteria": [
          {
            "id": "fakta",
            "name": "Fakta"
          },
          {
            "id": "huraian",
            "name": "Huraian"
          },
          {
            "id": "contoh",
            "name": "Contoh"
          }
        ],
        "bands": [
          {
            "name": "Cemerlang",
            "range": [
              9,
              10
            ],
            "descriptor": "Fakta tepat, huraian jelas dan contoh sesuai."
          },
          {
            "name": "Baik",
            "range": [
              6,
              8
            ],
            "descriptor": "Fakta tepat, huraian dan contoh kurang lengkap."
          },
          {
            "name": "Sederhana",
            "range": [
              3,
              5
            ],
            "descriptor": "Fakta asas sahaja, sedikit huraian."
          },
          {
            "name": "Lemah",
            "range": [
              1,
              2
            ],
            "descriptor": "Fakta terhad atau kurang tepat."
          }
        ],
        "notes": [
          "Guru mengesahkan band; markah tidak diberi secara automatik."
        ]
      }
    },
    {
      "id": "sej2-q4-a",
      "scheme": {
        "kind": "rubric",
        "marks": 10,
        "criteria": [
          {
            "id": "fakta",
            "name": "Fakta"
          },
          {
            "id": "huraian",
            "name": "Huraian"
          },
          {
            "id": "contoh",
            "name": "Contoh"
          }
        ],
        "bands": [
          {
            "name": "Cemerlang",
            "range": [
              9,
              10
            ],
            "descriptor": "Fakta tepat, huraian jelas dan contoh sesuai."
          },
          {
            "name": "Baik",
            "range": [
              6,
              8
            ],
            "descriptor": "Fakta tepat, huraian dan contoh kurang lengkap."
          },
          {
            "name": "Sederhana",
            "range": [
              3,
              5
            ],
            "descriptor": "Fakta asas sahaja, sedikit huraian."
          },
          {
            "name": "Lemah",
            "range": [
              1,
              2
            ],
            "descriptor": "Fakta terhad atau kurang tepat."
          }
        ],
        "notes": [
          "Guru mengesahkan band; markah tidak diberi secara automatik."
        ]
      }
    }
  ]
}
