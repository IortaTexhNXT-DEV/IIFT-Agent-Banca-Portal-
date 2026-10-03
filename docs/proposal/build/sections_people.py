"""Chapter: Personas, screens, journeys and navigation.

Everything here describes the application as built: the menu per persona is
derived from the role permissions (apps/api/prisma/reference-data/roles.ts) and
the menu definition (apps/web/src/layouts/menus.tsx); the journeys follow the
service code (policies, billing, agency, aml, claims, workflow, eod, esign,
issues). Screen images come from the manifest in screen_manifest.py; a
missing image is replaced by a neutral placeholder so the document always builds.
"""

from PIL import Image

import brand
import diagrams
import numbering
from docx_kit import ProposalWriter
from screen_manifest import PERSONA_SCREENS, USERS, entries_for

PRODUCT = brand.PRODUCT

# =============================================================================
# Permissions and menus, as seeded and as the web application filters them
# =============================================================================
PORTAL_BASE = [
    "portal.dashboard", "portal.profile.view", "portal.profile.update", "portal.hierarchy.view",
    "portal.participants.view", "portal.participants.manage", "portal.policies.view", "portal.policies.quote",
    "portal.policies.submit", "portal.policies.service", "portal.billing.view", "portal.billing.submit",
    "portal.claims.view", "portal.claims.submit", "portal.issues", "portal.reports", "portal.commission.view",
]
BO_READ = ["bo.dashboard", "bo.agencies.view", "bo.agents.view", "bo.participants.view", "bo.policies.view",
           "bo.payments.view", "bo.reports.view"]
APPROVE = ["bo.approve.agents", "bo.approve.participants", "bo.approve.policies", "bo.approve.servicing",
           "bo.approve.payments"]

ROLE_PERMISSIONS = {
    "AGENCY_PRINCIPAL": PORTAL_BASE + ["portal.agency.view_all", "portal.agents.register"],
    "AGENT": PORTAL_BASE,
    "BANCA_OFFICER": PORTAL_BASE,
    "BANCA_SUPERVISOR": PORTAL_BASE + ["portal.agency.view_all", "portal.agents.register"],
    "SYSTEM_ADMINISTRATOR": ["bo.dashboard", "bo.users.manage", "bo.roles.manage", "bo.config.manage",
                             "bo.workflow.configure", "bo.products.manage", "bo.integration.manage", "bo.audit.view",
                             "bo.agencies.view", "bo.agencies.manage", "bo.reports.view", "bo.reports.schedule"],
    "OPERATIONS_OFFICER": BO_READ + ["bo.agencies.manage", "bo.agents.manage", "bo.documents.verify",
                                     "bo.claims.manage", "bo.issues.manage"],
    "OPERATIONS_SUPERVISOR": BO_READ + ["bo.approve.agents", "bo.approve.participants", "bo.approve.servicing",
                                        "bo.documents.verify"],
    "UNDERWRITER": BO_READ + ["bo.approve.policies", "bo.documents.verify"],
    "FINANCE_OFFICER": BO_READ + ["bo.approve.payments", "bo.eod.run", "bo.integration.manage", "bo.reports.schedule"],
    "COMPLIANCE_OFFICER": BO_READ + ["bo.aml.review", "bo.audit.view"],
    "SUPPORT_DESK": ["bo.dashboard", "bo.issues.manage", "bo.agents.view", "bo.agencies.view"],
}

# (group label, [(item label, path, any-of permissions)])
PORTAL_MENU = [
    (None, [("Dashboard", "/portal", ["portal.dashboard"])]),
    ("Sales", [("Quotations & policies", "/portal/policies", ["portal.policies.view"]),
               ("Renewals", "/portal/renewals", ["portal.policies.view"]),
               ("Participants", "/portal/participants", ["portal.participants.view"])]),
    ("Servicing", [("Billing & payments", "/portal/billing", ["portal.billing.view"]),
                   ("Claims", "/portal/claims", ["portal.claims.view"]),
                   ("My requests", "/portal/requests", [])]),
    ("Agency", [("Team & hierarchy", "/portal/team", ["portal.hierarchy.view"]),
                ("Commission", "/portal/commission", ["portal.commission.view"]),
                ("Reports", "/portal/reports", ["portal.reports"]),
                ("Support", "/portal/issues", ["portal.issues"])]),
]
BACKOFFICE_MENU = [
    (None, [("Dashboard", "/backoffice", ["bo.dashboard"]), ("Approvals", "/backoffice/approvals", APPROVE)]),
    ("Distribution", [("Agents & bankers", "/backoffice/agents", ["bo.agents.view"]),
                      ("Agencies & banks", "/backoffice/agencies", ["bo.agencies.view"])]),
    ("Business", [("Policies", "/backoffice/policies", ["bo.policies.view"]),
                  ("Participants", "/backoffice/participants", ["bo.participants.view"]),
                  ("Payments", "/backoffice/payments", ["bo.payments.view"]),
                  ("Claims", "/backoffice/claims", ["bo.claims.manage"])]),
    ("Control", [("AML / KYC", "/backoffice/aml", ["bo.aml.review"]),
                 ("Document checks", "/backoffice/documents", ["bo.documents.verify"]),
                 ("Audit trail", "/backoffice/audit", ["bo.audit.view"])]),
    ("Operations", [("Issues", "/backoffice/issues", ["bo.issues.manage"]),
                    ("Reports", "/backoffice/reports", ["bo.reports.view"]),
                    ("End of day", "/backoffice/eod", ["bo.eod.run"]),
                    ("Integration", "/backoffice/integration", ["bo.integration.manage"])]),
    ("Administration", [("Users", "/backoffice/users", ["bo.users.manage"]),
                        ("Roles & permissions", "/backoffice/roles", ["bo.roles.manage"]),
                        ("Workflows", "/backoffice/workflows", ["bo.workflow.configure"]),
                        ("Products", "/backoffice/products", ["bo.products.manage"]),
                        ("Parameters & master data", "/backoffice/settings", ["bo.config.manage"])]),
]


def _leads_to(path, perms):
    """Pages, dialogs and actions reached from a menu item, for the navigation figure."""
    agency_wide = "portal.agency.view_all" in perms
    can_register = "portal.agents.register" in perms
    text = {
        "/portal": "Work queues, follow-ups, production chart, recent activity"
                   + (" (whole agency or bank)" if agency_wide else " (own records)"),
        "/portal/policies": "List with filters → Policy detail: checklist, Declarations, Nominees, Signature, "
                            "Send link, Submit; Renew, Request endorsement, Request cancellation, E-mail documents",
        "/portal/renewals": "Policies ending inside the renewal window → Renew → new quotation",
        "/portal/participants": "List → Participant detail (policies, documents, update requests) · Register participant",
        "/portal/billing": "Outstanding → Submit payment (single or bulk, proof) · Payment history → Payment detail, e-Receipts",
        "/portal/claims": "List → Claim detail (documents, IIFT remarks) · Notify claim (validate policy first)",
        "/portal/requests": "Own requests" + (" and the team's" if agency_wide else "") + " → Request detail, remarks, Withdraw",
        "/portal/team": "Agency or bank record, hierarchy, team members → Team member"
                        + (" · Register agent / bank officer" if can_register else ""),
        "/portal/commission": "Commission and referral fee by period" + (", whole agency" if agency_wide else ""),
        "/portal/reports": "Report catalogue → filters, preview, export (Excel, CSV, PDF)",
        "/portal/issues": "Own issues → Issue detail, conversation, attachments · Report an issue",
        "/backoffice": "Work queues for this role; management tiles for Management",
        "/backoffice/approvals": "Awaiting my decision / All requests → Approval detail → Approve or Reject",
        "/backoffice/agents": "Search → Agent detail (documents, hierarchy, AML, approvals)"
                              + (" · Register · Request profile update · Change status" if "bo.agents.manage" in perms else ""),
        "/backoffice/agencies": "List → Agency or bank detail, agents, issuance block"
                                + (" · Add, Edit, Lift issuance block" if "bo.agencies.manage" in perms else ""),
        "/backoffice/policies": "Search across agencies → Policy record (read-only view of the portal page)",
        "/backoffice/participants": "Search → Participant record, policies, documents, AML screening history",
        "/backoffice/payments": "Search → Payment detail, proof, e-Receipts, verification request",
        "/backoffice/claims": "List → Claim detail → Update status with remarks",
        "/backoffice/aml": "Screening cases → Review (Cleared / Confirmed match) · Watch-lists: add, import CSV",
        "/backoffice/documents": "Uploaded documents awaiting verification → Verify or Reject with reason",
        "/backoffice/audit": "Search by period, user, action, record → before and after values",
        "/backoffice/issues": "All issues → Issue detail: assign, priority, status, conversation",
        "/backoffice/reports": "Run a report with filters and export"
                               + (" · Scheduled reports" if "bo.reports.schedule" in perms else ""),
        "/backoffice/eod": "Runs by business date → Run end of day · EOD report · FIN file",
        "/backoffice/integration": "Health per system · Message queue (re-submit) · Integration log · Reconciliation",
        "/backoffice/users": "Users → New staff user, Edit, Disable, Unlock, Reset password",
        "/backoffice/roles": "Roles → New role / Edit role (permission picker)",
        "/backoffice/workflows": "One card per transaction type: steps, approver, amount threshold",
        "/backoffice/products": "Products → Edit: flags, rating configuration, documents, questionnaire",
        "/backoffice/settings": "Parameters by category · Master data code tables",
    }
    return text[path]


