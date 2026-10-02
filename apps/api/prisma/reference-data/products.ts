/**
 * IIFT product catalogue (RFP section 1.1 and Appendix 3).
 *
 * Plan structures, limits, eligibility and documents follow the RFP. Contribution rates
 * are INDICATIVE placeholders for demonstration and testing only: IIFT's approved rate
 * tables replace them during the design phase, through Back-office > Products, without
 * code changes.
 */

const HEALTH_DECLARATION = [
  {
    code: 'HEALTH_CURRENT',
    text: 'Are you currently suffering from any illness or medical condition, or receiving medical treatment?',
    referIfYes: true,
  },
  {
    code: 'HEALTH_HOSPITAL',
    text: 'In the past 5 years, have you been hospitalised or advised to undergo surgery?',
    referIfYes: true,
  },
  {
    code: 'PRIOR_DECLINE',
    text: 'Has any takaful or insurance application on your life been declined, postponed or accepted on special terms?',
    referIfYes: true,
  },
];

const FINANCING_RISK_FIELDS = (amountLabel: string) => [
  { key: 'financingAmount', label: amountLabel, type: 'number', min: 1000 },
  { key: 'tenureMonths', label: 'Financing period (months)', type: 'number', min: 12 },
  {
    key: 'profitRatePercent',
    label: 'Profit rate of financing (% p.a.)',
    type: 'number',
    min: 0,
    max: 20,
  },
  { key: 'financierName', label: 'Financier', type: 'string' },
  { key: 'financingReference', label: 'Financing agreement / approval reference', type: 'string' },
];

