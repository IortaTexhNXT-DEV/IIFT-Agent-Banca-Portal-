"""Requirements compliance matrix – every requirement ID in the RFP.

Compliance codes:
    F = Fully Compliant           (standard capability of the delivered solution)
    C = Compliant – configuration (met by configuring rules, parameters or master data)
    X = Compliant – custom        (met by IIFT-specific development within the fixed price)

Priority codes follow RFP Appendix 4: M = Must Have, S = Should Have.
Commercial rows read their figures from pricing_data so they always match the
Commercial Proposal.
"""

import pricing_data as price

COMPLIANCE_LABELS = {
    "F": "Fully Compliant",
    "C": "Compliant – configuration",
    "X": "Compliant – custom",
}
PRIORITY_LABELS = {"M": "Must", "S": "Should"}


def _b(amount) -> str:
    return f"B${amount:,.0f}"

# (group title, [(id, requirement, priority, compliance, how addressed)])
MATRIX = [
    ("RFP 4.1 – Agent/Banca Portal functional requirements", [
        ("AP-01", "Secure login", "M", "F", "Username/password with Argon2id hashing, rate-limited login, optional MFA, server-side sessions."),
        ("AP-02", "Password management", "M", "C", "Self-service change and reset; length, complexity, history (last 5) and 90-day expiry are parameters."),
        ("AP-03", "Session management", "M", "C", "15-min idle and 8-h absolute timeout, logout revokes server session, ID regenerated at login, single-session option."),
        ("AP-04", "Account lockout", "M", "C", "Lock after 5 failed attempts for 30 min (configurable); manual release by an administrator is audited."),
        ("AP-05", "View agent/banca profile", "M", "F", "My Profile page: personal, contact, agency/bank, licence, hierarchy and document status."),
        ("AP-06", "Maintain profile (approval)", "M", "F", "Profile change request with before/after values routed through maker-checker workflow."),
        ("AP-07", "Agent/banca registration", "M", "F", "Online registration wizard with AML/KYC data, document upload (IC copy, or passport copy for passport holders) and back-office approval."),
        ("AP-08", "Agent ID", "M", "C", "Unique agent/banca code produced on approval from a configurable numbering pattern."),
        ("AP-09", "Main/sub-agent relationships", "M", "F", "Hierarchy view of main agent, sub-agents and bank officers scoped to the user's position."),
        ("AP-10", "Agency/banca information", "M", "F", "Agency/bank details, branches, contacts and status shown on dashboard and profile."),
        ("AP-11", "Cross-agency participant sharing", "M", "X", "Single participant master with de-duplication by IC/registration no.; sharing governed by RBAC and policy rules."),
        ("AP-12", "Agency-wide participant visibility", "M", "X", "Consolidated participant 360 view (policies, payments, claims, interactions) for authorised roles."),
        ("AP-13", "Participant registration", "M", "F", "Individual and corporate participant forms with validation and duplicate check."),
        ("AP-14", "Participant search", "M", "C", "Search by name, IC/passport (blind index), phone, policy no.; criteria configurable."),
        ("AP-15", "Participant maintenance (approval)", "M", "F", "Update requests go through maker-checker; approved values applied with audit history."),
        ("AP-16", "AML screening", "M", "X", "Screening on registration and update via AML adapter; hits routed to compliance review queue."),
        ("AP-17", "Product selection", "M", "C", "Product catalogue from configuration showing products the agent/bank is authorised to sell."),
        ("AP-18", "New quotation", "M", "X", "Product-specific quotation wizard for all seven Appendix 3 products."),
        ("AP-19", "Automatic contribution calculation", "M", "X", "Rating engines per product using configurable rate tables supplied by IIFT actuarial."),
        ("AP-20", "Draft quotation", "M", "F", "Quotations saved as DRAFT at any step and resumed later."),
        ("AP-21", "Policy status", "M", "F", "Draft, Pending Approval, Pending Payment, Active, Rejected, Expired and Cancelled statuses."),
        ("AP-22", "Policy listing", "M", "F", "Paginated policy list with status chips, scoped to agent, agency or bank."),
        ("AP-23", "Policy search", "M", "C", "Filter by policy no., participant, product, status, date range; criteria configurable."),
        ("AP-24", "Policy details", "M", "F", "Coverage, participant, nominees, contribution, payment status, documents and history."),
        ("AP-25", "Policy issuance", "M", "F", "Submit eligible quotation for issuance after validation; e-Policy produced on approval/payment."),
        ("AP-26", "Policy renewal", "M", "C", "Renewal-due list and one-click renewal quotation inside the renewal window (notice period before expiry to 30 days after); renewal enable/disable per product (e.g. Khairat)."),
        ("AP-27", "Policy endorsement", "M", "F", "Endorsement request with change details and documents, subject to approval rules."),
        ("AP-28", "Policy cancellation", "M", "F", "Cancellation request with reason and supporting documents, subject to approval."),
        ("AP-29", "Policy documents", "M", "F", "View/download e-Policy, schedule, receipts, certificates and correspondence."),
        ("AP-30", "Payment status", "M", "F", "Payment status and outstanding amount shown on policy and billing screens."),
        ("AP-31", "Policy history", "S", "F", "Timeline of every transaction and status change with user and timestamp."),
        ("AP-32", "Policy validation", "M", "C", "Server-side rules for product, eligibility, documents, payment and AML before submission."),
        ("AP-33", "Approval workflow", "M", "C", "Transactions needing approval routed by workflow definition to authorised checkers."),
        ("AP-34", "Notifications", "S", "C", "In-portal, email and SMS notifications for issuance, approval, rejection, expiry and renewal."),
        ("AP-35", "Audit trail", "M", "F", "Append-only audit of policy creation, updates and approvals with before/after values."),
        ("AP-36", "Policy restrictions", "M", "C", "Issuance blocked when payment, AML or document requirements are not met."),
        ("AP-37", "Payment dashboard", "M", "F", "Billing dashboard with collected, outstanding and overdue amounts and ageing."),
        ("AP-38", "Bulk payment (per policy)", "M", "F", "Single or bulk payment submission with amounts allocated per policy."),
        ("AP-39", "Upload payment proof", "M", "F", "Upload bank slip / transfer evidence against one or many policies."),
        ("AP-40", "Payment verification", "M", "F", "Payment proof routed to Finance for verification (approve/reject with remarks)."),
        ("AP-41", "Receipt generation", "M", "F", "PDF e-Receipt with unique number produced on approval and e-mailed."),
        ("AP-42", "Payment rules (7-day grace, agency block)", "M", "C", "Daily job blocks all agents of an agency when any policy is unpaid > 7 days; auto-lifted on settlement."),
        ("AP-43", "Claims notification", "M", "F", "Claim notification: validate policy, capture details, upload documents, submit to IIFT."),
        ("AP-44", "Policy schedule / receipt", "M", "F", "Branded PDF policy schedule and receipt produced after issuance."),
        ("AP-45", "Document download / e-mail", "M", "F", "Download and e-mail documents to participant from the portal."),
        ("AP-46", "Document upload", "M", "F", "Upload during registration and maintenance with type allow-list, size limit, checksum and ClamAV malware scan (mandatory in production)."),
        ("AP-47", "Document status", "S", "F", "Document status, validity and expiry dates displayed with reminders."),
        ("AP-48", "AML information", "M", "C", "AML/KYC fields captured in onboarding (configurable questionnaire)."),
        ("AP-49", "Application submission", "M", "F", "Save, submit and track applications and requests."),
        ("AP-50", "Application status", "M", "F", "Draft, Submitted, Pending Approval, Approved, Rejected and Completed statuses."),
        ("AP-51", "Rejection remarks", "M", "F", "Rejection reasons displayed; maker can amend and resubmit."),
        ("AP-52", "Agent dashboard", "M", "F", "Dashboard with profile, applications, pending actions, production and payments."),
        ("AP-53", "Pending actions", "M", "F", "Action list of incomplete drafts, rejected items, overdue payments and expiring documents."),
        ("AP-54", "Notifications (applications)", "S", "C", "Notification templates per workflow event; channels configurable."),
        ("AP-55", "Report issue", "M", "F", "Issue form with category, priority, description and attachments."),
        ("AP-56", "Issue tracking", "M", "F", "Unique issue reference and status tracking with comments."),
        ("AP-57", "Issue attachment", "S", "F", "Screenshots, documents and evidence attached to issues."),
        ("AP-58", "Agency/agent/banca reports", "S", "C", "Role-scoped reports (production, payments, renewals) with export."),
        ("AP-59", "Role-based access", "M", "C", "Permissions by agent type, hierarchy and role; data scoping enforced in the API."),
        ("AP-60", "Authority limit", "M", "C", "Financing above B$150,000 is referred to IIFT Sales; further thresholds per product and role are configurable."),
        ("AP-61", "Approval history", "M", "F", "Approval actions with remarks retained and displayed; immutable audit."),
        ("AP-62", "Electronic signature", "M", "X", "On-screen signature by agent or participant, signature by single-use e-mail link, or upload of signed documents."),
    ]),
    ("RFP 4.2 – Back-office (Admin) functional requirements", [
        ("BO-01", "Secure login", "M", "F", "Internal login with optional AD/LDAP SSO and MFA (email OTP / TOTP)."),
        ("BO-02", "Role-based access control", "M", "C", "Roles, permissions and data scopes configured by administrators."),
        ("BO-03", "User administration", "M", "F", "Create, update, deactivate and reset back-office users and release lockouts; changes audited."),
        ("BO-04", "Role & permission management", "M", "C", "Role builder with fine-grained permissions grouped by module; maker-checker optional."),
        ("BO-05", "Agent administration", "M", "F", "Create, view, update, activate, suspend and terminate agent records."),
        ("BO-06", "Agent search", "M", "C", "Search by agent/banca ID, name, agency/bank, status and configurable criteria."),
        ("BO-07", "Agent status", "M", "F", "Pending, Active, Inactive, Suspended and Terminated with controlled transitions."),
        ("BO-08", "Main/sub-agent management", "M", "F", "Maintain hierarchy (agency → main agent → sub-agent / bank → branch → officer)."),
        ("BO-09", "Agency administration", "M", "F", "Maintain agency/bank details, branches, contacts and associated agents."),
        ("BO-10", "Agent approval (maker-checker)", "M", "C", "Registration and profile changes approved through configurable workflow levels."),
        ("BO-11", "Agent documents", "M", "F", "View, validate, approve, reject and manage agent documents."),
        ("BO-12", "Document validation", "S", "C", "Mandatory document checklist per entity type; expiry tracking and reminders."),
        ("BO-13", "AML screening", "M", "X", "Watch-list screening with fuzzy name matching for agents and participants; manual re-screen."),
        ("BO-14", "AML status", "M", "F", "Screening result, score, status, reviewer and dates recorded and displayed."),
        ("BO-15", "Compliance review", "M", "F", "Compliance queue to clear, escalate or reject flagged cases with remarks; a confirmed match rejects the subject's pending approval requests."),
        ("BO-16", "Approval workflow", "M", "C", "Configurable levels and amount thresholds per transaction type (e.g. second approval from B$300,000 sum covered)."),
        ("BO-17", "Maker-checker", "M", "F", "Server-side rule: maker cannot approve own transaction; enforced for every workflow."),
        ("BO-18", "Workflow status", "M", "F", "Tracking of every request through Submitted, Pending, Approved, Rejected, Completed."),
        ("BO-19", "Rejection & remarks", "M", "F", "Mandatory remarks on rejection; visible to maker and in audit."),
        ("BO-20", "Management dashboard", "S", "F", "KPIs, trends, production by product/channel, outstanding actions and SLA."),
        ("BO-21", "Pending action dashboard", "M", "F", "Approvals inbox, incomplete applications and outstanding actions per user/role."),
        ("BO-22", "Standard reports", "M", "X", "12 standard reports in the working application; remaining IIFT reports added from the catalogue agreed in design."),
        ("BO-23", "Report filtering", "M", "F", "Filters by date, agent, agency/bank, product, status and other criteria."),
        ("BO-24", "Report export", "M", "F", "Export to Excel, CSV and PDF."),
        ("BO-25", "Scheduled reports", "S", "C", "Report schedules (daily/weekly/monthly) e-mailed to authorised recipients."),
        ("BO-26", "Audit trail", "M", "F", "Records user activities, transactions, approvals, rejections and system events."),
        ("BO-27", "Change history", "M", "F", "Previous and new values, user, date/time and IP retained for critical changes."),
        ("BO-28", "Audit search", "M", "F", "Audit search by user, entity, action and date with export for authorised roles."),
        ("BO-29", "Issue assignment", "M", "C", "Assignment to support personnel or teams with assignment rules."),
        ("BO-30", "Issue priority", "M", "C", "Critical, High, Medium, Low priorities (configurable)."),
        ("BO-31", "Issue SLA monitoring", "S", "C", "Response/resolution timers per priority with breach alerts and SLA report."),
        ("BO-32", "Master data management", "M", "F", "Maintain products, plans, rates, branches, banks, occupations, document types, reasons, etc."),
        ("BO-33", "System configuration", "M", "C", "Business rules, statuses, approval levels and parameters maintainable without redevelopment."),
    ]),
    ("RFP 4.3 – Integration functional requirements", [
        ("INT-01", "Core system integration", "M", "X", "Core system adapter to retrieve/update agent and policy information per interface specification."),
        ("INT-02", "Agent/banca master data synchronisation", "M", "X", "Scheduled and event-driven synchronisation of agent, agency, bank and status data."),
        ("INT-03", "Agent information exchange", "M", "X", "Agent-related events exchanged between portal, back-office and core via outbox."),
        ("INT-04", "Financial system integration", "M", "X", "EOD postings, receipts and commission data exchanged with FIN."),
        ("INT-05", "Commission / referral fee information", "M", "X", "Commission/referral statements retrieved from FIN and shown to authorised agents."),
        ("INT-06", "Enterprise authentication", "S", "X", "LDAP/Active Directory SSO for back-office; SAML/OIDC possible if IITH IdP exists."),
        ("INT-07", "Email integration", "S", "C", "SMTP relay integration with TLS; templates configurable."),
        ("INT-08", "SMS integration", "S", "X", "SMS gateway adapter for OTP and alerts via IIFT-approved provider."),
        ("INT-09", "API gateway / API services", "M", "F", "Versioned REST APIs (OpenAPI 3) exposed and consumed through the integration layer."),
        ("INT-10", "API security", "M", "F", "Mutual TLS or API keys/OAuth2 client credentials, RBAC, input validation, rate limiting."),
        ("INT-11", "API monitoring", "S", "F", "Integration monitor with availability, volumes, failures and response times; metrics endpoint."),
        ("INT-12", "Data validation", "M", "F", "Schema validation of inbound and outbound payloads; rejects logged with reason."),
        ("INT-13", "Error handling & retry", "M", "F", "Transactional outbox, exponential back-off retry, dead-letter and alerting."),
        ("INT-14", "Integration logging", "M", "F", "Every attempt logged with correlation id, status, duration and payload hash."),
        ("INT-15", "Data reconciliation", "S", "F", "Receipt reconciliation in the working application; BRR and Core reconciliation added during implementation."),
    ]),
    ("RFP 4.4 – Shared / common platform requirements", [
        ("COM-01", "Sensitive data protection", "M", "F", "TLS 1.2+, AES-256-GCM field encryption for IC/passport, masking, encrypted storage."),
        ("COM-02", "Access control", "M", "F", "Least-privilege RBAC with data scoping by agency/bank/hierarchy."),
        ("COM-03", "Comprehensive audit", "M", "F", "Common append-only audit service used by all modules."),
        ("COM-04", "Configurable workflow", "M", "C", "Workflow definitions by transaction type, role, level and business rule."),
        ("COM-05", "Notification framework", "S", "F", "Common notification service for email, SMS and in-portal channels with templates."),
        ("COM-06", "Document repository", "M", "F", "Encrypted document store with metadata, versioning, checksum and access control."),
        ("COM-07", "Global search", "S", "F", "Global search across participants, policies, agents and requests for authorised users."),
        ("COM-08", "Reporting framework", "M", "F", "Common report engine with filters, scheduling and Excel/CSV/PDF export."),
        ("COM-09", "Parameter management", "M", "C", "System parameters and master data maintained in the back-office without code change."),
        ("COM-10", "Data encryption", "M", "F", "Encryption in transit (TLS) and at rest (volume/DB/object storage + field level)."),
    ]),
    ("RFP 5 – Non-functional requirements", [
        ("NFR-01", "Response time", "M", "F", "Targets: page < 3 s, standard API p95 < 1 s, reports < 10 s for 12 months of data."),
        ("NFR-02", "Concurrent users", "M", "F", "Sized for 100 concurrent / 500 named users against 26 named users in Appendix 1."),
        ("NFR-03", "Transaction volume", "M", "F", "Sized for > 10x the Appendix 2 five-year projection (~628 policies per year)."),
        ("NFR-04", "System availability", "M", "F", "99.5% overall, 99.9% during IIFT business hours, excluding approved maintenance."),
        ("NFR-05", "High availability", "S", "F", "Two application nodes, PostgreSQL primary + standby, redundant load balancer."),
        ("NFR-06", "User scalability", "M", "F", "Stateless API nodes scale horizontally; no per-user licences."),
        ("NFR-07", "Transaction scalability", "M", "F", "Indexed relational model, partition-ready audit tables, archival policy."),
        ("NFR-08", "Encryption", "M", "F", "TLS 1.2+ in transit; encrypted volumes, backups and field-level encryption at rest."),
        ("NFR-09", "Authentication", "M", "C", "Password policy, lockout, MFA and AD integration aligned to IITH security policy."),
        ("NFR-10", "Authorisation", "M", "F", "Least privilege RBAC with deny-by-default API guards."),
        ("NFR-11", "Audit logging", "M", "C", "Security and business events logged; retention period configurable (default 7 years)."),
        ("NFR-12", "Vulnerability management", "M", "F", "CodeQL static analysis, dependency audit, secret and container scanning in CI; remediation within severity-based timelines."),
        ("NFR-13", "Penetration testing", "M", "F", "Independent VAPT before go-live with remediation and re-test (included in price)."),
        ("NFR-14", "Secure development", "M", "F", "OWASP ASVS Level 2 aligned SDLC, OWASP Top 10 controls, peer review."),
        ("NFR-15", "Error handling", "M", "F", "Generic user messages with correlation id; no stack traces or internals exposed."),
        ("NFR-16", "Transaction integrity", "M", "F", "ACID transactions in PostgreSQL; issuance, receipt, audit and outbox commit atomically."),
        ("NFR-17", "Data backup", "M", "F", "Daily full backup, continuous WAL archiving (PITR), configuration backup, restore tests."),
        ("NFR-18", "DR capability", "M", "F", "Warm standby DR with RPO ≤ 15 min and RTO ≤ 4 h."),
        ("NFR-19", "DR testing", "M", "F", "Annual DR test with IIFT, documented results and improvement actions."),
        ("NFR-20", "Modular architecture", "S", "F", "Modular monolith with module boundaries per functional area; modules can be split later."),
        ("NFR-21", "Documentation", "M", "F", "Technical, configuration, operations and user documentation maintained for 5 years."),
        ("NFR-22", "User interface", "M", "F", "Consistent Ant Design based UI themed to Insurans Islam TAIB branding."),
        ("NFR-23", "Browser compatibility", "M", "F", "Current and previous major versions of Chrome, Edge, Firefox and Safari."),
        ("NFR-24", "Accessibility", "S", "F", "Designed to WCAG 2.1 AA (keyboard navigation, contrast, labels)."),
        ("NFR-25", "API standards", "M", "F", "REST/JSON over HTTPS, OpenAPI 3 contracts, ISO 8601 dates, UTF-8."),
        ("NFR-26", "System monitoring", "M", "F", "Health endpoints, Prometheus metrics, integration monitor and infrastructure checks."),
        ("NFR-27", "Alerting", "M", "F", "Alert rules for availability, errors, latency, job failures and dead-letters to support teams."),
        ("NFR-28", "Centralised logs", "S", "F", "Structured JSON logs with correlation id shipped to central log store."),
        ("NFR-29", "Data retention", "M", "C", "Retention and archival rules per data class, configurable to IIFT policy."),
        ("NFR-30", "Data quality", "M", "F", "Validation on every DTO plus database constraints (FK, CHECK, UNIQUE)."),
    ]),
    ("RFP 6 – Commercial requirements", [
        ("COM-01", "Implementation cost", "M", "F", f"Fixed implementation price: Option A {_b(price.one_time_total('A'))} (licence {_b(price.licence_fee())}, services {_b(price.services_fee())}); Option B {_b(price.option_b_one_time())} (services {_b(price.services_fee())}, cloud set-up {_b(price.CLOUD_SETUP_FEE)})."),
        ("COM-02", "Software licence", "M", "F", f"Option A: perpetual, non-exclusive enterprise licence for IIFT, unlimited named users, all environments, {_b(price.licence_fee())} one-off, no renewal fee. Option B: right to use within the subscription."),
        ("COM-03", "Subscription", "M", "F", f"Option B: subscription {_b(price.subscription_monthly(1))} a month and managed services {_b(price.managed_monthly(1))} a month in Year 1 (+5% a year), minimum term {price.SUBSCRIPTION_MINIMUM_MONTHS} months; cloud recharged at cost. Option A has no subscription."),
        ("COM-04", "Infrastructure", "M", "F", f"Option A: IIFT procures to iorta's sizing (BOM, indicative {_b(price.bom_onprem_totals()[0])}–{price.bom_onprem_totals()[1]:,}). Option B: one-off cloud set-up {_b(price.CLOUD_SETUP_FEE)}; cloud recharged at cost, about {_b(price.cloud_monthly())} a month, or paid by IIFT directly. PostgreSQL B$0; third-party costs in the BOM."),
        ("COM-05", "Integration cost", "M", "F", f"Cost per interface itemised (six interfaces, {_b(price.item_total('integration'))})."),
        ("COM-06", "Implementation services", "M", "F", f"PM, BA, design, configuration, customisation and deployment: {_b(price.item_total('implementation'))} (item 2)."),
        ("COM-07", "Data migration", "M", "F", f"Scope, assumptions, tools and cost ({_b(price.item_total('migration'))}) stated."),
        ("COM-08", "Testing", "M", "F", f"SIT, UAT support and performance testing ({_b(price.item_total('testing'))}) and security testing ({_b(price.item_total('security'))}) itemised."),
        ("COM-09", "Training", "M", "F", f"User, administrator and technical training included ({_b(price.item_total('training'))})."),
        ("COM-10", "Documentation", "M", "F", f"Preparation and maintenance of documentation included ({_b(price.item_total('documentation'))})."),
        ("COM-11", "Warranty period", "M", "F", f"{price.WARRANTY_MONTHS} months from production go-live under both options, included."),
        ("COM-12", "5-year maintenance", "M", "F", f"Detailed five-year plan. Option A AMC {_b(price.amc(1))} in Year 1 (22% of licence and customisation, +5% a year; {_b(price.amc_total())} over five years). Option B: included in the subscription."),
        ("COM-13", "Service level agreement", "M", "F", "Response, restoration and availability targets committed (Maintenance and Support chapter)."),
        ("COM-14", "Support hours", "M", "F", "Aligned to IIFT business hours with 24x7 for P1 incidents."),
        ("COM-15", "Critical incident escalation", "M", "F", "Four-level escalation matrix with time-based triggers."),
        ("COM-16", "Change request", "M", "F", f"Rate card ({_b(price.ENHANCEMENT_DAY_RATE)} per man-day, {_b(price.ENHANCEMENT_HOUR_RATE)} per hour in Year 1, +5% a year) and formal CR process."),
        ("COM-17", "Third-party dependencies", "M", "F", "All third-party products, licences, services and infrastructure disclosed in the Bill of Materials (Annex C and BOM workbook); runtime components open source, B$0; SBOM with every build."),
        ("COM-18", "Annual increase", "S", "F", "AMC, subscription, managed services and rate card rise 5% a year, capped at 5%. Cloud and third-party items at actual cost."),
        ("COM-19", "Exit assistance", "M", "F", "Transition, data extraction in open formats and knowledge transfer included in Year 5, at the end of the subscription or on termination."),
        ("COM-20", "IP ownership", "M", "F", "SalesVerse 2.0 core remains iorta IP (perpetual licence under Option A, right to use under Option B); IIFT-specific configuration, reports, documentation and data belong to IIFT."),
        ("COM-21", "Source code", "S", "F", f"Source code of IIFT-specific components delivered under every option (DEL-11); core platform source via Option C ({_b(price.option_c_total())} with {price.KNOWLEDGE_TRANSFER_WEEKS}-week knowledge transfer) or escrow."),
        ("COM-22", "Data ownership", "M", "F", "All business data remains the property of IITH/IIGT/IIFT."),
        ("COM-23", "Vendor liability", "M", "F", "Responsibilities, liability and service credits defined in Terms and Conditions."),
        ("COM-24", "Vendor BCP", "M", "F", "iorta business continuity arrangements: code repositories, backup staff, remote support."),
    ]),
    ("RFP 7 – Project deliverables", [
        ("DEL-01", "Project charter", "M", "F", "Week 2: objectives, scope, governance, stakeholders, assumptions, milestones."),
        ("DEL-02", "Project plan", "M", "F", "Week 2: activities, dependencies, resources, timeline; updated fortnightly."),
        ("DEL-03", "Business requirement specification", "M", "F", "Week 4: agreed business requirements and processes (as-is / to-be)."),
        ("DEL-04", "Functional requirement specification", "M", "F", "Week 5: detailed functional behaviour, rules, screens and reports."),
        ("DEL-05", "Requirements traceability matrix", "M", "F", "Week 6, maintained to closure: requirement → design → build → test → acceptance."),
        ("DEL-06", "Solution architecture", "M", "F", "Week 6: application, infrastructure, security, integration and deployment architecture."),
        ("DEL-07", "Technical design", "M", "F", "Week 6: components, database, APIs, interfaces and configuration."),
        ("DEL-08", "UI/UX design", "M", "F", "Week 5: clickable screen designs, navigation and user journeys."),
        ("DEL-09", "Interface specification", "M", "F", "Week 6: APIs, data mappings, methods, security and error handling per interface."),
        ("DEL-10", "Configured solution", "M", "F", "Week 16: complete portal and back-office, demonstrated sprint by sprint."),
        ("DEL-11", "Source code", "M", "F", "Week 24 and every release, all options: source code of IIFT-specific components (configuration, adapters, reports, templates), build scripts and migrations. Core platform via Option C or escrow."),
        ("DEL-12", "Test strategy", "M", "F", "Week 6: levels, responsibilities, environments, entry/exit and acceptance criteria."),
        ("DEL-13", "SIT test cases", "M", "F", "Week 14: scenarios and expected results traced to requirements."),
        ("DEL-14", "SIT results", "M", "F", "Week 19: execution evidence, defect log and closure."),
        ("DEL-15", "UAT test cases", "M", "F", "Week 18: business scenarios prepared with IIFT users."),
        ("DEL-16", "UAT results", "M", "F", "Week 22: execution evidence and business sign-off."),
        ("DEL-17", "Security assessment", "M", "F", "Week 19: VAPT report, remediation evidence and re-test results."),
        ("DEL-18", "Performance test report", "M", "F", "Week 19: load, stress and soak results against NFR targets."),
        ("DEL-19", "Data migration plan", "M", "F", "Week 8: extraction, transformation, validation, migration and reconciliation."),
        ("DEL-20", "Deployment plan", "M", "F", "Week 21: deployment sequence, responsibilities, rollback and contingency."),
        ("DEL-21", "Go-live checklist", "M", "F", "Week 23: technical, operational, security, business and support readiness."),
        ("DEL-22", "User training", "M", "F", "Weeks 21–23: agents, banca officers, back-office users and stakeholders."),
        ("DEL-23", "Administrator training", "M", "F", "Weeks 22–23: system administrators and support personnel."),
        ("DEL-24", "User manual", "M", "F", "Week 21: portal and back-office user guides with screenshots."),
        ("DEL-25", "Administrator manual", "M", "F", "Week 21: configuration, user administration and operational support."),
        ("DEL-26", "Technical manual", "M", "F", "Week 23: architecture, database, API, integration and deployment."),
        ("DEL-27", "Operations manual", "M", "F", "Week 23: monitoring, backup, incident handling and routine operations."),
        ("DEL-28", "Production deployment", "M", "F", "Week 24: production deployment per approved deployment plan."),
        ("DEL-29", "Go-live support", "M", "F", "Weeks 25–28: hypercare with daily checks and priority defect fixing."),
        ("DEL-30", "Project closure report", "M", "F", "Week 28: final status, outstanding items, lessons learned, formal acceptance."),
    ]),
    ("RFP 8 – Five-year maintenance & support requirements", [
        ("MNT-01", "Helpdesk support", "M", "F", "Service desk via portal issue module, e-mail and phone for five years."),
        ("MNT-02", "Incident management", "M", "F", "Record, classify, investigate, resolve and close incidents per ITIL-aligned procedure."),
        ("MNT-03", "Problem management", "M", "F", "Root-cause analysis for P1/P2 and recurring incidents with corrective actions."),
        ("MNT-04", "Service request", "M", "F", "User support, configuration and operational assistance requests handled."),
        ("MNT-05", "Critical incident SLA", "M", "F", "P1: 30-min response, 4-h restoration, 24x7, immediate escalation."),
        ("MNT-06", "High-priority SLA", "M", "F", "P2: 2-h response, resolution within 1 business day."),
        ("MNT-07", "Medium/Low/Cosmetic SLA", "M", "F", "P3: 4 business hours / 3 business days; P4: 1 business day / next release."),
        ("MNT-08", "Bug fixing", "M", "F", "Defects fixed under warranty (6 months) and maintenance thereafter."),
        ("MNT-09", "Corrective maintenance", "M", "F", "Corrective changes to maintain functionality included."),
        ("MNT-10", "Preventive maintenance", "S", "F", "Monthly health checks, log and capacity review, proactive fixes."),
        ("MNT-11", "Security patches", "M", "F", "Application, framework and dependency patches; monthly cycle, emergency as needed."),
        ("MNT-12", "Vulnerability remediation", "M", "F", "Critical ≤ 7 days, High ≤ 14 days, Medium ≤ 30 days, Low ≤ 90 days."),
        ("MNT-13", "Certificate management", "M", "F", "Certificate inventory, expiry alerts and renewal support."),
        ("MNT-14", "OS/platform compatibility", "M", "F", "Compatibility with supported OS, container runtime, Node.js and PostgreSQL versions."),
        ("MNT-15", "Browser compatibility", "M", "F", "Compatibility maintained with supported browser versions."),
        ("MNT-16", "Database maintenance", "M", "F", "Health checks, vacuum/index optimisation, query tuning, upgrade support."),
        ("MNT-17", "Performance monitoring", "S", "F", "Monthly performance review and optimisation recommendations."),
        ("MNT-18", "System monitoring", "M", "F", "Availability and critical component monitoring with alerting."),
        ("MNT-19", "Backup verification", "M", "F", "Quarterly restore test and backup job verification."),
        ("MNT-20", "Disaster recovery", "M", "F", "Participation in DR planning and annual DR test."),
        ("MNT-21", "Release management", "M", "F", "Releases follow agreed testing, CAB approval and deployment procedures."),
        ("MNT-22", "Version upgrade", "M", "F", "Application and platform upgrades during the maintenance period included."),
        ("MNT-23", "Minor enhancement", "S", "F", "60 hours per year of minor enhancements included; beyond that per rate card."),
        ("MNT-24", "Change request", "M", "F", "Formal CR: impact assessment, quotation, approval, delivery."),
        ("MNT-25", "Monthly service report", "M", "F", "Incidents, SLA performance, availability, changes and outstanding issues."),
        ("MNT-26", "Quarterly review", "S", "F", "Quarterly service review with improvement plan."),
        ("MNT-27", "Documentation updates", "M", "F", "System, technical and operational documents updated after material changes."),
        ("MNT-28", "Knowledge transfer", "M", "F", "Ongoing knowledge transfer sessions to IIFT/IITH support staff."),
        ("MNT-29", "Onsite support", "S", "F", "Onsite support for major incidents or upgrades at the rate card plus OPE; planned onsite phases per the OPE schedule."),
        ("MNT-30", "Transition support", "M", "F", "Year 5 knowledge transfer, documentation and technical assistance for transition."),
    ]),
]


