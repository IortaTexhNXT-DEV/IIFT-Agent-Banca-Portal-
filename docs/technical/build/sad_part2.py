"""Solution Architecture, chapters 7 to 13 and appendices: integration, security,
deployment, sizing, non-functional design, technology stack and decisions."""

import source_facts as facts
from tech_kit import PRODUCT, brand, price  # noqa: F401

# Cloud services, reference sizing and the one-off/monthly figures come from the proposal's
# pricing data (docs/proposal/build/pricing_data.py), so this document cannot drift from it.
CLOUD_ITEMS = list(zip(price.CLOUD_MONTHLY_ITEMS, price.CLOUD_SIZING))

OUTBOUND = [
    ["CORE", "AGENT_UPSERT", "POST /agents", "Agent registration, profile update or status change approved"],
    ["CORE", "PARTICIPANT_UPSERT", "POST /participants", "Participant update approved"],
    ["CORE", "POLICY_ISSUED", "POST /policies", "Policy issued: directly, after referral approval or after payment "
     "verification"],
    ["CORE", "POLICY_ENDORSED", "POST /policies/endorsements", "Endorsement approved"],
    ["CORE", "POLICY_CANCELLED", "POST /policies/cancellations", "Cancellation approved"],
    ["CORE", "CLAIM_NOTIFIED", "POST /claims", "Claim notification submitted"],
    ["FINANCE", "RECEIPT_POSTED", "POST /receipts", "Payment verified and receipt issued"],
    ["FINANCE", "REFUND_REQUESTED", "POST /refunds", "Cancellation approved with a refund due"],
    ["FINANCE", "COMMISSION_ACCRUED", "POST /commissions", "Commission accrued at issuance"],
    ["FINANCE", "EOD_POSTING", "POST /eod-postings", "End-of-day run completed"],
]

SYNCHRONOUS = [
    ["FIN", "GET /receipts/posted?date=", "Reconciliation in live mode", "Receipt references posted for a date"],
    ["AML provider", "POST /screen", "Agent or participant screening (when AML_API_BASE_URL is set)",
     "Name, identification number, date of birth, nationality; returns matches with scores"],
    ["SMS gateway", "POST /messages", "Notification dispatcher", "Sender id, mobile number, text up to 480 characters"],
    ["SMTP relay", "SMTP, STARTTLS required", "Notification dispatcher", "Message with optional attachments"],
    ["Active Directory", "LDAP bind and search", "Back-office sign-in of DIRECTORY users",
     "Service bind, user search with escaped filter, user bind"],
]

INBOUND = [
    ["PUT /api/v1/integration/agents/{agentCode}/status", "Core", "INT-02", "{status, reason}; status ACTIVE, "
     "INACTIVE, SUSPENDED or TERMINATED", "Updates the agent and its user; ends all sessions of a deactivated agent"],
    ["GET /api/v1/integration/policies?issuedOn=YYYY-MM-DD", "Core, FIN", "INT-09", "Business date",
     "Policies issued that day with product, participant, agent, agency, amounts and dates"],
    ["POST /api/v1/integration/commissions/paid", "FIN", "INT-05", "items: list of {policyNo, agentCode, paidOn}, up to "
     "1,000 items", "Marks commissions PAID; returns updated count and unmatched items"],
]

SECURITY_CONTROLS = [
    ["Passwords", "Argon2id (19 MiB memory, 2 iterations, parallelism 1). Policy: 12+ characters, upper, lower, digit, "
     "symbol, must not contain the user name, last 5 not reusable, 90-day expiry, forced change after reset. All "
     "values are parameters.", "AP-02, NFR-09"],
    ["Lockout", "5 failed attempts lock the account for 30 minutes (parameters); unknown user names take the same "
     "time to reject; every success, failure and lock is audited; administrators can unlock.", "AP-04"],
    ["Sessions", "Server-side in PostgreSQL; cookie HttpOnly, Secure, SameSite=Strict, path /; id regenerated at "
     "sign-in; idle timeout 15 minutes and absolute 8 hours (parameters); single active session option; sign-out "
     "and password change revoke sessions on the server.", "AP-03"],
    ["CSRF", "Synchroniser token: 32 random bytes created at sign-in, held in the session, returned to the SPA and "
     "required in X-CSRF-Token on every state-changing request; compared in constant time.", "NFR-14"],
    ["Authorisation", f"{facts.permission_count()} permission codes grouped into configurable roles; portal and "
     "back-office permissions cannot be mixed in one role; every route declares its audience and permissions; "
     "deny by default.", "AP-59, BO-02, NFR-10"],
    ["Data scope", "Back-office: all records. Portal users with agency-wide permission: their agency or bank. Main "
     "agents: themselves and sub-agents two levels down. Others: own records. Applied in every portal query.",
     "AP-09, AP-12, COM-02"],
    ["Maker-checker", "Maker cannot approve own request; one person cannot approve two levels; remarks on rejection; "
     "levels fixed at submission.", "BO-17, COM-04"],
    ["In transit", "TLS 1.2 or later at the load balancer or nginx with HSTS; TLS to PostgreSQL (sslmode=require), "
     "STARTTLS to SMTP, LDAPS, HTTPS to all APIs.", "NFR-08, COM-10"],
    ["At rest", "AES-256-GCM for identification numbers and documents with keys outside the database; HMAC-SHA256 "
     "blind index; encrypted volumes and backups (infrastructure).", "COM-01, COM-10, NFR-08"],
    ["Uploads", "Content type from magic bytes (PDF, PNG, JPEG only); MAX_UPLOAD_MB (10 MB) limit; file name "
     "sanitised and extension forced to match content; SHA-256 recorded; ClamAV INSTREAM scan, and the upload fails "
     "if the scanner cannot be reached. CLAMAV_HOST is mandatory in production.", "AP-46, COM-06"],
    ["Rate limiting", "nginx 20 requests/second per IP (burst 40) on /api; API 300 requests/minute per IP; sign-in "
     "and password change 10/minute.", "NFR-14"],
    ["Headers", "helmet on API responses, with X-Frame-Options DENY and a CSP of default-src 'none' and "
     "frame-ancestors 'none'; nginx adds HSTS, CSP (self only, frame-ancestors none), X-Frame-Options DENY, nosniff, "
     "Referrer-Policy and Permissions-Policy; server tokens and x-powered-by removed.", "NFR-14"],
    ["Errors", "Generic message plus correlation id to the client; full details only in server logs.", "NFR-15"],
    ["Logging", "JSON logs; cookie, authorization, CSRF and set-cookie headers redacted; audit values redacted.",
     "NFR-11, NFR-28"],
    ["System APIs", "API key compared by SHA-256 in constant time; only the hash is configured; IP allow-list at "
     "nginx or the firewall; every call logged.", "INT-10"],
    ["Production guard", "The API refuses to start in production with a non-secure cookie, API docs enabled, no "
     "CLAMAV_HOST, or live integration without Core, FIN, SMTP and inbound key settings.", "NFR-14"],
    ["Multi-factor authentication", "E-mail one-time code or authenticator app for back-office users; optional for "
     "portal users. Delivered during implementation.", "NFR-09"],
]

