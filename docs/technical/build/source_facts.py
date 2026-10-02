"""Facts read directly from the source code, shared by the technical documents.

Reading these from the code (instead of retyping them) keeps the documents in
step with the application: environment variables, business parameters, API
operations, package versions and the sizing model all come from here.
"""

import json
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
API = REPO / "apps" / "api"
WEB = REPO / "apps" / "web"


# --- Environment variables ---------------------------------------------------------------------
def env_variables():
    """Names read by AppConfig, in source order, with the default found in code."""
    src = (API / "src" / "config" / "app-config.ts").read_text()
    names = []
    for m in re.finditer(r"reader\.(string|int|bool|list|required|optional|secret|key|endpoint)\('([A-Z0-9_]+)'"
                         r"(?:,\s*([^)]*))?\)", src):
        kind, name, default = m.group(1), m.group(2), (m.group(3) or "").strip()
        if kind == "endpoint":
            for suffix, d in (("_BASE_URL", ""), ("_API_KEY", ""), ("_TIMEOUT_MS", "15000")):
                names.append((name + suffix, "endpoint", d))
            continue
        names.append((name, kind, default))
    seen, result = set(), []
    for item in names:
        if item[0] not in seen:
            seen.add(item[0])
            result.append(item)
    return result


ENV_DOCS = {
    # name: (group, purpose, example)
    "NODE_ENV": ("Runtime", "production enables the production safety checks and secure defaults.", "production"),
    "PORT": ("Runtime", "HTTP port the API listens on inside the container.", "3000"),
    "TRUST_PROXY_HOPS": ("Runtime", "Number of reverse proxies in front of the API, so client IPs in logs and audit "
                                    "are correct.", "1"),
    "DATABASE_URL": ("Database", "PostgreSQL connection string for the application role; use sslmode=require.",
                     "postgresql://iift_app:***@db-vip:5432/iift?sslmode=require"),
    "DATABASE_POOL_SIZE": ("Database", "Maximum connections per API instance for business queries (the session store "
                                       "uses a separate pool of 5).", "10"),
    "CORS_ORIGINS": ("HTTP", "Comma-separated origins allowed for cross-origin calls. Leave empty when the SPA and API "
                             "share one origin behind the proxy.", "(empty)"),
    "PUBLIC_BASE_URL": ("HTTP", "External base URL used in links sent by e-mail (e-signature links).",
                        "https://portal.iift.com.bn"),
    "API_DOCS_ENABLED": ("HTTP", "Serves Swagger UI at /api/docs. Must be false in production.", "false"),
    "SESSION_SECRET": ("Security", "Secret that signs the session cookie; at least 32 characters.", "(64 random chars)"),
    "SESSION_COOKIE_NAME": ("Security", "Name of the session cookie.", "iift.sid"),
    "SESSION_COOKIE_SECURE": ("Security", "Sends the cookie over HTTPS only. Must be true in production.", "true"),
    "FIELD_ENCRYPTION_KEY": ("Security", "Base64 256-bit key for AES-256-GCM encryption of IC/passport numbers.",
                             "(base64, 32 bytes)"),
    "FIELD_HASH_KEY": ("Security", "Base64 256-bit key for the HMAC-SHA256 blind index of identification numbers.",
                       "(base64, 32 bytes)"),
    "DOCUMENT_ENCRYPTION_KEY": ("Security", "Base64 256-bit key for AES-256-GCM encryption of stored documents.",
                                "(base64, 32 bytes)"),
    "DOCUMENT_STORAGE_PATH": ("Documents", "Directory of the encrypted document store (NFS mount on-premise, EFS in "
                                           "the cloud).", "/data/documents"),
    "MAX_UPLOAD_MB": ("Documents", "Largest accepted upload in MB (the HTTP layer also refuses bodies over 25 MB).",
                      "10"),
    "CLAMAV_HOST": ("Documents", "clamd host for malware scanning of uploads. When it is empty outside "
                                  "production, uploads are not scanned.",
                    "clamav"),
    "CLAMAV_PORT": ("Documents", "clamd TCP port.", "3310"),
    "JOBS_ENABLED": ("Jobs", "Runs scheduled jobs in this instance. Locks prevent double runs, so it can stay true on "
                             "every replica.", "true"),
    "JOBS_TIMEZONE": ("Jobs", "Time zone of EOD_CRON.", "Asia/Brunei"),
    "EOD_CRON": ("Jobs", "Six-field cron expression (with seconds) for end-of-day processing.", "0 30 23 * * *"),
    "INTEGRATION_MODE": ("Integration", "simulated records messages without calling external systems; live calls the "
                                        "configured endpoints.", "live"),
    "INBOUND_API_KEY_SHA256": ("Integration", "Hex SHA-256 of the API key that Core and FIN present to "
                                              "/api/v1/integration. The key itself is not stored.", "(64 hex chars)"),
    "CORE_API_BASE_URL": ("Integration", "Base URL of the core system API.", "https://core.iith.local/api"),
    "CORE_API_API_KEY": ("Integration", "API key sent to the core system (x-api-key).", "(secret)"),
    "CORE_API_TIMEOUT_MS": ("Integration", "Timeout of a core system call.", "15000"),
    "FINANCE_API_BASE_URL": ("Integration", "Base URL of the financial system (FIN) API.", "https://fin.iith.local/api"),
    "FINANCE_API_API_KEY": ("Integration", "API key sent to FIN.", "(secret)"),
    "FINANCE_API_TIMEOUT_MS": ("Integration", "Timeout of a FIN call.", "15000"),
    "AML_API_BASE_URL": ("Integration", "Base URL of the external AML screening service (optional).",
                         "https://aml.provider.example/v1"),
    "AML_API_API_KEY": ("Integration", "API key of the AML service.", "(secret)"),
    "AML_API_TIMEOUT_MS": ("Integration", "Timeout of an AML call.", "15000"),
    "SMS_API_BASE_URL": ("Notifications", "Base URL of the SMS gateway HTTP API.", "https://sms.provider.example/v1"),
    "SMS_API_API_KEY": ("Notifications", "Bearer token of the SMS gateway.", "(secret)"),
    "SMS_API_TIMEOUT_MS": ("Notifications", "Timeout of an SMS call.", "15000"),
    "SMS_SENDER_ID": ("Notifications", "Sender name shown on SMS messages.", "IIFT"),
    "SMTP_HOST": ("Notifications", "SMTP relay host; e-mail is recorded but not sent when empty.", "smtp.iith.local"),
    "SMTP_PORT": ("Notifications", "SMTP port.", "587"),
    "SMTP_SECURE": ("Notifications", "true for implicit TLS (465); false uses STARTTLS, which is then required.",
                    "false"),
    "SMTP_USER": ("Notifications", "SMTP user name, if the relay requires authentication.", "portal-mailer"),
    "SMTP_PASSWORD": ("Notifications", "SMTP password.", "(secret)"),
    "SMTP_FROM": ("Notifications", "Sender address (required when SMTP_HOST is set).", "no-reply@iift.com.bn"),
    "LDAP_URL": ("Directory", "Directory URL for back-office sign-in; use ldaps://.", "ldaps://ad.iith.local:636"),
    "LDAP_BIND_DN": ("Directory", "Service account used to look up users.", "CN=svc-portal,OU=Service,DC=iith,DC=local"),
    "LDAP_BIND_PASSWORD": ("Directory", "Service account password.", "(secret)"),
    "LDAP_BASE_DN": ("Directory", "Search base for users.", "OU=Staff,DC=iith,DC=local"),
    "LDAP_USER_FILTER": ("Directory", "Search filter; {{username}} is replaced with the escaped user name.",
                         "(sAMAccountName={{username}})"),
    "METRICS_TOKEN": ("Monitoring", "Bearer token required by /metrics when set.", "(secret)"),
}

