"""Proposal sections 2 and 5–11: understanding, scope, functional solution,
products and flows, architecture, security, deployment and infrastructure."""

import brand
import pricing_data as price
from docx_kit import ProposalWriter
from numbering import sec

PRODUCT = brand.PRODUCT

# =============================================================================
# 2. Understanding of requirements
# =============================================================================
OBJECTIVES = [
    ("1", "Digitalise Agent/Banca operations", "Agent/Banca Portal for onboarding, quotation, issuance, servicing, payments, claims notification and issues."),
    ("2", "Improve operational efficiency", "Data captured once at source; contribution calculated by the system; e-Policy, e-Receipt and EOD files produced automatically."),
    ("3", "Strengthen Agent/Banca management", "Agency and bank hierarchy, main/sub-agent links, five agent statuses and document expiry tracking."),
    ("4", "Strengthen governance and controls", "Role-based access with data scoping, maker-checker with configurable levels and thresholds, append-only audit trail."),
    ("5", "AML/KYC management", "Watch-list screening with fuzzy name matching at onboarding and on change; Compliance review queue."),
    ("6", "Improve data quality", "Field validation, controlled master data, duplicate checks on IC and registration numbers, daily reconciliation."),
    ("7", "Improve integration", "Transactional outbox with retry and dead-letter; adapters for Core, FIN, AML, Active Directory, SMS and e-mail."),
    ("8", "Improve reporting", "Dashboards and standard reports with Excel, CSV and PDF export and scheduled distribution."),
    ("9", "Improve user experience", "Step-by-step quotation wizards, one design system themed to Insurans Islam TAIB colours, WCAG 2.1 AA target."),
    ("10", "Strengthen security", "Controls aligned with OWASP ASVS Level 2 and an independent VAPT before go-live."),
    ("11", "Ensure scalability", "Sized for 100 concurrent and 500 named users, more than ten times the projected policy volume."),
    ("12", "Long-term sustainability", "Five years of support with yearly increases capped at 5%, maintained documentation, IIFT-specific source code with every release and an option to take the platform source code."),
]

USERS = [["Bank", "Portal", "12"], ["IIFT", "Back-office (Admin)", "5"], ["IIFT", "Portal", "5"],
         ["Agent", "Portal", "4"], ["Total", "", "26"]]

VOLUMES = [
    ["Mortgage Takaful", "Financing Takaful Plan – Hire Purchaser", "59", "16", "75"],
    ["Mortgage Takaful", "Financing Takaful Plan – Non-Participating", "158", "65", "205"],
    ["Mortgage Takaful", "Property Financing Takaful Plan", "88", "60", "115"],
    ["Annual (Individual)", "Personal Home Assistant Takaful Plan", "102", "41", "132"],
    ["Annual (Individual)", "Professional Takaful Plan", "40", "19", "52"],
    ["Annual (Individual)", "Khairat Takaful Plan", "31", "16", "40"],
    ["Annual (Individual)", "Overseas Student Assist Takaful Plan", "7", "2", "9"],
    ["Total", "", "485", "219", "628"],
]

KEY_RULES = [
    "Financing above **B$150,000** is the high-risk limit. The agent or banker cannot complete it; the case is "
    "referred to IIFT Sales (FFR01, AP-60).",
    "A **seven-day payment grace period** applies to issued policies. If payment is not submitted in time, every agent "
    "in that agency is blocked from issuing until it is settled (AP-42).",
    "**Maker-checker** covers agent registration and profile changes, participant updates, endorsements, "
    "cancellations, payment verification and AML review (BO-10, BO-17).",
    "**End-of-day processing** produces the daily issuance report and FIN entries, and issuance is reconciled with "
    "BRR for every product (FFR01 to FFR05).",
    "Product eligibility differs by plan: Professional is limited to Occupational Class I, Khairat has no renewal, and "
    "Overseas Student Assist requires a Brunei citizen registered as a student and aged 65 or under.",
]


def understanding(w: ProposalWriter):
    w.h1("Understanding of IIFT's Requirements")
    w.h2("Background")
    w.paras([
        "IIFT sells Mortgage Takaful and Annual (Individual) Family Takaful plans through agents and bank partners. "
        "Banca work today relies on paper or e-mailed submissions and manual follow-up with the back-office. Status is "
        "hard to track and management has little real-time visibility.",
        "The IIGT Agent Portal went live on 17 July 2026 for Motor Takaful. It covers agent onboarding, e-quotation, "
        "e-Cover Notes, AML screening, documents, e-signature, payment proof verification, audit and reporting. IIFT "
        "needs the same kind of capability for Family Takaful products and the Banca channel, plus a back-office in "
        "which IIFT staff review, approve and report on every Banca transaction.",
    ])
    w.h2("Project objectives and our response")
    w.table(["#", "RFP objective", "How the solution meets it"], [list(o) for o in OBJECTIVES],
            widths=[0.8, 4.7, 11.5], center_cols=(0,), font_size=8)
    w.h2("Users and volumes")
    w.para("Appendix 1 lists 26 named users and Appendix 2 projects 628 policies a year within five years. These "
           "volumes are small for a relational database and two application servers, so we size for 100 concurrent "
           "and 500 named users and ten times the projected volume (NFR-02, NFR-03, NFR-06, NFR-07).")
    w.table(["Company", "Application", "Expected users"], USERS, widths=[5.0, 7.0, 5.0], center_cols=(2,),
            total_rows=1, caption="Expected users (RFP Appendix 1)")
    w.table(["Line of business", "Product", "2025", "2026 (to July)", "Projected in 5 years"], VOLUMES,
            widths=[3.5, 6.5, 2.0, 2.5, 2.5], center_cols=(2, 3, 4), total_rows=1, font_size=8,
            caption="Policy volumes (RFP Appendix 2)")
    w.h2("Business rules that shape the design")
    w.bullets(KEY_RULES)


# =============================================================================
# 6. Functional solution
# =============================================================================
POLICY_STATUSES = [
    ["DRAFT", "Quotation saved; editable by the maker.", "Submit"],
    ["PENDING APPROVAL", "Referral above the authority limit, quality check or other approval.", "Approve or reject"],
    ["PENDING PAYMENT", "Approved; waiting for verified payment (pay-first products).", "Payment verified"],
    ["ACTIVE", "In force; e-Policy and e-Receipt issued.", "Endorse, cancel, renew, expire"],
    ["REJECTED", "Rejected with mandatory remarks.", "Amend and resubmit"],
    ["EXPIRED", "Cover period ended.", "Renew where enabled"],
    ["CANCELLED", "Cancellation approved.", "None"],
]

