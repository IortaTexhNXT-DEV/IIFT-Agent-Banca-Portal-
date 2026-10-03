"""Commercial chapters (commercial proposal, validity, supporting information,
terms and conditions) and Annexes A–D.

Every figure comes from pricing_data.py; nothing in this module is typed in by
hand, so the proposal, the pricing workbook and the bill of materials agree.
"""

import brand
import compliance_matrix as cm
import pricing_data as price
from docx_kit import ProposalWriter
from numbering import sec

PRODUCT = brand.PRODUCT
YEARS = range(1, price.CONTRACT_YEARS + 1)
PRICING_WORKBOOK = brand.XLSX_OUTPUT.name
BOM_WORKBOOK = brand.BOM_OUTPUT.name

# Order of the numbered sections in the commercial chapter (used for cross-references).
COMMERCIAL_SECTIONS = ["summary", "client_format", "rfp10", "option_a", "option_b", "option_c", "tco", "ope",
                       "third_party", "rate_card", "payments", "terms", "assumptions"]


def csec(key: str) -> str:
    """Number of a section of the commercial chapter, e.g. '19.8'."""
    return f"{sec('commercials')}.{COMMERCIAL_SECTIONS.index(key) + 1}"


def n(value) -> str:
    """Whole B$ amount without the currency sign."""
    return f"{value:,.0f}"


def b(value) -> str:
    return f"B$ {value:,.0f}"


def rng(low, high) -> str:
    return "B$ 0" if high == 0 else f"B$ {low:,}–{high:,}"


def usd(value) -> str:
    return f"{price.usd(value):,}"


# =============================================================================
# Commercial proposal
# =============================================================================
def _fee_basis_rows():
    ope_core, ope_c = price.ope_total(), price.ope_total(True) - price.ope_total()
    return [
        ("Currency", f"Brunei Dollars (B$). USD amounts are indicative at USD 1 = B$ {price.FX_BND_PER_USD:.2f}, "
                     "rounded to the nearest dollar; the B$ amounts are binding."),
        ("Withholding tax (WHT)", "**Inclusive.** Where Brunei law requires IIFT to withhold tax from iorta's fees, "
                                  "IIFT deducts and remits it and pays the balance. iorta bears the tax; invoices "
                                  "are not grossed up. Cloud infrastructure and OPE are not fees: they are recharged "
                                  "at cost as disbursements with the provider and travel invoices attached."),
        ("Out-of-pocket expenses (OPE)", f"**Exclusive.** Recharged at cost as disbursements for the onsite phases "
                                         f"in Section {csec('ope')}, with the per diem fixed at USD "
                                         f"{price.PER_DIEM_USD} "
                                         f"(B$ {price.per_diem_bnd()}) a day. Estimate {b(ope_core)}, plus "
                                         f"{b(ope_c)} if Option C is taken."),
        ("Third-party charges", f"**Exclusive.** SMS, AML data service, certificates, e-mail relay and optional "
                                f"items are listed in the Bill of Materials (Section {csec('third_party')}) and are "
                                "paid by IIFT or passed through at cost without mark-up."),
        ("Infrastructure", "**Exclusive.** Option A: IIFT procures servers, storage, OS and network to iorta's "
                           "sizing. Option B: cloud infrastructure is recharged at the provider's cost as a "
                           "disbursement with no mark-up, or IIFT holds the cloud account in its own name and pays "
                           "the provider directly. The one-off cloud set-up and iorta's managed services are "
                           "fixed fees."),
        ("Indirect taxes", "Brunei Darussalam has no GST or VAT at present. If an indirect tax is introduced, it is "
                           "added to invoices at the statutory rate."),
        ("Price basis", "One-time fees are fixed prices for the scope of this proposal. Recurring fees rise by 5% a "
                        "year, which is also the cap (COM-18)."),
    ]


def commercial_summary(w: ProposalWriter):
    w.h2("Commercial summary")
    w.para(f"iorta TechNXT offers {PRODUCT} under two commercial models and one add-on. All three are priced on the "
           "same scope, team and 24-week plan; they differ in who holds the licence, who runs the infrastructure and "
           "whether IIFT takes the platform source code.")
    a_fees = price.one_time_total("A") + price.amc_total()
    b_fees = price.option_b_one_time() + price.subscription_total() + price.managed_total()
    tco_a, tco_b = price.tco_option_a(), price.tco_option_b()
    rows = [
        ["What IIFT gets",
         "Perpetual enterprise licence, implementation and annual maintenance (AMC). Runs in the IIFT/IITH data "
         "centre.",
         "Right to use for the term, implementation, maintenance and application management. iorta hosts and "
         "operates the solution on cloud.",
         f"Core platform source code with an {price.KNOWLEDGE_TRANSFER_WEEKS}-week knowledge transfer and "
         "transition, after go-live and hypercare."],
        ["Infrastructure", "IIFT procures to iorta's sizing (Bill of Materials).",
         "Cloud at cost (disbursement, no mark-up) or paid by IIFT directly; set-up and managed services by iorta.",
         "Unchanged."],
        ["One-time fees", f"**{b(price.one_time_total('A'))}**\nLicence {n(price.licence_fee())}; services "
                          f"{n(price.services_fee())}",
         f"**{b(price.option_b_one_time())}**\nServices {n(price.services_fee())}; cloud set-up "
         f"{n(price.CLOUD_SETUP_FEE)}", f"**{b(price.option_c_total())}**\nSource code "
         f"licence {n(price.SOURCE_CODE_LICENCE)}; knowledge transfer {n(price.KNOWLEDGE_TRANSFER)}"],
        ["Recurring, Year 1", f"AMC {b(price.amc(1))}\n(22% of {b(price.amc_base())})",
         f"Subscription {b(price.subscription_annual(1))} ({b(price.subscription_monthly(1))} a month)\n"
         f"Managed services {b(12 * price.managed_monthly(1))}\nCloud at actuals ≈ {b(price.cloud_annual())}",
         f"Optional L3 support {b(price.post_handover_support(1))} (10% of the AMC base) in place of the AMC"],
        ["Yearly increase", "5% on the AMC", "5% on subscription and managed services; cloud at actuals",
         "5% on post-handover support"],
        ["Term", "Licence perpetual; AMC for five years, renewable yearly",
         f"Minimum term {price.SUBSCRIPTION_MINIMUM_MONTHS} months from go-live",
         "Exercisable after hypercare"],
        ["iorta fees, five years", f"**{b(a_fees)}**", f"**{b(b_fees)}**", "Add-on to A, or to B on conversion"],
        ["Five-year total with OPE and cloud estimates", f"**{b(tco_a)}**\nUSD {usd(tco_a)}",
         f"**{b(tco_b)}**\nUSD {usd(tco_b)}", f"+ {b(price.option_c_total())} and OPE "
                                              f"{b(price.ope_total(True) - price.ope_total())}"],
    ]
    w.table(["", "Option A\nOn-premise perpetual licence", "Option B\nSubscription, iorta-hosted cloud",
             "Option C\nSource code handover (add-on)"], rows, widths=[3.0, 4.7, 4.7, 4.6], font_size=8,
            bold_first_col=True, caption="Commercial options at a glance (B$)")
    saving = tco_b - tco_a
    w.callout("Recommendation: Option A, with the Option C decision taken after go-live", [
        "**Data stays in Brunei.** The solution runs in the IITH data centre next to IIFT's core and finance "
        "systems, under IITH's existing security and DR arrangements; no cloud outsourcing notification to AMBD is "
        "needed.",
        f"**Lowest five-year cost.** {b(tco_a)} against {b(tco_b)} for Option B, a difference of {b(saving)} "
        f"({saving / tco_b:.0%}). Even with IIFT's own infrastructure added (indicative "
        f"{rng(*price.bom_onprem_totals())}), Option A is the cheaper option from Year 2.",
        "**IIFT owns a perpetual licence.** After go-live IIFT can take the platform source code (Option C) and "
        "replace the AMC with the 10% L3 support, or keep the full AMC.",
        f"**Option B** suits IIFT if it prefers a lower upfront payment ({b(price.option_b_one_time())} instead of "
        f"{b(price.one_time_total('A'))}) and an operating-expense model with iorta running the infrastructure. It "
        "can be converted to Option A during the term.",
    ])
    w.h3("Fee basis")
    w.key_value_table(_fee_basis_rows(), widths=(4.2, 12.8), caption="What the fees include and exclude")


def _client_rows(option):
    """Rows of the client-format table for one option; returns (rows, highlight indexes)."""
    def money(value):
        return [n(value), usd(value)]

    rows, highlight = [], []

    def line(label, fee, wht="Inclusive", ope="Excluded"):
        rows.append([label, *money(fee), wht, ope, *money(fee)])

    def subtotal(label, fee):
        highlight.append(len(rows))
        line(label, fee)

    rows.append(("GROUP", "One-time fees" + (" (licence and services)" if option == "A" else " (services)")))
    line("Agent/Banca Portal", price.one_time_portal(option))
    line("Back-office solution", price.one_time_backoffice(option))
    if option == "B":
        line("Cloud set-up, platform (landing zone, environments, monitoring, backups, DR)", price.CLOUD_SETUP_FEE)
    subtotal("Total one-time fees", price.option_b_one_time() if option == "B" else price.one_time_total(option))
    if option == "A":
        rows.append(("GROUP", "Annual maintenance (AMC), Year 1 – 22% of licence and customisation, +5% a year"))
        line("Agent/Banca Portal", price.amc_portal(1))
        line("Back-office solution", price.amc_backoffice(1))
        subtotal("Total AMC, Year 1", price.amc(1))
    else:
        rows.append(("GROUP", "Recurring fees, Year 1 – +5% a year"))
        line(f"Agent/Banca Portal subscription (B$ {price.subscription_monthly_portal(1):,} a month)",
             12 * price.subscription_monthly_portal(1))
        line(f"Back-office solution subscription (B$ {price.subscription_monthly_backoffice(1):,} a month)",
             12 * price.subscription_monthly_backoffice(1))
        line(f"Managed services, platform (B$ {price.managed_monthly(1):,} a month)", 12 * price.managed_monthly(1))
        subtotal("Total recurring fees, Year 1", price.subscription_annual(1) + 12 * price.managed_monthly(1))
    rows.append(("GROUP", "Out-of-pocket expenses – disbursements at cost, estimate for the onsite phases"))
    ope = price.ope_total()
    rows.append(["OPE (travel, accommodation, per diem, insurance, transfers, visas)", "–", "–", "–",
                 n(ope), n(ope), usd(ope)])
    return rows, highlight


