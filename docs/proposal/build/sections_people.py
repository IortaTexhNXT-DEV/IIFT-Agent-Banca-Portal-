"""Proposal chapters on personas, user journeys and the screen catalogue."""

from PIL import Image

import brand
import diagrams
from docx_kit import ProposalWriter

PRODUCT = brand.PRODUCT

# (persona, goals, key tasks, screens used, role / permissions)
PERSONAS = [
    ("Bank officer (branch banker)", "Sell financing and annual plans quickly; keep customers informed",
     "Quotations, participant capture, document upload, payment submission, claim notification",
     "Dashboard, New quotation, Policies, Participants, Billing, Claims", "Bank officer; own branch data"),
    ("Bank supervisor", "Oversee branch production and overdue payments", "Review team pipeline, reports, bank-level requests",
     "Dashboard, Team and hierarchy, Reports, My requests", "Bank supervisor; whole bank"),
    ("Agency principal / main agent", "Grow the agency; avoid issuance blocks", "Monitor sub-agents, payments, renewals, commission",
     "Dashboard, Team and hierarchy, Billing, Commission, Reports", "Main agent; whole agency"),
    ("Sub-agent", "Issue policies and get paid commission", "Quotations, policies, payments, renewals, issues",
     "New quotation, Policies, Renewals, Billing, Support issues", "Agent; own records"),
    ("IIFT Operations officer (maker)", "Process Banca work accurately", "Agent registrations, participant and policy changes, document checks",
     "Agents, Participants, Policies, Document checks", "Operations maker"),
    ("Operations supervisor (checker)", "Approve correct work promptly", "Review and approve or reject requests with remarks",
     "Approvals inbox, Approval detail, Dashboard", "Operations checker"),
    ("Underwriter / quality check", "Accept good risk; refer the rest", "Quality check, referrals above limits, endorsements, cancellations",
     "Approvals inbox, Policies, Products", "Underwriting checker"),
    ("Finance officer", "Match every receipt and close each day", "Verify payment proofs, run EOD, review reconciliation",
     "Payments, End of day, Integration monitor, Reports", "Finance maker or checker"),
    ("Compliance officer", "Keep AML/KYC risk under control", "Review possible matches, maintain watch-lists, compliance reports",
     "AML/KYC cases and watch-lists, Audit trail, Reports", "Compliance"),
    ("Support desk", "Resolve user problems within SLA", "Triage, assign and resolve issues; release locked accounts on request",
     "Issues, Users, Integration monitor", "Support"),
    ("Management", "See production, risk and service at a glance", "Read dashboards and scheduled reports",
     "Dashboard (management KPIs), Reports and schedules", "Management, read only"),
    ("System administrator", "Keep the platform configured and secure", "Users, roles, workflows, products, parameters",
     "Users, Roles and permissions, Workflows, Products, Parameters", "Administrator"),
    ("Participant (remote e-signature)", "Sign without visiting a branch", "Open link, confirm details, sign",
     "Participant e-signature page", "No account; single-use link"),
    ("IITH core and finance systems (system actors)", "Receive and send master and financial data",
     "Agent master sync, FIN file intake, commission statements", "Integration monitor (seen by IIFT IT)",
     "System credentials; mTLS, API key or SFTP key"),
]