WORKFLOWS = [
    ["Agent / Banca registration", "Banca/Sales officer", "Banca/Sales manager", "Always two levels"],
    ["Agent profile update", "Banca/Sales officer", "None", "None"],
    ["Participant update", "Underwriting officer", "None", "None"],
    ["Quotation above B$150,000 financing", "IIFT Sales", "Underwriting manager", "Referral rule"],
    ["New policy, sum covered from B$300,000", "Underwriting officer", "Underwriting manager", "Amount threshold"],
    ["Quality check (Mortgage Takaful)", "Underwriting / QC", "None", "Product rule"],
    ["Endorsement", "Underwriting officer", "Underwriting manager", "Contribution change threshold"],
    ["Cancellation", "Underwriting officer", "Underwriting manager", "Always two levels"],
    ["Payment verification", "Finance officer", "Finance manager", "Amount threshold"],
    ["AML possible match", "Compliance officer", "Compliance manager", "On escalation"],
]

NOTIFICATIONS = [
    ["Request submitted, approved or rejected (with remarks)", "Maker; checker queue", "Portal, e-mail"],
    ["Policy issued with e-Policy and e-Receipt", "Agent; participant", "E-mail with PDF, portal"],
    ["Payment overdue: reminder on day 5, block on day 8", "Agent; agency principal; Finance", "Portal, e-mail, SMS"],
    ["Agency block lifted", "All agents of the agency", "Portal, e-mail"],
    ["Renewal due (60, 30 and 7 days) and expiry", "Agent", "Portal, e-mail"],
    ["Agent document expiring", "Agent; Banca/Sales officer", "Portal, e-mail"],
    ["AML possible match", "Compliance", "Back-office, e-mail"],
    ["Issue assigned, updated or SLA breached", "Assignee; reporter; supervisor", "Portal, e-mail"],
    ["Dead-letter or EOD failure", "Support team; IIFT IT", "E-mail, monitoring alert"],
]

REPORT_CATALOGUE = [
    ["Daily issuance (EOD) report", "Finance, Banca", "Issued policies by product, bank and agent"],
    ["FIN interface report", "Finance", "Entries sent to FIN with control totals"],
    ["Receipt and BRR reconciliation", "Finance", "Matched and unmatched receipts and issuance"],
    ["Policy register by status", "Banca, Underwriting", "Policies with status, dates and contribution"],
    ["Production report", "Management, Banca", "Production by agent, agency, bank, product, period"],
    ["Outstanding payments and ageing", "Finance, Banca", "Unpaid policies by ageing bucket"],
    ["Grace-period breaches and agency blocks", "Finance, Banca", "Policies unpaid over 7 days; blocked agencies"],
    ["Renewals due and expiries", "Banca, agents", "Policies due for renewal or expired"],
    ["Claims notification register", "Claims, Banca", "Notifications and their status"],
    ["AML screening and review", "Compliance", "Screenings, possible matches, outcomes"],
    ["Agent register and document expiry", "Banca/Sales", "Agents, hierarchy, status, licence and document validity"],
    ["Approval turnaround", "Management", "Requests by type, ageing and turnaround"],
    ["Issue log and SLA", "IT, Management", "Issues by priority, status and SLA result"],
    ["User access review", "IT security, Audit", "Users, roles, last login, dormant accounts"],
    ["Commission / referral fee statement", "Agents, Finance", "Statement retrieved from FIN (INT-05)"],
]


def functional_solution(w: ProposalWriter, figs: dict):
    w.h1("Functional Solution")
    w.paras([
        f"{PRODUCT} is iorta TechNXT's distribution platform for Takaful and insurance. For IIFT it is configured as "
        f"the {brand.SOLUTION_NAME}: one portal for agents and bank officers and one back-office for IIFT and IITH "
        "staff, sharing a single database, workflow engine, document store and audit trail. A transaction submitted "
        "in the portal appears in the back-office at once, and every action on it is recorded.",
        f"Functions are listed by RFP area in Section {sec('scope')}, users in Section {sec('personas')}, journeys in "
        f"Section {sec('journeys')} and screens in Section {sec('screens')}. This chapter covers the rules that tie "
        "them together.",
    ])
    w.h2("Policy lifecycle")
    w.para("Only the server changes a policy's status, after validation and any required approval. Validation "
           "covers product eligibility, mandatory documents, the AML result, the agency payment block and the "
           "authority limit. Each change is written to the policy history and the audit trail.")
    w.figure(figs["lifecycle"], "Policy lifecycle and status transitions", width_cm=16.0)
    w.table(["Status", "Meaning", "Next actions"], POLICY_STATUSES, widths=[3.4, 9.6, 4.0], font_size=8,
            bold_first_col=True)
    w.h2("Workflow engine and maker-checker")
    w.para("Approvals are data, not code. A workflow definition sets the transaction type, the number of levels, the "
           "permission needed at each level and amount thresholds that add a level, for example a second approval "
           "from B$300,000 sum covered. On final approval a handler applies the change in the same database "
           "transaction as the audit record and the notification event. The API rejects any attempt by the maker to "
           f"approve their own request. When Compliance confirms an AML match, the pending requests for that agent or "
           "participant are rejected automatically with the Compliance remarks and the maker is notified. Journey 9 "
           f"in Section {sec('journeys')} shows the flow.")
    w.table(["Transaction", "Level 1 checker", "Level 2 checker", "Rule"], WORKFLOWS, widths=[5.6, 3.8, 3.8, 3.8],
            font_size=8, caption="Default workflow definitions, confirmed in design")
    w.h2("Seven-day grace period")
    w.para("A nightly job finds issued policies unpaid for more than seven days and blocks issuance for every agent "
           "of that agency. Agents see the reason on their dashboard. The block lifts automatically once Finance "
           "verifies the payment.")
    w.h2("Notifications")
    w.table(["Event", "Recipients", "Channels"], NOTIFICATIONS, widths=[7.0, 5.5, 4.5], font_size=8,
            caption="Notification events (templates and channels configurable)")
    w.h2("Reports")
    w.para("The platform has 12 standard reports with filters, Excel, CSV and PDF export and scheduled e-mail "
           "delivery. The go-live catalogue below is confirmed in design; reports not yet built are delivered during "
           "implementation within the fixed price.")
    w.table(["Report", "Primary users", "Content"], REPORT_CATALOGUE, widths=[5.5, 3.5, 8.0], font_size=8,
            caption="Report catalogue for go-live")


