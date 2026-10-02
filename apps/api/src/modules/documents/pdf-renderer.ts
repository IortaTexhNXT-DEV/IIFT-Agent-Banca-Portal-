import { Injectable } from '@nestjs/common';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import PDFDocument from 'pdfkit';

const BRAND_MAGENTA = '#E1058C';
const BRAND_ORANGE = '#F58220';
const TEXT_DARK = '#333333';
const TEXT_MUTED = '#6B6B6B';
const COMPANY_NAME = 'Insurans Islam Family Takaful Sendirian Berhad';
const COMPANY_TAGLINE = 'A member of Insurans Islam TAIB Holding';
const LOGO_PATH = fileURLToPath(new URL('../../assets/iift-logo.png', import.meta.url));

export interface PdfTable {
  columns: { header: string; width: number; align?: 'left' | 'right' }[];
  rows: string[][];
}

export interface PdfSection {
  heading: string;
  fields?: [label: string, value: string][];
  table?: PdfTable;
  paragraphs?: string[];
}

export interface PdfDocumentContent {
  title: string;
  reference: string;
  sections: PdfSection[];
  footerNote: string;
}

/**
 * Renders branded A4 documents (e-Policy schedule, e-Receipt). Callers supply already
 * formatted values; this class is only concerned with layout.
 */
@Injectable()
export class PdfRenderer {
  render(content: PdfDocumentContent): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: { Title: `${content.title} ${content.reference}`, Author: COMPANY_NAME },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const finished = new Promise<Buffer>((resolve, reject) => {
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
    });

    this.header(doc, content.title, content.reference);
    for (const section of content.sections) {
      this.section(doc, section);
    }
    this.footer(doc, content.footerNote);
    doc.end();
    return finished;
  }

  private header(doc: PDFKit.PDFDocument, title: string, reference: string): void {
    if (existsSync(LOGO_PATH)) {
      doc.image(LOGO_PATH, 50, 40, { height: 56 });
    }
    doc
      .fillColor(BRAND_MAGENTA)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text(COMPANY_NAME, 95, 48, { width: 450 });
    doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(8.5).text(COMPANY_TAGLINE, 95, 66);
    doc.rect(50, 104, 495, 3).fill(BRAND_ORANGE);
    doc.fillColor(TEXT_DARK).font('Helvetica-Bold').fontSize(16).text(title, 50, 120);
    doc.font('Helvetica').fontSize(10).fillColor(TEXT_MUTED).text(reference, 50, 142);
    doc.moveDown(1.2);
  }

  private section(doc: PDFKit.PDFDocument, section: PdfSection): void {
    this.ensureSpace(doc, 80);
    doc.moveDown(0.6);
    const y = doc.y;
    doc.rect(50, y, 495, 18).fill(BRAND_MAGENTA);
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(section.heading, 56, y + 5);
    doc.y = y + 24;

    for (const [label, value] of section.fields ?? []) {
      this.ensureSpace(doc, 18);
      const rowY = doc.y;
      doc.fillColor(TEXT_MUTED).font('Helvetica').fontSize(9).text(label, 56, rowY, { width: 170 });
      doc
        .fillColor(TEXT_DARK)
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(value || '-', 230, rowY, { width: 310 });
      doc.y = Math.max(doc.y, rowY + 14) + 2;
    }
    if (section.table) {
      this.table(doc, section.table);
    }
    for (const paragraph of section.paragraphs ?? []) {
      this.ensureSpace(doc, 30);
      doc
        .fillColor(TEXT_DARK)
        .font('Helvetica')
        .fontSize(8.5)
        .text(paragraph, 56, doc.y, { width: 485, align: 'justify' });
      doc.moveDown(0.4);
    }
  }

  private table(doc: PDFKit.PDFDocument, table: PdfTable): void {
    const drawRow = (cells: string[], bold: boolean, shaded: boolean) => {
      this.ensureSpace(doc, 18);
      const rowY = doc.y;
      if (shaded) {
        doc.rect(50, rowY - 2, 495, 16).fill('#F7F2F5');
      }
      let x = 56;
      cells.forEach((cell, index) => {
        const column = table.columns[index];
        doc
          .fillColor(TEXT_DARK)
          .font(bold ? 'Helvetica-Bold' : 'Helvetica')
          .fontSize(8.5)
          .text(cell, x, rowY, { width: column.width - 6, align: column.align ?? 'left' });
        x += column.width;
      });
      doc.y = rowY + 16;
    };
    drawRow(
      table.columns.map((c) => c.header),
      true,
      true,
    );
    table.rows.forEach((row, index) => drawRow(row, false, index % 2 === 1));
  }

  private footer(doc: PDFKit.PDFDocument, note: string): void {
    this.ensureSpace(doc, 60);
    doc.moveDown(1.5);
    doc.rect(50, doc.y, 495, 1).fill(BRAND_ORANGE);
    doc.moveDown(0.5);
    doc
      .fillColor(TEXT_MUTED)
      .font('Helvetica-Oblique')
      .fontSize(8)
      .text(note, 50, doc.y, { width: 495, align: 'center' });
  }

  private ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
    }
  }
}

export function formatMoney(value: { toFixed(digits: number): string } | number | string): string {
  const amount = typeof value === 'object' ? Number(value.toFixed(2)) : Number(value);
  return `B$ ${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDate(value: Date | null | undefined): string {
  if (!value) {
    return '-';
  }
  return value.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
