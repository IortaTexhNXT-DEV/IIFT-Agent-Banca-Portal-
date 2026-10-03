"""Test scenarios and test conditions for SalesVerse 2.0 (IIFT Agent/Banca Portal & Back-office).

A scenario is one business or technical situation to prove, traced to RFP requirement
identifiers. A condition is one rule, decision or state inside a scenario that at least one
test case must verify. Test cases (test_cases_manual.py and test_automated.py) reference
conditions by identifier; test_status.py joins everything and checks the references.
"""

# --- Functional areas (order used in the workbook and the strategy) --------------------------
AREAS = [
    ("AUT", "Authentication and session"),
    ("ACC", "Access control and data scoping"),
    ("AGT", "Agent and agency management"),
    ("PAR", "Participant management"),
    ("AML", "AML/KYC screening"),
    ("PRD", "Products and rating"),
    ("QUO", "Quotation and submission"),
    ("WFL", "Approval workflow (maker-checker)"),
    ("POL", "Policy issuance and policy documents"),
    ("BIL", "Billing and payments"),
    ("SVC", "Policy servicing: renewal, endorsement, cancellation"),
    ("CLM", "Claims notification"),
    ("DOC", "Documents and uploads"),
    ("DSH", "Dashboards and notifications"),
    ("ISS", "Issue management and SLA"),
    ("RPT", "Reporting"),
    ("AUD", "Audit trail"),
    ("ADM", "Administration and configuration"),
    ("INT", "Integration and end-of-day"),
    ("SEC", "Application security"),
    ("NFR", "Non-functional: performance, availability, DR, usability"),
    ("PLT", "Platform behaviour and configuration"),
]
AREA_NAME = dict(AREAS)


def _s(sid, area, rfp, persona, description, pre, end):
    return {"id": sid, "area": area, "rfp": rfp, "persona": persona, "description": description,
            "preconditions": pre, "end_state": end}


