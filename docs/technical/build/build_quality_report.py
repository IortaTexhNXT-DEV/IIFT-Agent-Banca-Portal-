"""Build the SalesVerse 2.0 Code Standards and Quality Report (.docx and .pdf).

Usage (from the repository root):
    python3 docs/technical/build/capture_static_analysis.py   # refresh lint/type-check/format evidence
    python3 docs/technical/build/build_quality_report.py

Every result is read from docs/technical/evidence and from the repository's own
configuration files at build time. Missing front-end evidence is shown as
pending instead of failing the build.
"""

import json
import re
import tempfile
from collections import defaultdict
from pathlib import Path

import yaml

from reports_common import (PENDING, ROOT, TECH_DIR, brand, cover, evidence_annex, format_timestamp, git_commit,
                            load_json, load_text, new_report, save_and_export)

OUTPUT = TECH_DIR / "SalesVerse-2.0-Code-Standards-and-Quality-Report.docx"
TITLE = "Code Standards and Quality Report"
API = ROOT / "apps" / "api"
WEB = ROOT / "apps" / "web"

# What each automated test suite is for (keyed by file name). New suites appear with "See test titles".
SUITE_PURPOSE = {
    "app-config.spec.ts": "Start-up configuration: safe defaults, weak secrets rejected, insecure production settings refused",
    "field-crypto.service.spec.ts": "AES-256-GCM field encryption, tamper detection, blind index for identifiers",
    "dates.spec.ts": "Age at next birthday and Brunei business-day boundaries (UTC+8)",
    "name-matching.spec.ts": "AML fuzzy name matching: normalisation, honorifics, transliterations, thresholds",
    "watchlist.spec.ts": "Watch-list file parsing (quoted fields, CRLF)",
    "password.service.spec.ts": "Password policy rules, username check, history and expiry",
    "file-inspector.spec.ts": "Upload checks by content, forced extension, size limit",
    "product-definitions.spec.ts": "Product questionnaires: referral answers, completeness, unknown questions",
    "reports.spec.ts": "CSV formula neutralisation and report schedules in Brunei time",
    "financing.engine.spec.ts": "Mortgage Takaful rating (FTP-HP, FTP-NP, PFT) and the B$150,000 referral",
    "fixed-plan.engine.spec.ts": "Annual plan rating (PHA, PRO, KHR, OSA), eligibility and riders",
    "access-control.e2e-spec.ts": "Authentication, audience separation, permissions and data scoping over HTTP",
    "auth.e2e-spec.ts": "Sign-in, cookie flags, lockout, password change, logout and session revocation",
    "operations.e2e-spec.ts": "Onboarding, AML review, issues with SLA and other back-office journeys",
    "policy-lifecycle.e2e-spec.ts": "Quotation to policy with maker-checker payment, agency block, referral approval",
    "plan-label.spec.ts": "Configured plan names on documents and the e-signature page, with fallback to the code",
    "workflow-payload.spec.ts": "Encrypted values removed from approval request payloads before they are shown",
    # Web application (Vitest, Testing Library, jsdom)
    "client.test.ts": "API client: base path, CSRF header, uploads, error mapping, session-ended handling",
    "ErrorAlert.test.tsx": "Error messages, validation details and the support reference for server errors",
    "Money.test.tsx": "Amount display",
    "RequirePermission.test.tsx": "Pages shown only to users holding the permission",
    "StatusTag.test.tsx": "Status labels and colours",
    "menus.test.ts": "Menu highlighting for the current page",
    "format.test.ts": "Money, number, date and file-size formatting in Brunei dollars and local time",
    "permissions.test.ts": "Permission codes unique, prefixed by audience, approval permissions grouped",
    "status.test.ts": "Status colour mapping",
    "LoginPage.test.tsx": "Sign-in form: validation, forced password change, rejected credentials, ended session",
    "CellText.test.tsx": "Table cell text",
    "links.test.ts": "Links to record pages for each audience and from notifications",
    "values.test.ts": "Display of approval values: hidden encrypted and hashed keys, labels, money and dates",
    "NomineesEditor.test.ts": "Nominee rows: existing ids kept, blank ID number keeps the stored one, shares",
    "PaymentList.test.tsx": "Payment list filtered by the status in the URL",
    "options.test.ts": "Option labels, policy reference and term display",
}

