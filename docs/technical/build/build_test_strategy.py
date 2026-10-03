"""Build the SalesVerse 2.0 Test Strategy (DOCX and PDF).

Usage:
    python3 docs/technical/build/build_test_strategy.py [--no-pdf]

The 'Status post testing' chapter is built from the same catalogue as the Test Cases
workbook (test_status.py); build_all.py verifies that the two agree after both are built.
"""

import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import tech_kit  # noqa: E402
from tech_kit import TechnicalWriter, DocInfo, TECH_DIR, PRODUCT, brand, price  # noqa: E402
import tech_diagrams  # noqa: E402
from tech_diagrams import card, zone, arrow, text, F, FS, FT, W  # noqa: E402
from diagrams import new_canvas, save, MAGENTA, ORANGE, WHITE, LIGHT_GREY, LIGHT_MAGENTA, LIGHT_ORANGE, MID_GREY, MUTED  # noqa: E402
from reports_common import evidence_annex, format_timestamp, load_json  # noqa: E402
import test_status as status  # noqa: E402
import test_scenarios as ts  # noqa: E402

INFO = DocInfo(
    code="TST",
    title="Test Strategy",
    subtitle="Test levels, environments, entry and exit criteria, defect management, tooling, traceability, "
             "schedule and the status of testing on the current build",
    deliverable="DEL-12 (Test Strategy); with the Test Cases workbook: DEL-13, DEL-14 precursor, DEL-15 basis",
    keywords="test strategy; SIT; UAT; performance; VAPT; traceability; SalesVerse 2.0; IIFT",
    purpose="This document defines how SalesVerse 2.0 is tested for IIFT: the test levels from unit tests to user "
            "acceptance, the environments and data, the criteria for entering and leaving each phase, how defects "
            "are classified and resolved, who does what, the tools, the traceability from RFP requirement to test "
            "case, the schedule within the 24-week plan, and the metrics reported. Its last chapter states the "
            "status of testing on the build submitted with the proposal, counted from the same data as the Test "
            "Cases workbook.",
    related=["SalesVerse-2.0-Test-Cases.xlsx (IIFT-SV2-TCS): scenarios, conditions, cases, defects, traceability and "
             "the execution log; its Summary sheet and chapter 12 of this document are built from one source.",
             "SalesVerse-2.0-Security-Assessment-Report: the OWASP checks referenced by the security cases.",
             "SalesVerse-2.0-Code-Standards-and-Quality-Report: unit and end-to-end test evidence and coverage.",
             "SalesVerse-2.0-Solution-Architecture: environments, integration adapters and deployment options."],
)