# =============================================================================
# 7. Products and process flows
# =============================================================================
PRODUCTS = [
    ["FTP-HP", "Financing Takaful Plan – Hire Purchaser", "Mortgage", "Financing amount, tenure, profit rate, age next birthday", "Above B$150,000 referred to IIFT Sales; QC before contract; issue-then-pay with 7-day grace"],
    ["FTP-NP", "Financing Takaful Plan – Non-Participating", "Mortgage", "As FTP-HP", "Same engine and referral rule"],
    ["PFT", "Property Financing Takaful Plan", "Mortgage", "As FTP-HP (decreasing term)", "Same engine; property financing documents"],
    ["PHA", "Personal Home Assistant Takaful Plan", "Annual", "Cover period 1 or 2 years", "Employer IC, employee IC and details, passport, labour licence"],
    ["PRO", "Professional Takaful Plan", "Annual", "Plan A/B/C B$15k/30k/50k; additional cover B$90/120/140", "Occupational Class I only; nominee, beneficiary or executor IC"],
    ["KHR", "Khairat Takaful Plan", "Annual", "Plan A/B/C B$5k/10k/15k; Individual or Wider (Child)", "Renewal switched off"],
    ["OSA", "Overseas Student Assist Takaful Plan", "Annual", "Basic B$20k or Tertiary B$50k", "Brunei citizen, registered student, age 65 or under; student ID"],
]

FLOWS = [
    ("FFR01: Financing Takaful Plan, Hire Purchaser (FTPHP)", [
        ["FTPHP01", "Capture participant details", "Full name, IC number, address, phone; duplicate check and AML screening.", "Possible matches go to Compliance."],
        ["FTPHP02", "Attach documents", "Proposal form, product disclosure sheet, IC copy, HP agreement or financier approval; HP statement for existing HP.", "Checklist enforces mandatory documents per case."],
        ["FTPHP03", "Contribution", "Calculated from financing amount, period, profit rate and age next birthday.", "Above B$150,000: referred to IIFT Sales."],
        ["FTPHP04", "Drawdown letter", "Agent uploads the drawdown letter and remaining documents and enters drawdown details.", "Back-office validates documents."],
        ["FTPHP05", "Issue receipt", "e-Receipt issued for the contribution collected.", "Receipt number assigned; FIN entry queued."],
        ["FTPHP06", "Quality check", "Status shows Pending Approval (QC).", "Underwriting approves or rejects with remarks."],
        ["FTPHP07", "e-Policy and e-Receipt", "PDFs available to download and e-mailed to the participant.", "Stored in the encrypted document store."],
        ["FTPHP08", "EOD and final issuance", "None", "EOD report, master report, FIN file, reconciliation."],
    ]),
    ("FFR02: Personal Home Assistant Takaful Plan (APHA)", [
        ["APHA01", "Capture participant details", "Full name, IC number, address, phone.", "Duplicate check, AML screening."],
        ["APHA02", "Select cover", "New or renewal; 1 or 2 years.", "Plan rules from configuration."],
        ["APHA03", "Quotation and questionnaire", "Summary shown; Appendix II questionnaire completed.", "Questionnaire version stored."],
        ["APHA04", "Requirements", "Employer IC, employee IC, employee details, passport, labour licence.", "Checklist and expiry dates."],
        ["APHA05", "Payment", "Single or bulk payment with proof.", "Finance verifies."],
        ["APHA06", "e-Policy and e-Receipt", "Issued on payment confirmation.", "Policy becomes ACTIVE."],
        ["APHA07", "FIN reporting", "None", "Daily report, FIN file, BRR reconciliation."],
    ]),
    ("FFR03: Professional Takaful Plan (APPT)", [
        ["APPT01", "Capture participant details", "Full name, IC number, address, phone.", "Duplicate check, AML screening."],
        ["APPT02", "Quotation, new or renewal", "Plan A B$15,000, Plan B B$30,000, Plan C B$50,000.", "Occupational Class I only."],
        ["APPT03", "Additional cover", "Optional: Plan A B$90, Plan B B$120, Plan C B$140.", "Configured as rider."],
        ["APPT04", "Summary and questionnaire", "Summary shown; questionnaires completed.", "Answers can trigger referral rules."],
        ["APPT05", "Documents", "Questionnaire, IC copy, IC of nominee, beneficiary or executor.", "Checklist validation."],
        ["APPT06", "Payment", "Payment with proof.", "Finance verifies."],
        ["APPT07", "Policy and receipt", "e-Policy and e-Receipt on confirmation.", "Policy becomes ACTIVE."],
        ["APPT08", "EOD reporting", "None", "EOD report, FIN entries, BRR reconciliation."],
    ]),
    ("FFR04: Khairat Takaful Plan (APKT)", [
        ["APKT01", "Capture participant details", "Full name, IC number, address, phone.", "Duplicate check, AML screening."],
        ["APKT02", "Quotation", "Plan A B$5,000, B B$10,000, C B$15,000; Individual or Wider (Child).", "Renewal switched off."],
        ["APKT03", "Summary and questionnaire", "Summary shown; questionnaires completed.", "Stored with quotation."],
        ["APKT04", "Documents", "Questionnaires, IC copy, nominee's IC copy.", "Checklist validation."],
        ["APKT05", "Payment", "Payment with proof.", "Finance verifies."],
        ["APKT06", "Policy issuance", "e-Policy and e-Receipt on confirmation.", "Policy becomes ACTIVE."],
        ["APKT07", "EOD reporting", "None", "EOD report to FIN; BRR reconciliation."],
    ]),
    ("FFR05: Overseas Student Assist Takaful Plan (APAOS)", [
        ["APAOS01", "Capture participant details", "Full name, IC number, address, phone.", "Duplicate check, AML screening."],
        ["APAOS02", "Select cover", "Basic B$20,000 or Tertiary B$50,000.", "Plan rules from configuration."],
        ["APAOS03", "Eligibility", "Brunei citizen, registered student, age 65 or under.", "Ineligible cases cannot proceed."],
        ["APAOS04", "Summary and questionnaire", "Summary shown; Appendix IV questionnaire.", "Stored with quotation."],
        ["APAOS05", "Documents", "Questionnaires, IC copy, student ID, IC of nominee, beneficiary or executor.", "Checklist validation."],
        ["APAOS06", "Payment", "Payment with proof.", "Finance verifies."],
        ["APAOS07", "e-Policy and e-Receipt", "Issued on confirmation.", "Policy becomes ACTIVE."],
        ["APAOS08", "EOD reporting", "None", "EOD report, FIN file, BRR reconciliation."],
    ]),
]

