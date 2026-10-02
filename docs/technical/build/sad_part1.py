"""Solution Architecture, chapters 1 to 6: purpose, principles, context, functional,
application and data architecture."""

import re

import source_facts as facts
import schema_model
import dictionary_text
from tech_kit import PRODUCT, brand

STATUS_TODAY = [
    ["Agent/Banca Portal and Back-office web application (React SPA)", "Running", "–"],
    ["REST API with all functional modules listed in chapter 4", "Running", "–"],
    ["PostgreSQL schema, migrations, reference data and demonstration data", "Running", "–"],
    ["Sessions, CSRF, Argon2id, lockout, RBAC, data scoping, maker-checker", "Running", "–"],
    ["Field-level and document encryption, append-only audit trigger", "Running", "–"],
    ["Transactional outbox, retry, dead-letter, integration monitor, reconciliation", "Running", "–"],
    ["Core, FIN, AML, SMS, SMTP and LDAP adapters", "Running in simulated mode",
     "Endpoint mapping and payload formats agreed in the interface specification (DEL-09)"],
    ["Container images, nginx web tier, Docker Compose, CI pipeline with CodeQL, secret scan, dependency and image "
     "scans and SBOM", "Running", "Image signing, registry push and CD stages to SIT, UAT and PROD"],
    ["Health endpoints and Prometheus metrics", "Running", "Dashboards, alert rules, log shipping and SIEM "
     "forwarding"],
    ["Multi-factor authentication for back-office users", "–", "Delivered during implementation"],
    ["PostgreSQL streaming replication, pgBackRest backups, DR site", "–", "Delivered during implementation"],
    ["Data retention and archival job; key rotation tooling", "–", "Delivered during implementation"],
    ["Maker-checker approval for product and rate changes", "Two-person check (manual)",
     "Delivered during implementation"],
    ["S3-compatible document storage adapter (only if object storage is chosen)", "–",
     "Delivered during implementation"],
    ["IIFT actuarial rates, wakalah and tabarru' parameters", "Indicative values loaded",
     "IIFT values loaded and verified in design and SIT"],
    ["Legacy data migration", "–", "Delivered during implementation (DEL-19)"],
    ["Independent VAPT and re-test", "–", "Before go-live (DEL-17)"],
]

PRINCIPLES = [
    ["One system of record", "Every business fact lives in PostgreSQL; external systems receive copies through the "
     "outbox.", "No dual writes; integrations are replayable; reconciliation compares against one source."],
    ["Modular monolith", "26 named users and about 600 policies a year do not justify microservices.",
     "One deployable unit; modules follow RFP areas and talk through services, so a module can be split out later "
     "(NFR-20)."],
    ["Server-side enforcement", "The browser is untrusted.", "Authentication, permissions, data scope, maker-checker "
     "and every business rule are enforced by the API; the SPA only hides what a user cannot do."],
    ["Atomic business transactions", "NFR-16 requires no partial updates.", "A business change, its audit row and its "
     "outbox message commit in one database transaction."],
    ["Configuration over code", "Rates, parameters, workflows and master data change more often than code.",
     "Products, parameters, roles, workflows and code lists are maintained in the back-office and audited."],
    ["Secure by default", "Regulated personal and financial data.", "Deny by default; encrypted identifiers; "
     "production start-up refuses insecure settings; generic errors with correlation id."],
    ["Operable", "IIFT and IITH must be able to run it.", "Standard containers, JSON logs, health and metrics "
     "endpoints, documented runbooks, open-source stack without licence fees."],
    ["Testable", "Changes must be safe to release.", "Unit and end-to-end tests against a real PostgreSQL database run "
     "in CI on every change."],
]