def client_format(w: ProposalWriter):
    w.h2("Fees in IIFT's requested format")
    w.para("The tables follow the format in the RFP (Description, Fee, WHT, OPE, Total). Agent/Banca Portal and "
           f"Back-office solution are the two modules of {PRODUCT}, and every fee is split between them. Amounts in "
           "B$ with indicative USD.")
    w.callout("Fee statement", [
        "All fees are **inclusive of WHT**, **exclusive of OPE** (recharged at cost as disbursements; estimates shown) and "
        "**exclusive of third-party charges and infrastructure** (listed in the Bill of Materials).",
    ])
    headers = ["Description", "Fee (B$)", "Fee (USD)", "WHT", "OPE", "Total (B$)", "Total (USD)"]
    widths = [5.6, 1.9, 1.8, 1.7, 1.6, 2.2, 2.2]
    for option, caption in (("A", "Option A – on-premise perpetual licence, in IIFT's format"),
                            ("B", "Option B – subscription, in IIFT's format")):
        rows, highlight = _client_rows(option)
        w.table(headers, rows, widths=widths, font_size=8, align_right_cols=(1, 2, 4, 5, 6), center_cols=(3,),
                highlight_rows=highlight, caption=caption)
    w.bullets([
        "**WHT – inclusive.** The fee is the full amount payable; any withholding tax is deducted from it and borne "
        "by iorta.",
        f"**OPE – exclusive.** The OPE line is an estimate for the onsite phases in Section {csec('ope')}; actual "
        "costs are recharged as disbursements with the travel invoices attached, and the per diem is fixed.",
        f"**Third-party charges and infrastructure – exclusive.** Under Option B, cloud infrastructure is recharged "
        f"at cost as a disbursement (or paid by IIFT directly), estimated at {b(price.cloud_monthly())} a month "
        f"({b(price.cloud_annual())} a year) plus "
        f"{b(price.CLOUD_IMPLEMENTATION_MONTHLY * price.CLOUD_IMPLEMENTATION_MONTHS)} for the project environments.",
    ])


# RFP section 10 component names and pricing bases, as worded in the RFP
RFP10_ITEMS = {
    1: ("Software / application licence", "One-off / licence"), 2: ("Implementation", "One-off"),
    3: ("Integration", "Per interface"), 4: ("Data migration", "One-off"), 5: ("Infrastructure / cloud", "Annual"),
    6: ("Database", "Annual"), 7: ("Security", "One-off / annual"), 8: ("Testing", "One-off"),
    9: ("Training", "One-off"), 10: ("Documentation", "One-off"), 11: ("Warranty", "Included"),
    12: ("Year 1 maintenance", "Annual"), 13: ("Year 2 maintenance", "Annual"), 14: ("Year 3 maintenance", "Annual"),
    15: ("Year 4 maintenance", "Annual"), 16: ("Year 5 maintenance", "Annual"),
    17: ("Enhancement rate", "Hour / day rate"), 18: ("Onsite support", "Per day"),
    19: ("After-hours support", "Per incident / included"), 20: ("Third-party charges", "Annual / usage"),
    21: ("Exit / transition", "Fixed / included"),
}

RFP10_SHORT = {
    # no: (Option A text, Option B text, remark) – used where the item has no fixed amount
    1: (None, "Included in subscription", "A: perpetual, unlimited IIFT named users, all environments. "
                                          "B: right to use during the term."),
    2: (None, None, "PM, BA, design, configuration, customisation, deployment (COM-06)"),
    3: (None, None, "Six interfaces, priced per interface (COM-05)"),
    4: (None, None, "Two dry runs, load and reconciliation (COM-07)"),
    5: ("IIFT procures (BOM)", "{setup} set-up (one-off)\n+ managed services {ms} (Year 1)\n+ cloud at cost",
        "A: IIFT's own procurement to iorta's sizing. B: set-up at signing; cloud recharged at cost as a "
        "disbursement; managed services +5% a year"),
    6: ("0 (PostgreSQL)", "In cloud actuals", "No database licence fee; support in AMC or managed services"),
    7: (None, None, "Independent VAPT and re-test; certificates in the BOM"),
    8: (None, None, "SIT, performance, regression and UAT support (COM-08)"),
    9: (None, None, "End-user, administrator and technical training"),
    10: (None, None, "User, administrator, technical and operations manuals"),
    11: ("Included (6 months)", "Included (6 months)", "Defect correction from production go-live"),
    12: (None, None, "A: 22% of {base}, +5% a year. B: subscription, +5% a year"),
    17: ("680 / man-day\n90 / hour", "680 / man-day\n90 / hour", "Year 1 rates, +5% a year"),
    18: ("850 / day + OPE", "850 / day + OPE", "Unplanned visits; planned phases per the OPE schedule"),
    19: ("P1 included\n120 / hour", "P1 included\n120 / hour", "Other after-hours work only at IIFT's request"),
    20: ("Excluded (BOM)", "Excluded (BOM)", "SMS, AML data, certificates, e-mail relay: {tp_a} a year (A), "
                                            "{tp_b} a year (B)"),
    21: ("Included (Year 5 AMC)", "Included (end of term)", "Transition, data extraction, knowledge transfer; core "
                                                            "source code is Option C"),
}


def rfp_section10(w: ProposalWriter):
    w.h2("Commercial pricing breakdown (RFP section 10)")
    w.para("All 21 items of RFP section 10, for both options. Amounts in B$; the portal and back-office split of "
           f"every amount is in the pricing workbook ({PRICING_WORKBOOK}).")
    rows_a = {r["no"]: r for r in price.rfp_section10_rows("A")}
    rows_b = {r["no"]: r for r in price.rfp_section10_rows("B")}
    fmt = {"ms": n(12 * price.managed_monthly(1)), "base": b(price.amc_base()), "setup": n(price.CLOUD_SETUP_FEE),
           "tp_a": rng(*price.third_party_annual("A")), "tp_b": rng(*price.third_party_annual("B"))}
    rows, highlight = [], []
    for no in range(1, 22):
        ra, rb = rows_a[no], rows_b[no]
        component, basis = RFP10_ITEMS[no]
        short = RFP10_SHORT.get(no) or (None, None, ra["component"].split(": ", 1)[-1])
        text_a = n(ra["amount"]) if ra["amount"] is not None else (short[0] or ra["text"])
        text_b = (short[1] if no == 5 else n(rb["amount"]) if rb["amount"] is not None
                  else (short[1] or rb["text"]))
        rows.append([str(no), component, basis, text_a.format(**fmt), text_b.format(**fmt), short[2].format(**fmt)])
        if no == 11:
            highlight.append(len(rows))
            rows.append(["", "Subtotal one-time (items 1–11)", "", n(price.one_time_total("A")),
                         n(price.option_b_one_time()), "Fixed price; B includes the cloud set-up"])
        if no == 16:
            highlight.append(len(rows))
            rows.append(["", "Subtotal Years 1–5 (items 12–16)", "", n(price.amc_total()),
                         n(price.subscription_total()), "AMC (A) / subscription (B)"])
            rows.append(["", "Managed services Years 1–5 (item 5)", "", "–", n(price.managed_total()),
                         "Option B only"])
            highlight.append(len(rows))
            rows.append(["", "iorta fees, five years", "",
                         n(price.one_time_total("A") + price.amc_total()),
                         n(price.option_b_one_time() + price.subscription_total() + price.managed_total()),
                         "Excludes OPE, cloud actuals and third-party charges"])
    w.table(["No", "Commercial component", "Basis", "Option A (B$)", "Option B (B$)", "Remarks"], rows,
            widths=[0.8, 4.0, 2.0, 2.4, 2.8, 5.0], font_size=7.5, center_cols=(0,), align_right_cols=(3, 4),
            highlight_rows=highlight, padding=25, caption="RFP section 10 commercial pricing breakdown")


# --- Option A -------------------------------------------------------------------------
def _licence_terms():
    return [
        ("Licence type", f"Perpetual, non-exclusive, non-transferable enterprise licence to {PRODUCT} (Agent/Banca "
                         "Portal and Back-office modules), in object code, for IIFT's internal business."),
        ("Quantity", "Unlimited named and concurrent users for IIFT, its agents and bank partners (Appendix 1 lists "
                     "26). No per-user, per-policy or per-transaction fees."),
        ("Environments", "Production, DR and non-production (SIT, UAT, training) without further licence fees."),
        ("Duration and renewal", "Perpetual. No renewal fee. The licence continues if the AMC ends."),
        ("Fee", f"{b(price.licence_fee())} one-off (Agent/Banca Portal {n(price.licence_fee('portal'))}; "
                f"Back-office {n(price.licence_fee('backoffice'))}), paid against milestones L1–L3."),
        ("Transfer", "Not transferable, except to a successor of IIFT's business in a merger or group "
                     "reorganisation, with written notice to iorta. IITH may operate and support the solution on "
                     "IIFT's behalf."),
        ("Other IITH companies", "Use by another group company, such as IIGT, needs an additional entity licence, "
                                 "priced separately."),
        ("Updates", f"New {PRODUCT} releases, patches and upgrades are included while the AMC is in force."),
        ("Source code", f"Source code of IIFT-specific components is delivered under every option (DEL-11). The "
                        f"core platform source code is Option C (Section {csec('option_c')}) or escrow."),
    ]


