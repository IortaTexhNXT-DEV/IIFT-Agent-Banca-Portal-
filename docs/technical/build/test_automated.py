"""Test cases derived from the automated suites and their evidence files.

Every unit test (API and web), every end-to-end test and every OWASP check becomes one
test case whose status is read from docs/technical/evidence at build time: the original
evidence files, and test-reruns.json when the same test was re-run later (the latest run
wins and both are cited).
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

from reports_common import EVIDENCE_DIR, load_json  # noqa: E402
import test_cases_manual as manual  # noqa: E402

UNIT_CMD_API = "Run `npm test -w apps/api` (Vitest)"
UNIT_CMD_WEB = "Run `npm test -w apps/web` (Vitest, Testing Library, jsdom)"
SEC_CMD = "Run `node tools/security/security-checks.mjs` against a fresh non-production instance with demonstration data"

# Spec file (relative to apps/api/src) -> default condition, plus overrides by words in the test title.
API_SPEC_CONDITIONS = {
    "config/app-config.spec.ts": ("TC-188", {}),
    "common/crypto/field-crypto.service.spec.ts": ("TC-160", {}),
    "common/util/dates.spec.ts": ("TC-189", {}),
    "modules/aml/name-matching.spec.ts": ("TC-048", {}),
    "modules/aml/watchlist.spec.ts": ("TC-052", {}),
    "modules/auth/password.service.spec.ts": ("TC-007", {"expires passwords": "TC-008", "temporary passwords": "TC-011", "Argon2id": "TC-009"}),
    "modules/documents/file-inspector.spec.ts": ("TC-119", {"size limit": "TC-120", "safe file names": "TC-120"}),
    "modules/products/plan-label.spec.ts": ("TC-066", {}),
    "modules/products/product-definitions.spec.ts": ("TC-071", {"documents as mandatory": "TC-073"}),
    "modules/reports/reports.spec.ts": ("TC-135", {"scheduling": "TC-137"}),
    "modules/workflow/workflow-payload.spec.ts": ("TC-086", {}),
    "modules/products/rating/financing.engine.spec.ts": ("TC-054", {"high-risk limit": "TC-055", "maximum age": "TC-056", "missing risk field": "TC-056", "NONE as profit basis": "TC-057", "validates its configuration": "TC-057"}),
    "modules/products/rating/fixed-plan.engine.spec.ts": ("TC-058", {"Occupational Class": "TC-059", "Wider (Child)": "TC-060", "coverage type": "TC-060", "Personal Home Assistant": "TC-062", "Overseas Student": "TC-064", "drops risk details": "TC-066", "validates every catalogue": "TC-065"}),
}

WEB_SPEC_CONDITIONS = {
    "api/client.test.ts": "TC-191",
    "components/ErrorAlert.test.tsx": "TC-192",
    "components/Money.test.tsx": "TC-193",
    "utils/format.test.ts": "TC-193",
    "components/RequirePermission.test.tsx": "TC-194",
    "utils/permissions.test.ts": "TC-194",
    "components/StatusTag.test.tsx": "TC-194",
    "utils/status.test.ts": "TC-194",
    "layouts/menus.test.ts": "TC-194",
    "layouts/UserMenu.test.ts": "TC-194",
    "components/admin/CellText.test.tsx": "TC-195",
    "components/admin/links.test.ts": "TC-195",
    "components/admin/values.test.ts": "TC-195",
    "components/FieldGrid.test.tsx": "TC-195",
    "components/PageHeader.test.tsx": "TC-195",
    "components/sales/NomineesEditor.test.ts": "TC-195",
    "components/sales/PaymentList.test.tsx": "TC-195",
    "components/sales/options.test.ts": "TC-195",
    "pages/auth/LoginPage.test.tsx": "TC-196",
}

SEC_CONDITIONS = {
    "SEC-01": "TC-165", "SEC-02": "TC-166", "SEC-03": "TC-165", "SEC-04": "TC-001", "SEC-05": "TC-012",
    "SEC-06": "TC-013", "SEC-07": "TC-014", "SEC-08": "TC-004", "SEC-09": "TC-021", "SEC-10": "TC-022",
    "SEC-11": "TC-026", "SEC-12": "TC-028", "SEC-13": "TC-047", "SEC-14": "TC-024", "SEC-15": "TC-015",
    "SEC-17": "TC-164", "SEC-18": "TC-005", "SEC-19": "TC-019", "SEC-20": "TC-102", "SEC-21": "TC-163",
    "SEC-22": "TC-119", "SEC-23": "TC-120", "SEC-24": "TC-120", "SEC-25": "TC-161", "SEC-26": "TC-161",
    "SEC-27": "TC-003", "SEC-28": "TC-165", "SEC-29": "TC-166", "SEC-30": "TC-148",
}

STATUS_MAP = {"passed": "Passed", "failed": "Failed", "skipped": "Not executed", "pending": "Not executed", "todo": "Not executed"}


def stamp(epoch_ms) -> str:
    moment = datetime.fromtimestamp(epoch_ms / 1000, tz=timezone.utc)
    return f"{moment.day} {moment:%b %Y %H:%M} UTC"


def reruns():
    data = load_json("test-reruns.json") or {"suites": {}}
    index = {}
    for key, suite in data["suites"].items():
        index[key] = (suite, {t["fullName"]: t for t in suite["tests"]})
    return index


def _latest(evidence_file, evidence_start, full_name, evidence_status, rerun):
    """Status, evidence text and execution time, preferring the later re-run when present."""
    suite, by_name = rerun if rerun else (None, {})
    text = f"{evidence_file}: '{full_name}' {evidence_status} ({stamp(evidence_start)})"
    status = STATUS_MAP.get(evidence_status, "Not executed")
    executed = stamp(evidence_start)
    if full_name in by_name:
        later = by_name[full_name]
        later_status = STATUS_MAP.get(later["status"], "Not executed")
        text += f"; test-reruns.json: {later['status']} ({stamp(suite['startTime'])})"
        if later.get("failure"):
            text += f" – {later['failure'].splitlines()[0][:120]}"
        status, executed = later_status, stamp(suite["startTime"])
    return status, text, executed


def _rerun_only(full_name, rerun):
    suite, by_name = rerun
    later = by_name[full_name]
    text = f"test-reruns.json: '{full_name}' {later['status']} ({stamp(suite['startTime'])})"
    return STATUS_MAP.get(later["status"], "Not executed"), text, stamp(suite["startTime"])


def unit_cases(evidence_name, root_marker, conditions, command, suite_key, executed_by):
    data = load_json(evidence_name)
    rerun = reruns().get(suite_key)
    cases = []
    seen = set()
    files = data["testResults"] if data else []
    for result in files:
        rel = result["name"].split(root_marker, 1)[1]
        mapping = conditions.get(rel)
        if mapping is None:
            raise SystemExit(f"No condition mapping for test file {rel}")
        default, overrides = mapping if isinstance(mapping, tuple) else (mapping, {})
        for assertion in result["assertionResults"]:
            full = assertion["fullName"]
            seen.add(full)
            condition = next((cid for word, cid in overrides.items() if word in assertion["title"]), default)
            status, evidence, executed = _latest(evidence_name, data["startTime"], full, assertion["status"], rerun)
            cases.append(_unit_case(condition, assertion, rel, command, status, evidence, executed, executed_by))
    # Tests that exist only in the re-run (added after the evidence file was captured).
    if rerun:
        suite, by_name = rerun
        for full, test in by_name.items():
            if full in seen:
                continue
            rel = test["file"].split(root_marker, 1)[1]
            mapping = conditions.get(rel)
            if mapping is None:
                raise SystemExit(f"No condition mapping for test file {rel}")
            default, overrides = mapping if isinstance(mapping, tuple) else (mapping, {})
            title = full.split(" ", 1)[1] if " " in full else full
            condition = next((cid for word, cid in overrides.items() if word in title), default)
            status, evidence, executed = _rerun_only(full, rerun)
            assertion = {"fullName": full, "title": title, "ancestorTitles": [full.split(" ", 1)[0]]}
            cases.append(_unit_case(condition, assertion, rel, command, status, evidence, executed, executed_by))
    return cases


def _unit_case(condition, assertion, rel, command, status, evidence, executed, executed_by):
    subject = " › ".join(assertion.get("ancestorTitles") or [])
    title = f"{subject}: {assertion['title']}" if subject else assertion["title"]
    return {
        "condition": condition,
        "title": title,
        "persona": "Developer / CI",
        "steps": [command, f"Locate '{assertion['fullName']}' in the run output"],
        "data": f"Fixtures defined in {rel}",
        "expected": f"The test passes: {subject or 'the unit under test'} {assertion['title']}.",
        "level": "Unit",
        "automation": f"Automated – {rel}",
        "status": status,
        "evidence": evidence,
        "executed_on": executed,
        "executed_by": executed_by,
        "defect": "",
    }


def api_unit_cases():
    return unit_cases("api-unit-tests.json", "apps/api/src/", API_SPEC_CONDITIONS, UNIT_CMD_API, "api-unit", "iorta QA (Vitest)")


def web_unit_cases():
    return unit_cases("web-unit-tests.json", "apps/web/src/", WEB_SPEC_CONDITIONS, UNIT_CMD_WEB, "web-unit", "iorta QA (Vitest)")


def security_cases():
    import build_security_report as security  # noqa: WPS433  (EXPECTED texts of the security report)
    data = load_json("security-checks.json")
    run_at = datetime.fromisoformat(data["summary"]["runAt"].replace("Z", "+00:00"))
    executed = f"{run_at.day} {run_at:%b %Y %H:%M} UTC"
    cases = []
    for check in data["results"]:
        condition = SEC_CONDITIONS.get(check["id"])
        if condition is None:
            raise SystemExit(f"No condition mapping for {check['id']}")
        cases.append({
            "condition": condition,
            "title": f"{check['id']} (OWASP {check['owasp']}): {check['title']}",
            "persona": "Security tester",
            "steps": [SEC_CMD, f"Read the result of {check['id']}"],
            "data": "Demonstration users and records; crafted payloads as described in the script",
            "expected": security.EXPECTED.get(check["id"], check["title"]),
            "level": "Security",
            "automation": "Automated – tools/security/security-checks.mjs",
            "status": "Passed" if check["result"] == "PASS" else "Failed",
            "evidence": f"security-checks.json: {check['id']} {check['result']} ({executed}); evidence summarised in the Security Assessment Report",
            "executed_on": executed,
            "executed_by": "iorta QA (security-checks.mjs)",
            "defect": "",
        })
    return cases


def e2e_cases(defect_for_test):
    data = load_json("api-e2e-tests.json")
    rerun = reruns().get("api-e2e")
    by_full = {}
    for result in data["testResults"]:
        rel = result["name"].rsplit("/", 1)[1]
        for assertion in result["assertionResults"]:
            by_full[(rel, assertion["title"])] = (assertion["fullName"], assertion["status"])
    cases = []
    for entry in manual.E2E:
        key = (entry["spec"], entry["test"])
        if key not in by_full:
            raise SystemExit(f"End-to-end test not found in the evidence: {key}")
        full, status_text = by_full[key]
        status, evidence, executed = _latest("api-e2e-tests.json", data["startTime"], full, status_text, rerun)
        cases.append({
            "condition": entry["condition"],
            "title": entry["title"],
            "persona": entry["persona"],
            "steps": entry["steps"],
            "data": entry["data"],
            "expected": entry["expected"],
            "level": "E2E",
            "automation": f"Automated – {manual.E2E_DIR}/{entry['spec']} › {entry['test']}",
            "status": status,
            "evidence": evidence,
            "executed_on": executed,
            "executed_by": "iorta QA (Vitest e2e, iift_test database)",
            "defect": defect_for_test.get(entry["test"], "") if status == "Failed" else "",
        })
    return cases


def executed_cases():
    data = load_json("api-test-run.json")
    if not data:
        raise SystemExit("evidence/api-test-run.json is missing: run tools/testing/api-test-run.mjs first")
    by_id = {r["id"]: r for r in data["results"]}
    missing = sorted(set(manual.EXECUTED) - set(by_id))
    extra = sorted(set(by_id) - set(manual.EXECUTED))
    if missing or extra:
        raise SystemExit(f"Executed cases out of step with the run: missing {missing}, unmapped {extra}")
    cases = []
    for ex_id, (condition, steps, test_data) in manual.EXECUTED.items():
        run = by_id[ex_id]
        moment = datetime.fromisoformat(run["executedAt"].replace("Z", "+00:00"))
        note = f" Note: {run['note']}" if run.get("note") else ""
        cases.append({
            "condition": condition,
            "title": run["title"],
            "persona": run["actor"],
            "steps": steps,
            "data": test_data,
            "expected": run["expected"],
            "level": "API",
            "automation": "Executed – API run (tools/testing/api-test-run.mjs)",
            "status": run["result"],
            "evidence": f"api-test-run.json {ex_id}: {run['request']} → {run['response']}{note}",
            "executed_on": f"{moment.day} {moment:%b %Y %H:%M} UTC",
            "executed_by": data["summary"]["executedBy"],
            "defect": "",
            "ex_id": ex_id,
        })
    return cases, data["summary"]


def manual_cases(screens_dir: Path):
    cases = []
    for entry in manual.MANUAL:
        for shot in entry["shots"]:
            if not (screens_dir / (Path(shot).stem + ".jpg")).exists():
                raise SystemExit(f"Screenshot evidence missing: {shot} (expected {screens_dir / (Path(shot).stem + '.jpg')})")
        cases.append({
            "condition": entry["condition"],
            "title": entry["title"],
            "persona": entry["persona"],
            "steps": entry["steps"],
            "data": entry["data"],
            "expected": entry["expected"],
            "level": "UI",
            "automation": "Manual (exploratory)",
            "status": "Passed",
            "evidence": "Screens: " + ", ".join(entry["shots"]) + " (evidence/ui-screens)",
            "executed_on": "2 Oct 2026",
            "executed_by": "iorta QA (manual, exploratory)",
            "defect": "",
        })
    return cases


def not_executed_cases():
    cases = []
    for entry in manual.NOT_EXECUTED:
        cases.append({
            "condition": entry["condition"],
            "title": entry["title"],
            "persona": entry["persona"],
            "steps": entry["steps"],
            "data": entry["data"],
            "expected": entry["expected"],
            "level": entry["level"],
            "automation": "Not automated",
            "status": "Not executed",
            "evidence": entry["reason"],
            "executed_on": "",
            "executed_by": "",
            "defect": "",
        })
    return cases
