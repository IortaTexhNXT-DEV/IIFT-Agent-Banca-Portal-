/**
 * Demonstration data for DEV / SIT / UAT environments and training. It drives the real
 * business services (registration, maker-checker approvals, quotation, submission,
 * payment verification, claims, issues, end-of-day), so it also acts as an end-to-end
 * smoke test of the API. Refuses to run when NODE_ENV=production.
 *
 *   DEMO_PASSWORD='<password for all demo users>' npm run db:seed:demo
 */
import 'dotenv/config';
import 'reflect-metadata';
import { hash } from '@node-rs/argon2';
import { NestFactory } from '@nestjs/core';
import { deflateSync } from 'node:zlib';
import PDFDocument from 'pdfkit';
import { AppModule } from '../src/app.module.js';
import { requestContext } from '../src/common/context/request-context.js';
import { PrismaService } from '../src/common/prisma/prisma.service.js';
import type { SessionUser } from '../src/common/security/session-user.js';
import { addDays, addMonths, businessToday, toIsoDate } from '../src/common/util/dates.js';
import { AgenciesService } from '../src/modules/agency/agencies.service.js';
import { AgentsService } from '../src/modules/agency/agents.service.js';
import { WatchlistService } from '../src/modules/aml/watchlist.service.js';
import { AmlService } from '../src/modules/aml/aml.service.js';
import { ARGON2_OPTIONS } from '../src/modules/auth/password.service.js';
import { SessionUserFactory } from '../src/modules/auth/session-user.factory.js';
import { GracePeriodService } from '../src/modules/billing/grace-period.service.js';
import { PaymentsService } from '../src/modules/billing/payments.service.js';
import { ClaimsService } from '../src/modules/claims/claims.service.js';
import { DocumentsService } from '../src/modules/documents/documents.service.js';
import type { UploadedFile } from '../src/modules/documents/file-inspector.js';
import { EodService } from '../src/modules/eod/eod.service.js';
import { ESignService } from '../src/modules/esign/esign.service.js';
import { OutboxDispatcher } from '../src/modules/integration/outbox.dispatcher.js';
import { IssuesService } from '../src/modules/issues/issues.service.js';
import { NotificationDispatcher } from '../src/modules/notifications/notification.dispatcher.js';
import { ParticipantsService } from '../src/modules/participants/participants.service.js';
import { PoliciesService } from '../src/modules/policies/policies.service.js';
import {
  readQuestionnaire,
  readRequiredDocuments,
} from '../src/modules/products/product-definitions.js';
import { WorkflowService } from '../src/modules/workflow/workflow.service.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demonstration data must never be loaded into production');
}
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? '';
if (DEMO_PASSWORD.length < 12) {
  throw new Error('Set DEMO_PASSWORD (at least 12 characters) for the demo users');
}
process.env.JOBS_ENABLED = 'false';

const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
const prisma = app.get(PrismaService);
const sessionUsers = app.get(SessionUserFactory);
const workflow = app.get(WorkflowService);
const documents = app.get(DocumentsService);
const policies = app.get(PoliciesService);
const payments = app.get(PaymentsService);
const participants = app.get(ParticipantsService);
const agents = app.get(AgentsService);

const log = (message: string) => process.stdout.write(`${message}\n`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function as<T>(user: SessionUser, work: () => Promise<T>): Promise<T> {
  return requestContext.run(
    { correlationId: 'demo-seed', user, ipAddress: '127.0.0.1', userAgent: 'demo-seed' },
    work,
  );
}

async function session(username: string): Promise<SessionUser> {
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  return sessionUsers.build(user.id, false);
}

function samplePdf(title: string): Promise<UploadedFile> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        originalname: `${title.replace(/\W+/g, '-').toLowerCase()}.pdf`,
        mimetype: 'application/pdf',
        size: buffer.length,
        buffer,
      });
    });
    doc.fontSize(18).text(title).moveDown().fontSize(11).text('Sample document for demonstration.');
    doc.end();
  });
}

/** Small PNG with a hand-drawn-looking stroke, used as an on-screen signature. */
function signaturePng(): string {
  const width = 240;
  const height = 80;
  const raw = Buffer.alloc((width * 4 + 1) * height, 0xff);
  for (let x = 20; x < width - 20; x++) {
    const y = Math.round(height / 2 + Math.sin(x / 14) * 14);
    for (let dy = 0; dy < 3; dy++) {
      const offset = (y + dy) * (width * 4 + 1) + 1 + x * 4;
      raw[offset] = 0x1f;
      raw[offset + 1] = 0x2a;
      raw[offset + 2] = 0x6b;
    }
  }
  for (let row = 0; row < height; row++) raw[row * (width * 4 + 1)] = 0;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8);
  header.writeUInt8(6, 9);
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
  return `data:image/png;base64,${png.toString('base64')}`;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0);
  return Buffer.concat([length, body, crc]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return crc ^ 0xffffffff;
}

