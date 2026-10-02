"""Proposal chapters on scope of work (following the RFP structure) and
solution fitment."""

import brand
import compliance_matrix as cm
from docx_kit import ProposalWriter
from numbering import sec

PRODUCT = brand.PRODUCT

# (no, component, what we deliver, how, acceptance evidence) – RFP 3.1 items 1–29
COMPONENTS = [
    ("1", "Agent/Banca Portal", "Web portal (/portal) for agents, main/sub-agents and bank officers", "Configure the SalesVerse 2.0 portal for IIFT roles, products and branding", "UAT sign-off of portal scenarios"),
    ("2", "Back-office (Admin)", "Internal application (/backoffice) for IIFT and IITH staff", "Configure back-office roles, queues and dashboards; publish only on the internal network", "UAT sign-off; network test showing no internet exposure"),
    ("3", "Agent/Banca management", "Registration, profile, status, agent code, hierarchy", "Load agent master data; set numbering pattern and status rules", "SIT cases; migrated agent reconciliation"),
    ("4", "Agency/Banca management", "Agencies, banks, branches and their relationships", "Load agency and bank structure; map hierarchy to data scopes", "Hierarchy review signed by Banca/Sales"),
    ("5", "Agent/Banca onboarding", "Online application, KYC data, documents, AML, approval", "Configure document checklist and approval levels", "Journey 1 executed in UAT"),
    ("6", "Participant management", "Shared participant record, search, updates with approval, AML", "Set search criteria, duplicate rules and update workflow", "SIT and UAT cases for AP-11 to AP-16"),
    ("7", "Policy management", "Seven products, quotation, drafts, issuance, statuses, servicing", "Load IIFT rates, questionnaires and templates for all seven products", "Rate verification sheet signed by IIFT actuarial; UAT"),
    ("8", "Billing management", "Payment dashboard, single and bulk payment, verification, e-Receipt, 7-day block", "Configure payment rules, thresholds and receipt numbering", "Journey 4 in UAT; grace-period test evidence"),
    ("9", "Claims management", "Claim notification with policy validation and documents", "Configure claim types and document lists", "UAT cases for AP-43"),
    ("10", "AML/KYC", "Watch-list screening with fuzzy matching, Compliance review", "Connect to IIFT's AML provider or lists; set match threshold", "Screening test pack agreed with Compliance"),
    ("11", "Workflow management", "Configurable workflows for all approval transactions", "Load IIFT approval matrix as workflow definitions", "Approval matrix sign-off; SIT cases"),
    ("12", "Maker-checker", "Segregation of duties on every configured transaction", "Assign maker and checker permissions per role", "Negative tests: maker cannot approve own request"),
    ("13", "Document management", "Encrypted document store; e-Policy, schedule and e-Receipt PDFs", "Load IIFT templates and wording; deploy ClamAV in each environment", "Template sign-off; upload security tests"),
    ("14", "Dashboard", "Agent, bank, back-office and management dashboards", "Agree KPI definitions and targets", "Dashboard review in UAT"),
    ("15", "Reporting", "Report catalogue with filters, schedules, Excel/CSV/PDF export", "Configure the 12 existing reports; build the remaining catalogue items", "Report sign-off against sample data"),
    ("16", "Issue management", "Issue reporting, assignment, priorities, SLA timers", "Set categories, assignment rules and SLA targets", "Journey 7 in UAT"),
    ("17", "Notification", "E-mail, SMS and in-portal notifications", "Connect SMTP and SMS gateway; agree templates", "Notification test log"),
    ("18", "Audit trail", "Append-only audit with search and export", "Set retention; optional SIEM export", "Audit tamper test (UPDATE/DELETE rejected)"),
    ("19", "Administration", "Users, roles, permissions, master data, parameters", "Load IIFT roles and parameter values", "Role matrix sign-off"),
    ("20", "Integration", "Core, FIN, AML, AD, SMS, e-mail adapters with monitoring and reconciliation", "Build adapters against agreed interface specifications", "End-to-end interface tests with each system owner"),
    ("21", "Security", "Controls in Section {security}; MFA; independent VAPT", "Apply IITH policy values; remediate VAPT findings", "VAPT and re-test report (DEL-17)"),
    ("22", "Data migration", "Agent, agency, bank, participant and reference data", "Scripted extract, cleanse, load, reconcile; two rehearsals", "Signed reconciliation report"),
    ("23", "Testing", "Unit, API, SIT, regression, performance, security; UAT support", "Automated suites in CI; SIT and UAT plans", "SIT and UAT results (DEL-14, DEL-16)"),
    ("24", "Deployment", "DEV, SIT, UAT, PROD and DR environments; CI/CD; cut-over", "Container deployment on IIFT infrastructure (Option A) or iorta-managed cloud (Option B)", "Deployment plan and go-live checklist signed"),
    ("25", "Training", "Agents, bank officers, back-office, administrators, IT", "Train-the-trainer, hands-on sessions, manuals", "Attendance records and feedback"),
    ("26", "Documentation", "User, administrator, technical and operations manuals", "Update the SalesVerse 2.0 document pack for IIFT", "Document acceptance by IIFT"),
    ("27", "Warranty", "Six months of defect correction from go-live", "Fixes under the SLA at no charge", "Monthly service report"),
    ("28", "Maintenance", "Five years of support, patches and upgrades", "Service desk, monthly patch cycle, releases", "Monthly service report; quarterly review"),
    ("29", "Transition", "Knowledge transfer, handover and exit support", "Year 5 exit plan and shadow support", "Signed transition acceptance"),
]

