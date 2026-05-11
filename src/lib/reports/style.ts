// Color palette + cell defaults — ported from /reference/make_chianti_report.js
// All hex values are stripped of `#` (docx convention).

import { BorderStyle } from "docx";

export const PALETTE = {
  brand: "8B1538",
  brandSoft: "F4E4E8",
  meta: "1877F2",
  metaSoft: "E3EFFD",
  google: "0F9D58",
  googleSoft: "E2F0E5",
  accent: "2E75B6",
  context: "E7F0F9",
  contextBorder: "9DC3E6",
  good: "107C41",
  goodLight: "E2EFDA",
  warn: "BF8F00",
  warnLight: "FFF2CC",
  bad: "C00000",
  badLight: "FBE5D6",
  purple: "7030A0",
  purpleLight: "E4D5F7",
  gridGray: "BFBFBF",
  zebra: "F7F7F7",
  textMuted: "595959",
  black: "000000",
  white: "FFFFFF",
} as const;

export const CELL_BORDERS = {
  top: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.gridGray },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.gridGray },
  left: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.gridGray },
  right: { style: BorderStyle.SINGLE, size: 4, color: PALETTE.gridGray },
} as const;

export const CELL_MARGINS = {
  top: 100,
  bottom: 100,
  left: 80,
  right: 80,
} as const;

export const PAGE = {
  width: 11906,
  height: 16838,
  margin: 1080,
} as const;

export const TOTAL_TABLE_WIDTH = 9024;