ACTORS = [
    ["Agents and main agents", "Person", "Agent/Banca Portal over HTTPS", "Quotations, participants, policies, payments, "
     "claims, issues, reports", "AP-01 to AP-62"],
    ["Bank officers and supervisors", "Person", "Agent/Banca Portal over HTTPS", "Financing takaful sales at bank "
     "branches; bank-wide view for supervisors", "AP-09, AP-59"],
    ["IIFT staff", "Person", "Back-office over HTTPS on the internal network", "Approvals, administration, compliance, "
     "finance, support, reporting", "BO-01 to BO-33"],
    ["Participants", "Person", "One-time e-signature page, e-mail", "Review and sign the application; receive "
     "documents", "AP-45, AP-62"],
    ["IITH core takaful system", "System", "REST/JSON both ways", "Agent, participant, policy, endorsement, "
     "cancellation and claim events out; agent status and issued-policy queries in", "INT-01 to INT-03, INT-09"],
    ["Financial system (FIN)", "System", "REST/JSON and EOD file", "Receipts, refunds, commission accruals and EOD "
     "postings out; posted receipts and commission payments in", "INT-04, INT-05, INT-15"],
    ["AML screening provider", "System (optional)", "REST/JSON", "Name and identifier screening in addition to "
     "Compliance watch-lists", "AP-16, BO-13"],
    ["SMTP relay", "System", "SMTP with STARTTLS", "Notifications, documents, e-signature links, scheduled reports",
     "INT-07"],
    ["SMS gateway", "System", "HTTPS API", "Short notifications (agency block, approvals)", "INT-08"],
    ["Active Directory / LDAP", "System", "LDAPS bind", "Back-office sign-in for directory accounts", "INT-06"],
]

MODULES = [
    ["Identity & access", "auth, access", "Sign-in, sessions, password policy and history, lockout, directory sign-in, "
     "users, roles, permissions", "AP-01 to AP-04, AP-59, BO-01 to BO-04, INT-06, COM-02"],
    ["Agency & agents", "agency", "Agencies and banks, agent registration and approval, hierarchy, status, authority "
     "limits, issuance block override", "AP-05 to AP-10, AP-42, BO-05 to BO-12"],
    ["Participants & AML", "participants, aml", "Shared participant master with duplicate check, update requests, "
     "watch-list screening, Compliance review", "AP-11 to AP-16, AP-48, BO-13 to BO-15"],
    ["Products & rating", "products", "Catalogue, FINANCING and FIXED_PLAN rating engines, required documents, "
     "questionnaires", "AP-17 to AP-19, BO-33"],
    ["Quotation & policy lifecycle", "policies", "Quotations, validation, referral, issuance, e-Policy, renewal, "
     "endorsement, cancellation, expiry, history", "AP-20 to AP-36, AP-44, AP-49 to AP-51, AP-60"],
    ["Billing & receipts", "billing", "Outstanding contributions, bulk payments with allocation, proof, verification, "
     "e-Receipts, commission, grace-period block", "AP-30, AP-37 to AP-42, INT-05"],
    ["Claims", "claims", "Claim notification with policy validation and documents; back-office status updates",
     "AP-43"],
    ["Documents & e-signature", "documents, esign", "Encrypted document store, upload checks, verification queue, PDF "
     "output, e-mail of documents, on-screen and link signatures", "AP-29, AP-39, AP-44 to AP-47, AP-62, BO-11, BO-12, "
     "COM-06"],
    ["Workflow / maker-checker", "workflow", "Workflow definitions, approval requests and actions, inbox, handlers",
     "AP-33, AP-49 to AP-51, AP-61, BO-10, BO-16 to BO-19, COM-04"],
    ["Issues", "issues", "Issue logging, comments, attachments, assignment, priority, SLA monitoring",
     "AP-55 to AP-57, BO-29 to BO-31"],
    ["Notifications", "notifications", "In-app, e-mail and SMS notifications with retry and delivery log",
     "AP-34, AP-54, INT-07, INT-08, COM-05"],
    ["Reporting", "reports", "Report catalogue, filters, preview, export (XLSX, CSV, PDF), schedules",
     "AP-58, BO-22 to BO-25, COM-08"],
    ["Dashboards", "dashboard", "Agent dashboard, pending actions, management KPIs", "AP-52, AP-53, BO-20, BO-21"],
    ["Audit", "audit", "Append-only audit trail, search and facets", "AP-35, BO-26 to BO-28, COM-03, NFR-11"],
    ["Configuration & master data", "settings", "Business parameters with ranges, code lists", "BO-32, BO-33, COM-09"],
    ["Integration & outbox", "integration, integration-api", "Outbox, dispatcher, gateways, integration log, "
     "monitor and retry, reconciliation, inbound system APIs", "INT-01 to INT-05, INT-09 to INT-15"],
    ["End-of-day", "eod", "EOD issuance report, FIN interface file, EOD posting, reconciliation, re-run",
     "Appendix 3 (FFR01-08 to FFR05-08), INT-04, INT-15"],
    ["Health & metrics", "health", "Liveness, readiness, Prometheus metrics", "NFR-26, NFR-27"],
]