# (key, title, lanes, [(lane, short label, actor, screen, what happens)])
JOURNEYS = [
    ("onboarding", "Agent onboarding",
     ["Applicant", "System", "Compliance", "Operations maker", "Supervisor"],
     [(0, "Submit registration", "Applicant", "Agent registration", "Enters personal, agency or bank and KYC data; uploads documents."),
      (1, "Watch-list screening", "System", "None", "Screens the name with fuzzy matching; clear results pass straight on."),
      (2, "Review possible match", "Compliance officer", "AML/KYC cases", "Clears or rejects a possible match with remarks."),
      (3, "Check documents", "Operations officer", "Document checks", "Validates documents and expiry dates."),
      (4, "Approve", "Operations supervisor", "Approvals inbox", "Approves; the maker cannot approve their own request."),
      (1, "Code and account", "System", "None", "Issues the agent code, activates the account, e-mails the agent."),
      (0, "First login", "Agent", "Sign-in, Change password", "Signs in, sets a new password and lands on the dashboard.")]),
    ("annual", "Quotation to e-Policy for an annual product (FFR02 to FFR05)",
     ["Agent", "Participant", "Finance", "System"],
     [(0, "Select product", "Agent", "New quotation", "Chooses PHA, PRO, KHR or OSA from the authorised list."),
      (0, "Participant and cover", "Agent", "New quotation", "Captures participant and plan; the live quote shows the contribution."),
      (1, "Questionnaire and signature", "Participant", "Participant e-signature page", "Completes the questionnaire and signs on screen or by e-mail link."),
      (0, "Documents and submit", "Agent", "Policy detail", "Uploads required documents; the checklist must be complete to submit."),
      (0, "Pay and upload proof", "Agent", "Billing", "Pays and uploads proof of payment."),
      (2, "Verify payment", "Finance officer", "Payments", "Verifies the proof against the bank statement."),
      (3, "e-Policy and e-Receipt", "System", "None", "Policy becomes Active; PDFs are produced and e-mailed."),
      (3, "EOD and FIN", "System", "End of day", "The day's issuance goes into the EOD report and FIN file.")]),
    ("hp", "Banca hire-purchase financing with referral and grace period (FFR01)",
     ["Bank officer", "IIFT Sales", "Underwriting", "System"],
     [(0, "Capture HP details", "Bank officer", "New quotation", "Captures participant, financing amount, tenure and profit rate."),
      (3, "Contribution", "System", "New quotation", "Calculates the contribution; above B$150,000 the case is referred."),
      (1, "Referral decision", "IIFT Sales", "Approvals inbox", "Approves or declines cases above the high-risk limit."),
      (0, "Drawdown letter", "Bank officer", "Policy detail", "Uploads the drawdown letter and remaining documents."),
      (2, "Quality check", "Underwriter", "Approvals inbox", "Approves the contract after quality check."),
      (3, "Issue e-Policy", "System", "None", "Issues e-Policy (issue-then-pay); payment due within seven days."),
      (0, "Pay within 7 days", "Bank officer", "Billing", "Submits payment with proof."),
      (3, "Block or clear", "System", "Dashboard", "If unpaid on day 8, blocks issuance for the agency until settled.")]),
    ("payment", "Payment submission, verification and e-Receipt",
     ["Agent", "Finance officer", "Finance manager", "System"],
     [(0, "Select policies", "Agent", "Billing (outstanding)", "Selects one or many outstanding policies."),
      (0, "Pay and upload proof", "Agent", "Billing (bulk payment)", "Allocates amounts per policy and uploads one proof."),
      (3, "Pending verification", "System", "Payment detail", "Marks the payment Pending Verification and queues it."),
      (1, "Verify", "Finance officer", "Payments", "Checks the proof; approves or rejects with remarks."),
      (2, "Second approval", "Finance manager", "Approvals inbox", "Approves when the amount is above the threshold."),
      (3, "e-Receipt", "System", "None", "Produces the e-Receipt, marks policies Paid, lifts any agency block."),
      (0, "Download receipt", "Agent", "Payment detail", "Downloads or e-mails the e-Receipt.")]),
    ("servicing", "Endorsement or cancellation",
     ["Agent", "System", "Underwriting officer", "Underwriting manager"],
     [(0, "Choose action", "Agent", "Policy detail (servicing)", "Selects Endorse or Cancel on an active policy."),
      (0, "Enter change", "Agent", "Policy detail (servicing)", "Enters changes or reason and attaches documents."),
      (1, "Create request", "System", "My requests", "Records before and after values; routes by workflow."),
      (2, "Review", "Underwriting officer", "Approvals inbox", "Reviews and approves or rejects with remarks."),
      (3, "Second level", "Underwriting manager", "Approval detail", "Approves cancellations and endorsements above threshold."),
      (1, "Apply and notify", "System", "Policy detail", "Applies the change, records audit, notifies the agent.")]),
    ("claim", "Claim notification",
     ["Agent", "System", "IIFT Claims"],
     [(0, "New notification", "Agent", "Claims (notification)", "Opens a new claim notification."),
      (1, "Validate policy", "System", "Claims (notification)", "Checks the policy was in force on the event date."),
      (0, "Details and documents", "Agent", "Claims (notification)", "Enters claim details and uploads documents."),
      (0, "Submit", "Agent", "Claims (notification)", "Submits; a reference number is issued."),
      (2, "Review", "Claims team", "Claims", "Reviews the notification and updates its status."),
      (0, "Track", "Agent", "Claims (detail)", "Follows status and responds to requests.")]),
    ("issue", "Issue reporting with SLA",
     ["Reporter", "System", "Support desk", "Resolver"],
     [(0, "Report issue", "Agent or IIFT user", "Support issues", "Describes the problem and attaches screenshots."),
      (1, "Reference and timers", "System", "None", "Issues a reference number and starts SLA timers."),
      (2, "Triage and assign", "Support desk", "Issues", "Sets priority and assigns by rule."),
      (3, "Investigate", "Resolver", "Issues", "Updates the issue and the reporter."),
      (1, "Escalate if late", "System", "None", "Alerts the supervisor when a target is about to be missed."),
      (3, "Resolve", "Resolver", "Issues", "Records the fix."),
      (0, "Confirm closure", "Reporter", "Support issues", "Confirms or reopens.")]),
    ("eod", "End of day and FIN reconciliation",
     ["System", "FIN", "Finance officer", "Finance manager"],
     [(0, "Cut-off", "System", "End of day", "Closes the business day at the configured time."),
      (0, "Issuance report", "System", "End of day", "Builds the issuance report by product, bank and agent."),
      (0, "FIN file", "System", "Integration monitor", "Writes the FIN interface file and queues delivery."),
      (1, "Receive file", "FIN system", "None", "Receives and posts the entries."),
      (0, "Reconcile", "System", "End of day", "Reconciles receipts; lists exceptions."),
      (2, "Review exceptions", "Finance officer", "End of day", "Investigates and comments on exceptions."),
      (3, "Sign off", "Finance manager", "End of day", "Signs off the run; history is kept.")]),
    ("makerchecker", "Maker-checker approval",
     ["Maker", "Workflow engine", "Checker 1", "Checker 2"],
     [(0, "Submit change", "Maker", "Any maintenance screen", "Submits a change; before and after values are stored."),
      (1, "Resolve workflow", "Workflow engine", "None", "Finds the definition, levels and thresholds."),
      (2, "First review", "Checker 1", "Approval detail", "Approves or rejects with mandatory remarks."),
      (1, "Threshold check", "Workflow engine", "None", "Adds a level, e.g. sum covered from B$300,000."),
      (3, "Second review", "Checker 2", "Approval detail", "Approves or rejects with remarks."),
      (1, "Apply", "Workflow engine", "None", "Applies the change with audit record and notification."),
      (0, "See outcome", "Maker", "My requests", "Sees the result and any remarks.")]),
]