EXTRA_ENV = [
    ("LOGIN_RATE_LIMIT_PER_MINUTE", "Security", "Sign-in attempts allowed per client IP per minute and API instance.",
     "10", "config/app-config.ts"),
    ("LOG_LEVEL", "Monitoring", "pino log level; defaults to info in production and debug otherwise.", "info",
     "app.module.ts"),
    ("SEED_ADMIN_PASSWORD", "Set-up", "Temporary password of the first administrator created by npm run db:seed "
                                      "(12+ characters, changed at first sign-in).", "(one-off secret)", "prisma/seed.ts"),
    ("SEED_ADMIN_EMAIL", "Set-up", "E-mail of the first administrator.", "it.admin@iift.com.bn", "prisma/seed.ts"),
    ("DEMO_PASSWORD", "Set-up", "Password of demonstration users loaded by npm run db:seed:demo; refused in "
                                "production.", "(non-production only)", "prisma/seed-demo.ts"),
]


NEED_OVERRIDE = {
    "SMTP_FROM": "Required when SMTP_HOST is set",
    "LDAP_BIND_DN": "Required when LDAP_URL is set",
    "LDAP_BIND_PASSWORD": "Required when LDAP_URL is set",
    "LDAP_BASE_DN": "Required when LDAP_URL is set",
    "LDAP_USER_FILTER": "Default (sAMAccountName={{username}})",
    "CLAMAV_HOST": "Required in production",
    "INBOUND_API_KEY_SHA256": "Required in production with live mode",
    "CORE_API_BASE_URL": "Required in production with live mode",
    "FINANCE_API_BASE_URL": "Required in production with live mode",
    "SMTP_HOST": "Required in production with live mode",
    "NODE_ENV": "Default development",
}