EOD_STEPS = [
    ["1", "Cut-off", "Configurable daily cut-off; later transactions roll to the next business day."],
    ["2", "Issuance report", "Policies issued, endorsed and cancelled and receipts approved, by product, bank and agent."],
    ["3", "Final issuance", "Master report for Mortgage Takaful final issuance (FFR01 step 8)."],
    ["4", "FIN interface file", "Contribution and receipt entries, with wakalah fee and tabarru' split where applicable."],
    ["5", "Reconciliation", "Receipts reconciled today; BRR reconciliation added once IIFT confirms the BRR format."],
    ["6", "Grace-period check", "Policies unpaid for more than seven days found; agency blocks applied or lifted."],
    ["7", "Sign-off", "Finance reviews exceptions and signs off the run; run history kept."],
]


def product_flows(w: ProposalWriter):
    w.h1("Products, Rating and Process Flows")
    w.para("All seven products in RFP section 1.1 and Appendix 3 are configured in the working application. Each "
           "product definition holds plans, sums covered, eligibility, required documents, questionnaires, renewal "
           "availability, payment mode (pay first, or issue then pay within the grace period) and its rating engine.")
    w.h2("Product configuration")
    w.table(["Code", "Product", "Line", "Rating inputs", "Key rules"], PRODUCTS,
            widths=[1.5, 4.0, 1.6, 4.8, 5.1], font_size=8, caption="Product configuration")
    w.h2("Contribution calculation")
    w.paras([
        "The Mortgage Takaful engine (FTP-HP, FTP-NP, PFT) calculates contribution from financing amount, financing "
        "period, profit rate and age next birthday using decreasing-term rate tables. Annual products use plan-based "
        "tables with riders and cover periods.",
        "Rate tables, loadings, minimum contributions, rounding and authority limits are master data, changed in the "
        "back-office with every change audited. Maker-checker approval and effective-dated versions of rate tables, "
        "with the version recorded on each quotation, are added during implementation; until then a second person "
        "checks each rate change against IIFT's signed rate sheet. The working "
        "application holds indicative rates; IIFT's actuarial rates and wakalah fee and tabarru' split are loaded and "
        "verified during design and SIT.",
    ])
    w.h2("Process flows (Appendix 3)")
    for title, rows in FLOWS:
        w.h3(title)
        w.table(["Step", "RFP step", "Portal / participant", "Back-office / system"], rows,
                widths=[1.9, 3.3, 6.4, 5.4], font_size=8, padding=30)
    w.h2("End-of-day processing")
    w.para("EOD runs on a schedule and can be re-run from the back-office. One locked job runs across application "
           "nodes. Each posting to FIN carries a revision number and its own idempotency key, and a re-run is marked "
           "as replacing the previous revision, so FIN can reject duplicates and keep only the latest figures for "
           "the day.")
    w.table(["#", "Step", "Description"], EOD_STEPS, widths=[0.8, 3.6, 12.6], center_cols=(0,), font_size=8)


# =============================================================================
# 8. Solution architecture
# =============================================================================
MODULES = [
    ["auth, users-roles", "Login, sessions, password policy, roles, permissions, data scopes", "AP-01–04, AP-59, BO-01–04"],
    ["agencies, agents", "Agencies, banks, branches, agents, hierarchy, status, onboarding", "AP-05–12, BO-05–12"],
    ["participants, aml", "Participant record, duplicate checks, watch-list screening, Compliance review", "AP-11–16, AP-48, BO-13–15"],
    ["products", "Catalogue, plans, rate tables, rating engines, questionnaires", "AP-17–19, BO-32"],
    ["policies", "Quotations, issuance, status, renewal, endorsement, cancellation, history", "AP-20–36, AP-60"],
    ["billing", "Payments, allocation, proofs, verification, e-Receipts, grace-period rule", "AP-37–42"],
    ["claims, issues", "Claim notifications; issues with priority and SLA timers", "AP-43, AP-55–57, BO-29–31"],
    ["documents, esign", "Encrypted store, upload checks, PDF output, e-mail, on-screen and e-mail-link signatures", "AP-44–47, AP-62, COM-06"],
    ["workflow", "Workflow definitions, approval requests and actions, handlers", "AP-33, AP-49–51, BO-16–19, COM-04"],
    ["notifications", "Templates; e-mail, SMS and in-portal delivery; delivery log", "AP-34, AP-54, COM-05"],
    ["reports, dashboard", "Report definitions, exports, schedules, KPIs", "AP-52–53, AP-58, BO-20–25, COM-08"],
    ["audit, config", "Append-only audit; parameters, master data, numbering", "BO-26–28, BO-32–33, COM-03, COM-09"],
    ["integration, jobs", "Outbox, dispatcher, adapters, integration log; EOD, grace period, expiry, reminders", "INT-01–15, AP-42"],
]

ENTITIES = [
    ["Agency, Bank, Branch, Agent", "Distribution structure, agent code, type, status, parent agent, licence"],
    ["User, Role, Permission, Session", "Access control; sessions held on the server"],
    ["Participant, Nominee", "Shared participant record; IC and passport numbers encrypted"],
    ["Product, Plan, RateTable, Questionnaire", "Versioned product configuration"],
    ["Quotation, Policy, PolicyTransaction", "Policy lifecycle and history"],
    ["Payment, PaymentAllocation, Receipt", "Billing with exact NUMERIC amounts"],
    ["Claim, Issue, Document", "Claim notifications, issues with SLA timestamps, document metadata and checksums"],
    ["WorkflowDefinition, ApprovalRequest, ApprovalAction", "Maker-checker"],
    ["AmlScreening, AuditEvent", "Screening results; append-only audit with before and after values"],
    ["OutboxEvent, IntegrationLog, EodRun, AgencyBlock", "Integration delivery, EOD runs and grace-period blocks"],
]

DB_COMPARISON = [
    ["Data shape", "Relational: agency, main agent, sub-agent; policy, participant, nominees, payments, receipts, claims", "Suits self-contained documents with few relationships"],
    ["Transaction integrity (NFR-16)", "Issuance, receipt, audit and outbox commit in one ACID transaction; row locks for numbering", "Multi-document transactions exist but fit this model less naturally"],
    ["Financial accuracy", "Exact NUMERIC plus foreign keys, CHECK and UNIQUE constraints", "Decimal128; integrity rules mostly in application code"],
    ["Reporting (BO-22–25)", "Joins and aggregates written directly in SQL", "Aggregation pipelines; joins via $lookup"],
    ["Flexible data", "JSONB for questionnaires, product settings and audit values", "Native"],
    ["Operations", "Streaming replication and point-in-time recovery; managed on every cloud and on-premise", "Replica sets; a second skill set for IITH"],
    ["Licence", "PostgreSQL licence, no fee", "SSPL; enterprise features are paid"],
    ["Fit to volume", "Under 5 GB of structured data in five years", "Strength is very large schemaless data, not needed here"],
]