KEYS = [
    ["SESSION_SECRET", "Signs the session cookie", "Rotate yearly or on staff change; all users sign in again"],
    ["FIELD_ENCRYPTION_KEY", "Encrypts identification numbers", "Version prefix v1 in each value; re-encryption "
     "tool for a v2 key delivered during implementation"],
    ["FIELD_HASH_KEY", "Blind index of identification numbers", "Rotation needs every blind index recomputed; same "
     "tool"],
    ["DOCUMENT_ENCRYPTION_KEY", "Encrypts stored files", "Rotation re-encrypts the store; tool delivered during "
     "implementation"],
    ["INBOUND_API_KEY_SHA256", "Hash of the key Core and FIN present", "Rotate yearly; issue new key, update hash, "
     "retire old key"],
    ["CORE/FINANCE/AML/SMS API keys", "Outbound authentication", "Per provider policy"],
    ["SMTP_PASSWORD, LDAP_BIND_PASSWORD", "Relay and directory service accounts", "Per IITH policy"],
    ["Database passwords", "Application and migration roles", "Per IITH policy"],
    ["METRICS_TOKEN", "Protects /metrics", "Yearly"],
]

ENVIRONMENTS = [
    ["DEV", "Development, sprint demos", "iorta (both options)", "1 VM or laptop compose", "Synthetic, demo seed",
     "simulated", "Enabled"],
    ["SIT", "Integration and performance testing", "A: IIFT data centre (iorta until the VM is ready). B: cloud "
     "account", "1 VM, compose; B: 1 task", "Synthetic and masked", "live (test endpoints)", "Enabled"],
    ["UAT", "Acceptance, training, release rehearsal", "A: IIFT data centre. B: cloud account", "1 VM, compose; "
     "B: 1 task, small database", "Masked or migrated", "live (test endpoints)", "Disabled"],
    ["PROD", "Live operation", "A: IIFT/IITH data centre. B: cloud, Malaysia region", "2 app + 2 DB VMs; B: 2 tasks "
     "in 2 zones, Multi-AZ database", "Production", "live", "Disabled"],
    ["DR", "Disaster recovery", "A: IIFT/IITH DR site. B: second cloud region", "1 app + 1 DB VM; B: pilot light",
     "Replica of PROD", "live (on invocation)", "Disabled"],
]

# Who does what under each hosting option. (Area, Option A: IIFT/IITH, Option B: iorta managed services,
# Option B: cloud provider, Option B: IIFT)
SHARED_RESPONSIBILITY = [
    ["Physical facilities, hardware, hypervisor", "IITH", "–", "Provider", "–"],
    ["Network, firewall, load balancer, WAF rules", "IITH (iorta specifies)", "Configure and operate",
     "Managed services", "Approve rules"],
    ["Operating system and container runtime patching", "IITH (OS); iorta (containers)", "Patch in agreed windows",
     "Serverless container platform", "Approve windows"],
    ["PostgreSQL install, replication, backups, PITR", "IITH runs backups; iorta configures", "Configure, verify, "
     "restore tests", "Managed database engine", "Approve restore drills"],
    ["Application deployment and configuration", "iorta under IIFT change control", "iorta under IIFT change "
     "control", "–", "Change approval (CAB)"],
    ["Monitoring and alerting", "IITH (infrastructure); iorta (application)", "24x7 infrastructure and "
     "application", "Platform metrics and logs", "Receive reports and alerts"],
    ["Security monitoring and vulnerability scanning", "IITH SIEM; iorta scans images", "WAF, threat detection, "
     "scans of the estate", "Threat detection service", "Security review; VAPT sponsor"],
    ["Encryption keys and secrets", "IITH vault", "Key management service in IIFT's account", "Key management "
     "service", "Key ownership; access reviews"],
    ["DR site or region and the yearly DR test", "IITH provides; iorta takes part", "Pilot light, replication, "
     "annual drill", "Second region", "Approve the DR region; take part"],
    ["Cloud account, budget and cost control", "–", "Budget alerts, monthly cost report, right-sizing",
     "Billing", "Account holder (optional); approves reserved capacity"],
    ["Regulatory notification (outsourcing, cloud)", "Not needed", "Supporting documents", "Certifications",
     "AMBD notification"],
    ["Data ownership, export and deletion at exit", "IIFT", "Export, deletion certificate", "–", "IIFT"],
]

IMAGES = [
    ["salesverse-api (runtime)", "apps/api/Dockerfile, target runtime", "node:22-bookworm-slim; production "
     "dependencies only; runs as user salesverse under tini; HEALTHCHECK on /health/ready; port 3000; documents at "
     "/data/documents"],
    ["salesverse-api (migrate)", "apps/api/Dockerfile, target migrate", "One-off job: prisma migrate deploy, then "
     "the reference-data seed (idempotent)"],
    ["salesverse-web", "apps/web/Dockerfile", "Vite build served by nginxinc/nginx-unprivileged 1.29 on port 8080 "
     "with security headers, CSP, rate limiting and /api proxy"],
    ["clamav", "clamav/clamav:stable", "clamd for upload scanning, port 3310, internal only"],
    ["PostgreSQL 16", "postgres:16-alpine (DEV, SIT, UAT); OS packages on the PROD database VMs", "Streaming "
     "replication and pgBackRest on PROD"],
]

PIPELINE = [
    ["Verify", "npm ci; prisma generate; prettier check; oxlint; tsc type check; API and web unit tests; end-to-end "
     "API tests against a PostgreSQL 16 service; production build; npm audit (moderate and above); CycloneDX SBOM of "
     "production dependencies kept as a build artifact", "Running (.github/workflows/ci.yml)"],
    ["Images", "Build API and web images; Trivy scan fails on unfixed CRITICAL or HIGH findings", "Running"],
    ["Static analysis and secrets", "CodeQL (JavaScript and TypeScript, security-extended queries) and a gitleaks "
     "secret scan of the full git history on every push and pull request", "Running"],
    ["Package", "Tag images with the release version, sign them, attach the SBOM and release notes, push to the "
     "IITH registry", "Delivered during implementation"],
    ["Deploy SIT and UAT", "Run the migrate job, roll out containers, smoke tests", "Delivered during implementation"],
    ["Deploy PROD", "After IIFT change approval, in the agreed window, same images as UAT", "Delivered during "
     "implementation"],
]

