import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { AppConfig } from '../../config/app-config.js';
import { currentActor } from '../../common/context/request-context.js';
import { BusinessRuleError, notFound } from '../../common/http/errors.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { DataScopeService } from '../../common/security/data-scope.service.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { AuditService } from '../audit/audit.service.js';
import { DocumentsService } from '../documents/documents.service.js';
import type { UploadedFile } from '../documents/file-inspector.js';
import { formatMoney } from '../documents/pdf-renderer.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { Setting } from '../settings/setting-keys.js';
import { SettingsService } from '../settings/settings.service.js';
import { describePlan } from '../products/plan-label.js';

const MAX_SIGNATURE_BYTES = 512 * 1024;
const PNG_DATA_URL = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/;

/**
 * Electronic signature (AP-62): agent and participant can sign on screen, or the
 * participant receives a one-time e-signature link by email. Signatures are stored as
 * images against the quotation, with time and source recorded in the audit trail.
 */
@Injectable()
export class ESignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly scopes: DataScopeService,
    private readonly documents: DocumentsService,
    private readonly settings: SettingsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  /** On-screen signature captured on the agent's device. */
  async captureSignature(
    user: SessionUser,
    policyId: string,
    signer: 'AGENT' | 'PARTICIPANT',
    imageDataUrl: string,
  ) {
    const policy = await this.draftPolicy(user, policyId);
    const docType = signer === 'AGENT' ? 'SIGNATURE_AGENT' : 'SIGNATURE_PARTICIPANT';
    const prepared = await this.documents.prepareUpload(
      docType,
      signatureFile(imageDataUrl, `${signer.toLowerCase()}-signature`),
    );
    return this.prisma.$transaction(async (tx) => {
      const document = await this.documents.recordUpload(
        tx,
        user,
        { ownerType: 'POLICY', ownerId: policy.id, docType },
        prepared,
      );
      await tx.policyEvent.create({
        data: {
          policyId: policy.id,
          action: `${signer}_SIGNED`,
          remarks: 'Signed on screen',
          ...currentActor(),
        },
      });
      return { documentId: document.id };
    });
  }

  /** Sends the participant a one-time link to review and sign remotely. */
  async sendSignatureLink(user: SessionUser, policyId: string, email?: string) {
    const policy = await this.draftPolicy(user, policyId);
    const recipient = (email ?? policy.participant.email ?? '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      throw new BusinessRuleError(
        'EMAIL_REQUIRED',
        'A valid participant e-mail address is required',
      );
    }
    const token = randomBytes(32).toString('base64url');
    const hours = await this.settings.getInt(Setting.ESignLinkHours);
    const expiresAt = new Date(Date.now() + hours * 3_600_000);
    const link = `${this.config.publicBaseUrl}/esign/${token}`;

    await this.prisma.$transaction(async (tx) => {
      await tx.signatureRequest.create({
        data: {
          policyId: policy.id,
          tokenHash: hashToken(token),
          recipientName: policy.participant.fullName,
          recipientEmail: recipient,
          expiresAt,
          createdById: user.id,
        },
      });
      await this.notifications.emailExternal(tx, recipient, {
        eventType: 'ESIGN_REQUEST',
        subject: `Please review and sign your ${policy.product.name} application`,
        body:
          `Dear ${policy.participant.fullName},\n\nYour agent has prepared quotation ${policy.quotationNo} ` +
          `(contribution ${formatMoney(policy.contribution)}). Review and sign it here: ${link}\n\n` +
          `The link can be used once and expires in ${hours} hours. If you did not expect this message, please ignore it.`,
        sensitive: true,
      });
      await tx.policyEvent.create({
        data: {
          policyId: policy.id,
          action: 'ESIGN_LINK_SENT',
          remarks: `Sent to ${recipient}`,
          ...currentActor(),
        },
      });
    });
    return { sentTo: recipient, expiresAt };
  }

  /** Public page: minimal, non-sensitive summary for the participant to review. */
  async viewByToken(token: string) {
    const request = await this.validRequest(token);
    const policy = request.policy;
    return {
      quotationNo: policy.quotationNo,
      participantName: request.recipientName,
      product: policy.product.name,
      plan: describePlan(policy.product.config, policy.planCode, policy.coverageType),
      sumCovered: policy.sumCovered.toFixed(2),
      contribution: policy.contribution.toFixed(2),
      termMonths: policy.termMonths,
      agentName: policy.agent.fullName,
      expiresAt: request.expiresAt,
    };
  }

  async signByToken(
    token: string,
    imageDataUrl: string,
    fullName: string,
    ipAddress: string | undefined,
  ) {
    const request = await this.validRequest(token);
    if (normalise(fullName) !== normalise(request.recipientName)) {
      throw new BusinessRuleError('NAME_MISMATCH', 'Please type your full name exactly as shown');
    }
    const prepared = await this.documents.prepareUpload(
      'SIGNATURE_PARTICIPANT',
      signatureFile(imageDataUrl, 'participant-signature'),
    );
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.signatureRequest.updateMany({
        where: { id: request.id, signedAt: null },
        data: { signedAt: new Date(), signerIp: ipAddress?.slice(0, 64) },
      });
      if (claimed.count !== 1) {
        throw new BusinessRuleError('LINK_USED', 'This link has already been used');
      }
      const document = await tx.document.create({
        data: {
          ownerType: 'POLICY',
          ownerId: request.policyId,
          docType: 'SIGNATURE_PARTICIPANT',
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
          sizeBytes: prepared.sizeBytes,
          storageKey: prepared.storageKey,
          sha256: prepared.sha256,
        },
      });
      await tx.signatureRequest.update({
        where: { id: request.id },
        data: { documentId: document.id },
      });
      await tx.policyEvent.create({
        data: {
          policyId: request.policyId,
          action: 'PARTICIPANT_SIGNED',
          remarks: `Signed via e-signature link from ${ipAddress ?? 'unknown address'}`,
          actorName: request.recipientName,
        },
      });
      await this.audit.record(
        {
          action: 'ESIGN_COMPLETED',
          entityType: 'Policy',
          entityId: request.policyId,
          after: { signatureRequestId: request.id },
        },
        tx,
      );
      await this.notifications.notifyUser(tx, request.createdById, {
        eventType: 'ESIGN_COMPLETED',
        subject: `${request.recipientName} has signed ${request.policy.quotationNo}`,
        body: 'The participant signature has been received. You can now submit the application.',
        link: `/portal/policies/${request.policyId}`,
      });
    });
    return { signed: true };
  }

  private async validRequest(token: string) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw notFound('Signature request');
    }
    const request = await this.prisma.signatureRequest.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { policy: { include: { product: true, agent: { select: { fullName: true } } } } },
    });
    if (
      !request ||
      request.signedAt ||
      request.expiresAt < new Date() ||
      request.policy.status !== 'DRAFT'
    ) {
      throw new BusinessRuleError(
        'LINK_INVALID',
        'This signature link is invalid, expired or has already been used',
      );
    }
    return request;
  }

  private async draftPolicy(user: SessionUser, policyId: string) {
    const scope = await this.scopes.resolve(user);
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { participant: true, product: true },
    });
    if (!policy || !DataScopeService.allows(scope, policy)) {
      throw notFound('Policy');
    }
    if (policy.status !== 'DRAFT') {
      throw new BusinessRuleError(
        'NOT_DRAFT',
        'Signatures are collected before the application is submitted',
      );
    }
    return policy;
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function normalise(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toUpperCase();
}

/** Converts a PNG data URL from the signature pad into an upload for validation. */
function signatureFile(dataUrl: string, name: string): UploadedFile {
  const match = PNG_DATA_URL.exec(dataUrl);
  if (!match) {
    throw new BusinessRuleError('INVALID_SIGNATURE', 'The signature must be a PNG image');
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (buffer.length > MAX_SIGNATURE_BYTES) {
    throw new BusinessRuleError('INVALID_SIGNATURE', 'The signature image is too large');
  }
  return { originalname: `${name}.png`, mimetype: 'image/png', size: buffer.length, buffer };
}
