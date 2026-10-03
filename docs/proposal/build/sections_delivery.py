"""Proposal sections 12, 13 and 15–18: methodology, timeline, maintenance and
support, team, assumptions and risks."""

import brand
import pricing_data as price
from docx_kit import ProposalWriter
from numbering import sec

PRODUCT = brand.PRODUCT


# =============================================================================
# 12. Implementation methodology
# =============================================================================
PHASES = [
    ["0", "Mobilisation", "1–2", "Kick-off, governance set-up, environment and data requests, detailed plan", "Project charter, project plan (DEL-01, 02)"],
    ["1", "Discovery and fit-gap confirmation", "2–6", "Workshops per product and process on the working system; collect IIFT rates, wording, questionnaires, templates; confirm gaps", "BRS, FRS, RTM, SAD, TDD, UI/UX, interface specification, test strategy (DEL-03 to 09, 12)"],
    ["2", "Configuration sprints", "6–16", "Five two-week sprints configuring products, rates, workflows, roles, reports and templates; demo every sprint", "Configured solution, source code (DEL-10, 11)"],
    ["3", "Integration with IIFT systems", "8–17", "Adapters to core, FIN, AML provider, SMS, SMTP and Active Directory; joint tests with system owners", "Working interfaces, test evidence"],
    ["4", "SIT, performance and VAPT", "16–19", "SIT, regression, performance test, independent VAPT, remediation, re-test", "SIT results, performance report, security assessment (DEL-13, 14, 17, 18)"],
    ["5", "UAT, migration rehearsals, training", "19–23", "UAT support, two migration rehearsals, train-the-trainer and end-user training, manuals", "UAT results, migration plan, training, manuals (DEL-15, 16, 19, 22 to 27)"],
    ["6", "Cut-over and go-live", "24", "Production deployment, final migration, go/no-go", "Deployment plan, go-live checklist, production deployment (DEL-20, 21, 28)"],
    ["7", "Hypercare and closure", "25–28", "Hypercare, stabilisation, handover to support, closure", "Go-live support, closure report (DEL-29, 30)"],
]

SPRINTS = [
    ["Sprint 1 (wk 6–7)", "Access set-up to IITH policy, MFA, roles and data scopes; agent, agency and bank master data loaded"],
    ["Sprint 2 (wk 8–9)", "Onboarding and approval matrix; participant rules; AML connection to IIFT's screening service"],
    ["Sprint 3 (wk 10–11)", "IIFT actuarial rates, questionnaires and document templates for all seven products"],
    ["Sprint 4 (wk 12–13)", "Referral and QC rules, policy servicing, e-Policy and e-Receipt wording and branding"],
    ["Sprint 5 (wk 14–15)", "Payment rules, EOD and FIN file sign-off, BRR reconciliation, remaining reports, notifications"],
    ["Hardening (wk 16)", "Performance tuning, security hardening, defect fixing, documentation; build complete (M3)"],
]

GOVERNANCE_FORUMS = [
    ["Steering Committee", "IIFT sponsor (chair), IITH IT head, IIFT business heads, iorta Engagement Director, both PMs", "Monthly and at milestone gates", "Direction, milestone approval, escalated risks and changes, go/no-go"],
    ["Project Working Committee", "IIFT PM, iorta PM, business and IT leads", "Weekly", "Progress, RAID log, dependencies, decisions"],
    ["Sprint review & planning", "Product owner, key users, iorta team", "Every two weeks", "Demo of completed features, backlog priorities"],
    ["Design Authority", "IITH IT architecture & security, iorta Solution Architect", "As needed in phases 1–4", "Architecture, security and integration decisions"],
    ["Change Control Board", "IIFT PM, sponsor delegate, iorta PM", "As needed", "Assess and approve change requests"],
]

RACI = [
    ["Project governance & reporting", "A", "R", "I", "I", "R", "C"],
    ["Requirements & process sign-off", "A", "R", "R", "C", "C", "R"],
    ["Solution design & architecture", "I", "C", "C", "A", "R", "R"],
    ["Build & configuration", "I", "I", "C", "C", "A", "R"],
    ["Infrastructure provisioning (Option A)", "I", "C", "I", "A/R", "C", "C"],
    ["Interface availability (Core, FIN, AML, AD)", "I", "C", "I", "A/R", "C", "R"],
    ["SIT & performance testing", "I", "I", "I", "C", "A", "R"],
    ["VAPT (independent)", "I", "C", "I", "C", "A", "R"],
    ["UAT execution & sign-off", "A", "R", "R", "C", "C", "C"],
    ["Data extraction from legacy sources", "I", "C", "R", "A", "C", "C"],
    ["Data transformation, load & reconciliation", "I", "C", "R", "C", "A", "R"],
    ["Training delivery", "I", "C", "R", "C", "A", "R"],
    ["Go-live decision", "A", "R", "C", "C", "C", "I"],
    ["Hypercare & support", "I", "C", "C", "C", "A", "R"],
]