TEST_LEVELS = [
    ["Unit", "Business rules, rating engines (all seven products), validators, password policy, encryption, file "
     "inspection, report export, web components and utilities", "Developers", "Developer workstation; CI on every push",
     "Vitest (API), Vitest + Testing Library + jsdom (web)", "All tests pass; coverage of core modules ≥ 70%"],
    ["Integration / API", "Every endpoint with positive and negative cases: permissions per role, audience separation, "
     "data scoping, validation, business-rule errors", "Developers, QA", "CI with PostgreSQL (dedicated *_test "
     "database rebuilt from the migrations)", "Vitest + supertest", "All tests pass; no endpoint without a negative test"],
    ["End-to-end API (business journeys)", "Quotation to e-Policy and e-Receipt, referral and maker-checker, "
     "onboarding with AML, claims, issues, reports, EOD and reconciliation, administration", "QA", "CI and the iorta "
     "test instance with demonstration data", "Vitest e2e suite; tools/testing/api-test-run.mjs against a running instance",
     "All journeys pass on the release candidate"],
    ["UI / component", "Web components, navigation, permission gating, forms; exploratory runs of every screen",
     "QA", "iorta test instance (browser)", "Testing Library; Playwright smoke suite (regression); exploratory sessions "
     "with screen captures", "No open Critical/High UI defects; smoke suite green"],
    ["System integration test (SIT)", "End-to-end flows across portal, back-office and IIFT systems: Core, FIN, "
     "AML service, Active Directory, SMTP relay, SMS gateway; scheduled jobs; EOD with FIN and BRR reconciliation",
     "iorta QA with IITH system owners", "SIT environment at IIFT with test endpoints and credentials",
     "This workbook (cases marked SIT) plus the automated suites; Playwright regression", "≥ 95% of SIT cases passed; "
     "no open Critical/High defects; reconciliation MATCHED for three consecutive days"],
    ["Performance", "Load at 100 concurrent users, stress to the breaking point, 8-hour soak, five-year data volume",
     "iorta performance engineer", "Production-like SIT environment", "k6 scenarios; Grafana/Prometheus",
     "p95 < 2 s for normal transactions; error rate < 0.1%; no resource growth in the soak (DEL-18)"],
    ["Security", "SAST, secret scan, dependency audit and container scan in CI; OWASP Top 10 check script before each "
     "release; independent VAPT with re-test", "iorta DevOps/QA; independent tester", "CI; iorta test instance; IIFT UAT "
     "or production-like environment for the VAPT", "CodeQL, gitleaks, npm audit, Trivy, security-checks.mjs; VAPT "
     "provider's tooling", "No open Critical/High findings at go-live (DEL-17)"],
    ["User acceptance (UAT)", "Business scenarios per product (FFR01–FFR05) and per role, run by IIFT users; browser "
     "matrix on IIFT devices; accessibility basics", "IIFT business users with iorta support", "UAT environment with "
     "masked production data", "UAT scripts derived from the scenarios marked UAT; defect log", "Signed UAT certificate; "
     "no open Critical/High defects (DEL-15, DEL-16)"],
    ["Regression", "Automated suites and Playwright smoke re-run on every release candidate and every fix", "QA",
     "CI; SIT", "Vitest, Playwright", "100% of critical paths automated and green before any deployment"],
    ["Migration rehearsal", "Two dry-runs of extraction, transformation, load and reconciliation", "iorta, IIFT data "
     "owners", "UAT", "Migration scripts; reconciliation reports", "100% record count and control-total match"],
    ["DR drill", "Failover to the DR site/region and failback; restore from backup", "IITH IT (Option A) or iorta "
     "managed services (Option B) with iorta support", "DR site/region", "Runbooks of the Production Support Handover",
     "RTO ≤ 4 h, RPO ≤ 15 min achieved and documented (NFR-19)"],
    ["Operational readiness", "Deployment rehearsal, rollback, monitoring and alert rules, go-live checklist",
     "iorta, IITH IT", "Pre-production", "Deployment plan; checklists (DEL-20, DEL-21)", "Checklist complete; rollback "
     "rehearsed; hypercare entry criteria met"],
]

ENVIRONMENTS = [
    ["DEV / CI", "iorta", "Build and unit, API and end-to-end tests on every push; dedicated PostgreSQL database named "
     "*_test, dropped and rebuilt from the migrations and seeds before each end-to-end run", "Reference data and the "
     "demonstration data set (seed-demo.ts)"],
    ["iorta test instance", "iorta", "Running instance with simulated integrations (INTEGRATION_MODE=simulated); "
     "used for the API run, the security checks and exploratory UI runs", "Demonstration data set: three agencies, "
     "named demonstration users for every role, policies in every status, blocked bank, AML cases, issues"],
    ["SIT", "IIFT/IITH (Option A) or iorta cloud (Option B), available by week 8", "Live adapters to Core, FIN, AML, "
     "AD, SMTP and SMS test endpoints; jobs enabled; ClamAV; monitoring stack", "Demonstration data plus IIFT test "
     "cases' data; migration dry-run output for the second cycle"],
    ["UAT", "IIFT, available by week 16", "Production configuration; the independent VAPT runs here", "Masked copy "
     "of production data where available, otherwise the migrated data of dry-run 2; test accounts per role"],
    ["Pre-production / performance", "IIFT (SIT sized like production) ", "Performance and soak tests; deployment "
     "rehearsal", "Five-year projected volume generated from the demonstration profile (Appendix 2)"],
]