# (area with RFP IDs, what we deliver, how, acceptance evidence)
PORTAL_AREAS = [
    ("Authentication (AP-01–04)", "Secure login, password change and reset, session control, lockout", "Server-side sessions; policy values set to IITH standards", "Security test cases; VAPT"),
    ("Agent/Banca profile (AP-05–06)", "Profile view and change requests with approval", "Profile change workflow with before and after values", "UAT case; audit record of approved change"),
    ("Agent/Banca management (AP-07–12)", "Online registration, agent code, hierarchy, agency information, shared participants", "Registration journey; data scoping by agency and bank", "Journey 1 in UAT"),
    ("Participant management (AP-13–16)", "Individual and corporate registration, search, approved updates, AML screening", "Duplicate checks on encrypted IC numbers via blind index", "SIT cases; AML test pack"),
    ("Quotation (AP-17–20)", "Authorised product list, product wizards, automatic contribution, drafts", "Seven configured products with IIFT rate tables", "Rate verification sheet; UAT"),
    ("Issuance and status (AP-21–25, AP-32–36)", "Policy list, search, details, issuance, validation, routing, restrictions, notifications, audit", "Server-side validation and workflow routing", "Journeys 2 and 3 in UAT"),
    ("Policy servicing (AP-26–31)", "Renewal, endorsement, cancellation, documents, payment status, history", "Servicing requests through maker-checker", "Journey 5 in UAT"),
    ("Billing (AP-37–42)", "Payment dashboard, bulk payment per policy, proof upload, verification, e-Receipt, 7-day block", "Billing module and nightly grace-period job", "Journey 4; grace-period test evidence"),
    ("Claims (AP-43)", "Claim notification with policy validation and documents", "Claims module", "Journey 6 in UAT"),
    ("Documents (AP-44–47)", "Policy schedule, e-Policy and e-Receipt PDFs; download, e-mail, upload, status and expiry", "IIFT templates; encrypted store; ClamAV scan", "Template sign-off; upload tests"),
    ("AML information (AP-48)", "AML/KYC data captured at onboarding", "Configurable KYC fields", "Compliance review of form"),
    ("Workflow (AP-49–51)", "Save, submit, track; status list; rejection remarks and resubmission", "My requests screen over the workflow engine", "Journey 9 in UAT"),
    ("Dashboard (AP-52–53)", "Agent dashboard and pending actions", "Role-based dashboard widgets", "UAT review"),
    ("Notifications (AP-54)", "Alerts on status changes, approvals, rejections, actions", "Notification templates per event", "Notification test log"),
    ("Issue management (AP-55–57)", "Report issues with reference number, tracking and attachments", "Issues module with SLA timers", "Journey 7 in UAT"),
    ("Reporting (AP-58)", "Role-scoped reports for agency, agent and bank", "Report catalogue with data scoping", "Report sign-off"),
    ("Security and approvals (AP-59–61)", "Role-based access, authority limits, approval history", "Permissions and data scopes; amount thresholds", "Role matrix sign-off; negative tests"),
    ("Digital signature (AP-62)", "On-screen signature, single-use e-mail link, upload of signed documents", "e-Signature module with evidence record", "UAT case; evidence sample reviewed by IIFT Legal"),
]