def env_reference():
    """Rows: name, group, required/default, purpose, example. Fails if a variable is undocumented."""
    rows = []
    missing = []
    for name, kind, default in env_variables():
        if name not in ENV_DOCS:
            missing.append(name)
            continue
        group, purpose, example = ENV_DOCS[name]
        if kind in ("required", "secret", "key"):
            need = "Required"
        elif kind == "endpoint":
            need = "Optional (set together)" if not default else f"Default {default}"
        elif kind == "optional":
            need = "Optional"
        elif kind == "list":
            need = "Optional"
        else:
            shown = default.strip("'") if default else ""
            if "isProduction" in shown:
                shown = "true in production" if shown.startswith("this.isProduction") else "false in production"
            need = f"Default {shown}"
        need = NEED_OVERRIDE.get(name, need)
        rows.append([name, group, need, purpose, example])
    if missing:
        raise SystemExit("Undocumented environment variables: " + ", ".join(missing))
    return rows


# --- Business parameters ------------------------------------------------------------------------
def setting_defaults():
    src = (API / "src" / "modules" / "settings" / "setting-keys.ts").read_text()
    region = src[src.index("export const Setting = {"):src.index("} as const")]
    keys = dict(re.findall(r"^\s+(\w+): '([a-z_.]+)',$", region, re.M))
    body = src[src.index("SETTING_DEFAULTS"):]
    rows = []
    for block in re.findall(r"\{([^{}]*key: Setting\.[^{}]*)\}", body, re.S):
        def field(name, pattern=None):
            patterns = [pattern] if pattern else [r"'((?:[^'\\]|\\.)*)'", r'"((?:[^"\\]|\\.)*)"']
            for candidate in patterns:
                m = re.search(rf"{name}:\s*{candidate}", block, re.S)
                if m:
                    return m.group(1)
            return ""
        const = field("key", r"Setting\.(\w+)")
        lo, hi = field("min", r"([\d.]+)"), field("max", r"([\d.]+)")
        rows.append({"key": keys[const], "value": field("value"), "type": field("valueType"),
                     "category": field("category"), "description": field("description").replace("\\'", "'"),
                     "range": f"{lo} to {hi}" if lo else ""})
    if len(rows) != len(keys):
        raise SystemExit(f"Parsed {len(rows)} of {len(keys)} settings from setting-keys.ts")
    return rows


# --- API catalogue ------------------------------------------------------------------------------
def api_operations():
    spec = json.loads((REPO / "docs" / "api" / "openapi.json").read_text())
    ops = []
    for path, methods in spec["paths"].items():
        for method, op in methods.items():
            if method in ("get", "post", "put", "patch", "delete"):
                ops.append((method.upper(), path, (op.get("tags") or [""])[0]))
    return spec, ops


def namespace(path):
    parts = path.split("/")
    return "/" + "/".join(parts[1:4]) if len(parts) > 3 else path


# --- Package versions ---------------------------------------------------------------------------
def versions():
    api = json.loads((API / "package.json").read_text())
    web = json.loads((WEB / "package.json").read_text())
    root = json.loads((REPO / "package.json").read_text())
    def clean(v):
        return v.lstrip("^~")
    deps = {}
    for source in (api.get("dependencies", {}), api.get("devDependencies", {}), web.get("dependencies", {}),
                   web.get("devDependencies", {})):
        for name, version in source.items():
            deps.setdefault(name, clean(version))
    return deps, root


# --- Sizing model --------------------------------------------------------------------------------
APPENDIX2 = [
    # product, line of business, 2025, 2026 to July, projected in 5 years
    ("Financing Takaful Plan – Hire Purchase (FTP-HP)", "Mortgage Takaful", 59, 16, 75),
    ("Financing Takaful Plan – Non-Participating (FTP-NP)", "Mortgage Takaful", 158, 65, 205),
    ("Property Financing Takaful (PFT)", "Mortgage Takaful", 88, 60, 115),
    ("Personal Home Assistant Takaful (PHA)", "Annual", 102, 41, 132),
    ("Professional Takaful Plan (PRO)", "Annual", 40, 19, 52),
    ("Khairat Takaful Plan (KHR)", "Annual", 31, 16, 40),
    ("Overseas Student Assist Takaful (OSA)", "Annual", 7, 2, 9),
]