JOBS = [
    ["end-of-day", "Daily 23:30 (EOD_CRON, JOBS_TIMEZONE)", "end-of-day", "EOD report, FIN file, EOD_POSTING "
     "message, receipt reconciliation", "eod/eod.service.ts"],
    ["policy-expiry", "Daily 00:05", "policy-expiry", "ACTIVE policies past end date become EXPIRED; agent notified",
     "policies/policy.jobs.ts"],
    ["payment-grace-period", "Daily 01:00", "payment-grace-period", "Blocks agencies with overdue issue-then-pay "
     "policies; lifts the block when settled", "billing/grace-period.service.ts"],
    ["outbox-dispatch", "Every 20 seconds", "outbox-dispatch", "Delivers up to 25 due outbox messages to Core and FIN",
     "integration/outbox.dispatcher.ts"],
    ["notification-dispatch", "Every 30 seconds", "notification-dispatch", "Sends up to 50 pending e-mail and SMS "
     "notifications", "notifications/notification.dispatcher.ts"],
    ["issue-sla-monitor", "Every 5 minutes", "issue-sla-monitor", "Flags issues past their response or resolution "
     "target and alerts support", "issues/issues.service.ts"],
    ["scheduled-reports", "Every 15 minutes", "scheduled-reports", "Runs due report schedules and e-mails the files",
     "reports/reports.service.ts"],
    ["session pruning", "Every 15 minutes", "none (idempotent)", "Deletes expired rows from user_session",
     "connect-pg-simple"],
]

WORKFLOWS = [
    ["AGENT_REGISTRATION", "Operations supervisor approval (bo.approve.agents)", "Agent ACTIVE, portal user and role "
     "created, AGENT_UPSERT to Core"],
    ["AGENT_PROFILE_UPDATE", "Operations supervisor approval", "Changes applied, AGENT_UPSERT to Core"],
    ["AGENT_STATUS_CHANGE", "Operations supervisor approval", "Status applied; sessions revoked when deactivated"],
    ["PARTICIPANT_UPDATE", "Operations supervisor approval (bo.approve.participants)", "Changes applied; re-screened "
     "on name change; PARTICIPANT_UPSERT to Core"],
    ["POLICY_REFERRAL", "Underwriting / quality check; second approval from sum covered B$300,000",
     "Policy proceeds to PENDING_PAYMENT or ACTIVE; rejection returns it with remarks"],
    ["POLICY_ENDORSEMENT", "Policy servicing approval (bo.approve.servicing)", "Endorsement applied, POLICY_ENDORSED"],
    ["POLICY_CANCELLATION", "Policy servicing approval", "CANCELLED, POLICY_CANCELLED, REFUND_REQUESTED when a refund "
     "is due"],
    ["PAYMENT_VERIFICATION", "Finance verification (bo.approve.payments)", "Receipts issued, RECEIPT_POSTED, pay-first "
     "policies issued"],
]

DB_COMPARISON = [
    ["Data shape", "Agency, agent, sub-agent; policy, participant, nominees, payments, receipts, claims: strongly "
     "relational", "Suits self-contained documents with few cross-references"],
    ["Transaction integrity (NFR-16)", "Issuance, receipt, audit and outbox commit in one ACID transaction",
     "Multi-document transactions exist but are not the natural model"],
    ["Financial accuracy", "Exact DECIMAL, foreign keys, CHECK and UNIQUE constraints in the database",
     "Decimal128; most integrity rules move into application code"],
    ["Reporting (BO-22 to BO-25)", "Joins and aggregates in SQL", "Aggregation pipelines with $lookup"],
    ["Flexible structures", "JSONB for product configuration, questionnaires, audit values, outbox payloads",
     "Native"],
    ["Operations", "Streaming replication, PITR, pgBackRest; managed service on AWS and Azure; skills common in IITH",
     "Replica sets; a second database skill set"],
    ["Licence", "PostgreSQL licence, no fee", "SSPL; some enterprise features paid"],
    ["Fit to volume", "Under 1 GB of rows after five years at Appendix 2 volumes", "Strength is very large schemaless "
     "data, not needed here"],
]