def visible_menu(menu, perms, highlight=()):
    groups = []
    for label, items in menu:
        visible = [(item, _leads_to(path, perms), path in highlight)
                   for item, path, any_of in items if not any_of or any(p in perms for p in any_of)]
        if visible:
            groups.append((label, visible))
    return groups


# =============================================================================
# Personas
# =============================================================================
PERSONAS = {
    "main_agent": dict(
        name="Main agent (agency principal)", role="AGENCY_PRINCIPAL", module="portal",
        demo="Hajah Siti Aminah binti Haji Osman, Seri Amanah Takaful Agency",
        who="Runs an IIFT agency; sells annual plans herself and is accountable for the production and conduct of her "
            "sub-agents.",
        goals="Grow agency production; keep contributions collected inside the grace period so the agency is never "
              "blocked; bring new sub-agents on quickly.",
        frequency="Daily; several times a day in campaign periods.",
        device="Laptop in the office; phone or tablet when visiting participants (the portal reflows to a drawer menu).",
        permissions="All portal functions plus agency-wide visibility (portal.agency.view_all) and sub-agent "
                    "registration (portal.agents.register).",
        scope="Every record of the agency: own and sub-agents' quotations, policies, participants, payments, "
              "claims, requests and commission.",
        rfp="AP-01–AP-10, AP-12–AP-47, AP-49–AP-58, AP-59, AP-62, INT-05",
        highlight=("/portal/team", "/portal/commission"),
        notes="The four portal roles share one menu. What differs is the data scope and two actions: the "
              "principal and the bank supervisor see the whole agency or bank and may register team members.",
    ),
    "sub_agent": dict(
        name="Sub-agent", role="AGENT", module="portal",
        demo="Muhammad Firdaus bin Abdullah, reports to AG-000001",
        who="Sells Professional, Khairat, Personal Home Assistant and Overseas Student plans under a main agent.",
        goals="Quote and issue in one sitting with the participant; collect the contribution; earn commission; "
              "know at once when IIFT needs something.",
        frequency="Daily during sales activity; weekly for renewals and payments.",
        device="Phone or tablet in the field; laptop for document uploads.",
        permissions="Portal base permissions: quote, submit, service, bill, claim, report, support.",
        scope="Own records only (portal.agency.view_all not granted).",
        rfp="AP-01–AP-06, AP-13–AP-47, AP-49–AP-58, AP-62",
        highlight=("/portal/policies", "/portal/billing"),
    ),
    "bank_officer": dict(
        name="Bank officer (banca)", role="BANCA_OFFICER", module="portal",
        demo="Nurul Huda binti Hassan, Mutiara Islamic Bank, Gadong branch, authority limit B$ 250,000",
        who="Branch officer who attaches financing takaful (hire purchase, personal and property financing) to the "
            "bank's financing approvals.",
        goals="Issue the e-Policy as soon as the financing is approved, so the drawdown is not held up; keep the "
              "branch inside the seven-day payment rule.",
        frequency="Daily, in bursts around month-end drawdowns.",
        device="Bank workstation on the branch network.",
        permissions="Portal base permissions; an authority limit on the agent record routes larger cases for approval.",
        scope="Own records only.",
        rfp="AP-01–AP-06, AP-13–AP-47, AP-49–AP-58, AP-60, AP-62, FFR01 (FTPHP01–08), AP-42",
        highlight=("/portal/billing",),
    ),
    "bank_supervisor": dict(
        name="Bank supervisor (banca)", role="BANCA_SUPERVISOR", module="portal",
        demo="Pengiran Khairul Anwar bin Pengiran Ismail, Mutiara Islamic Bank, main branch",
        who="Head of bancassurance at the partner bank; registers officers, settles the bank's contributions in bulk "
            "and watches production per officer.",
        goals="One bank transfer for many policies; no issuance block; new officers active within a day.",
        frequency="Daily review; weekly bulk payment.",
        device="Bank workstation.",
        permissions="Portal base permissions plus bank-wide visibility and officer registration.",
        scope="Every record of the bank, all branches.",
        rfp="AP-07–AP-10, AP-12, AP-37–AP-42, AP-58, AP-59, plus the bank officer's set",
        highlight=("/portal/team", "/portal/billing"),
    ),
    "ops_maker": dict(
        name="Operations officer (maker)", role="OPERATIONS_OFFICER", module="backoffice",
        demo="Rosmawati binti Abdul Karim (ops.maker)",
        who="IIFT Banca and agency administration: registers and maintains agents, agencies and banks, checks "
            "documents, handles claim notifications and portal issues.",
        goals="Clean, complete records before a checker sees them; nothing waiting in the document queue overnight.",
        frequency="All day.",
        device="IIFT workstation on the internal network.",
        permissions="Back-office read set plus agencies.manage, agents.manage, documents.verify, claims.manage, "
                    "issues.manage. No approval permission: a maker never decides a request.",
        scope="All agencies and banks.",
        rfp="BO-05–BO-09, BO-11, BO-12, BO-21, BO-22–BO-24, BO-29, BO-30, AP-43",
        highlight=("/backoffice/agents", "/backoffice/documents"),
    ),
    "ops_checker": dict(
        name="Operations supervisor (checker)", role="OPERATIONS_SUPERVISOR", module="backoffice",
        demo="Mohammad Hafiz bin Yusof (ops.checker)",
        who="Approves what the maker and the portal submit: registrations, profile and status changes, participant "
            "updates, endorsements and cancellations.",
        goals="Decide every request the same day, with the evidence on one page; reject with a reason the "
              "submitter can act on.",
        frequency="Several times a day; the dashboard shows what is waiting.",
        device="IIFT workstation.",
        permissions="Read set plus approve.agents, approve.participants, approve.servicing, documents.verify.",
        scope="All agencies and banks.",
        rfp="BO-10, BO-16–BO-19, BO-21, BO-11, AP-15, AP-27, AP-28, AP-61",
        highlight=("/backoffice/approvals",),
    ),
    "underwriter": dict(
        name="Underwriter / quality check", role="UNDERWRITER", module="backoffice",
        demo="Dr. Liyana binti Ahmad (underwriter)",
        who="Decides referred quotations: health declarations answered Yes, financing above B$ 150,000, cases above "
            "an officer's authority limit, and the quality check before a financing contract is issued.",
        goals="Accept good risk quickly; see the declarations and documents without leaving the request.",
        frequency="Daily.",
        device="IIFT workstation.",
        permissions="Read set plus approve.policies and documents.verify.",
        scope="All policies.",
        rfp="AP-32, AP-33, AP-60, AP-61, BO-16–BO-19, FFR01 (FTPHP06)",
        highlight=("/backoffice/approvals", "/backoffice/policies"),
    ),
    "finance": dict(
        name="Finance officer", role="FINANCE_OFFICER", module="backoffice",
        demo="Faizal bin Haji Omar (finance)",
        who="Verifies payment proofs against the bank statement, issues e-Receipts, runs end of day and checks the "
            "FIN postings.",
        goals="Every receipt matched; the day closed with a clean reconciliation; no agency blocked for a payment "
              "that has in fact arrived.",
        frequency="Daily, with a fixed end-of-day routine.",
        device="IIFT workstation.",
        permissions="Read set plus approve.payments, eod.run, integration.manage, reports.schedule.",
        scope="All payments and runs.",
        rfp="AP-40, AP-41, AP-42, AP-44, INT-04, INT-11, INT-13–INT-15, BO-25, FFR02 (APHA07), FFR03 (APPT08)",
        highlight=("/backoffice/approvals", "/backoffice/eod", "/backoffice/integration"),
    ),
    "compliance": dict(
        name="Compliance officer", role="COMPLIANCE_OFFICER", module="backoffice",
        demo="Nur Azizah binti Mahmud (compliance)",
        who="Reviews possible watch-list matches on participants and agents and maintains the watch-lists.",
        goals="Clear false positives the same day so sales are not held; confirm true matches so the record is "
              "closed everywhere at once.",
        frequency="Daily, usually a few cases.",
        device="IIFT workstation.",
        permissions="Read set plus aml.review and audit.view.",
        scope="All screening cases and the audit trail.",
        rfp="AP-16, AP-48, BO-13–BO-15, BO-26–BO-28",
        highlight=("/backoffice/aml", "/backoffice/audit"),
    ),
    "support": dict(
        name="Support officer", role="SUPPORT_DESK", module="backoffice",
        demo="Kenneth Lim (support)",
        who="First-line support for portal and back-office users; owns issues until they are closed.",
        goals="Respond inside the SLA for the priority; keep the reporter informed; no breached issue unassigned.",
        frequency="All day.",
        device="IIFT workstation.",
        permissions="dashboard, issues.manage, agents.view, agencies.view (to look up who is reporting).",
        scope="All issues; agents and agencies read-only.",
        rfp="AP-55–AP-57, BO-29–BO-31",
        highlight=("/backoffice/issues",),
    ),
    "sysadmin": dict(
        name="System administrator", role="SYSTEM_ADMINISTRATOR", module="backoffice",
        demo="admin (first administrator created by the seed)",
        who="IIFT or IITH IT: users, roles, workflows, products, parameters, master data, integration health.",
        goals="Change a rule, a threshold or a rate table without a release; prove who changed what.",
        frequency="Weekly, and during product or rule changes.",
        device="IIFT workstation.",
        permissions="users.manage, roles.manage, config.manage, workflow.configure, products.manage, "
                    "integration.manage, audit.view, agencies.view/manage, reports.view/schedule. No approval "
                    "permission and no access to policies, participants or payments.",
        scope="Configuration and audit; no business records.",
        rfp="BO-02–BO-04, BO-09, BO-16, BO-18, BO-26–BO-28, BO-32, BO-33, COM-04, COM-09, INT-11, INT-13",
        highlight=("/backoffice/users", "/backoffice/workflows", "/backoffice/settings"),
    ),
}