PORTS = [
    ["Internet", "External WAF / load balancer", "443/tcp", "HTTPS for /portal, /esign, /api (80 redirects)"],
    ["IIFT internal network", "Internal load balancer", "443/tcp", "HTTPS for /backoffice and /api"],
    ["Core and FIN hosts", "Internal load balancer", "443/tcp", "/api/v1/integration (IP allow-list)"],
    ["Load balancers", "App VMs (web container)", "8080/tcp", "HTTP inside the zone, or TLS re-encryption if IITH "
     "policy requires"],
    ["Web container", "API container", "3000/tcp", "Same host network; not exposed outside the VM"],
    ["Load balancers, monitoring", "App VMs", "3000/tcp", "/health/live, /health/ready, /metrics (bearer token); "
     "published on the VM's internal interface by the production compose override"],
    ["App VMs", "PostgreSQL VIP / primary", "5432/tcp", "TLS, application role"],
    ["App VMs", "Document store (NFS)", "2049/tcp", "NFSv4, export restricted to app VMs"],
    ["App VMs", "SMTP relay", "587/tcp", "STARTTLS"],
    ["App VMs", "Active Directory", "636/tcp", "LDAPS"],
    ["App VMs", "Core and FIN APIs", "443/tcp", "HTTPS"],
    ["App VMs", "Egress proxy to SMS gateway and AML provider", "443/tcp", "HTTPS, destination allow-list"],
    ["DB primary", "DB standby (local and DR)", "5432/tcp", "Streaming replication, TLS"],
    ["DB VMs", "Backup repository", "22/tcp", "pgBackRest over SSH"],
    ["Primary site", "DR site", "22/tcp", "Document rsync, backup copy"],
    ["Monitoring", "All VMs", "9100/tcp, 9187/tcp", "node_exporter and postgres_exporter"],
    ["Administrators (bastion)", "All VMs", "22/tcp", "SSH with keys, from the bastion only"],
    ["All VMs", "IITH NTP and DNS", "123/udp, 53", "Time and name resolution"],
]

ADR = [
    ["Modular monolith", "Microservices; modular monolith", "Small user base and volume; one deployment and one "
     "database transaction per operation; module boundaries keep a later split possible."],
    ["PostgreSQL 16", "PostgreSQL; MongoDB; SQL Server", "Relational, financial data with ACID across tables; no "
     "licence fee; mature replication and PITR; JSONB where flexibility is needed (section 6.2)."],
    ["Prisma 7 with the pg driver adapter", "Prisma; TypeORM; Knex; hand-written SQL", "Typed queries generated from "
     "one schema; parameterised by construction; versioned SQL migrations reviewed in code review."],
    ["Server-side sessions", "Sessions in PostgreSQL; JWT in browser storage", "Revocable at once (sign-out, lockout, "
     "deactivation, password change); no tokens readable by scripts; no extra session store."],
    ["Synchroniser CSRF token with SameSite=Strict", "Synchroniser token; double-submit cookie; SameSite only",
     "Token bound to the server session and checked in constant time; SameSite gives a second layer."],
    ["Argon2id", "Argon2id; bcrypt; PBKDF2", "Current OWASP recommendation; memory-hard; native implementation "
     "without build tools."],
    ["Application-level field encryption with blind index", "Disk encryption only; pgcrypto; application "
     "encryption", "Keys never reach the database server; database administrators and backups see ciphertext; exact "
     "search and uniqueness still work."],
    ["Transactional outbox", "Synchronous calls; message broker; outbox table", "A message exists exactly when the "
     "business change commits; retries survive restarts; no broker to run for this volume."],
    ["In-process jobs with advisory locks", "Separate scheduler; Redis queue; in-process with locks", "No extra "
     "component; one runner across replicas; lock released if a process dies."],
    ["Encrypted files on a mounted volume", "Database BLOBs; object storage; encrypted volume", "Keeps the database "
     "small; works on NFS on-premise and EFS or Azure Files in the cloud; S3 adapter possible later."],
    ["React SPA with Ant Design", "React SPA; server-rendered pages; Angular", "Large talent pool; accessible "
     "component library; one code base for portal and back-office."],
    ["Business parameters in the database", "Environment variables; database parameters", "Operations staff change "
     "policy values without a release, within ranges, with audit."],
    ["Generic workflow engine with handlers", "Per-feature approval code; BPMN engine; generic engine",
     "Eight approval types share one inbox, rule set and history; a BPMN engine would add a product to operate."],
    ["Watch-list screening built in, external provider optional", "External only; built in only; both", "Compliance "
     "can screen from day one with UN and local lists; a commercial provider can be added by configuration; an "
     "unavailable provider forces manual review."],
    ["PostgreSQL sequences for reference numbers", "Sequences; counter table with row locks", "No lock contention "
     "across replicas; gaps are acceptable for these references."],
    ["Optimistic locking", "Pessimistic locks; version column", "Short web transactions; clear STALE_RECORD message "
     "instead of blocking users."],
    ["Simulated and live integration modes", "Live only; switchable mode", "Build and test end to end before IITH "
     "endpoints exist; production start-up checks the live settings."],
    ["Manual database promotion on PROD", "Automatic failover; manual promotion", "Two database nodes cannot form a "
     "safe quorum; a runbook promotion within the 4-hour RTO avoids split-brain."],
    ["JSON logs and Prometheus metrics", "Vendor APM agent; open formats", "Works with IITH's existing log and "
     "monitoring tools; no agent licence."],
]

STACK = [
    ("Runtime", [("Node.js", "22 LTS (.nvmrc 22, engines >=22.12)", "API runtime"), ("npm", None, "workspaces")]),
    ("API", [("@nestjs/core", "@nestjs/core", "Application framework"), ("@nestjs/schedule", "@nestjs/schedule",
                                                                         "Scheduled jobs"),
             ("@nestjs/throttler", "@nestjs/throttler", "Rate limiting"), ("@nestjs/swagger", "@nestjs/swagger",
                                                                          "OpenAPI"),
             ("class-validator", "class-validator", "DTO validation"), ("typescript", "typescript", "Language")]),
    ("Data", [("PostgreSQL", "16", "Database"), ("prisma / @prisma/client", "prisma", "ORM and migrations"),
              ("@prisma/adapter-pg, pg", "pg", "Driver")]),
    ("Security", [("express-session", "express-session", "Sessions"), ("connect-pg-simple", "connect-pg-simple",
                                                                       "Session store"),
                  ("@node-rs/argon2", "@node-rs/argon2", "Password hashing"), ("helmet", "helmet",
                                                                               "Security headers"),
                  ("ldapts", "ldapts", "Directory sign-in")]),
    ("Output and messaging", [("pdfkit", "pdfkit", "PDF documents"), ("exceljs", "exceljs", "Excel exports"),
                              ("nodemailer", "nodemailer", "E-mail")]),
    ("Observability", [("nestjs-pino / pino", "pino", "JSON logging"), ("prom-client", "prom-client", "Metrics")]),
    ("Front end", [("react", "react", "UI library"), ("antd", "antd", "Components"),
                   ("@tanstack/react-query", "@tanstack/react-query", "Server state"),
                   ("react-router", "react-router", "Routing"), ("recharts", "recharts", "Charts"),
                   ("vite", "vite", "Build tool")]),
    ("Quality", [("vitest", "vitest", "Unit, component and API tests"), ("supertest", "supertest", "HTTP tests"),
                 ("@testing-library/react", "@testing-library/react", "Web component tests"),
                 ("oxlint", "oxlint", "Linting"), ("prettier", "prettier", "Formatting")]),
    ("Delivery", [("Docker images", "node:22-bookworm-slim, nginx-unprivileged 1.29", "Containers"),
                  ("GitHub Actions / GitLab CI", "ci.yml", "Pipeline"), ("CodeQL", "v3 action", "Static analysis"),
                  ("gitleaks", "8.21.2", "Secret scan"), ("Trivy", "0.28 action", "Image scan")]),
]


