"""Single source of truth for every commercial figure in the proposal.

build_proposal.py (Word), build_pricing.py (Excel pricing workbook and bill of
materials) and the internal commercial workbook all read from this module, so
the documents cannot disagree. Amounts are in Brunei Dollars (B$); USD figures
are indicative only.

Commercial models offered to IIFT:
  Option A  On-premise: perpetual licence + implementation, annual maintenance
            (AMC) at 22% of licence and customisation, +5% a year.
  Option B  Subscription: implementation fee + monthly subscription (+5% a year),
            hosted by iorta on cloud; cloud infrastructure on actuals and a
            separate managed services fee.
  Option C  Add-on to A (or to B at conversion): source code handover with a
            structured knowledge transfer and transition after go-live and
            hypercare.
Out-of-pocket expenses (OPE) for onsite work are charged on actuals, with the
per diem fixed, for both options.
"""

from dataclasses import dataclass

FX_BND_PER_USD = 1.30          # indicative: USD 1 = B$ 1.30
QUOTATION_VALIDITY_DAYS = 90
CONTRACT_YEARS = 5
ESCALATION = 0.05              # yearly increase on AMC, subscription, managed services and rate card
WARRANTY_MONTHS = 6
HYPERCARE_WEEKS = 4
IMPLEMENTATION_WEEKS = 24
ENHANCEMENT_HOURS_PER_YEAR = 60
WHT_POSITION = "inclusive"     # IIFT withholds and remits; iorta absorbs the tax

# ---------------------------------------------------------------------------
# One-time items, keyed by RFP section 10 item number.
# (rfp_no, key, component, basis, portal B$, back-office B$, in_amc_base, scope note)
# in_amc_base marks the licence and customisation lines that the AMC is computed on.
# ---------------------------------------------------------------------------
ONE_TIME_ITEMS = [
    (1, "licence", "SalesVerse 2.0 software licence (Agent/Banca Portal and Back-office)",
     "One-off, perpetual", 26_000, 22_000, True,
     "Perpetual, non-exclusive, non-transferable enterprise licence for IIFT. Unlimited named users; "
     "production, DR and non-production environments included. Option A only."),
    (2, "implementation", "Implementation and customisation (project management, business analysis, "
     "design, configuration, customisation, deployment)", "One-off", 36_000, 28_000, True,
     "Fixed price for the functional scope in RFP section 4 and Appendix 3, configured for IIFT's "
     "seven products, workflows, documents and reports."),
    (3, "integration", "Integration (per interface; see integration breakdown)", "Per interface",
     17_500, 13_000, True,
     "Core system, FIN, AML screening, LDAP/AD, SMS gateway and Email/SMTP."),
    (4, "migration", "Data migration", "One-off", 3_000, 4_500, False,
     "Extraction support, transformation, cleansing, two dry runs, load and reconciliation of agreed "
     "agent, agency, bank and participant data."),
    (7, "security", "Security (independent VAPT and re-test)", "One-off", 4_500, 4_000, False,
     "Independent vulnerability assessment and penetration test before go-live, remediation and re-test."),
    (8, "testing", "Testing (SIT, performance, regression, UAT support)", "One-off", 5_500, 4_500, False,
     "Test strategy, SIT cases and execution, performance test, automated regression suite, UAT support "
     "and defect fixing."),
    (9, "training", "Training", "One-off", 2_500, 2_000, False,
     "End-user, administrator and technical training including materials."),
    (10, "documentation", "Documentation", "One-off", 2_500, 2_500, False,
     "User, administrator, technical and operations manuals; maintained throughout the contract."),
]

# Integration fees per interface: (interface, scope, portal B$, back-office B$)
INTERFACES = [
    ("Core system", "Agent, agency, bank and policy master synchronisation; agent information exchange",
     4_250, 4_250),
    ("Financial system (FIN)", "End-of-day postings, receipts, commission / referral fee information, "
     "BRR reconciliation", 4_250, 4_250),
    ("AML screening service", "Participant and agent screening, result capture, re-screening", 2_500, 2_500),
    ("LDAP / Active Directory", "Single sign-on for back-office users; optional directory look-up for "
     "portal administration", 2_000, 2_000),
    ("SMS gateway", "OTP and alert delivery through IIFT-approved SMS provider", 2_500, 0),
    ("Email / SMTP relay", "Notification and document e-mail delivery through IIFT mail relay", 2_000, 0),
]

