import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import type { Db } from '../../common/prisma/prisma.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { businessToday, parseIsoDate } from '../../common/util/dates.js';
import type { Document } from '../../generated/prisma/client.js';
import type { DocumentOwnerType } from '../../generated/prisma/enums.js';
import { AuditService } from '../audit/audit.service.js';
import { MasterDataService } from '../settings/master-data.service.js';
import { DocumentAccess } from './document-access.js';
import { DocumentStorage } from './document-storage.js';
import { FileInspector, type UploadedFile } from './file-inspector.js';

export interface UploadRequest {
  ownerType: DocumentOwnerType;
  ownerId: string;
  docType: string;
  expiryDate?: string;
}

export interface PreparedUpload {
  fileName: string;
  mimeType: string;
  sha256: string;
  storageKey: string;
  sizeBytes: number;
}

export interface GeneratedFile {
  ownerType: DocumentOwnerType;
  ownerId: string;
  docType: string;
  fileName: string;
  mimeType: string;
  content: Buffer;
}

/** Public shape of a document (storage key and hash are internal). */
export type DocumentView = Omit<Document, 'storageKey' | 'sha256'> & { expired: boolean };

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: DocumentStorage,
    private readonly inspector: FileInspector,
    private readonly access: DocumentAccess,
    private readonly masterData: MasterDataService,
    private readonly audit: AuditService,
  ) {}

  /** AP-39/46, BO-11: upload with type, size and malware validation, stored encrypted. */
  async upload(
    user: SessionUser,
    request: UploadRequest,
    file: UploadedFile | undefined,
  ): Promise<DocumentView> {
    await this.access.assertCanUpload(user, request.ownerType, request.ownerId);
    const prepared = await this.prepareUpload(request.docType, file);
    const document = await this.prisma.$transaction((tx) =>
      this.recordUpload(tx, user, request, prepared),
    );
    return toView(document);
  }

  /**
   * Validates and stores the file content before the owning record is written, so a
   * rejected file never leaves a half-created business record behind.
   */
  async prepareUpload(docType: string, file: UploadedFile | undefined): Promise<PreparedUpload> {
    await this.masterData.assertValid('DOCUMENT_TYPE', docType);
    const inspected = await this.inspector.inspect(file);
    const storageKey = await this.storage.write(file!.buffer);
    return { ...inspected, storageKey, sizeBytes: file!.size };
  }

  async recordUpload(
    db: Db,
    user: SessionUser,
    request: UploadRequest,
    prepared: PreparedUpload,
  ): Promise<Document> {
    const created = await db.document.create({
      data: {
        ownerType: request.ownerType,
        ownerId: request.ownerId,
        docType: request.docType,
        fileName: prepared.fileName,
        mimeType: prepared.mimeType,
        sizeBytes: prepared.sizeBytes,
        storageKey: prepared.storageKey,
        sha256: prepared.sha256,
        expiryDate: request.expiryDate ? parseIsoDate(request.expiryDate) : null,
        uploadedById: user.id,
      },
    });
    await this.audit.record(
      {
        action: 'DOCUMENT_UPLOADED',
        entityType: request.ownerType,
        entityId: request.ownerId,
        after: { documentId: created.id, docType: created.docType, fileName: created.fileName },
      },
      db,
    );
    return created;
  }

  /** Stores a system-generated file (policy schedule, receipt, report) as part of `db`'s transaction. */
  async storeGenerated(db: Db, file: GeneratedFile): Promise<Document> {
    const storageKey = await this.storage.write(file.content);
    return db.document.create({
      data: {
        ownerType: file.ownerType,
        ownerId: file.ownerId,
        docType: file.docType,
        fileName: file.fileName,
        mimeType: file.mimeType,
        sizeBytes: file.content.length,
        storageKey,
        sha256: createHash('sha256').update(file.content).digest('hex'),
        status: 'VERIFIED',
        systemGenerated: true,
      },
    });
  }

  async listForOwner(
    user: SessionUser,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<DocumentView[]> {
    await this.access.assertCanRead(user, ownerType, ownerId);
    return this.listForOwnerUnchecked(this.prisma, ownerType, ownerId);
  }

  async listForOwnerUnchecked(
    db: Db,
    ownerType: DocumentOwnerType,
    ownerId: string,
  ): Promise<DocumentView[]> {
    const documents = await db.document.findMany({
      where: { ownerType, ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return documents.map(toView);
  }

  async download(user: SessionUser, id: string): Promise<{ document: Document; content: Buffer }> {
    const document = await this.prisma.document.findUnique({ where: { id } });
    if (!document) {
      throw notFound('Document');
    }
    await this.access.assertCanRead(user, document.ownerType, document.ownerId);
    const content = await this.storage.read(document.storageKey);
    await this.audit.record({
      action: 'DOCUMENT_DOWNLOADED',
      entityType: document.ownerType,
      entityId: document.ownerId,
      after: { documentId: id },
    });
    return { document, content };
  }

  /** BO-11/12: verify or reject an uploaded document. Rejection requires remarks. */
  async review(
    user: SessionUser,
    id: string,
    decision: 'VERIFIED' | 'REJECTED',
    remarks?: string,
  ): Promise<DocumentView> {
    if (decision === 'REJECTED' && !remarks?.trim()) {
      throw new BusinessRuleError(
        'REMARKS_REQUIRED',
        'Please give a reason for rejecting the document',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.document.findUnique({ where: { id } });
      if (!before) {
        throw notFound('Document');
      }
      if (before.systemGenerated) {
        throw new BusinessRuleError(
          'SYSTEM_DOCUMENT',
          'System-generated documents do not require review',
        );
      }
      if (decision === 'VERIFIED' && before.uploadedById === user.id) {
        throw new BusinessRuleError(
          'SEGREGATION_OF_DUTIES',
          'You cannot verify a document you uploaded',
        );
      }
      const updated = await tx.document.update({
        where: { id },
        data: {
          status: decision,
          remarks: remarks?.trim() || null,
          verifiedById: user.id,
          verifiedAt: new Date(),
        },
      });
      await this.audit.record(
        {
          action: `DOCUMENT_${decision}`,
          entityType: before.ownerType,
          entityId: before.ownerId,
          before: { status: before.status },
          after: { documentId: id, status: decision, remarks },
        },
        tx,
      );
      return toView(updated);
    });
  }

  /** Returns the document types in `required` that have no non-rejected upload for the owner. */
  async missingTypes(
    db: Db,
    ownerType: DocumentOwnerType,
    ownerId: string,
    required: string[],
  ): Promise<string[]> {
    if (required.length === 0) {
      return [];
    }
    const present = await db.document.findMany({
      where: { ownerType, ownerId, docType: { in: required }, status: { not: 'REJECTED' } },
      select: { docType: true },
    });
    const presentTypes = new Set(present.map((d) => d.docType));
    return required.filter((type) => !presentTypes.has(type));
  }
}

export function toView(document: Document): DocumentView {
  const { storageKey: _storageKey, sha256: _sha256, ...rest } = document;
  return {
    ...rest,
    expired: document.expiryDate !== null && document.expiryDate < businessToday(),
  };
}
