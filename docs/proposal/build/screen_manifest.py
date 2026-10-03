"""Screenshot manifest for the proposal: one entry per application screen image.

This module is the single source of truth for the screen images used in the
"Personas, screens, journeys and navigation" chapter. The proposal build reads
PERSONA_SCREENS directly; the capture script (tools/screenshots/capture.mjs)
reads the same list as JSON:

    python3 docs/proposal/build/screen_manifest.py --json

Each entry:
    file      PNG name under docs/proposal/screenshots/ (01..24 are the original set)
    persona   persona key from sections_people (or "participant", "management", "shared")
    user      demo user name to sign in as (None for public pages)
    title     short name used in the figure caption
    caption   what the reader should notice
    route     path opened after sign-in; ${ENV} placeholders are filled from the environment
    actions   optional steps run before the capture (see tools/screenshots/README.md)
    width     "full" (16.5 cm) or "half" (two per row)
    manual    True when the image is produced by hand (e.g. a PDF page), so the capture skips it

Selectors in actions use roles, labels and visible text, never CSS classes, so a
restyle of the interface does not break them.
"""

import json
import sys

# Demo users (apps/api/prisma/seed-demo.ts). Portal user names are the agent codes.
USERS = {
    "main_agent": "ag-000001",      # Hajah Siti Aminah binti Haji Osman, Seri Amanah Takaful Agency
    "sub_agent": "ag-000002",       # Muhammad Firdaus bin Abdullah, reports to AG-000001
    "bank_officer": "bk-000004",    # Nurul Huda binti Hassan, Mutiara Islamic Bank, Gadong branch
    "bank_supervisor": "bk-000005",  # Pengiran Khairul Anwar bin Pengiran Ismail, bank-wide view
    "ops_maker": "ops.maker",
    "ops_checker": "ops.checker",
    "underwriter": "underwriter",
    "finance": "finance",
    "compliance": "compliance",
    "support": "support",
    "sysadmin": "admin",            # first administrator from seed.ts (SEED_ADMIN_PASSWORD)
    "management": "manager",
}


def _entry(file, persona, title, caption, route, actions=None, width="half", user=None, manual=False):
    return {
        "file": file,
        "persona": persona,
        "user": USERS.get(persona) if user is None else user,
        "title": title,
        "caption": caption,
        "route": route,
        "actions": actions or [],
        "width": width,
        "manual": manual,
    }


# Shorthands for the action steps understood by capture.mjs
def click(name, role="button", **extra):
    return {"click": {"role": role, "name": name, **extra}}


def link(name, **extra):
    return click(name, role="link", **extra)


def tab(name):
    return {"click": {"role": "tab", "name": name}}


def text(value):
    return {"clickText": value}


def fill(label, value):
    return {"fill": {"label": label, "value": value}}


def select(label, option):
    return {"select": {"label": label, "option": option}}


def wait(ms):
    return {"wait": ms}


FIRST_REFERENCE = "/^(QT|PRO|KHR|OSA|PHA|FTP-HP|FTP-NP|PFT)\\//"   # first quotation or policy link in a table
FIRST_REQUEST = "/^RQ\\//"
FIRST_CLAIM = "/^CL\\//"
FIRST_ISSUE = "/^IS\\//"
FIRST_PAYMENT = "/^PY\\//"
FIRST_AGENT = "/^(AG|BK)-/"
FIRST_AGENCY = "/^(AGY|BNK)-/"