# ---------------------------------------------------------------------------
# Option A – annual maintenance (AMC)
# ---------------------------------------------------------------------------
AMC_RATE = 0.22
AMC_BILLING = "Quarterly in advance; Year 1 starts at go-live"

# (rfp_no, year, focus, description) – focus per RFP section 9
MAINTENANCE_PLAN = [
    (12, 1, "Stabilisation & Hypercare",
     "Intensive post-go-live support, defect resolution, performance tuning, monitoring and "
     "stabilisation of integrations. Includes the 6-month defect warranty."),
    (13, 2, "Operational Support",
     "BAU incident management, preventive maintenance, security patches, performance monitoring and "
     "minor enhancements."),
    (14, 3, "Optimisation",
     "System optimisation, reporting improvements, integration improvements and technology review."),
    (15, 4, "Technology Refresh",
     "Platform compatibility review, security hardening, version upgrades and capacity assessment."),
    (16, 5, "Sustainability & Transition",
     "Comprehensive health assessment, documentation refresh, knowledge transfer, technology roadmap "
     "and exit/renewal preparation."),
]

MAINTENANCE_INCLUSIONS = [
    "Helpdesk during IIFT business hours with 24x7 coverage for P1 (Critical) incidents",
    "Incident, problem and service request management against the agreed SLA",
    "Corrective and preventive maintenance; defect fixing",
    "Security patches, dependency updates and vulnerability remediation",
    "Platform and version upgrades (Node.js, PostgreSQL, frameworks) within the supported lifecycle, "
    "including SalesVerse 2.0 platform releases",
    f"{ENHANCEMENT_HOURS_PER_YEAR} hours per year of minor enhancements",
    "Monthly service report and quarterly service review",
    "Backup verification and annual DR test participation",
    "Documentation updates and ongoing knowledge transfer",
    "Exit and transition support in Year 5",
]

# ---------------------------------------------------------------------------
# Option B – subscription, hosted and managed by iorta on cloud
# ---------------------------------------------------------------------------
SUBSCRIPTION_MONTHLY_PORTAL = 1_850
SUBSCRIPTION_MONTHLY_BACKOFFICE = 1_550
SUBSCRIPTION_MINIMUM_MONTHS = 36
SUBSCRIPTION_BILLING = "Monthly in advance from go-live (quarterly in advance on request)"
SUBSCRIPTION_INCLUSIONS = [
    "Right to use SalesVerse 2.0 (Agent/Banca Portal and Back-office) for unlimited IIFT named users",
    "Everything in the Option A annual maintenance: SLA support, P1 24x7, patches, upgrades, "
    f"{ENHANCEMENT_HOURS_PER_YEAR} enhancement hours a year, monthly reports and quarterly reviews",
    "Application management: releases, configuration changes, job and integration monitoring",
    "Production, DR and UAT environments operated by iorta (infrastructure charged separately on actuals)",
    "Data export in open formats at any time and at exit; data remains IIFT's property",
]

MANAGED_SERVICES_MONTHLY = 1_100
MANAGED_SERVICES_INCLUSIONS = [
    "24x7 infrastructure and availability monitoring with alerting",
    "Operating system, container and database patching in agreed windows",
    "Backups, monthly restore tests and the annual DR drill",
    "Security monitoring: WAF, threat detection, vulnerability scanning of the cloud estate",
    "Capacity, performance and cloud cost management with a monthly report",
    "Infrastructure incident response and liaison with the cloud provider",
]

# Cloud infrastructure on actuals: (service, purpose, estimated B$ per month).
# Reference design: AWS Asia Pacific (Malaysia) or Azure Malaysia West, DR in a second region.
CLOUD_MONTHLY_ITEMS = [
    ("Container compute, 2 tasks across 2 availability zones", "Portal, back-office and API", 260),
    ("Managed PostgreSQL, Multi-AZ, 100 GB, automated backups", "Database and point-in-time recovery", 420),
    ("Application load balancer and web application firewall", "TLS termination, OWASP rules", 130),
    ("NAT gateway and data transfer", "Outbound integration and updates", 90),
    ("Object storage (encrypted) and cross-region backup copies", "Documents, backups, DR copies", 70),
    ("Logging, metrics, alarms and threat detection", "Monitoring and security", 70),
    ("Secrets and key management", "Credentials and encryption keys", 20),
    ("UAT environment, scaled down, stopped out of hours", "Non-production testing", 120),
    ("DR environment, pilot light in a second region", "Database replica and standby images", 150),
]
CLOUD_IMPLEMENTATION_MONTHLY = 300   # DEV/SIT/UAT during the project, on actuals
CLOUD_IMPLEMENTATION_MONTHS = 5

