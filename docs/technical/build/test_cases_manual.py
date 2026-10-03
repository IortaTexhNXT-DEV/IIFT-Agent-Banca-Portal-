"""Hand-written test cases for SalesVerse 2.0: the executed API run, the end-to-end suite
decomposed into business cases, the manual (exploratory) UI runs with screenshot evidence,
and the cases that can only be executed in IIFT's environment.

Automated unit, component and security-check cases are derived from the evidence files in
test_automated.py. test_status.py joins everything, assigns case identifiers and verifies
every reference (condition, evidence file, screenshot, executed case id).
"""

E2E_DIR = "apps/api/test"
STEPS_API = "Run `npm run test:e2e -w apps/api` (rebuilds the iift_test database from the migrations and seeds)"

# ---------------------------------------------------------------------------------------------
# 1. Cases executed by the API run (tools/testing/api-test-run.mjs). Title, actor, expected
#    result, response and verdict come from evidence/api-test-run.json; steps and data here.
# ---------------------------------------------------------------------------------------------
EXECUTED = {
    "EX-001": ("TC-001", ["POST /api/v1/auth/login with an unknown user name", "POST /api/v1/auth/login as finance with a wrong password", "Compare status, code and message"], "username nobody-<run>; finance / wrong-password"),
    "EX-002": ("TC-002", ["POST /api/v1/auth/login as ag-000001", "Inspect Set-Cookie flags and the body"], "ag-000001 / demo password"),
    "EX-003": ("TC-015", ["POST /api/v1/common/notifications/read-all without x-csrf-token", "Repeat with a forged token", "Repeat with the session's token"], "Session of ag-000001"),
    "EX-004": ("TC-022", ["As ag-000001 GET /api/v1/backoffice/agents", "As finance GET /api/v1/portal/policies"], "Portal and back-office sessions"),
    "EX-005": ("TC-023", ["As ops.maker GET /api/v1/backoffice/users"], "ops.maker lacks bo.users.manage"),
    "EX-006": ("TC-007", ["POST /api/v1/auth/change-password with newPassword 'password1'", "POST with a wrong currentPassword", "GET /api/v1/auth/me"], "ag-000002"),
    "EX-007": ("TC-014", ["Sign in as ag-000003", "GET /api/v1/auth/me", "POST /api/v1/auth/logout", "GET /api/v1/auth/me with the same cookie"], "ag-000003"),
    "EX-008": ("TC-015", ["Sign in twice as ag-000003", "GET /api/v1/auth/me with the first cookie"], "security.session.single_active = true"),
    "EX-009": ("TC-027", ["As ag-000002 GET /api/v1/portal/policies", "As ag-000001 GET /api/v1/portal/policies", "Compare agent codes and totals"], "Agency AGY-SA: principal AG-000001, sub-agent AG-000002"),
    "EX-010": ("TC-042", ["POST /api/v1/portal/participants with an individual NRIC participant", "Inspect participantNo, amlStatus and idNumberMasked"], "Nur Hidayah binti Kamal, NRIC 01-9nnnnn, class 1 professional"),
    "EX-011": ("TC-045", ["POST /api/v1/portal/participants again with the same NRIC"], "Same IC as EX-010"),
    "EX-012": ("TC-041", ["POST /api/v1/portal/participants type CORPORATE with idType NRIC"], "Syarikat Contoh Sdn Bhd"),
    "EX-013": ("TC-163", ["POST /api/v1/portal/participants with isAdmin=true and mobile 'abc'"], "Unknown property and invalid mobile"),
    "EX-014": ("TC-046", ["As ag-000003 GET /api/v1/portal/participants/lookup?idType=NRIC&idNumber=<EX-010 IC>"], "Participant of agency AGY-SA"),
    "EX-015": ("TC-047", ["As ag-000003 GET /api/v1/portal/participants/{id of EX-010}"], "No business between AGY-DT and the participant"),
    "EX-016": ("TC-044", ["POST /api/v1/portal/participants/{id}/update-requests with an empty body", "POST with mobile and addressLine2 changed", "POST another change while the first is pending"], "Participant of EX-010"),
    "EX-017": ("TC-036", ["GET /api/v1/portal/requests?status=PENDING", "POST /api/v1/portal/requests/{id}/withdraw"], "Request of EX-016"),
    "EX-020": ("TC-065", ["GET /api/v1/common/products", "Check codes and the paymentBeforeIssuance / allowRenewal flags"], "Seeded catalogue"),
    "EX-021": ("TC-058", ["POST /api/v1/portal/policies/calculate PRO plan B additionalCover=true"], "Participant of EX-010 (class 1)"),
    "EX-022": ("TC-060", ["POST /api/v1/portal/policies/calculate KHR plan A coverageType WIDER"], "Participant of EX-010"),
    "EX-023": ("TC-062", ["POST /api/v1/portal/policies/calculate PHA plan STANDARD termMonths 24 with helper details"], "Helper Maria Santos, passport P8827361A"),
    "EX-024": ("TC-064", ["Register a Malaysian passport holder", "POST /api/v1/portal/policies/calculate OSA plan BASIC"], "nationality MALAYSIA, registered student"),
    "EX-025": ("TC-059", ["Register a participant with occupationClass 3", "POST /api/v1/portal/policies/calculate PRO plan A"], "SKILLED_MANUAL, class 3"),
    "EX-026": ("TC-055", ["POST /api/v1/portal/policies/calculate FTP-HP financingAmount 200000", "Repeat with 150000"], "tenure 60 months, profit rate 4%"),
    "EX-027": ("TC-056", ["POST /api/v1/portal/policies/calculate FTP-NP with riskDetails {}"], "No risk fields"),
    "EX-028": ("TC-056", ["Register a 64-year-old participant", "POST /api/v1/portal/policies/calculate FTP-HP tenure 108 months"], "maxAgeAtExpiry 70"),
    "EX-030": ("TC-067", ["POST /api/v1/portal/policies PRO plan B additionalCover=true"], "Participant of EX-010"),
    "EX-031": ("TC-071", ["POST /api/v1/portal/policies/{id}/submit before answering the questionnaire"], "Draft of EX-030"),
    "EX-032": ("TC-071", ["PUT /api/v1/portal/policies/{id}/questionnaire with HEALTH_CURRENT=yes and no details"], "Draft of EX-030"),
    "EX-033": ("TC-071", ["PUT /api/v1/portal/policies/{id}/questionnaire with all three answers 'no'"], "Draft of EX-030"),
    "EX-034": ("TC-072", ["PUT /api/v1/portal/policies/{id}/nominees with one nominee at 60%", "PUT with one nominee at 100% and an ID number"], "Kamal bin Ali, PARENT"),
    "EX-035": ("TC-073", ["POST /api/v1/portal/policies/{id}/submit with no documents or signature"], "PRO requires IC copy, nominee IC, signature"),
    "EX-036": ("TC-119", ["POST /api/v1/common/documents with MZ content named ic.pdf", "Upload a PDF as IC_COPY", "Upload a PDF as NOMINEE_IC"], "ownerType POLICY"),
    "EX-037": ("TC-075", ["POST /api/v1/portal/policies/{id}/signatures/link with the participant e-mail", "GET /api/v1/public/esign/<43 unknown characters>", "GET /api/v1/public/esign/short"], "policy.esign_link_hours = 72"),
    "EX-038": ("TC-074", ["POST /api/v1/portal/policies/{id}/signatures with a text/html data URL", "POST with a PNG data URL, signer PARTICIPANT"], "1×1 PNG"),
    "EX-039": ("TC-078", ["POST /api/v1/portal/policies/{id}/submit with everything complete"], "PRO pays before issuance; no referral reasons"),
    "EX-040": ("TC-098", ["POST /api/v1/portal/billing/payments dated in two days", "POST without a proof file", "POST with amount 999"], "Allocation to the quotation of EX-030 (255.00)"),
    "EX-041": ("TC-099", ["POST /api/v1/portal/billing/payments BANK_TRANSFER 255.00 with a PDF proof", "GET /api/v1/portal/policies/{id}"], "referenceNo TRX-<run>"),
    "EX-042": ("TC-100", ["As finance GET /api/v1/backoffice/approvals/inbox", "As ops.maker POST approvals/{id}/approve", "As finance POST approvals/{id}/reject with empty remarks"], "PAYMENT_VERIFICATION request of EX-041"),
    "EX-043": ("TC-101", ["As finance POST approvals/{id}/approve with remarks", "GET /api/v1/portal/policies/{id}"], "Request of EX-042"),
    "EX-044": ("TC-093", ["GET /api/v1/common/documents/{POLICY_SCHEDULE id}/content"], "Policy of EX-043"),
    "EX-045": ("TC-090", ["Inspect events[] of the policy detail of EX-043"], "Policy of EX-043"),
    "EX-046": ("TC-095", ["POST /api/v1/portal/policies/{id}/email-documents with email 'not-an-email'", "POST with an empty body (participant e-mail used)"], "Policy of EX-043"),
    "EX-047": ("TC-068", ["As ag-000003 GET /api/v1/portal/policies/{id}", "As ag-000001 PUT /api/v1/portal/policies/{id}/questionnaire"], "Issued policy of EX-043"),
    "EX-048": ("TC-089", ["GET /api/v1/portal/policies?status=ACTIVE", "GET ?search=' OR 1=1; DROP TABLE policy; --", "GET ?search=<policyNo>"], "Agent's own policies"),
    "EX-049": ("TC-068", ["POST /api/v1/portal/policies (new PRO draft)", "POST /api/v1/portal/policies/{draft}/discard", "POST /api/v1/portal/policies/{issued}/discard"], "Draft and issued policy"),
    "EX-050": ("TC-079", ["POST /api/v1/portal/policies FTP-HP 200,000 over 60 months", "Answer the questionnaire; upload PROPOSAL_FORM, PDS, IC_COPY, HP_APPROVAL_LETTER, DRAWDOWN_LETTER; sign", "POST /submit", "GET the policy detail"], "Participant of EX-010; financier Bank A"),
    "EX-051": ("TC-082", ["As underwriter GET /api/v1/backoffice/approvals/inbox", "As ag-000001 POST approvals/{id}/approve"], "POLICY_REFERRAL of EX-050"),
    "EX-052": ("TC-103", ["As underwriter POST approvals/{id}/approve with remarks", "GET /api/v1/portal/policies/{id}"], "billing.payment_grace_days = 7"),
    "EX-053": ("TC-084", ["As underwriter POST approvals/{id}/reject on the decided request"], "Request of EX-052"),
    "EX-054": ("TC-080", ["As bk-000005 GET /api/v1/portal/dashboard", "POST /api/v1/portal/policies FTP-NP 20,000", "POST /submit"], "Bank BNK-MIB blocked by the demonstration data (overdue policy)"),
    "EX-060": ("TC-111", ["POST /api/v1/portal/policies/{id}/endorsements with endorsementType NOT_A_TYPE", "POST with NOMINEE_CHANGE and two nominees at 50% each"], "Policy of EX-043"),
    "EX-061": ("TC-086", ["As ops.checker GET /api/v1/backoffice/approvals/{id}"], "Endorsement of EX-060"),
    "EX-062": ("TC-112", ["As ops.checker POST approvals/{id}/approve", "GET /api/v1/portal/policies/{id} and inspect nominees"], "Endorsement of EX-060"),
    "EX-063": ("TC-113", ["POST /api/v1/portal/policies/{id}/cancellations effective 2020-01-01", "POST with today's date", "As ops.checker POST reject without remarks", "POST reject with remarks", "GET the policy"], "Reason PARTICIPANT_REQUEST"),
    "EX-064": ("TC-088", ["GET /api/v1/portal/requests?status=REJECTED", "GET /api/v1/portal/requests/{id}"], "Cancellation of EX-063"),
    "EX-065": ("TC-110", ["POST /api/v1/portal/policies/{new PRO policy}/renew", "POST /api/v1/portal/policies/{KHR policy}/renew", "GET /api/v1/portal/policies/renewals-due"], "policy.renewal_notice_days = 45"),
    "EX-066": ("TC-109", ["GET /api/v1/portal/policies/renewals-due", "POST /api/v1/portal/policies/{due policy}/renew twice"], "Renewable policy ending within 45 days"),
    "EX-067": ("TC-116", ["GET /api/v1/portal/claims/validate-policy?policyNo=<EX-043>", "POST /api/v1/portal/claims with eventDate 2020-01-01", "POST with today's event date"], "ACCIDENT claim"),
    "EX-068": ("TC-117", ["As ops.maker PUT /api/v1/backoffice/claims/{id}/status CLOSED", "PUT UNDER_REVIEW", "As ag-000001 GET /api/v1/portal/claims/{id}"], "Claim of EX-067"),
    "EX-069": ("TC-115", ["POST /api/v1/portal/claims against a DRAFT quotation"], "Any draft of ag-000001"),
    "EX-070": ("TC-029", ["As ag-000002 POST /api/v1/portal/agents"], "Sub-agent without portal.agents.register"),
    "EX-071": ("TC-030", ["As ag-000001 POST /api/v1/portal/agents agentType BANKER", "POST agentType MAIN_AGENT with parentAgentId"], "Agency AGY-SA"),
    "EX-072": ("TC-031", ["POST /api/v1/portal/agents SUB_AGENT Hazirah binti Jamil", "POST again with the same IC"], "NRIC 01-5nnnnn"),
    "EX-073": ("TC-123", ["As ops.checker GET approvals/inbox", "POST approvals/{id}/approve before any upload"], "AGENT_REGISTRATION of EX-072"),
    "EX-074": ("TC-033", ["As ag-000001 upload IC_COPY for the agent", "As ops.checker POST approvals/{id}/approve", "GET /api/v1/portal/agents/{id}", "As manager GET /api/v1/backoffice/users?search=<code>"], "Agent of EX-072"),
    "EX-075": ("TC-083", ["As ops.maker POST /api/v1/backoffice/agents (MAIN_AGENT under AGY-DT)", "GET /api/v1/backoffice/approvals?status=PENDING", "POST approvals/{own request}/approve"], "ops.maker holds bo.approve.agents? no – segregation checked first"),
    "EX-076": ("TC-084", ["As ops.checker POST approvals/{id}/reject without remarks", "POST reject with remarks", "As ops.maker GET /api/v1/backoffice/agents/{id}"], "Request of EX-075"),
    "EX-077": ("TC-036", ["As ag-000002 POST /api/v1/portal/profile/update-requests with a new mobile", "GET /api/v1/portal/hierarchy", "GET /api/v1/portal/agency"], "Sub-agent of AGY-SA"),
    "EX-078": ("TC-038", ["As ops.maker POST /api/v1/backoffice/agents/{AG-000003}/status-requests ACTIVE", "POST SUSPENDED with a reason", "POST approvals/{id}/withdraw"], "Active main agent AG-000003"),
    "EX-079": ("TC-039", ["As manager POST /api/v1/backoffice/agencies with code 'bad code'", "POST with code AGY-<run>, channel AGENCY"], "New agency"),
    "EX-080": ("TC-048", ["POST /api/v1/portal/participants 'Rashid Al Mansouri' (passport)", "Create a KHR quotation; complete questionnaire, nominee, documents, signature", "POST /submit"], "Watch-list DEMO-PEP entry; aml.match_threshold = 85"),
    "EX-081": ("TC-050", ["As compliance GET /api/v1/backoffice/aml/cases?status=PENDING_REVIEW", "POST aml/cases/{id}/review with empty remarks", "POST decision CLEARED with remarks", "POST again", "GET the participant"], "Case of EX-080"),
    "EX-082": ("TC-049", ["POST /api/v1/portal/policies/{id}/submit after clearance"], "Quotation of EX-080"),
    "EX-083": ("TC-052", ["POST /api/v1/backoffice/aml/watchlist (manual entry)", "POST aml/watchlist/import with header 'name,list'", "POST import with a valid CSV line"], "LOCAL list, Doe John"),
    "EX-084": ("TC-051", ["As ops.maker GET /api/v1/backoffice/aml/cases"], "ops.maker lacks bo.aml.review"),
    "EX-090": ("TC-129", ["As ag-000002 POST /api/v1/common/issues priority HIGH", "Compare responseDueAt and resolutionDueAt with createdAt"], "sla.high.response_hours 2, resolution 24"),
    "EX-091": ("TC-130", ["As support GET /api/v1/backoffice/issues/assignees", "PUT issues/{id}/assignment", "PUT issues/{id}/priority CRITICAL"], "Issue of EX-090; sla.critical.response_hours 1"),
    "EX-092": ("TC-131", ["POST two comments (internal, public)", "PUT status RESOLVED without resolution", "PUT RESOLVED with resolution", "As ag-000002 GET the issue"], "Issue of EX-090"),
    "EX-093": ("TC-131", ["As ag-000002 PUT status CLOSED", "GET /api/v1/common/issues?status=CLOSED"], "Issue of EX-090"),
    "EX-094": ("TC-028", ["As ag-000003 GET /api/v1/common/issues/{id of EX-090}"], "Issue of agency AGY-SA"),
    "EX-100": ("TC-134", ["As manager GET /api/v1/backoffice/reports", "GET reports/POLICY_REGISTER?from=2025-01-01&to=today"], "Demonstration data"),
    "EX-101": ("TC-134", ["GET /api/v1/backoffice/reports/{code} for each of the 12 codes with a date range"], "Demonstration data"),
    "EX-102": ("TC-135", ["GET reports/POLICY_REGISTER/export?format=XLSX, CSV, PDF"], "Content types spreadsheetml, text/csv, application/pdf"),
    "EX-103": ("TC-136", ["As ag-000002 GET /api/v1/portal/reports", "GET portal/reports/AML_SCREENING", "GET the first portal report"], "Sub-agent"),
    "EX-104": ("TC-137", ["POST reports/schedules with recipient 'not-an-email'", "POST a valid DAILY XLSX schedule", "PUT schedules/{id}/active false"], "COLLECTIONS, PREVIOUS_DAY"),
    "EX-105": ("TC-125", ["As manager GET /api/v1/backoffice/dashboard", "As ag-000001 GET /api/v1/portal/dashboard"], "Demonstration data"),
    "EX-106": ("TC-126", ["As ops.checker GET approvals/inbox", "GET /api/v1/backoffice/documents?status=UPLOADED"], "Checker permissions"),
    "EX-110": ("TC-141", ["As manager GET role-options", "POST /api/v1/backoffice/users (AUDITOR, LOCAL)", "PATCH users/{id} with a portal role", "PATCH with no roles"], "qa.lockout.<run>"),
    "EX-111": ("TC-142", ["PUT users/{self}/status DISABLED", "POST users/{self}/reset-password", "PATCH users/{self} roleIds []"], "manager's own account"),
    "EX-112": ("TC-144", ["POST /api/v1/backoffice/roles with permissions [bo.dashboard, portal.dashboard]", "POST with valid permissions", "DELETE roles/{SYSTEM_ADMINISTRATOR}", "DELETE the new role"], "READ_ONLY_<run>"),
    "EX-113": ("TC-145", ["PUT config/parameters/billing.payment_grace_days = 0", "= 10", "= 7", "GET audit?entityType=ConfigParameter"], "Range 1–60"),
    "EX-114": ("TC-146", ["POST config/codes ENDORSEMENT_TYPE TEST_<run>", "PATCH codes/{id} active=false", "As ag-000001 POST endorsements with that type"], "Policy of EX-043"),
    "EX-115": ("TC-147", ["GET /api/v1/backoffice/workflows", "PUT workflows/PARTICIPANT_UPDATE with permission bo.users.manage", "PUT with bo.approve.participants"], "Eight definitions"),
    "EX-116": ("TC-139", ["GET audit?actor=manager", "GET audit?action=LOGIN_FAILED", "GET audit/facets", "As ops.maker GET audit"], "Audit trail"),
    "EX-117": ("TC-065", ["GET /api/v1/backoffice/products", "PUT products/{KHR} with plans []", "PUT with the unchanged configuration"], "Khairat product"),
    "EX-118": ("TC-122", ["As ops.checker POST documents/{IC copy}/review REJECTED without remarks", "POST VERIFIED with remarks", "As ag-000001 GET /api/v1/common/documents for the policy"], "IC copy uploaded in EX-036"),
    "EX-119": ("TC-028", ["As ag-000003 GET /api/v1/common/documents/{id}/content"], "Document of agency AGY-SA"),
    "EX-120": ("TC-151", ["As finance POST /api/v1/backoffice/eod for tomorrow", "As ops.maker POST eod for today"], "Business date in Brunei time"),
    "EX-121": ("TC-152", ["As finance POST /api/v1/backoffice/eod for today, twice", "GET /api/v1/common/documents/{finFileDocumentId}/content", "GET /api/v1/backoffice/eod"], "Today's issuance"),
    "EX-122": ("TC-152", ["GET integration/outbox?system=FINANCE and filter EOD_POSTING for today", "Compare idempotencyKey with the revision"], "Runs of EX-121"),
    "EX-123": ("TC-155", ["Wait for the dispatcher (20 s)", "GET integration/summary", "GET outbox?status=SENT", "GET logs?system=FINANCE"], "INTEGRATION_MODE simulated"),
    "EX-124": ("TC-153", ["POST integration/reconciliations for today", "GET integration/reconciliations"], "Today's EOD"),
    "EX-125": ("TC-156", ["POST integration/outbox/{SENT message}/retry"], "Any delivered message"),
    "EX-126": ("TC-148", ["GET /api/v1/integration/policies?issuedOn=today without key, with a wrong key, with the configured key"], "x-api-key"),
    "EX-127": ("TC-149", ["PUT /api/v1/integration/agents/AG-999999/status", "POST /api/v1/integration/commissions/paid with items 'nope'"], "Valid key"),
    "EX-128": ("TC-127", ["As ag-000001 GET /api/v1/common/notifications", "GET unread-count", "POST {id}/read", "POST read-all", "GET unread-count"], "Notifications from the run"),
    "EX-129": ("TC-094", ["GET integration/outbox and filter messages naming the policy or its quotation"], "Policy of EX-043"),
    "EX-130": ("TC-165", ["GET /api/v1/nothing-here", "POST /api/v1/auth/login with broken JSON"], "Anonymous"),
    "EX-131": ("TC-190", ["GET /health/live", "GET /health/ready", "Inspect response headers"], "Anonymous"),
    "EX-132": ("TC-190", ["GET /api/docs"], "API_DOCS_ENABLED"),
    "EX-133": ("TC-018", ["Wait 61 s for the sign-in rate limit", "POST /api/v1/auth/login 5× with a wrong password for the user of EX-110", "POST with the temporary password", "As manager POST users/{id}/unlock", "Sign in; GET /api/v1/backoffice/users", "Disable the test user"], "security.lockout.max_attempts = 5"),
    "EX-134": ("TC-143", ["As manager POST /api/v1/backoffice/users/{qa user}/reset-password", "Sign in as the (disabled) user with the new temporary password"], "User of EX-110, disabled in EX-133"),
}

