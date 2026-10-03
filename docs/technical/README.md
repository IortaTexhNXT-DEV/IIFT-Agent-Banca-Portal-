# SalesVerse 2.0 technical document pack

Technical documents for SalesVerse 2.0, configured as the IIFT Agent/Banca Portal & Back-office. They accompany the
tender proposal in `docs/proposal` and use the same styling.

| Document | Files | Content |
|---|---|---|
| Solution Architecture (IIFT-SV2-SAD, DEL-06) | `SalesVerse-2.0-Solution-Architecture.docx` / `.pdf` | Principles, context, functional modules with RFP coverage, application and data architecture, integration (outbox, retry, dead-letter, inbound APIs), security controls, deployment options (Option A on-premise with hybrid variant; Option B iorta-hosted cloud in AWS Asia Pacific (Malaysia) or Azure Malaysia West with landing zone, DR region, cost controls, shared responsibility and data-residency note), sizing (on-premise table checked by the proposal's bill of materials; cloud sizing read from the proposal's pricing data), firewall matrix, non-functional design, technology versions, decision log, API operation list |
| Data Dictionary (IIFT-SV2-DD, DEL-07) | `SalesVerse-2.0-Data-Dictionary.xlsx`, `.docx` / `.pdf` | Every table and column with PostgreSQL type, nullability, default, keys, foreign keys, protection and business description; enumerations, relationships, indexes, sequences, audit trigger, check constraints, encrypted and blind-indexed columns |
| Production Support Handover (IIFT-SV2-PSH, DEL-26/27) | `SalesVerse-2.0-Production-Support-Handover.docx` / `.pdf` | Support tiers, hours and SLA, incident, problem, change and release processes, escalation, monitoring and alerts, twelve runbooks, backup and DR, managed services operating model for Option B (roster, on-call, runbook equivalents, cost and SLA reporting), configuration reference, scheduled jobs, knowledge transfer, Option C source code handover and transition (8-week plan, repository handover, handover certificate, post-handover support models), developer onboarding, handover checklist, monthly report template, exit plan |
| Code Standards & Quality Report (IIFT-SV2-CSQ) | `SalesVerse-2.0-Code-Standards-and-Quality-Report.docx` / `.pdf` | Built from `evidence/`; see `README-reports.md` |
| Security Assessment Report (IIFT-SV2-SAR) | `SalesVerse-2.0-Security-Assessment-Report.docx` / `.pdf` | Built from `evidence/`; see `README-reports.md` |
| Test Strategy (IIFT-SV2-TST, DEL-12) | `SalesVerse-2.0-Test-Strategy.docx` / `.pdf` | Test levels (unit to UAT, SIT, performance, security and VAPT, regression, migration rehearsal, DR drill, operational readiness), environments and data, entry/exit criteria, defect severity and priority, roles, tooling, traceability, schedule within the 24-week plan, metrics, risks, and the status of testing on the current build (counted from `evidence/`) |
| Test Cases (IIFT-SV2-TCS, DEL-13/14) | `SalesVerse-2.0-Test-Cases.xlsx` | Read-me, Summary (formulas over the Cases sheet), Scenarios, Conditions, Cases (steps, data, expected result, level, automation, status, evidence), Defects, Traceability (RFP requirement to case), Execution log; see `README-reports.md` for how the status is produced |

## Rebuilding

Requirements: Python 3 with `python-docx`, `openpyxl` and `Pillow`; LibreOffice Writer with the `uno` Python module
for PDF export; `pdfinfo` (poppler) for page counts.

```bash
python3 docs/technical/build/build_all.py              # the whole pack, with PDFs, then the strategy/workbook drift check
python3 docs/technical/build/build_test_cases.py       # workbook only (recalculated with LibreOffice to check the formulas)
python3 docs/technical/build/build_test_strategy.py    # strategy only
python3 docs/technical/build/build_architecture.py     # one document
python3 docs/technical/build/build_data_dictionary.py --no-pdf
```

PDF export starts its own LibreOffice instance (private profile, port 2093), refreshes the table of contents and
page numbers, and writes the PDF next to the DOCX. The DOCX files contain a table-of-contents field that Word
refreshes when the document is opened.

## How the generators work

| File | Role |
|---|---|
| `build/tech_kit.py` | Shared kit for every technical document: `TechnicalWriter` (cover and header with the iorta logo, document control, running header and footer, code blocks, procedure tables), PDF export and workbook styles. It imports the proposal's `brand.py`, `docx_kit.py`, `diagrams.py` and `pricing_data.py` read-only; every commercial figure quoted in the pack (hypercare weeks, warranty, enhancement hours, cloud sizing and estimate, knowledge-transfer plan, source code deliverables, managed services scope) is read from `pricing_data.py`, so the pack cannot drift from the proposal. Use it for any further technical document. |
| `build/tech_diagrams.py` | Pillow diagrams sized to print labels at about 10 to 12 pt |
| `build/schema_model.py` | Parses `apps/api/prisma/schema.prisma` and the migration SQL; stops if a column type or nullability differs between them |
| `build/dictionary_text.py` | Business descriptions of tables, columns, enumeration values, sequences and checks; the Data Dictionary build stops if anything in the schema lacks a description |
| `build/source_facts.py` | Reads facts from the code: environment variables (`app-config.ts`), business parameters (`setting-keys.ts`), roles, permissions, API operations (`docs/api/openapi.json`), package versions, test inventory, and holds the sizing model |
| `build/sad_part1.py`, `build/sad_part2.py` | Solution Architecture content |
| `build/test_scenarios.py`, `build/test_cases_manual.py`, `build/rfp_requirements.py` | The test catalogue: areas, scenarios, conditions, hand-written cases (the executed API run, the end-to-end suite decomposed into business cases, manual UI runs with screen captures, cases that need IIFT's environment) and the RFP identifiers for traceability |
| `build/test_automated.py`, `build/test_status.py` | Derive cases from the evidence files (unit, end-to-end, security checks, API run, re-runs), join everything, number the cases, compute the counts used by both test documents and verify every reference; `verify_pack()` reads the finished DOCX and XLSX back and fails if they disagree |
| `build/collect_ui_evidence.py` | Copies the screen captures cited by the manual cases into `evidence/ui-screens` (JPEG) |
| `build/build_*.py` | One builder per document; `build_all.py` runs them all |

Because the configuration reference, parameters, roles, API list, versions and data dictionary are read from the
source at build time, rebuild the pack after every release that changes them. A schema change also needs new
descriptions in `dictionary_text.py`. Statements about items not yet built are marked "delivered during
implementation" in the documents.