BACKOFFICE_AREAS = [
    ("Authentication and access (BO-01–02)", "Internal login, MFA, Active Directory sign-on, role-based access", "MFA and AD adapter built during implementation", "Security tests; VAPT"),
    ("User management (BO-03–04)", "User administration, roles and permissions", "Role builder; IIFT role matrix loaded", "Role matrix sign-off"),
    ("Agent management (BO-05–08, BO-10)", "Agent records, search, status lifecycle, hierarchy, approval of registrations and changes", "Agents module with maker-checker", "SIT cases; Journey 1"),
    ("Agency management (BO-09)", "Agency and bank records with linked agents", "Agencies and banks screens", "Hierarchy review"),
    ("Documents (BO-11–12)", "Validate, approve, reject documents; completeness and expiry", "Document checks queue", "UAT case"),
    ("AML/KYC (BO-13–15)", "Screening, results with dates, Compliance review", "AML cases and watch-list screens", "AML test pack"),
    ("Workflow (BO-16–19)", "Configurable approvals, maker-checker, status tracking, rejection remarks", "Workflow definitions for the IIFT matrix", "Journey 9; negative tests"),
    ("Dashboards (BO-20–21)", "Management KPIs and pending actions", "Back-office dashboard", "UAT review"),
    ("Reporting (BO-22–25)", "Standard reports, filters, Excel/CSV/PDF export, schedules", "12 existing reports plus the agreed catalogue", "Report sign-off"),
    ("Audit (BO-26–28)", "Audit of activity and changes with before and after values; search", "Append-only audit table protected by trigger", "Tamper test; audit search demo"),
    ("Issue management (BO-29–31)", "Assignment, priorities, SLA monitoring", "Issue rules and SLA targets", "Journey 7"),
    ("Administration (BO-32–33)", "Master data and configurable rules, statuses, levels, parameters", "Parameters and master data screens", "Configuration workbook signed"),
]

INTEGRATION_AREAS = [
    ("Core system (INT-01–03)", "Agent, agency and bank master synchronisation; agent information exchange", "Adapter over the outbox; API or file per IITH capability", "End-to-end test with core owner"),
    ("Financial system (INT-04–05)", "EOD FIN interface file, receipts, commission and referral fee data", "FIN file format agreed; SFTP or API delivery", "Journey 8; FIN reconciliation sign-off"),
    ("Identity (INT-06)", "Active Directory single sign-on for back-office", "LDAPS adapter", "Login test with IITH accounts"),
    ("Notifications (INT-07–08)", "E-mail through IIFT SMTP; SMS through IIFT gateway", "SMTP and SMS adapters", "Delivery test log"),
    ("APIs (INT-09–11)", "Secure REST APIs, authentication, monitoring", "OpenAPI 3; mTLS or OAuth2; integration monitor", "API security tests; monitor demo"),
    ("Data (INT-12–15)", "Validation, error handling and retry, logging, reconciliation", "Schema validation; outbox retry and dead-letter; daily reconciliation", "Failure-injection tests; reconciliation report"),
]

SHARED_AREAS = [
    ("Security (COM-01, 02, 10)", "Protection of sensitive data, access control, encryption", "Controls in Section {security}", "VAPT; encryption check"),
    ("Audit (COM-03)", "Common audit service", "Append-only audit", "Tamper test"),
    ("Workflow (COM-04)", "Configurable workflows by type, role, level, rule", "Workflow engine", "Approval matrix tests"),
    ("Notification (COM-05)", "E-mail, SMS, portal notifications", "Notification service and templates", "Notification test log"),
    ("Documents (COM-06)", "Secure document repository", "Encrypted storage; access through API only", "Access tests"),
    ("Search (COM-07)", "Global search across records", "Search with configurable criteria", "UAT case"),
    ("Reporting (COM-08)", "Common reporting framework", "Report definitions, exports, schedules", "Report sign-off"),
    ("Configuration (COM-09)", "Parameters maintained without code changes", "Parameters and master data screens", "Configuration workbook signed"),
]