RETENTION = [
    ["Policies, quotations taken up, nominees, policy events", "7 years after policy end or cancellation",
     "Archive to read-only schema, then delete"],
    ["Quotations not taken up (DRAFT, REJECTED)", "2 years after last change", "Delete with documents"],
    ["Participants and AML screenings", "7 years after the last policy ends (AML/CFT record keeping)",
     "Archive, then delete"],
    ["Payments, receipts, commissions, EOD runs, FIN files", "7 years after the financial year", "Archive, then delete"],
    ["Audit log", "7 years online or in archive", "Controlled archive procedure (trigger blocks normal deletion)"],
    ["Integration log, delivered outbox messages", "2 years", "Delete"],
    ["Notifications", "1 year (sensitive bodies already removed after delivery)", "Delete"],
    ["Issues and comments", "3 years after closure", "Delete"],
    ["Sessions", "Until expiry", "Pruned every 15 minutes (running today)"],
]


def purpose(w, status_rows=STATUS_TODAY):
    w.h1("Purpose and Scope")
    w.h2("Purpose")
    w.para(f"This document describes the solution architecture of {PRODUCT} as configured for Insurans Islam Family "
           "Takaful Sendirian Berhad (IIFT) as the Agent/Banca Portal and Back-office. It explains how the solution is "
           "structured, how it handles data, integration and security, how it is deployed and sized, and why the main "
           "design decisions were taken. It is the Solution Architecture deliverable (DEL-06) and the reference for "
           "the Technical Design (DEL-07), the Interface Specification (DEL-09) and the deployment plan (DEL-20).")
    w.h2("Scope")
    w.table(["In scope", "Out of scope"], [[
        "Agent/Banca Portal for agents, main agents and bank officers\nBack-office for IIFT staff\nParticipant "
        "e-signature page\nREST API, database, document store, scheduled jobs\nIntegration with Core, FIN, AML "
        "provider, SMTP, SMS and Active Directory\nDeployment, sizing, security, monitoring and DR design",
        "Changes inside IITH core and financial systems\nClaims assessment and payment (core system)\nInfrastructure "
        "procurement and data-centre operation (IIFT/IITH)\nCommercial terms (see the proposal)"]],
        widths=[8.5, 8.5])
    w.h2("Audience")
    w.para("IIFT and IITH IT architecture, infrastructure, security and operations teams; the IIFT project team; "
           "iorta TechNXT engineering and support. Readers are assumed to know web applications and relational "
           "databases.")
    w.h2("Status of the solution")
    w.para(f"{PRODUCT} is a working application. The table separates what runs in the current build from what is "
           "completed during implementation, so that every statement in this document can be checked against the "
           "source code.")
    w.table(["Capability", "Today", "Implementation work"], status_rows, widths=[8.4, 3.6, 5.0], font_size=8,
            caption="Solution status at proposal submission")
    w.h2("Sources")
    w.bullets([
        "Source code: apps/api (NestJS API, Prisma schema and migrations), apps/web (React SPA), deploy (Docker "
        "Compose), .github/workflows (CI).",
        "docs/api/openapi.json: the API description produced from the code.",
        "IIFT Request for Proposal, including Appendix 1 (users), Appendix 2 (policy volumes) and Appendix 3 "
        "(product flows).",
        "Companion documents: Data Dictionary and Production Support Handover.",
    ])


def principles(w):
    w.h1("Architecture Principles")
    w.para("These principles guided every design decision recorded in chapter 13.")
    w.table(["Principle", "Rationale", "Implication"], PRINCIPLES, widths=[3.4, 5.6, 8.0], font_size=8.5,
            bold_first_col=True, caption="Architecture principles")


def context(w, figs):
    w.h1("System Context")
    w.para(f"{PRODUCT} sits between IIFT's distribution partners and the IITH group systems. Agents and bank officers "
           "work in the portal; IIFT staff work in the back-office on the internal network; participants only see a "
           "one-time e-signature page. The core and financial systems stay the systems of record for in-force "
           "business and accounting, and receive every relevant event from the portal.")
    w.figure(figs["context"], "System context", width_cm=16.5)
    w.table(["Actor or system", "Type", "Channel", "Interaction", "RFP"], ACTORS, widths=[3.4, 2.0, 3.2, 5.6, 2.8],
            font_size=8, caption="Actors and external systems")