TEST_LEVELS = [
    ["Unit", "Business rules, rating engines, validators, web components", "iorta developers", "DEV / CI", "Vitest and Testing Library; coverage ≥ 70% on core modules"],
    ["API / integration", "Endpoints, permissions per role, database constraints", "iorta", "CI with PostgreSQL", "Vitest e2e; every endpoint has positive and negative tests"],
    ["SIT", "End-to-end flows across portal, back-office and interfaces", "iorta QA, IITH system owners", "SIT", "No open Critical/High defects; ≥ 95% pass"],
    ["Regression", "Automated suite re-run every sprint and release", "iorta QA", "SIT", "Playwright; 100% of critical paths automated"],
    ["Performance", "Load (100 concurrent), stress and soak", "iorta", "SIT (production-like)", "k6; non-functional targets met"],
    ["Security", "SAST/SCA/DAST in pipeline; independent VAPT and re-test", "iorta, independent tester", "SIT / pre-prod", "No open Critical/High findings"],
    ["UAT", "Business scenarios per product and role", "IIFT users with iorta support", "UAT", "Signed UAT certificate; no open Critical/High defects"],
    ["Migration", "Dry-runs, reconciliation, sample verification", "iorta, IIFT data owners", "UAT", "100% record count and control-total match"],
]

DEFECT_SEVERITY = [
    ["Critical", "System unusable or data integrity at risk; no workaround", "Fix before exit of current test phase"],
    ["High", "Key function fails; workaround difficult", "Fix before exit of current test phase"],
    ["Medium", "Function impaired; workaround exists", "Fix before go-live or agreed deferral"],
    ["Low", "Cosmetic or minor", "Planned release"],
]

MIGRATION_STEPS = [
    ["Discovery & profiling", "Identify sources (spreadsheets, existing agent records, IIGT/core extracts), profile quality, agree scope"],
    ["Mapping & rules", "Field mapping to target model, transformation and cleansing rules, ownership of corrections"],
    ["Tooling", "Repeatable scripts (TypeScript/SQL) with validation reports; no manual re-keying"],
    ["Dry-run 1 & 2", "Full loads in UAT; exceptions corrected at source; reconciliation reports"],
    ["Reconciliation", "Record counts, control totals, mandatory-field completeness, sample verification by business owners"],
    ["Production load", "Executed during cut-over; signed reconciliation before users are enabled"],
]

TRAINING = [
    ["Agents & bank officers (Portal)", "Train-the-trainer plus two hands-on sessions", "Half day per session", "Up to 21 users (12 bank, 4 agent, 5 IIFT portal)", "Quick reference guide, video walkthroughs, user manual"],
    ["Back-office users", "Hands-on workshop per role", "1 day", "IIFT admin, Finance, Compliance, Underwriting users", "Role-based user manual, exercises"],
    ["System administrators", "Workshop", "1 day", "IITH/IIFT administrators", "Administrator manual, configuration guide"],
    ["Technical team", "Technical handover sessions", "2 days", "IITH IT support, infrastructure, security", "Technical and operations manuals, runbooks"],
    ["Management", "Briefing and dashboard demo", "1 hour", "IIFT management", "Dashboard guide"],
]

CHANGE_MANAGEMENT = [
    "Stakeholder map and communication plan covering IIFT teams, bank partners and agencies.",
    "Early involvement of key users in design workshops and sprint demos to build ownership.",
    "Bank and agent onboarding pack: invitation e-mail, account activation guide, FAQ and support contacts.",
    "Super-user network within IIFT to provide first-line help after go-live.",
    "Adoption metrics on the management dashboard (active users, digital submissions, turnaround times).",
]

