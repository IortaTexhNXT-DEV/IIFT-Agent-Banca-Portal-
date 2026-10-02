import { Injectable } from '@nestjs/common';
import { normaliseIdentifier } from '../../common/crypto/field-crypto.service.js';
import { BusinessRuleError } from '../../common/http/errors.js';
import { pageArgs, type PageQueryDto, toPage } from '../../common/http/pagination.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { normaliseName } from './name-matching.js';

export interface WatchlistEntryInput {
  listName: string;
  fullName: string;
  idNumber?: string;
  country?: string;
  reference?: string;
}

const MAX_IMPORT_ROWS = 20_000;
const CSV_HEADER = ['list_name', 'full_name', 'id_number', 'country', 'reference'];

/** Watch-lists maintained by Compliance for the built-in screening. */
@Injectable()
export class WatchlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async search(query: PageQueryDto, search?: string) {
    const where: Prisma.AmlWatchlistEntryWhereInput = search
      ? { normalised: { contains: normaliseName(search) } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.amlWatchlistEntry.findMany({
        where,
        orderBy: [{ listName: 'asc' }, { fullName: 'asc' }],
        ...pageArgs(query),
      }),
      this.prisma.amlWatchlistEntry.count({ where }),
    ]);
    return toPage(items, total, query);
  }

  async add(input: WatchlistEntryInput) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.amlWatchlistEntry.create({ data: toRow(input) });
      await this.audit.record(
        {
          action: 'WATCHLIST_ENTRY_ADDED',
          entityType: 'AmlWatchlistEntry',
          entityId: entry.id,
          after: input,
        },
        tx,
      );
      return entry;
    });
  }

  async setActive(id: string, active: boolean) {
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.amlWatchlistEntry.update({ where: { id }, data: { active } });
      await this.audit.record(
        {
          action: active ? 'WATCHLIST_ENTRY_ACTIVATED' : 'WATCHLIST_ENTRY_DEACTIVATED',
          entityType: 'AmlWatchlistEntry',
          entityId: id,
        },
        tx,
      );
      return entry;
    });
  }

  /**
   * Bulk load from CSV with header: list_name,full_name,id_number,country,reference.
   * Replace mode deactivates the previous entries of the same list first, so a list can
   * be refreshed from its latest publication.
   */
  async importCsv(content: string, replaceList: boolean): Promise<{ imported: number }> {
    const rows = parseCsv(content);
    const header = rows.shift()?.map((cell) => cell.trim().toLowerCase());
    if (!header || CSV_HEADER.some((column, index) => header[index] !== column)) {
      throw new BusinessRuleError('INVALID_CSV', `The first line must be: ${CSV_HEADER.join(',')}`);
    }
    if (rows.length === 0 || rows.length > MAX_IMPORT_ROWS) {
      throw new BusinessRuleError(
        'INVALID_CSV',
        `The file must contain between 1 and ${MAX_IMPORT_ROWS} entries`,
      );
    }
    const entries = rows
      .filter((row) => row.some((cell) => cell.trim() !== ''))
      .map((row, index) => {
        const [listName, fullName, idNumber, country, reference] = row.map((cell) => cell.trim());
        if (!listName || !fullName) {
          throw new BusinessRuleError(
            'INVALID_CSV',
            `Line ${index + 2}: list_name and full_name are required`,
          );
        }
        return toRow({ listName, fullName, idNumber, country, reference });
      });
    const lists = [...new Set(entries.map((entry) => entry.listName))];

    await this.prisma.$transaction(async (tx) => {
      if (replaceList) {
        await tx.amlWatchlistEntry.updateMany({
          where: { listName: { in: lists } },
          data: { active: false },
        });
      }
      await tx.amlWatchlistEntry.createMany({ data: entries });
      await this.audit.record(
        {
          action: 'WATCHLIST_IMPORTED',
          entityType: 'AmlWatchlistEntry',
          after: { lists, count: entries.length, replaceList },
        },
        tx,
      );
    });
    return { imported: entries.length };
  }
}

function toRow(input: WatchlistEntryInput): Prisma.AmlWatchlistEntryCreateInput {
  return {
    listName: input.listName.trim().toUpperCase().slice(0, 50),
    fullName: input.fullName.trim().slice(0, 150),
    normalised: normaliseName(input.fullName).slice(0, 150),
    idNumber: input.idNumber ? normaliseIdentifier(input.idNumber).slice(0, 50) : null,
    country: input.country?.slice(0, 50) || null,
    reference: input.reference?.slice(0, 100) || null,
  };
}

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (quoted) {
      if (char === '"' && content[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}