def functional(w, figs):
    w.h1("Functional Architecture")
    w.para("The API is split into modules that follow the RFP functional areas. Each module owns its controllers, "
           "services, data-transfer objects and tests; shared concerns (database access, encryption, numbering, data "
           "scope, request context, error handling) live in apps/api/src/common.")
    w.figure(figs["module_map"], "Functional module map", width_cm=16.0)
    w.table(["Module", "Code", "Responsibilities", "RFP requirements"], MODULES, widths=[3.2, 2.6, 6.6, 4.6],
            font_size=8, bold_first_col=True, caption="Modules and the requirements they cover")
    w.h2("Policy lifecycle")
    w.para("A quotation and the policy it becomes are one record, so history, documents and payments stay attached "
           "from first quote to expiry. On submission the API re-rates the quotation with current rates, checks "
           "validity (30 days by default), the agency issuance block, required documents, nominees, participant "
           "signature and AML status, then decides whether the application must be referred.")
    w.figure(figs["lifecycle"], "Quotation and policy lifecycle", width_cm=16.0)
    w.table(["Referral reason", "Source"], [
        ["Sum covered above the agent's authority limit", "agent.authority_limit (AP-60)"],
        ["Product limit, e.g. financing amount above B$150,000 (high-risk limit)", "Product configuration"],
        ["Questionnaire answer marked 'refer if yes'", "product.questionnaire"],
        ["Quality check before issuance for products that require it", "Product rules"],
    ], widths=[10.0, 7.0], font_size=8.5, caption="Referral triggers")
    w.para("Pay-first products (the annual plans) wait in PENDING_PAYMENT until Finance verifies payment, then issue. "
           "Issue-then-pay products (the financing plans) issue immediately with a payment due date of issuance plus "
           "the grace period (7 days by default). A daily job blocks every agent of an agency from submitting new "
           "business while any of its issued policies is unpaid beyond the due date, and lifts the block "
           "automatically once nothing is overdue (AP-42). An administrator can lift a block manually with a reason; "
           "the next daily run re-applies it if contributions are still overdue.")
    w.para("Renewal is allowed only inside the renewal window, from policy.renewal_notice_days before the end date "
           "until 30 days after it; outside it the API answers OUTSIDE_RENEWAL_WINDOW. The renewals-due list uses "
           "the same window, and products can switch renewal off.")
    w.h2("Maker-checker workflows")
    w.para("Eight transaction types run through the workflow engine. Each type has a configurable sequence of levels; "
           "each level names the permission a checker needs and, optionally, an amount threshold from which it "
           "applies. The levels are resolved when the request is raised and stored with it, so a later configuration "
           "change does not alter requests already in flight. When no level applies the request is approved "
           "immediately and the change is applied in the same transaction.")
    w.table(["Type", "Default levels (seed data)", "Effect on final approval"], WORKFLOWS, widths=[4.2, 6.0, 6.8],
            font_size=8, caption="Approval types")
    w.para("Rules enforced by the server: the maker can never approve their own request; the same person cannot "
           "approve two levels of one request; rejection requires remarks; a request can be withdrawn by its maker "
           "until decided; only one pending request per record and type is allowed; and a decision fails with "
           "STALE_RECORD if another checker decided the same level first. An agent registration can be approved only "
           "once the identity document is on file: the passport copy for passport holders, otherwise the IC copy.")
    w.para("When Compliance confirms an AML match, the subject's pending approval requests (for example the agent "
           "registration) are rejected in the same transaction with the Compliance remarks and the maker is notified. "
           "The subject's AML status becomes REJECTED, and an agent whose registration is closed this way is "
           "REJECTED.")
    w.h2("Scheduled processing")
    w.table(["Job", "Schedule (Brunei time)", "Lock", "Purpose", "Source"], JOBS, widths=[2.7, 3.0, 2.7, 4.6, 4.0],
            font_size=7.5, caption="Scheduled jobs")
    w.para("Each job takes a PostgreSQL transaction-scoped advisory lock (pg_try_advisory_xact_lock) named after the "
           "job before it runs. Every API replica schedules the jobs, but only the replica that gets the lock does "
           "the work; the lock is released automatically if the process stops. JOBS_ENABLED=false disables all jobs "
           "in an instance, for example in a reporting replica.")