def option_a(w: ProposalWriter):
    w.h2(price.OPTION_TITLES["A"])
    w.para(f"IIFT buys a perpetual licence and a fixed-price implementation, and runs the solution in the IIFT/IITH "
           f"data centre on infrastructure it procures to iorta's sizing (Section {sec('infrastructure')}). "
           "Maintenance and support are charged as an AMC from go-live.")
    w.h3("Licence terms (COM-02)")
    w.key_value_table(_licence_terms(), widths=(3.6, 13.4), caption="Option A licence terms")

    w.h3("One-time fees")
    rows = []
    for no, key, component, basis, portal, backoffice, in_base, _ in price.ONE_TIME_ITEMS:
        rows.append([str(no), component, n(portal), n(backoffice), n(portal + backoffice),
                     "Yes" if in_base else "No"])
    rows.append(["", "Total one-time fees, Option A", n(price.one_time_portal("A")),
                 n(price.one_time_backoffice("A")), n(price.one_time_total("A")), n(price.amc_base())])
    w.table(["No", "Component", "Portal (B$)", "Back-office (B$)", "Total (B$)", "In AMC base"], rows,
            widths=[0.8, 8.4, 1.9, 2.2, 1.9, 1.8], font_size=8, align_right_cols=(2, 3, 4), center_cols=(0, 5),
            total_rows=1, caption="Option A one-time fees (RFP section 10 numbering)")
    w.table(["Item", "What the fee covers"],
            [[f"{i[0]}. {i[2].split(' (')[0]}", i[7]] for i in price.ONE_TIME_ITEMS],
            widths=[4.2, 12.8], font_size=8, bold_first_col=True, padding=30,
            caption="Scope of each one-time fee (COM-06 to COM-10)")

    w.h3("Integration per interface (COM-05)")
    rows = [[name, scope, n(portal), n(backoffice), n(portal + backoffice)]
            for name, scope, portal, backoffice in price.INTERFACES]
    rows.append(["Total integration (item 3)", "", n(price.integration_portal()), n(price.integration_backoffice()),
                 n(price.integration_portal() + price.integration_backoffice())])
    w.table(["Interface", "Scope", "Portal (B$)", "Back-office (B$)", "Total (B$)"], rows,
            widths=[3.4, 7.2, 2.0, 2.4, 2.0], font_size=8, align_right_cols=(2, 3, 4), total_rows=1,
            bold_first_col=True, caption="Integration cost per interface (same under Option B)")

    w.h3("Annual maintenance charge (AMC)")
    w.para(f"The AMC is **22% of the licence and customisation fees** (items 1, 2 and 3): 22% × "
           f"{b(price.amc_base())} = **{b(price.amc(1))} in Year 1**, rising by 5% a year. Year 1 starts at "
           f"production go-live. The {price.WARRANTY_MONTHS}-month warranty runs inside Year 1: defects are fixed "
           "free of charge under the warranty, while the AMC pays for the service desk, SLA, monitoring, patches, "
           f"upgrades and {price.ENHANCEMENT_HOURS_PER_YEAR} enhancement hours a year.")
    rows = []
    for _, year, focus, _ in price.MAINTENANCE_PLAN:
        rows.append([f"Year {year}", focus, n(price.amc_portal(year)), n(price.amc_backoffice(year)),
                     n(price.amc(year)), f"{price.amc(year) / 4:,.2f}"])
    rows.append(["Total", "Five years", n(sum(price.amc_portal(y) for y in YEARS)),
                 n(sum(price.amc_backoffice(y) for y in YEARS)), n(price.amc_total()), ""])
    w.table(["Year", "Focus (RFP section 9)", "Portal (B$)", "Back-office (B$)", "AMC (B$)", "Per quarter (B$)"],
            rows, widths=[1.7, 5.3, 2.4, 2.6, 2.4, 2.6], font_size=8, align_right_cols=(2, 3, 4, 5),
            total_rows=1, bold_first_col=True, caption="AMC by year (COM-12, COM-18)")
    w.para("**AMC inclusions:**", space_after=2, keep_with_next=True)
    w.bullets(price.MAINTENANCE_INCLUSIONS)
    w.para(f"Billing: {price.AMC_BILLING.lower()}. After Year 5 the AMC is renewable yearly, with the increase "
           f"capped at 5%. The services are described in Section {sec('maintenance')}.")

    w.h3("Warranty (COM-11)")
    w.para(f"Both options carry a {price.WARRANTY_MONTHS}-month warranty from production go-live: defects against "
           "the approved specifications, including IIFT-specific configuration, adapters, reports and templates, "
           "are corrected at no charge within the SLA. The warranty does not cover changes made by others, misuse, "
           "or infrastructure and third-party products outside iorta's scope.")


# --- Option B -------------------------------------------------------------------------
def option_b(w: ProposalWriter):
    w.h2(price.OPTION_TITLES["B"])
    w.para(f"IIFT pays the implementation fee and a monthly subscription that includes the right to use "
           f"{PRODUCT}, maintenance and support, and application management. iorta hosts the solution on cloud in "
           f"{price.CLOUD_REGION}. A one-off set-up fee covers building the cloud environments. Cloud infrastructure "
           "is recharged at cost as a disbursement (or paid by IIFT directly), and iorta's managed services for the "
           "infrastructure are a separate fixed fee.")
    w.h3("Implementation fee")
    w.para(f"{b(price.one_time_total('B'))} (Agent/Banca Portal {n(price.one_time_portal('B'))}; Back-office "
           f"{n(price.one_time_backoffice('B'))}): the same scope and fees as Option A items 2 to 10 "
           f"(Section {csec('option_a')}), without the licence. It is paid against the service milestones in "
           f"Section {csec('payments')}.")
    w.h3("Cloud set-up fee")
    w.para(f"**{b(price.CLOUD_SETUP_FEE)} one-off**, payable at contract signing: set-up of the cloud landing zone "
           "(account structure, network, VPN to the IITH data centre, identity and key management), the PROD, DR and "
           "UAT environments, monitoring and alerting, backups and the DR arrangement, with security baselines "
           f"applied. It is RFP section 10 item 5 (one-off part) and is not part of the AMC base. Option B one-time "
           f"fees therefore total **{b(price.option_b_one_time())}**.")

    w.h3("Subscription (COM-03)")
    rows = []
    for year in YEARS:
        rows.append([f"Year {year}", n(price.subscription_monthly_portal(year)),
                     n(price.subscription_monthly_backoffice(year)), n(price.subscription_monthly(year)),
                     n(price.subscription_annual(year))])
    rows.append(["Total", "", "", "", n(price.subscription_total())])
    w.table(["Contract year", "Portal per month (B$)", "Back-office per month (B$)", "Total per month (B$)",
             "Per year (B$)"], rows, widths=[2.8, 3.4, 3.8, 3.4, 3.6], font_size=8, align_right_cols=(1, 2, 3, 4),
            total_rows=1, bold_first_col=True, caption="Subscription by year (+5% a year)")
    w.bullets([
        f"**Billing:** {price.SUBSCRIPTION_BILLING.lower()}.",
        f"**Term:** minimum term of {price.SUBSCRIPTION_MINIMUM_MONTHS} months from go-live "
        f"({b(price.subscription_minimum_commitment())} of subscription). If IIFT ends the subscription earlier "
        "other than for iorta's breach, the subscription for the rest of the minimum term is payable; conversion "
        "to Option A ends it without that charge. After the minimum term it renews yearly, with the increase "
        "capped at 5%.",
        "**Users:** unlimited named users for IIFT; no per-user or per-policy charges.",
    ])
    w.para("**The subscription includes:**", space_after=2, keep_with_next=True)
    w.bullets(price.SUBSCRIPTION_INCLUSIONS)

    w.h3("Cloud infrastructure at cost (COM-04)")
    rows = [[service, sizing, n(monthly), n(12 * monthly)]
            for (service, _, monthly), sizing in zip(price.CLOUD_MONTHLY_ITEMS, price.CLOUD_SIZING)]
    rows.append(["Total, production run", "", n(price.cloud_monthly()), n(price.cloud_annual())])
    rows.append([f"Project environments (DEV, SIT, UAT) for {price.CLOUD_IMPLEMENTATION_MONTHS} months before "
                 "go-live", "Scaled-down environments", n(price.CLOUD_IMPLEMENTATION_MONTHLY),
                 n(price.CLOUD_IMPLEMENTATION_MONTHLY * price.CLOUD_IMPLEMENTATION_MONTHS) + " (one-off)"])
    w.table(["Service", "Reference sizing", "B$ / month", "B$ / year"], rows, widths=[5.8, 7.0, 2.0, 2.2],
            font_size=8, align_right_cols=(2, 3), highlight_rows=(len(rows) - 2,),
            caption="Cloud infrastructure estimate (recharged at cost as a disbursement)")
    w.bullets([
        "**Recharged at cost as a disbursement.** iorta recharges the cloud provider's charges monthly in arrears, "
        "with the provider invoice attached and no mark-up, separately from its fees and outside the fees to which "
        "withholding tax applies. The estimate above is for budgeting; IIFT pays the actual charges.",
        "**Or paid by IIFT directly.** IIFT may hold the cloud account in its own name and pay the provider "
        "directly; iorta then operates the account under the managed services with delegated access. Either way "
        "the account is dedicated to IIFT.",
        "**Currency.** Providers bill in USD; recharged amounts are converted to B$ at the bank selling rate on the "
        "provider's invoice date, shown on iorta's disbursement invoice.",
        "**Cost control.** Budget alerts at 80% and 100% of the monthly estimate, a monthly cost report and a "
        "quarterly right-sizing review. Reserved capacity is bought only with IIFT's approval, and the saving "
        "passes to IIFT.",
    ])

    w.h3("Managed services by iorta")
    rows = [[f"Year {y}", n(price.managed_monthly(y)), n(12 * price.managed_monthly(y))] for y in YEARS]
    rows.append(["Total", "", n(price.managed_total())])
    w.table(["Contract year", "Per month (B$)", "Per year (B$)"], rows, widths=[5.0, 6.0, 6.0], font_size=8,
            align_right_cols=(1, 2), total_rows=1, bold_first_col=True,
            caption="Managed services fee (+5% a year), billed monthly in advance from go-live")
    w.para("**Managed services include:**", space_after=2, keep_with_next=True)
    w.bullets(price.MANAGED_SERVICES_INCLUSIONS)

    w.h3("Hosting region and data residency")
    w.paras([
        f"The reference design uses {price.CLOUD_REGION}, with production across two availability zones and DR "
        f"copies in {price.CLOUD_DR_REGION}. Data is encrypted at rest with keys held in IIFT's account and in "
        "transit with TLS; back-office traffic and integrations with Core, FIN, AD and SMTP run over a site-to-site "
        "VPN to the IITH data centre.",
        "Cloud hosting of personal data is an outsourcing arrangement for IIFT. IIFT makes the AMBD outsourcing and "
        "cloud notification; iorta provides the supporting material (architecture, controls, exit plan, provider "
        "certifications). A Brunei-hosted alternative, such as a local data-centre provider, can be priced on "
        "request.",
    ])
    w.h3("Exit and data return")
    w.bullets([
        "Data belongs to IIFT. A full export (database dump, CSV extracts, documents and audit records) is available "
        "on request during the term and is delivered at exit.",
        "Exit assistance is included at the end of the term: transition plan, knowledge transfer, data export and up "
        "to 30 days of parallel support.",
        "After IIFT confirms receipt of the data, iorta deletes it from the cloud account and backups and issues a "
        "deletion certificate. An account held in IIFT's name stays with IIFT.",
    ])
    w.h3("Conversion to Option A")
    w.para(f"IIFT may convert to Option A at any point in the term. The perpetual licence fee of "
           f"{b(price.licence_fee())} applies [bid owner to confirm any credit of subscription fees already paid]; "
           "from the conversion date the subscription, including any remaining minimum term, is replaced by the "
           "Option A AMC for that contract year. The "
           "solution moves to the IIFT/IITH data centre, or stays in the cloud account with managed services and "
           "cloud at actuals continuing. Option C becomes available once converted.")