NFR_AREAS = [
    ("Performance (NFR-01–03)", "Agreed response times for 100 concurrent users and projected volume", "k6 load, stress and soak tests on production-like SIT", "Performance test report (DEL-18)"),
    ("Availability (NFR-04–05)", "99.5% overall, 99.9% in business hours; no single point of failure", "Two app nodes, database standby, load balancer pair", "Monthly availability report"),
    ("Scalability (NFR-06–07)", "Growth in users and volume without redesign", "Stateless API nodes; indexed schema", "Capacity statement in SAD"),
    ("Security (NFR-08–14)", "Encryption, authentication, authorisation, audit, vulnerability management, VAPT, secure SDLC", "Section {security}", "VAPT report; scan results"),
    ("Reliability (NFR-15–16)", "Controlled errors; transaction integrity", "Generic messages with correlation id; ACID transactions", "Negative tests"),
    ("Backup and DR (NFR-17–19)", "Backups, DR to RPO 15 minutes and RTO 4 hours, DR tests", "WAL archiving; warm standby; annual DR test", "Restore test and DR test reports"),
    ("Maintainability (NFR-20–21)", "Modular design; maintained documentation", "Modular monolith; document pack updated per release", "Document acceptance"),
    ("Usability and accessibility (NFR-22–24)", "Consistent UI, browser support, WCAG 2.1 AA target", "One design system; browser test matrix; accessibility check", "UAT feedback; accessibility check report"),
    ("Compatibility (NFR-25)", "Standard APIs", "REST/JSON, OpenAPI 3", "API specification"),
    ("Monitoring and logging (NFR-26–28)", "System monitoring, alerting, central logs", "Prometheus, Grafana, central log store", "Alert test during SIT"),
    ("Data (NFR-29–30)", "Retention and data quality", "Retention rules; validation and constraints", "Retention configuration signed"),
]

# (id, deliverable, content and approach, due week, acceptance evidence)
DELIVERABLES = [
    ("DEL-01", "Project charter", "Objectives, scope, governance, stakeholders, assumptions, milestones", "Wk 2", "Steering Committee approval"),
    ("DEL-02", "Project plan", "Activities, dependencies, resources, timeline; updated fortnightly", "Wk 2", "IIFT PM approval"),
    ("DEL-03", "Business requirement specification", "Agreed processes from fit-gap workshops on the working system", "Wk 4", "Business owner sign-off"),
    ("DEL-04", "Functional requirement specification", "Rules, screens, reports and configuration per product", "Wk 5", "Business owner sign-off"),
    ("DEL-05", "Requirements traceability matrix", "Every RFP ID traced to design, test and acceptance", "Wk 6, kept current", "Final RTM at closure"),
    ("DEL-06", "Solution architecture", "Application, infrastructure, security, integration, deployment", "Wk 6", "Design Authority sign-off"),
    ("DEL-07", "Technical design", "Components, database, APIs, interfaces, configuration", "Wk 6", "Design Authority sign-off"),
    ("DEL-08", "UI/UX design", "Screen designs and journeys based on the working screens", "Wk 5", "Business owner sign-off"),
    ("DEL-09", "Interface specification", "APIs, mappings, methods, security, error handling per interface", "Wk 6", "System owner sign-off"),
    ("DEL-10", "Configured solution", "SalesVerse 2.0 configured and integrated for IIFT", "Wk 16", "Build-complete demo (M3)"),
    ("DEL-11", "Source code", "Source code of IIFT-specific components (configuration, adapters, reports, templates), build scripts, migrations; core platform via Option C or escrow", "Wk 24 and each release", "Repository handover checklist"),
    ("DEL-12", "Test strategy", "Levels, roles, environments, entry and exit criteria", "Wk 6", "IIFT approval"),
    ("DEL-13", "SIT test cases", "Scenarios traced to requirements", "Wk 14", "IITH IT review"),
    ("DEL-14", "SIT results", "Execution evidence, defect log, closure", "Wk 19", "SIT exit sign-off (M4)"),
    ("DEL-15", "UAT test cases", "Business scenarios per product and role", "Wk 18", "Business owner review"),
    ("DEL-16", "UAT results", "Execution evidence and business sign-off", "Wk 22", "UAT certificate (M5)"),
    ("DEL-17", "Security assessment", "Independent VAPT, remediation, re-test", "Wk 19", "No open Critical or High findings"),
    ("DEL-18", "Performance test report", "Load, stress and soak results against targets", "Wk 19", "Targets met"),
    ("DEL-19", "Data migration plan", "Extraction, transformation, validation, reconciliation", "Wk 8", "Data owner sign-off"),
    ("DEL-20", "Deployment plan", "Sequence, roles, rollback and contingency", "Wk 21", "IITH IT approval"),
    ("DEL-21", "Go-live checklist", "Technical, operational, security, business, support readiness", "Wk 23", "Go/no-go decision"),
    ("DEL-22", "User training", "Agents, bank officers, back-office users", "Wk 21–23", "Attendance and feedback"),
    ("DEL-23", "Administrator training", "Administrators and support staff", "Wk 22–23", "Attendance and hands-on check"),
    ("DEL-24", "User manual", "Portal and back-office guides with screenshots", "Wk 21", "Document acceptance"),
    ("DEL-25", "Administrator manual", "Configuration, user administration, operations support", "Wk 21", "Document acceptance"),
    ("DEL-26", "Technical manual", "Architecture, database, API, integration, deployment", "Wk 23", "Document acceptance"),
    ("DEL-27", "Operations manual", "Monitoring, backup, incidents, routine operations", "Wk 23", "Document acceptance"),
    ("DEL-28", "Production deployment", "Deployment per approved plan", "Wk 24", "Go-live confirmation (M6)"),
    ("DEL-29", "Go-live support", "Four weeks of hypercare", "Wk 25–28", "Hypercare exit criteria met"),
    ("DEL-30", "Project closure report", "Status, open items, lessons, acceptance", "Wk 28", "Closure sign-off (M7)"),
]