PERSONA_ORDER = ["main_agent", "sub_agent", "bank_officer", "bank_supervisor", "ops_maker", "ops_checker",
                 "underwriter", "finance", "compliance", "support", "sysadmin"]

PORTAL_SCREEN_ROWS = {
    "dashboard": ["Dashboard", "Tiles, work queues, production, recent activity",
                  "Starts the day from the queues; opens follow-ups", "AP-37, AP-52, AP-53"],
    "new_quotation": ["New quotation (Product, Participant, Coverage, Review)", "Four-step wizard with a live "
                      "indicative contribution", "Chooses the product, finds or registers the participant, sets the "
                      "cover, saves the quotation", "AP-17–AP-20, FFR01–05 step 1–3"],
    "policy_list": ["Quotations & policies", "List with search, status, payment status, product and date filters",
                    "Finds drafts, pending, rejected and active records", "AP-21–AP-23"],
    "policy_detail": ["Policy detail", "Checklist, overview, Documents, Payments & receipts, History, Approvals, "
                      "Claims tabs", "Completes declarations, nominees, documents and signatures; submits; "
                      "downloads or e-mails the e-Policy and e-Receipt", "AP-24, AP-25, AP-29–AP-36, AP-44–AP-47, AP-62"],
    "renewals": ["Renewals", "Policies ending inside the renewal window", "Creates the renewal quotation", "AP-26"],
    "participants": ["Participants and Register participant", "List, detail with policies, documents and update "
                     "requests", "Registers or finds the participant; requests updates", "AP-11, AP-13–AP-16, AP-48"],
    "billing": ["Billing & payments and Payment detail", "Outstanding, overdue, due soon, pending verification; "
                "payment history", "Submits single or bulk payment with proof; downloads e-Receipts",
                "AP-30, AP-37–AP-42"],
    "claims": ["Claims and Notify claim", "List, validation of the policy number, event details, documents",
               "Notifies a claim and follows IIFT's remarks", "AP-43"],
    "requests": ["My requests", "Own (or team) maker-checker requests", "Reads the decision and remarks; withdraws "
                 "a pending request", "AP-49–AP-51"],
    "team": ["Team & hierarchy and Register agent", "Agency or bank record, hierarchy, members",
             "Registers sub-agents or bank officers; follows their approval", "AP-07–AP-10, AP-12, AP-46, AP-48"],
    "team_view": ["Team & hierarchy", "Agency or bank record and reporting line", "Sees own position and reporting "
                  "line", "AP-09, AP-10"],
    "commission": ["Commission", "Accrued and paid commission by period", "Checks the statement", "INT-05"],
    "reports": ["Reports", "Role-scoped reports, preview, export", "Runs production and payment reports", "AP-58"],
    "support": ["Support and Report an issue", "Own issues with SLA targets", "Reports a problem with attachments; "
                "confirms or reopens the resolution", "AP-55–AP-57"],
    "profile": ["My profile", "Profile, portal user name, documents, change requests", "Requests contact changes "
                "(approved by IIFT)", "AP-05, AP-06"],
    "notifications": ["Notifications", "In-app notifications with links", "Opens the record behind a notification",
                      "AP-34, AP-54"],
}

PERSONA_SCREEN_KEYS = {
    "main_agent": ["dashboard", "new_quotation", "policy_list", "policy_detail", "renewals", "participants",
                   "billing", "claims", "requests", "team", "commission", "reports", "support", "profile",
                   "notifications"],
    "sub_agent": ["dashboard", "new_quotation", "policy_list", "policy_detail", "renewals", "participants",
                  "billing", "claims", "requests", "team_view", "commission", "reports", "support", "profile",
                  "notifications"],
    "bank_officer": ["dashboard", "new_quotation", "policy_list", "policy_detail", "participants", "billing",
                     "claims", "requests", "team_view", "commission", "reports", "support", "profile",
                     "notifications"],
    "bank_supervisor": ["dashboard", "new_quotation", "policy_list", "policy_detail", "participants", "billing",
                        "claims", "requests", "team", "commission", "reports", "support", "profile",
                        "notifications"],
}