# --- Option C -------------------------------------------------------------------------
def option_c(w: ProposalWriter):
    w.h2(price.OPTION_TITLES["C"])
    w.callout("Source code under every option", [
        "RFP DEL-11 (Must) asks for the source code of agreed custom-developed components. Under **every option** "
        "iorta delivers, at go-live and with every release, the source code of IIFT-specific components: "
        "configuration, integration adapters, reports, document templates, migration scripts and build scripts.",
        f"**Option C** adds the source code of the {PRODUCT} core platform, with a structured knowledge transfer so "
        "that IIFT, IITH or a provider IIFT appoints can maintain and extend it.",
    ])
    w.h3("What is delivered")
    w.bullets(price.SOURCE_CODE_DELIVERABLES)
    w.h3("Licence rights")
    w.key_value_table([
        ("Rights", "Use, modify, compile, maintain and extend the source code for the internal business of IIFT and "
                   "the IITH group. A group company that deploys the solution needs its own licence."),
        ("Restrictions", "No sale, sublicensing, distribution or provision to third parties as a product or "
                         "service. Contractors may work on the code for IIFT under confidentiality obligations."),
        ("Ownership", f"The {PRODUCT} core remains iorta TechNXT's intellectual property. Changes IIFT makes after "
                      "handover belong to IIFT."),
        ("Confidentiality", "The source code is iorta's confidential information and is kept in IIFT/IITH-controlled "
                            "repositories."),
        ("Third-party code", "Open-source components remain under their own licences, listed in the SBOM."),
        ("Assurance", "The delivered code builds the production release; this is verified by IIFT before payment "
                      "C1. iorta does not warrant changes made by others."),
    ], widths=(3.4, 13.6), caption="Option C licence rights")

    w.h3("Timing and transition plan")
    w.para(f"Handover starts after go-live and hypercare exit (week {price.KT_START_WEEK} at the earliest) and takes "
           f"{price.KNOWLEDGE_TRANSFER_WEEKS} weeks. It can also start later in the contract. The plan below assumes "
           "up to six IIFT/IITH or nominated contractor staff with Node.js and React experience.")
    w.table(["Week", "Activity", "Outcome"], [[str(wk), act, out] for wk, act, out in price.KT_PLAN],
            widths=[1.4, 10.4, 5.2], font_size=8, center_cols=(0,), caption="Knowledge transfer and transition plan")
    w.para("**Acceptance.** The handover certificate is signed when IIFT's team has built and deployed a release to "
           "SIT from the delivered repository without iorta's help, resolved tickets in the reverse-shadow weeks, "
           "and received the documentation set; the competency assessment in week 8 records the result for each "
           "participant.")
    ope_c = price.ope_total(True) - price.ope_total()
    w.para(f"Onsite: the Solution Architect and a Senior Developer spend the code walkthrough weeks onsite (OPE "
           f"estimate {b(ope_c)}, at actuals); the rest is delivered remotely.")

    w.h3("Price and payment")
    rows = [[code, trigger, component, f"{share:.0%}", n(amount)]
            for code, trigger, component, share, amount in price.source_code_milestone_amounts()]
    rows.append(["", "Total Option C", "", "", n(price.option_c_total())])
    w.table(["Milestone", "Payment trigger", "Component", "Share", "Amount (B$)"], rows,
            widths=[1.8, 8.0, 3.6, 1.4, 2.2], font_size=8, center_cols=(0, 3), align_right_cols=(4,), total_rows=1,
            caption=f"Option C: source code licence {b(price.SOURCE_CODE_LICENCE)} and knowledge transfer "
                    f"{b(price.KNOWLEDGE_TRANSFER)}")
    w.para("The price holds if Option C is exercised within 12 months of go-live; later exercise is priced at this "
           "fee plus 5% for each further contract year. OPE for the onsite weeks is charged at actuals.")

    w.h3("Support after handover")
    w.table(["Choice", "What iorta provides", "Price"], [
        ["1. Continue the full AMC", "All AMC services: service desk, SLA, patches, upgrades, enhancement hours.",
         f"AMC unchanged ({b(price.amc(1))} in Year 1, +5% a year)"],
        ["2. Platform updates and L3 support", f"{PRODUCT} core releases and security patches, L3 advice and "
                                               "defect fixes in the core under the SLA. IIFT's team handles L1/L2 "
                                               "and its own changes.",
         f"10% of the AMC base: {b(price.post_handover_support(1))} in Year 1, +5% a year, in place of the AMC"],
        ["3. Rate card only", "No retainer; work ordered when needed.",
         f"Rate card (Section {csec('rate_card')})"],
    ], widths=[3.6, 8.4, 5.0], font_size=8, bold_first_col=True, caption="Support choices after handover")
    rows = [[f"Year {y}", n(price.post_handover_support(y)), n(price.amc(y)),
             n(price.amc(y) - price.post_handover_support(y))] for y in YEARS]
    rows.append(["Total", n(price.post_handover_total()), n(price.amc_total()),
                 n(price.amc_total() - price.post_handover_total())])
    w.table(["Contract year", "Choice 2 (B$)", "Full AMC (B$)", "Difference (B$)"], rows,
            widths=[3.8, 4.4, 4.4, 4.4], font_size=8, align_right_cols=(1, 2, 3), total_rows=1, bold_first_col=True,
            caption="Choice 2 compared with the full AMC (pro rata from the month after the handover certificate)")

    w.h3("Escrow alternative")
    w.bullets([
        "Instead of Option C, the core source code can be deposited with an independent escrow agent chosen with "
        "IIFT, under a tripartite agreement.",
        "Deposits at go-live and after every major release; an optional verification test confirms the deposit "
        "builds.",
        f"Escrow agent fees are paid by IIFT at cost (indicative {rng(*price.ESCROW_ANNUAL_ESTIMATE)} a year); "
        "iorta's deposit work is included.",
        "Release conditions: iorta's insolvency or winding-up, iorta ceasing to trade or to support "
        f"{PRODUCT} without a successor, or a material breach of support obligations not remedied within 30 days "
        "of notice.",
        "On release IIFT receives the rights described above for Option C. Knowledge transfer is not part of "
        "escrow and can be ordered at the rate card.",
    ])