PORTAL_SCREENS = [
    ["Sign-in", "Secure login", "AP-01, AP-03, AP-04"],
    ["Change password", "Password change under policy", "AP-02"],
    ["Dashboard", "Profile summary, pending actions, production, payments", "AP-37, AP-52, AP-53"],
    ["New quotation", "Product, participant, coverage and live quote", "AP-17 to AP-20"],
    ["Quotations and policies", "List and search by status", "AP-21 to AP-23"],
    ["Policy detail", "Checklist, questionnaire, nominees, documents, signatures, submit; servicing actions; history tabs", "AP-24 to AP-36, AP-44 to AP-47, AP-62"],
    ["Renewals", "Policies due for renewal", "AP-26"],
    ["Participants", "List, registration and detail", "AP-11 to AP-16"],
    ["Billing", "Outstanding, bulk payment, history", "AP-37 to AP-42"],
    ["Payment detail", "Allocation, proof, status, e-Receipt", "AP-39 to AP-41"],
    ["Claims", "List, notification and detail", "AP-43"],
    ["My requests", "Status of submitted requests and rejection remarks", "AP-49 to AP-51"],
    ["Team and hierarchy", "Main agent, sub-agents and bank officers", "AP-09, AP-10"],
    ["Agent registration", "Online registration and onboarding", "AP-07, AP-08, AP-46, AP-48"],
    ["Profile", "Profile and change requests", "AP-05, AP-06"],
    ["Commission", "Commission and referral fee statement", "INT-05"],
    ["Reports", "Role-scoped reports and exports", "AP-58"],
    ["Support issues", "Report and track issues", "AP-55 to AP-57"],
    ["Notifications", "In-portal notifications", "AP-34, AP-54"],
    ["Participant e-signature page", "Remote signature by single-use link", "AP-62"],
]

BACKOFFICE_SCREENS = [
    ["Dashboard", "Pending actions and management KPIs", "BO-20, BO-21"],
    ["Approvals inbox and detail", "Maker-checker queue with before and after values", "BO-16 to BO-19"],
    ["Agents", "List, registration and detail", "BO-05 to BO-08, BO-10"],
    ["Agencies and banks", "Agency, bank and branch records", "BO-09"],
    ["Policies", "Policy search and detail", "AP-21 to AP-31 (back-office view)"],
    ["Participants", "Participant search and detail", "AP-11 to AP-15"],
    ["Payments", "Verification and receipts", "AP-40, AP-41"],
    ["Claims", "Claim notifications", "AP-43"],
    ["AML/KYC cases and watch-lists", "Screening results, review, lists", "BO-13 to BO-15"],
    ["Document checks", "Validation, approval and expiry", "BO-11, BO-12"],
    ["Audit trail", "Audit search and export", "BO-26 to BO-28"],
    ["Issues", "Assignment, priority, SLA", "BO-29 to BO-31"],
    ["Reports and schedules", "Report runs, exports, schedules", "BO-22 to BO-25"],
    ["End of day", "EOD runs, FIN file, reconciliation, sign-off", "FFR EOD, INT-04"],
    ["Integration monitor and reconciliation", "Outbox messages, retries, dead-letters, reconciliation", "INT-11 to INT-15"],
    ["Users", "User administration", "BO-03"],
    ["Roles and permissions", "Role builder and data scopes", "BO-02, BO-04"],
    ["Workflows", "Workflow definitions and thresholds", "BO-16, COM-04"],
    ["Products", "Products, plans, rates, questionnaires", "BO-32"],
    ["Parameters and master data", "System parameters and reference data", "BO-32, BO-33, COM-09"],
]

