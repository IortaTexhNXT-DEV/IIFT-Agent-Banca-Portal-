"""Build the SalesVerse 2.0 Production Support Handover (DOCX and PDF).

Usage:
    python3 docs/technical/build/build_handover.py [--no-pdf]

The configuration reference, business parameters, scheduled jobs and npm scripts
are read from the source code at build time (source_facts.py), so the handover
matches the release it is built from.
"""

import json
import sys
import tempfile
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parent))

import tech_kit  # noqa: E402
from tech_kit import TechnicalWriter, DocInfo, TECH_DIR, PRODUCT  # noqa: E402
import tech_diagrams  # noqa: E402
import source_facts as facts  # noqa: E402
from sad_part1 import JOBS  # noqa: E402

INFO = DocInfo(
    code="PSH",
    title="Production Support Handover",
    subtitle="Support model, service levels, operating procedures, runbooks, configuration reference and knowledge "
             "transfer",
    deliverable="DEL-26 (Technical manual), DEL-27 (Operations manual), MNT-01 to MNT-30",
    keywords="production support; runbooks; SLA; operations; SalesVerse 2.0; IIFT",
    purpose="This document hands over the operation of SalesVerse 2.0 to the support organisation. It defines who "
            "does what, the service levels, the processes for incidents, problems, changes and releases, and gives "
            "the runbooks and reference data that support staff need. It is updated after every release (MNT-27).",
    related=["SalesVerse-2.0-Solution-Architecture: design, deployment, sizing and security.",
             "SalesVerse-2.0-Data-Dictionary: database tables and columns.",
             "README.md and apps/api/.env.example in the source repository."],
)

TIERS = [
    ["L1", "IIFT helpdesk", "Receives calls, e-mails and Issues-module tickets; classifies priority; answers how-to "
     "questions; resets passwords and unlocks users; checks known errors; escalates with the correlation id",
     "IIFT business hours; P1 on-call per IIFT rota"],
    ["L2", "iorta application support", "Diagnoses from logs, metrics and data; runs runbooks; configuration and "
     "parameter changes; data corrections under change control; integration retries; coordinates with IITH IT",
     "IIFT business hours; P1 24 x 7 on call"],
    ["L3", "iorta engineering", "Code defects, root-cause analysis, fixes, performance work, releases and emergency "
     "patches", "Business hours; P1 24 x 7 when escalated"],
    ["Infra", "IITH IT (infrastructure owner)", "Servers, storage, network, firewalls, load balancers, operating "
     "systems, backup infrastructure, DR site, certificates, DNS, SMTP relay", "Per IITH service hours"],
]

RACI = [
    ["Log and classify incidents", "R/A", "C", "I", "I"],
    ["User administration, unlock, password reset", "R/A", "C", "–", "–"],
    ["Business parameter and master data changes", "A", "R", "–", "–"],
    ["Application monitoring and alert response", "I", "R/A", "C", "C"],
    ["Infrastructure monitoring and patching", "I", "C", "–", "R/A"],
    ["Integration retries and reconciliation follow-up", "C (Finance)", "R/A", "C", "–"],
    ["Defect fixes and releases", "A (approve)", "R", "R", "C"],
    ["Database backups and restore", "I", "R (verify)", "C", "R/A (run)"],
    ["DR invocation and tests", "A", "R", "C", "R"],
    ["Security patches (application)", "A (approve)", "R", "R", "I"],
    ["Security patches (OS, database packages)", "A (approve)", "C", "–", "R"],
    ["Monthly service report", "I", "R/A", "C", "C"],
]

SLA = [
    ["P1 Critical", "Production down, or a critical function (sign-in, quotation, issuance, payment verification, "
     "EOD) unavailable for all users; data integrity or security breach", "30 minutes", "4 hours (restore or "
     "workaround)", "24 x 7"],
    ["P2 High", "Major function impaired for many users with no reasonable workaround", "2 hours", "1 business day",
     "IIFT business hours"],
    ["P3 Medium", "Function impaired with a workaround; few users affected", "4 business hours", "3 business days",
     "IIFT business hours"],
    ["P4 Low", "Cosmetic issue, question or minor defect", "1 business day", "Next scheduled release",
     "IIFT business hours"],
]

ESCALATION_IORTA = [
    ["1", "Support engineer (on call)", "[Name]", "[Mobile, e-mail]", "On logging; P1 by telephone immediately"],
    ["2", "Support lead", "[Name]", "[Mobile, e-mail]", "P1 not restored in 1 hour; P2 not responded in 2 hours"],
    ["3", "Engineering lead", "[Name]", "[Mobile, e-mail]", "P1 not restored in 2 hours; P2 not resolved in 1 "
     "business day"],
    ["4", "Account / project director", "[Name]", "[Mobile, e-mail]", "P1 not restored in 4 hours; repeated SLA "
     "breach"],
]

ESCALATION_IIFT = [
    ["1", "IIFT helpdesk", "[Name]", "[Phone, e-mail]", "First contact for users"],
    ["2", "IIFT IT application owner", "[Name]", "[Phone, e-mail]", "P1/P2 decisions, change approval"],
    ["3", "IITH infrastructure on-call", "[Name]", "[Phone, e-mail]", "Server, network, database host, DR"],
    ["4", "IIFT Head of IT / business owner", "[Name]", "[Phone, e-mail]", "Business impact, external communication"],
]

ALERTS = [
    ["API not ready", "/health/ready fails on any instance for 2 minutes", "P1 if all instances, else P2",
     "L2 on call", "R1, check database"],
    ["High error rate", "HTTP 5xx above 2% for 5 minutes (nginx logs)", "P2", "L2", "Logs by correlation id"],
    ["Slow responses", "p95 latency above 2 s for 10 minutes", "P3", "L2", "Metrics, slow queries"],
    ["Event-loop lag", "iift_api_nodejs_eventloop_lag_seconds above 0.5 for 5 minutes", "P3", "L2", "Metrics"],
    ["Memory or disk", "Memory above 85% or disk above 80%", "P3", "Infra, L2", "Capacity"],
    ["Replication lag", "Standby more than 5 minutes behind", "P2", "Infra, L2", "Section 11"],
    ["Backup missing", "No successful database backup in 26 hours", "P2", "Infra", "Section 11"],
    ["EOD failed", "eod_run FAILED, or no COMPLETED run for the previous day by 01:00", "P2", "L2, Finance", "R6"],
    ["Integration dead-letter", "Any outbox_message in DEAD (application also e-mails integration support)", "P2",
     "L2", "R7"],
    ["Reconciliation mismatch", "reconciliation_run status MISMATCH", "P3", "Finance, L2", "R7"],
    ["Issue SLA breach", "Application e-mails holders of bo.issues.manage when an issue misses a target", "Per issue",
     "Support desk", "Issues module"],
    ["Certificate expiry", "TLS certificate expires within 30 days", "P3", "Infra", "Renew"],
]