ENTRY_EXIT = [
    ["Unit and API (CI)", "Code reviewed; migrations applied cleanly", "All tests pass; lint, type check and format "
     "clean; coverage ≥ 70% on core modules; no Critical/High dependency findings"],
    ["End-to-end and release candidate", "CI green; release notes drafted; demonstration data loaded", "End-to-end "
     "suite and API run green; OWASP checks 29/29; Playwright smoke green; test cases workbook refreshed"],
    ["SIT", "Release candidate deployed to SIT; interfaces, test endpoints and credentials available (week 8 "
     "assumption); SIT cases reviewed with IITH owners; test data prepared", "≥ 95% cases passed, 100% of Must "
     "requirements covered; no open Critical/High; Medium defects with agreed workaround or fix date; reconciliation "
     "MATCHED three days running; SIT results report (DEL-14) issued"],
    ["Performance", "SIT functional exit; production-like sizing; monitoring in place", "Targets met or deviations "
     "accepted by IIFT with a remediation plan; report issued (DEL-18)"],
    ["Security (VAPT)", "SIT functional exit; rules of engagement signed; test accounts per role", "No open "
     "Critical/High; Medium/Low with dates; re-test report issued (DEL-17)"],
    ["UAT", "SIT exit; UAT environment with masked data; testers trained; UAT scripts approved", "All UAT scripts "
     "executed; no open Critical/High; signed UAT certificate (DEL-16)"],
    ["Go-live", "UAT sign-off; VAPT cleared; migration dry-run 2 reconciled; DR drill done; go-live checklist "
     "complete (DEL-21)", "Production deployment verified by the smoke checklist; hypercare entry"],
]

SEVERITY = [
    ["Critical", "System unusable, data integrity or security at risk, or a Must requirement cannot be met; no "
     "workaround", "Fix before exit of the current phase; in production, P1 handling (contained within 24 h)"],
    ["High", "Key function fails or gives wrong results; workaround difficult", "Fix before exit of the current phase; "
     "in production, 14 days"],
    ["Medium", "Function impaired with an acceptable workaround", "Fix before go-live or agreed deferral with IIFT"],
    ["Low", "Cosmetic, wording or minor usability", "Planned release"],
]

PRIORITY = [
    ["Urgent", "Blocks testing of other cases or a milestone", "Next build (within 1 working day in SIT/UAT)"],
    ["High", "Needed for the current phase exit", "Within 3 working days"],
    ["Medium", "Needed before go-live", "Next planned build"],
    ["Low", "Improvement; can follow go-live", "Backlog"],
]

ROLES = [
    ["Test manager (iorta)", "Owns this strategy, the workbook, entry/exit decisions, defect triage, reporting"],
    ["QA engineers (iorta)", "Write and run cases, maintain the automated suites and the API run script, record "
     "evidence, re-test fixes"],
    ["Developers (iorta)", "Unit and API tests with every change; fix defects; support SIT and UAT"],
    ["DevOps and security engineer (iorta)", "CI gates, environments, performance tests, VAPT coordination and "
     "remediation tracking"],
    ["Business analyst (iorta)", "Scenario review against the BRS/FRS and Appendix 3 flows; UAT script preparation "
     "and support"],
    ["IIFT UAT testers / super-users", "Execute UAT scripts, record results and defects, confirm business "
     "acceptance; browser checks on IIFT devices"],
    ["IIFT product and business owners", "Approve UAT scripts and exit; decide on deferrals; sign the UAT certificate"],
    ["IITH IT", "SIT and UAT environments, interface test endpoints and credentials, AD, SMTP, SMS, monitoring, "
     "backup/DR drills; participation in SIT of interfaces"],
    ["Independent VAPT provider", "Vulnerability assessment and penetration test, re-test, report"],
]

TOOLS = [
    ["Vitest", "Unit and API/end-to-end test runner (JSON reports kept as evidence)"],
    ["supertest", "HTTP calls against the application in the end-to-end suite"],
    ["Testing Library + jsdom", "Web component tests"],
    ["Playwright", "Browser smoke and regression suite (SIT onwards)"],
    ["tools/testing/api-test-run.mjs", "Scripted system cases against a running instance; writes evidence/api-test-run.json"],
    ["tools/security/security-checks.mjs", "29 OWASP Top 10 checks; evidence/security-checks.json"],
    ["CodeQL, gitleaks, npm audit, Trivy, CycloneDX SBOM", "CI security gates"],
    ["k6, Grafana, Prometheus", "Performance scenarios and measurements"],
    ["Issues module / IIFT's defect tool", "Defect log during SIT and UAT (IIFT's tool if preferred; export to the "
     "SIT and UAT results reports)"],
    ["docs/technical/build", "Generates this strategy and the workbook from the catalogue and the evidence files"],
]