HYPERCARE = [
    "Four weeks immediately after go-live (weeks 25–28) with the core delivery team on standby.",
    "Daily health checks of application, jobs, EOD and integrations; daily stand-up with IIFT during the first two weeks.",
    "Priority fixing of go-live defects; daily defect and usage report.",
    "Onsite presence for go-live and the first month of support: a Senior Developer for the month and the Project "
    "Manager in go-live week; the rest of the team supports remotely.",
    "Formal handover to the maintenance team and hypercare exit criteria: no open P1/P2 issues, EOD stable for ten "
    "consecutive business days, all interfaces reconciled.",
]


TECH_DOCS = [
    ["SalesVerse-2.0-Solution-Architecture.docx", "Logical, functional and deployment architecture; integration and security architecture; on-premise and cloud infrastructure sizing", "DEL-06, DEL-07, DEL-09 (baseline)"],
    ["SalesVerse-2.0-Data-Dictionary.xlsx and .docx", "Every table and field with type, constraints, encryption and retention", "DEL-07, DEL-26"],
    ["SalesVerse-2.0-Code-Standards-and-Quality-Report.docx", "Coding standards, review process, automated test coverage and static analysis results", "NFR-14, NFR-20"],
    ["SalesVerse-2.0-Security-Assessment-Report.docx", "Internal vulnerability assessment and security test results; the independent third-party penetration test follows before go-live", "NFR-12 to NFR-14; DEL-17 (precursor)"],
    ["SalesVerse-2.0-Production-Support-Handover.docx", "Support process, runbooks, knowledge transfer and release management", "DEL-27, MNT-01 to MNT-04, MNT-21, MNT-28"],
]


def technical_documents(w: ProposalWriter):
    w.h1("Technical Document Pack")
    w.para(f"The documents below accompany this proposal in the folder docs/technical. They describe {PRODUCT} as it "
           "stands today and become the baseline of the corresponding project deliverables, updated for IIFT during "
           "the project.")
    w.table(["Document", "Content", "RFP references"], TECH_DOCS, widths=[5.6, 7.8, 3.6], font_size=8,
            bold_first_col=True, caption="Technical document pack and the deliverables it seeds")


def methodology(w: ProposalWriter, figs: dict):
    w.h1("Implementation Methodology")
    w.h2("Delivery approach: configure and integrate")
    w.paras([
        f"Because {PRODUCT} already runs IIFT's products and rules (Section {sec('fitment')}), the project configures "
        "and integrates an existing platform rather than building one. Discovery is a series of fit-gap workshops on "
        "the working system: IIFT users walk through each journey with their own products, confirm what fits and "
        "record the gaps, and the gaps become the configuration backlog.",
        "Governance follows formal gates, so IIFT signs off scope, design, test exit and go-live at fixed points and "
        "pays against them. Configuration and integration run in two-week sprints, each ending with a demonstration "
        "to IIFT key users. SIT, an independent VAPT, UAT, two migration rehearsals and a rehearsed cut-over follow, "
        "then four weeks of hypercare.",
        "The Steering Committee reviews each gate: design sign-off (M2), build complete (M3), SIT exit and security "
        "clearance (M4), UAT sign-off (M5), go-live (M6) and hypercare exit (M7).",
    ])
    w.h2("Phases and activities")
    w.table(["#", "Phase", "Weeks", "Key activities", "Outputs"], PHASES, widths=[0.7, 3.1, 1.4, 6.3, 5.5],
            font_size=8, center_cols=(0, 2), caption="Implementation phases")
    w.h3("Configuration sprints")
    w.table(["Sprint", "Scope"], SPRINTS, widths=[3.4, 13.6], bold_first_col=True)
    w.para(f"All 30 deliverables of RFP section 7 are produced; the due week and acceptance evidence of each are in "
           f"Section {sec('scope')}.")
    w.h2("Project governance")
    w.figure(figs["governance"], "Project governance structure", width_cm=16.0)
    w.table(["Forum", "Members", "Frequency", "Purpose"], GOVERNANCE_FORUMS, widths=[3.4, 6.0, 2.8, 4.8],
            font_size=8, bold_first_col=True)
    w.para("Progress is reported weekly to the Working Committee (status, milestones and the RAID log of risks, "
           "assumptions, issues and dependencies) and monthly to the Steering Committee. Anything the Working "
           "Committee cannot resolve within five business days goes to the Steering Committee.")
    w.h3("RACI matrix")
    w.para("R = Responsible, A = Accountable, C = Consulted, I = Informed.")
    w.table(["Activity", "IIFT Sponsor", "IIFT PM", "IIFT business", "IITH IT", "iorta PM", "iorta team"], RACI,
            widths=[5.6, 1.9, 1.9, 1.9, 1.9, 1.9, 1.9], font_size=8, center_cols=(1, 2, 3, 4, 5, 6))
    w.h2("Quality assurance")
    w.para("A feature is done when its code is reviewed, its automated tests and security scans pass, its "
           "documentation is updated and the product owner has seen it working. The traceability matrix (DEL-05) "
           "links every RFP requirement ID to design, build, test case and acceptance evidence. Each major document "
           "is reviewed internally by someone outside the delivery team before it reaches IIFT.")
    w.h2("Testing strategy")
    w.table(["Level", "Scope", "Responsibility", "Environment", "Tools / exit criteria"], TEST_LEVELS,
            widths=[2.2, 4.3, 3.3, 2.4, 4.8], font_size=8, bold_first_col=True, caption="Test levels, responsibilities and exit criteria")
    w.table(["Defect severity", "Definition", "Resolution in test phases"], DEFECT_SEVERITY, widths=[3.0, 7.5, 6.5],
            bold_first_col=True)
    w.h2("Data migration approach")
    w.para("Migration covers existing agent, agency, bank and branch records, participant records needed for "
           "servicing, and reference data. Sources and volumes are confirmed in the Data Migration Plan (DEL-19).")
    w.table(["Step", "Description"], MIGRATION_STEPS, widths=[3.8, 13.2], bold_first_col=True)
    w.h2("Training plan")
    w.table(["Audience", "Format", "Duration", "Participants", "Materials"], TRAINING,
            widths=[3.4, 3.4, 2.2, 4.0, 4.0], font_size=8, bold_first_col=True, caption="Training by audience")
    w.h2("Change management")
    w.bullets(CHANGE_MANAGEMENT)
    w.h2("Hypercare")
    w.bullets(HYPERCARE)