BACKOFFICE_SCREEN_ROWS = {
    "ops_maker": [
        ["Dashboard", "Queues: agent registrations, documents to verify, payments, open claims, open issues",
         "Picks the next piece of work", "BO-21"],
        ["Agents & bankers, Agent detail, Register agent or bank officer", "Search, profile, documents, hierarchy, "
         "AML, approvals", "Registers agents (maker), requests profile updates and status changes, uploads "
         "documents", "BO-05–BO-08, BO-10, BO-11"],
        ["Agencies & banks, Agency detail", "Agency and bank records, agents, issuance block", "Adds and edits "
         "agencies and banks; lifts a block with a reason", "BO-09, AP-42"],
        ["Document checks", "Uploaded documents awaiting verification", "Verifies or rejects with a reason; sees "
         "expiry", "BO-11, BO-12"],
        ["Policies, Participants, Payments", "Read-only search and records", "Looks up a record while handling a "
         "query", "BO-06, AP-14, AP-23"],
        ["Claims, Claim detail", "Claim notifications and their status", "Moves the claim to Under review, "
         "Acknowledged, Rejected or Closed with remarks", "AP-43"],
        ["Issues, Issue detail", "Portal and back-office issues", "Assigns, prioritises and answers issues",
         "BO-29, BO-30"],
        ["Reports", "Operational reports", "Agent register, document expiry", "BO-22–BO-24"],
    ],
    "ops_checker": [
        ["Dashboard", "Awaiting my approval, pending requests by type", "Opens the oldest request", "BO-21"],
        ["Approvals (Awaiting my decision, All requests)", "Maker-checker inbox and history", "Works the inbox; "
         "searches past requests by number, type, status", "BO-16, BO-18"],
        ["Approval detail", "Request, submitted details, supporting evidence (AML, documents), approval history",
         "Approves with optional remarks or rejects with a mandatory reason", "BO-10, BO-17, BO-19, AP-61"],
        ["Agents & bankers, Agencies & banks", "Records behind a request", "Cross-checks the registration",
         "BO-05–BO-09"],
        ["Document checks", "Documents awaiting verification", "Verifies the IC copy before approving a "
         "registration", "BO-11, BO-12"],
        ["Policies, Participants, Payments", "Read-only records", "Checks the policy before deciding an "
         "endorsement or cancellation", "AP-27, AP-28"],
        ["Reports", "Approval turnaround", "Reviews ageing of requests", "BO-22"],
    ],
    "underwriter": [
        ["Dashboard", "Referred quotations awaiting decision", "Opens the queue", "BO-21"],
        ["Approvals, Approval detail", "Referral reasons, sum covered, contribution, policy documents",
         "Approves (level 1, and level 2 from B$ 300,000 sum covered by a second underwriter) or rejects with "
         "remarks that the agent sees", "AP-33, AP-60, AP-61, BO-16–BO-19"],
        ["Policies, Policy record", "Cover, declarations, risk details, nominees, documents, history",
         "Reads the full application from the request", "AP-24, AP-31"],
        ["Document checks", "Documents on policies", "Verifies the proposal form or medical evidence", "BO-11"],
        ["Participants", "Participant record and AML screening history", "Checks the participant", "AP-14"],
        ["Reports", "Referral and issuance reports", "Reviews referrals by product and reason", "BO-22"],
    ],
    "finance": [
        ["Dashboard", "Payments to verify with their total; integration dead letters", "Starts with the oldest "
         "payment", "BO-21"],
        ["Approvals, Approval detail", "Payment verification requests with proof of payment", "Verifies "
         "(approves) or rejects; approval issues e-Receipts and posts to FIN", "AP-40, AP-41, BO-16–BO-19"],
        ["Payments, Payment detail", "Payments by agency or bank, status, e-Receipts", "Reviews a payment and its "
         "receipts; jumps to the request", "AP-41, AP-44"],
        ["End of day", "Runs per business date, EOD report, FIN file", "Runs or re-runs a date; downloads the "
         "files", "FFR01 FTPHP08, FFR02 APHA07, FFR03 APPT08, FFR04 APKT07, FFR05 APAOS08, INT-04"],
        ["Integration (Message queue, Integration log, Reconciliation)", "Interface health, retries, dead letters, "
         "receipt reconciliation", "Re-submits a message; runs reconciliation; investigates mismatches",
         "INT-11, INT-13–INT-15"],
        ["Reports, Scheduled reports", "Finance reports, schedules with recipients", "Schedules the receipts "
         "report to Finance", "BO-22–BO-25"],
        ["Policies, Participants, Agencies & banks", "Read-only records", "Checks a blocked agency or an "
         "outstanding policy", "AP-30, AP-42"],
    ],
    "compliance": [
        ["Dashboard", "AML cases to review", "Opens pending cases", "BO-21"],
        ["AML / KYC: Screening cases", "Pending, cleared, confirmed and auto-cleared cases with matches",
         "Reviews a case: Cleared or Confirmed match with remarks", "AP-16, BO-13–BO-15"],
        ["AML / KYC: Watch-lists", "Entries by list, add, import CSV, deactivate", "Maintains sanctions, PEP and "
         "internal lists", "BO-13"],
        ["Participants, Agents & bankers", "Records with AML screening history", "Reads the subject's history "
         "before deciding", "BO-14"],
        ["Audit trail", "Append-only record of actions with before and after values", "Evidences who screened, "
         "reviewed and approved", "BO-26–BO-28"],
        ["Reports", "AML screening and review report", "Monthly compliance reporting", "BO-22"],
    ],
    "support": [
        ["Dashboard", "Open issues and how many are past SLA", "Starts with breached issues", "BO-21, BO-31"],
        ["Issues", "All issues with filters Assigned to me and SLA breached", "Triages new issues", "BO-29–BO-31"],
        ["Issue detail", "Details, SLA, attachments, conversation, assignment and priority", "Assigns, changes "
         "priority (recalculates SLA), replies or adds internal notes, resolves with a resolution text",
         "BO-29–BO-31, AP-56"],
        ["Agents & bankers, Agencies & banks", "Read-only lookups", "Identifies the reporter's agency or bank",
         "BO-06"],
    ],
    "sysadmin": [
        ["Users", "Staff, agent and bank officer accounts", "Creates staff users (local or directory), edits roles, "
         "disables, unlocks, resets passwords", "BO-03, AP-04, INT-06"],
        ["Roles & permissions", "Roles per module with their permissions", "Creates or edits roles from the "
         "permission catalogue", "BO-02, BO-04, AP-59"],
        ["Workflows", "Approval definitions per transaction type", "Switches approval on or off; sets levels, "
         "approvers and amount thresholds", "BO-16, BO-18, COM-04"],
        ["Products", "Products, rating configuration, documents, questionnaire", "Updates rates, plans, required "
         "documents and declarations", "BO-32, BO-33"],
        ["Parameters & master data", "Parameters by category; code tables", "Changes grace days, validity, SLA "
         "hours, thresholds; maintains banks, districts, reasons", "BO-32, BO-33, COM-09"],
        ["Agencies & banks", "Agency and bank records", "Creates a new bank partner", "BO-09"],
        ["Integration", "Health, message queue, log, reconciliation", "Watches interface health; re-submits",
         "INT-11, INT-13, INT-14"],
        ["Audit trail", "All changes with before and after values", "Evidences configuration changes", "BO-26–BO-28"],
        ["Reports, Scheduled reports", "User access review report and schedules", "Schedules the access review",
         "BO-25"],
    ],
}


# =============================================================================
# Journeys
# =============================================================================
def step(lane, screen, action, detail=None, kind="action", **extra):
    return dict(lane=lane, screen=screen, action=action, detail=detail or action, kind=kind, **extra)


def decision(lane, question, yes, no, no_to, detail):
    return dict(lane=lane, screen=question, action="", detail=detail, kind="decision", yes=yes, no=no, no_to=no_to)