# --- Scenarios ------------------------------------------------------------------------------------
SCENARIOS = [
    # Authentication
    _s("TS-01", "AUT", "AP-01, BO-01, NFR-09", "Agent, bank officer, staff",
       "Sign in with a user name and password; wrong credentials are refused without revealing which part was wrong.",
       "Demonstration users loaded; account active.", "Session established; failed attempts recorded in the audit trail."),
    _s("TS-02", "AUT", "AP-02, NFR-09", "Any user, administrator",
       "Change a password under the configurable policy (length, character classes, history, expiry, no user name); temporary passwords must be changed at first sign-in.",
       "Signed in; password parameters at defaults.", "Password changed; other sessions ended; policy breaches refused."),
    _s("TS-03", "AUT", "AP-03, NFR-09", "Any user",
       "Session management: cookie flags, new session id at sign-in, logout revocation, single active session, idle and absolute timeout.",
       "Signed in.", "Old sessions unusable; timeouts applied from parameters."),
    _s("TS-04", "AUT", "AP-04, NFR-09", "Any user, administrator",
       "Account lockout after the configured failed attempts and administrator unlock.",
       "Lockout parameters at defaults (5 attempts, 30 minutes).", "Account locked then unlocked; events audited."),
    _s("TS-05", "AUT", "INT-06, BO-01", "Back-office staff",
       "Back-office sign-on through the corporate directory (LDAP/Active Directory) with escaped filters.",
       "LDAP configured (IIFT environment).", "Directory users sign in; local accounts unaffected."),
    # Access control
    _s("TS-06", "ACC", "AP-59, BO-02, COM-02, NFR-10", "All personas",
       "Role-based access: every route checks a permission; portal and back-office audiences are separate; roles grant least privilege.",
       "Demonstration roles loaded.", "Unauthorised calls refused with 401/403; authorised calls succeed."),
    _s("TS-07", "ACC", "AP-09, AP-11, AP-12, AP-59, COM-02", "Agents, bank officers, supervisors",
       "Data scoping: agents see their own and their sub-agents' records; principals and bank supervisors see the whole agency/bank; other agencies' records are not disclosed.",
       "Two agencies and one bank with business.", "Records outside the scope answer 404/403; participant profile shared only through exact-ID lookup."),
    # Agents and agencies
    _s("TS-08", "AGT", "AP-07, AP-08, AP-48, BO-10, BO-11", "Agency principal, operations checker",
       "Online registration of a sub-agent with AML screening, document upload and maker-checker approval; agent code generated; portal account created.",
       "Principal signed in; checker available.", "Agent ACTIVE with a unique code and a user that must change its temporary password."),
    _s("TS-09", "AGT", "AP-05, AP-06, AP-09, AP-10, BO-08", "Agent, bank officer",
       "Profile, agency information and hierarchy views; profile changes submitted for approval and withdrawable by the maker.",
       "Signed in as a sub-agent.", "Profile request pending or withdrawn; hierarchy shows the reporting line."),
    _s("TS-10", "AGT", "BO-05, BO-06, BO-07, BO-08, BO-09", "Operations maker/checker, manager",
       "Back-office agent and agency administration: search, status changes with allowed transitions, agency creation and maintenance, payment-block lift.",
       "Back-office user with the relevant permissions.", "Changes applied after approval; invalid transitions refused."),
    # Participants
    _s("TS-11", "PAR", "AP-13, AP-14, AP-15, AP-48, NFR-30", "Agent, operations checker",
       "Register individual and corporate participants with validation, search them, and submit profile updates for approval.",
       "Signed in as an agent.", "Participant number assigned; updates applied after approval."),
    _s("TS-12", "PAR", "AP-11, AP-12, COM-01", "Agents of different agencies",
       "Single shared participant profile: duplicate identification numbers refused, exact-ID lookup across agencies returns a masked summary, full profile visible once business exists.",
       "Participant registered by agency A.", "No duplicate profiles; cross-agency visibility limited as designed."),
    # AML
    _s("TS-13", "AML", "AP-16, BO-13, BO-14, BO-15", "Agent, compliance officer",
       "Watch-list screening of participants and agents at registration; matches above the threshold routed to Compliance; decisions recorded with dates and remarks.",
       "Watch-lists loaded; threshold 85.", "Cleared subjects proceed; confirmed matches rejected and blocked from business."),
    _s("TS-14", "AML", "BO-13, BO-32", "Compliance officer",
       "Watch-list maintenance: manual entries, CSV import with validation, deactivation.",
       "Compliance signed in.", "Watch-list updated and used by the next screening."),
    # Products and rating
    _s("TS-15", "PRD", "AP-17, AP-18, AP-19, FFR01", "Bank officer, agent",
       "Financing Takaful (Hire Purchase, Non-Participating, Property): contribution from amount, period, profit rate and age next birthday; high-risk limit; age at expiry.",
       "Participant registered.", "Correct contribution and referral reasons."),
    _s("TS-16", "PRD", "AP-17, AP-18, AP-19, FFR03", "Agent",
       "Professional Takaful Plan: Plans A/B/C with optional additional cover; Occupational Class I only.",
       "Participant with occupation class.", "Correct contribution; ineligible classes refused."),
    _s("TS-17", "PRD", "AP-17, AP-18, AP-19, FFR04", "Agent",
       "Khairat Takaful Plan: Plans A/B/C, Individual or Wider (Child) cover; no portal renewal.",
       "Participant registered.", "Correct contribution with loading; renewal refused."),
    _s("TS-18", "PRD", "AP-17, AP-18, AP-19, FFR02", "Agent",
       "Personal Home Assistant Takaful Plan: 1- or 2-year cover with helper details and documents.",
       "Participant registered.", "Correct contribution per period."),
    _s("TS-19", "PRD", "AP-17, AP-18, AP-19, FFR05", "Agent",
       "Overseas Student Assist Takaful Plan: Basic/Tertiary plans; eligibility (Brunei citizen, registered student, up to 65).",
       "Participant registered.", "Ineligible participants refused; eligible ones rated."),
    _s("TS-20", "PRD", "BO-33, COM-09", "Administrator",
       "Product configuration (rates, plans, documents, questionnaire, flags) maintained in the back-office without code changes and validated on save.",
       "Administrator signed in.", "Valid configuration saved and used by the next quotation; invalid configuration refused."),
    # Quotation
    _s("TS-21", "QUO", "AP-18, AP-20, AP-49, AP-50", "Agent",
       "Create, save, change, reopen and discard a draft quotation; quotation validity period.",
       "Product and participant available.", "Draft quotation with a quotation number; discarded drafts not submittable."),
    _s("TS-22", "QUO", "AP-32, AP-36, AP-46, AP-62", "Agent",
       "Submission checks: questionnaire complete, nominee shares, mandatory documents per product, participant signature (on screen, e-signature link or signed form).",
       "Draft quotation.", "Submission refused with a list of problems until complete."),
    _s("TS-23", "QUO", "AP-62", "Agent, participant",
       "Remote e-signature: one-time link e-mailed to the participant, public review page, name confirmation, consent, signature; link expiry and reuse.",
       "Draft quotation with participant e-mail.", "Signature document stored; link unusable afterwards."),
    _s("TS-24", "QUO", "AP-25, AP-32, AP-33, AP-36, AP-60, FFR01", "Agent, bank officer",
       "Submit an eligible application: pay-before-issuance products go to PENDING_PAYMENT; referral reasons (declarations, high-risk limit, authority limit, quality check) route to PENDING_APPROVAL; AML and agency block gates.",
       "Complete application.", "Correct next status and workflow request."),
    # Workflow
    _s("TS-25", "WFL", "BO-16, BO-17, BO-18, BO-19, COM-04, AP-61", "Makers and checkers",
       "Configurable maker-checker workflow: inbox by permission, approve/reject with mandatory remarks, segregation of duties, amount-based levels, withdrawal, history.",
       "Workflow definitions loaded.", "Requests decided once by an authorised different user; history and remarks retained."),
    _s("TS-26", "WFL", "AP-51, AP-54, BO-19", "Agent",
       "Rejection remarks and status changes are visible to the maker in 'My requests' and in notifications; resubmission where applicable.",
       "A rejected request exists.", "Maker sees the reason and can act."),
    # Policy
    _s("TS-27", "POL", "AP-21, AP-22, AP-23, AP-24, AP-31", "Agent, back-office",
       "Policy listing, search and filters, detail with cover, participant, nominees, payment status and the transaction history.",
       "Policies in several statuses.", "Correct lists and detail; statuses Draft, Pending approval, Pending payment, Active, Rejected, Expired, Cancelled."),
    _s("TS-28", "POL", "AP-41, AP-44, AP-45, AP-29, COM-06, FFR03", "Agent, finance",
       "Issuance on payment verification or approval: policy number, e-Policy schedule and e-Receipt generated as PDF, downloadable and e-mailable; Core/FIN messages queued.",
       "Submitted application with verified payment.", "ACTIVE policy with documents and outbox messages."),
    _s("TS-29", "POL", "AP-21, AP-26, AP-34", "System (scheduled job)",
       "Daily expiry job moves policies past their end date to EXPIRED and notifies agents; renewal notices within the notice period.",
       "Policies with past end dates.", "Statuses updated; notifications recorded."),
    # Billing
    _s("TS-30", "BIL", "AP-37, AP-30", "Agent, bank officer",
       "Billing dashboard: outstanding, overdue, due soon and pending-verification figures; outstanding list per policy; payment history.",
       "Policies awaiting payment.", "Figures reconcile with the policy list."),
    _s("TS-31", "BIL", "AP-38, AP-39, AP-40, AP-41", "Bank officer, finance",
       "Bulk payment: one transfer or cheque allocated per policy with proof upload; Finance verifies or rejects; receipts generated on approval.",
       "Policies awaiting payment.", "Payment VERIFIED or REJECTED; receipt and FIN posting on approval."),
    _s("TS-32", "BIL", "AP-42, FFR01", "Bank officer, system",
       "Grace period and issuance block: financing policies issued before payment with a 7-day due date; the daily job blocks every agent of an agency/bank with overdue contributions and lifts the block when settled.",
       "Issue-then-pay policy unpaid past the due date.", "Agency blocked; submissions refused; block lifted after payment."),
    _s("TS-33", "BIL", "INT-05, INT-04", "Agent, finance",
       "Commission statement: accrued commission per issued policy and paid status from FIN.",
       "Issued policies with commission rates.", "Statement visible to the agent; paid status updated through the inbound API."),
    # Servicing
    _s("TS-34", "SVC", "AP-26, FFR03", "Agent",
       "Renewal: policies due within the notice period listed; renewal quotation created from the expiring policy; window and product rules enforced.",
       "Renewable policy near its end date.", "Renewal quotation DRAFT carrying nominees; duplicates refused."),
    _s("TS-35", "SVC", "AP-27, BO-16", "Agent, operations checker",
       "Endorsement request (nominee change, correction, contact details) approved by the servicing checker; changes applied on approval.",
       "Active policy.", "Policy updated; request history kept."),
    _s("TS-36", "SVC", "AP-28, BO-19", "Agent, operations checker",
       "Cancellation request with reason, effective date and remarks; approval cancels the policy, rejection keeps it in force.",
       "Active policy.", "Status CANCELLED on approval; ACTIVE on rejection."),
    # Claims
    _s("TS-37", "CLM", "AP-43", "Agent, operations",
       "Claim notification: validate the policy, check the event date against the period of cover, upload supporting documents, track the claim through review statuses.",
       "In-force policy.", "Claim number assigned; status transitions enforced; visible to the agent."),
    # Documents
    _s("TS-38", "DOC", "AP-46, AP-47, COM-06, NFR-30", "Agent, operations checker",
       "Document upload with content inspection, size limit and malware scan; encrypted storage; document status, validity and expiry; back-office verification queue.",
       "Signed in with an owner record.", "Only PDF/PNG/JPEG stored; status VERIFIED/REJECTED with remarks."),
    _s("TS-39", "DOC", "BO-11, BO-12", "Operations checker",
       "Agent document validation: completeness per ID type (IC copy or passport copy) checked before registration approval; expiry warnings.",
       "Pending agent registration.", "Approval blocked until documents complete."),
    # Dashboards and notifications
    _s("TS-40", "DSH", "AP-52, AP-53, BO-20, BO-21", "Agent, management, operations",
       "Portal dashboard with profile, production, pending actions (drafts, rejected, blocked); management dashboard with KPIs and 12-month trend; back-office pending-action views.",
       "Demonstration data loaded.", "Figures match the underlying records."),
    _s("TS-41", "DSH", "AP-34, AP-54, COM-05, INT-07, INT-08", "All users",
       "Notification framework: in-app notifications for status changes, approvals, rejections and SLA events; e-mail and SMS delivery through the configured gateways with retry.",
       "Events raised.", "In-app list and unread count correct; e-mail/SMS recorded and delivered."),
    # Issues
    _s("TS-42", "ISS", "AP-55, AP-56, AP-57, BO-29, BO-30, BO-31", "Agent, support desk",
       "Issue lifecycle: report with reference number, attach evidence, assign, prioritise, comment (internal/public), resolve, close; SLA targets and breach alerts.",
       "Support users exist.", "Issue closed with SLA dates; breaches flagged."),
    # Reports
    _s("TS-43", "RPT", "BO-22, BO-23, BO-24, COM-08", "Manager, back-office",
       "Twelve standard reports with filters (date, agent, agency, status) and export to XLSX, CSV and PDF.",
       "Demonstration data loaded.", "Reports run and export correctly."),
    _s("TS-44", "RPT", "AP-58", "Agent",
       "Portal reports limited to the agent's role and scope.",
       "Agent signed in.", "Only permitted reports, own records."),
    _s("TS-45", "RPT", "BO-25", "Manager, system",
       "Scheduled report generation and e-mail distribution (daily, weekly, monthly).",
       "Schedule configured.", "Report generated at the due time and e-mailed."),
    # Audit
    _s("TS-46", "AUD", "AP-35, AP-61, BO-26, BO-27, BO-28, COM-03, NFR-11", "Auditor, manager",
       "Audit trail of user activities, transactions, approvals and configuration changes with before/after values, user, time and IP; searchable; append-only.",
       "Activity performed.", "Records present, searchable and immutable."),
    # Administration
    _s("TS-47", "ADM", "BO-03", "Administrator",
       "User administration: create, update, disable, unlock, reset password; audience and self-service rules.",
       "Administrator signed in.", "User changes applied and audited."),
    _s("TS-48", "ADM", "BO-04", "Administrator",
       "Role and permission management: create roles per audience, assign permissions, protect system roles.",
       "Administrator signed in.", "Roles saved; invalid permissions refused."),
    _s("TS-49", "ADM", "BO-32, BO-33, COM-09", "Administrator",
       "Business parameters and master data (codes) maintained with validation, taking effect immediately and audited.",
       "Administrator signed in.", "Parameters applied by the next transaction; inactive codes refused."),
    _s("TS-50", "ADM", "BO-16, COM-04", "Administrator",
       "Workflow configuration: levels, approving permission and amount thresholds per transaction type.",
       "Administrator signed in.", "New configuration used by the next request."),
    # Integration and EOD
    _s("TS-51", "INT", "INT-01, INT-02, INT-03, INT-09, INT-10, INT-12", "Core system, IITH IT",
       "Core system integration: outbound agent/policy events through the outbox; inbound agent status synchronisation and issued-policy queries protected by an API key.",
       "Core endpoint configured or simulated.", "Messages delivered and acknowledged; inbound updates applied."),
    _s("TS-52", "INT", "INT-04, INT-05, INT-14, INT-15, FFR01, FFR02, FFR03, FFR04, FFR05", "Finance officer, FIN system",
       "End-of-day: daily close with EOD report, FIN interface file and postings with idempotent revisions; reconciliation of issuance and receipts with FIN/BRR.",
       "Business transacted today.", "EOD COMPLETED; FIN file produced; reconciliation MATCHED or MISMATCH reported."),
    _s("TS-53", "INT", "INT-11, INT-13, INT-14, NFR-27", "Finance officer, support",
       "Integration monitor: summary per system, outbox with retry and dead-letter, integration logs, alerts on dead letters.",
       "Messages in the outbox.", "Failures retried with back-off; dead letters visible and retriable."),
    _s("TS-54", "INT", "INT-06, INT-07, INT-08, COM-05", "IITH IT",
       "Connectivity to IIFT services: SMTP relay, SMS gateway, LDAP/AD, external AML service, Core and FIN endpoints (live mode).",
       "IIFT endpoints and credentials provided.", "Each adapter exchanges a real transaction end to end."),
    # Security
    _s("TS-55", "SEC", "COM-01, COM-10, NFR-08", "Security tester",
       "Data protection: identification numbers encrypted with a blind index and shown masked; documents encrypted at rest; TLS in transit; no secrets in responses.",
       "Demonstration data.", "No plaintext identifiers or hashes exposed."),
    _s("TS-56", "SEC", "NFR-14, NFR-15, NFR-30", "Security tester",
       "Input handling: whitelist validation, mass-assignment protection, injection payloads treated as text, upload content checks, generic errors with correlation ids.",
       "Test environment.", "All payloads refused or neutralised; no stack traces."),
    _s("TS-57", "SEC", "NFR-12, NFR-13, NFR-14, DEL-17", "Security tester, independent VAPT provider",
       "Vulnerability management: SAST, secret scan, dependency audit and image scan in CI; OWASP Top 10 checks before each release; independent VAPT and re-test before go-live.",
       "CI pipeline and test environment.", "No open Critical/High findings at go-live."),
    _s("TS-58", "SEC", "NFR-09", "Back-office staff",
       "Multi-factor authentication for back-office users (e-mail OTP or TOTP).",
       "Delivered during implementation.", "Second factor required at sign-in."),
    # Non-functional
    _s("TS-59", "NFR", "NFR-01, NFR-02, NFR-03, NFR-06, NFR-07, DEL-18", "Performance tester",
       "Performance: response times, 100 concurrent users, transaction volumes and five-year growth; stress and soak tests.",
       "Production-like SIT environment at IIFT.", "Targets met and reported (DEL-18)."),
    _s("TS-60", "NFR", "NFR-04, NFR-05, NFR-26, NFR-27, NFR-28", "IITH IT, support",
       "Availability and monitoring: health endpoints, metrics, log forwarding, alerts, failover of application instances and database standby.",
       "Target environment with two application instances and a standby database.", "Service continues through single-component failure; alerts raised."),
    _s("TS-61", "NFR", "NFR-17, NFR-18, NFR-19, MNT-19, MNT-20", "IITH IT, support",
       "Backup and disaster recovery: scheduled backups, restore drill, DR failover within RTO/RPO.",
       "Backup platform and DR site configured.", "Restore verified; DR drill documented."),
    _s("TS-62", "NFR", "NFR-22, NFR-23, NFR-24, MNT-15", "UAT testers",
       "Usability, browser compatibility (current Chrome, Edge, Firefox, Safari; mobile widths) and accessibility basics (keyboard, labels, contrast).",
       "UAT environment and IIFT devices.", "Accepted by IIFT users on the agreed browsers."),
    _s("TS-63", "NFR", "NFR-16", "Developer, QA",
       "Transaction integrity: issuance, receipt, audit and outbox commit atomically; optimistic locking on concurrent edits; numbering without gaps or duplicates.",
       "Concurrent updates simulated.", "No partial updates; stale edits refused with 409."),
    _s("TS-64", "NFR", "NFR-25, DEL-09", "Integration partners",
       "API standards: OpenAPI 3 contract, JSON over HTTPS, versioned paths, documented error format.",
       "OpenAPI document published.", "Partners build against the contract without ambiguity."),
    _s("TS-65", "NFR", "NFR-29, COM-07", "Administrator",
       "Data retention and archival policy; global search across records.",
       "Policy agreed with IIFT.", "Retention jobs and search behave as agreed."),
    _s("TS-66", "NFR", "DEL-19, COM-07", "iorta, IIFT data owners",
       "Data migration rehearsal: extraction, transformation, load, reconciliation of counts and control totals.",
       "Legacy extracts available.", "100% record count and control-total match."),
    _s("TS-67", "NFR", "DEL-15, DEL-16", "IIFT business users",
       "User acceptance testing of the end-to-end business flows per product and role, with sign-off.",
       "UAT environment with masked data; trained testers.", "Signed UAT certificate; no open Critical/High defects."),
    _s("TS-68", "NFR", "DEL-20, DEL-21", "iorta, IITH IT",
       "Operational readiness: deployment rehearsal, go-live checklist, rollback, hypercare entry criteria.",
       "Production environment prepared.", "Checklist complete; rollback tested."),
    # Platform
    _s("TS-69", "PLT", "NFR-15, NFR-14", "Developer, QA",
       "Platform behaviour: start-up configuration guards, production safety checks, generic error responses, health and readiness, API documentation switch.",
       "Configuration variants.", "Unsafe configuration refused at start-up; errors consistent."),
    _s("TS-70", "PLT", "NFR-22", "Developer, QA",
       "Web application components: API client (CSRF, session end), formatting, status display, navigation, permission gating, forms.",
       "Unit test environment.", "Components behave per specification."),
]