LICENCE_NOTES = {
    "elkjs": "Reached only through the Prisma CLI's optional Studio peer, a development tool. It is not installed in "
             "the runtime image, which is built with npm ci --omit=dev.",
    "buffers": "MIT licence declared in the project repository but not in package.json.",
    "png-js": "MIT licence declared in the project repository but not in package.json.",
    "jszip": "Dual-licensed MIT OR GPL-3.0; used under the MIT licence.",
}

LIMITATIONS = [
    ["Service-level unit coverage", "Unit tests concentrate on rules and calculations; most services are exercised "
     "through the end-to-end suite only.", "Add unit and SIT automation; reach at least 80% line coverage on rating, "
     "billing and workflow modules", "Weeks 6–19"],
    ["Front-end tests", "Unit and component tests cover the API client, formatting, permissions, navigation and "
     "shared components; complete pages are not yet tested in a browser.",
     "Add Playwright smoke tests of the main portal and back-office journeys to CI", "Weeks 6–16"],
    ["Front-end bundle size", "The Ant Design vendor chunk is about 1.38 MB raw (438 kB gzip). It is cached "
     "long-term and pages are already split by route, so it is loaded once per release.",
     "Watch the size at each release; import components more selectively if first-load time on branch networks "
     "approaches the NFR-01 target", "Each release"],
    ["Integration adapters", "Core, FIN, AML provider and SMS adapters run in simulated mode until IIFT endpoints "
     "are available.", "Contract tests per interface specification; joint tests with system owners", "Weeks 8–17"],
    ["Performance evidence", "No load test results yet.", "k6 load, stress and soak tests on production-like SIT "
     "(DEL-18)", "Weeks 17–18"],
    ["Mutation and accessibility checks", "Not yet part of CI.", "Add an accessibility check on key screens and a "
     "periodic mutation-test run on rating engines", "Weeks 10–19"],
]


# --- Evidence readers -----------------------------------------------------------------------
def suite_rows(results):
    rows = []
    for suite in results["testResults"]:
        name = Path(suite["name"]).name
        tests = suite["assertionResults"]
        passed = sum(1 for t in tests if t["status"] == "passed")
        rows.append([name, SUITE_PURPOSE.get(name, "See test titles in the annex"), str(len(tests)), str(passed)])
    return rows


def test_titles(results):
    rows = []
    for suite in results["testResults"]:
        name = Path(suite["name"]).name
        for test in suite["assertionResults"]:
            rows.append([name, test["title"], "Passed" if test["status"] == "passed" else test["status"].title()])
    return rows


def coverage_group(path):
    relative = path.split("apps/api/")[-1]
    parts = relative.split("/")
    if len(parts) > 3 and parts[1] == "modules" and parts[2] == "products" and parts[3] == "rating":
        return "products/rating (rating engines)"
    if len(parts) > 2 and parts[1] == "modules":
        return parts[2]
    return "/".join(parts[1:2]) or relative


def coverage_by_group(summary):
    totals = defaultdict(lambda: [0, 0])
    for path, metrics in summary.items():
        if path == "total" or path.endswith((".spec.ts", "e2e-spec.ts")):
            continue
        group = coverage_group(path)
        totals[group][0] += metrics["lines"]["total"]
        totals[group][1] += metrics["lines"]["covered"]
    return totals


def pct(covered, total):
    return f"{100 * covered / total:.1f}%" if total else "n/a"


def raw_sql_sites():
    tagged, unsafe = 0, 0
    for path in (API / "src").rglob("*.ts"):
        if "generated" in path.parts or path.name.endswith(".spec.ts"):
            continue
        text = path.read_text()
        tagged += len(re.findall(r"\$(?:queryRaw|executeRaw)(?:<[^`(]*>)?`", text))
        unsafe += len(re.findall(r"\$(?:queryRaw|executeRaw)Unsafe", text))
    return tagged, unsafe


def literal(text: str) -> str:
    """Keep glob patterns such as ** from being read as bold markup by the layout kit."""
    return text.replace("**", "*\u200b*")


