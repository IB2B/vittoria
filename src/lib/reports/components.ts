// Building blocks for the .docx report — ported from
// /reference/make_chianti_report.js to TypeScript with the same DXA values.

import {
  AlignmentType,
  BorderStyle,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type ISpacingProperties,
} from "docx";

import {
  CELL_BORDERS,
  CELL_MARGINS,
  PALETTE,
  TOTAL_TABLE_WIDTH,
} from "./style";

const FONT = "Arial";

export type ParagraphOpts = {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  size?: number;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  spacing?: ISpacingProperties;
};

export function p(text: string, opts: ParagraphOpts = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: opts.spacing,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italics,
        color: opts.color,
        size: opts.size,
        font: FONT,
      }),
    ],
  });
}

export function sectionTitle(text: string, color: string = PALETTE.brand): Paragraph {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 4 },
    },
    children: [
      new TextRun({
        text,
        bold: true,
        size: 26,
        color,
        font: FONT,
      }),
    ],
  });
}

export function h1(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text,
        bold: true,
        size: 40,
        color: PALETTE.brand,
        font: FONT,
      }),
    ],
  });
}

export function subtitle(text: string): Paragraph {
  return new Paragraph({
    spacing: { after: 240 },
    alignment: AlignmentType.CENTER,
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 12,
        color: PALETTE.brand,
        space: 6,
      },
    },
    children: [
      new TextRun({
        text,
        size: 22,
        color: PALETTE.textMuted,
        italics: true,
        font: FONT,
      }),
    ],
  });
}

// --- Metric cards (4-up row) ---

export type MetricCardSpec = {
  value: string;
  label: string;
  sub?: string;
  color: string;
};

function metricCard(spec: MetricCardSpec, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: { fill: PALETTE.white, type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 180, bottom: 180, left: 160, right: 160 },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: spec.value,
            bold: true,
            size: 40,
            color: spec.color,
            font: FONT,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 20 },
        children: [
          new TextRun({
            text: spec.label,
            bold: true,
            size: 20,
            color: PALETTE.black,
            font: FONT,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: spec.sub ?? "",
            size: 18,
            color: PALETTE.textMuted,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

export function metricsRow(cards: MetricCardSpec[]): Table {
  const w = Math.floor(TOTAL_TABLE_WIDTH / cards.length);
  const widths = new Array(cards.length).fill(w);
  widths[widths.length - 1] = TOTAL_TABLE_WIDTH - w * (cards.length - 1);
  return new Table({
    width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({
        children: cards.map((c, i) => metricCard(c, widths[i])),
      }),
    ],
  });
}

// --- Generic data table ---

export type DataCellSpec = {
  text: string;
  bold?: boolean;
  italics?: boolean;
  color?: string;
  fill?: string;
  align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  size?: number;
};

export type DataCellInput = string | DataCellSpec;

function isCellSpec(x: DataCellInput): x is DataCellSpec {
  return typeof x === "object" && x !== null && "text" in x;
}

function headerCell(text: string, width: number, fill: string): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: { fill, type: ShadingType.CLEAR, color: "auto" },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text,
            bold: true,
            size: 18,
            color: PALETTE.white,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

function dataCell(
  value: DataCellInput,
  width: number,
  zebra: boolean,
): TableCell {
  const spec = isCellSpec(value) ? value : { text: value };
  const align = spec.align ?? AlignmentType.CENTER;
  const fill =
    spec.fill ?? (zebra ? PALETTE.zebra : PALETTE.white);
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: CELL_BORDERS,
    shading: { fill, type: ShadingType.CLEAR, color: "auto" },
    margins: CELL_MARGINS,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      new Paragraph({
        alignment: align,
        children: [
          new TextRun({
            text: spec.text || "—",
            bold: spec.bold,
            italics: spec.italics,
            color: spec.color ?? PALETTE.black,
            size: spec.size ?? 19,
            font: FONT,
          }),
        ],
      }),
    ],
  });
}

export type DataTableSpec = {
  headers: string[];
  rows: DataCellInput[][];
  columnWidths: number[];
  headerFill?: string;
};

export function dataTable({
  headers,
  rows,
  columnWidths,
  headerFill = PALETTE.brand,
}: DataTableSpec): Table {
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  const tableRows: TableRow[] = [];
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) =>
        headerCell(h, columnWidths[i], headerFill),
      ),
    }),
  );
  rows.forEach((r, idx) => {
    const zebra = idx % 2 === 1;
    tableRows.push(
      new TableRow({
        children: r.map((cell, i) => dataCell(cell, columnWidths[i], zebra)),
      }),
    );
  });
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths,
    rows: tableRows,
  });
}

// --- Callout box ---

export type CalloutLine = Array<{
  text: string;
  bold?: boolean;
  italics?: boolean;
  color?: string;
}>;

export function calloutBox({
  title,
  body,
  borderColor = PALETTE.contextBorder,
  fill = PALETTE.context,
  titleColor = PALETTE.brand,
}: {
  title: string;
  body: CalloutLine[];
  borderColor?: string;
  fill?: string;
  titleColor?: string;
}): Table {
  return new Table({
    width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [TOTAL_TABLE_WIDTH],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
              bottom: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: borderColor,
              },
              left: {
                style: BorderStyle.SINGLE,
                size: 18,
                color: borderColor,
              },
              right: {
                style: BorderStyle.SINGLE,
                size: 6,
                color: borderColor,
              },
            },
            shading: { fill, type: ShadingType.CLEAR, color: "auto" },
            margins: { top: 160, bottom: 160, left: 240, right: 200 },
            children: [
              new Paragraph({
                spacing: { after: 80 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 22,
                    color: titleColor,
                    font: FONT,
                  }),
                ],
              }),
              ...body.map(
                (line) =>
                  new Paragraph({
                    spacing: { after: 40 },
                    children: line.map(
                      (pc) =>
                        new TextRun({
                          text: pc.text,
                          bold: pc.bold,
                          italics: pc.italics,
                          color: pc.color,
                          size: 20,
                          font: FONT,
                        }),
                    ),
                  }),
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

// --- Priority row ---

export function priorityRow(
  tagFill: string,
  tag: string,
  title: string,
  body: string,
): Table {
  return new Table({
    width: { size: TOTAL_TABLE_WIDTH, type: WidthType.DXA },
    columnWidths: [1600, 7424],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1600, type: WidthType.DXA },
            borders: CELL_BORDERS,
            shading: {
              fill: tagFill,
              type: ShadingType.CLEAR,
              color: "auto",
            },
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: tag,
                    bold: true,
                    size: 20,
                    color: PALETTE.white,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 7424, type: WidthType.DXA },
            borders: CELL_BORDERS,
            shading: {
              fill: PALETTE.white,
              type: ShadingType.CLEAR,
              color: "auto",
            },
            margins: CELL_MARGINS,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { after: 60 },
                children: [
                  new TextRun({
                    text: title,
                    bold: true,
                    size: 21,
                    color: PALETTE.black,
                    font: FONT,
                  }),
                ],
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: body,
                    size: 19,
                    color: PALETTE.textMuted,
                    font: FONT,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

export function spacer(before = 200): Paragraph {
  return new Paragraph({ spacing: { before, after: 80 }, children: [] });
}