SCHEDULE = [
    ["6–16", "Build sprints", "Unit, API and end-to-end tests with every story; sprint demo acceptance; OWASP checks "
     "each sprint", "CI green per sprint"],
    ["16", "Hardening", "Full regression; API run; security checks; workbook refreshed; SIT readiness review",
     "Build complete (M3)"],
    ["16–19", "SIT", "SIT cases with IITH interface owners; three EOD/reconciliation cycles; defect fixing and re-test",
     "SIT results (DEL-14)"],
    ["17–18", "Performance", "Load, stress, soak and volume tests; tuning", "Performance report (DEL-18)"],
    ["17–19", "VAPT", "Independent test, remediation, re-test", "Security assessment (DEL-17); SIT exit and security "
     "clearance (M4, week 19)"],
    ["19–22", "UAT", "IIFT testers execute UAT scripts; daily triage; browser matrix; accessibility checks",
     "UAT results and sign-off (DEL-16, M5 week 22)"],
    ["19–23", "Migration rehearsals", "Dry-run 1 and 2 with reconciliation", "Migration plan and reconciliation reports"],
    ["23", "Readiness", "Deployment rehearsal, DR drill, go-live checklist", "Go/no-go (DEL-21)"],
    ["24", "Go-live", "Production smoke checklist; first EOD monitored", "Production deployment (DEL-28, M6)"],
    ["25–28", "Hypercare", "Daily checks; fixes under warranty; regression before each patch", "Hypercare exit (M7)"],
]

METRICS = [
    ["Execution progress", "Cases planned, executed, passed, failed, blocked per level and per area", "Daily in SIT/UAT; "
     "weekly to the Working Committee"],
    ["Pass rate", "Passed / executed; target ≥ 95% at SIT exit, 100% of Must requirements", "Daily / weekly"],
    ["Requirement coverage", "RFP requirements with at least one executed and passed case (Traceability sheet)",
     "Weekly; 100% at UAT exit"],
    ["Defects", "Open by severity and age; found vs fixed per week; re-open rate", "Daily / weekly"],
    ["Automation", "Share of cases automated; regression duration", "Per release"],
    ["Non-functional", "p95 response time, error rate, throughput, resource use", "Performance report"],
    ["Security", "Findings by severity and remediation status", "VAPT report and re-test"],
]

RISKS = [
    ["Interface test endpoints or credentials late (Core, FIN, AML, AD)", "SIT slips", "Simulated adapters allow all "
     "flows to be tested first; interface cases isolated and scheduled last; dependency tracked from week 8"],
    ["Shared demonstration accounts used by several testers", "Sessions ended by the single-active-session rule; "
     "misleading failures", "Named accounts per tester in SIT/UAT; the API run re-signs in and records it"],
    ["Time-zone-dependent tests and jobs", "Flaky results near midnight Brunei time", "All tests use the business-day "
     "helper (DEF-001); jobs tested at their scheduled time in SIT"],
    ["UAT tester availability", "UAT exceeds weeks 19–22", "Testers named by week 16; scripts short and per role; "
     "iorta on site"],
    ["Performance environment not production-like", "Results not representative", "Sizing agreed in the Solution "
     "Architecture; environment checked before the test; results reported with configuration"],
    ["VAPT findings late in the plan", "Go-live at risk", "Internal checks and CI gates first; VAPT starts at SIT "
     "functional exit; remediation window reserved in week 19"],
    ["Migration data quality", "Reconciliation mismatches", "Two dry-runs; corrections at source; exception reports"],
]


# --- figure ---------------------------------------------------------------------------------------
def test_levels_figure(out: Path):
    image, draw = new_canvas(W, 560)
    columns = [
        ("Build and CI\nweeks 6–16", LIGHT_GREY, ["Unit", "API / integration", "End-to-end journeys", "OWASP checks", "Component and smoke"]),
        ("SIT, performance, VAPT\nweeks 16–19", LIGHT_MAGENTA, ["SIT with IIFT systems", "Regression", "Performance", "Independent VAPT"]),
        ("UAT and rehearsals\nweeks 19–23", LIGHT_ORANGE, ["UAT by IIFT users", "Browser and accessibility", "Migration dry-runs", "DR drill, readiness"]),
        ("Go-live and hypercare\nweeks 24–28", LIGHT_GREY, ["Production smoke", "First EOD monitored", "Regression per patch"]),
    ]
    x = 20
    col_w = (W - 40 - 3 * 24) // 4
    for title, fill, items in columns:
        zone(draw, (x, 20, x + col_w, 540), "", fill=fill)
        text(draw, (x, 28, x + col_w, 100), title, size=FS, bold=True, fill=MAGENTA)
        y = 110
        for item in items:
            card(draw, (x + 18, y, x + col_w - 18, y + 70), item, size=FS)
            y += 84
        x += col_w + 24
    return save(image, out, "test_levels.png")


