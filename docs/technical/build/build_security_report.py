"""Build the SalesVerse 2.0 Security Assessment Report (.docx and .pdf).

This is iorta TechNXT's internal pre-implementation assessment: automated
application security checks plus configuration and code review of the current
build in a test environment. It is not an independent penetration test.

Usage (from the repository root):
    python3 docs/technical/build/build_security_report.py

Results are read at build time from docs/technical/evidence (security-checks.json,
npm-audit.json) and from the repository's configuration files.
"""

import json
import re
import tempfile
from collections import OrderedDict
from pathlib import Path

import yaml

from reports_common import (ROOT, TECH_DIR, brand, cover, evidence_annex, format_timestamp, git_commit, load_json,
                            new_report, save_and_export)

OUTPUT = TECH_DIR / "SalesVerse-2.0-Security-Assessment-Report.docx"
TITLE = "Security Assessment Report"
SUBTITLE = "Internal pre-implementation assessment"
API = ROOT / "apps" / "api"

OWASP = OrderedDict([
    ("A01", "Broken Access Control"),
    ("A02", "Cryptographic Failures"),
    ("A03", "Injection"),
    ("A04", "Insecure Design"),
    ("A05", "Security Misconfiguration"),
    ("A06", "Vulnerable and Outdated Components"),
    ("A07", "Identification and Authentication Failures"),
    ("A08", "Software and Data Integrity Failures"),
    ("A09", "Security Logging and Monitoring Failures"),
    ("A10", "Server-Side Request Forgery"),
])

# Evidence other than the automated HTTP checks, per OWASP category.
OTHER_EVIDENCE = {
    "A02": "Code review: AES-256-GCM field and document encryption; Argon2id password hashing",
    "A04": "Design review: maker-checker enforced by the API; server-side business rules",
    "A05": "Configuration review: production guards, web-tier headers, non-root containers",
    "A06": "npm audit (0 findings); container image scan and CycloneDX SBOM in CI",
    "A08": "CI pipeline with locked dependencies (npm ci), CodeQL and secret scanning; signed release images planned",
    "A09": "Code review: structured logs with correlation id and header redaction; audit table append-only",
    "A10": "Code review: outbound calls go only to endpoints set in configuration; no user-supplied URLs are fetched",
}

# What a pass means for each check (keyed by check ID); the title is used when no entry exists.
EXPECTED = {
    "SEC-01": "HSTS, nosniff, frame and content-security headers present; X-Powered-By absent",
    "SEC-02": "404 with code and correlation id only; no framework detail",
    "SEC-03": "400 without stack trace",
    "SEC-04": "Identical message for unknown user and wrong password",
    "SEC-05": "HttpOnly and SameSite=Strict; Secure enforced by production configuration",
    "SEC-06": "New session identifier after sign-in",
    "SEC-07": "Old cookie rejected (401) after logout",
    "SEC-08": "HTTP 429 once the per-client sign-in limit is reached",
    "SEC-09": "401 without a session",
    "SEC-10": "403 WRONG_AUDIENCE for portal users on back-office routes",
    "SEC-11": "404: record outside the user's agency is not disclosed",
    "SEC-12": "403 for another agency's document",
    "SEC-13": "403 for participants with no business in the user's agency",
    "SEC-14": "403 when granting permissions the user does not hold",
    "SEC-15": "403 without the session's own CSRF token",
    "SEC-17": "Payloads treated as text: no extra records, no errors, no delay",
    "SEC-18": "401 invalid credentials",
    "SEC-19": "401; LDAP filter characters escaped",
    "SEC-20": "Negative, future-dated and excessive amounts refused",
    "SEC-21": "400 listing the unexpected properties",
    "SEC-22": "422 for executable, HTML and SVG content",
    "SEC-23": "422 FILE_TOO_LARGE",
    "SEC-24": "Stored name stripped of path elements",
    "SEC-25": "Identifiers masked; no ciphertext or blind index returned",
    "SEC-26": "No password hash in any user response",
    "SEC-27": "LOGIN_FAILED events with IP address in the audit trail",
    "SEC-28": "X-Request-Id on every response",
    "SEC-29": "Malformed and unknown tokens reveal nothing",
    "SEC-30": "401 without a key and with a wrong key; valid key accepted",
}