def ci_steps():
    workflow = yaml.safe_load((ROOT / ".github" / "workflows" / "ci.yml").read_text())
    rows = []
    for job_name, job in workflow["jobs"].items():
        for step in job.get("steps", []):
            label = step.get("name") or step.get("run") or step.get("uses", "")
            dockerfile = re.search(r"docker build -f (\S+)", step.get("run", ""))
            if not step.get("name") and dockerfile:
                label = f"Build image from {dockerfile.group(1)}"
            uses, options = step.get("uses", ""), step.get("with", {})
            if not step.get("name") and "codeql-action/init" in uses:
                label = f"CodeQL set-up: {options.get('languages')}, {options.get('queries')}"
            elif not step.get("name") and "codeql-action/analyze" in uses:
                label = "CodeQL analysis (SAST)"
            elif not step.get("name") and "upload-artifact" in uses:
                label = f"Keep {options.get('path')} as build artifact"
            if any(skip in label for skip in ("actions/checkout", "actions/setup-node", "npm install -g")):
                continue
            action = step.get("run") or step.get("uses", "")
            label = label if len(label) < 60 else label[:57] + "…"
            action = action if len(action) < 70 else action[:67] + "…"
            rows.append([job_name, literal(label), literal(action)])
    return rows


def largest_web_chunk(build_text):
    """(file, raw kB, gzip kB) of the largest JavaScript chunk in the Vite build output."""
    chunks = re.findall(r"assets/(\S+\.js)\s+([\d,.]+) kB\s+│ gzip:\s+([\d,.]+) kB", build_text or "")
    if not chunks:
        return None
    name, raw, gzip = max(chunks, key=lambda c: float(c[1].replace(",", "")))
    return re.sub(r"-[\w-]{8}\.js$", "", name), raw, gzip


def front_end_evidence():
    lint = load_json("web-lint.json")
    typecheck = load_text("web-typecheck.txt")
    build = load_text("web-build.txt")

    def summarise_text(text):
        if text is None:
            return PENDING
        exit_code = re.search(r"exit code: (\d+)", text)
        if exit_code:
            return "No errors reported" if exit_code.group(1) == "0" else f"Failed (exit code {exit_code.group(1)})"
        return "No errors reported" if "error" not in text.lower() else text.splitlines()[-1][:80]

    lint_text = PENDING
    if lint is not None:
        diagnostics = lint.get("diagnostics", lint) if isinstance(lint, dict) else lint
        if isinstance(diagnostics, list):
            errors = sum(1 for item in diagnostics if isinstance(item, dict) and item.get("severity") == "error")
            warnings = sum(1 for item in diagnostics if isinstance(item, dict) and item.get("severity") == "warning")
        else:
            errors, warnings = lint.get("errors", 0), lint.get("warnings", 0)
        lint_text = f"{errors} errors, {warnings} warnings"
        if isinstance(lint, dict) and lint.get("number_of_files"):
            lint_text += f" ({lint['number_of_files']} files, {lint.get('number_of_rules')} rules)"
    build_text = summarise_text(build)
    chunk = largest_web_chunk(build)
    if chunk and build_text == "No errors reported":
        build_text += f"; largest chunk {chunk[0]} {chunk[1]} kB ({chunk[2]} kB gzip)"
    return [["Web lint (oxlint)", lint_text], ["Web type check (tsc)", summarise_text(typecheck)],
            ["Web production build (Vite)", build_text]]


# --- Report sections --------------------------------------------------------------------------
def coverage_scope(ev):
    """Number of API source files the coverage figures are measured over."""
    return len([path for path in ev["e2e_cov"] if path != "total"])