async function approvePending(
  entityId: string,
  approver: SessionUser,
  remarks = 'Checked and approved',
): Promise<void> {
  const request = await prisma.approvalRequest.findFirstOrThrow({
    where: { entityId, status: 'PENDING' },
  });
  await as(approver, () => workflow.approve(approver, request.id, remarks));
}

async function rejectPending(
  entityId: string,
  approver: SessionUser,
  remarks: string,
): Promise<void> {
  const request = await prisma.approvalRequest.findFirstOrThrow({
    where: { entityId, status: 'PENDING' },
  });
  await as(approver, () => workflow.reject(approver, request.id, remarks));
}

async function setDemoPassword(username: string): Promise<void> {
  await prisma.user.update({
    where: { username },
    data: {
      passwordHash: await hash(DEMO_PASSWORD, ARGON2_OPTIONS),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    },
  });
}

// ---------------------------------------------------------------------------
// Staff users
// ---------------------------------------------------------------------------

const STAFF: [username: string, fullName: string, roles: string[]][] = [
  ['ops.maker', 'Rosmawati binti Abdul Karim', ['OPERATIONS_OFFICER']],
  ['ops.checker', 'Mohammad Hafiz bin Yusof', ['OPERATIONS_SUPERVISOR', 'UNDERWRITER']],
  ['underwriter', 'Dr. Liyana binti Ahmad', ['UNDERWRITER']],
  ['finance', 'Faizal bin Haji Omar', ['FINANCE_OFFICER']],
  ['compliance', 'Nur Azizah binti Mahmud', ['COMPLIANCE_OFFICER']],
  ['support', 'Kenneth Lim', ['SUPPORT_DESK']],
  [
    'manager',
    'Haji Abdul Rahim bin Haji Salleh',
    [
      'MANAGEMENT',
      'OPERATIONS_SUPERVISOR',
      'UNDERWRITER',
      'FINANCE_OFFICER',
      'COMPLIANCE_OFFICER',
      'SUPPORT_DESK',
      'AUDITOR',
      'SYSTEM_ADMINISTRATOR',
    ],
  ],
];

async function seedStaff(): Promise<void> {
  for (const [username, fullName, roleCodes] of STAFF) {
    if (await prisma.user.findUnique({ where: { username } })) continue;
    const roles = await prisma.role.findMany({ where: { code: { in: roleCodes } } });
    await prisma.user.create({
      data: {
        username,
        fullName,
        email: `${username}@iift.example`,
        userType: 'STAFF',
        passwordHash: await hash(DEMO_PASSWORD, ARGON2_OPTIONS),
        mustChangePassword: false,
        passwordChangedAt: new Date(),
        roles: { create: roles.map((role) => ({ roleId: role.id })) },
      },
    });
  }
  log('Staff users ready');
}

// ---------------------------------------------------------------------------
// Agencies, agents and watch-list
// ---------------------------------------------------------------------------

interface AgentSeed {
  key: string;
  agency: string;
  agentType: 'MAIN_AGENT' | 'SUB_AGENT' | 'BANKER';
  parent?: string;
  fullName: string;
  idNumber: string;
  dateOfBirth: string;
  mobile: string;
  branchName?: string;
  authorityLimit?: number;
  approve: boolean;
}

const AGENT_SEEDS: AgentSeed[] = [
  {
    key: 'sa-main',
    agency: 'AGY-SA',
    agentType: 'MAIN_AGENT',
    fullName: 'Hajah Siti Aminah binti Haji Osman',
    idNumber: '00-512347',
    dateOfBirth: '1978-03-14',
    mobile: '6738712345',
    approve: true,
  },
  {
    key: 'sa-sub',
    agency: 'AGY-SA',
    agentType: 'SUB_AGENT',
    parent: 'sa-main',
    fullName: 'Muhammad Firdaus bin Abdullah',
    idNumber: '01-298114',
    dateOfBirth: '1991-07-02',
    mobile: '6738823456',
    approve: true,
  },
  {
    key: 'dt-main',
    agency: 'AGY-DT',
    agentType: 'MAIN_AGENT',
    fullName: 'Awang Haziq bin Rahman',
    idNumber: '00-623981',
    dateOfBirth: '1984-11-21',
    mobile: '6738934567',
    approve: true,
  },
  {
    key: 'mib-officer',
    agency: 'BNK-MIB',
    agentType: 'BANKER',
    fullName: 'Nurul Huda binti Hassan',
    idNumber: '01-377265',
    dateOfBirth: '1989-05-09',
    mobile: '6737145678',
    branchName: 'Gadong branch',
    authorityLimit: 250000,
    approve: true,
  },
  {
    key: 'mib-supervisor',
    agency: 'BNK-MIB',
    agentType: 'BANKER',
    fullName: 'Pengiran Khairul Anwar bin Pengiran Ismail',
    idNumber: '00-441902',
    dateOfBirth: '1980-01-30',
    mobile: '6737256789',
    branchName: 'Main branch',
    approve: true,
  },
  {
    key: 'sa-pending',
    agency: 'AGY-SA',
    agentType: 'SUB_AGENT',
    parent: 'sa-main',
    fullName: 'Dayang Norhayati binti Ali',
    idNumber: '01-834502',
    dateOfBirth: '1995-09-17',
    mobile: '6738367890',
    approve: false,
  },
];

