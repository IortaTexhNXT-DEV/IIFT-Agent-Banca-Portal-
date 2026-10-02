import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { DataScope } from '../../common/security/data-scope.service.js';

export type ColumnType = 'text' | 'number' | 'money' | 'date' | 'datetime';
export type FilterKey = 'dateRange' | 'product' | 'agency' | 'agent' | 'status';

export interface ReportColumn {
  key: string;
  header: string;
  type: ColumnType;
  width?: number;
}

export type ReportRow = Record<string, string | number | Date | null>;

export interface ReportFilters {
  from?: Date;
  /** Exclusive upper bound. */
  to?: Date;
  productId?: string;
  agencyId?: string;
  agentId?: string;
  status?: string;
}

export interface ReportContext {
  prisma: PrismaService;
  scope: DataScope;
  filters: ReportFilters;
  limit: number;
}

export interface ReportDefinition {
  code: string;
  name: string;
  description: string;
  audiences: ('PORTAL' | 'BACKOFFICE')[];
  filters: FilterKey[];
  statusOptions?: string[];
  dateLabel?: string;
  columns: ReportColumn[];
  run(context: ReportContext): Promise<ReportRow[]>;
}