JOURNEYS = [
    dict(
        key="annual", title="New business for an annual plan (Professional Takaful Plan)", split=8,
        starts="Sub-agent", ends="Policy ACTIVE and PAID; e-Policy and e-Receipt issued and e-mailed",
        demo="about 12 minutes including the Finance step",
        rfp="AP-13–AP-20, AP-25, AP-32, AP-33, AP-36, AP-39–AP-41, AP-44, AP-45, AP-62, FFR03 (APPT01–07)",
        intro="The sub-agent completes the application with the participant in one sitting. Payment is required "
              "before issuance for the annual plans, so the e-Policy follows Finance's verification.",
        lanes=[("Sub-agent", "user"), ("Participant", "user"), ("System", "system"), ("Finance officer", "user")],
        steps=[
            step(0, "New quotation: Product", "Choose Professional Takaful Plan",
                 "Header button New quotation. Products are grouped by line of business; the card shows Pay "
                 "before issue and Renewable."),
            step(0, "New quotation: Participant", "Look up by ID, or Register new",
                 "Find existing (name, number, mobile), Look up by ID (exact IC number across agencies, AP-11) or "
                 "Register new: ID type and number, name, date of birth, nationality, occupation and class, "
                 "mobile, e-mail, address."),
            step(2, "Participant registered", "Participant no. PT/26/nnnnnn; AML screening",
                 "The participant number is assigned and the name and IC number are screened against the "
                 "watch-lists. A score at or above the threshold (85) flags the participant and e-mails Compliance; "
                 "the agent sees the outcome on the Participant step."),
            step(0, "New quotation: Coverage, Review", "Plan A/B/C, additional cover; Save quotation",
                 "The indicative contribution updates as the plan changes. Review shows participant and cover; Save "
                 "quotation creates QT/26/nnnnnn in status DRAFT and opens the policy page."),
            step(0, "Policy detail: Application checklist", "Declarations, Nominees, Upload documents",
                 "Declarations: three health questions (a Yes needs details and refers the case). Nominees: name, "
                 "relationship, role, share (total 100%). Documents tab: questionnaire, IC copy, nominee IC."),
            step(0, "Checklist: Participant signature", "Sign on screen or Send link",
                 "On screen: the participant signs on the agent's device. Send link: a one-time link is e-mailed "
                 "to the participant, valid for 72 hours (parameter)."),
            step(1, "Participant e-signature page", "Review summary, type name, tick declaration, sign",
                 "Public page without login. The typed name must match the participant; the signature image is "
                 "stored, the policy history records the source address and the agent is notified."),
            step(0, "Policy detail", "Submit application",
                 "The server checks quotation validity (30 days), the agency block, nominees, mandatory documents, "
                 "participant signature and the AML status, then re-rates the quotation."),
            decision(2, "Referral reason?", "yes", "no", 10,
                     "Referral reasons: a Yes declaration, sum covered above the agent's authority limit, or a "
                     "product quality check."),
            step(2, "Referred: PENDING APPROVAL", "RQ to Underwriting; continues on approval",
                 "Request RQ/26/nnnnnn goes to Underwriting with the reasons; the agent sees Awaiting IIFT "
                 "underwriting decision. Journey 2 shows the approval; a rejection returns the quotation with the "
                 "remarks and it can be reopened and resubmitted."),
            step(2, "Accepted: PENDING PAYMENT", "Notify agent: payment required",
                 "Without a referral the quotation is accepted and waits for the contribution. The agent receives "
                 "an in-app notification with the amount."),
            step(0, "Billing & payments", "Select the policy, Submit payment with proof",
                 "Allocation per policy, method, bank, bank reference, payment date, proof file. The payment "
                 "PY/26/nnnnnn is marked Pending verification and a Payment verification request is raised."),
            step(3, "Approvals: payment verification", "Check proof, Approve",
                 "Finance opens the request from the inbox or dashboard, sees the allocation and the proof under "
                 "Supporting evidence, and approves; a rejection needs a reason, which the agent sees."),
            step(2, "Issuance", "e-Receipt, policy no., e-Policy schedule, FIN and core postings",
                 "One e-Receipt RC/26/nnnnnn per policy; the policy is PAID and issued as PRO/26/nnnnnn with the "
                 "e-Policy schedule PDF; commission accrues; outbox messages to the core system (policy issued) "
                 "and FIN (receipt, commission); audit records; agent notified by e-mail with receipts; "
                 "participant e-mailed the e-Policy."),
            step(0, "Policy detail: Documents", "Download or E-mail documents", "The agent downloads or "
                 "re-sends the e-Policy and e-Receipt. The day's issuance is picked up by end of day (journey 9).",
                 kind="end"),
        ],
    ),
    dict(
        key="banca", title="Banca financing policy above B$ 150,000 with bulk payment by the bank", split=7,
        starts="Bank officer", ends="Policy ACTIVE; contribution settled by one bank transfer; receipts posted to FIN",
        demo="about 15 minutes across three users",
        rfp="FFR01 (FTPHP01–07), AP-32, AP-33, AP-38–AP-42, AP-60, AP-61, BO-16–BO-19",
        intro="Financing takaful is issued first and paid within the grace period. Every hire purchase case "
              "passes a quality check, and financing above B$ 150,000 is a referral; both are decided on the same "
              "request. The supervisor settles several policies with one transfer.",
        lanes=[("Bank officer", "user"), ("Underwriter", "user"), ("System", "system"),
               ("Bank supervisor", "user"), ("Finance officer", "user")],
        steps=[
            step(0, "New quotation", "Financing Takaful Plan – Hire Purchase; participant; financing details",
                 "Product tagged Pay after issue. Participant found by IC lookup or registered (AML screening). "
                 "Coverage: financing amount B$ 180,000, period 96 months, profit rate, financier, approval "
                 "reference, vehicle registration. The indicative contribution shows the referral reason."),
            step(0, "Policy detail: checklist", "Declarations, documents, signatures; Submit application",
                 "Mandatory documents for FTP-HP: proposal form, product disclosure sheet, IC copy, hire purchase "
                 "approval letter, drawdown letter; the HP statement is optional. Participant signature on screen "
                 "or by link."),
            step(2, "Referral", "PENDING APPROVAL; RQ to Underwriting",
                 "Two referral reasons are recorded: financing above the B$ 150,000 high-risk limit and the "
                 "quality check before contract issuance. Request RQ/26/nnnnnn is created with the sum covered "
                 "as its amount; approvers are notified; the officer sees Awaiting IIFT underwriting decision."),
            step(1, "Approvals: Approval detail", "Review reasons and documents; Approve",
                 "The request shows the referral reasons, sum covered, contribution and the policy documents; "
                 "Open policy shows the full record. Approve with remarks."),
            decision(2, "Sum covered ≥ B$ 300,000?", "yes: second approver", "no", 6,
                     "The Referred quotation workflow has a second step from B$ 300,000 sum covered. The same "
                     "person cannot approve both levels."),
            step(1, "Approvals: level 2", "Second underwriter approves",
                 "A second underwriter decides; the request header shows Level 2 of 2."),
            step(2, "Issuance (issue then pay)", "Policy FTP-HP/26/nnnnnn ACTIVE; payment due in 7 days",
                 "e-Policy schedule generated and e-mailed; core system notified; commission accrued; the officer is "
                 "notified with the due date; the policy appears in Billing & payments as outstanding."),
            step(3, "Billing & payments", "Select several policies; Submit payment",
                 "The supervisor sees the bank's outstanding list (overdue, due within 3 days). One drawer "
                 "allocates the transfer across the selected policies, with the bank reference and proof."),
            step(2, "Payment PY/26/nnnnnn", "Pending verification; RQ to Finance",
                 "Each policy's payment status becomes Pending verification; the grace-period check runs for the "
                 "bank."),
            step(4, "Approvals: payment verification", "Approve",
                 "Finance matches the reference and amount to the bank statement."),
            step(2, "Receipts", "One e-Receipt per policy; FIN postings; policies PAID",
                 "Receipts RC/26/nnnnnn per policy, posted to FIN through the outbox; the supervisor receives the "
                 "receipts by e-mail; any issuance block on the bank is lifted."),
            decision(2, "Unpaid after 7 days?", "yes", "no", 13,
                     "Nightly at 01:00 the grace-period job checks every agency and bank for policies whose "
                     "payment due date has passed."),
            step(2, "Bank blocked", "New business stopped until the overdue payment is verified",
                 "Dashboard alert for every user of the bank, e-mail and SMS, audit record AGENCY_BLOCKED. The "
                 "block lifts automatically once Finance verifies the payment, with a notification."),
            step(2, "End state", "Policy ACTIVE and PAID; bank not blocked",
                 "The day's policy and receipts are in the EOD report and FIN file.", kind="end"),
        ],
    ),
    dict(
        key="onboarding", title="Sub-agent onboarding",
        starts="Main agent (or the Operations officer from the back-office)",
        ends="Agent ACTIVE with a portal account; first sign-in completed",
        demo="about 8 minutes across three users",
        rfp="AP-07, AP-08, AP-46, AP-48, BO-05, BO-10, BO-11, BO-13, BO-17, BO-19, AP-01, AP-02",
        intro="The principal registers the applicant in the portal; IIFT verifies the IC copy and approves. The "
              "portal account is created on approval, never before.",
        lanes=[("Main agent", "user"), ("System", "system"), ("Compliance", "user"),
               ("Operations officer", "user"), ("Operations supervisor", "user")],
        steps=[
            step(0, "Team & hierarchy: Register agent", "Applicant details; Submit registration",
                 "Reports to (main agent), full name, ID type and number, date of birth, e-mail, mobile, address, "
                 "licence number and expiry. Banks register bank officers on the same page."),
            step(1, "Registration created", "Code AG-nnnnnn (BK- for banks), PENDING; AML screening; RQ raised",
                 "Duplicate ID numbers are refused. The agent is screened against the watch-lists; the Agent / "
                 "banker registration workflow raises RQ/26/nnnnnn for an Operations supervisor; approvers are "
                 "notified. The page shows the code, the AML outcome and the next steps."),
            step(0, "Registration submitted: Supporting documents", "Upload IC copy",
                 "The IC copy is required before IIFT can approve; a validity date can be recorded."),
            decision(1, "Possible AML match?", "yes: Compliance", "no", 5,
                     "A flagged applicant blocks approval (AML_NOT_CLEARED) until Compliance clears the case."),
            step(2, "AML / KYC: Review", "Cleared, or Confirmed match", "Journey 4. A confirmed match rejects the "
                 "registration automatically with the Compliance remarks."),
            step(3, "Document checks", "Verify the IC copy",
                 "Documents awaiting verification, oldest first; Verify or Reject with a reason. A rejected "
                 "document must be replaced by the principal."),
            step(4, "Approvals: Approval detail", "Check evidence; Approve",
                 "Supporting evidence shows the agent, status, AML status and documents. Missing documents or an "
                 "uncleared screening stop the approval with guidance. The maker can never approve its own "
                 "request."),
            step(1, "Activation", "Agent ACTIVE; portal account created; e-mail with temporary password",
                 "User name is the agent code (lower case); the first sign-in forces a password change. The core "
                 "system receives the agent record; the principal is notified."),
            step(0, "Sign in, Change password, Dashboard", "New sub-agent signs in",
                 "Password rules come from the Security parameters. The sub-agent appears in the hierarchy and may "
                 "quote at once.", kind="end"),
        ],
    ),
    dict(
        key="aml", title="AML review by Compliance, including a confirmed match",
        starts="System (screening) and Compliance officer", ends="Case CLEARED, or CONFIRMED MATCH with the "
        "subject rejected and its pending requests closed",
        demo="about 4 minutes",
        rfp="AP-16, AP-48, BO-13–BO-15, BO-19, BO-26",
        intro="Screening is automatic on every participant and agent registration and again at submission if a "
              "participant was never screened. Compliance decides flagged cases in one dialog.",
        lanes=[("Portal user", "user"), ("System", "system"), ("Compliance officer", "user")],
        steps=[
            step(0, "Register participant / Register agent", "Save the record",
                 "The portal page reports the outcome: registered, or registered and referred to Compliance."),
            step(1, "Screening", "Watch-lists (and external service); score",
                 "Exact ID number match scores 100; names are compared with fuzzy matching. An unavailable external "
                 "service forces a manual review rather than silently passing."),
            decision(1, "Score ≥ threshold (85)?", "yes: FLAGGED", "no: CLEAR", 7,
                     "Threshold is the Compliance parameter aml.match_threshold."),
            step(1, "Case PENDING REVIEW", "Subject FLAGGED; Compliance e-mailed",
                 "A flagged participant cannot be submitted; a flagged agent cannot be approved."),
            step(2, "AML / KYC: Screening cases", "Open the case; expand matches; Review",
                 "Matches show list, name, score and reason (name or ID number)."),
            step(2, "Review screening dialog", "Cleared – not the listed person, or Confirmed match; remarks",
                 "Remarks are mandatory and record the evidence checked."),
            step(1, "Decision applied", "CLEAR, or REJECTED with pending requests rejected",
                 "Cleared: the subject is CLEAR and the sale or registration continues. Confirmed match: the "
                 "subject is REJECTED, every pending request on it (for example the agent registration) is "
                 "rejected with the remarks, the maker is e-mailed, and the audit trail records AML_REVIEWED."),
            step(1, "End state", "Subject CLEAR or REJECTED; case closed",
                 "The screening history stays on the agent and participant records.", kind="end"),
        ],
    ),
    dict(
        key="servicing", title="Endorsement (nominee change) and cancellation through maker-checker",
        starts="Main agent", ends="Endorsement applied with a new e-Policy schedule; or policy CANCELLED with a "
        "pro-rata refund request",
        demo="about 6 minutes for both requests",
        rfp="AP-27, AP-28, AP-31, AP-33, AP-49–AP-51, AP-61, BO-16–BO-19",
        intro="Both changes are requests against an active policy. Nothing changes on the policy until the "
              "Operations supervisor approves; the agent follows the request under My requests.",
        lanes=[("Main agent", "user"), ("System", "system"), ("Operations supervisor", "user")],
        steps=[
            step(0, "Policy detail (ACTIVE)", "Request endorsement: Nominee change, description, nominees",
                 "The nominee editor pre-fills the current nominees; shares must total 100%. Submit request."),
            step(1, "Request RQ/26/nnnnnn", "Policy endorsement workflow; approvers notified",
                 "The payload stores the new nominees with ID numbers encrypted; the portal shows the request as "
                 "Pending under My requests."),
            step(2, "Approvals: Approval detail", "Review submitted details; Approve or Reject",
                 "Rejection needs a reason, shown to the agent with a hint to correct and resubmit."),
            step(1, "Endorsement applied", "Nominees replaced; new e-Policy schedule; core notified",
                 "Policy history records ENDORSED; an endorsed e-Policy schedule PDF is stored; audit "
                 "POLICY_ENDORSED; the agent is notified."),
            step(0, "Policy detail (ACTIVE)", "Request cancellation: reason, effective date, remarks",
                 "Reason codes come from master data; the effective date cannot precede the cover start. The "
                 "policy stays in force until approval."),
            step(1, "Request RQ/26/nnnnnn", "Policy cancellation workflow with the contribution as amount",
                 "An amount threshold can add a second level in Workflows."),
            step(2, "Approvals: Approval detail", "Approve",
                 "Same inbox; the maker-checker rule applies."),
            step(1, "Cancellation applied", "Status CANCELLED; refund calculated; FIN refund request",
                 "Refund is pro-rated on the unexpired days of what was actually paid; the core system is told; "
                 "the agent is notified with the refund amount.", kind="end"),
        ],
    ),
    dict(
        key="renewal", title="Renewal inside the window",
        starts="Sub-agent", ends="Renewal policy ACTIVE from the day after the old cover ends",
        demo="about 6 minutes including payment",
        rfp="AP-26, AP-25, AP-34, AP-39–AP-41, FFR02 (APHA02), FFR03 (APPT02)",
        intro="Renewable products (PHA, PRO, OSA) are listed from 45 days before the end of cover (parameter) "
              "until 30 days after it. KHR is configured as not renewable.",
        lanes=[("Sub-agent", "user"), ("System", "system"), ("Finance officer", "user")],
        steps=[
            step(1, "Renewal window", "Policy listed under Renewals; dashboard tile; expiry job",
                 "The nightly expiry job moves policies past their end date to EXPIRED and notifies the agent; "
                 "an expired policy can still be renewed for 30 days."),
            step(0, "Renewals", "Renew",
                 "Also available as Renew on the policy page. Days left are shown per policy."),
            step(1, "Renewal quotation created", "Cover, options, risk details and nominees copied",
                 "Start date is the day after the old end date; the quotation is linked as Renewal of the old "
                 "policy; only one open renewal per policy."),
            step(0, "Policy detail: checklist", "Declarations, documents, signature; Submit application",
                 "Declarations and the participant signature are collected again; documents can be re-uploaded."),
            step(0, "Billing & payments", "Submit payment with proof",
                 "Pay-before-issue product: the renewal waits for the contribution."),
            step(2, "Approvals", "Verify payment",
                 "As journey 1."),
            step(1, "Issuance", "New policy no.; e-Policy and e-Receipt; old policy expires on its end date",
                 "Both policies show the link to each other in Policy record.", kind="end"),
        ],
    ),
    dict(
        key="claim", title="Claim notification and back-office review",
        starts="Main agent", ends="Claim CLOSED after acknowledgement or rejection; agent informed at each step",
        demo="about 4 minutes",
        rfp="AP-43, AP-34, AP-54, INT-01",
        intro="The portal records the notification and forwards it to IIFT; the claims team tracks the status "
              "here and the agent sees every remark.",
        lanes=[("Main agent", "user"), ("System", "system"), ("Claims (Operations officer)", "user")],
        steps=[
            step(0, "Claims: Notify claim", "Enter the policy number; Validate",
                 "Also from the policy page's Claims tab. The policy must be ACTIVE or EXPIRED and in the agent's "
                 "scope; the card shows product, participant, period of cover and sum covered."),
            step(0, "Notify claim", "Claim type, date of event, what happened, amount claimed; Notify claim",
                 "The event date must fall within the period of cover and not in the future."),
            step(1, "Claim CL/26/nnnnnn", "Policy history; core system message; claims staff notified",
                 "Outbox message Claim notified to the core system; in-app notification to everyone with the claims "
                 "permission; audit CLAIM_NOTIFIED."),
            step(0, "Claim detail: Supporting documents", "Upload",
                 "Discharge summary, invoices, reports."),
            step(2, "Claims: Claim detail", "Update status: Under review",
                 "Remarks are mandatory and shared with the agent."),
            step(2, "Claim detail", "Acknowledged or Rejected, then Closed",
                 "Allowed moves: Submitted → Under review or Rejected; Under review → Acknowledged or Rejected; "
                 "Acknowledged or Rejected → Closed."),
            step(1, "Agent notified", "In-app notification per status change",
                 "The agent opens the claim from the notification and reads IIFT's remarks.", kind="end"),
        ],
    ),
    dict(
        key="issue", title="Support issue with SLA",
        starts="Sub-agent (any user)", ends="Issue CLOSED by the reporter, or reopened",
        demo="about 5 minutes",
        rfp="AP-55–AP-57, BO-29–BO-31, COM-05",
        intro="Response and resolution targets per priority are parameters of the issue module (Critical 1 h / 4 h, "
              "High 2 h / 24 h, Medium 8 h / 72 h, Low 24 h / 168 h), set by IIFT for the issues its users raise; "
              "they are distinct from the support SLA iorta commits to in Section {maintenance}. A job checks them "
              "every five minutes.",
        lanes=[("Reporter", "user"), ("System", "system"), ("Support officer", "user")],
        steps=[
            step(0, "Support: Report an issue", "Title, category, priority, description; Submit",
                 "Priority definitions are shown on the form: Critical means business stopped."),
            step(1, "Issue IS/26/nnnnnn", "SLA targets set; support e-mailed (SMS for Critical)",
                 "The confirmation shows the reference number and the response target; attachments can be added."),
            step(2, "Issues: Issue detail", "Assign (counts as first response); set priority",
                 "Assignment to a support user and team; changing priority recalculates both targets from the "
                 "reporting time."),
            step(2, "Conversation", "Reply to the reporter or add an internal note",
                 "Replies notify the reporter; internal notes stay in the back-office."),
            decision(1, "Target missed?", "yes: breach", "no", 6,
                     "Every five minutes the monitor flags issues past their response or resolution target."),
            step(1, "SLA breached", "Tag on the issue; e-mail alert to support; dashboard count",
                 "The dashboard queue links to the breached filter."),
            step(2, "Change status", "In progress → Resolved with resolution text",
                 "The resolution is e-mailed to the reporter."),
            step(0, "Support: Issue detail", "Confirm and close, or Reopen",
                 "Reopening returns the issue to In progress.", kind="end"),
        ],
    ),
    dict(
        key="eod", title="End of day, FIN posting and reconciliation",
        starts="Scheduler (or Finance officer on demand)", ends="Run COMPLETED; FIN posting queued; reconciliation "
        "MATCHED, or MISMATCH with the unmatched receipts listed",
        demo="about 3 minutes",
        rfp="FFR01 FTPHP08, FFR02 APHA07, FFR03 APPT08, FFR04 APKT07, FFR05 APAOS08, INT-04, INT-13–INT-15",
        intro="End of day runs at the configured time and can be run again for a date; a re-run is a new "
              "revision that replaces the earlier FIN posting.",
        lanes=[("Finance officer", "user"), ("System", "system"), ("FIN", "system")],
        steps=[
            step(0, "End of day", "Run end of day; choose the business date",
                 "The scheduler does the same at the EOD time. A run already in progress for the date is refused."),
            step(1, "Totals", "Policies issued and receipts of the day",
                 "Counts and amounts by product."),
            step(1, "Files", "EOD report (Excel) and FIN interface file (CSV) stored",
                 "Report sheets: Summary, Policies issued, Receipts. FIN file: one PI line per policy, one RC line "
                 "per receipt, agreed with Finance in the interface specification."),
            step(1, "FIN posting queued", "Outbox message EOD-date-Rn",
                 "Idempotency key per revision so FIN ignores a duplicate; retries with back-off; dead letter after "
                 "six attempts, visible on the Integration page."),
            step(2, "FIN", "Receives the posting",
                 "In simulated mode the delivered outbox messages stand in for FIN."),
            step(1, "Reconciliation", "Receipts issued vs receipts posted",
                 "Expected and matched counts and amounts; status MATCHED or MISMATCH with the unmatched receipt "
                 "numbers; audit RECONCILIATION_RUN."),
            step(0, "End of day; Integration: Reconciliation", "Download files; review the run; re-submit if needed",
                 "A mismatch is investigated in the message queue and log, then Run reconciliation again for the "
                 "date.", kind="end"),
        ],
    ),
    dict(
        key="admin", title="Administration: users, roles, workflows, products and parameters with audit",
        starts="System administrator", ends="Configuration changed with before and after values in the audit trail",
        demo="about 8 minutes",
        rfp="BO-02–BO-04, BO-16, BO-18, BO-26–BO-28, BO-32, BO-33, COM-04, COM-09",
        intro="Every maintenance action below writes an audit record with the previous and new values, the user, "
              "time, address and correlation id; the table is append-only.",
        lanes=[("System administrator", "user"), ("System", "system")],
        steps=[
            step(0, "Users: New staff user", "User name, sign-in method, details, roles; Create user",
                 "Local accounts get a one-time temporary password shown once; directory accounts sign in through "
                 "AD. Edit, Disable, Unlock and Reset password are confirmed before they run."),
            step(0, "Roles & permissions: Edit role", "Pick permissions; Save",
                 "Permissions are limited to the role's module; system roles cannot be deleted; a role in use "
                 "cannot be deleted."),
            step(0, "Workflows", "Approval required; steps, Approved by, Applies from amount; Save",
                 "Up to five steps per transaction type; only approval permissions are accepted; a step with an "
                 "amount applies from that amount."),
            step(0, "Products: Edit", "Flags, rating configuration, required documents, questionnaire; Save",
                 "Payment before issuance, renewal allowed and offered for sale; JSON validated on save; the "
                 "change applies to new quotations."),
            step(0, "Parameters & master data", "Edit a value within its allowed range; add or deactivate codes",
                 "Grace days, quotation validity, renewal notice, e-signature link hours, AML threshold, SLA hours, "
                 "integration attempts; code tables for banks, districts, claim types, reasons."),
            step(1, "Audit", "USER_CREATED, WORKFLOW_UPDATED, PRODUCT_UPDATED, PARAMETER_UPDATED …",
                 "Each with before and after values."),
            step(0, "Audit trail", "Filter by user, action, record; expand the row",
                 "Evidence for internal audit and the regulator.", kind="end"),
        ],
    ),
]