# =============================================================================
# 13. Timeline
# =============================================================================
def timeline(w: ProposalWriter, figs: dict, phases, milestones):
    w.h1("Delivery and Implementation Timeline")
    w.para("Production go-live is in week 24 counted from kick-off, followed by four weeks of hypercare. The "
           "six-month warranty and Year 1 of maintenance (the AMC under Option A, the subscription under Option B) "
           "both start at go-live; defects found under warranty are fixed free of charge.")
    w.figure(figs["gantt"], "Delivery plan (weeks from kick-off)", width_cm=17.0)
    w.h2("Key milestones")
    milestone_rows = []
    payment_lookup = {code: share for code, _, share in price.SERVICE_MILESTONES}
    for code, week, label in milestones:
        share = payment_lookup.get(code)
        milestone_rows.append([code, label, f"Week {week}", f"{share:.0%}" if share else "–"])
    w.table(["Milestone", "Description", "Target", "Services fee"], milestone_rows, widths=[2.4, 9.0, 2.8, 2.8],
            center_cols=(0, 2, 3), caption="Milestones and linked payments")
    licence = {code: share for code, _, share in price.LICENCE_MILESTONES}
    w.para(f"Under Option A the licence fee is paid separately: {licence['L1']:.0%} at contract signing, "
           f"{licence['L2']:.0%} on installation in SIT and {licence['L3']:.0%} at go-live. Amounts are in Section "
           f"{sec('commercials')}.")
    w.h2("Dependencies on the critical path")
    w.bullets([
        "Contract signature and kick-off date (week 1 starts at kick-off).",
        "Availability of IIFT business owners for workshops in weeks 2–5 and sign-off of design by week 6.",
        "SIT and UAT environments (VMs, network, database access) available by week 8 and week 16 respectively.",
        "Interface specifications, test endpoints and credentials for Core, FIN, AML and AD available by week 8.",
        "IIFT actuarial rate tables and product documents (proposal forms, PDS, questionnaires) by week 6.",
        "UAT participants available in weeks 19–22; legacy data extracts available by week 12.",
    ])


# =============================================================================
# 15. Maintenance and support
# =============================================================================
SLA = [
    ["P1 Critical", "Production down or critical function unavailable for all users; data integrity or security breach", "30 minutes", "4 hours (restore / workaround)", "24x7"],
    ["P2 High", "Major function impaired for many users; no reasonable workaround", "2 hours", "1 business day", "IIFT business hours"],
    ["P3 Medium", "Function impaired with workaround; limited users affected", "4 business hours", "3 business days", "IIFT business hours"],
    ["P4 Low / Cosmetic", "Cosmetic issue, question or minor defect", "1 business day", "Next scheduled release", "IIFT business hours"],
]