def application(w, figs):
    spec, ops = facts.api_operations()
    w.h1("Logical and Application Architecture")
    w.h2("Layers")
    w.para("The solution has five layers. Two single-page applications, built from one React code base, run in the "
           "browser. An nginx web tier serves them and forwards /api calls. The NestJS API holds all business logic "
           "and security enforcement. PostgreSQL holds all structured data, and an encrypted file store holds "
           "documents. Scheduled jobs run inside the API processes and coordinate through database locks, so there is "
           "no separate scheduler or message broker to operate.")
    w.figure(figs["logical"], "Logical architecture", width_cm=16.0)
    w.h2("Front end")
    pages = len(list((facts.WEB / "src" / "pages").rglob("*Page.tsx")))
    w.paras([
        f"apps/web is a React 19 and TypeScript application built with Vite 7 and Ant Design 6, themed in the Insurans "
        f"Islam TAIB colours. It contains {pages} page components behind three route trees: /portal for agents and "
        "bank officers, /backoffice for IIFT staff and /esign/:token for participants. Pages are loaded on demand, and "
        "vendor libraries are split into separate chunks (react, antd, charts) so the first screen stays small.",
        "Server state is managed with TanStack Query. A thin API client sends the session cookie (same origin), adds "
        "the X-CSRF-Token header to every state-changing call, and turns error responses into a typed error that "
        "carries the correlation id the user can quote to support. A 401 response returns the user to the sign-in "
        "page. Route guards in the SPA only shape navigation; every check is repeated by the API.",
    ])
    w.h2("API")
    w.para(f"The API is a NestJS 12 application on Node.js 22, written in TypeScript as ES modules. All business "
           f"endpoints are under /api/v1 and are described in docs/api/openapi.json ({len(spec['paths'])} paths, "
           f"{len(ops)} operations). Namespaces separate the audiences, so the reverse proxy can publish the "
           "back-office only on the internal network.")
    counts = {}
    for _, path, _ in ops:
        counts[facts.namespace(path)] = counts.get(facts.namespace(path), 0) + 1
    purpose_of = {
        "/api/v1/auth": ("Sign-in, sign-out, current user, password change", "Session (login is public)"),
        "/api/v1/portal": ("Agent/Banca Portal functions", "Session, PORTAL audience, permissions, data scope"),
        "/api/v1/backoffice": ("Back-office functions", "Session, BACKOFFICE audience, permissions"),
        "/api/v1/common": ("Functions used by both audiences: documents, notifications, issues, products, codes",
                           "Session, permissions, data scope"),
        "/api/v1/public": ("Participant e-signature page", "One-time token (hash stored)"),
        "/api/v1/integration": ("System-to-system APIs for Core and FIN", "API key (SHA-256 held), IP allow-list"),
    }
    rows = [[ns, str(counts.get(ns, 0)), purpose_of[ns][0], purpose_of[ns][1]] for ns in purpose_of]
    rows.append(["/health/live, /health/ready, /metrics", "3", "Probes and Prometheus metrics (outside /api/v1)",
                 "Public probes; METRICS_TOKEN for metrics"])
    w.table(["Namespace", "Ops", "Purpose", "Access control"], rows, widths=[4.0, 1.2, 6.4, 5.4], font_size=8,
            caption="API namespaces")
    w.h2("Request processing")
    w.para("Every request passes the same pipeline, configured once in app.setup.ts and used by both the server and "
           "the end-to-end tests. Global guards run in a fixed order: throttling, authentication, CSRF, then "
           "permissions. A route is protected unless it is explicitly marked public.")
    w.figure(figs["pipeline_req"], "Request pipeline", width_cm=16.5)
    w.h2("Error handling")
    w.para("A global exception filter turns every error into the same JSON body: statusCode, a stable code, a message "
           "safe to show, optional details and the correlation id. Unexpected errors are logged in full on the server "
           "and reach the user only as a generic message with the correlation id (NFR-15).")
    w.table(["HTTP", "Codes", "When"], [
        ["400", "BAD_REQUEST", "Validation failed; details lists each field problem"],
        ["401", "NOT_AUTHENTICATED, INVALID_CREDENTIALS, ACCOUNT_LOCKED, SESSION_EXPIRED", "No valid session or sign-in "
         "refused"],
        ["403", "FORBIDDEN, CSRF_TOKEN_INVALID, WRONG_AUDIENCE, PASSWORD_CHANGE_REQUIRED", "Not permitted"],
        ["404", "NOT_FOUND", "Record does not exist or is outside the user's data scope"],
        ["409", "DUPLICATE, STALE_RECORD", "Unique value exists; record changed by another user"],
        ["413", "PAYLOAD_TOO_LARGE", "Body or file above the limit"],
        ["422", "Business rule codes, e.g. AGENCY_BLOCKED, SUBMISSION_INCOMPLETE, QUOTATION_EXPIRED",
         "Valid request that breaks a business rule"],
        ["429", "TOO_MANY_REQUESTS", "Rate limit reached"],
        ["500", "INTERNAL_ERROR", "Unexpected error; logged with stack trace on the server only"],
        ["503", "NOT_READY, NOT_CONFIGURED", "Database unavailable; inbound integration not configured"],
    ], widths=[1.4, 8.6, 7.0], font_size=8, caption="Error responses")
    w.h2("Consistency and concurrency")
    w.bullets([
        "Each business operation runs in one database transaction that includes its audit row and outbox message.",
        "Records edited by several users (agent, participant, policy) carry a version column; updates quote the "
        "version read and fail with STALE_RECORD if it changed.",
        "Approval decisions update the request only if it is still PENDING at the expected level, so two checkers "
        "cannot both decide.",
        "Reference numbers come from PostgreSQL sequences, which are safe across replicas without row locks.",
        "Amounts are DECIMAL end to end and rounded half-up to two places; binary floating point is never stored.",
    ])