# ---------------------------------------------------------------------------
# Option C – source code handover with knowledge transfer and transition
# ---------------------------------------------------------------------------
SOURCE_CODE_LICENCE = 60_000
KNOWLEDGE_TRANSFER = 28_000
KNOWLEDGE_TRANSFER_WEEKS = 8
POST_HANDOVER_SUPPORT_RATE = 0.10    # optional platform updates and L3 support, on the AMC base
ESCROW_ANNUAL_ESTIMATE = (2_500, 4_000)

KT_PLAN = [
    # (week, activity, outcome)
    (1, "Transition plan, roles, access to repositories and pipelines", "Signed transition plan"),
    (2, "Architecture, data model and module walkthroughs", "Architecture walkthrough sign-off"),
    (3, "Code walkthroughs: sales, policy, billing and claims modules", "Module checklists"),
    (4, "Code walkthroughs: workflow, integration, reports, security", "Module checklists"),
    (5, "Build, test, CI/CD, release and database migration practice", "IIFT team produces a release"),
    (6, "Shadow support: IIFT developers observe live tickets", "Ticket log"),
    (7, "Reverse shadow: IIFT developers resolve tickets, iorta reviews", "Ticket log, code reviews"),
    (8, "Competency assessment, documentation handover, closure", "Handover certificate"),
]
SOURCE_CODE_DELIVERABLES = [
    "Full source code of SalesVerse 2.0 core and IIFT customisations in a Git repository with history",
    "Build scripts, CI/CD pipeline definitions, infrastructure and container definitions",
    "Database schema, migrations, reference data and seed scripts",
    "Automated test suites (unit, end-to-end, security checks) and test data",
    "Developer guide, architecture document, data dictionary, runbooks and coding standards",
    "Third-party component inventory and software bill of materials (SBOM)",
]

# ---------------------------------------------------------------------------
# Out-of-pocket expenses (OPE) for onsite work
# ---------------------------------------------------------------------------
PER_DIEM_USD = 50
HOTEL_PER_NIGHT = 150

# origin: (return airfare B$, travel insurance B$ per trip, airport transfers B$ per trip, visa B$)
ORIGINS = {
    "Malaysia": (500, 50, 80, 0),
    "India": (1_200, 70, 80, 40),
}


@dataclass(frozen=True)
class OnsiteTrip:
    phase: str
    role: str
    origin: str
    nights: int
    optional: bool = False

    @property
    def days(self) -> int:
        return self.nights + 1


ONSITE_PLAN = [
    OnsiteTrip("Requirements gathering and fit-gap (weeks 1–4)", "Project Manager", "Malaysia", 12),
    OnsiteTrip("Requirements gathering and fit-gap (weeks 1–4)", "Business Analyst", "Malaysia", 19),
    OnsiteTrip("Requirements gathering and fit-gap (weeks 1–4)", "Solution Architect", "India", 12),
    OnsiteTrip("User training and UAT support (weeks 19–23)", "Business Analyst / Trainer", "Malaysia", 19),
    OnsiteTrip("User training and UAT support (weeks 19–23)", "QA Lead", "India", 12),
    OnsiteTrip("Go-live and one month of support (weeks 24–28)", "Senior Developer", "India", 33),
    OnsiteTrip("Go-live and one month of support (weeks 24–28)", "Project Manager", "Malaysia", 6),
    OnsiteTrip("Knowledge transfer and source code handover (Option C)", "Solution Architect", "India", 12,
               optional=True),
    OnsiteTrip("Knowledge transfer and source code handover (Option C)", "Senior Developer", "India", 12,
               optional=True),
]