ESCALATION = [
    ["Level 1", "Service Desk / Support Engineer", "[Name, phone, e-mail]", "Immediately on logging"],
    ["Level 2", "Support Lead / Senior Engineer", "[Name, phone, e-mail]", "P1 not restored in 1 h; P2 not responded in 2 h"],
    ["Level 3", "Account / Project Manager", "[Name, phone, e-mail]", "P1 not restored in 2 h; P2 not resolved in 1 business day"],
    ["Level 4", "Engagement Director", "[Name, phone, e-mail]", "P1 not restored in 4 h; repeated SLA breach"],
]

SUPPORT_MODEL = [
    ("Channels", "Issue module in the portal/back-office (preferred), dedicated support e-mail and telephone hotline; P1 "
                 "incidents must be reported by telephone in addition to the ticket."),
    ("Support hours", "IIFT business hours as defined in the 'Insurans Islam TAIB Business Hours (Family Takaful)' "
                      "schedule (COM-14); P1 incidents 24x7, including weekends and public holidays."),
    ("Incident management", "Record, classify, prioritise, investigate, resolve and close per ITIL-aligned procedure; "
                            "IIFT confirms closure (MNT-02)."),
    ("Problem management", "Root-cause analysis for every P1 and P2 and for recurring incidents, with report within five "
                           "business days and tracked corrective actions (MNT-03)."),
    ("Service requests", "User support, configuration changes, data corrections and operational assistance (MNT-04)."),
    ("Preventive maintenance", "Monthly health check: logs, error trends, job runs, capacity, slow queries, certificate "
                               "expiry, backup status (MNT-10, 16, 17)."),
    ("Security maintenance", "Monthly patch cycle for application dependencies and container images; emergency patches "
                             "per remediation timelines; certificate management support (MNT-11 to 13)."),
    ("Technology currency", "Compatibility with supported OS, browser, Node.js and PostgreSQL versions; upgrades included "
                            "(MNT-14, 15, 22)."),
    ("Minor enhancements", f"{price.ENHANCEMENT_HOURS_PER_YEAR} hours per year included; further changes via change request "
                           f"at the rate card (MNT-23, 24)."),
    ("Onsite support", "Remote by default; onsite for major incidents, upgrades or critical activities at the rate card "
                       "day rate plus OPE at actuals (MNT-29)."),
]

SERVICE_REPORTING = [
    "Monthly service report (MNT-25): incidents and service requests by priority, SLA performance, availability, "
    "changes and releases, security patches and vulnerabilities, capacity trends, outstanding issues.",
    "Quarterly service review (MNT-26): service performance, improvement plan, roadmap, upcoming platform changes.",
    "Annual DR test participation (MNT-20) and quarterly backup restore verification (MNT-19) with written results.",
    "Documentation updated after every material change (MNT-27) and ongoing knowledge-transfer sessions for IIFT/IITH "
    "support staff (MNT-28).",
]

EXIT_PLAN = [
    ["Transition planning", "Exit plan agreed in Year 5 (or within 30 days of a termination notice): scope, timeline, receiving party."],
    ["Knowledge transfer", "Structured sessions on architecture, code, configuration, operations and known issues."],
    ["Documentation", "Final refresh of technical, operations, administrator and user manuals; runbooks."],
    ["Source code & tooling", "Final source code of IIFT-specific components (and of the core platform if Option C or escrow applies), pipelines, infrastructure scripts and credentials handed over."],
    ["Data extraction", "Full export of business data, documents and audit records in open formats (SQL dump, CSV, original files)."],
    ["Parallel support", "Shadow support to the new provider or IIFT team for up to 30 days."],
    ["Confirmation", "Signed transition acceptance; secure deletion of IIFT data held by iorta, with certificate."],
]