# (id, requirement, what we deliver and how, acceptance evidence)
MAINTENANCE = [
    ("MNT-01", "Helpdesk support", "Service desk via issue module, e-mail and phone for five years", "Ticket records"),
    ("MNT-02", "Incident management", "Record, classify, investigate, resolve, close", "Monthly incident statistics"),
    ("MNT-03", "Problem management", "Root-cause analysis for P1, P2 and recurring incidents", "RCA reports within 5 business days"),
    ("MNT-04", "Service requests", "User support, configuration and operational help", "Request log"),
    ("MNT-05", "Critical incident SLA", "P1: 30-minute response, 4-hour restoration, 24x7", "SLA report"),
    ("MNT-06", "High priority SLA", "P2: 2-hour response, 1 business day", "SLA report"),
    ("MNT-07", "Medium/Low/Cosmetic SLA", "P3: 4 business hours / 3 business days; P4: 1 business day / next release", "SLA report"),
    ("MNT-08", "Bug fixing", "Defects fixed under warranty, then under maintenance", "Release notes"),
    ("MNT-09", "Corrective maintenance", "Changes needed to keep functions working", "Release notes"),
    ("MNT-10", "Preventive maintenance", "Monthly health check of logs, jobs, capacity, queries, certificates", "Health check in monthly report"),
    ("MNT-11", "Security patches", "Monthly patch cycle; emergency patches as needed", "Patch log"),
    ("MNT-12", "Vulnerability remediation", "Critical 7 days, High 14, Medium 30, Low 90", "Vulnerability register"),
    ("MNT-13", "Certificate management", "Inventory, expiry alerts, renewal support", "Certificate register"),
    ("MNT-14", "OS/platform compatibility", "Compatibility with supported OS, Node.js, PostgreSQL", "Compatibility statement per release"),
    ("MNT-15", "Browser compatibility", "Current and previous browser versions", "Browser test record"),
    ("MNT-16", "Database maintenance", "Health checks, vacuum and index tuning, upgrades", "Health check results"),
    ("MNT-17", "Performance monitoring", "Monthly review and tuning advice", "Performance section of monthly report"),
    ("MNT-18", "System monitoring", "Availability and component monitoring with alerts", "Availability figures"),
    ("MNT-19", "Backup verification", "Quarterly restore test", "Restore test record"),
    ("MNT-20", "Disaster recovery", "DR planning and annual DR test", "DR test report"),
    ("MNT-21", "Release management", "Tested, approved releases in agreed windows", "Release records and approvals"),
    ("MNT-22", "Version upgrade", "Application and platform upgrades, including SalesVerse 2.0 updates", "Upgrade release notes"),
    ("MNT-23", "Minor enhancement", "60 hours a year included; more at rate card", "Enhancement log"),
    ("MNT-24", "Change request", "Impact assessment, quotation, approval, delivery", "Signed CR forms"),
    ("MNT-25", "Monthly service report", "Incidents, SLA, availability, changes, open issues", "Report issued monthly"),
    ("MNT-26", "Quarterly review", "Service performance and improvement plan", "Minutes and action log"),
    ("MNT-27", "Documentation updates", "Documents updated after material change", "Document version history"),
    ("MNT-28", "Knowledge transfer", "Sessions for IIFT/IITH support staff", "Session records"),
    ("MNT-29", "Onsite support", "Onsite for major incidents or upgrades (rate card plus OPE)", "Visit reports"),
    ("MNT-30", "Transition support", "Year 5 knowledge transfer, documents and technical help", "Transition acceptance"),
]