# ---------------------------------------------------------------------------
# Rate card (Year 1 rates; +5% a year)
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
     f"B$ {ONSITE_DAY_RATE:,} per day + OPE",
     "Planned onsite phases are covered by the fixed fees; only travel costs are charged as OPE."),
    (19, "After-hours support", "Per hour / Included",
     f"P1 (Critical): included; other after-hours work: B$ {AFTER_HOURS_HOUR_RATE} per hour",
     "After-hours work other than P1 is performed only on IIFT request."),
    (21, "Exit / transition", "Included",
     "Included in Year 5 maintenance or subscription",
     "Knowledge transfer, data extraction and technical handover at contract end."),
]

# ---------------------------------------------------------------------------
# Payment schedules
# ---------------------------------------------------------------------------
LICENCE_MILESTONES = [
    ("L1", "Contract signing", 0.50),
    ("L2", "Installation in the SIT environment", 0.30),
    ("L3", "Production go-live", 0.20),
]
SERVICE_MILESTONES = [
    ("M1", "Contract signing and project kick-off", 0.15),
    ("M2", "Design sign-off (BRS, FRS, SAD, TDD, UI/UX, interface specification)", 0.15),
    ("M4", "SIT exit and security clearance (VAPT remediated)", 0.25),
    ("M5", "UAT sign-off", 0.25),
    ("M6", "Production go-live", 0.15),
    ("M7", "Hypercare exit and project closure", 0.05),
]
SOURCE_CODE_MILESTONES = [
    ("C1", "Delivery of the source code repository and a verified build by IIFT", "Source code licence", 1.00),
    ("C2", "Start of knowledge transfer", "Knowledge transfer", 0.50),
    ("C3", "Handover certificate signed", "Knowledge transfer", 0.50),
]
PAYMENT_TERMS_DAYS = 30


# --- Derived figures ---------------------------------------------------------
def _item(key: str):
    return next(item for item in ONE_TIME_ITEMS if item[1] == key)


def item_total(key: str) -> int:
    item = _item(key)
    return item[4] + item[5]


def escalate(amount: float, year: int) -> int:
    """Amount for contract year `year` (1-based) after yearly escalation, rounded to B$1."""
    return round(amount * (1 + ESCALATION) ** (year - 1))


def one_time_portal(option: str = "A") -> int:
    return sum(i[4] for i in ONE_TIME_ITEMS if option == "A" or i[1] != "licence")


def one_time_backoffice(option: str = "A") -> int:
    return sum(i[5] for i in ONE_TIME_ITEMS if option == "A" or i[1] != "licence")


def one_time_total(option: str = "A") -> int:
    return one_time_portal(option) + one_time_backoffice(option)


def amc_base_portal() -> int:
    return sum(i[4] for i in ONE_TIME_ITEMS if i[6])


def amc_base_backoffice() -> int:
    return sum(i[5] for i in ONE_TIME_ITEMS if i[6])


def amc_base() -> int:
    return amc_base_portal() + amc_base_backoffice()


def amc_portal(year: int) -> int:
    return escalate(amc_base_portal() * AMC_RATE, year)


def amc_backoffice(year: int) -> int:
    return escalate(amc_base_backoffice() * AMC_RATE, year)


def amc(year: int) -> int:
    return amc_portal(year) + amc_backoffice(year)


def amc_total() -> int:
    return sum(amc(y) for y in range(1, CONTRACT_YEARS + 1))


def subscription_monthly(year: int) -> int:
    return escalate(SUBSCRIPTION_MONTHLY_PORTAL, year) + escalate(SUBSCRIPTION_MONTHLY_BACKOFFICE, year)


def subscription_annual(year: int) -> int:
    return 12 * subscription_monthly(year)


def subscription_total() -> int:
    return sum(subscription_annual(y) for y in range(1, CONTRACT_YEARS + 1))


def managed_monthly(year: int) -> int:
    return escalate(MANAGED_SERVICES_MONTHLY, year)


def managed_total() -> int:
    return sum(12 * managed_monthly(y) for y in range(1, CONTRACT_YEARS + 1))


def cloud_monthly() -> int:
    return sum(i[2] for i in CLOUD_MONTHLY_ITEMS)


def cloud_annual() -> int:
    return 12 * cloud_monthly()


def cloud_total() -> int:
    """Estimate on actuals: project-period environments plus five years of run."""
    return CLOUD_IMPLEMENTATION_MONTHLY * CLOUD_IMPLEMENTATION_MONTHS + CONTRACT_YEARS * cloud_annual()


def post_handover_support(year: int) -> int:
    return escalate(amc_base() * POST_HANDOVER_SUPPORT_RATE, year)