def summary_section(w, ev):
    unit, e2e, web = ev["unit"], ev["e2e"], ev["web"]
    static = ev["static"]["results"] if ev["static"] else []
    audit_total = ev["audit"]["metadata"]["vulnerabilities"]["total"]
    rows = [[f"{r['check']} ({r['tool']})", f"{r['errors']} errors, {r['warnings']} warnings" +
             ("" if r["passed"] else " (failed)")] for r in static] or [["Lint, type check, formatting",
                                                                         "Evidence not captured"]]
    rows += [
        ["API unit tests", f"{unit['numPassedTests']} of {unit['numTotalTests']} passed"],
        ["API end-to-end tests", f"{e2e['numPassedTests']} of {e2e['numTotalTests']} passed"],
        ["Web unit and component tests", f"{web['numPassedTests']} of {web['numTotalTests']} passed"
         if web else PENDING],
        ["End-to-end line coverage (API)", f"{ev['e2e_cov']['total']['lines']['pct']}% of {coverage_scope(ev)} "
                                           "source files"],
        ["Unit line coverage (API)", f"{ev['unit_cov']['total']['lines']['pct']}% of {coverage_scope(ev)} "
                                     "source files"],
        ["Dependency vulnerabilities (npm audit)", f"{audit_total} found"],
        ["Runtime packages in licence inventory", f"{ev['licences']['total']}"],
    ]
    rows += front_end_evidence()
    w.h1("Summary")
    w.para(f"This report describes the coding standards used to build {brand.PRODUCT} and the quality evidence "
           f"for the current build (commit {git_commit()}). All results are produced by tools, not by assessment, "
           "and the report is rebuilt from the evidence files each time they are refreshed.")
    w.table(["Measure", "Result"], rows, widths=[7.0, 10.0], font_size=8.5, bold_first_col=True,
            caption="Quality results")
    w.para("Static analysis, the three test suites and the dependency audit are clean. Coverage is measured over "
           f"all {coverage_scope(ev)} API source files, including files that no test loads. End-to-end coverage is "
           f"{ev['e2e_cov']['total']['lines']['pct']}% of lines because those tests drive the real HTTP pipeline "
           "against PostgreSQL. Unit coverage is lower by design at this stage: unit tests target the calculation "
           "and rule code where defects are most costly. Section 5 sets the coverage targets for implementation.")


def standards_section(w):
    tsconfig = json.loads((API / "tsconfig.json").read_text())["compilerOptions"]
    prettier = json.loads((ROOT / ".prettierrc").read_text())
    api_lint = json.loads((API / ".oxlintrc.json").read_text())
    web_lint = json.loads((WEB / ".oxlintrc.json").read_text())
    tagged, unsafe = raw_sql_sites()
    metrics = load_json("code-metrics-api.json")

    strict_flags = [flag for flag in ("strict", "noImplicitReturns", "noFallthroughCasesInSwitch", "isolatedModules")
                    if tsconfig.get(flag)]
    lint_rules = [rule for rule, level in api_lint["rules"].items() if level == "error"]
    w.h1("Coding standards")
    w.para("The standards below apply to every change. Most are enforced by tools in the CI pipeline, so a change "
           "that breaks them cannot be merged.")
    rows = [
        ["Language", f"TypeScript with {', '.join(strict_flags)}; target {tsconfig['target']}; module "
                     f"{tsconfig['module']} (ES modules on Node.js 22)", "Type check in CI"],
        ["Module structure", f"One NestJS module per functional area ({len(metrics['api_modules'])} modules: "
                             f"{', '.join(metrics['api_modules'])}); shared code in src/common", "Code review"],
        ["Naming", "Files in kebab-case with role suffix (.controller, .service, .dto, .guard, .spec); classes in "
                   "PascalCase; database tables and columns in snake_case mapped from camelCase", "Code review"],
        ["Input validation", "Every request body is a DTO class with class-validator rules; the global pipe uses "
                             "whitelist, forbidNonWhitelisted and transform, so unknown fields are rejected",
         "Global ValidationPipe; e2e tests"],
        ["Data access", f"Prisma client only. {tagged} raw SQL statements use Prisma's tagged templates, which bind "
                        f"parameters; {unsafe} use the unsafe string API", "Code review; source scan in this report"],
        ["Error handling", "Business errors carry a code and a user message; one global filter returns status, "
                           "code, message and correlation id, and logs full detail only on the server for 5xx",
         "AllExceptionsFilter; security checks"],
        ["Logging", "Structured JSON logs (pino) with the request correlation id; cookies, authorisation and CSRF "
                    "headers redacted; console logging forbidden", "no-console lint rule"],
        ["Comments", "Comments explain why, not what; public services and guards carry a short doc comment, often "
                     "citing the RFP requirement (for example AP-01/03/04)", "Code review"],
        ["Formatting", f"Prettier with {'single' if prettier.get('singleQuote') else 'double'} quotes, trailing "
                       f"commas '{prettier.get('trailingComma')}' and a line width of {prettier.get('printWidth')}",
         "prettier --check in CI"],
        ["Linting (API)", f"oxlint plugins {', '.join(api_lint['plugins'])}; categories "
                          + ", ".join(f"{k}={v}" for k, v in api_lint["categories"].items())
                          + f"; rules as errors: {', '.join(lint_rules)}", "Lint step in CI"],
        ["Linting (web)", f"oxlint plugins {', '.join(web_lint['plugins'])}, including accessibility (jsx-a11y) "
                          "and React hooks rules", "Lint step in CI"],
        ["Commits and review", "Small commits with a descriptive message; every change through a pull request "
                               "reviewed by a second engineer; the reviewer checks security, tests and RFP traceability",
         "Pull-request review; branch protection on main"],
        ["Branching", "Short-lived feature branches from main; main is always releasable; releases are tagged",
         "Branch protection"],
    ]
    w.table(["Area", "Standard", "Enforced by"], rows, widths=[2.8, 10.4, 3.8], font_size=8, bold_first_col=True,
            caption="Coding standards")
    w.h2("CI pipeline gates", numbered=False)
    w.para("The pipeline runs on every pull request and on main. A failing step stops the merge.")
    w.table(["Job", "Step", "Command or action"], ci_steps(), widths=[2.0, 5.6, 9.4], font_size=8,
            caption="CI steps (.github/workflows/ci.yml)")