# --- Five-year view -------------------------------------------------------------------
def five_year_cost(w: ProposalWriter):
    w.h2("Five-year cost of ownership")
    a_fees = price.one_time_total("A") + price.amc_total()
    b_fees = price.option_b_one_time() + price.subscription_total() + price.managed_total()
    tco_a, tco_b = price.tco_option_a(), price.tco_option_b()
    infra_low, infra_high = price.bom_onprem_totals()
    tp = {o: price.third_party_annual(o) for o in "AB"}
    opt = {o: price.third_party_annual(o, optional=True) for o in "AB"}
    years = price.CONTRACT_YEARS
    rows = [
        ["One-time iorta fees (B: services and cloud set-up)", n(price.one_time_total("A")),
         n(price.option_b_one_time())],
        ["AMC (A) / subscription (B), Years 1–5", n(price.amc_total()), n(price.subscription_total())],
        ["Managed services, Years 1–5", "–", n(price.managed_total())],
        ["iorta fees, five years", n(a_fees), n(b_fees)],
        ["OPE, core onsite phases (estimate, disbursements at cost)", n(price.ope_total()), n(price.ope_total())],
        ["Cloud infrastructure at cost (estimate, incl. project environments)", "–", n(price.cloud_total())],
        ["Five-year total (B$)", n(tco_a), n(tco_b)],
        ["Five-year total (USD, indicative)", usd(tco_a), usd(tco_b)],
        ("GROUP", "Paid by IIFT directly – indicative, not included in the totals above"),
        ["Infrastructure procured by IIFT (one-time, Bill of Materials)", rng(infra_low, infra_high), "–"],
        ["Required third-party services, five years (SMS, AML, certificates, e-mail)",
         rng(years * tp["A"][0], years * tp["A"][1]), rng(years * tp["B"][0], years * tp["B"][1])],
        ["Optional items, five years (RHEL, PostgreSQL support, escrow)",
         rng(years * opt["A"][0], years * opt["A"][1]), rng(years * opt["B"][0], years * opt["B"][1])],
        ("GROUP", "Option C add-on (either option)"),
        ["Source code handover with knowledge transfer", n(price.option_c_total()), "On conversion"],
        ["OPE for onsite knowledge transfer (estimate)", n(price.ope_total(True) - price.ope_total()), "–"],
    ]
    w.table(["Cost element", "Option A (B$)", "Option B (B$)"], rows, widths=[9.8, 3.6, 3.6], font_size=8,
            align_right_cols=(1, 2), highlight_rows=(3, 6, 7), bold_first_col=True,
            caption="Five-year cost of ownership")

    view = {o: price.five_year_view(o) for o in "AB"}
    rows = []
    crossover = None
    infra_mid = (infra_low + infra_high) // 2
    cum_infra = {"A": infra_mid, "B": 0}
    for year in range(0, years + 1):
        va, vb = view["A"][year], view["B"][year]
        label = "Year 0 (implementation)" if year == 0 else f"Year {year}"
        fees_a = va["one_time"] + va["recurring"]
        fees_b = vb["one_time"] + vb["recurring"] + vb["managed"]
        rows.append([label, n(fees_a), n(va["ope"]), n(va["total"]), n(fees_b), n(vb["cloud"]), n(vb["ope"]),
                     n(vb["total"])])
        for o, v in (("A", va), ("B", vb)):
            cum_infra[o] += v["total"]
        if crossover is None and year > 0 and cum_infra["A"] <= cum_infra["B"]:
            crossover = year
    total = {o: sum(v["total"] for v in view[o].values()) for o in "AB"}
    rows.append(["Total", n(a_fees), n(price.ope_total()), n(total["A"]), n(b_fees), n(price.cloud_total()),
                 n(price.ope_total()), n(total["B"])])
    w.table(["Period", "A: iorta fees", "A: OPE", "A: total", "B: iorta fees", "B: cloud", "B: OPE", "B: total"],
            rows, widths=[3.3, 2.0, 1.6, 1.9, 2.0, 1.8, 1.6, 2.8], font_size=8, align_right_cols=tuple(range(1, 8)),
            total_rows=1, bold_first_col=True, caption="Cash view by contract year (B$)")
    w.para(f"Option B needs {b(price.one_time_total('A') - price.option_b_one_time())} less in one-time fees. Option A "
           f"costs less over five years by {b(tco_b - tco_a)}, and becomes the cheaper option in Year {crossover} "
           f"even when the mid-point of IIFT's infrastructure estimate ({b(infra_mid)}) is added to it.")


# --- OPE ------------------------------------------------------------------------------
def ope_schedule(w: ProposalWriter):
    w.h2("Out-of-pocket expenses (OPE)")
    w.para("The team works from Malaysia and India. Onsite presence in Bandar Seri Begawan is recommended for "
           "requirements gathering, user training and UAT support, go-live with one month of support and, if "
           "Option C is taken, knowledge transfer and handover. All other work is delivered remotely and carries no "
           "OPE.")
    my, ind = price.ORIGINS["Malaysia"], price.ORIGINS["India"]
    w.table(["Cost item", "From Malaysia (B$)", "From India (B$)", "Basis"], [
        ["Return airfare (economy)", n(my[0]), n(ind[0]), "Per trip, at actuals"],
        ["Accommodation", n(price.HOTEL_PER_NIGHT), n(price.HOTEL_PER_NIGHT), "Per night, at actuals"],
        ["Per diem (meals, local transport)", n(price.per_diem_bnd()), n(price.per_diem_bnd()),
         f"Per day onsite incl. travel days; fixed at USD {price.PER_DIEM_USD}"],
        ["Travel insurance", n(my[1]), n(ind[1]), "Per trip, at actuals"],
        ["Airport transfers", n(my[2]), n(ind[2]), "Per trip, at actuals"],
        ["Visa", "0 (visa-free)", n(ind[3]), "Per trip, at actuals"],
    ], widths=[4.6, 3.0, 3.0, 6.4], font_size=8, align_right_cols=(1, 2), bold_first_col=True,
        caption="OPE unit rates used for the estimate")
    rows, highlight = [], []
    current = None
    for trip, cost in price.ope_trip_rows():
        if trip.phase != current:
            current = trip.phase
            rows.append(("GROUP", trip.phase + (" – optional" if trip.optional else "")))
        other = cost["insurance"] + cost["transfers"] + cost["visa"]
        rows.append([trip.role, trip.origin, str(trip.nights), n(cost["airfare"]), n(cost["accommodation"]),
                     n(cost["per_diem"]), n(other), n(cost["total"])])
    core, total = price.ope_total(), price.ope_total(True)
    highlight.append(len(rows))
    rows.append(["Core onsite phases", "", str(sum(t.nights for t in price.ONSITE_PLAN if not t.optional)), "", "",
                 "", "", n(core)])
    rows.append(["Option C knowledge transfer (optional)", "",
                 str(sum(t.nights for t in price.ONSITE_PLAN if t.optional)), "", "", "", "", n(total - core)])
    highlight.append(len(rows))
    rows.append(["Total including Option C", "", "", "", "", "", "", n(total)])
    w.table(["Role", "From", "Nights", "Airfare", "Hotel", "Per diem", "Insurance, transfers, visa", "Total (B$)"],
            rows, widths=[4.4, 1.7, 1.3, 1.5, 1.5, 1.6, 2.6, 2.4], font_size=8, align_right_cols=(2, 3, 4, 5, 6, 7),
            highlight_rows=highlight, caption="Onsite plan and OPE estimate")
    w.bullets([
        "**Billing:** recharged monthly in arrears at cost as disbursements, with the travel invoices and receipts "
        "attached and no mark-up, separately from iorta's fees and outside the fees to which withholding tax "
        "applies. The per diem is fixed and needs no receipts.",
        f"**Ceiling:** total OPE will not exceed the estimate by more than {price.OPE_TOLERANCE:.0%} "
        f"({b(core * (1 + price.OPE_TOLERANCE))} for the core phases) without IIFT's prior written approval.",
        "**Standards:** economy-class flights; business hotels near IIFT's office. If IIFT provides accommodation or "
        "transport, the OPE falls accordingly.",
        f"**Changes:** trips are agreed with IIFT's project manager two weeks ahead. Extra onsite days that IIFT "
        f"requests outside these phases are charged at the rate card ({b(price.ONSITE_DAY_RATE)} a day) plus OPE.",
    ])


# --- Third-party charges and licences ---------------------------------------------------
def third_party(w: ProposalWriter):
    w.h2("Third-party charges, licences and infrastructure (COM-04, COM-17)")
    w.para(f"Every third-party product, licence, service and infrastructure item is listed in the Bill of Materials "
           f"workbook ({BOM_WORKBOOK}) and summarised in Annex C. The table gives the totals.")
    infra_low, infra_high = price.bom_onprem_totals()
    tp_a, tp_b = price.third_party_annual("A"), price.third_party_annual("B")
    opt_a, opt_b = price.third_party_annual("A", True), price.third_party_annual("B", True)
    w.table(["Category", "Option A", "Option B", "Treatment"], [
        ["Runtime software: Node.js, NestJS, React, Ant Design, Prisma, PostgreSQL, nginx, ClamAV, Docker, "
         "monitoring stack", "B$ 0 licence", "B$ 0 licence", "Open source; included"],
        ["Infrastructure", f"{rng(infra_low, infra_high)} one-time (indicative)",
         f"≈ {b(price.cloud_monthly())} a month at cost", "A: IIFT procures. B: disbursement at cost or paid "
                                                          "by IIFT directly"],
        ["Operating system", f"Ubuntu LTS B$ 0; RHEL optional {rng(*price.rhel_annual())} a year",
         "In cloud actuals", "A: IIFT procures"],
        ["Required services: SMS, AML data, certificates, e-mail relay", f"{rng(*tp_a)} a year",
         f"{rng(*tp_b)} a year", "IIFT procures or pass-through at cost"],
        ["Optional: commercial PostgreSQL support, RHEL, escrow agent", f"{rng(*opt_a)} a year",
         f"{rng(*opt_b)} a year", "Only if IIFT elects them"],
        ["Cloud set-up (landing zone, environments, monitoring, backups, DR)", "Not applicable",
         f"{b(price.CLOUD_SETUP_FEE)} one-off", "iorta fee (Option B one-time fees)"],
        ["Independent VAPT and re-test", "Included (item 7)", "Included (item 7)", "Included in iorta fee"],
    ], widths=[5.6, 3.8, 3.4, 4.2], font_size=8, bold_first_col=True,
        caption="Third-party charges and licences (detail in Annex C and the BOM workbook)")
    w.para("The CI pipeline produces a CycloneDX software bill of materials (SBOM) of the production dependencies on "
           "every build. It is delivered with each release and lists every open-source package with its licence.")