DAILY_CHECKS = [
    "Grafana overview: all instances ready, error rate and latency normal overnight.",
    "Back-office > End of day: yesterday's run COMPLETED, totals plausible, files present.",
    "Back-office > Integration: no DEAD messages; pending and retrying counts near zero; reconciliation MATCHED.",
    "Backup report: last full backup and WAL archiving successful; replication lag normal.",
    "Issues module: new P1/P2 tickets, SLA breaches.",
    "Back-office > Agencies: agencies newly blocked overnight (expected after the 01:00 job) communicated to "
    "Distribution.",
]

KT_SESSIONS = [
    ["1", "Solution overview and architecture", "IIFT IT, IITH infrastructure", "2 h",
     "Solution Architecture, live demonstration"],
    ["2", "Back-office administration: users, roles, workflows, parameters, products, master data",
     "IIFT administrators", "3 h", "Administrator manual, UAT environment"],
    ["3", "Operations: monitoring, EOD, integration monitor, reconciliation, daily checks", "IIFT IT, Finance",
     "3 h", "This document, dashboards"],
    ["4", "Runbooks hands-on: start/stop, deploy, rollback, restore, retries", "IIFT IT, IITH infrastructure", "4 h",
     "UAT environment, runbooks"],
    ["5", "Infrastructure: containers, PostgreSQL replication, backups, DR", "IITH infrastructure", "3 h",
     "Deployment scripts, DR plan"],
    ["6", "Security operations: keys, secrets, access reviews, audit trail, VAPT findings", "IIFT IT security",
     "2 h", "Security Assessment Report"],
    ["7", "Code walk-through for developers: structure, conventions, tests, adding features", "IIFT/IITH developers",
     "2 × 3 h", "Developer onboarding guide, repository"],
    ["8", "Helpdesk: common questions, triage, priority rules, escalation", "IIFT helpdesk", "2 h",
     "Known-error list, FAQ"],
]

CHECKLIST = [
    ["Source code repository with full history transferred to IIFT/IITH", "Repository access confirmed", "iorta"],
    ["Production, UAT and SIT environments documented with access granted", "Access matrix", "iorta, IITH"],
    ["Secrets and keys held in the IITH vault; no copies outside", "Vault inventory signed", "IITH, iorta"],
    ["Monitoring dashboards and alert rules live; alert recipients tested", "Test alert received", "iorta"],
    ["Backups running; one restore tested and reconciled", "Restore test record", "IITH, iorta"],
    ["DR replication running; DR test plan agreed", "Plan approved", "IITH, iorta"],
    ["Runbooks in this document executed once in UAT by IIFT/IITH staff", "Signed runbook log", "IIFT, iorta"],
    ["Knowledge-transfer sessions delivered and attended", "Attendance and feedback", "iorta"],
    ["Escalation contacts completed and tested", "Contact test record", "IIFT, iorta"],
    ["Known-error list and open defect list handed over", "Lists accepted", "iorta"],
    ["Data Dictionary and Solution Architecture at the go-live version", "Documents issued", "iorta"],
    ["Hypercare exit criteria met: no open P1/P2, EOD stable 10 business days", "Hypercare report", "iorta, IIFT"],
]

REPORT_SECTIONS = [
    ["1", "Summary", "Service status, key events, availability, SLA attainment, actions for IIFT"],
    ["2", "Availability", "Monthly availability overall and in business hours against 99.5% and 99.9%; outages "
     "with cause and duration"],
    ["3", "Incidents", "Opened, resolved and open by priority; SLA attainment per priority; P1/P2 summaries"],
    ["4", "Problems", "Root-cause analyses completed and actions outstanding"],
    ["5", "Service requests", "Volume by type, average turnaround"],
    ["6", "Changes and releases", "Changes implemented, emergency changes, releases with content"],
    ["7", "Security", "Patches applied, vulnerabilities found and remediation status, access reviews"],
    ["8", "Operations", "EOD runs, reconciliation results, integration dead-letters, backup and restore tests"],
    ["9", "Capacity", "Database and document growth, CPU and memory trends against sizing"],
    ["10", "Enhancement hours", "Hours used from the annual 60-hour pool, balance"],
    ["11", "Outstanding items and plan", "Open issues, upcoming changes, next month's plan"],
]

EXIT = [
    ["Trigger", "Year 5 of maintenance, or within 30 days of a termination notice"],
    ["Exit plan", "Scope, timeline, receiving party and responsibilities agreed with IIFT"],
    ["Knowledge transfer", "Sessions on architecture, code, configuration, operations and known issues to the new "
     "provider or IIFT team (sessions 1 to 8 repeated as needed)"],
    ["Documentation", "Final update of this document, the Solution Architecture, Data Dictionary, administrator and "
     "user manuals"],
    ["Source code and tooling", "Final source code, pipeline definitions, deployment files and build scripts; "
     "container images in the IITH registry"],
    ["Data", "IIFT owns all data. Full export on request: PostgreSQL dump, CSV per table, document files decrypted "
     "into a folder per owner, audit trail"],
    ["Credentials", "All iorta access removed; secrets rotated by IITH after transfer"],
    ["Parallel support", "Shadow support to the new provider for up to 30 days"],
    ["Closure", "Signed transition acceptance; secure deletion of IIFT data held by iorta, with certificate"],
]


def runbook(w, number, title, purpose, steps, verify=None, notes=None, code=None, permission=None):
    w.h2(f"R{number} {title}")
    w.para(purpose)
    if permission:
        w.para(f"**Needs:** {permission}", space_after=3)
    if code:
        w.code(code)
    w.steps(steps)
    if verify:
        w.para(f"**Verify:** {verify}")
    if notes:
        w.bullets(notes)