INTERFACES = [
    ["Core system", "Both ways", "REST API or scheduled file", "Event-driven plus daily sync", "Agent, agency, bank master; status; policy summary", "mTLS or API key; IP allow-list"],
    ["FIN", "Out (commission in)", "Interface file over SFTP, or API", "EOD; statements on demand", "Contribution, receipts, allocations; commission and referral fees", "SFTP keys or mTLS"],
    ["AML screening", "Request / response", "REST API", "On onboarding and change; scheduled re-screen", "Name, IC, date of birth, nationality; match result", "API key or OAuth2; TLS"],
    ["Active Directory", "Inbound", "LDAPS", "At login", "Back-office authentication and groups", "LDAPS service account"],
    ["SMS gateway", "Out", "HTTPS API", "Real time", "OTP and alerts", "API key; TLS"],
    ["E-mail", "Out", "SMTP with STARTTLS", "Real time", "Notifications, documents, scheduled reports", "Authenticated relay"],
]

TECH_STACK = [
    ["Front end", "React 19, TypeScript, Vite, Ant Design 6, TanStack Query, React Router", "Widely used; accessible components themed to Insurans Islam TAIB colours"],
    ["API", "Node.js 22 LTS, NestJS 12 (TypeScript), modular monolith", "Module boundaries follow the RFP functional areas"],
    ["Data access", "Prisma 7 with the PostgreSQL driver adapter; versioned SQL migrations", "Typed, parameterised queries only"],
    ["Database", "PostgreSQL 16", "See data architecture"],
    ["Documents and reports", "pdfkit for PDFs, exceljs for Excel; encrypted local volume, MinIO or S3", "No native dependencies"],
    ["Jobs", "NestJS scheduler with PostgreSQL advisory locks", "One runner across replicas for EOD, grace period and outbox"],
    ["Observability", "pino JSON logs with correlation id; health endpoints; Prometheus metrics; Grafana", "Central monitoring and alerting"],
    ["Testing", "Vitest (unit and API tests against PostgreSQL; web component tests with Testing Library), Playwright, k6", "Run in the CI pipeline"],
    ["Delivery", "Non-root Docker images; docker compose on-premise; Kubernetes or ECS optional; GitHub Actions or GitLab CI", "Same images in every environment"],
]

NFR_APPROACH = [
    ["Performance (NFR-01)", "Page load under 3 s; standard API calls p95 under 1 s; reports on 12 months of data under 10 s. Proven by k6 tests (DEL-18)."],
    ["Capacity (NFR-02, 03, 06, 07)", "100 concurrent and 500 named users; ten times Appendix 2 volume. Stateless API nodes scale out."],
    ["Availability (NFR-04, 05)", "99.5% overall and 99.9% in IIFT business hours; two application nodes and a PostgreSQL standby."],
    ["Backup and DR (NFR-17 to 19)", "Daily full backup and continuous WAL archiving; 35 days online, monthly copies for 12 months; RPO 15 minutes, RTO 4 hours; annual DR test."],
    ["Integrity and errors (NFR-15, 16)", "ACID transactions and idempotency keys; users see a generic message with a correlation id."],
    ["Monitoring and logs (NFR-26 to 28)", "Health, metrics, job and integration monitors; alerts on downtime, error rate, latency, failed jobs and dead-letters; logs to a central store."],
    ["Retention and quality (NFR-29, 30)", "Policy and financial records kept 7 years after expiry by default; validation on every input plus database constraints."],
    ["Usability (NFR-22 to 24)", "One design system; WCAG 2.1 AA target; current and previous versions of Chrome, Edge, Firefox and Safari."],
    ["API standards (NFR-25)", "REST and JSON over HTTPS, OpenAPI 3, ISO 8601 dates, versioned URLs (/api/v1)."],
]


def architecture(w: ProposalWriter, figs: dict):
    w.h1("Solution Architecture")
    w.h2(f"{PRODUCT} logical architecture")
    w.paras([
        f"{PRODUCT} is a modular monolith: one deployable application split into modules that follow the RFP "
        "functional areas. For 26 named users and about 600 policies a year this is simpler to run than "
        "microservices, and a module can be split out later without a rewrite (NFR-20).",
        "Users reach two React applications through a reverse proxy and web application firewall. The back-office path "
        "is published only on the internal network. Both applications call one versioned REST API. The integration "
        "layer isolates IITH systems through a transactional outbox, and PostgreSQL is the system of record.",
    ])
    w.figure(figs["logical"], f"{PRODUCT} logical architecture", width_cm=16.0)
    w.h2(f"{PRODUCT} components")
    w.table(["Module", "Responsibilities", "RFP requirements"], MODULES, widths=[3.2, 8.8, 5.0], font_size=8,
            caption="Application modules")
    w.h2("Data architecture")
    w.table(["Entity group", "Purpose"], ENTITIES, widths=[7.0, 10.0], font_size=8, caption="Key data entities")
    w.para("We chose PostgreSQL over MongoDB because IIFT's data is relational and financial. The comparison below "
           "summarises the reasons.")
    w.table(["Criterion", "PostgreSQL 16 (selected)", "MongoDB"], DB_COMPARISON, widths=[3.6, 7.6, 5.8],
            font_size=8, bold_first_col=True, caption="Database selection")
    w.h2("Integration architecture")
    w.para("Each outbound message is written to an outbox table in the same transaction as the business change. A "
           "policy therefore cannot be issued without its FIN entry being queued, and a failed call loses nothing. A "
           "dispatcher delivers messages through adapters, retries with back-off, logs every attempt and moves "
           "exhausted messages to a dead-letter queue shown in the integration monitor. The outbox, retry and "
           "dead-letter handling run in the working application; the IIFT adapters are built during implementation "
           "against the interface specification (DEL-09).")
    w.figure(figs["integration"], "Integration flow with outbox, retry and reconciliation", width_cm=16.0)
    w.table(["Interface", "Direction", "Method", "Frequency", "Data", "Security"], INTERFACES,
            widths=[2.4, 2.4, 3.0, 2.8, 3.8, 2.6], font_size=8, caption="Interface catalogue")
    w.h2("Technology stack")
    w.table(["Layer", "Technology and version", "Reason"], TECH_STACK, widths=[2.8, 8.0, 6.2], font_size=8,
            bold_first_col=True, caption=f"{PRODUCT} technology stack")
    w.para("All components are open source under permissive licences. The CI pipeline produces a CycloneDX software "
           "bill of materials of the production dependencies on every build; it is delivered with the technical "
           "manual (COM-17).")
    w.h2("Non-functional requirements")
    w.para(f"Security requirements (NFR-08 to NFR-14) are covered in Section {sec('security')}. The remaining "
           "targets are:")
    w.table(["Area", "Target and approach"], NFR_APPROACH, widths=[4.4, 12.6], font_size=8, bold_first_col=True)