def data(w, figs, pm):
    w.h1("Data Architecture")
    areas = len({m.section for m in pm.models})
    w.para(f"The database has {len(pm.models)} tables in {areas} areas. The Data Dictionary documents every column; "
           "this chapter explains the structure and the controls around it.")
    w.h2("Entity overview")
    w.figure(figs["entities"], "Entity overview", width_cm=16.0)
    w.table(["Entity", "Role in the model"], [
        ["agency, agent", "Distribution structure. Agents belong to one agency or bank; sub-agents point to their main "
         "agent. Agency carries the issuance block."],
        ["app_user, role, user_role, role_permission", "Sign-in identities and role-based permissions. A portal user is "
         "linked to exactly one agent."],
        ["participant", "One shared record per identification number across agencies; encrypted identifier with blind "
         "index; AML status."],
        ["product", "Rating configuration, required documents and questionnaire as validated JSON."],
        ["policy", "Quotation and policy in one row through the whole lifecycle; contribution breakdown and risk "
         "details as JSON; outstanding amount and due date."],
        ["payment, payment_allocation, receipt, commission", "Bulk payments allocated per policy; one receipt per "
         "policy; commission accrued at issuance."],
        ["approval_request, approval_action", "Maker-checker requests with payload and resolved levels; full action "
         "history."],
        ["document", "Metadata for encrypted files attached to any owner type."],
        ["audit_log", "Append-only audit trail with before and after values."],
        ["outbox_message, integration_log, reconciliation_run, eod_run", "Integration delivery, call log, "
         "reconciliation and end-of-day history."],
    ], widths=[5.2, 11.8], font_size=8, caption="Key entities")
    w.h2("Why PostgreSQL")
    w.para("PostgreSQL 16 was chosen over MongoDB because IIFT's data is relational and financial, and because "
           "issuance, receipting, audit and integration must commit together.")
    w.table(["Criterion", "PostgreSQL 16 (selected)", "MongoDB"], DB_COMPARISON, widths=[3.4, 7.8, 5.8], font_size=8,
            bold_first_col=True, caption="Database selection")
    w.h2("Integrity controls")
    w.bullets([
        f"{len(pm.relations)} foreign keys with explicit ON DELETE rules: RESTRICT for business parents, CASCADE only "
        "for dependent detail rows (nominees, events, allocations, comments, role links).",
        f"{sum(1 for i in pm.indexes if i.unique and not i.primary)} unique indexes, including one participant and one "
        "agent per identification type and number, one receipt number, one policy number.",
        f"{len(pm.checks)} CHECK constraints: amounts on policy, payment and allocation; nominee share between 0 and "
        "100.",
        "Validation of every request body against a whitelist DTO before it reaches a service; unknown fields are "
        "rejected (NFR-30).",
        "JSON columns (product configuration, questionnaire, payloads) are validated by the owning service before "
        "they are written.",
    ])
    w.h2("Audit trail")
    w.para("The audit service writes one row per security or business event: actor, action, entity, before and after "
           "values, IP address, user agent and correlation id. It writes inside the caller's transaction, so an audit "
           "row exists exactly when the change exists. Passwords, hashes, encrypted identifiers, tokens and storage "
           "keys are replaced with a fixed REDACTED marker. In the database, the trigger audit_log_no_update calls "
           "audit_log_block_mutation() before any UPDATE or DELETE and raises an exception, so the trail is "
           "append-only whichever client connects. Granting the application role only INSERT and SELECT on "
           "audit_log, with a separate migration owner role, is set up during implementation.")
    w.h2("Field-level encryption")
    w.para("IC, passport and business registration numbers of agents and participants, and nominee identification "
           "numbers, are encrypted by the application before they reach the database: AES-256-GCM with a random "
           "96-bit IV per value, stored as v1:<base64(IV | tag | ciphertext)>. The version prefix allows a new key "
           "to be introduced without a big-bang re-encryption. For exact search and duplicate prevention, the "
           "application also stores a blind index: HMAC-SHA256 of the normalised number (separators removed, upper "
           "case) with a separate key. The unique constraint on (id_type, id_number_hash) therefore blocks duplicates "
           "without decrypting anything. Screens show the number masked to its last four characters, and the API never "
           "returns ciphertext: approval request views (inbox, search, detail, the portal's own requests and record "
           "history) drop payload values whose key ends in Enc, while the stored payload keeps them for the approval "
           "handler. When nominees are saved again with their existing id and the number left blank, as on a draft "
           "or an endorsement, the stored encrypted number is kept.")
    w.h2("Reference numbers")
    rows = [[name, dictionary_text.SEQUENCES[name][1], dictionary_text.SEQUENCES[name][2]]
            for name, _ in pm.sequences]
    w.table(["Sequence", "Format", "Column"], rows, widths=[4.6, 6.4, 6.0], font_size=8,
            caption="Business reference numbers")
    w.para("The two-digit year is the calendar year of issue. Sequences never repeat a value; a rolled-back "
           "transaction can leave a gap, which is acceptable for these references and is explained to auditors.")
    w.h2("Documents")
    w.para("Uploaded and generated files are encrypted with AES-256-GCM (separate key, one IV per file) and written to "
           "the document store under a generated key of the form yyyy/mm/<uuid>.bin, so no user input ever "
           "influences a file path. The document table holds the owner, type, sanitised file name, detected content "
           "type, size, SHA-256 checksum and verification status. The store is a directory: a local or NFS volume "
           "on-premise, or an encrypted Amazon EFS or Azure Files share in the cloud. An S3-compatible adapter is "
           "delivered during implementation if IIFT prefers object storage.")
    w.h2("Configuration data")
    w.para("Business parameters live in config_parameter and are changed in the back-office within the allowed "
           "range; every change is audited. Values are cached briefly in each API instance.")
    rows = [[s["key"], s["value"], s["range"] or "–", s["description"]] for s in facts.setting_defaults()]
    w.table(["Parameter", "Default", "Range", "Meaning"], rows, widths=[5.4, 1.6, 2.0, 8.0], font_size=7.5,
            padding=25, caption="Business parameters and defaults")
    w.h2("Retention and archival")
    w.para("Proposed retention periods are below. They are confirmed with IIFT Compliance against the PDPO 2025, AMBD "
           "requirements and AML/CFT record-keeping rules during design. The retention job that applies them, with "
           "an archive schema and audit of every purge, is delivered during implementation. Expired sessions are "
           "already pruned automatically.")
    w.table(["Data", "Retention", "Mechanism"], RETENTION, widths=[6.6, 5.4, 5.0], font_size=8,
            caption="Proposed retention")
    w.h2("Data migration")
    w.para("Legacy agents, agencies, participants and in-force policies are loaded through the same services the "
           "application uses, so encryption, blind indexes, numbering and audit apply to migrated records. Each "
           "rehearsal produces a reconciliation of counts and amounts that IIFT signs off (DEL-19); the migration "
           "tooling is delivered during implementation.")