def integration(w, figs):
    w.h1("Integration Architecture")
    w.h2("Approach")
    w.para("Outbound business events to the core and financial systems use a transactional outbox. Calls that need an "
           "answer at once (AML screening, directory sign-in, FIN posted receipts) are synchronous with timeouts. "
           "E-mail and SMS go through the notification table and its own dispatcher. Core and FIN call the portal "
           "through a small set of API-key-protected endpoints. Every call in either direction is written to "
           "integration_log, which feeds the integration monitor (INT-11, INT-14).")
    w.figure(figs["integration"], "Outbox delivery, retry and dead-letter", width_cm=16.0)
    w.h2("Delivery guarantees")
    w.bullets([
        "**Atomic capture.** The outbox row is inserted in the same transaction as the business change, so a message "
        "is never lost and never sent for a change that rolled back.",
        "**At-least-once delivery with idempotency.** The outbox id is sent as the Idempotency-Key header, unless "
        "the payload carries its own business key (EOD postings), which is sent instead; the receiver must ignore a "
        "key it has already processed. This is part of the interface specification.",
        "**Retry with back-off.** Connection errors, timeouts, HTTP 5xx, 408 and 429 are retried after 1, 2, 4, 8 "
        "... minutes, capped at 60 minutes. Other 4xx responses mean the message is wrong and go straight to "
        "dead-letter.",
        "**Dead-letter and alert.** After integration.max_attempts attempts (6 by default) the message becomes DEAD "
        "and every holder of bo.integration.manage receives an e-mail. The integration monitor shows the message and "
        "error; Retry resets it to PENDING.",
        "**Ordering.** Due messages are taken oldest first in batches of 25 by a single dispatcher (advisory lock), "
        "so events for one record are delivered in order unless one of them is retrying.",
        "**Timeouts.** Each endpoint has its own timeout (15 seconds by default).",
    ])
    w.h2("Outbound operations")
    w.table(["System", "Operation", "Endpoint (base URL from configuration)", "Raised when"], OUTBOUND,
            widths=[2.0, 4.0, 5.0, 6.0], font_size=8, caption="Outbox operations")
    w.table(["System", "Call", "Used by", "Content"], SYNCHRONOUS, widths=[2.6, 3.8, 4.8, 5.8], font_size=8,
            caption="Synchronous and notification calls")
    w.para("Endpoint paths, payload fields and the FIN interface file layout shown here are the working defaults. "
           "They are confirmed or mapped to IITH's formats in the Interface Specification (DEL-09) during design.")
    w.h2("Inbound system APIs")
    w.table(["Endpoint", "Caller", "RFP", "Input", "Effect"], INBOUND, widths=[5.0, 1.6, 1.4, 4.2, 4.8],
            font_size=8, caption="Inbound endpoints")
    w.para("Callers present x-api-key. The API holds only the SHA-256 of the key (INBOUND_API_KEY_SHA256) and "
           "compares in constant time; if no hash is configured the endpoints answer 503. nginx or the firewall "
           "restricts /api/v1/integration to the Core and FIN host addresses. Each call is logged as INBOUND with its "
           "outcome and duration.")
    w.h2("End-of-day and reconciliation")
    w.para("At 23:30 Brunei time (EOD_CRON) the end-of-day job selects policies issued and receipts issued during the "
           "business day and, in one transaction, stores the EOD issuance report (Excel: summary by product, policies "
           "issued, receipts), stores the FIN interface file (CSV: one PI line per policy and one RC line per receipt "
           "with amounts in BND), queues an EOD_POSTING message with the day's totals and records the run. It then "
           "reconciles receipts: in live mode against the receipt references FIN reports as posted for that date; in "
           "simulated mode against RECEIPT_POSTED messages delivered from the outbox. The result is MATCHED or "
           "MISMATCH with the unmatched receipt numbers. Finance can re-run EOD for any past date from the "
           "back-office; the eod_run row for the date is updated, not duplicated. Each posting carries a revision "
           "number, the idempotency key EOD-<date>-R<n> and replacesPreviousRevision (true from the second revision). "
           "The dispatcher sends that key to FIN, so FIN can reject a repeated delivery of the same revision and "
           "replace the earlier revision for the date; the interface specification sets out this behaviour.")
    w.h2("Simulated and live modes")
    w.para("INTEGRATION_MODE=simulated records every outbound message and marks its reference as simulated without "
           "calling external systems, so the full flow can be built and tested before IITH endpoints exist. In live "
           "mode the configured endpoints are called; a production instance in live mode refuses to start without "
           "the Core, FIN, SMTP and inbound key settings. E-mail and SMS are sent only when SMTP_HOST and "
           "SMS_API_BASE_URL are set, independent of the mode.")


def security(w, figs):
    w.h1("Security Architecture")
    w.para("Controls are layered so that no single failure exposes data. They are aligned with OWASP ASVS Level 2 and "
           "the OWASP Top 10, the Brunei Personal Data Protection Order 2025 and AMBD technology-risk expectations. "
           "The Security Assessment Report records the test evidence.")
    w.figure(figs["security"], "Defence in depth", width_cm=15.5)
    w.h2("Control catalogue")
    w.table(["Control", "Implementation", "RFP"], SECURITY_CONTROLS, widths=[2.8, 11.6, 2.6], font_size=8,
            bold_first_col=True, caption="Security controls")
    w.h2("Roles")
    rows = [[code, name, audience.title().replace("Backoffice", "Back-office"), description]
            for code, name, audience, description in facts.roles()]
    w.table(["Code", "Role", "Audience", "Purpose"], rows, widths=[4.2, 4.2, 2.0, 6.6], font_size=8,
            caption="Default roles (seed data, editable in the back-office)")
    w.h2("Keys and secrets")
    w.para("All secrets are supplied as environment variables from the platform's secret store (HashiCorp Vault or "
           "the IITH equivalent on-premise; AWS Secrets Manager or Azure Key Vault in the cloud) and never stored in "
           "the repository or images. Encryption keys are 256-bit random values, base64 encoded; the API checks "
           "their length at start-up.")
    w.table(["Secret", "Purpose", "Rotation"], KEYS, widths=[4.8, 5.2, 7.0], font_size=8, caption="Secrets")
    w.h2("Security testing")
    w.bullets([
        "End-to-end tests cover authentication, access control across audiences and data scopes, and the policy "
        "lifecycle against a real database on every CI run.",
        "tools/security/security-checks.mjs runs repeatable OWASP Top 10 checks against a test environment before "
        "each release.",
        "CI runs CodeQL (security-extended queries) and a gitleaks secret scan of the full history on every push "
        "and pull request, and blocks a release on moderate or higher npm audit findings and on unfixed critical or "
        "high container image findings.",
        "An independent VAPT is performed before go-live; no critical or high finding may remain open (NFR-13).",
    ])