def maintenance(w: ProposalWriter):
    w.h1("Five-Year Maintenance and Support")
    w.para(f"Maintenance and support start at go-live and run for five years. The service is the same under both "
           f"options; Option A charges it as the AMC (Section {sec('commercials')}), Option B includes it in the "
           "subscription, and under Option B iorta's managed services also cover the cloud infrastructure. During "
           "the six-month warranty, defect fixes are free of charge; the AMC or subscription pays for the service "
           f"desk, SLA, monitoring, patches, upgrades, {price.ENHANCEMENT_HOURS_PER_YEAR} enhancement hours a year "
           "and the services described below.")
    w.h2("Support model")
    w.table(["Element", "Description"], [list(s) for s in SUPPORT_MODEL], widths=[3.8, 13.2], bold_first_col=True)
    w.h2("Service levels")
    w.table(["Priority", "Definition", "Response", "Resolution / restoration", "Coverage"], SLA,
            widths=[2.6, 6.4, 2.4, 3.2, 2.4], font_size=8, bold_first_col=True,
            caption="Incident service levels (MNT-05 to MNT-07, COM-13)")
    w.para("Availability target: 99.5% per month overall and 99.9% during IIFT business hours, excluding approved "
           "maintenance windows and infrastructure outside iorta's responsibility. Response is measured from ticket "
           "logging; resolution may be a workaround with a permanent fix scheduled. Service credits for repeated "
           f"breaches are set out in Section {sec('terms')}.")
    w.h2("Escalation matrix")
    w.table(["Level", "Role", "Contact", "Escalation trigger"], ESCALATION, widths=[1.6, 4.6, 4.6, 6.2],
            bold_first_col=True, caption="Critical incident escalation (COM-15)")
    w.h2("Year-by-year focus")
    w.table(["Year", "Focus", "Activities"], [[f"Year {year}", focus, description]
                                             for _, year, focus, description in price.MAINTENANCE_PLAN],
            widths=[1.8, 4.0, 11.2], bold_first_col=True, caption="Five-year maintenance structure (RFP section 9)")
    w.h2("Service reporting and reviews")
    w.bullets(SERVICE_REPORTING)
    w.h2("Exit and transition plan")
    w.table(["Activity", "Description"], EXIT_PLAN, widths=[3.8, 13.2], bold_first_col=True)
    w.h2("iorta business continuity")
    w.para("Source code, documentation and infrastructure scripts are kept in version-controlled repositories with "
           "off-site backup. At least two engineers know each module, support can run from more than one location, "
           "and every support role has a named backup (COM-24). [Confirm or extend with iorta's corporate BCP "
           "details.]")


# =============================================================================
# 16. Team
# =============================================================================
TEAM = [
    ["Engagement Director", "[Name]", "Executive sponsor; Steering Committee member; commercial and escalation owner"],
    ["Project Manager", "[Name]", "Plan, governance, RAID, reporting, change control; single point of contact"],
    ["Solution Architect", "[Name]", "Architecture, security and integration design; Design Authority member"],
    ["Business Analyst (Takaful)", "[Name]", "Workshops, BRS/FRS, product rules, RTM, UAT preparation, training"],
    ["UI/UX Designer", "[Name]", "Screen designs, user journeys, accessibility"],
    ["Technical Lead", "[Name]", "Code quality, technical design, reviews, deployment"],
    ["Software Engineers", "[Names]", "Portal, back-office and API development"],
    ["Integration Engineer", "[Name]", "Core, FIN, AML, AD, SMS and e-mail adapters; interface testing"],
    ["QA Lead / Test Engineer", "[Name]", "Test strategy, SIT, regression automation, performance testing"],
    ["DevOps & Security Engineer", "[Name]", "Environments, CI/CD, monitoring, hardening, VAPT coordination"],
    ["Support Manager", "[Name]", "Hypercare, maintenance service, SLA reporting"],
]

ALLOCATION = [
    ["Engagement Director", "●", "○", "○", "○", "○", "●", "○"],
    ["Project Manager", "●", "●", "●", "●", "●", "●", "●"],
    ["Solution Architect", "●", "●", "○", "●", "○", "○", "–"],
    ["Business Analyst", "●", "●", "○", "○", "●", "○", "○"],
    ["UI/UX Designer", "–", "●", "○", "–", "–", "–", "–"],
    ["Technical Lead", "○", "●", "●", "●", "●", "●", "●"],
    ["Software Engineers", "–", "○", "●", "●", "●", "○", "●"],
    ["Integration Engineer", "–", "●", "●", "●", "○", "○", "○"],
    ["QA Lead / Test Engineer", "–", "○", "●", "●", "●", "○", "○"],
    ["DevOps & Security Engineer", "○", "○", "●", "●", "○", "●", "○"],
    ["Support Manager", "–", "–", "–", "○", "○", "●", "●"],
]