CONTROLS = [
    ["Authentication", "Argon2id password hashing (OWASP parameters); identical message for unknown user and wrong "
     "password; Active Directory sign-on for back-office users with escaped LDAP filters", "AP-01, NFR-09, INT-06"],
    ["Password policy", "{password}", "AP-02"],
    ["Sessions", "Server-side sessions in PostgreSQL; new session id at sign-in; HttpOnly, SameSite=Strict cookie, "
     "Secure in production; {session}; revocation at logout and on password change", "AP-03"],
    ["Lockout and rate limits", "{lockout}; sign-in limited per client address (HTTP 429); global request limit; "
     "web-tier request limit", "AP-04, NFR-09"],
    ["Authorisation", "Permission guard on every route; separate portal and back-office audiences; data scoping by "
     "agency and hierarchy; users cannot grant permissions they lack", "COM-02, NFR-10"],
    ["CSRF", "Synchroniser token issued at sign-in, checked in constant time on every state-changing request",
     "NFR-14"],
    ["Encryption in transit", "HSTS on API and web tier; TLS terminated at the web tier or load balancer",
     "COM-10, NFR-08"],
    ["Encryption at rest", "IC and passport numbers encrypted with AES-256-GCM (random IV, authentication tag, key "
     "version prefix) and an HMAC-SHA256 blind index; documents encrypted with AES-256-GCM and stored with mode 0600; "
     "ciphertext is never returned, and approval request views drop encrypted payload values",
     "COM-01, COM-10, NFR-08"],
    ["Input validation", "DTO whitelist with forbidNonWhitelisted; 2 MB JSON limit; parameterised database access",
     "NFR-14, NFR-30"],
    ["File uploads", "Type detected from content (PDF, PNG, JPEG only); extension forced to match; size limit; "
     "path elements removed; SHA-256 recorded; ClamAV scan, mandatory in production (the API does not start "
     "without CLAMAV_HOST)", "AP-46, COM-06"],
    ["Audit trail", "Append-only audit_log: a database trigger rejects UPDATE and DELETE; failed and successful "
     "sign-ins, lockouts and changes recorded with user, time and IP; sensitive fields redacted", "NFR-11, COM-03"],
    ["Error handling", "One global filter returns status, code, message and correlation id; details logged on the "
     "server only", "NFR-15"],
    ["System-to-system APIs", "Inbound API key compared by SHA-256 hash; interface disabled until a key is "
     "configured; web-tier allow-list for IITH addresses", "INT-10"],
    ["Vulnerability management", "CodeQL static analysis, gitleaks secret scan over the full history, npm audit and "
     "container scan in CI; CycloneDX SBOM per build; remediation timelines in section 9",
     "NFR-12, NFR-13"],
]

RESIDUAL = [
    ["Back-office MFA", "Medium", "Passwords alone protect back-office accounts today.", "Add e-mail OTP or TOTP MFA "
     "for back-office users; Active Directory sign-on where available", "Implementation, sprint 1"],
    ["Web application firewall", "Medium", "No WAF in front of the portal in the test environment.", "Place the "
     "portal behind IITH's WAF or a managed WAF with OWASP rules", "Before SIT"],
    ["Key management", "Medium", "Encryption keys are supplied as environment variables.", "Hold keys in an HSM, "
     "cloud KMS or vault; rotate yearly using the key-version prefix", "Before go-live"],
    ["Malware scanning", "Low", "The API refuses to start in production without CLAMAV_HOST, so production uploads "
     "are always scanned; development instances may run without a scanner.", "Run ClamAV in SIT and UAT too, keep "
     "signatures current and alert when the scanner is unreachable", "Before SIT"],
    ["Database connections", "Low", "Database traffic is not encrypted inside the compose network.", "Enable TLS "
     "to PostgreSQL and restrict the application role to the privileges it needs", "Before go-live"],
    ["Backup encryption", "Low", "Backup encryption depends on IITH's backup service.", "Encrypt backups and test "
     "restores quarterly", "Before go-live"],
    ["SIEM integration", "Low", "Logs and audit records are not yet forwarded centrally.", "Forward logs and "
     "audit events to IITH's SIEM; add alert rules", "Implementation"],
    ["Rate limiting behind proxies", "Low", "Per-client limits depend on the forwarded client address.", "Set "
     "TRUST_PROXY_HOPS to the real proxy chain and tune limits after performance testing", "SIT"],
    ["Independent assurance", "High until done", "No independent test has yet been performed.", "Independent VAPT "
     "on IIFT's UAT or production-like environment with re-test (DEL-17)", "Weeks 17–19"],
]