def deployment(w, figs):
    w.h1("Deployment Architecture")
    w.para(f"{PRODUCT} ships as container images and runs unchanged in the IIFT/IITH data centre or in a cloud "
           "account. The two deployment models match the commercial options of the proposal: Option A, on-premise "
           "on infrastructure that IIFT procures to the sizing in chapter 10, under a perpetual licence; and "
           "Option B, hosted and managed by iorta in a cloud account dedicated to IIFT, under a subscription. A "
           "hybrid variant of Option A keeps all data on-premise and places only the portal's web tier at the edge. "
           "Option C of the proposal (source code handover) does not change the deployment; the Production Support "
           "Handover describes that transition.")
    w.h2("Environments")
    w.table(["Env.", "Purpose", "Hosted by", "Shape", "Data", "Integration", "API docs"], ENVIRONMENTS,
            widths=[1.2, 3.0, 3.6, 3.2, 2.2, 2.2, 1.6], font_size=7.5, bold_first_col=True, caption="Environments")
    w.para("Every environment runs the same images; only configuration differs. Promotion is DEV to SIT to UAT to "
           "PROD, and nothing reaches PROD that has not passed UAT. DEV stays with iorta under both options.")
    w.h2("Option A: on-premise high availability (recommended)")
    w.para("Two application VMs sit behind an external WAF and load balancer pair for internet users and an internal "
           "load balancer for staff and IITH systems. Each application VM runs the web, API and ClamAV containers. "
           "PostgreSQL runs natively on a primary VM with a hot standby fed by streaming replication. Documents are "
           "on an NFS share mounted by both application VMs. Losing one application VM leaves the service running; "
           "losing the database primary is handled by promoting the standby. IIFT procures the servers, storage, "
           "network and DR capacity to the sizing in chapter 10 (the proposal's bill of materials lists the same "
           "items); IITH operates the infrastructure and iorta installs, configures and supports the application "
           "and database under the maintenance agreement.")
    w.figure(figs["on_prem"], "Option A: on-premise deployment", width_cm=16.0)
    w.h3("Hybrid variant of Option A")
    w.para("The back-office, API, database and documents stay in the IITH data centre; only the web tier for "
           "internet users (nginx with the SPA) runs in the DMZ or at a cloud edge and forwards /api calls over a "
           "private encrypted link. Personal data never leaves the data centre, so no cloud outsourcing step is "
           "needed. It is sized and priced as Option A; any edge hosting is at actuals.")
    w.h2("Option B: iorta-hosted cloud")
    w.para(f"iorta hosts and operates the solution in a cloud account dedicated to IIFT in {price.CLOUD_REGION}, "
           f"with production across two availability zones and a pilot-light DR environment in {price.CLOUD_DR_REGION}. "
           "The account may be held by iorta and recharged at cost, or held by IIFT in its own name with iorta "
           "operating it through delegated access; the design is the same. The AWS reference design is shown below "
           "and the Azure equivalent is listed in the table.")
    w.figure(figs["cloud"], "Option B: cloud reference deployment (AWS Asia Pacific (Malaysia))", width_cm=16.0)
    w.table(["Component", "AWS Asia Pacific (Malaysia)", "Azure Malaysia West"], [
        ["Edge", "Application Load Balancer, AWS WAF with managed OWASP rules, ACM certificate",
         "Application Gateway with WAF"],
        ["Containers", "ECS Fargate, 2 tasks in 2 availability zones", "Container Apps or AKS, 2 replicas in 2 zones"],
        ["Database", "RDS for PostgreSQL 16, Multi-AZ, 35-day backups and PITR",
         "Azure Database for PostgreSQL flexible server, zone-redundant HA"],
        ["Documents", "Amazon EFS, encrypted, mounted at /data/documents", "Azure Files, encrypted"],
        ["Backups and exports", "S3 with SSE-KMS, replicated to the DR region", "Blob Storage, geo-redundant"],
        ["Secrets and keys", "Secrets Manager and KMS (customer-managed keys)", "Key Vault"],
        ["Monitoring and security", "CloudWatch logs, metrics, alarms; GuardDuty; Security Hub",
         "Azure Monitor, Log Analytics, Defender for Cloud"],
        ["Connectivity", "Site-to-site VPN to the IITH data centre (Direct Connect optional)",
         "VPN Gateway (ExpressRoute optional)"],
        ["DR", "Cross-region read replica, replicated S3, standby task definitions in the second region",
         "Geo-replica, geo-redundant storage, standby revision in the second region"],
    ], widths=[3.0, 7.4, 6.6], font_size=8, bold_first_col=True, caption="Cloud services by provider")
    w.h3("Landing zone")
    w.para("The one-off cloud set-up in the proposal builds the landing zone before the environments: a dedicated "
           "account (or subscription) for IIFT with no other tenant; separate production and non-production "
           "networks (VPC or VNet) with public subnets for the load balancer only and private subnets for tasks and "
           "databases; identity with named administrators, multi-factor authentication, least-privilege roles and "
           "no long-lived access keys; customer-managed encryption keys for database, storage and backups; central "
           "logging with 90-day retention and an immutable audit trail of console and API activity; the site-to-site "
           "VPN to the IITH data centre; a private container registry; and the security baseline (CIS benchmark "
           "checks, threat detection, vulnerability scanning) with alerts to the managed services roster. "
           "Everything is defined as infrastructure code held in the repository, so the estate can be rebuilt in "
           "the DR region or handed to IIFT.")
    w.h3("Environments and DR region")
    w.para("PROD runs two tasks across two availability zones with a Multi-AZ managed database. UAT is a single task "
           "with a small single-zone database, stopped outside test periods; SIT is the same shape during the "
           "project. The DR environment in the second region is a pilot light: a cross-region database replica, "
           "replicated backups and documents, and standby task definitions scaled from zero. Invocation promotes the "
           "replica, scales the tasks up and switches DNS; the Production Support Handover gives the procedure and "
           "the yearly drill. RPO and RTO are the same as for Option A (chapter 10).")
    w.h3("Cost controls")
    w.bullets([
        "Cloud charges are recharged at the provider's cost without mark-up, or paid by IIFT directly when it holds "
        "the account; the estimate in chapter 10 is for budgeting.",
        "Budget alerts at 80% and 100% of the monthly estimate go to iorta and the IIFT application owner.",
        "A monthly cost report by service and environment accompanies the monthly service report.",
        "A quarterly right-sizing review adjusts task sizes, database class and storage tiers; reserved capacity is "
        "bought only with IIFT's approval, and the saving passes to IIFT.",
        "Non-production environments are stopped outside test periods; log retention and backup lifecycle rules "
        "are enforced by policy.",
    ])
    w.h3("Shared responsibility")
    w.table(["Area", "Option A: IIFT / IITH and iorta", "Option B: iorta managed services", "Option B: cloud "
             "provider", "Option B: IIFT"], SHARED_RESPONSIBILITY, widths=[3.6, 3.6, 3.6, 3.0, 3.2], font_size=7.5,
            bold_first_col=True, caption="Shared responsibility by option")
    w.para("Under Option B the managed services cover 24x7 infrastructure and availability monitoring, patching in "
           "agreed windows, backups with monthly restore tests and the yearly DR drill, security monitoring of the "
           "cloud estate, capacity and cost management with a monthly report, and infrastructure incident response "
           "with the cloud provider. The scope and fee are in the proposal; the operating model is in the Production "
           "Support Handover.")
    w.h3("Data residency and regulatory notification")
    w.para("Under Option B, personal data of agents, participants and staff is stored in Malaysia with copies in the "
           "DR region, encrypted at rest with keys held in IIFT's account and in transit with TLS; back-office "
           "traffic and the Core, FIN, AD and SMTP integrations run over the VPN to the IITH data centre. Cloud "
           "hosting is an outsourcing arrangement for IIFT: IIFT approves the regions and makes the AMBD outsourcing "
           "and cloud notification before production data is loaded, and iorta provides the supporting material "
           "(this architecture, the control catalogue in chapter 8, the exit plan and the provider's "
           "certifications). A Brunei-hosted alternative can be designed on request. Option A needs no such step.")
    w.h2("Disaster recovery")
    w.figure(figs["dr"], "Disaster recovery topology", width_cm=15.5)
    w.para("Under Option A the DR site holds an asynchronous PostgreSQL replica, a copy of the document store "
           "refreshed every 15 minutes, copies of the backups, and a cold application VM with the current images. "
           "Invocation promotes the replica, mounts the document copy, starts the containers with DR configuration "
           "and moves DNS or the load-balancer VIP. Under Option B the same pattern spans two regions with managed "
           "services. The Production Support Handover gives the step-by-step procedure and the test schedule.")
    w.h2("Container images")
    w.table(["Image", "Source", "Notes"], IMAGES, widths=[4.0, 4.8, 8.2], font_size=8, caption="Images")
    w.para("Docker Compose (deploy/docker-compose.yml) runs the full stack on one host for DEV, SIT and UAT, and the "
           "web, API and ClamAV services on each production application VM, with the database on dedicated VMs. "
           "ECS task definitions (or the Azure equivalent) and the landing-zone infrastructure code are produced "
           "during implementation if IIFT selects Option B.")
    w.h2("Build and release pipeline")
    w.figure(figs["cicd"], "Build and release pipeline", width_cm=16.0)
    w.table(["Stage", "Activities", "Status"], PIPELINE, widths=[3.2, 9.8, 4.0], font_size=8,
            caption="Pipeline stages")
    w.para("Database changes follow expand-and-contract: a release first adds columns or tables that the previous "
           "version ignores, and removes old structures only in a later release. The previous images therefore run "
           "on the new schema, so an application rollback does not need a database restore.")