# --- document -------------------------------------------------------------------------------------
def build(path: Path):
    scenarios, conditions, cases, run_summary = status.build_catalogue()
    totals = status.summary(cases)
    with tempfile.TemporaryDirectory() as tmp:
        figs = tech_diagrams.render([], Path(tmp))
        levels_fig = test_levels_figure(Path(tmp))
        w = TechnicalWriter(INFO)
        w.cover(figs["cover_band"])
        w.document_control()
        w.table_of_contents()

        # 1
        w.h1("Purpose and scope")
        w.paras([
            f"This strategy covers the testing of {PRODUCT} configured as the {brand.SOLUTION_NAME}: the Agent/Banca "
            "Portal, the Back-office, the public e-signature page, the system-to-system APIs and the integrations "
            "with IIFT's core, financial, AML, directory, e-mail and SMS services. It applies from the build sprints "
            "to hypercare and is the reference for the SIT and UAT deliverables (DEL-13 to DEL-16), the security "
            "assessment (DEL-17) and the performance report (DEL-18).",
            "The companion workbook holds the test scenarios, conditions and cases with their current status. Both "
            "are generated from one catalogue in the source repository, so the counts in chapter 12 and in the "
            "workbook's Summary sheet cannot differ; the build stops if they do.",
            "Out of scope: testing of IIFT's own systems beyond their interfaces, and of the hosting infrastructure "
            "other than through the availability, backup and DR drills in which iorta participates.",
        ])
        w.h2("Test objectives")
        w.bullets([
            "Prove every functional requirement of RFP sections 4.1 to 4.4 and the five product flows of Appendix 3 "
            "with at least one executed, passed case, traced in the workbook.",
            "Prove the non-functional requirements of section 5 at the agreed level: security before any release, "
            "performance and availability at IIFT scale before go-live.",
            "Find defects early: unit and API tests run with every change, business journeys on every release "
            "candidate, and the OWASP checks each sprint.",
            "Give IIFT evidence it can audit: JSON results from every automated run, request and response summaries "
            "from the scripted API run, screen captures from manual runs, and signed UAT records.",
        ])

        # 2
        w.h1("Test levels and approach")
        w.para("Testing is layered. Each level has an owner, an environment, tooling and an exit criterion; the "
               "levels build on each other so that SIT and UAT concentrate on IIFT's systems, data and users rather "
               "than on application logic already proven.")
        w.figure(levels_fig, "Test levels across the delivery plan", width_cm=16.5)
        w.table(["Level", "Scope", "Owner", "Environment", "Tooling", "Exit criterion"], TEST_LEVELS,
                widths=[2.3, 4.6, 2.0, 2.8, 2.9, 2.4], font_size=7, padding=20, bold_first_col=True,
                caption="Test levels")
        w.h2("Approach by type of requirement")
        w.bullets([
            "**Business rules and rating** (Appendix 3, AP-19, AP-32): unit tests of the rating engines for all seven "
            "products with the indicative rates, then API cases that re-rate on submission; IIFT's approved rate "
            "tables are loaded in design and the expected contributions in the cases are refreshed with them.",
            "**Workflows and maker-checker** (BO-16 to BO-19, COM-04): every approval type has cases for inbox "
            "visibility, segregation of duties, mandatory remarks, withdrawal and history.",
            "**Security** (COM-01, COM-02, COM-10, NFR-08 to NFR-14): automated OWASP checks with every release, CI "
            "gates on every push, and the independent VAPT before go-live.",
            "**Integrations** (INT-01 to INT-15): tested first against the simulated adapters (outbox, retry, dead "
            "letter, idempotent EOD postings, reconciliation), then in SIT against IIFT's test endpoints.",
            "**Scheduled jobs** (expiry, grace period, EOD, SLA monitor, scheduled reports): logic tested through the "
            "API and the suites; schedules observed in SIT with jobs enabled.",
            "**Usability, browsers and accessibility** (NFR-22 to NFR-24): exploratory runs at desktop and mobile "
            "widths now; browser matrix and accessibility checks with IIFT testers in UAT.",
        ])

        # 3
        w.h1("Test environments and data")
        w.table(["Environment", "Provided by", "Use", "Data"], ENVIRONMENTS, widths=[2.8, 3.2, 6.0, 5.0],
                font_size=7.5, padding=20, bold_first_col=True, caption="Environments")
        w.h2("Test data")
        w.bullets([
            "The demonstration data set is generated through the application's own services (registration, "
            "screening, quotation, submission, payment, verification, issuance, renewal, endorsement, claims, issues, "
            "EOD, reconciliation), so every record carries a genuine history, audit trail and outbox messages.",
            "Named demonstration users exist for every role; each case states which user it uses.",
            "Scripted runs create their own records with a run identifier so they can be repeated; they never alter "
            "the seeded blocked bank or the demonstration passwords.",
            "UAT uses masked production data where IIFT can provide it (identification numbers, contact details and "
            "names replaced); otherwise the migrated data of the second dry-run.",
            "No production data is used outside IIFT's UAT and pre-production environments; the security check "
            "script and the API run must never be pointed at production.",
        ])

        # 4
        w.h1("Entry and exit criteria")
        w.table(["Phase", "Entry criteria", "Exit criteria"], ENTRY_EXIT, widths=[3.0, 6.0, 8.0], font_size=7.5,
                padding=20, bold_first_col=True, caption="Entry and exit criteria per phase")
        w.para("Exit decisions are taken by the test manager with IIFT's product owner at the phase review; "
               "deviations (for example a Medium defect deferred) are recorded in the phase report with the agreed "
               "date.")

        # 5
        w.h1("Defect management")
        w.para("Defects are logged with steps, data, expected and actual result, evidence and the case identifier; "
               "they are triaged daily during SIT and UAT. Severity describes the impact, priority the urgency of "
               "the fix. A fixed defect is re-tested by the person who found it where possible, and the related "
               "automated cases are extended so that the defect cannot return unnoticed.")
        w.table(["Severity", "Definition", "Resolution target"], SEVERITY, widths=[2.4, 8.6, 6.0], font_size=8,
                bold_first_col=True, caption="Defect severity")
        w.table(["Priority", "Definition", "Target"], PRIORITY, widths=[2.4, 8.6, 6.0], font_size=8,
                bold_first_col=True, caption="Defect priority")
        w.h2("Defect workflow")
        w.steps([
            "Log the defect in the agreed tool with the case identifier, environment, build and evidence.",
            "Triage (daily): confirm, set severity and priority, assign to iorta; reject duplicates or expected behaviour with a note.",
            "Fix and unit-test; add or extend an automated case; deliver in the next build with release notes.",
            "Re-test the case and the related regression set; close or re-open with evidence.",
            "Report open defects by severity and age in the daily and weekly reports; agree deferrals with IIFT.",
        ], title="Steps")

        # 6
        w.h1("Roles and responsibilities")
        w.table(["Role", "Responsibilities"], ROLES, widths=[4.6, 12.4], font_size=8, bold_first_col=True,
                caption="Roles")

        # 7
        w.h1("Tooling")
        w.table(["Tool", "Use"], TOOLS, widths=[5.4, 11.6], font_size=8, bold_first_col=True, caption="Tools")
        w.para("Every automated run writes a JSON report that is kept under docs/technical/evidence and read when "
               "the workbook and this document are rebuilt, so the recorded status is always the result of a real "
               "run, never a typed value.")

        # 8
        w.h1("Traceability")
        w.para("Traceability runs from the RFP requirement to the executed case in four links, all held in the "
               "workbook:")
        w.table(["Link", "Artefact", "Identifier", "Content"], [
            ["1", "RFP requirement", "AP-nn, BO-nn, INT-nn, COM-nn, NFR-nn, DEL-nn, MNT-nn, FFR0n", "Requirement and "
             "short title (Traceability sheet)"],
            ["2", "Test scenario", "TS-nn", "Business or technical situation, persona, pre-conditions, expected end "
             "state, RFP identifiers covered"],
            ["3", "Test condition", "TC-nnn", "One rule or decision inside the scenario that must be verified"],
            ["4", "Test case", "CS-nnnn", "Steps, data, expected result, level, automation, status, evidence, "
             "execution details, defect reference"],
        ], widths=[1.0, 3.0, 5.0, 8.0], font_size=8, center_cols=(0,), caption="Traceability links")
        w.para("The Traceability sheet shows, for each requirement, the scenarios, the case identifiers and a "
               "coverage status (executed – passed, partly executed, cases defined but not executed, no case yet). "
               "The build fails if a scenario cites an unknown requirement, if a condition has no case, or if a "
               "case cites evidence that does not exist. UAT scripts (DEL-15) are produced from the scenarios whose "
               "persona is an IIFT user, with the business language of Appendix 3.")
        w.table(["Catalogue element", "Count"], [
            ["Functional and technical areas", str(len(ts.AREAS))],
            ["Test scenarios", str(totals["scenarios"])],
            ["Test conditions", str(totals["conditions"])],
            ["Test cases", str(totals["cases"])],
            ["RFP requirements traced", str(len(status.traceability(cases)))],
        ], widths=[9.0, 8.0], font_size=8.5, bold_first_col=True, center_cols=(1,), caption="Catalogue size")

        # 9
        w.h1("Schedule")
        w.para(f"The schedule follows the {price.IMPLEMENTATION_WEEKS}-week delivery plan of the proposal: SIT, "
               "performance and VAPT in weeks 16 to 19, UAT in weeks 19 to 22, go-live in week "
               f"{price.GO_LIVE_WEEK} and {price.HYPERCARE_WEEKS} weeks of hypercare.")
        w.table(["Weeks", "Activity", "Testing", "Output / milestone"], SCHEDULE, widths=[1.6, 3.2, 7.4, 4.8],
                font_size=7.5, padding=20, center_cols=(0,), caption="Test schedule")

        # 10
        w.h1("Metrics and reporting")
        w.table(["Metric", "Definition", "Frequency"], METRICS, widths=[3.4, 9.6, 4.0], font_size=8,
                bold_first_col=True, caption="Metrics")
        w.bullets([
            "Daily SIT/UAT report: cases executed and passed, blockers, defects found and fixed, open by severity.",
            "Weekly Working Committee report: progress against plan, pass rate, coverage, defect trend, risks.",
            "Phase reports: SIT results (DEL-14), performance report (DEL-18), security assessment and VAPT re-test "
            "(DEL-17), UAT results and certificate (DEL-16); each attaches the workbook refreshed on that date.",
        ])

        # 11
        w.h1("Risks and mitigations")
        w.table(["Risk", "Effect", "Mitigation"], RISKS, widths=[5.0, 3.6, 8.4], font_size=8, bold_first_col=True,
                caption="Test risks")

        # 12
        status_chapter(w, totals, cases, run_summary)

        evidence_annex(w, "Annex – Evidence files")
        w.save(path)
    return totals


