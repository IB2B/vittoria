const fs = require('fs');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, PageOrientation, LevelFormat,
  TabStopType, TabStopPosition,
  HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak
} = require('docx');

// -----------------------
// Colors
// -----------------------
const C = {
  brand:        '8B1538',   // Note del Chianti deep red/wine
  brandSoft:    'F4E4E8',
  meta:         '1877F2',   // Meta blue
  metaSoft:     'E3EFFD',
  google:       '0F9D58',   // Google green
  googleSoft:   'E2F0E5',
  accent:       '2E75B6',
  context:      'E7F0F9',
  contextBorder:'9DC3E6',
  good:         '107C41',
  goodLight:    'E2EFDA',
  warn:         'BF8F00',
  warnLight:    'FFF2CC',
  bad:          'C00000',
  badLight:     'FBE5D6',
  purple:       '7030A0',
  purpleLight:  'E4D5F7',
  gridGray:     'BFBFBF',
  zebra:        'F7F7F7',
  textMuted:    '595959',
  black:        '000000',
};

// -----------------------
// Helpers
// -----------------------
const cellBorders = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: C.gridGray },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: C.gridGray },
  left:   { style: BorderStyle.SINGLE, size: 4, color: C.gridGray },
  right:  { style: BorderStyle.SINGLE, size: 4, color: C.gridGray },
};
const cellMargins = { top: 100, bottom: 100, left: 80, right: 80 };

function p(text, opts = {}) {
  const run = new TextRun({
    text,
    bold: opts.bold,
    italics: opts.italics,
    color: opts.color,
    size: opts.size,
    font: 'Arial',
  });
  return new Paragraph({
    alignment: opts.align,
    spacing: opts.spacing,
    children: [run],
  });
}

function sectionTitle(text, color = C.brand) {
  return new Paragraph({
    spacing: { before: 280, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 26, color, font: 'Arial' })],
  });
}

function h1(text) {
  return new Paragraph({
    spacing: { before: 100, after: 100 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, bold: true, size: 40, color: C.brand, font: 'Arial' })],
  });
}

function subtitle(text) {
  return new Paragraph({
    spacing: { after: 240 },
    alignment: AlignmentType.CENTER,
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: C.brand, space: 6 } },
    children: [new TextRun({ text, size: 22, color: C.textMuted, italics: true, font: 'Arial' })],
  });
}

// Metric cards
function metricCard(value, label, sub, color, width = 2256) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
    margins: { top: 180, bottom: 180, left: 160, right: 160 },
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 60 },
        children: [new TextRun({ text: value, bold: true, size: 40, color, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 20 },
        children: [new TextRun({ text: label, bold: true, size: 20, color: C.black, font: 'Arial' })],
      }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new TextRun({ text: sub || '', size: 18, color: C.textMuted, font: 'Arial' })],
      }),
    ],
  });
}

function metricsRow(cards) {
  const totalWidth = 9024;
  const w = Math.floor(totalWidth / cards.length);
  // adjust last to make sum equal
  const widths = new Array(cards.length).fill(w);
  widths[widths.length - 1] = totalWidth - w * (cards.length - 1);
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: widths,
    rows: [new TableRow({
      children: cards.map((c, i) => metricCard(c.value, c.label, c.sub, c.color, widths[i])),
    })],
  });
}

// Header / data cells
function headerCell(text, width, fill = C.brand) {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, size: 18, color: 'FFFFFF', font: 'Arial' })],
    })],
  });
}

function dataCell(text, width, opts = {}) {
  const align = opts.align || AlignmentType.CENTER;
  const fill = opts.fill || (opts.zebra ? C.zebra : 'FFFFFF');
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill, type: ShadingType.CLEAR },
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({
      alignment: align,
      children: [new TextRun({
        text: String(text),
        bold: opts.bold,
        color: opts.color || C.black,
        size: opts.size || 19,
        font: 'Arial',
      })],
    })],
  });
}