# ---------------------------------------------------------------------------------------------
# 2. End-to-end suite (apps/api/test/*.e2e-spec.ts) decomposed into business cases
# ---------------------------------------------------------------------------------------------
def _e(condition, title, steps, data, expected, spec, test):
    return {"condition": condition, "title": title, "steps": steps, "data": data, "expected": expected,
            "spec": spec, "test": test, "persona": _persona_for(spec, test)}


def _persona_for(spec, test):
    if spec.startswith("auth"):
        return "finance, support, ag-000001..3, admin"
    if spec.startswith("access"):
        return "ag-000001..3, finance, ops.maker, manager, system"
    if spec.startswith("policy"):
        return "ag-000002, bk-000004, ops.maker, finance, underwriter"
    return "ag-000001, ops.checker, compliance, support, finance, manager"


AUTH = "auth.e2e-spec.ts"
ACC = "access-control.e2e-spec.ts"
POL = "policy-lifecycle.e2e-spec.ts"
OPS = "operations.e2e-spec.ts"
JOURNEY = "runs the full Professional Takaful Plan journey with maker-checker payment verification"

E2E = [
    _e("TC-001", "Generic message for wrong credentials (suite)", [STEPS_API, "Sign in as 'nobody' and as finance with a wrong password"], "Unknown user; wrong password", "Both 401 INVALID_CREDENTIALS with identical message", AUTH, "rejects wrong credentials with a generic message"),
    _e("TC-012", "Session cookie flags and no secrets in the sign-in response (suite)", [STEPS_API, "Sign in as finance", "Inspect Set-Cookie and body"], "finance", "HttpOnly, SameSite=Strict; no passwordHash or argon2 text", AUTH, "issues an HttpOnly, SameSite=Strict session cookie and never returns secrets"),
    _e("TC-017", "Lockout after five failed attempts (suite)", [STEPS_API, "5 wrong passwords for support", "Correct password"], "support", "Sixth attempt 401 ACCOUNT_LOCKED", AUTH, "locks the account after the configured number of failed attempts"),
    _e("TC-015", "CSRF token required on state-changing requests (suite)", [STEPS_API, "POST read-all without, with forged, with real token"], "ag-000001", "403 CSRF_TOKEN_INVALID; 403; 204", AUTH, "requires the CSRF token on state-changing requests"),
    _e("TC-014", "Logout ends the session (suite)", [STEPS_API, "GET /auth/me, logout, GET /auth/me"], "ag-000002", "200; 204; 401", AUTH, "ends the session on logout"),
    _e("TC-015", "Single active session (suite)", [STEPS_API, "Sign in twice as ag-000003; use the first cookie"], "ag-000003", "401 NOT_AUTHENTICATED on the first session", AUTH, "keeps only one active session per user"),
    _e("TC-010", "Temporary password must be changed first; weak passwords refused (suite)", [STEPS_API, "Sign in as admin with the seeded temporary password", "GET /backoffice/users", "Change to 'password1'", "Change to a strong password", "GET /backoffice/users"], "admin / Temp#Admin2026x", "403 PASSWORD_CHANGE_REQUIRED; 422 PASSWORD_POLICY; 200; 200", AUTH, "forces a temporary password to be changed before anything else"),
    _e("TC-021", "Unauthenticated request refused (suite)", [STEPS_API, "GET /portal/policies without a session"], "None", "401 NOT_AUTHENTICATED", ACC, "rejects unauthenticated requests"),
    _e("TC-022", "Audience separation (suite)", [STEPS_API, "Agent calls back-office; finance calls portal"], "ag-000001, finance", "403 WRONG_AUDIENCE both ways", ACC, "keeps portal users out of the back-office API and vice versa"),
    _e("TC-023", "Permission enforced inside the back-office (suite)", [STEPS_API, "ops.maker GET /backoffice/users"], "ops.maker", "403 FORBIDDEN", ACC, "enforces permissions within the back-office"),
    _e("TC-026", "Hierarchy and agency scoping of policies (suite)", [STEPS_API, "Policy of AG-000001 read by ag-000003, ag-000002 and ag-000001"], "Main agent policy", "404; 404; 200", ACC, "restricts records to the agent hierarchy and agency"),
    _e("TC-164", "Injection in search parameters treated as text (suite)", [STEPS_API, "GET /portal/policies?search=' OR 1=1; DROP TABLE policy; --"], "ag-000001", "200 with no items; policy table intact", ACC, "treats injection attempts in search parameters as plain text"),
    _e("TC-163", "Unknown and malformed fields rejected (suite)", [STEPS_API, "POST /portal/participants with isAdmin and mobile 'abc'"], "ag-000001", "400 listing 'isAdmin should not exist' and mobile", ACC, "rejects unknown and malformed fields"),
    _e("TC-165", "No internal error details; correlation id (suite)", [STEPS_API, "GET /portal/policies/not-a-uuid without session"], "None", "401; X-Request-Id present; no stack/prisma text", ACC, "never exposes internal error details and returns a correlation id"),
    _e("TC-165", "Security headers; framework hidden (suite)", [STEPS_API, "GET /health/live"], "None", "No X-Powered-By; nosniff, HSTS, CSP present", ACC, "sends security headers and hides the framework"),
    _e("TC-148", "System-to-system API key (suite)", [STEPS_API, "GET /integration/policies without key, wrong key, valid key"], "e2e-inbound-key", "401; 401; 200", ACC, "authenticates system-to-system calls with an API key"),
    _e("TC-161", "Identification numbers encrypted and masked (suite)", [STEPS_API, "Read idNumberEnc in the database; GET /backoffice/participants/{id} as manager"], "First participant", "Ciphertext starts 'v1:'; idNumberMasked ****1234; no idNumberEnc in the response", ACC, "stores identification numbers encrypted and shows them masked"),
    _e("TC-140", "Audit trail append-only (suite)", [STEPS_API, "UPDATE audit_log; DELETE FROM audit_log"], "Database", "Both statements rejected by the trigger ('append-only')", ACC, "keeps the audit trail append-only at database level"),
    # Journey split
    _e("TC-042", "Journey: participant registered and auto-cleared by AML (suite)", [STEPS_API, "POST /portal/participants Nur Hidayah binti Kamal"], "NRIC 01-990011", "201; amlStatus CLEAR", POL, JOURNEY),
    _e("TC-058", "Journey: Professional Plan A with additional cover rated 165 (suite)", [STEPS_API, "POST /portal/policies/calculate PRO plan A additionalCover"], "75 + 90", "contribution '165'", POL, JOURNEY),
    _e("TC-067", "Journey: quotation created in DRAFT (suite)", [STEPS_API, "POST /portal/policies"], "PRO plan A", "201 DRAFT", POL, JOURNEY),
    _e("TC-071", "Journey: questionnaire gate (suite)", [STEPS_API, "Submit before the questionnaire; answer all 'no'"], "3 declarations", "422 QUESTIONNAIRE_INCOMPLETE; then 200", POL, JOURNEY),
    _e("TC-072", "Journey: nominee shares and encrypted nominee ID retained (suite)", [STEPS_API, "PUT nominees 60%; 100% with ID; re-save with id and no ID number"], "Kamal bin Ali", "422 INVALID_SHARES; 200; stored idNumberEnc unchanged", POL, JOURNEY),
    _e("TC-073", "Journey: missing documents listed (suite)", [STEPS_API, "Submit without uploads"], "PRO documents", "422 SUBMISSION_INCOMPLETE with 'Upload: IC copy'", POL, JOURNEY),
    _e("TC-119", "Journey: disguised executable refused, PDFs accepted (suite)", [STEPS_API, "Upload MZ content as ic.pdf; upload PDFs; sign on screen"], "IC_COPY, NOMINEE_IC, PNG signature", "422 FILE_TYPE_NOT_ALLOWED; 201; 201; 201", POL, JOURNEY),
    _e("TC-078", "Journey: submission moves to PENDING_PAYMENT (suite)", [STEPS_API, "POST /submit"], "Complete application", "200 PENDING_PAYMENT", POL, JOURNEY),
    _e("TC-099", "Journey: payment with proof pending verification (suite)", [STEPS_API, "POST /portal/billing/payments 165 with PDF proof"], "TRX-E2E-0001", "201 PENDING_VERIFICATION", POL, JOURNEY),
    _e("TC-100", "Journey: only Finance verifies; rejection needs remarks (suite)", [STEPS_API, "ops.maker approve; finance inbox; finance reject with empty remarks; finance approve"], "PAYMENT_VERIFICATION", "403; inbox contains the request; 400; 200", POL, JOURNEY),
    _e("TC-092", "Journey: policy issued ACTIVE/PAID with number, receipt and documents (suite)", [STEPS_API, "GET /portal/policies/{id}"], "After approval", "ACTIVE, PAID, PRO/yy/nnnnnn, 1 receipt, POLICY_SCHEDULE and RECEIPT documents", POL, JOURNEY),
    _e("TC-093", "Journey: schedule served as PDF (suite)", [STEPS_API, "GET /common/documents/{schedule}/content"], "POLICY_SCHEDULE", "200 application/pdf starting %PDF-", POL, JOURNEY),
    _e("TC-094", "Journey: POLICY_ISSUED and RECEIPT_POSTED queued (suite)", [STEPS_API, "Read outbox_message for the policy and receipt"], "Outbox", "Operations include POLICY_ISSUED and RECEIPT_POSTED", POL, JOURNEY),
    _e("TC-105", "Blocked bank cannot submit new business (suite)", [STEPS_API, "bk-000004 submits an FTP-NP quotation"], "BNK-MIB blocked", "422 AGENCY_BLOCKED", POL, "blocks new business for an agency with overdue contributions (AP-42)"),
    _e("TC-079", "High-risk financing referral visible to the underwriter (suite)", [STEPS_API, "Find the pending POLICY_REFERRAL; GET as underwriter"], "Seeded referral above B$150,000", "Payload has a high-risk reason; first action SUBMIT", POL, "refers high-risk financing for approval and prevents self-approval"),
    _e("TC-110", "Renewal only inside the window (suite)", [STEPS_API, "Renew a due policy; renew one ending in more than 120 days"], "ag-000002 policies", "201 DRAFT; 422 OUTSIDE_RENEWAL_WINDOW", POL, "renews a policy only inside its renewal window"),
    _e("TC-033", "Sub-agent onboarding end to end (suite)", [STEPS_API, "Register SUB_AGENT; checker approves before upload; upload IC; approve"], "Hazirah binti Jamil", "201 PENDING AG-nnnnnn; 422 DOCUMENTS_MISSING; 200; agent ACTIVE; user = agent code; mustChangePassword", OPS, "onboards a sub-agent through registration, AML, documents and approval (AP-07, BO-10/13)"),
    _e("TC-032", "Passport holders need a passport copy (suite)", [STEPS_API, "Register with PASSPORT; upload IC_COPY only; approve; upload PASSPORT_COPY; approve"], "Nurul Ain binti Osman", "422 DOCUMENTS_MISSING; then 200", OPS, "asks passport holders for a passport copy instead of an IC copy"),
    _e("TC-034", "Confirmed AML match closes the registration (suite)", [STEPS_API, "Register 'Viktor Petrenko'; compliance CONFIRMED_MATCH"], "Watch-list DEMO-002", "amlStatus FLAGGED; request REJECTED with 'AML match confirmed'; agent REJECTED", OPS, "closes a pending registration when Compliance confirms an AML match"),
    _e("TC-050", "Watch-list match reviewed by Compliance; CSV import (suite)", [STEPS_API, "Review 'Ahmad Zulkifli bin Hamid' as CONFIRMED_MATCH; import a CSV line"], "score ≥ 85", "201; participant REJECTED; imported = 1", OPS, "routes a watch-list match to Compliance and records the review (AP-16, BO-13..15)"),
    _e("TC-131", "Issue lifecycle with SLA dates (suite)", [STEPS_API, "Create HIGH issue; assign; comments; resolve without/with resolution; reporter closes"], "responseDueAt = +2 h", "201; 200; 422; 200; reporter sees public comment only; CLOSED", OPS, "manages an issue through assignment, comments and resolution with SLA dates (AP-55..57, BO-29..31)"),
    _e("TC-116", "Claim only within the period of cover; status transitions (suite)", [STEPS_API, "validate-policy; claim dated 2020; claim today; CLOSED; UNDER_REVIEW"], "KHR policy", "200; 422 CLAIM_NOT_VALID; 201; 422; 200", OPS, "accepts claim notifications only within the period of cover (AP-43)"),
    _e("TC-134", "Every standard report runs and exports; portal restriction; schedule (suite)", [STEPS_API, "Run 12 reports; export 3 formats; agent catalogue; schedule create/deactivate"], "manager, ag-000002", "12 × 200; XLSX/CSV/PDF types; AML_SCREENING absent and 403; 201; 200", OPS, "runs every standard report and exports it in each format (BO-22..24)"),
    _e("TC-152", "EOD, FIN posting, reconciliation, dead letter (suite)", [STEPS_API, "Run EOD twice; read idempotency keys; download FIN file; dispatch; reconcile; retry a DEAD message"], "finance", "COMPLETED; same run id; keys R(n-1), R(n); file has record_type; FINANCE successCount > 0; MATCHED; unknown operation stays DEAD", OPS, "runs end-of-day, posts to FIN, reconciles and delivers integration messages (FFR EOD, INT-13..15)"),
    _e("TC-141", "Administration with audit trail (suite)", [STEPS_API, "Create user; portal role; reset; disable; self-disable; role with mixed permissions; parameter 0/10/7; code; workflows"], "manager", "201 (17-char password); 422; 200; 200; 422; 422 INVALID_PERMISSION; 422/200/200; 201; 8 workflows; 422/200; audit PARAMETER_UPDATED by manager", OPS, "administers users, roles, parameters, master data and workflows with an audit trail (BO-03/04/26..33, COM-04)"),
    _e("TC-125", "Dashboards (suite)", [STEPS_API, "GET /backoffice/dashboard; GET /portal/dashboard as bk-000004"], "manager, bk-000004", "policiesYtd > 0; 12 trend points; issuanceBlocked true with AGENCY_BLOCKED pending action", OPS, "serves the dashboards (AP-52/53, BO-20/21)"),
]