def status_chapter(w, totals, cases, run_summary):
    w.h1("Status post testing")
    w.para(f"Status of testing on the build of {totals['as_of']} (source commit {totals['commit']}), counted from "
           "the evidence files listed in the annex. The figures are the same as on the Summary sheet of the Test "
           "Cases workbook; the build of this pack verifies that they agree.")
    total = totals["cases"]
    rows = []
    meaning = {
        "Passed": "Executed with the expected result (automated suites, API run, security checks, manual runs with screen captures)",
        "Failed": "Executed; expected result not observed; defect logged",
        "Blocked": "Pre-condition not available in the test data at the time of the run",
        "Not executed": "Needs IIFT's environment, scale, users or a time-based job; reason stated per case",
    }
    for st, count in totals["by_status"].items():
        rows.append([st, str(count), f"{count / total:.0%}", meaning[st]])
    rows.append(["Total", str(total), "100%", f"{totals['scenarios']} scenarios, {totals['conditions']} conditions"])
    w.table(["Status", "Cases", "Share", "Meaning"], rows, widths=[2.6, 1.6, 1.6, 11.2], font_size=8.5,
            bold_first_col=True, center_cols=(1, 2), total_rows=1, caption="Cases by status")

    level_rows = []
    for level, counts in totals["by_level"].items():
        level_rows.append([status.LEVEL_NAMES[level], str(counts["total"]), str(counts["Passed"]), str(counts["Failed"]),
                           str(counts["Blocked"]), str(counts["Not executed"])])
    w.table(["Level", "Cases", "Passed", "Failed", "Blocked", "Not executed"], level_rows,
            widths=[6.6, 1.8, 1.8, 1.8, 1.8, 2.6], font_size=8.5, bold_first_col=True, center_cols=(1, 2, 3, 4, 5),
            caption="Cases by level")
    auto_rows = [[label, str(count)] for label, count in totals["by_automation"].items()]
    w.table(["Automation", "Cases"], auto_rows, widths=[9.0, 8.0], font_size=8.5, bold_first_col=True,
            center_cols=(1,), caption="Cases by automation")

    w.h2("What was executed")
    reruns = load_json("test-reruns.json") or {"suites": {}}
    e2e = reruns["suites"].get("api-e2e", {})
    web = reruns["suites"].get("web-unit", {})
    unit = reruns["suites"].get("api-unit", {})
    sec = load_json("security-checks.json")["summary"]
    w.bullets([
        f"Unit tests: {unit.get('passed', 0)} of {unit.get('total', 0)} API tests and {web.get('passed', 0)} of "
        f"{web.get('total', 0)} web tests passed in the re-run of {totals['as_of']}.",
        f"End-to-end suite: {e2e.get('passed', 0)} of {e2e.get('total', 0)} journeys passed in the re-run; all 32 "
        "passed in the earlier evidence run of the same day (see DEF-001).",
        f"API run: {run_summary['passed']} of {run_summary['total']} system cases passed against the running "
        f"demonstration instance ({run_summary['baseUrl']}), executed by {run_summary['executedBy']} on "
        f"{run_summary['startedAt'][:10]} starting {run_summary['startedAt'][11:16]} UTC; every request and response "
        "is in the Execution log sheet.",
        f"Security: {sec['passed']} of {sec['total']} OWASP checks passed ({format_timestamp(sec['runAt'])}); "
        "details in the Security Assessment Report.",
        "Manual exploratory runs of the portal and back-office screens with screen captures held in "
        "evidence/ui-screens.",
    ])
    w.h2("Defects")
    if status.DEFECTS:
        w.table(["ID", "Title", "Severity", "Status"], [[d["id"], d["title"], d["severity"], d["status"]] for d in status.DEFECTS],
                widths=[1.6, 8.4, 2.0, 5.0], font_size=8, bold_first_col=True, caption="Defects found")
        for d in status.DEFECTS:
            w.para(f"**{d['id']}** – {d['description']}", size=8.5)
    else:
        w.para("No defects were found in the executed cases.")
    w.h2("Not executed and why")
    not_run = [c for c in cases if c["status"] == "Not executed"]
    reasons = {}
    for c in not_run:
        key = "Requires IIFT environment" if "IIFT environment" in c["evidence"] else \
              "Time-based job or timeout" if "time-based" in c["evidence"].lower() else \
              "UI under restyling at the time of the run" if "restyling" in c["evidence"] else \
              "Not yet built" if "not yet built" in c["evidence"] else \
              "Scheduled for SIT regression" if "SIT" in c["evidence"] else "Other"
        reasons.setdefault(key, []).append(c)
    rows = [[key, str(len(items)), "; ".join(sorted({i["title"] for i in items}))[:400]] for key, items in sorted(reasons.items(), key=lambda kv: -len(kv[1]))]
    w.table(["Reason", "Cases", "Cases concerned"], rows, widths=[4.0, 1.4, 11.6], font_size=7.5, padding=20,
            bold_first_col=True, center_cols=(1,), caption="Cases not executed in the iorta test environment")
    w.callout("Reading the status", [
        "Everything that can be proven on the application alone has been executed. Two cases failed: the "
        "end-to-end claim test affected by DEF-001 (a test-code issue) and the password-reset case that found "
        "DEF-002 (a disabled account is re-activated by a reset). One renewal case was blocked by exhausted test "
        "data. What remains needs IIFT's interfaces, scale, devices or users, or a scheduled job observed at its "
        "time, and is planned for SIT, performance testing, VAPT and UAT in weeks 16 to 22.",
        f"During the first API run on {totals['as_of']}, other engineers signed in to the shared demonstration "
        "accounts from the user interface; the single-active-session rule ended the run's sessions. The script "
        "now signs in again when that happens and the run was repeated; the recorded run is the final one.",
    ])


def main():
    TECH_DIR.mkdir(parents=True, exist_ok=True)
    docx = TECH_DIR / f"{INFO.file_stem}.docx"
    build(docx)
    print(f"Wrote {docx}")
    if "--no-pdf" not in sys.argv:
        pdf = tech_kit.export_pdf(docx)
        print(f"Wrote {pdf} ({tech_kit.pdf_pages(pdf)} pages)")


if __name__ == "__main__":
    main()