const agentUsers = new Map<string, SessionUser>();

async function seedAgencies(maker: SessionUser): Promise<Map<string, string>> {
  const service = app.get(AgenciesService);
  const definitions = [
    {
      code: 'AGY-SA',
      name: 'Seri Amanah Takaful Agency',
      channel: 'AGENCY' as const,
      registrationNo: 'RC/00012345',
      phone: '6732223344',
      email: 'admin@seriamanah.example',
      address: 'Unit 12, Kiulap Plaza, Bandar Seri Begawan BE1518',
    },
    {
      code: 'AGY-DT',
      name: 'Darussalam Family Agency',
      channel: 'AGENCY' as const,
      registrationNo: 'RC/00023456',
      phone: '6733334455',
      email: 'office@darussalamfamily.example',
      address: 'No. 7, Jalan Pemancha, Bandar Seri Begawan BS8811',
    },
    {
      code: 'BNK-MIB',
      name: 'Mutiara Islamic Bank – Bancassurance',
      channel: 'BANCA' as const,
      registrationNo: 'BK/0045',
      phone: '6732445566',
      email: 'banca@mutiarabank.example',
      address: 'Mutiara Tower, Jalan Sultan, Bandar Seri Begawan BS8611',
    },
  ];
  const ids = new Map<string, string>();
  for (const definition of definitions) {
    const existing = await prisma.agency.findUnique({ where: { code: definition.code } });
    ids.set(
      definition.code,
      existing?.id ?? (await as(maker, () => service.create(definition))).id,
    );
  }
  log('Agencies ready');
  return ids;
}

async function seedAgents(
  maker: SessionUser,
  checker: SessionUser,
  agencyIds: Map<string, string>,
): Promise<void> {
  const created = new Map<string, string>();
  for (const seed of AGENT_SEEDS) {
    const existing = await prisma.agent.findFirst({ where: { fullName: seed.fullName } });
    let agentId = existing?.id;
    if (!agentId) {
      const agent = await as(maker, () =>
        agents.register(maker, {
          agencyId: agencyIds.get(seed.agency)!,
          agentType: seed.agentType,
          parentAgentId: seed.parent ? created.get(seed.parent) : undefined,
          fullName: seed.fullName,
          idType: 'NRIC',
          idNumber: seed.idNumber,
          dateOfBirth: seed.dateOfBirth,
          email: `${seed.key}@agents.example`,
          mobile: seed.mobile,
          branchName: seed.branchName,
          authorityLimit: seed.authorityLimit,
          licenceNo: seed.agentType === 'BANKER' ? undefined : `IIFT/AG/${seed.idNumber.slice(-4)}`,
          licenceExpiry:
            seed.agentType === 'BANKER' ? undefined : toIsoDate(addMonths(businessToday(), 14)),
        }),
      );
      agentId = agent.id;
      await as(maker, async () =>
        documents.upload(
          maker,
          { ownerType: 'AGENT', ownerId: agent.id, docType: 'IC_COPY' },
          await samplePdf(`IC copy ${seed.fullName}`),
        ),
      );
      if (seed.approve) {
        await approvePending(agent.id, checker, 'Documents verified, AML clear');
      }
    }
    created.set(seed.key, agentId);
    const user = await prisma.user.findUnique({ where: { agentId } });
    if (user) {
      await setDemoPassword(user.username);
      agentUsers.set(seed.key, await sessionUsers.build(user.id, false));
    }
  }
  // The bank supervisor gets bank-wide visibility.
  const supervisor = await prisma.user.findUniqueOrThrow({
    where: { agentId: created.get('mib-supervisor') },
  });
  const supervisorRole = await prisma.role.findUniqueOrThrow({
    where: { code: 'BANCA_SUPERVISOR' },
  });
  await prisma.userRole.deleteMany({ where: { userId: supervisor.id } });
  await prisma.userRole.create({ data: { userId: supervisor.id, roleId: supervisorRole.id } });
  agentUsers.set('mib-supervisor', await sessionUsers.build(supervisor.id, false));
  log('Agents ready');
}

