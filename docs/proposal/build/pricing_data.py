"""Single source of truth for every commercial figure in the proposal.

Both build_proposal.py (Word) and build_pricing.py (Excel) read from this
module so that the two documents can never disagree. All amounts are in
Brunei Dollars (B$). USD figures are indicative only.
"""

FX_BND_PER_USD = 1.30          # indicative: USD 1 = B$ 1.30
QUOTATION_VALIDITY_DAYS = 90
WARRANTY_MONTHS = 6
MAINTENANCE_YEARS = 5
MAINTENANCE_ESCALATION = 0.0   # flat price for all five years
ENHANCEMENT_HOURS_PER_YEAR = 60
PLANNED_ONSITE_VISITS = 4

# ---------------------------------------------------------------------------
# One-time implementation fees, keyed by RFP section 10 item number.
# (rfp_no, component, pricing basis, portal B$, back-office B$, scope note)
# ---------------------------------------------------------------------------
ONE_TIME_ITEMS = [
    (1, "SalesVerse 2.0 software licence (Agent/Banca Portal and Back-office)", "One-off", 0, 0,
     "Bundled at B$0. Perpetual, royalty-free, enterprise-wide licence for unlimited users; "
     "source code of the deployed solution delivered. No per-user or renewal fees."),
    (2, "Implementation (project management, business analysis, design, "
        "configuration, development, deployment)", "One-off", 56_000, 44_000,
     "Fixed price for the full functional scope in RFP section 4 and Appendix 3."),
    (3, "Integration (per interface; see integration breakdown)", "Per interface",
     17_500, 13_000,
     "Core system, FIN, AML screening, LDAP/AD, SMS gateway and Email/SMTP."),
    (4, "Data migration", "One-off", 3_000, 4_500,
     "Extraction support, transformation, cleansing, two dry runs, load and "
     "reconciliation of agreed agent, agency, bank and participant data."),
    (7, "Security (independent VAPT and re-test)", "One-off", 4_500, 4_000,
     "Independent vulnerability assessment and penetration test before go-live, "
     "remediation and re-test."),
    (8, "Testing (SIT, performance, regression, UAT support)", "One-off", 5_500, 4_500,
     "Test strategy, SIT cases and execution, performance test, automated "
     "regression suite, UAT support and defect fixing."),
    (9, "Training", "One-off", 2_500, 2_000,
     "End-user, administrator and technical training including materials."),
    (10, "Documentation", "One-off", 2_500, 2_500,
     "User, administrator, technical and operations manuals; maintained "
     "throughout the contract."),
    (11, "Warranty (6 months from go-live)", "Included", 0, 0,
     "Defect correction at no charge for 6 months after go-live."),
]

# ---------------------------------------------------------------------------
# Integration fees per interface: (interface, scope, portal B$, back-office B$)
# ---------------------------------------------------------------------------
INTERFACES = [
    ("Core system", "Agent, agency, bank and policy master synchronisation; "
     "agent information exchange", 4_250, 4_250),
    ("Financial system (FIN)", "End-of-day postings, receipts, commission / "
     "referral fee information, BRR reconciliation", 4_250, 4_250),
    ("AML screening service", "Participant and agent screening, result capture, "
     "re-screening", 2_500, 2_500),
    ("LDAP / Active Directory", "Single sign-on for back-office users; optional "
     "directory look-up for portal administration", 2_000, 2_000),
    ("SMS gateway", "OTP and alert delivery through IIFT-approved SMS provider",
     2_500, 0),
    ("Email / SMTP relay", "Notification and document e-mail delivery through "
     "IIFT mail relay", 2_000, 0),
]

# ---------------------------------------------------------------------------
# Maintenance and support (annual, flat for five years)
# ---------------------------------------------------------------------------
MAINTENANCE_ANNUAL_PORTAL = 11_900
MAINTENANCE_ANNUAL_BACKOFFICE = 9_700