# =============================================================================
# 9. Security
# =============================================================================
SECURITY_CONTROLS = [
    ["Authentication", "Argon2id password hashing; rate-limited login; MFA by e-mail OTP or authenticator app for back-office (optional for portal); Active Directory single sign-on", "AP-01, BO-01, NFR-09, INT-06"],
    ["Password policy", "12 characters minimum with complexity; last 5 passwords blocked; 90-day expiry; change at first login. All configurable", "AP-02"],
    ["Sessions", "Sessions held on the server; HttpOnly, Secure, SameSite=Strict cookie; CSRF token; new session id at login; 15-minute idle and 8-hour absolute timeout; optional single session; revoked at logout", "AP-03"],
    ["Lockout", "Locked for 30 minutes after 5 failed attempts (configurable); alert on repeated lockouts", "AP-04"],
    ["Authorisation", "Permissions per role plus data scoping by agency, bank, branch and hierarchy, checked by the API on every call; deny by default", "AP-59, BO-02, COM-02, NFR-10"],
    ["Encryption in transit", "TLS 1.2 or later with HSTS; TLS also for database, SMTP, LDAPS and APIs", "COM-10, NFR-08"],
    ["Encryption at rest", "IC and passport numbers encrypted per field with AES-256-GCM, keys held outside the database; HMAC-SHA256 blind index for exact search; masked on screen; encrypted document storage and backups", "COM-01, COM-10, NFR-08"],
    ["Input and output", "Whitelist validation of every request body; parameterised queries only; output encoding; CSP and security headers", "NFR-14, NFR-30"],
    ["File uploads", "Type allow-list with magic-byte check, size limit, SHA-256 checksum, ClamAV malware scan (mandatory in production); files served only through authorised API calls", "AP-46, COM-06"],
    ["Audit", "Append-only table; a database trigger rejects UPDATE and DELETE; the application role can only insert and read; before and after values, user, time, IP, correlation id", "BO-26–28, COM-03, NFR-11"],
    ["Errors and secrets", "Generic error messages with correlation id; secrets in environment or vault, rotated on staff change and yearly", "NFR-15, INT-10"],
    ["System APIs", "mTLS or OAuth2 client credentials for integrations; rate limiting", "INT-09, INT-10"],
]

SDLC = [
    ["Design", "Threat model for login, payment, approval and e-signature flows", "Workshop, ASVS checklist"],
    ["Build", "Secure coding standard aligned with OWASP ASVS Level 2 and Top 10; peer review of every change", "Pull-request review"],
    ["Pipeline", "Static analysis, dependency, secret and container image scans; a failed scan blocks release", "CI security gates"],
    ["Testing", "Authorisation tests per role, negative tests, DAST baseline in SIT", "API tests, DAST"],
    ["Pre-production", "Independent VAPT, remediation and re-test", "Independent tester"],
    ["Operation", "Monthly patching, vulnerability monitoring, log review", "Maintenance service"],
]

REMEDIATION = [
    ["Critical", "Remotely exploitable; data exposure or system compromise", "Contained within 24 hours; fixed within 7 days"],
    ["High", "Significant impact, exploitation likely", "Within 14 days"],
    ["Medium", "Limited impact or hard to exploit", "Within 30 days"],
    ["Low", "Minimal impact; hardening advice", "Within 90 days or next release"],
]

INCIDENT_STEPS = [
    ["Detect", "Alert, log review or user report; logged as a P1 security incident."],
    ["Contain", "Within 30 minutes: assess scope, isolate the component, revoke sessions or credentials."],
    ["Notify", "IIFT IT security told immediately; iorta supports regulatory and PDPO notifications."],
    ["Recover", "Patch, restore from a clean backup if needed, verify integrity, monitor."],
    ["Review", "Root-cause report within 5 business days; actions tracked to closure."],
]


def security(w: ProposalWriter):
    w.h1("Security Architecture & Controls")
    w.para("This chapter is the single description of security controls; other chapters refer to it. Controls are "
           "aligned with OWASP ASVS Level 2, the OWASP Top 10, Brunei's Personal Data Protection Order 2025 (PDPO) and "
           "AMBD's technology risk expectations for Takaful operators. We claim alignment, not certification. IIFT's "
           "policies are mapped in detail in the Solution Architecture (DEL-06).")
    w.h2("Controls")
    w.table(["Control", "Implementation (defaults configurable)", "RFP reference"], SECURITY_CONTROLS,
            widths=[3.0, 10.6, 3.4], font_size=8, bold_first_col=True, caption="Security controls")
    w.para("The audit trigger, field-level encryption, encrypted document storage and the ClamAV upload scan already "
           "run in the working application; the API will not start in production without the scanner configured. MFA, Active Directory sign-on and the remaining parameters are set up "
           "during implementation. Personal data is limited to what products and AML/KYC rules need; a data "
           "inventory with purpose and retention is delivered with the Solution Architecture.")
    w.h2("Secure development lifecycle")
    w.table(["Stage", "Practice", "Mechanism"], SDLC, widths=[2.8, 10.0, 4.2], font_size=8, bold_first_col=True)
    w.h2("Penetration testing and remediation")
    w.para("An independent tester assesses the portal, back-office, APIs and hosting set-up before production "
           "(NFR-13, DEL-17). The cost is in the fixed price. Findings are fixed and re-tested, and no Critical or High "
           "finding may be open at go-live. After go-live, vulnerabilities are fixed within these limits "
           "(NFR-12, MNT-12):")
    w.table(["Severity", "Description", "Timeline"], REMEDIATION, widths=[2.6, 7.4, 7.0], font_size=8,
            bold_first_col=True, caption="Vulnerability remediation timelines")
    w.h2("Regulatory alignment")
    w.para("For PDPO we provide consent and purpose notices at participant capture, access and correction support, "
           "retention rules and breach-notification support. For AMBD expectations we cover access control, change "
           "management, outsourcing and cloud considerations (infrastructure options), DR testing and audit trails. AML/CFT record "
           "keeping is met by the screening history and review decisions. Screens and documents use "
           "Shariah-appropriate terms: participant, contribution, Takaful operator, wakalah and tabarru'.")
    w.h2("Security incident response")
    w.table(["Phase", "Action"], INCIDENT_STEPS, widths=[3.0, 14.0], font_size=8, bold_first_col=True)