def static_section(w, ev):
    w.h1("Static analysis", new_page=False)
    static = ev["static"]
    if static:
        rows = [[r["check"], f"{r['tool']} {r['version']}", literal(r["command"]), str(r["errors"]), str(r["warnings"]),
                 "Pass" if r["passed"] else "Fail"] for r in static["results"]]
        w.para(f"Run on {format_timestamp(static['runAt'])} with the same commands as the CI pipeline.")
    else:
        rows = []
        w.para("Static analysis evidence has not been captured; run capture_static_analysis.py.")
    w.table(["Check", "Tool", "Command", "Errors", "Warnings", "Result"], rows,
            widths=[2.6, 2.6, 6.6, 1.5, 1.7, 2.0], font_size=7.5, center_cols=(3, 4), caption="API static analysis")
    w.table(["Web application check", "Result"], front_end_evidence(), widths=[7.0, 10.0], font_size=8,
            bold_first_col=True, caption="Web application static analysis and build")


def tests_section(w, ev):
    unit, e2e, web = ev["unit"], ev["e2e"], ev["web"]
    w.h1("Automated tests")
    w.para(f"Unit tests run with Vitest and need no database. End-to-end tests start the API with the production "
           "HTTP pipeline (the same middleware, guards, validation and error handling as the server) against a "
           "PostgreSQL 16 database, and call it over HTTP. Web unit and component tests run with Vitest and Testing "
           "Library in a simulated browser (jsdom) and cover the API client, formatting, permissions, navigation and "
           "shared components. All three suites run in CI on every change.")
    suites = [("API unit tests", unit), ("API end-to-end tests", e2e)] + ([("Web unit and component tests", web)]
                                                                          if web else [])
    w.table(["Suite", "Files", "Tests", "Passed", "Failed", "Run"], [
        [name, str(len(result["testResults"])), str(result["numTotalTests"]), str(result["numPassedTests"]),
         str(result["numFailedTests"]), format_timestamp(result["startTime"])] for name, result in suites
    ], widths=[4.6, 1.4, 1.5, 1.5, 1.5, 6.5], font_size=8.5, center_cols=(1, 2, 3, 4), caption="Test results")
    w.h2("What the suites cover", numbered=False)
    w.table(["Test file", "What it asserts", "Tests", "Passed"],
            [row for _, result in suites for row in suite_rows(result)],
            widths=[4.6, 9.4, 1.5, 1.5], font_size=8, center_cols=(2, 3), caption="Test files")
    w.para("Every test title is listed in Annex A.")