PERSONA_SCREENS = [
    # --- Sign-in and shared pages ------------------------------------------------------
    _entry("01-login.png", "shared", "Sign in",
           "Username and password; the account locks after the configured number of failed attempts.",
           "/login", user=None),
    _entry("85-shared-change-password.png", "shared", "Change password",
           "Password rules from the Security parameters; required at first sign-in and after a reset.",
           "/change-password", user=USERS["sub_agent"]),
    _entry("42-agent-notifications.png", "shared", "Notifications",
           "Every in-app notification links to the record it is about; unread items are marked.",
           "/portal/notifications", user=USERS["main_agent"]),
    _entry("43-agent-global-search.png", "shared", "Global search (Ctrl+K)",
           "Results grouped by policies and quotations, participants and team; a result opens the record.",
           "/portal", user=USERS["main_agent"],
           actions=[{"press": "Control+k"}, {"type": "PRO"}, wait(900)]),

    # --- Main agent (agency principal) ---------------------------------------------------
    _entry("02-portal-dashboard.png", "main_agent", "Dashboard",
           "Agency-wide figures, work queues and follow-ups for the principal.", "/portal", width="full"),
    _entry("07-policy-detail.png", "main_agent", "Policy detail (active)",
           "Overview, servicing actions, tabs for documents, payments and receipts, history and approvals.",
           "/portal/policies?status=ACTIVE", actions=[link(FIRST_REFERENCE)], width="full"),
    _entry("09-billing-payment.png", "bank_officer", "Submit payment",
           "Outstanding contributions; one payment allocated per policy with proof of payment.",
           "/portal/billing", actions=[click("Pay now")], width="full"),
    _entry("26-agent-policy-checklist.png", "main_agent", "Draft application checklist",
           "What remains before submission: declarations, nominees, documents and signatures.",
           "/portal/policies?status=DRAFT", actions=[link(FIRST_REFERENCE)], width="full"),
    _entry("06-policy-list.png", "main_agent", "Quotations & policies",
           "Agency-wide list with the Agent column, status and payment filters.", "/portal/policies"),
    _entry("27-agent-declarations-dialog.png", "main_agent", "Declarations",
           "Health and risk questions; a Yes answer needs details and refers the case to underwriting.",
           "/portal/policies?status=DRAFT", actions=[link(FIRST_REFERENCE), click("/^(Answer|Review answers)$/")]),
    _entry("28-agent-nominees-dialog.png", "main_agent", "Nominees",
           "Nominee, beneficiary or executor with relationship and share; shares must total 100%.",
           "/portal/policies?status=DRAFT", actions=[link(FIRST_REFERENCE), click("/^(Add nominees|Edit nominees)$/")]),
    _entry("29-agent-signature-dialog.png", "main_agent", "Signature on screen",
           "Participant or agent signs on the agent's device; the image is stored against the application.",
           "/portal/policies?status=DRAFT", actions=[link(FIRST_REFERENCE), click("Sign on screen", nth=1)]),
    _entry("30-agent-esign-link-dialog.png", "main_agent", "Send e-signature link",
           "One-time link e-mailed to the participant; validity set by the e-signature parameter.",
           "/portal/policies?status=DRAFT", actions=[link(FIRST_REFERENCE), click("/^(Send link|Resend link)$/")]),
    _entry("38-agent-team.png", "main_agent", "Team & hierarchy",
           "Agency record, issuance block status, reporting hierarchy and team members.", "/portal/team"),
    _entry("39-agent-register.png", "main_agent", "Register agent",
           "Applicant details, documents and IIFT approval shown as three steps.", "/portal/team/register"),
    _entry("36-agent-requests.png", "main_agent", "My requests",
           "Every maker-checker request with its status, decision and remarks.", "/portal/requests"),
    _entry("37-agent-request-detail.png", "main_agent", "Request detail",
           "Submitted details, approval history and a Withdraw action while pending.",
           "/portal/requests", actions=[link(FIRST_REQUEST)]),
    _entry("41-agent-commission.png", "main_agent", "Commission",
           "Accrued and paid commission by period, agency-wide for the principal.", "/portal/commission"),
    _entry("10-claims.png", "main_agent", "Claims",
           "Claim notifications of the agency with status.", "/portal/claims"),
    _entry("34-agent-claim-form.png", "main_agent", "Notify claim",
           "Policy validated first; then claim type, date of event within cover, description, amount.",
           "/portal/claims/new?policyNo=PRO/26/000001"),
    _entry("35-agent-claim-detail.png", "main_agent", "Claim detail",
           "Claim, policy, IIFT remarks and supporting documents uploaded after notification.",
           "/portal/claims", actions=[link(FIRST_CLAIM)]),
    _entry("32-agent-renewals.png", "main_agent", "Renewals",
           "Policies whose cover ends inside the renewal window, with days left and a Renew action.",
           "/portal/renewals"),

    # --- Sub-agent ---------------------------------------------------------------------
    _entry("03-quotation-product.png", "sub_agent", "New quotation: product",
           "Products grouped by line of business with pay-before or pay-after-issue tags.",
           "/portal/quotations/new", width="full"),
    _entry("25-agent-participant-register.png", "sub_agent", "Register participant",
           "Individual or corporate; ID, personal and contact details; AML screening runs on save.",
           "/portal/participants/new"),
    _entry("04-quotation-wizard.png", "sub_agent", "New quotation: coverage",
           "Plan and options for the chosen product; the indicative contribution updates as fields change.",
           "/portal/quotations/new",
           actions=[text("Professional Takaful Plan"), click("Next"), click("Select", first=True), click("Next")]),
    _entry("05-quotation-summary.png", "sub_agent", "New quotation: review",
           "Participant, coverage and contribution breakdown before the quotation is saved.",
           "/portal/quotations/new",
           actions=[text("Professional Takaful Plan"), click("Next"), click("Select", first=True), click("Next"),
                    text("Plan A"), click("Review")]),
    _entry("08-participants.png", "sub_agent", "Participants",
           "Own participants with participant number, masked ID and AML status.", "/portal/participants"),
    _entry("33-agent-payment-detail.png", "sub_agent", "Payment detail",
           "Allocation, proof of payment, verification status and the e-Receipts once verified.",
           "/portal/billing", actions=[tab("Payment history"), link(FIRST_PAYMENT)]),
    _entry("40-agent-profile.png", "sub_agent", "My profile",
           "Registered profile, portal user name, documents and change requests.", "/portal/profile"),
    _entry("11-issues.png", "sub_agent", "Support",
           "Issues reported by the user with priority, status and SLA targets.", "/portal/issues"),
    _entry("44-agent-report-issue-dialog.png", "sub_agent", "Report an issue",
           "Title, category, priority with definitions and description; attachments after submission.",
           "/portal/issues", actions=[click("Report an issue")]),

    # --- Bank officer ------------------------------------------------------------------
    _entry("45-banker-dashboard-blocked.png", "bank_officer", "Dashboard with issuance block",
           "The seven-day grace period has lapsed for the bank: new business is blocked until payment is submitted.",
           "/portal", width="full"),
    _entry("46-banker-quotation-hp.png", "bank_officer", "Hire purchase quotation",
           "Financing amount, period, profit rate, financier and reference; above B$150,000 the case is referred.",
           "/portal/quotations/new",
           actions=[text("Financing Takaful Plan – Hire Purchase"), click("Next"), click("Select", first=True),
                    click("Next")], width="full"),
    _entry("47-banker-policy-referred.png", "bank_officer", "Referred application",
           "Awaiting the IIFT underwriting decision; the referral reasons are shown on the overview.",
           "/portal/policies?status=PENDING_APPROVAL", actions=[link(FIRST_REFERENCE)], width="full"),

    # --- Bank supervisor ---------------------------------------------------------------
    _entry("48-banker-bulk-payment.png", "bank_supervisor", "Bulk payment",
           "Several policies settled with one bank transfer; amounts allocated per policy.",
           "/portal/billing", actions=[{"checkAllRows": True}, click("Submit payment")], width="full"),
    _entry("49-supervisor-team.png", "bank_supervisor", "Bank team",
           "Bank-wide hierarchy and officers, with the Register bank officer action.", "/portal/team"),
    _entry("50-supervisor-reports.png", "bank_supervisor", "Reports",
           "Role-scoped reports with filters, preview and export.", "/portal/reports"),

    # --- Operations officer (maker) -----------------------------------------------------
    _entry("51-bo-maker-dashboard.png", "ops_maker", "Dashboard",
           "Work queues for registrations, documents, payments, claims and issues.", "/backoffice", width="full"),
    _entry("14-bo-agents.png", "ops_maker", "Agents & bankers",
           "Search by code, name, ID number, agency or bank, channel, type and status.", "/backoffice/agents"),
    _entry("52-bo-agent-register.png", "ops_maker", "Register agent or bank officer",
           "Registration under any agency or bank, with authority limit and reporting line; goes to approval.",
           "/backoffice/agents/new"),
    _entry("15-bo-agent-detail.png", "ops_maker", "Agent detail (pending)",
           "Profile, documents, hierarchy, AML screening and approval history; maker actions in the header.",
           "/backoffice/agents?status=PENDING", actions=[link(FIRST_AGENT)]),
    _entry("53-bo-agency-detail.png", "ops_maker", "Agency or bank detail",
           "Details, active agents and the issuance block with its reason.",
           "/backoffice/agencies", actions=[link(FIRST_AGENCY)]),
    _entry("54-bo-document-checks.png", "ops_maker", "Document checks",
           "Uploaded documents awaiting verification, oldest first, with expiry and reject reason.",
           "/backoffice/documents"),
    _entry("55-bo-claim-detail.png", "ops_maker", "Claim detail (back-office)",
           "Status moves Submitted, Under review, Acknowledged or Rejected, Closed; remarks go to the agent.",
           "/backoffice/claims", actions=[link(FIRST_CLAIM)]),

    # --- Operations supervisor (checker) -------------------------------------------------
    _entry("56-bo-checker-dashboard.png", "ops_checker", "Dashboard",
           "Requests awaiting the checker's decision and pending requests by type.", "/backoffice", width="full"),
    _entry("57-bo-approval-detail-agent.png", "ops_checker", "Approval detail: agent registration",
           "Submitted details, AML outcome and documents as evidence, approval history on the right.",
           "/backoffice/approvals", actions=[link(FIRST_REQUEST)], width="full"),
    _entry("13-bo-approvals.png", "ops_checker", "Approvals inbox",
           "Awaiting my decision and All requests; never shows the checker's own requests.", "/backoffice/approvals"),
    _entry("58-bo-approval-decision-dialog.png", "ops_checker", "Approve or reject",
           "Remarks optional on approval, mandatory on rejection; the reason is shown to the maker.",
           "/backoffice/approvals", actions=[link(FIRST_REQUEST), click("Approve")]),
    _entry("59-bo-approval-endorsement.png", "ops_checker", "Approval detail: endorsement",
           "Nominee change with the new nominees shown before it is applied to the policy.",
           "/backoffice/approvals",
           actions=[tab("All requests"), select("Request type", "Policy endorsement"), link(FIRST_REQUEST)]),

    # --- Underwriter -------------------------------------------------------------------
    _entry("60-bo-underwriter-dashboard.png", "underwriter", "Dashboard",
           "Referred quotations awaiting underwriting or quality check.", "/backoffice", width="full"),
    _entry("61-bo-referral-detail.png", "underwriter", "Referred quotation",
           "Referral reasons, sum covered and contribution, policy documents and the second-level rule.",
           "/backoffice/approvals", actions=[link(FIRST_REQUEST)], width="full"),
    _entry("62-bo-policy-detail.png", "underwriter", "Policy record (back-office)",
           "Full record opened from the request: cover, participant, declarations, documents, history.",
           "/backoffice/policies?status=PENDING_APPROVAL", actions=[link(FIRST_REFERENCE)], width="full"),

    # --- Finance officer ---------------------------------------------------------------
    _entry("63-bo-finance-dashboard.png", "finance", "Dashboard",
           "Payments to verify with their total, plus integration dead letters.", "/backoffice", width="full"),
    _entry("64-bo-payment-approval.png", "finance", "Payment verification request",
           "Allocation, bank reference and the proof of payment under Supporting evidence.",
           "/backoffice/approvals", actions=[link(FIRST_REQUEST)], width="full"),
    _entry("65-bo-payment-approve-dialog.png", "finance", "Verify payment",
           "Approval issues one e-Receipt per policy and posts them to FIN.",
           "/backoffice/approvals", actions=[link(FIRST_REQUEST), click("Approve")]),
    _entry("17-bo-payment-verification.png", "finance", "Payment detail (back-office)",
           "Payment, allocation, e-Receipts and a shortcut to the verification request.",
           "/backoffice/payments", actions=[link(FIRST_PAYMENT)]),
    _entry("23-bo-eod.png", "finance", "End of day",
           "Runs per business date with policies, contribution, receipts and the EOD report and FIN file.",
           "/backoffice/eod"),
    _entry("66-bo-eod-run-dialog.png", "finance", "Run end of day",
           "Business date chosen by Finance; a re-run replaces the day's report and FIN posting.",
           "/backoffice/eod", actions=[click("Run end of day")]),
    _entry("22-bo-integration-monitor.png", "finance", "Integration",
           "Health per system, message queue with re-submit, call log and reconciliation.",
           "/backoffice/integration"),
    _entry("67-bo-reconciliation.png", "finance", "Reconciliation",
           "Receipts issued matched against FIN postings; mismatches list the unmatched receipt numbers.",
           "/backoffice/integration", actions=[tab("Reconciliation")]),
    _entry("18-bo-reports.png", "finance", "Reports",
           "Report catalogue, filters, preview and export to Excel, CSV or PDF.", "/backoffice/reports"),
    _entry("68-bo-report-schedules.png", "finance", "Scheduled reports",
           "Frequency, data period, format and recipients; pause and resume.",
           "/backoffice/reports", actions=[tab("Scheduled reports")]),

    # --- Compliance officer ------------------------------------------------------------
    _entry("69-bo-compliance-dashboard.png", "compliance", "Dashboard",
           "AML cases to review as the first queue.", "/backoffice", width="full"),
    _entry("70-bo-aml-review-dialog.png", "compliance", "Review screening",
           "Matches with list, score and reason; decision Cleared or Confirmed match with mandatory remarks.",
           "/backoffice/aml", actions=[click("Review", first=True)], width="full"),
    _entry("16-bo-aml-review.png", "compliance", "AML / KYC screening cases",
           "Pending cases with highest score and match count; rows expand to the matches.", "/backoffice/aml"),
    _entry("71-bo-watchlist.png", "compliance", "Watch-lists",
           "Entries by list with add, CSV import and deactivation.",
           "/backoffice/aml", actions=[tab("Watch-lists")]),
    _entry("72-bo-participant-detail.png", "compliance", "Participant record",
           "Profile, policies, documents, update requests and the AML screening history.",
           "/backoffice/participants", actions=[link("/^PT\\//")]),
    _entry("19-bo-audit.png", "compliance", "Audit trail",
           "Filters by period, user, action, record type and id; rows expand to before and after values.",
           "/backoffice/audit"),

    # --- Support officer ---------------------------------------------------------------
    _entry("73-bo-support-dashboard.png", "support", "Dashboard",
           "Open issues and how many are past their SLA.", "/backoffice", width="full"),
    _entry("74-bo-issues.png", "support", "Issues",
           "All issues with assignment, response and resolution targets; filters for mine and breached.",
           "/backoffice/issues", width="full"),
    _entry("75-bo-issue-detail.png", "support", "Issue detail",
           "Details and SLA, attachments, conversation with internal notes, assignment and priority.",
           "/backoffice/issues", actions=[link(FIRST_ISSUE)], width="full"),

    # --- System administrator ----------------------------------------------------------
    _entry("76-bo-sysadmin-dashboard.png", "sysadmin", "Dashboard",
           "Integration queue and audit are the administrator's queues; no business records.",
           "/backoffice", width="full"),
    _entry("80-bo-workflows.png", "sysadmin", "Workflows",
           "Per transaction type: approval switch, steps with approver permission and amount threshold.",
           "/backoffice/workflows", width="full"),
    _entry("20-bo-users-roles.png", "sysadmin", "Users",
           "Staff, agents and bank officers with roles, status and last sign-in; unlock and reset.",
           "/backoffice/users"),
    _entry("77-bo-user-form.png", "sysadmin", "New staff user",
           "Account, sign-in method (local or directory), details and roles.",
           "/backoffice/users", actions=[click("New staff user")]),
    _entry("78-bo-roles.png", "sysadmin", "Roles & permissions",
           "Roles per module with permission count and users; system roles cannot be deleted.",
           "/backoffice/roles"),
    _entry("79-bo-role-drawer.png", "sysadmin", "Edit role",
           "Permission picker limited to the role's module.",
           "/backoffice/roles", actions=[click("Edit", first=True)]),
    _entry("81-bo-products.png", "sysadmin", "Products",
           "Seven products with rating engine, payment rule, renewal flag and document count.",
           "/backoffice/products"),
    _entry("82-bo-product-drawer.png", "sysadmin", "Edit product",
           "Flags, rating configuration, required documents and questionnaire without code changes.",
           "/backoffice/products", actions=[click("Edit", first=True)]),
    _entry("21-bo-config.png", "sysadmin", "Parameters",
           "Parameters by category with allowed range and last change.", "/backoffice/settings"),
    _entry("83-bo-master-data.png", "sysadmin", "Master data",
           "Code tables (banks, districts, claim types, reasons) with add, edit and deactivate.",
           "/backoffice/settings", actions=[tab("Master data")]),
    _entry("84-bo-agencies.png", "sysadmin", "Agencies & banks",
           "Agency and bank records with channel, active agents and new-business status.",
           "/backoffice/agencies"),

    # --- Participant (public e-signature page) and management ------------------------------
    _entry("31-participant-esign-page.png", "participant", "Participant e-signature page",
           "Quotation summary, typed name, declaration and signature; the link works once.",
           "/esign/${ESIGN_TOKEN}", user=None, width="full"),
    _entry("12-bo-dashboard.png", "management", "Management dashboard",
           "Month and year-to-date issuance, outstanding contribution, production trend, split by product and channel.",
           "/backoffice", width="full"),
    _entry("24-policy-schedule-pdf.png", "shared", "e-Policy schedule (PDF)",
           "Generated on issuance and e-mailed to the participant.", "", user=None, manual=True),
]


def entries_for(persona):
    return [entry for entry in PERSONA_SCREENS if entry["persona"] == persona]


def check():
    files = [entry["file"] for entry in PERSONA_SCREENS]
    duplicates = {name for name in files if files.count(name) > 1}
    if duplicates:
        raise SystemExit(f"Duplicate screenshot names in manifest: {sorted(duplicates)}")


check()

if __name__ == "__main__":
    if "--json" in sys.argv:
        print(json.dumps(PERSONA_SCREENS, indent=2))
    else:
        for entry in PERSONA_SCREENS:
            print(f"{entry['file']:40} {entry['persona']:16} {entry['user'] or '-':12} {entry['route']}")