BASE_2025 = sum(r[2] for r in APPENDIX2)
TARGET_5Y = sum(r[4] for r in APPENDIX2)
GROWTH = (TARGET_5Y / BASE_2025) ** (1 / 5) - 1
YEARS = [2027, 2028, 2029, 2030, 2031]
HEADROOM = 10

# Rows created per issued policy, and average row size in bytes (heap, before indexes).
PER_POLICY = [
    ("policy", 2.5, 2600, "issued policy plus 1.5 quotations not taken up"),
    ("policy_event", 10, 260, "history entries"),
    ("nominee", 1.5, 300, ""),
    ("participant", 0.8, 850, "some participants hold several policies"),
    ("aml_screening", 1.0, 900, "screening on registration and name change"),
    ("signature_request", 0.5, 420, ""),
    ("document", 9, 420, "metadata only; files counted separately"),
    ("payment", 0.5, 420, "bulk payments cover about two policies"),
    ("payment_allocation", 1.1, 130, ""),
    ("receipt", 1.1, 220, ""),
    ("commission", 1.0, 220, ""),
    ("claim", 0.05, 900, ""),
    ("approval_request", 0.8, 1600, "referrals, payment verification, endorsements"),
    ("approval_action", 2.0, 260, ""),
    ("notification", 14, 900, "in-app, e-mail and SMS"),
    ("outbox_message", 3.5, 1000, ""),
    ("integration_log", 18, 420, "outbound, inbound, e-mail and SMS calls"),
    ("audit_log", 35, 1500, "before and after values"),
]
INDEX_FACTOR = 1.6
FIXED_PER_YEAR_MB = 12   # eod_run, reconciliation_run, issues, sessions, users, master data, watch-list


def policies_per_year():
    return {year: round(BASE_2025 * (1 + GROWTH) ** (year - 2025)) for year in YEARS}


def database_sizing():
    per_year = policies_per_year()
    rows = []
    cumulative_policies = 0
    total_mb = 0.0
    for year in YEARS:
        cumulative_policies += per_year[year]
        year_bytes = per_year[year] * sum(mult * size for _, mult, size, _ in PER_POLICY)
        year_mb = year_bytes * INDEX_FACTOR / 1_048_576 + FIXED_PER_YEAR_MB
        total_mb += year_mb
        rows.append((year, per_year[year], cumulative_policies, year_mb, total_mb, total_mb * HEADROOM))
    return rows


DOC_PER_POLICY_MB = [
    ("Uploaded supporting documents (IC, proposal form, PDS, product documents)", 5, 0.40),
    ("System-generated e-Policy schedule and e-Receipt (PDF)", 2, 0.05),
    ("Signatures (PNG)", 2, 0.02),
    ("Payment proof (shared by about two policies)", 0.5, 0.50),
]
DOC_FIXED_PER_YEAR_MB = 120   # EOD reports and FIN files, scheduled reports, agent documents, claim and issue files


def document_sizing():
    per_policy = sum(n * size for _, n, size in DOC_PER_POLICY_MB)
    per_year = policies_per_year()
    rows, total = [], 0.0
    for year in YEARS:
        year_gb = (per_year[year] * per_policy + DOC_FIXED_PER_YEAR_MB) / 1024
        total += year_gb
        rows.append((year, year_gb, total, total * HEADROOM))
    return per_policy, rows


# --- Roles and permissions -------------------------------------------------------------------------
def roles():
    src = (API / "prisma" / "reference-data" / "roles.ts").read_text()
    pattern = (r"code: '([A-Z_]+)',\s*name: '([^']+)',\s*audience: '(\w+)',\s*description:\s*"
               r"(?:'((?:[^'\\]|\\.)*)'|\"([^\"]*)\")")
    return [(m.group(1), m.group(2), m.group(3), m.group(4) or m.group(5)) for m in re.finditer(pattern, src)]


def permission_count():
    src = (API / "src" / "common" / "security" / "permissions.ts").read_text()
    catalogue = src[src.index("PERMISSION_CATALOGUE"):]
    return len(re.findall(r"code: Permission\.\w+", catalogue))


def test_inventory():
    unit = list((API / "src").rglob("*.spec.ts")) + list((WEB / "src").rglob("*.test.ts*"))
    e2e = list((API / "test").glob("*.e2e-spec.ts"))
    def cases(files):
        return sum(len(re.findall(r"^\s*(?:it|test)\(", f.read_text(), re.M)) for f in files)
    return len(unit), cases(unit), len(e2e), cases(e2e)