# (rfp_no, year, focus, description) – focus per RFP section 9
MAINTENANCE_PLAN = [
    (12, 1, "Stabilisation & Hypercare",
     "Intensive post-go-live support, defect resolution, performance tuning, "
     "monitoring and stabilisation of integrations."),
    (13, 2, "Operational Support",
     "BAU incident management, preventive maintenance, security patches, "
     "performance monitoring and minor enhancements."),
    (14, 3, "Optimisation",
     "System optimisation, reporting improvements, integration improvements "
     "and technology review."),
    (15, 4, "Technology Refresh",
     "Platform compatibility review, security hardening, version upgrades and "
     "capacity assessment."),
    (16, 5, "Sustainability & Transition",
     "Comprehensive health assessment, documentation refresh, knowledge "
     "transfer, technology roadmap and exit/renewal preparation."),
]

MAINTENANCE_INCLUSIONS = [
    "Helpdesk during IIFT business hours with 24x7 coverage for P1 (Critical) incidents",
    "Incident, problem and service request management against the agreed SLA",
    "Corrective and preventive maintenance; defect fixing",
    "Security patches, dependency updates and vulnerability remediation",
    "Platform and version upgrades (Node.js, PostgreSQL, frameworks) within the supported lifecycle, "
    "including SalesVerse 2.0 platform updates",
    f"{ENHANCEMENT_HOURS_PER_YEAR} hours per year of minor enhancements",
    "Monthly service report and quarterly service review",
    "Backup verification and annual DR test participation",
    "Documentation updates and ongoing knowledge transfer",
    "Exit and transition support in Year 5",
]

# ---------------------------------------------------------------------------
# Optional cloud hosting (pass-through, indicative)
# (service, purpose, B$ per month)
# ---------------------------------------------------------------------------
CLOUD_MONTHLY_ITEMS = [
    ("Container compute (2 tasks across 2 availability zones)", "Portal, back-office and API", 180),
    ("Managed PostgreSQL, Multi-AZ, with storage and automated backups", "Database and PITR", 330),
    ("Application load balancer and web application firewall", "TLS termination, OWASP rules", 120),
    ("NAT gateway and data transfer", "Outbound integration and updates", 120),
    ("Object storage (SSE-KMS) and cross-region snapshot copy", "Documents, backups, DR copies", 60),
    ("Logging, metrics and alarms", "Monitoring and alerting", 60),
    ("Secrets and key management", "Credentials and encryption keys", 20),
    ("Scaled-down UAT environment", "Non-production testing", 60),
]
CLOUD_MANAGED_OPERATIONS_ANNUAL = 4_800

# ---------------------------------------------------------------------------
# Rate card (rfp_no, item, basis, rate text)
# ---------------------------------------------------------------------------
ENHANCEMENT_DAY_RATE = 680
ENHANCEMENT_HOUR_RATE = 90
ONSITE_DAY_RATE = 850
AFTER_HOURS_HOUR_RATE = 120

RATE_CARD = [
    (17, "Enhancements and change requests", "Per man-day / per hour",
     f"B$ {ENHANCEMENT_DAY_RATE:,} per man-day; B$ {ENHANCEMENT_HOUR_RATE} per hour",
     "Blended rate for all roles; quoted per change request after impact assessment."),
    (18, "Onsite support (unplanned visits)", "Per day",
     f"B$ {ONSITE_DAY_RATE:,} per day + travel at cost",
     f"{PLANNED_ONSITE_VISITS} planned visits are already included in the fixed price."),
    (19, "After-hours support", "Per hour / Included",
     f"P1 (Critical): included; other after-hours work: B$ {AFTER_HOURS_HOUR_RATE} per hour",
     "After-hours work other than P1 is performed only on IIFT request."),
    (21, "Exit / transition", "Included",
     "Included in Year 5 maintenance",
     "Knowledge transfer, data extraction and technical handover at contract end."),
]