async function seedWatchlist(compliance: SessionUser): Promise<void> {
  if ((await prisma.amlWatchlistEntry.count()) > 0) return;
  const service = app.get(WatchlistService);
  const entries = [
    {
      listName: 'DEMO-SANCTIONS',
      fullName: 'Ahmad Zulkifli Hamid',
      country: 'XX',
      reference: 'DEMO-001',
    },
    {
      listName: 'DEMO-SANCTIONS',
      fullName: 'Viktor Petrenko',
      country: 'XX',
      reference: 'DEMO-002',
    },
    {
      listName: 'DEMO-PEP',
      fullName: 'Rashid Al Mansouri',
      country: 'XX',
      reference: 'DEMO-PEP-01',
    },
    {
      listName: 'INTERNAL',
      fullName: 'Lim Chee Keong',
      idNumber: '99-000001',
      reference: 'Fraud case 2024/07',
    },
  ];
  for (const entry of entries) {
    await as(compliance, () => service.add(entry));
  }
  log('Watch-list ready');
}

// ---------------------------------------------------------------------------
// Participants and policies
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  'Nurul Ain',
  'Mohd Azri',
  'Siti Khadijah',
  'Hj Kamaruddin',
  'Dk Nur Syafiqah',
  'Awg Shahrul',
  'Norazlina',
  'Mohd Hazwan',
  'Ummi Kalsom',
  'Faridah',
  'Abdul Malik',
  'Hjh Rosnah',
  'Aqilah',
  'Mohd Rizal',
  'Nadiah',
  'Syazwan',
  'Haslinda',
  'Amirul',
  'Zuraidah',
  'Hafizul',
  'Rozita',
  'Iskandar',
  'Suhaila',
  'Danial',
];
const LAST_NAMES = [
  'binti Haji Yahya',
  'bin Mohd Daud',
  'binti Ismail',
  'bin Haji Bakar',
  'binti Pg Hashim',
  'bin Awg Tengah',
  'binti Jaafar',
  'bin Sulaiman',
  'binti Ahmad',
  'binti Kassim',
  'bin Hamzah',
  'binti Matussin',
  'binti Rahman',
  'bin Latif',
  'binti Salleh',
  'bin Noordin',
  'binti Ibrahim',
  'bin Zainal',
  'binti Abu Bakar',
  'bin Hassan',
  'binti Mahmud',
  'bin Osman',
  'binti Ali',
  'bin Yusof',
];

let participantCounter = 0;

async function createParticipant(
  agent: SessionUser,
  overrides: Partial<{
    fullName: string;
    dateOfBirth: string;
    nationality: string;
    occupation: string;
    occupationClass: number;
  }> = {},
) {
  participantCounter++;
  const index = participantCounter % FIRST_NAMES.length;
  const fullName =
    overrides.fullName ??
    `${FIRST_NAMES[index]} ${LAST_NAMES[(participantCounter * 7) % LAST_NAMES.length]}`;
  const idNumber = `${participantCounter % 2 === 0 ? '01' : '00'}-${String(700000 + participantCounter * 137).padStart(6, '0')}`;
  const existing = await participants.lookup('NRIC', idNumber);
  if (existing.found) {
    return prisma.participant.findUniqueOrThrow({ where: { id: existing.participant.id } });
  }
  const view = await as(agent, () =>
    participants.create(agent, {
      type: 'INDIVIDUAL',
      fullName,
      idType: 'NRIC',
      idNumber,
      dateOfBirth:
        overrides.dateOfBirth ??
        `19${70 + (participantCounter % 25)}-0${1 + (participantCounter % 9)}-1${participantCounter % 9}`,
      gender: participantCounter % 2 === 0 ? 'FEMALE' : 'MALE',
      nationality: overrides.nationality ?? 'BRUNEI',
      occupation: overrides.occupation ?? 'PROFESSIONAL',
      occupationClass: overrides.occupationClass ?? 1,
      email: `participant${participantCounter}@mail.example`,
      mobile: `673${8100000 + participantCounter * 911}`,
      addressLine1: `No. ${participantCounter + 3}, Simpang ${100 + participantCounter}, Kampong Rimba`,
      postcode: `BE${3100 + participantCounter}`,
      district: ['BRUNEI_MUARA', 'TUTONG', 'BELAIT', 'TEMBURONG'][participantCounter % 4],
    }),
  );
  return prisma.participant.findUniqueOrThrow({ where: { id: view.id } });
}