def sizing(w):
    w.h1("Infrastructure Sizing")
    w.h2("Load assumptions")
    w.para("Appendix 1 lists 26 named users: 12 bank portal users, 5 IIFT back-office users, 5 IIFT portal users and "
           "4 agent portal users. The design target is 100 concurrent and 500 named users without redesign. "
           "Appendix 2 gives the policy volumes below.")
    rows = [[p, lob, str(a), str(b), str(c)] for p, lob, a, b, c in facts.APPENDIX2]
    rows.append(["Total", "", str(facts.BASE_2025), str(sum(r[3] for r in facts.APPENDIX2)), str(facts.TARGET_5Y)])
    w.table(["Product", "Line", "2025", "2026 to July", "In 5 years"], rows, widths=[7.4, 3.2, 1.8, 2.4, 2.2],
            font_size=8, align_right_cols=(2, 3, 4), total_rows=1, caption="Appendix 2 policy volumes per year")
    per_year = facts.policies_per_year()
    w.para(f"Growing from {facts.BASE_2025} policies in 2025 to {facts.TARGET_5Y} a year in five years is "
           f"{facts.GROWTH * 100:.1f}% a year. The sizing uses that rate from go-live: "
           + ", ".join(f"{y}: {n}" for y, n in per_year.items())
           + f". Every figure is then multiplied by {facts.HEADROOM} for headroom, which also covers the target of "
           "100 concurrent users. At this scale the limiting factor is availability, not capacity.")
    w.h2("On-premise servers (Option A, procured by IIFT)")
    w.para("IIFT procures the capacity below, or allocates it on the IITH virtualisation platform, before SIT (the "
           "SIT VM) and before UAT (the rest). The proposal's bill of materials repeats this table with indicative "
           "costs and is checked against it when the proposal is built.")
    w.table(["Server", "Qty", "vCPU", "RAM", "Storage", "Software"], [
        ("GROUP", "Production"),
        ["WAF / load balancer", "2 (or existing)", "2", "4 GB", "–", "IITH appliance or HAProxy/nginx pair"],
        ["Application VM", "2", "4", "8 GB", "100 GB", "Linux, Docker Engine; web, api, clamav containers"],
        ["Database VM", "2", "4", "16 GB", "200 GB SSD", "PostgreSQL 16 primary and hot standby, pgBackRest"],
        ["Document store", "1 share", "–", "–", "500 GB", "NFS export, encrypted volume"],
        ["Backup repository", "1", "–", "–", "1 TB", "pgBackRest repository, document backups"],
        ["Monitoring", "1 (or existing)", "2", "4 GB", "100 GB", "Prometheus, Grafana, log collector"],
        ("GROUP", "Non-production"),
        ["SIT", "1", "4", "16 GB", "200 GB", "Compose: web, api, clamav, PostgreSQL"],
        ["UAT", "1", "4", "16 GB", "200 GB", "Compose: web, api, clamav, PostgreSQL"],
        ("GROUP", "DR site"),
        ["Application VM", "1", "4", "8 GB", "100 GB", "Cold standby, same images"],
        ["Database VM", "1", "4", "16 GB", "200 GB SSD", "Asynchronous replica"],
        ["Document and backup copies", "–", "–", "–", "500 GB + 1 TB", "rsync target, backup copy"],
    ], widths=[3.6, 2.2, 1.2, 1.4, 2.4, 6.2], font_size=8, caption="On-premise sizing (Option A)")
    w.para("Operating system: Red Hat Enterprise Linux 9 or Ubuntu 24.04 LTS, hardened to the IITH baseline. "
           "Each application VM has spare capacity for a second API container if load grows. ClamAV needs about "
           "1.5 GB of memory for its signature database, which is included.")
    w.h2("Cloud services (Option B)")
    w.para("The reference sizing below is the basis of the cloud infrastructure estimate in the proposal; both are "
           "read from the same source. Charges are recharged at the provider's cost, or paid by IIFT directly, and "
           f"move with usage and exchange rates. The estimate is about {price.bnd(price.cloud_monthly())} a month "
           f"for the production run (UAT and the DR pilot light included), plus scaled-down project environments "
           f"for {price.CLOUD_IMPLEMENTATION_MONTHS} months before go-live; the one-off set-up and the managed "
           "services fee are in the proposal.")
    rows = [[service, sizing, price.bnd(monthly)] for (service, _, monthly), sizing in CLOUD_ITEMS]
    rows.append(["Total per month", "", price.bnd(price.cloud_monthly())])
    rows.append(["Total per year", "", price.bnd(price.cloud_annual())])
    w.table(["Service", "Reference sizing", "Estimate B$ / month"], rows, widths=[6.0, 8.4, 2.6], font_size=8,
            align_right_cols=(2,), total_rows=2, caption="Option B cloud sizing and estimate (recharged at cost)")
    w.para("ClamAV runs as a sidecar in each task (1 GB) or as a small shared service. The document share is expected "
           "to stay under 100 GB in five years and object storage under about 200 GB with backups and exports "
           "(sections 10.5 and 10.6). RPO and RTO targets are unchanged: the Multi-AZ database fails over "
           "automatically within the region, and the DR region holds a cross-region replica.")
    w.h2("Database sizing")
    w.para("Rows per issued policy were estimated from how the application writes data: quotations not taken up, "
           "policy history, documents, payments, approvals, notifications, outbox messages, integration log entries "
           "and audit rows. Index overhead is added at 60%.")
    rows = [[t, f"{m:g}", f"{s:,}", note] for t, m, s, note in facts.PER_POLICY]
    w.table(["Table", "Rows per policy", "Bytes per row", "Basis"], rows, widths=[4.0, 2.6, 2.6, 7.8], font_size=7.5,
            padding=25, align_right_cols=(1, 2), caption="Sizing basis")
    rows = [[str(y), f"{n:,}", f"{c:,}", f"{ym:,.0f} MB", f"{tot:,.0f} MB", f"{head / 1024:,.1f} GB"]
            for y, n, c, ym, tot, head in facts.database_sizing()]
    w.table(["Year", "Policies", "Cumulative", "Growth", "Database size", f"×{facts.HEADROOM} headroom"], rows,
            widths=[1.8, 2.4, 2.8, 2.8, 3.4, 3.8], font_size=8.5, align_right_cols=(1, 2, 3, 4, 5),
            caption="Database growth")
    final = facts.database_sizing()[-1]
    w.para(f"After five years the database holds about {final[4]:,.0f} MB, or {final[5] / 1024:,.1f} GB at ten "
           "times the volume. The 200 GB database volume therefore leaves room for WAL, temporary files, local "
           "backups and growth well beyond the contract. PostgreSQL settings: shared_buffers 4 GB, "
           "effective_cache_size 12 GB, max_connections 100 (two API instances use at most 30), "
           "wal_level replica, archive_timeout 300 seconds.")
    w.h2("Document storage")
    per_policy, doc_rows = facts.document_sizing()
    rows = [[label, f"{n:g}", f"{size:.2f} MB"] for label, n, size in facts.DOC_PER_POLICY_MB]
    rows.append(["Per issued policy", "", f"{per_policy:.2f} MB"])
    w.table(["Item", "Files", "Average size"], rows, widths=[11.0, 2.0, 4.0], font_size=8, align_right_cols=(1, 2),
            total_rows=1, caption="Document volume per policy")
    rows = [[str(y), f"{g:.1f} GB", f"{t:.1f} GB", f"{h:.0f} GB"] for y, g, t, h in doc_rows]
    w.table(["Year", "Added", "Cumulative", f"×{facts.HEADROOM} headroom"], rows, widths=[3.0, 4.6, 4.6, 4.8],
            font_size=8.5, align_right_cols=(1, 2, 3), caption="Document store growth")
    w.para(f"Including {facts.DOC_FIXED_PER_YEAR_MB} MB a year for EOD reports, FIN files, scheduled reports and agent, "
           "claim and issue documents, the store reaches about "
           f"{doc_rows[-1][2]:.0f} GB in five years and {doc_rows[-1][3]:.0f} GB with headroom, inside the 500 GB "
           "share.")
    w.h2("Backup, RPO and RTO")
    w.table(["Item", "Design"], [
        ["Database backups", "pgBackRest full backup daily at 02:00, after EOD and the overnight jobs; continuous WAL "
         "archiving with archive_timeout 300 seconds"],
        ["Document backups", "Daily incremental, weekly full"],
        ["Retention", "35 days online; monthly copies kept 12 months; yearly copies per IIFT policy"],
        ["Off-site", "Daily copy of backups to the DR site; backups encrypted"],
        ["RPO", "15 minutes or better: streaming replication to the standby is near-real-time, and archived WAL "
         "limits loss to 5 minutes if both database nodes are lost"],
        ["RTO", "4 hours for a full site loss; under 30 minutes for loss of an application VM (none, service "
         "continues) or the database primary (promote standby)"],
        ["Backup storage need", "About 150 GB at year 5 (database fulls and WAL, document backups, monthly copies); "
         "1 TB provisioned"],
        ["Verification", "Quarterly restore test to a scratch instance with reconciliation of counts; yearly DR test"],
    ], widths=[3.6, 13.4], font_size=8.5, bold_first_col=True, caption="Backup and recovery design")
    w.h2("Network ports and firewall rules")
    w.table(["Source", "Destination", "Port", "Purpose"], PORTS, widths=[4.2, 4.6, 2.6, 5.6], font_size=8,
            caption="Firewall matrix (Option A)")