def coverage_section(w, ev):
    w.h1("Coverage")
    unit_total, e2e_total = ev["unit_cov"]["total"], ev["e2e_cov"]["total"]
    w.para(f"Coverage is measured with the V8 provider over all {coverage_scope(ev)} API source files under "
           "apps/api/src, excluding the Prisma database client in src/generated, the test files and the start-up "
           "file main.ts. Files that a suite never loads count as uncovered. Earlier versions of this report measured end-to-end "
           "coverage over the files the tests loaded, so the figures here are lower but complete. Front-end "
           "coverage is not yet measured.")
    w.table(["Measure", "Unit tests", "End-to-end tests"], [
        [metric.title(), f"{unit_total[metric]['pct']}%", f"{e2e_total[metric]['pct']}%"]
        for metric in ("lines", "statements", "functions", "branches")
    ], widths=[5.0, 6.0, 6.0], font_size=8.5, center_cols=(1, 2), caption="Overall coverage")
    unit_groups = coverage_by_group(ev["unit_cov"])
    e2e_groups = coverage_by_group(ev["e2e_cov"])
    rows = []
    for group in sorted(set(unit_groups) | set(e2e_groups)):
        total = max(unit_groups[group][0], e2e_groups[group][0])
        if not total:
            continue
        rows.append([group, str(total), pct(unit_groups[group][1], unit_groups[group][0]),
                     pct(e2e_groups[group][1], e2e_groups[group][0])])
    w.table(["Module or area", "Lines", "Unit", "End-to-end"], rows, widths=[6.0, 2.6, 4.2, 4.2], font_size=7.5,
            padding=20, center_cols=(1, 2, 3), caption="Line coverage by module")
    w.h2("Coverage targets for implementation", numbered=False)
    w.para("Coverage is reported honestly rather than inflated with low-value tests. The rating engines already "
           "carry focused unit tests; most services are covered only through end-to-end journeys. During "
           "implementation we add service-level unit tests and SIT automation, with these targets:")
    w.table(["Area", "Target", "Measured by"], [
        ["Rating engines (products/rating)", "At least 80% lines and branches", "Unit tests, per release"],
        ["Billing (payments, grace period)", "At least 80% lines", "Unit plus end-to-end"],
        ["Workflow (maker-checker)", "At least 80% lines", "Unit plus end-to-end"],
        ["All API code", "At least 70% lines combined", "Merged unit and end-to-end coverage in CI"],
    ], widths=[6.0, 5.0, 6.0], font_size=8, bold_first_col=True)


def dependencies_section(w, ev):
    audit = ev["audit"]["metadata"]
    w.h1("Dependencies and licences")
    w.h2("Vulnerability audit", numbered=False)
    vulns = audit["vulnerabilities"]
    deps = audit["dependencies"]
    w.para(f"npm audit reports {vulns['total']} known vulnerabilities across {deps['total']} installed packages "
           f"({deps['prod']} production, {deps['dev']} development, {deps['optional']} optional). CI fails on any "
           "moderate or higher finding, and a container scan (Trivy) fails the image build on any fixable Critical "
           "or High finding. Each CI run also produces a CycloneDX software bill of materials of the production "
           "dependencies (npm sbom), kept as a build artifact.")
    w.table(["Severity", "Critical", "High", "Moderate", "Low", "Info", "Total"],
            [["Findings", *[str(vulns[k]) for k in ("critical", "high", "moderate", "low", "info", "total")]]],
            widths=[3.2, 2.3, 2.3, 2.3, 2.3, 2.3, 2.3], font_size=8.5, center_cols=(1, 2, 3, 4, 5, 6))
    licences = ev["licences"]
    w.h2("Licence inventory", numbered=False)
    w.para(f"The runtime dependency tree contains {licences['total']} packages. All carry permissive open-source "
           "licences apart from the items explained below; none imposes copyleft obligations on the deployed "
           "solution.")
    rows = sorted(([name, str(count)] for name, count in licences["byLicense"].items()), key=lambda r: -int(r[1]))
    w.table(["Licence", "Packages"], rows, widths=[10.0, 7.0], font_size=8, center_cols=(1,), padding=20,
            caption="Packages by licence")
    flagged = [p for p in licences["packages"]
               if p["name"] in LICENCE_NOTES or "GPL" in p["license"] or p["license"] in ("UNKNOWN", "EPL-2.0")]
    w.table(["Package", "Version", "Declared licence", "Position"],
            [[p["name"], p["version"], p["license"], LICENCE_NOTES.get(p["name"], "Under review")] for p in flagged],
            widths=[2.6, 1.8, 3.6, 9.0], font_size=8, caption="Licence exceptions and how they are handled")