def _c(cid, sid, text):
    return {"id": cid, "scenario": sid, "text": text}


# --- Conditions -----------------------------------------------------------------------------------
CONDITIONS = [
    # TS-01 sign-in
    _c("TC-001", "TS-01", "Unknown user and wrong password return the same message and code INVALID_CREDENTIALS"),
    _c("TC-002", "TS-01", "Successful sign-in returns the user profile, permissions and a CSRF token; never a password hash"),
    _c("TC-003", "TS-01", "Failed sign-ins are recorded in the audit trail with the client IP address"),
    _c("TC-004", "TS-01", "Sign-in attempts are rate limited per client address (HTTP 429)"),
    _c("TC-005", "TS-01", "Injection payloads in sign-in fields are rejected as invalid credentials"),
    _c("TC-006", "TS-01", "Sign-in page validates both fields and shows the server's error message"),
    # TS-02 password
    _c("TC-007", "TS-02", "Password must meet the configured length and character-class rules and must not contain the user name"),
    _c("TC-008", "TS-02", "Last N passwords cannot be reused and passwords expire after the configured days"),
    _c("TC-009", "TS-02", "Passwords are hashed with Argon2id; current password must be given to change it"),
    _c("TC-010", "TS-02", "A temporary password must be changed before any other request succeeds (PASSWORD_CHANGE_REQUIRED)"),
    _c("TC-011", "TS-02", "Generated temporary passwords satisfy the policy"),
    # TS-03 session
    _c("TC-012", "TS-03", "Session cookie is HttpOnly and SameSite=Strict; Secure in production"),
    _c("TC-013", "TS-03", "Session identifier changes at every sign-in (no fixation)"),
    _c("TC-014", "TS-03", "Logout revokes the session server-side; the old cookie is refused"),
    _c("TC-015", "TS-03", "Signing in again ends the user's earlier session when single active session is on"),
    _c("TC-016", "TS-03", "Idle (15 min) and absolute (8 h) timeouts end the session; the web application returns to the sign-in page"),
    # TS-04 lockout
    _c("TC-017", "TS-04", "Account is locked after the configured number of failed attempts; the correct password is then refused with ACCOUNT_LOCKED"),
    _c("TC-018", "TS-04", "Administrator can unlock a locked account; a disabled account cannot be unlocked"),
    # TS-05 LDAP
    _c("TC-019", "TS-05", "LDAP filter characters in user names are escaped"),
    _c("TC-020", "TS-05", "Directory users authenticate against IIFT's Active Directory; directory accounts are not reset locally"),
    # TS-06 RBAC
    _c("TC-021", "TS-06", "Protected routes require a session (401 NOT_AUTHENTICATED)"),
    _c("TC-022", "TS-06", "Portal users cannot call back-office routes and vice versa (403 WRONG_AUDIENCE)"),
    _c("TC-023", "TS-06", "Each back-office function requires its permission (403 FORBIDDEN)"),
    _c("TC-024", "TS-06", "Users cannot grant permissions they do not hold"),
    _c("TC-025", "TS-06", "The web application hides pages and menu entries the user lacks permission for"),
    # TS-07 scoping
    _c("TC-026", "TS-07", "A policy outside the user's agency or hierarchy is not disclosed (404)"),
    _c("TC-027", "TS-07", "Sub-agents see only their own business; principals and bank supervisors see the whole agency/bank"),
    _c("TC-028", "TS-07", "Documents, participants and issues of another agency cannot be read or downloaded"),
    # TS-08 registration
    _c("TC-029", "TS-08", "Only users with portal.agents.register (principals, bank supervisors) can register agents"),
    _c("TC-030", "TS-08", "Agent type must match the channel (BANKER for banks; MAIN/SUB_AGENT for agencies); sub-agents need an active main agent; no circular lines"),
    _c("TC-031", "TS-08", "Unique agent code AG-/BK-nnnnnn generated; duplicate identification number refused"),
    _c("TC-032", "TS-08", "Approval requires the identity document (IC copy, or passport copy for passport holders)"),
    _c("TC-033", "TS-08", "On approval the agent becomes ACTIVE and a portal user named after the agent code is created with a temporary password"),
    _c("TC-034", "TS-08", "A confirmed AML match rejects the registration and the agent"),
    # TS-09 profile
    _c("TC-035", "TS-09", "Profile, agency and hierarchy views show the registered data and reporting line"),
    _c("TC-036", "TS-09", "Profile update requests need at least one change and go to the checker; the maker can withdraw a pending request"),
    # TS-10 back-office agents
    _c("TC-037", "TS-10", "Agent search by code, name, agency, status and type"),
    _c("TC-038", "TS-10", "Status changes follow the allowed transitions (Pending, Active, Inactive, Suspended, Terminated) and need a reason and approval"),
    _c("TC-039", "TS-10", "Agency created and maintained with validation; agents listed under it; payment block can be lifted"),
    _c("TC-040", "TS-10", "Back-office registration of an agent on behalf of an agency follows the same approval"),
    # TS-11 participants
    _c("TC-041", "TS-11", "Individual participants use NRIC or passport; corporate participants use a business registration number"),
    _c("TC-042", "TS-11", "Participant number PT/yy/nnnnnn assigned; mandatory fields and formats validated"),
    _c("TC-043", "TS-11", "Participant search by name, number and exact identification number"),
    _c("TC-044", "TS-11", "Participant updates go through approval and need at least one change"),
    # TS-12 single profile
    _c("TC-045", "TS-12", "Duplicate identification number refused with the existing participant number; the wizard offers the existing record"),
    _c("TC-046", "TS-12", "Exact-ID lookup from another agency returns a masked summary only"),
    _c("TC-047", "TS-12", "Full profile visible to an agency only once it holds business with the participant"),
    # TS-13 AML
    _c("TC-048", "TS-13", "Name matching normalises spelling, honorifics and transliteration; score ≥ threshold flags the subject"),
    _c("TC-049", "TS-13", "Flagged participants cannot be submitted (AML_REVIEW_PENDING); rejected participants cannot be quoted (AML_REJECTED)"),
    _c("TC-050", "TS-13", "Compliance review needs remarks, is recorded once with date and user, and updates the subject's status"),
    _c("TC-051", "TS-13", "AML functions are restricted to Compliance; results and dates are displayed"),
    # TS-14 watch-list
    _c("TC-052", "TS-14", "CSV import validates the header and rows; quoted fields and CRLF handled"),
    _c("TC-053", "TS-14", "Manual entries and deactivation"),
    # TS-15 financing
    _c("TC-054", "TS-15", "Contribution = decreasing-term rate on the flat-rate financing total by age next birthday; minimum contribution applies"),
    _c("TC-055", "TS-15", "Financing above B$150,000 (high-risk limit) is referred to IIFT Sales; exactly at the limit is not"),
    _c("TC-056", "TS-15", "Cover past the maximum age at expiry or outside the amount/tenure range is refused; all missing risk fields reported together"),
    _c("TC-057", "TS-15", "Products with profit basis NONE apply no profit loading; configuration validated at start-up"),
    # TS-16 PRO
    _c("TC-058", "TS-16", "Plan A/B/C sum covered 15,000/30,000/50,000 with contributions 75/135/210; additional cover adds 90/120/140"),
    _c("TC-059", "TS-16", "Only Occupational Class I participants are eligible"),
    # TS-17 KHR
    _c("TC-060", "TS-17", "Plan A/B/C sum covered 5,000/10,000/15,000; Wider (Child) applies the 1.6 loading"),
    _c("TC-061", "TS-17", "Khairat cannot be renewed through the portal"),
    # TS-18 PHA
    _c("TC-062", "TS-18", "1-year and 2-year cover priced from the plan table; helper details required"),
    # TS-19 OSA
    _c("TC-063", "TS-19", "Basic 20,000 and Tertiary 50,000 plans"),
    _c("TC-064", "TS-19", "Eligibility: Brunei citizen, registered student, up to 65 next birthday"),
    # TS-20 product config
    _c("TC-065", "TS-20", "Product configuration saved through the back-office is validated (plans, documents, questionnaire) and applied"),
    _c("TC-066", "TS-20", "Plan labels fall back to the code for retired plans; undefined risk details are dropped"),
    # TS-21 draft
    _c("TC-067", "TS-21", "Quotation created in DRAFT with QT/yy/nnnnnn and the calculated contribution"),
    _c("TC-068", "TS-21", "Only drafts can be changed, discarded or signed; issued policies are locked"),
    _c("TC-069", "TS-21", "Quotations expire after the validity period (30 days) and cannot be submitted"),
    _c("TC-070", "TS-21", "The quotation wizard guides product, participant, cover and review steps for fixed-plan and financing products"),
    # TS-22 submission checks
    _c("TC-071", "TS-22", "Every declaration must be answered; 'yes' needs details; unknown questions refused"),
    _c("TC-072", "TS-22", "Nominee shares must total 100%; relationship must be a valid code; nominee ID numbers stay encrypted"),
    _c("TC-073", "TS-22", "Mandatory documents per product must be uploaded; the submission lists what is missing"),
    _c("TC-074", "TS-22", "Participant signature required (parameter) by on-screen PNG, e-signature link or signed proposal form"),
    # TS-23 e-sign
    _c("TC-075", "TS-23", "Link sent to a valid participant e-mail with configurable expiry; event recorded"),
    _c("TC-076", "TS-23", "Public page shows a minimal summary; invalid, expired, used or non-draft tokens reveal nothing"),
    _c("TC-077", "TS-23", "Signer must type the name exactly, give consent and a PNG signature; the link works once"),
    # TS-24 submit
    _c("TC-078", "TS-24", "Pay-before-issuance products move to PENDING_PAYMENT without referral reasons"),
    _c("TC-079", "TS-24", "Referral reasons (declaration yes, high-risk limit, authority limit, quality check) move the application to PENDING_APPROVAL with a POLICY_REFERRAL request"),
    _c("TC-080", "TS-24", "Submission is refused for a blocked agency (AGENCY_BLOCKED) and for inactive agents"),
    _c("TC-081", "TS-24", "Rates are re-applied at submission"),
    # TS-25 workflow
    _c("TC-082", "TS-25", "Inbox lists requests whose current level matches the user's permissions"),
    _c("TC-083", "TS-25", "The maker cannot approve or reject their own request (SEGREGATION_OF_DUTIES); the same user cannot approve two levels"),
    _c("TC-084", "TS-25", "Rejection requires remarks; a decided request cannot be decided again"),
    _c("TC-085", "TS-25", "Amount thresholds add approval levels (second level from B$300,000)"),
    _c("TC-086", "TS-25", "Request views never contain encrypted values"),
    _c("TC-087", "TS-25", "Approval history with actor, action, level, time and remarks is retained"),
    # TS-26 rejection visibility
    _c("TC-088", "TS-26", "Rejected and withdrawn requests show the remarks to the maker"),
    # TS-27 policy views
    _c("TC-089", "TS-27", "Policy list and search by number, participant, status, product and dates"),
    _c("TC-090", "TS-27", "Policy detail shows cover, contribution breakdown, participant, nominees, documents, payments and history"),
    _c("TC-091", "TS-27", "Back-office policy views across all agencies"),
    # TS-28 issuance
    _c("TC-092", "TS-28", "Policy number <product>/yy/nnnnnn assigned; status ACTIVE; paymentStatus PAID after verification"),
    _c("TC-093", "TS-28", "e-Policy schedule and e-Receipt generated as PDF documents"),
    _c("TC-094", "TS-28", "POLICY_ISSUED and RECEIPT_POSTED messages queued for Core and FIN"),
    _c("TC-095", "TS-28", "Documents can be e-mailed to the participant"),
    # TS-29 expiry
    _c("TC-096", "TS-29", "Expiry job sets EXPIRED after the end date and notifies; renewal notices within the notice period"),
    # TS-30 billing dashboard
    _c("TC-097", "TS-30", "Outstanding, overdue, due-within-3-days and pending-verification figures and lists"),
    # TS-31 payments
    _c("TC-098", "TS-31", "Payment needs a proof file, a non-future date, unique policies and amounts equal to the outstanding contribution"),
    _c("TC-099", "TS-31", "One payment can cover several policies (allocations); each policy appears once"),
    _c("TC-100", "TS-31", "Finance (bo.approve.payments) verifies or rejects; other staff cannot; rejection needs remarks"),
    _c("TC-101", "TS-31", "Verification issues pay-first policies and settles issue-then-pay policies; receipt per policy"),
    _c("TC-102", "TS-31", "Negative, future-dated and excessive amounts are refused"),
    # TS-32 grace period
    _c("TC-103", "TS-32", "Issue-then-pay policies get paymentDueDate = issue date + grace days (7)"),
    _c("TC-104", "TS-32", "Daily job blocks an agency/bank with any policy unpaid past the due date and notifies its users"),
    _c("TC-105", "TS-32", "Blocked agency: every officer's submissions refused; dashboard shows the block"),
    _c("TC-106", "TS-32", "Block lifted automatically when nothing is overdue, or manually by the back-office"),
    # TS-33 commission
    _c("TC-107", "TS-33", "Commission accrued at the product rate on issuance; statement per month; paid status from FIN"),
    # TS-34 renewal
    _c("TC-108", "TS-34", "Renewals-due lists active/expired policies ending within the notice period (45 days) and up to the lapse limit"),
    _c("TC-109", "TS-34", "Renewal creates a DRAFT quotation starting the day after expiry with the same cover and nominees; only one renewal per policy"),
    _c("TC-110", "TS-34", "Renewal outside the window or for a non-renewable product is refused"),
    # TS-35 endorsement
    _c("TC-111", "TS-35", "Only active policies can be endorsed; endorsement type must be a valid code; nominee rules apply"),
    _c("TC-112", "TS-35", "Approval applies the change (nominees, details); rejection leaves the policy unchanged"),
    # TS-36 cancellation
    _c("TC-113", "TS-36", "Only active policies; reason code valid; effective date not before cover start"),
    _c("TC-114", "TS-36", "Approval sets CANCELLED; rejection keeps ACTIVE; policy stays in force meanwhile"),
    # TS-37 claims
    _c("TC-115", "TS-37", "Policy validated by number; claims only on active or expired policies"),
    _c("TC-116", "TS-37", "Event date must fall within the period of cover"),
    _c("TC-117", "TS-37", "Claim number CL/yy/nnnnnn; status transitions SUBMITTED→UNDER_REVIEW→ACKNOWLEDGED/REJECTED→CLOSED only"),
    _c("TC-118", "TS-37", "Supporting documents attached; agent tracks the status; back-office reviews"),
    # TS-38 documents
    _c("TC-119", "TS-38", "Type detected from content (PDF, PNG, JPEG only); extension forced; executables, HTML and SVG refused"),
    _c("TC-120", "TS-38", "Size limit enforced; file required; path elements removed from names"),
    _c("TC-121", "TS-38", "Documents stored encrypted with SHA-256 and listed with status; malware scan mandatory in production"),
    _c("TC-122", "TS-38", "Back-office verification: rejection needs remarks; uploader cannot verify own document; system documents need no review"),
    # TS-39 agent documents
    _c("TC-123", "TS-39", "Registration approval blocked until IC copy (or passport copy) uploaded"),
    _c("TC-124", "TS-39", "Document expiry dates recorded; expiry warning within the configured days"),
    # TS-40 dashboards
    _c("TC-125", "TS-40", "Portal dashboard: profile, production KPIs, pending actions (drafts, rejected, blocked agency)"),
    _c("TC-126", "TS-40", "Management dashboard: KPIs, 12-month trend, outstanding actions; back-office inbox and document queue"),
    # TS-41 notifications
    _c("TC-127", "TS-41", "In-app notifications created for status changes, approvals, rejections, SLA and block events; unread count; mark read"),
    _c("TC-128", "TS-41", "E-mail and SMS delivered through configured gateways with retry and logging; recorded when not configured"),
    # TS-42 issues
    _c("TC-129", "TS-42", "Issue number ISS/yy/nnnnnn; priority-based response and resolution targets from parameters"),
    _c("TC-130", "TS-42", "Assignment to active support users; priority change recomputes targets"),
    _c("TC-131", "TS-42", "Internal comments hidden from the reporter; resolution text mandatory; reporter closes"),
    _c("TC-132", "TS-42", "SLA monitor flags breaches and alerts issue managers"),
    _c("TC-133", "TS-42", "Attachments (screenshots, documents) can be added to an issue"),
    # TS-43 reports
    _c("TC-134", "TS-43", "Twelve standard reports run with date, product, agency, agent and status filters"),
    _c("TC-135", "TS-43", "Export to XLSX, CSV and PDF with correct content types; CSV cells quoted and formulas neutralised"),
    # TS-44 portal reports
    _c("TC-136", "TS-44", "Portal catalogue excludes back-office reports; data limited to the agent's scope"),
    # TS-45 schedules
    _c("TC-137", "TS-45", "Schedules validated (recipients, frequency, period); next run computed in Brunei time; generated report e-mailed"),
    # TS-46 audit
    _c("TC-138", "TS-46", "Actions recorded with actor, time, IP, entity, before/after values"),
    _c("TC-139", "TS-46", "Audit search by actor, action, entity and date; facets; restricted to bo.audit.view"),
    _c("TC-140", "TS-46", "Audit table is append-only at database level (UPDATE/DELETE rejected)"),
    # TS-47 users
    _c("TC-141", "TS-47", "User created with a generated temporary password; at least one role of the right audience"),
    _c("TC-142", "TS-47", "Self-service limits: no self-disable, self-reset or self-role-change; disabled accounts cannot sign in"),
    _c("TC-143", "TS-47", "Password reset issues a new temporary password; directory accounts excluded"),
    # TS-48 roles
    _c("TC-144", "TS-48", "Permissions must match the role audience; system roles cannot be deleted; roles in use cannot be deleted"),
    # TS-49 parameters
    _c("TC-145", "TS-49", "Parameters validated by type and range; change applied immediately and audited"),
    _c("TC-146", "TS-49", "Master data codes created, relabelled and deactivated; inactive codes refused in transactions"),
    # TS-50 workflow config
    _c("TC-147", "TS-50", "Eight workflow definitions; steps must use approval permissions; thresholds optional"),
    # TS-51 core
    _c("TC-148", "TS-51", "Inbound calls require the API key (SHA-256 compared); interface disabled without a key"),
    _c("TC-149", "TS-51", "Inbound agent status synchronisation validates the agent code and status; commission paid updates validated"),
    _c("TC-150", "TS-51", "Outbound Core messages (agent approved, policy issued) delivered to the live Core endpoint"),
    # TS-52 EOD
    _c("TC-151", "TS-52", "EOD runs for today or a past date, not the future; only one run at a time; restricted to bo.eod.run"),
    _c("TC-152", "TS-52", "EOD produces the report and the FIN interface file; re-run replaces the revision with a new idempotency key"),
    _c("TC-153", "TS-52", "Reconciliation compares issuance and receipts with FIN and records MATCHED/MISMATCH"),
    _c("TC-154", "TS-52", "Scheduled EOD at the configured time in Brunei time with a job lock"),
    # TS-53 monitor
    _c("TC-155", "TS-53", "Summary per system with success/failure counts; outbox and log views"),
    _c("TC-156", "TS-53", "Failed messages retried with exponential back-off up to max attempts, then DEAD with an alert; manual retry of failed/dead only"),
    # TS-54 connectivity
    _c("TC-157", "TS-54", "SMTP relay delivers e-mail; SMS gateway delivers SMS; failures logged and retried"),
    _c("TC-158", "TS-54", "External AML service screening in live mode"),
    _c("TC-159", "TS-54", "Core and FIN live endpoints accept the messages; FIN file ingested"),
    # TS-55 data protection
    _c("TC-160", "TS-55", "Field encryption AES-256-GCM with random IV, authentication tag and key version; blind index for exact search"),
    _c("TC-161", "TS-55", "Identification numbers returned masked; no ciphertext, hash or password hash in any response"),
    _c("TC-162", "TS-55", "HSTS and TLS termination; database and backup encryption in the target environment"),
    # TS-56 input handling
    _c("TC-163", "TS-56", "DTO whitelist: unknown properties rejected (mass assignment)"),
    _c("TC-164", "TS-56", "SQL/NoSQL/template injection payloads in search and sign-in treated as text"),
    _c("TC-165", "TS-56", "Generic error responses with correlation id; no stack traces; security headers present; framework hidden"),
    _c("TC-166", "TS-56", "Unguessable e-signature tokens; unknown routes answer a generic 404"),
    # TS-57 vuln mgmt
    _c("TC-167", "TS-57", "CI pipeline runs CodeQL, gitleaks, npm audit, Trivy and produces an SBOM; build fails on findings"),
    _c("TC-168", "TS-57", "OWASP Top 10 check script passes before each release"),
    _c("TC-169", "TS-57", "Independent VAPT and re-test with no open Critical/High findings"),
    # TS-58 MFA
    _c("TC-170", "TS-58", "Second factor required for back-office sign-in"),
    # TS-59 performance
    _c("TC-171", "TS-59", "Response time: p95 under 2 s for normal transactions at 100 concurrent users"),
    _c("TC-172", "TS-59", "Throughput and volume: daily issuance peak and five-year data growth without degradation"),
    _c("TC-173", "TS-59", "Soak test over 8 hours without memory growth or error increase"),
    # TS-60 availability
    _c("TC-174", "TS-60", "Health/readiness endpoints and metrics; alerts for API down, error rate, latency, EOD failure, dead letters"),
    _c("TC-175", "TS-60", "Failure of one application instance and failover to the standby database without data loss"),
    # TS-61 backup
    _c("TC-176", "TS-61", "Daily backups with retention; restore drill verified"),
    _c("TC-177", "TS-61", "DR failover within RTO 4 h and RPO 15 min, documented"),
    # TS-62 usability
    _c("TC-178", "TS-62", "Supported browsers and screen widths (desktop and 390 px mobile)"),
    _c("TC-179", "TS-62", "Accessibility basics: keyboard navigation, labels, contrast, focus order"),
    _c("TC-180", "TS-62", "Consistent navigation, menus and status presentation"),
    # TS-63 integrity
    _c("TC-181", "TS-63", "Issuance, receipt, audit and outbox commit atomically; numbering sequences without duplicates"),
    _c("TC-182", "TS-63", "Concurrent edits refused with STALE_RECORD (409)"),
    # TS-64 API standards
    _c("TC-183", "TS-64", "OpenAPI 3 document describes every operation; JSON error format documented"),
    # TS-65 retention
    _c("TC-184", "TS-65", "Retention and archival per agreed policy; global search"),
    # TS-66 migration
    _c("TC-185", "TS-66", "Migration dry-runs reconcile counts and control totals"),
    # TS-67 UAT
    _c("TC-186", "TS-67", "UAT scripts per product and role executed and signed off by IIFT"),
    # TS-68 readiness
    _c("TC-187", "TS-68", "Deployment rehearsal, rollback and go-live checklist"),
    # TS-69 platform
    _c("TC-188", "TS-69", "Start-up refuses missing or weak secrets and insecure production settings"),
    _c("TC-189", "TS-69", "Business date is the Brunei calendar day; date helpers correct"),
    _c("TC-190", "TS-69", "Health, readiness and API documentation switch"),
    # TS-70 web components
    _c("TC-191", "TS-70", "API client sends the CSRF token on writes, handles 401 as session end, uploads as form data"),
    _c("TC-192", "TS-70", "Error display shows messages, validation details and support references"),
    _c("TC-193", "TS-70", "Money, number, date and enum formatting"),
    _c("TC-194", "TS-70", "Permission gating, status tags and menu selection"),
    _c("TC-195", "TS-70", "Sales and admin components: nominee editor, payment filters, option labels, record links, value display"),
    _c("TC-196", "TS-70", "Sign-in page behaviour"),
]

SCENARIO_BY_ID = {s["id"]: s for s in SCENARIOS}
CONDITION_BY_ID = {c["id"]: c for c in CONDITIONS}