REMEDIATION = [
    ["Critical", "Remotely exploitable; data exposure or system compromise", "Contained within 24 hours; fixed within 7 days"],
    ["High", "Significant impact; exploitation likely", "Within 14 days"],
    ["Medium", "Limited impact or hard to exploit", "Within 30 days"],
    ["Low", "Minimal impact; hardening advice", "Within 90 days or the next release"],
]

VAPT_PLAN = [
    ["Tester", "Independent third party approved by IIFT; no involvement in building the solution"],
    ["Environment", "IIFT UAT or a production-like environment with production configuration and test data"],
    ["Timing", "Weeks 17 to 19 of the plan, after SIT functional exit"],
    ["Scope", "Portal, back-office, public e-signature page, APIs including system-to-system endpoints, web tier and "
              "hosting configuration"],
    ["Approach", "Authenticated (grey-box) testing per role plus unauthenticated external testing, against OWASP "
                 "ASVS Level 2 and the OWASP Top 10"],
    ["Rules of engagement", "Agreed with IIFT IT security: test windows, contacts, data handling, no denial-of-service"],
    ["Deliverables", "Report with findings, severity and evidence; remediation by iorta; re-test report (DEL-17)"],
    ["Exit criterion", "No open Critical or High findings at go-live; Medium and Low tracked to the timelines in "
                       "section 9"],
]


# --- Evidence and configuration readers ------------------------------------------------------
def summarise(check):
    evidence = check["evidence"]
    if check["id"] == "SEC-17":
        leaked = sum(1 for e in evidence if e.get("leaked"))
        slowest = max(e.get("ms", 0) for e in evidence)
        return f"{len(evidence)} payloads; all HTTP {evidence[0]['status']}; no records leaked ({leaked}); slowest {slowest} ms"
    if check["id"] == "SEC-25":
        return f"{len(evidence)} identifiers returned masked, e.g. {evidence[0]}"
    if check["id"] == "SEC-08":
        return f"{evidence['statuses'].count(429)} of {len(evidence['statuses'])} attempts after the limit returned 429"
    if check["id"] == "SEC-01":
        present = [k for k, v in evidence.items() if v]
        absent = [k for k, v in evidence.items() if not v]
        return f"Present: {', '.join(present)}. Absent: {', '.join(absent)}"
    if check["id"] == "SEC-05":
        return "Set-Cookie: " + "; ".join(part.strip() for part in evidence["setCookie"].split(";")
                                          if not part.strip().startswith("Expires"))
    if check["id"] == "SEC-27":
        return f"{evidence['total']} failure events; sample {evidence['sample']['action']} from {evidence['sample']['ip']}"
    if isinstance(evidence, dict):
        parts = []
        for key, value in evidence.items():
            if isinstance(value, dict):
                value = ", ".join(f"{k}={v}" for k, v in value.items() if k in ("statusCode", "code", "message"))
            elif isinstance(value, list):
                value = "; ".join(str(item) for item in value)
            parts.append(f"{key}: {value}")
        text = "; ".join(parts)
    else:
        text = json.dumps(evidence)
    text = text.replace("[", "(").replace("]", ")")   # square brackets mark placeholders in the layout kit
    return text if len(text) < 150 else text[:147] + "…"


def nginx_headers():
    text = (ROOT / "apps" / "web" / "nginx.conf").read_text()
    headers = re.findall(r'add_header\s+([\w-]+)\s+"([^"]+)"\s+always;', text)
    extras = []
    if "server_tokens off" in text:
        extras.append(["server_tokens", "off (nginx version hidden)"])
    rate = re.search(r"limit_req_zone .* rate=(\S+);", text)
    if rate:
        extras.append(["limit_req (API)", f"{rate.group(1)} per client address with burst"])
    body = re.search(r"client_max_body_size (\S+);", text)
    if body:
        extras.append(["client_max_body_size", body.group(1)])
    return [[name, value] for name, value in headers] + extras


def production_guards():
    text = (API / "src" / "config" / "app-config.ts").read_text()
    return re.findall(r"problems\.push\(\s*'([^']+)',?\s*\)", text)


