"""Build the commercial pricing workbook for the IIFT proposal (.xlsx).

Usage:
    python docs/proposal/build/build_pricing.py

All figures come from pricing_data.py. Totals are real Excel formulas, so the
workbook stays consistent if a reviewer changes an input cell. After writing,
the script recomputes every total in Python and checks it against the
approved figures.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from openpyxl import Workbook                                      # noqa: E402
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side  # noqa: E402
from openpyxl.utils import get_column_letter                      # noqa: E402

import brand                     # noqa: E402
import pricing_data as price     # noqa: E402

HEADER_FILL = PatternFill("solid", fgColor=brand.MAGENTA)
TOTAL_FILL = PatternFill("solid", fgColor=brand.GROUP_ROW)
ZEBRA_FILL = PatternFill("solid", fgColor=brand.ZEBRA)
INPUT_FILL = PatternFill("solid", fgColor="FFF9DB")
HEADER_FONT = Font(name=brand.BODY_FONT, bold=True, color=brand.WHITE, size=10)
TITLE_FONT = Font(name=brand.BODY_FONT, bold=True, color=brand.MAGENTA, size=14)
SUBTITLE_FONT = Font(name=brand.BODY_FONT, bold=True, color=brand.ORANGE, size=11)
BODY_FONT = Font(name=brand.BODY_FONT, color=brand.TEXT_DARK, size=10)
BOLD_FONT = Font(name=brand.BODY_FONT, color=brand.TEXT_DARK, size=10, bold=True)
NOTE_FONT = Font(name=brand.BODY_FONT, color=brand.TEXT_MUTED, size=9, italic=True)
THIN = Side(style="thin", color=brand.BORDER_GREY)
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
MONEY = '#,##0;(#,##0);"0"'
WRAP = Alignment(wrap_text=True, vertical="top")

FX_CELL = "'Summary (RFP format)'!$C$6"


# --- Styling helpers ------------------------------------------------------------------
def title_block(ws, title, subtitle=None):
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws["A2"] = subtitle or f"{brand.BIDDER}, proposal to {brand.CLIENT}, {brand.SUBMISSION_DATE}"
    ws["A2"].font = NOTE_FONT


def header_row(ws, row, headers):
    for col, text in enumerate(headers, start=1):
        cell = ws.cell(row=row, column=col, value=text)
        cell.font = HEADER_FONT
        cell.fill = HEADER_FILL
        cell.border = BORDER
        cell.alignment = Alignment(wrap_text=True, vertical="center")


def body_row(ws, row, values, money_cols=(), bold=False, fill=None):
    for col, value in enumerate(values, start=1):
        cell = ws.cell(row=row, column=col, value=value)
        cell.font = BOLD_FONT if bold else BODY_FONT
        cell.border = BORDER
        cell.alignment = WRAP
        if col in money_cols:
            cell.number_format = MONEY
            cell.alignment = Alignment(horizontal="right", vertical="top")
        if fill:
            cell.fill = fill


def zebra(ws, first_row, last_row, columns):
    for row in range(first_row, last_row + 1):
        if (row - first_row) % 2 == 1:
            for col in range(1, columns + 1):
                ws.cell(row=row, column=col).fill = ZEBRA_FILL


def widths(ws, values):
    for index, width in enumerate(values, start=1):
        ws.column_dimensions[get_column_letter(index)].width = width


def note(ws, row, text, columns=6):
    ws.cell(row=row, column=1, value=text).font = NOTE_FONT
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=columns)
    ws.cell(row=row, column=1).alignment = Alignment(wrap_text=True, vertical="top")
    ws.row_dimensions[row].height = 30


def usd(cell_ref):
    return f"=ROUND({cell_ref}/{FX_CELL},0)"


# --- Sheets -------------------------------------------------------------------------------
def one_time_sheet(wb):
    """RFP section 10 items 1–21; returns cell references of the key totals."""
    ws = wb.create_sheet("One-time breakdown")
    title_block(ws, "Commercial pricing breakdown, RFP section 10 (items 1–21)")
    header_row(ws, 4, ["No", "Commercial component", "Pricing basis", "Agent/Banca Portal (B$)",
                       "Back-office (B$)", "Total (B$)", "Rate / treatment", "Remarks"])
    row = 5
    one_time_rows, maintenance_rows, refs = [], [], {}
    for item in price.rfp_section10_rows():
        if item["portal"] is not None:
            values = [item["no"], item["component"], item["basis"], item["portal"], item["backoffice"],
                      f"=D{row}+E{row}", "Included" if item["no"] == 11 else "", item["remark"]]
            (one_time_rows if item["category"] == "one-time" else maintenance_rows).append(row)
        else:
            values = [item["no"], item["component"], item["basis"], None, None, None, item["text"], item["remark"]]
        body_row(ws, row, values, money_cols=(4, 5, 6))
        row += 1
        if item["no"] == 11:
            first, last = one_time_rows[0], one_time_rows[-1]
            body_row(ws, row, ["", "Subtotal one-time (items 1–11)", "One-off", f"=SUM(D{first}:D{last})",
                               f"=SUM(E{first}:E{last})", f"=SUM(F{first}:F{last})",
                               "Fixed price; WHT inclusive; planned OPE included", ""],
                     money_cols=(4, 5, 6), bold=True, fill=TOTAL_FILL)
            refs["one_time"] = row
            row += 1
        if item["no"] == 16:
            first, last = maintenance_rows[0], maintenance_rows[-1]
            body_row(ws, row, ["", "Subtotal maintenance Years 1–5 (items 12–16)", "Annual",
                               f"=SUM(D{first}:D{last})", f"=SUM(E{first}:E{last})", f"=SUM(F{first}:F{last})",
                               "Flat, 0% escalation", ""], money_cols=(4, 5, 6), bold=True, fill=TOTAL_FILL)
            refs["maintenance"] = row
            row += 1
    note(ws, row + 1, "Integration (item 3) is itemised per interface on the 'Integration per interface' sheet. "
                      "Infrastructure, database and third-party items (5, 6, 20) are not part of iorta's fees under "
                      "the recommended on-premise option.", columns=8)
    widths(ws, [6, 44, 15, 18, 16, 14, 34, 60])
    ws.freeze_panes = "C5"
    return refs


def integration_sheet(wb):
    ws = wb.create_sheet("Integration per interface")
    title_block(ws, "Integration cost per interface (RFP section 10 item 3, COM-05)")
    header_row(ws, 4, ["Interface", "Scope", "Agent/Banca Portal (B$)", "Back-office (B$)", "Total (B$)"])
    row = 5
    for name, scope, portal, backoffice in price.INTERFACES:
        body_row(ws, row, [name, scope, portal, backoffice, f"=C{row}+D{row}"], money_cols=(3, 4, 5))
        row += 1
    zebra(ws, 5, row - 1, 5)
    body_row(ws, row, ["Total integration", "", f"=SUM(C5:C{row - 1})", f"=SUM(D5:D{row - 1})",
                       f"=SUM(E5:E{row - 1})"], money_cols=(3, 4, 5), bold=True, fill=TOTAL_FILL)
    widths(ws, [26, 70, 22, 18, 14])
    return row


def maintenance_sheet(wb):
    ws = wb.create_sheet("Maintenance 5 years")
    title_block(ws, "Five-year maintenance & support (RFP sections 8 and 9)")
    ws["A3"] = "Annual escalation"
    ws["A3"].font = BOLD_FONT
    ws["C3"] = price.MAINTENANCE_ESCALATION
    ws["C3"].number_format = "0.0%"
    ws["C3"].fill = INPUT_FILL
    header_row(ws, 5, ["Year", "Focus", "Activities", "Agent/Banca Portal (B$)", "Back-office (B$)",
                       "Total (B$)", "Cumulative (B$)"])
    row = 6
    for _, year, focus, description in price.MAINTENANCE_PLAN:
        body_row(ws, row, [f"Year {year}", focus, description,
                           f"=ROUND({price.MAINTENANCE_ANNUAL_PORTAL}*(1+$C$3)^{year - 1},0)",
                           f"=ROUND({price.MAINTENANCE_ANNUAL_BACKOFFICE}*(1+$C$3)^{year - 1},0)",
                           f"=D{row}+E{row}", f"=SUM($F$6:F{row})"], money_cols=(4, 5, 6, 7))
        row += 1
    zebra(ws, 6, row - 1, 7)
    body_row(ws, row, ["Total", "Five years", "", f"=SUM(D6:D{row - 1})", f"=SUM(E6:E{row - 1})",
                       f"=SUM(F6:F{row - 1})", ""], money_cols=(4, 5, 6), bold=True, fill=TOTAL_FILL)
    total_row = row
    row += 2
    ws.cell(row=row, column=1, value="Included in the annual fee").font = SUBTITLE_FONT
    for inclusion in price.MAINTENANCE_INCLUSIONS:
        row += 1
        ws.cell(row=row, column=1, value=f"• {inclusion}").font = BODY_FONT
    row += 2
    note(ws, row, f"Billing: {price.MAINTENANCE_BILLING}. Warranty: {price.WARRANTY_MONTHS} months from go-live "
                  "(defects corrected free of charge); Year 1 maintenance starts at go-live.", columns=7)
    widths(ws, [10, 28, 70, 22, 18, 14, 16])
    return total_row


def rate_card_sheet(wb):
    ws = wb.create_sheet("Rate card")
    title_block(ws, "Rate card (RFP section 10 items 17–19, 21; COM-16)")
    header_row(ws, 4, ["Item", "Unit", "Rate (B$)", "Notes"])
    rows = [
        ("Enhancements / change requests", "Per man-day", price.ENHANCEMENT_DAY_RATE,
         f"{price.ENHANCEMENT_HOURS_PER_YEAR} hours per year included in maintenance"),
        ("Enhancements / change requests", "Per hour", price.ENHANCEMENT_HOUR_RATE, "Blended rate, all roles"),
        ("Onsite support, unplanned", "Per day", price.ONSITE_DAY_RATE,
         f"Plus travel at cost; {price.PLANNED_ONSITE_VISITS} planned visits included in the fixed price"),
        ("After-hours support, P1 Critical", "Per incident", 0, "Included"),
        ("After-hours support, other", "Per hour", price.AFTER_HOURS_HOUR_RATE, "Only at IIFT's request"),
        ("Exit / transition", "Fixed", 0, "Included in Year 5 maintenance"),
    ]
    for offset, values in enumerate(rows):
        body_row(ws, 5 + offset, list(values), money_cols=(3,))
    zebra(ws, 5, 4 + len(rows), 4)
    widths(ws, [36, 14, 12, 70])


def milestones_sheet(wb, one_time_ref):
    ws = wb.create_sheet("Payment milestones")
    title_block(ws, "Payment milestones, one-time fee")
    header_row(ws, 4, ["Milestone", "Payment trigger", "Share", "Amount (B$)", "Amount (USD, indicative)"])
    row = 5
    for code, trigger, share in price.PAYMENT_MILESTONES:
        body_row(ws, row, [code, trigger, share, f"=ROUND(C{row}*{one_time_ref},0)", usd(f"D{row}")],
                 money_cols=(4, 5))
        ws.cell(row=row, column=3).number_format = "0%"
        row += 1
    zebra(ws, 5, row - 1, 5)
    body_row(ws, row, ["Total", "", f"=SUM(C5:C{row - 1})", f"=SUM(D5:D{row - 1})", usd(f"D{row}")],
             money_cols=(4, 5), bold=True, fill=TOTAL_FILL)
    ws.cell(row=row, column=3).number_format = "0%"
    note(ws, row + 2, f"Invoices payable within 30 days. Maintenance: {price.MAINTENANCE_BILLING.lower()} "
                      f"(B$ {price.maintenance_annual() / 4:,.0f} per quarter).", columns=5)
    widths(ws, [12, 70, 10, 16, 22])
    return row


def third_party_sheet(wb):
    ws = wb.create_sheet("3rd-party & infra (indicative)")
    title_block(ws, "Optional cloud hosting and third-party charges (indicative, excluded from iorta fees)")
    ws["A3"] = "Option B: cloud hosting (AWS Singapore / Azure Southeast Asia), pass-through at cost"
    ws["A3"].font = SUBTITLE_FONT
    header_row(ws, 4, ["Service", "Purpose", "B$ per month", "B$ per year"])
    row = 5
    for service, purpose, monthly in price.CLOUD_MONTHLY_ITEMS:
        body_row(ws, row, [service, purpose, monthly, f"=C{row}*12"], money_cols=(3, 4))
        row += 1
    zebra(ws, 5, row - 1, 4)
    body_row(ws, row, ["Cloud infrastructure total", "", f"=SUM(C5:C{row - 1})", f"=SUM(D5:D{row - 1})"],
             money_cols=(3, 4), bold=True, fill=TOTAL_FILL)
    cloud_total_row = row
    row += 1
    body_row(ws, row, ["Managed cloud operations by iorta (optional)", "Patching, monitoring, backups, cost "
                       "management", f"=ROUND(D{row}/12,0)", price.CLOUD_MANAGED_OPERATIONS_ANNUAL],
             money_cols=(3, 4))
    ops_row = row
    row += 1
    body_row(ws, row, ["Option B annual total", "", "", f"=D{cloud_total_row}+D{ops_row}"], money_cols=(4,),
             bold=True, fill=TOTAL_FILL)
    row += 2
    ws.cell(row=row, column=1, value="Option A: on-premise (recommended). B$ 0 hosting from iorta; servers, OS, "
                                     "network and DR site provided by IIFT/IITH.").font = BOLD_FONT
    row += 2
    ws.cell(row=row, column=1, value="Third-party charges: excluded, payable at cost (COM-17)").font = SUBTITLE_FONT
    row += 1
    header_row(ws, row, ["Item", "Basis", "Provider / note", "Indicative amount"])
    first = row + 1
    for item, basis, provider, amount in price.THIRD_PARTY_CHARGES:
        row += 1
        body_row(ws, row, [item, basis, provider, amount])
    zebra(ws, first, row, 4)
    note(ws, row + 2, "Cloud prices are indicative, vary with usage and exchange rates, and are confirmed before "
                      "provisioning. Use of cloud is subject to IIFT data-residency approval and AMBD outsourcing / "
                      "cloud notification.", columns=4)
    widths(ws, [52, 40, 30, 48])
    return cloud_total_row, ops_row


def assumptions_sheet(wb):
    ws = wb.create_sheet("Assumptions")
    title_block(ws, "Commercial assumptions")
    items = [
        f"Currency: Brunei Dollars (B$). USD equivalents indicative at USD 1 = B$ {price.FX_BND_PER_USD:.2f}, rounded to the nearest dollar; B$ figures are binding.",
        "Withholding tax (WHT): Inclusive; fees quoted gross; any Brunei WHT deducted by IIFT is borne by iorta TechNXT.",
        f"Out-of-pocket expenses (OPE): Included for {price.PLANNED_ONSITE_VISITS} planned onsite visits (kick-off, design workshop, UAT/training, go-live).",
        "Third-party charges: Excluded; SMS, AML data subscription, SSL certificates, e-mail relay, infrastructure; payable at cost.",
        f"{brand.PRODUCT} licence bundled at B$ 0: perpetual, royalty-free, enterprise-wide, unlimited users. The core platform remains iorta TechNXT IP; source code of the deployed solution is delivered; escrow optional.",
        "Implementation is a fixed price for the scope in the proposal; changes follow the change request process at the rate card.",
        f"Maintenance: flat for five years ({price.MAINTENANCE_ESCALATION:.0%} escalation), billed {price.MAINTENANCE_BILLING.lower()}.",
        f"Warranty: {price.WARRANTY_MONTHS} months from go-live, included.",
        "Sizing basis: 26 named users (Appendix 1) and ~628 policies per year (Appendix 2); designed for 100 concurrent / 500 named users without redesign.",
        "Recommended hosting: on-premise in the IIFT/IITH data centre (no hosting charge from iorta). Cloud costs shown are optional and indicative.",
        "Data migration: agent, agency, bank, branch, participant and reference data, estimated below 10,000 records from up to three source extracts.",
        f"Quotation validity: {price.QUOTATION_VALIDITY_DAYS} days from the date of submission.",
    ]
    header_row(ws, 4, ["#", "Assumption"])
    for index, text in enumerate(items, start=1):
        body_row(ws, 4 + index, [index, text])
    zebra(ws, 5, 4 + len(items), 2)
    widths(ws, [5, 130])


def summary_sheet(ws, one_time_refs, maintenance_total_row, cloud_rows):
    """Sheet 1: the fee table in the exact format requested by IIFT, plus maintenance and TCO."""
    ws.title = "Summary (RFP format)"
    title_block(ws, f"{brand.PROPOSAL_TITLE}: {brand.PRODUCT} commercial summary")
    rows = [("Client", brand.CLIENT), ("Bidder", brand.BIDDER), ("Currency", "Brunei Dollar (B$)")]
    for offset, (label, value) in enumerate(rows):
        ws.cell(row=3 + offset, column=1, value=label).font = BOLD_FONT
        ws.cell(row=3 + offset, column=3, value=value).font = BODY_FONT
    ws.cell(row=6, column=1, value="Indicative FX (B$ per USD 1)").font = BOLD_FONT
    fx = ws.cell(row=6, column=3, value=price.FX_BND_PER_USD)
    fx.fill = INPUT_FILL
    fx.number_format = "0.00"

    bd = "'One-time breakdown'"
    mt = "'Maintenance 5 years'"
    tp = "'3rd-party & infra (indicative)'"
    headers = ["Description", "Fee (B$)", "Fee (USD)", "WHT", "OPE", "Total (B$)", "Total (USD)"]

    def fee_table(start_row, heading, lines, total_label):
        ws.cell(row=start_row, column=1, value=heading).font = SUBTITLE_FONT
        header_row(ws, start_row + 1, headers)
        row = start_row + 2
        for label, ref in lines:
            body_row(ws, row, [label, f"={ref}", usd(f"B{row}"), "Inclusive", "Included", f"=B{row}",
                               usd(f"F{row}")], money_cols=(2, 3, 6, 7))
            row += 1
        body_row(ws, row, [total_label, f"=SUM(B{start_row + 2}:B{row - 1})", usd(f"B{row}"), "Inclusive",
                           "Included", f"=SUM(F{start_row + 2}:F{row - 1})", usd(f"F{row}")],
                 money_cols=(2, 3, 6, 7), bold=True, fill=TOTAL_FILL)
        return row

    one_time_row = one_time_refs["one_time"]
    one_time_total = fee_table(8, "A. One-time implementation fee (fixed price)", [
        ("Agent/Banca Portal", f"{bd}!D{one_time_row}"),
        ("Back-office solution", f"{bd}!E{one_time_row}"),
    ], "Total one-time fee")
    maintenance_total = fee_table(one_time_total + 2, "B. Annual maintenance & support fee (Years 1–5, flat)", [
        ("Agent/Banca Portal", f"{mt}!D6"),
        ("Back-office solution", f"{mt}!E6"),
    ], "Total per year")

    row = maintenance_total + 2
    ws.cell(row=row, column=1, value="C. Five-year total cost of ownership").font = SUBTITLE_FONT
    header_row(ws, row + 1, ["Cost element", "Option A: on-premise (B$)", "Option A (USD)", "",
                             "", "Option B: cloud (B$)", "Option B (USD)"])
    cloud_total_row, ops_row = cloud_rows
    tco = [
        ("One-time implementation", f"=B{one_time_total}", f"=B{one_time_total}"),
        ("Software licence (5 years)", 0, 0),
        ("Maintenance & support (5 years)", f"={mt}!F{maintenance_total_row}", f"={mt}!F{maintenance_total_row}"),
        ("Cloud infrastructure pass-through (5 years)", 0, f"=5*{tp}!D{cloud_total_row}"),
        ("Managed cloud operations (5 years)", 0, f"=5*{tp}!D{ops_row}"),
    ]
    first = row + 2
    for offset, (label, on_prem, cloud) in enumerate(tco):
        r = first + offset
        body_row(ws, r, [label, on_prem, usd(f"B{r}"), "", "", cloud, usd(f"F{r}")], money_cols=(2, 3, 6, 7))
    last = first + len(tco) - 1
    total = last + 1
    body_row(ws, total, ["Five-year TCO", f"=SUM(B{first}:B{last})", usd(f"B{total}"), "", "",
                         f"=SUM(F{first}:F{last})", usd(f"F{total}")], money_cols=(2, 3, 6, 7), bold=True,
             fill=TOTAL_FILL)

    notes = [
        "WHT inclusive: fees are quoted gross; any Brunei withholding tax deducted by IIFT is borne by iorta TechNXT.",
        f"OPE included: travel and subsistence for the {price.PLANNED_ONSITE_VISITS} planned onsite visits are included.",
        "Third-party charges excluded: SMS, AML data subscription, SSL certificates, e-mail relay and infrastructure, at cost.",
        f"Both fee lines are modules of {brand.PRODUCT}: Agent/Banca Portal ({brand.PRODUCT}) and Back-office solution ({brand.PRODUCT}).",
        f"{brand.PRODUCT} licence bundled at B$ 0: perpetual, royalty-free, enterprise-wide, unlimited users. The core platform remains iorta TechNXT IP; source code of the deployed solution is delivered; escrow optional.",
        "USD figures are indicative and rounded per cell; the B$ amounts are binding.",
        f"Quotation validity: {price.QUOTATION_VALIDITY_DAYS} days from submission.",
    ]
    row = total + 2
    for text in notes:
        note(ws, row, text, columns=7)
        ws.row_dimensions[row].height = 16
        row += 1
    widths(ws, [44, 18, 14, 12, 12, 18, 14])
    return {"one_time_total": one_time_total, "maintenance_total": maintenance_total, "tco_total": total}


def build(output: Path = brand.XLSX_OUTPUT) -> Path:
    price.verify()
    wb = Workbook()
    summary = wb.active
    one_time_refs = one_time_sheet(wb)
    integration_sheet(wb)
    maintenance_total_row = maintenance_sheet(wb)
    rate_card_sheet(wb)
    milestones_sheet(wb, f"'One-time breakdown'!F{one_time_refs['one_time']}")
    cloud_rows = third_party_sheet(wb)
    assumptions_sheet(wb)
    summary_sheet(summary, one_time_refs, maintenance_total_row, cloud_rows)
    for ws in wb.worksheets:
        ws.sheet_properties.tabColor = brand.MAGENTA if ws is summary else brand.ORANGE
        ws.sheet_view.showGridLines = False
        ws.page_setup.orientation = "landscape"
        ws.page_setup.fitToWidth = 1
        ws.oddFooter.center.text = f"{brand.CLASSIFICATION} | Page &P of &N"
    props = wb.properties
    props.creator = brand.BIDDER
    props.lastModifiedBy = brand.BIDDER
    props.title = f"{brand.PROPOSAL_TITLE}: Commercial Pricing"
    props.subject = f"Commercial proposal to {brand.CLIENT}"
    wb.save(str(output))
    return output


# --- Verification ---------------------------------------------------------------------------
def verify_workbook(path: Path) -> None:
    """Recompute the workbook's totals in Python and compare with approved figures.

    Formulas are evaluated with a small resolver that handles the functions
    this workbook uses (SUM, ROUND, arithmetic, cross-sheet references).
    """
    import re
    from openpyxl import load_workbook

    wb = load_workbook(str(path))
    cache = {}

    def value(sheet, ref):
        key = (sheet, ref.replace("$", ""))
        if key not in cache:
            raw = wb[sheet][key[1]].value
            cache[key] = evaluate(sheet, raw) if isinstance(raw, str) and raw.startswith("=") else (raw or 0)
        return cache[key]

    def cell_range(sheet, start, end):
        ws = wb[sheet]
        return [value(sheet, c.coordinate) for row in ws[start:end] for c in row]

    def evaluate(sheet, formula):
        expr = formula[1:]
        ref = r"(?:'([^']+)'!)?\$?([A-Z]+)\$?(\d+)"
        expr = re.sub(r"SUM\(" + ref + r":\$?([A-Z]+)\$?(\d+)\)",
                      lambda m: str(sum(cell_range(m.group(1) or sheet, f"{m.group(2)}{m.group(3)}",
                                                   f"{m.group(4)}{m.group(5)}"))), expr)
        expr = re.sub(ref, lambda m: repr(value(m.group(1) or sheet, f"{m.group(2)}{m.group(3)}")), expr)
        expr = expr.replace("ROUND", "_round").replace("^", "**")
        return eval(expr, {"_round": lambda x, d: round(x, int(d))})  # formulas are written by this script

    def row_of(sheet, label, column="A"):
        return next(c.row for c in wb[sheet][column] if c.value == label)

    summary = "Summary (RFP format)"
    one_time = row_of(summary, "Total one-time fee")
    per_year = row_of(summary, "Total per year")
    tco = row_of(summary, "Five-year TCO")
    integration = row_of("Integration per interface", "Total integration")
    milestones = row_of("Payment milestones", "Total")
    cloud = row_of("3rd-party & infra (indicative)", "Cloud infrastructure total")
    breakdown = row_of("One-time breakdown", "Subtotal one-time (items 1–11)", column="B")
    checks = {
        "one-time total (B$)": (value(summary, f"B{one_time}"), price.one_time_total()),
        "one-time portal (B$)": (value(summary, f"B{one_time - 2}"), price.one_time_portal()),
        "one-time back-office (B$)": (value(summary, f"B{one_time - 1}"), price.one_time_backoffice()),
        "one-time total (USD)": (value(summary, f"C{one_time}"), price.usd(price.one_time_total())),
        "breakdown subtotal one-time (B$)": (value("One-time breakdown", f"F{breakdown}"), price.one_time_total()),
        "maintenance per year (B$)": (value(summary, f"B{per_year}"), price.maintenance_annual()),
        "maintenance 5 years (B$)": (value(summary, f"B{tco - 3}"), price.maintenance_total()),
        "five-year TCO on-premise (B$)": (value(summary, f"B{tco}"), price.tco_on_prem()),
        "five-year TCO on-premise (USD)": (value(summary, f"C{tco}"), price.usd(price.tco_on_prem())),
        "five-year TCO cloud (B$)": (value(summary, f"F{tco}"), price.tco_cloud()),
        "integration total (B$)": (value("Integration per interface", f"E{integration}"),
                                   price.integration_portal() + price.integration_backoffice()),
        "payment milestones total (B$)": (value("Payment milestones", f"D{milestones}"), price.one_time_total()),
        "cloud per year (B$)": (value("3rd-party & infra (indicative)", f"D{cloud}"), price.cloud_annual()),
    }
    failures = {k: v for k, v in checks.items() if v[0] != v[1]}
    for name, (actual, expected) in checks.items():
        print(f"  {'OK ' if actual == expected else 'ERR'} {name}: {actual:,} (expected {expected:,})")
    if failures:
        raise AssertionError(f"Workbook totals do not match: {failures}")


if __name__ == "__main__":
    path = build()
    print(f"Wrote {path}")
    verify_workbook(path)
    print("All workbook totals verified.")
