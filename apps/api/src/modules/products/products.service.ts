import { Injectable } from '@nestjs/common';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { Prisma, Product } from '../../generated/prisma/client.js';
import { AuditService } from '../audit/audit.service.js';
import { readQuestionnaire, readRequiredDocuments } from './product-definitions.js';
import { ratingEngine } from './rating/rating-engines.js';
import type { QuoteRequest, QuoteResult, RatingContext } from './rating/rating.types.js';

export interface ProductUpdate {
  name: string;
  description: string;
  config: Prisma.InputJsonValue;
  requiredDocuments: Prisma.InputJsonValue;
  questionnaire: Prisma.InputJsonValue;
  paymentBeforeIssuance: boolean;
  allowRenewal: boolean;
  active: boolean;
}

/** AP-17 product catalogue and BO-33 product/rating maintenance without code changes. */
@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  list(activeOnly: boolean): Promise<Product[]> {
    return this.prisma.product.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async get(id: string): Promise<Product> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw notFound('Product');
    }
    return product;
  }

  quote(product: Product, request: QuoteRequest, context: RatingContext): QuoteResult {
    if (!product.active) {
      throw new BusinessRuleError('PRODUCT_INACTIVE', `${product.name} is not currently offered`);
    }
    return ratingEngine(product.ratingEngine).quote(product.config, request, context);
  }

  async update(id: string, input: ProductUpdate): Promise<Product> {
    const before = await this.get(id);
    try {
      ratingEngine(before.ratingEngine).validateConfig(input.config);
      readRequiredDocuments(input.requiredDocuments);
      readQuestionnaire(input.questionnaire);
    } catch (error) {
      throw new BusinessRuleError('INVALID_PRODUCT_CONFIG', (error as Error).message);
    }
    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.update({ where: { id }, data: input });
      await this.audit.record(
        { action: 'PRODUCT_UPDATED', entityType: 'Product', entityId: id, before, after: product },
        tx,
      );
      return product;
    });
  }
}