# ---------------------------------------------------------------------------------------------
# 3. Manual (exploratory) UI runs with screenshot evidence (file names in evidence/ui-screens)
# ---------------------------------------------------------------------------------------------
def _m(condition, title, persona, steps, data, expected, shots):
    return {"condition": condition, "title": title, "persona": persona, "steps": steps, "data": data,
            "expected": expected, "shots": shots if isinstance(shots, list) else [shots]}


MANUAL = [
    _m("TC-006", "Sign-in page at desktop and mobile widths", "ag-000001", ["Open /login at 1440, 1280 and 390 px", "Sign in"], "Demo password", "Form usable at every width; dashboard opens", ["ui-login-1440.png", "ui-login-390.png", "a-login.png"]),
    _m("TC-010", "Change-password page after first sign-in", "New user", ["Sign in with a temporary password", "Observe the change-password page"], "Temporary password", "Change-password page shown before any other page", "ui-change-password.png"),
    _m("TC-070", "Quotation wizard for a fixed-plan product", "ag-000001", ["New quotation", "Select product", "Select participant", "Choose cover", "Review and save"], "Professional Takaful Plan", "Four steps complete; draft saved with quotation number", ["ui-wizard-1-product.png", "ui-wizard-2-participant.png", "ui-wizard-3-coverage.png", "ui-wizard-4-review.png", "a-wizard-saved.png"]),
    _m("TC-070", "Quotation wizard for a financing product", "bk-000005", ["New quotation", "Select Financing Takaful – Hire Purchase", "Select participant", "Enter financing details"], "Amount, tenure, profit rate", "Financing fields shown; contribution calculated", ["ui-wizard-fin-1-product.png", "ui-wizard-fin-2-participant.png", "ui-wizard-fin-3-coverage.png"]),
    _m("TC-045", "Duplicate participant detected in the wizard", "ag-000001", ["In the participant step enter an IC already registered", "Click Register"], "Existing IC", "Warning names the existing participant number and offers 'Use existing participant'", ["a-wizard-duplicate.png", "a-wizard-duplicate-used.png", "a-participant-duplicate.png"]),
    _m("TC-073", "Draft completion: questionnaire, nominees, uploads, signature, submit", "ag-000001", ["Open the draft", "Answer the questionnaire", "Add nominees", "Upload documents", "Sign on screen", "Submit"], "Draft of the wizard run", "Readiness panel clears item by item; status PENDING_PAYMENT after submit", ["a-draft-questionnaire.png", "a-draft-nominees.png", "a-draft-upload.png", "a-draft-signature.png", "a-draft-ready.png", "a-draft-submitted.png"]),
    _m("TC-075", "E-signature link sent from the policy page", "ag-000001", ["Open the draft", "Click 'Send e-signature link'", "Enter the participant e-mail", "Send"], "Participant e-mail", "Confirmation with the recipient and expiry", ["a-link-modal.png", "a-link-sent.png"]),
    _m("TC-076", "Public e-signature page states", "Participant", ["Open the link", "Type a wrong name", "Sign with the right name", "Reopen the link", "Open an invalid link"], "Signature link", "Review page; 'type your full name exactly' error; signed confirmation; used/invalid link page", ["a-esign.png", "a-esign-mismatch.png", "a-esign-done.png", "a-esign-invalid.png"]),
    _m("TC-099", "Bulk payment by a bank officer", "bk-000005", ["Open Billing & payments", "Select several outstanding policies", "Submit payment with proof", "Open the payment"], "Bank transfer", "Policies move to Pending verification; payment detail shows allocations", ["a-billing.png", "a-billing-drawer.png", "a-billing-submitted.png", "a-payment.png"]),
    _m("TC-098", "Payment form validation", "bk-000005", ["Submit the payment form without proof or reference"], "Empty form", "Field errors shown; nothing submitted", "a-billing-drawer-error.png"),
    _m("TC-105", "Blocked bank officer sees the block", "bk-000004", ["Sign in as bk-000004", "Open Billing & payments"], "Blocked bank", "Block notice with the overdue reason; new business disabled", "a-billing-bk-000004.png"),
    _m("TC-100", "Finance verifies a payment from the approvals inbox", "finance", ["Open Approvals", "Open the payment request", "Approve with remarks"], "Pending payment", "Request approved; policy issued", ["ui-approvals-inbox.png", "ui-approval-payment.png", "b-flow-approve-modal.png", "b-flow-approved.png"]),
    _m("TC-090", "Policy detail: overview, documents, payments, history", "ag-000001", ["Open an active policy", "Switch tabs"], "Active PRO policy", "Cover, participant, documents (schedule, receipt), payments and history visible", ["a-policy-active.png", "a-policy-documents.png", "a-policy-payments.png", "a-policy-history.png"]),
    _m("TC-089", "Policy list with statuses and search", "ag-000001", ["Open Quotations & policies", "Filter by status", "Search"], "Mixed statuses", "List shows Draft, Pending payment, Active with tags; filters apply", ["a-policies.png", "ui-portal-policies.png", "a-policy-draft.png", "a-policy-pending.png"]),
    _m("TC-111", "Endorsement request from the policy page", "ag-000001", ["Open an active policy", "Request endorsement", "Choose type and describe"], "NOMINEE_CHANGE", "Request submitted and listed under My requests", "a-endorsement.png"),
    _m("TC-113", "Cancellation request modal", "ag-000001", ["Open an active policy", "Cancel", "Choose reason, date and remarks"], "PHA/26/000004", "Modal warns the policy stays in force until approval; request submitted", "a-cancellation.png"),
    _m("TC-108", "Renewals due list and renewal quotation", "ag-000001", ["Open Renewals", "Renew a due policy"], "Policy within 45 days of expiry", "Renewal quotation created in DRAFT", ["a-renewals.png", "a-renewal-quotation.png", "p0-renewals.png"]),
    _m("TC-118", "Claim notification and back-office review", "ag-000001, ops.maker", ["Open Claims", "New claim: validate policy, enter details, upload", "Back-office opens the claim and updates the status"], "ACCIDENT claim", "Claim created with number; status updated in the back-office and visible to the agent", ["a-claims.png", "a-claim-new.png", "a-claim-created.png", "a-bo-claims.png", "a-bo-claim.png", "a-bo-claim-status.png", "a-bo-claim-updated.png"]),
    _m("TC-042", "Participant registration and update request", "ag-000001", ["Open Participants", "New participant", "Save", "Edit and submit an update"], "Individual participant", "Participant created with number; update request pending approval", ["a-participants.png", "a-participant-new.png", "a-participant-created.png", "a-participant-update.png"]),
    _m("TC-031", "Agent registration from the portal and approval", "ag-000001, ops.checker", ["Team & hierarchy → Register", "Fill the form and upload the IC copy", "Checker opens the approval and approves"], "Sub-agent", "Agent code assigned; pending → active after approval", ["b-flow-register-filled.png", "b-flow-register-upload.png", "b-flow-register-uploaded.png", "b-flow-register-done.png", "b-flow-agent-pending.png", "ui-approval-agent.png"]),
    _m("TC-036", "Maker withdraws a pending request", "ag-000001", ["Open My requests", "Withdraw the agent registration"], "Pending request", "Status WITHDRAWN; agent no longer pending", ["b-flow-maker-view.png", "b-flow-agent-after-withdraw.png"]),
    _m("TC-035", "Profile, agency and team views", "ag-000002, bk-000005", ["Open Profile", "Open Team & hierarchy"], "Sub-agent and bank officer", "Profile details, agency information and reporting line shown", ["b-profile.png", "b-team.png", "b-team-sub.png", "b-team-banca.png"]),
    _m("TC-040", "Back-office agent registration with validation", "ops.maker", ["Agents & bankers → New agent", "Submit with invalid data", "Submit valid data"], "Agent under AGY-DT", "Validation messages; agent registered pending approval", ["b-bo-agent-new.png", "b-flow-bo-register-filled.png", "b-flow-bo-registered.png"]),
    _m("TC-039", "Agency maintenance", "manager", ["Agencies & banks → New", "Submit invalid, then valid data", "Open the agency"], "New agency", "Validation shown; agency created and listed with its agents", ["b-bo-agencies.png", "b-flow-agency-validation.png", "b-flow-agency-detail.png"]),
    _m("TC-050", "AML case: flagged subject, review validation, confirmed match", "compliance", ["Open AML / KYC", "Open the flagged case", "Submit the review without remarks", "Confirm the match"], "Viktor Petrenko", "Validation on empty remarks; case Confirmed match with reviewer, time and remarks", ["b-flow-aml-flagged-approval.png", "b-flow-aml-review-validation.png", "b-flow-aml-confirmed.png", "b-flow-aml-not-cleared.png"]),
    _m("TC-053", "Watch-list maintenance and CSV import", "compliance", ["Open Watch-lists", "Import a CSV"], "list.csv", "Entries listed; import count shown", ["b-flow-watchlist.png", "b-flow-watchlist-import.png"]),
    _m("TC-129", "Issue reported from the portal and tracked", "ag-000001", ["Support → Report issue", "Submit with missing fields", "Submit", "Open the issue"], "HIGH issue", "Validation; issue number and SLA targets shown", ["b-issues-portal.png", "b-flow-issue-validation.png", "b-flow-issue-created.png", "b-flow-issue-detail.png"]),
    _m("TC-131", "Issue resolved and closed with SLA view", "support, ag-000001", ["Back-office Issues → open", "Resolve without text", "Resolve with text", "Reporter sees the resolution and closes"], "Issue above", "Validation on empty resolution; resolved; closed", ["b-flow-issue-resolve-validation.png", "b-flow-issue-resolved.png", "b-flow-issue-reporter-resolved.png", "b-flow-issue-closed.png"]),
    _m("TC-132", "SLA-breached issues highlighted", "support", ["Open Issues with the 'breached' filter"], "Seeded breached issue", "Breached issues listed with the missed target", "b-flow-bo-issues-breached.png"),
    _m("TC-134", "Report preview and production report", "manager", ["Open Reports", "Preview Policy register", "Run Production summary"], "Date range", "Rows displayed with filters; export buttons available", ["b-bo-reports.png", "b-flow-report-preview.png", "b-flow-report-production.png"]),
    _m("TC-137", "Report schedule created", "manager", ["Reports → Schedules → New", "Set frequency, format, recipients"], "Daily collections", "Schedule listed with next run", ["b-flow-schedule-modal.png", "b-flow-schedules.png"]),
    _m("TC-136", "Portal reports for an agent", "ag-000001", ["Open Reports in the portal"], "Agent scope", "Only portal reports listed; own data", ["b-reports-portal.png", "b-final-preports.png"]),
    _m("TC-141", "User created with a temporary password", "manager", ["Users → New user", "Assign a role", "Save"], "New staff user", "Temporary password displayed once", ["b-flow-user-new.png", "b-flow-user-password.png", "r0-user-modal.png"]),
    _m("TC-144", "Role editing", "manager", ["Roles → open a role", "Change permissions"], "Custom role", "Permissions grouped by audience; saved", ["b-flow-roles.png", "b-flow-role-drawer.png"]),
    _m("TC-145", "Parameter validation", "manager", ["Settings → change a parameter outside its range"], "billing.payment_grace_days = 0", "Range error shown; value unchanged", ["b-flow-param-error.png", "b-bo-settings.png"]),
    _m("TC-065", "Product configuration validation", "manager", ["Products → open a product", "Save an invalid configuration", "Save valid"], "Khairat", "Validation error and server error shown without stack trace; valid save confirmed", ["b-flow-product-invalid.png", "b-flow-product-server-error.png", "b-bo-products.png"]),
    _m("TC-146", "Master data maintenance", "manager", ["Settings → Master data", "Add and deactivate a code"], "ENDORSEMENT_TYPE", "Code listed with active flag", "b-flow-master-data.png"),
    _m("TC-147", "Workflow configuration editor", "manager", ["Workflows → edit PARTICIPANT_UPDATE", "Change the approving permission"], "Approval permissions", "Steps saved; invalid permission refused", ["b-bo-workflows.png", "b-flow-workflow-edit.png"]),
    _m("TC-138", "Audit trail with before/after diff", "manager", ["Open Audit trail", "Open an entry"], "Parameter change", "Entry shows actor, time, IP and the before/after values", ["b-bo-audit.png", "b-flow-audit-diff.png"]),
    _m("TC-152", "End-of-day run and re-run from the back-office", "finance", ["End of day → Run", "Confirm", "Run again"], "Today", "Run COMPLETED with files; re-run completes for the same date", ["b-flow-eod-modal.png", "b-flow-eod-done.png", "b-bo-eod.png"]),
    _m("TC-153", "Reconciliation and integration monitor", "finance", ["Integration → Reconciliation → run", "Open logs", "Open a failure"], "Today", "MATCHED result; log entries; failure detail with message", ["b-flow-recon.png", "b-flow-int-log.png", "b-flow-failure.png", "b-bo-integration.png"]),
    _m("TC-126", "Back-office dashboards and inbox", "manager, ops.maker", ["Open the dashboard as manager and as ops.maker", "Open Approvals"], "Demonstration data", "KPIs and trend; pending actions per role", ["ui-bo-dashboard.png", "ui-bo-dashboard-opsmaker.png", "b-bo-inbox.png", "ui-approvals-all.png"]),
    _m("TC-125", "Portal dashboard at desktop and mobile widths", "ag-000001", ["Open the dashboard at 1280 and 390 px", "Open the mobile navigation"], "Demonstration data", "Cards, pending actions and navigation usable at both widths", ["ui-portal-dashboard-1280.png", "ui-portal-dashboard-390.png", "ui-mobile-nav.png"]),
    _m("TC-127", "Notification centre", "ag-000001, manager", ["Open notifications in the portal and the back-office", "Mark as read"], "Run events", "Unread count and list; links open the record", ["ui-notifications.png", "b-bo-notifications.png", "b-final-pnotif.png"]),
    _m("TC-038", "Agent status change request and approval detail", "ops.maker, ops.checker", ["Open an agent", "Request a status change", "Checker opens the approval"], "Suspend AG-000003", "Status modal validates reason; approval shows the change", ["b-flow-status-modal.png", "b-bo-approval-agent.png"]),
    _m("TC-087", "Approval request views", "ops.checker, underwriter", ["Open Approvals (all)", "Open a participant update, an agent registration and a referral"], "Pending requests", "Payload shown with before/after; actions and history", ["b-bo-approvals-all.png", "b-bo-approval-participant.png", "b-bo-approval-referral.png", "b-flow-reject-validation.png", "b-flow-rejected.png"]),
    _m("TC-122", "Document checks queue", "ops.checker", ["Open Document checks", "Verify or reject a document"], "Uploaded IC copy", "Queue lists uploaded documents; decision recorded", ["b-bo-documents.png", "b-final-docs.png"]),
    _m("TC-091", "Back-office policy, participant and payment views", "ops.maker", ["Open Policies, Participants, Payments", "Open one record of each"], "All agencies", "Cross-agency lists and details; masked identifiers", ["a-bo-policies.png", "a-bo-policy.png", "a-bo-participants.png", "a-bo-participant.png", "a-bo-payments.png", "a-bo-payment.png"]),
    _m("TC-107", "Commission statement", "ag-000001", ["Open Commission"], "Issued policies", "Accrued commission per policy with month filter", ["a-commission.png", "p0-commission.png"]),
    _m("TC-180", "Global search and user menu", "ag-000001", ["Use the global search", "Open the user menu"], "Policy number", "Results link to the record; menu offers profile, password and sign-out", ["ui-search.png", "ui-user-menu.png"]),
    _m("TC-025", "Not-authorised page for a missing permission", "support", ["Open a back-office page the role lacks"], "support desk role", "Not-authorised page shown; menu entry absent", "b-final-roles.png"),
]

