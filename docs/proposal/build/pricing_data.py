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
from decimal import ROUND_HALF_UP, Decimal

FX_BND_PER_USD = 1.30          # indicative: USD 1 = B$ 1.30
QUOTATION_VALIDITY_DAYS = 90
CONTRACT_YEARS = 5
ESCALATION = 0.05              # yearly increase on AMC, subscription, managed services and rate card
WARRANTY_MONTHS = 6
HYPERCARE_WEEKS = 4
IMPLEMENTATION_WEEKS = 24
ENHANCEMENT_HOURS_PER_YEAR = 60
WHT_POSITION = "inclusive"     # IIFT withholds and remits; iorta absorbs the tax on fees
# Cloud infrastructure and OPE are recharged at cost as disbursements (provider and travel
# invoices attached), outside the fees that WHT applies to; IIFT may instead hold the cloud
# account in its own name and pay the provider directly.
RECHARGE_BASIS = "disbursement"

# ---------------------------------------------------------------------------
# One-time items, keyed by RFP section 10 item number.
# (rfp_no, key, component, basis, portal B$, back-office B$, in_amc_base, scope note)
# in_amc_base marks the licence and customisation lines that the AMC is computed on.
# ---------------------------------------------------------------------------
ONE_TIME_ITEMS = [
    (1, "licence", "SalesVerse 2.0 software licence (Agent/Banca Portal and Back-office)",
     "One-off, perpetual", 32_500, 27_500, True,
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
SUBSCRIPTION_MINIMUM_MONTHS = 60
SUBSCRIPTION_BILLING = "Monthly in advance from go-live (quarterly in advance on request)"
SUBSCRIPTION_INCLUSIONS = [
    "Right to use SalesVerse 2.0 (Agent/Banca Portal and Back-office) for unlimited IIFT named users",
    "Everything in the Option A annual maintenance: SLA support, P1 24x7, patches, upgrades, "
    f"{ENHANCEMENT_HOURS_PER_YEAR} enhancement hours a year, monthly reports and quarterly reviews",
    "Application management: releases, configuration changes, job and integration monitoring",
    "Production, DR and UAT environments operated by iorta (infrastructure charged separately on actuals)",
    "Data export in open formats at any time and at exit; data remains IIFT's property",
]

# One-time set-up of the cloud landing zone, environments, monitoring, backups and DR for
# Option B (RFP item 5, one-off). Payable at contract signing; not part of the AMC base.
CLOUD_SETUP_FEE = 15_000

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
    """Amount for contract year `year` (1-based) after yearly escalation, rounded to B$1.

    Half-cents round up, as a calculator or spreadsheet would, so the printed
    figures can be checked by hand.
    """
    value = Decimal(str(amount)) * (1 + Decimal(str(ESCALATION))) ** (year - 1)
    return int(value.quantize(Decimal("1"), rounding=ROUND_HALF_UP))


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
    return (one_time_total("B") + CLOUD_SETUP_FEE + subscription_total() + managed_total()
            + cloud_total() + (ope_total() if include_ope else 0))


def usd(amount_bnd: float) -> int:
    """Indicative USD equivalent, rounded to the nearest dollar."""
    return round(amount_bnd / FX_BND_PER_USD)


def bnd(amount: float) -> str:
    return f"B$ {amount:,.0f}"


def bnd_usd(amount: float) -> str:
    return f"B$ {amount:,.0f} (USD {usd(amount):,})"


# ===========================================================================
# Additions used by the commercial chapter, the pricing workbook and the bill
# of materials. They add descriptive data and derived views only; none of the
# approved prices above is changed.
# ===========================================================================
OPTION_TITLES = {
    "A": "Option A – On-premise perpetual licence",
    "B": "Option B – Subscription, hosted and managed by iorta",
    "C": "Option C – Source code handover (add-on)",
}
SUBSCRIPTION_TERM_MONTHS = 60          # prices quoted for a 60-month term
OPE_TOLERANCE = 0.10                   # OPE may not exceed the estimate by more than 10% without approval
PRICE_INCREASE_CAP = ESCALATION        # COM-18: yearly increase capped at 5%
GO_LIVE_WEEK = IMPLEMENTATION_WEEKS
KT_START_WEEK = IMPLEMENTATION_WEEKS + HYPERCARE_WEEKS + 1   # earliest start of Option C knowledge transfer
CLOUD_REGION = "AWS Asia Pacific (Malaysia) or Azure Malaysia West"
CLOUD_DR_REGION = "a second region approved by IIFT (the reference regions are AWS Asia Pacific (Malaysia) and Azure Malaysia West)"


def option_b_one_time() -> int:
    """All one-time iorta fees under Option B: services plus the cloud set-up fee."""
    return one_time_total("B") + CLOUD_SETUP_FEE


def licence_fee(module: str = "total") -> int:
    item = _item("licence")
    return {"portal": item[4], "backoffice": item[5], "total": item[4] + item[5]}[module]


def services_fee(module: str = "total") -> int:
    """One-time services (everything except the licence) – identical under Options A and B."""
    return {"portal": one_time_portal("B"), "backoffice": one_time_backoffice("B"),
            "total": one_time_total("B")}[module]


def integration_portal() -> int:
    return sum(i[2] for i in INTERFACES)


def integration_backoffice() -> int:
    return sum(i[3] for i in INTERFACES)


def subscription_monthly_portal(year: int) -> int:
    return escalate(SUBSCRIPTION_MONTHLY_PORTAL, year)


def subscription_monthly_backoffice(year: int) -> int:
    return escalate(SUBSCRIPTION_MONTHLY_BACKOFFICE, year)


def subscription_minimum_commitment() -> int:
    """Subscription value of the minimum term."""
    return sum(subscription_annual(y) for y in range(1, SUBSCRIPTION_MINIMUM_MONTHS // 12 + 1))


def post_handover_total() -> int:
    return sum(post_handover_support(y) for y in range(1, CONTRACT_YEARS + 1))


def rate(amount: float, year: int) -> int:
    """Rate card value in contract year `year`."""
    return escalate(amount, year)


def ope_trip_rows(include_optional: bool = True) -> list:
    """[(trip, costs dict)] for the onsite plan."""
    return [(t, trip_cost(t)) for t in ONSITE_PLAN if include_optional or not t.optional]


def ope_by_phase(include_optional: bool = True) -> list:
    """[(phase, trips, nights, total B$, optional)] in plan order."""
    phases = []
    for trip in ONSITE_PLAN:
        if trip.optional and not include_optional:
            continue
        if not phases or phases[-1][0] != trip.phase:
            phases.append([trip.phase, 0, 0, 0, trip.optional])
        phases[-1][1] += 1
        phases[-1][2] += trip.nights
        phases[-1][3] += trip_cost(trip)["total"]
    return [tuple(p) for p in phases]


def milestone_amounts(schedule, base: int) -> list:
    """[(code, trigger, share, amount)] for a payment schedule applied to `base`."""
    return [(m[0], m[1], m[-1], round(base * m[-1])) for m in schedule]


def source_code_milestone_amounts() -> list:
    bases = {"Source code licence": SOURCE_CODE_LICENCE, "Knowledge transfer": KNOWLEDGE_TRANSFER}
    return [(code, trigger, component, share, round(bases[component] * share))
            for code, trigger, component, share in SOURCE_CODE_MILESTONES]


def five_year_view(option: str) -> dict:
    """Year 0 (implementation) and Years 1–5 cash view of iorta fees, OPE and pass-through estimates."""
    years = {}
    if option == "A":
        years[0] = {"one_time": one_time_total("A"), "recurring": 0, "managed": 0, "ope": ope_total(), "cloud": 0}
        for y in range(1, CONTRACT_YEARS + 1):
            years[y] = {"one_time": 0, "recurring": amc(y), "managed": 0, "ope": 0, "cloud": 0}
    else:
        years[0] = {"one_time": option_b_one_time(), "recurring": 0, "managed": 0, "ope": ope_total(),
                    "cloud": CLOUD_IMPLEMENTATION_MONTHLY * CLOUD_IMPLEMENTATION_MONTHS}
        for y in range(1, CONTRACT_YEARS + 1):
            years[y] = {"one_time": 0, "recurring": subscription_annual(y), "managed": 12 * managed_monthly(y),
                        "ope": 0, "cloud": cloud_annual()}
    for values in years.values():
        values["total"] = sum(values.values())
    return years


def rfp_section10_rows(option: str) -> list:
    """All 21 items of RFP section 10 for Option "A" or "B", in RFP order.

    Each row: no, component, basis, portal, backoffice (numbers, or None when the
    item is not a fixed amount), amount (portal + back-office or None), text
    (shown when amount is None), remark and category ("one-time", "recurring",
    "rate", "pass-through", "included").
    """
    one_time = {item[0]: item for item in ONE_TIME_ITEMS}
    maintenance = {m[0]: m for m in MAINTENANCE_PLAN}
    rates = {r[0]: r for r in RATE_CARD}
    tp_low, tp_high = third_party_annual(option)
    rows = []

    def add(no, component, basis, portal=None, backoffice=None, text=None, remark="", category="rate",
            amount=None):
        if amount is None and portal is not None:
            amount = portal + backoffice
        rows.append(dict(no=no, component=component, basis=basis, portal=portal, backoffice=backoffice,
                         amount=amount, text=text, remark=remark, category=category))

    for no in range(1, 22):
        if no == 1:
            if option == "A":
                item = one_time[1]
                add(1, "Software licence (Agent/Banca Portal and Back-office)", "One-off, perpetual", item[4],
                    item[5], remark=item[7], category="one-time")
            else:
                add(1, "Software licence (Agent/Banca Portal and Back-office)", "Subscription",
                    text="Included in subscription",
                    remark="Right to use for unlimited IIFT named users during the subscription term "
                           "(items 12–16). Conversion to a perpetual licence is available.", category="included")
        elif no in one_time:
            _, _, component, basis, portal, backoffice, _, note = one_time[no]
            add(no, component, basis, portal, backoffice, remark=note, category="one-time")
        elif no == 5:
            if option == "A":
                low, high = bom_onprem_totals()
                add(5, "Infrastructure / cloud", "Annual", text="IIFT procures (BOM); B$0 from iorta",
                    remark=f"Servers or VMs, OS, storage, network and DR site to iorta's sizing. Indicative "
                           f"{bnd(low)}–{high:,} one-time if provisioned new (IIFT's own procurement).",
                    category="pass-through")
            else:
                add(5, "Infrastructure / cloud", "One-off / monthly",
                    text=f"Cloud set-up {bnd(CLOUD_SETUP_FEE)} one-off; managed services "
                         f"{bnd(12 * managed_monthly(1))} a year (Year 1); cloud at cost ≈ {bnd(cloud_annual())} a year",
                    remark=f"One-off cloud set-up (landing zone, PROD/DR/UAT environments, monitoring, backups, DR) "
                           f"payable at contract signing. Managed services B$ {MANAGED_SERVICES_MONTHLY:,} a month in "
                           f"Year 1, +5% a year. Cloud infrastructure ({CLOUD_REGION}) recharged at cost as a "
                           "disbursement, or paid by IIFT directly.",
                    category="one-time", amount=CLOUD_SETUP_FEE)
        elif no == 6:
            if option == "A":
                add(6, "Database", "Annual", text="B$0 – PostgreSQL 16, no licence fee",
                    remark="Open-source PostgreSQL licence. Database support is part of the AMC; optional "
                           "commercial PostgreSQL support is listed in the BOM.", category="included")
            else:
                add(6, "Database", "Annual", text="In cloud actuals; support in managed services",
                    remark="Managed PostgreSQL (Multi-AZ) is part of the cloud infrastructure on actuals.",
                    category="included")
        elif no == 11:
            add(11, "Warranty", "Included", text=f"Included – {WARRANTY_MONTHS} months",
                remark=f"Defect correction at no charge for {WARRANTY_MONTHS} months from production go-live.",
                category="included")
        elif no in maintenance:
            _, year, focus, description = maintenance[no]
            if option == "A":
                add(no, f"Year {year} maintenance (AMC): {focus}", "Annual", amc_portal(year), amc_backoffice(year),
                    remark=description, category="recurring")
            else:
                add(no, f"Year {year} subscription: {focus}", "Monthly",
                    12 * subscription_monthly_portal(year), 12 * subscription_monthly_backoffice(year),
                    remark=f"{description} Included in the subscription with application management.",
                    category="recurring")
        elif no in rates:
            _, component, basis, rate_text, remark = rates[no]
            if no == 21:
                rate_text = ("Included in Year 5 AMC" if option == "A"
                             else "Included in the subscription (end of term)")
                remark = remark + " Core source code handover is Option C."
            add(no, component, basis, text=rate_text, remark=remark + (" Rates rise 5% a year." if no in (17, 18, 19)
                                                                       else ""))
        elif no == 20:
            add(20, "Third-party charges", "Annual / usage", text="Excluded – see Bill of Materials",
                remark=f"SMS messages, AML data service, SSL certificates, e-mail relay: indicative "
                       f"{bnd(tp_low)}–{tp_high:,} a year, paid by IIFT or passed through at cost.",
                category="pass-through")
    return rows


# ---------------------------------------------------------------------------
# Bill of materials
# ---------------------------------------------------------------------------
# On-premise servers for Option A, procured by IIFT. Sizing is identical to the
# Solution Architecture (docs/technical/build/sad_part2.py, "On-premise sizing");
# build_bom.py checks that the two agree.
# (group, server, qty text, qty number, vCPU, RAM text, storage text, software, os_vm,
#  indicative one-time cost per unit B$ (low, high), note)
ON_PREM_BOM = [
    ("Production", "WAF / load balancer", "2 (or existing)", 2, "2", "4 GB", "–",
     "IITH appliance or HAProxy/nginx pair", False, (0, 1_000),
     "B$0 where the IITH WAF / F5 is reused (recommended)"),
    ("Production", "Application VM", "2", 2, "4", "8 GB", "100 GB",
     "Linux, Docker Engine; web, api, clamav containers", True, (1_500, 3_000), ""),
    ("Production", "Database VM", "2", 2, "4", "16 GB", "200 GB SSD",
     "PostgreSQL 16 primary and hot standby, pgBackRest", True, (2_500, 4_500), ""),
    ("Production", "Document store", "1 share", 1, "–", "–", "500 GB",
     "NFS export, encrypted volume", False, (1_000, 2_000), ""),
    ("Production", "Backup repository", "1", 1, "–", "–", "1 TB",
     "pgBackRest repository, document backups", False, (1_500, 3_000),
     "Lower where IITH backup capacity is reused"),
    ("Production", "Monitoring", "1 (or existing)", 1, "2", "4 GB", "100 GB",
     "Prometheus, Grafana, log collector", True, (0, 1_500), "B$0 where IITH monitoring is reused"),
    ("Non-production", "SIT", "1", 1, "4", "16 GB", "200 GB",
     "Compose: web, api, clamav, PostgreSQL", True, (2_000, 3_500), ""),
    ("Non-production", "UAT", "1", 1, "4", "16 GB", "200 GB",
     "Compose: web, api, clamav, PostgreSQL", True, (2_000, 3_500), ""),
    ("Non-production", "DEV", "Not required", 0, "–", "–", "–",
     "Hosted by iorta during the project and support", False, (0, 0), "No IIFT infrastructure needed"),
    ("DR site", "Application VM", "1", 1, "4", "8 GB", "100 GB",
     "Cold standby, same images", True, (1_500, 3_000), ""),
    ("DR site", "Database VM", "1", 1, "4", "16 GB", "200 GB SSD",
     "Asynchronous replica", True, (2_500, 4_500), ""),
    ("DR site", "Document and backup copies", "–", 1, "–", "–", "500 GB + 1 TB",
     "rsync target, backup copy", False, (2_000, 4_000), ""),
]
RHEL_PER_VM_YEAR = (500, 1_200)        # optional: only if IIFT standardises on RHEL instead of Ubuntu LTS
PG_SUPPORT_YEAR = (5_000, 10_000)      # optional commercial PostgreSQL support


def os_vm_count() -> int:
    return sum(row[3] for row in ON_PREM_BOM if row[8])


def bom_onprem_totals() -> tuple:
    """Indicative one-time cost (low, high) of the Option A infrastructure, IIFT's own procurement."""
    low = sum(row[3] * row[9][0] for row in ON_PREM_BOM)
    high = sum(row[3] * row[9][1] for row in ON_PREM_BOM)
    return low, high


def rhel_annual() -> tuple:
    return os_vm_count() * RHEL_PER_VM_YEAR[0], os_vm_count() * RHEL_PER_VM_YEAR[1]


# Cloud sizing per CLOUD_MONTHLY_ITEMS line (same order), from the Solution Architecture cloud sizing.
CLOUD_SIZING = [
    "2 tasks × (1 vCPU, 2 GB) incl. ClamAV sidecar; scales to 4 tasks",
    "db.t4g.large (2 vCPU, 8 GB), Multi-AZ, 100 GB gp3, 35-day backups and PITR",
    "1 load balancer; WAF with managed OWASP rule sets; managed TLS certificate",
    "NAT gateway, site-to-site VPN to the IITH data centre, outbound data",
    "Shared file storage up to 100 GB; about 200 GB object storage; cross-region copy",
    "Log retention 90 days, metrics, alarms, threat detection",
    "Secrets store and customer-managed encryption keys",
    "1 task and a single-AZ db.t4g.medium; stopped outside test periods",
    "Cross-region database replica or snapshots and standby images",
]
CLOUD_BILLING_BASIS = "At cost as a disbursement (provider invoice attached, no mark-up), or paid by IIFT directly"

# Paid and optional third-party items.
# (item, basis, Option A treatment, Option B treatment, indicative B$ a year (low, high),
#  required, note)
INCLUDED = "Included in iorta fee"
PASS_THROUGH = "Pass-through at cost"
IIFT_PROCURES = "IIFT procures"
NOT_REQUIRED = "Not required"
THIRD_PARTY_ITEMS = [
    ("SSL/TLS certificates", "Annual, per certificate", IIFT_PROCURES, PASS_THROUGH, (300, 1_000), True,
     "Two public certificates (portal, e-signature link) at about B$150–500 each; internal certificates from the "
     "IITH CA. Under Option B the load-balancer certificate is issued by the cloud provider at no charge."),
    ("SMS gateway", "Per message", IIFT_PROCURES, IIFT_PROCURES, (300, 600), True,
     "IIFT's SMS provider account; about B$0.05–0.10 per message, roughly 6,000 OTP and alert messages a year."),
    ("AML screening data / service", "Annual or per search", IIFT_PROCURES, IIFT_PROCURES, (0, 3_000), True,
     "B$0 if IIFT's existing screening service or lists are reused; otherwise from about B$3,000 a year."),
    ("E-mail relay", "Usage", IIFT_PROCURES, IIFT_PROCURES, (0, 120), True,
     "B$0 through the IITH relay (over the VPN under Option B); a cloud e-mail service costs under B$10 a month."),
    ("Commercial PostgreSQL support (EDB or similar)", "Annual", IIFT_PROCURES, NOT_REQUIRED, PG_SUPPORT_YEAR,
     False, "Optional. Database support is already part of the AMC; vendor support only if IIFT policy requires "
            "it. Under Option B the managed database is supported by the cloud provider."),
    ("Red Hat Enterprise Linux subscriptions", "Annual, per VM", IIFT_PROCURES, NOT_REQUIRED, None, False,
     "Optional. Ubuntu Server 24.04 LTS carries no licence fee; RHEL about B$500–1,200 per VM a year if IIFT "
     "standardises on it."),
    ("Source code escrow agent", "Annual", PASS_THROUGH, PASS_THROUGH, ESCROW_ANNUAL_ESTIMATE, False,
     "Optional alternative to Option C. Agent fees payable by IIFT at cost; iorta's deposits are included."),
    ("Independent VAPT and re-test", "One-off", INCLUDED, INCLUDED, (0, 0), True,
     "Pre-go-live test and re-test included in item 7. Later annual tests can be quoted on request."),
    ("Backup software", "–", IIFT_PROCURES, PASS_THROUGH, (0, 0), True,
     "Option A: IITH backup platform reused; pgBackRest (open source) for PostgreSQL. Option B: cloud backup "
     "services within the cloud actuals."),
    ("SIEM / security monitoring", "–", IIFT_PROCURES, PASS_THROUGH, (0, 0), True,
     "Option A: IITH SIEM reused; iorta configures log forwarding. Option B: cloud threat detection within the "
     "cloud actuals; forwarding to the IITH SIEM on request."),
    ("Virtualisation, network, firewall, DNS", "–", IIFT_PROCURES, IIFT_PROCURES, (0, 0), True,
     "Existing IITH platforms. Under Option B only the IITH VPN endpoint and DNS entries are needed."),
    ("Source code repository and CI/CD", "–", INCLUDED, INCLUDED, (0, 0), True,
     "iorta's repository and pipeline during the contract, mirrored to IITH GitLab if required."),
    ("Monitoring stack (Prometheus, Grafana, Loki)", "–", INCLUDED, INCLUDED, (0, 0), True,
     "Open source; set up by iorta. IITH monitoring tools can be used instead."),
    ("PKI digital signature certificates", "–", NOT_REQUIRED, NOT_REQUIRED, (0, 0), False,
     "Not required: the solution's e-signature captures consent with an audit record. Can be added later."),
    ("Payment gateway", "–", NOT_REQUIRED, NOT_REQUIRED, (0, 0), False,
     "Not required: payments are recorded and verified in the back-office. Can be added later."),
]


def third_party_cost(item) -> tuple:
    """Indicative annual (low, high) cost of a THIRD_PARTY_ITEMS row."""
    return rhel_annual() if item[4] is None else item[4]


def third_party_annual(option: str, optional: bool = False) -> tuple:
    """Indicative annual third-party cost (low, high) paid by IIFT or passed through, for an option.

    optional=False sums the required items; optional=True sums only the optional ones.
    """
    column = 2 if option == "A" else 3
    low = high = 0
    for item in THIRD_PARTY_ITEMS:
        is_optional = not item[5]
        if is_optional == optional and item[column] in (IIFT_PROCURES, PASS_THROUGH):
            costs = third_party_cost(item)
            if option == "B" and item[0].startswith("SSL"):
                costs = (0, 0)       # provider-issued certificate on the cloud load balancer
            low, high = low + costs[0], high + costs[1]
    return low, high


# Runtime software components of the solution with their licences. Licence fee is B$0 for all.
# (component, version, role, licence)
SOFTWARE_COMPONENTS = [
    ("Node.js", "22 LTS", "API runtime (inside the container image)", "MIT"),
    ("NestJS", "12", "API framework", "MIT"),
    ("Prisma ORM and PostgreSQL driver adapter", "7", "Data access and migrations", "Apache-2.0"),
    ("React and React DOM", "19", "Portal and back-office user interface", "MIT"),
    ("Ant Design and Ant Design Icons", "6", "UI component library", "MIT"),
    ("TanStack Query, React Router, Recharts, Day.js", "5 / 7 / 3 / 1", "UI data, routing, charts, dates", "MIT"),
    ("pdfkit, exceljs", "0.20 / 4.4", "PDF documents and Excel reports", "MIT"),
    ("Argon2 (@node-rs/argon2), helmet, express-session", "2 / 8 / 1", "Password hashing, security headers, "
     "sessions", "MIT"),
    ("pino, prom-client", "10 / 15", "Structured logs and metrics", "MIT / Apache-2.0"),
    ("ldapts, nodemailer", "9 / 10", "Active Directory and e-mail integration", "MIT / MIT-0"),
    ("PostgreSQL", "16", "Database", "PostgreSQL Licence"),
    ("pgBackRest", "2", "Database backup and point-in-time recovery", "MIT"),
    ("nginx (unprivileged image)", "1.29", "Web server for the user interface", "BSD-2-Clause"),
    ("ClamAV", "stable", "Malware scan of uploaded documents (separate container)", "GPL-2.0"),
    ("Docker Engine, containerd", "27+ / 1.7+", "Container runtime", "Apache-2.0"),
    ("Linux operating system", "Ubuntu Server 24.04 LTS or RHEL 9", "Server OS", "Ubuntu: free; RHEL: subscription"),
    ("Prometheus, Grafana, Loki", "current", "Monitoring, dashboards, log aggregation", "Apache-2.0 / AGPL-3.0"),
]


# ---------------------------------------------------------------------------
# Expected totals – a self-check so that a typo in the data above fails the build.
# ---------------------------------------------------------------------------
EXPECTED = {
    "one_time_a": 190_000,
    "one_time_b": 130_000,
    "integration_total": 30_500,
    "amc_base": 154_500,
    "amc_year1": 33_990,
    "amc_5yr": 187_816,
    "subscription_year1": 40_800,
    "cloud_setup": 15_000,
    "subscription_5yr": 225_468,
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
        "cloud_setup": CLOUD_SETUP_FEE,
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