SCREENSHOTS = [
    ("01-login.png", "Secure login"),
    ("02-portal-dashboard.png", "Agent/Banca dashboard"),
    ("03-quotation-product.png", "Product selection"),
    ("04-quotation-wizard.png", "Quotation – participant & coverage"),
    ("05-quotation-summary.png", "Quotation summary & contribution"),
    ("06-policy-list.png", "Policy listing & search"),
    ("07-policy-detail.png", "Policy details, documents & history"),
    ("08-participants.png", "Participant management"),
    ("09-billing-payment.png", "Payment submission (single/bulk)"),
    ("10-claims.png", "Claim notification"),
    ("11-issues.png", "Issue reporting & tracking"),
    ("12-bo-dashboard.png", "Back-office management dashboard"),
    ("13-bo-approvals.png", "Maker-checker approvals inbox"),
    ("14-bo-agents.png", "Agent/Banca administration"),
    ("15-bo-agent-detail.png", "Agent profile, hierarchy & documents"),
    ("16-bo-aml-review.png", "AML/KYC compliance review"),
    ("17-bo-payment-verification.png", "Payment verification & receipts"),
    ("18-bo-reports.png", "Reports & export"),
    ("19-bo-audit.png", "Audit trail search"),
    ("20-bo-users-roles.png", "Users, roles & permissions"),
    ("21-bo-config.png", "System parameters & master data"),
    ("22-bo-integration-monitor.png", "Integration monitor & reconciliation"),
    ("23-bo-eod.png", "End-of-day processing"),
    ("24-policy-schedule-pdf.png", "Generated e-Policy schedule"),
]


def _aspect(path):
    with Image.open(path) as image:
        width, height = image.size
    return height / width


def personas(w: ProposalWriter):
    w.h1("Personas")
    w.para("The personas below describe who uses the solution and what each needs. Roles and permissions are "
           "configurable; these are the defaults we propose for design.")
    w.table(["Persona", "Goals", "Key tasks", "Screens used", "Role / permissions"], [list(p) for p in PERSONAS],
            widths=[3.0, 3.4, 4.0, 3.9, 2.7], font_size=7.5, padding=30, bold_first_col=True,
            caption="Personas")


def journeys(w: ProposalWriter, figs: dict):
    w.h1("User Journeys")
    w.para("Each journey shows who acts, on which screen, and what the system does. The diagram gives the flow; the "
           "table gives the detail. Journeys are rehearsed in the fit-gap workshops and become UAT scenarios.")
    for index, (key, title, lanes, steps) in enumerate(JOURNEYS):
        w.h2(title)
        diagram = diagrams.swimlane(figs["out_dir"], key, lanes, [(lane, label) for lane, label, *_ in steps])
        w.figure(diagram, title, width_cm=16.5)
        rows = [[str(n), actor, screen, text] for n, (_, _, actor, screen, text) in enumerate(steps, start=1)]
        w.table(["Step", "Actor", "Screen", "What happens"], rows, widths=[1.1, 3.4, 4.0, 8.5], font_size=7.5,
                padding=25, center_cols=(0,))


def screen_catalogue(w: ProposalWriter, figs: dict):
    w.h1("Screen Catalogue")
    w.para(f"The tables list every screen in {PRODUCT} as configured for IIFT, with its purpose and the RFP "
           "requirements it serves. Sample screens follow; all data shown is test data.")
    w.h2("Agent/Banca Portal screens")
    w.table(["Screen", "Purpose", "RFP IDs"], PORTAL_SCREENS, widths=[4.2, 8.6, 4.2], font_size=7.5, padding=25,
            bold_first_col=True)
    w.h2("Back-office screens")
    w.table(["Screen", "Purpose", "RFP IDs"], BACKOFFICE_SCREENS, widths=[4.2, 8.6, 4.2], font_size=7.5,
            padding=25, bold_first_col=True)
    w.h2("Sample screens")
    items = []
    for filename, caption in SCREENSHOTS:
        path = brand.SCREENSHOT_DIR / filename
        if not path.exists():
            path = diagrams.screenshot_placeholder(figs["out_dir"], filename, caption)
        items.append((path, caption, _aspect(path)))
    w.figure_grid(items)