def build(path: Path):
    with tempfile.TemporaryDirectory() as tmp:
        figs = tech_diagrams.render(["support", "incident", "problem", "change", "release", "dr"], Path(tmp))
        w = TechnicalWriter(INFO)
        w.cover(figs["cover_band"])
        w.document_control()
        w.table_of_contents()

        # 1 -------------------------------------------------------------------------------
        w.h1("Introduction")
        w.para(f"{PRODUCT} goes live after UAT sign-off and is followed by four weeks of hypercare, during which the "
               "project team supports production directly. At hypercare exit the service moves to the support model "
               "in this document for the five-year maintenance period. The six-month warranty from go-live runs in "
               "parallel and covers defect correction at no cost.")
        w.table(["Phase", "Period", "Support arrangement"], [
            ["Hypercare", "Weeks 25 to 28 (4 weeks after go-live)", "Project team on site or on call; daily stand-up "
             "with IIFT; priority fixes"],
            ["Warranty", "6 months from go-live", "Defects fixed free of charge under this support model"],
            ["Maintenance", "Years 1 to 5 from go-live", "This support model, SLA and monthly reporting"],
        ], widths=[3.0, 5.4, 8.6], font_size=8.5, caption="Support phases")
        w.para("Readers: IIFT helpdesk and IT, IITH infrastructure, iorta support and engineering. Commands assume a "
               "Linux shell on the application or database VM, with the repository's deploy directory as working "
               "directory for Docker Compose commands.")

        # 2 -------------------------------------------------------------------------------
        w.h1("Support Model")
        w.figure(figs["support"], "Support tiers", width_cm=15.0)
        w.table(["Tier", "Team", "Responsibilities", "Hours"], TIERS, widths=[1.2, 3.2, 9.0, 3.6], font_size=8,
                bold_first_col=True, caption="Support tiers")
        w.h2("Channels")
        w.bullets([
            "**Issues module** in the portal and back-office (preferred): records priority, category, attachments and "
            "SLA timers automatically.",
            "**Support e-mail** [support mailbox] for users without portal access; the helpdesk logs the ticket.",
            "**Telephone hotline** [number] for P1: always call in addition to logging a ticket.",
            "Every error screen shows a reference (the correlation id). Users quote it; support searches logs and the "
            "audit trail with it.",
        ])
        w.h2("Responsibilities")
        w.table(["Activity", "IIFT helpdesk / IT", "iorta L2", "iorta L3", "IITH infra"], RACI,
                widths=[6.4, 2.8, 2.6, 2.4, 2.8], font_size=8, center_cols=(1, 2, 3, 4),
                caption="RACI (R responsible, A accountable, C consulted, I informed)")

        # 3 -------------------------------------------------------------------------------
        w.h1("Support Hours and Service Levels")
        w.h2("Support hours")
        w.para("Support follows the Insurans Islam TAIB business-hours schedule for Family Takaful (COM-14). P1 "
               "incidents are covered 24 hours a day, 7 days a week, including weekends and public holidays.")
        w.table(["Coverage", "Hours"], [
            ["IIFT business hours", "[As published in the 'Insurans Islam TAIB Business Hours (Family Takaful)' "
             "schedule, e.g. Monday to Thursday and Saturday, 08:00 to 17:00 Brunei time, excluding Friday, Sunday "
             "and public holidays]"],
            ["P1 critical incidents", "24 x 7 through the hotline and on-call engineer"],
            ["Planned maintenance windows", "[Agreed with IIFT, e.g. Sunday 08:00 to 12:00], announced 5 business "
             "days ahead"],
        ], widths=[4.6, 12.4], font_size=8.5, bold_first_col=True, caption="Support hours")
        w.h2("Severity definitions and SLA")
        w.table(["Priority", "Definition", "Response", "Restore / resolve", "Coverage"], SLA,
                widths=[2.2, 6.8, 2.4, 3.0, 2.6], font_size=8, bold_first_col=True,
                caption="Incident service levels (MNT-05 to MNT-07, COM-13)")
        w.bullets([
            "Response: an engineer has acknowledged the incident and started work, measured from logging (or from "
            "the call for P1).",
            "Restore: service or function available again, possibly with a workaround; the permanent fix follows "
            "under problem management.",
            "Priority is set by the helpdesk from impact and urgency and can be changed by agreement; the SLA clock "
            "follows the agreed priority.",
            "The clock pauses while waiting for IIFT information or for infrastructure outside iorta's "
            "responsibility; pauses are recorded on the ticket.",
            "Availability target: 99.5% per month overall and 99.9% within IIFT business hours, excluding approved "
            "maintenance windows.",
            "The Issues module's own SLA timers (Issue SLA parameters sla.*) track user-reported issues inside the "
            "application; they are configured to match this table at go-live.",
        ])

        # 4 -------------------------------------------------------------------------------
        w.h1("Incident Management")
        w.figure(figs["incident"], "Incident process", width_cm=16.0)
        w.table(["Step", "What happens", "Who"], [
            ["Detect", "Alert, user call, e-mail or Issues-module ticket", "Monitoring, users"],
            ["Log", "Ticket with symptom, time, user, correlation id, screenshots", "L1"],
            ["Classify", "Priority P1 to P4 from the definitions; category", "L1"],
            ["Respond", "Acknowledge within SLA; for P1 open a bridge call and notify the escalation contacts", "L2"],
            ["Diagnose", "Logs by correlation id, metrics, integration monitor, audit trail, data", "L2, L3"],
            ["Restore", "Workaround or fix; runbook where one exists", "L2, L3, Infra"],
            ["Verify", "User confirms; monitoring back to normal", "L1, L2"],
            ["Close", "IIFT confirms closure; P1 and P2 open a problem record", "L1"],
        ], widths=[2.4, 11.0, 3.6], font_size=8.5, bold_first_col=True, caption="Incident steps (MNT-02)")
        w.h2("P1 procedure")
        w.numbered([
            "Call the on-call engineer; log the ticket; the engineer acknowledges within 30 minutes.",
            "Open a bridge call with the IIFT application owner and, if needed, IITH infrastructure.",
            "Send a first update to the IIFT contact list within 30 minutes, then every 30 minutes until service is "
            "restored: impact, actions, next update time.",
            "Restore service by the fastest safe route (restart, rollback, failover, workaround). Record every action "
            "with its time on the ticket.",
            "Confirm restoration with users; keep monitoring for at least one hour.",
            "Issue a short incident summary within 1 business day and a root-cause report within 5 business days.",
        ])

        # 5 -------------------------------------------------------------------------------
        w.h1("Problem Management", new_page=False)
        w.figure(figs["problem"], "Problem process", width_cm=16.0)
        w.para("A problem record is opened for every P1 and P2, for recurring incidents (three or more with the same "
               "symptom in a month) and for trends seen in monitoring (MNT-03). The root-cause report contains: "
               "summary and impact; timeline; root cause; why it was not detected earlier; corrective actions with "
               "owner and date; preventive actions. Known errors with their workaround are published to the helpdesk "
               "until the fix is released.")

        # 6 -------------------------------------------------------------------------------
        w.h1("Change Management")
        w.figure(figs["change"], "Change process", width_cm=16.0)
        w.table(["Type", "Examples", "Approval", "Lead time"], [
            ["Standard", "Business parameter within range, master data code, user and role administration, report "
             "schedule", "Pre-approved; done by IIFT administrators in the back-office; audited", "None"],
            ["Normal", "Release, product rate change, workflow change, infrastructure change, integration change",
             "IIFT change approval (CAB) after impact assessment", "5 business days"],
            ["Emergency", "Fix for a P1/P2, urgent security patch", "IIFT application owner (retrospective CAB "
             "review)", "As needed"],
        ], widths=[2.4, 6.4, 5.4, 2.8], font_size=8, bold_first_col=True, caption="Change types")
        w.para("Minor enhancements are delivered from the 60-hour annual pool; larger changes follow the change "
               "request process with impact assessment, quotation at the rate card and approval (MNT-23, MNT-24). "
               "Data corrections in production are changes: they are scripted, reviewed, run in a transaction, and "
               "recorded in the audit trail or the change ticket.")

        # 7 -------------------------------------------------------------------------------
        w.h1("Release Management", new_page=False)
        w.figure(figs["release"], "Release process", width_cm=16.0)
        w.table(["Release type", "Content", "Cadence"], [
            ["Emergency fix", "P1/P2 defect or urgent security patch", "As needed"],
            ["Maintenance release", "Defect fixes, dependency and image patches, minor enhancements", "Monthly"],
            ["Feature release", "Change requests", "Quarterly or as agreed"],
            ["Platform upgrade", "Node.js, PostgreSQL, framework and SalesVerse 2.0 versions", "Typically yearly"],
        ], widths=[4.0, 9.0, 4.0], font_size=8.5, bold_first_col=True, caption="Release types (MNT-21, MNT-22)")
        w.para("Every release passes the CI pipeline, is deployed to UAT with the same images that will go to "
               "production, and is approved by IIFT before it is deployed in an agreed window. Release notes list "
               "changes, migrations, configuration changes, risks and the rollback plan. The deployment itself "
               "follows runbook R2; rollback follows R3.")

        # 8 -------------------------------------------------------------------------------
        w.h1("Escalation Matrix", new_page=False)
        w.para("Names and numbers are completed at mobilisation and checked quarterly.")
        w.table(["Level", "iorta TechNXT role", "Name", "Contact", "Escalate when"], ESCALATION_IORTA,
                widths=[1.2, 3.8, 2.6, 3.0, 6.4], font_size=8, center_cols=(0,), caption="iorta escalation (COM-15)")
        w.table(["Level", "IIFT / IITH role", "Name", "Contact", "Involved for"], ESCALATION_IIFT,
                widths=[1.2, 3.8, 2.6, 3.0, 6.4], font_size=8, center_cols=(0,), caption="IIFT and IITH contacts")

        # 9 -------------------------------------------------------------------------------
        w.h1("Monitoring and Alerting")
        w.h2("Health endpoints and metrics")
        w.table(["Endpoint", "Returns", "Used by"], [
            ["GET /health/live", "200 {status: ok} while the process runs", "Docker, load balancer"],
            ["GET /health/ready", "200 {status: ok, database: up}; 503 NOT_READY when PostgreSQL is unreachable",
             "Docker HEALTHCHECK every 30 s, load balancer"],
            ["GET /metrics", "Prometheus text format; process and Node.js metrics prefixed iift_api_; requires "
             "'Authorization: Bearer <METRICS_TOKEN>' when the token is set", "Prometheus"],
        ], widths=[3.4, 9.0, 4.6], font_size=8.5, caption="Health and metrics endpoints")
        w.para("The endpoints are served by the API on port 3000 outside the /api/v1 prefix and are not exposed "
               "through nginx. To check from the VM:")
        w.code('docker compose ps            # STATUS shows (healthy) for api and web\n'
               'docker compose exec api node -e "fetch(\'http://127.0.0.1:3000/health/ready\')'
               '.then(async r => console.log(r.status, await r.text()))"')
        w.h2("Logs")
        w.para("The API writes JSON lines to standard output (read with docker compose logs api, or in the central "
               "log platform). Each HTTP request line carries req.id, the correlation id that is also returned to the "
               "browser in X-Request-Id and shown to users as the error reference. Cookies, authorization, CSRF and "
               "set-cookie headers are redacted. Example:")
        w.code('{"level":30,"time":1791014400123,"req":{"id":"6f1c2a9e-0d1b-4f6e-9a55-3b7e2c1d4a10","method":"POST",\n'
               ' "url":"/api/v1/portal/policies/…/submit"},"res":{"statusCode":422},"responseTime":184,\n'
               ' "msg":"request completed"}')
        w.code("docker compose logs --since 2h api | grep 6f1c2a9e-0d1b-4f6e-9a55-3b7e2c1d4a10")
        w.para("Business events for the same request are in audit_log.correlation_id; integration messages in "
               "outbox_message.correlation_id.")
        w.h2("Alerts")
        w.para("Alert rules are configured in Prometheus Alertmanager (or the IITH equivalent) during implementation; "
               "the application itself e-mails dead-letters, SLA breaches, AML review requests and agency blocks.")
        w.table(["Alert", "Condition", "Priority", "Recipient", "Runbook"], ALERTS, widths=[3.0, 6.6, 2.4, 2.4, 2.6],
                font_size=7.5, caption="Alerts")
        w.h2("Daily health check")
        w.bullets(DAILY_CHECKS)

        # 10 ------------------------------------------------------------------------------
        w.h1("Operational Runbooks")
        w.para("Each runbook lists who may run it, the steps and how to verify the result. Run every runbook once in "
               "UAT during knowledge transfer. Production commands are run on the VMs through the bastion, under a "
               "change ticket unless stated otherwise.")
        runbook(w, 1, "Start and stop the service",
                "Planned stop for maintenance, or restart after an infrastructure event. On production run the steps "
                "on one application VM at a time so the service stays available.",
                ["Announce the window if users will be affected.",
                 "Stop: docker compose --env-file .env stop web api (ClamAV can stay up).",
                 "Start: docker compose --env-file .env up -d (starts or recreates containers as needed).",
                 "Wait until docker compose ps shows api and web as healthy (start period 30 s).",
                 "Repeat on the second application VM.",
                 "Database VMs: systemctl stop|start postgresql@16-main (stop the standby last and start the primary "
                 "first)."],
                verify="health/ready returns 200 on both VMs; sign in to the back-office; Integration screen shows "
                       "pending messages draining.",
                notes=["Stopping the API mid-job is safe: the advisory lock is released and the job runs again at its "
                       "next schedule; an interrupted EOD can be re-run (R6)."],
                permission="L2 or IITH infrastructure; change ticket for production.")
        runbook(w, 2, "Deploy a release with database migrations",
                "Deploys a release that has passed UAT. Migrations are applied once, before the new containers start; "
                "they are backward compatible (expand-and-contract), so old and new containers can run together during "
                "the rolling update.",
                ["Confirm IIFT approval, release notes and the rollback criteria.",
                 "Take a backup: pgbackrest --stanza=iift --type=incr backup on the database primary; note the time.",
                 "Load the release images (docker compose pull from the IITH registry, or docker load from the "
                 "release package) and set RELEASE in deploy/.env; the production compose override (delivered during "
                 "implementation) references the images by this tag.",
                 "Apply migrations and reference data once: docker compose --env-file .env run --rm migrate. "
                 "Equivalent from a source checkout: cd apps/api && npm run db:migrate (with DATABASE_URL set to the "
                 "migration role).",
                 "Check the output ends with 'All migrations have been successfully applied' (or 'No pending "
                 "migrations').",
                 "VM 1: docker compose --env-file .env up -d api web; wait for healthy; run smoke tests.",
                 "VM 2: same command; wait for healthy.",
                 "Smoke tests: sign in to portal and back-office, open a policy, calculate a quotation, open End of "
                 "day and Integration screens, download a document.",
                 "Record the release, time and result on the change ticket; publish release notes."],
                verify="The version in the release notes matches the running images (docker compose images); no new "
                       "errors in logs for 30 minutes.",
                code="cd /opt/salesverse/deploy\n"
                     "docker compose --env-file .env run --rm migrate\n"
                     "docker compose --env-file .env up -d api web\n"
                     "docker compose ps",
                permission="L2 with IIFT change approval.")
        runbook(w, 3, "Roll back a release",
                "Returns to the previous release when the go/no-go check fails or a serious defect appears after "
                "release.",
                ["Decide with the IIFT application owner using the rollback criteria in the release notes.",
                 "Set RELEASE back to the previous tag in deploy/.env and run docker compose --env-file .env up -d api web on "
                 "each VM in turn.",
                 "Do not reverse migrations: the previous release runs on the expanded schema.",
                 "If a migration failed part-way, Prisma marks it failed: fix the cause, then run "
                 "npx prisma migrate resolve --rolled-back <migration> before re-applying, or restore (R5) if data "
                 "was changed.",
                 "Restore the database (R5) only if the release corrupted data; this needs IIFT approval because "
                 "transactions after the restore point are lost."],
                verify="Smoke tests from R2 pass on the previous version.",
                permission="L2 with the IIFT application owner.")
        runbook(w, 4, "Rotate secrets and keys",
                "Scheduled rotation (yearly or on staff change) or emergency rotation after suspected exposure. "
                "Secrets are held in the vault and injected as environment variables; containers read them at start.",
                ["SESSION_SECRET: generate (openssl rand -hex 32), update the vault, restart api on both VMs; every "
                 "user must sign in again, so do it in a quiet period.",
                 "INBOUND_API_KEY_SHA256: generate a key (openssl rand -base64 32), compute its hash "
                 "(printf '%s' \"$KEY\" | sha256sum), agree a cut-over time with IITH, update the hash and restart "
                 "api, then give the new key to the Core and FIN teams. Only one key is valid at a time.",
                 "Outbound API keys, SMTP and LDAP passwords: obtain the new value from the provider, update the vault, "
                 "restart api, check the Integration screen and send a test e-mail.",
                 "Database passwords: ALTER ROLE ... PASSWORD on the primary, update DATABASE_URL in the vault, "
                 "restart api VM by VM.",
                 "METRICS_TOKEN: update the vault and the Prometheus scrape configuration together.",
                 "FIELD_ENCRYPTION_KEY, FIELD_HASH_KEY, DOCUMENT_ENCRYPTION_KEY: never change by editing the variable; "
                 "existing data would become unreadable. Rotation uses the re-encryption tool delivered during "
                 "implementation, under a dedicated change with a fresh backup."],
                verify="Sign-in works; integration calls succeed; /metrics scraped; audit trail shows normal activity.",
                permission="L2 with IITH security; emergency rotation can start before CAB approval.")
        runbook(w, 5, "Restore from backup",
                "Recovers the database to a point in time after data loss or corruption, or rebuilds a server.",
                ["Agree the target time with IIFT (the last good moment) and record it.",
                 "Stop the API on both VMs (R1) so nothing writes during the restore.",
                 "On the database host: systemctl stop postgresql@16-main.",
                 "Restore: pgbackrest --stanza=iift --delta --type=time \"--target=2026-11-05 10:42:00+08\" "
                 "--target-action=promote restore.",
                 "Start PostgreSQL and wait for recovery to finish (pg_is_in_recovery() returns false).",
                 "Re-create the standby from the new primary (pgbackrest restore --type=standby on the standby host).",
                 "Documents: restore the document store to the same point from the document backup if files were "
                 "lost.",
                 "Start the API (R1) and reconcile: counts of policies, receipts and payments for the affected days; "
                 "re-run EOD for affected dates (R6).",
                 "Outbox messages created before the target but delivered after it are sent again; receivers ignore "
                 "them by Idempotency-Key. Check the Integration screen for DEAD messages."],
                verify="Application readiness, reconciliation of counts with IIFT, EOD and reconciliation MATCHED.",
                notes=["For DEV, SIT and UAT (compose database): docker compose exec db pg_dump -U iift -Fc iift > "
                       "backup.dump and pg_restore --clean -d iift backup.dump."],
                permission="IITH infrastructure runs the restore; L2 verifies; IIFT approves.")
        runbook(w, 6, "Re-run end-of-day",
                "Runs EOD again for a business date after a failure, after late corrections, or after a restore.",
                ["Back-office > End of day: check the run for the date (status, error message).",
                 "Fix the cause shown in the error message or logs (search 'EOD' in the API log for that night).",
                 "Choose Run, enter the business date (YYYY-MM-DD) and confirm. API: POST /api/v1/backoffice/eod with "
                 "{\"businessDate\": \"2026-11-04\"}.",
                 "The run refuses future dates, and refuses a date whose run started less than 30 minutes ago and is "
                 "still RUNNING.",
                 "The run for the date is updated in place with new totals, report and FIN file; reconciliation runs "
                 "again.",
                 "The new EOD_POSTING carries the next revision number, the idempotency key EOD-<date>-R<n> and "
                 "replacesPreviousRevision=true when an earlier revision was sent, so FIN replaces the earlier "
                 "revision for the date and ignores a repeated delivery of the same one.",
                 "Tell Finance which revision was sent for the date."],
                verify="Status COMPLETED; totals match the policy and collection reports for the date; reconciliation "
                       "MATCHED or explained.",
                permission="Finance officer or L2 with bo.eod.run.")
        runbook(w, 7, "Retry integration messages",
                "Clears dead-letter messages after the cause has been fixed (receiver down, credentials expired, data "
                "rejected).",
                ["Back-office > Integration: filter status DEAD; open the message; read last_error and the "
                 "integration log entries.",
                 "Fix the cause first: receiver available, credentials valid, or the data corrected in the source "
                 "record.",
                 "Select Retry (POST /api/v1/backoffice/integration/outbox/{id}/retry). The message returns to "
                 "PENDING with attempts reset and is sent within 20 seconds.",
                 "For many messages after an outage, retry in creation order so events for one record stay in order.",
                 "A message rejected with HTTP 4xx will fail again unless its payload is valid for the receiver; "
                 "raise a problem record with the receiving team."],
                verify="Message status SENT; integration log shows success; the receiving system confirms.",
                code="-- List dead-letter messages (read-only)\n"
                     "SELECT id, system, operation, attempts, last_error, created_at\n"
                     "FROM outbox_message WHERE status = 'DEAD' ORDER BY created_at;",
                permission="L2 or Finance with bo.integration.manage.")
        runbook(w, 8, "Unlock a user or reset a password",
                "A user is locked after repeated failed sign-ins (5 attempts, 30 minutes by default) or has forgotten "
                "the password.",
                ["Verify the caller's identity with the IIFT procedure (call-back to the registered number).",
                 "Back-office > Users: find the user. Status LOCKED: choose Unlock (POST /api/v1/backoffice/users/"
                 "{id}/unlock). The lock also clears itself when the period ends.",
                 "Forgotten password: choose Reset password. A temporary password is shown once to the administrator; "
                 "give it to the user through a separate channel. The user must change it at sign-in, and all the "
                 "user's sessions are ended.",
                 "DISABLED users are re-activated, not unlocked. Directory (AD) users are unlocked and reset in Active "
                 "Directory, not in the application.",
                 "Repeated lockouts for one account: check the audit trail (LOGIN_FAILED, ACCOUNT_LOCKED) for signs of "
                 "an attack and inform IIFT IT security."],
                verify="The user signs in; audit trail shows USER_UNLOCKED or USER_PASSWORD_RESET.",
                permission="IIFT administrator (L1) with bo.users.manage; an administrator cannot reset their own "
                           "password this way.")
        runbook(w, 9, "Lift an agency issuance block",
                "The 01:00 job blocks an agency's new business when an issued policy is unpaid past its due date, and "
                "lifts the block automatically once nothing is overdue. A manual lift is for payments made outside "
                "the portal or agreed exceptions.",
                ["Back-office > Agencies: open the agency; read the block reason (number of overdue policies, "
                 "amount).",
                 "Preferred: have the agency submit the payment and Finance verify it; the block lifts at the next "
                 "01:00 run.",
                 "If a manual lift is approved by IIFT, choose Lift block and enter the reason and approval reference "
                 "(POST /api/v1/backoffice/agencies/{id}/lift-block).",
                 "Make sure the overdue policies are paid before 01:00; otherwise the job re-applies the block."],
                verify="Agency shows issuance not blocked; agents can submit; audit trail shows AGENCY_BLOCK_LIFTED with "
                       "the reason.",
                permission="Operations or Finance with bo.agencies.manage, with IIFT approval.")
        runbook(w, 10, "Replace an AML watch-list",
                 "Loads a new version of a sanctions, PEP or internal list from Compliance.",
                 ["Prepare a UTF-8 CSV whose first line is exactly: list_name,full_name,id_number,country,reference. "
                  "list_name and full_name are mandatory; up to 20,000 entries per file.",
                  "Back-office > AML > Watch-list > Import; choose the file and tick 'Replace list' (replaceList=true): "
                  "entries of the lists named in the file are deactivated and the file's entries become the active "
                  "list. Without the option, entries are added.",
                  "Import runs in one transaction: a format error rejects the whole file with the line number.",
                  "Spot-check: search the watch-list for a few new names.",
                  "Screening is applied to new registrations and name changes from now on; re-screening of existing "
                  "agents and participants against a new list is requested from L2 as a service request."],
                 verify="Import result shows the expected count; audit trail shows WATCHLIST_IMPORTED with the list "
                        "names and count.",
                 permission="Compliance officer with bo.aml.review.")
        runbook(w, 11, "Apply a product rate change",
                 "Changes rates, plans, limits or questionnaire for a product, for example when IIFT actuarial issues "
                 "new rates.",
                 ["Receive the signed rate change from IIFT actuarial with its effective date.",
                  "In UAT: Back-office > Products: edit the product configuration; save. The rating engine validates "
                  "the configuration and names the exact field if a value is invalid.",
                  "Quote test cases agreed with actuarial in UAT and compare with their expected contributions; obtain "
                  "sign-off.",
                  "In production, on the effective date and after that day's EOD: apply the same change (second person "
                  "checks the values against the signed sheet).",
                  "From then on new quotations use the new rates. Drafts saved earlier are re-rated at submission, so "
                  "agents see the new contribution when they submit; inform Distribution beforehand."],
                 verify="Audit trail shows PRODUCT_UPDATED with before and after values; a test quotation in "
                        "production gives the expected contribution and is then discarded.",
                 notes=["Product changes are not routed through maker-checker in the application; the two-person check "
                        "above is the control until an approval type for products is added."],
                 permission="System administrator with bo.products.manage, with IIFT actuarial sign-off.")
        runbook(w, 12, "Investigate an error reported by a user",
                 "A user quotes the reference shown on an error message.",
                 ["Search the logs for the reference (correlation id) over the time of the error.",
                  "Read the error entry (stack trace for 500 errors) and the request line (URL, status, user).",
                  "Check audit_log and outbox_message for the same correlation_id to see what was committed.",
                  "4xx errors with a code (for example AGENCY_BLOCKED, SUBMISSION_INCOMPLETE) are business rules: "
                  "explain the message and details to the user.",
                  "500 errors: open an incident with the stack trace and steps to reproduce."],
                 code="SELECT occurred_at, actor_name, action, entity_type, entity_id\n"
                      "FROM audit_log WHERE correlation_id = '6f1c2a9e-0d1b-4f6e-9a55-3b7e2c1d4a10';",
                 permission="L1 for business-rule messages; L2 for logs and database.")

        # 11 ------------------------------------------------------------------------------
        w.h1("Backup and Disaster Recovery")
        w.h2("Backup schedule")
        w.table(["What", "How", "When", "Retention"], [
            ["Database full", "pgBackRest full backup to the backup repository", "Daily 02:00", "35 days"],
            ["Database WAL", "Continuous archiving (archive_timeout 300 s)", "Continuous", "35 days"],
            ["Database monthly", "Copy of the first full backup of the month", "Monthly", "12 months"],
            ["Document store", "Incremental file backup; weekly full", "Daily 03:00", "35 days; monthly 12 months"],
            ["Configuration", "deploy files, compose overrides, vault export (encrypted)", "On change", "All versions"],
            ["Off-site", "Copy of backups to the DR site", "Daily", "As above"],
        ], widths=[3.2, 6.6, 3.0, 4.2], font_size=8.5, caption="Backups (NFR-17)")
        w.h2("Targets")
        w.para("RPO 15 minutes or better (the local standby is near-real-time; archived WAL bounds loss to 5 minutes if "
               "both database nodes are lost); RTO 4 hours for loss of the primary site. Loss of one application VM "
               "has no outage; loss of the database primary is recovered by promoting the local standby within "
               "30 minutes.")
        w.h2("Database failover to the local standby")
        w.steps([
            "Confirm the primary is down and will not return quickly (IITH infrastructure).",
            "Make sure the old primary cannot start again (stop the service or isolate the VM) to avoid two primaries.",
            "On the standby: pg_ctlcluster 16 main promote (or SELECT pg_promote();).",
            "Move the database VIP or DNS name to the promoted server; the API reconnects automatically "
            "(readiness turns green).",
            "Rebuild the old primary as the new standby when it is repaired.",
        ], title="Promotion procedure")
        w.h2("DR invocation")
        w.figure(figs["dr"], "DR topology", width_cm=15.0)
        w.steps([
            "Declare the disaster with the IIFT application owner and IITH infrastructure; record the time.",
            "Promote the DR database replica; note the last replayed transaction time (data after it is lost).",
            "Mount the document replica at /data/documents on the DR application VM.",
            "Start the containers with the DR configuration: docker compose --env-file .env.dr up -d.",
            "Switch DNS or the external load balancer to the DR site; confirm TLS certificates.",
            "Run the R2 smoke tests; re-run EOD for the last business day if it did not complete (R6).",
            "Inform users and IITH system owners; monitor closely.",
            "Plan fail-back after the primary site is restored: rebuild replication in reverse, then switch in a "
            "maintenance window.",
        ], title="Invocation procedure")
        w.h2("Test schedule")
        w.table(["Test", "Frequency", "Scope", "Evidence"], [
            ["Restore test", "Quarterly", "Restore the latest backup to a scratch server; reconcile counts and "
             "amounts", "Restore record (MNT-19)"],
            ["Local failover", "Twice a year, in a maintenance window", "Promote the standby, run the service, rebuild",
             "Change record"],
            ["DR site test", "Yearly", "Full invocation at the DR site with IIFT users testing key functions; "
             "fail-back", "DR test report (NFR-19, MNT-20)"],
            ["Document restore", "Twice a year", "Restore a sample of files and open them in the application",
             "Restore record"],
        ], widths=[3.2, 3.6, 6.6, 3.6], font_size=8.5, caption="Backup and DR tests")

        # 12 ------------------------------------------------------------------------------
        w.landscape_section()
        w.h1("Configuration Reference", new_page=False)
        w.para("Every environment variable read by the API (apps/api/src/config/app-config.ts), as of this release. "
               "The API validates them at start-up and refuses to start with a missing or invalid value; in "
               "production it also refuses insecure combinations. Secrets come from the vault, never from files in "
               "the repository.")
        rows = facts.env_reference()
        rows += [[name, group, "Optional", purpose, example] for name, group, purpose, example, _ in facts.EXTRA_ENV]
        w.table(["Variable", "Group", "Required / default", "Purpose", "Example"], rows,
                widths=[5.2, 2.4, 4.4, 8.6, 5.1], font_size=7.5, padding=20, caption="Environment variables")
        w.h2("Business parameters")
        w.para("Maintained in Back-office > Parameters by holders of bo.config.manage; each change is audited and "
               "takes effect within a minute.")
        rows = [[s["key"], s["category"], s["value"], s["range"] or "–", s["description"]]
                for s in facts.setting_defaults()]
        w.table(["Key", "Category", "Default", "Range", "Meaning"], rows, widths=[6.2, 2.6, 1.8, 2.2, 12.9],
                font_size=7.5, padding=20, caption="Business parameters")
        w.h1("Scheduled Jobs", new_page=False)
        w.para("All jobs run inside the API containers. Each takes a PostgreSQL advisory lock named after the job, so "
               "only one instance runs it at a time. JOBS_ENABLED=false switches all jobs off in an instance.")
        rows = [job + [("Re-run from Back-office > End of day (R6)" if job[0] == "end-of-day" else
                        "Runs again at the next schedule; restart not needed")] for job in JOBS]
        w.table(["Job", "Schedule (Brunei time)", "Lock name", "Purpose", "Source", "If it fails"], rows,
                widths=[3.2, 3.8, 3.4, 6.8, 4.4, 4.1], font_size=7.5, caption="Scheduled jobs")
        w.portrait_section()

        # 14 ------------------------------------------------------------------------------
        w.h1("Knowledge Transfer Plan", new_page=False)
        w.para("Knowledge transfer runs from UAT to hypercare exit and continues each year for new IIFT and IITH staff "
               "(MNT-28). Sessions are recorded and the recordings handed over with the materials.")
        w.table(["#", "Session", "Audience", "Duration", "Materials"], KT_SESSIONS, widths=[0.8, 6.2, 3.8, 1.6, 4.6],
                font_size=8, center_cols=(0,), caption="Knowledge transfer sessions")
        w.para("Completion criteria: each session delivered and attended; IIFT/IITH staff have run runbooks R1, R2, R5, "
               "R6, R7 and R8 in UAT unaided; questions log closed.")

        # 15 ------------------------------------------------------------------------------
        onboarding(w)

        # 16 ------------------------------------------------------------------------------
        w.h1("Handover Checklist")
        w.table(["Item", "Evidence", "Owner", "Done"], [row + ["☐"] for row in CHECKLIST],
                widths=[8.2, 4.2, 3.0, 1.6], font_size=8.5, center_cols=(3,), caption="Handover checklist")
        w.table(["Role", "Name", "Signature / date"], [["IIFT application owner", "[Name]", ""],
                                                       ["IITH infrastructure lead", "[Name]", ""],
                                                       ["iorta TechNXT project director", "[Name]", ""]],
                widths=[6.0, 6.0, 5.0], caption="Handover acceptance")

        # 17 ------------------------------------------------------------------------------
        w.h1("Monthly Service Report Template")
        w.para("Issued by the 10th business day of each month (MNT-25) and reviewed in the quarterly service review "
               "(MNT-26).")
        w.table(["#", "Section", "Content"], REPORT_SECTIONS, widths=[0.8, 3.6, 12.6], font_size=8.5,
                center_cols=(0,), caption="Report sections")
        w.table(["Measure", "Target", "This month", "Previous month"], [
            ["Availability overall", "99.5%", "[x.x%]", "[x.x%]"],
            ["Availability in business hours", "99.9%", "[x.x%]", "[x.x%]"],
            ["P1 responded in 30 min / restored in 4 h", "100%", "[n of n]", "[n of n]"],
            ["P2 responded in 2 h / resolved in 1 business day", "95%", "[n of n]", "[n of n]"],
            ["P3 within SLA", "90%", "[n of n]", "[n of n]"],
            ["EOD runs completed on schedule", "All business days", "[n of n]", "[n of n]"],
            ["Reconciliations MATCHED", "All", "[n of n]", "[n of n]"],
            ["Dead-letter messages (open at month end)", "0", "[n]", "[n]"],
            ["Backups successful / restore test done", "All / quarterly", "[n of n / date]", "[–]"],
            ["Database size / document store size", "Within sizing", "[GB / GB]", "[GB / GB]"],
            ["Enhancement hours used (year to date)", "60 per year", "[h]", "[h]"],
        ], widths=[7.0, 3.4, 3.2, 3.4], font_size=8.5, caption="KPI table")

        # 18 ------------------------------------------------------------------------------
        w.h1("Exit and Transition Plan", new_page=False)
        w.para("Exit assistance is included in Year 5 and on termination (COM-19, MNT-30). IIFT owns its data, the "
               "configuration and the custom code delivered under the contract.")
        w.table(["Element", "Commitment"], EXIT, widths=[3.6, 13.4], font_size=8.5, bold_first_col=True,
                caption="Exit and transition")
        w.save(path)