# ---------------------------------------------------------------------------------------------
# 4. Cases that cannot be executed in the iorta test environment
# ---------------------------------------------------------------------------------------------
IIFT_ENV = "Not executed – requires IIFT environment"


def _n(condition, title, persona, steps, data, expected, level, reason):
    return {"condition": condition, "title": title, "persona": persona, "steps": steps, "data": data,
            "expected": expected, "level": level, "reason": reason}


NOT_EXECUTED = [
    _n("TC-016", "Idle timeout ends the session after 15 minutes", "Any user", ["Sign in", "Leave the browser idle for 16 minutes", "Click any navigation"], "security.session.idle_minutes = 15", "Redirected to sign-in with 'session ended'; API answers 401", "UI", "Not executed – time-based; scheduled for SIT regression (Playwright) in week 16"),
    _n("TC-016", "Absolute timeout ends the session after 8 hours", "Any user", ["Keep a session active with periodic requests for 8 h"], "security.session.absolute_hours = 8", "Session ends at 8 h regardless of activity", "SIT", "Not executed – time-based; SIT soak run"),
    _n("TC-008", "Password history and expiry", "Agent", ["Change password 6 times cycling back to the first", "Set expiry to 1 day; sign in after"], "history_count 5, expiry_days", "Reuse of the last 5 refused; expired password forces a change", "SIT", "Not executed – changes demonstration account passwords; run in SIT with dedicated accounts"),
    _n("TC-020", "Back-office sign-on through IIFT Active Directory", "IIFT staff", ["Configure LDAP_URL and bind account", "Sign in with a directory user", "Attempt a reset"], "IITH AD test OU", "Directory user signs in; reset refused with DIRECTORY_ACCOUNT", "SIT", f"{IIFT_ENV} (LDAP endpoint)"),
    _n("TC-004", "Sign-in rate limit per client address", "Anonymous", ["Send 11 sign-in attempts within a minute from one address"], "LOGIN_RATE_LIMIT_PER_MINUTE = 10", "Attempts after the tenth answer 429", "Security", "Not executed in this run (would block the run's own sign-ins); covered by automated check SEC-08"),
    _n("TC-096", "Expiry job and renewal notices", "System", ["Backdate a policy end date", "Trigger the 00:05 policy-expiry job", "Check status and notifications"], "JOBS_ENABLED=true", "Policy EXPIRED; agent notified; renewal notice within 45 days", "SIT", "Not executed – scheduled job; SIT with job schedule enabled"),
    _n("TC-104", "Grace-period job blocks and unblocks an agency", "System, bank officer", ["Issue a financing policy; leave unpaid 8 days", "Run the 01:00 grace-period job", "Pay; run the job again"], "billing.payment_grace_days = 7", "Agency blocked with reason and notification; unblocked after payment", "SIT", "Not executed – date-driven job; seeded state verified through EX-054 and the suite"),
    _n("TC-106", "Manual lift of a payment block", "manager", ["Agencies → blocked bank → Lift block with reason"], "BNK-MIB", "issuanceBlocked false; audit AGENCY_UNBLOCKED", "API", "Not executed – would alter the shared demonstration state used by the suites"),
    _n("TC-077", "Participant signs through the e-mailed link", "Participant", ["Receive the e-mail", "Open the link", "Type the name, consent, sign"], "SMTP relay", "Signature stored; link marked used", "SIT", f"{IIFT_ENV} (SMTP relay to deliver the link); UI states verified manually"),
    _n("TC-128", "E-mail and SMS delivery through IIFT gateways", "System", ["Configure SMTP_HOST and SMS_API_BASE_URL", "Trigger a notification"], "IITH relay, SMS provider", "Message delivered; integration log success", "SIT", f"{IIFT_ENV} (SMTP and SMS endpoints)"),
    _n("TC-157", "SMTP and SMS failure retry", "System", ["Point the gateway to an unreachable host", "Trigger a notification", "Restore"], "notification.max_attempts = 5", "Attempts logged with back-off; delivered after restore", "SIT", f"{IIFT_ENV}"),
    _n("TC-158", "External AML service screening", "Compliance", ["Configure AML_API_BASE_URL", "Register a participant"], "Provider sandbox", "Provider matches recorded alongside watch-list matches", "SIT", f"{IIFT_ENV} (AML provider)"),
    _n("TC-159", "Core and FIN live delivery", "IITH IT", ["Set INTEGRATION_MODE=live with Core and FIN endpoints", "Issue a policy; run EOD"], "Core/FIN test endpoints", "Messages acknowledged; FIN file ingested; reconciliation MATCHED", "SIT", f"{IIFT_ENV} (Core and FIN endpoints)"),
    _n("TC-150", "Outbound Core message acknowledged", "IITH IT", ["Approve an agent in live mode", "Check the Core acknowledgement"], "Core endpoint", "AGENT_UPSERT delivered with reference", "SIT", f"{IIFT_ENV}"),
    _n("TC-156", "Dead-letter alert e-mail", "Support", ["Force 6 failed attempts for a message", "Check the alert"], "integration.max_attempts = 6", "Message DEAD; integration support e-mailed", "SIT", "Not executed – needs a failing live endpoint; dead-letter handling verified in the suite"),
    _n("TC-154", "Scheduled EOD at 23:30 Brunei time", "System", ["Enable jobs; wait for the schedule"], "EOD_CRON", "EOD run COMPLETED automatically with a job lock", "SIT", "Not executed – time-based; SIT overnight run"),
    _n("TC-124", "Document expiry warning", "ops.checker", ["Upload a licence with an expiry 20 days ahead", "Check warnings"], "document.expiry_warning_days = 30", "Document flagged as expiring", "API", "Not executed – no expiry-driven UI in this build; verified during SIT"),
    _n("TC-133", "Attachments on issues", "ag-000001", ["Report an issue", "Attach a screenshot"], "PNG", "Attachment listed on the issue", "UI", "Not executed – UI under restyling at the time of the run; API upload path covered by TC-119"),
    _n("TC-121", "Malware scan refuses an infected upload", "Agent", ["Run ClamAV", "Upload the EICAR test file as PDF"], "CLAMAV_HOST", "422 FILE_REJECTED; audit entry", "SIT", "Not executed – ClamAV not running in the iorta test instance; mandatory in production"),
    _n("TC-162", "TLS, HSTS and database encryption in the target environment", "IITH IT", ["Inspect the load balancer certificate and HSTS", "Check sslmode=require and backup encryption"], "IIFT environment", "TLS 1.2+; HSTS; encrypted connections and backups", "SIT", f"{IIFT_ENV}"),
    _n("TC-167", "CI security gates", "DevOps", ["Push a change", "Inspect CodeQL, gitleaks, npm audit, Trivy and SBOM jobs"], "GitHub Actions", "All gates green; SBOM artifact", "Security", "Not executed in this run – pipeline runs on IIFT's or iorta's CI service; configuration reviewed in the Security Assessment Report"),
    _n("TC-169", "Independent VAPT and re-test", "Independent tester", ["Grey-box test per role; unauthenticated external test", "Remediate; re-test"], "IIFT UAT environment", "No open Critical/High findings (DEL-17)", "Security", f"{IIFT_ENV}; weeks 17–19"),
    _n("TC-170", "Back-office MFA", "Back-office staff", ["Enable MFA", "Sign in with password and OTP"], "E-mail OTP / TOTP", "Second factor required", "SIT", "Not executed – MFA not yet built (planned for implementation sprint 1)"),
    _n("TC-171", "Load test: p95 response time at 100 concurrent users", "Performance tester", ["Run the k6 scenario mix (sign-in, quotation, policy list, payment, reports)", "Ramp to 100 virtual users for 30 minutes"], "Production-like SIT at IIFT", "p95 < 2 s; error rate < 0.1%", "Perf", f"{IIFT_ENV} (performance at IIFT scale, weeks 17–18)"),
    _n("TC-172", "Volume and growth test", "Performance tester", ["Load five years of projected policies and documents", "Repeat the k6 mix"], "Appendix 2 volumes", "No degradation beyond 20% against the baseline", "Perf", f"{IIFT_ENV}"),
    _n("TC-173", "Soak test (8 hours)", "Performance tester", ["Run 50 virtual users for 8 hours", "Monitor memory and error rate"], "Production-like SIT", "Stable memory; no error growth", "Perf", f"{IIFT_ENV}"),
    _n("TC-174", "Monitoring and alert rules", "IITH IT", ["Stop one API instance", "Force an EOD failure", "Create a dead letter"], "Grafana/Prometheus or IITH SIEM", "Alerts raised to the agreed contacts", "SIT", f"{IIFT_ENV} (monitoring stack)"),
    _n("TC-175", "Application instance and database failover", "IITH IT", ["Kill one application instance during traffic", "Fail over to the standby database"], "Two instances; streaming standby", "No failed user transactions; RPO within 15 minutes", "SIT", f"{IIFT_ENV} (HA infrastructure)"),
    _n("TC-176", "Backup and restore drill", "IITH IT", ["Take a backup", "Restore into a scratch database", "Compare counts"], "pgBackRest or platform backup", "Restore succeeds; counts match", "SIT", f"{IIFT_ENV} (backup platform)"),
    _n("TC-177", "DR failover drill", "IITH IT", ["Declare DR", "Promote the DR database; start the application in the DR site", "Measure RTO/RPO"], "DR site/region", "RTO ≤ 4 h; RPO ≤ 15 min; documented", "SIT", f"{IIFT_ENV} (DR site); NFR-19"),
    _n("TC-178", "Browser matrix on IIFT devices", "UAT testers", ["Run the UAT smoke script on Chrome, Edge, Firefox, Safari and the IIFT standard laptop and phone"], "Agreed browser list", "No blocking defects on any agreed browser", "UAT", f"{IIFT_ENV} (browser matrix on IIFT devices, weeks 19–22)"),
    _n("TC-179", "Accessibility review", "UAT testers", ["Keyboard-only navigation of the wizard and approvals", "Screen-reader labels; contrast check"], "WCAG 2.1 AA basics", "No blocking accessibility issues", "UAT", "Not executed – UI under restyling; scheduled with UAT"),
    _n("TC-181", "Atomic issuance under failure", "Developer", ["Inject a failure after receipt creation inside the issuance transaction", "Inspect policy, receipt, audit and outbox"], "Fault injection", "Nothing persisted; no gap in numbering", "SIT", "Not executed – fault-injection harness scheduled for SIT"),
    _n("TC-182", "Optimistic locking on concurrent edits", "Two agents", ["Open the same draft in two sessions", "Save from both"], "version column", "Second save refused with 409 STALE_RECORD", "API", "Not executed in this run; scheduled for SIT regression"),
    _n("TC-183", "OpenAPI contract review with integration partners", "IITH IT", ["Review docs/api/openapi.json", "Generate a client stub"], "OpenAPI 3", "Every operation documented; stub compiles", "SIT", f"{IIFT_ENV} (partner review in SIT)"),
    _n("TC-184", "Retention and archival policy", "Administrator", ["Agree retention periods", "Run the archival job"], "Policy agreed in design", "Records archived per policy", "SIT", "Not executed – retention periods to be agreed with IIFT (design phase)"),
    _n("TC-185", "Migration dry-run reconciliation", "iorta, IIFT data owners", ["Load the legacy extract", "Reconcile counts and totals"], "Legacy extracts", "100% count and control-total match", "SIT", f"{IIFT_ENV} (legacy extracts; weeks 19–23)"),
    _n("TC-186", "UAT execution per product and role", "IIFT business users", ["Execute the UAT scripts for FFR01–FFR05 and back-office flows", "Record results and defects", "Sign off"], "UAT environment", "Signed UAT certificate; no open Critical/High", "UAT", f"{IIFT_ENV} (UAT by IIFT users, weeks 19–22)"),
    _n("TC-187", "Deployment rehearsal and rollback", "iorta, IITH IT", ["Deploy to pre-production from the release package", "Execute the rollback"], "Deployment plan", "Deployment and rollback within the window; checklist complete", "SIT", f"{IIFT_ENV} (pre-production)"),
    _n("TC-085", "Second approval level above B$300,000", "underwriter, manager", ["Submit a property financing quotation of B$400,000", "Approve as underwriter", "Approve as manager"], "POLICY_REFERRAL thresholds", "Request needs two different approvers; the first approver cannot approve the second level", "API", "Not executed in this run – PFT high-risk limit 500,000 requires an eligible participant and documents; scheduled for SIT regression"),
    _n("TC-081", "Rates re-applied at submission after a rate change", "manager, agent", ["Save a draft", "Change the product rate", "Submit"], "Rate table", "Submitted contribution uses the new rate", "API", "Not executed in this run; scheduled for SIT regression"),
    _n("TC-069", "Expired quotation cannot be submitted", "Agent", ["Backdate a draft's createdAt by 31 days", "Submit"], "policy.quotation_validity_days = 30", "422 QUOTATION_EXPIRED", "API", "Not executed – needs a backdated record; scheduled for SIT regression"),
    _n("TC-057", "Property financing with profit basis NONE", "Agent", ["Quote PFT 200,000 over 240 months"], "profitBasis NONE", "No profit loading in the sum covered", "API", "Not executed in this run; unit-tested in the financing engine"),
    _n("TC-063", "Overseas Student Tertiary plan", "Agent", ["Quote OSA TERTIARY for an eligible Brunei student"], "Tertiary 50,000", "contribution 380", "API", "Not executed in this run; unit-tested in the fixed-plan engine"),
    _n("TC-061", "Khairat renewal unavailable in the portal UI", "Agent", ["Open an active Khairat policy"], "KHR", "No Renew action", "UI", "Not executed – UI under restyling; API rule verified in EX-065"),
    _n("TC-114", "Cancellation approved sets CANCELLED", "ops.checker", ["Approve a cancellation request"], "Active policy", "Status CANCELLED from the effective date; audit entry", "API", "Not executed in this run – would cancel a demonstration policy; scheduled for SIT regression"),
    _n("TC-097", "Billing figures reconcile with the policy list", "Bank officer", ["Compare the dashboard figures with the outstanding list"], "Demonstration data", "Outstanding, overdue and due-soon totals equal the list", "UI", "Not executed – UI under restyling; screens captured earlier show the figures"),
    _n("TC-043", "Participant search in the back-office", "ops.maker", ["Search by name, number and exact ID"], "Seeded participants", "Matching records only", "UI", "Not executed – UI under restyling; API list verified in the suites"),
    _n("TC-037", "Agent search filters", "ops.maker", ["Filter agents by agency, status and type"], "Seeded agents", "Matching records only", "UI", "Not executed – UI under restyling"),
    _n("TC-019", "LDAP filter escaping", "Anonymous", ["Sign in with user name 'admin)(objectClass=*'"], "LDAP characters", "401; directory query not altered", "Security", "Not executed in this run; covered by automated check SEC-19"),
    _n("TC-168", "OWASP check script before release", "QA", ["Run tools/security/security-checks.mjs against a fresh test instance"], "29 checks", "29/29 PASS", "Security", "Executed on 2 October 2026 14:57 UTC (evidence security-checks.json); not repeated in this run"),
]