# --- Rate card ------------------------------------------------------------------------
def rate_card(w: ProposalWriter):
    w.h2("Rate card (COM-16)")
    rates = [
        ("Enhancements and change requests", "Per man-day", price.ENHANCEMENT_DAY_RATE),
        ("Enhancements and change requests", "Per hour", price.ENHANCEMENT_HOUR_RATE),
        ("Onsite support, unplanned visit (plus OPE)", "Per day", price.ONSITE_DAY_RATE),
        ("After-hours support other than P1", "Per hour", price.AFTER_HOURS_HOUR_RATE),
    ]
    rows = [[item, unit, *[n(price.rate(amount, y)) for y in YEARS]] for item, unit, amount in rates]
    rows.append(["After-hours support for P1 (Critical) incidents", "Per incident", *["Included"] * 5])
    rows.append(["Exit and transition at contract end", "Fixed", *["Included"] * 5])
    w.table(["Service", "Unit", *[f"Year {y}" for y in YEARS]], rows, widths=[6.0, 2.0, 1.8, 1.8, 1.8, 1.8, 1.8],
            font_size=8, align_right_cols=(2, 3, 4, 5, 6), bold_first_col=True,
            caption="Rate card in B$ (RFP section 10 items 17–19 and 21; +5% a year)")
    w.para(f"The man-day rate is blended across roles. {price.ENHANCEMENT_HOURS_PER_YEAR} hours of minor "
           "enhancements a year are included in the AMC and the subscription. Change requests follow a written "
           "request, an impact assessment within five business days, a quotation at these rates and IIFT's written "
           "approval before work starts; quotations remain valid for 90 days.")


# --- Payment schedules ----------------------------------------------------------------
def payment_schedules(w: ProposalWriter):
    w.h2("Payment schedules")
    w.h3("Option A licence fee")
    rows = [[code, trigger, f"{share:.0%}", n(amount)]
            for code, trigger, share, amount in price.milestone_amounts(price.LICENCE_MILESTONES,
                                                                         price.licence_fee())]
    rows.append(["", "Total licence fee", "100%", n(price.licence_fee())])
    w.table(["Milestone", "Payment trigger", "Share", "Amount (B$)"], rows, widths=[2.2, 9.6, 2.0, 3.2],
            center_cols=(0, 2), align_right_cols=(3,), total_rows=1, font_size=8, caption="Licence milestones")
    w.h3("Services fee (Options A and B)")
    weeks = {"M1": 2, "M2": 6, "M4": 19, "M5": 22, "M6": 24, "M7": 28}
    rows = [[code, trigger, f"Week {weeks.get(code, '–')}", f"{share:.0%}", n(amount)]
            for code, trigger, share, amount in price.milestone_amounts(price.SERVICE_MILESTONES,
                                                                         price.services_fee())]
    rows.append(["", "Total services fee", "", "100%", n(price.services_fee())])
    w.table(["Milestone", "Payment trigger", "Target", "Share", "Amount (B$)"], rows,
            widths=[2.0, 8.6, 1.8, 1.6, 3.0], center_cols=(0, 2, 3), align_right_cols=(4,), total_rows=1,
            font_size=8, caption="Service milestones (M3, build complete, carries no payment)")
    w.h3("Recurring charges, OPE and Option C")
    w.table(["Charge", "Option", "Billing", "Year 1 invoice (B$)"], [
        ["Annual maintenance (AMC)", "A", price.AMC_BILLING, f"{price.amc(1) / 4:,.2f} per quarter"],
        ["Cloud set-up fee", "B", "At contract signing", f"{n(price.CLOUD_SETUP_FEE)} once"],
        ["Subscription", "B", "Monthly in advance from go-live", f"{n(price.subscription_monthly(1))} per month"],
        ["Managed services", "B", "Monthly in advance from go-live", f"{n(price.managed_monthly(1))} per month"],
        ["Cloud infrastructure", "B", "Monthly in arrears, disbursement at cost with provider invoices (or paid by "
                                      "IIFT directly)",
         f"≈ {n(price.cloud_monthly())} per month ({n(price.CLOUD_IMPLEMENTATION_MONTHLY)} during the project)"],
        ["OPE", "A and B", "Monthly in arrears, disbursement at cost with travel invoices", "As incurred"],
        ["Source code handover", "C", "Milestones C1–C3", f"{n(price.option_c_total())} in total"],
        ["Post-handover support (choice 2)", "C", "Quarterly in advance",
         f"{price.post_handover_support(1) / 4:,.2f} per quarter"],
    ], widths=[4.2, 1.6, 6.2, 5.0], font_size=8, bold_first_col=True, caption="Billing of recurring charges")
    w.para(f"All invoices are payable within {price.PAYMENT_TERMS_DAYS} days of receipt.")


# --- Commercial terms -----------------------------------------------------------------
def commercial_terms(w: ProposalWriter):
    w.h2("Commercial terms")
    w.key_value_table([
        ("Payment terms", f"{price.PAYMENT_TERMS_DAYS} days from invoice."),
        ("Currency", f"B$. USD amounts are indicative at USD 1 = B$ {price.FX_BND_PER_USD:.2f}. Cloud charges are "
                     "converted at the rate on the provider's invoice date."),
        ("Taxes", "Fees inclusive of WHT, borne by iorta. Cloud infrastructure and OPE are recharged at cost as "
                  "disbursements with the provider and travel invoices attached, outside the fees to which WHT "
                  "applies. No GST or VAT applies in Brunei Darussalam at present; any indirect tax introduced by "
                  "law is added at the statutory rate."),
        ("Quotation validity", f"{price.QUOTATION_VALIDITY_DAYS} days from submission (Section {sec('validity')})."),
        ("Price protection", "One-time fees are fixed. AMC, subscription, managed services and the rate card rise "
                             "by 5% a year, capped at 5% (COM-18). Cloud and third-party charges follow actual "
                             "provider prices."),
        ("User growth", "Unlimited named users for IIFT under both options; more agents, banks or branches do not "
                        "change the fees."),
        ("Additional entities", "Use by another IITH group company, such as IIGT, is priced separately (licence or "
                                "subscription, configuration and integration)."),
        ("Term", "Implementation to hypercare exit; maintenance or subscription for five years from go-live. The "
                 f"subscription's minimum term is {price.SUBSCRIPTION_MINIMUM_MONTHS} months from go-live."),
        ("Changes", f"Through change requests at the rate card (Section {csec('rate_card')})."),
    ], widths=(3.6, 13.4), caption="Commercial terms")


COMMERCIAL_ASSUMPTIONS = [
    "Scope is the RFP (sections 3–8, Appendices 1–4) as described in this proposal; changes follow the change "
    "request process.",
    "The contract is signed within the quotation validity and the project starts within four weeks of signature.",
    f"IIFT meets the dependencies in Section {sec('timeline')}. A delay of more than four weeks caused by "
    "dependencies outside iorta's control is re-planned with IIFT; extra effort is agreed as a change request.",
    "Option A: IIFT provides SIT and UAT by week 8 and week 16 and production and DR by week 20, to the sizing in "
    f"Section {sec('infrastructure')}.",
    "Option B: IIFT approves the cloud region and completes the AMBD notification before production data is "
    "loaded; the project environments run in the cloud from kick-off; the cloud set-up fee is paid at contract "
    "signing.",
    "Cloud infrastructure and OPE are recharged at cost as disbursements with the provider and travel invoices "
    "attached, outside the fees to which withholding tax applies. IIFT may instead hold the cloud account in its "
    "own name and pay the provider directly.",
    "Data migration covers agent, agency, bank, branch, participant and reference data: below 10,000 records from "
    "no more than three source extracts.",
    "Onsite presence follows the OPE schedule; all other work is remote.",
]

COMMERCIAL_EXCLUSIONS = [
    "Infrastructure, operating system licences, network and data-centre services under Option A.",
    "Cloud infrastructure under Option B (recharged at cost or paid directly) and third-party charges in the Bill "
    "of Materials.",
    "OPE, recharged at cost as set out above.",
    "Changes to IIFT's core system, FIN, AML service or other third-party systems.",
    "Use by other IITH group companies; Malay translation of screens; payment gateway; native mobile apps.",
    "Penetration tests after go-live beyond the pre-go-live VAPT and re-test (quoted on request).",
]


def commercial_assumptions(w: ProposalWriter):
    w.h2("Commercial assumptions and exclusions")
    w.para("**Assumptions**", space_after=2, keep_with_next=True)
    w.bullets(COMMERCIAL_ASSUMPTIONS)
    w.para("**Exclusions**", space_after=2, keep_with_next=True)
    w.bullets(COMMERCIAL_EXCLUSIONS)
    w.para(f"General assumptions, dependencies and exclusions are in Section {sec('assumptions')}.")


def commercials(w: ProposalWriter):
    w.h1("Commercial Proposal")
    w.para(f"This chapter sets out the commercial offer: the options, the fees in IIFT's format and in the RFP "
           f"section 10 breakdown, the terms of each option, out-of-pocket expenses, third-party charges, the rate "
           f"card and the payment schedules. The pricing workbook ({PRICING_WORKBOOK}) holds the same figures with "
           f"live formulas, and the Bill of Materials ({BOM_WORKBOOK}) lists every infrastructure and third-party "
           "item.")
    builders = {
        "summary": commercial_summary, "client_format": client_format, "rfp10": rfp_section10,
        "option_a": option_a, "option_b": option_b, "option_c": option_c, "tco": five_year_cost,
        "ope": ope_schedule, "third_party": third_party, "rate_card": rate_card, "payments": payment_schedules,
        "terms": commercial_terms, "assumptions": commercial_assumptions,
    }
    for key in COMMERCIAL_SECTIONS:
        builders[key](w)
        assert f"{w.chapter}.{w.section_no}" == csec(key), f"Commercial section numbering out of step at {key}"