def security_settings():
    text = (API / "src" / "modules" / "settings" / "setting-keys.ts").read_text()
    keys = dict(re.findall(r"(\w+): '(security\.[\w.]+)'", text))
    values = dict(re.findall(r"key: Setting\.(\w+),\s*value: '([^']*)'", text))
    return {name: values.get(name) for name in keys}


def container_users():
    rows = []
    for path in (ROOT / "apps" / "api" / "Dockerfile", ROOT / "apps" / "web" / "Dockerfile"):
        text = path.read_text()
        user = re.findall(r"^USER\s+(\S+)", text, re.MULTILINE)
        base = re.findall(r"^FROM\s+(\S+)", text, re.MULTILINE)[-1]
        if user:
            detail = f"Runs as '{user[-1]}' (non-root); base image {base}"
        elif "unprivileged" in base:
            detail = f"Base image {base} runs nginx as a non-root user"
        else:
            detail = f"Base image {base}; no USER instruction"
        rows.append([path.relative_to(ROOT).as_posix(), detail])
    return rows


def ci_security_gates():
    workflow = yaml.safe_load((ROOT / ".github" / "workflows" / "ci.yml").read_text())
    gates = []
    for job in workflow["jobs"].values():
        for step in job.get("steps", []):
            run, uses = step.get("run", ""), step.get("uses", "")
            if "audit" in run:
                gates.append(["Dependency audit", run])
            if "gitleaks" in run:
                gates.append(["Secret scan", "gitleaks over the full git history on every push and pull request"])
            if "codeql-action/init" in uses:
                options = step.get("with", {})
                gates.append(["Static analysis (SAST)", f"CodeQL, {options.get('languages')}, "
                                                        f"{options.get('queries')} queries"])
            if "npm sbom" in run:
                gates.append(["Software bill of materials", "CycloneDX SBOM of production dependencies, kept as a "
                                                            "build artifact"])
            if "trivy" in uses:
                severity = step.get("with", {}).get("severity", "")
                gates.append(["Container image scan", f"Trivy; fails on {severity} (fixable)"])
    return gates


# --- Sections ------------------------------------------------------------------------------------
def notice(w):
    w.callout("Nature of this assessment", [
        "This is iorta TechNXT's **internal** assessment of the current build: automated application security "
        "checks, plus configuration and code review, in a test environment with demonstration data.",
        "It is **not** an independent penetration test. An independent third-party VAPT on IIFT's UAT or "
        "production-like environment is scheduled before go-live (DEL-17), followed by remediation and re-test. "
        "Section 10 sets out that plan.",
    ])


def scope_section(w, checks):
    summary = checks["summary"]
    w.h1("Scope and environment")
    w.table(["Item", "Detail"], [
        ["Build assessed", f"{brand.PRODUCT}, commit {git_commit()}"],
        ["Environment", f"Test environment at {summary['baseUrl']} with demonstration data; not production"],
        ["Automated checks run", format_timestamp(summary["runAt"])],
        ["In scope", "API (NestJS) and its HTTP pipeline, authentication and sessions, authorisation and data "
                     "scoping, uploads and document storage, field encryption, audit trail, web-tier configuration "
                     "(nginx), container images, CI pipeline, dependencies"],
        ["Out of scope", "IIFT/IITH infrastructure and network, IIFT systems behind the integration adapters, "
                         "denial-of-service, social engineering, physical security; these belong to the independent "
                         "VAPT and IITH's own controls"],
    ], widths=[4.0, 13.0], font_size=8.5, bold_first_col=True, caption="Scope")


def method_section(w):
    w.h1("Method")
    w.paras([
        "The assessment follows the OWASP Top 10 (2021) and the OWASP Application Security Verification Standard "
        "(ASVS) Level 2 areas for authentication, session management, access control, input validation, "
        "cryptography at rest, error handling and logging, data protection, file handling and configuration.",
        "Automated checks are run by tools/security/security-checks.mjs against a freshly built, non-production "
        "instance loaded with demonstration data. Each check signs in as the relevant demonstration user, sends a "
        "crafted request (wrong credentials, another agency's identifiers, injection payloads, executable uploads, "
        "missing CSRF tokens and so on) and records what was sent, what was expected and what came back. Because "
        "the script changes data and triggers lockouts and rate limits, it must never run against production.",
        "Code and configuration review covered: the HTTP pipeline (app.setup.ts), the authentication module and "
        "guards, the security helpers in common/security, field encryption, the file inspector and document "
        "storage, the audit trigger in the database migration, start-up configuration and production guards, the "
        "web-tier nginx configuration, both Dockerfiles, the compose deployment and the CI pipeline.",
    ])