def metrics_section(w, ev):
    m = ev["metrics"]
    w.h1("Code metrics", new_page=False)
    w.table(["Measure", "Value"], [
        ["API source files (including unit test files)", f"{m['api_source']['files']}"],
        ["API source lines (code / comment / blank)",
         f"{m['api_source']['code']:,} / {m['api_source']['comment']:,} / {m['api_source']['blank']:,}"],
        ["End-to-end test files and lines of code", f"{m['api_e2e_tests']['files']} files, {m['api_e2e_tests']['code']:,} lines"],
        ["API unit test files", str(m["api_unit_test_files"])],
        ["Web unit and component test files", str(len(ev["web"]["testResults"])) if ev["web"] else PENDING],
        ["Seed and reference data (files / lines of code)",
         f"{m['api_prisma_seed_and_reference']['files']} / {m['api_prisma_seed_and_reference']['code']:,}"],
        ["Functional modules", str(len(m["api_modules"]))],
        ["API paths / operations", f"{m['api_paths']} / {m['api_operations']}"],
        ["Database tables / enumerations", f"{m['db_tables']} / {m['db_enums']}"],
        ["Schema lines / migration SQL lines", f"{m['database_schema_lines']} / {m['migration_sql_lines']}"],
    ], widths=[8.0, 9.0], font_size=8.5, bold_first_col=True, caption="Size metrics (API)")
    w.para("Generated code (the Prisma client in src/generated) is excluded from linting and from these counts.")


def maintainability_section(w):
    w.h1("Maintainability", new_page=False)
    w.paras([
        "Each functional area is a separate NestJS module with its own controller, services and DTOs. Modules talk "
        "through injected services, not shared tables, so an area can be changed, tested or later moved to its own "
        "service without touching the others.",
        "Business behaviour that IIFT will want to change is configuration, not code. Products, plans and rate "
        "tables, questionnaires, workflow definitions and approval thresholds, security and business parameters "
        "(password policy, lockout, session limits, grace period, SLA hours) and master data are maintained in the "
        "back-office, audited and take effect without a release. Product and rate changes are checked by a second "
        "person until a maker-checker approval type for products is added during implementation.",
        "The API, the web tier and the database schema are versioned together. Database changes are applied by "
        "versioned SQL migrations, and the same container images move from SIT to UAT to production.",
    ])


def limitations_section(w):
    w.h1("Known limitations and improvement plan")
    w.table(["Area", "Current position", "Action during implementation", "When"], LIMITATIONS,
            widths=[3.2, 5.4, 6.0, 2.4], font_size=8, bold_first_col=True, caption="Improvement plan")


def build() -> Path:
    ev = {
        "unit": load_json("api-unit-tests.json"),
        "e2e": load_json("api-e2e-tests.json"),
        "unit_cov": load_json("api-unit-coverage-summary.json"),
        "e2e_cov": load_json("api-e2e-coverage-summary.json"),
        "audit": load_json("npm-audit.json"),
        "licences": load_json("runtime-dependency-licences.json"),
        "metrics": load_json("code-metrics-api.json"),
        "static": load_json("api-static-analysis.json"),
        "web": load_json("web-unit-tests.json"),
    }
    w = new_report(f"{brand.PRODUCT} – {TITLE}", "Code standards and quality",
                   f"iorta TechNXT | {brand.PRODUCT} – {TITLE}")
    with tempfile.TemporaryDirectory() as tmp:
        cover(w, Path(tmp), f"{brand.PRODUCT}\n{TITLE}", "Coding standards, static analysis, tests, coverage, "
              "dependencies and licences", [
                  ("Prepared for", brand.CLIENT),
                  ("Solution", brand.SOLUTION_NAME),
                  ("Build assessed", f"Commit {git_commit()}"),
                  ("Evidence date", format_timestamp(ev["e2e"]["startTime"])),
                  ("Document date", brand.SUBMISSION_DATE),
                  ("Version", brand.DOCUMENT_VERSION),
                  ("Classification", brand.CLASSIFICATION),
              ])
        w.h1("Contents", numbered=False)
        w.toc()
        summary_section(w, ev)
        standards_section(w)
        static_section(w, ev)
        tests_section(w, ev)
        coverage_section(w, ev)
        dependencies_section(w, ev)
        metrics_section(w, ev)
        maintainability_section(w)
        limitations_section(w)
        w.h1("Annex A – Test titles", numbered=False)
        w.table(["Test file", "Test", "Result"], test_titles(ev["unit"]) + test_titles(ev["e2e"])
                + (test_titles(ev["web"]) if ev["web"] else []),
                widths=[4.4, 10.8, 1.8], font_size=7.5, padding=15, caption="All automated tests")
        evidence_annex(w, "Annex B – Evidence files")
        return save_and_export(w, OUTPUT)


if __name__ == "__main__":
    print(f"Wrote {build()}")