# =============================================================================
# Validity
# =============================================================================
def validity(w: ProposalWriter):
    w.h1("Quotation Validity", new_page=False)
    w.paras([
        f"This proposal and the prices quoted are valid for **{price.QUOTATION_VALIDITY_DAYS} days from the date of "
        "submission** ([submission date] to [expiry date]).",
        "On award, the one-time fees are fixed for the implementation. The AMC, subscription, managed services and "
        "rate card follow the yearly schedule in the Commercial Proposal, with increases capped at 5% a year. Cloud "
        "infrastructure and third-party charges follow the providers' prices at the time they are incurred, and OPE "
        "is recharged at cost within the stated ceiling.",
    ])


# =============================================================================
# Supporting information
# =============================================================================
VALUE_ADDS = [
    ["Requirements compliance matrix", "All 234 requirement IDs answered line by line, with fitment (Annex A)."],
    ["Working application before contract", f"IIFT can test {PRODUCT} with its own products before signing."],
    ["Choice of commercial model", "Perpetual licence on-premise or subscription on iorta-managed cloud, priced on "
                                   "the same scope, with conversion from subscription to licence."],
    ["Source code handover option", "Core platform source code with an eight-week knowledge transfer (Option C), "
                                    "or escrow; IIFT-specific source code under every option."],
    ["Bill of Materials", "Every infrastructure item, licence and third-party service with indicative cost and who "
                          "pays, in a separate workbook."],
    ["Multi-factor authentication", "E-mail OTP or authenticator app for back-office users, delivered during implementation."],
    ["Remote participant e-signature", "Single-use e-mail link, so participants can sign without visiting a branch."],
    ["Integration monitor", "One screen for outbox messages, retries, dead-letters and reconciliation results."],
    ["End-of-day run screen", "Run, check and sign off EOD, the FIN file and reconciliation, with run history."],
    ["Retention and archival policy", "Retention period per data class, with archival of audit records and documents."],
    ["PDPO 2025 and AMBD alignment", f"Controls mapped to Brunei data protection law and AMBD expectations (Section {sec('security')})."],
    ["Shariah-appropriate terminology", "Contribution, participant, Takaful operator, wakalah and tabarru' throughout."],
    ["Accessibility", "WCAG 2.1 AA target."],
    ["Exit plan", f"Transition, data extraction and knowledge transfer defined now (Section {sec('maintenance')})."],
    ["Hardware sizing", f"Sizing for every environment for the on-premise option (Section {sec('infrastructure')})."],
    ["Unlimited users", "More banks, branches and agents at no extra licence or subscription cost."],
]


def supporting_information(w: ProposalWriter):
    w.h1("Supporting Information")
    w.h2("Value-added items beyond the RFP")
    w.table(["Item", "Benefit to IIFT"], VALUE_ADDS, widths=[5.4, 11.6], font_size=8, bold_first_col=True,
            caption="Value-added items included at no extra cost")
    w.para(f"Further supporting material: the technical document pack (Section {sec('techdocs')}), the screen "
           f"screen index (Section {sec('screens')}), the pricing workbook and the Bill of "
           "Materials workbook.")


# =============================================================================
# Terms and conditions
# =============================================================================
def _terms():
    return [
        ("Basis of contract", "This proposal, the RFP and agreed clarifications form the basis for a definitive "
         "agreement to be negotiated in good faith. In case of conflict, the signed agreement prevails."),
        ("Commercial model", "IIFT selects Option A (perpetual licence) or Option B (subscription) at award; Option "
         f"C may be exercised later on the terms in Section {csec('option_c')}."),
        ("Prices and taxes", f"Prices are in Brunei Dollars as set out in Section {sec('commercials')}. Fees are "
         "inclusive of withholding tax, which is borne by iorta TechNXT. Out-of-pocket expenses and cloud "
         "infrastructure (Option B) are recharged at cost as disbursements with the provider and travel invoices "
         "attached, outside the fees to which withholding tax applies; IIFT may instead hold the cloud account and "
         "pay the provider directly. Third-party charges are excluded and payable at cost. Any "
         "indirect tax introduced by law after submission is added at the statutory rate."),
        ("Payment terms", f"One-time fees are invoiced on the milestones in Section {csec('payments')}. Recurring "
         f"fees are invoiced as stated there. Invoices are payable within {price.PAYMENT_TERMS_DAYS} days."),
        ("Acceptance", "Deliverables and milestones are accepted by written sign-off against agreed acceptance "
         "criteria. IIFT will review within ten business days; a deliverable is deemed accepted if no material "
         "non-conformity is notified within that period or if it is used in production."),
        ("Intellectual property", f"The {PRODUCT} core platform remains the intellectual property of iorta "
         "TechNXT. Under Option A IIFT receives the perpetual licence in Section "
         f"{csec('option_a')}; under Option B a right to use for the subscription term. Configurations, reports, "
         "documentation and other work products produced specifically for IIFT belong to IIFT. Open-source "
         "components remain under their own licences."),
        ("Source code and escrow", "Source code of IIFT-specific components (configuration, integration adapters, "
         "reports, templates, migration and build scripts) is delivered at go-live and with every release under "
         "both options. Source code of the core platform is delivered under Option C, or deposited in escrow at "
         "IIFT's cost on the release conditions in Section "
         f"{csec('option_c')}."),
        ("Data ownership and protection", "All business data, including participant, agent and transaction data "
         "and documents, remains the property of IITH/IIGT/IIFT. iorta TechNXT processes personal data only on "
         "IIFT's instructions and for the purpose of the contract, applies the security controls in Section "
         f"{sec('security')}, supports IIFT's obligations under the Personal Data Protection Order 2025 and returns "
         "or securely deletes data at contract end."),
        ("Confidentiality", "Each party keeps the other's confidential information confidential, uses it only for "
         "the contract and discloses it only to personnel and approved subcontractors bound by equivalent "
         "obligations. These obligations survive termination for [five] years, and indefinitely for personal data "
         "and source code."),
        ("Warranty", f"iorta TechNXT warrants that the solution will perform materially in accordance with the "
         f"approved specifications for {price.WARRANTY_MONTHS} months from production go-live and will correct "
         "reported defects at no charge within the SLA. The warranty does not cover issues caused by changes made "
         "by others, misuse, infrastructure or third-party products outside iorta's scope."),
        ("Service levels and service credits", f"Service levels are as defined in Section {sec('maintenance')}. "
         "Where a P1 restoration target is missed, service credits apply: [e.g. 5% of the quarterly AMC or of the "
         "quarterly subscription per breach, capped at 20% of that quarter's fee]. Service credits are IIFT's "
         "financial remedy for SLA failure without prejudice to termination rights for persistent failure."),
        ("Limitation of liability", "Each party's total aggregate liability under the contract is limited to [the "
         "total fees paid and payable in the twelve months before the claim, or the one-time fees if higher]. "
         "Neither party is liable for indirect or consequential loss. The limitation does not apply to liability "
         "for fraud, wilful misconduct, breach of confidentiality or infringement of intellectual property."),
        ("Change requests", "Changes to scope follow the change request process: written request, impact assessment "
         "(scope, cost, schedule, risk) within five business days, quotation using the rate card, written approval "
         "before work starts."),
        ("Price protection", "The AMC, subscription, managed services fee and rate card increase by 5% a year and "
         "by no more than 5% a year (COM-18). One-time fees are fixed."),
        ("Personnel and subcontracting", "Key personnel are not replaced without IIFT's consent. The independent "
         "VAPT is performed by a qualified third-party tester engaged by iorta with IIFT's approval; iorta remains "
         "responsible for its subcontractors."),
        ("Term and termination", "Either party may terminate for material breach not remedied within 30 days of "
         "notice. IIFT may terminate for convenience on [90] days' notice, paying for work performed and accepted "
         "up to the termination date and, under Option B, the subscription for any remaining part of the "
         f"{price.SUBSCRIPTION_MINIMUM_MONTHS}-month minimum term. On any termination iorta provides the exit "
         f"assistance in Section {sec('maintenance')}, hands over work in progress and the source code of "
         "IIFT-specific components, and returns IIFT's data."),
        ("Force majeure", "Neither party is liable for delay or failure caused by events beyond its reasonable "
         "control (including natural disasters, pandemics, war, government action or widespread utility or network "
         "failure), provided it notifies the other party promptly and uses reasonable efforts to mitigate. If force "
         "majeure continues for more than 60 days, either party may terminate the affected services."),
        ("Governing law and disputes", "The contract is governed by the laws of Brunei Darussalam. Disputes are "
         "first escalated through the governance structure; unresolved disputes are referred to [mediation / "
         "arbitration in Brunei Darussalam] and, failing that, to the courts of Brunei Darussalam."),
        ("Validity", f"This proposal is valid for {price.QUOTATION_VALIDITY_DAYS} days from the submission date."),
    ]


def terms_and_conditions(w: ProposalWriter):
    w.h1("Terms & Conditions")
    w.para("We propose the key terms below and are willing to work from IIFT's standard contract in negotiation.")
    for number, (title, text) in enumerate(_terms(), start=1):
        w.para(f"**{w.chapter}.{number} {title}.** {text}", align="justify")


# =============================================================================
# Annexes
# =============================================================================
CV_ROLES = ["Project Manager", "Solution Architect", "Business Analyst (Takaful)", "Technical Lead",
            "QA Lead", "DevOps & Security Engineer"]
CV_COLUMNS = ["Proposed role", "Name", "Qualifications", "Years of experience (insurance/Takaful)",
              "Relevant projects (project, client, role, year)"]