def summary_section(w, checks, audit):
    results = checks["results"]
    w.h1("Summary of results")
    passed, total = checks["summary"]["passed"], checks["summary"]["total"]
    w.para(f"{passed} of {total} automated checks passed. npm audit reports "
           f"{audit['metadata']['vulnerabilities']['total']} known vulnerabilities. No Critical or High finding is "
           "open from this assessment. The residual risks in section 8 are improvements to be made during "
           "implementation, mostly in the hosting environment, together with the independent VAPT.")
    rows = []
    for code, name in OWASP.items():
        in_category = [r for r in results if r["owasp"] == code]
        passes = sum(1 for r in in_category if r["result"] == "PASS")
        result = "No automated check" if not in_category else ("Pass" if passes == len(in_category) else "Fail")
        rows.append([f"{code} {name}", str(len(in_category)), str(passes), result, OTHER_EVIDENCE.get(code, "")])
    w.table(["OWASP Top 10 2021", "Checks", "Passed", "Result", "Other evidence"], rows,
            widths=[4.6, 1.4, 1.5, 2.6, 6.9], font_size=8, center_cols=(1, 2), bold_first_col=True,
            caption="Results by OWASP category")


def detail_section(w, checks):
    w.h1("Detailed results")
    order = list(OWASP)
    results = sorted(checks["results"], key=lambda r: (order.index(r["owasp"]), r["id"]))
    rows = [[r["id"], r["owasp"], r["title"], EXPECTED.get(r["id"], r["title"]), r["result"].title(), summarise(r)]
            for r in results]
    w.table(["ID", "OWASP", "Check", "Expected", "Result", "Evidence summary"], rows,
            widths=[1.4, 1.3, 4.0, 3.9, 1.3, 5.1], font_size=7, padding=15, center_cols=(1, 4),
            caption="Automated security checks")
    w.para("Check IDs follow the script's numbering; the gap at SEC-16 is intentional. Cookie values are redacted "
           "in the evidence.")


def controls_section(w):
    settings = security_settings()
    fill = {
        "password": (f"At least {settings.get('PasswordMinLength')} characters with upper case, lower case, digit "
                     f"and symbol; last {settings.get('PasswordHistoryCount')} passwords blocked; expiry "
                     f"{settings.get('PasswordExpiryDays')} days; username not allowed; all configurable"),
        "session": (f"{settings.get('SessionIdleMinutes')}-minute idle and {settings.get('SessionAbsoluteHours')}-hour "
                    f"absolute timeout; single active session {'on' if settings.get('SessionSingleActive') == 'true' else 'off'}"),
        "lockout": (f"Account locked for {settings.get('LockoutMinutes')} minutes after "
                    f"{settings.get('LockoutMaxAttempts')} failed attempts"),
    }
    rows = [[area, text.format(**fill), refs] for area, text, refs in CONTROLS]
    w.h1("Security controls implemented")
    w.para("The controls below are in the current build. Default values are read from the platform's settings "
           "definitions and can be changed by IIFT administrators in the back-office; every change is audited.")
    w.table(["Control", "Implementation", "RFP reference"], rows, widths=[3.0, 11.0, 3.0], font_size=8,
            bold_first_col=True, caption="Controls mapped to RFP requirements")