IIFT_ROLES = [
    ["Project Sponsor", "Chairs Steering Committee; final decisions"],
    ["Project Manager", "Coordinates IIFT resources, approvals and logistics"],
    ["Business owners / SMEs", "Banca, Underwriting, Finance and Compliance: requirements, rules, UAT"],
    ["IITH IT", "Infrastructure, network, security, interfaces, environments"],
    ["UAT testers / super-users", "Execute UAT; support colleagues after go-live"],
]


def team(w: ProposalWriter):
    w.h1("Project Team and Organisation")
    w.para("The team pairs Takaful business analysts with the engineers who built and support the platform. CVs are "
           "in Annex B. Key personnel are not replaced without IIFT's consent, and any replacement has equivalent "
           "experience.")
    w.table(["Role", "Name", "Responsibilities"], TEAM, widths=[4.2, 3.0, 9.8], bold_first_col=True,
            caption="Proposed iorta team and responsibilities")
    w.h2("Involvement by phase")
    w.para("● = lead / high involvement, ○ = supporting / part-time, – = not involved.")
    w.table(["Role", "0 Mob.", "1 Design", "2 Build", "3 Integr.", "4 SIT", "5–6 UAT & go-live", "7 Hypercare"],
            ALLOCATION, widths=[4.4, 1.5, 1.6, 1.6, 1.7, 1.5, 2.5, 2.2], font_size=8,
            center_cols=(1, 2, 3, 4, 5, 6, 7))
    w.h2("Onsite and remote delivery")
    w.para("The team works from Malaysia and India. Onsite presence in Bandar Seri Begawan is planned for the phases "
           "where it matters most: requirements, training and UAT, go-live and the first month of support. "
           "Everything else is remote, with video conferencing and shared tools.")
    rows = [[t.phase, t.role, t.origin, str(t.nights)] for t in price.ONSITE_PLAN]
    w.table(["Phase", "Role", "From", "Nights onsite"], rows, widths=[7.0, 5.0, 2.4, 2.6], font_size=8,
            center_cols=(3,), caption=f"Planned onsite presence (OPE estimate in Section {sec('commercials')})")
    w.h2("Expected IIFT roles")
    w.table(["IIFT role", "Responsibility"], IIFT_ROLES, widths=[4.6, 12.4], bold_first_col=True)


# =============================================================================
# 17. Assumptions, dependencies and exclusions
# =============================================================================
ASSUMPTIONS = [
    "Scope is as described in the RFP (sections 3–8 and Appendices 1–4) and this proposal; changes follow the change "
    "request process.",
    "IIFT provides timely access to business owners and decisions; document reviews are completed within ten "
    "business days.",
    "Each external system (Core, FIN, AML, AD, SMS gateway, SMTP) offers a usable interface (API, file or protocol) with "
    "test environments; iorta does not modify those systems.",
    "Rate tables, product rules, document templates and questionnaires are provided by IIFT and signed off by week 6.",
    "Data migration covers agent, agency, bank, branch, participant and reference data, estimated below 10,000 "
    "records from no more than three source extracts; legacy data cleansing at source is IIFT's responsibility.",
    "Under Option A, hardware, OS licences, network, firewall, load balancer, backup infrastructure and DR site are "
    f"provided by IIFT/IITH to the sizing in Section {sec('infrastructure')} and the Bill of Materials.",
    "Under Option B, IIFT approves the cloud region and makes the AMBD outsourcing and cloud notification before "
    "production data is loaded.",
    "The user interface and documents are in English; Malay translation of screens can be added as a change request.",
    "Delivery is remote from Malaysia and India, with onsite presence for requirements gathering, user training and "
    "UAT support, and go-live with one month of support (and knowledge transfer if Option C is taken). Travel and "
    f"subsistence for these phases are recharged as OPE at cost (Section {sec('commercials')}).",
    "IIFT business hours are as published in the 'Insurans Islam TAIB Business Hours (Family Takaful)' schedule.",
]

DEPENDENCIES = [
    "Contract signature and kick-off date; project timeline counts from kick-off.",
    "SIT and UAT environments by weeks 8 and 16; production and DR environments by week 20.",
    "Interface specifications, endpoints and credentials by week 8.",
    "Legacy data extracts by week 12; UAT testers available weeks 19–22.",
    "Independent VAPT provider access to the SIT/pre-production environment in weeks 17–19.",
]

