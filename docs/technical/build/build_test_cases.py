"""Build the SalesVerse 2.0 Test Cases workbook (.xlsx): scenarios, conditions, cases,
defects, traceability to the RFP and the execution log, with a Summary sheet whose
formulas count the Cases sheet.

Usage:
    python3 docs/technical/build/build_test_cases.py

Statuses are read from docs/technical/evidence at build time (unit and end-to-end
results, security checks, the API run written by tools/testing/api-test-run.mjs and the
suite re-runs). The build verifies every reference and, after writing, recalculates the
workbook with LibreOffice to confirm the Summary formulas agree with the catalogue.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import tech_kit  # noqa: E402
from tech_kit import TECH_DIR, PRODUCT, CLIENT, BIDDER, CLASSIFICATION, brand  # noqa: E402
from xlsx_kit import SheetWriter, add_logo, finish, recalc_errors, recalculated_values, set_widths  # noqa: E402
from openpyxl import Workbook  # noqa: E402
from openpyxl.styles import Alignment, Font, PatternFill  # noqa: E402
from openpyxl.utils import get_column_letter  # noqa: E402
from openpyxl.worksheet.table import Table, TableStyleInfo  # noqa: E402
from reports_common import load_json  # noqa: E402
import test_status as status  # noqa: E402
import test_scenarios as ts  # noqa: E402

OUTPUT = status.XLSX
STATUS_FILL = {
    "Passed": PatternFill("solid", fgColor="E3F3E8"),
    "Failed": PatternFill("solid", fgColor="FBE3E3"),
    "Blocked": PatternFill("solid", fgColor="FFF1D6"),
    "Not executed": PatternFill("solid", fgColor="EEEEEE"),
}
BODY = Font(name="Arial", size=9, color=brand.TEXT_DARK)
HEADER_FONT = Font(name="Arial", size=9, bold=True, color="FFFFFF")
HEADER_FILL = PatternFill("solid", fgColor=brand.MAGENTA)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="top", wrap_text=True)


# --- data sheets with the header in row 1 ---------------------------------------------------------
def data_sheet(wb, name, headers, widths, rows, center=(), status_col=None, number_cols=(), row_height=None):
    ws = wb.create_sheet(name)
    set_widths(ws, widths)
    for col, text in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col, value=text)
        cell.font, cell.fill = HEADER_FONT, HEADER_FILL
        cell.alignment = Alignment(wrap_text=True, vertical="center")
    ws.row_dimensions[1].height = 30
    for r, values in enumerate(rows, start=2):
        for col, value in enumerate(values, start=1):
            cell = ws.cell(row=r, column=col, value=value)
            cell.font = BODY
            cell.alignment = CENTER if col in center else WRAP
            if col in number_cols:
                cell.number_format = "0"
        if status_col:
            fill = STATUS_FILL.get(values[status_col - 1])
            if fill:
                ws.cell(row=r, column=status_col).fill = fill
        if row_height:
            ws.row_dimensions[r].height = row_height
    last_col = get_column_letter(len(headers))
    if rows:
        table = Table(displayName=name.replace(" ", "").replace("-", ""), ref=f"A1:{last_col}{len(rows) + 1}")
        table.tableStyleInfo = TableStyleInfo(name="TableStyleLight1", showRowStripes=True)
        ws.add_table(table)
    ws.freeze_panes = "B2"
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    return ws


def numbered(steps):
    return "\n".join(f"{i}. {step}" for i, step in enumerate(steps, start=1))


# --- sheets ---------------------------------------------------------------------------------------
def readme_sheet(ws, totals, run_summary):
    ws.title = "Read-me"
    set_widths(ws, [30, 110])
    for r in (1, 2, 3):
        ws.row_dimensions[r].height = 16
    add_logo(ws, "A1", height_px=56)
    s = SheetWriter(ws, 2)
    s.title(f"{PRODUCT} – Test Cases", subtitle=f"{BIDDER} – {brand.SOLUTION_NAME} for {CLIENT} – {brand.SUBMISSION_DATE}", row=4)
    s.label_value("Document reference", "IIFT-SV2-TCS", value_col=2)
    s.label_value("RFP deliverables", "DEL-13 (test scenarios and expected results), DEL-14 precursor (execution evidence); UAT cases (DEL-15) are derived from the scenarios marked UAT", value_col=2)
    s.label_value("Status as of", f"{totals['as_of']}, source commit {totals['commit']}", value_col=2)
    s.label_value("Companion document", "SalesVerse-2.0-Test-Strategy (IIFT-SV2-TST): levels, environments, entry/exit criteria, schedule; its 'Status post testing' section is built from the same data as the Summary sheet", value_col=2)
    s.label_value("Classification", CLASSIFICATION, value_col=2)
    s.skip()
    s.section("How to read this workbook")
    s.bullets([
        "Scenarios: one business or technical situation per row, traced to RFP identifiers (AP, BO, INT, COM, NFR, DEL, MNT, FFR) with persona, pre-conditions and expected end state.",
        "Conditions: the rules and decisions inside each scenario that at least one case verifies (for example 'nominee shares must total 100%').",
        "Cases: the executable cases with numbered steps, test data, expected result, level, automation, status, evidence and execution details. Filter by Area, Level or Status.",
        "Defects: failures found during the run with severity and status (headers only when none).",
        "Traceability: every RFP requirement in scope with its scenarios, case identifiers and coverage; requirements without a case are marked.",
        "Execution log: every API case executed by the test run script, the automated suite re-runs and the security check run, with request, response and verdict.",
        "Summary: counts by status, level, area and automation as formulas over the Cases sheet, with the catalogue's own count beside each for a drift check.",
    ], columns=2)
    s.skip()
    s.section("Status and level definitions")
    s.header(["Term", "Meaning"], height=20)
    for term, meaning in [
        ("Passed", "Executed and the expected result observed (automated run, API run or manual exploratory run with a screen capture)."),
        ("Failed", "Executed and the expected result not observed; a defect reference is given."),
        ("Blocked", "Execution attempted but a pre-condition was not available in the test data or environment."),
        ("Not executed", "Not run in the iorta test environment; the Evidence column states why (IIFT environment, time-based job, UAT, VAPT, performance scale, not yet built)."),
        ("Unit", "Vitest unit tests of the API (business rules, rating engines, validators) and of web components (Testing Library)."),
        ("API", "System cases executed by tools/testing/api-test-run.mjs through the HTTP API of the running demonstration instance."),
        ("E2E", "The end-to-end suite apps/api/test/*.e2e-spec.ts (supertest against a dedicated PostgreSQL test database)."),
        ("UI", "Manual exploratory runs in the browser; evidence is a screen capture in evidence/ui-screens."),
        ("Security", "The OWASP Top 10 checks in tools/security/security-checks.mjs."),
        ("SIT / Perf / UAT", "Levels that need IIFT's systems, scale or users; executed in weeks 16–22 of the plan."),
        ("Automation", "'Automated – <spec>' for tests in the repository; 'Executed – API run' for the scripted run; 'Manual (exploratory)'; 'Not automated'."),
    ]:
        s.line([term, meaning], bold=False)
    s.skip()
    s.section("Evidence files (docs/technical/evidence)")
    s.header(["File", "Content"], height=20)
    for name, content in [
        ("api-unit-tests.json", "Vitest results of the API unit tests (59)"),
        ("web-unit-tests.json", "Vitest results of the web unit tests at the evidence capture (81)"),
        ("api-e2e-tests.json", "Vitest results of the end-to-end suite (32)"),
        ("test-reruns.json", "Re-runs of the three suites by iorta QA on 2 October 2026 (59, 91 and 32 tests); the later result is the status shown"),
        ("security-checks.json", "29 OWASP checks (see the Security Assessment Report)"),
        ("api-test-run.json", f"API run of {run_summary['total']} cases: {run_summary['passed']} passed, {run_summary['failed']} not passed; started {run_summary['startedAt'][:16].replace('T', ' ')} UTC"),
        ("ui-screens/", "Screen captures cited by the manual cases (JPEG copies of the PNG captures)"),
    ]:
        s.line([name, content])
    s.skip()
    s.section("Conventions")
    s.bullets([
        "Demonstration users: ag-000001 (agency principal), ag-000002 (sub-agent), ag-000003 (principal of another agency), bk-000004 and bk-000005 (bank officers; the bank is blocked for new business), manager, ops.maker, ops.checker, underwriter, finance, compliance, support, admin.",
        "Dates in the execution log are UTC; the application's business day is the Brunei calendar day (UTC+8).",
        "Cases are numbered CS-nnnn in area order; scenario and condition identifiers are stable keys used by the Test Strategy.",
        "The workbook is generated by docs/technical/build/build_test_cases.py; edit the catalogue modules, not the file.",
    ], columns=2)
    ws.freeze_panes = "A5"


def summary_sheet(ws, totals, cases):
    ws.title = "Summary"
    set_widths(ws, [44, 14, 14, 12, 14, 14, 14, 16])
    for r in (1, 2, 3):
        ws.row_dimensions[r].height = 16
    add_logo(ws, "A1", height_px=56)
    s = SheetWriter(ws, 8)
    s.title(f"{PRODUCT} – Test status summary", subtitle=f"As of {totals['as_of']} (commit {totals['commit']}); formulas count the Cases sheet, 'Catalogue' is the generator's count", row=4)

    s.section("Catalogue size")
    s.header(["Item", "Count", "Catalogue", "Check"], height=20)
    for label, formula, expected in [
        ("Test scenarios", "=COUNTA(Scenarios!A:A)-1", totals["scenarios"]),
        ("Test conditions", "=COUNTA(Conditions!A:A)-1", totals["conditions"]),
        ("Test cases", "=COUNTA(Cases!A:A)-1", totals["cases"]),
    ]:
        r = s.row
        s.line([label, formula, expected, f'=IF(B{r}=C{r},"OK","DRIFT")'], center=(2, 3, 4))
    s.skip()

    s.section("Cases by status")
    s.header(["Status", "Cases", "Catalogue", "Check", "Share"], height=20)
    first = s.row
    for st, count in totals["by_status"].items():
        r = s.row
        s.line([f"Status: {st}", f'=COUNTIF(Cases!$L:$L,"{st}")', count, f'=IF(B{r}=C{r},"OK","DRIFT")', f"=B{r}/$B${first + 4}"], center=(2, 3, 4), pct=(5,))
    r = s.line(["Total", f"=SUM(B{first}:B{s.row - 1})", f"=SUM(C{first}:C{s.row - 1})", f'=IF(B{s.row}=C{s.row},"OK","DRIFT")', f"=B{s.row}/$B${s.row}"], center=(2, 3, 4), pct=(5,), total=True)
    s.skip()

    s.section("Cases by level")
    s.header(["Level", "Cases", "Passed", "Failed", "Blocked", "Not executed", "Catalogue", "Check"], height=20)
    first = s.row
    for level, counts in totals["by_level"].items():
        r = s.row
        s.line([status.LEVEL_NAMES[level], f'=COUNTIF(Cases!$J:$J,"{level}")',
                f'=COUNTIFS(Cases!$J:$J,"{level}",Cases!$L:$L,"Passed")', f'=COUNTIFS(Cases!$J:$J,"{level}",Cases!$L:$L,"Failed")',
                f'=COUNTIFS(Cases!$J:$J,"{level}",Cases!$L:$L,"Blocked")', f'=COUNTIFS(Cases!$J:$J,"{level}",Cases!$L:$L,"Not executed")',
                counts["total"], f'=IF(B{r}=G{r},"OK","DRIFT")'], center=(2, 3, 4, 5, 6, 7, 8))
    s.line(["Total", f"=SUM(B{first}:B{s.row - 1})", f"=SUM(C{first}:C{s.row - 1})", f"=SUM(D{first}:D{s.row - 1})", f"=SUM(E{first}:E{s.row - 1})", f"=SUM(F{first}:F{s.row - 1})", f"=SUM(G{first}:G{s.row - 1})", f'=IF(B{s.row}=G{s.row},"OK","DRIFT")'], center=(2, 3, 4, 5, 6, 7, 8), total=True)
    s.skip()

    s.section("Cases by RFP area")
    s.header(["Area", "Cases", "Passed", "Failed", "Blocked", "Not executed", "Catalogue", "Check"], height=20)
    first = s.row
    for code, counts in totals["by_area"].items():
        r = s.row
        s.line([f"{code} – {counts['name']}", f'=COUNTIF(Cases!$D:$D,"{code}")',
                f'=COUNTIFS(Cases!$D:$D,"{code}",Cases!$L:$L,"Passed")', f'=COUNTIFS(Cases!$D:$D,"{code}",Cases!$L:$L,"Failed")',
                f'=COUNTIFS(Cases!$D:$D,"{code}",Cases!$L:$L,"Blocked")', f'=COUNTIFS(Cases!$D:$D,"{code}",Cases!$L:$L,"Not executed")',
                counts["total"], f'=IF(B{r}=G{r},"OK","DRIFT")'], center=(2, 3, 4, 5, 6, 7, 8))
    s.line(["Total", f"=SUM(B{first}:B{s.row - 1})", f"=SUM(C{first}:C{s.row - 1})", f"=SUM(D{first}:D{s.row - 1})", f"=SUM(E{first}:E{s.row - 1})", f"=SUM(F{first}:F{s.row - 1})", f"=SUM(G{first}:G{s.row - 1})", f'=IF(B{s.row}=G{s.row},"OK","DRIFT")'], center=(2, 3, 4, 5, 6, 7, 8), total=True)
    s.skip()

    s.section("Cases by automation")
    s.header(["Automation", "Cases", "Catalogue", "Check"], height=20)
    patterns = {"Automated": "Automated*", "Executed – API run": "Executed*", "Manual": "Manual*", "Not automated": "Not automated"}
    for label, count in totals["by_automation"].items():
        r = s.row
        s.line([label, f'=COUNTIF(Cases!$K:$K,"{patterns[label]}")', count, f'=IF(B{r}=C{r},"OK","DRIFT")'], center=(2, 3, 4))
    s.skip()
    s.section("Defects")
    s.header(["Item", "Count", "Catalogue", "Check"], height=20)
    r = s.row
    s.line(["Defects recorded", "=COUNTA(Defects!A:A)-1", totals["defects"], f'=IF(B{r}=C{r},"OK","DRIFT")'], center=(2, 3, 4))
    r = s.row
    s.line(["Cases with a defect reference", '=COUNTIF(Cases!$P:$P,"DEF-*")', sum(1 for c in cases if c["defect"]), f'=IF(B{r}=C{r},"OK","DRIFT")'], center=(2, 3, 4))
    ws.freeze_panes = "A5"


def scenarios_sheet(wb, scenarios):
    rows = []
    for sc in scenarios:
        rows.append([sc["id"], f"{sc['area']} – {ts.AREA_NAME[sc['area']]}", sc["rfp"], sc["persona"], sc["description"], sc["preconditions"], sc["end_state"],
                     f'=COUNTIF(Conditions!$B:$B,A{len(rows) + 2})', f'=COUNTIF(Cases!$B:$B,A{len(rows) + 2})'])
    data_sheet(wb, "Scenarios", ["ID", "Area", "RFP IDs", "Persona", "Scenario", "Pre-conditions", "Expected end state", "Conditions", "Cases"],
               [9, 26, 22, 24, 60, 34, 40, 11, 9], rows, center=(1, 8, 9))


def conditions_sheet(wb, conditions):
    rows = []
    for c in conditions:
        r = len(rows) + 2
        sc = ts.SCENARIO_BY_ID[c["scenario"]]
        rows.append([c["id"], c["scenario"], f"{sc['area']} – {ts.AREA_NAME[sc['area']]}", c["text"],
                     f'=COUNTIF(Cases!$C:$C,A{r})', f'=COUNTIFS(Cases!$C:$C,A{r},Cases!$L:$L,"Passed")',
                     f'=COUNTIFS(Cases!$C:$C,A{r},Cases!$L:$L,"Failed")', f'=COUNTIFS(Cases!$C:$C,A{r},Cases!$L:$L,"Blocked")',
                     f'=COUNTIFS(Cases!$C:$C,A{r},Cases!$L:$L,"Not executed")'])
    data_sheet(wb, "Conditions", ["ID", "Scenario", "Area", "Condition / rule under test", "Cases", "Passed", "Failed", "Blocked", "Not executed"],
               [9, 10, 26, 80, 8, 8, 8, 8, 12], rows, center=(1, 2, 5, 6, 7, 8, 9))


def cases_sheet(wb, cases):
    rows = [[c["id"], c["scenario"], c["condition"], c["area"], c["title"], c["persona"], numbered(c["steps"]), c["data"], c["expected"],
             c["level"], c["automation"], c["status"], c["evidence"], c["executed_on"], c["executed_by"], c["defect"]] for c in cases]
    data_sheet(wb, "Cases", ["ID", "Scenario", "Condition", "Area", "Title", "Persona / user", "Steps", "Test data", "Expected result", "Level",
                             "Automation", "Status", "Evidence", "Executed on", "Executed by", "Defect ref"],
               [9, 9, 9, 7, 44, 20, 52, 30, 46, 9, 34, 12, 60, 16, 20, 10], rows, center=(1, 2, 3, 4, 10, 12), status_col=12)


def defects_sheet(wb, cases):
    rows = []
    for d in status.DEFECTS:
        linked = ", ".join(c["id"] for c in cases if c["defect"] == d["id"])
        rows.append([d["id"], d["title"], d["severity"], d["priority"], d["area"], d["description"], d["found_by"], d["status"], linked])
    ws = data_sheet(wb, "Defects", ["ID", "Title", "Severity", "Priority", "Area", "Description", "Found by", "Status", "Cases"],
                    [9, 44, 10, 10, 30, 80, 30, 40, 14], rows, center=(1, 3, 4))
    if not rows:
        ws.cell(row=2, column=1, value="No defects were found in the executed cases.").font = BODY


def traceability_sheet(wb, cases):
    rows = [[r["id"], r["area"], r["title"], r["scenarios"], r["cases"], r["executed"], r["passed"], r["failed"], r["case_ids"], r["coverage"]]
            for r in status.traceability(cases)]
    data_sheet(wb, "Traceability", ["RFP ID", "Area", "Requirement", "Scenarios", "Cases", "Executed", "Passed", "Failed", "Case IDs", "Coverage"],
               [9, 22, 40, 24, 8, 9, 8, 8, 60, 26], rows, center=(1, 5, 6, 7, 8), number_cols=(5, 6, 7, 8))


def execution_log_sheet(wb, run_summary):
    rows = []
    run = load_json("api-test-run.json")
    for r in run["results"]:
        moment = datetime.fromisoformat(r["executedAt"].replace("Z", "+00:00"))
        rows.append([f"API run {run['summary']['runId']}", f"{moment:%Y-%m-%d %H:%M:%S} UTC", run["summary"]["executedBy"], f"{r['id']} – {r['title']}", r["actor"], r["request"], r["expected"], r["response"] + (f" Note: {r['note']}" if r.get("note") else ""), r["result"]])
    reruns = load_json("test-reruns.json") or {"suites": {}}
    for key, suite in reruns["suites"].items():
        moment = datetime.fromtimestamp(suite["startTime"] / 1000, tz=timezone.utc)
        for t in suite["tests"]:
            rows.append([f"Suite re-run ({key})", f"{moment:%Y-%m-%d %H:%M:%S} UTC", "iorta QA (Vitest)", t["fullName"], "–", suite["command"], "Test passes", (t["failure"] or "passed").splitlines()[0][:200], "Passed" if t["status"] == "passed" else "Failed"])
    sec = load_json("security-checks.json")
    moment = datetime.fromisoformat(sec["summary"]["runAt"].replace("Z", "+00:00"))
    for r in sec["results"]:
        rows.append(["Security checks", f"{moment:%Y-%m-%d %H:%M:%S} UTC", "iorta QA (security-checks.mjs)", f"{r['id']} – {r['title']}", "script users", f"node tools/security/security-checks.mjs ({sec['summary']['baseUrl']})", "PASS", r["result"], "Passed" if r["result"] == "PASS" else "Failed"])
    rows.append(["Manual UI run", "2026-10-02 (Brunei afternoon)", "iorta QA (manual, exploratory)", "Portal and back-office screens listed on the Cases sheet (level UI)", "demo users", "Browser against http://localhost:5173", "Screens behave as described", "Screen captures in evidence/ui-screens", "Passed"])
    rows.append(["Environment note", "2026-10-02 21:44–21:49 UTC", "iorta QA", "First API run", "shared demo accounts", "Other engineers signed in to the same demonstration accounts from the UI during the run", "–", "Single-active-session ended 25 cases' sessions; the script now signs in again and the run was repeated (final run recorded above)", "Not executed"])
    data_sheet(wb, "Execution log", ["Run", "When", "Executed by", "Case / test", "Actor", "Request / command", "Expected", "Response / outcome", "Result"],
               [20, 20, 22, 48, 18, 50, 46, 60, 10], rows, center=(9,), status_col=9)


# --- build and verify -----------------------------------------------------------------------------
def build(path: Path = OUTPUT):
    scenarios, conditions, cases, run_summary = status.build_catalogue()
    totals = status.summary(cases)
    wb = Workbook()
    readme = wb.active
    summary = wb.create_sheet("Summary")
    scenarios_sheet(wb, scenarios)
    conditions_sheet(wb, conditions)
    cases_sheet(wb, cases)
    defects_sheet(wb, cases)
    traceability_sheet(wb, cases)
    execution_log_sheet(wb, run_summary)
    readme_sheet(readme, totals, run_summary)
    summary_sheet(summary, totals, cases)
    finish(wb, f"{PRODUCT} – Test Cases", f"Test scenarios, conditions, cases and results for {CLIENT}", readme)
    for ws in wb.worksheets:
        ws.oddFooter.left.text = f"{CLASSIFICATION} | IIFT-SV2-TCS v{brand.DOCUMENT_VERSION}"
    wb.properties.keywords = f"{PRODUCT}; IIFT; test cases; traceability"
    wb.save(str(path))
    return path, totals


def verify(path: Path, totals):
    values = recalculated_values(path)
    if values is None:
        raise SystemExit("LibreOffice is required to verify the workbook formulas")
    errors = recalc_errors(path)
    if errors:
        raise AssertionError(f"Workbook error cells: {errors[:10]}")
    drift = []
    for ws in values.worksheets:
        for row in ws.iter_rows():
            for cell in row:
                if cell.value == "DRIFT":
                    drift.append(f"{ws.title}!{cell.coordinate}")
    if drift:
        raise AssertionError(f"Summary formulas differ from the catalogue: {drift}")
    summary = values["Summary"]
    checked = 0
    for row in summary.iter_rows():
        if isinstance(row[0].value, str) and row[0].value.startswith("Status:"):
            label = row[0].value.split(":", 1)[1].strip()
            if row[1].value != totals["by_status"][label]:
                raise AssertionError(f"Summary {label}: {row[1].value} != {totals['by_status'][label]}")
            checked += 1
    print(f"  Workbook recalculated with LibreOffice: no error cells, {checked} status counts verified, no drift")


def main():
    path, totals = build()
    print(f"Wrote {path}")
    verify(path, totals)


if __name__ == "__main__":
    main()