function dataTable({ headers, rows, columnWidths, headerFill = C.brand }) {
  const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
  const tableRows = [];
  tableRows.push(new TableRow({
    tableHeader: true,
    children: headers.map((h, i) => headerCell(h, columnWidths[i], headerFill)),
  }));
  rows.forEach((r, idx) => {
    const zebra = idx % 2 === 1;
    tableRows.push(new TableRow({
      children: r.map((cell, i) => {
        if (cell && typeof cell === 'object' && 'text' in cell) {
          return dataCell(cell.text, columnWidths[i], { ...cell, zebra });
        }
        return dataCell(cell ?? '—', columnWidths[i], { zebra });
      }),
    }));
  });
  return new Table({
    width: { size: tableWidth, type: WidthType.DXA },
    columnWidths,
    rows: tableRows,
  });
}

// Callout box
function calloutBox({ title, body, borderColor = C.contextBorder, fill = C.context }) {
  return new Table({
    width: { size: 9024, type: WidthType.DXA },
    columnWidths: [9024],
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 9024, type: WidthType.DXA },
        borders: {
          top:    { style: BorderStyle.SINGLE, size: 6, color: borderColor },
          bottom: { style: BorderStyle.SINGLE, size: 6, color: borderColor },
          left:   { style: BorderStyle.SINGLE, size: 18, color: borderColor },
          right:  { style: BorderStyle.SINGLE, size: 6, color: borderColor },
        },
        shading: { fill, type: ShadingType.CLEAR },
        margins: { top: 160, bottom: 160, left: 240, right: 200 },
        children: [
          new Paragraph({
            spacing: { after: 80 },
            children: [new TextRun({ text: title, bold: true, size: 22, color: C.brand, font: 'Arial' })],
          }),
          ...body.map(line => new Paragraph({
            spacing: { after: 40 },
            children: line.map(pc => new TextRun({
              text: pc.text,
              bold: pc.bold,
              italics: pc.italics,
              color: pc.color,
              size: 20,
              font: 'Arial',
            })),
          })),
        ],
      })],
    })],
  });
}

// Priority row
function priorityRow(color, tag, title, body) {
  return new Table({
    width: { size: 9024, type: WidthType.DXA },
    columnWidths: [1600, 7424],
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: 1600, type: WidthType.DXA },
          borders: cellBorders,
          shading: { fill: color, type: ShadingType.CLEAR },
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: tag, bold: true, size: 20, color: 'FFFFFF', font: 'Arial' })],
          })],
        }),
        new TableCell({
          width: { size: 7424, type: WidthType.DXA },
          borders: cellBorders,
          shading: { fill: 'FFFFFF', type: ShadingType.CLEAR },
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              spacing: { after: 60 },
              children: [new TextRun({ text: title, bold: true, size: 21, color: C.black, font: 'Arial' })],
            }),
            new Paragraph({
              children: [new TextRun({ text: body, size: 19, color: C.textMuted, font: 'Arial' })],
            }),
          ],
        }),
      ],
    })],
  });
}

// =====================================================================
// DOCUMENT
// =====================================================================