def journey_no(key: str) -> int:
    """Number of a journey as printed in the chapter, so other chapters never hard-code it."""
    return next(index for index, journey in enumerate(JOURNEYS, start=1) if journey["key"] == key)


CONVENTIONS = [
    ["Ctrl+K", "Focuses the global search in the header; results are grouped and a result opens the record."],
    ["Row click", "Clicking a table row opens the record; links and buttons inside the row keep their own action."],
    ["Status tags", "Statuses are colour tags everywhere (Draft, Pending approval, Active, Pending verification, "
                    "Paid, Rejected, Cancelled); the same words are used in filters."],
    ["Breadcrumb", "Home › list › record on every page; the record reference is the page title."],
    ["Page actions", "Right-aligned; the primary action is last; dangerous actions (reject, cancel, discard) are "
                     "red and confirmed."],
    ["Dialogs and drawers", "A short change opens a dialog; a longer form (payment, role, product) opens a "
                            "drawer from the right so the page stays visible."],
    ["Checklist", "A draft application shows what remains before submission, with a button per item."],
    ["Maker-checker", "A change that needs approval is submitted as a request; My requests (portal) and Approvals "
                      "(back-office) show the same request from both sides; remarks are mandatory on rejection."],
    ["Work queues", "Dashboards list queues with counts; each links to the filtered list."],
    ["Notifications", "Bell with unread count; every notification links to the record; e-mail and SMS copies "
                      "for the events configured."],
    ["Filters in the URL", "Dashboard links carry the filter (for example status=DRAFT) so a list opens filtered."],
    ["Navigation state", "Collapsed navigation and open groups are remembered per browser; on a phone the "
                         "navigation is a drawer."],
    ["Session", "Idle timeout and absolute lifetime from the Security parameters; signing in again shows why."],
]