def nfr(w):
    unit_files, unit_cases, e2e_files, e2e_cases = facts.test_inventory()
    w.h1("Non-functional Design")
    w.table(["Area", "Target", "Design measures"], [
        ["Performance (NFR-01)", "Page load under 3 s; API p95 under 1 s; reports on 12 months of data under 10 s",
         "Indexed list queries with pagination (max 100 rows); lazy-loaded pages and split bundles; gzip and long "
         "caching of hashed assets; exports capped and streamed to file"],
        ["Capacity (NFR-02, 03)", "100 concurrent, 500 named users; 10× Appendix 2 volume",
         "Stateless API instances; connection pools of 10 per instance plus 5 for sessions"],
        ["Scalability (NFR-06, 07)", "Growth without redesign", "Add API containers or VMs behind the load balancer; "
         "jobs stay single-runner through advisory locks; database vertical scaling"],
        ["Availability (NFR-04, 05)", "99.5% monthly; 99.9% in IIFT business hours", "Two application VMs; hot "
         "standby database; health-checked load balancing; rolling deployment"],
        ["Integrity (NFR-16)", "No partial updates", "Single-transaction business operations; outbox; optimistic "
         "locking"],
        ["Recoverability (NFR-17 to 19)", "RPO 15 minutes; RTO 4 hours", "Streaming replication, WAL archiving, "
         "daily backups, DR site, tested restores"],
        ["Usability and accessibility (NFR-22 to 24)", "WCAG 2.1 AA; current Chrome, Edge, Firefox, Safari",
         "Ant Design accessible components, keyboard navigation, consistent layouts in both applications"],
        ["API standards (NFR-25)", "REST, JSON, OpenAPI 3", "/api/v1 versioning; ISO 8601 dates; documented error "
         "body; OpenAPI description in docs/api"],
        ["Maintainability (NFR-20, 21)", "Modular, documented, tested", f"{unit_files} API and web unit test "
         f"files ({unit_cases} cases) and {e2e_files} end-to-end suites ({e2e_cases} cases) run in CI; lint, format and "
         "type checks"],
    ], widths=[3.6, 5.2, 8.2], font_size=8, bold_first_col=True, caption="Non-functional targets and design")
    w.h2("Monitoring and health")
    w.table(["Endpoint or signal", "Content", "Use"], [
        ["GET /health/live", "{status: ok} while the process runs", "Container and load-balancer liveness"],
        ["GET /health/ready", "Runs SELECT 1; 503 NOT_READY if the database is unavailable", "Load-balancer "
         "readiness; Docker HEALTHCHECK"],
        ["GET /metrics", "Prometheus default process metrics prefixed iift_api_ (CPU, memory, heap, event-loop lag, "
         "GC); bearer METRICS_TOKEN", "Prometheus scrape every 30 s"],
        ["Integration monitor", "Per-system success rate, average time, pending, retrying and dead-letter counts for "
         "24 hours", "Back-office screen and API for support"],
        ["EOD history", "Status, totals and files per business date", "Finance and support"],
        ["Application e-mails", "Dead-letter alerts, AML review, SLA breaches, agency blocks", "Business and support "
         "teams"],
    ], widths=[3.8, 7.6, 5.6], font_size=8, caption="Health and monitoring signals")
    w.para("Prometheus alert rules (delivered during implementation) cover: readiness failing for 2 minutes; HTTP 5xx "
           "rate above 2% for 5 minutes (from nginx logs); p95 latency above 2 s; event-loop lag above 500 ms; memory "
           "above 85%; disk above 80%; replication lag above 5 minutes; last successful backup older than 26 hours; "
           "an eod_run in FAILED status or no completed run by 01:00; any outbox message in DEAD; certificate expiry "
           "within 30 days. HTTP request histograms and business gauges (outbox backlog, open SLA breaches) are added "
           "to /metrics during implementation.")
    w.h2("Logging")
    w.para("The API writes one JSON line per event to standard output with pino: level, time, message and, for HTTP "
           "requests, the request id, method, URL, status and response time. The request id is the correlation id "
           "from X-Request-Id (set by nginx) or a new UUID, and is returned in the response header and in every error "
           "body, so a user's reference leads straight to the log lines. Cookies, authorization, CSRF and set-cookie "
           "headers are redacted; health probes are not logged. Container logs are collected by the platform's log "
           "shipper (Fluent Bit to the IITH log platform, or CloudWatch) and kept 90 days online. The audit trail is "
           "separate from logs and is held in the database under the retention rules.")


