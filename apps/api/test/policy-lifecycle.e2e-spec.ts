import type { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import { createApp, type Session, signIn } from './app.js';

/** Smallest valid PDF and PNG headers accepted by the upload inspection. */
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function upload(
  session: Session,
  ownerType: string,
  ownerId: string,
  docType: string,
  content = PDF,
  name = 'document.pdf',
) {
  return session.agent
    .post('/api/v1/common/documents')
    .set('x-csrf-token', session.csrf)
    .field('ownerType', ownerType)
    .field('ownerId', ownerId)
    .field('docType', docType)
    .attach('file', content, name);
}

describe('Quotation to e-Policy and e-Receipt (FFR03, AP-17..45, BO-16..19)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;
  let agent: Session;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.get(PrismaService);
    agent = await signIn(app, 'ag-000002');
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs the full Professional Takaful Plan journey with maker-checker payment verification', async () => {
    const csrf = { 'x-csrf-token': agent.csrf };
    const products = (await agent.agent.get('/api/v1/common/products').expect(200)).body as {
      id: string;
      code: string;
    }[];
    const product = products.find((p) => p.code === 'PRO')!;

    const participant = await agent.agent
      .post('/api/v1/portal/participants')
      .set(csrf)
      .send({
        type: 'INDIVIDUAL',
        fullName: 'Nur Hidayah binti Kamal',
        idType: 'NRIC',
        idNumber: '01-990011',
        dateOfBirth: '1990-05-05',
        nationality: 'BRUNEI',
        occupation: 'PROFESSIONAL',
        occupationClass: 1,
        email: 'hidayah@mail.example',
        mobile: '6738111222',
        addressLine1: 'No. 5, Simpang 22, Kiulap',
      })
      .expect(201);
    expect(participant.body.amlStatus).toBe('CLEAR');

    const quote = await agent.agent
      .post('/api/v1/portal/policies/calculate')
      .set(csrf)
      .send({
        productId: product.id,
        participantId: participant.body.id,
        planCode: 'A',
        additionalCover: true,
        riskDetails: {},
      })
      .expect(200);
    expect(quote.body.contribution).toBe('165');

    const policy = await agent.agent
      .post('/api/v1/portal/policies')
      .set(csrf)
      .send({
        productId: product.id,
        participantId: participant.body.id,
        planCode: 'A',
        additionalCover: true,
        riskDetails: {},
      })
      .expect(201);
    const id = policy.body.id as string;
    expect(policy.body.status).toBe('DRAFT');

    const incomplete = await agent.agent
      .post(`/api/v1/portal/policies/${id}/submit`)
      .set(csrf)
      .expect(422);
    expect(incomplete.body.code).toBe('QUESTIONNAIRE_INCOMPLETE');

    await agent.agent
      .put(`/api/v1/portal/policies/${id}/questionnaire`)
      .set(csrf)
      .send({
        answers: ['HEALTH_CURRENT', 'HEALTH_HOSPITAL', 'PRIOR_DECLINE'].map((code) => ({
          code,
          answer: false,
        })),
      })
      .expect(200);

    const badShares = await agent.agent
      .put(`/api/v1/portal/policies/${id}/nominees`)
      .set(csrf)
      .send({
        nominees: [
          { fullName: 'Kamal bin Ali', relationship: 'PARENT', role: 'NOMINEE', sharePercent: 60 },
        ],
      })
      .expect(422);
    expect(badShares.body.code).toBe('INVALID_SHARES');
    await agent.agent
      .put(`/api/v1/portal/policies/${id}/nominees`)
      .set(csrf)
      .send({
        nominees: [
          {
            fullName: 'Kamal bin Ali',
            idNumber: '00-112233',
            relationship: 'PARENT',
            role: 'NOMINEE',
            sharePercent: 100,
          },
        ],
      })
      .expect(200);

    const missing = await agent.agent
      .post(`/api/v1/portal/policies/${id}/submit`)
      .set(csrf)
      .expect(422);
    expect(missing.body.code).toBe('SUBMISSION_INCOMPLETE');
    expect(missing.body.details).toEqual(expect.arrayContaining(['Upload: IC copy']));

    const disguised = await upload(
      agent,
      'POLICY',
      id,
      'IC_COPY',
      Buffer.from('MZ\x90\x00 executable'),
      'ic.pdf',
    ).expect(422);
    expect(disguised.body.code).toBe('FILE_TYPE_NOT_ALLOWED');
    await upload(agent, 'POLICY', id, 'IC_COPY').expect(201);
    await upload(agent, 'POLICY', id, 'NOMINEE_IC').expect(201);
    await agent.agent
      .post(`/api/v1/portal/policies/${id}/signatures`)
      .set(csrf)
      .send({ signer: 'PARTICIPANT', imageDataUrl: PNG_DATA_URL })
      .expect(201);

    const submitted = await agent.agent
      .post(`/api/v1/portal/policies/${id}/submit`)
      .set(csrf)
      .expect(200);
    expect(submitted.body.status).toBe('PENDING_PAYMENT');

    const payment = await agent.agent
      .post('/api/v1/portal/billing/payments')
      .set(csrf)
      .field('method', 'BANK_TRANSFER')
      .field('referenceNo', 'TRX-E2E-0001')
      .field('paymentDate', new Date().toISOString().slice(0, 10))
      .field('allocations', JSON.stringify([{ policyId: id, amount: 165 }]))
      .attach('proof', PDF, 'transfer.pdf')
      .expect(201);
    expect(payment.body.status).toBe('PENDING_VERIFICATION');

    const request = await prisma.approvalRequest.findFirstOrThrow({
      where: { entityId: payment.body.id, status: 'PENDING' },
    });

    const maker = await signIn(app, 'ops.maker');
    await maker.agent
      .post(`/api/v1/backoffice/approvals/${request.id}/approve`)
      .set('x-csrf-token', maker.csrf)
      .send({})
      .expect(403);

    const finance = await signIn(app, 'finance');
    const inbox = await finance.agent.get('/api/v1/backoffice/approvals/inbox').expect(200);
    expect(inbox.body.items.map((item: { id: string }) => item.id)).toContain(request.id);
    const rejectWithoutRemarks = await finance.agent
      .post(`/api/v1/backoffice/approvals/${request.id}/reject`)
      .set('x-csrf-token', finance.csrf)
      .send({ remarks: '' })
      .expect(400);
    expect(rejectWithoutRemarks.body.code).toBe('BAD_REQUEST');
    await finance.agent
      .post(`/api/v1/backoffice/approvals/${request.id}/approve`)
      .set('x-csrf-token', finance.csrf)
      .send({ remarks: 'Matched to statement' })
      .expect(200);

    const issued = await agent.agent.get(`/api/v1/portal/policies/${id}`).expect(200);
    expect(issued.body.status).toBe('ACTIVE');
    expect(issued.body.paymentStatus).toBe('PAID');
    expect(issued.body.policyNo).toMatch(/^PRO\/\d{2}\/\d{6}$/);
    expect(issued.body.receipts).toHaveLength(1);
    const docTypes = issued.body.documents.map((d: { docType: string }) => d.docType);
    expect(docTypes).toEqual(expect.arrayContaining(['POLICY_SCHEDULE', 'RECEIPT']));

    const schedule = issued.body.documents.find(
      (d: { docType: string }) => d.docType === 'POLICY_SCHEDULE',
    );
    const pdf = await agent.agent
      .get(`/api/v1/common/documents/${schedule.id}/content`)
      .buffer(true)
      .expect(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    const outbox = await prisma.outboxMessage.findMany({
      where: { aggregateId: { in: [id, issued.body.receipts[0].id] } },
    });
    expect(outbox.map((m) => m.operation)).toEqual(
      expect.arrayContaining(['POLICY_ISSUED', 'RECEIPT_POSTED']),
    );
  });

  it('blocks new business for an agency with overdue contributions (AP-42)', async () => {
    const banker = await signIn(app, 'bk-000004');
    const draft = await prisma.policy.findFirst({
      where: { agent: { agentCode: 'BK-000004' }, status: 'DRAFT' },
    });
    const product = await prisma.product.findUniqueOrThrow({ where: { code: 'FTP-NP' } });
    const participant = await prisma.participant.findFirstOrThrow({
      where: { policies: { some: { agent: { agentCode: 'BK-000004' } } } },
    });
    const id =
      draft?.id ??
      (
        await banker.agent
          .post('/api/v1/portal/policies')
          .set('x-csrf-token', banker.csrf)
          .send({
            productId: product.id,
            participantId: participant.id,
            riskDetails: {
              financingAmount: 20000,
              tenureMonths: 36,
              profitRatePercent: 4,
              financierName: 'Bank A',
              financingReference: 'PF/1',
            },
          })
          .expect(201)
      ).body.id;
    const response = await banker.agent
      .post(`/api/v1/portal/policies/${id}/submit`)
      .set('x-csrf-token', banker.csrf)
      .expect(422);
    expect(response.body.code).toBe('AGENCY_BLOCKED');
  });

  it('refers high-risk financing for approval and prevents self-approval', async () => {
    const referral = await prisma.approvalRequest.findFirstOrThrow({
      where: { type: 'POLICY_REFERRAL', status: 'PENDING' },
    });
    expect(referral.payload).toMatchObject({
      referralReasons: expect.arrayContaining([expect.stringContaining('high-risk limit')]),
    });
    const underwriter = await signIn(app, 'underwriter');
    const detail = await underwriter.agent
      .get(`/api/v1/backoffice/approvals/${referral.id}`)
      .expect(200);
    expect(detail.body.actions[0].action).toBe('SUBMIT');
  });
});