PORTS = [
    ["Internet / bank network", "WAF / load balancer", "443 (HTTPS)", "Portal and e-sign"],
    ["IIFT LAN", "Internal reverse proxy", "443 (HTTPS)", "Back-office"],
    ["Load balancer / proxy", "Application VMs", "8080 (HTTP, internal only) or 443", "Application traffic"],
    ["Application VMs", "PostgreSQL", "5432 (TLS)", "Database"],
    ["Application VMs", "Active Directory", "636 (LDAPS)", "Back-office SSO"],
    ["Application VMs", "SMTP relay", "587 (STARTTLS)", "E-mail"],
    ["Application VMs", "Core / FIN / AML / SMS", "443 (HTTPS) or 22 (SFTP)", "Integrations"],
    ["Monitoring server", "Application VMs", "9100 / 9464 (metrics)", "Monitoring"],
    ["PostgreSQL primary", "Standby / DR replica", "5432 (TLS)", "Replication"],
]

GLOSSARY = [
    ["Takaful", "Islamic insurance based on mutual co-operation and shared responsibility, in which participants "
                "contribute to a common fund to help one another against defined risks."],
    ["Takaful operator", "The company (here IIFT) that manages the Takaful fund on behalf of participants."],
    ["Participant", "The person or entity that joins a Takaful plan and makes contributions (the Takaful equivalent "
                    "of a policyholder)."],
    ["Contribution", "The amount paid by the participant for Takaful cover (the Takaful equivalent of a premium)."],
    ["Tabarru'", "The portion of the contribution donated to the participants' risk fund to help fellow participants "
                 "who suffer a covered loss."],
    ["Wakalah", "An agency contract under which the Takaful operator manages the fund for a fee (wakalah fee)."],
    ["Participants' risk fund", "The fund made up of tabarru' contributions from which claims are paid."],
    ["Nominee / beneficiary / executor", "Persons designated to receive Takaful benefits or administer them on the "
                                         "participant's behalf."],
    ["Mortgage Takaful", "Decreasing-term Takaful protecting a financing facility (hire purchase or property)."],
    ["Banca / bancassurance", "Distribution of Takaful products through bank partners and bank officers."],
    ["Main agent / sub-agent", "Hierarchical agency relationship in which a main agent supervises sub-agents."],
    ["e-Policy / e-Receipt", "Electronic policy document and receipt issued to the participant."],
    ["Grace period", "Period (seven days) within which payment for an issued policy must be submitted before the "
                     "agency's issuance is blocked."],
    ["Maker-checker", "Control in which a transaction prepared by one user (maker) must be approved by another "
                      "(checker) before it takes effect."],
    ["Quality check (QC)", "Review of an application by IIFT before contract issuance."],
    ["End-of-day (EOD)", "Daily batch that produces issuance reports, interfaces postings to FIN and reconciles with BRR."],
    ["Transactional outbox", "Integration pattern in which outbound messages are stored in the same database "
                             "transaction as the business change and delivered asynchronously, guaranteeing no loss."],
    ["Dead-letter", "Holding area for messages that could not be delivered after the maximum number of retries."],
    ["Blind index", "Keyed hash of an encrypted value that allows exact-match search without decrypting data."],
    ["Modular monolith", "Single deployable application internally divided into independent modules with clear "
                         "boundaries."],
    ["Hypercare", "Period of intensified support immediately after go-live."],
    ["Point-in-time recovery", "Ability to restore the database to any moment using base backups and transaction logs."],
    ["Perpetual licence", "A licence with no end date, paid once; maintenance (AMC) is charged separately."],
    ["Subscription", "A right to use software for a term, paid periodically, with maintenance included."],
    ["Annual maintenance charge (AMC)", "Yearly fee for support, maintenance, patches and upgrades of licensed "
                                        "software, here 22% of the licence and customisation fees."],
    ["At actuals / pass-through", "A cost re-charged at the amount the provider invoices, without mark-up."],
    ["Per diem", "Fixed daily allowance for meals and local transport during onsite work."],
    ["Source code escrow", "Deposit of source code with an independent agent, released to the customer only on "
                           "agreed events such as the supplier's insolvency."],
]


def bom_annex(w: ProposalWriter):
    """Annex C: summary of the Bill of Materials, software components and network flows."""
    w.h1("Annex C – Bill of Materials, Software Components and Network Flows", numbered=False)
    w.para(f"This annex summarises the Bill of Materials workbook ({BOM_WORKBOOK}). Indicative costs are for "
           "budgeting; items marked IIFT procures are bought by IIFT and are not part of iorta's fees.")
    w.h3("On-premise infrastructure (Option A, IIFT procures)")
    rows, group = [], None
    for grp, server, qty, qty_n, cpu, ram, disk, software, _, (low, high), note in price.ON_PREM_BOM:
        if grp != group:
            group = grp
            rows.append(("GROUP", grp))
        rows.append([server, qty, cpu, ram, disk, rng(qty_n * low, qty_n * high)])
    rows.append(["Total, indicative one-time", "", "", "", "", rng(*price.bom_onprem_totals())])
    w.table(["Server / item", "Qty", "vCPU", "RAM", "Storage", "Indicative cost (B$)"], rows,
            widths=[4.6, 2.6, 1.3, 1.6, 3.0, 3.9], font_size=8, center_cols=(1, 2, 3), align_right_cols=(5,),
            total_rows=1, padding=25, caption="Option A infrastructure, sized as in the Solution Architecture")
    w.para(f"Operating system: Ubuntu Server 24.04 LTS (no licence fee) or RHEL 9 "
           f"({rng(*price.rhel_annual())} a year for {price.os_vm_count()} VMs). Virtualisation, network, firewall, "
           "backup platform and SIEM are existing IITH services. Costs fall where existing IITH capacity is used.")
    w.h3("Software components")
    w.table(["Component", "Version", "Role", "Licence", "Fee"],
            [[c, v, r, lic, "B$ 0" if not lic.startswith("Ubuntu") else "B$ 0 / RHEL optional"]
             for c, v, r, lic in price.SOFTWARE_COMPONENTS],
            widths=[4.6, 2.4, 4.6, 3.2, 2.2], font_size=7.5, padding=20, caption="Runtime software components")
    w.h3("Third-party services and optional items")
    rows = []
    for item in price.THIRD_PARTY_ITEMS:
        low, high = price.third_party_cost(item)
        cost = "Included" if item[2] == price.INCLUDED else ("–" if high == 0 else f"{low:,}–{high:,} a year")
        rows.append([item[0] + ("" if item[5] else " (optional)"), item[2], item[3], cost])
    w.table(["Item", "Option A", "Option B", "Indicative cost (B$)"], rows, widths=[6.0, 3.6, 3.6, 3.8],
            font_size=7.5, padding=20, caption="Third-party services and treatment")
    w.h3("Network flows and storage growth")
    w.table(["From", "To", "Port / protocol", "Purpose"], PORTS, widths=[4.0, 4.4, 4.4, 4.2], font_size=8,
            caption="Network flows")
    w.table(["Data", "Year 1", "Year 5", "Notes"], [
        ["Structured data (PostgreSQL)", "< 1 GB", "< 5 GB", "Policies, participants, payments, audit"],
        ["Documents", "10–20 GB", "50–100 GB", "Uploads and system-produced PDFs"],
        ["Logs (online)", "About 20 GB", "About 20 GB", "Rolling retention; archived to backup"],
        ["Backups", "About 150 GB", "About 600 GB", "35 days online plus monthly copies"],
    ], widths=[4.6, 2.6, 2.6, 7.2], font_size=8, caption="Storage growth estimate")


def annexes(w: ProposalWriter):
    w.landscape_section()
    w.h1("Annex A – Requirements Compliance and Fitment Matrix", numbered=False, new_page=False)
    w.para("Every requirement ID in the RFP is listed. **Compliance**: Fully Compliant is a standard capability of the "
           "delivered solution; Compliant – configuration is met by setting rules, parameters or master data; "
           "Compliant – custom is met by IIFT-specific work inside the fixed price. **Fitment** uses the four "
           f"categories in Section {sec('fitment')}. Priority follows RFP Appendix 4. The RFP uses the prefix COM for "
           "both shared platform (section 4.4) and commercial (section 6) requirements; each set is listed under its "
           "section, and commercial items carry no fitment.")
    rows = []
    for group_index, (group, items) in enumerate(cm.MATRIX):
        rows.append(("GROUP", group))
        for rid, requirement, priority, compliance, how in items:
            code = cm.fitment(group_index, rid)
            rows.append([rid, requirement, cm.PRIORITY_LABELS[priority], cm.COMPLIANCE_LABELS[compliance],
                         cm.FITMENT_LABELS[code] if code else "Commercial", how])
    w.table(["ID", "Requirement", "Priority", "Compliance", "Fitment", "How addressed"], rows,
            widths=[1.6, 4.8, 1.4, 3.1, 3.4, 11.4], font_size=7.5, center_cols=(2,), bold_first_col=True,
            padding=20, caption="Requirements compliance and fitment matrix")

    w.portrait_section()
    w.h1("Annex B – Curricula Vitae of Key Personnel", numbered=False, new_page=False)
    w.para(f"Key personnel from Section {sec('team')} are summarised below; full CVs are attached. [Complete the "
           "table and attach one CV per person.]")
    w.table(CV_COLUMNS, [[role, "[Full name]", "[Degrees, certifications]", "[Years]", "[3 to 5 projects]"]
                         for role in CV_ROLES], widths=[3.4, 2.8, 3.4, 2.8, 4.6], font_size=8, bold_first_col=True,
            caption="Key personnel summary")

    bom_annex(w)

    w.h1("Annex D – Glossary", numbered=False)
    w.table(["Term", "Meaning"], GLOSSARY, widths=[4.4, 12.6], font_size=8, bold_first_col=True)