AREA_COLUMNS = ["RFP area and IDs", "What we deliver", "How", "Acceptance evidence"]
AREA_WIDTHS = [3.6, 5.6, 4.6, 3.2]


def _format(rows):
    return [[cell.format(security=sec("security")) for cell in row] for row in rows]


def scope_of_work(w: ProposalWriter):
    w.h1("Scope of Work")
    w.para(f"We will configure, integrate, test, deploy and support {PRODUCT} as the {brand.SOLUTION_NAME}, with "
           "training, documentation, a six-month warranty and five years of maintenance. This chapter follows the "
           "RFP structure. For each item it states what we deliver, how, and the evidence IIFT uses to accept it. "
           f"Fitment against the working platform is in Section {sec('fitment')}; the per-ID matrix is in Annex A.")
    w.h2("In-scope components (RFP 3.1)")
    w.table(["#", "Component", "What we deliver", "How", "Acceptance evidence"], _format(COMPONENTS),
            widths=[0.7, 2.9, 5.0, 5.0, 3.4], font_size=7.5, padding=30, center_cols=(0,),
            caption="In-scope components 1 to 29")
    w.h2("Agent/Banca Portal functions (RFP 4.1)")
    w.table(AREA_COLUMNS, _format(PORTAL_AREAS), widths=AREA_WIDTHS, font_size=7.5, padding=30, bold_first_col=True)
    w.h2("Back-office functions (RFP 4.2)")
    w.table(AREA_COLUMNS, _format(BACKOFFICE_AREAS), widths=AREA_WIDTHS, font_size=7.5, padding=30,
            bold_first_col=True)
    w.h2("Integration (RFP 4.3)")
    w.table(AREA_COLUMNS, _format(INTEGRATION_AREAS), widths=AREA_WIDTHS, font_size=7.5, padding=30,
            bold_first_col=True)
    w.h2("Shared platform (RFP 4.4)")
    w.table(AREA_COLUMNS, _format(SHARED_AREAS), widths=AREA_WIDTHS, font_size=7.5, padding=30, bold_first_col=True)
    w.h2("Non-functional requirements (RFP 5)")
    w.table(AREA_COLUMNS, _format(NFR_AREAS), widths=AREA_WIDTHS, font_size=7.5, padding=30, bold_first_col=True)
    w.h2("Deliverables (RFP 7)")
    w.para("Documents are delivered in Word or Excel and PDF. IIFT reviews within five business days and we issue "
           "the final version within three business days of comments.")
    w.table(["ID", "Deliverable", "Content and approach", "Due", "Acceptance evidence"], DELIVERABLES,
            widths=[1.5, 3.6, 6.0, 2.4, 3.5], font_size=7.5, padding=30, bold_first_col=True,
            caption="Deliverables DEL-01 to DEL-30")
    w.h2("Maintenance and support (RFP 8)")
    w.table(["ID", "Requirement", "What we deliver and how", "Acceptance evidence"], MAINTENANCE,
            widths=[1.5, 3.6, 8.0, 3.9], font_size=7.5, padding=30, bold_first_col=True,
            caption="Maintenance requirements MNT-01 to MNT-30")