export const PRODUCTS = [
  {
    code: 'FTP-HP',
    name: 'Financing Takaful Plan – Hire Purchase',
    lineOfBusiness: 'Mortgage Takaful',
    description:
      'Decreasing-term family takaful covering the outstanding hire purchase financing in the event of death or total and permanent disability.',
    ratingEngine: 'FINANCING',
    paymentBeforeIssuance: false,
    allowRenewal: false,
    sortOrder: 1,
    config: {
      profitBasis: 'FLAT',
      highRiskLimit: 150000,
      minFinancing: 1000,
      maxFinancing: 500000,
      minTenureMonths: 12,
      maxTenureMonths: 108,
      minAge: 18,
      maxEntryAge: 65,
      maxAgeAtExpiry: 70,
      rateTable: [
        { maxAge: 30, ratePerMille: 2.1 },
        { maxAge: 40, ratePerMille: 3.2 },
        { maxAge: 50, ratePerMille: 5.6 },
        { maxAge: 60, ratePerMille: 9.8 },
        { maxAge: 65, ratePerMille: 14.5 },
      ],
      decreasingFactor: 0.55,
      wakalahPercent: 25,
      minimumContribution: 50,
      commissionRate: 0.1,
      qualityCheck: true,
      riskFields: [
        ...FINANCING_RISK_FIELDS('Hire purchase financing amount (B$)'),
        {
          key: 'vehicleRegistrationNo',
          label: 'Vehicle registration no.',
          type: 'string',
          required: false,
        },
      ],
    },
    requiredDocuments: [
      { docType: 'PROPOSAL_FORM', label: 'Proposal form', mandatory: true },
      { docType: 'PDS', label: 'Product disclosure sheet (acknowledged)', mandatory: true },
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
      {
        docType: 'HP_APPROVAL_LETTER',
        label: 'Hire purchase approval letter from the financier',
        mandatory: true,
      },
      {
        docType: 'HP_STATEMENT',
        label: 'Hire purchase statement (existing financing only)',
        mandatory: false,
      },
      { docType: 'DRAWDOWN_LETTER', label: 'Drawdown letter', mandatory: true },
    ],
    questionnaire: HEALTH_DECLARATION,
  },
  {
    code: 'FTP-NP',
    name: 'Financing Takaful Plan – Non-Participating',
    lineOfBusiness: 'Mortgage Takaful',
    description:
      'Non-participating decreasing-term family takaful for personal financing, protecting the family from the outstanding financing balance.',
    ratingEngine: 'FINANCING',
    paymentBeforeIssuance: false,
    allowRenewal: false,
    sortOrder: 2,
    config: {
      profitBasis: 'FLAT',
      highRiskLimit: 150000,
      minFinancing: 1000,
      maxFinancing: 300000,
      minTenureMonths: 12,
      maxTenureMonths: 120,
      minAge: 18,
      maxEntryAge: 60,
      maxAgeAtExpiry: 65,
      rateTable: [
        { maxAge: 30, ratePerMille: 2.4 },
        { maxAge: 40, ratePerMille: 3.6 },
        { maxAge: 50, ratePerMille: 6.2 },
        { maxAge: 60, ratePerMille: 10.9 },
      ],
      decreasingFactor: 0.55,
      wakalahPercent: 25,
      minimumContribution: 50,
      commissionRate: 0.1,
      riskFields: FINANCING_RISK_FIELDS('Personal financing amount (B$)'),
    },
    requiredDocuments: [
      { docType: 'PROPOSAL_FORM', label: 'Proposal form', mandatory: true },
      { docType: 'PDS', label: 'Product disclosure sheet (acknowledged)', mandatory: true },
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
      { docType: 'FINANCING_APPROVAL_LETTER', label: 'Financing approval letter', mandatory: true },
    ],
    questionnaire: HEALTH_DECLARATION,
  },
  {
    code: 'PFT',
    name: 'Property Financing Takaful Plan',
    lineOfBusiness: 'Mortgage Takaful',
    description: 'Mortgage reducing-term family takaful protecting the home financing balance.',
    ratingEngine: 'FINANCING',
    paymentBeforeIssuance: false,
    allowRenewal: false,
    sortOrder: 3,
    config: {
      profitBasis: 'NONE',
      highRiskLimit: 500000,
      minFinancing: 10000,
      maxFinancing: 1500000,
      minTenureMonths: 36,
      maxTenureMonths: 360,
      minAge: 18,
      maxEntryAge: 60,
      maxAgeAtExpiry: 70,
      rateTable: [
        { maxAge: 30, ratePerMille: 1.6 },
        { maxAge: 40, ratePerMille: 2.5 },
        { maxAge: 50, ratePerMille: 4.6 },
        { maxAge: 60, ratePerMille: 8.4 },
      ],
      decreasingFactor: 0.5,
      wakalahPercent: 25,
      minimumContribution: 100,
      commissionRate: 0.08,
      riskFields: [
        ...FINANCING_RISK_FIELDS('Property financing amount (B$)'),
        { key: 'propertyAddress', label: 'Property address', type: 'string' },
      ],
    },
    requiredDocuments: [
      { docType: 'PROPOSAL_FORM', label: 'Proposal form', mandatory: true },
      { docType: 'PDS', label: 'Product disclosure sheet (acknowledged)', mandatory: true },
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
      { docType: 'FINANCING_APPROVAL_LETTER', label: 'Financing approval letter', mandatory: true },
      { docType: 'DRAWDOWN_LETTER', label: 'Drawdown letter', mandatory: false },
    ],
    questionnaire: HEALTH_DECLARATION,
  },
  {
    code: 'PHA',
    name: 'Personal Home Assistant Takaful Plan',
    lineOfBusiness: 'Annual (Individual)',
    description:
      'Protection for employers of domestic helpers, for a coverage period of 1 or 2 years.',
    ratingEngine: 'FIXED_PLAN',
    paymentBeforeIssuance: true,
    allowRenewal: true,
    sortOrder: 4,
    config: {
      terms: [12, 24],
      plans: [
        {
          code: 'STANDARD',
          name: 'Standard',
          sumCovered: 10000,
          contributions: { '12': 120, '24': 220 },
        },
      ],
      eligibility: { participantTypes: ['INDIVIDUAL'] },
      wakalahPercent: 30,
      commissionRate: 0.15,
      riskFields: [
        { key: 'helperName', label: 'Domestic helper name', type: 'string' },
        { key: 'helperPassportNo', label: 'Helper passport no.', type: 'string' },
        { key: 'helperNationality', label: 'Helper nationality', type: 'string' },
        { key: 'labourLicenceNo', label: 'Labour licence no.', type: 'string' },
      ],
    },
    requiredDocuments: [
      { docType: 'EMPLOYER_IC', label: 'Employer IC copy', mandatory: true },
      { docType: 'EMPLOYEE_IC', label: 'Domestic helper IC copy', mandatory: true },
      { docType: 'EMPLOYEE_DETAILS', label: 'Domestic helper employment details', mandatory: true },
      { docType: 'PASSPORT_COPY', label: 'Helper passport copy', mandatory: true },
      { docType: 'LABOUR_LICENCE', label: 'Labour licence copy', mandatory: true },
      { docType: 'QUESTIONNAIRE', label: 'Signed Appendix II questionnaire', mandatory: false },
    ],
    questionnaire: [
      {
        code: 'HELPER_HEALTH',
        text: 'Is the domestic helper currently suffering from any illness or injury?',
        referIfYes: true,
      },
      {
        code: 'HELPER_PRIOR_CLAIM',
        text: 'Has a claim been made for this helper under any previous plan?',
        referIfYes: true,
      },
    ],
  },
  {
    code: 'PRO',
    name: 'Professional Takaful Plan',
    lineOfBusiness: 'Annual (Individual)',
    description:
      'Annual personal protection for professionals, managers and administrators (Occupational Class I), Plan A/B/C with optional additional cover.',
    ratingEngine: 'FIXED_PLAN',
    paymentBeforeIssuance: true,
    allowRenewal: true,
    sortOrder: 5,
    config: {
      terms: [12],
      plans: [
        {
          code: 'A',
          name: 'Plan A',
          sumCovered: 15000,
          contributions: { '12': 75 },
          additionalCover: { name: 'Additional cover – Plan A', amount: 90 },
        },
        {
          code: 'B',
          name: 'Plan B',
          sumCovered: 30000,
          contributions: { '12': 135 },
          additionalCover: { name: 'Additional cover – Plan B', amount: 120 },
        },
        {
          code: 'C',
          name: 'Plan C',
          sumCovered: 50000,
          contributions: { '12': 210 },
          additionalCover: { name: 'Additional cover – Plan C', amount: 140 },
        },
      ],
      eligibility: {
        minAge: 18,
        maxAge: 65,
        occupationClasses: [1],
        participantTypes: ['INDIVIDUAL'],
      },
      wakalahPercent: 30,
      commissionRate: 0.15,
      requiresNominee: true,
    },
    requiredDocuments: [
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
      {
        docType: 'NOMINEE_IC',
        label: 'IC copy of nominee(s), beneficiary or executor',
        mandatory: true,
      },
      { docType: 'QUESTIONNAIRE', label: 'Signed questionnaire', mandatory: false },
    ],
    questionnaire: HEALTH_DECLARATION,
  },
  {
    code: 'KHR',
    name: 'Khairat Takaful Plan',
    lineOfBusiness: 'Annual (Individual)',
    description:
      'Annual khairat (funeral and family support) benefit, Plan A/B/C, for the individual or wider family including children.',
    ratingEngine: 'FIXED_PLAN',
    paymentBeforeIssuance: true,
    allowRenewal: false,
    sortOrder: 6,
    config: {
      terms: [12],
      plans: [
        { code: 'A', name: 'Plan A', sumCovered: 5000, contributions: { '12': 40 } },
        { code: 'B', name: 'Plan B', sumCovered: 10000, contributions: { '12': 75 } },
        { code: 'C', name: 'Plan C', sumCovered: 15000, contributions: { '12': 105 } },
      ],
      coverageTypes: [
        { code: 'INDIVIDUAL', name: 'Individual', loading: 1 },
        { code: 'WIDER', name: 'Wider (Child)', loading: 1.6 },
      ],
      eligibility: { minAge: 18, maxAge: 70, participantTypes: ['INDIVIDUAL'] },
      wakalahPercent: 30,
      commissionRate: 0.15,
      requiresNominee: true,
    },
    requiredDocuments: [
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
      { docType: 'NOMINEE_IC', label: "Nominee's IC copy", mandatory: true },
      { docType: 'QUESTIONNAIRE', label: 'Signed questionnaire', mandatory: false },
    ],
    questionnaire: HEALTH_DECLARATION,
  },
  {
    code: 'OSA',
    name: 'Overseas Student Assist Takaful Plan',
    lineOfBusiness: 'Annual (Individual)',
    description:
      'Annual protection for Bruneian students studying overseas: Basic (B$20,000) or Tertiary (B$50,000).',
    ratingEngine: 'FIXED_PLAN',
    paymentBeforeIssuance: true,
    allowRenewal: true,
    sortOrder: 7,
    config: {
      terms: [12],
      plans: [
        { code: 'BASIC', name: 'Basic Plan', sumCovered: 20000, contributions: { '12': 180 } },
        {
          code: 'TERTIARY',
          name: 'Tertiary Plan',
          sumCovered: 50000,
          contributions: { '12': 380 },
        },
      ],
      eligibility: { maxAge: 65, nationalities: ['BRUNEI'], participantTypes: ['INDIVIDUAL'] },
      wakalahPercent: 30,
      commissionRate: 0.15,
      requiresNominee: true,
      riskFields: [
        {
          key: 'registeredStudent',
          label: 'Registered as a student',
          type: 'boolean',
          mustBeTrue: true,
        },
        { key: 'institutionName', label: 'Institution', type: 'string' },
        { key: 'countryOfStudy', label: 'Country of study', type: 'string' },
        { key: 'studentIdNo', label: 'Student ID no.', type: 'string' },
        { key: 'courseEndDate', label: 'Expected course end date', type: 'date' },
      ],
    },
    requiredDocuments: [
      { docType: 'IC_COPY', label: 'IC copy', mandatory: true },
      { docType: 'STUDENT_ID', label: 'Student ID / letter of offer', mandatory: true },
      {
        docType: 'NOMINEE_IC',
        label: 'IC copy of nominee, beneficiary or executor',
        mandatory: true,
      },
      { docType: 'QUESTIONNAIRE', label: 'Signed Appendix IV questionnaire', mandatory: false },
    ],
    questionnaire: [
      ...HEALTH_DECLARATION,
      {
        code: 'HAZARDOUS',
        text: 'Will the student take part in hazardous activities or sports during the period of study?',
        referIfYes: true,
      },
    ],
  },
];