def stack(w):
    deps, root = facts.versions()
    w.h1("Technology Stack and Versions")
    w.para("Versions are the minimums declared in the package manifests at the time of writing; the lockfile pins "
           "exact versions. All third-party components are open source and carry no licence fee; the only paid "
           f"choice is the operating system if IIFT standardises on RHEL. The {PRODUCT} licence itself (perpetual "
           "under Option A, right to use under the Option B subscription, source code under Option C) is a "
           "commercial term of the proposal.")
    rows = []
    for layer, items in STACK:
        rows.append(("GROUP", layer))
        for name, key, purpose in items:
            if key is None:
                version = root.get("packageManager", "npm").split("@")[-1]
            elif key in deps:
                version = deps[key]
            else:
                version = key
            rows.append([name, version, purpose])
    w.table(["Component", "Version", "Purpose"], rows, widths=[5.6, 5.8, 5.6], font_size=8,
            caption="Technology stack")


def decisions(w):
    w.h1("Architecture Decisions")
    w.para("Each decision is recorded with the options considered and the reason for the choice. Changes to these "
           "decisions follow the change process and are added here.")
    rows = [[f"AD-{i:02d}", d, o, r] for i, (d, o, r) in enumerate(ADR, start=1)]
    w.table(["Id", "Decision", "Options considered", "Rationale"], rows, widths=[1.3, 3.6, 4.4, 7.7], font_size=8,
            caption="Architecture decision log")


def appendix_api(w):
    spec, ops = facts.api_operations()
    w.h1("Appendix A: API Operations", numbered=False)
    w.para(f"All {len(ops)} operations on {len(spec['paths'])} paths in docs/api/openapi.json, grouped by tag. "
           "Request and response schemas are in the OpenAPI file.")
    groups = {}
    for method, path, tag in ops:
        groups.setdefault(tag, []).append((method, path))
    rows = []
    for tag in sorted(groups, key=lambda t: (t.split(":")[0], t)):
        rows.append(("GROUP", tag))
        for method, path in groups[tag]:
            rows.append([method, path])
    w.table(["Method", "Path"], rows, widths=[2.0, 15.0], font_size=7.5, padding=15, zebra=False)


def appendix_glossary(w):
    w.h1("Appendix B: Glossary", numbered=False)
    w.table(["Term", "Meaning"], [
        ["Advisory lock", "PostgreSQL lock identified by a number, used here so one API instance runs each job"],
        ["AMBD", "Autoriti Monetari Brunei Darussalam, the financial regulator"],
        ["Blind index", "Keyed hash of a value stored next to its ciphertext so the value can be matched exactly "
         "without decrypting"],
        ["CSRF", "Cross-site request forgery"],
        ["Dead-letter", "State of a message that will not be retried automatically"],
        ["EOD", "End-of-day processing"],
        ["FIN", "IITH financial system"],
        ["Idempotency key", "Identifier that lets a receiver ignore a repeated delivery"],
        ["Maker-checker", "Control where one person raises a change and another approves it"],
        ["Outbox", "Table of messages written with the business change and delivered afterwards"],
        ["PDPO", "Personal Data Protection Order 2025 (Brunei)"],
        ["PITR", "Point-in-time recovery"],
        ["RPO / RTO", "Recovery point objective (data loss) / recovery time objective (downtime)"],
        ["SPA", "Single-page application"],
        ["Tabarru'", "Donation portion of the contribution to the participants' risk fund"],
        ["Wakalah", "Agency fee charged by the takaful operator"],
    ], widths=[3.6, 13.4], font_size=8.5, bold_first_col=True)