# =============================================================================
# 10. Deployment
# =============================================================================
ENVIRONMENTS = [
    ["DEV", "Development and sprint demos", "iorta (both options)", "Synthetic", "iorta team"],
    ["SIT", "Integration and performance testing", "A: IIFT data centre (iorta-hosted until the IIFT VM is ready). B: cloud", "Synthetic and masked samples", "iorta, IIFT IT"],
    ["UAT", "Acceptance testing and training", "A: IIFT data centre. B: cloud", "Masked or migrated test data", "IIFT users"],
    ["PROD", "Live operation", "A: IIFT/IITH data centre. B: cloud, Malaysia region", "Production", "IIFT users; iorta under change control"],
    ["DR", "Disaster recovery", "A: IIFT/IITH DR site. B: second cloud region", "Replicated production", "Activated per DR plan"],
]

PIPELINE = [
    ["Commit and review", "Branch, pull request, mandatory peer review"],
    ["Build", "Type check, lint, compile front end and API, build container images"],
    ["Test", "Unit and API tests against PostgreSQL; web component tests; coverage report"],
    ["Scan", "CodeQL static analysis, npm audit, gitleaks secret scan and Trivy image scan"],
    ["Package", "Versioned, signed images with release notes and SBOM"],
    ["Deploy to SIT/UAT", "Automated deployment and migration; Playwright smoke tests"],
    ["Approve", "Test sign-off and IIFT change approval"],
    ["Deploy to PROD", "Scripted deployment in the approved window; health checks; post-deployment checks"],
]

RELEASES = [
    ["Emergency fix", "P1/P2 defect or security patch", "As needed, expedited approval"],
    ["Maintenance release", "Fixes, minor enhancements, patches", "Monthly"],
    ["Feature release", "Change requests", "Quarterly or as agreed"],
    ["Platform upgrade", "Node.js, PostgreSQL, framework and SalesVerse 2.0 updates", "Typically yearly"],
]

GO_LIVE_CHECKLIST = [
    ["Business", "UAT signed off; users trained; procedures and contacts issued; agents and banks informed"],
    ["Technical", "Production built and hardened; performance test passed; backups and monitoring running"],
    ["Security", "VAPT findings fixed and re-tested; certificates installed; privileged access reviewed"],
    ["Data", "Two migration rehearsals; reconciliation signed; master data and rates verified"],
    ["Integration", "All interfaces tested end to end; credentials in the vault"],
    ["Operations", "Operations manual, runbooks and DR plan; support rota and escalation agreed"],
    ["Decision", "Steering Committee go/no-go recorded with open items and rollback criteria"],
]

CUTOVER = [
    ["T-10 days", "Scope frozen; deployment plan approved; agents and banks informed"],
    ["T-5 days", "Deployment rehearsal; final migration dry-run and reconciliation"],
    ["T-2 days", "Legacy data frozen; manual process continues where needed"],
    ["T-1 day", "Final extract, migration load, reconciliation, business check"],
    ["T-0", "Deployment, smoke tests, integration checks, go/no-go, users enabled"],
    ["T+1 to T+20 business days", "Hypercare: daily health checks and stand-ups, priority fixes"],
]


def deployment(w: ProposalWriter):
    w.h1("Deployment & Release Management")
    w.h2("Environments")
    w.table(["Environment", "Purpose", "Hosted by", "Data", "Users"], ENVIRONMENTS,
            widths=[2.2, 3.8, 4.4, 3.4, 3.2], font_size=8, bold_first_col=True, caption="Environments")
    w.h2("CI/CD pipeline")
    w.para("Every environment runs the same versioned container images, so what passes UAT is what runs in "
           "production. The pipeline can run on IITH's GitLab or on GitHub Actions; the repository is held for IIFT.")
    w.table(["Stage", "Activities"], PIPELINE, widths=[4.0, 13.0], font_size=8, bold_first_col=True)
    w.h2("Release management and rollback")
    w.para("Every production change follows the agreed procedure (MNT-21): change request, impact assessment, SIT "
           "and UAT, release notes, IIFT approval and deployment in an approved window.")
    w.table(["Release type", "Content", "Cadence"], RELEASES, widths=[4.0, 7.5, 5.5], font_size=8,
            bold_first_col=True)
    w.para("The previous container images are kept, so the application rolls back in minutes. Database migrations "
           "follow the expand-and-contract pattern, which lets the previous version run on the new schema. A "
           "verified backup and a recovery marker are taken before each release. Rollback criteria and decision "
           "owners are set in the deployment plan (DEL-20).")
    w.h2("Go-live checklist")
    w.table(["Area", "Readiness criteria"], GO_LIVE_CHECKLIST, widths=[3.0, 14.0], font_size=8, bold_first_col=True)
    w.h2("Cut-over plan")
    w.table(["When", "Activities"], CUTOVER, widths=[4.2, 12.8], font_size=8, bold_first_col=True)


# =============================================================================
# 11. Infrastructure options
# =============================================================================
RESPONSIBILITIES = [
    ["Servers, storage, network, firewall, load balancer", "Provide", "Specify, review"],
    ["Linux OS (RHEL 9 or Ubuntu 24.04 LTS) and licences", "Provide, patch", "Specify hardening"],
    ["Container runtime, application, proxy configuration", "Approve", "Install, configure, operate"],
    ["PostgreSQL install, replication, backup set-up", "Approve; run backup infrastructure", "Install, configure, tune"],
    ["Monitoring and alerting", "Infrastructure monitoring; receive alerts", "Application monitoring"],
    ["Certificates, DNS, SMTP relay, SMS account, AML subscription", "Provide", "Configure; support renewal"],
    ["DR site and DR tests", "Provide site; lead test", "Replication; take part in tests"],
]

CLOUD_SERVICES = [
    ["Region", "AWS Asia Pacific (Malaysia), ap-southeast-5 (Azure Malaysia West); DR copies in a second region"],
    ["Compute", "ECS Fargate across two availability zones (AKS on Azure), or two EC2 instances"],
    ["Database", "RDS for PostgreSQL 16 Multi-AZ (Azure Database for PostgreSQL, zone-redundant)"],
    ["Storage", "S3 and EFS with encryption, versioning and lifecycle rules (Azure Blob and Files)"],
    ["Edge", "Application Load Balancer with AWS WAF (Azure Application Gateway with WAF)"],
    ["Monitoring", "CloudWatch logs, metrics and alarms; GuardDuty threat detection (Azure Monitor, Defender)"],
    ["Connectivity", "Site-to-site VPN to the IITH data centre for Core, FIN, AD, SMTP and back-office users"],
    ["DR", "Automated backups with point-in-time recovery; pilot-light DR in a second region"],
]