# ---------------------------------------------------------------------------
# Third-party charges – excluded from iorta fees, payable at cost
# (item, basis, typical provider / note)
# ---------------------------------------------------------------------------
THIRD_PARTY_CHARGES = [
    # (item, basis, provider / note, indicative amount – to be confirmed by the provider)
    ("SMS messages", "Per message", "IIFT-approved SMS gateway or telco tariff",
     "About B$0.05–0.10 per SMS; roughly B$300–600 a year at expected volumes"),
    ("AML screening data subscription", "Annual / usage", "IIFT's existing or chosen screening list provider",
     "B$0 if IIFT's existing service is reused; otherwise from about B$3,000 a year"),
    ("SSL/TLS certificates", "Annual", "IIFT-approved certificate authority",
     "About B$150–500 a year per certificate"),
    ("Email relay service", "Annual / usage", "IIFT/IITH mail infrastructure",
     "B$0 with the existing IITH relay"),
    ("Servers, storage, network and OS licences (on-premise)", "One-off / annual", "IIFT/IITH data centre",
     "Per IITH standard; Linux subscriptions about B$500–1,200 per server a year if RHEL is used, B$0 for Ubuntu"),
    ("Cloud hosting (if Option B is chosen)", "Monthly", "Cloud provider, passed through at cost",
     f"About B${12 * sum(i[2] for i in CLOUD_MONTHLY_ITEMS):,} a year"),
    ("Optional commercial PostgreSQL support", "Annual", "Only if IIFT elects vendor-backed database support",
     "About B$5,000–10,000 a year"),
    ("Optional PKI digital signature certificates", "Per certificate / annual",
     "Only if certificate-based signing is required in future", "Quoted by the certificate authority"),
]

# ---------------------------------------------------------------------------
# Payment milestones on the one-time fee: (milestone, trigger, share)
# ---------------------------------------------------------------------------
PAYMENT_MILESTONES = [
    ("M1", "Contract signing and project kick-off", 0.15),
    ("M2", "Design sign-off (BRS, FRS, SAD, TDD, UI/UX, interface specification)", 0.15),
    ("M4", "SIT exit and security clearance (VAPT remediated)", 0.25),
    ("M5", "UAT sign-off", 0.25),
    ("M6", "Production go-live", 0.15),
    ("M7", "Hypercare exit and project closure", 0.05),
]
MAINTENANCE_BILLING = "Quarterly in advance, from go-live"

# ---------------------------------------------------------------------------
# Expected totals from the approved pricing brief – used as a self-check.
# ---------------------------------------------------------------------------
EXPECTED = {
    "one_time_portal": 91_500,
    "one_time_backoffice": 74_500,
    "one_time_total": 166_000,
    "integration_total": 30_500,
    "maintenance_annual": 21_600,
    "maintenance_5yr": 108_000,
    "cloud_annual": 11_400,
    "tco_5yr_on_prem": 274_000,
}


# --- Derived figures ---------------------------------------------------------
def one_time_portal() -> int:
    return sum(item[3] for item in ONE_TIME_ITEMS)


def one_time_backoffice() -> int:
    return sum(item[4] for item in ONE_TIME_ITEMS)


def one_time_total() -> int:
    return one_time_portal() + one_time_backoffice()


def integration_portal() -> int:
    return sum(i[2] for i in INTERFACES)


def integration_backoffice() -> int:
    return sum(i[3] for i in INTERFACES)


def maintenance_annual() -> int:
    return MAINTENANCE_ANNUAL_PORTAL + MAINTENANCE_ANNUAL_BACKOFFICE


def maintenance_total() -> int:
    return maintenance_annual() * MAINTENANCE_YEARS


def cloud_annual() -> int:
    return 12 * sum(i[2] for i in CLOUD_MONTHLY_ITEMS)


def cloud_monthly() -> int:
    return sum(i[2] for i in CLOUD_MONTHLY_ITEMS)


def tco_on_prem() -> int:
    return one_time_total() + maintenance_total()


def tco_cloud() -> int:
    return tco_on_prem() + MAINTENANCE_YEARS * (cloud_annual() + CLOUD_MANAGED_OPERATIONS_ANNUAL)