def configuration_section(w, checks):
    w.h1("Configuration review")
    w.h2("Web-tier headers and limits (nginx)", numbered=False)
    w.table(["Directive", "Value"], nginx_headers(), widths=[4.4, 12.6], font_size=7.5, padding=20,
            bold_first_col=True, caption="apps/web/nginx.conf")
    api_headers = next((r["evidence"] for r in checks["results"] if r["id"] == "SEC-01"), {})
    w.h2("API response headers (observed)", numbered=False)
    w.table(["Header", "Value"], [[k, v if v else "Absent"] for k, v in api_headers.items()],
            widths=[4.4, 12.6], font_size=7.5, padding=20, bold_first_col=True, caption="Headers recorded by SEC-01")
    w.para("The API and the web tier send the same framing policy: X-Frame-Options DENY and frame-ancestors "
           "'none'. API responses also carry default-src 'none', as they are data, not pages.")
    w.h2("Cookies, secrets and production guards", numbered=False)
    guards = production_guards()
    w.para("The session cookie is HttpOnly and SameSite=Strict in every environment, and Secure whenever "
           "SESSION_COOKIE_SECURE is true, which is the production default. Secrets and keys come from environment "
           "variables (deploy/.env, never committed): the session secret must be at least 32 characters and each "
           "encryption key must be a base64 32-byte key, or the API refuses to start. In production the API also "
           "refuses to start when any of these conditions fails:")
    w.bullets(guards)
    w.h2("Containers and pipeline", numbered=False)
    w.table(["Item", "Finding"], container_users() + ci_security_gates() + [
        ["Runtime dependencies", "API image installs production dependencies only (npm ci --omit=dev)"],
        ["Health checks", "Both images define container health checks"],
    ], widths=[5.0, 12.0], font_size=8, bold_first_col=True, caption="Container and CI review")


def dependency_section(w, audit):
    w.h1("Dependency vulnerabilities", new_page=False)
    vulns, deps = audit["metadata"]["vulnerabilities"], audit["metadata"]["dependencies"]
    w.para(f"npm audit found {vulns['total']} known vulnerabilities in {deps['total']} installed packages. The CI "
           "pipeline repeats the audit on every change and fails on any moderate or higher finding.")
    w.table(["Critical", "High", "Moderate", "Low", "Info", "Total"],
            [[str(vulns[k]) for k in ("critical", "high", "moderate", "low", "info", "total")]],
            widths=[2.8] * 6, font_size=8.5, center_cols=(0, 1, 2, 3, 4, 5))


def residual_section(w):
    w.h1("Residual risks and recommendations")
    w.para("None of these items is an exploitable weakness found in the build. They are controls that depend on "
           "the target environment or that we plan to add during implementation.")
    w.table(["Area", "Rating", "Current position", "Recommendation", "When"], RESIDUAL,
            widths=[2.8, 1.8, 4.4, 5.6, 2.4], font_size=7.5, padding=20, bold_first_col=True,
            caption="Residual risks")


def remediation_section(w):
    w.h1("Vulnerability severity and remediation timelines", new_page=False)
    w.table(["Severity", "Description", "Timeline"], REMEDIATION, widths=[2.6, 7.4, 7.0], font_size=8.5,
            bold_first_col=True, caption="Remediation timelines (NFR-12, MNT-12)")


def vapt_section(w):
    w.h1("Independent VAPT plan")
    w.table(["Item", "Plan"], VAPT_PLAN, widths=[3.6, 13.4], font_size=8.5, bold_first_col=True,
            caption="Independent vulnerability assessment and penetration test (DEL-17)")


def build() -> Path:
    checks = load_json("security-checks.json")
    audit = load_json("npm-audit.json")
    w = new_report(f"{brand.PRODUCT} – {TITLE} – {SUBTITLE}", "Security assessment",
                   f"iorta TechNXT | {brand.PRODUCT} – {TITLE}")
    with tempfile.TemporaryDirectory() as tmp:
        cover(w, Path(tmp), f"{brand.PRODUCT}\n{TITLE}", f"{SUBTITLE.capitalize()}: automated checks, "
              "configuration and code review", [
                  ("Prepared for", brand.CLIENT),
                  ("Solution", brand.SOLUTION_NAME),
                  ("Build assessed", f"Commit {git_commit()}"),
                  ("Checks run", format_timestamp(checks["summary"]["runAt"])),
                  ("Assessment type", "Internal (iorta TechNXT); not an independent penetration test"),
                  ("Document date", brand.SUBMISSION_DATE),
                  ("Version", brand.DOCUMENT_VERSION),
                  ("Classification", brand.CLASSIFICATION),
              ])
        w.h1("Contents", numbered=False)
        w.toc()
        notice(w)
        scope_section(w, checks)
        method_section(w)
        summary_section(w, checks, audit)
        detail_section(w, checks)
        controls_section(w)
        configuration_section(w, checks)
        dependency_section(w, audit)
        residual_section(w)
        remediation_section(w)
        vapt_section(w)
        evidence_annex(w, "Annex – Evidence files")
        return save_and_export(w, OUTPUT)


if __name__ == "__main__":
    print(f"Wrote {build()}")
