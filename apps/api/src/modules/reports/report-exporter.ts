import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { ExportFormat } from '../../generated/prisma/enums.js';
import type { ReportColumn, ReportDefinition, ReportRow } from './report-types.js';

const BRAND_MAGENTA = 'E1058C';
const MIME_TYPES: Record<ExportFormat, string> = {
  XLSX: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  CSV: 'text/csv',
  PDF: 'application/pdf',
};

export interface ExportedReport {
  fileName: string;
  mimeType: string;
  content: Buffer;
}

/** Report export to Excel, CSV and PDF (BO-24). */
@Injectable()
export class ReportExporter {
  async export(
    report: ReportDefinition,
    rows: ReportRow[],
    format: ExportFormat,
    subtitle: string,
  ): Promise<ExportedReport> {
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const base = `${report.code.toLowerCase()}-${stamp}`;
    switch (format) {
      case 'XLSX':
        return {
          fileName: `${base}.xlsx`,
          mimeType: MIME_TYPES.XLSX,
          content: await this.xlsx(report, rows, subtitle),
        };
      case 'CSV':
        return {
          fileName: `${base}.csv`,
          mimeType: MIME_TYPES.CSV,
          content: this.csv(report.columns, rows),
        };
      default:
        return {
          fileName: `${base}.pdf`,
          mimeType: MIME_TYPES.PDF,
          content: await this.pdf(report, rows, subtitle),
        };
    }
  }

  private async xlsx(
    report: ReportDefinition,
    rows: ReportRow[],
    subtitle: string,
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'IIFT Agent/Banca Portal';
    const sheet = workbook.addWorksheet(report.name.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 3 }],
    });
    sheet.addRow([report.name]).font = {
      bold: true,
      size: 14,
      color: { argb: `FF${BRAND_MAGENTA}` },
    };
    sheet.addRow([subtitle]).font = { italic: true, color: { argb: 'FF6B6B6B' } };
    const header = sheet.addRow(report.columns.map((c) => c.header));
    header.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${BRAND_MAGENTA}` } };
    });
    for (const row of rows) {
      sheet.addRow(report.columns.map((c) => row[c.key] ?? null));
    }
    report.columns.forEach((column, index) => {
      const sheetColumn = sheet.getColumn(index + 1);
      sheetColumn.width = column.width ?? 16;
      if (column.type === 'money') sheetColumn.numFmt = '#,##0.00';
      if (column.type === 'date') sheetColumn.numFmt = 'dd-mmm-yyyy';
      if (column.type === 'datetime') sheetColumn.numFmt = 'dd-mmm-yyyy hh:mm';
    });
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private csv(columns: ReportColumn[], rows: ReportRow[]): Buffer {
    const lines = [columns.map((c) => csvCell(c.header)).join(',')];
    for (const row of rows) {
      lines.push(columns.map((c) => csvCell(formatValue(row[c.key], c))).join(','));
    }
    // UTF-8 BOM so Excel opens accented names correctly.
    return Buffer.from(`﻿${lines.join('\r\n')}\r\n`, 'utf8');
  }

  private pdf(report: ReportDefinition, rows: ReportRow[], subtitle: string): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
      info: { Title: report.name },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) =>
      doc.on('end', () => resolve(Buffer.concat(chunks))),
    );

    const usable = doc.page.width - 60;
    const totalWeight = report.columns.reduce((acc, c) => acc + (c.width ?? 16), 0);
    const widths = report.columns.map((c) => ((c.width ?? 16) / totalWeight) * usable);

    const drawHeader = () => {
      doc
        .fillColor(`#${BRAND_MAGENTA}`)
        .font('Helvetica-Bold')
        .fontSize(13)
        .text(report.name, 30, 28);
      doc.fillColor('#6B6B6B').font('Helvetica').fontSize(8).text(subtitle, 30, 46);
      let x = 30;
      const y = 62;
      doc.rect(30, y - 3, usable, 15).fill(`#${BRAND_MAGENTA}`);
      report.columns.forEach((column, index) => {
        doc
          .fillColor('#FFFFFF')
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(column.header, x + 2, y, {
            width: widths[index] - 4,
            lineBreak: false,
            ellipsis: true,
          });
        x += widths[index];
      });
      doc.y = y + 16;
    };

    drawHeader();
    rows.forEach((row, rowIndex) => {
      if (doc.y > doc.page.height - 40) {
        doc.addPage();
        drawHeader();
      }
      const y = doc.y;
      if (rowIndex % 2 === 1) doc.rect(30, y - 2, usable, 13).fill('#F7F2F5');
      let x = 30;
      report.columns.forEach((column, index) => {
        const align = column.type === 'money' || column.type === 'number' ? 'right' : 'left';
        doc
          .fillColor('#333333')
          .font('Helvetica')
          .fontSize(7)
          .text(formatValue(row[column.key], column), x + 2, y, {
            width: widths[index] - 4,
            align,
            lineBreak: false,
            ellipsis: true,
          });
        x += widths[index];
      });
      doc.y = y + 13;
    });
    if (rows.length === 0) {
      doc
        .fillColor('#6B6B6B')
        .fontSize(9)
        .text('No records for the selected criteria.', 30, doc.y + 6);
    }
    doc.end();
    return done;
  }
}

function formatValue(value: ReportRow[string] | undefined, column: ReportColumn): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (value instanceof Date) {
    return column.type === 'datetime'
      ? value.toISOString().slice(0, 16).replace('T', ' ')
      : value.toISOString().slice(0, 10);
  }
  if (column.type === 'money' && typeof value === 'number') {
    return value.toFixed(2);
  }
  return String(value);
}

/**
 * Quotes a CSV cell and neutralises formula injection: values starting with = + - @
 * (or tab/CR) are prefixed with an apostrophe so spreadsheets treat them as text.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) && !/^-?\d+(\.\d+)?$/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}