def option_c_total() -> int:
    return SOURCE_CODE_LICENCE + KNOWLEDGE_TRANSFER


def per_diem_bnd() -> int:
    return round(PER_DIEM_USD * FX_BND_PER_USD)


def trip_cost(trip: OnsiteTrip) -> dict:
    airfare, insurance, transfers, visa = ORIGINS[trip.origin]
    costs = {
        "airfare": airfare,
        "accommodation": trip.nights * HOTEL_PER_NIGHT,
        "per_diem": trip.days * per_diem_bnd(),
        "insurance": insurance,
        "transfers": transfers,
        "visa": visa,
    }
    costs["total"] = sum(costs.values())
    return costs


def ope_total(include_optional: bool = False) -> int:
    return sum(trip_cost(t)["total"] for t in ONSITE_PLAN if include_optional or not t.optional)


def tco_option_a(include_ope: bool = True) -> int:
    """Five-year iorta fees for Option A, plus estimated OPE. Excludes IIFT infrastructure."""
    return one_time_total("A") + amc_total() + (ope_total() if include_ope else 0)


def tco_option_b(include_ope: bool = True) -> int:
    """Five-year cost of Option B including cloud on actuals (estimate) and managed services."""
    return (one_time_total("B") + subscription_total() + managed_total() + cloud_total()
            + (ope_total() if include_ope else 0))


def usd(amount_bnd: float) -> int:
    """Indicative USD equivalent, rounded to the nearest dollar."""
    return round(amount_bnd / FX_BND_PER_USD)


def bnd(amount: float) -> str:
    return f"B$ {amount:,.0f}"


def bnd_usd(amount: float) -> str:
    return f"B$ {amount:,.0f} (USD {usd(amount):,})"


# ---------------------------------------------------------------------------
# Expected totals – a self-check so that a typo in the data above fails the build.
# ---------------------------------------------------------------------------
EXPECTED = {
    "one_time_a": 178_000,
    "one_time_b": 130_000,
    "integration_total": 30_500,
    "amc_base": 142_500,
    "amc_year1": 31_350,
    "amc_5yr": 173_229,
    "subscription_year1": 40_800,
    "subscription_5yr": 225_456,
    "managed_5yr": 72_936,
    "cloud_monthly": 1_330,
    "option_c": 88_000,
    "ope_core": 31_440,
    "ope_optional": 8_070,
}


def verify() -> None:
    """Fail loudly if any derived figure drifts from the approved pricing."""
    actual = {
        "one_time_a": one_time_total("A"),
        "one_time_b": one_time_total("B"),
        "integration_total": sum(i[2] + i[3] for i in INTERFACES),
        "amc_base": amc_base(),
        "amc_year1": amc(1),
        "amc_5yr": amc_total(),
        "subscription_year1": subscription_annual(1),
        "subscription_5yr": subscription_total(),
        "managed_5yr": managed_total(),
        "cloud_monthly": cloud_monthly(),
        "option_c": option_c_total(),
        "ope_core": ope_total(),
        "ope_optional": ope_total(include_optional=True) - ope_total(),
    }
    integration = _item("integration")
    assert integration[4] == sum(i[2] for i in INTERFACES), "Portal integration split mismatch"
    assert integration[5] == sum(i[3] for i in INTERFACES), "Back-office integration split mismatch"
    for schedule in (LICENCE_MILESTONES, SERVICE_MILESTONES):
        assert abs(sum(m[-1] for m in schedule) - 1.0) < 1e-9, "Milestones must total 100%"
    mismatches = {k: (actual[k], v) for k, v in EXPECTED.items() if actual[k] != v}
    if mismatches:
        raise AssertionError(f"Pricing mismatch (actual, expected): {mismatches}")


if __name__ == "__main__":
    for year in range(1, CONTRACT_YEARS + 1):
        print(f"Year {year}: AMC {amc(year):,}  subscription {subscription_annual(year):,}  "
              f"managed {12 * managed_monthly(year):,}  post-handover {post_handover_support(year):,}")
    for trip in ONSITE_PLAN:
        print(trip.role, trip.origin, trip.nights, trip_cost(trip))
    print("TCO A", tco_option_a(), "TCO B", tco_option_b(), "cloud total", cloud_total())
    verify()
    print("verified")