def all_rows():
    for _, rows in MATRIX:
        yield from rows


def summary_counts():
    """Return {compliance_code: count} and total, for the summary table."""
    counts = {code: 0 for code in COMPLIANCE_LABELS}
    for row in all_rows():
        counts[row[3]] += 1
    return counts, sum(counts.values())


# ---------------------------------------------------------------------------
# Fitment: where each requirement stands against SalesVerse 2.0 today.
#   A = Available in SalesVerse 2.0 today
#   C = Configuration (IIFT values, rates, templates or rules loaded)
#   I = Integration with IIFT systems (adapter needs IIFT endpoints to complete)
#   D = Delivered during implementation (or, for MNT, during maintenance)
# Commercial requirements (RFP section 6) are contractual commitments and have
# no fitment; they are answered in the Commercial Proposal.
# ---------------------------------------------------------------------------
FITMENT_LABELS = {
    "A": "Available today",
    "C": "Configuration",
    "I": "Integration with IIFT systems",
    "D": "Delivered during implementation",
}
FITMENT_HEADINGS = {
    "A": "Available in SalesVerse 2.0 today",
    "C": "Configuration",
    "I": "Integration with IIFT systems",
    "D": "Delivered during implementation",
}

# Default fitment per matrix group (index into MATRIX), then per-ID overrides.
_GROUP_DEFAULT = {0: "A", 1: "A", 2: "A", 3: "A", 4: "A", 5: None, 6: "D", 7: "D"}
_OVERRIDES = {
    "C": ["AP-02", "AP-03", "AP-04", "AP-08", "AP-17", "AP-19", "AP-26", "AP-34", "AP-48", "AP-54", "AP-58",
          "AP-59", "BO-10", "BO-12", "BO-16", "BO-30", "BO-31", "BO-33", "COM-04", "COM-09", "NFR-29"],
    "I": ["AP-45", "INT-01", "INT-02", "INT-03", "INT-04", "INT-05", "INT-06", "INT-07", "INT-08", "INT-15"],
    "D": ["NFR-01", "NFR-02", "NFR-04", "NFR-05", "NFR-09", "NFR-13", "NFR-17", "NFR-18", "NFR-19",
          "NFR-21", "NFR-24", "NFR-26", "NFR-27", "NFR-28"],
}
_OVERRIDE_BY_ID = {rid: code for code, ids in _OVERRIDES.items() for rid in ids}


def fitment(group_index: int, rid: str):
    """Fitment code for a requirement, or None for commercial requirements."""
    default = _GROUP_DEFAULT[group_index]
    if default is None:
        return None
    return _OVERRIDE_BY_ID.get(rid, default)


def fitment_summary():
    """[(group title, {code: count}, total)] for every group that has fitment."""
    summary = []
    for index, (title, rows) in enumerate(MATRIX):
        if _GROUP_DEFAULT[index] is None:
            continue
        counts = {code: 0 for code in FITMENT_LABELS}
        for row in rows:
            counts[fitment(index, row[0])] += 1
        summary.append((title, counts, len(rows)))
    return summary