def _comparison():
    low, high = price.bom_onprem_totals()
    return [
        ["Commercial option", "Option A: perpetual licence and AMC", "Option B: subscription and managed services",
         "Option A"],
        ["Data residency", "Data stays in Brunei", "Malaysia region; DR copies in a second region; needs IIFT "
                                                   "approval and AMBD notification",
         "Personal data on-premise; portal web tier in DMZ or cloud"],
        ["Regulatory steps", "Internal approval only", "AMBD outsourcing and cloud notification by IIFT",
         "Depends on what sits in the cloud"],
        ["Infrastructure cost", f"IIFT procures: indicative B$ {low:,}–{high:,} one-time (less where IITH "
                                "capacity is reused)",
         f"Set-up {price.bnd(price.CLOUD_SETUP_FEE)} one-off; cloud at cost, no mark-up: about "
         f"{price.bnd(price.cloud_monthly())} a month", "Mostly as Option A"],
        ["Operations", "IITH infrastructure team; iorta application support under the AMC",
         f"iorta managed services, {price.bnd(price.managed_monthly(1))} a month in Year 1", "Shared"],
        ["Provisioning time", "Depends on IITH VM provisioning", "Days", "Mixed"],
        ["Resilience", "Two nodes, standby database, DR site", "Multi-AZ; DR in a second region", "Per component"],
    ]


def _sizing_rows():
    rows, group = [], None
    for grp, server, qty, _, cpu, ram, disk, software, *_ in price.ON_PREM_BOM:
        if grp != group:
            group = grp
            rows.append(("GROUP", grp))
        rows.append([server, qty, cpu, ram, disk, software])
    return rows


def infrastructure(w: ProposalWriter, figs: dict):
    w.h1("Infrastructure Options")
    w.para(f"{PRODUCT} ships as standard containers and runs unchanged on-premise or in the cloud. The two "
           "deployment models match the commercial options: on-premise in the IIFT/IITH data centre under Option A, "
           "with infrastructure procured by IIFT to iorta's sizing, and an iorta-hosted cloud under Option B, with "
           "cloud infrastructure at cost and managed services by iorta. A hybrid variant of Option A is also "
           f"possible. Costs are in Section {sec('commercials')} and the Bill of Materials.")
    w.h2("Option A: on-premise in the IIFT/IITH data centre (recommended)")
    w.para("Two application VMs run behind the load balancer. PostgreSQL runs as a primary with a streaming standby, "
           "and an asynchronous streaming replica at the DR site stands ready for promotion. The solution uses IITH's network security, "
           "backup and monitoring services where capacity allows. Production needs two 4 vCPU / 8 GB application "
           "servers, two 4 vCPU / 16 GB database servers and 500 GB of document storage.")
    w.figure(figs["on_prem"], "Option A: on-premise deployment", width_cm=16.0)
    w.table(["Server", "Qty", "vCPU", "RAM", "Storage", "Software"], _sizing_rows(),
            widths=[3.6, 2.4, 1.2, 1.4, 2.4, 6.0], font_size=8, center_cols=(2, 3),
            caption="Option A sizing per environment (procured by IIFT; indicative costs in Annex C)")
    w.para("Operating system: Ubuntu Server 24.04 LTS or Red Hat Enterprise Linux 9, hardened to the IITH baseline. "
           "DEV stays with iorta, so IIFT provides no development environment.")
    w.table(["Item", "IIFT / IITH", "iorta TechNXT"], RESPONSIBILITIES, widths=[8.0, 4.5, 4.5], font_size=8,
            caption="Option A responsibilities")
    w.h2("Option B: iorta-hosted cloud")
    w.para(f"iorta hosts and operates the solution in a cloud account dedicated to IIFT in {price.CLOUD_REGION}. "
           "Cloud use depends on IIFT's data-residency decision and on AMBD's outsourcing and cloud notification, "
           "which IIFT makes and iorta supports with the required documents. A Brunei-hosted alternative can be "
           "priced on request.")
    w.table(["Service", "AWS reference (Azure equivalent)"], CLOUD_SERVICES, widths=[3.0, 14.0], font_size=8,
            bold_first_col=True)
    w.figure(figs["cloud"], "Option B: iorta-hosted cloud deployment (AWS reference)", width_cm=16.0)
    rows = [[name, sizing, price.bnd(monthly)]
            for (name, _, monthly), sizing in zip(price.CLOUD_MONTHLY_ITEMS, price.CLOUD_SIZING)]
    rows.append(["Total per month", "", price.bnd(price.cloud_monthly())])
    rows.append(["Total per year (at cost, estimate)", "", price.bnd(price.cloud_annual())])
    w.table(["Service", "Reference sizing", "B$ / month"], rows, widths=[6.4, 8.0, 2.6], align_right_cols=(2,),
            total_rows=2, font_size=8, caption="Option B cloud infrastructure estimate (recharged at cost)")
    w.para(f"iorta's managed services (monitoring, patching, backups, DR drills, security monitoring and cost "
           f"management) cost {price.bnd(price.managed_monthly(1))} a month in Year 1. Cloud charges move with usage "
           "and exchange rates; they are recharged at the provider's cost without mark-up, or IIFT holds the account "
           f"and pays the provider directly. The one-off cloud set-up fee is {price.bnd(price.CLOUD_SETUP_FEE)}.")
    w.h2("Hybrid variant of Option A")
    w.para("The back-office, database and documents stay in the IITH data centre. Only the portal's web tier (static "
           "application and reverse proxy) sits in the DMZ or at a cloud edge and forwards API calls over an "
           "encrypted private link. Personal data never leaves the data centre. This suits IIFT if internet-facing "
           "capacity in the data centre is limited; it is priced as Option A, with any edge hosting at actuals.")
    w.h2("Comparison and recommendation")
    w.table(["Criterion", "A: On-premise", "B: iorta-hosted cloud", "Hybrid variant"], _comparison(),
            widths=[3.2, 4.6, 5.0, 4.2], font_size=8, bold_first_col=True, caption="Deployment models compared")
    w.callout("Recommendation: Option A, on-premise in the IITH/IIFT data centre", [
        "Participant and agent data stays in Brunei and no extra regulatory step is needed.",
        "IITH's existing data-centre services and operating model are reused, as for other group systems, which "
        "keeps cost and support effort down.",
        f"Option A has the lowest five-year cost (Section {sec('commercials')}). Option B remains available if IIFT "
        "prefers an operating-expense model with iorta running the infrastructure.",
    ])