def onboarding(w):
    api_pkg = json.loads((facts.API / "package.json").read_text())
    root_pkg = json.loads((facts.REPO / "package.json").read_text())
    web_pkg = json.loads((facts.WEB / "package.json").read_text())
    w.h1("Developer Onboarding Guide")
    w.h2("Repository layout")
    w.table(["Path", "Contents"], [
        ["apps/api/src/main.ts, app.setup.ts, app.module.ts", "Entry point, HTTP pipeline, module list and global "
         "guards"],
        ["apps/api/src/config", "AppConfig: typed, validated environment variables"],
        ["apps/api/src/common", "Prisma service and job locks, field crypto, numbering, data scope, permissions, "
         "decorators, request context, errors, pagination, dates and money"],
        ["apps/api/src/modules/<area>", "One folder per functional area: controller, service, DTOs, handlers, jobs, "
         "unit tests"],
        ["apps/api/prisma", "schema.prisma, migrations, reference data (seed.ts) and demonstration data "
         "(seed-demo.ts)"],
        ["apps/api/test", "End-to-end tests against a dedicated *_test database"],
        ["apps/web/src", "routes.tsx, layouts (AppShell, menus), api (client, hooks, types), pages per audience, "
         "shared components, theme"],
        ["deploy", "docker-compose.yml and .env.example"],
        ["tools/security", "Repeatable OWASP Top 10 checks"],
        ["docs/api, docs/technical", "OpenAPI description; this document pack and its generators"],
    ], widths=[6.4, 10.6], font_size=8.5, caption="Repository layout")
    w.h2("Local set-up")
    w.code("# Node.js 22.12+ and npm 11, PostgreSQL 16 running locally\n"
           "npm ci\n"
           "createdb iift                                   # or CREATE DATABASE iift; as postgres\n"
           "cp apps/api/.env.example apps/api/.env          # fill in DATABASE_URL and the secrets:\n"
           "#   SESSION_SECRET: openssl rand -hex 32\n"
           "#   FIELD_ENCRYPTION_KEY, FIELD_HASH_KEY, DOCUMENT_ENCRYPTION_KEY: openssl rand -base64 32\n"
           "cd apps/api\n"
           "npm run db:migrate                              # prisma migrate deploy\n"
           "SEED_ADMIN_PASSWORD='<temporary password>' npm run db:seed\n"
           "DEMO_PASSWORD='<demo password>' npm run db:seed:demo   # optional, never in production\n"
           "npm run start:dev                               # API on :3000, Swagger at /api/docs\n"
           "cd ../web && npm run dev                        # UI on :5173, proxies /api to :3000")
    w.para("Sign in as admin with the temporary password and change it. With demonstration data, agents "
           "(ag-000001 ...), bank officers and staff users (ops.maker, ops.checker, underwriter, finance, compliance, "
           "support, manager) use DEMO_PASSWORD.")
    w.h2("Scripts")
    rows = [["root", name, cmd] for name, cmd in root_pkg.get("scripts", {}).items()]
    rows += [["apps/api", name, cmd] for name, cmd in api_pkg.get("scripts", {}).items()]
    rows += [["apps/web", name, cmd] for name, cmd in web_pkg.get("scripts", {}).items()]
    w.table(["Package", "npm run ...", "Command"], rows, widths=[2.2, 3.6, 11.2], font_size=7.5, padding=20,
            caption="npm scripts")
    w.h2("Coding conventions")
    w.bullets([
        "TypeScript strict mode, ES modules with .js import suffixes; Prettier (single quotes, trailing commas, "
        "100 columns) and oxlint must pass; CI checks formatting, lint, types, tests and build.",
        "Controllers are thin: validation by DTO classes (class-validator), authorisation by decorators "
        "(@ForAudience, @RequirePermissions, @Public only where intended), logic in services.",
        "Every state change that matters is audited with AuditService.record inside the same transaction; anything "
        "sent to Core or FIN goes through OutboxService.enqueue in that transaction.",
        "Business rule failures throw BusinessRuleError with a stable code; missing records use notFound(); stale "
        "updates use staleRecord(). Never return stack traces or internal messages to clients.",
        "Portal queries always apply the data scope (DataScopeService.recordFilter); back-office routes declare "
        "permissions.",
        "Money as Prisma.Decimal through money()/sum(); dates as UTC instants or business dates via businessToday(); "
        "reference numbers via NumberingService.",
        "Database changes only by migration (npx prisma migrate dev --name <change>), reviewed in the pull request, "
        "expand-and-contract for anything already in production; update dictionary_text.py so the Data Dictionary "
        "build passes.",
        "Tests: API unit tests next to the code (*.spec.ts); end-to-end tests in apps/api/test for new endpoints and "
        "permissions; web unit and component tests next to the code (*.test.ts, *.test.tsx) with Vitest and Testing "
        "Library. npm test --workspaces runs the API and web unit tests.",
        "British English in user-facing text; Shariah-appropriate terms (participant, contribution, takaful).",
    ])
    w.h2("How to")
    w.table(["Task", "Steps"], [
        ["Add a module", "Create apps/api/src/modules/<area> with <area>.module.ts, controller, service and DTOs; add "
         "the module to app.module.ts; add permissions to common/security/permissions.ts (code and catalogue entry) and "
         "to roles in reference-data/roles.ts; add tests."],
        ["Add an endpoint", "Add the method to the controller with @Get/@Post..., a DTO for the body or query, "
         "@RequirePermissions (and audience on the controller); implement in the service with scope and audit; add an "
         "end-to-end test for allowed and denied users; regenerate docs/api/openapi.json."],
        ["Add a product", "Add the product to prisma/reference-data/products.ts with code, rating engine (FINANCING or "
         "FIXED_PLAN), config, required documents and questionnaire; run npm run db:seed (adds missing products only) "
         "or create it in production through a scripted change; if the product needs a new rating model, add an "
         "engine in modules/products/rating and register it in rating-engines.ts with unit tests."],
        ["Add a report", "Add a ReportDefinition (code, name, audiences, filters, columns, run) to "
         "modules/reports/report-definitions.ts; use the data scope in run(); export, preview and scheduling work "
         "without further code; add a unit test."],
        ["Add an approval type", "Add the value to enum ApprovalType in schema.prisma and create a migration; add a "
         "workflow definition with its steps to reference-data/workflows.ts; implement an ApprovalHandler "
         "(onApproved, onRejected, optional onWithdrawn) and register it with WorkflowService.registerHandler in "
         "onModuleInit; raise requests with WorkflowService.submit inside the business transaction."],
        ["Add a business parameter", "Add the key and default (with range) to modules/settings/setting-keys.ts; read "
         "it through SettingsService; defaults are seeded at start-up."],
        ["Add a scheduled job", "Use @Cron or @Interval with timeZone BUSINESS_TIME_ZONE, return early when "
         "JOBS_ENABLED is false, and wrap the work in prisma.withJobLock('<job-name>', ...)."],
    ], widths=[3.4, 13.6], font_size=8, bold_first_col=True, caption="Common development tasks")


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