interface QuoteSeed {
  productCode: string;
  planCode?: string;
  coverageType?: string;
  termMonths?: number;
  additionalCover?: boolean;
  riskDetails?: Record<string, unknown>;
  declareYes?: boolean;
}

/** Quotation → questionnaire → nominees → documents → signature → submission. */
async function prepareAndSubmit(
  agent: SessionUser,
  participantId: string,
  quote: QuoteSeed,
): Promise<string> {
  const product = await prisma.product.findUniqueOrThrow({ where: { code: quote.productCode } });
  const policy = await as(agent, () =>
    policies.createQuotation(agent, {
      productId: product.id,
      participantId,
      planCode: quote.planCode,
      coverageType: quote.coverageType,
      termMonths: quote.termMonths,
      additionalCover: quote.additionalCover,
      riskDetails: quote.riskDetails ?? {},
    }),
  );
  const questions = readQuestionnaire(product.questionnaire);
  await as(agent, () =>
    policies.saveQuestionnaire(
      agent,
      policy.id,
      questions.map((q, index) => ({
        code: q.code,
        answer: Boolean(quote.declareYes && index === 0),
        details:
          quote.declareYes && index === 0
            ? 'Controlled hypertension, on medication since 2022'
            : undefined,
      })),
    ),
  );
  if ((product.config as { requiresNominee?: boolean }).requiresNominee) {
    await as(agent, () =>
      policies.saveNominees(agent, policy.id, [
        {
          fullName: 'Hajah Mariam binti Haji Ahmad',
          idNumber: '00-118822',
          relationship: 'SPOUSE',
          role: 'NOMINEE',
          sharePercent: 60,
        },
        {
          fullName: 'Muhammad Iqbal bin Hassan',
          idNumber: '01-998877',
          relationship: 'CHILD',
          role: 'NOMINEE',
          sharePercent: 40,
        },
      ]),
    );
  }
  for (const document of readRequiredDocuments(product.requiredDocuments).filter(
    (d) => d.mandatory,
  )) {
    await as(agent, async () =>
      documents.upload(
        agent,
        { ownerType: 'POLICY', ownerId: policy.id, docType: document.docType },
        await samplePdf(document.label),
      ),
    );
  }
  await as(agent, () =>
    app.get(ESignService).captureSignature(agent, policy.id, 'PARTICIPANT', signaturePng()),
  );
  await as(agent, () =>
    app.get(ESignService).captureSignature(agent, policy.id, 'AGENT', signaturePng()),
  );
  await as(agent, () => policies.submit(agent, policy.id));
  return policy.id;
}

async function pay(
  agent: SessionUser,
  finance: SessionUser | null,
  policyIds: string[],
  method: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH_DEPOSIT' = 'BANK_TRANSFER',
): Promise<void> {
  const items = await prisma.policy.findMany({ where: { id: { in: policyIds } } });
  const payment = await as(agent, async () =>
    payments.submit(
      agent,
      {
        method,
        bankName: 'Partner bank A',
        referenceNo: `TRX${Date.now().toString().slice(-8)}${policyIds.length}`,
        paymentDate: toIsoDate(businessToday()),
        allocations: items.map((p) => ({ policyId: p.id, amount: p.outstandingAmount.toNumber() })),
      },
      await samplePdf('Bank transfer advice'),
    ),
  );
  if (finance) {
    await approvePending(payment.id, finance, 'Matched to bank statement');
  }
}

async function issueAndPay(
  agent: SessionUser,
  underwriter: SessionUser,
  finance: SessionUser,
  participantId: string,
  quote: QuoteSeed,
): Promise<string> {
  const id = await prepareAndSubmit(agent, participantId, quote);
  if ((await prisma.policy.findUniqueOrThrow({ where: { id } })).status === 'PENDING_APPROVAL') {
    await approvePending(id, underwriter);
  }
  await pay(agent, finance, [id]);
  return id;
}

/** Moves an issued policy (and its receipts and history) back in time to build a realistic trend. */
async function backdate(policyId: string, monthsAgo: number): Promise<void> {
  const policy = await prisma.policy.findUniqueOrThrow({ where: { id: policyId } });
  const shift = (date: Date | null) => (date ? addMonths(date, -monthsAgo) : null);
  await prisma.policy.update({
    where: { id: policyId },
    data: {
      issuedAt: shift(policy.issuedAt),
      startDate: shift(policy.startDate),
      endDate: shift(policy.endDate),
      createdAt: shift(policy.createdAt)!,
      submittedAt: shift(policy.submittedAt),
    },
  });
  const receipts = await prisma.receipt.findMany({ where: { policyId } });
  for (const receipt of receipts) {
    await prisma.receipt.update({
      where: { id: receipt.id },
      data: { issuedAt: shift(receipt.issuedAt)! },
    });
  }
  await prisma.commission.updateMany({
    where: { policyId },
    data: { period: toIsoDate(addMonths(businessToday(), -monthsAgo)).slice(0, 7) },
  });
}