def usd(amount_bnd: float) -> int:
    """Indicative USD equivalent, rounded to the nearest dollar."""
    return round(amount_bnd / FX_BND_PER_USD)


def bnd(amount: float) -> str:
    return f"B$ {amount:,.0f}"


def bnd_usd(amount: float) -> str:
    return f"B$ {amount:,.0f} (USD {usd(amount):,})"


def verify() -> None:
    """Fail loudly if any derived figure drifts from the approved pricing."""
    actual = {
        "one_time_portal": one_time_portal(),
        "one_time_backoffice": one_time_backoffice(),
        "one_time_total": one_time_total(),
        "integration_total": integration_portal() + integration_backoffice(),
        "maintenance_annual": maintenance_annual(),
        "maintenance_5yr": maintenance_total(),
        "cloud_annual": cloud_annual(),
        "tco_5yr_on_prem": tco_on_prem(),
    }
    integration_item = next(i for i in ONE_TIME_ITEMS if i[0] == 3)
    assert integration_item[3] == integration_portal(), "Portal integration split mismatch"
    assert integration_item[4] == integration_backoffice(), "Back-office integration split mismatch"
    assert abs(sum(m[2] for m in PAYMENT_MILESTONES) - 1.0) < 1e-9, "Milestones must total 100%"
    mismatches = {k: (actual[k], v) for k, v in EXPECTED.items() if actual[k] != v}
    if mismatches:
        raise AssertionError(f"Pricing mismatch (actual, expected): {mismatches}")


def rfp_section10_rows() -> list:
    """All 21 items of RFP section 10 in RFP order.

    Each row is a dict with: no, component, basis, portal, backoffice
    (numbers, or None when the item is not a fixed amount), text (shown
    instead of amounts when they are None), remark and category
    ("one-time", "annual" or "rate").
    """
    one_time = {item[0]: item for item in ONE_TIME_ITEMS}
    maintenance = {m[0]: m for m in MAINTENANCE_PLAN}
    rates = {r[0]: r for r in RATE_CARD}
    rows = []
    for no in range(1, 22):
        if no in one_time:
            _, component, basis, portal, backoffice, remark = one_time[no]
            rows.append(dict(no=no, component=component, basis=basis, portal=portal,
                             backoffice=backoffice, text=None, remark=remark,
                             category="one-time"))
        elif no in maintenance:
            _, year, focus, description = maintenance[no]
            rows.append(dict(no=no, component=f"Year {year} maintenance: {focus}",
                             basis="Annual", portal=MAINTENANCE_ANNUAL_PORTAL,
                             backoffice=MAINTENANCE_ANNUAL_BACKOFFICE, text=None,
                             remark=description, category="annual"))
        elif no in rates:
            _, component, basis, rate_text, remark = rates[no]
            rows.append(dict(no=no, component=component, basis=basis, portal=None,
                             backoffice=None, text=rate_text, remark=remark,
                             category="rate"))
        elif no == 5:
            rows.append(dict(
                no=5, component="Infrastructure / cloud", basis="Annual",
                portal=None, backoffice=None,
                text="On-premise (recommended): B$ 0, IIFT/IITH-provided",
                remark=(f"Optional cloud hosting: approx. {bnd(cloud_annual())} per year "
                        f"pass-through plus {bnd(CLOUD_MANAGED_OPERATIONS_ANNUAL)} per year "
                        "managed cloud operations. Not included in totals."),
                category="rate"))
        elif no == 6:
            rows.append(dict(
                no=6, component="Database", basis="Annual", portal=None, backoffice=None,
                text="B$ 0: PostgreSQL community edition, no licence fee",
                remark="Optional commercial PostgreSQL support available at cost if IIFT requires it.",
                category="rate"))
        elif no == 20:
            rows.append(dict(
                no=20, component="Third-party charges", basis="Annual / usage",
                portal=None, backoffice=None, text="Excluded; payable at cost",
                remark="SMS messages, AML data subscription, SSL certificates, email relay; "
                       "see third-party schedule.",
                category="rate"))
    return rows