EXCLUSIONS = [
    "Hardware, operating system licences, network equipment and data-centre services (Option A).",
    "Cloud infrastructure charges (Option B), recharged at cost without mark-up or paid by IIFT directly.",
    "Third-party charges listed in the Bill of Materials: SMS messages, AML data service, SSL certificates, e-mail "
    "relay services and optional items such as commercial PostgreSQL support or RHEL subscriptions.",
    "Out-of-pocket expenses, recharged at cost.",
    "Changes to the Core system, FIN, AML service or other third-party systems.",
    "Native mobile applications (the portal is responsive and works on tablets and mobile browsers).",
    "Payment gateway / online card payments (can be added later as a change request).",
    "Full claims administration and policy administration in the core system beyond claim notification and the "
    "portal/back-office functions described.",
    "Onsite visits outside the planned phases (rate card plus OPE) and work outside IIFT business hours other than "
    "P1 incidents (rate card).",
]


def assumptions(w: ProposalWriter):
    w.h1("Assumptions, Dependencies and Exclusions", new_page=False)
    w.h2("Assumptions")
    w.bullets(ASSUMPTIONS)
    w.h2("Dependencies")
    w.bullets(DEPENDENCIES)
    w.h2("Exclusions")
    w.bullets(EXCLUSIONS)


# =============================================================================
# 18. Risks
# =============================================================================
RISKS = [
    ["R1", "Delayed availability or incomplete specification of Core/FIN interfaces", "High", "Medium", "Early interface workshops (week 3); mock services so build continues; interface specification sign-off by week 6"],
    ["R2", "Late provision of SIT/UAT/production environments", "High", "Medium", "Environment request at kick-off; iorta-hosted SIT as interim; containerised deployment reduces set-up time"],
    ["R3", "Rate tables or product rules not finalised in time", "High", "Medium", "Configurable rating with placeholder rates; rate validation as an SIT exit criterion"],
    ["R4", "Scope growth during design", "Medium", "Medium", "Workshops on working screens; scope baseline at M2; formal change control"],
    ["R5", "Legacy data quality lower than expected", "Medium", "Medium", "Early profiling; two dry-runs; cleansing rules owned by IIFT data owners"],
    ["R6", "Limited availability of IIFT users for UAT", "Medium", "Low", "UAT plan agreed at M2; scenario scripts prepared by iorta; super-user model"],
    ["R7", "VAPT reveals significant findings close to go-live", "High", "Low", "Secure SDLC with SAST/SCA/DAST from sprint 1; VAPT in weeks 17–19 leaves time for remediation"],
    ["R8", "AML provider integration constraints (rate limits, formats)", "Medium", "Low", "Adapter with queueing and retry; manual screening fallback with audit"],
    ["R9", "Low adoption by bank officers and agents", "Medium", "Low", "Change management, train-the-trainer, simple UX, onboarding pack, adoption KPIs"],
    ["R10", "Regulatory feedback on cloud hosting (Option B)", "Medium", "Low", "Recommend Option A; early AMBD engagement if Option B is chosen"],
    ["R11", "Key personnel unavailability", "Medium", "Low", "Named backups; shared code ownership; documentation as we go"],
    ["R12", "Performance issues with document-heavy transactions", "Low", "Low", "Streaming uploads, object storage, performance tests on production-like data"],
    ["R13", "Cloud charges above the estimate (Option B)", "Low", "Medium", "Recharged at cost with budget alerts, monthly cost report, quarterly right-sizing; reserved capacity only with IIFT approval"],
    ["R14", "Exchange-rate movement on USD-billed cloud and third-party services", "Low", "Medium", "B$ fees for iorta services; pass-through items converted at invoice-date rates and reported monthly"],
    ["R15", "Knowledge transfer (Option C) without enough IIFT/IITH developers", "Medium", "Low", "Skills profile agreed in week 1 of the transition; competency assessment; support choice 2 as a safety net"],
]


def risks(w: ProposalWriter):
    w.h1("Risk Register")
    w.para("The register below is the starting point. The two project managers maintain it; the Working Committee "
           "reviews it weekly and the Steering Committee monthly.")
    w.table(["ID", "Risk", "Impact", "Likelihood", "Mitigation"], RISKS, widths=[1.0, 5.0, 1.6, 1.9, 7.5],
            font_size=8, center_cols=(0, 2, 3), caption="Initial risk register with mitigations")
