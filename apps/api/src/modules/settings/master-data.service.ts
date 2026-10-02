import { Injectable } from '@nestjs/common';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CodeItem } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';

/** Categories of administrator-maintained lookup values (BO-32). */
export const CODE_CATEGORIES = [
  'OCCUPATION',
  'RELATIONSHIP',
  'NATIONALITY',
  'DISTRICT',
  'BANK',
  'CLAIM_TYPE',
  'ISSUE_CATEGORY',
  'DOCUMENT_TYPE',
  'ENDORSEMENT_TYPE',
  'CANCELLATION_REASON',
] as const;

export type CodeCategory = (typeof CODE_CATEGORIES)[number];

export interface CodeItemInput {
  category: CodeCategory;
  code: string;
  label: string;
  active?: boolean;
  sortOrder?: number;
}

@Injectable()
export class MasterDataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(category?: CodeCategory, activeOnly = false): Promise<CodeItem[]> {
    return this.prisma.codeItem.findMany({
      where: { category, active: activeOnly ? true : undefined },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }, { label: 'asc' }],
    });
  }

  /** Throws unless `code` is an active value of `category` — used to validate user input. */
  async assertValid(category: CodeCategory, code: string): Promise<void> {
    const item = await this.prisma.codeItem.findUnique({
      where: { category_code: { category, code } },
    });
    if (!item || !item.active) {
      throw new BusinessRuleError(
        'INVALID_CODE',
        `"${code}" is not a valid ${category.toLowerCase().replace(/_/g, ' ')}`,
      );
    }
  }

  async labelOf(category: CodeCategory, code: string): Promise<string> {
    const item = await this.prisma.codeItem.findUnique({
      where: { category_code: { category, code } },
    });
    return item?.label ?? code;
  }

  async create(input: CodeItemInput): Promise<CodeItem> {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.codeItem.create({
        data: {
          category: input.category,
          code: input.code.trim().toUpperCase(),
          label: input.label.trim(),
          active: input.active ?? true,
          sortOrder: input.sortOrder ?? 0,
        },
      });
      await this.audit.record(
        { action: 'CODE_ITEM_CREATED', entityType: 'CodeItem', entityId: item.id, after: item },
        tx,
      );
      return item;
    });
  }

  async update(
    id: string,
    input: Partial<Pick<CodeItemInput, 'label' | 'active' | 'sortOrder'>>,
  ): Promise<CodeItem> {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.codeItem.findUnique({ where: { id } });
      if (!before) {
        throw notFound('Code item');
      }
      const item = await tx.codeItem.update({
        where: { id },
        data: { label: input.label?.trim(), active: input.active, sortOrder: input.sortOrder },
      });
      await this.audit.record(
        { action: 'CODE_ITEM_UPDATED', entityType: 'CodeItem', entityId: id, before, after: item },
        tx,
      );
      return item;
    });
  }
}