# =============================================================================
# Solution fitment
# =============================================================================
CAPABILITY_STATUS = [
    ["Products and rating", "Seven Appendix 3 products (FTP-HP, FTP-NP, PFT, PHA, PRO, KHR, OSA) with configurable rating", "IIFT actuarial rate tables replace the indicative rates; questionnaires and templates loaded"],
    ["Underwriting referral", "Financing above B$150,000 referred to IIFT Sales", "Further referral rules agreed in design"],
    ["Payment control", "Seven-day grace-period block on all agents of an agency", "Bank-specific settlement rules, if any"],
    ["Approvals", "Maker-checker with configurable levels and amount thresholds, e.g. second approval from B$300,000 sum covered", "IIFT approval matrix and approver roles"],
    ["AML/KYC", "Watch-list screening with fuzzy name matching; Compliance review queue; a confirmed match rejects the subject's pending requests", "Adapter to IIFT's AML provider or lists"],
    ["e-Signature", "On-screen signature and single-use e-mail link", "Evidence format agreed with IIFT Legal"],
    ["Documents", "e-Policy and e-Receipt PDFs; encrypted document storage; ClamAV scan of uploads, mandatory in production", "IIFT templates, wording and branding"],
    ["End of day", "EOD report, FIN interface file, receipt reconciliation; re-runs sent to FIN as numbered revisions", "FIN file format sign-off; BRR reconciliation"],
    ["Integration", "Transactional outbox with retry and dead-letter", "Adapters to IIFT core, FIN, AML provider, SMS gateway, SMTP and Active Directory"],
    ["Reports", "12 standard reports; Excel, CSV and PDF export; scheduling", "Remaining reports from the agreed catalogue"],
    ["Audit and data protection", "Append-only audit enforced by a database trigger; AES-256-GCM encryption of IC and passport numbers", "Retention and archival job; key rotation tooling; SIEM export"],
    ["Access", "Login, users, roles and permissions", "IITH password and session values; MFA for back-office"],
]

DELIVERED_IN_IMPLEMENTATION = [
    "Adapters to IIFT's core system, FIN, AML provider, SMS gateway, SMTP relay and Active Directory. Each needs "
    "IIFT's interface specification, test endpoint and credentials before it can be completed.",
    "IIFT's actuarial rate tables, questionnaires, product wording and document templates, replacing the indicative "
    "values in the working system.",
    "MFA for back-office users, production and DR infrastructure set-up, performance testing and the independent "
    "VAPT.",
    "Data migration, UAT, training and the IIFT-specific document set.",
]


FITMENT_AREAS = ["Agent/Banca Portal (RFP 4.1)", "Back-office (RFP 4.2)", "Integration (RFP 4.3)",
                 "Shared platform (RFP 4.4)", "Non-functional (RFP 5)", "Deliverables (RFP 7)",
                 "Maintenance and support (RFP 8)"]


def fitment_chapter(w: ProposalWriter):
    w.h1("Solution Fitment")
    w.para(f"Each functional and non-functional requirement is classified against {PRODUCT} as it runs today. The "
           "four categories are:")
    w.table(["Category", "Meaning"], [
        [cm.FITMENT_HEADINGS["A"], "Works in the current platform; IIFT can see it in the demonstration."],
        [cm.FITMENT_HEADINGS["C"], "Supported by the platform; needs IIFT values, rates, templates or rules."],
        [cm.FITMENT_HEADINGS["I"], "Adapter built on the platform's integration layer; completed once IIFT "
                                   "provides endpoints and credentials."],
        [cm.FITMENT_HEADINGS["D"], "Work or services performed during the project or, for MNT items, during "
                                   "maintenance."],
    ], widths=[5.0, 12.0], font_size=8, bold_first_col=True)
    rows = []
    totals = {code: 0 for code in cm.FITMENT_LABELS}
    grand = 0
    for (title, counts, total), area in zip(cm.fitment_summary(), FITMENT_AREAS):
        rows.append([area, *[str(counts[code]) for code in cm.FITMENT_LABELS], str(total)])
        for code in totals:
            totals[code] += counts[code]
        grand += total
    rows.append(["Total", *[str(totals[code]) for code in cm.FITMENT_LABELS], str(grand)])
    w.table(["RFP area", "Available today", "Configuration", "Integration", "During implementation", "Total"], rows,
            widths=[6.0, 2.2, 2.2, 2.2, 2.4, 2.0], font_size=8, center_cols=(1, 2, 3, 4, 5), total_rows=1,
            caption="Fitment by RFP area (number of requirement IDs)")
    w.para(f"The 24 commercial requirements (RFP section 6) are contractual commitments rather than functions; they "
           f"are answered in Section {sec('commercials')} and listed in Annex A without a fitment category.")
    w.h2("What runs today and what is completed in the project")
    w.table(["Capability", "Available in SalesVerse 2.0 today", "Completed during implementation"],
            CAPABILITY_STATUS, widths=[3.2, 7.4, 6.4], font_size=8, bold_first_col=True,
            caption="Capability status")
    w.h2("Work that depends on IIFT")
    w.bullets(DELIVERED_IN_IMPLEMENTATION)