# =============================================================================
# Rendering
# =============================================================================
def _aspect(path):
    with Image.open(path) as image:
        width, height = image.size
    return height / width


def _screenshot(figs, entry):
    path = brand.SCREENSHOT_DIR / entry["file"]
    if not path.exists():
        path = diagrams.screenshot_placeholder(figs["out_dir"], entry["file"], entry["title"])
    return path


def _render_entries(w, figs, entries, max_width=8.2):
    """Full-width entries as single figures; half-width entries two per row."""
    pending = []

    def flush():
        if pending:
            w.figure_grid(pending, max_width_cm=max_width)
            pending.clear()

    for entry in entries:
        path = _screenshot(figs, entry)
        caption = f"{entry['title']}: {entry['caption']}"
        if entry["width"] == "full":
            flush()
            w.figure(path, caption, width_cm=16.0)
        else:
            pending.append((path, caption, _aspect(path)))
    flush()


def _nav_figure(figs, key):
    persona = PERSONAS[key]
    perms = ROLE_PERMISSIONS[persona["role"]]
    portal = persona["module"] == "portal"
    menu = PORTAL_MENU if portal else BACKOFFICE_MENU
    groups = visible_menu(menu, perms, persona.get("highlight", ()))
    if portal:
        search = "Search policy, quotation, participant or agent"
        actions = ["+ New quotation"] if "portal.policies.quote" in perms else []
    else:
        searchable = any(p in perms for p in ("bo.policies.view", "bo.participants.view", "bo.agents.view"))
        search = "Search policy, participant or agent" if searchable else "No searchable records for this role"
        actions = []
    user = " ".join(persona["demo"].split(",")[0].split(" (")[0].split()[:3])
    scope = "Data scope: " + persona["scope"]
    return diagrams.nav_tree(figs["out_dir"], key, "Agent & Banca Portal" if portal else "Back-office", groups,
                             actions, user, search, notes=persona.get("notes"), scope_note=scope,
                             searchable=portal or searchable)


def _persona_section(w, figs, key):
    persona = PERSONAS[key]
    w.h2(persona["name"])
    assert w.section_no == numbering.PEOPLE_SECTIONS.index(key) + 1, f"Section numbering out of step at {key}"
    w.h3("Profile")
    w.key_value_table([
        ("Who", persona["who"]),
        ("Goals", persona["goals"]),
        ("How often", persona["frequency"]),
        ("Device", persona["device"]),
        ("Role and permissions", f"{persona['role']}: {persona['permissions']}"),
        ("Data scope", persona["scope"]),
        ("Demo user", f"{persona['demo']} ({USERS[key]})"),
        ("RFP requirements covered", persona["rfp"]),
    ], widths=(4.0, 13.0), caption=f"{persona['name']}: profile")
    w.h3("Navigation")
    w.para("The menu below is what this role sees after sign-in; items the role has no permission for are not "
           "rendered. The right-hand column lists the pages, dialogs and actions behind each item.",
           keep_with_next=True)
    w.figure(_nav_figure(figs, key), f"{persona['name']}: navigation map", width_cm=16.5)
    w.h3("Screens")
    if persona["module"] == "portal":
        rows = [PORTAL_SCREEN_ROWS[k] for k in PERSONA_SCREEN_KEYS[key]]
    else:
        rows = BACKOFFICE_SCREEN_ROWS[key]
    w.table(["Screen", "Purpose", "What this persona does there", "RFP IDs"], rows,
            widths=[3.6, 5.0, 5.4, 3.0], font_size=7.5, padding=25, bold_first_col=True,
            caption=f"{persona['name']}: screens")
    entries = entries_for(key)
    if entries:
        w.h3("Screens in sequence")
        w.para("The images follow the order in which this persona meets the screens. All data is demonstration "
               "data.", keep_with_next=True)
        _render_entries(w, figs, entries)


def _parts(journey):
    """A long journey is drawn in two figures; step numbers and branch targets carry over."""
    steps = journey["steps"]
    split = journey.get("split")
    if not split:
        return [(1, steps)]
    second = []
    for s in steps[split:]:
        s = dict(s)
        if s.get("no_to") is not None:
            s["no_to"] -= split
        second.append(s)
    return [(1, steps[:split]), (split + 1, second)]


def _journey_section(w, figs, index, journey):
    w.h3(f"Journey {index}: {journey['title']}")
    w.key_value_table([
        ("Starts with", journey["starts"]),
        ("Ends with", journey["ends"]),
        ("Time in the demonstration", journey["demo"]),
        ("RFP requirements", journey["rfp"]),
    ], widths=(4.0, 13.0))
    w.para(journey["intro"].format(maintenance=numbering.sec("maintenance")), keep_with_next=True)
    for part_no, (start, steps) in enumerate(_parts(journey), start=1):
        figure = diagrams.journey_flow(figs["out_dir"], journey["key"], journey["lanes"], steps, start=start)
        aspect = _aspect(figure)
        width = min(16.5, 23.0 / aspect)
        suffix = "" if "split" not in journey else f" (part {part_no} of 2)"
        w.figure(figure, f"Journey {index}: {journey['title']}{suffix}", width_cm=width)
    rows = []
    for number, s in enumerate(journey["steps"], start=1):
        who = journey["lanes"][s["lane"]][0]
        screen = s["screen"] if s["kind"] != "decision" else f"Decision: {s['screen']}"
        rows.append([str(number), who, screen, s["detail"]])
    w.table(["Step", "Who", "Screen or system step", "What happens"], rows, widths=[1.1, 3.0, 4.2, 8.7],
            font_size=7.5, padding=25, center_cols=(0,))