/** Hire purchase financing risk details for the banca demo cases. */
function hp(amount: number, tenureMonths: number): QuoteSeed {
  return {
    productCode: 'FTP-HP',
    riskDetails: {
      financingAmount: amount,
      tenureMonths,
      profitRatePercent: 3.5,
      financierName: 'Mutiara Islamic Bank',
      financingReference: `HP/${amount}/${tenureMonths}`,
      vehicleRegistrationNo: `B${1000 + tenureMonths}A`,
    },
  };
}

async function seedBusiness(staff: Record<string, SessionUser>): Promise<void> {
  if ((await prisma.policy.count()) > 0) {
    log('Business data already present – skipped');
    return;
  }
  const { underwriter, opsChecker, finance, compliance, support } = staff;
  const saMain = agentUsers.get('sa-main')!;
  const saSub = agentUsers.get('sa-sub')!;
  const dtMain = agentUsers.get('dt-main')!;
  const banker = agentUsers.get('mib-officer')!;

  // Annual products sold through agencies, issued and paid.
  const pro = await issueAndPay(
    saMain,
    underwriter,
    finance,
    (await createParticipant(saMain)).id,
    { productCode: 'PRO', planCode: 'B', additionalCover: true },
  );
  await issueAndPay(saMain, underwriter, finance, (await createParticipant(saMain)).id, {
    productCode: 'KHR',
    planCode: 'B',
    coverageType: 'WIDER',
  });
  await issueAndPay(
    saMain,
    underwriter,
    finance,
    (
      await createParticipant(saMain, {
        dateOfBirth: '2004-02-11',
        occupation: 'STUDENT',
        occupationClass: 1,
      })
    ).id,
    {
      productCode: 'OSA',
      planCode: 'TERTIARY',
      riskDetails: {
        registeredStudent: true,
        institutionName: 'University of Leeds',
        countryOfStudy: 'United Kingdom',
        studentIdNo: 'UOL2026-55812',
        courseEndDate: '2029-06-30',
      },
    },
  );
  await issueAndPay(saSub, underwriter, finance, (await createParticipant(saSub)).id, {
    productCode: 'PHA',
    planCode: 'STANDARD',
    termMonths: 24,
    riskDetails: {
      helperName: 'Maria Santos',
      helperPassportNo: 'P8827361A',
      helperNationality: 'Philippines',
      labourLicenceNo: 'LL/2026/04412',
    },
  });
  await issueAndPay(dtMain, underwriter, finance, (await createParticipant(dtMain)).id, {
    productCode: 'PRO',
    planCode: 'C',
  });
  await issueAndPay(dtMain, underwriter, finance, (await createParticipant(dtMain)).id, {
    productCode: 'KHR',
    planCode: 'A',
    coverageType: 'INDIVIDUAL',
  });

  // Banca financing products: issued on acceptance, paid within the grace period.
  const hpPaid = await prepareAndSubmit(
    banker,
    (await createParticipant(banker)).id,
    hp(85000, 84),
  );
  await approvePending(hpPaid, underwriter, 'Quality check completed');
  await pay(banker, finance, [hpPaid]);

  const npUnpaid = await prepareAndSubmit(banker, (await createParticipant(banker)).id, {
    productCode: 'FTP-NP',
    riskDetails: {
      financingAmount: 40000,
      tenureMonths: 60,
      profitRatePercent: 4.25,
      financierName: 'Mutiara Islamic Bank',
      financingReference: 'PF/2026/1182',
    },
  });

  const property = await prepareAndSubmit(
    banker,
    (await createParticipant(banker, { dateOfBirth: '1988-06-15' })).id,
    {
      productCode: 'PFT',
      riskDetails: {
        financingAmount: 320000,
        tenureMonths: 300,
        profitRatePercent: 3.9,
        financierName: 'Mutiara Islamic Bank',
        financingReference: 'HF/2026/0331',
        propertyAddress: 'Lot 5521, Kampong Jerudong',
      },
    },
  );
  await approvePending(property, underwriter, 'Within authority after review');
  await approvePending(property, opsChecker, 'Second approval – sum covered above B$300,000');

  // Rejected quotation after a "yes" health declaration.
  const declared = await prepareAndSubmit(dtMain, (await createParticipant(dtMain)).id, {
    productCode: 'KHR',
    planCode: 'C',
    coverageType: 'INDIVIDUAL',
    declareYes: true,
  });
  await rejectPending(
    declared,
    underwriter,
    'Medical evidence required before acceptance – please obtain a medical report and resubmit',
  );

  // Payment submitted and awaiting Finance verification.
  const awaitingVerification = await prepareAndSubmit(saSub, (await createParticipant(saSub)).id, {
    productCode: 'PRO',
    planCode: 'A',
  });
  await pay(saSub, null, [awaitingVerification]);

  // A draft quotation still being prepared.
  const draftParticipant = await createParticipant(saMain);
  const osa = await prisma.product.findUniqueOrThrow({ where: { code: 'OSA' } });
  await as(saMain, () =>
    policies.createQuotation(saMain, {
      productId: osa.id,
      participantId: draftParticipant.id,
      planCode: 'BASIC',
      riskDetails: {
        registeredStudent: true,
        institutionName: 'Monash University',
        countryOfStudy: 'Australia',
        studentIdNo: 'MU-33127',
        courseEndDate: '2028-11-30',
      },
    }),
  );

  // Historical production for the 12-month trend.
  const history: QuoteSeed[] = [
    { productCode: 'PRO', planCode: 'A' },
    { productCode: 'KHR', planCode: 'B', coverageType: 'INDIVIDUAL' },
    {
      productCode: 'PHA',
      planCode: 'STANDARD',
      termMonths: 12,
      riskDetails: {
        helperName: 'Siti Rahayu',
        helperPassportNo: 'B1928374',
        helperNationality: 'Indonesia',
        labourLicenceNo: 'LL/2025/9921',
      },
    },
    { productCode: 'PRO', planCode: 'C', additionalCover: true },
    { productCode: 'KHR', planCode: 'C', coverageType: 'WIDER' },
  ];
  for (let monthsAgo = 1; monthsAgo <= 11; monthsAgo++) {
    const perMonth = 2 + (monthsAgo % 3);
    for (let i = 0; i < perMonth; i++) {
      const seller = [saMain, saSub, dtMain][(monthsAgo + i) % 3];
      const id = await issueAndPay(
        seller,
        underwriter,
        finance,
        (await createParticipant(seller)).id,
        history[(monthsAgo + i) % history.length],
      );
      await backdate(id, monthsAgo);
    }
    if (monthsAgo % 2 === 0) {
      const id = await prepareAndSubmit(
        banker,
        (await createParticipant(banker)).id,
        hp(30000 + monthsAgo * 4000, 60),
      );
      await approvePending(id, underwriter, 'Quality check completed');
      await pay(banker, finance, [id]);
      await backdate(id, monthsAgo);
    }
  }
  // Overdue banca policy: issued 10 days ago and never paid -> the bank is blocked (AP-42).
  const overdue = await prepareAndSubmit(
    banker,
    (await createParticipant(banker)).id,
    hp(32000, 48),
  );
  await approvePending(overdue, underwriter, 'Quality check completed');
  await prisma.policy.update({
    where: { id: overdue },
    data: { paymentDueDate: addDays(businessToday(), -3), issuedAt: addDays(new Date(), -10) },
  });

  // High-risk referral left in the approval inbox (financing above B$150,000).
  await prepareAndSubmit(banker, (await createParticipant(banker)).id, hp(180000, 96));

  log('Policies ready');

  // AML: one participant flagged by the watch-list and left for Compliance; one false positive cleared.
  const flagged = await createParticipant(saMain, { fullName: 'Ahmad Zulkifli bin Hamid' });
  const cleared = await createParticipant(dtMain, { fullName: 'Viktor Petrenkov' });
  const clearedCase = await prisma.amlScreening.findFirst({
    where: { subjectId: cleared.id, status: 'PENDING_REVIEW' },
  });
  if (clearedCase) {
    await as(compliance, () =>
      app
        .get(AmlService)
        .review(
          compliance,
          clearedCase.id,
          'CLEARED',
          'Different date of birth and nationality – false positive',
        ),
    );
  }
  log(`AML cases ready (${flagged.fullName} pending review)`);

  // Servicing requests awaiting approval.
  await as(saMain, () =>
    policies.requestEndorsement(saMain, pro, {
      endorsementType: 'NOMINEE_CHANGE',
      description: 'Participant requests to add a second child as nominee',
      nominees: [
        {
          fullName: 'Hajah Mariam binti Haji Ahmad',
          relationship: 'SPOUSE',
          role: 'NOMINEE',
          sharePercent: 50,
        },
        {
          fullName: 'Muhammad Iqbal bin Hassan',
          relationship: 'CHILD',
          role: 'NOMINEE',
          sharePercent: 25,
        },
        {
          fullName: 'Nur Insyirah binti Hassan',
          relationship: 'CHILD',
          role: 'NOMINEE',
          sharePercent: 25,
        },
      ],
    }),
  );
  const proPolicy = await prisma.policy.findUniqueOrThrow({ where: { id: pro } });
  await as(saMain, () =>
    participants.requestUpdate(saMain, proPolicy.participantId, {
      mobile: '6738990011',
      addressLine1: 'No. 18, Simpang 32, Jalan Tutong',
    }),
  );

  // Claim notification on an in-force policy.
  const claims = app.get(ClaimsService);
  const claim = await as(saMain, () =>
    claims.create(saMain, {
      policyId: pro,
      claimType: 'MEDICAL',
      eventDate: toIsoDate(businessToday()),
      description:
        'Participant hospitalised at RIPAS Hospital for appendectomy; admission and discharge summary attached.',
      claimedAmount: 2450,
    }),
  );
  await as(saMain, async () =>
    documents.upload(
      saMain,
      { ownerType: 'CLAIM', ownerId: claim.id, docType: 'CLAIM_SUPPORT' },
      await samplePdf('Discharge summary'),
    ),
  );
  await as(staff.opsMaker, () =>
    claims.updateStatus(claim.id, 'UNDER_REVIEW', 'Forwarded to claims department for assessment'),
  );

  // Issues raised through the portal.
  const issues = app.get(IssuesService);
  const issue = await as(saSub, () =>
    issues.create(saSub, {
      title: 'Unable to upload IC copy from mobile phone',
      description:
        'When uploading a photo of the IC from my phone the upload stops at 90%. Tried twice on mobile data.',
      category: 'DOCUMENTS',
      priority: 'MEDIUM',
    }),
  );
  await as(support, () => issues.assign(issue.id, support.id, 'Application support'));
  await as(support, () =>
    issues.comment(
      support,
      issue.id,
      'Thank you – please try again on Wi-Fi; we are checking the upload limits for large photos.',
      false,
    ),
  );
  await as(banker, () =>
    issues.create(banker, {
      title: 'Receipt not received by participant',
      description:
        'Participant did not receive the e-Receipt email for policy issued this morning. Please check delivery.',
      category: 'PAYMENT',
      priority: 'HIGH',
    }),
  );

  // Operations has already checked the paperwork of older business; the last week stays in
  // the document queue.
  const settled = await prisma.policy.findMany({
    where: { issuedAt: { lt: addDays(businessToday(), -7) } },
    select: { id: true, allocations: { select: { paymentId: true } } },
  });
  const activeAgents = await prisma.agent.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });
  const checkedOwners = [
    ...settled.map((policy) => policy.id),
    ...settled.flatMap((policy) => policy.allocations.map((a) => a.paymentId)),
    ...activeAgents.map((agent) => agent.id),
  ];
  const toVerify = await prisma.document.findMany({
    where: { status: 'UPLOADED', systemGenerated: false, ownerId: { in: checkedOwners } },
    select: { id: true },
  });
  for (const document of toVerify) {
    await as(opsChecker, () => documents.review(opsChecker, document.id, 'VERIFIED'));
  }

  // Payment block evaluation, deliveries and end-of-day.
  await app.get(GracePeriodService).evaluateAll();
  await app.get(OutboxDispatcher).dispatchDue();
  await app.get(NotificationDispatcher).dispatchPending();
  await as(finance, () => app.get(EodService).run(addDays(businessToday(), -1), finance.fullName));
  await as(finance, () => app.get(EodService).run(businessToday(), finance.fullName));
  // Users have read their older notifications; the five most recent stay unread.
  await prisma.$executeRaw`
    UPDATE notification SET read_at = now()
    WHERE read_at IS NULL AND user_id IS NOT NULL AND id NOT IN (
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY user_id ORDER BY created_at DESC) AS position
        FROM notification WHERE user_id IS NOT NULL
      ) ranked WHERE position <= 5)`;
  log(`Business data ready (unpaid within grace: ${npUnpaid})`);
}

// ---------------------------------------------------------------------------

try {
  await seedStaff();
  const staff = {
    opsMaker: await session('ops.maker'),
    opsChecker: await session('ops.checker'),
    underwriter: await session('underwriter'),
    finance: await session('finance'),
    compliance: await session('compliance'),
    support: await session('support'),
  };
  const agencyIds = await seedAgencies(staff.opsMaker);
  await seedWatchlist(staff.compliance);
  await seedAgents(staff.opsMaker, staff.opsChecker, agencyIds);
  await seedBusiness(staff);
  // Users referenced by the seed are listed so testers know who to sign in as.
  const users = await prisma.user.findMany({
    select: { username: true, userType: true },
    orderBy: { username: 'asc' },
  });
  log(`Demo users: ${users.map((u) => `${u.username} (${u.userType})`).join(', ')}`);
} finally {
  await app.close();
}