const doc = new Document({
  creator: 'Alpha Digital',
  title: 'Report Performance Campagne Advertising — Note del Chianti',
  styles: {
    default: { document: { run: { font: 'Arial', size: 22 } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 36, bold: true, color: C.brand, font: 'Arial' },
        paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, color: C.brand, font: 'Arial' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
      },
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({
            text: 'Alpha Digital  ·  Report Note del Chianti  ·  8 – 30 Aprile 2026  ·  Fonti: Meta Ads Manager · Google Ads · Backend PrestaShop',
            size: 16, color: C.textMuted, italics: true, font: 'Arial',
          })],
        })],
      }),
    },
    children: [
      // ====== HEADER ======
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        children: [new TextRun({ text: 'NOTE  DEL  CHIANTI', bold: true, size: 30, color: C.brand, font: 'Arial' })],
      }),
      h1('Report Performance Campagne Advertising'),
      subtitle('Note del Chianti  ·  Meta + Google Ads  ·  8 – 30 Aprile 2026'),

      // ====== CONTEXT ======
      calloutBox({
        title: 'Contesto del report',
        body: [
          [
            { text: 'Periodo analizzato: ', bold: true },
            { text: '8 – 30 Aprile 2026', bold: true, color: C.brand },
            { text: ' (23 giorni). Il report copre entrambi i canali advertising attivi per Note del Chianti.' },
          ],
          [
            { text: '  •  Meta (Facebook / Instagram): ', bold: true, color: C.meta },
            { text: 'attiva la campagna ' },
            { text: 'NOTE NEW APRIL // NEW CREATIVES', bold: true },
            { text: ' (le altre 2 fasi sono inactive). 23 giorni di raccolta dati.' },
          ],
          [
            { text: '  •  Google Ads: ', bold: true, color: C.google },
            { text: 'lanciate il ' },
            { text: '15 Aprile', bold: true },
            { text: ' (16 giorni effettivi nel periodo).' },
          ],
          [
            { text: 'Dati ordini: ', bold: true },
            { text: 'verificati da backend PrestaShop. Alcune vendite ' },
            { text: 'non sono state tracciate dal pixel/tag', bold: true, color: C.bad },
            { text: ' di Meta o Google ma sono comunque attribuibili alle campagne (segnalate con asterisco). I valori reali integrano queste vendite.' },
          ],
        ],
      }),

      // ====== COMBINED METRICS ======
      sectionTitle('1.  Risultati Globali  ·  Meta + Google Ads', C.brand),

      p('Vista consolidata di entrambi i canali advertising nel periodo 8 – 30 Aprile 2026, integrando le vendite tracciate e quelle attribuibili da backend.',
        { size: 20, color: C.textMuted, italics: true, spacing: { after: 160 } }),

      metricsRow([
        { value: '€914,93', label: 'Spesa Totale Ads', sub: 'Meta €651,93 + Google €263,00', color: C.brand },
        { value: '11',      label: 'Acquisti Reali',  sub: '5 tracciati + 6 da backend',  color: C.good },
        { value: '€1.172',  label: 'Ricavi Generati', sub: 'Da ordini PrestaShop',         color: C.accent },
        { value: '1,28x',   label: 'ROAS Globale',    sub: 'CPA medio €83,18',             color: C.purple },
      ]),

      new Paragraph({ spacing: { before: 200, after: 80 } }),

      // Channel comparison table
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: 'Confronto Canali  —  Meta vs Google Ads', bold: true, size: 22, color: C.brand, font: 'Arial' })],
      }),
      dataTable({
        headers: ['Canale', 'Periodo', 'Spesa', 'Ordini', 'Ricavi', 'ROAS', 'CPA'],
        columnWidths: [1700, 1500, 1200, 1000, 1200, 1100, 1324],
        rows: [
          [
            { text: 'Meta Ads', bold: true, color: C.meta, fill: C.metaSoft },
            { text: '8 – 30 Aprile (23 gg)', fill: C.metaSoft },
            { text: '€651,93', bold: true, fill: C.metaSoft },
            { text: '7', bold: true, fill: C.metaSoft },
            { text: '€577,00', bold: true, fill: C.metaSoft },
            { text: '0,89x', bold: true, color: C.bad, fill: C.metaSoft },
            { text: '€93,13', fill: C.metaSoft },
          ],
          [
            { text: 'Google Ads', bold: true, color: C.google, fill: C.googleSoft },
            { text: '15 – 30 Aprile (16 gg)', fill: C.googleSoft },
            { text: '€263,00', bold: true, fill: C.googleSoft },
            { text: '4', bold: true, fill: C.googleSoft },
            { text: '€595,00', bold: true, fill: C.googleSoft },
            { text: '2,26x', bold: true, color: C.good, fill: C.googleSoft },
            { text: '€65,75', fill: C.googleSoft },
          ],
          [
            { text: 'TOTALE', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '8 – 30 Aprile', fill: C.brandSoft, bold: true },
            { text: '€914,93', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '11', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '€1.172,00', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '1,28x', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '€83,18', bold: true, fill: C.brandSoft },
          ],
        ],
      }),

      // Pie/share insight
      new Paragraph({ spacing: { before: 200 } }),
      calloutBox({
        title: 'Lettura  ·  Bilancio Globale',
        borderColor: C.brand,
        fill: C.brandSoft,
        body: [
          [
            { text: '▸ Google Ads sta performando meglio: ', bold: true, color: C.good },
            { text: 'genera più ricavi (€595) di Meta (€577) con meno della metà del budget. ROAS Google ' },
            { text: '2,26x', bold: true },
            { text: ' contro Meta ' },
            { text: '0,89x', bold: true, color: C.bad },
            { text: '.' },
          ],
          [
            { text: '▸ Meta sotto break-even: ', bold: true, color: C.bad },
            { text: 'spesa (€651,93) supera i ricavi diretti (€577). Da analizzare creatività e qualità del traffico.' },
          ],
          [
            { text: '▸ Tracciamento incompleto: ', bold: true, color: C.warn },
            { text: '6 ordini su 11 (54%) ' },
            { text: 'non sono stati tracciati dal pixel Meta o dal tag Google', bold: true },
            { text: ' — pari a €853 di ricavi invisibili nelle dashboard. Priorità il fix del tracking.' },
          ],
          [
            { text: '▸ ROAS combinato 1,28x: ', bold: true },
            { text: 'campagne in attivo positivo se si considera l’intera attribution. Senza correzioni il ROAS apparente Meta sarebbe 0,46x.' },
          ],
        ],
      }),

      // ============================================================
      // SECTION 2 — META ADS
      // ============================================================
      sectionTitle('2.  Meta Ads  ·  Facebook / Instagram', C.meta),

      p('Campagna attiva nel periodo: NOTE NEW APRIL // NEW CREATIVES (le 2 campagne PHASE 1 risultano inactive). Dati pixel Meta + integrazione backend.',
        { size: 20, color: C.textMuted, italics: true, spacing: { after: 160 } }),

      metricsRow([
        { value: '€651,93', label: 'Spesa Meta',     sub: '23 giorni di delivery',        color: C.meta },
        { value: '7',       label: 'Acquisti Reali', sub: '4 pixel + 3 da backend',       color: C.good },
        { value: '€577,00', label: 'Ricavi Meta',    sub: 'Da 7 ordini verificati',       color: C.accent },
        { value: '0,89x',   label: 'ROAS Meta',      sub: 'CPA reale €93,13',             color: C.bad },
      ]),

      new Paragraph({ spacing: { before: 200, after: 80 } }),

      // Funnel Meta
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: 'Funnel di Conversione  —  NOTE NEW APRIL // NEW CREATIVES', bold: true, size: 22, color: C.meta, font: 'Arial' })],
      }),
      dataTable({
        headers: ['Fase', 'N°', 'Tasso'],
        columnWidths: [4500, 2200, 2324],
        headerFill: C.meta,
        rows: [
          [{ text: 'Impression', align: AlignmentType.LEFT, bold: true }, '123.468', '—'],
          [{ text: 'Click sul link', align: AlignmentType.LEFT, bold: true }, '1.401', '1,13% CTR'],
          [{ text: 'Visualizzazioni pagina prodotto (LPV)', align: AlignmentType.LEFT, bold: true }, '169', '12,1% dei click'],
          [{ text: 'Acquisti tracciati dal pixel', align: AlignmentType.LEFT, bold: true, color: C.warn }, '4', '2,4% delle LPV'],
          [{ text: 'Acquisti reali (backend)', align: AlignmentType.LEFT, bold: true, color: C.good }, { text: '7', bold: true, color: C.good }, { text: '+75% vs pixel', color: C.good, bold: true }],
        ],
      }),

      new Paragraph({ spacing: { before: 200, after: 80 } }),

      // Engagement table
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: 'Metriche di Consegna ed Engagement', bold: true, size: 22, color: C.meta, font: 'Arial' })],
      }),
      dataTable({
        headers: ['Reach', 'Impression', 'Frequenza', 'CPM', 'CPC link', 'CTR link', 'LPV', '€ / LPV'],
        columnWidths: [1100, 1300, 1100, 1000, 1100, 1100, 1000, 1324],
        headerFill: C.meta,
        rows: [
          ['48.409', '123.468', '2,55', '€5,28', '€0,47', '1,13%', '169', '€3,86'],
        ],
      }),

      new Paragraph({ spacing: { before: 200, after: 80 } }),

      // Orders table Meta
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: 'Ordini Attribuibili a Meta Ads  ·  7 ordini  ·  €577,00', bold: true, size: 22, color: C.meta, font: 'Arial' })],
      }),
      dataTable({
        headers: ['#', 'Cliente', 'Paese', 'Linea', 'Valore', 'Pixel', 'Data'],
        columnWidths: [950, 1850, 1250, 1250, 1100, 1100, 1524],
        headerFill: C.meta,
        rows: [
          ['4399', 'R. Cavalcante', 'Italia', 'Perfumes', '€188,00', { text: 'NO *', color: C.bad, bold: true }, '08/04 · 16:02'],
          ['4404', 'C. Rossato', 'Italia', 'Atelier', '€20,00', { text: 'NO *', color: C.bad, bold: true }, '15/04 · 18:18'],
          ['4405', 'M. Tumminaro', 'Italia', 'Perfumes', '€71,00', { text: 'NO *', color: C.bad, bold: true }, '16/04 · 13:58'],
          ['4406', 'S. Villani', 'Italia', 'Perfumes', '€19,00', { text: 'SÌ', color: C.good, bold: true }, '16/04 · 20:17'],
          ['4411', 'R. Arena', 'Italia', 'Atelier', '€149,00', { text: 'SÌ', color: C.good, bold: true }, '21/04 · 23:44'],
          ['4413', 'S. Mackenzie', 'Regno Unito', 'Atelier', '€109,00', { text: 'SÌ', color: C.good, bold: true }, '23/04 · 15:58'],
          ['4414', 'A. Verta', 'Italia', 'Atelier', '€21,00', { text: 'SÌ', color: C.good, bold: true }, '24/04 · 11:40'],
          [
            { text: 'TOTALE', bold: true, fill: C.metaSoft, color: C.meta },
            { text: '7 ordini', bold: true, fill: C.metaSoft, color: C.meta },
            { text: '—', fill: C.metaSoft },
            { text: '3 Perf · 4 Atel', fill: C.metaSoft },
            { text: '€577,00', bold: true, fill: C.metaSoft, color: C.meta },
            { text: '4 SÌ · 3 NO', fill: C.metaSoft, bold: true },
            { text: '—', fill: C.metaSoft },
          ],
        ],
      }),
      p('* Ordini non tracciati dal pixel Meta — verificati manualmente da backend PrestaShop e attribuibili alla campagna sulla base di referrer/UTM/timing.',
        { size: 16, color: C.textMuted, italics: true, spacing: { before: 60, after: 200 } }),

      // ============================================================
      // SECTION 3 — GOOGLE ADS
      // ============================================================
      sectionTitle('3.  Google Ads', C.google),

      p('Campagne lanciate il 15 Aprile (16 giorni di attività nel periodo). Il tracking conversioni è ancora in fase di setup: 3 ordini su 4 risultano non tracciati ma attribuibili.',
        { size: 20, color: C.textMuted, italics: true, spacing: { after: 160 } }),

      metricsRow([
        { value: '€263,00', label: 'Spesa Google',  sub: '15 – 30 Aprile (16 gg)',         color: C.google },
        { value: '4',       label: 'Acquisti',      sub: '1 tracciato + 3 da backend',     color: C.good },
        { value: '€595,00', label: 'Ricavi Google', sub: 'Da 4 ordini verificati',         color: C.accent },
        { value: '2,26x',   label: 'ROAS Google',   sub: 'CPA €65,75',                     color: C.good },
      ]),

      new Paragraph({ spacing: { before: 200, after: 80 } }),

      // Orders Google
      new Paragraph({
        spacing: { before: 120, after: 80 },
        children: [new TextRun({ text: 'Ordini Attribuibili a Google Ads  ·  4 ordini  ·  €595,00', bold: true, size: 22, color: C.google, font: 'Arial' })],
      }),
      dataTable({
        headers: ['#', 'Cliente', 'Paese', 'Linea', 'Valore', 'Tag', 'Data'],
        columnWidths: [950, 1850, 1250, 1250, 1100, 1100, 1524],
        headerFill: C.google,
        rows: [
          ['4409', 'L. Brunker', 'Australia', 'Perfumes', '€356,00', { text: 'NO *', color: C.bad, bold: true }, '21/04 · 02:23'],
          ['4412', 'G. Cardillo Piacentini', 'Italia', 'Perfumes', '€21,00', { text: 'SÌ', color: C.good, bold: true }, '22/04 · 16:19'],
          ['4416', 'I. Lapenna', 'Italia', 'Atelier', '€69,00', { text: 'NO *', color: C.bad, bold: true }, '25/04 · 12:42'],
          ['4421', 'F. Vannini', 'Italia', 'Atelier', '€149,00', { text: 'NO *', color: C.bad, bold: true }, '29/04 · 16:43'],
          [
            { text: 'TOTALE', bold: true, fill: C.googleSoft, color: C.google },
            { text: '4 ordini', bold: true, fill: C.googleSoft, color: C.google },
            { text: '—', fill: C.googleSoft },
            { text: '2 Perf · 2 Atel', fill: C.googleSoft },
            { text: '€595,00', bold: true, fill: C.googleSoft, color: C.google },
            { text: '1 SÌ · 3 NO', fill: C.googleSoft, bold: true },
            { text: '—', fill: C.googleSoft },
          ],
        ],
      }),
      p('* Ordini non tracciati dal tag Google — verificati manualmente da backend e attribuibili alla campagna.',
        { size: 16, color: C.textMuted, italics: true, spacing: { before: 60, after: 200 } }),

      // Insight Google
      calloutBox({
        title: 'Lettura  ·  Google Ads',
        borderColor: C.google,
        fill: C.googleSoft,
        body: [
          [
            { text: '▸ Best performer: ', bold: true, color: C.good },
            { text: 'l’ordine ' },
            { text: '4409 (Australia, €356)', bold: true },
            { text: ' da solo copre il ROAS della spesa Google complessiva. Indicativo di un mercato internazionale ricettivo da approfondire.' },
          ],
          [
            { text: '▸ Tracking da sistemare: ', bold: true, color: C.warn },
            { text: '3 acquisti su 4 non sono tracciati dal tag Google Ads. Verificare implementazione del Conversion Tracking (gtag/GTM) sulla thank you page.' },
          ],
          [
            { text: '▸ Bilancio canale: ', bold: true, color: C.good },
            { text: 'ROAS 2,26x in soli 16 giorni di attività con €263 di budget — segnale molto positivo. Da considerare un incremento progressivo del budget Google a parità di setup.' },
          ],
        ],
      }),

      // ============================================================
      // SECTION 4 — TRACKING ANALYSIS
      // ============================================================
      sectionTitle('4.  Analisi del Tracciamento', C.warn),

      p('Sintesi degli ordini tracciati dai sistemi pubblicitari rispetto a quelli effettivamente attribuibili da backend PrestaShop.',
        { size: 20, color: C.textMuted, italics: true, spacing: { after: 160 } }),

      dataTable({
        headers: ['Canale', 'Tracciati', 'Non Tracciati', 'Totale Reali', 'Ricavi tracciati', 'Ricavi non tracciati', '% non tracciato'],
        columnWidths: [1200, 1100, 1300, 1200, 1400, 1500, 1324],
        rows: [
          [
            { text: 'Meta Ads', bold: true, color: C.meta, fill: C.metaSoft },
            { text: '4', fill: C.metaSoft },
            { text: '3', fill: C.metaSoft, color: C.bad, bold: true },
            { text: '7', fill: C.metaSoft, bold: true },
            { text: '€298,00', fill: C.metaSoft },
            { text: '€279,00', fill: C.metaSoft, color: C.bad, bold: true },
            { text: '48,4%', fill: C.metaSoft, color: C.bad, bold: true },
          ],
          [
            { text: 'Google Ads', bold: true, color: C.google, fill: C.googleSoft },
            { text: '1', fill: C.googleSoft },
            { text: '3', fill: C.googleSoft, color: C.bad, bold: true },
            { text: '4', fill: C.googleSoft, bold: true },
            { text: '€21,00', fill: C.googleSoft },
            { text: '€574,00', fill: C.googleSoft, color: C.bad, bold: true },
            { text: '96,5%', fill: C.googleSoft, color: C.bad, bold: true },
          ],
          [
            { text: 'TOTALE', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '5', bold: true, fill: C.brandSoft },
            { text: '6', bold: true, fill: C.brandSoft, color: C.bad },
            { text: '11', bold: true, fill: C.brandSoft, color: C.brand },
            { text: '€319,00', bold: true, fill: C.brandSoft },
            { text: '€853,00', bold: true, fill: C.brandSoft, color: C.bad },
            { text: '72,8%', bold: true, fill: C.brandSoft, color: C.bad },
          ],
        ],
      }),

      new Paragraph({ spacing: { before: 200 } }),
      calloutBox({
        title: 'Implicazioni del tracciamento',
        borderColor: C.warn,
        fill: C.warnLight,
        body: [
          [
            { text: '▸ Il 72,8% dei ricavi pubblicitari non è visibile nelle dashboard Meta/Google. ', bold: true },
            { text: 'Le piattaforme stanno ottimizzando con dati parziali, riducendo l’efficacia degli algoritmi di apprendimento.' },
          ],
          [
            { text: '▸ Google Ads è particolarmente impattato: ', bold: true, color: C.bad },
            { text: 'solo 1 ordine su 4 tracciato. ROAS apparente in dashboard ' },
            { text: '0,08x', bold: true, color: C.bad },
            { text: ' ↔ ROAS reale ' },
            { text: '2,26x', bold: true, color: C.good },
            { text: '. La differenza è 28× più alta a favore della realtà.' },
          ],
          [
            { text: '▸ Azione immediata: ', bold: true, color: C.brand },
            { text: 'audit completo del tracking — pixel Meta (eventi Purchase, AddToCart), tag Google (Conversion Tracking, Enhanced Conversions), GA4. Stima 1–2 giorni di lavoro tecnico.' },
          ],
        ],
      }),

      // ============================================================
      // SECTION 5 — PRIORITIES
      // ============================================================
      sectionTitle('5.  Priorità e Prossimi Passi', C.brand),

      priorityRow(C.bad, 'Priorità 1',
        'Audit completo tracciamento conversioni',
        'Il 72,8% delle vendite non è tracciato. Verificare e ricostruire: (1) Pixel Meta — eventi Purchase, ViewContent, AddToCart. (2) Google Ads Conversion Tracking + Enhanced Conversions. (3) GA4 e collegamento ai due account. Senza questo fix, gli algoritmi di Meta e Google ottimizzano su dati parziali.'),
      new Paragraph({ spacing: { after: 120 } }),

      priorityRow(C.warn, 'Priorità 2',
        'Analisi creatività Meta — break-even non raggiunto',
        'ROAS Meta 0,89x: spesa (€651,93) sopra ricavi (€577) anche includendo ordini non tracciati. Da rivedere il mix creativo della campagna NOTE NEW APRIL // NEW CREATIVES e valutare la riattivazione delle 2 fasi PHASE 1 (attualmente inactive) con creatività testate.'),
      new Paragraph({ spacing: { after: 120 } }),

      priorityRow(C.good, 'Priorità 3',
        'Scaling Google Ads — performance positive',
        'ROAS Google 2,26x in 16 giorni. Considerare incremento progressivo del budget (es. +30% nei prossimi 14 giorni) mantenendo struttura attuale. Approfondire il caso Australia (ordine €356): valutare estensione targeting su mercati anglosassoni.'),
      new Paragraph({ spacing: { after: 120 } }),

      priorityRow(C.meta, 'In corso',
        'Monitoraggio settimanale e seconda finestra Atelier',
        'Atelier ha generato 6 ordini su 11 (€520 / €1.172 = 44% dei ricavi). Conferma il trend: la creatività Meta che mostra il processo guidato dell’Alchimista resta una opportunità chiave da testare. Prossimo report previsto: 7 Maggio 2026.'),

      new Paragraph({ spacing: { before: 400 } }),
      p('Prossimo aggiornamento: 7 Maggio 2026.  ·  Dati estratti da Meta Ads Manager, Google Ads, e backend PrestaShop alla data del 30 Aprile 2026.',
        { size: 16, color: C.textMuted, italics: true, align: AlignmentType.CENTER }),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('/sessions/modest-youthful-hamilton/mnt/outputs/Report_Campagne_Note_Del_Chianti_30_Aprile_2026.docx', buffer);
  console.log('OK  ·  Report_Campagne_Note_Del_Chianti_30_Aprile_2026.docx');
});