def people_chapter(w: ProposalWriter, figs: dict):
    w.h1("Personas, Screens, Journeys and Navigation")
    w.para(f"This chapter shows the {brand.SOLUTION_NAME} as each kind of user meets it: who they are, what their "
           "menu contains, which screens they work in and how the end-to-end journeys run across the portal, the "
           "back-office and the system's own steps (numbering, notifications, outbox messages, audit). Menus are "
           "taken from the role definitions shipped with the product, and journeys are described as the services "
           "execute them today, not as a design intent.")

    # 7.1 Overview
    w.h2("Who uses what")
    w.para("Eleven personas cover the RFP's users: four work in the Agent/Banca Portal (labelled Agent & Banca "
           "Portal on screen) and seven in the Back-office. Each persona is a seeded role; IIFT can change the "
           "permissions of a role or add roles in the Back-office without a release.")
    rows = []
    for key in PERSONA_ORDER:
        p = PERSONAS[key]
        rows.append([p["name"], "Agent & Banca Portal" if p["module"] == "portal" else "Back-office", p["role"],
                     p["scope"], USERS[key]])
    rows += [
        ["Management (read-only)", "Back-office", "MANAGEMENT", "KPIs, trends and reports; no approvals", "manager"],
        ["Internal auditor", "Back-office", "AUDITOR", "Records and audit trail, read-only", "–"],
        ["Participant", "Public e-signature page", "no account", "One quotation, through a single-use link", "–"],
    ]
    w.table(["Persona", "Module", "Seeded role", "Data scope", "Demo user"], rows,
            widths=[3.6, 2.8, 4.3, 4.3, 2.0], font_size=7.5, padding=25, bold_first_col=True,
            caption="Personas, roles and data scope")
    management = entries_for("management")
    if management:
        _render_entries(w, figs, management)

    # 7.2 Navigation model
    w.h2("Navigation model")
    w.para("Both modules share one shell: a header with the module name, global search, the module's primary "
           "action, notifications and the user menu; a side navigation of groups; and a content area that always "
           "runs list → detail → action. The figure names the parts; the table lists the conventions a user "
           "learns once and meets on every screen.")
    portal_groups = [(label, [item for item, _, _ in items]) for label, items in PORTAL_MENU]
    bo_groups = [(label, [item for item, _, _ in items]) for label, items in BACKOFFICE_MENU]
    w.figure(diagrams.navigation_model(figs["out_dir"], portal_groups, bo_groups),
             "Navigation model: header, side navigation of both modules, record page and conventions", width_cm=16.5)
    w.table(["Convention", "Behaviour"], CONVENTIONS, widths=[3.4, 13.6], font_size=8, padding=25,
            bold_first_col=True, caption="Keyboard and interaction conventions")
    shared = entries_for("shared")
    if shared:
        w.para("Screens shared by every persona:", keep_with_next=True)
        _render_entries(w, figs, shared)

    # 7.3 – 7.13 personas
    for key in PERSONA_ORDER:
        _persona_section(w, figs, key)

    # 7.14 journeys
    w.h2("End-to-end journeys")
    assert w.section_no == numbering.PEOPLE_SECTIONS.index("journeys") + 1
    w.para("Ten journeys cover new business for both product families, onboarding, compliance, servicing, "
           "renewal, claims, support, end of day and administration. In each figure the columns are the people "
           "and the system, the boxes are numbered in order, orange boxes are automatic system steps, diamonds are "
           "the points where the system branches and orange arrows are hand-offs from one person to another. The "
           "table under each figure gives the detail of every step, including the reference numbers assigned, the "
           "messages sent and the audit records written. The times quoted are what the steps take in a "
           "demonstration with the seeded data.")
    for index, journey in enumerate(JOURNEYS, start=1):
        _journey_section(w, figs, index, journey)
    participant = entries_for("participant")
    if participant:
        w.para("The participant's only screen, reached from the e-mailed link in journeys "
               f"{journey_no('annual')}, {journey_no('banca')} and {journey_no('renewal')}:", keep_with_next=True)
        _render_entries(w, figs, participant)

    # 7.15 screen index
    w.h2("Screen index")
    assert w.section_no == numbering.PEOPLE_SECTIONS.index("screens") + 1
    w.para("Every screen of the product with its path and the personas that use it. Paths are the browser "
           "routes of the single-page application; record pages take the record's identifier.")
    w.table(["Screen", "Path", "Personas"], SCREEN_INDEX, widths=[5.2, 5.6, 6.2], font_size=7.5, padding=22,
            bold_first_col=True, caption="Screen index")


SCREEN_INDEX = [
    ("GROUP", "Shared"),
    ["Sign in", "/login", "Everyone"],
    ["Change password", "/change-password", "Everyone"],
    ["Notifications", "/portal/notifications, /backoffice/notifications", "Everyone"],
    ["Participant e-signature page", "/esign/{token}", "Participant (no account)"],
    ("GROUP", "Agent & Banca Portal"),
    ["Dashboard", "/portal", "All portal personas"],
    ["New quotation (Product, Participant, Coverage, Review)", "/portal/quotations/new", "All portal personas"],
    ["Quotations & policies", "/portal/policies", "All portal personas"],
    ["Policy detail (checklist, tabs, dialogs: Declarations, Nominees, Signature, Send e-signature link, "
     "Endorsement, Cancellation, E-mail documents)", "/portal/policies/{id}", "All portal personas"],
    ["Renewals", "/portal/renewals", "All portal personas"],
    ["Participants, Register participant, Participant detail, Request update",
     "/portal/participants, /participants/new, /participants/{id}", "All portal personas"],
    ["Billing & payments, Submit payment drawer, Payment detail", "/portal/billing, /billing/payments/{id}",
     "All portal personas; bulk payment typically the bank supervisor"],
    ["Claims, Notify claim, Claim detail", "/portal/claims, /claims/new, /claims/{id}", "All portal personas"],
    ["My requests, Request detail", "/portal/requests, /requests/{id}", "All portal personas"],
    ["Team & hierarchy, Team member, Register agent / bank officer", "/portal/team, /team/{id}, /team/register",
     "All; registration by main agent and bank supervisor"],
    ["Commission", "/portal/commission", "All portal personas"],
    ["Reports", "/portal/reports", "All portal personas"],
    ["Support, Report an issue, Issue detail", "/portal/issues, /issues/{id}", "All portal personas"],
    ["My profile", "/portal/profile", "All portal personas"],
    ("GROUP", "Back-office"),
    ["Dashboard", "/backoffice", "All back-office personas"],
    ["Approvals, Approval detail", "/backoffice/approvals, /approvals/{id}",
     "Operations supervisor, Underwriter, Finance officer"],
    ["Agents & bankers, Register agent or bank officer, Agent detail", "/backoffice/agents, /agents/new, /agents/{id}",
     "Operations officer (maker), checkers, Compliance, Support (read)"],
    ["Agencies & banks, Agency detail", "/backoffice/agencies, /agencies/{id}",
     "Operations officer, System administrator, others read"],
    ["Policies, Policy record", "/backoffice/policies, /policies/{id}", "Operations, Underwriter, Finance, Compliance"],
    ["Participants, Participant record", "/backoffice/participants, /participants/{id}",
     "Operations, Underwriter, Finance, Compliance"],
    ["Payments, Payment detail", "/backoffice/payments, /payments/{id}", "Finance officer; Operations read"],
    ["Claims, Claim detail", "/backoffice/claims, /claims/{id}", "Operations officer"],
    ["AML / KYC (Screening cases, Watch-lists, Review dialog)", "/backoffice/aml", "Compliance officer"],
    ["Document checks", "/backoffice/documents", "Operations officer, Operations supervisor, Underwriter"],
    ["Audit trail", "/backoffice/audit", "Compliance officer, System administrator, Internal auditor"],
    ["Issues, Issue detail", "/backoffice/issues, /issues/{id}", "Support officer, Operations officer"],
    ["Reports, Scheduled reports", "/backoffice/reports", "All back-office personas; schedules for Finance, "
     "Management, System administrator"],
    ["End of day", "/backoffice/eod", "Finance officer"],
    ["Integration (Message queue, Integration log, Reconciliation)", "/backoffice/integration",
     "Finance officer, System administrator"],
    ["Users, New staff user", "/backoffice/users", "System administrator"],
    ["Roles & permissions, Edit role", "/backoffice/roles", "System administrator"],
    ["Workflows", "/backoffice/workflows", "System administrator"],
    ["Products, Edit product", "/backoffice/products", "System administrator"],
    ["Parameters & master data", "/backoffice/settings", "System administrator"],
]
