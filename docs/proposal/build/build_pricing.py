"""Build the client-facing commercial pricing workbook (.xlsx).

Usage:
    python3 docs/proposal/build/build_pricing.py

All figures come from pricing_data.py. Totals, annualisations, milestone
amounts, OPE trip costs and USD conversions are live Excel formulas. Yearly
escalated amounts (AMC, subscription, managed services, rate card for Years 2
to 5) are entered as values rounded to the nearest B$, exactly as in the
proposal. After writing, the script recomputes the workbook and checks every
key total against pricing_data.py, and (if LibreOffice is installed)
recalculates it to confirm no cell evaluates to an error.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from openpyxl import Workbook       # noqa: E402

import brand                        # noqa: E402
import pricing_data as price        # noqa: E402
from xlsx_kit import (MONEY, PERCENT, FormulaEvaluator, SheetWriter, add_logo, finish,  # noqa: E402
                      recalc_errors, recalculated_values, set_widths)

FX = "Summary!$C$11"
YEARS = list(range(1, price.CONTRACT_YEARS + 1))
REFS = {}          # name -> "'Sheet'!$X$n"


def ref(sheet, col, row, absolute=True):
    cell = f"${col}${row}" if absolute else f"{col}{row}"
    return f"'{sheet}'!{cell}" if " " in sheet else f"{sheet}!{cell}"


def usd(cell):
    return f"=ROUND({cell}/{FX},0)"


# =============================================================================
# Option A
# =============================================================================
def option_a_sheet(wb):
    name = "Option A"
    ws = wb.create_sheet(name)
    set_widths(ws, [7, 50, 16, 15, 15, 15, 13, 80])
    s = SheetWriter(ws, 8)
    s.title(price.OPTION_TITLES["A"] + ": licence, implementation and annual maintenance")

    s.section("1. One-time fees (RFP section 10 numbering)")
    s.header(["No", "Component", "Basis", "Agent/Banca Portal (B$)", "Back-office (B$)", "Total (B$)",
              "In AMC base", "Scope"])
    first = s.row
    flagged = []
    for i, (no, key, component, basis, portal, backoffice, in_base, note) in enumerate(price.ONE_TIME_ITEMS):
        r = s.row
        s.line([no, component, basis, portal, backoffice, f"=D{r}+E{r}", "Yes" if in_base else "No", note],
               money=(4, 5, 6), center=(1, 7), zebra=i % 2 == 1)
        if in_base:
            flagged.append(r)
        if key == "licence":
            REFS["a_licence"] = ref(name, "F", r)
            REFS["a_licence_p"], REFS["a_licence_b"] = ref(name, "D", r), ref(name, "E", r)
    last = s.row - 1
    r = s.line(["", "Total one-time fees, Option A", "", f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})",
                f"=SUM(F{first}:F{last})", "", "Fixed price; inclusive of WHT; exclusive of OPE and third-party "
                                               "charges"], money=(4, 5, 6), total=True)
    REFS["a_one_portal"], REFS["a_one_bo"], REFS["a_one_total"] = ref(name, "D", r), ref(name, "E", r), ref(name, "F", r)
    s.line(["", "of which licence (item 1)", "", f"={REFS['a_licence_p']}", f"={REFS['a_licence_b']}",
            f"={REFS['a_licence']}", "", "Paid against licence milestones L1–L3"], money=(4, 5, 6))
    r2 = s.line(["", "of which services (items 2–10)", "", f"=D{r}-D{r + 1}", f"=E{r}-E{r + 1}", f"=F{r}-F{r + 1}",
                 "", "Paid against service milestones M1–M7; same under Option B"], money=(4, 5, 6))
    REFS["a_services"] = ref(name, "F", r2)
    s.skip()

    s.section("2. Integration per interface (item 3, COM-05)")
    s.header(["No", "Interface", "Basis", "Agent/Banca Portal (B$)", "Back-office (B$)", "Total (B$)", "", "Scope"])
    first = s.row
    for i, (iface, scope, portal, backoffice) in enumerate(price.INTERFACES, start=1):
        r = s.row
        s.line([f"3.{i}", iface, "Per interface", portal, backoffice, f"=D{r}+E{r}", "", scope],
               money=(4, 5, 6), center=(1,), zebra=i % 2 == 0)
    last = s.row - 1
    s.line(["", "Total integration (agrees with item 3)", "", f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})",
            f"=SUM(F{first}:F{last})", "", ""], money=(4, 5, 6), total=True)
    s.skip()

    s.section("3. Annual maintenance charge (AMC): 22% of licence and customisation, +5% a year")
    base = s.line(["", "AMC base: licence, implementation and integration (items flagged Yes)", "",
                   "=" + "+".join(f"D{r}" for r in flagged), "=" + "+".join(f"E{r}" for r in flagged),
                   "=" + "+".join(f"F{r}" for r in flagged), "", "Items 1, 2 and 3"], money=(4, 5, 6), bold=True)
    REFS["amc_base"] = ref(name, "F", base)
    rate = s.line(["", "AMC rate", "", None, None, price.AMC_RATE, "", "Applied to the AMC base"], pct=(6,),
                  inputs=(6,))
    s.line(["", "Yearly increase (capped, COM-18)", "", None, None, price.ESCALATION, "",
            "Years 2–5 are escalated from Year 1 and rounded to the nearest B$"], pct=(6,))
    s.header(["Year", "Focus (RFP section 9)", "Basis", "Agent/Banca Portal (B$)", "Back-office (B$)", "AMC (B$)",
              "Per quarter (B$)", "Activities"])
    first = s.row
    for _, year, focus, description in price.MAINTENANCE_PLAN:
        r = s.row
        portal = f"=ROUND(D{base}*$F${rate},0)" if year == 1 else price.amc_portal(year)
        backoffice = f"=ROUND(E{base}*$F${rate},0)" if year == 1 else price.amc_backoffice(year)
        s.line([f"Year {year}", focus, "Annual", portal, backoffice, f"=D{r}+E{r}", f"=F{r}/4", description],
               money=(4, 5, 6), money2=(7,), zebra=year % 2 == 0)
        REFS[f"amc_{year}"] = ref(name, "F", r)
        REFS[f"amc_{year}_p"], REFS[f"amc_{year}_b"] = ref(name, "D", r), ref(name, "E", r)
    last = s.row - 1
    r = s.line(["Total", "Five years", "", f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})",
                f"=SUM(F{first}:F{last})", "", ""], money=(4, 5, 6), total=True)
    REFS["amc_total"] = ref(name, "F", r)
    s.skip()
    s.section("AMC inclusions")
    s.bullets(price.MAINTENANCE_INCLUSIONS)
    s.skip()
    s.section("Licence terms (COM-02)")
    s.bullets([
        f"Perpetual, non-exclusive, non-transferable enterprise licence to {brand.PRODUCT} (Agent/Banca Portal and "
        "Back-office) for IIFT's internal business; no renewal fee.",
        "Unlimited named and concurrent users; production, DR and non-production environments included.",
        "Use by another IITH group company (e.g. IIGT) needs an additional entity licence, priced separately.",
        f"Billing of the AMC: {price.AMC_BILLING.lower()}. Warranty: {price.WARRANTY_MONTHS} months from go-live.",
    ])
    ws.freeze_panes = "C4"


# =============================================================================
# Option B
# =============================================================================
def option_b_sheet(wb):
    name = "Option B"
    ws = wb.create_sheet(name)
    set_widths(ws, [9, 50, 16, 15, 15, 15, 15, 70])
    s = SheetWriter(ws, 8)
    s.title(price.OPTION_TITLES["B"] + ": implementation, subscription, managed services and cloud at actuals")

    s.section("1. Implementation fee (same scope and fees as Option A items 2–10)")
    s.header(["No", "Component", "Basis", "Agent/Banca Portal (B$)", "Back-office (B$)", "Total (B$)", "", "Scope"])
    first = s.row
    for i, (no, key, component, basis, portal, backoffice, _, note) in enumerate(
            [item for item in price.ONE_TIME_ITEMS if item[1] != "licence"]):
        r = s.row
        s.line([no, component, basis, portal, backoffice, f"=D{r}+E{r}", "", note], money=(4, 5, 6), center=(1,),
               zebra=i % 2 == 1)
    last = s.row - 1
    r = s.line(["", "Total implementation fee, Option B", "", f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})",
                f"=SUM(F{first}:F{last})", "", "Paid against service milestones M1–M7"], money=(4, 5, 6), total=True)
    REFS["b_one_portal"], REFS["b_one_bo"], REFS["b_one_total"] = ref(name, "D", r), ref(name, "E", r), ref(name, "F", r)
    setup = s.line(["5", "Cloud set-up: landing zone, PROD/DR/UAT environments, monitoring, backups, DR", "One-off",
                    None, None, price.CLOUD_SETUP_FEE, "",
                    "RFP item 5 (one-off part); payable at contract signing; not part of the AMC base"],
                   money=(4, 5, 6), center=(1,))
    REFS["b_setup"] = ref(name, "F", setup)
    r = s.line(["", "Total one-time fees, Option B", "", None, None, f"=F{r}+F{setup}", "",
                "Inclusive of WHT; exclusive of OPE, cloud infrastructure and third-party charges"],
               money=(4, 5, 6), total=True)
    REFS["b_one_all"] = ref(name, "F", r)
    s.skip()

    s.section(f"2. Subscription (+5% a year; minimum term {price.SUBSCRIPTION_MINIMUM_MONTHS} months from go-live)")
    s.header(["Year", "Item", "Basis", "Portal per month (B$)", "Back-office per month (B$)", "Total per month (B$)",
              "Per year (B$)", "Notes"])
    first = s.row
    for year in YEARS:
        r = s.row
        s.line([f"Year {year}", "Subscription: right to use, maintenance and support, application management",
                "Monthly in advance", price.subscription_monthly_portal(year),
                price.subscription_monthly_backoffice(year), f"=D{r}+E{r}", f"=F{r}*12",
                "Year 1 rates as quoted; later years escalated by 5% and rounded to the nearest B$" if year == 1
                else ""], money=(4, 5, 6, 7), zebra=year % 2 == 0)
        REFS[f"sub_{year}"] = ref(name, "G", r)
        REFS[f"sub_{year}_m"] = ref(name, "F", r)
        REFS[f"sub_{year}_p"] = f"={ref(name, 'D', r)}*12"
        REFS[f"sub_{year}_b"] = f"={ref(name, 'E', r)}*12"
    last = s.row - 1
    r = s.line(["Total", "Five years", "", "", "", "", f"=SUM(G{first}:G{last})", ""], money=(7,), total=True)
    REFS["sub_total"] = ref(name, "G", r)
    s.line(["", f"Minimum term value ({price.SUBSCRIPTION_MINIMUM_MONTHS} months)", "", "", "", "",
            f"=SUM(G{first}:G{first + price.SUBSCRIPTION_MINIMUM_MONTHS // 12 - 1})",
            "Payable if IIFT ends the subscription early other than for iorta's breach"], money=(7,))
    s.skip()

    s.section("3. Managed services by iorta (+5% a year)")
    s.header(["Year", "Item", "Basis", "Per month (B$)", "Per year (B$)", "Inclusions"], merge_from=6)
    first = s.row
    for year in YEARS:
        r = s.row
        s.line([f"Year {year}", "Managed services: cloud operations, monitoring, patching, backups, DR, security",
                "Monthly in advance", price.managed_monthly(year), f"=D{r}*12",
                price.MANAGED_SERVICES_INCLUSIONS[year - 1]], money=(4, 5), zebra=year % 2 == 0, merge_from=6)
        REFS[f"ms_{year}"] = ref(name, "E", r)
        REFS[f"ms_{year}_m"] = ref(name, "D", r)
    last = s.row - 1
    r = s.line(["Total", "Five years", "", None, f"=SUM(E{first}:E{last})", price.MANAGED_SERVICES_INCLUSIONS[-1]],
               money=(4, 5), total=True, merge_from=6)
    REFS["ms_total"] = ref(name, "E", r)
    s.skip()

    s.section(f"4. Cloud infrastructure recharged at cost (disbursement) – estimate ({price.CLOUD_REGION})")
    s.header(["No", "Service", "Billing basis", "B$ per month", "B$ per year", "Reference sizing"], merge_from=6)
    first = s.row
    for i, ((service, purpose, monthly), sizing) in enumerate(zip(price.CLOUD_MONTHLY_ITEMS, price.CLOUD_SIZING),
                                                               start=1):
        r = s.row
        s.line([i, f"{service} ({purpose})", "At cost (disbursement)", monthly, f"=D{r}*12", sizing],
               money=(4, 5), center=(1,), zebra=i % 2 == 0, merge_from=6)
    last = s.row - 1
    r = s.line(["", "Total, production run", "", f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})",
                "Recharged monthly in arrears as a disbursement with provider invoices; no mark-up"], money=(4, 5),
               total=True,
               merge_from=6)
    REFS["cloud_month"], REFS["cloud_year"] = ref(name, "D", r), ref(name, "E", r)
    r = s.line(["", f"Project environments before go-live (DEV, SIT, UAT), {price.CLOUD_IMPLEMENTATION_MONTHS} months",
                "At cost (disbursement)", price.CLOUD_IMPLEMENTATION_MONTHLY,
                f"=D{s.row}*{price.CLOUD_IMPLEMENTATION_MONTHS}", "One-off, during implementation; scaled down"],
               money=(4, 5), merge_from=6)
    REFS["cloud_project"] = ref(name, "E", r)
    r = s.line(["", "Cloud estimate, project plus five years", "", None,
                f"=E{r}+{price.CONTRACT_YEARS}*{REFS['cloud_year']}", "Estimate only; IIFT pays actual charges"],
               money=(4, 5), total=True, merge_from=6)
    REFS["cloud_total"] = ref(name, "E", r)
    s.skip()

    s.section("5. Option B over five years")
    s.header(["", "Element", "Treatment", "B$", "Notes"], merge_from=5)
    rows = [
        ("Implementation fee", "iorta fee", f"={REFS['b_one_total']}", "Fixed price"),
        ("Cloud set-up fee", "iorta fee", f"={REFS['b_setup']}", "One-off, at contract signing"),
        ("Subscription, Years 1–5", "iorta fee", f"={REFS['sub_total']}", "+5% a year"),
        ("Managed services, Years 1–5", "iorta fee", f"={REFS['ms_total']}", "+5% a year"),
        ("OPE, core onsite phases (estimate)", "Disbursement", "='OPE'!$L$" + "{core}", "At cost; per diem fixed"),
        ("Cloud infrastructure (estimate)", "Disbursement", f"={REFS['cloud_total']}",
         "At cost, no mark-up, or paid by IIFT directly"),
    ]
    first = s.row
    for label, treatment, formula, notes in rows:
        s.line(["", label, treatment, formula, notes], money=(4,), merge_from=5)
    REFS["b_summary_rows"] = (first, s.row - 1)
    r = s.line(["", "Five-year total, Option B", "", f"=SUM(D{first}:D{s.row - 1})", ""], money=(4,),
               total=True, merge_from=5)
    REFS["b_tco"] = ref(name, "D", r)
    s.skip()
    s.section("Subscription inclusions")
    s.bullets(price.SUBSCRIPTION_INCLUSIONS)
    s.note("Hosting in a cloud account dedicated to IIFT: held by iorta with charges recharged at cost as "
           "disbursements (provider invoices attached), or held in IIFT's name with IIFT paying the provider "
           "directly. IIFT makes the AMBD "
           "outsourcing and cloud notification; a Brunei-hosted alternative can be priced on request. Data is "
           "returned in open formats at exit and then deleted with a certificate.")
    ws.freeze_panes = "C4"
    return ws


# =============================================================================
# OPE
# =============================================================================
def ope_sheet(wb):
    name = "OPE"
    ws = wb.create_sheet(name)
    set_widths(ws, [44, 26, 12, 9, 8, 11, 11, 11, 11, 11, 9, 13, 11])
    s = SheetWriter(ws, 13)
    s.title("Out-of-pocket expenses (OPE): onsite plan and estimate, recharged at cost as disbursements")
    s.section("1. Unit rates (B$)")
    s.header(["Cost item", "From Malaysia", "From India", "Basis"], height=20, merge_from=(4, 9))
    origins = list(price.ORIGINS)
    unit = {}
    for label, idx, basis in (("Return airfare (economy)", 0, "Per trip, at actuals"),
                              ("Travel insurance", 1, "Per trip, at actuals"),
                              ("Airport transfers", 2, "Per trip, at actuals"),
                              ("Visa", 3, "Per trip, at actuals")):
        r = s.line([label, *[price.ORIGINS[o][idx] for o in origins], basis], money=(2, 3), inputs=(2, 3), merge_from=(4, 9))
        unit[idx] = r
    hotel = s.line(["Accommodation per night", price.HOTEL_PER_NIGHT, price.HOTEL_PER_NIGHT, "Per night, at actuals"],
                   money=(2, 3), inputs=(2, 3), merge_from=(4, 9))
    per_diem_usd = s.line(["Per diem (USD per day)", price.PER_DIEM_USD, price.PER_DIEM_USD,
                           "Fixed; per day onsite including travel days"], money=(2, 3), inputs=(2, 3), merge_from=(4, 9))
    per_diem = s.line(["Per diem (B$ per day)", f"=ROUND(B{per_diem_usd}*{FX},0)", f"=ROUND(C{per_diem_usd}*{FX},0)",
                       "Converted at the indicative rate on the Summary sheet"], money=(2, 3), merge_from=(4, 9))
    s.skip()
    s.section("2. Onsite plan and estimate")
    s.header(["Phase", "Role", "From", "Nights", "Days", "Airfare", "Hotel", "Per diem", "Insurance", "Transfers",
              "Visa", "Total (B$)", "Type"])
    col = {"Malaysia": "B", "India": "C"}
    rows = {"core": [], "optional": []}
    for i, trip in enumerate(price.ONSITE_PLAN):
        r = s.row
        c = col[trip.origin]
        s.line([trip.phase, trip.role, trip.origin, trip.nights, f"=D{r}+1", f"=${c}${unit[0]}",
                f"=D{r}*${c}${hotel}", f"=E{r}*${c}${per_diem}", f"=${c}${unit[1]}", f"=${c}${unit[2]}",
                f"=${c}${unit[3]}", f"=SUM(F{r}:K{r})", "Optional (Option C)" if trip.optional else "Core"],
               money=(6, 7, 8, 9, 10, 11, 12), center=(4, 5), zebra=i % 2 == 1)
        rows["optional" if trip.optional else "core"].append(r)
    core = s.line(["Core onsite phases", "", "", f"=SUM(D{rows['core'][0]}:D{rows['core'][-1]})", "", "", "", "",
                   "", "", "", f"=SUM(L{rows['core'][0]}:L{rows['core'][-1]})", ""], money=(12,), center=(4,),
                  total=True)
    optional = s.line(["Option C knowledge transfer (optional)", "", "",
                       f"=SUM(D{rows['optional'][0]}:D{rows['optional'][-1]})", "", "", "", "", "", "", "",
                       f"=SUM(L{rows['optional'][0]}:L{rows['optional'][-1]})", ""], money=(12,), center=(4,))
    total = s.line(["Total including Option C", "", "", "", "", "", "", "", "", "", "", f"=L{core}+L{optional}", ""],
                   money=(12,), total=True)
    ceiling = s.line([f"Ceiling without IIFT's prior approval: estimate + {price.OPE_TOLERANCE:.0%} (core phases)",
                      "", "", "", "", "", "", "", "", "", "", f"=ROUND(L{core}*{1 + price.OPE_TOLERANCE},0)", ""],
                     money=(12,))
    REFS["ope_core"], REFS["ope_optional"], REFS["ope_total"] = (ref(name, "L", core), ref(name, "L", optional),
                                                                 ref(name, "L", total))
    REFS["ope_ceiling"] = ref(name, "L", ceiling)
    s.skip()
    s.section("3. Rules")
    s.bullets([
        "Recharged monthly in arrears at cost as disbursements, with travel invoices and receipts attached and no "
        "mark-up, outside the fees to which WHT applies; the per diem is fixed and needs no receipts.",
        f"Total OPE will not exceed the estimate by more than {price.OPE_TOLERANCE:.0%} without IIFT's prior written "
        "approval.",
        "Economy-class flights; business hotels near IIFT's office. Accommodation or transport provided by IIFT "
        "reduces the OPE.",
        "Trips agreed with IIFT's project manager two weeks ahead; all other work is remote from Malaysia and India.",
        f"Extra onsite days requested by IIFT outside these phases: rate card (B$ {price.ONSITE_DAY_RATE} a day in "
        "Year 1) plus OPE.",
    ], columns=12)
    ws.freeze_panes = "C4"
    return core


# =============================================================================
# Option C
# =============================================================================
def option_c_sheet(wb):
    name = "Option C"
    ws = wb.create_sheet(name)
    set_widths(ws, [9, 62, 26, 15, 15, 15, 60])
    s = SheetWriter(ws, 7)
    s.title(price.OPTION_TITLES["C"] + ": core source code with knowledge transfer and transition")
    s.section("1. Price")
    s.header(["", "Component", "Basis", "Amount (B$)", "Amount (USD)", "Notes"], merge_from=6)
    lic = s.line(["", "Source code licence (SalesVerse 2.0 core platform)", "One-off", price.SOURCE_CODE_LICENCE,
                  usd(f"D{s.row}"), "Use, modify and maintain for IIFT and IITH group internal use; no resale"],
                 money=(4, 5), merge_from=6)
    kt = s.line(["", f"Knowledge transfer and transition ({price.KNOWLEDGE_TRANSFER_WEEKS} weeks)", "One-off",
                 price.KNOWLEDGE_TRANSFER, usd(f"D{s.row}"), "After go-live and hypercare exit"], money=(4, 5),
                merge_from=6)
    total = s.line(["", "Total Option C", "", f"=D{lic}+D{kt}", usd(f"D{s.row}"),
                    "Exclusive of OPE (onsite weeks at actuals)"], money=(4, 5), total=True, merge_from=6)
    REFS["c_total"] = ref(name, "D", total)
    s.line(["", "OPE for onsite knowledge transfer (estimate)", "At cost (disbursement)", f"={REFS['ope_optional']}",
            usd(f"D{s.row}"), "Solution Architect and Senior Developer onsite for the walkthrough weeks"],
           money=(4, 5), merge_from=6)
    s.note("Price held if Option C is exercised within 12 months of go-live; later exercise adds 5% for each further "
           "contract year.", columns=7)
    s.skip()
    s.section("2. Payment milestones")
    s.header(["Code", "Payment trigger", "Component", "Share", "Amount (B$)"], merge_from=(5, 5))
    first = s.row
    for code, trigger, component, share in price.SOURCE_CODE_MILESTONES:
        base = lic if component == "Source code licence" else kt
        s.line([code, trigger, component, share, f"=ROUND(D{s.row}*$D${base},0)"], money=(5,), pct=(4,),
               center=(1,))
    s.line(["", "Total", "", None, f"=SUM(E{first}:E{s.row - 1})"], money=(5,), total=True)
    s.skip()
    s.section("3. Knowledge transfer and transition plan")
    s.header(["Week", "Activity", "Outcome"], merge_from=(3, 3))
    for wk, activity, outcome in price.KT_PLAN:
        s.line([wk, activity, outcome], center=(1,), zebra=wk % 2 == 0)
    s.note("Acceptance: handover certificate signed when IIFT's team builds and deploys a release to SIT from the "
           "delivered repository without iorta's help, resolves tickets in the reverse-shadow weeks and receives the "
           "documentation set.")
    s.skip()
    s.section("4. Deliverables")
    s.bullets(price.SOURCE_CODE_DELIVERABLES)
    s.note("Source code of IIFT-specific components (configuration, adapters, reports, templates, migration and "
           "build scripts) is delivered under every option (RFP DEL-11); Option C adds the core platform.")
    s.skip()
    s.section("5. Support after handover – choice 2: platform updates and L3 support at 10% of the AMC base")
    base = s.line(["", "AMC base (Option A sheet)", "", f"={REFS['amc_base']}"], money=(4,))
    rate = s.line(["", "Rate", "In place of the AMC", price.POST_HANDOVER_SUPPORT_RATE], pct=(4,), inputs=(4,))
    s.header(["Year", "Support after handover", "Basis", "Choice 2 (B$)", "Full AMC (B$)", "Difference (B$)",
              "Notes"])
    first = s.row
    for year in YEARS:
        r = s.row
        value = f"=ROUND(D{base}*D{rate},0)" if year == 1 else price.post_handover_support(year)
        s.line([f"Year {year}", "Platform updates, security patches, L3 support for the core", "Quarterly in advance",
                value, f"={REFS[f'amc_{year}']}", f"=E{r}-D{r}",
                "Pro rata from the month after the handover certificate" if year == 1 else ""],
               money=(4, 5, 6), zebra=year % 2 == 0)
    last = s.row - 1
    r = s.line(["Total", "Five years", "", f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})",
                f"=SUM(F{first}:F{last})", ""], money=(4, 5, 6), total=True)
    REFS["ph_total"] = ref(name, "D", r)
    REFS["ph_1"] = ref(name, "D", first)
    s.note("Choice 1: continue the full AMC. Choice 3: rate card only, no retainer.")
    s.skip()
    s.section("6. Escrow alternative (instead of Option C)")
    s.header(["", "Item", "Basis", "B$ per year", "Notes"], merge_from=5)
    s.line(["", "Escrow agent fees, indicative (low)", "Pass-through at cost", price.ESCROW_ANNUAL_ESTIMATE[0],
            "Paid by IIFT; iorta's deposits included"], money=(4,), merge_from=5)
    s.line(["", "Escrow agent fees, indicative (high)", "Pass-through at cost", price.ESCROW_ANNUAL_ESTIMATE[1],
            "Release on insolvency, ceasing to trade or to support the product, or uncured material breach"],
           money=(4,), merge_from=5)
    ws.freeze_panes = "C4"


# =============================================================================
# RFP section 10
# =============================================================================
def rfp10_sheet(wb):
    name = "RFP Section 10"
    ws = wb.create_sheet(name)
    set_widths(ws, [6, 40, 18, 13, 13, 13, 13, 13, 13, 36, 36, 64])
    s = SheetWriter(ws, 12)
    s.title("Commercial pricing breakdown, RFP section 10 (items 1–21), Option A and Option B")
    s.header(["No", "Commercial component", "Pricing basis", "A: Portal (B$)", "A: Back-office (B$)", "A: Total (B$)",
              "B: Portal (B$)", "B: Back-office (B$)", "B: Total (B$)", "Option A: rate / treatment",
              "Option B: rate / treatment", "Remarks"], height=32)
    rows_a = {r["no"]: r for r in price.rfp_section10_rows("A")}
    rows_b = {r["no"]: r for r in price.rfp_section10_rows("B")}
    one_time, recurring = [], []
    for no in range(1, 22):
        a, b = rows_a[no], rows_b[no]
        r = s.row
        values = [no, a["component"] if no != 1 else "Software / application licence", a["basis"],
                  a["portal"], a["backoffice"], f"=D{r}+E{r}" if a["portal"] is not None else None,
                  b["portal"], b["backoffice"],
                  f"=G{r}+H{r}" if b["portal"] is not None else b["amount"],
                  a["text"] or "", b["text"] or "", a["remark"] if no not in range(12, 17) else
                  f"{a['remark']} Option B: subscription for the year."]
        s.line(values, money=(4, 5, 6, 7, 8, 9), center=(1,), zebra=no % 2 == 0)
        if a["category"] == "one-time" or b["category"] == "one-time":
            one_time.append(r)
        if a["category"] == "recurring":
            recurring.append(r)
        if no == 11:
            cols = "DEFGHI"
            s.line(["", "Subtotal one-time (items 1–11)", "One-off",
                    *[f"=SUM({c}{one_time[0]}:{c}{one_time[-1]})" for c in cols], "Fixed price",
                    "Fixed price; includes the cloud set-up (item 5)",
                    "Inclusive of WHT; exclusive of OPE and third-party charges"], money=(4, 5, 6, 7, 8, 9), total=True)
            REFS["r10_one"] = s.row - 1
        if no == 16:
            cols = "DEFGHI"
            s.line(["", "Subtotal Years 1–5 (items 12–16)", "Annual",
                    *[f"=SUM({c}{recurring[0]}:{c}{recurring[-1]})" for c in cols], "AMC, +5% a year",
                    "Subscription, +5% a year", "Managed services (item 5, Option B) are shown on the Option B sheet"],
                   money=(4, 5, 6, 7, 8, 9), total=True)
            REFS["r10_rec"] = s.row - 1
    s.skip()
    s.note("Rates for items 17–19 are Year 1 rates and rise by 5% a year (Rate card sheet). Third-party charges (item "
           "20) are detailed in the Bill of Materials workbook.", columns=12)
    ws.freeze_panes = "C4"


# =============================================================================
# Rate card
# =============================================================================
def rate_card_sheet(wb):
    ws = wb.create_sheet("Rate card")
    set_widths(ws, [46, 14, 12, 12, 12, 12, 12, 64])
    s = SheetWriter(ws, 8)
    s.title("Rate card (RFP section 10 items 17–19 and 21; COM-16), +5% a year")
    s.header(["Service", "Unit", *[f"Year {y} (B$)" for y in YEARS], "Notes"])
    rows = [
        ("Enhancements and change requests", "Per man-day", price.ENHANCEMENT_DAY_RATE,
         f"Blended rate, all roles; {price.ENHANCEMENT_HOURS_PER_YEAR} hours a year included in AMC / subscription"),
        ("Enhancements and change requests", "Per hour", price.ENHANCEMENT_HOUR_RATE, "Blended rate, all roles"),
        ("Onsite support, unplanned visit", "Per day", price.ONSITE_DAY_RATE, "Plus OPE at actuals"),
        ("After-hours support other than P1", "Per hour", price.AFTER_HOURS_HOUR_RATE, "Only at IIFT's request"),
    ]
    for i, (item, unit, amount, notes) in enumerate(rows):
        s.line([item, unit, *[price.rate(amount, y) for y in YEARS], notes], money=(3, 4, 5, 6, 7), zebra=i % 2)
    s.line(["After-hours support for P1 (Critical) incidents", "Per incident", *["Included"] * 5, "24x7"],
           center=(3, 4, 5, 6, 7))
    s.line(["Exit and transition at contract end", "Fixed", *["Included"] * 5,
            "Included in Year 5 AMC or at the end of the subscription"], center=(3, 4, 5, 6, 7), zebra=True)
    s.skip()
    s.note("Change requests: written request, impact assessment within five business days, quotation at these rates, "
           "written approval before work starts. Quotations remain valid for 90 days.")
    ws.freeze_panes = "C4"


# =============================================================================
# Payment schedules
# =============================================================================
def payments_sheet(wb):
    ws = wb.create_sheet("Payment schedules")
    set_widths(ws, [12, 62, 22, 14, 16, 16, 44])
    s = SheetWriter(ws, 7)
    s.title(f"Payment schedules (invoices payable within {price.PAYMENT_TERMS_DAYS} days)")
    s.section("1. Option A licence fee")
    s.header(["Milestone", "Payment trigger", "Target", "Share", "Amount (B$)", "Amount (USD)", "Notes"])
    first = s.row
    licence_targets = {"L1": "Signature", "L2": "About week 8", "L3": "Week 24"}
    for code, trigger, share in price.LICENCE_MILESTONES:
        r = s.row
        s.line([code, trigger, licence_targets.get(code, ""), share, f"=ROUND(D{r}*{REFS['a_licence']},0)", usd(f"E{r}"), ""],
               money=(5, 6), pct=(4,), center=(1,))
    r = s.line(["", "Total licence fee", "", f"=SUM(D{first}:D{s.row - 1})", f"=SUM(E{first}:E{s.row - 1})",
                usd(f"E{s.row}"), ""], money=(5, 6), pct=(4,), total=True)
    REFS["pay_licence"] = ref("Payment schedules", "E", r)
    s.skip()
    s.section("2. Services fee (Options A and B)")
    s.header(["Milestone", "Payment trigger", "Target", "Share", "Amount (B$)", "Amount (USD)", "Notes"])
    weeks = {"M1": 2, "M2": 6, "M4": 19, "M5": 22, "M6": 24, "M7": 28}
    first = s.row
    for code, trigger, share in price.SERVICE_MILESTONES:
        r = s.row
        s.line([code, trigger, f"Week {weeks[code]}", share, f"=ROUND(D{r}*{REFS['b_one_total']},0)", usd(f"E{r}"),
                ""], money=(5, 6), pct=(4,), center=(1, 3))
    r = s.line(["", "Total services fee", "", f"=SUM(D{first}:D{s.row - 1})", f"=SUM(E{first}:E{s.row - 1})",
                usd(f"E{s.row}"), "M3 (build complete, week 16) carries no payment"], money=(5, 6), pct=(4,),
               total=True)
    REFS["pay_services"] = ref("Payment schedules", "E", r)
    s.skip()
    s.section("3. Recurring charges")
    s.header(["Year", "Charge", "Option", "Per invoice (B$)", "Per year (B$)", "Billing"], merge_from=6)
    for year in YEARS:
        s.line([f"Year {year}", "Annual maintenance (AMC)", "A", f"={REFS[f'amc_{year}']}/4",
                f"={REFS[f'amc_{year}']}", "Quarterly in advance from go-live"], money=(5,), money2=(4,),
               center=(3,), merge_from=6)
    for year in YEARS:
        s.line([f"Year {year}", "Subscription", "B", f"={REFS[f'sub_{year}_m']}", f"={REFS[f'sub_{year}']}",
                "Monthly in advance from go-live"], money=(4, 5), center=(3,), zebra=True, merge_from=6)
    for year in YEARS:
        s.line([f"Year {year}", "Managed services", "B", f"={REFS[f'ms_{year}_m']}", f"={REFS[f'ms_{year}']}",
                "Monthly in advance from go-live"], money=(4, 5), center=(3,), merge_from=6)
    s.line(["At signing", "Cloud set-up fee", "B", f"={REFS['b_setup']}", None, "Once, at contract signing"],
           money=(4, 5), center=(3,), merge_from=6)
    s.line(["Each month", "Cloud infrastructure (estimate)", "B", f"={REFS['cloud_month']}", f"={REFS['cloud_year']}",
            "Monthly in arrears, disbursement at cost with provider invoices (or paid by IIFT directly)"],
           money=(4, 5), center=(3,), zebra=True, merge_from=6)
    s.line(["As incurred", "OPE", "A and B", None, None, "Monthly in arrears, disbursement at cost with travel invoices"],
           center=(3,), merge_from=6)
    s.skip()
    s.section("4. Option C")
    s.header(["Milestone", "Payment trigger", "Component", "Share", "Amount (B$)", "Amount (USD)", "Notes"])
    for code, trigger, component, share, _ in price.source_code_milestone_amounts():
        base = price.SOURCE_CODE_LICENCE if component == "Source code licence" else price.KNOWLEDGE_TRANSFER
        r = s.line([code, trigger, component, share, f"=ROUND(D{s.row}*{base},0)", usd(f"E{s.row}"), ""],
                   money=(5, 6), pct=(4,), center=(1,))
    s.line(["Quarterly", "Post-handover support, choice 2 (Year 1)", "Support", None, f"={REFS['ph_1']}/4",
            None, "Quarterly in advance, in place of the AMC"], money2=(5,))
    ws.freeze_panes = "C4"


# =============================================================================
# Client format and summary
# =============================================================================
def client_format_sheet(wb):
    name = "Client format"
    ws = wb.create_sheet(name, 1)
    set_widths(ws, [62, 15, 15, 13, 13, 15, 15])
    s = SheetWriter(ws, 7)
    s.title("Fees in IIFT's requested format (Description | Fee | WHT | OPE | Total)")
    s.note("All fees are inclusive of WHT, exclusive of OPE (recharged at cost as disbursements; estimate shown) and "
           "exclusive of "
           "third-party charges and infrastructure (Bill of Materials). USD indicative at the rate on the Summary "
           "sheet.", columns=7)
    s.skip()
    headers = ["Description", "Fee (B$)", "Fee (USD)", "WHT", "OPE", "Total (B$)", "Total (USD)"]

    def fee(label, formula, total=False):
        r = s.row
        return s.line([label, formula, usd(f"B{r}"), "Inclusive", "Excluded", f"=B{r}", usd(f"F{r}")],
                      money=(2, 3, 6, 7), center=(4, 5), total=total)

    def sum_row(label, rows):
        r = s.row
        return s.line([label, "=" + "+".join(f"B{x}" for x in rows), usd(f"B{r}"), "Inclusive", "Excluded",
                       "=" + "+".join(f"F{x}" for x in rows), usd(f"F{r}")], money=(2, 3, 6, 7), center=(4, 5),
                      total=True)

    def ope_row():
        r = s.row
        return s.line(["OPE estimate for the onsite phases (travel, accommodation, per diem, insurance, transfers, "
                       "visas)", None, None, "–", f"={REFS['ope_core']}", f"=E{r}", usd(f"F{r}")],
                      money=(2, 3, 5, 6, 7), center=(4,))

    s.section(price.OPTION_TITLES["A"])
    s.header(headers, height=20)
    s.group("One-time fees (licence and services)")
    p = fee("Agent/Banca Portal", f"={REFS['a_one_portal']}")
    b = fee("Back-office solution", f"={REFS['a_one_bo']}")
    REFS["cf_a_one"] = ref(name, "B", sum_row("Total one-time fees", [p, b]))
    s.group("Annual maintenance (AMC), Year 1 – 22% of licence and customisation, +5% a year")
    p = fee("Agent/Banca Portal", f"={REFS['amc_1_p']}")
    b = fee("Back-office solution", f"={REFS['amc_1_b']}")
    REFS["cf_a_amc"] = ref(name, "B", sum_row("Total AMC, Year 1", [p, b]))
    s.group("Out-of-pocket expenses – disbursements at cost")
    ope_row()
    s.skip()

    s.section(price.OPTION_TITLES["B"])
    s.header(headers, height=20)
    s.group("One-time fees (services)")
    p = fee("Agent/Banca Portal", f"={REFS['b_one_portal']}")
    b = fee("Back-office solution", f"={REFS['b_one_bo']}")
    c = fee("Cloud set-up, platform (landing zone, environments, monitoring, backups, DR)", f"={REFS['b_setup']}")
    REFS["cf_b_one"] = ref(name, "B", sum_row("Total one-time fees", [p, b, c]))
    s.group("Recurring fees, Year 1 – +5% a year")
    p = fee(f"Agent/Banca Portal subscription (B$ {price.subscription_monthly_portal(1):,} a month)",
            REFS["sub_1_p"])
    b = fee(f"Back-office solution subscription (B$ {price.subscription_monthly_backoffice(1):,} a month)",
            REFS["sub_1_b"])
    m = fee(f"Managed services, platform (B$ {price.managed_monthly(1):,} a month)", f"={REFS['ms_1']}")
    REFS["cf_b_rec"] = ref(name, "B", sum_row("Total recurring fees, Year 1", [p, b, m]))
    s.group("Out-of-pocket expenses – disbursements at cost")
    ope_row()
    s.skip()
    s.note(f"Cloud infrastructure (Option B) is excluded and recharged at cost as a disbursement (or paid by IIFT "
           f"directly): estimate B$ {price.cloud_monthly():,} "
           f"a month plus B$ {price.CLOUD_IMPLEMENTATION_MONTHLY * price.CLOUD_IMPLEMENTATION_MONTHS:,} for project "
           "environments (Option B sheet). Option C (source code handover) is on its own sheet.", columns=7)
    ws.freeze_panes = "A4"


def summary_sheet(ws):
    ws.title = "Summary"
    set_widths(ws, [52, 16, 16, 16, 16, 16, 16, 16])
    for r in (1, 2, 3):
        ws.row_dimensions[r].height = 16
    add_logo(ws, "A1", height_px=56)
    s = SheetWriter(ws, 8)
    s.title(f"{brand.PROPOSAL_TITLE}: commercial summary", row=4)
    assert s.row == 7
    s.label_value("Client", brand.CLIENT)
    s.label_value("Bidder", brand.BIDDER)
    s.label_value("Solution", f"{brand.PRODUCT}, configured as the {brand.SOLUTION_NAME}")
    s.label_value("Currency", "Brunei Dollar (B$); USD indicative")
    fx = s.label_value("Indicative FX (B$ per USD 1)", price.FX_BND_PER_USD, number_format="0.00", input_cell=True)
    assert fx.coordinate == "C11", fx.coordinate
    s.label_value("Quotation validity", f"{price.QUOTATION_VALIDITY_DAYS} days from submission")
    s.skip()

    s.section("1. Commercial options at a glance (B$)")
    s.header(["Item", "Option A: on-premise perpetual licence", "Option B: subscription, iorta-hosted cloud",
              "Option C: source code handover (add-on)", "Notes"], height=44, merge_from=5)
    one = s.line(["One-time iorta fees", f"={REFS['a_one_total']}", f"={REFS['b_one_all']}", f"={REFS['c_total']}",
                  "A: licence + services; B: services + cloud set-up; C: source code + knowledge transfer"],
                 money=(2, 3, 4), merge_from=5)
    s.line(["Recurring iorta fees, Year 1", f"={REFS['amc_1']}", f"={REFS['sub_1']}+{REFS['ms_1']}",
            f"={REFS['ph_1']}", "A: AMC; B: subscription + managed services; C: support choice 2 "
                                                  "in place of the AMC"], money=(2, 3, 4), merge_from=5)
    rec = s.line(["Recurring iorta fees, Years 1–5", f"={REFS['amc_total']}",
                  f"={REFS['sub_total']}+{REFS['ms_total']}", f"={REFS['ph_total']}",
                  "+5% a year (capped)"], money=(2, 3, 4), merge_from=5)
    fees = s.line(["iorta fees, five years", f"=B{one}+B{rec}", f"=C{one}+C{rec}", None, ""],
                  money=(2, 3, 4), bold=True, merge_from=5)
    ope = s.line(["OPE estimate, core onsite phases (disbursements at cost)", f"={REFS['ope_core']}", f"={REFS['ope_core']}",
                  f"={REFS['ope_optional']}", "C: optional onsite knowledge transfer"],
                 money=(2, 3, 4), merge_from=5)
    cloud = s.line(["Cloud infrastructure at cost, estimate (project + five years)", 0, f"={REFS['cloud_total']}",
                    None, "Disbursement at cost without mark-up, or paid by IIFT directly"], money=(2, 3, 4),
                   merge_from=5)
    total = s.line(["Five-year total (B$)", f"=B{fees}+B{ope}+B{cloud}", f"=C{fees}+C{ope}+C{cloud}", None,
                    "Excludes infrastructure procured by IIFT and third-party charges (BOM)"],
                   money=(2, 3), total=True, merge_from=5)
    REFS["sum_total_row"] = total
    s.line(["Five-year total (USD, indicative)", usd(f"B{total}"), usd(f"C{total}"), None, ""],
           money=(2, 3), total=True, merge_from=5)
    low, high = price.bom_onprem_totals()
    s.line(["Infrastructure procured by IIFT (Option A, indicative one-time, not included above)",
            f"B$ {low:,}–{high:,}", "–", None, "See the Bill of Materials workbook"], merge_from=5)
    s.skip()

    s.section("2. Cash view by contract year (B$)")
    s.header(["Period", "A: iorta fees", "A: OPE", "A: total", "B: iorta fees", "B: cloud at cost", "B: OPE",
              "B: total"], height=30)
    first = s.row
    for year in range(0, price.CONTRACT_YEARS + 1):
        r = s.row
        if year == 0:
            values = ["Year 0 (implementation, weeks 1–28)", f"={REFS['a_one_total']}", f"={REFS['ope_core']}",
                      f"=B{r}+C{r}", f"={REFS['b_one_all']}", f"={REFS['cloud_project']}", f"={REFS['ope_core']}",
                      f"=E{r}+F{r}+G{r}"]
        else:
            values = [f"Year {year}", f"={REFS[f'amc_{year}']}", 0, f"=B{r}+C{r}",
                      f"={REFS[f'sub_{year}']}+{REFS[f'ms_{year}']}", f"={REFS['cloud_year']}", 0,
                      f"=E{r}+F{r}+G{r}"]
        s.line(values, money=(2, 3, 4, 5, 6, 7, 8), zebra=year % 2 == 1)
    last = s.row - 1
    s.line(["Total", *[f"=SUM({c}{first}:{c}{last})" for c in "BCDEFGH"]], money=(2, 3, 4, 5, 6, 7, 8), total=True)
    s.skip()

    s.section("3. Fee basis")
    s.bullets([
        "WHT: inclusive. Where Brunei law requires IIFT to withhold tax from iorta's fees, IIFT deducts and remits "
        "it; iorta bears the tax and invoices are not grossed up.",
        "Cloud infrastructure (Option B) and OPE are recharged at cost as disbursements with the provider and travel "
        "invoices attached, outside the fees to which WHT applies. IIFT may instead hold the cloud account in its "
        "own name and pay the provider directly.",
        f"OPE: exclusive. Recharged at cost for the onsite phases (OPE sheet); per diem fixed at USD "
        f"{price.PER_DIEM_USD} a day; not more than {price.OPE_TOLERANCE:.0%} above the estimate without IIFT's "
        "approval.",
        "Third-party charges and infrastructure: exclusive. Listed in the Bill of Materials; paid by IIFT or passed "
        "through at cost without mark-up.",
        "Recurring fees (AMC, subscription, managed services, rate card) rise by 5% a year, capped at 5% (COM-18).",
        "No GST or VAT applies in Brunei Darussalam at present; any indirect tax introduced by law is added at the "
        "statutory rate.",
        "Recommended: Option A (data stays in Brunei; lowest five-year cost). Option B for a lower upfront payment; "
        "convertible to Option A during the term.",
    ], columns=8)
    ws.freeze_panes = "A7"


def assumptions_sheet(wb):
    ws = wb.create_sheet("Assumptions")
    set_widths(ws, [6, 150])
    s = SheetWriter(ws, 2)
    s.title("Commercial assumptions and exclusions")
    s.header(["#", "Assumption"], height=20)
    items = [
        f"Currency: Brunei Dollars. USD equivalents are indicative at USD 1 = B$ {price.FX_BND_PER_USD:.2f}, rounded "
        "to the nearest dollar; the B$ amounts are binding.",
        "Scope is the RFP (sections 3–8, Appendices 1–4) as described in the proposal; changes follow the change "
        "request process at the rate card.",
        "Implementation fees are fixed prices; recurring fees follow the yearly schedule with increases capped at 5%.",
        "Sizing basis: 26 named users (Appendix 1) and about 628 policies a year (Appendix 2); designed for 100 "
        "concurrent and 500 named users. Unlimited named users for IIFT under both options.",
        "Option A: IIFT procures infrastructure to iorta's sizing (Bill of Materials) and provides SIT and UAT by weeks "
        "8 and 16 and production and DR by week 20.",
        f"Option B: hosting in {price.CLOUD_REGION}; IIFT approves the region and makes the AMBD outsourcing and "
        f"cloud notification; one-off cloud set-up fee B$ {price.CLOUD_SETUP_FEE:,} payable at contract signing.",
        "Cloud infrastructure and OPE are recharged at cost as disbursements with provider and travel invoices "
        "attached, outside the fees to which WHT applies; IIFT may instead hold the cloud account in its own name "
        "and pay the provider directly (iorta then operates it under the managed services).",
        f"Option B minimum term {price.SUBSCRIPTION_MINIMUM_MONTHS} months from go-live.",
        f"Option C: after go-live and hypercare; {price.KNOWLEDGE_TRANSFER_WEEKS} weeks of knowledge transfer for up "
        "to six IIFT/IITH or nominated contractor staff; price held for exercise within 12 months of go-live.",
        "Data migration: agent, agency, bank, branch, participant and reference data, below 10,000 records from no "
        "more than three source extracts.",
        "OPE: onsite presence for requirements gathering, training and UAT support, go-live with one month of "
        "support and (Option C) knowledge transfer; all other work remote from Malaysia and India.",
        "Use by other IITH group companies (e.g. IIGT) is priced separately.",
        f"Quotation validity: {price.QUOTATION_VALIDITY_DAYS} days from submission. Invoices payable within "
        f"{price.PAYMENT_TERMS_DAYS} days.",
        "Exclusions: infrastructure (Option A), cloud charges (Option B, at cost), third-party charges, OPE, changes "
        "to IIFT's other systems, Malay translation, payment gateway, native mobile apps, post-go-live penetration "
        "tests beyond the pre-go-live VAPT and re-test.",
    ]
    for i, text in enumerate(items, start=1):
        s.line([i, text], center=(1,), zebra=i % 2 == 0)
    ws.freeze_panes = "A4"


# =============================================================================
# Build and verify
# =============================================================================
def build(output: Path = brand.XLSX_OUTPUT) -> Path:
    price.verify()
    REFS.clear()
    wb = Workbook()
    summary = wb.active
    summary.title = "Summary"
    option_a_sheet(wb)
    option_b = option_b_sheet(wb)
    core_row = ope_sheet(wb)
    # the Option B five-year block references the OPE total written after it
    first, last = REFS["b_summary_rows"]
    for row in range(first, last + 1):
        cell = option_b.cell(row=row, column=4)
        if isinstance(cell.value, str) and "{core}" in cell.value:
            cell.value = cell.value.format(core=core_row)
    option_c_sheet(wb)
    rfp10_sheet(wb)
    rate_card_sheet(wb)
    payments_sheet(wb)
    assumptions_sheet(wb)
    client_format_sheet(wb)
    summary_sheet(summary)
    order = ["Summary", "Client format", "Option A", "Option B", "Option C", "RFP Section 10", "OPE", "Rate card",
             "Payment schedules", "Assumptions"]
    wb._sheets = [wb[name] for name in order]
    finish(wb, f"{brand.PROPOSAL_TITLE}: Commercial Pricing", f"Commercial proposal to {brand.CLIENT}", summary)
    summary.page_setup.fitToHeight = 1
    wb.save(str(output))
    return output


def _expected():
    one_a, one_b = price.one_time_total("A"), price.option_b_one_time()
    return {
        ("Summary", "B", "One-time iorta fees"): one_a,
        ("Summary", "C", "One-time iorta fees"): one_b,
        ("Summary", "D", "One-time iorta fees"): price.option_c_total(),
        ("Summary", "B", "Recurring iorta fees, Year 1"): price.amc(1),
        ("Summary", "C", "Recurring iorta fees, Year 1"): price.subscription_annual(1) + 12 * price.managed_monthly(1),
        ("Summary", "D", "Recurring iorta fees, Year 1"): price.post_handover_support(1),
        ("Summary", "B", "Recurring iorta fees, Years 1–5"): price.amc_total(),
        ("Summary", "C", "Recurring iorta fees, Years 1–5"): price.subscription_total() + price.managed_total(),
        ("Summary", "D", "Recurring iorta fees, Years 1–5"): price.post_handover_total(),
        ("Summary", "B", "OPE estimate, core onsite phases (disbursements at cost)"): price.ope_total(),
        ("Summary", "D", "OPE estimate, core onsite phases (disbursements at cost)"):
            price.ope_total(True) - price.ope_total(),
        ("Summary", "C", "Cloud infrastructure at cost, estimate (project + five years)"): price.cloud_total(),
        ("Summary", "B", "Five-year total (B$)"): price.tco_option_a(),
        ("Summary", "C", "Five-year total (B$)"): price.tco_option_b(),
        ("Summary", "B", "Five-year total (USD, indicative)"): price.usd(price.tco_option_a()),
        ("Summary", "C", "Five-year total (USD, indicative)"): price.usd(price.tco_option_b()),
        ("Summary", "D", "Total"): price.tco_option_a(),
        ("Summary", "H", "Total"): price.tco_option_b(),
        ("Option A", "F", "Total one-time fees, Option A"): one_a,
        ("Option A", "F", "Total integration (agrees with item 3)"): price.item_total("integration"),
        ("Option A", "F", "AMC base: licence, implementation and integration (items flagged Yes)"): price.amc_base(),
        ("Option A", "G", "Year 1"): price.amc(1) / 4,
        ("Option B", "F", "Total implementation fee, Option B"): price.one_time_total("B"),
        ("Option B", "F", "Total one-time fees, Option B"): one_b,
        ("Option B", "D", "Five-year total, Option B"): price.tco_option_b(),
        ("Option B", "G", f"Minimum term value ({price.SUBSCRIPTION_MINIMUM_MONTHS} months)"):
            price.subscription_minimum_commitment(),
        ("Option B", "E", "Cloud estimate, project plus five years"): price.cloud_total(),
        ("Option B", "D", "Total, production run"): price.cloud_monthly(),
        ("Option C", "D", "Total Option C"): price.option_c_total(),
        ("OPE", "L", "Core onsite phases"): price.ope_total(),
        ("OPE", "L", "Total including Option C"): price.ope_total(True),
        ("RFP Section 10", "F", "Subtotal one-time (items 1–11)"): one_a,
        ("RFP Section 10", "I", "Subtotal one-time (items 1–11)"): one_b,
        ("RFP Section 10", "F", "Subtotal Years 1–5 (items 12–16)"): price.amc_total(),
        ("RFP Section 10", "I", "Subtotal Years 1–5 (items 12–16)"): price.subscription_total(),
        ("Payment schedules", "E", "Total licence fee"): price.licence_fee(),
        ("Payment schedules", "E", "Total services fee"): price.services_fee(),
        ("Client format", "B", "Total AMC, Year 1"): price.amc(1),
        ("Client format", "B", "Total recurring fees, Year 1"): price.subscription_annual(1) + 12 * price.managed_monthly(1),
    }


def _find(wb, sheet, label, occurrence=0):
    hits = [c.row for row in wb[sheet].iter_rows() for c in row[:2] if c.value == label]
    return hits[occurrence]


def verify_workbook(path: Path) -> None:
    """Recompute key totals (Python evaluator, then LibreOffice) and compare with pricing_data."""
    evaluator = FormulaEvaluator(path)
    failures = []
    checks = _expected()
    # Client format: one-time totals appear twice (Option A first, Option B second)
    cf = "Client format"
    checks_extra = {
        (cf, "B", 0): price.one_time_total("A"),
        (cf, "B", 1): price.option_b_one_time(),
    }
    for (sheet, col, label), expected in checks.items():
        row = _find(evaluator.wb, sheet, label)
        actual = evaluator.value(sheet, f"{col}{row}")
        ok = abs(actual - expected) < 0.005
        failures += [] if ok else [f"{sheet}!{col}{row} {label}: {actual} != {expected}"]
    for (sheet, col, occurrence), expected in checks_extra.items():
        row = _find(evaluator.wb, sheet, "Total one-time fees", occurrence)
        actual = evaluator.value(sheet, f"{col}{row}")
        failures += [] if actual == expected else [f"{sheet}!{col}{row}: {actual} != {expected}"]
    print(f"  Python evaluator: {len(checks) + len(checks_extra) - len(failures)} of "
          f"{len(checks) + len(checks_extra)} totals match pricing_data")

    errors = recalc_errors(path)
    if errors:
        failures.append(f"LibreOffice errors: {errors[:10]}")
    values = recalculated_values(path)
    if values is not None:
        lo_fail = 0
        for (sheet, col, label), expected in checks.items():
            row = _find(evaluator.wb, sheet, label)
            actual = values[sheet][f"{col}{row}"].value
            if actual is None or abs(actual - expected) >= 0.005:
                lo_fail += 1
                failures.append(f"LibreOffice {sheet}!{col}{row} {label}: {actual} != {expected}")
        print(f"  LibreOffice recalculation: no error cells; {len(checks) - lo_fail} of {len(checks)} totals match")
    if failures:
        raise AssertionError("Workbook check failed:\n  " + "\n  ".join(failures))


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path}")
    verify_workbook(path)
    print("All workbook totals verified.")
